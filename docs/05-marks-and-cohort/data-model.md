# Marks & Cohort — Data Model

`AssessmentKey = sha256(classId::component::normalizedTitle)`
Server payload: `{ stats: { [classId]: { μ, σ, topFraction, n } } }`.
Frozen receipts: `[{ key, received, ts }]`.
