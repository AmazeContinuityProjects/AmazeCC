# Current State Audit

Every claim below was verified against the working tree. Paths are relative to each repo root. This doc exists so that design decisions can be challenged against evidence rather than recollection.

---

## 1. Backend: the endpoint does not exist

| Check | Result |
|---|---|
| `AmazeCC-API/src/app/api/social/` | Does not exist |
| Any `route.ts` with "social" in its path | None (135 route directories, 222 `route.ts` files) |
| Any table holding friends or groups | None. All 21 `CREATE TABLE` statements enumerated; nearest are `cabshare_users`, `club_representatives`, `push_subscriptions` |
| `ROUTE_TRACKER.md` / `README.md` mention of `/api/social/*` | None |

Both client calls therefore return **404**, and because both wrap everything in a bare `catch {}` (`socialUtils.ts:526, 567`) the failure is invisible in the UI, the console, and the server log.

The one trace of this feature in the backend is `AmazeCC-API/src/lib/socialUtils.ts` — 206 lines, **unreferenced**, containing no `fetch`, no `axios`, and no `/api/social/sync` string. It is a copy of the frontend's browser-only `localStorage` helper, committed accidentally during the Express → Next.js migration. It is also **stale**: its `exportScheduleCode` emits the old pipe-delimited `v5` format while the frontend has moved to `v6` with expiry, and its `getFriends()` takes no argument while the frontend's is per-user.

## 2. Backend: no timetable is ever persisted

`AmazeCC-API/src/lib/fetchTimeTable.ts` scrapes `POST /vtop/processViewTimeTable` and returns `courseItem[]`. It imports only `cheerio`, `VTOPClient`, `URLSearchParams` and a type — **it does not import `@/lib/db`**, so it is structurally incapable of writing. Its two callers pass the result straight through:

- `src/app/api/timetable/route.ts:57-60` → `NextResponse.json({ success: true, semesterId, courseInfo })`
- `src/app/api/attendance/route.ts:176-185` → builds a `courseCreditMap` and discards the rest

There is no cron or background job that stores timetables. `src/app/api/cron/` contains exactly one file, `reminders/route.ts`, which is a VITOL web-push notifier.

**The server also cannot obtain one unaided.** It holds no VTOP credentials by design — every route forwards the caller's `cookies` + `csrf` and proxies. That is what makes the "client authenticates, server derives" model in [01-overview.md](./01-overview.md) necessary rather than merely convenient.

### The two `config.json` copies had already drifted

`AmazeCC-API/config.json` and `AmazeCC/config.json` are separate files with the same two keys (`semesterIDs`, `slotMap`). At the time of the audit the server's copy was **stale and missing data the client had**: it had no `S8B` or `S10B`, and its `S8`/`S10` were an hour off (`12:35-1:25` versus the client's `11:40-12:30`).

Nothing detected it because the server's copy had **zero importers** — it was referenced only by the dead `src/lib/socialUtils.ts`, so no code path could notice. A stale server vocabulary would have rejected any weekend seminar slot at ingest as an unknown key.

The copies are now synced and `src/lib/socialVocabulary.ts` is the single place on the server that reads it, which makes the divergence detectable. `SLOTMAP_VERSION` is a hash of the vocabulary, the client sends its own, and a mismatch is rejected. Any future change to the frontend `config.json` slot map must be copied in the same commit.

## 3. Backend: no per-student identity

There is no students table. 43 tables were enumerated; none is a registry.

| Table | Column | Reality |
|---|---|---|
| `cabshare_users` | `reg_number` | Misnamed. `cabshare/auth/route.ts:93` binds `authorizedID` (the VTOP login id) into it, not the Register No. Its own comment at `:98` reads *"In a real app we'd sign a JWT here. For this implementation, the frontend will pass reg_number as auth."* Every subsequent cabshare route reads identity from a query parameter. **Do not copy this pattern.** |
| `club_representatives` | `vtop_id` | Plaintext VTOP id, but only for club reps |
| `push_subscriptions` | `user_id` | Untyped client string, no FK |
| `bus_students` | `registration_number` | Real reg numbers, but an admin-uploaded bus manifest with no name, program or semester |

