# Identity and Semester Resolution

How the server learns *who you are* without ever being told, and how "the current semester" is resolved.

---

## 1. The identity chain

```
  client's VTOP session  ──forwarded──>  server
                                            │
  POST /vtop/studentsRecord/StudentProfileAllView
  using the caller's cookies + csrf
                                            │
                                     HTML → parseStudentProfile()
                                            │
                                     registerNo  (e.g. "22BCE1234")
                                            │
                          .trim().toUpperCase()
                                            │
                    maskUserID()  =  HMAC-SHA256(ID_SALT, x) → first 16 hex
                                            │
                                     owner_key   ← internal, never leaves the server
```

### Why the response, not the request

The client sends `cookies`, `csrf` and `authorizedID`. **All three are client-controlled and none of them is an identity assertion.** A caller can put any `regNumber` in the body. What it cannot do is make VTOP return a *different* student's profile:

- cookies are valid → VTOP returns that session's own profile
- cookies are forged, expired, or borrowed → VTOP returns an error page, `parseStudentProfile` finds no `REGISTER NO` row, and the route 401s

So the owner key is derived from a value the *server* obtained from VTOP. This is the whole reason the IDOR is closed: there is no parameter through which a caller can name someone else's row.

This mirrors `cabshare/auth/route.ts`, which authenticates against VTOP before upserting, rather than `marks/sync/route.ts`, which trusts a client-supplied hash.

### `owner_key` is one-way

```ts
// ../AmazeCC-API/src/lib/mask.ts:6-11
export function maskUserID(userID: string): string {
  return createHmac("sha256", SALT).update(userID).digest("hex").substring(0, 16);
}
```

Consequences, stated plainly:

- **No plaintext reg number is stored in any table this feature creates.** `bus_students` is the only place the backend already holds real ones, and that is an admin-uploaded bus manifest.
- **`owner_key` is irreversible.** The server cannot recover a reg number from it. That is fine — nothing in this design needs to go back. If a future feature must show "your reg number" from a stored record, it must come from a fresh VTOP scrape, not from the database.
- **16 hex characters is 64 bits.** Collision-free at campus scale by a wide margin, but it is a truncation, not a full digest. If the user base ever exceeded ~10^9 the space would need revisiting.
- **`ID_SALT` must be set in the deployment's environment.** `mask.ts:4` reads it once at module load with a non-null assertion, so an unset `ID_SALT` makes `createHmac` throw at first use rather than at boot. Rotating `ID_SALT` orphans every row this feature creates.

### The reg number is a fallback chain, not a single field

The profile object has two live shapes and the frontend currently has three wrong readers:

| Source | Reg field | Name field |
|---|---|---|
| Live, from `/api/student` → `parseStudentProfile` | `registerNo` | `name` |
| Demo, from `src/data/demoData.json` | `registerNumber` | `studentName` |

Server-side normalisation mirrors `identity.ts:175`:

```ts
regNo: profile.registerNo || profile.applicationNumber || null
```

On the client, `getActiveRegNumber()` in `src/lib/social/identity.ts` must try `registerNo` → `registerNumber` → `regNo` → `regNumber` → `applicationNumber`, and `name` → `studentName`. All three of today's readers are wrong: `Main.tsx:2158` (`p?.regNo`), `socialUtils.ts:494` (`parsed?.regNumber`), `SocialTab.tsx:56-57` (`attendanceData?.studentInfo?.regNumber` on a type with no `studentInfo`).

The server never needs this chain — it parses VTOP itself. The chain exists only for local storage namespacing and for display.

## 2. The public handle

`owner_key` is internal, so there is a separate public identifier:

```
AMZ-XXXX-XXXX          4-4 characters from a 32-symbol Crockford-ish alphabet
```

- Generated once, on first successful sync, and stored in `social_people.handle` with a `UNIQUE` constraint.
- **Not derived from the reg number.** A masked reg number is not reversible, and a reversible one would leak identity through a value designed to be shown on a projector.
- Hand-typeable, so it can be read aloud or typed from a screenshot.
- Shown on the "My handle" row with a copy button, and rendered as a QR code for the in-person case.

Collision handling: generate, attempt insert, on `unique_violation` retry with a new suffix. A `UNIQUE` violation is the only expected failure and is not an error condition.

## 3. The current semester (R1) — RESOLVED, and the answer is negative

### The model

`semesterSubId` in VIT is a **calendar** semester, not a per-cohort term. Everyone on campus is in the same current one at any moment; students differ only in how many they have completed. So the server resolves it once and treats it as campus-wide.

