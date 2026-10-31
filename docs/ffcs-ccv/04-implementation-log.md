# FFCS-inator → AmazeCC Port — Implementation Log

Execution record for the plan in [`03-implementation-plan.md`](./03-implementation-plan.md). All scoped items are
complete: **items 4, 5, 6, 8, 9**, **GitHub issue templates**, and **Prettier + Husky**. Full suite green —
**136 test files, 1973 passed / 2 skipped**, `pnpm typecheck` clean, `pnpm lint` 0 errors.

> **Credit:** the bundled catalogue data (item 4) originates from **FFCS-inator by CodeChef VIT** —
> <https://ffcs.codechefvit.com> · <https://github.com/CodeChefVIT/ffcs> · **MIT © 2025 CodeChef-VIT**.
> It is shipped **offline only** as a same-origin static asset under `/ffcs/`; AmazeCC never fetches it (or any
> catalogue data) from `api.amazecc.com`. Provenance lives in `public/ffcs/codechef-vit-catalogue.SOURCE.md`, the
> report registry's `attribution` field, the converter script header, and a visible credit line in the UI.

---

## Item 4 — Offline bundled catalogue (CodeChef VIT)

**Converter:** `scripts/convert-codechef-catalogue.mjs` (362 lines) — run via `pnpm catalogue:build`.

- Reads `../ffcs/src/data/**` (their school folders): **144 TS files** transpiled with the installed
  `typescript` and evaluated in a `vm` sandbox (small resolver for `./X` / `./X/index.ts` imports),
  harvesting every export shaped `{ "CODE - Title": [{ slot, venue, faculty }] }`.
- Deterministic output: **2746 deduped offering rows**, **357 course codes**, **12 schools with data**,
  sorted by code+slot; **0 mixed-slot rows**. Stable sha256 (`8de60e2ac90b03bd…`) — re-running
  `pnpm catalogue:build` reproduces the file byte-for-byte.
- Header `CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE` — exactly what `parseReportRows` already accepts.
- `TYPE`: all slots lab-prefixed → `LO`, else `TH`. `CREDITS`: lab=1 / theory=3 heuristic, **overridden** by
  an exact-`CODE` join against our two existing bundled reports (which carry real credits for overlaps).
  Documented in `.SOURCE.md`.

**Wiring:**

- `reports.ts` — new `"codechef-vit"` entry in `FFCS_SEMESTER_REPORTS` (+ `FFCSSemesterId`); new optional
  `attribution` field on `FFCSSemesterReport` / row-level types, populated for this report.
- `FFCSTimetableTab.tsx` — `"codechef-vit"` included in the `ffcs_raw_courses` persistence set, and a visible
  attribution pill next to the report `SegmentedControl` ("Catalogue data: CodeChef VIT – ffcs.codechefvit.com").
- Modern-mode report picker subtitle shows the same attribution.

**Offline guarantees:** same-origin `/ffcs/*.csv` only (static export, Serwist `static-data-assets` NetworkFirst
cache, 24 h) — no `api.amazecc.com` request anywhere in this path. Parsed courses persist in
`ffcs_raw_courses`, so reloads work with no network at all.

**Tests:** `ffcsReports.test.ts` (updated id list) + `ffcsCodechefCatalogue.test.ts` (**17 tests**) — converter
determinism, header shape, credit/type invariants, attribution presence.

## Item 5 — All Subjects Mode

- `src/lib/ffcsSettings.ts` — `allSubjectsMode: boolean` (default **true**) through `FFCSSettings`,
  `FFCSSettingsDefaults`, `sanitizeFFCSSettings`; `ffcsSettings.test.ts` extended.
- `FFCSSettingsModal.tsx` — toggle with copy in the spirit of theirs:
  _"On: only timetables containing every selected course count. Off: if the courses cannot all fit, the solver
  retries with the lowest-priority courses left out instead of finding nothing…"_
- `FFCS/logic/dropPolicy.ts` (97 lines, pure) — `DEFAULT_MAX_DROPS = 3`, `droppableTail` (priority order =
  selected-course order, excluding protected codes), `isRetryableFailure` (`no_conflict_free`,
  `no_valid_slots`, zero-result `ok`), `nextDrop` (a `no_valid_slots` failure jumps that course's queue
  position forward — it is the one that could never fit).
