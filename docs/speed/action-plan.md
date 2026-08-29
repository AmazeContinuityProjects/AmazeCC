# Action plan (prioritized)

Ordered by impact-to-effort. Each item references the detailed finding file.

## P0 — Do first (biggest perceived-speed wins, low risk)

| # | Change | Where | Impact | Detail |
|---|--------|-------|--------|--------|
| 1 | Remove hard-coded 2.4 s loading timer | `Main.tsx:375` | High | Gate `isLoading` on real readiness, not `setTimeout(..., 2400)` | [`runtime.md`](./runtime.md) |
| 2 | Remove full reload on theme change | `Main.tsx:51` (`reloadAfterThemeChange`) | High | Let CSS-var theme swap re-render in place | [`runtime.md`](./runtime.md) |
| 3 | Add dep array to `cmds` useMemo | `Main.tsx:985` | High | Stops recompute-on-every-render of large command JSX | [`runtime.md`](./runtime.md) |
| 4 | Migrate fonts to `next/font/google` | `layout.tsx:53-55` | High | Removes render-blocking font CSS/round-trip → faster FCP | [`assets.md`](./assets.md) |

## P1 — Code splitting (largest bundle reduction)

| # | Change | Where | Impact | Detail |
|---|--------|-------|--------|--------|
| 5 | Lazy-load `xlsx` tabs | `FreeClassroomsTab.tsx:22`, `FFCSTimetableTab.tsx:5`, `FreeClassroomsWidget.tsx:5` | Critical | SheetJS is one of the biggest chunks | [`bundle.md`](./bundle.md) |
| 6 | Lazy-load `recharts` tabs | `AcademicsHub`, `MarksHistoryTab`, `CurriculumPage` | Critical | Recharts ≈ 280 KB+ | [`bundle.md`](./bundle.md) |
| 7 | Lazy-load `@uiw/react-heat-map` tabs | `AttendanceSubpage`, `OverallTrackerSubpage`, `ODTrackerSubpage` | High | Heat-map lib on initial path unnecessarily | [`bundle.md`](./bundle.md) |
| 8 | Lazy-load `swiper` (`ReelScroller`) | `ReelScroller.tsx:3` | Medium | Defer until used | [`bundle.md`](./bundle.md) |
| 9 | Stop inlining `demoData.json` | `Main.tsx:22` | High | Removes 151 KB from non-demo initial path | [`bundle.md`](./bundle.md) |
| 10 | Trim `framer-motion` | pervasive | Medium | `LazyMotion`/`m` or CSS transitions | [`bundle.md`](./bundle.md) |

## P2 — Rendering & re-render hygiene

| # | Change | Where | Impact | Detail |
|---|--------|-------|--------|--------|
| 11 | Use atom selectors / `React.memo` | `Main.tsx:58-94` → `Dashboard` | Medium | Cut re-render fan-out | [`runtime.md`](./runtime.md) |
| 12 | Centralize storage hydration | `Main.tsx:316-376`, `storage.ts` | Medium | One parse pass, not per-component reads | [`startup.md`](./startup.md) |
| 13 | Debounce tracker writes | `attendance/*`, `exams/CourseDashboard.tsx` | Medium | Avoid JSON.stringify on every keystroke | [`startup.md`](./startup.md) |
| 14 | Bound the `message` buffer | `Main.tsx` (`setMessage(prev + ...)`) | Low | Avoid ever-growing string re-renders | [`runtime.md`](./runtime.md) |
| 15 | Defer more reload endpoints | `Main.tsx:543-803` | Medium | Push bulk endpoints to background queue | [`startup.md`](./startup.md) |

## P3 — Caching & assets

| # | Change | Where | Impact | Detail |
|---|--------|-------|--------|--------|
| 16 | `cacheOnNavigation: true` | `next.config.mjs:19` | Medium | Instant repeat/offline loads | [`service-worker.md`](./service-worker.md) |
| 17 | Pre-optimize images in `public/` | `next.config.mjs:56` | Low | Unoptimized images served full-size | [`assets.md`](./assets.md) |
| 18 | `clientsClaim`/`skipWaiting` | `sw.ts:27-28` | Low | Faster pickup of optimized bundles | [`service-worker.md`](./service-worker.md) |

## Expected outcome

- **Initial JS** for `/` should drop from ~1.52 MB (page chunk) + heavy vendor chunks to a few hundred
  KB after P1, cutting Time-to-Interactive substantially.
