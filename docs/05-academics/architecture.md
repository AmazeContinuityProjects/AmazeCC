---
title: "Academics — Architecture (the full model)"
description: "grades are fetched once per login (unified /grades), marks per assessment are fetched alongside attendance, and everything derived is computed client-side so the numbers add up."
---

# Academics — Architecture (the full model)

> **In one line:** grades are fetched once per login (unified `/grades`), marks per assessment
> are fetched alongside attendance, and everything derived is computed client-side so the numbers add up.

## 1. The unified payload — read it until you hate it

```
{ success, overall: { cgpa: { gpa, credits, … }, curriculum: [...] },
  semesters: { "CH2024…05": { gpa?, grades: [{ courseCode, credits, grade, effective?, … }] } } }
```

`adaptUnifiedGradesResponse(res)` normalizes all historical name variants (`semesters`, `history`, `grades`)
into `{ gradesSummary, allGrades }`; reconstructs `effectiveGrades[]` for legacy consumers — see
`sync-engine/operations.ts` lines ~124–191 and the adapters doc, `06-sync-engine/16-adapters.md`.

## 2. Marks & boundaries (`lib/gradeBoundaries.ts`)

The boundary table is _grade-theory units_, not weights:

| Course type        | Absolute                                      | Relative          |
| ------------------ | --------------------------------------------- | ----------------- |
| TH (theory)        | fixed cuts                                    | class μ/σ ± tiers |
| LO (lab)           | fixed cuts                                    | class μ/σ ± tiers |
| ETH/ELA (embedded) | split the exam as TH/ELA; each ladder applied | same              |
| Soft-skills        | fixed (often max 10 in raw)                   | n/a               |

`buildGradeBoundaries()` returns ordered letter bands with inclusive-exclusive edges; `gradeAt(score)` is
the single assignment function. The `"relative"` mode trusts the μ/σ from class stats (`marksStatsAtom`)
— when stats are absent, falls back to absolute and says so in the UI ("curve pending").

## 3. CGPA — one source of truth (`lib/gradesEffective.ts`)

`computeCGPA(allGrades) = Σ(gradeNumber × credits) / Σcredits` (effective where available). Course pick-ups,
re-appearance policy, and failed-pass arithmetic all live here — one function, tested, never re-derived in UI.

## 4. The exam schedule — one FFCS call, many takers

`section=schedule` → `{semester, schedule: {<CAT/FAT heading>: ExamItem[]}}` →
`buildExamRows()` (`lib/examSchedule.ts`) → ScheduleDisplay / PDF / iCal / day sheet all consume the same
normalized rows; CAT numbering handled by `examSeries.ts` ("CAT2" ≈ "CAT - II" ≈ "CAT II").

## 5. Course dashboard (`CourseDashboard.tsx` + `CourseDetailSubpage.tsx`)

2,900 lines of per-course deep-dive: marks breakdown, attendance overlap, predicted FAT, faculty card,
exam countdown, notes. **This file is a bounded sub-project** — treat edits like surgical operations:

- any new card → memo candidate; the page mount is heavy otherwise
- `courseDashboard_target` hand-off from `SimplifiedMobileHome`/OD page is the only sanctioned
  entry with params (`?tab=academics&subtab=course-dashboard`)

## 6. Curriculum (`CurriculumPage.tsx`) — the VIT catalog browser

Reads the VIT curriculum API (via op `curriculum`) rather than static JSON — students' branches differ;
categories can drift mid-degree. Renders purely from the op payload + `curriculum.ts` derivations;
never cached beyond the semester.
