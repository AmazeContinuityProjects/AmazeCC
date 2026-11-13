---
title: "Marks Predictor — Testing"
---

# Marks Predictor — Testing

> Boundary edge cases are the whole game.

`marksPredictor.test.ts` — ladder edges (79.99 vs 80), relative μ/σ collapsing when n is tiny,
solver correctness at every band boundary, soft-skill cap (10) behavior.
`marksPredictorStorage.test.ts` — custom-course sanitization + persistence round-trip.
`gradeBoundaries.test.ts` / `gradeInsights.test.tsx` — letter bands & prose generation
`marksStatsOp.test.ts` — op merge + missing σ behavior
Render smoke: `CoursePredictorPage` mounts with seeded atoms; `TargetGradeSolver` runs end-to-end.