The table is still keyed `(owner_key, semester_id)` rather than a single current row per person. That costs nothing and buys two things: a mid-term slot change versions cleanly instead of overwriting, and past terms stay browsable. If the model turns out to be per-cohort after all, the schema is already correct and no migration is needed.

### What the probe found

**The current semester cannot be read from the dropdown.** The `selected` option is always the empty placeholder:

```jsonc
{ "value": "", "text": "-- Choose Semester --", "selected": true }
```

This was the open question, and the answer is the negative one. Reading a `selected` attribute can never yield the current semester.

**The option list, however, is scrapeable** — 41 options, newest first, on `POST /vtop/academics/common/StudentCoursePage` (the endpoint `course-page/route.ts:64` already posts to, and the one `parseCoursePage()` already reads `#semesterSubId` from). `StudentTimeTableChn` also carries it. The first entries:

```
  (empty)          -- Choose Semester --   <-- always selected
  CH20262726       Fall Semester (Industry) 2026-27
  CH20262701       Fall Semester 2026-27
  CH20252607       Summer Semester 2025-26
  CH20252605       Winter Semester 2025-26
  CH20252601       Fall Semester 2025-26
  ...
  CH2019201        Fall Semester 2019-20
```

The list runs to 2019 and the option **text carries the term name**, which settles a question [02-current-state-audit.md](./02-current-state-audit.md) §5 flagged as inconsistent: `CH20262701` is "Fall Semester 2026-27", so `/api/od/route.ts`'s labelling is right and `/api/calendar`'s suffix→months mapping is the suspect one. Suffix `26` marks the Industry variant, which is why the *first* entry is not the answer for a regular student.

For the probed account the first option that returned a non-empty timetable was `CH20262701` (15 rows), which matches the current date. So "newest first" plus "first one with rows" is a reliable heuristic — but a heuristic, not a contract.

### The mechanism, now the only mechanism

Client-proposed, server-validated. Not a fallback — the primary and only path.

| Step | Behaviour |
|---|---|
| 1 | Scrape the 41-option list from `StudentCoursePage`. If it is empty or unparseable, `502 semester_list_unavailable`. Never guess. |
| 2 | Take the client's `settings.currSemesterId` and **validate it against the list**. Accept only on exact membership. |
| 3 | If the client sent nothing, take the first option with a non-empty value. Record which rule fired. |
| 4 | If validation fails, `422 semester_not_offered`. Do not fall back to anything else. |
| 5 | **After fetching the timetable, assert every returned `Class Id` starts with the resolved `semesterId`** (verified: `CH2026270102069` for `CH20262701`). A mismatch means the semester was wrong — discard rather than store. |

The last step matters because the semester now comes from the client. Step 5 is the server's independent confirmation, and it is free: `processViewTimeTable` returns class ids that embed the term, so a wrong semester produces a detectable mismatch instead of a plausible-looking wrong record.

The resolved value is cached in `app_config` under `social_current_semester` so a 200-student sync does not scrape 200 times, and refreshed on every derivation. A `/api/social/semester` route exposes it for the client's semester switch.

### The demo path

Demo mode has no VTOP session — `loginToVTOP` (`Main.tsx:418-423`) short-circuits to `{ cookies: [], authorizedID: "DEMO123", csrf: "" }`. The derivation route must detect that and return a fixture response rather than calling VTOP and failing. `SocialTab` already gates on `isDemo`; the op will bail before it and keep the existing `loadDemoData` path, with demo IDs clearly namespaced so they can never collide with real ones.

## 4. What the client stores

```
amazecc_social_identity      { ownerKey, handle, semesterId, derivedAt, slotmapVersion }
amazecc_social_grants        [ { grantId, secret, peerHandle, peerName, visibility, createdAt, semesters } ]
amazecc_social_timetables    { [ `${ownerKey}:${semesterId}` ]: { version, busyMap, courses, publishedAt } }
amazecc_social_legacy        [ Friend… ]   ← the old payload, read-only, for the deprecation window
```

`ownerKey` is cached client-side so the reader never has to re-derive its own key for a cache hit, but it is **always** treated as a cache: every route that needs identity re-derives it from the session. A tampered `ownerKey` in local storage can only cause a stale local render, never a wrong server read.

The grants file is the one piece of state that is not a cache — it holds the only copy of the grant secrets, because the server keeps only hashes. Losing it means re-pairing. It is written with the same namespacing discipline as everything else, and the old `friends_schedules` global mirror is **not** carried over.
