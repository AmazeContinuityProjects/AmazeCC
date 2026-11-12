# 08 — Directory Map (annotated, with sizes)

> **In one line:** a guided stroll through the tree — biggest objects first, smallest shavings
> last. Line counts are approximate (snapshot 2026-11-12); re-verify with
> `git grep -c "" <file>` or your editor's status bar.
> **Audience:** everyone who just got the repo. **Reading time:** ~10 min.

## Repository root (what you keep tripping over)

```
AmazeCC/
├─ .github/workflows/ci.yaml      # lint → typecheck → test → build (PRs & main)
├─ .github/workflows/nextjs.yml   # main → build → upload artifact → GitHub Pages deploy
├─ config.json                    # VIT semester metadata (semester ids CH2022…CH20262705), campus ids
├─ next.config.mjs                # static export, Serwist, PostHog wrap, CSP
├─ package.json                   # scripts (pre* hooks!), deps (~110), pnpm enforced
├─ pnpm-lock.yaml                 # the contract
├─ tsconfig.json                  # strictNullChecks OFF; @/* → src/*
├─ vitest.config.ts               # 30s timeouts, jsdom, no global setup files
├─ eslint.config.mjs / .prettierrc/ .prettierignore / .npmrc / .husky/
├─ instrumentation-client.ts      # PostHog client init + OTel logs (client)
├─ instrumentation.ts             # server (build-time) OTel entry — nodejs-only
├─ CNAME                          # amazecc.com
├─ vercel.json / postcss.config.mjs / components.json (amazeui)
├─ certificates/                  # TLS chain used during scraping experiments (referenced by vitfacService note)
├─ certificates/ public/ data/ sql/ design/ dayscholar/ scripts/ docs/ grounding/
└─ FEATURES.md                    # 48 KB of what the app does, user-first
```

## src/app — the URL surface (24 files)

```
layout.tsx (166)     root shell: fonts, theme, CSP meta, pre-paint session hint, GA
page.tsx             '/' → HomeEntryController (guest vs Main)
error.tsx / global-error.tsx / not-found.tsx
globals.css          Tailwind v4 import + design tokens + theme vars
sw.ts                Serwist service worker — precache exclusions, ~offline fallback
ffcs/{layout,page,FFCSPageView,PreloadReportCsv}.tsx
friend-finder/{page, FriendFinderPageView, disclaimer/, ...}
share/{page, ShareTargetView, ffcs/FFCSShareView, page}.tsx
privacy/ terms/      client legal pages
~offline/page.tsx    the offline page
```

## src/components/custom — the product (309 files)

Sizes that matter for handoff (shock-value units):

| Lines  | File                                           |
| ------ | ---------------------------------------------- |
| ~5,100 | `exams/FFCS/components/FFCSGuidedSelector.tsx` |
| ~4,400 | `exams/FFCSTimetableTab.tsx`                   |
| ~3,700 | `exams/FFCS/FFCSGeneratorSubpage.tsx`          |
| ~2,900 | `exams/CourseDetailSubpage.tsx`                |
| ~2,750 | `header/ProfilePage.tsx`                       |
| ~2,300 | `reports/StudentReportPage.tsx`                |
| ~2,150 | `mobile/SimplifiedMobileHome.tsx`              |
| ~2,000 | `friendfinder/FriendFinderTab.tsx`             |
| ~1,770 | `app/useAppCommands.tsx`                       |
| ~1,560 | `header/NavigationTabs.tsx`                    |

Sub-folders: `app/` (18) shell plumbing · `dashboard/` (12) feature boundaries & navigator ·
`header/` (11) chrome & ProfilePage · `attendance/` (14) · `exams/` (23 + FFCS/) · `hostel/` (13) ·
`social/` (15) · `tasks/` (11) · `qbank/` (5) · `shared/` (31 shims + primitives) · `timetable/`
(10) · `tools/` (7) · `onboarding/` (2) · `profile/` (4) · `more/` (2) · `feedback/` (3)

## src/lib — the brains (146 files)

Top five by size: `exportTimetable.ts` (1,752) · `calendarDay.ts` (1,581) · `posthog.ts`
(1,172) · `ffcsGenerate.ts` (1,281) · `exportTimetableHtml.ts` (1,002).
Sub-trees: `sync-engine/` (13), `scanner/` (13), `social/` (12), `libraries/` (3),
`navigation/` (1), `introSong/` (2), everything else flat at lib root.

## src/store (6 files, 59 atoms) · src/types (17) · src/features (4 files)

`features/import/*` powers course-sheet ingestion for the FFCS planner. `types/data/` mirrors
AmazeCC-API's payload shapes — import from there, not ad-hoc.

## src/**tests** — 204 test suites

Largest suites: `calendarDay.test.ts` (~1,700 lines) and the `ffcs-*` family (37 files).
Helper: `helpers/localStorage.ts` (in-memory Storage installer).

## scripts/

`generate-build-info.js` (all builds) · `prune-sw-precache.js` (post-build) ·
`convert-codechef-catalogue.mjs` · `compress-hero-artwork.mjs` · `fetch-vit-faculty.mjs` ·
`build-scanner-dataset.mjs` · `train-scanner-nn.mjs` (+128 KB corpus JSONL).

## Root data directories

`data/vit-faculty/` (roster scrape output + 1 cached profile) · `sql/` (PG migrations for the
**remote** Supabase; informational) · `design/` (mockups) · `dayscholar/` (bus fixtures) ·
`certificates/` (TLS chains referenced by `vitfacService.ts`)

## The one caveat of this map

Path-by-path explanations of _why every file exists_ live in `docs/05-*/` and the reference
catalogs (`99-reference/route-and-file-index.md`). This page is the altitude-reading layer.
