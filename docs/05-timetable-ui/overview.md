# Timetable UI — Overview (walkthrough)

> **In one line:** every grid in the app descends from this one component — change the grid, and the app's face follows.

The Timetable surface is the universal "week view" inside the app:

- opening from **Attendance** — same shell, attendance-tinted cells
- opening from **Academics** — same shell, grade-tone bands
- inside the **FFCS planner** — same shell, planner actions (lock/blacklist)
- inside **exports** (JPG/PDF) — via `exportTimetableHtml.ts` — byte-identical layout snapshot

Auto-density by screen width; user override in Settings → Timetable (Auto/Compact/Detailed). Long-press any cell for the detail sheet (`SlotDetailSheet`) — course, venue, teacher, clash shadows.
