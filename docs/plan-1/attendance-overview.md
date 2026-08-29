# Plan: At-a-glance Attendance Overview (Incremental Polish)

- **Status:** Ready to implement
- **Scope:** Add a summary header to the Attendance tab only. No layout/UX redesign, no theme or animation overhaul.
- **Mode decision:** At-a-glance overview + Incremental polish (per user).
- **Target area:** `AttendanceTabs` component (the main "Weekly attendance" view).

---

## 1. Problem

The Attendance tab (`src/components/custom/attendance/AttendanceTabs.tsx`) currently jumps
straight from the `PageHeader` into the weekday selector (`AttendanceTabs.tsx:339`) and the
`DailyPlanner` timeline. There is **no at-a-glance overview** of a student's overall standing:

- No aggregate attendance percentage.
- No sense of how many courses are safe vs. at risk.
- No quick call-to-action when something needs attention.

Students must scroll the timeline or open the Predictor to understand their situation. The
global `StatCards` shows one attendance number but not course-level health.

## 2. Goal

Add a compact **Attendance Summary** block at the top of the Attendance tab that renders
instantly from data already in scope, using the existing visual language and thresholds.

## 3. Deliverable

A new component `src/components/custom/attendance/AttendanceSummary.tsx`, rendered inside
`AttendanceTabs` between `PageHeader` and the weekday selector.

### 3.1 Contents of the summary block

1. **Aggregate attendance ring**
   - Reuse `CircularProgress` from `@amazecontinuityprojects/amazeui`
     (used by `CourseCard.tsx:197`, `DesktopCourseDetail.tsx:8`).
   - Value = weighted average already computed by `overallSimStats`
     (`AttendanceTabs.tsx:231-270`). Lab classes count ×2, theory ×1.
   - Ring color follows status:
     - `red` when `avg < threshold`
     - `amber` when `threshold ≤ avg < threshold + 10`
     - `emerald` otherwise
     - (same color rule as `DesktopCourseDetail.tsx:341-345` and `DailyPlanner.tsx:359-365`)

2. **Headline text**
   - Big aggregate % + `(attended / total)` fraction using the same weighted totals
     from `overallSimStats`.
   - Small label "Overall attendance".

3. **Course health counts** — three stat chips computed from `data.attendance`:
   - `critical` count: `pct < threshold`
   - `warning` count: `threshold ≤ pct < threshold + 10`
   - `safe` count: `pct ≥ threshold + 10`
   - `threshold` = `settings.targetAttendance` (default 75, or 85 when `isDayscholarWithBus`).
   - Each chip shows a colored dot + count + label ("Safe" / "Warning" / "Critical").

4. **"Needs attention" CTA** (conditional)
   - Shown only when `critical + warning > 0`.
   - Label: "N course(s) need attention".
   - `onClick` → `setShowPredictor(true)` (existing handler, `AttendanceTabs.tsx:332`).

5. **Critical course chips** (small, optional-but-included)
   - For each course below `threshold`, render a tiny pill with its `courseCode`.
   - Helps the student see exactly which courses are at risk without opening anything.

### 3.2 Props for `AttendanceSummary`

```ts
interface AttendanceSummaryProps {
  attendance: any[];            // data.attendance
  simulatedSkips: Record<string, number>;
  isDayscholarWithBus: boolean;
  thresholdPct: number;         // resolved target attendance
  onOpenPredictor: () => void;
}
```

All inputs already exist in `AttendanceTabs`; no new data fetching.

## 4. Where to insert

In `AttendanceTabs.tsx`, after the `PageHeader` block (ends ~line 337) and before the
"Rich Weekday Selector" comment (line 339):

```tsx
<AttendanceSummary
  attendance={data.attendance}
  simulatedSkips={simulatedSkips}
  isDayscholarWithBus={isDayscholarWithBus}
  thresholdPct={isDayscholarWithBus ? 85 : 75}
  onOpenPredictor={() => setShowPredictor(true)}
/>
```

