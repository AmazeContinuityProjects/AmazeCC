---
title: "The Settings Atom"
description: "one localStorage-backed object with a merge-on-read migration shim — adding fields preserves old installs; deleting them silently resurrects them."
---

# 05 — The Settings Atom

> **In one line:** one localStorage-backed object with a merge-on-read migration shim — adding
> fields preserves old installs; deleting them silently resurrects them.
> **Read:** `src/store/settingsAtoms.ts`.

## The merge semantics

```ts
atomWithStorage("settings", defaultSettings, undefined, { getOnInit: true })
→ on every mount, read stored JSON, deep-merge over `defaultSettings` (arrays replaced, not merged),
  then serve result. Nothing is deleted from stored payloads — ever — by this path.
```

## Why it matters

- **Additive changes are free** — add a field + default: old installs pick it up on next read.
- **Renames are silent breakage** — renaming a key orphans values forever.
- **Validation is manual** — corrupt shapes (wrong primitive types) blow up consumers; readers
  must tolerate anything because storage lies.

## The field families (~70)

Display: theme, palette, accent, font-scale, privacyMode, showCGPAOnDashboard.
Sync: defaultSyncMode, sync cadence stamps (`lastSyncStatuses`), `autoSyncInterval` (captured but
never acted on). Timetable: viewMode, cellDensity, signals. Tasks: pomodoro defaults. Push:
quietHours, category flags, prompt stamps. Navigation: pinnedNavTabs, isSidebarCollapsed,
difficulty of help. Misc: decimalValues, showProfilePhoto, syncTimes, forget-credential flags.

## The one hard rule

No consumer may treat a settings field as guaranteed to exist post-upgrade without a fallback
expression; the atom does not enforce shape.
