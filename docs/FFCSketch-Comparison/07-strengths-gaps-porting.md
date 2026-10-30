# 07 — Strengths, gaps & porting notes

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

## 1. Strengths

### FFCSketch

| Strength                        | Evidence                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Real domain depth**           | correct Chennai slot algebra (12 theory periods, `L1`–`L60` map, flex slots, lunch barrier), exact-interval clash detection, ETH↔ELA partner embedding with scoring _and_ one-click repair |
| **Thoughtful, readable solver** | MRV ordering, atomic theory+lab units, bounded backtracking (`MAX_NODES = 400_000`), sensible composite score — all in 559 lines you can read in one sitting                               |
| **Portability**                 | whole plan is the URL (`?s=`), QR in the dialog, static export, zero backend — deployable anywhere, shareable anywhere                                                                     |
| **Craft & personality**         | dual theme (PaperCSS fun / plain nerd) × day/night, applied by a pre-hydration `<head>` script so there's no flash; help section; playful generator extras                                 |
| **Draft ergonomics**            | named tables with add/rename/delete/duplicate/switch, one-level undo (`Ctrl/Cmd+Z`), per-course pastel colors, drag-and-drop cart                                                          |
| **Useful unique views**         | `SlotView` occupancy browser, `SlotFinderPopover` "what fits here?", peek mode ghost preview, `ClashDoctor` explanations                                                                   |
| **Static-export purity**        | 11-line `next.config.ts`, no server, no env-dependent behaviour                                                                                                                            |
| **Freshness of data**           | `courses:update` script + Winter 26-27 catalogue (commit `0cc0eca`)                                                                                                                        |

### AmazeCC FFCS

| Strength                  | Evidence                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Solver quality**        | one pure backtracker (1,892 L) in a worker with streaming progress, cooperative cancel-keeps-partial, in-tree monotone pruning, 30k ceiling, documented inline fallback, 8 error codes, tested drop ladder                                                                      |
| **Correctness culture**   | canonical clash math in one module; `timeToMinutes → null` never midnight; law-slot aliases; `TimetableMetrics` derived not redeclared; string discriminants for `strict:false`; test running the **built** worker in a Node `vm`; test proving pruning ≡ enumerate-then-filter |
| **Data offline-first**    | 3 bundled CSVs (incl. a credited competitor catalogue), Serwist NetworkFirst for `*.csv`, layout-head preload, `ffcs_raw_courses` cache, no course API dependency                                                                                                               |
| **Depth of surface area** | 4 share encodings, 6 ranking profiles + 8 composable factors, per-course faculty priority, target-course locker, drop ladder, result filters, free classrooms, iCal, clash-report PDF, off-screen image exports with Vitfac sentiment, 15-phase wizard, tour, 3 layout modes    |
| **Port discipline**       | `docs/ffcs-ccv` scan → plan → status; features land behind pure modules with mirrored tests; explicit UI credit lines                                                                                                                                                           |
| **Test density**          | 582 FFCS assertions across 49 files inside a 1,873-test CI-gated suite (for reference: FFCS-inator has 4 `node --test` files and no CI)                                                                                                                                         |
| **Performance hygiene**   | heavy modals behind `next/dynamic` + `ssr:false`, `xlsx` dynamically imported, subpages unmount to cancel work, progress rate-limited to 100 ms                                                                                                                                 |

## 2. Gaps & risks

### FFCSketch

| Risk                            | Detail                                                                                                                                                                           | Severity                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **No tests, no CI**             | zero `*.test.*`; no `.github/` — on a repo whose entire value is `timetable.ts` / `slots.ts` / `embedded.ts`                                                                     | 🔴 high                              |
| **Lint neutered**               | ~30 rules off incl. `react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any` in a hooks-heavy React 19 app                                                         | 🔴 high                              |
| **Main-thread generator**       | up to 400k DFS nodes in one synchronous pass; no worker, no cancel, no progress → UI jank/freeze on large wishlists                                                              | 🟠 medium-high                       |
| **964 KB inlined dataset**      | `courses.json` statically imported, no code splitting; first-load cost paid always                                                                                               | 🟠 medium                            |
| **PWA overclaim**               | network-first SW + offline page only; README says "offline caching" but the app shell isn't precached                                                                            | 🟡 low-medium                        |
| **Chennai-only**                | store migration actively drops other-campus data                                                                                                                                 | 🟡 intended                          |
| **Dependency tail**             | `next-auth`, `next-intl`, `@mdxeditor/editor`, `z-ai-web-dev-sdk`, TanStack query/table, recharts, react-hook-form… unused; ~5.6k LOC shadcn boilerplate for ~15 used components | 🟡 low (bundle/tree-shake dependent) |
| **No share payload versioning** | `?s=` has no format version → state-shape changes silently break old links; no oversize warning                                                                                  | 🟠 medium                            |
| **Manual data pipeline**        | one CSV drop + script run; no catalogue history                                                                                                                                  | 🟡 low                               |

