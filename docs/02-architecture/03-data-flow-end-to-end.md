---
title: "Data Flow, End to End"
description: "a button press → sync engine → AmazeCC-API → VTOP → atoms + storage → React re-render. If you can't trace this, you can't fix anything real in this app."
---

# 03 — Data Flow, End to End

> **In one line:** a button press → sync engine → AmazeCC-API → VTOP → atoms + storage →
> React re-render. If you can't trace this, you can't fix anything real in this app.
> **Prereqs:** 02-the-one-page-app · **Reading time:** ~12 min.

## The example: "Attendance & marks" refresh

```
Student taps the Refresh icon (NavigationTabs → handleReloadRequest)
 │
 1. useAppDataActions.ts  → opens sync sheet ("Quick Sync")
 │
 2. syncEngine.syncMode("quick")
 │     ├─ attendanceMarks op ──► apiRequest("attendance", {semesterId}, {auth:"vtop"})
 │     │       └─► request-layer: attach creds (from credential-manager), dedupe, fetch
 │     └─ marksStats op (background-ish) ──► same machinery
 │
 3. AmazeCC-API scrapes VTOP, returns JSON
 │
 4. state-bridge: setAtom(attendanceDataAtom…) + storage.ts.persist("attendance", …)
 │     └─► messageAtom gets "Sync complete" line; LastSynced atom updated
 │
 5. React subscribed screens re-render (attendance calendar, marks table)
```

Every arrow is grounded in a file you can open: `sync-engine/index.ts` (mode runner),
`sync-engine/request-layer.ts` (fetch), `sync-engine/operations.ts` (the `attendanceMarks`
op), `sync-engine/state-bridge.ts` (atoms+storage publish), `storage.ts` (persistence).

## The two write targets, always together

| Target                              | Why both                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| **atoms**                           | immediate re-render of the current session                        |
| **localStorage** (via `storage.ts`) | survives tab close; rehydrated by `useAppBootstrap` on next mount |

Skip atoms → UI lies until refresh. Skip storage → refresh loses everything; user thinks sync
didn't work.

## Reads vs writes — the asymmetry

- **Writes are rare**: only explicit syncs/logins.
- **Reads are constant**: every render reads atoms; skeletons fill gaps.
- **The FFCS catalog CSVs** are fetched as static assets (`public/ffcs/*.csv`) — no API, no
  credentials, just bytes; `parseReportRows` parses them client-side (~230 KB each).
- **Share links** carry the whole timetable in the `d=` query param (lz-string compressed) —
  the only design where the server holds _no_ data at all.

## Where caches drown

Read this once: `cache_whoami`, `cache_registration_schedule`, `cache_ffcs_feedback`,
`frozen_marks_*`, `marksFrozenV1`, `sync_queue_*`, `localStorage` keys — enumerated in
`07-data-layer/03-local-storage-key-catalog.md` and `08-caches-and-ttl.md`. Every one of them
was invented by a specific bug report; don't tidy them away.

## Quiz

1. Name every file touched, in order, when the student taps "Sign in" (not Refresh).
2. Why does the sync engine write to _both_ atoms and storage, and what breaks either way?
3. Which CSVs does the app fetch with plain `fetch()` and why are they not in precache?
