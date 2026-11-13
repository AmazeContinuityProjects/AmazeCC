# 09 — Chunk Recovery (the post-deploy failure)

> **In one line:** after a deploy, a stale page can reference a JS chunk that no longer exists — this is the one-time self-healing path.

## The failure

User keeps an open tab across deploys → HTML from yesterday requests `chunk-abc123.js` → server
404s → React throws `ChunkLoadError`.

## The recovery (`lib/chunkRecovery.ts`)

1. `error.tsx`/`global-error.tsx` detect the pattern via `/loading chunk|ChunkLoadError|dynamically imported module/` regex on the message and on `digest`.
2. → set a session cooldown (10 s window, in-memory + localStorage) and call `purgeAndReload()`:
   - unregister the service worker
   - delete all Cache-Storage entries
   - `location.reload()` once (guarded by the cooldown so a loop can't happen)
3. New page loads → SW re-registers → fresh chunks — user never knows.

## When it loops anyway

`CHUNK_RECOVERY_COOLDOWN` atom guards reload storms (max once per 10 s). If the purge can't
clear (IndexedDB blocked), the sheet shows an actionable error with a hard-refresh button.

## How to test

Build → serve → open page → rebuild with a changed chunk name → reload tab → observe auto-recovery.
The test hook is `chunkRecovery.test.ts` (both branches).
