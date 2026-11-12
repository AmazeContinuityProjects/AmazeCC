# Attendance — Data Model

VTOP payload (`attendanceRes`, see `types/data/attendance.d.ts`):
`{ attendance: [{ courseCode, courseTitle, attendedClasses, totalClasses, category }], … }`
— unweighted-sum is canonical; do not average per-course percentages.
Predictor result lives in component state only.
`CalendarInput`/`CalendarType` in `types/data/semTT.d.ts`; events typed loosely by VTOP via cheerio scrapes (strings mostly).
