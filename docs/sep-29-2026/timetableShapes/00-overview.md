# Timetable shapes — unification plan

**Date:** 2026-09-29
**Status:** **shipped** — all five phases done, `test` / `typecheck` / `lint` / `build` green
**Baseline:** 811 tests across 45 files → **now 854 across 46**
**Deviations from the plan:** four, all recorded in [08 — What actually shipped](./08-what-shipped.md)

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
| 08 | [What actually shipped](./08-what-shipped.md) | The four places the build disagreed with the plan, and what was done instead |

## Locked decisions

| Question | Decision |
|---|---|
| Scope | Full: lookups + metrics + one generator |
| Generator host | One pure function, run in a web worker |
| Worker module type | `{ type: 'module' }` — **requires Safari 15+ (2021)** |
| `metrics.gaps` unit | **Minutes** everywhere |
| Compactness sort weight | `((MAX_WEEKLY_GAP_MIN - gaps) / 60) * 5`, `MAX_WEEKLY_GAP_MIN = 1200` |
| `TimetableState.metrics` | All fields **required**, derived from `TimetableMetrics` |
| Build failure | **Stop and report.** No webpack workarounds attempted |

## Phases

| Phase | Work | Status |
|-------|------|--------|
| 1 | Move schema/time primitives into `src/lib/slots.ts`; add `periodsForSlot`, `slotsOverlap`, `courseInPeriod`, `ownSlotSpelling` | done — 8 call sites rewired, all 5 duplicate lookups gone |
| 2 | Add `src/lib/timetableMetrics.ts`; rewire callers, derive `types.ts`, `formatHours` at the display sites | done — 4 duplicate day walks and 3 sort comparators gone |
| 3 | Extract pure `generateTimetables`; reduce the worker to a bridge; both UIs go through it | done — both inline generators deleted, ~500 lines |
| 4 | Delete 3 dead files, `utils.timeToMinutes`, and the locals orphaned by Phase 3 | done |
| 5 | Tests, then `test` / `typecheck` / `lint` / `build` | done |

## The abort condition, resolved

`next.config.mjs` sets `output: 'export'`, and `new Worker(new URL(...))` under a
static export had **never been exercised by this build** — the only importer of the
worker was dead code, so the file had sat in the repo un-bundled.

It turned out to work. `npm run build` succeeds, webpack emits the solver as
`out/_next/static/chunks/999.*.js`, and the page chunk instantiates it with
`new Worker(r.tu(new URL(r.p + r.u(999), ...)))`. The abort condition did not fire,
so no fallback was needed.

## One correction worth carrying forward

During the earlier analysis of this plan it was reported that a `DAYS` id mismatch had
made the generator's scoring inert and was costing users ranking accuracy. That was an
overstatement: the mismatch was real, but it lived only in the dead worker, so no user
ever saw it. The duplication caused genuine harm — law students' timetables rendering
blank, AB5 reported free all morning — but the metrics bugs were latent. See
[05-deletions.md](./05-deletions.md).
