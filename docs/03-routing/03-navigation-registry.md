---
title: "The Navigation Registry"
description: "lib/navigation/registry.tsx is a declarative list of every navigable destination in the app — icons, labels, groups, shortcuts — consumed by the sidebar, the command palette, and the deep-link…"
---

# 03 — The Navigation Registry

> **In one line:** `lib/navigation/registry.tsx` is a declarative list of every navigable
> destination in the app — icons, labels, groups, shortcuts — consumed by the sidebar, the
> command palette, and the deep-link machinery.
> **Read first:** `src/lib/navigation/registry.tsx` (~933 lines).
> **Reading time:** ~9 min.

## Why a registry

Three surfaces need the same destination list:

1. the **sidebar** (study / campus / tools / account groups),
2. the **command palette** ("go to …" entries + fuzzy search), and
3. the **shortcut map** (`g` + letter jumps).

Duplicating it in three places guaranteed drift. The registry exports
`getModuleRegistry(ctx)` — context-aware (some entries hide in demo mode / for hostellers /
on certain campus builds) — and each consumer filters by `surfaces`.

## The shape of an entry

```ts
{
  id: "attendance",                  // stable key
  label: "Attendance",               // sidebar & palette label
  surfaces: { sidebar: true, sidebarGroup: "study", commandPalette: true },
  icon: <BarChart3 />,               // lucide icon component
  target: { kind: "tab", tab: "attendance" },   // or subtab navigation targets
  keywords: ["classes", "OD", "attendance %"],   // palette fuzzy match
  hiddenInDemo?: false,
}
```

`target.kind` discriminates plain tab switches (`tab`), sub-tab jumps (`tabSub`), and route
assignments (`route`). Registry consumers call `navigate(target)` which routes through
`setActiveTab`/`setActiveSubTab` (and dispatches `?tab=` to keep the URL honest).

## Groups you will see in the sidebar

`study` — attendance, courses, marks, timetable, FFCS planner · `campus` — hostel, payments,
libraries, events · `tools` — tools hub slots (qbank, predictor, scanner…) · `account` —
profile, settings, changelog, about.

## Extending the registry (your first feature)

1. Add the entry with a unique `id`.
2. Pick `surfaces` honestly (don't leak internal tools into demo).
3. Add `keywords` — the palette is how power users find things.
4. Wire a test? `navigation registry` suites exist for the shell screens — update them.

## Quiz

1. Why not inline the sidebar into `NavigationTabs.tsx`?
2. Which surface reads the registry to build the ⌘K list?
3. What does `surfaces.sidebarGroup` control?
