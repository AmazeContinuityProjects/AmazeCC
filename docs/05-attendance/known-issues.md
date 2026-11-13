---
title: "Attendance — Known Issues (extended)"
---

# Attendance — Known Issues (extended)

1. **Ambiguous slots** — VTOP occasionally ships a class with both `TH` and `LO` in one row;
   the attendance table then reports double-held periods for the same course. The attendance sum
   stays legal; the _predictor_ may overestimate remaining. Treat MA 105-esque courses with caution.

2. **Friday/Saturday fatigue sign** — `TEACHING_DAYS` shows classes on Saturdays that some faculties
   run as "extended sessions" — the predictor counts each as one period, same as Mondays. VIT treats
   them the same; don't fork.

3. **OD approved but not yet reflected** — official OD lands on the API with a lag (days). The
   `odHoursDataAtom` bridges by counting manual "asked for OD" marks as effective-wasted until the
   server agrees. The drift log lines in the sync sheet surface mismatches honestly; don't hide them.

4. **Semester boundaries** — freshers see prior-semester OD entries because VIT counts are not
   per-term-clean in the UI; we surface "suggested semester cap" text instead of deleting data.

5. **Percentage collapse at 0/0** — a course with zero classes held shows 0% in red, which is
   technically wrong; the UI special-cases `totalHeld === 0` → shows "—". If you see 0/0 red anywhere,
   that's a regression.

6. **Cache staleness after VTOP re-classifies** — sometimes VTOP moves a recorded OD into the
   attendance bucket with different attribution; the frozen receipt set for marks-side attendance is
   separate from the marks side — misalignment happens at report boundaries, not mid-week.

7. **Date picker on the day sheet** — tapping an adjacent-campus calendar entry may land on a
   different `dateKey` when the device TZ differs from India; always compare keys, never timestamps.
