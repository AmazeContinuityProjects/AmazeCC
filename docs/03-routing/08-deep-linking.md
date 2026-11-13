---
title: "Deep Linking & Return Paths"
description: "the URL carries ?tab= and return paths; the app reads it once at boot and never again, so deep links are bookmarks, not live state."
---

# Deep Linking & Return Paths

> **In one line:** the URL carries `?tab=` and return paths; the app reads it once at boot and
> never again, so deep links are bookmarks, not live state.
> **Read:** `dashboard/DashboardNavigator.tsx`, `lib/signInReturn.ts`, `useAppCommands.tsx`.

## What URLs represent

| Pattern                                  | Meaning                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `/?tab=attendance`                       | open the attendance tab on boot                 |
| `/?tab=academics&subtab=marks-predictor` | boot into the marks predictor                   |
| `/?feedback=open&category=bug`           | auto-open feedback sheet with bug category      |
| `https://amazecc.com/ffcs/`              | standalone FFCS, unrelated to atoms (own route) |

## How they're consumed

`DashboardNavigatorProvider`'s mount effect reads `window.location.search` **once** and applies
`setActiveTab` (and sanitiser rules from `02-tab-router.md`). The URL is **not** live state —
no `useSearchParams` subscriptions inside screens; fresh links are just a boot animation.
`signInReturn.ts` handles `/?signin=1` + `takeSignInReturn()` — the round-trip after a forced
VTOP re-login bounces you back to the screen you were on.

## What breaks (and why it's okay)

- `/?tab=garbage` — ignored silently, stays "home"; we do not 404 marketing typos.
- Tab params are additive — `?tab=marks` (invalid) does not remove the app's defaults.
- Standalone routes (`/ffcs`, `/friend-finder`) ignore these atoms — they have their own
  navigators internally.

## Quiz

1. Why is `?tab=` read only once, not reactively?
2. After a forced sign-in, how does the app return the student to their screen?
