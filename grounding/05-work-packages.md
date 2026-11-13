# 05 — Execution Plan: Work Packages (WP-00 … WP-12)

Run WPs **in order**. Each WP is one or more commits, each of which must leave the tree green
(`pnpm run test`, `pnpm run lint`, `pnpm exec tsc --noEmit` are unaffected by docs-only
changes, but the reviewer may run them). A WP is done only when its "Done when" list holds and
`06-verification.md` has been run against its output.

Legend for "Size": S (~1 session, <1 hr) · M (~2–4 hr) · L (~1 day) · XL (multi-session).

---

## WP-00 — Scaffold the new docs tree (S)

**Goal:** `docs/` holds the new skeleton with `README.md`s everywhere, empty-ish stubs, and
`archive/` in place with all legacy files moved.

**Steps:**

1. `git mv` every Class B/C file from `docs/xxx` into `docs/archive/xxx`; prepend the archive
   banner from `02-existing-docs-triage.md`.
2. Create every directory in `03-target-docs-structure.md` with a placeholder `README.md`
   (title + one line + "content lands in WP-nn").
3. Rebuild `docs/README.md` minimal: audience split (new dev / reviewer / maintainer), "read
   this first" sequence linking primer → getting started → architecture, then a table of all
   sections with one-line descriptions. Do not link to files that don't exist yet.
4. Create `docs/99-reference/glossary.md` from `grounding/08-glossary-seed.md`.

**Done when:** tree matches 03 minus file bodies; `git status` shows renames; no links into
`docs/archive/` from live pages (stub pages may link labeled).

## WP-01 — Web Foundation (L)

**Goal:** `docs/00-web-foundation/` complete; an amateur reader leaves knowing what's what.

**Files:** 13 pages per 03 + README. Sources: this repo (layout.tsx, next.config.mjs, tsconfig,
pnpm-lock.yaml, package.json), `node_modules/next/dist/docs/` (App Router, static export —
REQUIRED reading before writing 06-next-app-router.md and 07-static-export.md), MDN-style
general web knowledge. No repo facts beyond what you can verify.

**Done when:** each page follows `04-writing-standard.md`; every acronym defined at first
use; all primer pages link glossary and each other; a reader with no web background can
answer the 13-page quiz at the bottom of each page (write the quizzes).

## WP-02 — Getting Started + scripts + build (M)

**Goal:** `docs/01-getting-started/`; new dev reaches a running dev server in demo mode in
<30 min following only these pages.

**Verify on PATH:** Node 22, pnpm via Corepack or npm i -g (document both). `pnpm dev` vs
`pnpm dev:http` (HTTPS self-signed certs). Env defaults from `.env.example`; what happens when
blank; demo mode walk-through including `handleDemoClick` path and `demoData.json` provenance
(`src/data/demoData.json` == `public/data/demoData.json`). Every script: `predev`,
`prebuild`, `catalogue:build`, `scanner:dataset`, `scanner:train`, `build`, `typecheck`,
`test`, `lint`, `format`, `serve`. Troubleshooting: pnpm version mismatch, Node <22, port
in use, cert warning.

**Done when:** commands copy-pasted verbatim from the doc work on a clean clone; env var
table matches source greps (see WP-09 ref generation).

## WP-03 — Architecture & configuration (L)

**Goal:** `docs/02-architecture/` complete; `05-application-overview.png`-equivalent ASCII
diagrams of browser→static→API→VTOP; `07-state-management-map.md` lists all atoms grouped;
`08-directory-map.md` matches `01-inventory.md`.

**Done when:** a reader can name where each of: atoms, storage keys, caches, workers, fetches
live — with paths; config catalog covers every root config file (next.config, tsconfig,
eslint, prettier, husky, vitest, pnpm-workspace, .npmrc, vercel.json, CNAME, tools).

## WP-04 — Routing & navigation (L)

**Goal:** `docs/03-routing/` complete — both routing models documented with real file paths;
`/share` target parsing explained; tab-router internals verified against `Main.tsx`,
`DashboardRoute`, `useDashboardScreenHistory`, overlay stack, registry.

**Done when:** reader can trace `?tab=attendance` from URL → atom → screen, and can explain
why `/ffcs/` has its own layout + manifest (read `src/app/ffcs/layout.tsx` before writing).

## WP-05 — App shell deep-dive (M)

**Goal:** `docs/04-app-shell/` — Main.tsx line-commented narrative; AppHousing vs
Main-scroll SyncSessionHost duplication called out as historical artifact; HomeEntryController
gate; AuthenticatedWorkspace branches (intro/welcome/login); the "shell vs feature" rule.

**Done when:** every user-visible branch of Main.tsx's render is accounted for in the docs;
branch from login → full sync → dashboard traced end-to-end.

## WP-06 — Features I: academics cluster (XL)

**Scope folders:** `attendance/`, `academics/`, `marks-predictor/`, `free-classrooms/`,
`marks-and-cohort/`, `timetable-ui/`.

**Sources to read first:** `src/components/custom/attendance/*`, `exams/*` (non-FFCS),
`marks-predictor/*`, `shared/primitives/*` (Shell, Subpage, SettingRow, PageShell),
`src/lib/calendarDay.ts`, `attendancePredictor.ts`, `marksPredictor.ts`, `gradeBoundaries.ts`.
**Known corrections from 01-inventory.md:** StatCards.tsx dead; AttendanceSubpage &
DesktopCourseDetailPane are re-export aliases; StatsCards vs StatCards naming; cohort drift
logging lives in `marksSync.ts` + useDashboardDataActions.

