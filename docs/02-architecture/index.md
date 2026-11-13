---
title: "Architecture"
description: "a static PWA shell in your browser, a plain-files host on the internet, and a separate scraping backend that does all the dangerous reading of VIT's systems."
---

# 02 — Architecture

> **In one line:** a static PWA shell in your browser, a plain-files host on the internet, and a
> separate scraping backend that does all the dangerous reading of VIT's systems.

Read this section after the primer — it assumes `fetch`, CI, layouts, and vaults make sense
to you already.

## The five-minute version

```
Browser (GitHub Pages CDN, static files)
   │  HTML/CSS/JS, service worker, IndexedDB vault
   ▼
HTTPS ──► AmazeCC-API (api.amazecc.com) ──► VTOP (vtopcc.vit.ac.in)   ← scraped, never embedded
   │            │            │
   │            ├── Supabase (Postgres: push subs, cohort marks, social tables)
   │            ├── B2 / CDN (uploads: receipts, paper uploads)
   │            └── captcha solver (VIT login challenge)
   ▼
Cloudflare Worker (cache.amazecc.com)  ← public, cacheable, credential-free data only
Cloudflare CDN    (cdn.amazecc.com)    ← images in front of Supabase/WordPress storage
```

**Read next:** [01-runtime-topology](01-runtime-topology.md) → [02-the-one-page-app](02-the-one-page-app.md)
→ [03-data-flow-end-to-end](03-data-flow-end-to-end.md). Then [08-directory-map](08-directory-map.md)
when you want to go spelunking, and [09-design-system](09-design-system.md) before touching UI.

## Section map

- **01-runtime-topology** — who talks to whom, in what language, with which credentials
- **02-the-one-page-app** — why there's one URL for the app and what "tab routing" replaces
- **03-data-flow-end-to-end** — a single button press, traced through sync, atoms and pixels
- **04-offline-and-the-pwa** — what the service worker does when the network dies
- **05-build-pipeline** — next build → Serwist → prune step → `out/`
- **06-error-handling** — error boundaries, chunk recovery, PostHog; the failure taxonomy
- **07-state-management-map** — every atom, grouped by domain, with writers/readers
- **08-directory-map** — annotated repository tree with line counts
- **09-design-system** — Tailwind v4 dialect, zinc palette, amazeui relationship, tokens
- **10-configuration-catalog** — every root config file, decoded

## The three sentences the architecture exists to serve

1. **The student clicks "Refresh" and never sees a spinner she can't cancel.**
2. **The student's VTOP password never reaches infrastructure we control.**
3. **The app opens instantly on campus Wi-Fi and readable-ish in a tunnel.**

Everything — demo mode, the sync engine, the service worker, the vault, static export — is an
answer to one of those.
