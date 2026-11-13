---
title: "PWA & Service Workers"
description: "a service worker is a background script that intercepts network requests and answers from cache when offline — that's how AmazeCC opens on campus Wi-Fi that hates you."
---

# 10 — PWA & Service Workers

> **In one line:** a service worker is a background script that intercepts network requests and
> answers from cache when offline — that's how AmazeCC opens on campus Wi-Fi that hates you.
> **Audience:** everyone. **Reading time:** ~9 min.

## The three pieces of a PWA

1. **Manifest** (`public/manifest.json` + friends) — tells the OS about icons, name, colors,
   share targets (`share_target` for `/share/ffcs`), and `display: standalone` (no browser chrome).
2. **Icons + start URL** — what "Add to Home Screen" installs.
3. **Service worker** (`src/app/sw.ts` → built to `out/sw.js`) — the offline brain.

## The lifecycle you must understand

```
install → (precache the shell) → activate → intercept fetches → update (new SW found)
```

- **Precache** = files fetched once at install: the HTML shell, runtime JS chunks marked
  critical, CSS, fonts. AmazeCC precaches **no** images/JSON/CSVs (~10 MB would ride along) —
  they're runtime-cached on demand with generous staleness windows instead.
- **Runtime cache tiers** in `sw.ts`: pages = NetworkFirst (fresh if online, cached if not),
  static JS/CSS = StaleWhileRevalidate / CacheFirst with TTLs (30 days max-age), all caps on
  entry count. Two `PERSISTENT` caches survive SW restarts.
- **`/~offline/`** — the fallback page served when the network is down _and_ nothing is cached.
- **Updates** — `skipWaiting` + `clients.claim()` apply the new SW immediately; stale HTML can
  still reference renamed chunks → `chunkRecovery.ts` detects this and purges + reloads once.
- **Push** — SW handles `push` events → `showNotification`; VAPID public key in env, subscriptions
  held server-side in Supabase (`sql/supabase_setup.sql`).

## How to observe it

Chrome DevTools → Application → Service Workers / Storage. Or:

```js
navigator.serviceWorker.getRegistration().then((r) => console.log(r?.active?.state));
```

If changes you deployed don't show up, check: registry scope (`/`), `updateViaCache: "none"`
in `ServiceWorkerRegistrar`, and whether the browser actually got your new `sw.js`.

## Quiz

1. Why are CSVs not in the precache even though the FFCS planner needs one?
2. What does a student see when they open the app on airplane mode after using it yesterday?
   And a brand-new browser that's never been online?
3. What failure mode does `chunkRecovery.ts` exist for?
