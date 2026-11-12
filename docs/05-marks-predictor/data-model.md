# Marks Predictor — Data Model

`AssessmentComponentType: theory | lab | project | softSkill | x` — each with VIT-standard splits (e.g. theory TH: CAT1 25 + FAT 50 + LD/... — see tables in marksPredictor.ts).
`CoursePrediction: { components: AssessmentComponent[], mu?, sigma?, predicted: Record<string, number> }`.
`GradeLetter`: A+..F (with S grade for softSkills).
