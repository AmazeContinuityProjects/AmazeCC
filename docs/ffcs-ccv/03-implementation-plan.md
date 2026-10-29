# FFCS-inator → AmazeCC Port — Implementation Plan & Status

Port scope agreed from the scan in [`01-theirs-not-yours.md`](./01-theirs-not-yours.md): items **4, 5, 6, 8, 9**
plus **GitHub issue templates** and **Prettier + Husky**. Items 1, 2, 3, 7 and the "smaller things" (FAQ, four04,
email capture, OG metadata, middleware) are explicitly out of scope — 1/2/3 need a backend or a separate browser
extension deliverable, 7 is a nice-to-have deferred.

**Status legend:** ⬜ not started · 🟡 in progress · ✅ done · ⏸ deferred

| #   | Item                                                                               | Status | Primary files                                                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Offline bundled course catalogue (ported from CodeChef VIT, credited)              | ✅     | `scripts/convert-codechef-catalogue.mjs`, `public/ffcs/codechef-vit-catalogue.csv`, `src/components/custom/exams/FFCS/reports.ts`     |
| 5   | All Subjects Mode (drop lowest-priority courses instead of 0 results)              | ✅     | `src/lib/ffcsSettings.ts`, `FFCS/hooks/useGenerationRun.ts`, `FFCS/logic/dropPolicy.ts`, generator subpage + guided selector          |
| 6   | Per-course manual faculty priority ordering                                        | ✅     | `FFCS/components/FacultyPriorityModal.tsx`, `FFCS/components/SelectedCoursesList.tsx`, `FFCS/logic/generate.ts`, `src/lib/storage.ts` |
| 8   | Result-view smart filters (same building, session, faculty, slot grouping, paging) | ✅     | `src/lib/ffcsResultFilters.ts`, `FFCS/components/FFCSResultsFilterBar.tsx`, `FFCS/FFCSGeneratorSubpage.tsx`, `FFCSGuidedSelector.tsx` |
| 9   | Structured PDF report with a "Clashes With" column                                 | ✅     | `src/lib/exportClashReport.ts`, `src/lib/ffcsClashPairs.ts`, `FFCS/components/ExportDossierWidget.tsx`, `FFCSTimetableTab.tsx`        |
| —   | GitHub issue templates                                                             | ✅     | `.github/ISSUE_TEMPLATE/`                                                                                                             |
| —   | Prettier + Husky + lint-staged                                                     | ✅     | `.prettierrc`, `.prettierignore`, `.husky/`, `package.json`                                                                           |

Full per-item detail in [`04-implementation-log.md`](./04-implementation-log.md).

---

## Design basis

Architecture facts verified before writing any code (full map in the scan notes):

- Generation pipeline: `FFCSGeneratorSubpage.generateTimetables` (`:861`) and
  `FFCSGuidedSelector.handleRunAutoGeneration` (`:1243`) → `useGenerationRun.run` (`:66`) →
  `logic/generator.ts#startGeneration` → `workers/generator.worker.ts` → `generateTimetablesStream`
  (`generate.ts:1627`) → `GenerateResult` (`generate.ts:219`, string discriminants:
  `"ok" | "cancelled" | "error"`) → staged results (`stagedTimetables`, `FFCSGeneratorSubpage:299`).
- `useGenerationRun.run` never rejects; a retry loop must live here (it already auto-cancels the previous run,
  `:71`). Worker params are structured-clone only (no `Set`/functions).
- Zero results surface as `errorFor(code)` (`FFCSGeneratorSubpage:840–859`, banner `:1462–1487`) with
  `no_conflict_free` (`generate.ts:1799`) and `no_valid_slots` (`:1654`).
- Selected-course order (the priority order for item 5) = `activeTimetable.courses` array order
  (`FFCSTimetableTab:312`, appended by `handleAddCourse:1512`), grouped by code via `groupSelectedCourses`.
