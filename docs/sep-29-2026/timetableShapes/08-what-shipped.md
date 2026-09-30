# 08 — What actually shipped

The plan in [00-overview.md](./00-overview.md) was written before any code moved. Four
things went differently, all of them the code telling the plan something the plan had
guessed. This file is the record.

## 1. Two modules, not one

**Planned:** everything in `src/lib/slots.ts`.

**Shipped:** `src/lib/slots.ts` for vocabulary and schema lookups, and a new
`src/lib/timetableMetrics.ts` for occupancy, metrics, scoring and sorting.

Slot spelling and timetable scoring are different concerns. `slots.ts` has no
dependency on courses and answers "what period is this?"; `timetableMetrics.ts` answers
"how good is this week?". Folding the second into the first would have produced a
~500-line module about two unrelated things, and the metrics half is the part most
likely to change again.

The single-source-of-truth goal is met either way: one implementation of each operation,
imported by everything that needs it.

## 2. `kind`, not `ok`

**Planned:** `GenerateResult` as `{ ok: true, timetables } | { ok: false, code }`.

**Shipped:** `{ kind: "ok", timetables } | { kind: "error", code }`.

This project's `tsconfig` is `"strict": false`, and TypeScript does **not** narrow a
union on a boolean literal in that mode — `if (result.ok)` leaves `result` as the whole
union, and every property access after it is a compile error. A string discriminant
narrows in any mode. Verified with a three-case probe before committing to it:

| Discriminant | Narrows under `strict: false`? |
|---|---|
| `if (r.ok)` | no |
| `if (s.kind === "ok")` | yes |
| `if ("code" in r)` | yes |

Kept the boolean shape documented in the plan, discovered the constraint from the
compiler, and switched. The comment in `generate.ts` says why, so the next person does
not "simplify" it back.

## 3. A setting the plan had merged

**Planned:** one `syncFriendClasses` flag governing both the friend-offering filter and
the social score.

**Shipped:** `syncFriendClasses` *and* `maximizeFreeTimeFriends: string[]`, which are
two independent settings in the UI.

They were conflated in the first draft of `generate.ts`, and a test caught it: a student
with friends selected scored **zero**, because scoring was gated behind the sync filter.
They are genuinely separate — one narrows the search to what a friend is taking, the
other just ranks results by how well they suit. The tab and the modal each hold both as
separate `useState`, which is how the conflation became visible.

The test `scores zero when friends exist but none were picked` exists specifically to
keep them apart.

## 4. `"compact"` and `"spread"` preferences

**Planned:** `preference: "none" | "morning" | "evening"`.

**Shipped:** the type also admits `"compact" | "spread"`, which the old filter never
tested for and which therefore behaved exactly like `"none"`.

The caller's type has carried these two values all along. Widening rather than
rejecting preserves existing behaviour and makes the two entry points agree; the
parameter's doc comment records that they do nothing. Deciding what they *should* do is
a question about the planner's UI, not about this filter.

## Also worth recording

**A fifth dead function.** Beyond the three deleted files, `FFCS/utils.ts` had a
`timeToMinutes` that returned `0` for an unreadable time — which is midnight, so a period
with a bad time became a period at the start of the day. Only the two dead files used
it. Gone.

**Two orphaned locals per generator.** `usedFacultiesPerCourse` was populated and never
read in both inline copies, and the tab's own `timeToMinutes` and
`parse24HourToMinutes` became dead once the metrics loop moved. All removed.

**Line references in [01](./01-duplication-audit.md) and [02](./02-slot-vocabulary.md)
describe the pre-unification tree.** They are kept as-is deliberately: the audit is a
record of what was duplicated, and rewriting it to point at code that no longer exists
would destroy its value. Anyone re-checking a claim should check it against the commit
before this change.

## The build risk did not materialise — and the worker was then executed

Worth stating plainly, because the plan made it a headline risk and the answer took two
steps to get right.

`new Worker(new URL(...))` under `output: 'export'` had never been exercised by this
build, because the only importer was dead. It bundles: `npm run build` succeeds, webpack
emits the solver as `out/_next/static/chunks/999.*.js`, and the page chunk instantiates it
with `new Worker(r.tu(new URL(r.p + r.u(999), ...)))`.

**But that only proves the chunk exists.** So `__tests__/worker-artifact.test.ts` loads
the emitted bytes into a bare `vm` context with only `self`, `console` and `crypto`,
posts a real `GenerateParams`, and waits for a reply. Six tests, all green:

- loads with only the globals a worker has — no `document`, no `window`, no `process`
- installs a `message` handler
- answers a real request with real data
- carries a law booking's slots through and scores it (`E+TE+TEE` → `halfDays: 6`,
  matching the source-level tests)
- reports a filtered-out course as `no_valid_slots` rather than crashing
- survives a malformed payload

The test finds the worker by behaviour — installs a message handler, carries the solver,
touches no DOM — rather than by filename, so it survives webpack renaming chunk 999. It
skips when `out/` is absent, so `npm test` passes on a fresh clone.

### The bug that test would have caught, caught anyway

Loading the artifact surfaced a real defect in the `crypto.randomUUID` switch described
in [04](./04-generator-worker.md). **`Crypto.randomUUID()` is `[SecureContext]`-only** —
it is `undefined` on a plain-HTTP origin, and the solver runs in a worker where a missing
global throws. This app is HTTPS and a PWA, but `next.config.mjs` lists a bare LAN IP
(`192.168.1.101`) as an allowed dev origin, and a self-hosted copy on a campus LAN over
HTTP would have had no `crypto.randomUUID` at all. The old inline code used
`Math.random`, which always exists.

`newId` now prefers `randomUUID` and falls back to a timestamp-prefixed random id, and
both branches are present in the emitted chunk.

The inline fallback in `logic/generator.ts` remains and is not dead weight: it is the
path for a browser that cannot construct a module worker, and it is one line at each call
site if the worker ever has to be abandoned.

## What a user notices

| Change | Who notices |
|---|---|
| Law courses render in both grid views | every law student — before, their whole timetable was blank |
| AB5 is no longer reported free while occupied | everyone looking for a room before 9am |
| Blocking a law slot now works | law students using the planner |
| iCal export includes law courses | law students exporting to a calendar |
| Generation no longer freezes the UI | everyone generating, and especially on a phone |
| `gaps` is minutes, displayed as hours | nobody — the display is unchanged, the number is now correct |
| A blocked slot recorded as `A1` by an older build | may need re-blocking once |

That last row is the only backwards-incompatible change, and it is cosmetic: a blocked
slot stored in localStorage under the schema's spelling will not hatch a cell that now
prints the course's own. `HorizontalTimetableGrid` expands the blocked set through both
spellings, so re-blocking a slot once fixes it permanently.
