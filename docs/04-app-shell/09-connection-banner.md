---
title: "Connection Banner (offline / VTOP-down)"
description: 'the one strip that says "the world is currently broken" — browser offline, API unreachable, or VTOP down — derived from a hybrid of navigator.onLine and a heartbeat.'
---

# Connection Banner (offline / VTOP-down)

> **In one line:** the one strip that says "the world is currently broken" — browser offline,
> API unreachable, or VTOP down — derived from a hybrid of `navigator.onLine` and a heartbeat.
> **Read:** `app/useAppNetworkStatus.ts`, `shared/ConnectionBanner.tsx`.

## Detection strategy

- `navigator.onLine` → instant offline flag (`isOfflineAtom`)
- `api("status")` ping (lightweight) → `isAPIworkingAtom` — detects "online but API dead"
- VTOP-level failures → atoms set from `sync-session` lines (VTOP-reported status) +
  `vtopStatus`/`vtopHealth` in lib; e.g., consecutive `401/timeout` mark "VTOP down" strip
- Demo mode → banner hidden entirely

## UX contract

- Offline → persistent strip; retries are student-initiated ("Retry")
- API reachable / VTOP flaky → soft amber; never blocks reading cached data
- Recovery → strip auto-dismisses on the first successful ping or sync

## Quiz

1. Why can't `navigator.onLine` alone be trusted for "API is up"?
2. Which atoms does the banner read, and who writes `isAPIworkingAtom`?
