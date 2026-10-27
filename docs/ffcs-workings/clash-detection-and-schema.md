# Clash Detection & Campus Schema Engine

This document explains how the **FFCS Timetable Tab** and the **Timetable Generator** detect and prevent course schedule clashes according to the campus schema.

---

## 1. Campus Schema (`src/data/campus/*.json`)

The campus schema defines the physical schedule grid for a VIT campus (e.g. `chennai.json`).
It contains two period lists:
- `theory`: Array of time blocks, each having `start`, `end`, and a `days` map (`{ mon: "A1", tue: "B1", ... }`).
- `lab`: Array of lab blocks, each having `start`, `end`, and a `days` map (`{ mon: "L1", tue: "L7", ... }`).

### Time Normalization (`src/lib/slots.ts`)
Clock times (e.g., `"08:00 AM"`, `"1:25 PM"`, `"2:00 PM"`) are converted into integer minutes elapsed from midnight:
- `"8:00 AM"` $\rightarrow 480$ minutes
- `"1:25 PM"` $\rightarrow 805$ minutes
- `"2:00 PM"` $\rightarrow 840$ minutes

### Period Lookup (`periodsForSlot`)
When given a slot token (e.g. `"A1"` or `"L11"`):
1. `periodsForSlot` scans both `schema.theory` and `schema.lab`.
2. It expands any alternative spellings (such as law school aliases: `A` $\leftrightarrow$ `A1`, `S11` $\leftrightarrow$ `TEE`).
3. It returns an array of `SlotPeriod` objects:
   ```typescript
   export interface SlotPeriod {
     day: "mon" | "tue" | "wed" | "thu" | "fri";
     start: string;      // e.g. "08:00 AM"
     end: string;        // e.g. "08:50 AM"
     startMin: number;   // e.g. 480
     endMin: number;     // e.g. 530
     type: "theory" | "lab";
     index: number;
   }
   ```

A single slot like `"A1"` maps to multiple periods in the week (e.g., Monday 8:00–8:50 AM and Wednesday 8:55–9:45 AM).

---

## 2. Mathematical Definition of a Clash

In continuous time, two scheduled events $A$ and $B$ clash if and only if:
1. They take place on the **same day** (`A.day === B.day`).
2. Their open time intervals $(A_{\text{start}}, A_{\text{end}})$ and $(B_{\text{start}}, B_{\text{end}})$ overlap.

The canonical mathematical formulation is centralized in [`src/lib/slots.ts`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/lib/slots.ts):

```typescript
/** Do two scheduled periods overlap in time on the same day? */
export function periodsOverlap(a: SlotPeriod, b: SlotPeriod): boolean {
  return a.day === b.day && Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin);
}

/** Do any periods in list `a` collide with any periods in list `b`? */
export function periodListsClash(
  a: readonly SlotPeriod[],
  b: readonly SlotPeriod[]
): boolean {
  for (const x of a) {
    for (const y of b) {
      if (periodsOverlap(x, y)) return true;
    }
  }
  return false;
}

/** Find the first pair of clashing periods between two lists, or null if clash-free. */
export function findPeriodClash(
  a: readonly SlotPeriod[],
  b: readonly SlotPeriod[]
): { periodA: SlotPeriod; periodB: SlotPeriod } | null {
  for (const x of a) {
    for (const y of b) {
      if (periodsOverlap(x, y)) return { periodA: x, periodB: y };
    }
  }
  return null;
}
```

### Boundary Minute Analysis
Suppose Period A is Theory 8:00 AM – 8:50 AM ($[480, 530]$) and Period B is Lab 8:50 AM – 9:40 AM ($[530, 580]$):
- $\max(480, 530) = 530$
- $\min(530, 580) = 530$
- Condition: $530 < 530$ evaluates to **`false`**.
- **Result**: No clash. Back-to-back classes touching at the boundary are valid.

Suppose Period C is Theory 8:55 AM – 9:45 AM ($[535, 585]$) and Period B is Lab 8:50 AM – 9:40 AM ($[530, 580]$):
- $\max(535, 530) = 535$
- $\min(585, 580) = 580$
- Condition: $535 < 580$ evaluates to **`true`** (overlap of 45 minutes).
- **Result**: **Clash detected.**

---

## 3. How the FFCS Timetable Tab Handles Clashes

In [`FFCSTimetableTab.tsx`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/components/custom/exams/FFCSTimetableTab.tsx), clash detection operates interactively:

1. **Incremental Validation on Add**:
   When the user selects an offering and clicks "Add Course":
   - The slot string (e.g. `"A1+TA1+L11+L12"`) is tokenized into `["A1", "TA1", "L11", "L12"]`.
   - `checkClashes(slotsArray)` checks:
     1. **Blocked slots**: Verifies if any token is in `blockedSlots`.
     2. **Existing course conflicts**: Flattens periods for the candidate course and compares against every already-enrolled course using the interval overlap test.
   - If any period clashes, an error banner is displayed (`Time clash on WED between new slot and BAECE204 (A1+TA1)`), and the addition is aborted.

