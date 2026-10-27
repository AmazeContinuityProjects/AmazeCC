# Routing architecture analysis (what-if: split tabs into real routes)

**Context:** Today the app is a single-route SPA. `src/app/page.tsx` → `Main` → `Dashboard`, and every
"tab" (`home`, `attendance`, `academics`, `tools`, `hostel`, `cabshare`, `dayscholar`, `transport`,
`payments`, `libraries`, `more`, `profile`, `about`) is just `activeTab` atom state rendered with
`activeTab === "x" && <Tab/>` (`Dashboard.tsx:771-1156`). `next/navigation` is **not** used anywhere
except `not-found.tsx` (verified by grep). All data lives in global Jotai atoms (`Main.tsx:58-94`),
persisted to `localStorage`.

The question: **what if we turn each tab into a real Next.js route, and warm (cache) every route after
the initial load?** This document analyzes feasibility, benefits, costs, and a migration path. It
assumes the existing `output: 'export'` static-export setup.

---

## 1. Why this helps more than `next/dynamic` alone

The current bundle problem (`bundle.md`) is that `Dashboard.tsx` **statically imports ~40 tab
components**, so recharts/xlsx/heat-map/swiper are all pulled into the home `page` chunk (1,521.7 KB)
even though the user only sees one tab.

Two ways to fix that:

| Approach | How | Pros | Cons |
|---|---|---|---|
| **A. `next/dynamic` per tab** (P1 in `action-plan.md`) | Wrap each heavy tab in `dynamic(() => import(...))` | Small, localized change; keeps SPA UX | Easy to forget a tab; home chunk still bundles `Dashboard` + light tabs + all the effect/redirect logic; no deep-linking; cache granularity = one big app |
| **B. Real routes** (this doc) | Each tab = its own `app/<tab>/page.tsx` | Next gives **per-route code splitting for free**; deep-linking; back/forward; framework-native `router.prefetch` to warm cache; finer SW caching | Larger refactor; history/UX behavior changes |

**Recommendation: do B, and keep A for heavy *sub*-views.** Route-splitting is the only approach that
makes the *initial* download tiny by construction (the home route simply cannot reference the
`/academics` recharts code), and it gives you a clean, supported way to "cache all routes after init"
via `router.prefetch` (see `caching-strategy.md`).

---

## 2. Target route map

Map the existing `activeTab` values 1:1 to routes. Sub-tabs stay as in-route UI state but their heavy
panels are lazy (`next/dynamic`) — exactly like `qbank/PapersArchiveTab` already is.

```
app/
  layout.tsx                     (root: <html>, fonts, <body>)  — unchanged
  (app)/
    layout.tsx                   (AppProvider + NavigationTabs + CommandPalette + PushPrompt)
    page.tsx                     ->  home          (was activeTab "home")
    attendance/page.tsx          ->  attendance     (heat-map lives here)
    academics/page.tsx           ->  academics     (recharts: AcademicsHub, CurriculumPage)
    tools/page.tsx               ->  tools         (xlsx: free-class/ffcs; recharts: predictor)
    hostel/page.tsx              ->  hostel
    cabshare/page.tsx            ->  cabshare
    dayscholar/page.tsx          ->  dayscholar    (xlsx: FreeClassroomsWidget)
    transport/page.tsx           ->  transport
    payments/page.tsx            ->  payments
    libraries/page.tsx           ->  libraries
    more/page.tsx                ->  more
    profile/page.tsx             ->  profile
    about/page.tsx               ->  about
```

Notes:
- The route group `(app)` keeps URLs clean (`/attendance`, not `/(app)/attendance`).
- `privacy/`, `terms/`, `~offline/` already exist as separate routes — consistent with this model.
- Gated tabs (hostel only for hostellers, dayscholar only for dayscholars) just don't get a nav entry;
  deep-linking to them is harmless (provider still hydrates from cache).

---

## 3. What must move out of `Main.tsx`

`Main.tsx` is ~1,300 lines and wires everything through props. For route-splitting, extract an
**`AppProvider`** (a client context) placed in `app/(app)/layout.tsx`. It owns:

- Login / reload / logout handlers (`handleLogin`, `handleReloadRequest`, `handleLogOutRequest`,
  `loginToVTOP`, `fetchTransportData`) — currently `Main.tsx:378-837`.
- The one-time `localStorage` hydration effect — currently `Main.tsx:316-376` (move here so it runs
  **once per app mount**, not per route; the layout persists across client navigations).
- The theme CSS-variable writer — currently `Main.tsx:111-228`.
- Keyboard shortcuts — currently `Main.tsx:905-983` (replace `setActiveTab(x)` with
  `router.push('/x')`; keep Alt+T theme toggle but **remove the `location.reload()`** — `runtime.md`).
- The `cmds` command palette — currently `Main.tsx:985+` (move into the provider/layout so it is
  available on every route; **add a dependency array** to the `useMemo`).
- Push prompt / changelog / onboarding modals — render once in the layout, not per route.

