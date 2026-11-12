# Attendance — Known Issues

1. Official OD lags local assumptions — official wins; the UI must say so.
2. CAT/FAT weekend collisions — `TEACHING_DAYS` is a pinned hard list; change only with tests.
3. Predictions are heuristics — lab-heavy weeks fool them; treat as advisory.
4. `attendanceRemainingClasses.ts` counts lab periods as theory-ish in some shapes — `labFatWeek.ts` owns the compensation logic.