- **FCP** improves via `next/font` + removal of the 2.4 s splash.
- **Interactivity** improves via the `useMemo` fix, removed theme reload, and reduced re-render fan-out.

## Verification

After P0+P1, re-run `next build` and compare `out/_next/static/chunks/page-*.js` (target < ~600 KB raw)
and the home First-Load JS. Measure FCP/TTI in Chrome DevTools (or Lighthouse) before/after.

## Progress log (implemented)

| # | Status | Note |
|---|--------|------|
| P0-1 2.4s timer | ✅ Done | `setIsLoading(false)` gated on real readiness (Main.tsx ~370) |
| P0-2 theme reload | ✅ Done | removed `reloadAfterThemeChange` + 2 call sites |
| P0-3 cmds useMemo | ✅ Done | wrapped handler chain in `useCallback` (loginToVTOP, handleLogin, fetchTransportData, handleReloadRequest, handleLogOutRequest, setAttendanceAndOD) so `cmds` no longer recomputes every render |
| P0-4 next/font | ✅ Done | Geist/Geist_Mono/DM_Sans via `next/font/google` in layout.tsx; globals.css uses CSS vars |
| P1-5 xlsx lazy | ✅ Done | `import("xlsx")` inside export handlers (3 files); 469 KB now separate async chunk |
| P1-6 recharts lazy | ✅ Auto | webpack already splits recharts into a chunk NOT in initial preload |
| P1-7 heat-map lazy | ✅ Auto | same — not in initial preload |
| P1-9 demoData | ✅ Done | `fetch('/data/demoData.json')` on demand; removed from bundle (confirmed `demo12345` absent from page chunk) |
| P1-8 swiper | ✅ Done | `ReelScroller` lazy via `next/dynamic({ ssr:false })` in ReloadModal — swiper loads only when reload modal renders |
| P1-10 framer-motion | ✅ Done (minimal benefit) | Converted all 27 files `motion`→`m` + wrapped root in `<LazyMotion features={() => import("framer-motion").then(m => m.domMax)}>`. **Measured result: no bundle/initial-load win** — framer-motion core was already a separate preloaded vendor chunk (via static `motion` import), and `LazyMotion`+`domMax` still require that core, so the 0.77 MB chunk remains in the initial preload. Net: modernized pattern, ~0 KB saved. (True trim needs dropping framer-motion for CSS transitions — out of scope.) |
| P2-11 React.memo | ✅ Done | `DashboardContent` wrapped in `memo()`; stabilized the 2 inline arrow props (`openCommandPalette`/`openShortcutsHelp` via `useCallback`). Verified `DashboardContent` does NOT subscribe to `messageAtom`, so it now skips re-render on every `message`/`progressBar` update (≈15 during a reload). (atom-selector narrowing left as optional) |
| P2-12 storage hydration | ✅ Already done | `Main.tsx` hydration effect (311-376) already reads all storage once and sets atoms (single parse pass). Only 2 non-critical direct reads remain (`storage.curriculum` in CurriculumPage/CurriculumCategoriesTab, per-mount) |
| P2-13 debounce writes | ⬜ Deferred | grep found no per-keystroke `localStorage`/`JSON.stringify` writes; all writes are in fetch/settings handlers (appropriately batched). No clear target. |
| P2-14 message buffer | ✅ Done | `messageAtom` write override caps to last 60 lines at the store — bounds ever-growing string for all consumers |
| P2-15 defer endpoints | ✅ Done | `handleReloadRequest` now sets `isReloading=false` after the primary `Promise.all(tasks)` (core + events + transport + moodle); EPT/bus/library/bulk-endpoint caching moved to a non-awaited background IIFE. App becomes interactive sooner during reload |
| P3-16 cacheOnNavigation | ⬜ Pending | config flag |
| P3-18 clientsClaim | ⬜ Pending | sw.ts |

### Measured after P0+P1 (partial)
- `page` chunk: 1.44 MB raw (was 1.52 MB; demoData 151 KB + xlsx 400 KB now split out).
- `xlsx` present only in async chunk `57287d70…js` (469 KB); verified absent from `page-*.js`.
- `recharts`/`heat-map` verified absent from initial preload set → already lazy.

### Remaining high-value, lower-risk
- P1-8 swiper, P1-10 framer-motion (bundle only).
- P3-16 `cacheOnNavigation: true` in next.config.mjs (instant repeat/offline loads) — config-only, safe.
- P3-18 `clientsClaim` in sw.ts — config-only, safe.
- Route-level splitting (strategic doc) deferred.