`class_user_hashes` is the only table with a per-student key, and it is not a registry: `marksSync.ts:91-97` computes **unsalted SHA-256 in the browser** over the raw login id, and `marks/sync/route.ts:34-45` accepts it from the body with **no auth call at all**.

`class_data.class_id` is keyed on the VTOP class number. **Correction to an earlier reading of this file:** those class ids are *not* scoped to a semester. The probe returned `CH2026270102069`, `CH2026270102407` and `CH2026270102460` for semester `CH20262701`, so the id is the semester code followed by a sequence number and is globally unique. The `PRIMARY KEY` is therefore safe, and `marks/sync` rows for one semester will not collide with another.

## 4. Backend: `class_data` is dead, and it reveals the intended design

`class_data` is created only by `POST /api/admin/migrate` (`admin/migrate/route.ts:95-102`) and its writer is **commented out** at `marks.ts:80-133`:

```ts
// await AddClassData(course.classNbr, maskUserID(authorizedID), Math.ceil(validatedComponent.totalWeightageMark));
```

Its only live consumer, `GET /api/attendance?classId=`, therefore always 404s. Those dead lines are the closest existing thing to this feature: server-side, salted, per-student, verifiable identity. `maskUserID` (`src/lib/mask.ts:6-11`) is defined, wired to `ID_SALT`, and called from nothing else.

## 5. Backend: "current semester" is not a server concept

- Every semester-scoped route destructures `semesterId` from the request body. `/api/od/route.ts:87-94` is the strictest and simply 400s without it.
- `config.json` contains a `semesterIDs` array, but **no server code reads it** — it is dead on the backend. The array is also a flat, unordered list of 9 codes with no dates and no "current" flag.
- `/api/all-grades/route.ts:75-88` *guesses* codes by parsing a 2-digit year out of the authorized id.
- `/api/calendar/route.ts:61-100` hardcodes a suffix→months academic calendar inline, defaulting `startYear` to the magic string `"2024"`.
- **No table has a `semesterId` column anywhere.**

The only place the server ever sees the set of valid semesters is by scraping `#semesterSubId option` out of a per-request VTOP page (`qcm-view/route.ts:185-195`, and three parsers with the same boilerplate).

Note that `/api/od/route.ts:36-37` labels `CH20262701` as "Fall Semester 2026-27" while `/api/calendar` treats suffix `01` as July–November. The suffix→term semantics are inconsistent and undocumented.

## 6. Backend: auth, and what "club auth" actually does

`AmazeCC-API/src/lib/clubAuth.ts` **does not call VTOP and does not derive a registration number.** It is 125 lines of stateless HMAC-SHA256 token verification (`base64(payload).signature`, 7-day expiry, `timingSafeEqual` at `:67-69`). It reads only `Authorization: Bearer`.

`signClubToken` is called from exactly one place, `login/route.ts:155`, and its identity argument is scraped server-side from the VTOP dashboard with Cheerio:

```ts
let authorizedID: string =
    (String($('#authorizedID').val() ?? "") || String($('input[name="authorizedid"]').val() ?? ""));
if (!authorizedID) { authorizedID = username.toUpperCase(); }
```

The closest structural precedent to the new route is `cabshare/auth/route.ts`: authenticate against VTOP, derive identity, upsert to Postgres. Its one flaw is the `reg_number` misnaming described in §3.

`src/lib/auth.ts` is admin-only and identifies no student. There is **no student session, no student JWT, and no student token of any kind** anywhere in the backend.

## 7. Backend: the VTOP call this design needs

`/vtop/studentsRecord/StudentProfileAllView` returns HTML parsed by `parseStudentProfile`. Relevant parser lines:

