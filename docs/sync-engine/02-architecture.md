# Sync Engine — Architecture

Location: `src/lib/sync-engine/`. A singleton instance is exported as `syncEngine`.

```
sync-engine/
  index.ts            # SyncEngine singleton; public methods (login, sync, syncAll, logout, editCredentials)
  types.ts            # Creds, SyncOp, SyncStatus, ProgressEvent, EngineError
  credential-manager.ts   # VTOP + EventHub sessions, give-up cache, backoff, editCredentials
  request-layer.ts    # request(path, body, opts) — ONLY network call; dedup, failover, timeout, retry/backoff
  operation-registry.ts  # registered sync operations (name → fetcher + persist keys + atoms)
  operations/         # one file per domain: attendance.ts, core.ts, events.ts, library.ts, payments.ts, profile.ts, academic.ts, misc.ts
  state-bridge.ts     # writes storage + atoms; single source of truth
  progress-bus.ts     # pub/sub for message + progress % (UI subscribes)
  errors.ts           # typed errors: AuthError, TransientError, NotFoundError, AbortedError
```

Components never import `API_BASE`, `fetch`, `fetchWithTimeout`, `loginToVTOP`, or `loginToEventHub`. They use `useSync()`.

## 1. RequestLayer (`request-layer.ts`)
The **only** function that performs a network request. Wraps `fetchWithTimeout` + the existing `fetchWithFailover`.

```ts
request(path: string, body?: unknown, opts?: {
  method?: "GET" | "POST";
  auth?: "vtop" | "eventhub" | "none";   // attaches the right session cookie
  signal?: AbortSignal;
  timeoutMs?: number;
  dedupeKey?: string;                     // coalesce concurrent identical calls
  retry?: { max?: number; baseMs?: number };
}): Promise<ApiResponse>
```

Responsibilities:
- **Single in-flight dedup**: identical `dedupeKey` (default = `method+path+hash(body)`) shares one promise. Prevents the "4× loginToVTOP + per-tab login" burst.
- **Failover + timeout**: reuses current `fetchWithFailover`/`fetchWithTimeout`.
- **Bounded retry with backoff**: transient (`502/503/504`, network, timeout, `AbortError` not user-aborted) retries up to `max` (default 2) with exponential backoff. **Auth failures are never retried here** — they surface to CredentialManager.
- Never throws raw `Response`; normalizes to `ApiResponse { ok, status, json }` or a typed `EngineError`.

## 2. CredentialManager (`credential-manager.ts`)
Owns all sessions and the give-up logic (supersedes `auth.ts` + `event-hub.ts`).

State:
- `vtopSession: { cookies, authorizedID, csrf } | null`
- `eventHubSession: string | null`
- `failedVtop: { username, password } | null`  (give-up cache)
- `failedEventHub: { username, password } | null`
- `backoffUntil: number` (epoch ms) per auth domain — engine refuses to hit the API until then.
- `attempts` counter.

Methods:
- `async loginVtop(ids, { forceNew, retryCaptcha })` → gets session via `request("login", …)`, caches on success, sets `failedVtop` + `backoffUntil` on auth failure, throws `AuthError`.
- `async loginEventHub(ids)` → same pattern for EventHub.
- `giveUpActive(): boolean` → true if `failedVtop`/`failedEventHub` matches current ids and `backoffUntil` not elapsed.
- `editCredentials(nextIds)` → clears `failedVtop`/`failedEventHub`/`backoffUntil`/`vtopSession`/`eventHubSession`, persists to `storage.ids`, and re-establishes sessions (calls `loginVtop`/`loginEventHub` once). **This is the safe "fix my password" path** (see `05-credential-editor.md`).
- `logout()` → clears sessions + caches + `storage.ids`/password (keep username per existing `clearAllData` keep-set).

Safety rules (directly address the VTOP-lockout complaint):
- On an auth failure for a given `(username, password)`, **no further `/api/login` is attempted for that pair** for the rest of the session (unless `editCredentials`/`forceNew`).
- A short exponential **backoff** (e.g. 0, 1s, 4s) is applied across attempts so even a "try again" button cannot rapid-fire.
- Captcha failures retry **once** (`retryCaptcha`), then give up.

## 3. OperationRegistry (`operation-registry.ts` + `operations/*`)
Each data type is one declarative operation:

```ts
interface SyncOp {
  name: string;                 // "payments", "attendance", "library", "events"…
  auth: "vtop" | "eventhub" | "none";
  run(ctx): Promise<unknown>;  // uses ctx.request(...) + ctx.creds
  persist?: (keyof StorageKeys)[];  // storage keys to write
  atoms?: AtomWriter[];         // atoms to update from the result
  dependsOn?: string[];         // e.g. pastAttendance depends on allGrades
  critical?: boolean;           // if true, failure aborts the whole syncAll
}
```

Example (`operations/payments.ts`):
```ts
register({
  name: "payments",
  auth: "vtop",
  run: ({ request, creds }) => request("payments", creds),
  persist: ["cache_payments"],
  atoms: [(res, bridge) => bridge.set(paymentsAtom, res)],
});
```

All current `data-fetchers.ts` functions + the direct fetches in `01-current-state.md` become operations here.

## 4. StateBridge (`state-bridge.ts`)
The **only** writer of `storage` and the data atoms.
- `bridge.set(storageKey, value)` → `storage[...].set(value)`.
- `bridge.setAtom(atom, value)` → updates the jotai atom (via a stored `setSelf` from the store, or a small atom-writer registry).
- Operations return data; `SyncEngine` routes it through `StateBridge`. Components only ever *read* atoms.

This eliminates the triple-writer problem (storage / Main useState / atoms).

## 5. ProgressBus (`progress-bus.ts`)
Replaces the scattered `setMessage(...)` / `setProgressBar(...)` calls.
- `engine.subscribe(cb: (e: ProgressEvent) => void)` where `ProgressEvent = { op, phase: "start"|"done"|"error", message, delta? }`.
- `Main.tsx` (or a `SyncStatusBar` component) subscribes once and renders the single loading/progress UI.
- Per-op progress is emitted by `SyncEngine.sync(name)` so the UI shows "Syncing payments… 60%".

## 6. SyncEngine (`index.ts`) — public surface
```ts
class SyncEngine {
  async login(ids): Promise<void>             // full login (VTOP + EventHub), throws AuthError
  async editCredentials(nextIds): Promise<void>  // safe password change (see 05)
  async logout(): Promise<void>

  async sync(name: string, opts?): Promise<void>     // run one operation, update state
  async syncAll(opts?): Promise<void>                // run critical ops, then background non-critical
  async invalidate(name?): Promise<void>             // force re-fetch (clear session/cache)
  subscribe(cb): () => void                          // ProgressBus
}
```

`Main.tsx` keeps a thin wrapper (`handleLogin`/`handleReloadRequest`) that simply calls `engine.login` / `engine.syncAll` and wires `subscribe` to the existing progress UI. All child components drop their `loginToVTOP`/`fetch` code and instead call `engine.sync(name)` (or rely on atoms already populated).

## Error handling summary
| Failure | Behavior |
|---------|----------|
| Auth (wrong password) | `AuthError` → CredentialManager sets give-up + backoff → **one** attempt, then stop. UI offers "Edit credentials". |
| Captcha | retry once, then `AuthError`. |
| Transient (5xx/timeout/net) | `request-layer` retries ≤2 with backoff; then `TransientError` → UI shows retry. |
| Not found / empty | `NotFoundError` → op skipped, state left as-is / cleared. |
| User abort | `AbortedError` → no retry, no state change. |
