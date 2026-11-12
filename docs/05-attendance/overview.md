# Attendance — Overview

Open **Attendance**. The tab has one job: tell the student where they stand, per course, per month, with one authoritative number everywhere — `attendanceSummary.ts`: unweighted sum of `attendedClasses / totalClasses` across all courses. OD requests score against the same odds.

## Screens

1. **Calendar view** — month grid with working days, instructional days, CAT/FAT dates (`calendarDay.ts` classifies)
2. **Course detail** — per-course rates, skip math (`attendancePredictor.ts`), embedded-lab weight
3. **OD tracker** — earned vs "to-date" remaining, semester crossing
4. **Upcoming classes** — this-week strip with lock dates
5. **Overall predictor** — "which class is the safest skip this week?"

Tap anything to drill in; export the month as `.ics` via DayDetailSheet.
