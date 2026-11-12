# Academics — Known Issues (full catalog)

1. **CAT numbering ambiguity.** "CAT 1", "CAT-I", "CAT - 1" all appear in VTOP depending on
   course/batch. `examSeries.ts#canonicalSeries()` normalizes only known patterns — report new spellings;
   don't add bespoke `if (name.includes("2"))` branches.

2. **Relative boundary accuracy.** When class μ/σ aren't in `marksStatsAtom` (un-synced season, or the
   student hasn't opted in to cohort stats), relative courses display "curve pending" with absolute
   fallbacks — the grade ladder is correct-by-construction but may be wrong-by-policy for those courses.

3. **Effective grades for revaluation.** VIT applies waitlists/revaluation late; `gradesEffective`
   prefers `effective*` when present; absent that, last known wins — the UI surfaces these as "declared"
   vs "revised" explicitly.

4. **Curriculum mid-degree changes.** VIT sometimes shuffles category rules between years of students;
   `CurriculumPage` reads from the op each launch and will show the _current_ requirements, with a
   mismatch between what the student passed and what the page claims they required — the Audit sheet
   exists for this conversation (IT has happened; students found it honest).

5. **FAT boundary edge painting.** Two courses with the same name in different semesters produce
   identical keys in some charts — always join on `(courseCode, semesterId)`, never alone.

6. **Empty-grade-vs-zero-grade.** VIT sometimes emits `""` grade or `0`; render as "not declared",
   not "F". Any zero-hides ended up as false F's — a bug report happened and was fixed by special-casing.
