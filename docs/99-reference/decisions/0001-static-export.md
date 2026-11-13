---
title: "ADR-0001: Ship a Static Export, Not a Server"
---

# ADR-0001: Ship a Static Export, Not a Server

**Status:** accepted (since first deploy)
**Context:** Next.js can run as a server, but we have no secret per-user rendering need, we do not hold user data, and operating a server would add cost, latency, and an attack surface.
**Decision:** `output: "export"` — plain HTML/CSS/JS on GitHub Pages via CNAME. No SSR, no API routes, no middleware.
**Consequences:** no server to keep secrets; auth must be client-side; CSP becomes <meta>; 404.html custom only; rollbacks are git reverts; every deploy serves every user the identical bundle.
**Revisit when:** someone must run server-side logic per user (never happened — AmazeCC-API does exactly that job).
