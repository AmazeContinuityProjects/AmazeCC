---
title: "Sync Engine Overview"
description: 'a small engine (src/lib/sync-engine/) that turns "fetch VTOP stuff" into typed, retryable, observable operations with one output shape: atoms + localStorage.'
---

# Sync Engine Overview

> **In one line:** a small engine (`src/lib/sync-engine/`) that turns "fetch VTOP stuff" into
> typed, retryable, observable operations with one output shape: atoms + localStorage.

## The problem it solves

Before the engine, every screen did its own `fetch("/api/attendance", …)` — different headers,
no dedupe, three retry policies, and you had to open Chrome DevTools to know why anything
worked. The engine centralizes:

- **Credentials** — one place owns the 10-minute VTOP session (and refreshes it when stale)
- **Requests** — one `apiRequest()` path: auth attach, dedupe, retry, timeout, cancellation
- **Operations** — named, declared units ("attendanceMarks", "grades") with meta (cost, auth, label)
- **Publication** — atoms + localStorage caches via `state-bridge` — no screen writes them
- **Observability** — every op emits `start/done/error` progress events; the sync sheet consumes them

## What it explicitly does **not** do

- Talk to Supabase, B2, Koha, or CDN directly — those go through their own helpers (exceptions:
  cached public data via Worker fetches with clear provenance).
- Decide _policy_ about what's stale — screens choose to call `LastSynced`/refresh themselves.
- Render anything — UI lives in `shared/SyncNotification.tsx` and `SyncSessionHost.tsx`.

## File map

| File                                  | Role                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `index.ts`                            | `SyncEngine` class: `sync`, `syncMode`, `syncAll`, `login`, `logout`, re-exports |
| `operation-registry.ts`               | `registerOp`, `getOp`, `allOps` — how ops exist                                  |
| `operations.ts`                       | pays the bills — every op's implementation (~1,170 lines)                        |
| `request-layer.ts`                    | `apiRequest`: the only fetch in app code                                         |
| `credential-manager.ts` / `errors.ts` | session ownership & failure typing                                               |
| `sync-modes.ts`                       | preset modes + custom mode CRUD                                                  |
| `sync-session.ts`                     | the sheet's session store                                                        |
| `state-bridge.ts`                     | writes to atoms (and storage caches)                                             |
| `progress-bus.ts`                     | pub/sub for engine events                                                        |
| `single-sync.ts`                      | `runPageSync` — every feature-screen reload goes through this                    |
| `useSync.ts`                          | public React hook surface                                                        |

## The one-sentence model

**Ops are sentences; modes are paragraphs; the sheet is the reading glasses.**
You can't `await fetch(...)` anything VTOP-shaped — you `syncEngine.sync("attendanceMarks", …)`.
