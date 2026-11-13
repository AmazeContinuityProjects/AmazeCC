---
title: "AppHousing (the shared housing pattern)"
description: "one component that every entry route shares to get session hydration, sync-event bridging, PostHog identity, and the sync sheet — without duplicating wiring."
---

# 03 — AppHousing (the shared housing pattern)

> **In one line:** one component that every entry route shares to get session hydration,
> sync-event bridging, PostHog identity, and the sync sheet — without duplicating wiring.
> **Read:** `src/components/custom/app/AppHousing.tsx`.

## What it mounts (in order)

1. `useSyncSessionBridge()` — forwards engine progress events into legacy
   `messageAtom`/`progressBarAtom` for UI toasts.
2. **Hydration effect** — restores credentials (storage `ids` + username/password + demoMode),
   seeds jotai `isLoggedInAtom`/`demoModeAtom`/`credentialsAtom` before children paint.
   This is why returning students skip login entirely.
3. **PostHog identity** — `syncCurrentUserPostHogIdentity({ route, semester })` when logged in —
   see `06-sync-engine/…` and `11-security/` for what gets attached.
4. `SyncSessionHost` (optional prop `mountSyncHost`) — the bottom sheet for sync progress.

## Callers

| Caller                  | Notes                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| `Main.tsx` (fresh boot) | rolls its own host; uses shared hydration/bridge/identity                        |
| `/ffcs` route           | `AppHousing` wraps the standalone planner; own manifest — same session hydration |
| `/friend-finder` route  | same pattern                                                                     |
| `/share/ffcs` route     | renders without Housing (public, no session needed)                              |

## Parameter contract

```tsx
<AppHousing route="ffcs" semester="CH20262705" mountSyncHost>
  <FFCSPageView />
</AppHousing>
```

- `route` — forwarded to PostHog + icon-updater semantics.
- `semester` — default `CH20262705`; lets identity tags carry the term.
- `mountSyncHost={false}` — only when a host is supplied by the caller (Main.tsx).

## Quiz

1. Why does `AppHousing` hydrate _inside_ an effect instead of synchronously in render?
2. What does `useSyncSessionBridge` protect consumers (Main vs route housings) from?
