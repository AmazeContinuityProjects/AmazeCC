---
title: "The App Shell (signed-in chrome)"
description: "everything visible around feature screens — the sidebar/bottom-nav, the global modals, the online/offline banner — and the thin layer that wires them together."
---

# 04 — The App Shell (signed-in chrome)

> **In one line:** everything visible around feature screens — the sidebar/bottom-nav, the
> global modals, the online/offline banner — and the thin layer that wires them together.

1. [01-main-tsx.md](01-main-tsx.md) — Main.tsx vs. the world
2. [02-home-entry-controller.md](02-home-entry-controller.md) — who decides guest vs app
3. [03-app-housing.md](03-app-housing.md) — shared housing for every route
4. [04-authenticated-workspace.md](04-authenticated-workspace.md) — the gate + intro branches
5. [05-dashboard.md](05-dashboard.md) — Dashboard.tsx: wiring more than views (renamed intent)
6. [06-navigation-tabs.md](06-navigation-tabs.md) — sidebar, bottom bar, shortcuts
7. [07-sync-session-sheet.md](07-sync-session-sheet.md) — the sync bottom sheet & progress lines
8. [08-command-palette-host.md](08-command-palette-host.md)
9. [09-connection-banner.md](09-connection-banner.md)
10. [10-notifications-and-toasts.md](10-notifications-and-toasts.md)
11. [11-icon-updater.md](11-icon-updater.md)

> 💡 The shell is the highest-traffic surface in the app. Change it with tests running, and
> keep line counts in mind when you split any of it.
