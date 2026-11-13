---
title: "The Repo Layout"
description: "src/app = URLs; components/ = UI; lib/ = logic; store/ = jotai atoms; features/ = file import pipeline; data/ = fixtures; __tests__/ = tests."
---

# 12 — The Repo Layout

> **In one line:** `src/app` = URLs; `components/` = UI; `lib/` = logic; `store/` = jotai
> atoms; `features/` = file import pipeline; `data/` = fixtures; `__tests__/` = tests.
> **Audience:** everyone. **Reading time:** ~7 min.

## Annotated map

```
src/
├── app/                ← URL surface. Only thin page shells; interactive code stays client-side
│   ├── layout.tsx        root layout: html tag, fonts, theme, CSP meta, SW registrar
│   ├── page.tsx          "/" — renders HomeEntryController (guest vs Main)
│   ├── ffcs/             standalone PWA: layout + page + FFCSPageView
│   ├── friend-finder/    public FFCS-classmate finder (+ disclaimer route)
│   ├── share/            Web Share Target receiver (/share, /share/ffcs)
│   ├── privacy|terms/    legal pages
│   ├── sw.ts             the service worker source (Serwist)
│   └── ~offline/         Serwist offline fallback route
├── components/         ← UI by product area (attendance, exams, hostel, social, timetable…)
│   └── custom/           everything that isn't a library primitive
│       ├── app/            shell plumbing: AppHousing, Main, useAppCommands, useAppDataActions
│       ├── dashboard/      feature boundaries + navigator + data hooks
│       ├── header/         sidebar/tab bar, ProfilePage, changelog, etc.
│       ├── shared/         bottom sheet, amazeui shims, primitives (PageShell, Subpage…)
│       └── …               one folder per feature (see 05-*)
├── lib/                ← brains with no JSX. Pure-ish modules, engines, adapters
│   ├── sync-engine/      the VTOP fetch machinery (see 06-sync-engine)
│   ├── ffcs*.ts          the FFCS planner engine (types, reports, generator, share, …)
│   ├── scanner/          OCR/NN paper scanner
│   └── social/           social/pairing model (types, schedule math, visibility)
├── store/              ← jotai atoms, grouped by domain (auth, data, settings, ui, social)
├── features/import/    ← pasted/CSV course import (normalizer, paste parser, samples)
├── types/              ← declaration files; api response shapes (import from here!)
├── data/               ← committed fixtures: demoData, buildInfo, changelog, campus tables
└── __tests__/          ← 200+ test suites (vitest) + helpers/localStorage.ts
```

## Where things _really_ live (the shortcuts you'll learn)

| I want…                      | Look in…                                          |
| ---------------------------- | ------------------------------------------------- |
| The sync engine's ops        | `src/lib/sync-engine/operations.ts`               |
| All atoms                    | `src/store/` (index re-exports)                   |
| The VTOP→atoms write path    | `sync-engine/state-bridge.ts`                     |
| The FFCS planner entry       | `components/custom/exams/FFCSTimetableTab.tsx`    |
| The one attendance % formula | `lib/attendanceSummary.ts`                        |
| Build/env behavior           | `next.config.mjs`, `package.json`, `.env.example` |

## Anti-patterns you'll meet

- **Barrel files** — `shared/index.ts` re-exports amazeui shims; handy, but doubling exports
  means an edit to one line can change many importers — grep before renaming.
- **The "alias" files** — `AttendanceSubpage.tsx`, `DesktopCourseDetailPane.tsx` are
  re-export shells for code organization; they are not separate features.
- **`docs/` is not the repo map** — `docs/archive/` is history only; this page and
  `08-architecture/08-directory-map.md` are the map.

## Quiz

1. Add a new jotai atom — which folder and which file(s) change?
2. Where do you read the AES-GCM vault implementation from?
3. Why does this repo have both `src/components/custom/TimetableGrid.tsx` and
   `src/components/custom/timetable/TimetableView.tsx`? (Hint: canonical entry point.)
