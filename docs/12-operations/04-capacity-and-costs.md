---
title: "Capacity & What Breaks First"
description: "VTOP is the bottleneck, always — not our infra, not PostHog, not Pages."
---

# Capacity & What Breaks First

> **In one line:** VTOP is the bottleneck, always — not our infra, not PostHog, not Pages.

- **VTOP scrape budget**: AmazeCC-API does captcha-solved logins; VIT allows N/min before human review queues. The sync engine's backoff exists because of this — honor it
- **Cache architecture**: the Worker absorb caches public data; the app caches private data in localStorage — both exist to keep VTOP loads below the "examine human" threshold
- **Pages bandwidth**: ~3 MB first paint + SW; viral moments (result day) are absorbed by Cloudflare, not us
- **Supabase**: small relational tables (tokens, cohort stats) — cached server-side; scales fine