- `FFCS/hooks/useGenerationRun.ts` — `GenerationRunOptions { drop?: DropPolicy }`; `run` now walks a retry
  ladder: attempt 0 is today's run verbatim; a failure that **streamed zero batches** and is retryable is
  retried with the lowest-priority course dropped, up to 3 drops, stopping at the first result. Results carry
  `droppedCourses?: readonly string[]` (`GenerationOutcome = GenerateResult & …`) so the UI can disclose what
  was left out. Attempts that already streamed batches are never retried (the caller's list would hold two
  attempts' worth of options); cancelled runs and solver crashes return as-is.
- Protected codes = locks with restricted slots/faculty/offerings — a targeted course is never silently dropped.
- Call sites: `FFCSGeneratorSubpage.tsx` + `FFCSGuidedSelector.tsx` build `runOptions` from
  `settings.allSubjectsMode === false` + `effectiveCourseLocks`, and render an amber notice naming the dropped
  courses beside the results.

**Tests:** `ffcsDropPolicy.test.ts` (pure policy) + `ffcsGenerationRun.dropLadder.test.ts` (7 tests, mocked
`startGeneration`) — drop order, protection, batch-seen suppression, budget cap, `droppedCourses` disclosure.

## Item 6 — Per-course manual faculty priority

- `src/lib/storage.ts` — `FFCS_FACULTY_PRIORITY` key + `storage.ffcsFacultyPriority` accessor.
- `src/lib/ffcsFacultyPriority.ts` (150 lines, pure) — name-based `Record<code, string[]>`, `/`-split for
  combined theory/lab halves, case-insensitive matching, `sanitizeFacultyPriority` + `hasFacultyPriority`.
- `FFCS/logic/generate.ts` — optional `GenerateParams.facultyPriority`:
  - `optionsFor` step 9 sorts each course's offerings so preferred faculties come first (affects streaming
    order and what survives `resultCap` / `dedupeByFaculty`);
  - a `facultyPriority` score is the **primary sort key** before the final return, so preference isn't lost to
    `sortBy`. `ffcsRanking` deliberately untouched — preference acts on ordering only (reversible by design,
    recorded in the plan).
- UI: `modals/FacultyPriorityModal.tsx` (232 lines) — move-up/move-down ordering of the course's faculties
  (aggregated with the existing `facultyGroups`), current vitfac rank badge when available.
  `SelectedCoursesList.tsx` gains a `ListOrdered` per-row action (mobile + desktop) via `onPriorityClick` /
  `priorityCodes`; `FFCSTimetableTab.tsx` owns the state, loads/saves through storage, and renders the modal
  with the course's offerings.
- Both generation entry points read the stored map fresh per run
  (`storage.ffcsFacultyPriority.get()` → params `facultyPriority`).

**Tests:** `ffcsFacultyPriority.test.ts` (18 tests) + `ffcs-generate.facultyPriority.test.ts` (ordering +
sort-precedence over `sortBy`).

## Item 8 — Result-view smart filters

- `src/lib/ffcsResultFilters.ts` (198 lines, pure) — `buildingOf` (venue prefix; `NIL`/empty = unknown so
  roomless rows are never "same building"), `theorySessionOf` (excludes labs; end times vs the lunch
  boundary), `slotSignature` / `uniqueSlotLayouts` (their "Group by Slot"), `planHasFaculty`,
  `applyResultFilters`.
- `FFCS/components/FFCSResultsFilterBar.tsx` (130 lines) — pills **All / Morning / Evening / Mixed**,
  **Same Building**, faculty/course-code search, **Group by slot layout**, plus filtered-count display.
- Wiring: `FFCSGeneratorSubpage.tsx` (options pane + results grid + empty state, filters reset per run) and
  `FFCSGuidedSelector.tsx` (`autoResultsList` memo; carousel arrows and "Recommendation X of Y" walk the
  **filtered** list; guided filter reset per run).
- Pure view-state — generation untouched.

**Tests:** `ffcsResultFilters.test.ts` (**18 tests**) mirroring their `tests/building-filter.test.cjs`
semantics.

## Item 9 — PDF report with "Clashes With" column

- `src/lib/ffcsClashPairs.ts` (170 lines, pure) — `courseClashPairs(courses, schema): Map<courseId, CourseClash[]>`
  on `periodsForSlot` + `findPeriodClash`; works for hand-built (clashable) plans as well as generated ones.
