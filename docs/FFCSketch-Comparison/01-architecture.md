# 01 — Architecture

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

## 1. Build & deployment

|                          | FFCSketch                                                                                | AmazeCC FFCS                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config                   | `next.config.ts` (11 lines): `output: "export"`, `images.unoptimized`, `reactStrictMode` | `next.config.mjs`: `output: 'export'`, `trailingSlash`, env'd `basePath`, Serwist PWA, `typescript.ignoreBuildErrors: false`                            |
| Server code              | none — no routes, no handlers, no middleware                                             | none — `src/app/api` does not exist                                                                                                                     |
| Package manager          | bun (`bun.lock`)                                                                         | pnpm 12 (`pnpm-lock.yaml`, workspace file)                                                                                                              |
| Scripts                  | `dev`, `build`, `preview` (`npx serve out`), `lint`, `courses:update`                    | `dev` (`--webpack --experimental-https -p 3001`), `build`, `test`, `typecheck`, `lint`, `format`, plus `api-dev` for a separate backend                 |
| CI                       | none (no `.github/`)                                                                     | `.github/workflows/ci.yaml`: lint → typecheck → test → build; `nextjs.yml` Pages deploy                                                                 |
| Tests                    | none                                                                                     | vitest + testing-library + jsdom, 1,873 tests                                                                                                           |
| Static-export workaround | share payload fully in the query string                                                  | `share/ffcs/page.tsx`: prerendered shell + `useSearchParams()` inside `<Suspense>` — pattern documented as the only one that survives `output:'export'` |

Both are **deliberately backend-free for FFCS**. AmazeCC documents this explicitly in `guide.md` ("FFCS Planner (client-side — no endpoints)") and in `docs/ffcs-ccv/03-implementation-plan.md` (accounts/cloud/short-links declared out of scope because of static export).

## 2. Routing & entry

### FFCSketch

```
src/app/
  layout.tsx   (66 L)  metadata, PWA manifest, pre-hydration theme script
  page.tsx     (749 L) the entire app shell: 4 tabs, keyboard shortcuts, share-link loader
  globals.css / nerd.css / fun.css
```

`page.tsx` owns tab state, shortcut handling (`1`–`4` for tabs, `Ctrl/Cmd+Z` undo), the share-link auto-load effect, and composes every feature component. One document = one app.

### AmazeCC FFCS

```
src/app/ffcs/                     page.tsx (22) layout.tsx (70) FFCSPageView.tsx (87) PreloadReportCsv.tsx (19)
src/app/share/ffcs/               page.tsx (30) FFCSShareView.tsx (307)
src/components/custom/exams/
  FFCSTimetableTab.tsx            (4,047) the planner itself
  FFCSGuideModal.tsx              (145)
  FFCS/…                          54 files, ~24,600 LOC
```

