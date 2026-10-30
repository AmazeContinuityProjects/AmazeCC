# What's in AmazeCC that is NOT in FFCS-inator (CodeChef VIT)

Paths under `src/`, `docs/` are this repo; `../ffcs/` is the CodeChef repo.

---

## FFCS planner

- **Worker-based backtracking solver** — `src/components/custom/exams/FFCS/logic/generate.ts` (≈1 850 lines) run in
  a streaming web worker (`workers/generator.worker.ts`, wrapper `logic/generator.ts`): live progress, batch
  streaming, cancellation via `worker.terminate()`, in-tree monotone pruning, free-half-days minimum, faculty
  dedupe, result caps. Their generator is a cartesian expansion with no worker and no streaming.
- **Target course locker / course locks** — `hooks/useCourseLocks.ts`, `components/TargetCourseLocker.tsx`,
  `GeneratorTargetCoursesWidget.tsx`, `docs/ffcs-generator-target-courses-locker-plan.md` (`CourseLock` restricts
  `allowedSlots` / `allowedFaculty` / specific `offerings`).
- **6 ranking profiles** with weighted verdict/100 — `src/lib/ffcsRanking.ts` (Best Faculty, Balanced, Half Days,
  Minimize Gaps, Early Finish, Late Start) + user-reorderable `rankingPriorityOrder` (FFCSGuidedSelector:3756).
- **Vitfac faculty review catalog** — `src/lib/vitfacService.ts`, `src/lib/ffcsFacultyRanking.ts` (win/loss %,
  lecture/DA/vibe metrics, score filters), `FacultyReviewSheet.tsx`.
- **Embedded course pairing** — 4-tier scored branch-and-bound theory+lab pairing with the VIT shift model,
  `docs/ffcs-workings/embedded-course-pairing.md` (their app instead keeps embedded halves clubbed by `__`).
- **Clash detection** — interval model on campus-schema periods (`src/lib/slots.ts`: `periodsOverlap`,
  `findPeriodClash`, `slotsOverlap`), compound slot splitting, lunch handling,
  `docs/ffcs-workings/clash-detection-and-schema.md`.
- **Friend alignment / Social Matrix** — `hooks/useSocialState.ts`, `SocialMatrixModal.tsx`, `FFCSFriendsSubpage.tsx`,
  pairwise social score in `src/lib/timetableMetrics.ts`.
- **Guided tour + tips** — `features/tour/` (`TourProvider`, `TourContext`).
- **URL share of the whole plan** — `src/lib/ffcsShare.ts` (lz-string, `FFCS_SHARE_VERSION = 1`,
  `/share/ffcs/?d=…`) + `src/lib/ffcsShareInput.ts`; no account needed.
- **Exports** — PDF dossier (jsPDF text tables in `src/lib/portraitDossier.ts`), image exports with Vitfac reviews
  embedded (`src/lib/exportTimetable.ts` ≈102 KB), iCal (`src/lib/exportIcal.ts`), CSV preload report.
- **Free classrooms / room search** — `src/lib/freeClassrooms.ts` (2 357-row day index, block detection,
  lab/theory union), `FreeClassroomsTab`, `mobile/FreeClassroomsWidget`.
- **Universal paste import** — `src/features/import/` (`parsePastedText.ts` 36 KB, `normalizeColumns.ts`,
  CSV/XLSX/TSV), `PasteRegisteredCoursesModal`, class-ID share decoding (`ffcsShareInput.ts`).
- **Credit accounting** — total-credits stat with 27-credit budget (`FFCSDashboardHeader.tsx:1017–1055`),
  curriculum credit-category limits (`curriculum.ts`). _(Their app has no credits anywhere.)_
- **Multi-campus schemas** — `src/data/campus/{chennai,ap,bhopal}.json` + `config.json#slotMap` (all 94 lab slots),
  LAW-school slot support (campus currently pinned to Chennai).

## Tests & CI

- **125 Vitest suites** in `src/__tests__/` incl. solver suites (`ffcs-generate.test.ts`,
  `ffcs-generate-stream.test.ts`) and `worker-artifact.test.ts` (executes the _built_ worker in a Node `vm`).
  Their `npm test` runs **one** `.cjs` file; two more suites exist for extensions.
