# 06 — Command Palette & Keyboard Shortcuts

> **In one line:** ⌘/Ctrl-K opens a fuzzy palette of every destination & action; `g`-prefixed
> sequences jump directly; `?` opens the shortcut cheat sheet.
> **Read:** `app/useGlobalShortcuts.ts`, `app/useAppCommands.tsx`, `lib/shortcuts.ts`, `palette/`.

## The pieces

| Piece                                         | Role                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `shortcuts.ts`                                | the declarative table: `g a` → attendance, `g t` → timetable, … shared by handler + help sheet          |
| `useGlobalShortcuts`                          | keydown listener: ⌘K/Ctrl-K toggles palette, `?` toggles help, `g` arms sequence mode with 1.5 s window |
| `useAppCommands.tsx`                          | merges registry destinations + one-off actions (sync modes, sign out, theme) into the command list      |
| `CommandPalette.tsx`                          | the UI — fuzzy match, grouped results, Enter to execute, mouse+keyboard parity                          |
| `CommandPaletteHost.tsx`                      | mounts palette at the shell; wires `commandPaletteOpenAtom`                                             |
| `EventSearchPalette` / `LibrarySearchPalette` | scoped searches one chord away (feature-local palettes)                                                 |

## How commands are built

```
getModuleRegistry(ctx)  → destination commands (label + keywords)
getManualCommands(...)  → sync modes, sign out, toggle theme, help…
merge, dedupe by id, sort by fuzziness at query time
```

Demo mode gets a reduced command set (nothing authenticated) — palette items are
`hiddenInDemo` when they'd 401.

## Customizing behaviour

- add a destination: register it (`03-navigation-registry.md`) with `keywords` — palette picks
  it up for free
- add a one-off: append to `useAppCommands.tsx` with an explicit `run()` — no registry needed
- add a chord: put it in `lib/shortcuts.ts` and both the handler and the `?` sheet update

## Quiz

1. Why does the shortcut sheet show exactly what works, with no hand-maintained README?
2. Which atom owns the open state, and which component renders it?
3. What closes when you press `Escape` with a sheet and palette both open?
