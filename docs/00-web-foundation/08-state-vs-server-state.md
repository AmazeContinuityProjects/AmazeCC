# 08 — UI State vs Server Truth

> **In one line:** atoms remember _what the screen is doing_; localStorage caches _what the
> server said_; VTOP remains the only real source of truth for academics data.
> **Audience:** everyone. **Reading time:** ~8 min.

## The three memories this app has

| Memory           | Technology                    | Example                                      | Lifetime                                             |
| ---------------- | ----------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| **UI state**     | jotai atoms (`src/store/`)    | "active tab is 3", "sidebar collapsed"       | tab life; some atoms rehydrate from storage on mount |
| **Client cache** | localStorage via `storage.ts` | last attendance payload, demo flag, settings | until cleared by sync/logout                         |
| **Server truth** | AmazeCC-API → VTOP/Supabase   | actual marks, actual schedule                | authoritative; client copies are stale by definition |

## Why not one global store

Redux/zustand would also work, but this app has two very different jobs:

1. _UI ephemera_ — flickers off instantly on tab close (perfect for atoms).
2. _Cache_ — needs to survive restarts so the student sees _something_ offline (perfect for
   localStorage; atoms forget it on refresh, so `useAppBootstrap` rehydrates them back).

## The refresh cycle (why data is "fresh enough")

1. Mount → `AppHousing` reads storage and seeds atoms (instant, maybe stale).
2. User taps refresh / login / full sync → sync engine fetches from the API.
3. API scrapes VTOP (or its own DB) → returns JSON.
4. `stateBridge` writes results to atoms AND `storage.ts`.
5. Screens re-render from atoms.

Between (1) and (2), what you see is **yesterday's or last hour's data** — labelled as cached
(`LastSynced.tsx`) in the UI.

## Rules of thumb you must respect

- Never write to an atom for "this data survives refresh" — write to storage too, or bootstrap
  re-seeds it on reload.
- Never assume localStorage exists at build time — guard `typeof window`.
- Never treat cached data as instructions (`frozen_marks_*` are diagnostic receipts, not data
  for decisions).
- Demo mode short-circuits network and plays from a fixture — see `06-sync-engine/10-demo-mode.md`.

## Quiz

1. What renders a screen 100 ms after a refresh: atoms or localStorage? Explain the hand-off.
2. Give one thing that is _never_ cached client-side as source of truth, and say where it lives.
3. Why does this app need both atoms and localStorage — why not just atoms?