2. **Proactive UI Badges**:
   In the course offerings accordion (`AvailableSlotsAccordion`):
   - Every candidate offering runs `checkClashes(slotsArray)`.
   - Clashing offerings display a prominent red **`Clash: Time clash on ...`** badge and their selection is disabled.

3. **Faculty Swapping**:
   - Swapping a faculty inside the grid or generator uses `sameSlotFacultyAlternatives`.
   - Because it strictly filters for faculty teaching at the **exact same slot tokens**, time slots do not move and the timetable is guaranteed to remain clash-free.

---

## 4. How the Timetable Generator Handles Clashes

In [`src/components/custom/exams/FFCS/logic/generate.ts`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/components/custom/exams/FFCS/logic/generate.ts):

1. **Pre-Filtering (Pruning before Search)**:
   - Filters out offerings with user-blocked slots (checked across all alias spellings via `slotSpellings`).
   - Filters out offerings violating user morning/evening preferences or custom time bounds (`minStartTime`, `maxEndTime`).
   - Filters out incomplete embedded courses missing either half.

2. **Pre-Computing Schedule Windows**:
   - For every candidate offering, pre-resolves all slot tokens into `SlotPeriod[]` objects:
     `windowsPerCourse[courseIndex][offeringIndex] = periods`
   - This eliminates repeated schema lookups during backtracking.

3. **Backtracking Search (`walkCombinations`)**:
   - Depth-first search over courses $0 \dots N-1$.
   - At each course level, tests candidate offerings against `chosenWindows` using `clashes(periods, chosenWindows)`.
   - If a collision occurs with any previously chosen period, the entire sub-tree is pruned instantly:
     ```typescript
     if (clashes(periods, chosenWindows)) continue;
     chosen.push(options[index][i]);
     chosenWindows.push(...periods);
     walk(index + 1);
     chosenWindows.length = chosenWindows.length - periods.length;
     chosen.pop();
     ```
   - When the run enables `separateLabDays`, `avoidConsecutiveLabs`, or a `minHalfDays` floor, the same step also declines an offering whose bitmask would break that rule mid-week. All three rules are *monotone* over partial weeks (a shared lab day, a consecutive pair, and an occupied half-day cell can each only be added, never removed), so cutting at first break drops exactly the sub-trees with no legal leaf — and `limit` then counts rule-legal combinations rather than every conflict-free one.
   - Only combinations with **zero period clashes across all courses** reach the leaf node and are emitted as candidate timetables.

4. **Post-Search Constraints**:
   - The same three rules remain as visit-time checks (`labsShareADay`, `labsAreConsecutive`, and the `timetableMetrics.halfDays` floor). With in-tree pruning active they are a guard behind it; without it — no rule flag set — they are the whole of the rule, as they were before pruning existed.
   - `facultyScoreFilters` is still only a post-search filter: it aggregates over the whole week's faculty and cannot be decided from a partial one.

---

## 5. Verification: Is the Clash Prevention Code Valid?

### Technical Verification Summary

| Verification Aspect | Status | Assessment |
|---|:---:|---|
| **Mathematical Correctness** | **VALID** | $\max(s_1, s_2) < \min(e_1, e_2)$ accurately handles all interval intersections, partial overlaps, and adjacent boundary contacts. |
| **Multi-Slot Token Handling** | **VALID** | Compound slots like `A1+TA1` or `L11+L12` are properly split by `+` and mapped to individual period blocks before clash evaluation. |
| **Multi-Day Slot Mapping** | **VALID** | Slots occurring on multiple days (e.g. `A1` on Monday and Wednesday) are correctly expanded into distinct `SlotPeriod`s per day. |
| **Shift Separation** | **VALID** | Morning and Evening slots in the schema do not intersect. Cross-shift overlaps (e.g. Morning Theory vs Core Morning Lab) are detected and flagged. |
| **Generator Invariant** | **VALID** | The generator only emits timetables where all Cartesian pairs evaluate to `clashes(a, b) === false`. |
| **Interactive Guard** | **VALID** | `checkClashes` in `FFCSTimetableTab` strictly aborts before state mutation if an overlap is detected. |

### Edge Case Considerations & Defenses
- **Schema Missing Time**: Handled safely. If start/end time is malformed, `timeToMinutes` returns `null` and the period is ignored rather than erroneously evaluated as midnight (0).
- **Embedded Half Swapping**: `sameSlotFacultyAlternatives` requires identical slot token sets, preventing faculty swaps from introducing slot drift.
- **Law School Aliases**: Schema aliasing handles `A` $\leftrightarrow$ `A1`, `TEE` $\leftrightarrow$ `S11`, ensuring law students are not double-booked into engineering periods.
