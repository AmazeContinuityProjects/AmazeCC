# 01 — The Service Worker (`src/app/sw.ts`)

> **In one line:** caches the shell for offline, never precaches assets the student may never open, always yields to the network for pages.

## What the SW owns

- **Install**: fetches precache manifest entries (shell HTML, runtime JS chunks, CSS)
- **Activate**: `clients.claim()`, `skipWaiting()` — new SW takes over immediately
- **Fetch**: routes by `destination` — document (NetworkFirst, PAGES_CACHE 30d TTL), script/style
  (JSB — CacheFirst static, SWR css/js), image/etc (**NetworkAfter-filter — NOT precached at all**)
- **Fallback**: `/~offline/` for any document request that fails all caches
- **Push**: `push` event → `showNotification` with icon/badge, `tag` for dedupe
- **Notification click**: focuses existing window or `openWindow(url)`
- **precache concurrency**: 10; caps per cache: 64/48/32 entries

## What it deliberately doesn't do

- No background-synced queues (VIT scraping from a SW is fragile & unsavory)
- No asset precache (CSVs, images, fonts) — runtime cache with staleness instead
- No HTML push of course lists — notifications only

## Rebuilding the SW

Generated at build time (`SERWIST` plugin) — never edit `out/sw.js` or `public/sw.js` by hand.
`prune-sw-precache.js` strips unused lazy chunks from the manifest post-build. If you add a
route that must work offline, it must be in precache or explicitly runtime-cached — both are
review-worthy changes.

## Testing it

DevTools → Application → Service Workers → Unregister + hard refresh. `ServiceWorkerRegistrar.tsx`
(updateViaCache:"none") forces checks per boot. The SW health is also asserted in build output
(`prune` step logs precache list size).
