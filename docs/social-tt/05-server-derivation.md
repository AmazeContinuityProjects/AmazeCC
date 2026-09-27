# Server Derivation

The client authenticates. The server does every VTOP call, builds the busy map, and persists the result. No timetable ever travels from one student's device to another's.

---

## 1. Call sequence

One HTTP request in, four VTOP calls out, one upsert:

```
POST /api/social/identity/sync     { cookies, authorizedID, csrf, proposedSemesterId? }

  1. rate limit                        checkRateLimit(`social-sync:${ip}`, 20, 60_000)
  2. validate body                     400 if !csrf || !authorizedID
  3. VTOP identity                     POST /vtop/studentsRecord/StudentProfileAllView
                                       → parseStudentProfile(html)
                                       → registerNo ?? applicationNumber
                                       → 401 if neither            ← the trust boundary
  4. owner_key                         maskUserID(regNo.trim().toUpperCase())
  5. VTOP semester list                POST /vtop/academics/forms/StudentSemesterSubIdSelection
                                       → parse #semesterSubId option list
                                       → selected ?? validate(proposedSemesterId) ?? 422
  6. VTOP timetable                    POST /vtop/processViewTimeTable  (semesterSubId = resolved)
                                       → build busy_map + courses
  7. validate against vocabulary       400 on any unknown "DAY:SLOTID"
  8. upsert                            social_people + social_timetables, version = version + 1
  9. cache the resolved semester       app_config['social_current_semester']
 10. respond                           { handle, semesterId, semesterLabel, busyMap, courses,
                                        slotmapVersion, derivedAt, peers[] }
```

Steps 3 and 5 are sequential because step 6 is scoped to `(authorizedID, semesterSubId)` and there is no batch endpoint. Step 4 can be skipped when the caller's `owner_key` cache is present and a cheap probe confirms the session is still live, but on the sync path it is always recomputed — a cached key is a cache, never an authorisation.

### Why the server, not the client

The client already holds the raw attendance rows. It could build the busy map itself and upload it. It is not allowed to, for three reasons:

1. **Honesty.** A busy map is the input to "is this person free right now". If the client supplies it, a modified client can claim to be free during a class. Deriving it from VTOP removes the possibility.
2. **Validation.** Only the server can reject an out-of-vocabulary slot at write time. A client that submits a payload cannot be trusted to have checked, and the check has to happen before persistence to be worth anything.
3. **Cost.** The server is the only party that can do it once per person rather than once per *reader*. Under the old model, N students each upload N timetables; under this one, each student uploads one and the server serves the rest.

## 2. The timetable parser — R2 RESOLVED

**Resolved by the probe against live VTOP.** The endpoint is `POST /vtop/processViewTimeTable` and the table is `table.table`, 12 columns, identified by header name:

| # | Header | Sample value |
|---|---|---|
| 0 | `Sl.No` | `1` |
| 1 | `Class Group` | `General (Semester)` |
| 2 | `Course` | `BACSE102 - Problem Solving Using Java ( Lab Only )` |
| 3 | `L T P J C` | `0 0 4 0 2.0` |
| 4 | `Category` | `University Core Courses` |
| 5 | `Course Option` | `Regular` |
| 6 | `Class Id` | `CH2026270102069` |
| 7 | `Slot/ Venue` | `L31+L32+L37+L38 - AB1-607B` |
| 8 | `Faculty Details` | `SHEENA CHRISTABEL PRAVIN - SENSE` |
| 9 | `Registered / Updated Date & Time` | `08-Jul-2026 08:50` |
| 10 | `Attendance Date/ Type` | `09-Jul-2026 - Manual` |
| 11 | `Status & Ref. No.` | `Registered and Approved` |

### The separator is `" - "`, not `"/"`

**This is the correction that mattered.** The design originally assumed `"<slots> / <venue>"`. The live format is:

```
"L31+L32+L37+L38 - AB1-607B"   →   slots: L31, L32, L37, L38   venue: AB1-607B
"F1+TF1 - AB1-609"              →   slots: F1, TF1             venue: AB1-609
"L11+L12 - AB1-607B"            →   slots: L11, L12             venue: AB1-607B
```

Splitting on `"/"` returns the whole string as a single "slot", which would produce a busy map full of keys that do not exist in the vocabulary and be rejected at ingest. The correct parse is:

