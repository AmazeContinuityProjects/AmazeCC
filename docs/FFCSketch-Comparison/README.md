# FFCSketch vs AmazeCC FFCS — Comparison

> **Scan date:** 2026-10-30
> **Subjects:** [`../../`](file:///home/sugeethjsa/GitHub/AmazeCC) → `AmazeCC` (v3.1.0, branch `fix/october`, some FFCS files WIP-uncommitted) and `../FFCSketch` (v0.2.1, 19 commits, HEAD `7c705ec`).
> **Scope:** only the FFCS (Fully Flexible Credit System) timetable planner/generator surface of each repo. LOC figures are `wc -l` counts taken during the scan and are approximate (±small deltas).

**One-line summary:** FFCSketch is a focused, standalone, zero-backend FFCS planner (~18k LOC of app code, zero tests); AmazeCC's FFCS is the same domain problem solved inside a production app at ~8× the size, with a web-worker solver, a 1,873-test CI suite, and social / faculty-review depth neither of which FFCSketch attempts.

Both apps solve the identical VIT problem — pick course offerings, keep them clash-free, respect the `ETH`+`ELA` embedded-pairing rule, and auto-generate ranked conflict-free timetables — and both are 100% client-side with `output: 'export'` (no API routes, no accounts, everything in `localStorage`).

---

## Document index

| #   | Document                                                          | Contents                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 00  | [Summary](./00-summary.md)                                        | Side-by-side table, verdict, decision guidance                     |
| 01  | [Architecture](./01-architecture.md)                              | Routing, state management, workers, build/PWA, code layout         |
| 02  | [Data model & course catalogues](./02-data-model.md)              | Types, slot system, campus schemas, course data sources            |
| 03  | [Solver & generator](./03-solver-and-generator.md)                | Clash detection, ETH/ELA pairing, search algorithm, ranking        |
| 04  | [Feature inventory](./04-feature-inventory.md)                    | Full capability matrix, including what only one side has           |
| 05  | [Share, export & import](./05-share-export-import.md)             | Share-link encodings, PNG/PDF/iCal, CSV/XLSX/paste import, backups |
| 06  | [Quality: tests, lint, CI, docs](./06-quality-and-testing.md)     | Test counts, CI gates, lint posture, documentation                 |
| 07  | [Strengths, gaps & porting notes](./07-strengths-gaps-porting.md) | Risks on both sides and what to port between them                  |

---

## Head-to-head snapshot

| Axis              | **FFCSketch**                                               | **AmazeCC FFCS**                                                                     |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Version / history | 0.2.1, 19 commits, greenfield scaffold → 6 feature commits  | 3.1.0, years of history, FFCS evolved over dozens of commits                         |
| Placement         | Standalone app, 2 routes (`/` + layout)                     | Feature inside a multi-tool app: `/ffcs/`, `/share/ffcs/`, plus host tabs            |
| Framework         | Next 16 App Router, React 19, TS 5, Tailwind 4              | Next 16 App Router, React 19, TS 5.9, Tailwind 4                                     |
| Render model      | `output: 'export'`, fully client-side                       | `output: 'export'`, fully client-side, no `src/app/api`                              |
| State             | **One Zustand store** → `ffcs-planner-v1`                   | `useState` + 6 hooks, ~26 `ffcs_*` localStorage keys (host Jotai unused)             |
| Heavy compute     | Main-thread DFS, `setTimeout(30)` yield                     | **`generator.worker.ts`** (stream, cancel, inline fallback) + **`pdf.worker.ts`**    |
| Core FFCS LOC     | ~10k app code + ~5.6k shadcn boilerplate + 44k-line dataset | ~33.7k core (+ ~5.6k support libs)                                                   |
| Tests             | **0**                                                       | **49 FFCS files / 582 cases** inside 136 files / 1,873 tests                         |
| CI                | none (`.github/` absent)                                    | lint → typecheck → test → build (static export)                                      |
| Docs              | single 17.9k `README.md`                                    | `docs/ffcs-workings/`, `docs/ffcs-ccv/`, plans, `guide.md` FFCS section              |
| Campus            | Chennai only (migration drops other data)                   | Chennai hard-locked (`GLOBAL_CAMPUS`), `ap`/`bhopal` schemas shipped but unreachable |
| Catalogue         | 964 KB `courses.json` inlined into bundle (3,426 sections)  | 3 bundled CSVs (856 KB, ~11k rows) fetched at runtime + paste/CSV/XLSX import        |
| Share             | Base64URL `?s=` payload + QR                                | 4 encodings (`?d/?x/?q/?r`), versioned lz-string, `/share/ffcs` receiver             |
| Faculty reviews   | —                                                           | Vitfac integration (`vitfac.amazecc.com`)                                            |
| Social / friends  | friend-sync in Compare view                                 | friends, groups, social matrix, sync-in-generator                                    |

---

## Verdict in three sentences

1. **FFCSketch wins on focus, legibility, and personality** — a small readable engine (~2k LOC), an instant portable share link, a genuinely charming dual-theme UI, and multi-draft planning with undo.
2. **AmazeCC FFCS wins on almost every operational axis** — non-blocking worker solver with streaming/cancel, far richer generator controls and ranking, faculty intelligence, social planning, export/import breadth, and correctness infrastructure (582 FFCS assertions vs 0).
3. **The trade is craft-vs-scale:** FFCSketch's risks are _missing verification_ (no tests, neutered lint, main-thread solver, 964 KB inlined data), AmazeCC's are _structural mass_ (three ~14k-line god-components, duplicated state layers, doc drift, hardcoded campus).

Read [07-strengths-gaps-porting.md](./07-strengths-gaps-porting.md) for the concrete porting list if you intend to move features either way.
