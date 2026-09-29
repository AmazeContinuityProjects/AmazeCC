# 04 — One generator, in a worker (Phase 3)

## Current shape

Two live generators, byte-for-byte identical:

| Location | Runs on | Reached by |
|----------|---------|-----------|
| `FFCSTimetableTab.tsx:850` | main thread | the tab's own generate button |
| `AutoGeneratorModal.tsx:152` | main thread | the modal's generate button |

Both block the UI thread for the whole solve. Both open with
`await new Promise(r => setTimeout(r, 50))` purely to let the spinner paint before
synchronous work starts — a smell that exists only because the work is synchronous.

A third implementation exists at `workers/generator.worker.ts` and is **never invoked**.

## The pure function

New file `FFCS/logic/generate.ts`. No React, no `window`, no `localStorage`, no
`next-themes` — it must load in a bare worker scope.

```ts
type GeneratorErrorCode =
  | "no_courses_selected"
  | "no_valid_slots"
  | "no_conflict_free"
  | "below_min_half_days";

interface GenerateParams {
  schema: CampusSchema;
  masterCourses: ParsedCourse[];
  courseLocks: CourseLock[];
  blockedSlots: string[];          // an array, not a Set — see below
  friends: Friend[];
  preference: "none" | "morning" | "evening";
  syncFriendClasses: boolean;
  minStartTime: string;
  maxEndTime: string;
  uniqueFaculties: boolean;
  noLimit: boolean;
  minHalfDays: number;
  sortBy: "social" | "halfdays" | "compactness" | "balanced";
}

type GenerateResult =
  | { ok: true; timetables: TimetableState[] }
  | { ok: false; code: GeneratorErrorCode };

function generateTimetables(params: GenerateParams): GenerateResult
```

It absorbs, in order:

1. the eight option filters (see [01](./01-duplication-audit.md))
2. the conflict-free backtracking
3. `timetableMetrics` from Phase 2
4. the `minHalfDays` filter
5. the `uniqueFaculties` dedupe
6. variant grouping by slot signature
7. `sortTimetables`

Two things are dropped as dead: the `usedFacultiesPerCourse` map, which both copies
populate and never read, and the `setTimeout(50)` paint hack, which becomes unnecessary
once the work is off-thread.

### Errors are codes, not strings

Each surface currently owns its own `setError(...)` call with its own wording. The pure
function returns a `code`; each call site maps it to the string it uses today, so no user-
visible text changes and there is still one source of truth for *which* failure occurred.

| Code | Surfaces today |
|---|---|
| `no_courses_selected` | both — "Please select at least one course." |
| `no_valid_slots` | both — "No valid slots found for {code}…" (needs the code passed alongside) |
| `no_conflict_free` | both — "Could not generate any conflict-free timetables…" |
| `below_min_half_days` | both — "No timetables met the minimum half-days requirement…" |

`no_valid_slots` currently interpolates the course code, so the result carries
`{ code, subjectCode }`.

## The worker bridge

`workers/generator.worker.ts` becomes roughly ten lines: import the pure function, call
it, post the result. It stops carrying its own `COLORS` literal, its own
`crypto.randomUUID` helper, its own copy of the metrics and its own sort — all of which it
had to duplicate because it could not import them.

`logic/generator.ts`'s `generateTimetablesAsync` becomes the **only** entry point, called
by both the tab and the modal. It is already structured for this: it constructs the worker,
wires `onmessage`/`onerror`, and resolves or rejects. It only ever had one caller who
never called it.

## Three consequences worth naming

**The paint hack goes.** `await new Promise(r => setTimeout(r, 50))` existed only to let
the spinner paint before blocking. In a worker the main thread is free, so the spinner
paints naturally and the hack can be deleted from both call sites.

**Ids change format.** `Math.random().toString(36).substr(2, 9)` → `crypto.randomUUID()`.
`substr` is deprecated, and both contexts have `crypto`. These ids are persisted to
`ffcs_timetables` in localStorage when a staged option is saved, so the format does reach
storage — but ids are opaque, never parsed, and regenerated on load, so this is safe.

**Params cross a structured clone.** Everything passed to the worker is cloned, not
shared. `ParsedCourse`, `CourseLock`, `Friend` and the campus schema are all plain
JSON-shaped data and clone cleanly. `blockedSlots` is a `Set` in React state but is
declared as `string[]` in `GenerateParams` so the boundary is explicit and does not depend
on `Set` surviving the clone. The one-off copy of ~2,357 course rows is negligible beside
the solve.

## Worker module type

`{ type: 'module' }`, as the dead code already specified. This **requires Safari 15+
(2021)**. Given this is a PWA with a service worker that is a real floor and it is a
known, accepted one. The alternative — a classic worker with no `type` flag and a body
free of ESM-only syntax — buys older iOS at the cost of a more awkward worker file.

## The build risk

`next.config.mjs:31` sets `output: 'export'`. A `new Worker(new URL(...))` chunk normally
works under webpack 5 with a static export.

**But this build has never done it.** The only importer of the worker has been dead code
since it was written, so `generator.worker.ts` has sat in the repo un-bundled and the
pattern is unexercised. There is no webpack configuration for workers in `next.config.mjs`
— only a `@napi-rs/canvas` server external and a `react-native-web` alias.

**If `npm run build` cannot bundle the worker: stop and report the exact error.** Do not
attempt a webpack workaround. The pure function from this phase survives that outcome, and
falling back to main-thread execution is a one-line change at the two call sites — which
is precisely why the pure function is built before the bridge is touched.

Next: [05 — Deletions](./05-deletions.md)
