# Marks Predictor — UI Map

| File                          | ~Lines | Job                                             |
| ----------------------------- | ------ | ----------------------------------------------- |
| `CoursePredictorPage.tsx`     | ~700   | the page — per-course view                      |
| `AssessmentMarkSheet.tsx`     | ~250   | the one sheet where marks get edited            |
| `AssessmentRegimenEditor.tsx` | ~300   | weight/regimen editor with freeze rules         |
| `TargetGradeSolver.tsx`       | ~150   | invert the ladder                               |
| `AddAssessmentSheet.tsx`      | ~150   | add assessment with remaining-weight precompute |
| `AddCustomCourseModal.tsx`    | ~150   | what-if a course you're not taking              |
| `ClassCurveEditor.tsx`        | ~120   | manual μ/σ override                             |
| `GradeLadderChart.tsx`        | ~200   | the band-bar ladder (absolute/relative toggle)  |
| `useCoursePredictionScope.ts` | ~120   | enrolled-course scope hook                      |
| `tour/` (4 files)             | ~400   | near-verbatim copy of FFCS tour system          |

Keep the page-per-course split — the interior is enormously heavy if two courses render at once.
