# 06 — Quality: tests, lint, CI, docs

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

This axis is where the two projects differ most sharply.

## 1. Tests

|                 | FFCSketch              | AmazeCC FFCS                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test files      | **0**                  | **49 files touch FFCS** (12,626 lines); **27 named `ffcs*`** (8,504 lines)                                                                                                                                                                                                                                                                          |
| Test cases      | **0**                  | **582 `it()` cases** FFCS-related; **1,873** in the whole suite (136 files)                                                                                                                                                                                                                                                                         |
| Runner          | none in `package.json` | vitest + `@testing-library/react` + jsdom (`vitest.config.ts`)                                                                                                                                                                                                                                                                                      |
| Render tests    | none                   | `ffcsTab.render.test.tsx` (970/31), `ffcsGuidedSelector.render.test.tsx` (977/20), `ffcsGeneratorSubpage.render.test.tsx`, `ffcsPageView.render.test.tsx`, `ffcsShareView.render.test.tsx`, modal tests, …                                                                                                                                          |
| Solver tests    | none                   | `ffcs-generate.test.ts` (1,064/49): filters, law slots, **purity**, real-report runs, lab rules, **in-tree pruning ≡ enumerate-then-filter equivalence** (`:1027`)                                                                                                                                                                                  |
| Streaming tests | n/a                    | `ffcs-generate-stream.test.ts` (536/20): batches, progress, cancel, 30k ceiling                                                                                                                                                                                                                                                                     |
| Worker tests    | n/a                    | `worker-artifact.test.ts` (342) — executes the **built** worker bundle in a Node `vm`                                                                                                                                                                                                                                                               |
| Policy tests    | none                   | `ffcsDropPolicy.test.ts`, `ffcsGenerationRun.dropLadder.test.ts`                                                                                                                                                                                                                                                                                    |
| Domain tests    | none                   | `ffcsClashPairs`, `ffcsFacultyPriority`, `ffcsFacultyRanking`, `ffcsRanking` (377/25), `ffcsShare*` (410/27), `ffcsSettings` (10), `ffcsCodechefCatalogue` (136/6 — asserts the exact `FFCSSemesterId` list), `slots`, `facultyGroups`, `exportTimetable`, `portraitDossier`, `freeClassrooms`, `vitfacService`, `parsePastedText`, `importFile`, … |
| Uncommitted WIP | —                      | 19 modified FFCS files at scan time; a `wc -l` re-run minutes later differed by ~57 lines → LOC figures here are ±small deltas                                                                                                                                                                                                                      |

### Coverage shape

- **AmazeCC** covers three layers: _pure logic_ (`logic/`, `lib/ffcs*.ts`), _render_ (component output), and _artifacts_ (the built worker). That triad is only possible because pure logic was deliberately extracted into separate modules.
- **FFCSketch** covers nothing. Its value lives entirely in the correctness of `lib/ffcs/timetable.ts` (559), `slots.ts` (262), and `embedded.ts` (217) — ~1,000 lines of hand-written constraint logic with zero regression protection.

## 2. Lint & types

|               | FFCSketch                                                                                                                 | AmazeCC                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Config        | `eslint.config.mjs` (50 L) flat config                                                                                    | `eslint.config.mjs` (3,083 B) flat config                                                                        |
| Posture       | **~30 rules turned off**, including `react-hooks/exhaustive-deps`, `@typescript-eslint/no-explicit-any`, `no-unused-vars` | stricter; additionally bans direct `fetchWithTimeout`/`API_BASE` imports (all network via `lib/sync-engine`)     |
| Effect        | `npm run lint` is effectively a no-op for the rules that catch real bugs in a hooks-heavy React 19 app                    | FFCS code passes none of its own network except Vitfac                                                           |
| Type checking | implicit via `next build` only; **no `tsc --noEmit` script**                                                              | explicit `typecheck` script (`tsc --noEmit`) as a CI gate                                                        |
| `strict` mode | not stated in scan; `next build` type-checks                                                                              | **`tsconfig` `strict: false`** — code comments document workarounds (e.g. string discriminants instead of enums) |
| Formatting    | none                                                                                                                      | Prettier (`format`, `format:check`) + husky + lint-staged                                                        |

## 3. CI/CD

|                    | FFCSketch                | AmazeCC                                                                                                     |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Workflows          | **none** (no `.github/`) | `.github/workflows/ci.yaml`: **lint → typecheck → test → build (static export)**; `nextjs.yml` Pages deploy |
| Pre-commit         | none                     | husky + lint-staged → prettier                                                                              |
| Build verification | `next build` locally     | CI build of the static export incl. `/share/ffcs`                                                           |

## 4. Documentation

### FFCSketch

