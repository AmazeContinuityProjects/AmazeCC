# Open Questions

## 1. Resolved

### R1 — Can the server determine the current calendar semester? **No.**

The `selected` option on VTOP's `#semesterSubId` dropdown is **always the empty `-- Choose Semester --` placeholder**. Reading a `selected` attribute can never yield the current semester.

The option *list* is scrapeable — 41 entries, newest first, on `POST /vtop/academics/common/StudentCoursePage` — so it serves as the validation set. The mechanism is therefore **client-proposed, server-validated**, and it is no longer a fallback: it is the only path. Backed by a post-fetch assertion that every returned `Class Id` starts with the resolved semester.

Full detail in [03-identity-and-semester.md](./03-identity-and-semester.md) §3.

### R2 — What is the real cell layout of `/vtop/processViewTimeTable`? **Resolved, and the assumption was wrong.**

The design assumed `"<slots> / <venue>"`. The live format uses **`" - "` as a space-delimited separator**:

```
"L31+L32+L37+L38 - AB1-607B"
```

Splitting on `/` would have produced a busy map of invalid keys that ingest would reject wholesale. Also learned:

- `Course` is `"<CODE> - <Title> ( <Type> )"`, so the **course code is real** and the **component type is explicit** (`Lab Only`, `Embedded Theory`, `Embedded Lab`) rather than inferred from whether a slot id starts with `L`.
- `Class Id` is the semester code plus a sequence (`CH2026270102069` for `CH20262701`), which gives a free self-check on the resolved semester.
- The option text settles the suffix→term inconsistency: `CH20262701` is "Fall Semester 2026-27".

Full detail in [05-server-derivation.md](./05-server-derivation.md) §2.

### Also found while probing

- **`node --env-file` silently truncates an unquoted `#`.** The `VTOP_PASSWORD` in `../AmazeCC-API/.env` ended in `#` and was parsed as 27 characters instead of 28, so VTOP received the wrong password and rejected it. The value is now double-quoted. No application code reads `VTOP_PASSWORD`, so the running API was never affected — but any future server-side VTOP work would have hit this. Worth a comment next to the variable.
- **The `Slot/ Venue` column is never parsed today.** `fetchTimeTable.ts` stores the raw `"L31+L32+L37+L38 - AB1-607B"` as `slotVenue` and nothing downstream splits it, so the venue is only ever displayed and no consumer can derive slot ids from that field. The frontend gets slot ids from `attendance[].slotName` instead, which is why this has gone unnoticed.
- **The `Course` cell is a better component discriminator than the slot id.** `fetchTimeTable.ts` infers theory-vs-lab from whether a *slot* begins with `L`, which misclassifies `F1+TF1` (an **Embedded Theory** course). The `Category` column states it directly.

## 2. Non-blocking, needs a decision

### Visibility is a read-time redaction, not a storage-time one

The server stores the full record and strips fields when serving a `coarse` grant. This genuinely protects against *other students*, which is the real peer threat. It does **not** protect against the server operator or a full database compromise.

If the requirement is that the server cannot read any timetable, the whole model changes and needs a KMS. That was explicitly rejected in [06-grants-and-pairing.md](./06-grants-and-pairing.md) §6 — worth confirming that is still the right call now that the privacy consequence is spelled out.

### Either participant can raise visibility to `full`

Because a grant is one row, there is no per-direction visibility, so the more permissive setting wins. Neither partner can unilaterally hide from the other, which keeps the pairing coherent — but it does mean A cannot prevent B from seeing venues.

Alternative: a per-direction column, at the cost of reintroducing direction into the model. **Recommended:** keep as designed, and say so plainly in the consent copy.

### Pairing has no accept step

Claiming *is* consenting, which removes a pending state, a notification, a timeout and a decline path. The cost is that the consent screen carries the entire burden of making mutuality obvious. **Confirm** that this is preferable to a request/accept flow.

### Semester retention

Keyed `(owner_key, semester_id)` and versioned, so past terms are browsable. Proposed: keep current plus one previous, purge older. Not yet decided, and it interacts with the phase-6 timing.

