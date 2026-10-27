# Service worker & caching

**Severity: LOW-MEDIUM** — affects repeat-visit speed and offline behavior.

## Current setup

- Serwist wraps the build (`next.config.mjs:18-23`), `swSrc: "src/app/sw.ts"`, `cacheOnNavigation: false`.
- `src/app/sw.ts` precaches `self.__SW_MANIFEST`, uses `defaultCache` runtime caching, registers a
  push handler, and a `/~offline/` document fallback.
- `navigationPreload: false` (`sw.ts:28`); `clientsClaim: false` (`sw.ts:27`).

## Observations

1. **`cacheOnNavigation: false`** (`next.config.mjs:19`) means the app-shell HTML navigation request is
   **not** precached. On repeat visits the SW must fetch `/` from the network before serving the cached
   JS chunks. For a static export this is usually fast, but enabling navigation precache would make
   repeat loads instant and improve offline launch.

2. **`clientsClaim: false` + `skipWaiting: false`** means a new SW waits for all clients to close before
   activating. After a deploy, returning users keep running the old bundle until they fully close the
   tab — not a speed bug, but it delays cache refreshes.

3. The runtime caching `defaultCache` from `@serwist/next/worker` is reasonable (cache-first for
   static assets). Verify it actually caches the large `page-*.js`/vendor chunks with a long max-age so
   repeat visits skip the network.

## Recommendations

1. Set `cacheOnNavigation: true` (or add an explicit navigation route precache) so the HTML shell is
   available offline/instant on repeat visits.
2. Consider `clientsClaim: true` + `skipWaiting: true` pair (or a "new version available" prompt) so
   users pick up optimized bundles sooner.
3. Confirm Serwist precache includes the big vendor chunks; if they are split correctly after the
   code-splitting work (see `bundle.md`), the cached set shrinks automatically.
