# Attendance — Testing

> The invariant suite in miniature: **one percentage function, one calendar model, one predictor.**

Suites that gate this feature: `calendarDay.test.ts` (~1,700 lines), `calendarVtopMonth.test.ts`,
`analyzeCalendar.test.ts`, `attendancePredictor.test.ts`, `marksSync.test.ts` (OD-frozen receipts),
`attendanceRemainingClasses.test.ts`, render suites for `DayDetailSheet`, `DesktopCourseDetailPane`, tab mount smoke.

Verify: `pnpm run test -- calendarDay && pnpm run test -- attendance`

Don't: snapshot calendar classes without pinning `dateKey` timezone — always UTC date strings.
