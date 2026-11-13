---
title: "Network Calls Catalog"
---

# Network Calls Catalog

> **Method:** every call through `api(`, `apiRequest(`, `eventHubRequest(`, `fetch(` in `src/` — counted by `git grep -n -E "apiRequest\(|api\(\"|fetch\(" src/`.
> Auth column: who signs/credentials (v-flag = vtop flow). **All credentialed calls are POST + JSON.**

## By auth domain

| Auth     | Path pattern             | Caller (representative)               | Notes                             |
| -------- | ------------------------ | ------------------------------------- | --------------------------------- |
| vtop     | `/api/whoami`            | credential-manager→sync(whoami)       | cached `cache_whoami`             |
| vtop     | `/api/grades`            | ops (`grades`, `core` bundle)         | unified payload; unified adapter  |
| vtop     | `/api/attendance`        | ops (`attendanceMarks`)               | merged marks+attendance           |
| vtop     | `/api/marks/stats`       | ops (`marksStats`)                    | classIds ≤ 100                    |
| vtop     | `/api/ffcs`              | ops (`ffcs`, `core`), FeedbackModals  | the only legal `/api/ffcs` caller |
| vtop     | `/api/hostel`            | ops (`hostel`)                        | hosteller gated                   |
| vtop     | `/api/od`                | ops (`officialOd`)                    | OD records                        |
| vtop     | `/api/login`             | `syncEngine.login()`                  | captcha-heavy                     |
| eventhub | `/EventhubAPI/…`         | `eventhub.ts` helpers                 | jsessionid from instrumentation   |
| none     | `/api/fresher/resources` | `fresher op`                          | Worker-fronted, public            |
| none     | `WORKER/..*`             | mess/laundry fetchers                 | cached public                     |
| none     | CDN image URLs           | `vitfacService.ts`                    | faculty photos                    |
| none     | Koha OPAC HTTP           | `libraries/koha.ts`                   | VTOP-patron credentialed sections |
| none     | Supabase JS SDK          | push subscriptions — server-side only | never imported client-side        |

## By origin (not by auth)

`api.amazecc.com` (primary) → `amazecc-api-d402b5.rivendeploy.com` (backup failover) → `api-unicc.arya22.dev` (scoped, opt-out able).
Cloudflare Worker for `cache.*`, CDN for `cdn.*`. GA/PostHog/events to `shoot.amazecc.com`.

## What you must not do

- No direct `fetch()` in app code except SW registration, the CSVs preload, scanner pipeline (internal), and approved Worker public fetches
- No `X-` custom headers for VTOP auth — credentials travel in the JSON body only
- No retries outside `request-layer.ts` (it handles 429/5xx/timeout centrally)
