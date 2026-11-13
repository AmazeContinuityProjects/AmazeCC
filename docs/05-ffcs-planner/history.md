---
title: "FFCS Planner — History (full timeline)"
---

# FFCS Planner — History (full timeline)

> Newest first; kept as narrative, not data structure — the design decisions matter more than the dates.

- **2026-10 (v3.2.0)** — FFCS rebuild lands: guided mode ships as default for new users, legacy
  generator retained as "classic"; tour system re-written (`TOUR_VERSION` rolls); dossier export
  added; FFCS becomes a first-class PWA route at `/ffcs` with own manifest; `HARD_RESULT_LIMIT`
  ceiling introduced after a field report of 12k-timetable lockups.
- **2026-07/08** — Generator moved into a dedicated worker (`generator.worker.ts`); stream mode
  (`{type:"stream"}`) batched delivery — results paint progressively; `dropPolicy.ts` extracted
  as pure policy; faculty metric weights (wPct/lecture/da/vibe) introduced.
- **2026-06** — SW precache discipline shipped; CSVs removed from precache; install failures on
  metered networks resolved.
- **2026-04/05** — CodeChef-VIT FFCS-inator integration merged (`3afccd0`): same CSV schema; drove
  `parseReportRows` lineage; export parity achieved (Dossier, clash report, iCal, image).
- **2025-autumn** — First AmazeCC planner shipped: hardcoded fall report `ffcsReport.csv`;
  slot vocabulary ported from ffcs-inator; GLOBAL Chennai model chosen (single campus, deliberate).
- **Origins / ancestry** — AmazeCC's generator is a clean-room C re-write in spirit: the _ideas_
  (cartesian walk + clash pruning) descend from CodeChef-VIT's FFCS-inator over ~8k commits; the
  implementation owes it no names. The CodeChef catalogue ships with MIT credit; attribution in
  `public/ffcs/codechef-vit-catalogue.SOURCE.md`.
