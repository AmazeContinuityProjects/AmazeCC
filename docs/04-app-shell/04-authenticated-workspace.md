# 04 — AuthenticatedWorkspace (the gate + intro branches)

> **In one line:** decides, with no flicker, whether to show the first-run/login experience or
> the actual workspace.
> **Read:** `src/components/custom/app/AuthenticatedWorkspace.tsx`.

## The branching rule

```
const runIntro = showIntro === true || (!isLoggedIn && !demoMode);
```

Both halves matter:

- `showIntroAtom` — the one-time "welcome back / get started" hero (Can be suppressed on earlier visits).
- `!isLoggedIn && !demoMode` — catches the **cold-start-no-session** case the atom alone missed.

If `runIntro`, render `<AppIntroExperience>` — the sign-in/sync/welcome sequence. Once the
hero completes it flips `introActive=false` locally (must not yank away mid-flight).
Otherwise render `<DashboardContent/>` — the real app.

## The mid-flight guard (why there's a second flag)

`introActive` — set on effect when `runIntro` becomes true — prevents a race where a "login"
step setting `isLoggedInAtom=true` would swap the sync screen for the dashboard mid-sign-in.
Only the hero's own completion callback flips it off.

## What renders below both branches

`DashboardContent` gets: `handleLogOutRequest`, `handleReloadRequest`, `loginToVTOP`,
`handleLogin`, ⌘K handlers, `intro` config (username/password/initialPhase…), all destined
for `AuthenticatedWorkspace → NavigationTabs` and `ProfilePage` etc.

## Quiz

1. Student is logged-out, first visit to the app — enumerate every component rendered from boot.
2. Why is `introActive` separate from `showIntroAtom`?
3. Which prop hands the hero its sign-in config, and where does it ultimately land?
