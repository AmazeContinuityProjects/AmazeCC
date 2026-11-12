# Attendance — Storage & State

Atoms: `attendanceDataAtom`, `marksDataAtom`, `calendarDataAtom`, `odHoursDataAtom`, `officialOdDataAtom`, `moodleDataAtom`.
Storage keys: `attendance`, `marks`, `calendar`, `officialOD_*`, `cache_curriculum`.
Semester change → full sync wipes them implicitly (caches are additive; attendance is replaced).