- **`README.md` (17,878 B)** — well-structured: highlights, 7 core module sections, VIT Chennai slot/timetable system, tech stack, getting started, project structure, **XLSX/CSV import spec**, keyboard shortcuts, FFCS tips, disclaimer.
- No architecture docs, no ADRs, no per-module docs. The README _is_ the documentation.

### AmazeCC (FFCS-related)

| Doc                                                  |      Lines | Contents                                                                       |
| ---------------------------------------------------- | ---------: | ------------------------------------------------------------------------------ |
| `docs/ffcs-workings/README.md`                       |          — | index of engine architecture                                                   |
| `docs/ffcs-workings/clash-detection-and-schema.md`   |          — | schema, interval math, tab vs generator responsibilities table                 |
| `docs/ffcs-workings/embedded-course-pairing.md`      |         99 | 4-tier branch-and-bound walkthrough                                            |
| `docs/ffcs-workings/timetable-export-and-reviews.md` |          — | off-screen export + Vitfac integration                                         |
| `docs/ffcs-ccv/00-scan-overview.md` … `04-*`         |        529 | feature-by-feature comparison vs CodeChef's **FFCS-inator**, incl. a port plan |
| `docs/ffcs-generator-target-courses-locker-plan.md`  |         82 | locker refactor plan                                                           |
| `docs/oct-21-2026/ffcs-fixes/PLAN.md`                |        304 | 7-phase hardening plan, marked complete (1,547 tests green at that time)       |
| `guide.md` §FFCS                                     |          — | client-side FFCS notes (share route, `ffcs_*` namespace, generator worker)     |
| `README.md` FFCS row                                 |          — | feature table entry                                                            |
| **Total FFCS docs**                                  | **~1,280** |                                                                                |

### Known doc drift in AmazeCC

- `embedded-course-pairing.md` still locates `processParsedCourses` inside `FFCSTimetableTab` — it moved to `src/lib/ffcsCourseGrouping.ts`.
- `clash-detection-and-schema.md` contains stale `file:///C:/Users/sugee/...` Windows links.
- `docs/ffcs-ccv` still says the suite is 125 tests and shows status items ⬜ "not started" that are in fact implemented (items 4/5/6/8/9).
- `FEATURES.md` (the 21-chapter feature doc) has **zero FFCS mentions** despite README claiming an FFCS row.
- Test count in `docs/oct-21-2026` (1,547) is below the current 1,873.

## 5. PWA/offline claims vs reality

|                | FFCSketch                                                                  | AmazeCC                                                                                |
| -------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Claim          | "Full PWA support with service workers and offline caching"                | (no broad claim; CSV NetworkFirst documented)                                          |
| Implementation | network-first navigation + `/offline.html` only; **no app-shell precache** | Serwist precache + NetworkFirst for `*.csv` + `ReactDOM.preload` of the default report |
| Verdict        | **not truly offline-capable**                                              | catalogue genuinely offline; app shell via Serwist                                     |

## 6. Process observations

1. **AmazeCC practices "port discipline":** `docs/ffcs-ccv/` shows scan → plan → status, features landing behind pure modules (`ffcsResultFilters`, `ffcsClashPairs`, `dropPolicy`) with tests mirroring source semantics, and **explicit credit lines in the UI** (`reports.ts:66` credits the codechef-vit catalogue).
2. **FFCSketch practices "scaffold and ship":** 19 commits, feature-grouped, one merge PR for the nerd theme. No review gates, no CI, lint disabled to keep moving.
3. **AmazeCC's lint rule banning ad-hoc network calls** is a architectural guardrail FFCSketch doesn't need (no network at all) but also wouldn't have.
4. **Both currently carry risk:** FFCSketch in unverified logic; AmazeCC in 19 uncommitted FFCS files mid-refactor (merge hazard) and `strict: false`.

## 7. Scorecard

| Quality axis      | FFCSketch                           | AmazeCC                                        |
| ----------------- | ----------------------------------- | ---------------------------------------------- |
| Unit/logic tests  | ❌ 0                                | ✅ hundreds, incl. equivalence + purity proofs |
| Render tests      | ❌                                  | ✅ 20+ component suites                        |
| Artifact tests    | ❌                                  | ✅ built worker executed in Node `vm`          |
| Type gate         | ⚠️ build-time only                  | ✅ `tsc --noEmit` in CI                        |
| Lint signal       | ❌ ~30 rules off                    | ✅ useful + architectural bans                 |
| Formatting        | ❌                                  | ✅ Prettier + husky                            |
| CI                | ❌                                  | ✅ 4-stage pipeline                            |
| Documentation     | ✅ one strong README                | ✅ 11 docs, but with drift                     |
| Changelog/history | ⚠️ conventional-ish commit messages | ✅ rich commit messages (some multi-paragraph) |