- `src/lib/exportClashReport.ts` (356 lines) — jsPDF text-table report on the `portraitDossier.ts` machinery,
  **8 columns including `CLASHES WITH`**, footer "N clashes detected — generated plans are clash-free by
  construction"; `downloadClashReportPdf` helper.
- Wiring: `ExportDossierWidget` (`onDownloadClashReport` prop) + `FFCSTimetableTab` (dynamic-import callback
  with the existing `setIsDownloading` pattern, classic-mode export menu entry **"Download Clash Report (PDF)"**,
  `track("export_clash_report")` — new event added to `src/lib/analytics.ts`).

**Tests:** `ffcsClashPairs.test.ts` + `exportClashReport.test.ts` (22 tests together) — overlap math, no-false-
positives, column layout, clash-count footer.

## Issue templates

`.github/ISSUE_TEMPLATE/{bug_report.md, feature_request.md, config.yml}` — adapted for this repo: device/
browser, route (`/`, `/ffcs`), sync mode + custom API URL, demo mode, build info from `src/data/buildInfo.json`,
`pnpm lint/typecheck/test` reproduction commands (their templates were the shape reference).

## Prettier + Husky

- devDeps `prettier@3.9.10`, `husky@9.1.7`, `lint-staged@17.6.0`; scripts `format`, `format:check`,
  `prepare` (`husky`), `catalogue:build`.
- `.prettierrc`: double quotes, semicolons, `trailingComma: all`, `printWidth: 120`, LF — matched to dominant
  existing style (deliberately wider than CodeChef's 100 to minimise churn).
- `.prettierignore`: `public/`, `src/data/`, `out/`, `.next*/`, lockfile, generated assets + the ported CSV.
- `.husky/pre-commit` → `pnpm exec lint-staged` → `prettier --write` on staged `js/jsx/ts/tsx/css/md/json`
  (hooksPath verified). **No mass reformat** — files normalised as they're touched; CI `format:check` deferred
  to the follow-up pass recorded in the plan.

---

## Follow-up fixes (user review round 1)

Two gaps reported after the port landed:

### 1. The "detailed" PDF now carries the students' curriculum, not just a course list

The report's aim is for a student to **copy each course's curriculum** — when every class meets — so the
flat course table gained a second section that expands every slot into real sessions:

- `src/lib/exportClashReport.ts` — new exported `buildCurriculumSessions(courses, schema)`:
  - each course's slot tokens go through `splitSlots` + `periodsForSlot` (the same lookup the clash
    arithmetic uses, so the two sections can never disagree);
  - duplicate periods (two spellings naming one period, or a course listed on two rows) collapse by key;
  - **consecutive periods of one class merge into one block** — a lab's `L1+L2` pair prints as
    `08:00-09:40`, the way a student experiences it, not as two adjacent rows;
  - ordered day-major (Mon→Fri), then start time, then code: read down a day and the whole week falls out.
- New `CURRICULUM_COLUMNS` (7 columns, same 171 mm width) and a rendered **"Weekly Curriculum"** section
  after the clash table: DAY / TIME / TYPE / COURSE / TITLE / VENUE / FACULTY, zebra stripes **by day** so
  one day reads as one band, COURSE cell coloured with the course's own colour (cross-referencing the table
  above), page-continuation title like the clash table. The clash table and its `CLASHES WITH` column are
  unchanged — the curriculum is the report's body now, clashes stay as the verdict.
