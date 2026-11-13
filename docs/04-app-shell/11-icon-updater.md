---
title: "IconUpdater (per-route identity)"
description: "the document head is swapped at runtime — /ffcs shows the FFCS icon and manifest; everywhere else, AmazeCC's own."
---

# 11 — IconUpdater (per-route identity)

> **In one line:** the document head is swapped at runtime — `/ffcs` shows the FFCS icon and
> manifest; everywhere else, AmazeCC's own.
> **Read:** `src/components/custom/IconUpdater.tsx`, `src/app/ffcs/layout.tsx`.

## What it mutates

- `<link rel="icon">` → `/favicon/FFCS.png` (route `/ffcs` only)
- `<link rel="manifest">` → `/ffcs-manifest.json`
- `<link rel="apple-touch-icon">` → FFCS variant
- Everything else → default AmazeCC set (baked into `<head>` by `app/layout.tsx`)

## Why not separate entry points

GitHub Pages serves plain files; runtime manifest swap gives us "Save to home screen" with the
right identity and zero duplicate builds. Cost: one effect on mount, one `location.pathname`
sniff — acceptable trade for two installable identities shipped by one app.

## Quiz

1. What's the SSR `<head>` of `/ffcs`, and what does `IconUpdater` change post-hydration?
2. What breaks if a student installs `/ffcs` before visiting `/ffcs/` (direct hit)?