- `app/ffcs/layout.tsx` gives the route **its own metadata and its own PWA manifest** (`/ffcs-manifest.json`, `favicon/FFCS.png`) and re-declares the app-wide `initialScale: 0.85` viewport (this route doesn't inherit the root viewport).
- `PreloadReportCsv.tsx` calls `ReactDOM.preload(reportPath, { as: "fetch", crossOrigin: "anonymous" })` in the layout head so the default ~300 KB catalogue downloads alongside route JS (Next 16 recommended API per its comment).
- `src/lib/ffcsNavigation.ts` (10 lines) navigates with `location.assign` rather than the Next router, because `/ffcs` is a separate static document.
- `useOverlayBackBoundary("ffcs-route" / "ffcs-share-route")` wires browser/system Back into the app's own overlay stack instead of leaving the feature.

### Inside the tab

`FFCSTimetableTab.tsx` exposes `layoutMode: "guided" | "modern" | "classic"` (persisted `ffcs_layout_mode`, modal `FFCSLayoutModeModal.tsx`), and renders three **full-screen subpages as early returns** above its own tree — so unmounting them cancels in-flight work:

| Subpage                |   LOC | Purpose                                    |
| ---------------------- | ----: | ------------------------------------------ |
| `FFCSDossierSubpage`   |   935 | grouped course dossier, preview + export   |
| `FFCSFriendsSubpage`   |   583 | friend timetables, groups, social scoring  |
| `FFCSGeneratorSubpage` | 3,809 | 5 option panes, staged results, compare ×3 |

Everything heavy is behind `next/dynamic` with `ssr: false` (`FFCSTimetableTab.tsx:93-136` — 15+ dynamic imports including all 10 modals). Keyboard shortcuts live at `:1670-1757` (`f` toggles generator, Escape closes).

## 3. State management

### FFCSketch — one store

`src/store/ffcs.ts` (467 lines), Zustand 5, persisted to `localStorage` key **`ffcs-planner-v1`**:

- multi-table **drafts** (add / rename / delete / duplicate / switch),
- `picked` section ids per table, `pinnedSlots`, `lockedSlots`, table label,
- `wishlist` with per-item priority,
- `courseColors`, `ui` prefs (theme, day/night, layout orientation),
- a **one-level undo snapshot**,
- a migration that drops non-Chennai data.

Single source of truth; every component reads the same store. Simple, but no namespacing, no schema versioning beyond `v1`, and undo is a single snapshot rather than a stack.

### AmazeCC — layered and duplicated

**FFCS does not use Jotai** (the host app's store lib) — `src/store/*Atoms.ts` has zero `ffcs` references. Instead:

1. `src/lib/storage.ts` (432 L) defines **13 canonical keys** with typed accessors: `ffcs_timetables`, `ffcs_activeTimetableId`, `ffcs_blockedSlots`, `ffcs_friends`, `ffcs_friendGroups`, `ffcs_socialScoreGroupMethod`, `ffcs_courseLocks`, `ffcs_facultyPriority`, `ffcs_manual_links`, `ffcs_raw_courses`, `ffcs_settings`, `ffcs_tour_seen`, `ffcs_tips_dismissed`.
2. **~13 more keys** touched directly: `ffcs_semester`, `ffcs_layout_mode`, `ffcs_layout_mode_prompt_seen`, `ffcs_dashboard_widgets`, `ffcs_generator_view_mode`, `ffcs_generator_targets`, `ffcs_generator_session_prefs`, `ffcs_paste_registered_courses`, `ffcs_dismiss_faculty_guide`, `ffcs_analytics_enabled`, `ffcs_analytics_queue`, … (~26 total).
3. A hooks layer (`FFCS/hooks/`, 500 L): `useTimetables` (102), `useSocialState` (99), `useGenerationRun` (197), `useGeneratorState` (51), `useCourseLocks` (27), `useFacultyReviewSheet` (24) — each `useState` + `useEffect` localStorage mirror. **Some bypass `storage.ts` and touch raw `localStorage`.**
4. Cross-cutting prefs: `lib/ffcsSettings.ts` (248: `FFCSSettings` + defaults + `sanitizeFFCSSettings` per-field fallback + `useFFCSSettings()`) and `lib/ffcsGeneratorSessionPrefs.ts` (115).

**Consequence:** the same domain state exists at least twice (tab-local `useState` _and_ hook mirror), and a cross-feature consumer must replicate it. This is the single biggest structural difference from FFCSketch's flat Zustand store.

## 4. Heavy computation: threads

|                | FFCSketch                                                               | AmazeCC FFCS                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solver thread  | **Main thread**, `generateTimetables` yielded once via `setTimeout(30)` | **`workers/generator.worker.ts`** (96 L, `{type:"module"}` → Safari 15+ floor)                                                                    |
| Progress       | none                                                                    | `GenerateProgress {nodes, found, accepted}` every ~4,096 nodes; UI rate-limited to 100 ms                                                         |
| Cancellation   | none (a runaway search freezes the tab until `MAX_NODES`)               | `worker.terminate()` from the page; batches partial results so **Cancel keeps what was found**                                                    |
| Fallback       | n/a                                                                     | documented **inline solve** if worker creation fails (old browser / blocked blob / missing chunk) — `logic/generator.ts` (253 L)                  |
| Message shapes | n/a                                                                     | bare `GenerateParams` = one-shot, `{type:"stream",params}` = watched; **no cancel message** (terminate only)                                      |
| PDF/image      | `html-to-image` on the main thread                                      | **`workers/pdf.worker.ts`** (125 L): OffscreenCanvas slicing + jsPDF A4 landscape off the main thread, spawned from `lib/exportTimetable.ts:2032` |

Everything crossing the worker boundary in AmazeCC must be structured-clone-safe: `GenerateParams` uses only arrays (never `Set`), and the result contract uses **string discriminants** (`ok | cancelled | error`) rather than TS enums — the code comment explains this is because `tsconfig` is `strict: false`.

## 5. UI system & theming

### FFCSketch

Three CSS layers:

| File          |   LOC | Role                                                                                               |
| ------------- | ----: | -------------------------------------------------------------------------------------------------- |
| `globals.css` |    71 | Tailwind 4 base                                                                                    |
| `nerd.css`    |   234 | plain/utilitarian overrides under `html.theme-nerd`                                                |
| `fun.css`     | 1,731 | hand-drawn Neucha font + **the entire minified PaperCSS inlined inside `@scope (html.theme-fun)`** |

Two orthogonal axes: `theme` (`day`/`night` → `night-sketch` dark palette) × `uiTheme` (`fun`/`nerd`). `layout.tsx:53` runs an **inline bootstrap script in `<head>`** before hydration to apply the classes and gate a first-visit theme-intro modal — avoiding a flash of wrong theme.

Note: the `papercss` npm package _is_ a dependency but the CSS is inlined in `fun.css`, not imported from it.

UI primitives: 53 shadcn/Radix files in `src/components/ui/` (~5,600 LOC of generated boilerplate — sidebar 726, chart 353, carousel 241, calendar 213…) of which roughly 15 are actually used.

### AmazeCC FFCS

- No separate FFCS theme; inherits the host app's Tailwind 4 + `@amazecontinuityprojects/amazeui` design system.
- **Three layout modes** instead of themes: `guided` (wizard), `modern` (dashboard with widget system, `ffcs_dashboard_widgets` key), `classic` (accordion tab) — chosen via `FFCSLayoutModeModal.tsx` (166 L).
- `FFCSDashboardHeader.tsx` (1,991 L): widget system, mobile widget sheet, utility chip-tabs (timetables / social / faculty / export).
- Onboarding: `FFCS/features/tour/` (499 L: `TourProvider` 153, `TourSpotlight` 192, `tourSteps` 58, `useTips` 69, `Tip` 27) with 6 `data-tour-id` anchors and `TOUR_VERSION=1` in `ffcs_tour_seen`, plus `FFCSGuideModal.tsx` (145) as a static help sheet.

## 6. PWA & offline

|               | FFCSketch                                                                                                                    | AmazeCC FFCS                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Manifest      | `manifest.webmanifest` wired in root metadata; theme colors per theme                                                        | separate `/ffcs-manifest.json` for the `/ffcs` route, `favicon/FFCS.png`, `appleWebApp` |
| SW            | `ServiceWorkerRegister.tsx` (27) → `public/sw.js` (53): conservative **network-first navigation** + `/offline.html` fallback | **Serwist** (`@serwist/next`), NetworkFirst for `*.csv` catalogues                      |
| Claim         | "Full PWA support with service workers and offline caching" (README)                                                         | catalogue data offline-first; app shell via Serwist precache                            |
| Reality check | no app-shell precaching or runtime caching strategy → **not truly offline-capable** despite the claim                        | course CSVs genuinely cached; layout-head preload reduces first-paint data wait         |

## 7. Code layout, by the numbers

### FFCSketch

| Area                                                 |             LOC |
| ---------------------------------------------------- | --------------: |
| `src/components/ffcs/*` (feature UI)                 |           6,326 |
| `src/components/ui/*` (shadcn boilerplate, 53 files) |          ~5,600 |
| `src/lib/ffcs/*` (engine, 9 files)                   |           2,223 |
| CSS (`fun` 1,731 + `nerd` 234 + `globals` 71)        |           2,036 |
| Shell (`page.tsx` 749 + `layout.tsx` 66)             |             815 |
| `src/store/ffcs.ts`                                  |             467 |
| `scripts/update-courses.mjs`                         |             301 |
| `public/sw.js`                                       |              53 |
| `src/data/courses.json` (data)                       | 44,489 (964 KB) |
| **Total `src/` (.ts/.tsx/.css)**                     |      **17,834** |

### AmazeCC FFCS

| Area                                                                                                                                                                   | Files |         LOC |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----------: |
| `src/app/ffcs/*`                                                                                                                                                       |     4 |         198 |
| `src/app/share/ffcs/*`                                                                                                                                                 |     2 |         337 |
| `FFCSTimetableTab.tsx` + `FFCSGuideModal.tsx`                                                                                                                          |     2 |       4,209 |
| `src/components/custom/exams/FFCS/`                                                                                                                                    |    54 |     ≈24,600 |
| ├ `components/` (excl. modals)                                                                                                                                         |    20 |      13,114 |
| ├ `components/modals/`                                                                                                                                                 |    10 |       2,783 |
| ├ root (Generator/Friends/types/utils/constants/reports)                                                                                                               |     6 |       4,928 |
| ├ `logic/`                                                                                                                                                             |     6 |       2,564 |
| ├ `hooks/`                                                                                                                                                             |     6 |         500 |
| ├ `features/tour/`                                                                                                                                                     |     5 |         499 |
| └ `workers/`                                                                                                                                                           |     2 |         221 |
| `src/lib/ffcs*.ts`                                                                                                                                                     |    11 |       2,849 |
| Support libs (`slots`, `campusSchema`, `vitfacService`, `exportTimetable`, `portraitDossier`, `exportIcal`, `freeClassrooms`, `timetableMetrics`, `exportClashReport`) |     9 |       5,591 |
| `src/features/import/`                                                                                                                                                 |     4 |       1,521 |
| FFCS tests (`ffcs*`)                                                                                                                                                   |    27 |       8,504 |
| All FFCS-touching tests                                                                                                                                                |    49 |      12,626 |
| FFCS docs                                                                                                                                                              |    11 |       1,280 |
| Campus JSON data                                                                                                                                                       |     3 |         562 |
| **Core FFCS code**                                                                                                                                                     |     — | **≈33,700** |
| **With support libs**                                                                                                                                                  |     — | **≈39,300** |

### Structural observations

1. **Fan-out ratio:** AmazeCC has ~5× the files for ~4× the code — far more, smaller modules at the leaf level, but far larger modules at the top level (three files ≈ 14k lines).
2. **FFCSketch's ratio is inverted:** small engine, medium components, plus 5.6k lines of unused generated UI boilerplate.
3. **AmazeCC splits "pure logic" aggressively** (`logic/`, `lib/ffcs*.ts`) precisely so it can be unit-tested — that is why its test numbers are achievable.
4. **FFCSketch has no such seam** — `timetable.ts` is importable and pure-ish, but nothing verifies it.

## 8. Dependency posture

|                      | FFCSketch                                                                                                                                                                                                                                                                                                 | AmazeCC FFCS                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Needed & used        | `zustand`, `papercss` (inlined anyway), `html-to-image`, `xlsx`, `qrcode`, `framer-motion`, `lucide-react`, Radix subset, `dnd-kit`, `zod`                                                                                                                                                                | `xlsx` (SheetJS 0.20.3 from CDN tarball), `html-to-image`, `jspdf`, `lz-string`, `qrcode.react`, `@supabase/supabase-js` (host, not FFCS), `vitest`/`testing-library` |
| Apparent dead weight | `next-auth`, `next-intl`, `@mdxeditor/editor`, `z-ai-web-dev-sdk`, `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, `react-syntax-highlighter`, `react-hook-form` + resolvers, `vaul`, `embla`, `input-otp`, `react-day-picker`, `sharp`, `uuid`, `next-themes` (custom script used instead) | `react-native-web`, `@uiw/react-heat-map`, `canvas`, `cheerio`, `tough-cookie` (host-app tail; FFCS slice itself is lean)                                             |
| Bundle risk          | 964 KB `courses.json` statically imported into the client bundle, no code splitting                                                                                                                                                                                                                       | catalogue fetched at runtime + preloaded; `xlsx` historically flagged in `docs/historical/speed/bundle.md` as one of the biggest chunks and now dynamically imported  |
