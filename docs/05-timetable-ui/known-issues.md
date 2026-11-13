---
title: "Timetable UI — Known Issues (full)"
---

# Timetable UI — Known Issues (full)

1. **Classic mode is a time capsule.** The export PDFs depend on its exact pixel layout — do not modernize.
2. **Auto flip on orientation change.** Rotate an iPad mid-week and the view swaps — never disable the user override.
3. **Five-course cell overflow.** Compact cells with 6 lined-up courses clip silently; density
   auto-bumps at 5+ iff settings allow — verify with a monster-heavy week fixture.
4. **Lunch band rendering.** 12:35 gap is a render-time divider, not a data slot — removing it causes exports to re-wrap; never delete.
5. **Lab period spanning days.** LO slots can run Mon+Wed+Fri identical times — the band merge
   treats each as separate rows; don't collapse across days.
