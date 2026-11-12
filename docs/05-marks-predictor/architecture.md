# Marks Predictor — Architecture

Pure engine: `lib/marksPredictor.ts` — no DOM, no React. Two readings of the same roster:
absolute (fixed cutoffs) and relative (μ/σ-scaled). `gradeBoundaries.ts` builds both;
`gradeInsights.ts` narrates them.
UI container: `CoursePredictorPage.tsx` — scope via `useCoursePredictionScope` (enrolled vs custom courses).
Storage: `marksPredictorStorage.ts` — mocks and custom courses under `predictor_*`.