```ts
// src/lib/parsers/student-profile.ts:81
if (L.includes("APPLICATION NUMBER")) profile.applicationNumber = value;
// :106
else if (L.includes("REGISTER NO")) profile.registerNo = value;
```

and the canonical normalisation at `src/lib/identity.ts:175`:

```ts
regNo: profile.registerNo || profile.applicationNumber || null,
```

The same scrape pattern for semester selection exists at `qcm-view/route.ts:185-195`. `getVtopReferer()` from `src/lib/clients/VTOPClient.ts:15-17` is the env-aware Referer helper the new route should use.

## 8. Frontend: the social data model

`src/lib/socialUtils.ts` is 651 lines and imports **zero** design tokens — its `TILE`/`LIST_SHELL`/`LIST_ROW`/`ICON_BUTTON` strings are hand-copied from `src/lib/libraries/ui.ts`.

Types (`socialUtils.ts:14-40`):

```ts
export type FriendClassSlot = { day: string; timeSlot: string; courseCode: string;
                                courseTitle: string; venue: string; slotId: string };
export type Friend = { id: string /* === regNumber */; name: string; nickname: string;
                       regNumber: string; classSlots: FriendClassSlot[]; color: string;
                       addedAt: string; showInFriendsSchedule: boolean; showInHomePage: boolean };
export type FriendGroup = { id: string; name: string; friendIds: string[]; createdAt: string };
```

Structural defects:

- **No `semesterId`.** A stored timetable cannot be attributed to a term.
- **No `lastSyncedAt`, no `source`, no `schemaVersion`.** Nothing can detect or invalidate a stale record.
- `id` and `regNumber` are the same value, denormalised with a comment admitting it.
- `showInFriendsSchedule` is written and never read anywhere; only `showInHomePage` is consumed (`AttendanceTabs.tsx:105`).
- `day` is `"Monday"` for v5/v6/amz/v3/v2 and raw for v1 — two conventions inside one type.
- Three incompatible `timeSlot` conventions are in circulation: `config.json` uses `"8:00-8:50"`, the demo data uses `"08:00 AM - 08:50 AM"` (`SocialTab.tsx:96`), and v1 imports raw strings.

### Local storage

`socialUtils.ts` bypasses `src/lib/storage.ts` and writes `localStorage` raw, using a **namespaced key plus an unconditional global mirror**:

```ts
// socialUtils.ts:595-597
const key = reg ? `friends_schedules_${reg}` : "friends_schedules";
localStorage.setItem(key, JSON.stringify(friends));
localStorage.setItem("friends_schedules", JSON.stringify(friends));
```

The global mirror leaks the last-touched student's friends to any other account on the same browser, and `getFriends()` with no active reg returns that leak. `src/lib/storage.ts:43-44` declares `FRIENDS_SCHEDULES`/`FRIENDS_GROUPS` with typed accessors at `:296-305` that `socialUtils` never uses — two sources of truth. The `_${reg}` variants have no accessor at all.

`saveFriend`/`removeFriend`/`saveFriendGroup`/`removeFriendGroup` also have **no SSR guard**, unlike the getters, so they would throw in a server component.

A parallel, unrelated friend store exists for FFCS: `ffcs_friends`/`ffcs_friendGroups` (`storage.ts:57-58`) with a *different* `Friend` shape (`{ id, name, timetables: TimetableState[] }`). Watch for name collisions.

## 9. Frontend: the share-code codec, and two latent bugs

`v6|<expiresAtSec>|<name>|<regNumber>|<titles ";">|<assignments>`. Assignments are 3-char chunks — a 2-char base36 index into a 164-entry slot list, then a 1-char base36 course index.

**Bug 1 — the wire format is only decodable by a byte-identical `slotMap`.** The 164-entry list is built by iterating days in order and sorting slot ids *lexicographically* within each day. Any rename, addition or removal shifts every subsequent index, so a `config.json` edit silently re-maps every code ever minted. The new model's `(day, slotId)` keys remove this class of bug entirely.

