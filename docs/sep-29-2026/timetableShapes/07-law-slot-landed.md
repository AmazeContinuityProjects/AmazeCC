# 07 — Law-slot fix: landed

Implemented and tested in the working tree, **not yet committed**. This is the context
the unification plan grew out of, and the only part of the work that changed what a user
sees.

## The bug

The law school books its courses with a different spelling of a period: `A+TA+TAA` where
everyone else books `A1+TA1+TAA1`. Every lookup in the app compared those two spellings
literally, so nothing a law student took ever matched a period.

Verified against `public/ffcs/ffcsReport.csv`: **99 rows**, every one `TLAW*`, type `TH`
or `ETH`, all in AB5.

## Impact on real data

AB5 free rooms at 8:00 AM, before and after:

| Day | Before | After |
|-----|--------|-------|
| Mon | 20 of 20 free | 3 free |
| Tue | 20 of 20 free | 2 free |
| Wed | 20 of 20 free | 3 free |
| Thu | 20 of 20 free | 11 free |
| Fri | 20 of 20 free | 3 free |

Monday 8:00 overall: 118 rooms free → 101.

The 12:35 periods, once `S11`/`S15` were linked:

| Day | Before | After |
|-----|--------|-------|
| Mon (`S11`) | 20 of 20 free | 6 free |
| Fri (`S15`) | 20 of 20 free | 12 free |

## What changed

### New

| File | Purpose |
|---|---|
| `src/lib/slots.ts` | the two spellings and every lookup built on them |
| `src/components/custom/timetable/HorizontalTimetableGrid.tsx` | adapter for the amazeui grid, whose source is not in this repo |
| `src/__tests__/slots.test.ts` | spelling tests, both directions, every exclusion |
| `src/__tests__/ffcs-metrics.test.ts` | half-days, gaps, long weekend, law equivalence |
| `src/__tests__/timetable-horizontal-law.test.tsx` | the horizontal grid, incl. block spelling |

### Modified

| File | Change |
|---|---|
| `src/lib/freeClassrooms.ts` | `buildPeriodSlots` carries both spellings; `slotSpellings` imported |
| `src/components/custom/timetable/buildBands.ts` | `hasSlot` for cell matching; cell labels and block checks read the course's own spelling |
| `src/components/custom/timetable/SlotDetailSheet.tsx` | `hasSlot` for the blocked chips |
| `src/components/custom/timetable/TimetableView.tsx` | routes through the new horizontal adapter |
| `src/components/custom/timetable/index.ts` | exports the adapter |
| `src/components/custom/mobile/FreeClassroomsWidget.tsx` | both spellings in the target-slot set |
| `src/lib/exportIcal.ts` | lookup keyed under both spellings |
| `FFCSTimetableTab.tsx` | 4 lookups + free-half-days + venue lookup rewired |
| `AutoGeneratorModal.tsx` | 3 lookups + free-half-days + venue lookup rewired |
| `FFCS/logic/metrics.ts` | `DAYS` id mismatch fixed; `expandSlotSpellings` |
| `FFCS/logic/socialScoring.ts` | `DAYS` id mismatch fixed; `expandSlotSpellings` |

## The design decisions worth keeping

**Derive, don't tabulate.** The alias is computed by dropping a lone trailing `1` off a
theory slot, so `A1`→`A`, `TC1`→`TC`, `TDD1`→`TDD` are one rule rather than eighteen
entries, and it cannot drift when the schema gains a slot.

**Both directions, because both are asked.** The free-classroom page holds a period and
asks who is in it; the generator holds a course and asks when it runs. A period with two
names has to answer to both in either direction.

**State the `S` mapping rather than derive it.** `S11`→`TEE` and `S15`→`TFF` cannot be
derived from the schema — `S11` and `S15` are just two strings, and the link is knowledge
about the law timetable. It is a table with a comment saying so.

**Never alias the evening.** `A2` is 2:00 PM and the law school has no evening, so the
`1`-only match is what stops a law course marking itself busy from 2pm onward. Covered by
two dedicated tests.

**Show the course's own spelling.** A cell reading `A1` for a course the student's
timetable calls `A` would be correct but confusing, and it would break block-toggling,
which filters by the slot on the course.

## Corrections made during the work

Worth recording, because both were wrong in the first draft:

- **`S12` vs `S15`.** The mapping was first given as "S12 is TFF1". The schema has no
  `S12` — the 12:35 period carries `S11` (Monday) and `S15` (Friday), which matches the
  `mon`-to-`fri` order of the second slot digit. Corrected to `S15`, which removed the
  need for any schema change.
- **Half-day counts.** Several test expectations assumed a slot id names one day. `A1` is
  Monday 8:00 *and* Wednesday 8:55, so it costs two half-days. Expectations are now
  written out from `chennai.json`.

## Not fixed here

- **The horizontal grid still delegates to amazeui.** The adapter fixes the behaviour but
  the underlying `c.slots.includes(slotName)` remains in the dependency. If a future
  amazeui release adds slot-spelling support, the adapter can be removed.
- **The `DAYS` id mismatch** in `metrics.ts`/`socialScoring.ts` was fixed, but both files
  are dead and are deleted in [05](./05-deletions.md). It cost nothing: no user ever saw
  a wrong score. See that file for the full accounting.
- **Morning/evening preference filters** now resolve correctly for law slots, so
  `isEveningSlot("A")` returns `false` rather than the old empty-result `true` fallback.
  That is a behaviour change in the generator's filters, and it is the correct one.
