# 03 — Occupancy & metrics (Phase 2)

## What the day walk has to answer

For one day and one timetable: which periods are occupied, by what, and therefore which
half-days are free. Three copies of this walk exist; two are live and identical, one is
dead and was inert.

Each copy embeds, inline:

- the morning/evening split as `timeToMinutes(p.start) < timeToMinutes("2:00 PM")`
- the `p.days?.[day.id]` lookup
- the `labPeriods[pIdx]` index-aligned lab pairing
- the embedded-course venue split — a course booked `"AB1-101 / AB2-3"` takes the first
  part for its theory half and the second for its lab half
- the `p.days` → `c.slots` match

Every one of those is a spelling question or a magic constant, and every one of them had
to be patched separately when the law slots turned up.

## API

```ts
const MORNING_BEFORE_MIN = 840;          // 2:00 PM, was inline in 3 files

interface OccupiedClass {
  startMin: number; endMin: number;
  start: string; end: string;
  code: string; title: string; venue: string;
}

interface DayOccupancy {
  classes: OccupiedClass[];              // sorted by startMin
  morningOccupied: boolean;
  eveningOccupied: boolean;
}

dayOccupancy(courses, schema, day): DayOccupancy
freeHalfDays(courses, schema): string[]                  // "mon_morning", …
timetableMetrics(courses, schema): TimetableMetrics
pairwiseSocialScore(mine, theirs, schema): Score
sortTimetables(timetables, sortBy): TimetableState[]
formatHours(minutes): string
```

`dayOccupancy` is the only place the walk exists. `freeHalfDays` is five lines on top of
it, and `timetableMetrics` is the gap and dash derivation on top of *that*.

## The minutes decision

`metrics.gaps` is **minutes** everywhere. This settles an ambiguity that has been live
since at least the dead worker: the same field name carried minutes in one copy and hours
in another, and the sort read whichever it was handed.

| Field | Unit | Note |
|---|---|---|
| `metrics.gaps` | minutes | was hours in both live inline copies |
| `metrics.gapsPerDay` | minutes | was hours in both live inline copies |
| `gapDetails[].durationMins` | minutes | already correct everywhere |

### The compactness sort

```
((MAX_WEEKLY_GAP_MIN - gaps) / 60) * 5     with MAX_WEEKLY_GAP_MIN = 1200
```

The original was `(20 - gaps) * 5`, where `20` was gap-**hours** — an unexplained
constant. `1200` is the same value in minutes, so the arithmetic is unchanged, and the
constant is now named and self-documenting.

Both live sort sites read `metrics.gaps` from the inline copies, which were already in
hours — so this conversion is self-consistent either way and **does not change result
ordering**.

## `TimetableMetrics` becomes the contract

`types.ts:56-66` currently declares the metrics shape by hand, and a producer in the dead
worker filled in four of its nine fields. Nothing caught that, because the producer's
return type was inferred.

`types.ts` will derive from `TimetableMetrics`, and every field becomes **required**:

| Field | Filled by every producer after Phase 2 |
|---|---|
| `halfDays` | yes |
| `gaps` | yes |
| `gapsPerDay` | yes |
| `gapDetails` | yes |
| `buildingDashes` | yes |
| `dashDetails` | yes |
| `socialScore` | yes |
| `bestFriendMatches` | yes |
| `isLongWeekend` | yes |

Optionality goes away so that a partial producer is a type error rather than an
`undefined` that renders as a blank. A completeness test backs this up — see
[06 — Tests](./06-tests.md).

## One value for `day`

`dashDetails.day` was `"MON"` from the worker and `"Monday"` from the tab and modal,
rendered raw at `AutoGeneratorModal.tsx:824`. The unified function stores the day **id**
(`"mon"`), matching the keys of the `gapsPerDay` map beside it, and the UI uppercases it
the way the neighbouring tooltip already does at `:689`.

## `pairwiseSocialScore` gains a real parameter

It currently reads `getTimetableSchema()` internally, which is why the copy in
`socialScoring.ts` takes `schema` and the copy in `FFCSTimetableTab.tsx:159` does not.
The unified version takes it as a parameter, which makes it testable and changes the
signature at 5 call sites (`FFCSTimetableTab.tsx:1173`, `AutoGeneratorModal.tsx:476`,
`SocialMatrixModal.tsx:32` and `:108`, plus the unified generator).

`60` appears as a hardcoded slot count at `socialScoring.ts:51-52` with the comment
"Use a hardcoded 60 max slots for simplicity, or deduce from schema". It is left as-is —
deriving it from the schema is a separate question about what "free slot" means, and it
is not a spelling problem.

## Display

Three display sites print `{metrics.gaps}h`. They switch to `formatHours(minutes)`, which
is the only place minutes become hours for display.

## Rewiring

| Caller | Change |
|---|---|
| `FFCSTimetableTab.tsx:124` `getFreeHalfDaysList` | deleted, delegates to `freeHalfDays` |
| `FFCSTimetableTab.tsx:159` `calculatePairwiseSocialScore` | replaced by the shared one |
| `FFCSTimetableTab.tsx:1225` sort comparator | replaced by `sortTimetables` |
| `FFCSTimetableTab.tsx:~1030-1230` metrics loop | replaced by `timetableMetrics` (Phase 3) |
| `AutoGeneratorModal.tsx:528` sort comparator | replaced by `sortTimetables` |
| `AutoGeneratorModal.tsx:~340-530` metrics loop | replaced by `timetableMetrics` (Phase 3) |
| `AutoGeneratorModal.tsx:684, :950, :1063, :687, :1066` | use `formatHours` |
| `types.ts:56-66` | derived from `TimetableMetrics`, all required |
| `metrics.ts`, `socialScoring.ts` | deleted in Phase 4 |

Next: [04 — One generator, in a worker](./04-generator-worker.md)
