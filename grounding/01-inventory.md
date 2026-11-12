# 01 — Measured Codebase Inventory (snapshot 2026-11)

This is ground truth as of the snapshot date. **Re-verify with git/rg before relying on any
exact count** — the tree drifts. The point of this file is (a) scope sizing, (b) knowing the
hot spots and traps so docs can call them out, (c) feeding `09-coverage-checklist.md`.

Commands used: `Get-ChildItem src -Recurse | Measure-Object`, `git ls-files`, direct reads.
If something here and the tree disagree, trust the tree; note corrections in your PR.

## Scale

| Area                                                            | Files                                                                                                         | Lines (approx) |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- |
| `src/` total                                                    | ~721 (710 .ts/.tsx/.css)                                                                                      | ~184k          |
| `src/lib`                                                       | 146 .ts                                                                                                       | ~38.7k         |
| `src/components`                                                | 309 .tsx/.ts                                                                                                  | ~4.6 MB        |
| `src/store`                                                     | 6                                                                                                             | ~406           |
| `src/types`                                                     | 17                                                                                                            | ~545           |
| `src/data`                                                      | several (buildInfo.json, demoData.json ×2, changelog.json, campus/*.json, quickLinks, team, dayscholar_buses) | —              |
| `src/features`                                                  | 4 (`features/import/*`)                                                                                       | ~1.4k          |
| `src/__tests__`                                                 | 204 test files + `helpers/localStorage.ts`                                                                    | ~40k           |
| `src/app`                                                       | 24 entries                                                                                                    | —              |
| `scripts/`                                                      | 8 (incl. one .jsonl corpus, not a script)                                                                     | —              |
| `public/`                                                       | 51 files                                                                                                      | —              |
| Root `data/`, `sql/`, `certificates/`, `dayscholar/`, `design/` | committed scrape output & SQL migrations                                                                      | —              |

## App routes (`src/app`) — complete list

`/` (src/app/page.tsx → HomeEntryController), `/ffcs` (layout + page + FFCSPageView +
PreloadReportCsv), `/friend-finder` (+ `/friend-finder/disclaimer`), `/privacy`, `/terms`,
`/share`, `/share/ffcs`, `/~offline`, plus root `layout.tsx`, `error.tsx`, `global-error.tsx`,
`not-found.tsx`, `globals.css`, `sw.ts` (Serwist source). **No `route.ts` handlers, no
`loading.tsx`, no `template.tsx` anywhere.** `~offline/` is the Serwist offline fallback URL.

## Largest files (lines) — docs must go deepest here

1. `src/components/custom/exams/FFCS/components/FFCSGuidedSelector.tsx` — ~5,126
2. `src/components/custom/exams/FFCSTimetableTab.tsx` — ~4,436
3. `src/components/custom/exams/FFCS/FFCSGeneratorSubpage.tsx` — ~3,665
4. `src/components/custom/exams/CourseDetailSubpage.tsx` — ~2,881
5. `src/components/custom/header/ProfilePage.tsx` — ~2,749
6. `src/components/custom/reports/StudentReportPage.tsx` — ~2,280
7. `src/components/custom/mobile/SimplifiedMobileHome.tsx` — ~2,147
8. `src/components/custom/friendfinder/FriendFinderTab.tsx` — ~2,008
9. `src/components/custom/feedback/FeedbackReportPage.tsx` — ~1,974
10. `src/components/custom/app/useAppCommands.tsx` — ~1,772
11. `src/lib/exportTimetable.ts` — ~1,752
12. `src/lib/calendarDay.ts` — ~1,581 · 13. `src/lib/navigation/registry.tsx` — ~933 (in lib)
13. `src/lib/ffcsGenerate.ts` — ~1,281 · 15. `src/lib/posthog.ts` — ~1,192

## Build/config essentials (docs must explain these)

- `next.config.mjs`: `output: "export"`, `basePath: ""`, `trailingSlash: true`,
  `transpilePackages: ["@amazecontinuityprojects/amazeui"]`, `reactStrictMode: true`,
  `output images unoptimized`, Serwist wrapper (`swSrc: src/app/sw.ts → public/sw.js`
  in dev / `out/sw.js` post-build), PostHog source-map upload wrapper, webpack alias
  `react-native → react-native-web`, server external `@napi-rs/canvas`, CSP nonce-less
  meta tag in `layout.tsx` (production only).
- `package.json`: `dev` = `next dev --webpack --experimental-https -p 3001`;
  `build` = `next build --webpack && node scripts/prune-sw-precache.js`;
  `test` = `vitest run`; CI runs lint → typecheck → test → build.
- `.github/workflows/ci.yaml` and `nextjs.yml` (GitHub Pages deploy). Both set
  `NEXT_PUBLIC_*` at build time; prod uses `api.amazecc.com`.
- pnpm workspace (`pnpm-workspace.yaml`), `.npmrc` with `package-manager=pnpm` + auto-install-peers.
- `tsconfig.json` — `@/* → ./src/*`; **strictNullChecks is OFF** project-wide (docs must say so).
- `vitest.config.ts` — jsdom, globals:true, 30s timeout, no global setup (helper imported per
  suite), aliases, CSS stubbed, 4 workers. No @testing-library/jest-dom.
- `.env.example` — the env catalog to document; `.env` is gitignored (never print it).

## Architecture facts you must not get wrong

1. **There is no `src/app/api/`.** All "API" calls go to `NEXT_PUBLIC_API_URL`
   (default `https://api.amazecc.com`) via `apiRequest()` in `src/lib/sync-engine/request-layer.ts`.
2. **The signed-in app has no URL routing.** `src/app/page.tsx` → `Main.tsx`; tabs are jotai
   atoms (`src/store/uiAtoms.ts`) switched by rendering feature screens behind
   `DashboardRoute`/`DashboardNavigator`. `Main.tsx` is the strongest counterexample to the
   phrase "single-page app" that matters for handoff docs.
3. **Auth lives in the browser.** VTOP credentials are AES-256-GCM-encrypted at rest by
   `src/lib/credentialVault.ts` (IndexedDB-held CryptoKey + `Storage.prototype` patch).
   `authorizedIDAtom` (jotai) holds the session id **in memory only**.
4. **`Main.tsx` ≈ the "shell"**. `AuthenticatedWorkspace` (gate) → dynamic `Dashboard.tsx`
   (chrome + routing) → feature boundaries. `AppHousing` provides session hydration, the
   sync-engine→atoms bridge and the sync sheet; two near-duplicate hosts exist
   (`Main.tsx` rolls its own `SyncSessionHost` vs `AppHousing.mountSyncHost`).
5. **Standalone routes re-wire the same housing** (`/ffcs`, `/friend-finder`) — code-share
   pattern: `AppHousing` + dynamic page views.
6. **Demo mode** is a first-class runtime mode: `demoMode` flag in storage, `demoData.json`
   (committed twice: `src/data/demoData.json` == `public/data/demoData.json`, byte-identical),
   sync engine short-circuits VTOP auth when set.
7. **Two dedicated Web Workers:** `exams/FFCS/workers/generator.worker.ts` (solver, started
   from `logic/generator.ts`) and `exams/FFCS/workers/pdf.worker.ts` (dossier PDFs, started
   from `src/lib/exportTimetable.ts`). A Serwist service worker (`src/app/sw.ts`) precaches
   selectively and excludes ALL images/json/csv/md from precache; offline fallback is `/~offline/`.
8. **Failure hot lines:** `/api/ffcs` expects `{cookies, authorizedID, csrf}` and rejects
   anything else with 400; clients must never call it on mount (see `Dashboard.tsx` history).
9. **Marks sync** (`src/lib/marksSync.ts`) is consented, student-hashless (SHA-256 keys mirrored
   server-side), and gated by server HMAC receipts (`marksFrozenV1`). Docs must explain the
   privacy model, not just the mechanics.
10. **UniCC fallback** (`src/lib/unicc-fallback.ts`) sends real credentials to a third-party
    host for an allowlist of paths only; it can be disabled with
    `NEXT_PUBLIC_UNICC_FALLBACK=off`. Always documented as a deliberate, scoped choice.

## `src/lib` hot inventory (one line each — the coverage checklist expands this)

sync-engine/ (13 files: index, operations ~25 registered ops, credential-manager, request-layer,
sync-modes, sync-session, single-sync, operation-registry, errors, progress-bus, state-bridge,
useSync, types) • FFCS family (ffcsTypes/ffcsConstants/ffcsReports/ffcsGenerate/ffcsWalk/
ffcsGeneratorTargets/ffcsGeneratorSessionPrefs/ffcsSettings/ffcsClassmates/ffcsShare/
ffcsShareInput/ffcsCatalogFilters/ffcsPlannerGrades/ffcsRanking/ffcsClashPairs/ffcsCourseGrouping/
ffcsFacultyPriority/ffcsFacultyRanking/ffcsOfferingFilters/ffcsResultFilters/ffcsNavigation) •
storage/fetch/fallback (storage, safeStorage, fetch-utils, unicc-fallback, workerBase,
useUniccTarget) • academics engines (attendancePredictor, calendarDay 1,581 lines, gradeBoundaries,
marksPredictor, gradeHistory, gradesEffective, timetableMetrics, slots, freeClassrooms, cx.) •
exports (exportTimetable, exportTimetableHtml, exportClashReport, formDossier, portraitDossier,
studentReportPdf, exportIcal, imageDownload) • scanner/* (13 files, tesseract.js) • social/* (12
files) • libraries/koha • navigation/registry.tsx • posthog.ts, analytics.ts, csp.ts,
credentialVault.ts, chunkRecovery.ts, vitfacService.ts • ~60 other modules.

## `src/store` atom budget (59 atoms)

`authAtoms` (5: credentials, isLoggedIn, demoMode, showIntro, authorizedID) • `dataAtoms` (19) •
`settingsAtoms` (1 `atomWithStorage("settings")` with merge-on-read migration + ~70 Settings
fields + defaultSettings) • `uiAtoms` (26) • `socialAtoms` (8) • barrel `index.ts`.

## Dead code & duplicates (docs MUST flag these)

1. `src/components/custom/StatCards.tsx` — zero importers (the removed stat-card home).
2. `attendance/AttendanceSubpage.tsx` & `attendance/DesktopCourseDetailPane.tsx` — re-export
   aliases of `DesktopCourseDetail.tsx`.
3. `exams/marks-predictor/tour/*` — near-verbatim copy of `exams/FFCS/features/tour/*`.
4. `Toggle.tsx` vs `ThemeToggle.tsx` vs `shared/primitives/Switch.tsx` vs `ToggleRow.tsx` —
   four switch-ish systems; three docs-worthy "Sun/Moon toggle" histories.
5. Three `TimetableGrid*` + one shell; canonical entry is `timetable/TimetableView.tsx`.
6. `social/CommonFreeSlotsModal.tsx` — self-declared legacy, still shipped.
7. ~18 `shared/*.tsx` one-line re-export shims over `@amazecontinuityprojects/amazeui`
   (deliberate migration pattern; editors will mistake them for wrappers).
8. `FFCSGuideModal.tsx` in `exams/` root vs modals under `exams/FFCS/components/modals/`.
9. `VitolDisplay.tsx` exports lowercase `vitolDisplay`; `courseHelpers.tsx` is `.tsx` helpers;
   `StatCards.tsx` exports `StatsCards`; `ffcsCatalogCurriculum.hook.test.tsx` tests
   `ffcsCatalogFilters.ts` (missing module name ≠ missing logic).
10. Root `guide.md` — stale VTOP endpoint cookbook that mixes client guidance with server paths.

## Backend boundary (for docs framing)

The frontend never talks to Supabase/VTOP directly. Everything goes through
AmazeCC-API (separate repo) with `auth: "vtop"` or `"eventHub"`; static hosting = no secrets,
so all secrets stay server-side; the marks-sync HMAC and PostHog identity-hash are computed
server-side with the client only passing identifiers. Document the contract (who sends what,
in what shape, with which failure codes), not the server internals.

## Big-picture copies

`public/data/demoData.json` == `src/data/demoData.json` (same SHA). `ffcsReport.csv` ==
`fall-2026-2027-final-ffcs.csv` (same SHA). Document source-of-truth + provenance for each.
