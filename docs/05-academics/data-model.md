# Academics — Data Model

`allGradesDataAtom` → `{ grades: { [semesterId: string]: { gpa?, grades: GradeBreakdown[] } } }`
`GradeBreakdown` shape in `types/data/allgrades.d.ts` — code, title, grade, credits, creditsEarned, effective*.
ExamSchedule types in `types/data/schedule.d.ts` (CAT/FAT keys are data-driven — new series need code only).
