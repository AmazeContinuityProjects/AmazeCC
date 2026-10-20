# Mobile Friendliness Plan — AmazeCC

> Audit date: 2026-10-19. Findings verified against source (src/, public/) and the built SW precache.
> Status legend: [x] done · [~] partially done · [ ] not started (next step listed)

## Priority 1 — High impact

- [x] **1. Heavy static payload (~4.5 MB of PNG)**
  - `public/campus-twilight.png` (2.14 MB) is the LoginForm hero background (`LoginForm.tsx:410`) **and** is in the SW precache (`public/sw.js`).
  - `public/hero-artwork.png` (2.14 MB) — byte-size twin, redundant asset.
  - **Done:** converted hero background to `campus-twilight.webp` (82.6 KB, ~26× smaller), updated the reference, deleted the oversized PNGs, and taught `src/app/sw.ts` to skip oversized artwork in precache. `logo.png` stays PNG (push-notification icon, `sw.ts:69`).
- [x] **2. Hover-only controls unreachable on touch** (worst class of bug)
  - `exams/CircularsTab.tsx:74` — circular download button invisible on phones.
  - `exams/FFCSTimetableTab.tsx:1568` — "Download as JPG/PNG" menu unreachable on touch.
  - `FFCS/components/modals/AutoGeneratorModal.tsx:293, 672` — lock/config tooltips never visible on phones.
  - `tasks/TaskCard.tsx:187` — edit/delete hidden ≥640px until hover.
  - **Done:** all now keep working without hover — either always visible on touch (`[@media(any-hover:none)]:opacity-100`) or replaced with a tap-friendly fallback.
- [x] **3. Small touch targets (≈29 buttons below 44px)**
  - Shared `BottomSheet.tsx:206-212` close (~32px, hit ~44× on every sheet) plus inline actions in `TaskCard`, `SyncModeEditor:696`, `EventSearchPalette:562`, `AutoGeneratorModal:764`, etc.
  - **Done:** shared `.hit-expand` utility in `globals.css` (::after hit-area expansion, `inset: -0.5rem`) applied to the highest-traffic sub-44px buttons: BottomSheet close, TaskCard edit/delete, CircularsTab download, SyncNotification actions, CommandPalette/EventSearchPalette/SyncModeEditor/AutoGeneratorModal close buttons, LoginForm toggles; further small buttons left for a follow-up pass. Caveat for future use: an element that is already `absolute` must get `hit-expand` **without** `relative` — mixing both breaks corner positioning.
- [x] **4. Fixed banners ignore top safe-area**
  - `Main.tsx:2547` (offline toast), `ChangelogModal.tsx:57`, `privacy/page.tsx:24`, `terms/page.tsx:24`, `LoginForm.tsx:333`, `FresherWelcomePage.tsx:99` sticky header — sit under/notch.
  - `AutoGeneratorModal.tsx:752` (floating pill) and `SyncNotification.tsx:280` (toast) — collide with home indicator.
  - **Done:** `env(safe-area-inset-top|bottom)` applied to all of them.
