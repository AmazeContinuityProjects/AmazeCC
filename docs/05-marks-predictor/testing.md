# Marks Predictor — Testing

`marksPredictor.test.ts` (the ladder), `marksPredictorStorage.test.ts`, render suites for ladder & editor, `gradeBoundaries.test.ts`, `gradeInsights.test.tsx`.

## Known fragility

Boundary-flag cases at exact cutoffs (e.g. exactly 60) — tests exist in EVERY rounding mode; do not "fix" double-rounding casually.
