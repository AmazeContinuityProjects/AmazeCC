# 08 — Progress Bus & `useSync`

> **In one line:** a tiny pub/sub that turns engine events into React state — the nervous system
> of the sync sheet.
> **Read:** `src/lib/sync-engine/progress-bus.ts`, `useSync.ts`, `sync-session.ts`.

## The contract

```ts
type ProgressEvent = { op: string; phase: "start" | "done" | "error"; error?: EngineError }; // (+ optional percent for bulk)
progressBus.emit(e); // engine → bus
progressBus.subscribe(fn); // UI subscribes
progressBus.getSnapshot(); // useSyncExternalStore: [events, version]
```

`useSyncExternalStore` keeps it React-safe — reads the version to know when to re-render.

## `useSync(name?)` surface

`{ status: idle|syncing|done|error, sync, syncAll, syncMode, login, logout, editCredentials, subscribe }`
— the thin public API for feature screens to call the engine _without_ importing `SyncEngine` class internals.

`sync-session.ts` consumes the bus to produce the sheet's scrolling lines (`appendSyncLine`),
and this same layer owns `SyncPresentation = "sheet" | "inline"` (e.g. the intro's full-screen sync).

## Quiz

1. Why `useSyncExternalStore` instead of `useState` + a listener in an effect?
2. Where do the "done (1.2s)" lines in the sheet get timestamps?