**Done when:** each folder has the 8-file skeleton; feature README tables link every screen &
test; every "why this exists" references a real user pain.

## WP-07 — Features II: FFCS planner cluster (XL)

**Scope folders:** `ffcs-planner/`, `ffcs-friends/`, `.timetable-ui` finishes here (TimetableView).
**Files to master:** `FFCSTimetableTab.tsx` (~4.4k), `FFCSGuidedSelector.tsx` (~5.1k),
`FFCSGeneratorSubpage.tsx` (~3.7k), `logic/generator.ts`, `workers/generator.worker.ts`,
`ffcsGenerate.ts`, `ffcsWalk.ts`, share (`ffcsShare.ts`), tour (`features/tour/*`).
Also: catalog filters, curriculum backfill hook, target-lockers, export pipeline (image/PDF).

**Deliver a SUB-README** inside `ffcs-planner/` mapping: top-level screen modes
(guided/modern/classic), the worker protocol (one-shot vs `{type:"stream"}`), share payload
shapes (`d|x|q|r`), the tour system (TOUR_VERSION gating), and "how to add a filter/step".
**Done when:** a reader can generate 100 timetables mentally from the docs + can point to
where each setting in the settings sheet writes to.

## WP-08 — Features III: campus life & social (XL)

**Scope:** `social/`, `friend-finder/`, `hostel/`, `libraries/`, `payments/`,
`events-and-clubs/`, `cab-share/`, `tasks-and-pomodoro/`.
**Read first:** `src/lib/social/*`, `social-tt` archive for intent (labeled historical),
`FriendFinder*`, `clubs/*`, `CabShare/*`, `tasks*`, `tasksStorage`.
**Privacy language:** full-disclosure model, AMZ handle, grant revocation — quote
`social/visibility.ts` and disclaimer page text verbatim.
**Done when:** social pairing lifecycle (claim → push → derive → render) is flawless in the
docs; friend-finder pass is clearly public-vs-authenticated split.

## WP-09 — Features IV: rest of features + all reference tables (XL)

**Scope:** `qbank/`, `paper-scanner/`, `student-report/`, `settings-and-profile/`,
`notifications-and-push/`, `feedback-and-support/`, `changelog-and-about/`,
`about-and-licensing/`, `onboarding/`, `guest-landing/`.
**Then generate `99-reference/` tables from source, not memory:** env-var-reference (grep
`process.env.`), network-calls-catalog (grep `apiRequest|api\(|fetch\(` and classify by auth),
storage-key-catalog (grep `localStorage.(getItem|setItem|removeItem)` + `storage.ts` KEYS),
atom-catalog, dependency-catalog (top 40 by size w/ reason), route-and-file-index.
**Done when:** every table row traces to a path:line count; no hand-written inventory drifts
from grep output — include the grep commands in the doc footer.

## WP-10 — Sync engine + security (L)

**Goal:** `docs/06-sync-engine/` and `docs/11-security/` authoritative; retire `docs/sync-engine`
original location into new paths (git mv + rewrite against `01-inventory.md`; keep provenance).
**Must nail:** the 25 ops catalog with writes; `core` bundle fan-out incl. FFCS bundle fetch
on `wanted.has("schedule")`; `ffcs` op as the only place `sync("ffcs")` lands; demo-mode
short-circuit; failover order & UniCC refusal; credential-manager failure semantics; the
"which call failed?" decision tree in troubleshooting.
**Security:** vault AES-GCM contract; PostHog identity HMAC verification (client never holds
secret); marks-sync SHA-256 key parity w/ server; CSP decoded line-by-line; privacy-mode blur.
**Done when:** an attacker-minded reviewer reads 11-security and cannot find a misleading
claim (every mechanism traced to code).

## WP-11 — PWA, testing, ops, troubleshooting (L)

**Goal:** `08-pwa-platform/`, `09-testing/` (incl. suite-map listing ALL 204 suites),
`10-tooling-and-ci/`, `12-operations/`, `13-troubleshooting/` complete; CI changes documented;
all flakes noted; the `ServiceWorkerRegistrar` + `sw.ts` cache policy decoded; deploy walkthrough
for GitHub Pages (`nextjs.yml`) incl. the `out/` prune step.

**Done when:** a friend with repo access but no VIT account can clone, `pnpm install`, `pnpm dev`,
browse in demo mode, run one test suite, and open a docs PR — following only the docs.

## WP-12 — Final sweep: ADRs, cross-links, verification, tour (M)

**Goal:** `20-design-notes/`, `99-reference/decisions/*` (6 ADRs), `academy/` deep dives,
route-and-file-index finalized; run everything in `06-verification.md`; rebuild `docs/README.md`
to final form; tag commit `docs: handoff rebuild`.
**Exit interview:** reread 00–03 as a newcomer; fix anything that assumes knowledge.

## Dependencies at a glance

```
WP-00 → WP-01 → WP-02 → WP-03 → WP-04 → WP-05
                                        ↓
              WP-06, WP-07, WP-08, WP-09 (parallelizable, WP-06 needs WP-03)
                                        ↓
                              WP-10 → WP-11 → WP-12
```

## Parallelization guidance

WP-06…WP-09 may run as separate agent sessions. Each WP agent must read this folder fully,
its assigned sections of `01-inventory.md`, and only the source paths it documents. Agents
must not touch other WPs' output paths; merges resolve by directory, not by file.
