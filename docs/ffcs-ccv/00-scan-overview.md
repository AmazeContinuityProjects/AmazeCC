# FFCS Codebase Comparison — Scan Overview

**Scan date:** 2026-10-29
**Subject A:** this repo — `AmazeCC` (`github.com/AmazeContinuityProjects/AmazeCC`, branch `fix/october`)
**Subject B:** `../ffcs` — **FFCS-inator, CodeChef VIT** (`prod` branch), MIT licensed, © 2025 CodeChef-VIT

Companion files:

- [`01-theirs-not-yours.md`](./01-theirs-not-yours.md) — everything FFCS-inator has that AmazeCC does not (the 10 numbered items).
- [`02-yours-not-theirs.md`](./02-yours-not-theirs.md) — everything AmazeCC has that FFCS-inator does not, plus feature equivalences.
- [`03-implementation-plan.md`](./03-implementation-plan.md) — scope, design, and status for the items being ported.

---

## TL;DR

Both are Next.js 16 + React 19 + Tailwind v4 + TypeScript FFCS planners for VIT, but they are built on
opposite architectural philosophies:

| Concern     | **AmazeCC (ours)**                                                                                                                    | **FFCS-inator (theirs)**                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Rendering   | Static export (`output: 'export'`), **zero API routes**                                                                               | SSR + server API routes                                            |
| Data source | Hosted scraping API (`api.amazecc.com` + mirror + UniCC fallback) + 2 bundled CSV reports                                             | **146 bundled course-data TS files**, fully offline, no API at all |
| Auth        | VTOP credentials (localStorage)                                                                                                       | NextAuth v4 Google, restricted to `hd: vitstudent.ac.in`           |
| Persistence | localStorage only (~70 keys, `src/lib/storage.ts`)                                                                                    | **MongoDB** (mongoose) + local mirror                              |
| State       | Jotai atoms (`src/store/`)                                                                                                            | React Context + localStorage                                       |
| Generator   | Backtracking solver in a **web worker**, streaming progress/cancel/prune rules (`src/components/custom/exams/FFCS/logic/generate.ts`) | Cartesian expansion, "2D priority algorithm" (`src/lib/utils.ts`)  |
| Tests       | Vitest, **125 test files** (`src/__tests__/`), CI lint→typecheck→test→build                                                           | `node --test`, 4 test files (`tests/`), **no CI**                  |
| Lint/format | ESLint 9 flat config + guardrail rules, **no formatter config**                                                                       | ESLint + **Prettier + Husky pre-commit**                           |
| Deploy      | GH Pages + Vercel + Cloudflare (`open-next.config.ts`)                                                                                | Vercel-style (no config in repo)                                   |
| PWA         | Serwist 9 with background sync, 30-day shell cache, two manifests                                                                     | Hand-written `public/service-worker.js`                            |

---

## Tech stack detail

### AmazeCC

- Next.js **16.4.3** (webpack dev/build, `--experimental-https`), React **19.2.7**, TS **5.9.3** (`strict: false`)
- Tailwind **v4.3.2** + Radix primitives + shadcn-style config + org design system `@amazecontinuityprojects/amazeui`
  - Framer Motion 12 + `next-themes`
- Jotai 2.20 for state (`src/store/{auth,data,settings,social,ui}Atoms.ts`), only 2 React contexts
- Serwist 9.5.13 PWA (`src/app/sw.ts`), background-sync queue, `~offline` fallback
- `axios`/`cheerio`/`p-limit` for the hosted API; **`@supabase/supabase-js` declared but unused in `src/`**
- Package manager: pnpm (note: `package.json#packageManager: pnpm@12.15.0` vs `.npmrc` pinning `10.33.0`)
- Testing: Vitest 4 + jsdom + testing-library; 125 suites incl. `worker-artifact.test.ts` (runs the built worker in a Node `vm`)
- Lint: ESLint 9 flat config; **no Prettier** (being added — see implementation plan)
- Deploy: GitHub Pages (custom domain `amazecc.com` via `CNAME`) + `vercel.json` + `open-next.config.ts`
- GA `G-HGB7VDJKX0` hardcoded in `src/app/layout.tsx`; license GPL-3.0; version 3.1.0

### FFCS-inator (CodeChef VIT)

- Next.js **16.4.2** (`--turbopack` dev), React **19**, TS **5** (**strict**)
- Tailwind **v4** + hand-rolled "ZButton" neobrutalism components; fonts Pangolin/Poppins/Inter/Plus Jakarta Sans
- Context (`TimeTableContext`) + localStorage + module singleton (`src/lib/globalCourses.ts`)
- **MongoDB** via mongoose + native driver (NextAuth adapter); models in `src/models/`
- NextAuth v4 Google provider (`src/app/api/auth/[...nextauth]/authOptions.ts`)
- `pdfmake` for PDF export, `googleapis` (Sheets email collection); unused deps: `exceljs`, `html2canvas`, `dom-to-image-more`
- Hand-written service worker + `src/app/manifest.ts`
- ESLint 9 + **Prettier** (`.prettierrc`: singleQuote, printWidth 100, arrowParens avoid) + **Husky** pre-commit (`yarn lint-staged`)
- Testing: `node --test` only (`tests/*.test.cjs` + 2 large `.mjs` suites), including driving a real headless browser for extension tests
- Package manager: **three lockfiles** (`yarn.lock`, `package-lock.json`, `pnpm-lock.yaml`) + `.yarnrc.yml`; husky calls yarn
- **No CI** — `.github/` holds issue templates only
- No `vercel.json`; `.gitignore` ignores `.vercel`

