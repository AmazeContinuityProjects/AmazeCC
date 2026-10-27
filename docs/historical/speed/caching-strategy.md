# Caching strategy (cache every route after the initial load)

Companion to `routing-architecture.md`. Assumes tabs become real routes and we want every route's
assets local after first paint, so navigation is instant and works offline. The app already uses
Serwist (`next.config.mjs:18-23`, `src/app/sw.ts`).

---

## 1. Two caching layers

| Layer | What | Mechanism |
|---|---|---|
| **Build-time precache** | App shell + home route chunks | Serwist `self.__SW_MANIFEST` (automatic) |
| **Runtime cache (warm after init)** | Every other route's JS/CSS + their data | `router.prefetch()` during idle + Serwist `defaultCache` (`cacheFirst`) |

We deliberately do **not** precache every route's HTML at SW *install* time (would bloat install and
delay activation). Instead we precache the shell, then **warm** the rest in the background.

---

## 2. Warm every route after init (client side)

Add to `AppProvider` (`app/(app)/layout.tsx`, see `routing-architecture.md` §3):

```ts
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = [
  "/", "/attendance", "/academics", "/tools", "/hostel", "/cabshare",
  "/dayscholar", "/transport", "/payments", "/libraries", "/more",
  "/profile", "/about",
];

function warmRoutes(router: ReturnType<typeof useRouter>) {
  const run = () => ROUTES.forEach((r) => {
    try { router.prefetch(r); } catch {}
  });
  // Prefetch after first idle; don't compete with initial render.
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 3000);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => { warmRoutes(router); }, [router]);
  // ...
}
```

Why this works:
- `router.prefetch(route)` downloads that route's JS chunk (and its RSC payload). With `output: 'export'`
  the payload is tiny; it's the JS chunk that matters.
- Serwist's `defaultCache` (`src/app/sw.ts:30`, from `@serwist/next/worker`) caches `_next/static/*`
  with `cacheFirst`. So the prefetched chunk is stored by the SW.
- First real navigation to a tab → chunk already local → instant, no network, offline-capable.

Prefetch cost is bounded: it runs once, on idle, and only fetches chunks the user hasn't visited yet
(visited routes are already cached by runtime caching).

---

## 3. Service worker tuning (`src/app/sw.ts`)

Current: `navigationPreload: false` (`:28`), `clientsClaim: false`/ `skipWaiting: false` (`:26-27`),
`cacheOnNavigation: false` (`next.config.mjs:19`).

Recommended changes:

1. **`navigationPreload: true`** (`sw.ts:28`). Lets the SW preload the navigation request in parallel
   with the `fetch` event → faster FCP on repeat visits. Requires the server to send
   `Service-Worker-Navigation-Preload` aware responses (static export does; safe to enable).

2. **Keep `cacheOnNavigation: false`** in `next.config.mjs`. We do *not* want every route HTML in the
   precache list at install. The idle `router.prefetch` + runtime cache covers it. (If you prefer true
   offline deep-linking of *every* route from a cold start, flip this to `true` — but accept a larger
   SW install.)

3. **Add a navigation fallback that serves cached HTML when offline.** Extend `fallbacks.entries`
   (`sw.ts:31-40`) with a matcher that returns the cached route HTML for `request.destination ===
   "document"` when the network fails — so a deep-linked `/attendance` opened offline still renders
   from cache. Serwist already caches navigations at runtime via `defaultCache`; this just guarantees a
   document fallback instead of the generic `/~offline/`.

4. **`clientsClaim: true` + `skipWaiting: true`** (or a "new version available" prompt). Today
   (`sw.ts:26-27`) a new build waits for all tabs to close before activating, so users keep the slow
   old bundle. Claiming clients makes optimized chunks take effect sooner. Pair with the `reloadAfter`
   banner if you want an explicit prompt instead of an implicit reload.

5. **Verify `_next/static` is `cacheFirst` with a long max-age.** The default Serwist `defaultCache`
   already does this; confirm in the built `public/sw.js` that JS/CSS chunks get `cacheFirst` (they
   should, since they are content-hashed and immutable).

---

## 4. Data caching (so routes are useful offline)

Route chunks being cached is only half the story — the *data* must also be available. It already is:
data lives in global Jotai atoms hydrated from `localStorage` (`Main.tsx:316-376`, `storage.ts`). So a
prefetched, cached `/attendance` route, opened offline, will render from the `localStorage` cache just
like today. No extra work needed beyond what `startup.md` already recommends (centralize hydration,
debounce writes).

Optional: also cache API responses in the SW (they are `POST` to `API_BASE`, currently *not* cached by
`defaultCache` which targets GET). Not required for the "feels fast" goal — login/reload is inherently
online; only the cached view needs to be instant.

---

## 5. Resulting cache lifecycle

1. Cold start → SW precaches shell + home chunk. Home paints fast (also helped by `next/font` + removed
   2.4 s splash).
2. Idle → `warmRoutes()` prefetches all other route chunks; Serwist caches them.
3. User clicks any tab → client nav, chunk already local → instant.
4. Repeat visit / offline → SW serves cached chunks + `localStorage` data → app usable immediately.

---

## 6. Risks

- **Stale chunks after deploy:** mitigated by `clientsClaim/skipWaiting` (§3.4) + Serwist's content-hashed
  filenames (new hash ⇒ new cache entry; old evicted).
- **Prefetch competing with first interaction:** guarded by `requestIdleCallback` + `timeout`.
- **Larger SW install if `cacheOnNavigation` flipped:** only if you choose offline deep-link of *all*
  routes from cold start; default recommendation keeps it `false`.
