---
title: "Offline Strategy"
description: "the app _opens_ offline; it just doesn't know anything new happened. That's the honest contract."
---

# 03 — Offline Strategy

> **In one line:** the app _opens_ offline; it just doesn't know anything new happened. That's the honest contract.

## What renders with zero network, second visit

| Screen                 | Offline behavior                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Home shell             | renders instantly from PAGES_CACHE                                                          |
| Marks/attendance       | last synced values, "Updated N min ago" chip                                                |
| FFCS planner           | works fully; CSVs load from runtime cache (second visit onwards)                            |
| FFCS shared link view  | cannot be _decoded_ (needs the URL) — actually decodes client-side fully; works offline too |
| Hostel mess/laundry    | stale with label                                                                            |
| Search/palette         | works; registry is bundled                                                                  |
| VTOP-dependent screens | last cached, refresh disabled, banner shown                                                 |
| Payments / feedback    | will show last cache or nothing — fail honestly                                             |

## What _can't_ work

- Account actions, captcha, registration upload, PDF generation from remote data
- Push _registration_ (needs server round-trip) — already-subscribed pushes still display

## Diagnosis rules (for humans and bots)

- `navigator.onLine === false` → `isOfflineAtom` → banner + disables refresh
- `api("status")` fails while `navigator.onLine === true` → `isAPIworkingAtom` → same UI treatment
- `sync-session` shows VTOP-specific failures → banner variant with `vtopStatus` copy

## Freshness contract on resume

Resume → no auto-sync ever (boot-silent rule). Student taps Refresh — or full sync on mode
sellection — and only then network proceeds; offline app from cold start renders stale in `&lt;1s`.
