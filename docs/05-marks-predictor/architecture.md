# Marks Predictor — Architecture (deep)

> **In one line:** a grade-boundary solver for what VIT hasn't graded yet — two parallel ladders
> (absolute / relative) and a solver that inverts them to "what do you need on FAT".

## 1. The math, in one page

Theory TH assessment for a 4-credit course (representative pattern):
CAT1 25 · CAT2 25 · FAT 50 (2024–25 schema)
Pass cutoffs: per-GP table in `gradeBoundaries.ts` — letter S counted as pass too in TH.

Each component converts to "points":
`points = obtained × (100 / maximum)` (normalized to 100).

Letter assignment (absolute):

```
≥90 → S  · ≥80 → A · … · ≥40 → E · <40 → F
```

(softSkill TH variant: lower cap of 10 — see `marksPredictor.ts#softSkillBoundary`)

Relative variant:

```
mu, sig = μ,σ of class obtained (from marksStatsAtom or manual editor)
z = (obtained − mu) / sig
letter bands = mu ± k·σ  (k enumerated in GRADE_DISTRIBUTION table)
```

## 2. The solver (`lib/marksPredictor.ts`)

`solveTarget(components, targetLetter)`:

1. solves TH/LO/ETH splits independently when sufficient stats exist
2. returns the _achievable_ pred based on current inputs + remaining components (FAT)
3. `targetGrade Solver` = solve for `obtained(FAT) ≥ …` with rounding rules pinned
4. `gradeInsights.ts` narrates: "You need ≥ 183/200 to guarantee S (absolute)" etc.

## 3. State (`CoursePredictorPage.tsx`)

- Local to page — nothing persists except mock/custom course definitions (`marksPredictorStorage.ts`)
- Scales: enrolled courses only (or "custom enrolled what-if") via `useCoursePredictionScope`

## 4. Data deps

- atoms: `marksDataAtom` (current marks) · `marksStatsAtom` (class distribution)
- storage: `marksPredictorStorage.ts` under `predictor_*`
- stats: cohort stats require the student to have run `marksStats` once (it's in the quick sync)

## 5. Failure modes

- σ = 0 (whole class scored same) → relative ladder collapses to absolute with notice
- Missing FAT component in table → solver returns `null` → UI shows "add FAT to complete the ladder"
- Custom course with unsupported mix → clear "not supported" rather than wrong math
