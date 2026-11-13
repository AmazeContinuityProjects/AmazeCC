---
title: "Static-Export Routing Quirks"
description: "GitHub Pages can't redirect or rewrite — so every URL in this app ends in / and every route ships as index.html inside a folder."
---

# 05 — Static-Export Routing Quirks

> **In one line:** GitHub Pages can't redirect or rewrite — so every URL in this app ends in `/`
> and every route ships as `index.html` inside a folder.
> **Reading time:** ~6 min.

## Rules of the road

1. **`trailingSlash: true`** (`next.config.mjs`) — canonical links always end in `/`. GitHub
   Pages happily serves `/ffcs/` from `out/ffcs/index.html`.
2. **Unknown paths** — Pages can't produce dynamic responses; it serves `404.html`
   (the build emits `not-found.tsx` as `404.html`). `not-found.tsx` echoes the requested path.
3. **No rewrites** — everything you see is a real file; directories _are_ pages.
4. **`basePath: ""`** — the site is the domain root (`amazecc.com/`), not a subpath. Don't
   hardcode absolute paths with a repo prefix; use `getAssetPath()`-style helpers already
   present for base-path safety.
5. **`_next/`** — chunks; immutable, hashed, never linked directly by hand.

## What about `/ffcs` without slash?

Pages returns a redirect to `/ffcs/` (directory index behavior) — our manifest and links use
the slashed form; the SW falls back to its own cached copy either way.

## Practical doc for teammates

- Never tell a student "go to `/ffcs`" — say "amazecc.com/ffcs" (browser adds slash).
- Any future route must be a folder with `page.tsx`; no `[param]` dynamic segments exist here.
- `out/` is not committed; `public/sw.js` is gitignored (see `08-pwa-platform/08-bundle-and-workers.md`).