**Bug 2 — course indices break at 36.** `courseIdx.toString(36).substring(0, 1)` (`socialUtils.ts:101`) truncates, so a 37-course student gets two courses mapped to the same index on import.

Also: `compressScheduleCode` is base64url, not compression, and *lengthens* the payload (103 → 138 chars). A handle is 11 characters.

Six import formats are accepted: `v6|`, `v5|`, `amz-profile-`, `v3|`, `v2|`, and a v1 pipe branch. Only v1 and v2 carry venue; v5/v6 push `courseCode: ""` and `venue: ""`.

## 10. Frontend: the slot-matching bug this design fixes

`CommonFreeSlotsGrid.tsx:68-80` builds a friend's grid by **ignoring `slot.day` entirely** and re-fanning-out `slot.slotId` across all seven days:

```ts
friend.classSlots.forEach((slot) => {
  days.forEach((day) => {
    if (slotMap[day]?.[slot.slotId]) friendsGrid[friend.id][day][slot.slotId] = slot.courseTitle || true;
  });
});
```

For v5/v6 friends this is harmless because the importer already emitted one entry per `(day, slotId)`. For v1/v2/v3/`amz-profile-` friends — where `day` is meaningful — it marks the friend busy on days they are not in class. `A1` exists on both Monday and Wednesday, so this fires for every theory block. See [09-schedule-math.md](./09-schedule-math.md).

## 11. Frontend: sync engine

- `registerOp({ name, auth, run, critical?, dependsOn? })` — `operation-registry.ts:13-19`. `critical` and `dependsOn` are **never read** by any code.
- `ctx.request(path, body?, opts?)` has **no `query` and no `parse` option**; `auth: "vtop"` merges the session into the body. `apiRequest` (exported as `api`) is the other client and does have `query`/`parse`, but it is not `ctx.request`.
- `ctx.bridge.setAtom` writes **jotai atoms only** — it does not touch `localStorage`.
- `syncEngine.syncAll()` and `useSync` are **dead code**. The real global sync is `handleReloadRequest` (`Main.tsx:605-879`), with hardcoded op chains at `Main.tsx:519-541` and `Main.tsx:796-870`. `BACKGROUND_OPS` feeds `syncAll` and updating it alone achieves nothing.
- `socialUtils.ts:514,535` read `process.env.NEXT_PUBLIC_API_BASE_URL`, which is **defined nowhere in the repo**, and pass absolute URLs, which short-circuits `apiRequest`'s `API_BASE` (`request-layer.ts:166-171`). This violates the rule in `docs/sync-engine/00-overview.md:5`.

## 12. Cross-cutting

- `SocialTab` is mounted twice, by `MoreTab.tsx:33` and `ToolsTab.tsx:134`, so two independent copies of the state exist and the sub-tab resets when switching between them.
- `SocialTab.tsx:56-57` reads `attendanceData?.studentInfo?.*`, but `attendanceRes` (`src/types/data/attendance.d.ts:36-40`) has no `studentInfo` field. `studentName` is always `"Student"` and `studentReg` always `"VIT Student"`.
- The profile object has two live shapes: `/api/student` → `registerNo` + `name`; `src/data/demoData.json` → `registerNumber` + `studentName`. `Main.tsx:2158` reads `p?.regNo`, which is neither.
- `SocialTab.tsx:230-240` fabricates the "% match" and "free hrs" figures shown on every friend row from a character hash of the reg number, with `totalPossibleSlots = 35` hardcoded.
- `SocialTab.tsx:596-645` nests `<span role="button">` inside a `<button>`, which is invalid HTML; the surrounding `e.stopPropagation()` calls are the symptom.
- Eight `alert()` calls and two `confirm()` calls stand in for validation and confirmation.
- Four utility classes used by the feature do not exist in the project: `shadow-2xs`, `no-scrollbar`, `animate-in fade-in`, and `animate-slideUp` (a typo for the real `animate-slide-up`).
