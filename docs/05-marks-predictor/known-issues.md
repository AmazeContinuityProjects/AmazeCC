---
title: "Marks Predictor — Known Issues (full)"
---

# Marks Predictor — Known Issues (full)

1. **Relative grading pre-results is speculative.** VIT doesn't publish class σ until FAT closes —
   the displayed μ/σ are learned-from-cohort receipts and may be garbage for a fresh section.

2. **Custom regimen mis-spec.** A student can describe 30/30/40 with passed components but no
   FAT → the ladder renders, but "to-deliver" always shows blank FAT-gap — the UI should surface
   this before acting confused. (It does now.)

3. **Double-count patches.** Some VIT faculty give partial internals as "attendance" — the marks table
   sometimes contains such rows with `category: "Attendance"` and zero weight — predictor filters-ish;
   not all such rows are detectable. Verify by eye when numbers seem weird.

4. **softSkill 10-mark cap.** This is a VIT policy the predictor must respect but exams may not enforce
   identically across faculties (some enforce it, some don't). The cap is documented in the editor
   tooltip; if a course violates it, the predictor adjusts silently and warns in console.

5. **Marks scale mismatch.** Courses mostly use 100-scaled internals, VIT sometimes ships 10-scaled rows
   (LAB without weight conversion). Any row with `maximum === 10` is expanded to 100 implicitly —
   too clever, and wrong across faculties; flag it in the report instead of compensating silently.