- **Real CI** — `.github/workflows/ci.yaml` (lint → typecheck → test → build) + `nextjs.yml` (Pages deploy).
  They have **no workflows at all**, only issue templates.
- **ESLint guardrails** — `eslint.config.mjs` bans direct `fetchWithTimeout`/`API_BASE` imports (all traffic must
  go through `src/lib/sync-engine`) and enforces design tokens.

## Resilience / infra

- **3-tier API host failover** — `src/lib/fetch-utils.ts` (primary → mirror → UniCC per-route fallback,
  `src/lib/unicc-fallback.ts` with hard guards) + `amazecc_custom_api_url` override.
- **Sync engine** — `src/lib/sync-engine/` (13 files: credential manager, operation registry, progress bus,
  request layer, sync modes/session).
- **Serwist PWA done properly** — `src/app/sw.ts`: 30-day `last-used` app-shell cache, background-sync queue,
  hero-artwork precache exclusion, two manifests (app + standalone FFCS), web push
  (`pushNotificationManager.tsx`, VAPID), `~offline` fallback. _(Theirs is a simple hand-written SW.)_
- **Triple deploy** — GitHub Pages (GH domain `amazecc.com`), Vercel, Cloudflare (OpenNext) while shipping as a
  pure static export.

## The rest of the app (they are an FFCS-only product)

Attendance (+ calendar, OD tracker, **predictor**, Moodle connect) · marks/grades (**marks predictor**, CGPA
what-if, grade history) · exam schedule · marks sync to cohort stats (HMAC'd, `migrate.sql`) · hostel (mess,
laundry, leave, counselling, **cab sharing**) · **dayscholar bus finder** (`dayscholar/` source PDFs →
`src/data/dayscholar_buses.json`) · KOHA library catalog/dues · payments · tasks (kanban, week view, pomodoro,
Moodle import) · **social timetables** (peers, groups, common-free grids, QR handle scan/share) · QBank ·
command palette (Ctrl/Cmd+K) · themes (light/dark/midnight + accents) · onboarding + fresher welcome · changelog ·
team/hall-of-fame · localStorage inspector · privacy/terms · demo mode · Google Analytics.

## Docs culture

- `FEATURES.md` (47 KB, 21 chapters), `docs/ffcs-workings/` (clash detection, embedded pairing), dated engineering
  journals (`docs/sep-29-2026/…`, `docs/oct-21-2026/…`), sync-engine & social-tt RFCs, `design/` design-system
  docs, `guide.md` (VTOP endpoint map). Theirs: a 5.5 KB README + `CONTRIBUTING.md`.

---

## Feature equivalences (both have it — don't re-port)

| Feature                                | AmazeCC                                                            | FFCS-inator                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Timetable save/rename/duplicate/delete | local (`useTimetables.ts`, `FFCSDashboardHeader.tsx`)              | cloud (`/api/timetables*`, `saved.tsx`)                                                                    |
| Clash detection                        | interval model, `src/lib/slots.ts`                                 | `clashMap` table, `../ffcs/src/lib/slots.ts`                                                               |
| Lab shift morning/evening selection    | `FFCSDashboardHeader.tsx:1511–1518`, guided selector slot filter   | `FacultySelector.generateCourseSlots*()`                                                                   |
| PDF export                             | jsPDF image + text dossier                                         | pdfmake report                                                                                             |
| Share link                             | full plan in URL (`ffcsShare.ts`)                                  | short shareId + DB                                                                                         |
| PWA + offline page                     | Serwist, `~offline`                                                | hand-written SW, `/offline`                                                                                |
| QR code                                | `qrcode.react` (social handles)                                    | `next-qrcode` (share popup)                                                                                |
| Google Analytics                       | `G-HGB7VDJKX0`                                                     | `G-ZC8LE59L8H`                                                                                             |
| Mobile responsive                      | CSS-first (0.85 initialScale viewport trick)                       | desktop/mobile page variants via `useScreenSize`                                                           |
| Dead code                              | `conflict.txt`, `backend/` scripts, unused supabase/pg/multer deps | `QuickModify.tsx`, `services/api.tsx`, `models/user.ts`, `models/course.ts`, inert `middleware.ts` matcher |