- [x] **5. Inputs < 16px → iOS auto-zoom on focus**
  - `exams/FFCSTimetableTab.tsx:1524, 1539` (selects at 14px/10px), `marks-predictor/AssessmentRegimenEditor.tsx:223/225` (inputs inheriting text-xs).
  - **Done:** bumped to ≥16px on those form controls (14px only on larger screens where focus zoom doesn't apply… iOS applies anyway, so 16px floor kept everywhere).
- [x] **6. Manifest, SW registration & install UX**
  - [x] `manifest.json` `background_color: #ffffff` vs dark-default app → cold-launch white flash. Set to `#020617`; light-theme `themeColor` header fixed (`#ffffffff` → `#ffffff`).
  - [x] Added missing manifest fields: `id`, `scope`, `description`, `lang`, `categories` (both `manifest.json` and `manifest-fire.json`).
  - [x] Root-level SW registration via `ServiceWorkerRegistrar` (mounted in `app/layout.tsx`) so offline fallback works even without visiting onboarding/Dashboard push paths.
  - [x] `beforeinstallprompt` captured app-root; reusable `usePwaInstall()` hook (`src/lib/pwaInstall.ts`) + install offer (`PwaInstallCard.tsx`) that only renders when it has something to show:
      - **Browser prompt path** (Chrome/Edge Android+desktop): when the captured prompt is available, an **Install app** button triggers the native prompt; `accepted`/`dismissed` hide the card for good (dismissal persisted to localStorage).
      - **iOS fallback**: Safari never fires `beforeinstallprompt`, so on touch-iOS (not already standalone) the card instead shows the manual **Share → Add to Home Screen** steps rather than vanishing.
  - [x] Offer placement: Dashboard (next to the push prompt, so a new logged-in user sees both offers once) and the ProfilePage settings hub.

## Priority 2 — Medium

- [x] **7. Desktop-style tables on phones** — partially done: `attendance/TimetableGrid.tsx:277,300` reference table now has a sticky course column so horizontal scroll keeps context; `FFCSTimetableTab.tsx:1624` / `AutoGeneratorModal.tsx:340-350` still need proper card/list redesigns (design work).
- [~] **8. 3-col grids that never collapse** — `qbank/UploadPaperModal.tsx:132` fixed (`grid-cols-1 md:grid-cols-3`); `FreeClassroomsTab.tsx:183`, `TaskEditSheet.tsx:562`, `AutoGeneratorModal.tsx:664` are editable pickers — review before collapsing.
- [x] **9. ProfilePage amazeui center-screen Modals → BottomSheet** (`ProfilePage.tsx:2650-2686`) — all four detail surfaces (EPT/Registration/Bank/Dayboarder) now render through the shared `BottomSheet` with manual title headers; `Modal` import removed.
- [x] **10. Layout-thrashing animation** — resolved: the `scanner-laser` keyframes (animating `top`) turned out to be **used by zero components** in `src/` — dead CSS, flagged in §12 to delete or convert when a scanner UI returns. Plus: global `@media (prefers-reduced-motion: reduce)` block in `globals.css` kills all `.animate-ping/.animate-pulse/.animate-spin/.shimmer/.scanner-laser` loops for motion-sensitive users; the always-on live-dot loops on both mobile homes slowed to 2.5s.
- [~] **11. Images** — `loading="lazy" decoding="async"` added to feed/modal/list avatars (`ClubDetailsModal`, `FacultyInfoTab`, `TeamModal`, `ProfilePage` people list, SimplifiedMobileHome/MobileHome avatars, `TransportRegistration` QR, onboarding logos); `decoding="async"` on the LCP-critical logos. `next/image` migration skipped deliberately (static export + arbitrary VTOP/Koha hosts; see `BookCover.tsx` comment).

## Priority 3 — Low / needs a decision

- [x] **12. Dead weight** — `ReelScroller.tsx` deleted (zero importers; swiper-only user), deps removed from `package.json`: `html2canvas`, `jspdf`, `cmdk`, `swiper`. `pnpm install` re-locked (21 packages removed).
- [x] **13. Manifest extras** — `shortcuts` (Dashboard/Tasks/Timetable) + `share_target` (GET → `/share`) added to both manifests; new `src/app/share/page.tsx` receives shared title/text/url, validates URLs to http(s), offers copy-to-clipboard + dashboard link. `screenshots` skipped: requires real device screenshots we don't have.
- [x] **14. List windowing** — `GenericApiView.tsx` API-dump tables now render the first 80 rows with a "Show N more rows / Show fewer" toggle (state at the component top-level, per-table `Set`).

## Bug fix (not in the audit)

- [x] **Sheets invisible on scrollable pages** — an uncommitted `BottomSheet.tsx` change made the keyboard-offset wrapper render **always** with `willChange: "transform"`, which (per spec) turned the wrapper into the containing block for the `fixed` sheet panel. The sheet then anchored to a 0-height box at the end of the document flow, i.e. below the fold on any scrollable page: dimmed backdrop, no sheet. Fixed: wrapper stays always-mounted (preserving the remount-loop fix it was written for) but is an inert pass-through when not lifted; when lifted it becomes a fixed, viewport-sized, pointer-transparent layer with `pointerEvents: "auto"` restored on the panel.
- [x] **Page reloading mid-operation** — the error boundaries (`error.tsx`/`global-error.tsx`) auto-reloaded on `ChunkLoadError`, but a plain `location.reload()` re-serves the same stale document (from the SW cache) that referenced the missing chunk, so the error re-threw and the page reloaded again every 10 s. Recovery now drops the stale bundle first (`src/lib/chunkRecovery.ts`: unregister the SW + delete caches, then reload) and never fires offline. Covered by `__tests__/chunkRecovery.test.ts`.
- [x] **Back stack capped at ~2 steps** — two causes, both fixed:
  - Next.js's App Router popstate handler reloads the page when the landed history entry lacks its `__NA` marker (`function F(e){ if(!e.__NA) return window.location.reload(); ... }` in the router chunk). A reload re-mounts the app and resets its own stack, so back "stopped working" after a couple of steps. `src/lib/historyStack.ts` now writes that marker explicitly (and preserves `__PRIVATE_NEXTJS_INTERNALS_TREE`) instead of relying on the spread of the previous entry, which races Next's hydration write on the first entry.
  - Only tab/sub-tab **screens** owned history entries; overlays (sheets, palettes, in-tab subpages, app library, drill-downs) borrowed a screen's entry, which fails outright on the first screen and means the full chain of ops was never addressable by back. `useOverlayBack` now gives every back-able overlay its own entry (`op: { kind: "overlay", id }`), and the popstate handler dismisses the overlay for its own entry rather than re-pushing a screen. `goBack` also dismisses an open overlay before consulting the screen stack.
  - Covered by `__tests__/historyStack.test.ts` and `__tests__/overlayStack.test.tsx`.

## Offline persistence (iOS/Safari follow-up)

- [x] **Root cause: 24-hour cache expiry.** `@serwist/next`'s `defaultCache` aged every shell-critical cache (`pages`, `next-static-js-assets`, `static-js-assets`, `static-style-assets`) out after 24 h, so after a day of not opening the app the cached shell was gone and only the offline fallback rendered. `src/app/sw.ts` now prepends persistence overrides (first match wins) giving the app shell **30 days** with `maxAgeFrom: "last-used"` — pages the user actually opens offline stay cached, abandoned ones age out. Dynamic data (APIs, `next-data`, RSC) keeps its short TTLs on purpose.
- [x] **`skipWaiting`** cleaned up: the top-level `self.skipWaiting()` + `skipWaiting: false` contradiction is now a single `skipWaiting: true`, so a redeploy activates immediately instead of leaving the old cache in charge until every tab closes.
- [x] **`updateViaCache: "none"`** on the root registration — Safari serving a stale `sw.js` from its HTTP cache is a classic way offline support "stops working" after a deploy.
- [x] **Offline page is now a real gateway**: "Open dashboard" navigates to `/`, whose HTML is served from the `pages` cache, so the app shell comes up with last-synced data; added a reconnect button and honest copy. The page itself is precached (`~offline` present in `__SW_MANIFEST`).
- [ ] **Platform limit, not a bug:** iOS Safari purges website data (including SW caches) for sites not visited for ~7 days **unless installed as a home-screen PWA**. The install offer (`PwaInstallCard`) is therefore part of the offline story on iOS — installed PWAs get persistent storage.

## Verification checklist

- [x] `pnpm test` (vitest) passes — includes `mobileNavStacking`, `bottomSheetDismiss` guards. (72 files, 1364 tests)
- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` — 0 errors (all 128 warnings pre-existing in untouched files).
- [x] `pnpm build` passes — static export emits all 8 routes incl. `/share`; the Service Worker bundles with the new precache filter.
