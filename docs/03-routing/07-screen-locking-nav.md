---
title: "Overlays, Back Button & Screen Locking"
description: "Back closes a sheet first, a sub-page second, a tab last — an ordered overlay stack makes that deterministic."
---

# 07 — Overlays, Back Button & Screen Locking

> **In one line:** Back closes a sheet first, a sub-page second, a tab last — an ordered
> overlay stack makes that deterministic.
> **Read:** `lib/overlayStack.ts`, `hooks/useSubpageStack` (in `shared/primitives/Subpage.tsx`),
> `dashboard/useDashboardScreenHistory.ts`, `BottomSheet.tsx`.

## The problem

Students hit browser Back constantly — and expect: close the grade sheet → back to marks;
another Back → back to timetable; never land somewhere they didn't expect, never lose the app
to a stray Back to the landing page.

## The machinery

| Layer                 | File                                                                | Order (push→pop)                                                                             |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Bottom sheets         | `BottomSheet.tsx`                                                   | push on open (portal, scroll lock, Escape)                                                   |
| Overlay stack manager | `lib/overlayStack.ts`                                               | global registry; the SW-of-modals — every sheet registers; handles dead entries & double-pop |
| Sub-page stack        | `shared/primitives/Subpage.tsx` (`useSubpageStack`/`SubpageScreen`) | shallow per-tab stack; "Back" inside a feature pops it first                                 |
| Screen history        | `dashboard/useDashboardScreenHistory.ts`                            | maps browser history ↔ overlay pops                                                          |

## The rules

1. Back never exits the experience accidentally — at worst it goes to the last screen boundary.
2. Sheets opened from a sheet stack by construction; Escape/pop order is deterministic.
3. The history entry is consumed exactly once per Back press (`historyStack.ts`).

## In tests

`overlayStack.test.tsx` & friends pin these invariants: push/pop order, dead-entry pruning,
double-Escape safety, and keyboard-inset wrapping. Change the stack only with the suites green.

## Quiz

1. Name the order in which Back consumes overlays and screens.
2. What happens if two sheets both render with `z-50`? (Hint: the stack decides z-fights by
   registration order.)
