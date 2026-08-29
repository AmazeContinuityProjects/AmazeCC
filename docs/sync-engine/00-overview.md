# Sync Engine — Overview

## Goal
Replace the current fragmented, copy-pasted sync code with a **single, unified `SyncEngine`**.
After this work, **no component may import `API_BASE`, call `fetch`/`fetchWithTimeout` against the API, or call `loginToVTOP`/`loginToEventHub` directly.** Every network request and every login flows through the engine, which owns credentials, coalescing, backoff, persistence, and state updates.

## Why (the problems today)
1. **Sync is everywhere.** The "real" sync lives in `Main.tsx` (`handleLogin`, `handleReloadRequest`, `fetchTransportData`) and `src/lib/data-fetchers.ts`, but **25+ components** also hit the API directly (`fetch(\`${API_BASE}/api/...\`)`) and call `loginToVTOP()`/`loginToEventHub()` on mount. See `01-current-state.md`.
2. **Duplicate login managers.** `auth.ts` (VTOP) and `event-hub.ts` (EventHub) each re-implement caching + single-in-flight promise + a fragile `finally`-reset. Easy to get wrong; already caused the "wrong password keeps hammering VTOP" bug.
3. **No real backoff / give-up.** On bad credentials the app keeps firing `/api/login`. VTOP sees many attempts → account lockout. (We added a one-shot `failedLogin` cache in `auth.ts`, but it is not generalized and components still call login individually.)
4. **State written from many places.** `storage`, `Main.tsx` `useState`, and `dataAtoms.ts` atoms are all written ad-hoc by whoever fetched. No single source of truth → inconsistent UI, double-fetching.
5. **Hard to track / maintain.** Adding a new data type means editing the component *and* `Main.tsx` *and* `data-fetchers.ts` *and* the atom. Bug fixes (e.g. give-up logic) must be repeated per call site.

## Target architecture (at a glance)
```
Component / Hook
      │  (reads state, triggers sync by name — never fetches)
      ▼
  useSync()  ──────────────►  SyncEngine  (singleton)
                                  │
              ┌───────────────────┼───────────────────────┐
              ▼                   ▼                        ▼
        CredentialManager    RequestLayer            OperationRegistry
        (VTOP + EventHub     (single fetch wrapper,  (typed sync ops:
         login, give-up,      dedup/coalesce,        attendance, core,
         backoff, edit)       failover, timeout,     events, grades,
                                 retry/backoff)        library, payments…)
              │                                           │
              └───────────────┬───────────────────────────┘
                              ▼
                   StateBridge  →  writes storage (persist) + atoms (UI)
                              ▼
                   ProgressBus  →  UI (message + progress %)
```

## Design principles
- **One chokepoint for requests.** `RequestLayer.request(path, body, opts)` is the *only* function that performs a network call. Every operation uses it.
- **One owner of credentials.** `CredentialManager` holds VTOP + EventHub sessions, the give-up cache, and backoff timers. Nothing else touches `storage.ids`/`password`.
- **Operations, not ad-hoc fetches.** Each data type is one registered operation with: name, required auth, persistence key(s), atom(s) to update, and a fetcher. Components ask for `sync('payments')`, not `fetch(...)`.
- **Engine owns the store.** Operations write to `storage` + atoms via `StateBridge`. Components subscribe to atoms; they never receive raw fetch results.
- **Fail safe, not fail loud.** Auth failure → give up + notify user once; transient failure → bounded retry with backoff; no infinite loops.
- **Migrate incrementally.** The engine is built behind the existing call sites first (centralize), then components are cut over one domain at a time. See `04-migration-plan.md`.

## Deliverables (this effort)
- `src/lib/sync-engine/` — the engine (CredentialManager, RequestLayer, OperationRegistry, StateBridge, ProgressBus, types).
- `src/hooks/useSync.ts` — the only public surface components use.
- A **"Edit credentials"** flow (`05-credential-editor.md`) so a wrong password can be corrected in-app without re-hammering VTOP.
- Lint guard: ban `API_BASE`/`fetch` against the API and `loginToVTOP`/`loginToEventHub` outside the engine.

See the other files in this folder for details.
