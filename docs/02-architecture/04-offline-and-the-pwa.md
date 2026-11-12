# 04 — Offline & the PWA Shell

> **In one line:** the service worker is the bouncer — it serves yesterday's shell instantly
> and apologizes with `/~offline/` when there's nothing to serve.
> **Prereqs:** 00-web-foundation/10 · **Reading time:** ~8 min.

## What works when the network is dead

| Feature                | Offline after first visit                                                                      | Offline brand-new browser                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Home shell loads       | ✅ (NetworkFirst from PAGES_CACHE)                                                             | ❌ (needs one online visit)                  |
| Attendance marks shown | ✅ last synced cache                                                                           | ❌                                           |
| FFCS planner           | ✅ fully offline (CSVs bundled in precache exclusions → runtime-cached on first use… see note) | partial — CSVs runtime-cache needs one visit |
| Sync (any new data)    | ❌ — no network, no VTOP                                                                       | ❌                                           |
| `/~offline/` fallback  | ✅                                                                                             | ✅                                           |

Note the FFCS CSV precache situation: `sw.ts` excludes **all** CSV/JSON/images from
precache; FFCS CSVs are cached **on demand** at runtime with long staleness — so the _second_
visit works offline, the first never does.

## The caches (from `src/app/sw.ts`)

- **precache manifest** — the app shell; concurrency 10; `skipWaiting`, `clientsClaim`
- **PAGES_CACHE** (`*.html`, NetworkFirst, 30-day TTL)
- **STATIC_CHUNKS** (`/_next/static/**/*.js`, CacheFirst, TTL)
- **STATIC_CSS** (js/css StaleWhileRevalidate)
- all caps on entry count (`maxEntries` 32–64) — phones are finite

## Boot pre-paint

`layout.tsx` inlines a script reading `localStorage` (`IDs`, `username`, `demoMode`,
`cred_vault_session`) and tagging `<html class="has-stored-session">`. CSS keys off this to
skip the guest landing flash. That's why no flash-of-landing — and why SSR markup must match.

## The offline contract (user-visible)

1. Open the app from home screen → shell from cache in <1 s.
2. Any network-dependent screen shows **last synced** data with an "Updated N min ago" badge
   (`LastSynced.tsx`) or an offline banner (`ConnectionBanner`).
3. Operations that need network are disabled/queued accordingly (sheet shows "offline").

## Quiz

1. Why can't a fresh offline browser open `/ffcs` and see the planner?
2. What does `skipWaiting` + `clientsClaim` accomplish, and what risk does it create?
3. Where does the app show the "you're seeing old data" badge?
