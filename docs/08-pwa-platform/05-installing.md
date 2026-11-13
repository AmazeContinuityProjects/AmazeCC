---
title: "Installing the App (Add to Home Screen)"
description: "installation makes AmazeCC an app icon with no browser chrome — one tap to your timetable."
---

# Installing the App (Add to Home Screen)

> **In one line:** installation makes AmazeCC an app icon with no browser chrome — one tap to your timetable.

## Criteria (browser-driven)

- Served over HTTPS (satisfied)
- Manifest with name/icons/start_url/display (satisfied)
- Service worker controlling pages (satisfied — register in `ServiceWorkerRegistrar`)
- No `maximum-scale`/zoom-disable that fails WCAG (satisfied — pinch zoom intact)

## Android (Chrome/Chromium)

Banner "Add to Home Screen" appears automatically after a few visits (Chrome's engagement
heuristic), or via **Settings → Install app** → captured `beforeinstallprompt` → card
(`PwaInstallCard.tsx`) offers a one-tap install. Result: `AmazeCC` icon, splash screens,
`display: standalone` (no address bar).

## iOS / iPadOS (Safari only)

No install prompt API exists — the card shows manual instructions:

> Share (□↑) → Add to Home Screen → Add — full-screen app with your icon.
> ⚠️ iOS 16.4+ supports web push _only_ after manual install; prompt copy mentions this.

## The div of care

- On SW update, install unaffected
- On `SiteLock` (chunks mismatch), `PwaInstallCard` hides; install prompt re-appears next visit
- Uninstall = normal OS uninstall; SW + caches die with it; localStorage persists (or not —
  OS-dependent; the vault re-prompts)

## Quiz

1. Why does the app never nag on iOS?
2. What browser event does the install card listen for, and on which browsers?