### AmazeCC FFCS

| Risk                                        | Detail                                                                                                                                                                                               | Severity              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **God components**                          | `FFCSGuidedSelector.tsx` 6,214 · `FFCSTimetableTab.tsx` 4,047 · `FFCSGeneratorSubpage.tsx` 3,809 ≈ **14k lines in 3 files**; docs themselves flag merge-conflict likelihood                          | 🔴 high               |
| **Duplicated state layers**                 | domain state exists in tab-local `useState`, mirrored hooks, and raw `localStorage`; some hooks bypass `storage.ts`; host Jotai unused → cross-feature consumers must replicate                      | 🔴 high               |
| **`strict: false`**                         | whole app compiles without strict null/function checks; code comments document the workarounds                                                                                                       | 🟠 medium-high        |
| **Uncommitted WIP**                         | 19 modified FFCS files at scan time (tab, `generate.ts`, `ffcsSettings.ts`, `reports.ts`) → diff/merge hazard right now                                                                              | 🟠 medium (transient) |
| **Doc drift**                               | `embedded-course-pairing.md` points at a moved function; Windows `file:///C:/Users/...` links; stale test counts (125 vs 1,873; 1,547 vs current); `FEATURES.md` has no FFCS chapter                 | 🟡 medium             |
| **Campus locked to Chennai**                | `GLOBAL_CAMPUS = "chennai"`; `ap.json`/`bhopal.json` shipped but unreachable; `constants.ts` and `FreeClassroomsWidget.tsx:32` hardcode Chennai _independently_ → would drift if a picker were added | 🟠 medium             |
| **Manual data pipeline**                    | someone must export VIT's registration list into `public/ffcs/*.csv` each semester; scraping API lives in another repo and FFCS doesn't call it                                                      | 🟡 medium             |
| **Vitfac single host**                      | `vitfac.amazecc.com` hard-coded, 12 s abort, sessionStorage TTL, silent degradation → faculty ranking quality quietly depends on it                                                                  | 🟡 medium             |
| **Share size**                              | full plans can exceed practical URL lengths (mitigated by 8k warning + 4 encodings, but no short links)                                                                                              | 🟡 low                |
| **No cloud/accounts**                       | all localStorage; documented out of scope (`docs/ffcs-ccv/03-implementation-plan.md:188`)                                                                                                            | ⚪ accepted           |
| **`tsconfig.tsbuildinfo` + `out/` in tree** | build artifacts present in the working directory                                                                                                                                                     | ⚪ hygiene            |

## 3. Porting notes

### → into AmazeCC (worth taking from FFCSketch)

| Feature                                                                                                           | Where it would live                                                                                                     | Notes                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Multi-draft tables + one-level undo**                                                                           | `useTimetables` / `storage.ts` (`ffcs_timetables` already an array — needs rename/duplicate/switch UX + a snapshot key) | AmazeCC already stores multiple timetables; this is UX + an undo slot, not a data change                        |
| **Slot occupancy explorer (`SlotView`)**                                                                          | new component under `FFCS/components/` fed by parsed master courses                                                     | explicitly listed as deferred in `docs/ffcs-ccv/03-implementation-plan.md:190` — cheap win, pure read-only view |
| **Peek mode (ghost preview)**                                                                                     | overlay on shared `TimetableView`                                                                                       | lets users trial a generated combo before applying — currently results must be committed to preview             |
| **Slot finder from a blank cell**                                                                                 | cell click currently = block/unblock; add a secondary "what fits here?" action                                          | must not collide with the existing block-on-tap interaction on mobile                                           |
| **Pairing problem detector + one-click repair**                                                                   | `ffcsCourseGrouping.ts` already scores pairs; add an `embeddedPairProblems`-style report + fix actions                  | complements the existing `ManualLink` flow                                                                      |
| **Per-course color picker**                                                                                       | `AddedCourse.color` exists but is auto-assigned; expose a picker like `ColorPicker.tsx`                                 | trivial once exposed                                                                                            |
| **Share payload version check already exists** — but FFCSketch's **no-warning URL length** should _not_ be copied | —                                                                                                                       | keep AmazeCC's 8k warning                                                                                       |
| **Dual theming / pre-hydration script**                                                                           | only if FFCS ever gets its own visual identity; currently it inherits the host system                                   | low priority                                                                                                    |
| **WhatsApp text export**                                                                                          | small addition to `exportTimetable.ts`                                                                                  | cheap parity item                                                                                               |
| **README-quality feature narrative**                                                                              | `FEATURES.md` still has no FFCS chapter                                                                                 | documentation gap, not code                                                                                     |