- `src/lib/ffcsClashPairs.ts` — the shared zero-padded clock formatter is now exported as
  `formatMinutesOfDay` (one implementation for both tables' TIME cells).

### 2. Per-course faculty priority finally has entry points in the autogenerator UI

Both generation runs already read `storage.ffcsFacultyPriority` fresh — what was missing was any way to
_set_ it after locking target courses. Now:

- `FFCSGeneratorSubpage.tsx` owns `facultyPriority` state (load once, save straight back to storage, same
  contract as `FFCSTimetableTab`) and renders `FacultyPriorityModal` itself:
  - the focused-course panel header gains **"Prioritise faculties"**, appearing once the target has chosen
    offerings (or an existing order) — becoming **"Priority (N)"** when an order is saved;
  - the mobile locker BottomSheet gets the same button above the offering list;
  - the left-nav target entries show a small `ListOrdered` **N badge** when a course is already ranked.
- `FFCSGuidedSelector.tsx` (same state + modal, lazy `dynamic` import like the swap sheet):
  - both inline **"Preferred Faculty"** chip sections (search mode and imported-list mode) gain a
    **"Prioritise"** chip once at least one faculty is ticked;
  - the dedicated slots/faculty screen's **"2. Preferred Faculty"** header gains a standing
    **"Prioritise Order"** action beside "Clear Faculty".
- Both surfaces open the same `FacultyPriorityModal`, whose pool is every offering row of that course code;
  saves land in `ffcs_facultyPriority`, which both solvers already honour.

### 3. The ranking is scoped to the faculties you selected

Refinement on 2: when a course already has chosen faculties, the ranking sheet asks you to order **those**,
not the whole catalogue. The solver already filtered to the selection before applying the order, so a
catalogue-wide list was noise — every name you did not pick would sort somewhere you cannot act on.

- `FacultyPriorityModal` — new `selectedFaculties` prop; when non-empty the pool (rank list + "Add a
  faculty…" menu) is filtered to those names, and a note states the scope ("Ranked among the N faculties
  you selected for CODE…"). Empty selection = whole catalogue, as before.
- `FFCSGeneratorSubpage` — `selectedFacultyNamesOf(code)` derives the names from the lock's
  `allowedFaculty` plus the faculties of its chosen offerings, matched with the same `offeringMatches` the
  solver filters with (a combined `THEORY / LAB` row contributes both names via `splitFacultyNames`), so
  the sheet scopes to exactly the set generation will consider.
- `FFCSGuidedSelector` — passes the lock's `allowedFaculty` at all three open sites.
- Saving an order for a scoped course stores only the scoped names — precisely the order the solver walks.

### Tests added in this round

| File                                   | What                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `exportClashReport.test.ts`            | +5: curriculum columns, expansion, lab-block merge, dedupe, day-major order, PDF prints the section   |
| `ffcsGeneratorSubpage.render.test.tsx` | +1: entry appears after faculty pick, ranking scoped to the selection, order round-trips into storage |

---

## Verification

- `pnpm test` → **136 files, 1980 passed, 2 skipped** (after the follow-up round; 1973 at first landing).
- `pnpm typecheck` → clean.
- `pnpm lint` → 0 errors (130 pre-existing warnings, none in files touched by this port).

### Test hardening along the way

- `ffcsGuidedSelector.render.test.tsx` — the two "regression" failures were actually **network flakiness**:
  `handleRunAutoGeneration` awaits the live Vitfac catalog (~1.6 s) against `waitFor`'s default 1 s budget,
  and HEAD failed intermittently too (reproduced in a clean worktree). Fixed by mocking
  `loadVitfacRankingData` to resolve instantly with no ratings (reviews are irrelevant to what the file
  asserts) — 3/3 consecutive green runs afterwards.
- `ffcsSettingsModal.test.tsx` — the new All Subjects Mode description contained the substring
  "generation", colliding with the side-pane query `getByText("Generation", { exact: false })`; reworded to
  "the solver retries" (14/14 green).

### New/updated test files in this port

| Test file                               | Focus                         |
| --------------------------------------- | ----------------------------- |
| `ffcsCodechefCatalogue.test.ts`         | Item 4 (17 tests)             |
| `ffcsDropPolicy.test.ts`                | Item 5 pure policy            |
| `ffcsGenerationRun.dropLadder.test.ts`  | Item 5 retry ladder (7 tests) |
| `ffcsSettings.test.ts` (extended)       | Item 5 setting                |
| `ffcsFacultyPriority.test.ts`           | Item 6 (18 tests)             |
| `ffcs-generate.facultyPriority.test.ts` | Item 6 ordering/precedence    |
| `ffcsResultFilters.test.ts`             | Item 8 (18 tests)             |
| `ffcsClashPairs.test.ts`                | Item 9 clash math             |
| `exportClashReport.test.ts`             | Item 9 PDF layout             |
| `ffcsReports.test.ts` (updated)         | Item 4 registry ids           |
| `ffcsGuidedSelector.render.test.tsx`    | Vitfac mock hardening         |
| `ffcsSettingsModal.test.tsx` (fix)      | Copy collision fix            |
