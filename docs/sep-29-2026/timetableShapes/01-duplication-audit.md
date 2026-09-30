# 01 — Duplication audit

Every copy, where it lives today, and what its existence has already cost. All line
numbers are as of the working tree at 2026-09-29.

## The shape of the problem

A slot id names one period of one day. Answering "when does this course run?" requires
walking the campus schema and matching an id. That walk was written out seven times, and
the "which periods does this day occupy?" walk three more times. Nothing enforced that
they agree, so they don't.

## Operation: `slot → periods`

| # | Location | Shape returned | Live |
|---|----------|----------------|------|
| 1 | `FFCSTimetableTab.tsx:204` `getPeriodsForSlotOuter` | `{day, startMin, endMin}` | yes |
| 2 | `FFCSTimetableTab.tsx:747` `getPeriodsForSlot` | `{day, startMin, endMin, type, pIdx}` | yes |
| 3 | `AutoGeneratorModal.tsx:79` `getPeriodsForSlot` | `{day, startMin, endMin}` | yes |
| 4 | `courseProcessor.ts:3` `getPeriodsForSlotOuter` | `{day, startMin, endMin}` | **no — dead file** |
| 5 | `exportIcal.ts:74` `slotLookup` | `Map<slot, {day, start, end}[]>` | yes |

Five copies, three return shapes. Number 5 keeps raw clock strings where the others
convert to minutes; number 2 carries the period index the others do not.

## Operation: `period → course`

| # | Location | Live |
|---|----------|------|
| 1 | `buildBands.ts:462` | yes |
| 2 | `FFCSTimetableTab.tsx:802` | yes |
| 3 | amazeui `TimetableGrid` (compiled, another repo) | yes — see [02](./02-slot-vocabulary.md) |

## Operation: day occupancy + metrics

| # | Location | Runs on | Live |
|---|----------|---------|------|
| 1 | `FFCS/logic/metrics.ts:6` `calculateTimetableMetrics` | web worker | **no — dead file** |
| 2 | `FFCSTimetableTab.tsx:~1030-1230` (inline in `generateTimetables`) | main thread | yes |
| 3 | `AutoGeneratorModal.tsx:~340-530` (inline in `generateTimetables`) | main thread | yes |

Copies 2 and 3 are **byte-for-byte identical** from the metrics loop through to the
variant grouping: `FFCSTimetableTab.tsx:1232-1267` ≡ `AutoGeneratorModal.tsx:535-570`.

## Operation: `getFreeHalfDaysList`

| # | Location | Live |
|---|----------|------|
| 1 | `socialScoring.ts:6` (takes `schema` as a parameter) | **no — dead file** |
| 2 | `FFCSTimetableTab.tsx:124` (reads `getTimetableSchema()` internally) | yes |

## Operation: `calculatePairwiseSocialScore`

| # | Location | Live |
|---|----------|------|
| 1 | `socialScoring.ts:40` `(mine, theirs, schema)` | **no — dead file** |
| 2 | `FFCSTimetableTab.tsx:159` `(mine, theirs)` | yes — 4 call sites |

## Operation: `isOverlap`

| # | Location | Live |
|---|----------|------|
| 1 | `FFCSTimetableTab.tsx:252` | yes |
| 2 | `courseProcessor.ts:24` | **no — dead file** |

## Operation: sort comparators

`(20 - gaps) * 5` appears verbatim three times: `FFCSTimetableTab.tsx:1225`,
`AutoGeneratorModal.tsx:528`, `generator.worker.ts:132`.

## Operation: `processParsedCourses`

| # | Location | Live |
|---|----------|------|
| 1 | `FFCSTimetableTab.tsx:269` | yes |
| 2 | `courseProcessor.ts:41` | **no — 274 dead lines** |

## The generators

| # | Location | Runs on | Live |
|---|----------|---------|------|
| 1 | `FFCSTimetableTab.tsx:850` `generateTimetables` | main thread | yes |
| 2 | `AutoGeneratorModal.tsx:152` `generateTimetables` | main thread | yes |
| 3 | `workers/generator.worker.ts` | worker | **no — never invoked** |

Number 3 is reached only through `logic/generator.ts:14`, which
`AutoGeneratorModal.tsx:6` imports and **never calls**. So there are two generators, not
three, and they are the same function.

Both apply the same eight option filters in the same order:

1. `allowedSlots`
2. `allowedFaculty`
3. `offerings`
4. embedded-course completeness (has both a theory and a lab slot)
5. morning/evening `generatorPreference`
6. `blockedSlots`
7. start/end time bounds
8. friend-class sync

then backtrack over non-overlapping period sets, score, filter by `minHalfDays`, dedupe
by faculty when asked, group variants by slot signature, and sort.

## Divergence the duplication has already caused

All verified, not inferred.

**Visible to users, caused by the law-slot bug (already fixed — see [07](./07-law-slot-landed.md)):**

- The free-classroom page reported all 20 AB5 rooms free at 8:00 on every weekday while
  a class was sitting in them. A law student blocked slot `A` and the block did nothing,
  because the grid recorded the schema's `A1` and the generator filters on the course's.
- A law student's entire timetable rendered blank in both grid views, because no cell
  ever matched a course.

**Latent — real bugs in the dead worker, never seen by a user:**

- `metrics.ts:130` builds `gapsPerDay` and then never returns it, while the UI reads
  `metrics.gapsPerDay` at `AutoGeneratorModal.tsx:687` and `:1066`.
- `metrics.ts:138` returns `longWeekend`; `types.ts:65` declares `isLongWeekend`.
- `metrics.ts` also omits `bestFriendMatches`, a third required field. TypeScript misses
  all of this because `newTts` at `generator.worker.ts:68` is unannotated, so the shape
  is inferred and cast at the consumer.
- `metrics.ts:136` returns `gaps` in **minutes** while the UI prints `{metrics.gaps}h`
  (`AutoGeneratorModal.tsx:684`, `:950`, `:1063`) — 60 minutes of gaps renders as "**60h**".
- `dashDetails.day` is `"MON"` from the worker but `"Monday"` from the tab and modal,
  rendered raw at `AutoGeneratorModal.tsx:824`.
- `metrics.ts` kept a private `DAYS` list of `{ id: "monday" }` while the schema keys
  days `"mon"`, so `p.days?.[day.id]` was always `undefined` and the whole metrics block
  was inert. Fixed in the working tree, but it was unreachable, so it cost nothing.

**Latent — visible-code-but-inconsistent:**

- `gaps` is minutes in `metrics.ts` and hours in both live inline copies. The compactness
  sort reads whichever it was given. This is why the unit is being settled explicitly
  rather than left to whichever copy is nearest.

The pattern: **the copies that were live behaved identically, and the copies that were
dead all diverged.** That is the argument for the audit being worth doing properly rather
than adding a sixth copy.

Next: [02 — Slot vocabulary & lookups](./02-slot-vocabulary.md)
