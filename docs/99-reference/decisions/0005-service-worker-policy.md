---
title: "ADR-0005: Service Worker Policy (no asset precache)"
---

# ADR-0005: Service Worker Policy (no asset precache)

**Status:** accepted
**Context:** campus networks metered and slow; precaching MBs of CSVs/images blew up first-load installs.
**Decision:** precache only the app shell (HTML/JS/CSS, no images/data); runtime caching with generous TTLs (30 days) and capped entries; NetworkFirst for documents; `/~offline` fallback; skipWaiting + clientsClaim.
**Consequences:** first visit must be online; later visits instant; CSVs maybe one second late on metered networks.
**Revisit when:** VIT publishes real 4G coverage across campus — unlikely to change the calculus.
