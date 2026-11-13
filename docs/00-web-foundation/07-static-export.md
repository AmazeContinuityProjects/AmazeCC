---
title: "Static Export (why there's no server)"
description: 'output: "export" means next build emits .html/.css/.js files and GitHub Pages serves them directly — every byte is baked in at build time.'
---

# 07 — Static Export (why there's no server)

> **In one line:** `output: "export"` means `next build` emits `.html/.css/.js` files and
> GitHub Pages serves them directly — every byte is baked in at build time.
> **Audience:** everyone. **Reading time:** ~8 min.

## The deal we struck

Normally Next.js can render pages on-demand on a server. We turned that off
(`next.config.mjs → output: "export"`). In exchange:

**Gained:** deploys are `git push` to GitHub Pages · no cold starts · no server bills · no
backend code in this repo (and nothing secret can leak from it) · instant rollbacks (revert).

**Lost:** anything that needs a server at request time — API routes, middleware redirects,
ISR revalidation, dynamic server rendering, set headers/cookies on the response,
`headers()` in `next.config.mjs` at runtime.

## What this forces onto the client

| Want                                     | Server way      | Our way                                                                                    |
| ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| Hide secrets                             | server env      | impossible — all env is public; secrets live in AmazeCC-API                                |
| Server-rendered HTML per user            | SSR             | impossible — HTML is identical for everyone; app hydrates after load                       |
| Middleware auth redirect                 | edge middleware | client gate (`AppHousing`/`HomeEntryController`)                                           |
| Correct `Content-Security-Policy` header | response header | `<meta httpEquiv="Content-Security-Policy">` in `layout.tsx` (no frame-ancestors possible) |
| 4xx statuses                             | server          | static export can't send real 404s; GitHub Pages serves `404.html`                         |

## Practical consequences for your code

1. **Everything network-related goes through `apiRequest()`** in `src/lib/sync-engine/request-layer.ts`
   (see `06-sync-engine/02-request-layer.md`) to `NEXT_PUBLIC_API_URL`. Fallback logic lives
   there too. Direct `fetch()` calls outside it are a code smell.
2. **No secrets in source.** Even `phc_…` PostHog token in the repo is a _public_ project
   token, not a credential — treat it accordingly.
3. **Search/SEO** — most meaningful pages are behind a client-side gate, so crawlers see the
   shell; `/ffcs` and `/friend-finder` are server-renderable pages with proper metadata.
4. **CSP is weaker** (no `frame-ancestors`, no nonces) — see `08-pwa-platform/07-csp.md`.
5. **`trailingSlash: true`** — every URL ends in `/`; GitHub Pages serves directory indexes
   (`/ffcs/` → `/ffcs/index.html`). Links elsewhere in the app should match this.

## Quiz

1. Name three things this app cannot do that a normal Next.js server could.
2. Where does the student's login cookie physically live — and why does that bound our design?
3. What is the one file that makes `/ffcs` different from `/`?
