---
title: "Browser Compatibility"
description: "modern Chromium, Safari 15+ and Firefox all work — with documented iOS install quirks and a no-plugin stance."
---

# Browser Compatibility

> **In one line:** modern Chromium, Safari 15+ and Firefox all work — with documented iOS install quirks and a no-plugin stance.

## Supported

| Browser                    | Experience                               | Notes                       |
| -------------------------- | ---------------------------------------- | --------------------------- |
| Chrome/Edge/Opera ≥ latest | full (PWA, push, install prompt)         | primary target              |
| Safari macOS 15+           | full except install prompt (manual card) | SW + push (16.4+)           |
| Safari iOS 16.4+           | push after manual install; SW ok         | viewport-0.85 makes dense   |
| Firefox ≥ latest           | full except beforeinstallprompt          | manual install instructions |
| WebView (Android in-app)   | push limited/absent but works            | campus-safe default         |

## Not supported (by design)

- IE11 — dead anyway; no polyfills shipped
- Anything without Service Workers — site opens but offline says no
- JavaScript-disabled mode — everything is a client app; noscript renders a notice

## Specification notes

- `theme-color` light/dark both declared
- `viewport-fit=cover` + safe-area-insets accounted for in bottom nav/pills
- `prefers-reduced-motion` — ambient animations respect it (no scale/blur ballet)
- `color-scheme: dark light` declared in CSS (form theming)

## Quiz

1. What breaks on an Android WebView, and what still works?
2. Which one CSS feature would you check first if a user reports clipped bottom nav on iPhone?
