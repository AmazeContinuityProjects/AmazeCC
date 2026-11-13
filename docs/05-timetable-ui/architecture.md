---
title: "Timetable UI — Architecture (deep)"
description: "three grid dialects — vertical (phone), horizontal (desktop), classic (legacy) — unified under one entry point and one density model."
---

# Timetable UI — Architecture (deep)

> **In one line:** three grid dialects — vertical (phone), horizontal (desktop), classic (legacy) — unified under one entry point and one density model.

## 1. The canonical entry (`src/components/custom/timetable/TimetableView.tsx`)

```
<TimetableView periods={periods} mode={"auto"|"vertical"|"horizontal"|"classic"} density={"auto"|"compact"|"detailed"} />
```

- `auto` mode: viewport width decides — `&lt;700 px` → vertical; 700–1100 → horizontal; >1100 → horizontal detailed
- density by sub-level inside each mode (compact stacks 4+ courses per period; detailed renders full course card)
- `useTimetableViewMode` reads `settingsAtom` override; no prop drilling for mode selection

## 2. The variants (files, in order of preference)

| Variant             | File                                 | Notes                                                            |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Modern vertical     | `VerticalTimetableGrid.tsx`          | 7-day × period heatmap; density-aware cells                      |
| Modern horizontal   | `ModernHorizontalTimetableGrid.tsx`  | band-per-row; sticky gutter; merges multi-period (rowSpan) spans |
| Horizontal (bridge) | `HorizontalTimetableGrid.tsx`        | rule-variant runner for migration era                            |
| Classic             | `ClassicHorizontalTimetableGrid.tsx` | amazeui legacy; frozen — exports depend on its exact layout      |

## 3. The band model (`lib/buildBands.ts`)

Transposes (day × period) cells → (band × day) blocks. Bands merge adjacent same-course spans.
`periodSkeleton.ts` provides theory/lab pairing — labs column-aggregate across days for stand-alone LO slots.

## 4. Density model (`useTimetableViewMode.ts`)

`auto` picks by width AND density class of the semester? No — width only. Density settings
(`timetableCellDensity`) override compact/detailed independently of width.

## 5. Merge & clash rendering

rowSpan merging collapses identical consecutive cells; divider rows skipped for half-days;
lab periods (same window + adjacent days) rendered with a lab color band on the left edge.

## 6. Academic vs attendance rendering

Same components render both TimetableGridShell paths; attendance uses the same Grid with
attendance-derived cell status styles (attended/missed/pending) from `DesktopCourseDetail`.