- Per-course offering restriction already exists as `CourseLock.offerings` (`types.ts:127`, consumed at
  `generate.ts:452` via `offeringId`/`offeringMatches` in `reports.ts:101`).
- Settings pattern: `FFCSSettings` + `FFCSSettingsDefaults` + `sanitizeFFCSSettings` (per-field fallback) +
  `useFFCSSettings()` in `src/lib/ffcsSettings.ts`; editor sheet `FFCS/modals/FFCSSettingsModal.tsx`.
- Report loading: `FFCSTimetableTab.loadSemesterReport` (`:613`) fetches `getAssetPath(report.path)` (same-origin)
  and parses via `parseReportRows` (`reports.ts:140`), which accepts `CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE`.
  Bundled CSVs are already offline-cached by Serwist's `defaultCache`
  (`static-data-assets`, NetworkFirst, 24 h — `@serwist/next` matches `/\.(?:json|xml|csv)$/i`).
- PDF: `src/lib/portraitDossier.ts` already renders **jsPDF text tables** (course table columns
  `[CODE, COURSE, TYPE, CR, SLOTS, VENUE, FACULTY]`, `:316–370`) — the natural host for a `CLASHES WITH` column.
  Clash primitives: `src/lib/slots.ts` `periodsForSlot` / `findPeriodClash` (`:354`) / `slotsOverlap` (`:374`).
- Result list precedent: `stagedVisibleCount` + `STAGED_RENDER_LIMIT = 60` + "Show N more"
  (`FFCSGeneratorSubpage:127,299,1517–1593`); variant grouping already exists (`groupVariants`, `generate.ts:1421`,
  renamed `Option N`).

---

## Item 4 — Offline bundled catalogue, credited to CodeChef VIT

**Requirement:** our catalogue must work **fully offline and never touch `api.amazecc.com`** — i.e. ship the data
as first-party static assets. Port their school folders and **credit the CodeChef FFCS website**.

Approach:

1. **Converter** `scripts/convert-codechef-catalogue.mjs` (Node, run manually — wired as a `pnpm` script):
   - Source: `../ffcs/src/data/` (20 school folders, 146 TS files, 5 502 offering rows, 783 courses), MIT © 2025
     CodeChef-VIT.
   - Transpiles each TS file with the installed `typescript` (`transpileModule`) and evaluates it in a `vm` sandbox
     with a small resolver for `./X` / `./X/index.ts` imports, harvesting every exported object shaped
     `{ "CODE - Title": [{ slot, venue, faculty }] }`.
   - Emits `public/ffcs/codechef-vit-catalogue.csv` in the header set our loader already accepts:
     `CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE` (one row per offering, deduped, sorted by code+slot).
   - **TYPE:** every slot lab-prefixed (`L…`) → `LO`, else `TH` (matches the previous report's vocabulary; the
     winter report ships no TYPE at all, so `TH`/`LO` only improves grouping).
   - **CREDITS:** lab-only → 1, theory → 3 (the two dominant classes in `ffcsReport.csv`), **overridden** by an
     exact `CODE` join against our two existing bundled reports, which carry real credits for overlapping codes.
     Heuristic documented in the attribution file.
   - `MIS ('25 Batch)` / `X ('25 Batch)` and `_F` fresher folders are included as-is (they're just catalogue
     entries; the student picks what applies to them).
2. **Attribution (explicit requirement):**
   - `public/ffcs/codechef-vit-catalogue.SOURCE.md` — provenance, MIT license text reference, URL
     **https://ffcs.codechefvit.com**, conversion date, row counts, credit heuristic.
   - `reports.ts` — new optional `attribution` field on `FFCSSemesterReport`, populated for this report.
   - Visible credit in the UI next to the report switcher ("Catalogue data: CodeChef VIT – ffcs.codechefvit.com").
   - Header comment in the converter script + note in this doc and `04-implementation-log.md`.
