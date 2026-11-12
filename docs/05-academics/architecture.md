# Academics — Architecture

Seed data: unified `/api/grades` → `applyUnifiedGrades` → `gradesDataAtom` + `allGradesDataAtom`
(201 ok: `adaptUnifiedGradesResponse` normalizes historical payload name-shapes).
Marks: per-assessment breakdown — marks remain _fresh_ only via test payload (`VTOP doStudentMarkView`); client renders with absolute/relative boundaries from `gradeBoundaries.ts`.
Exam schedule: same FFCS bundle (`/api/ffcs?section=schedule`) — one fetch, three consumers (download, .ics, day sheet).
CGPA: `gradesEffective.ts` — single source of cumulative figures; predictor GPA separate (`predictorGpa.ts`).
