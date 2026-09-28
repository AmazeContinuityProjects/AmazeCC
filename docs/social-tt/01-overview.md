# Overview

- **Status:** Designed, not implemented
- **Mode:** Server-derived timetables with mutual pairing grants, semester-scoped, opt-in
- **Repos:** `AmazeCC` (frontend), `../AmazeCC-API` (backend)

---

## 1. The problem

The Social tab lets students see when their friends are free so they can plan together. It has been built entirely client-side, and that choice has produced three compounding problems.

**The server is a blind pass-through nobody uses.** `socialUtils.ts:505-527` and `:529-571` call `POST /api/social/sync` and `GET /api/social/sync?regNumber=…`. **Neither endpoint exists in `../AmazeCC-API`.** There is no `src/app/api/social/` directory, no `route.ts` containing "social", and none of the 21 `CREATE TABLE` statements in that repo relates to friends or groups. The POST additionally never fires at all: `getActiveUserRegNumber()` (`socialUtils.ts:488-503`) looks for `profile.regNumber` and `attendance.studentInfo.regNumber`, but the live profile object uses `registerNo` and the demo profile uses `registerNumber` — three different names, so it returns `""` and `syncSocialToCloud` early-returns at `:508`.

**Every client is a full replica of everyone's timetable.** A friend's `classSlots[]` is a copy that was uploaded by *their* device. Your device holds it, re-uploads the entire array on every add/remove/toggle, and cannot know whether it is current.

**The model is unauthenticated and cannot express consent or deletion.** The merge is last-write-wins by `id` with remote winning (`socialUtils.ts:539-546`), so **removing a friend on device A resurrects them on device B**. There is no `semesterId` anywhere in `Friend`, so a stored timetable cannot be attributed to a term and goes stale invisibly. There is no `lastSyncedAt`, so nothing tells a user the data they are looking at is a year old.

## 2. The shape of the solution

The client authenticates with the VTOP session it already holds. The **server** does all the deriving, persists the result, and becomes the only source every other read consults.

```
person ──(VTOP session)──> /api/social/identity/sync
                            ├─ VTOP StudentProfileAllView      → registerNo
                            ├─ VTOP dashboard/menu             → current calendar semesterId
                            └─ VTOP processViewTimeTable(sem)  → timetable + course allocation
                            └─ UPSERT, return { handle, semesterId, busyMap, courses }

any person ──(handle)──> /api/social/pair/claim
                          └─ server mints a shared signed grant, both sides hold it

any person ──(grant secret)──> /api/social/timetable?handle=…&semester=…
                            └─ database lookup, filtered by the grant's visibility setting
```

The steady state is fully server-derived. Nothing is wrong with a client because it has an old copy, and a friend changing a slot does not require them to message anyone.

## 3. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where the timetable lives | Server database | Kills the N-copies problem, makes deletion authoritative, makes consent expressible |
| Who derives it | Server, from the forwarded VTOP session | The client cannot be trusted to publish its own occupancy honestly; the server scraping removes client-side busy-map construction and the possibility of forgery |
| Credential storage | **Not stored.** Transient, used for one derivation, discarded | Storing VTOP sessions server-side would be a materially larger breach. The session is already the thing every other route in this API forwards |
| Identity | `maskUserID(registerNo)` — HMAC-SHA256 over `ID_SALT` | Already exists in `../AmazeCC-API/src/lib/mask.ts` and is **called from nothing** except two commented-out lines in `marks.ts`. It is the abandoned remnant of the design this doc reinstates |
| Public identifier | Opaque handle `AMZ-XXXX-XXXX`, server-generated | Must be hand-typeable and safe to show on a screen. A masked reg number is not reversible, so it cannot be a public handle |
| Pairing direction | **Mutual, both directions, one grant** | A one-way "follow" would need two grants and two revocation paths for no benefit. `least()/greatest()` on the participant pair makes one grant per pair structurally |
| Semester | Calendar semester, campus-wide, server-resolved | VIT's `semesterSubId` is a calendar term, not a per-cohort term. Keyed `(owner_key, semester_id)` anyway so a mid-term change versions cleanly and the schema survives if the model turns out to be per-cohort |
| Reader's semester | The server's current semester, with a visible badge | Follows from the decision above. The viewer's existing global semester switch pins everyone at once |
| Visibility | Per-grant `coarse` or `full`, owner's choice | Coarse is slot occupancy only; full adds course, code and venue |
| Comparison math | Client-side | Two small `(day, slotId)` sets. No round trip, and it works against cache while offline |
| Push trigger | Global sync button **and** a ~5s debounced auto-push | The button is the explicit path the user asked for; the debounce keeps the UI feeling instant without a round trip per click |
| Existing friends | Kept read-only with a re-share prompt | They cannot become verified server records. Nothing is lost, nothing silently wrong |
| Timetable feature model | Flat signed grants; no per-pair encrypted secret | See §4. A per-pair key would need key management that has no home in this API, and adds no capability the grant lacks |

## 4. Why a shared secret per pair is not used

A tempting design is a symmetric key per pair, so the server never sees either timetable. It was rejected: the server must *store* timetables anyway, so it already holds the plaintext, and per-pair key management would need a KMS, a rotation story, and a revocation path per pair. The grant secret achieves the property that actually matters — **a peer can only read you if you explicitly paired with them, and revoking severs it in both directions** — without inventing infrastructure. If server-blindness is ever a requirement, that is a separate project, not a variation on this one.

## 5. Non-goals

- Location tracking. Coarse mode exists precisely so the default share does not publish where someone is.
- Class-level or cohort-level sharing. Grants are person-to-person only.
- Organising people into server-side groups. A "group" becomes a client-side view over the grant list, so there is no second source of truth.
- Editing someone else's timetable, or any write path other than publishing your own.
- Server-side VTOP session storage, or the server acting on a student's behalf after they disconnect.
- Multi-device realtime push. Sync is pull-based on the global sync, as with every other module.

## 6. What gets deleted

Server derivation makes the timetable-transfer codec obsolete, because a handle replaces it.

| Deleted | Location | Lines |
|---|---|---|
| `exportScheduleCode` | `socialUtils.ts:50-118` | 69 |
| `compressScheduleCode` | `socialUtils.ts:121-134` | 14 |
| `decompressScheduleCode` | `socialUtils.ts:136-153` | 18 |
| `exportShareableLink` | `socialUtils.ts:155-169` | 15 |
| `syncSocialToCloud` / `pullSocialFromCloud` | `socialUtils.ts:505-571` | 67 |
| v1 / v2 / v3 / `amz-profile-` import branches | `socialUtils.ts:304-453` | 150 |
| `AmazeCC-API/src/lib/socialUtils.ts` | unreferenced dead copy | 206 |

**Kept for one deprecation window:** `importScheduleCode`'s v6 branch, so codes already shared in the wild still resolve. After the window, the whole codec goes.

Note that `compressScheduleCode` is not compression — it is base64url, and it makes links *longer* (a 103-character token becomes 138). A handle is 11 characters.

## 7. Design language

Per [11-ui-redesign.md](./11-ui-redesign.md), the tab is rebuilt on the tokens promoted out of `src/lib/libraries/ui.ts` into `src/lib/design/tokens.ts`, matching the Libraries and Simplified Mobile Home grammar: `rounded-[24px]` hero tiles, `rounded-2xl` divided list shells, zinc borders, `font-outfit` numerals, at most three semantic hues plus indigo.
