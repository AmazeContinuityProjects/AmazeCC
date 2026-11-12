# 07 — The Sync Session Sheet

> **In one line:** the progress bar + log of a sync run — the only UI that tells the student
> what the app is _doing_ while VTOP scrapes away.
> **Read:** `SyncSessionHost.tsx`, `shared/SyncNotification.tsx`, `sync-engine/sync-session.ts`.

## Pieces of the sheet

| Piece         | File                                              | Job                                                                  |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Engine emits  | `sync-engine/progress-bus.ts`, `useSyncSession()` | wire: events → React snapshot                                        |
| Session state | `sync-engine/sync-session.ts`                     | open/lines/progress/outcome/notice; presentation="sheet"             |
| Host          | `SyncSessionHost.tsx`                             | mounts `<SyncNotification/>`; wires retry/dismiss/change-password    |
| Sheet UI      | `shared/SyncNotification.tsx`                     | progress %, scrolling log lines with statuses, Cancel, mode switcher |

## The session lifecycle (read this once)

```
login → openSyncSession(title)        // atom flip from closed → sheet
   lines stream via appendSyncLine    // "Attendance & marks… done (1.2s)"
   progressBarAtom advances per op    // rough: foreground steps then background
closeSyncSession(ms?, outcome?)       // auto-dismiss or keep on failure
```

Failures stay on screen until the student dismisses or retries — by design: silent retries hide
VTOP lockouts.

## Actions wired

- **Retry** → reruns the last mode (`handleReloadRequest()`), never a half-remembered args pair
- **Cancel** → `cancelAllRequests("User dismissed sync")` aborts in-flight fetches via the
  global `AbortController` (request-layer honors it)
- **Change password** → opens `CredentialEditorModal` (initial stored creds pre-filled)
- **Mode switch** → re-runs with chosen `SyncMode` id (persisted via `persistDefaultSyncMode`)

## Quiz

1. What proves to the student the sync actually ran and wasn't cached?
2. What does Cancel do to requests already on the wire?
3. Why does the sheet persist on failure instead of auto-dismiss?
