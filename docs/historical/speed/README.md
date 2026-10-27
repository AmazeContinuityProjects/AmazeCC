# AmazeCC Performance Analysis

**Date:** 2026-08-29
**Scope:** Full frontend (`src/`, `next.config.mjs`) — why the app "feels insanely slow".
**Method:** Static code review + a real production build (`next build --webpack`, `output: export`) to measure bundle sizes.

> All file references use `path:line`. Sizes are **raw (uncompressed)** JS measured from `out/_next/static/chunks`. Gzip is typically ~1/3 of these.

---

## TL;DR

The app is a single-page, fully client-rendered static export (`output: 'export'`). Almost the
entire application is shipped in **one ~1.52 MB home-page chunk** that must be downloaded, parsed and
executed before anything is interactive. On top of that there is an **artificial 2.4-second loading
screen**, a **full page reload on theme change**, a **151 KB demo-data JSON inlined into the bundle**,
**render-blocking Google Fonts**, and **images served unoptimized**. These combine to make first load
and interactions feel slow.

The single biggest win is **code-splitting the heavy libraries** (`recharts`, `xlsx`,
`@uiw/react-heat-map`, `swiper`, `framer-motion`) out of the initial bundle.

---

## Measured bundle (production build)

| Chunk | Size | Notes |
|---|---|---|
| `page-*.js` (home `/`) | **1,521.7 KB** | Contains `Main` + `Dashboard` + every statically-imported child |
| `12-*.js` | 783.0 KB | Heavy vendor (recharts / xlsx class) |
| `57287d70-*.js` | 355.9 KB | Vendor chunk |
| `39a02dcd-*.js` | 281.4 KB | Vendor chunk (likely framer-motion) |
| `d7afc3f2-*.js` | 259.1 KB | Vendor chunk (likely xlsx) |
| `128-*.js` | 240.9 KB | Vendor chunk |
| `framework-*.js` | 185.2 KB | React/Next runtime |
| `main-*.js` | 135.4 KB | Next app shell |
| `polyfills-*.js` | 110.0 KB | Polyfills |
| **Total JS** | **~4.5 MB** | across all chunks (initial load pulls the page chunk + its graph) |

First-load JS for `/` is realistically ~2.2–2.5 MB raw (~700–850 KB gzipped) because the page chunk
statically imports the heavy tabs.

---

## Detailed findings (see companion files)

1. **Bundle / code splitting** → [`bundle.md`](./bundle.md)
2. **Runtime rendering & React** → [`runtime.md`](./runtime.md)
3. **Startup, storage & data fetching** → [`startup.md`](./startup.md)
4. **Network, fonts & images** → [`assets.md`](./assets.md)
5. **Service worker / caching** → [`service-worker.md`](./service-worker.md)
6. **Prioritized action plan** → [`action-plan.md`](./action-plan.md)

## Deeper "what-if" analysis (requested follow-up)

- **Route-splitting architecture** → [`routing-architecture.md`](./routing-architecture.md)
  Turn each `activeTab` into a real Next.js route for per-route code splitting + deep-linking.
- **Cache every route after init** → [`caching-strategy.md`](./caching-strategy.md)
  Idle `router.prefetch()` + Serwist tuning so all routes are local/instant/offline after first paint.

---

## Quick wins (do these first)

- `next.config.mjs:56` — `images.unoptimized: true` + `layout.tsx:55` render-blocking font `<link>`.
- `Main.tsx:375` — `setTimeout(() => setIsLoading(false), 2400)` hard-coded 2.4 s splash.
- `Main.tsx:51` — `reloadAfterThemeChange()` full `location.reload()` on theme toggle.
- `Main.tsx:985` — `useMemo` for `cmds` with **no dependency array** (recomputes every render).
- `Main.tsx:22` + `demoData.json` (151 KB) — inlined into the main bundle.
- `Dashboard.tsx:1-72` — ~40 heavy tab components imported statically (recharts/xlsx/heat-map on the initial path).