### Groups

Treated as a client-side view over the grant list, so there is no server-side group entity. This avoids a second source of truth but means a group cannot be shared between two devices as a named object — each device derives it from its own grants, so a group whose membership differs across devices will look different on each. **Confirm** that is acceptable, or decide groups become a server entity.

## 3. Known issues outside this scope

Found during the audit, not caused by this work, worth separate issues:

1. **`marks/sync` is fully unauthenticated** and writes to a statistics store keyed on an unverified, unsalted, browser-computed hash of a login id. Its `timestamp` is client-supplied and unvalidated, so `9e15` locks out legitimate updates permanently. `marks/stats` is equally open. (`AmazeCC-API/src/app/api/marks/sync/route.ts:34-45`, `marks/stats/route.ts:34-58`)
2. **`proxy.ts` reflects any Origin with `Access-Control-Allow-Credentials: true`.** Needs a real allowlist.
3. **`ADMIN_SECRET` and `ID_SALT` share a value** in the current `.env`, so the admin signing key and the student-identity salt are not independent. Rotate both.
4. **`cabshare` authenticates by query parameter.** `cabshare_users.reg_number` is a misnomer for `authorizedID`, and its own comment admits *"In a real app we'd sign a JWT here."* Every cabshare route reads identity from `?reg_number=`.
5. **`class_data` is dead** — writer commented out at `marks.ts:80-133`, so `GET /api/attendance?classId=` always 404s. Its `PRIMARY KEY` on `class_id` would also collide across semesters, since a VTOP class number is only unique within one.
6. **`shadow-2xs` is not defined in this project** and is used in 20+ files. `no-scrollbar` and `scrollbar-none` are likewise dead; `hide-scrollbar` is the working class.
7. **The API repo has no test runner.** No `test` script, no runner in dependencies, no test files; CI runs `lint` and `build` only, with no typecheck step of its own.
8. **`v5` is emitted for "permanent" shares.** `expiryMinutes: 0` falls through to the `v5` branch (`ShareScheduleModal.tsx:180`), so the never-expiring option produces a code with no expiry field.
9. **The semester suffix→term mapping is inconsistent.** `/api/od/route.ts:36-37` calls `CH20262701` "Fall Semester 2026-27"; `/api/calendar/route.ts:61-100` treats suffix `01` as July–November. **Partly resolved by the probe:** VTOP's own option text confirms `CH20262701` = "Fall Semester 2026-27", so `/api/od` is right and `/api/calendar`'s inline month mapping is the suspect one. The full list also reveals variants the codebase never handles — `CH20262726` "Fall Semester **(Industry)** 2026-27", `CH20252614` "Fall Semester **LLM** 2025-26", `CH20222325` "Fall **Inter** Semester 2022-23", and several LAW-specific codes. A clean parse of the option text is now available if the calendar mapping is ever fixed.
10. **The password in `../AmazeCC-API/.env` has been fixed.** It ended in an unquoted `#`, which `node --env-file` truncated, so the probe sent a 27-character password. Now double-quoted. If the password is ever rotated, keep the quotes.
12. **The `Slot/ Venue` column is never parsed today.** `fetchTimeTable.ts` stores the raw `"L31+L32+L37+L38 - AB1-607B"` as `slotVenue` and nothing downstream splits it, so the venue is only ever displayed and no consumer can derive slot ids from that field. The frontend gets slot ids from `attendance[].slotName` instead, which is why this has gone unnoticed.

## 4. Deliberately not designed

Listed so it is a decision rather than an omission.

- **Realtime or push updates.** Sync is pull-based on the global sync, like every other module. A peer who syncs mid-morning appears immediately; one who does not does not.
- **Server-side groups.** See §2.
- **Cross-institution sharing.** The slot vocabulary is VIT-specific and `config.json` is the only source.
- **Historical "who was free last term".** The schema permits it; no view is designed for it.
- **Sharing with people who do not use the app.** A non-user has no record to read, so the feature is useless to them. Adding a read-only web share is a separate feature with a separate threat model.
