# 06 — The Sync Modes Editor (UI)

> **In one line:** reorder, toggle and compose ops into a personal sync profile, persisted
> client-side, validated against the live registry.
> **Read:** `shared/SyncModeEditor.tsx`, `shared/SyncModePicker.tsx`, `sync-modes.ts`.

## Editor contract

- Add/remove ops from `allOps()` — only registered ops are selectable
- Reorder via ↑/↓ (no drag-and-drop dependency)
- Toggle background vs foreground per step
- `bulk` expands into per-endpoint rows automatically (`expandBulkSteps`); collapses back on save
- Validation errors surfaced inline — never silently swallowed
- "Set as default" writes `settings.defaultSyncMode`

## The picker

Segmented control with Quick / Balanced / Full + bundled customs; the sheet's mode switcher
uses the same component with `onSelectMode` → `selectSyncMode(id)` → persist + re-run.

## Persistence & migration

Custom modes are schema-versioned by key (`sync_custom_modes_v1`). Unknown future ops in stored
modes are dropped by `loadCustomModes()`; invalid modes never reach the engine.

## Quiz

1. Where is the default sync mode stored — and when does a semester switch override it?
2. Which functions collapse the expanded bulk-endpoint picker back into one step?
