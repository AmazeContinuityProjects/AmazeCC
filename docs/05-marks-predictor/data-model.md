# Marks Predictor — Data Model (precise)

## Component schema

```ts
AssessmentComponentType =
  "CAT1" |
  "CAT2" |
  "CAT3" |
  "FAT" |
  "ASGN" |
  "QUIZ" |
  "LAB" |
  "PROJECT" |
  "INT" |
  "ASSIGNMENT" |
  "REPORT" |
  "VIVA" |
  "UNKNOWN";
```

Every component: `{ id, type, label, maximum, obtained?, weight? , regimen? }` — regimens allow
courses to define custom grading classes (e.g., 30/70 vs 40/60 splits).

## Course prediction state

```ts
PredictionState = {
  courseCode: string,
  regimen: RegimenTable,          // weight distribution per course type
  components: AssessmentComponent[],
  classStats?: { mu: number, sigma: number, n: number, topFraction?: number },
  custom?: boolean,
}
```

## Storage

`predictor_custom_courses` — user-defined what-if courses (never sent anywhere)
`predictor_mocks_v1` — named prediction snapshots (personal)

Atoms consumed: `marksDataAtom` (seeds components on tab open — your current real marks),
`marksStatsAtom` (μ/σ for relative).
