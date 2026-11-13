# 08 — Command Palette Host

> **In one line:** the thin mount layer that connects `useAppCommands` to `CommandPalette`,
> owned by whichever shell is active.
> **Read:** `app/CommandPaletteHost.tsx`, `app/useAppCommands.tsx` (~1,770 lines),
> `shared/CommandPalette.tsx`, `useGlobalShortcuts.ts`.

## Responsibilities

- Bind `commandPaletteOpenAtom` (open/close/toggle) for the active shell
- Filter `useAppCommands()` output by environment (demo-safe commands only in demo; VTOP-only
  actions hidden when signed out)
- Focus management: autofocus input on open; Escape returns focus to the opener
- Route execution: commands call atoms/effects registered by the navigator (no URL coupling)

## `useAppCommands.tsx` (why 1,770 lines)

It aggregates commands from ~15 domains: navigation (every registry entry), sync modes
(`quick/balanced/full/custom`), actions (sign out, theme cycle, shortcut help, feedback),
plus feature-local commands (marks predictor what-if, exam-mode toggles…). Splitting it is a
known cleanup — flag order with the shortcuts table.

## Demo-mode divergence

Authenticated commands render but no-op/alert honestly ("Sign in to use marks sync") rather
than disappearing — discoverability stays consistent.

## Quiz

1. Which atom owns open state? Which component renders the palette itself?
2. Where does the palette source its destination list, and which entries does demo mode drop?
