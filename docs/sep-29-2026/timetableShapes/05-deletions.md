# 05 — Deletions (Phase 4)

**Status: done.** The three files below are deleted, and `utils.timeToMinutes` went with
them. [08 — What actually shipped](./08-what-shipped.md) records what else went.

## Verified dead

Each confirmed by exhaustive grep across `src/`, not by inspection.

| File | Lines | Only referenced by |
|---|---|---|
| `FFCS/logic/courseProcessor.ts` | 274 | nothing — `FFCSTimetableTab.tsx:269` has its own `processParsedCourses` |
| `FFCS/logic/metrics.ts` | 142 | `generator.worker.ts:2` — itself dead |
| `FFCS/logic/socialScoring.ts` | 88 | `generator.worker.ts:3` — itself dead |
| `FFCS/utils.ts` → `timeToMinutes` | ~10 | `metrics.ts` and `socialScoring.ts` only — both dead |

`FFCS/utils.ts` keeps `isCourseFullyAdded`, which is live at
`FFCSTimetableTab.tsx:2634`. Only the `timeToMinutes` export goes; `src/lib/slots.ts` has
a stricter version that rejects unreadable input rather than returning `0`.

## Retained and rewritten

| File | From | To |
|---|---|---|
| `FFCS/workers/generator.worker.ts` | 142 | ~10 — a bridge over the pure function |
| `FFCS/logic/generator.ts` | 39 | the single entry point, both UIs call it |

## Also removed from the live code

- `usedFacultiesPerCourse` in both generators — populated, never read.
- `await new Promise(r => setTimeout(r, 50))` in both — the paint hack, obsolete once
  generation is off-thread.
- The three duplicate `getPeriodsForSlot` / `getPeriodsForSlotOuter` definitions.
- Both `getFreeHalfDaysList` copies, both `calculatePairwiseSocialScore` copies, both
  `isOverlap` copies, all three sort comparators.

## Net

Roughly **−600 lines**, once the ~500 lines of duplicated inline generator come out of
`FFCSTimetableTab.tsx` and `AutoGeneratorModal.tsx` in Phase 3.

## The honest accounting

Two things in this plan are usually described as fixes that cost users ranking accuracy.
Neither did, and it is worth recording why.

The `DAYS` id mismatch in `metrics.ts` — `{ id: "monday" }` against a schema that keys
days `"mon"` — made `p.days?.[day.id]` always `undefined` and the entire metrics block
inert. It was fixed earlier in this work. But `metrics.ts` was only reachable from the
dead worker, so **no user ever saw a wrong score because of it.**

The same applies to the other four divergences catalogued in
[01 — Duplication audit](./01-duplication-audit.md): `gapsPerDay` never returned,
`longWeekend` vs `isLongWeekend`, the missing `bestFriendMatches`, the minutes-vs-hours
split on `metrics.gaps`, and the `MON` vs `Monday` day string. All real, all unreachable.

What the duplication *did* cost, and what was real to users:

- All 20 rooms in AB5 reported free at 8:00 on every weekday while law classes were
  sitting in them.
- Law students' whole timetables rendering blank in both grid views.
- A blocked law slot doing nothing, because the grid recorded the schema's spelling and
  the generator filtered on the course's.

The lesson is the same either way, and it is the reason this plan exists: **the copies
that were live behaved identically, and every copy that was dead had diverged.** Six of
the seven slot-lookup copies were live and agreed; the one that was dead was reading a
schema shape (`schema.timetable[].periods[].slots`) that does not exist anywhere else in
the repository.

## The lesson to carry forward

A duplicate that is never executed is not a harmless duplicate. It is a trap for whoever
does execute it next, and it hides the fact that the live copies agree — which is the
whole reason the divergence is so easy to miss in review.

Two habits follow from it, and both are already in the test plan:

1. **Assert against the real data.** A completeness test over the metrics contract
   catches a producer that fills in four of nine fields.
2. **Delete, do not comment out.** A tombstone is still a copy. `git` remembers; the
   working tree should not carry a second implementation nobody is calling.

Next: [06 — Tests](./06-tests.md)
