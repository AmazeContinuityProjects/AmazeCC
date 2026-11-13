---
title: "Design Notes — Naming and History"
---

# Design Notes — Naming and History

> A field guide to the fossils of AmazeCC — each one was a real decision, often under deadline.

## The famous ones

- **`StatCards.tsx` exports `StatsCards`** — deleted UI, living export; kept so the tab doesn't fail to compile on partial revert. Dead file; delete when confident.
- **Two tour systems** (`exams/FFCS/features/tour/*` and `exams/marks-predictor/tour/*`) — verbatim copy-paste; the second got renamed providers only. Merge candidate after both mature.
- **Three timetable grids + shell** — `ModernHorizontalTimetableGrid` (current), `HorizontalTimetableGrid` (bridges), `ClassicHorizontalTimetableGrid` (amazeui legacy for export parity), `TimetableGridShell` (sticky gutter). Keep all four; exports depend on exact pixel paths.
- **amazeui shims in `shared/`** — ~18 one-line re-exports; deliberate migration seam; don't inline them.
- **`UniformControls` / `Controls.tsx` / `OptionPicker`** — same picker re-homed three times; the amazeui dependency kept but isolated.
- **Internal `stats` vs `percentages`** — computed differently today; `attendanceSummary.ts` is authoritative.
- **`vitolDisplay` lowercase** — exported name inconsistent with file name; some imports match one, some the other; both work, neither greps cleanly.
- **`courseHelpers.tsx` in exams/** — JSX helpers in a "logic" folder, colored JSX for course-type chips and faculty rows; pure constants have moved to `courseDetailHelpers.ts`.
- **Normalized names everywhere but the code stops at `…RemainingClasses`** — `"Subpage"` alias re-exports kept for compatible imports across eras.
- **`Guided` vs `Modern` vs `Classic` planner modes** — three implementations coexisting; settings atom picks, all maintained together by hand.

## Color/typography fossils

- Tailwind v3-era `indigo-600` classes lingering next to zinc-dialect zinc-*/white-alpha comments
- `--font-geist-mono` loaded, used only for ids/short strings
- `cyberpunk` theme experiments removed in 2026-10; leftover `manifest-fire.json` is a test harness, not a theme
