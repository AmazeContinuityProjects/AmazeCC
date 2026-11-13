---
title: "Main.tsx: The Runtime Root"
description: "the 1,280-line client component that owns session bootstrap, tab orchestration, command palette, shortcuts, and where the authenticated shell begins. Read it in one sitting once …"
---

# Main.tsx: The Runtime Root

> **In one line:** the 1,280-line client component that owns session bootstrap, tab
> orchestration, command palette, shortcuts, and where the authenticated shell begins.
> **Read it in one sitting once** — `src/components/custom/Main.tsx` (~1,280 lines).

## Its five jobs (in render order)

1. **Restore state** — read localStorage/atoms into the app (`useAppBootstrap`), show the
   `OpeningScreen` until hydration finishes (no flash of wrong screens).
2. **App chrome** — `SyncSessionHost`, `<BackgroundPrefetch/>`, `<IntroSong/>`, the command
   palette, notifications `<ConnectionBanner/>` — the permanent furniture.
3. **Handle login orchestration** — `submitLogin`, `handleReloadRequest`, `selectSyncMode`;
   everything authenticated flows through these functions, which is why they carry the
   semester-switch semantics (`switchedSemester → full sync`).
4. **Mount the workspace** — `AuthenticatedWorkspace` decides intro vs dashboard (`showIntroAtom` /
   `isLoggedInAtom` / `demoModeAtom`) — see 04.
5. **Wire navigation wiring** — `AppLibraryPortal`, shortcuts registry, global atoms like
   `isReloadingAtom` seeds.

## Suspense boundaries

`Main.tsx` itself is lazy-`import()`ed by `HomeEntryController` — the guest landing ships
without it. The `OpeningScreen` branding shown pre-hydration is deliberate UX, not a bug:
it prevents rendering half-restored state as the real UI.

## Two hosts, one duplication (historical)

The app has **two** equivalent sync-sheet hosts — AppHousing's `mountSyncHost` and Main.tsx's
inline `SyncSessionHost`. Main rolls its own because it needs `activeModeId/onSelectMode` (mode
switcher inside the sheet). A future simplification: parametrize `SyncSessionHost` once.

## What "good" looks like here

- Every branch is deterministic from atoms — no local `useState` quiz about identity.
- Loading is explicit (`appHydrated` flag) — never render before restore.
- Error surfaces are honest: login failure mirrors the sync sheet's last error line.

## Quiz

1. What does `appHydrated` gate, and what flashes without it?
2. Why is Main lazy-loaded rather than in the root layout?
3. Which function owns semester switches, and what sync mode do they force?

_Detailed line-by-line commentary lands with a follow-up pass under `docs/04-app-shell/` once
stable; treat this page as the map, not the source._
