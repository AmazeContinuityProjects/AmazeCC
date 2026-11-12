# 10 — Demo Mode (the no-network runtime)

> **In one line:** `demoMode` short-circuits every VTOP-specific code path and serves a fixture;
> the app otherwise runs exactly as if logged in — perfect for development and demos.
> **Read:** `Main.tsx#handleDemoClick`, `credential-manager.ts`, `useAppBootstrap.ts`, `sync-engine/index.ts`.

## Trip/reset

- enter: `Main#handleDemoClick` → atoms `demoMode=true`, `localStorage["demoMode"]="true"`,
  credentials seeded as demo, all data atoms populated from `/data/demoData.json`
- exit: Profile page → "Forget everything" (or clear site data); login screen "Try demo" is
  the inverse toggle

## What silently does nothing in demo mode

- `ensureVtopSession` → returns a stub immediately (no captcha, ever)
- `sync*` ops → VTOP-guarded paths skip; failure recording off (`!storage.demoMode.get()`)
- API calls: none — even `/api/ffcs` must not fire (see the 2026-11 regression; now enforced
  by mount discipline, not by the demo guard alone)
- `studentProfile`, `reportError` → still emitted? No: failure recording suppressed; PostHog
  events for demo are tagged `demoMode: true` where meaningful.

## What still works

Every UI/UX path: calendar rendering, marks predictor, FFCS generator (CSVs ship in the bundle
or cache), share links, timetable exports, tour, offline page, install prompts (as far as the
manifest allows).

## Demo data provenance

`src/data/demoData.json` == `public/data/demoData.json` (same SHA). Seeds: marks (2 sems),
attendance (current sem), hostel + OD demo fixture, `allGrades`, `registeredEvents`.
"Demo Student", `22BCE1234`, Vit Chennai. Random-sensible, deterministic, safe to screenshot.

## Quiz

1. Why can a fresh laptop run this app fully, offline-ish, with no env file at all?
2. What is the one thing demo mode cannot teach you about production behaviour?