```ts
const [slotPart, venue] = cell.split(/\s+-\s+/);
const slotIds = slotPart.split("+").map(s => s.trim()).filter(Boolean);
```

Note the separator is surrounded by whitespace in every observed sample, so a naive `split("-")` would also be wrong (it would break on the hyphens inside slot ids such as `S8B`, and on venue names like `AB1-607B`).

### The course code is real, and the component type is explicit

`cells[2]` is `"<CODE> - <Title> ( <Type> )"`, so both are directly available:

```ts
const m = /^([A-Z0-9]+)\s+-\s+(.*?)\s*\(\s*([^)]+?)\s*\)$/.exec(cell2);
const code = m?.[1];      // "BACSE102"
const title = m?.[2];     // "Problem Solving Using Java"
const componentType = m?.[3]; // "Lab Only" | "Embedded Theory" | "Embedded Lab"
```

This is better than the existing `fetchTimeTable.ts`, which synthesises the code as `cells[2].split(" ")[0] + "(L)"` — that happens to recover `"BACSE102"` as the first token, then appends a component marker, producing `"BACSE102(L)"`, which is not a VTOP course code. Worse, it infers theory-vs-lab from `cells[7].startsWith("L")`, i.e. whether the *slot* begins with `L`. That is wrong for `F1+TF1` (a theory-plus-tutorial slot for an **Embedded Theory** course) and right only by accident for genuine lab slots.

### `Category` is NOT the component type — a correction

An earlier draft of this doc claimed the `Category` column was "the authoritative theory/lab discriminator". **That is wrong**, and the end-to-end test caught it: the column contains a *course taxonomy*, not a component marker.

Observed against a real account, 13 course components:

| Field | Source | Values seen |
|---|---|---|
| `category` | the `Category` column | `University Core Courses`, `Programme Core Courses`, `Open Elective Courses`, `Concentration (CON Basket)`, `University Core Courses (GENERAL Basket)`, `University Core Courses (GENERAL Basket) Programme Core Courses`, `University Core Courses (LANGUAGE Basket)` |
| `componentType` | parenthesised suffix of the `Course` cell | `Theory Only`, `Lab Only`, `Embedded Theory`, `Embedded Lab`, `Online Course`, `Soft Skill` |

The two vocabularies are **disjoint**, and the E2E test asserts that they stay disjoint so the columns can never be confused again. `componentType` is the theory/lab signal; note it is broader than theory-vs-lab, since `Online Course` and `Soft Skill` are neither.

A course appears once per component, so one `code` legitimately has several rows with different `componentType`, `classId` and `venue` — 9 codes across 13 components on the probed account. `classId` is the dedupe key for that reason.

### `"NIL"` is a real venue sentinel

Not every enrolled component occupies a slot. An **Online Course** is listed with its `Slot/ Venue` cell effectively empty and its venue reported as the literal string `"NIL"`, and it therefore contributes **no** `busy_map` entries — which is correct, because a component with no slot is not in anyone's timetable.

On the probed account, 12 of 13 components occupy slots and one (`ACFOC309`, `Online Course`) does not. The end-to-end test asserts that any course missing from the `busy_map` is only ever a slotless one, so a regression that silently dropped real slots would fail rather than pass quietly. Clients must likewise not treat a course with `venue === "NIL"` as a data error.

### `Class Id` embeds the semester

`CH2026270102069` for semester `CH20262701` — the id is the semester code plus a sequence. All sampled rows shared the prefix. Two uses:

1. **A self-check on the derivation.** If the returned `Class Id`s do not start with the requested `semesterSubId`, the semester was wrong and the derivation should be discarded rather than stored.
2. `marks/sync` is keyed on `class_id`, and because the id is semester-qualified those rows cannot collide across semesters (this corrects an earlier reading in [02-current-state-audit.md](./02-current-state-audit.md) §3).

### Fan-out: why `day` needs no help

VTOP gives slot ids, not `(day, slotId)` pairs, and `L31` is only meaningful combined with a day. Every id must be expanded across the days on which it exists. `config.json` makes this exact and complete:

- 164 slots total: MON 24, TUE 23, WED 23, THU 23, FRI 23, SAT 24, SUN 24
- 24 ids appear on more than one day, so a bare id is ambiguous — `A1` is `8:00-8:50` on MON and `8:55-9:45` on WED

