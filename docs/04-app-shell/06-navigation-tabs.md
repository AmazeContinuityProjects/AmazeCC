# 06 — NavigationTabs (sidebar & bottom bar)

> **In one line:** one module-registry-driven component renders the desktop sidebar, the mobile
> bottom bar, and the command-palette shortcuts — the most-seen UI in the app.
> **Read:** `src/components/custom/header/NavigationTabs.tsx` (~1,560 lines).

## Anatomy

- **Sidebar (desktop)** — registry-filtered groups: study / campus / tools / account.
  `useMemo(() => registry.filter(e => e.surfaces.sidebar && e.surfaces.sidebarGroup …))`
- **Bottom bar (mobile)** — five primary tabs + "More" (see `more/MoreTab.tsx`)
- **Top app bar (desktop)** — breadcrumb-ish title, sync/reload, search trigger (⌘K)
- **Semester picker** — dropdown of VIT semester ids (`config.semesterIDs`), writes settings + broadcasts
- **Shortcut footer** — `g`-sequence hints, hidden on small screens

## Registry as single source

`getModuleRegistry(navCtx)` → entries with `surfaces.*` → each surface filters → nothing about
a destination is hand-maintained in JSX. Add a destination, all three surfaces light up
consistently. See `03-routing/03-navigation-registry.md`.

## State it reads/writes

- `activeTabAtom` / sub-tab atoms (directly + via `useDashboardNavigator` context prop-drilling)
- `isReloadingAtom` for the refresh button's spinner
- `showReloadBannerAtom` for the "VTOP is down" strip

## Edit safety

Sidebar order affects muscle memory. Ordering is registry order; changing it reorders _all_ surfaces.
Icon changes ripple through the palette; rename targets break `g`-sequence shortcuts (update
`shortcuts.ts`).

## Quiz

1. List everything that lights up when you add one registry entry.
2. Where does the active tab's page title live?
3. Which props let a screen trigger the ⌘K palette respectfully?
