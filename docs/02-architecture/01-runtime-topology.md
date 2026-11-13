---
title: "Runtime Topology"
description: "three worlds — the browser (ours to ship), the static host (ours to deploy), and the backend (theirs to host) — connected by HTTPS and JSON."
---

# Runtime Topology

> **In one line:** three worlds — the browser (ours to ship), the static host (ours to deploy),
> and the backend (theirs to host) — connected by HTTPS and JSON.
> **Prereqs:** primer pages 01, 07, 08. **Reading time:** ~10 min.

## The diagram, annotated

```
┌────────────────────────── BROWSER (student's device) ──────────────────────────┐
│  Web pages (/, /ffcs, …) — React 19 client components                          │
│  jotai atoms (UI state)   localStorage (cache + demoMode)   IndexedDB (vault)  │
│  Service Worker (Serwist) — offline page, precache, push listener              │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   │ HTTPS, JSON, one credential set in body
                                   ▼
┌───────────────────── CRANES — api.amazecc.com (AmazeCC-API) ───────────────────┐
│  Next.js API routes — the ONLY place VTOP is read                              │
│  captcha solving, cheerio scraping, Supabase (social, marks cohort stats),     │
│  B2 (file storage), HMAC minting for marks receipts & PostHog identity-hash    │
└────────────────┬───────────────────────────────────────────────┬──────────────┘
                 │ scrape                                         │ SQL/objects
                 ▼                                                ▼
        vtopcc.vit.ac.in                                 Supabase / Backblaze B2

Static assets (this repo, built to out/) — served by GitHub Pages via CNAME amazecc.com
Public cache data — cache.amazecc.com (Cloudflare Worker, credential-free)
Media — cdn.amazecc.com (Cloudflare in front of Supabase/WordPress WordPress storage)
```

## Who is trusted with what

| Layer                     | Trust boundary                                   | Why                                                                                             |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Browser                   | hostile co-tenancy (extensions, other tabs, XSS) | nothing secret exists here; vault is defense-in-depth                                           |
| GitHub Pages / CDN        | public bytes only                                | integrity via SRI-ish build determinism, not secrecy                                            |
| AmazeCC-API               | **full trust** — sees everything                 | it must (it logs into VTOP for you); hence rate-limiting, logging hygiene, separate repo review |
| VTOP                      | untrusted flavor of the week                     | every scraper has brittleness; failures are reported, never hidden                              |
| UniCC (optional fallback) | third-party; scoped allowlist only               | documented compromise — see `11-security/03-unicc-third-party-data-flow.md`                     |

## Request lifecycle (annotated)

```
a student's "Sign in" click
 → sync-engine.login(IDs)                     (useAppDataActions.ts)
 → credential-manager.loginVtop()             (in-flight captcha, backoff on lockout)
 → POST /api/login                            (AmazeCC-API; returns cookies/csrf/authorizedID)
 → jotai authorizedIDAtom + in-memory session (NOT persisted)
 → core sync: attendanceMarks → core (grades/schedule/hostel/calendar) → studentProfile
 → state-bridge: atoms + storage.ts publish results
 → React re-renders screens subscribed to those atoms
```

## What failure looks like

- **VTOP down** → API 502/timeouts → engine marks failure, banner + retry line; app still
  opens (cached).
- **API down** → nothing new loads; offline shell renders stale cache; `ConnectionBanner`.
- **SW stale** → rare broken chunk after deploy; `chunkRecovery.ts` purges+reloads once.

## Quiz

1. Which component of the topology would a security reviewer be most interested in, and why?
2. Why does the browser hold the only copy of the vault key?
3. What happens on this page if UniCC is down?
