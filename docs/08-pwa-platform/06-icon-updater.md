---
title: "Icon Updater (per-route identity)"
description: '/ffcs becomes "FFCS — AmazeCC" with FFCS icons, everyone else gets AmazeCC''s — at runtime, on route mount.'
---

# 06 — Icon Updater (per-route identity)

> **In one line:** `/ffcs` becomes "FFCS — AmazeCC" with FFCS icons, everyone else gets AmazeCC's — at runtime, on route mount.
> **Read:** `src/components/custom/IconUpdater.tsx`, `src/app/ffcs/layout.tsx`.

## Mechanism summary

`useEffect` on mount → `window.location.pathname` starts with `/ffcs`?
yes → swap `<link rel="icon">`, `apple-touch-icon`, `manifest` to
`/favicon/FFCS.png` / `/ffcs-manifest.json`
no → leave root layout's head untouched (main-app set baked into `out/`)

## Why this approach

GitHub Pages is folder-based — no route-specific `_headers` to swap icons per request.
Runtime swap keeps one build hosting both identities; the FFCS route fires
`<PreloadReportCsv>` in parallel for the fast-first-week experience.

## The contract with `layout.tsx`

Root layout already emits the default set + CSP meta; IconUpdater is **additive**
(idempotent `appendChild` markers) — no duplicate nodes across navigations.

## Quiz

1. Why doesn't the FFCS route just ship a different `<head>` static file? (Probably can't ship two static roots cheaply — and the planner is one route).
2. What bytes swap, and what bytes never do?
