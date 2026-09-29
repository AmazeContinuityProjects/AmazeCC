# Timetable shapes — unification plan

**Date:** 2026-09-29
**Status:** planned, not started
**Baseline:** 811 tests passing across 45 files

## What this is

A plan to collapse the timetable's slot, period and metrics logic — currently copied
six or seven times across the FFCS generator, the two grid renderers and the calendar
export — into one module, and to move generation off the main thread into a web worker.

It started as a bug fix. The law school books its courses with a different spelling of
a period (`A+TA+TAA` where everyone else writes `A1+TA1+TAA1`), and every one of those
copies compared the two spellings literally. Fixing them one at a time is what exposed
how many there were, and how two of them had already rotted.

| # | File | Contents |
|---|------|----------|
| 01 | [Duplication audit](./01-duplication-audit.md) | Every copy, with line references and the divergence each one has already caused |
| 02 | [Slot vocabulary & lookups](./02-slot-vocabulary.md) | The two spellings, and the one `slot → periods` function (Phase 1) |
| 03 | [Occupancy & metrics](./03-occupancy-metrics.md) | One day-walk, one metrics function, minutes not hours (Phase 2) |
| 04 | [One generator, in a worker](./04-generator-worker.md) | The pure function and the worker bridge (Phase 3) |
| 05 | [Deletions](./05-deletions.md) | Dead code and what it was quietly costing us (Phase 4) |
| 06 | [Tests](./06-tests.md) | What gets added, and the test that would have caught all of it (Phase 5) |
| 07 | [Law-slot fix: landed](./07-law-slot-landed.md) | The part already implemented and awaiting commit |

## Locked decisions

| Question | Decision |
|---|---|
| Scope | Full: lookups + metrics + one generator |
| Generator host | One pure function, run in a web worker |
| Worker module type | `{ type: 'module' }` — **requires Safari 15+ (2021)** |
| `metrics.gaps` unit | **Minutes** everywhere |
| Compactness sort weight | `((MAX_WEEKLY_GAP_MIN - gaps) / 60 * 5)`, `MAX_WEEKLY_GAP_MIN = 1200` |
| `TimetableState.metrics` | All fields **required**, derived from `TimetableMetrics` |
| Build failure | **Stop and report.** No webpack workarounds attempted |

## Phases

| Phase | Work | Independently testable |
|-------|------|------------------------|
| 1 | Move schema/time primitives into `src/lib/slots.ts`; add `periodsForSlot`, `slotsOverlap`, `courseInPeriod`, `ownSlotSpelling` | yes |
| 2 | Add `dayOccupancy`, `freeHalfDays`, `timetableMetrics`, `pairwiseSocialScore`, `sortTimetables`, `formatHours`; rewire all callers | yes |
| 3 | Extract pure `generateTimetables`; reduce the worker to a bridge; both UIs go through it | yes |
| 4 | Delete 3 dead files + `utils.timeToMinutes` | yes |
| 5 | Tests, then `test` / `typecheck` / `lint` / `build` | — |

Each phase typechecks and tests on its own, so a failure is always attributable to the
phase it landed in.

## Abort condition

`next.config.mjs` sets `output: 'export'`. `new Worker(new URL(...))` under a static
export normally works with webpack 5, **but this build has never done it** — the only
importer of the worker has been dead code, so the file has sat in the repo un-bundled
since it was written.

If `npm run build` cannot bundle the worker, **stop and report the exact error.** The
pure function from Phase 3 survives that outcome, and falling back to main-thread
execution is a one-line change at the two call sites. What must not happen is guessing at
a webpack workaround.

## Net effect

Roughly **−600 lines**, one source of truth for every slot/period/metrics question, and
generation that no longer blocks the UI thread.

## One correction worth carrying forward

During the earlier analysis of this plan it was reported that a `DAYS` id mismatch had
made the generator's scoring inert and was costing users ranking accuracy. That was an
overstatement: the mismatch was real, but it lived only in the dead worker, so no user
ever saw it. The duplication caused genuine harm — law students' timetables rendering
blank, AB5 reported free all morning — but the metrics bugs were latent. See
[05-deletions.md](./05-deletions.md).
