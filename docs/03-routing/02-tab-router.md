---
title: "The Tab Router (client-side screens)"
description: "jotai atoms decide which feature screen is mounted; DashboardRoute gates them; nothing here is a URL — the whole signed-in app lives behind /."
---

# 02 — The Tab Router (client-side screens)

> **In one line:** jotai atoms decide which feature screen is mounted; `DashboardRoute` gates
> them; nothing here is a URL — the whole signed-in app lives behind `/`.
> **Verify:** `DashboardNavigator.tsx`, `Main.tsx`, `dashboard/DashboardRoute` (in Navigator file).

## The moving parts

| Piece                                       | File                                     | Job                                                                                                        |
| ------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `activeTabAtom`, `activeSubTabAtom`, …      | `store/uiAtoms.ts`                       | single source of "where am I"                                                                              |
| `DashboardNavigatorProvider`                | `dashboard/DashboardNavigator.tsx`       | owns atoms + sets `?tab=` on mount + legacy id normalization                                               |
| `useDashboardNavigator()`                   | same file                                | context hook — every screen reads tab/subtab from here                                                     |
| `DashboardRoute`                            | same file                                | `<DashboardRoute route="attendance">…</DashboardRoute>` — renders children only when `activeTab === route` |
| `useDashboardScreenHistory()`               | `dashboard/useDashboardScreenHistory.ts` | browser back ↔ overlay/subpage alignment                                                                   |
| `useAppCommands.tsx` + `useGlobalShortcuts` | `app/`                                   | palette entries for every screen                                                                           |

## The flow, end to end

```
store: activeTabAtom = "home"   (default on boot)
student taps "Attendance" in bottom nav
NavigationTabs.setActiveTab("attendance")
DashboardRoute(route="attendance") re-evaluates → mounts DashboardAttendanceFeature
attendance screen renders from atoms (attendanceDataAtom)
```

Nothing re-renders except the gated subtree. The browser history gets one entry per tab switch
(via `historyStack.ts`) so back/forward works predictably; overlays (sheets) consume Back first.

## Normalization quirks (documented to be forgotten)

- `activeTab === "academics"` forces `activeSubTab` into the known academics set
  (`courses-simplified`, `course-dashboard`, `marks-predictor`, …) — unknown legacy values
  get rewritten on mount.
- `more` + `qbank` → redirects to `tools`/`qbank`.
- `hostel` + `payment` → moves to top-level `payments`.
- `profile` + `preferences` → renamed to `settings` (legacy id discarded).

## Why atoms instead of URLs (again, because people ask)

Cost model: 100 routes × per-route chunks + deep-link consistency + SW precache growth —
for a tool students open 40 times a day to glance at attendance. Atoms are instant,
offline-safe, and carry zero deploy coordination. URLs remain for _world-facing_ surfaces.

## Quiz

1. Trace `activeTab = "more"; activeMoreSubTab = "ffcs"` — which component renders FFCS?
2. Where is `?tab=` read exactly once, and what happens to unknown values?
3. Which component owns browser-back integration?