Note: `thresholdPct` should be read from `settings.targetAttendance` if present, mirroring
`getTargetAttendancePct()` used in `CourseCard.tsx:54`, `DailyPlanner.tsx:320`,
`DesktopCourseDetail.tsx:165`. Default to 75 (or 85 for dayscholar-with-bus) when unset.

## 5. Styling rules (consistency)

Reuse the exact visual language already present:

- Container: `rounded-2xl border border-gray-200 dark:bg-black dark:border-gray-800/80 shadow-sm p-5`
- Layout: `flex flex-col gap-4 md:flex-row md:items-center md:justify-between`
- Chips: `rounded-xl border bg-gray-50 dark:bg-gray-900 px-3 py-2`
- Typography: `font-outfit`, `tracking-wider` uppercase labels, `font-black` numbers.
- Palette: emerald (`#10B981`/red-500 family), amber (`#F59E0B`/amber-500), red (`#EF4444`/red-500).
- Respect reduced motion: avoid new `animate-ping`/`animate-pulse` loops; optional
  `animate-in fade-in slide-in-from-bottom-4 duration-500` (already used on the parent wrapper
  at `AttendanceTabs.tsx:312`). Add `motion-reduce:animate-none` if any animation is added.

## 6. Behavior / edge cases

- **Empty data:** `AttendanceTabs` already early-returns `<NoContentFound />` at line 295,
  so the summary only renders with valid data.
- **Simulated skips:** reuse `simulatedSkips[courseCode]` so the ring, counts, and CTA update
  live when the user simulates skips in `DailyPlanner` / `DesktopCourseDetail`.
- **Lab weighting:** use `courseCode.endsWith("(L)")` → weight 2, matching
  `AttendanceTabs.tsx:242-247`.
- **Threshold override:** honor `settings.targetAttendance`; for dayscholar-with-bus the
  warning band is `threshold+10` (85→95) per `DailyPlanner.tsx:360`.

## 7. Out of scope (explicitly excluded)

- No Framer Motion overhaul (no sliding selection indicator, no spring entrances).
- No midnight-theme rework (`dark:` vs `midnight:` classes left as-is).
- No changes to `DailyPlanner`, `DesktopCourseDetail`, `OverallTrackerSubpage`,
  `AttendanceSubpage`, `TimetableGrid`, or data flow.
- `CourseCard.tsx` is dead code (never imported) — left untouched.

## 8. Files touched

| File | Change |
|------|--------|
| `src/components/custom/attendance/AttendanceSummary.tsx` | **New** component |
| `src/components/custom/attendance/AttendanceTabs.tsx` | Import + render `<AttendanceSummary>` once |

## 9. Verification

1. `pnpm lint` — must pass.
2. `pnpm typecheck` — must pass (`tsc --noEmit`).
3. `pnpm dev` → open Attendance tab:
   - Summary ring value matches the `StatCards` attendance % (within rounding).
   - Safe / Warning / Critical chip counts sum to total number of courses.
   - Simulate a skip on a course in the timeline → ring, counts, and CTA update live.
   - If any course is below threshold, "N courses need attention" button appears and opens
     the Predictor.
   - Change `settings.targetAttendance` → thresholds and classifications shift accordingly.
   - Mobile (narrow viewport): summary stacks vertically and remains readable.

## 10. Reference: existing threshold logic to mirror

- `AttendanceTabs.tsx:231-270` — `overallSimStats` weighted average.
- `AttendanceTabs.tsx:272-291` — `dayHasCriticalCourse` threshold read from `settings`.
- `DailyPlanner.tsx:320-370` — `thresholdPct`, warning band, color classes.
- `DesktopCourseDetail.tsx:165-205` — `getTargetAttendancePct`, can-miss / need classes math.
- `CourseCard.tsx:54-69` — `getTargetAttendancePct` default 75.
