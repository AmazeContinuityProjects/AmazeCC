---
title: "FFCS Planner — Known Issues & Sharp Edges (complete catalog)"
---

# FFCS Planner — Known Issues & Sharp Edges (complete catalog)

> Read before filing; half of these are load-bearing weirdness.

1. **Slot vocabulary drift.** New spellings (`S11`, `TBB1`, lab-only tokens `L17`…) land without notice. Vocabulary lives in `slots.ts`; UI just renders blanks — add token + test; never special-case UI.

2. **Lab-day pairing.** An embedded TH with its ELA must sit on the same day in the _walk_, but the _UI_ may split — drop-pitching order: `walk` respects `buildWalkRules().labDayConstraints`; if a student sees a theory with no matching lab, the walk failed to prune, not the renderer.

3. **Slot time ambiguity (GLOBAL model).** Two periods mapping to 12:35 means lunch is implicit; the schema renders a divider — don't render two 12:35 periods back-to-back thinking it's a bug.

4. **`ffcsReport.csv` is a frozen photograph.** VTOP shows live seats; the CSV is what was dumped at release time. Warn students accordingly; keep mock files for in-progress semesters only (`winter-slot-timetable.csv`).

5. **`ffcs_settings` merge-on-read.** Removing a settings field silently resurrects the default on next boot — never rename; deprecate-add new.

6. **Share version mismatch.** Old links + new decoder = loud failure. Bump `FFCS_SHARE_VERSION` only with compat story or a hard break note in the changelog.

7. **Tour everywhere.** Every new primary surface adds tour gating on `TOUR_VERSION` — forgetting it confuses returning users on upgrades.

8. **CSV parse robustness is one function.** All CSVs must flow through `parseReportRows`; anything else silently drops rows or splits quoted fields.

9. **Export failures poison global `isDownloading`.** The export boolean lives in one place; a stuck one looks like a dead button until tab reload.

10. **SW CSVs are runtime-cached only.** No CSVs in precache by policy (install weight) — a student who never opened the planner offline has no offline planner.
