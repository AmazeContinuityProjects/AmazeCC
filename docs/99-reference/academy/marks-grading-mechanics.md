---
title: "Marks & Grading Mechanics"
---

# Marks & Grading Mechanics

> **Cheat sheet for how VIT grades land in AmazeCC.**

- **Internal marks** — CAT1 (50%), CAT2 (25%), assignments/quizzes contribute to a subtotal
- **FAT (final assessment)** — remaining external component; its weight differs by course type
- **Absolute grading** — fixed cutoffs (A+ ≥ 90, A ≥ 80, … for standard TH courses) — table lives in `gradeBoundaries.ts` as `ABSOLUTE_GRADE_BOUNDARIES`
- **Relative grading** — curve on class μ/σ ("scale your standings") — used by most subjective courses now
- **Effective vs declared grade** — VIT sometimes lets you improve via revaluation; "effective" is the reconciled record; AmazeCC stores both
- **Credits per course** — usually 4 (TH), 1–2 (LO/lab) — CGPA weighting uses this
- **Grade history** — never synthesized; it's scraped as published — incomplete in the predictor for missing terms