---

## Repository shape

### AmazeCC routes (`src/app/`)

`/` (guest vs authenticated workspace), `/ffcs` (standalone planner, 3 layout modes), `/share`, `/share/ffcs`,
`/privacy`, `/terms`, `~offline`, plus `sw.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
**No `app/api` at all** — the ~150-endpoint VTOP-scraping API lives in a separate repo (`api.amazecc.com`).

FFCS core: `src/components/custom/exams/FFCS/` — `FFCSTimetableTab.tsx` (lives one level up), generator subpage,
guided selector, `logic/{generate,generator,facultyGroups,groupSelectedCourses}.ts`, `workers/generator.worker.ts`,
`hooks/`, 9 modals. Lib layer: `src/lib/{ffcsRanking,ffcsFacultyRanking,ffcsShare,ffcsSettings,slots,campusSchema,timetableMetrics,freeClassrooms,exportTimetable,portraitDossier,exportIcal}.ts`.

Rest of the app: attendance (+predictor, OD tracker), marks/grades predictors, exam schedule, hostel (mess/laundry/
leave/cab), dayscholar bus finder (`dayscholar/` holds the source route PDFs), KOHA library, payments, tasks/kanban,
QBank, social timetables + QR handles, command palette, changelog, onboarding, tours.

### FFCS-inator routes (`src/app/`)

`/` (landing, desktop/mobile by `useScreenSize`), `/slots` (interactive slot view), `/saved`,
`/share/[shareId]`, `/denied-access`, `/four04`, `/offline`, `api/{auth,timetables,timetables/[id],save-timetable,
shared-timetable/[shareId],collect-email}`.

Also: `extension/` (two MV3 Chrome extensions), `src/data/` (146 bundled course files ≈ 884 KB across 20 school
folders), `tests/`, `scripts/` (extension packagers).

---

## Data layer summary

**AmazeCC (client-side, no DB in this repo):**

- localStorage primary store; FFCS namespace keys: `ffcs_timetables`, `ffcs_activeTimetableId`, `ffcs_blockedSlots`,
  `ffcs_courseLocks`, `ffcs_raw_courses`, `ffcs_settings`, `ffcs_friends`, …
- Network: 3-tier host chain (`NEXT_PUBLIC_API_URL` → backup mirror → per-route UniCC fallback), all traffic forced
  through `src/lib/sync-engine` by an ESLint `no-restricted-imports` rule
- Bundled static data: `src/data/campus/{chennai,ap,bhopal}.json`, `config.json` (`slotMap` with all 94 lab slots +
  semester IDs), `public/ffcs/*.csv` (3 course reports), `public/data/{mess,laundry}`, `demoData.json`
- Backend (separate repo, documented here): Supabase — `supabase_setup.sql` (push subscriptions + cron),
  `migrate.sql` (HMAC'd cohort marks stats)

**FFCS-inator (three tiers):**

1. Bundled TS catalogue: `src/data/faculty.ts` aggregates 20 school folders →
   `School → category → "CODE - Title" → [{slot, venue, faculty}]` (5 502 offering rows, 783 distinct courses)
2. Personal **"My VTOP"** catalogue captured by the browser extension → validated schema (`src/lib/vtopCatalogue.ts`)
   → localStorage `ffcs:vtop:catalogue:v1` → injected as a virtual school
3. MongoDB `Timetable` model (title, owner email, `isPublic`, unique sparse `shareId`, `slots[]`) — the only
   actively used model; plus Google Sheets email collection

---

## Notable oddities spotted during the scan

- **AmazeCC:** `conflict.txt` (stale UTF-16 merge-conflict dump), committed `tsconfig.tsbuildinfo`, README claims
  Recharts and a `backend/` directory that don't exist, `.npmrc` vs `package.json` pnpm version mismatch,
  `tsconfig.json` `strict: false`, unused `@supabase/supabase-js`/`pg`/`multer`, `certificates/` holds dev TLS
  certs from `next dev --experimental-https`.
- **FFCS-inator:** dead code (`middleware.ts` matcher targets removed `/user/favorites`, `src/services/api.tsx`,
  `QuickModify.tsx`, `models/user.ts`, `models/course.ts`), unused deps (`exceljs`, `html2canvas`,
  `dom-to-image-more`, `google-auth-library`), triple lockfile confusion, `collect-email` API with no frontend caller,
  no CI.
