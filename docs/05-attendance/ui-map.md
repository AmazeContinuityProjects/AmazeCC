# Attendance — UI Map

- `attendance/AttendanceSubpage.tsx` — _alias_: `export * from "@/lib/attendanceRemainingClasses"` + RegionalCourseDetail re-export (import-path compatibility)
- `attendance/DesktopCourseDetail.tsx` (5k+ words; + `DesktopCourseDetailPane.tsx` alias) — per-course detail
- `attendance/AttendanceCalendarView.tsx`, `MonthGrid.tsx` — month square grid
- `attendance/CalendarSubpage.tsx` + `DayDetailSheet.tsx` — day sheet + RFC-5545 export (`calendarIcs.ts`)
- `attendance/OverallAttendancePredictor.tsx` — simulate skips safely
- `attendance/ODTrackerSubpage.tsx` + `OfficialOdSection.tsx` — OD ledger UI
- `attendance/TimetableGrid.tsx` — attendance-flavored timetable sheet
- `attendance/MoodleConnectSheet.tsx` — LMS sign-in surface
