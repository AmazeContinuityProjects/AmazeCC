---
title: "The Real URL Routes"
description: "the entire public internet surface of this app is 12 URLs — everything else is behind client-side state."
---

# The Real URL Routes

> **In one line:** the entire public internet surface of this app is 12 URLs — everything else
> is behind client-side state.
> **Verify:** `src/app/` in this repo. **Reading time:** ~8 min.

| Route                       | Source                                                               | What it is                                                                                   |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`                         | `app/page.tsx`                                                       | guest landing → Sign in / Demo, or the signed-in shell once hydrated                         |
| `/ffcs`                     | `app/ffcs/{layout,page,FFCSPageView.tsx}`                            | standalone FFCS timetable planner — own manifest, icon, metadata; PWA-installable on its own |
| `/friend-finder`            | `app/friend-finder/{page,FriendFinderPageView.tsx}`                  | public classmate finder (VTOP-verified login modal)                                          |
| `/friend-finder/disclaimer` | `app/friend-finder/disclaimer/{page,FriendFinderDisclaimerView.tsx}` | liability & data-sharing terms; required before entering the finder                          |
| `/privacy`                  | `app/privacy/page.tsx`                                               | privacy policy (client page)                                                                 |
| `/terms`                    | `app/terms/page.tsx`                                                 | terms of service (client page)                                                               |
| `/share`                    | `app/share/{page.tsx,ShareTargetView.tsx}`                           | Web Share Target receiver — OS "Share…" lands here                                           |
| `/share/ffcs`               | `app/share/ffcs/{page.tsx,FFCSShareView.tsx}`                        | received FFCS plan, read-only, payload in `d=`                                               |
| `/~offline`                 | `app/~offline/page.tsx`                                              | Serwist offline fallback (served by SW, not the static host)                                 |
| (not-found)                 | `app/not-found.tsx`                                                  | 404 UI (GitHub Pages serves `404.html`)                                                      |

## The two flavors of the FFCS planner

- `/` → app shell → **Tools → FFCS Planner** or **More → FFCS** (authenticated, embedded)
- `/ffcs/` — same FFCS module, standalone: **own** layout (`ffcs/layout.tsx`), own metadata
  (`FFCS.png`), its own manifest (`public/ffcs-manifest.json`), `ReactDOM.preload()` of the
  default semester CSV, and `PreloadReportCsv.tsx`. The document `<html>` gets the FFCS icon set
  at runtime via `IconUpdater.tsx`.

## The two kinds of "share"

- **Sharing a plan out** — user taps "Share plan" → `buildShareUrl`/`buildCompactShareUrl`
  (`lib/ffcsShare.ts`) → URL opens in anything → `/share/ffcs?d=…` decodes it.
- **Receiving via OS Share Sheet** — Android/share-intent targets `/share?url=…` (see
  `public/manifest.json#share_target`) → `ShareTargetView` → forwards into the planner.

## The three boundaries you must respect

1. **Static export** — every route above is plain files under `out/` with `trailingSlash: true`.
2. **No server gate** — `AppHousing`/`HomeEntryController` do the gating client-side; the HTML
   itself is identical for everyone.
3. **Standalone routes re-wire housing** (`AppHousing`) deliberately — don't "save duplication"
   by importing Main into them; they deliberately avoid its cost.

## Quiz

1. Which file makes `/ffcs` installable as its own app, and which makes `/friend-finder` show
   a different favicon than `/`?
2. When the SW serves `/~offline/`, who initiated that load and why?
3. What exactly _can't_ GitHub Pages do with these routes that a Node server could?