So for each course, for each slot id in its `Slot/ Venue` cell, for each day in `DAYS` where `slotMap[day][slotId]` exists, emit a busy-map key. That produces at most 164 keys and is provably complete: the client's grid projection was verified to cover all 164 slots exactly once with no gaps and no double-counting ([09-schedule-math.md](./09-schedule-math.md) §3).

The same fan-out is what `CommonFreeSlotsGrid.tsx:68-80` already does — but it does it at *read* time against every friend, discarding the day each slot came from. Doing it once at write time, storing the result keyed by `(day, slotId)`, is the same computation with the ambiguity removed.

## 3. Refresh triggers

| Trigger | Route | Notes |
|---|---|---|
| Global sync | `POST /api/social/identity/sync` | The explicit path. Runs in both hardcoded chains at `Main.tsx:519-541` and `Main.tsx:796-870` |
| Debounced after own timetable changes | same | ~5s debounce, so adding a friend or switching semester is not a network round trip |
| Peer read, if stale | `POST /api/social/timetable` | **Read-only. The server never re-derives on a read**, because it has no session for anyone but the caller |

A peer's record therefore only refreshes when *they* sync. This is the real trade-off of the design and it is surfaced rather than hidden: `lastPublishedAt` drives a staleness badge, and anything over 14 days is flagged explicitly. A peer who has stopped opening the app shows a stale badge, which is the honest answer — the alternative would be storing their session server-side, which was rejected.

Freshness is also a correctness concern, not only a UX one: a peer who drops a class will still appear busy in a slot they no longer attend until they sync.

## 4. Failure handling

| Failure | Response | Client behaviour |
|---|---|---|
| VTOP unreachable / 5xx | `502 vtop_unavailable` | Keep local cache, mark peers stale, do not clear |
| VTOP session expired | `401 vtop_session_expired` | Prompt re-login; identity cache is dropped |
| `registerNo` absent from the page | `401 vtop_identity_unresolved` | Same as above — the cookie is not ours |
| Semester list unparseable | `502 semester_list_unavailable` | Keep local cache, surface a "could not reach VTOP" state |
| Proposed semester not in the scraped list | `422 semester_not_offered` | Reset the switch to the server's current value |
| Unknown slot key in payload | `400 unknown_slot` | Log, keep local state, do not half-apply |
| DB unreachable | `503` (from `db.ts:80-89`, which already maps pool failures to 503) | Retry on the next sync |

Every failure leaves the previous stored timetable intact. A failed derivation must never clear a good record — the same rule the sync engine already follows with `persistIfPresent` at `operations.ts:111-114`.

## 5. The probe

`../AmazeCC-API/scripts/vtop-probe.ts` resolved R1 and R2 against the live portal. It reads credentials from environment variable names only, never prints them, and writes structural findings to `vtop-probe-findings.json`.

```bash
cd ../AmazeCC-API
node --env-file=.env --import ./scripts/probe-register.mjs scripts/vtop-probe.ts
```

Note it is **local-only** — `scripts/` is gitignored in that repo, so the probe is not shareable until it is relocated.

**Three things the probe found that no amount of source reading would have:**

1. **The `Slot/ Venue` separator is `" - "`, not `"/"`.** See §2. This would have produced a busy map of invalid keys.
2. **The `Course` cell carries a real course code and an explicit component type** in `"CODE - Title ( Type )"` form, so neither has to be synthesised. See §2.
3. **The semester dropdown is on `StudentCoursePage`, not the dashboard**, and the `selected` option is always the empty placeholder. See [03-identity-and-semester.md](./03-identity-and-semester.md).

**Two operational findings:**

- **`node --env-file` silently truncates an unquoted `#` in a value.** The password in `../AmazeCC-API/.env` ended in `#` and was being read as 27 characters instead of 28, so VTOP received the wrong password and rejected it. Wrapping the value in double quotes fixed it. This does **not** affect the running API — no application code reads `VTOP_PASSWORD` — but it is a trap for any future script or server-side VTOP work, and it is worth a comment next to the variable. The probe now reports the parsed length and warns when a value ends in `#`.
- **Login is attempted exactly once by the probe**, and any failure stops it with a loud banner rather than retrying. A wrong captcha must be surfaced, not papered over. The captcha *image* fetch keeps the upstream 10-attempt loop, because that is about obtaining a picture rather than authenticating.
