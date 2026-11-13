# 07 — State Management Map (jotai atoms, catalog style)

> **In one line:** 59 atoms in five files, written mostly by the sync engine, read by every
> screen, rehydrated from `localStorage` on boot.
> **Reading time:** ~12 min. Deeper: `07-data-layer/04-atoms-catalog.md`.

## The five files

| File                     | Count                  | Domain                                                                  |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------- |
| `store/authAtoms.ts`     | 5                      | credentials (in-memory), demo flag, showIntro, authorizedID             |
| `store/dataAtoms.ts`     | 19                     | everything the sync engine produces (attendance → QCM)                  |
| `store/settingsAtoms.ts` | 1 (object, ~70 fields) | user preferences, theme, sync modes, goals                              |
| `store/uiAtoms.ts`       | 26                     | active tabs/subtabs, palette, sheets, offline banners, message/progress |
| `store/socialAtoms.ts`   | 8                      | social pairing: peers, grants, own busy map, sync state, invite handles |

## Writing atoms vs reading storage — the split

- Atoms hold **session-live values**. Only `state-bridge.ts` (or an explicit screen action)
  writes them — that's the canonical path.
- `localStorage` holds **durable copies** and demo-mode fixtures; `useAppBootstrap.ts` seeds
  atoms from it on mount.
- `settingsAtom` is the odd duck: `atomWithStorage("settings", defaultSettings)` with a
  merge-on-read migration shim — every release adds fields; old installs keep working. Read it
  before deleting _any_ field.

## Derived UI atoms of note

- `isReloadingAtom` — the global "a sync is running" flag; bottom sheet visible.
- `progressBarAtom` / `messageAtom` — thin status line + toast stream.
- `showIntroAtom` — the skippable "first run" hero gate.
- `activeRegNumberAtom` — published by the studentProfile op; drives deep watermarking of shares.

## Persisted-but-hidden

`demoModeAtom` round-trips via `storage` (`"demoMode"`), as do credentials through the vault.
`authorizedIDAtom` deliberately does **not** — it would outlive the session otherwise.

## How to add an atom (checklist)

1. Pick the domain file; export `<name>Atom`.
2. Add to `state-bridge.ts` if the sync engine should own it (type, initial value, persist key).
3. Seed it in `useAppBootstrap.ts` from storage under a catalog'd key.
4. Add it to `04-atoms-catalog.md` (count will drift — update it in the same PR).
5. Tests: `getDefaultStore().set(...)` in render suites.

## Quiz

1. Which atoms are written by something _other than_ the sync engine, and which UI eventes write them?
2. What breaks if you delete a field from `defaultSettings` without a migration shim?
3. Which atom holds the demo flag, and which module decides the app boots into demo mode?
