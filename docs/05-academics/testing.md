# Academics — Testing

> The intensity of testing is proportional to the financial anxiety of students on exam day.

- `gradeBoundaries.test.ts` — the letter-ladder edge cases (exact cutoffs everywhere; double-rounding is a known footgun — do not "fix" rounding modes)
- `gradesEffective.test.ts` — CGPA arithmetic; revaluation/best-effort policy rules
- `gradeHistory.test.ts` — numbers-as-numbers for trends/distribution views
- `gradeInsights.test.tsx` — insight strings math + render
- `examSeries.test.ts` — CAT/FAT taxonomy bugs found in the wild ("CAT2" vs "CAT - II")
- `marksPredictor.test.ts` — boundary application through the ladder + σ paths
- `marksStatsOp.test.ts` — class stats merge + missing behavior
- `academics.*` — curriculum op: `ffcsCatalogCurriculum.hook.test.tsx` + `curriculum.test.ts`
- Render suites: `CurriculumPage`, `ScheduleDisplay`, `CoursePreviewCard`, `CourseDetailSubpage` smoke
