# FFCS Planner — History

> Provenance and the decisions that made the planner this shape. Newest at top.

- **2026-10** — FFCS rebuild lands (`v3.2.0` changelog): new generator, guided mode, tour
  overhaul, share-link redesign (versioned payloads), dossier export.
- **2026-07..09** — CodeChef-VIT FFCS-inator merged via `plan-1` era reports; import pipeline
  (`features/import/*`) written to accept its CSV; the codechef-vit catalogue shipped with MIT credit.
- **2026-06** — SW precache tightened after phones choked on semester CSVs at install.
- **2025-autumn** — First AmazeCC FFCS port; hardcoded `ffcsReport.csv` approach for speed of
  shipping — still the runtime source for the stable reports.
- **2025-spring** — VTOP slot syntax analysis (`sep-29-2026/timetableShapes/*`, archived) drove
  the `slots.ts` vocabulary and GLOBAL Chennai schema choice (single-campus by design).
- **Origins** — `codechefvit/ffcs` (FFCS-inator, Arya & friends) was the direct ancestor;
  AmazeCC is a clean-room rewrite in spirit: the clash math, drop ladder, and faculty ranking
  carry ancestral logic; share links and PWA identity do not share ancestry.

## Heritage licensing

`codechef-vit-catalogue.csv` — MIT, attribution preserved in
`public/ffcs/codechef-vit-catalogue.SOURCE.md`. Vendored as a file, not a package; the parser
(`parseReportRows`) is original.
