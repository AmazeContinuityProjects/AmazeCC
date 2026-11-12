# Attendance — Architecture

`attendanceMarks` op → `setAttendanceAndOD` → atoms + localStorage (`attendance`).
Calendar model: `analyzeCalendar` classifies (working/holiday/instructional/important); `calendarDay.ts#TEACHING_DAYS` defines the teaching week.
Predictor: `predict(remaining, attended, targetPct)` → `{ canSkip, needToAttend, safe }` — recomputed on mount (cheap, never cached).
OD ledger: `odHoursDataAtom` + `officialOdAtom` — "official" OD from `officialOd` op wins over local assumptions.
Day sheet: `DayDetailSheet.tsx` joins calendar + exam cells + latest marks.