3. **Wiring:** add id `"codechef-vit"` to `FFCSSemesterId` + `FFCS_SEMESTER_REPORTS`; update
   `src/__tests__/ffcsReports.test.ts` (asserts the exact id list). Publish to `ffcs_raw_courses` alongside
   `"previous"` (it carries `VENUE`, unlike the winter list) so Free Classrooms and offline reloads see it.
   Report picker (`SegmentedControl`, `FFCSTimetableTab:1935`) picks the third entry up automatically.
4. **Offline guarantees:** same-origin `/ffcs/*.csv` (part of the static export — never `api.amazecc.com`),
   Serwist `static-data-assets` NetworkFirst cache, preload on the `/ffcs` route (default report preload path
   unchanged), parsed courses persisted in `ffcs_raw_courses`.

## Item 5 — All Subjects Mode

Semantics (ported from `CourseCard.tsx:179`):

- **ON (default, current behaviour):** only timetables containing _all_ selected courses are acceptable.
- **OFF:** if no full assignment exists, the generator retries while dropping courses from the **tail of the
  selected-course order** (add order = priority order), producing plans that exclude the lowest-priority courses
  instead of showing zero results.

Approach:

1. Settings: `allSubjectsMode: boolean` (default `true`) in `FFCSSettings`/`Defaults`/`sanitize`, editor toggle in
   `FFCSSettingsModal` with the same explanation copy as theirs.
2. Retry engine in `useGenerationRun.run`: when `params.dropPolicy` is present (built from settings + course
   order, excluding courses that have generator target locks — never silently drop a locked target):
   - attempt 0 = all courses (identical to today);
   - on `"error"` with `no_conflict_free` / `no_valid_slots`, or success with **zero** timetables, retry with
     `{lowest priority} dropped`, then the two lowest, … up to a small cap (`3` drops), stopping at the first
     attempt that yields results;
   - returns `GenerateResult` plus `droppedCourses: string[]` (optional field on the union — worker never sets it,
     the wrapper does), so both call sites can render an amber notice:
     _"All Subjects Mode is off — plans shown without: CSE3001, MAT2005."_
3. Keep the pure solver untouched except for accepting the new optional param plumbing (single-pass behaviour for
   a fixed course set is already correct).

## Item 6 — Per-course manual faculty priority

Semantics (ported from `FacultySelector.tsx:277,871`): for each selected course the student can order the
available faculties ("prefer A over B over C"); generation honours the order.

Approach:

1. Storage: new localStorage key `ffcs_facultyPriority` → `Record<courseCode, string[]>` (ordered faculty names;
   matched against `ParsedCourse.FACULTY`, split on `/` for combined theory/lab halves), accessor added to
   `src/lib/storage.ts`.
2. UI: `FacultyPriorityModal` (new) opened from a "priority" action on each row of `SelectedCoursesList` —
   faculty for the course aggregated with the existing `logic/facultyGroups.ts`, ordered via move-up/move-down
   buttons (mirrors the existing `rankingPriorityOrder` control at `FFCSGuidedSelector:3756`, and avoids a
   drag library), current vitfac rank badge shown when available.
3. Generation: optional `facultyPriority?: Record<string, string[]>` on `GenerateParams`:
   - `optionsFor` sorts each course's offerings so preferred faculties come first (affects streaming order and
     which variants survive `resultCap` / `dedupeByFaculty`);
   - the final ordering (`generate.ts:1823`) uses an added `facultyPriority` score as the primary sort key when
     present, so preference is not lost to `sortBy`.
   - Also blended into the ranking verdict where a profile is active? — **No**: keep `ffcsRanking` untouched;
     preference acts purely on ordering, like theirs. Documented here so the choice is reversible.
4. Both generation entry points pass the stored map into params; unit tests cover ordering + sort precedence.

## Item 8 — Result-view smart filters

Ported from `ViewTimeTable.tsx` + `filterUtils.ts`, adapted to AmazeCC's staged-results list:

