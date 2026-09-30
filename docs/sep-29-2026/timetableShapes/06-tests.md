# 06 — Tests (Phase 5)

## Baseline

**811 tests across 45 files**, held. Every phase is verified with `npm test`,
`npm run typecheck` and `npx eslint`; the worker additionally requires `npm run build`.

## What already exists and must keep passing

| File | Covers |
|---|---|
| `src/__tests__/slots.test.ts` | the two spellings, both directions, every exclusion |
| `src/__tests__/freeClassrooms.test.ts` | the free-room model, incl. the real-schema `S11`/`S15` cases |
| `src/__tests__/ffcs-metrics.test.ts` | half-days, gaps, long weekend, law equivalence |
| `src/__tests__/timetable-vertical.test.ts` | the vertical grid projection, incl. law courses |
| `src/__tests__/timetable-horizontal-law.test.tsx` | the amazeui adapter, incl. the block spelling |
| `src/__tests__/timetable-vertical-render.test.tsx` | vertical grid markup, rowSpan geometry |

## New tests

### 1. The golden generator test

`generateTimetables` on a fixed input, asserting the exact set of result slot layouts.
This is the test that would have caught every divergence in
[01](./01-duplication-audit.md) — the two live copies drifting apart, or a filter pass
being dropped from one of them.

It also becomes the test that the worker and the main-thread path produce identical
output, since both now call the same function.

### 2. The metrics completeness test

Assert that `timetableMetrics` fills **every** key declared in `TimetableState.metrics`.

This is the direct answer to the dead `metrics.ts`, which returned six fields where the
type declared nine, and TypeScript did not notice because the producer's return type was
inferred at an unannotated call site. With the type derived from `TimetableMetrics` this
is now a compile error, and this test is the runtime backstop.

```ts
it("fills every field the TimetableState.metrics contract declares", () => {
  expect(Object.keys(calculateTimetableMetrics(courses, schema)).sort())
    .toEqual(Object.keys(EXPECTED_CONTRACT).sort());
});
```

### 3. `periodsForSlot` in both directions

- schema id → periods: `A1` → Monday 8:00 **and** Wednesday 8:55 (it recurs across days,
  which is the detail several hand-written expectations got wrong during the law fix)
- law id → the same periods: `A` ≡ `A1`
- `TEE` ≡ `S11`, `TFF` ≡ `S15`
- and the exclusions, which are the part most likely to regress: `A2` has no law partner,
  `S1` is a real evening slot and is left alone, `L1` is a lab, `NIL` grows no `NIL1`

### 4. The minutes regression

`metrics.gaps` in minutes, `gapsPerDay` in minutes, and the compactness sort using
`MAX_WEEKLY_GAP_MIN / 60`. Concretely: a timetable with a 60-minute gap reports
`gaps === 60` and sorts as though it had `1` gap-hour, not `60`.

### 5. The worker smoke test

Assert `generator.worker.ts` and `logic/generate.ts` load in a bare scope — no `window`,
no `localStorage`, no React. This catches an accidental import of a client-only module,
which is the failure that would otherwise only appear at runtime in a user's browser.

`constants.ts` is already worker-safe (its only import is a campus JSON) and is the
template for what a worker-safe module looks like here.

### 6. Both call sites agree

A test that the tab's and the modal's filter inputs produce the same result set — the
invariant that held by accident before, and will hold by construction after.

### 7. Retarget `ffcs-metrics.test.ts`

It currently tests `calculateTimetableMetrics` from the dead `metrics.ts`. Point it at
`src/lib/slots.ts`. The existing assertions carry over unchanged, and two of them were
written to pin the law-slot behaviour:

- a law course scores identically to the same course written with numbers
- a law course stays out of the evening

## Reading the numbers in tests

A slot id names one period **on one day**, and some ids recur across days — `A1` is
Monday 8:00 *and* Wednesday 8:55, so it costs two half-days, not one. Every expected
value in these tests is written out from `chennai.json` rather than counted by hand; four
were wrong on first draft during the law fix because of exactly this.

Single-day ids for clean assertions: `TA1` (Friday 9:50), `S11` (Monday 12:35),
`S15` (Friday 12:35).

## Definition of done

- `npm test` — 811 + new, 0 failures
- `npm run typecheck` — clean
- `npx eslint` — 0 errors (the 8 pre-existing warnings in the touched files stay)
- `npm run build` — the worker bundles under `output: 'export'`, **or** the failure is
  reported and left for a decision

Next: [07 — Law-slot fix: landed](./07-law-slot-landed.md)
