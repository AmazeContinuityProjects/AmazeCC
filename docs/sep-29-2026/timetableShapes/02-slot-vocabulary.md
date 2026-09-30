# 02 — Slot vocabulary & lookups (Phase 1)

## The two spellings of one period

The engineering grid suffixes a `1` for morning and a `2` for evening. `A1` is Monday
8:00 *and* Wednesday 8:55; `A2` is Monday 2:00 and Wednesday 2:55. Two of the 12:35
periods are spelled with an `S` id instead — `S11` Monday, `S15` Friday.

The law school books those same morning periods with the number left off entirely:

| Report | Means |
|--------|-------|
| `A+TA+TAA` | `A1+TA1+TAA1` |
| `C+TC+TCC` | `C1+TC1+TCC1` |
| `E+TE+TEE` | `E1+TE1+S11` |
| `F+TF+TFF` | `F1+TF1+S15` |

The law school has **no evening timetable at all**, so a law slot only ever names a
morning period. That asymmetry is load-bearing — see the exclusions below.

Verified against `public/ffcs/ffcsReport.csv`: 99 rows, all `TLAW*`, all type `TH` or
`ETH`, all in AB5, none of which matched anything before the fix.

## What already exists

`src/lib/slots.ts` was added during the law-slot fix and is the single source of spelling
truth. It already resolves in **both** directions, because which way round the question
arrives depends on the caller — the free-classroom page holds a period and asks who is in
it, while the generator holds a course and asks when it runs.

```ts
lawSlotFor(schemaSlot)      // "A1" -> "A",  "S11" -> "TEE"
schemaSlotFor(lawSlot)      // "A"  -> "A1", "TEE" -> "S11"
slotSpellings(slot)         // every id naming the same period, including itself
expandSlotSpellings(slots)  // a Set where one `has` answers for both spellings
hasSlot(slots, slot)        // does a course holding `slots` run in `slot`?
```

`LAW_SLOT_BY_S_SLOT` (`S11`→`TEE`, `S15`→`TFF`) is **stated, not derived**. There is
nothing in the schema to derive it from: `S11` and `S15` are just two strings, and the
link to the law timetable is knowledge from outside the data.

### The exclusions, and why each is needed

| Guard | Prevents |
|-------|----------|
| only a **lone** trailing `1` is stripped | `A2` is 2:00 PM. Aliasing it would make a law course busy every evening, in every room it occupies, on the strength of a morning class. |
| base `S` excluded | `S1` is a **real** 6:35 PM theory slot that happens to fit the letters-plus-1 shape. Aliasing it would invent an `S` that collides with it. |
| base `L` excluded | `L1`–`L60` are labs and have no law equivalent. |
| `NIL` excluded | VTOP's "no slot" placeholder. It is all letters, so a naive reading hands it an `NIL1`. |
| `S11`/`S15` handled by table, not regex | They carry two digits and would not match the shape; the table is what makes them `TEE`/`TFF` rather than nothing. |
| labs never spell-checked | Only a **theory** slot is ever passed in, so `buildPeriodSlots` cannot lend out a bare `L`. |

## Phase 1 work

### 1a. Move the schema and time primitives here

From `freeClassrooms.ts`, which is the current home of all three:

| Symbol | From |
|--------|------|
| `DayId` | `freeClassrooms.ts:67` |
| `CampusSchema` | `freeClassrooms.ts:61` |
| `SchemaPeriod` | `freeClassrooms.ts:54` |
| `timeToMinutes` | `freeClassrooms.ts:167` |
| `periodKey` | `freeClassrooms.ts:204` |

`freeClassrooms.ts` re-exports them, so `FreeClassroomsTab.tsx:35-40` and both test
files are untouched.

**`resolvePeriods` and `buildDayIndex` stay in `freeClassrooms.ts`.** They are not
duplicates: they *merge overlapping periods* — Monday's lab block at 08:50–09:40 overlaps
the 08:55 lecture for 45 of its 50 minutes, so the two collapse into one window carrying
the union of their slots. The other call sites do not do this and must not start to.

### 1b. Add the one lookup

```ts
interface SlotPeriod {
  day: DayId;
  start: string; end: string;      // raw, for the iCal export
  startMin: number; endMin: number;
  type: "theory" | "lab";
  index: number;                   // the `pIdx` the component copy carried
}

periodsForSlot(schema: CampusSchema, slot: string): SlotPeriod[]
slotsOverlap(theorySlots: string, labSlots: string, schema: CampusSchema): boolean
```

Replaces:

- `FFCSTimetableTab.tsx:204` and `:747`
- `AutoGeneratorModal.tsx:79`
- `exportIcal.ts:74-88`
- `FFCSTimetableTab.tsx:252`

`exportIcal.ts` is the one caller that wants the raw clock strings rather than minutes;
`SlotPeriod` carries both, so it needs no special case.

### 1c. Add the inverse, for the grid direction

```ts
courseInPeriod(courses, schemaSlot)   // buildBands.ts:462, FFCSTimetableTab.tsx:802
ownSlotSpelling(courses, schemaSlot)  // HorizontalTimetableGrid
```

The grid asks the opposite question — it is holding a period and asking who is in it —
so it cannot use `periodsForSlot`.

## The amazeui problem

The horizontal grid is `TimetableGrid` from `@amazecontinuityprojects/amazeui`, whose
source is a separate repository and arrives here compiled. It cannot be edited, and
patching `node_modules` is not a fix that survives an install.

It makes three assumptions, all the same one — that the id the schema prints is the id the
course carries:

1. `courses.find(c => c.slots.includes(period.days[day]))` — so a course booked `A` is
   never found at the `A1` period, and the cell renders as a free period. Indistinguishable
   from a genuinely free one, which is how a whole law timetable came back blank.
2. It *prints* `period.days[day]` — so even once matched, the cell would read `A1` for a
   course the student's own timetable calls `A`.
3. It blocks by that printed id — so tapping records `A1`, and the generator filters
   options by the slot on the *course*, so the block silently does nothing.

`HorizontalTimetableGrid.tsx` was added as a local adapter that fixes all three with one
substitution: for every (day, period) a course occupies, hand the grid that course's own
spelling. The grid then only ever sees the spelling the course uses. Free cells keep the
schema's id — the right thing to print for a period nobody is in — and the time headers
are untouched because they read `period.start`/`end`.

`blockedSlots` is expanded too, so an id blocked from either spelling hatches the cell.

The vertical renderer has the same three problems and *is* editable, which is why
`buildBands.ts` spells them out at the call site instead of routing through the adapter.

## Dependency discipline

`slots.ts` stays free of imports. It declares its own minimal structural types, following
`freeClassrooms.ts`'s existing "only the fields this model reads" pattern, so
`AddedCourse` satisfies them without the module pulling in amazeui. `constants.ts` is
worker-safe (its only import is a campus JSON) and can be imported from the worker
context in Phase 3.

Next: [03 — Occupancy & metrics](./03-occupancy-metrics.md)
