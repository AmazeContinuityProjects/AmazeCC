---
title: "The One-Page App"
description: "the signed-in app does not navigate URLs; it swaps feature screens behind one URL, driven by jotai atoms and a navigator context."
---

# 02 — The One-Page App

> **In one line:** the signed-in app does not navigate URLs; it swaps feature screens behind
> one URL, driven by jotai atoms and a navigator context.
> **Prereqs:** 00-web-foundation 05–08 · **Reading time:** ~9 min.

## Two routing models, on purpose

| Model                         | Where                                                                       | Who chose it                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Real routes** (file-based)  | `/`, `/ffcs`, `/friend-finder`, `/share`, `/privacy`, `/terms`, `/~offline` | needs deep links / PWA identity / SEO                                                                     |
| **Tab router** (client state) | everything inside the signed-in app                                         | ~100 screens; atoms are cheaper than URLs at this scale — and the whole thing is one deployable HTML page |

## Anatomy of the tab router

```tsx
// Main.tsx (simplified flow)
const { activeTab } = useAtom(activeTabAtom);
…
<DashboardRoute route="attendance"><DashboardAttendanceFeature … /></DashboardRoute>
<DashboardRoute route="academics"> …
```

- `DashboardNavigatorProvider` (in `DashboardNavigator.tsx`) holds all active tab/subtab atoms
  and resets `?tab=` deep links once on mount.
- `DashboardRoute enabled={…}` gates a screen by route id (`activeTab`). Only the matching
  child mounts; on tab switch the previous screen unmounts (its state lives in atoms/cache).
- `useDashboardScreenHistory` bridges browser history ↔ tab state (back gesture closes sheets
  before pages, per overlay stack).

## What the student experiences

Click "Attendance" → bottom-nav icon lights → attendance screen cross-fades in.
The URL never changes and the SW never refetches the HTML — the transition is pure client-side.

## Why this is not an anti-pattern here

- The "site" is a tool, not a content library — 98% of sessions start from a bookmark/home icon.
- Keeping all screens in one deployable bundle means **git-push → every student gets the same
  whole app** — no partial-route deploys, no stale-chunk confusion for internal nav.
- The couple of public-facing routes (`/ffcs`, `/friend-finder`) opt out and pay their own
  wiring cost when they need to.

## Failure modes of this choice (know them)

- "Refresh" mid-flow loses component state (atoms rehydrate, un-persisted state doesn't).
- Deep-linking into the app requires `?tab=` support — `useDashboardNavigator` reads it once;
  unknown values are ignored, not 404'd.
- Browser "back" is overlay-aware, not page-aware — see `useDashboardScreenHistory`.

## Quiz

1. Trace `?tab=tools` from the URL to the screen that renders.
2. When the user presses back twice — once closing a sheet, once switching tabs — what happens?
3. Name the file that owns the mapping of route id → screen component.
