---
title: "The Build Pipeline"
description: "prebuild → next build --webpack → Serwist → prune-sw-precache.js → out/ — a static tree ready for GitHub Pages."
---

# The Build Pipeline

> **In one line:** `prebuild` → `next build --webpack` → Serwist → `prune-sw-precache.js` →
> `out/` — a static tree ready for GitHub Pages.
> **Reading time:** ~7 min. Verify: `package.json`, `next.config.mjs`, `.github/workflows/nextjs.yml`.

```
pnpm run build
  ├─ prebuild: node scripts/generate-build-info.js
  │     └─ writes src/data/buildInfo.json {buildNumber, commitHash, date, subjects}
  ├─ next build --webpack
  │     ├─ type-checks (no ignoreBuildErrors), lints via post-processing? (no — lint separately)
  │     ├─ Tailwind v4 compile (PostCSS), normalize imports, code-split with React.lazy boundaries
  │     ├─ inlines NEXT_PUBLIC_* from env/CI vars, bakes /_next/ hashed assets
  │     ├─ Serwist plugin compiles src/app/sw.ts → out/sw.js (dev: public/sw.js, gitignored)
  │     └─ emits static HTML: /index.html … /ffcs/index.html …
  └─ scripts/prune-sw-precache.js
        └─ rewrites out/sw.js — drops lazy JS chunks from precache (size cap for first install)
```

## The `out/` contract

- `index.html`, `ffcs/index.html`, `friend-finder/index.html`, `privacy/…`, `404.html`…
- `_next/static/chunks/*.js(.css)` — content-hashed, immutable-ish
- `sw.js` + precache manifest
- static assets from `public/`

## Cache battle, condensed

| Layer                    | TTL / policy                        | Managed by        |
| ------------------------ | ----------------------------------- | ----------------- |
| Browser HTTP cache       | server/Arch headers (Pages default) | GitHub Pages      |
| Service worker precache  | versioned per deploy                | `sw.ts` + pruning |
| Service worker runtime   | 30 days, capped entry counts        | `sw.ts`           |
| `localStorage` app cache | manual invalidation on sync/logout  | `storage.ts`      |

## Build determinism & CI

CI pins build-time env; `.next/cache` restored from GH cache; `--frozen-lockfile`. If two
commits differ only in docs, the bundle hash doesn't change (only `buildInfo.json` shifts —
which is the intended proof of freshness).

## Quiz

1. What does `prune-sw-precache.js` delete, and from which file?
2. Why does `buildInfo.json` exist and where is it shown?
3. Where do `NEXT_PUBLIC_API_URL` and friends end up in the output?
