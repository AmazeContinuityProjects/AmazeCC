---
title: "The Cloudflare Worker (cache.amazecc.com)"
description: "pre-computed, public, credential-free data served from the edge — buses, laundry, mess menus, changelog, faculty roster — with cache lifetimes the app never has to think about."
---

# 10 — The Cloudflare Worker (cache.amazecc.com)

> **In one line:** pre-computed, public, credential-free data served from the edge — buses,
> laundry, mess menus, changelog, faculty roster — with cache lifetimes the app never has to think about.

## Current routes (as seen from this repo — verify in Worker repo)

| Path                 | Content                                                        |
| -------------------- | -------------------------------------------------------------- |
| `/transport/buses`   | dayscholar bus routes fixture (static snapshot)                |
| `/fresher/resources` | onboarding resource links                                      |
| `/changelog`         | recent changelog entries for the About screen                  |
| `/mess/*`            | mess menus per canteen/meal/day (small JSON)                   |
| `/laundry/*`         | laundry slot tables                                            |
| `/faculty-roster`    | VIT Chennai faculty (photos, names) — for FFCS avatars/reviews |

## Access pattern

Any component that needs public data fetches Worker URLs directly (`WORKER_BASE`), never the
VTOP API. Failure mode: stale cache forever (fine) or bare-bones fallback bundled with the app
where present (e.g. fresher resources).

## Why not the API

The API exists to scrape VTOP with credentials. Public cache data doesn't need auth and benefits
from CDN TTLs — keeping it there avoids VTOP pool contention and halves the API's request load.

## Quiz

1. What kinds of data are _never_ allowed on the Worker?
2. What happens on campus Wi-Fi when the Worker is unreachable?