### → into FFCSketch (worth taking from AmazeCC)

| Item                                            | Where                                                                                                           | Why                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Web worker + streaming + cancel**             | extract `generateTimetables` into a pure module (it mostly is) + a thin worker bridge like `logic/generator.ts` | single biggest UX fix; eliminates the freeze                                 |
| **Test harness (vitest) + CI**                  | add tests for `slots.ts`, `timetable.ts`, `embedded.ts` first                                                   | highest ROI change in the whole repo; these three files are the product      |
| **Turn lint back on**                           | re-enable `exhaustive-deps`, `no-explicit-any`, `no-unused-vars`                                                | cheap correctness                                                            |
| **4-tier ETH/ELA branch-and-bound**             | replace build-time brute-force pairing with runtime `computePairScore` tiers                                    | pairing becomes catalogue-independent and tunable; keep the repair UI on top |
| **Law-slot aliases**                            | `slots.ts`                                                                                                      | if the catalogue ever includes `TLAW*` rows                                  |
| **Back-to-back rule + `timeToMinutes → null`**  | `slots.ts`                                                                                                      | defensive correctness details already proven in the other codebase           |
| **Drop ladder policy**                          | pure `dropPolicy`-style module                                                                                  | replaces ad-hoc `allowDrop = 2` with named, testable semantics               |
| **Share payload versioning + oversize warning** | `share.ts`                                                                                                      | prevents silent link breakage as state evolves                               |
| **Runtime catalogue fetching**                  | replace the static 964 KB import with `fetch` + cache                                                           | fixes the bundle problem; keep a fallback for offline                        |
| **Error taxonomy for the generator**            | map failure reasons to named codes instead of empty results                                                     | better UX than "no results"                                                  |
| **In-tree pruning**                             | for any constraint FFCSketch adds later                                                                         | proven performance pattern with an equivalence test to copy                  |

### Do _not_ port (either direction)

| From                | Item                                       | Why not                                                    |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| AmazeCC → FFCSketch | 6,214-line guided selector, 4,047-line tab | would import the god-component disease                     |
| AmazeCC → FFCSketch | ~26 localStorage keys + hook mirrors       | FFCSketch's single store is the better design for its size |
| AmazeCC → FFCSketch | Vitfac dependency                          | adds network + silent degradation to a zero-network app    |
| FFCSketch → AmazeCC | inline inlined PaperCSS theme              | host already has a design system                           |
| FFCSketch → AmazeCC | Base64URL-only share, no version           | loses AmazeCC's multi-format/oversize handling             |
| both                | accounts/short links                       | incompatible with `output: 'export'` (documented)          |

## 4. Decision guidance

**Choose FFCSketch when:**

- you want a small, hackable planner you can understand end-to-end;
- sharing must work with nothing but a URL;
- visual personality (fun/nerd themes) matters;
- draft/undo ergonomics and the slot explorer are the daily drivers;
- and you accept that you are running unverified logic.

**Choose AmazeCC FFCS when:**

- you need the generator to actually survive a 10+ course wishlist;
- faculty quality, social planning, and rich exports are part of the workflow;
- you want regression safety and CI;
- and you accept a much larger codebase with three very large files.

**If the goal is one product:** take FFCSketch's _view/UX ideas_ (slot view, peek, drafts+undo, slot finder, pairing repair, theming craft) and AmazeCC's _engineering core_ (worker solver, ranking system, tests/CI, share codec, import pipeline). Neither codebase alone is the complete answer — which is exactly what the two porting tables above describe.

## 5. Method note

This comparison was produced by two parallel read-only code scans (no files modified) over:

- `/home/sugeethjsa/GitHub/FFCSketch` @ `7c705ec`
- `/home/sugeethjsa/GitHub/AmazeCC` @ `93b2853`, branch `fix/october`, with 19 uncommitted FFCS files

LOC figures are `wc -l` snapshots and are approximate. Where the AmazeCC docs and code disagree, the **code** was treated as truth and the discrepancy is recorded in [06](./06-quality-and-testing.md).