1. New pure module `src/lib/ffcsResultFilters.ts` (+ tests mirroring `tests/building-filter.test.cjs` semantics):
   - `buildingOf(venue)` / `isSameBuildingPlan(plan)` — venue prefix (letters before digits), `NIL`/empty treated
     as unknown so plans with roomless rows are _not_ silently "same building";
   - `theorySessionOf(plan, schema)` → `"morning" | "evening" | "mixed"` using period end times vs the lunch
     boundary (same rule the guided selector's slot filter uses, `FFCSGuidedSelector:1094`);
   - `planHasFaculty(plan, query)`; `uniqueSlotLayouts(plans)` (one representative per slot-signature — their
     "Group by Slot", built on our existing variant grouping).
2. New `FFCSResultsFilterBar` (ChipTabs/SegmentedControl primitives, matching `ExportDossierWidget:63–118` styling)
   inserted above the generated-results list in `FFCSGeneratorSubpage` (and the guided `auto_results` list):
   pills **All / Morning / Evening / Mixed**, **Same Building**, faculty search input, **Group by slot layout**
   toggle, plus a windowed numbered pager (prev/next + page numbers) for the results list, replacing the plain
   "Show N more" affordance once filters are active. Filtered count shown next to "Results (N)".
3. No changes to generation — filters are pure view-state.

## Item 9 — Structured PDF report with "Clashes With"

1. New `src/lib/ffcsClashPairs.ts` (+ tests): `courseClashPairs(courses, schema): Map<courseId, CourseClash[]>`
   using `periodsForSlot` + `findPeriodClash` — returns, per course, the _other courses_ it overlaps (by code,
   with the clashing day/time detail). Works for hand-built plans (which can clash) as well as generated ones.
2. New `src/lib/exportClashReport.ts` (+ tests): `createClashReportPdf(...)` built on the same jsPDF text-table
   machinery as `portraitDossier.ts`, adding the eighth column **`CLASHES WITH`** (their exact feature) and a
   footer line "N clashes detected — generated plans are clash-free by construction".
3. Wiring: `ExportDossierWidget` gains a "Detailed report (PDF)" action (lazy-loaded like the other exports), and
   the classic-mode export menu in `FFCSTimetableTab` gets the same entry.

## Issue templates

`.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md` + `config.yml`, adapted for this repo: device/
browser, route (`/`, `/ffcs`), sync mode + custom API URL, demo mode, build info from `src/data/buildInfo.json`,
`pnpm lint/typecheck/test` reproduction commands. (Their templates were used as the shape reference.)

## Prettier + Husky

- devDeps: `prettier`, `husky`, `lint-staged`; scripts `format`, `format:check`, `prepare: "husky"`.
- `.prettierrc` matched to dominant existing style: double quotes, semicolons, trailing commas, `printWidth: 120`
  (deliberately wider than CodeChef's 100 to minimise churn on this codebase's long JSX lines).
- `.prettierignore` covers generated/vendored assets: `out/`, `.next*/`, `node_modules`, `pnpm-lock.yaml`,
  `tsconfig.tsbuildinfo`, `public/`, `src/data/`, `src/__generated__/`… plus the ported catalogue CSV.
- `.husky/pre-commit` → `pnpm exec lint-staged` → `prettier --write` on staged `js/jsx/ts/tsx/css/md/json`.
- **No mass reformat**: the repo is normalised file-by-file as it is touched; `format:check` is not added to CI
  until that pass happens (recorded as a follow-up).

---

## Follow-ups (out of scope, recorded for later)

- Server-side saved timetables + accounts, short share links with privacy gating, per-share OG metadata (item 1/2).
- "My VTOP" + "FFCS Contributors" browser extensions (item 3).
- Standalone `/slots` exploratory slot view (item 7).
- Whole-repo `prettier --write` normalisation, then a CI `format:check` step.