Each route page then does `const { handleReloadRequest, ... } = useApp()` instead of receiving ~50
props from `Dashboard`. `Dashboard.tsx` effectively dissolves: the active-tab switch (`activeTab ===`
conditionals) is replaced by the router, and each page renders its own tab component.

The redirect logic at `Dashboard.tsx:255-271` becomes `router.replace('/tools')`-style calls inside
the relevant page (or a small effect in the provider).

---

## 4. How "cache all routes after init" works

See `caching-strategy.md` for the full SW design. In short:

1. After the app mounts and the browser is idle, `AppProvider` calls a `warmRoutes()` that iterates the
   route list and invokes **`router.prefetch('/attendance')`** etc. (`requestIdleCallback` with a
   `setTimeout` fallback).
2. `router.prefetch` downloads each route's JS chunk. Serwist's runtime cache (`defaultCache`) stores
   `_next/static/*` with `cacheFirst`, so the chunk is now local.
3. When the user clicks a tab, client-side navigation fetches an **already-cached** chunk → instant
   switch, no network, works offline.

This is strictly better than today: today the 1.5 MB home chunk blocks first paint; with routes the
home chunk is small, and the rest is fetched in the background and cached.

---

## 5. Expected impact (estimates)

| Metric | Today | After route-split + warm |
|---|---|---|
| Initial JS for `/` | ~2.2 MB raw (page 1.52 MB + fw/main/poly + needed vendor) | ~0.7–0.9 MB raw (home tab + chrome + provider only) |
| Time-to-Interactive | blocked by 1.52 MB parse + 2.4 s splash | small home chunk + no forced splash (fix `runtime.md` P0) |
| Tab switch | already client-side, but whole app already in memory | client-side + chunk pre-cached → instant; memory lower per route |
| Offline deep-link | only `/` cached (navigation precache off) | every visited/prefetched route cached |

(Re-run `next build` after the split to confirm the home `page` chunk drops below ~600 KB raw.)

---

## 6. Trade-offs & risks

1. **Refactor size.** `Main`/`Dashboard` are monolithic; extraction to a provider + 13 pages is the
   biggest piece of work. Mitigate by doing it tab-by-tab behind the existing atom state (a page can
   still read `activeTab` during transition, then switch to `usePathname()`).
2. **History / back-button behavior changes.** Tab switches become history entries. Some users like
   deep-linking; others find "back returns to previous tab" surprising. Decide intentionally (e.g.
   `router.push` for user clicks, but `replace` for programmatic redirects).
3. **Refresh of a sub-route.** Refreshing `/attendance` re-runs the provider mount effect (localStorage
   hydration). That is fast and correct, but the **2.4 s splash must be removed first** or every refresh
   feels slow (`runtime.md` P0). Ensure the provider does not re-trigger a full network login on refresh
   — data comes from the `localStorage` cache, exactly as today.
4. **SSR/hydration.** Unchanged: `output: 'export'` + all-client components; `suppressHydrationWarning`
   already set. No new mismatch risk.
5. **Service worker must re-precache new chunks.** Serwist auto-includes the build manifest, so new
   per-route chunks are cached; just bump the SW so clients pick them up (`service-worker.md` P3).
6. **Shared chrome re-render.** Put `NavigationTabs`/provider in the `(app)` layout so it does **not**
   re-mount on navigation (keeps atom state and avoids re-running hydration).

---

## 7. Phased migration plan

- **Phase 0 (prerequisites, from `action-plan.md` P0):** remove 2.4 s splash, remove theme `location.reload()`, fix `cmds` useMemo deps, move fonts to `next/font`. Do these regardless.
- **Phase 1:** Extract `AppProvider` (handlers + hydration + theme + shortcuts + palette) into
  `app/(app)/layout.tsx`. Keep `page.tsx` rendering `Dashboard` for now — no URL change yet, just
  proves the provider works.
- **Phase 2:** Create route pages one at a time. Start with the heaviest, highest-value tabs
  (`/academics`, `/tools`, `/attendance`, `/dayscholar`) so their recharts/xlsx/heat-map code leaves the
  home chunk. Replace `setActiveTab` nav with `<Link href="/x">` / `router.push`.
- **Phase 3:** Delete `Dashboard.tsx`'s active-tab switch; each page renders its own tab component.
  Move remaining sub-view redirects to `router.replace`.
- **Phase 4:** Add `warmRoutes()` idle prefetch + Serwist tuning (`caching-strategy.md`).
- **Phase 5:** Re-measure bundle + TTI; confirm home chunk < ~600 KB raw.

---

## 8. Verdict

Route-splitting is the **strategically correct** fix for the bundle problem: it makes the initial
download small by construction, adds deep-linking, and gives a first-class mechanism (`router.prefetch`
+ Serwist) to cache every route after init. The main cost is a medium-large but mechanical refactor of
`Main`/`Dashboard` into a provider + route pages. Combined with the P0 runtime fixes, it should make
the app feel dramatically faster on first load and on every tab switch.
