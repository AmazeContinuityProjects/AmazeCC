# Timetable UI — Architecture

Canonical entry: `TimetableView.tsx` — picks variant + density (auto/vertical/horizontal/classic).
Grids: `VerticalTimetableGrid` (phone), `ModernHorizontalTimetableGrid`, `HorizontalTimetableGrid`, `ClassicHorizontalTimetableGrid` (amazeui legacy preserved for parity with exports).
Band transposition: `buildBands.ts` (left-day grid → column bands). Slot model: `slots.ts`.
