# FFCS Planner — Implementation Hardening Plan

**Date:** Oct 21, 2026
**Status:** Complete — all 7 phases landed; `pnpm test` (1547 passing), `typecheck`, `lint` (0 errors) and `build` (static export incl. `/share/ffcs`) all green

## Progress log

### Phase 7 — complete (sweep: tests, lint, build, docs)

- Gates: `pnpm test` 89 files / 1547 passed / 6 skipped; `pnpm typecheck` 0;
  `pnpm lint` 0 errors, 120 warnings (baseline 0/125 — five fewer, from
  quote-escaping in the rewritten guide); `pnpm build` static export OK with
  `/share/ffcs` prerendered.
- README features table gains an FFCS row; `guide.md` gains a client-side FFCS
  section (share route, `ffcs_*` storage namespace, generator worker) — it
  documents that the planner calls no endpoints, because it makes none.

### Phase 6 — complete (token migration, primitives, guide)

- Equivalences verified against amazeui's `tailwind.css` before sweeping:
  `bg-muted` ≡ `bg-surface-secondary` (`--color-muted`) and `border-border` ≡
  `border-border-strong` (`--color-border` → `--border-strong`, so the plan's
  "map to muted" reading would have been a visual regression, not a rename);
  `bg-background`→`bg-surface` and `text-foreground`→`text-text-heading` are
  the deliberate paradigm swap. No FFCS root painted `bg-background`, so no
  page canvas moved — every occurrence was a well, input or thumb.
- ~250 replacements across 13 files (26 `bg-background`, 92 `text-foreground`,
  61 `bg-muted`, 71 `border-border`, 5 `solid-card`). `solid-card` →
  `card-surface border border-border-strong rounded-2xl shadow-xs
  text-text-primary`, preserving the old class's radius and ink.
- The tab's last three native `<select>`s → `ChipTabs`/`SegmentedControl`:
  OptionPicker's popup portals at z-70, *under* the tab's own fullscreen
  `z-[100]`, so the tab body cannot host a portal picker at all — the same
  trap that converted the subpage's pickers.
- `FFCSGuideModal` rewritten: stale "Add to Draft" flow gone; paste/CSV/XLSX
  import; the generator workspace (Stop, compare, five ranking opinions with
  one-liners read off the actual profile weights — the old guide claimed
  Social Score fed Balanced, which the port does not do); friend import via
  Backup JSON; new Settings/Share/Tour section.
- Changelog: `v3.2.0` (2026-10-21) at the top of `changelog.json`.

### Phase 4 — complete (share links)

- `src/lib/ffcsShare.ts`: versioned lz-string codec — exact-version check
  decodes to `null` rather than misparsing, fresh timetable id per decode, and
  a field-picked payload (name + courses + campus; no friends, no locks).
  `buildShareUrl` honours `NEXT_PUBLIC_BASE_PATH` + `trailingSlash`; links
  over 8000 chars warn the sender.
- Route `/share/ffcs/`: prerendered shell + `useSearchParams` inside Suspense
  (the only pattern that survives `output: 'export'`), read-only grid,
  metric chips, PNG download, and "Open in planner" writing `ffcs_timetables`
  under a fresh id with the active plan switched to it.
- `GLOBAL_CAMPUS`/`CAMPUS_SCHEMAS`/`getTimetableSchema` moved to
  `src/lib/campusSchema.ts` so the view renders without importing the
  2,700-line tab (tab re-exports for its other importers).
- Tab: share button (native share sheet → clipboard fallback, `AbortError`
  treated as cancel, oversized-link warning). Tests: `ffcsShare.test.ts` (10).

### Phase 3 — complete (settings, tour, tips)

- `ffcs_settings` holds only the new prefs (ranking default incl. "none",
  default sort, export format, min half-days, result cap, tour); grouping and
  social method stay on the tab's own state (single source of truth, existing
  keys); analytics consent is its own key and survives a settings reset.
- `FFCSSettingsModal` as a sheet; settings + share buttons in the banner;
  `resultCap` binds only when the run is not `noLimit`.
- `features/tour/`: 6 anchors, once-`TOUR_VERSION` auto-start (600 ms), a
  sibling spotlight layer at z-500 found via `data-tour-id`, capture-phase key
  swallowing; `SettingsModalHost` bridges `useTour()` across the tab's
  early return; dismissible tips; share step added to the `ffcs` help guide.
- Tests: `ffcsSettings.test.ts`, `ffcsTour.test.tsx`,
  `ffcsSettingsModal.test.tsx` — 29 across settings/tour/modal/analytics.

### Phase 5 — complete (usage analytics)

- `src/lib/analytics.ts`: typed count-only events behind the
  `ffcs_analytics_enabled` consent key with a capped local queue; 9 tests.
- Wired to generation, save, import and share events. A settings reset does
  **not** flip consent — that toggle belongs to the student alone.

### Generator is a subpage of the FFCS tab, not a sheet — complete

- `FFCS/components/modals/AutoGeneratorModal.tsx` → `FFCS/FFCSGeneratorSubpage.tsx`.
  It takes the tab's screen through an early return in `FFCSTimetableTab`, the
  same route the rest of the app takes for drill-downs (`SubpageLayout` +
  `useSubpageStack` have 13 `*Subpage.tsx` siblings, and the overlay stack's own
  doc calls out "in-tab subpages"). Every piece of planner state stays passed
  down from the tab: nothing is copied, serialised or re-fetched, and back
  leaves with nothing lost.
- Shell: `SubpageLayout` supplies back + title; Generate, Stop and the live
  count sit in a sticky toolbar rather than the layout's `action` slot — that
  slot is a shrink-0 box beside the title, and the controls would squeeze a
  phone's title to nothing.
- System back is registered through `useOverlayBack`, exactly as it was while
  this was a sheet; the nested dash/gap/variant sheets keep pushing entries
  above it, so a gesture still dismisses them first.
- `closeGenerator` clears the run's notices on the way out, because they
  describe results that only exist on that screen. The run's own messages
  ("Found N… review them below!") are now rendered by the subpage itself —
  previously they were written into the planner's banner *behind* the sheet,
  where they were invisible until you closed it and outlived the results they
  pointed at. A save sets the planner's confirmation after closing, in the same
  tick, so the last write is the one that sticks.
- The tab's keyboard shortcuts are gated while the subpage is open: every other
  key would only set state that nothing renders, and `1`-`9`/Backspace would
  act on the planner behind it. `g` closes it.
- Tests: `ffcsGeneratorSubpage.render.test.tsx` (5) — generate gating, notice
  precedence, and the system-back contract.

### Every FFCS popup is a bottom sheet — complete

- All 17 overlays across 8 files render through `shared/BottomSheet`: target
  courses, course/slot search, faculty schedule, social matrix, friend
  timetables, friends manager, guide, shortcuts, timetable selection, manual
  linker — plus the generator's own nested dash, gap and variant dialogs.
- Sheets pass their previous z-index (`panelZIndex`/`backdropZIndex`) on
  purpose: the tab goes fullscreen at `z-[100]` and sheets portal to `<body>`,
  so a default z-60 sheet would land behind it. Nested dialogs sit at 210/220
  for the same reason.
- `BottomSheet` panels carry `data-prevent-swipe="true"`: the dashboard's
  swipe-to-change-tab listens document-wide and only bails inside a guarded
  subtree, which portalled sheets no longer are.
- Fixed a conditional `useMemo` behind an early return in `SocialMatrixModal`.

### Phase 2 — complete (input: smart paste + CSV/XLSX)

- `src/features/import/`: `normalizeColumns` → `parsePastedText` →
  `importFile` — `.csv`/`.tsv`/`.txt` read as text, workbooks through SheetJS
  (dynamically imported, as the rest of the app does); 68 tests.
- `CourseImportPanel`: paste and file modes with a row-level preview before
  anything lands; the file path stops at a preview, never a silent merge.
- `TargetCoursesModal` retitled as the course selector: Search | Paste | File
  tabs over the same panel; `handleImportCourses` owns merging into the
  master list (the modal never mutates it).

### Phase 1 — complete (engine: streaming, cancellation, additive ranking)

Landed:

- `FFCS/logic/generate.ts`: `walkCombinations` (visitor + `TICK_INTERVAL` tick),
  `generateTimetablesStream(params, hooks)`, `capped` on the ok branch, a
  `cancelled` branch, optional `rankingMode`.
- `FFCS/workers/generator.worker.ts`: typed protocol; a bare `GenerateParams`
  still gets `success` as its **first** reply, so `worker-artifact.test.ts`
  (which reads `replies[0]`) is unaffected. Streaming is opt-in on
  `onBatch`/`onProgress`.
- `FFCS/logic/generator.ts`: `startGeneration` → `GenerationHandle`
  (`{result, cancel}`); `generateTimetablesAsync` kept as the one-shot form.
  Worker cancel is `terminate()` (the walk is synchronous, so a cancel message
  could never be read); inline cancel is a cooperative `shouldStop` polled every
  4096 nodes.
- `src/lib/ffcsRanking.ts`: 5 profiles, `rankingInputs`, `scoreRanking`,
  `rankCourses`, `asRankingMode`, `RANKING_MODES`.
- `FFCS/hooks/useGenerationRun.ts` + wiring into `AutoGeneratorModal`: batches
  stream into `stagedTimetables` as they are found, with live counts, a
  `Stop` button and `aria-live` progress.
- Tests: `ffcs-generate-stream.test.ts` (17), `ffcsRanking.test.ts` (25).

**Bug found and fixed by the new tests — not introduced by this work.** Confirmed
against `git show HEAD` that `backtrack` had the same shape. The precompute loop
concatenated *every* offering's periods into one array per course, and the walk
tested that union against the week already chosen — identically for each
offering. So for a course with slots `S1` and `S2`, if `S1` clashed with an
already-chosen course, `S2` was rejected alongside it and the whole course was
dropped from the search. It stayed invisible because every fixture before this
plan gave each course exactly one offering; it is invisible in production too,
because it produces *fewer* results rather than an error. `windowsPerCourse` is
now `SlotPeriod[][][]` — per course, per offering — and the walk tests only the
offering it is about to take. `ffcs-generate.test.ts` passes unchanged.

## Context

AmazeCC's FFCS engine (`slots.ts`, `timetableMetrics.ts`, `logic/generate.ts`) is
technologically stronger than the reference "Ultimate FFCS Planner"
(`C:\Users\sugee\Github\mrRR7\ffcsmaker`) — schema-driven slots, law/embedded
handling, social/friends scoring, manual linking, worker verification. What it
lacks is *implementation*: input paths, progressive results, share, settings,
guidance, analytics, and tests.

This plan ports ffcsmaker's implementation features onto AmazeCC's engine
**without replacing the engine**.

## Ground rules (agreed with user)

1. **Client-side only** — no new backend; share via encoded URLs, analytics via
   Google Analytics + a local event queue.
2. **Keep AmazeCC's solver** — add streaming, cancellation, and a result cap.
   Do not alter existing search semantics.
3. **Paste + CSV/XLSX import** only (no live catalog, no VTOP scraper).
4. **Full FFCS tab migration** onto the current UI paradigm.
5. **FFCS-specific settings modal**, persisted in its own localStorage namespace.
6. **Weighted ranking profiles added additively** — new metric/score; existing
   sorts and default behaviour untouched.

## Hard constraint

`next.config.mjs` sets `output: 'export'` → GitHub Pages static deploy
(`.github/workflows/nextjs.yml` publishes `./out`). There are **no server routes**
and **no Supabase client** in `src`. Everything below is client-side.

---

## Phase 1 — Engine: streaming + cancellation + additive ranking

- `FFCS/logic/generate.ts`: extract the backtrack into a shared walker that can
  emit complete combinations; add `generateTimetablesStream(params, hooks)` with
  `onBatch` / `onProgress` / `shouldStop`.
- Preserve the error contract exactly: `no_courses_selected`, `no_valid_slots`,
  `no_conflict_free`, `below_min_half_days`, `error`. Existing
  `generateTimetables` becomes a thin collector over the stream so
  `ffcs-generate.test.ts` keeps passing.
- Keep `limit` as the search cap; add a `capped` flag when stopped early.
- `FFCS/workers/generator.worker.ts`: typed protocol
  - in: `{type:"start", params}` · `{type:"cancel"}`
  - out: `{type:"batch"}` · `{type:"progress"}` · `{type:"done", capped}` ·
    `{type:"error"}`
- `FFCS/logic/generator.ts`: `generateTimetablesAsync(params, {onBatch, signal})`
  so the UI renders the first batch immediately and appends the rest lazily.
- **New** `src/lib/ffcsRanking.ts`: ffcsmaker's weighted profiles
  (Balanced / Half Days / Minimize Gaps / Early Finish / Late Start) + score
  breakdown over AmazeCC's `TimetableMetrics`. Optional `rankingMode` in
  `GenerateParams`, `scoreBreakdown` on `TimetableState`; default path unchanged.
- **Tests:** `generate-stream.test.ts`, `ffcsRanking.test.ts`.

## Phase 2 — Input: smart paste + CSV/XLSX

- **New** `src/features/import/parsePastedText.ts` — port ffcsmaker's parser,
  adapted to AmazeCC's `ParsedCourse`, with law-slot + embedded handling.
- **New** `src/features/import/importFile.ts` + `normalizeColumns.ts` —
  normalize → validate → transform; reuses `xlsx` + `react-dropzone`.
- **UI:** `Search | Paste | File` segmented control in the Course Selector with
  a live preview table (confidence + errors) before import. Static
  `ffcsReport.csv` stays the fallback.
- **Tests:** `parsePastedText.test.ts`, `importFile.test.ts`.

## Phase 3 — Settings modal + guided tour + tips

- **New** `src/lib/ffcsSettings.ts` — typed settings + `useFFCSSettings` hook,
  persisted under `ffcs_settings` (new key in `lib/storage.ts`).
- **New** `FFCS/components/modals/FFCSSettingsModal.tsx` — `BottomSheet` +
  `SettingRow`/`Switch`/`SelectField`: ranking mode, export prefs, default
  sortBy, min-half-days, result cap, campus, group default, social method,
  analytics opt-out, show-tour toggle, reset.
- **New** `FFCS/features/tour/` — `tourSteps.ts`, `TourProvider`,
  `TourSpotlight` (anchors via `data-tour-id`), persisted `ffcs_tour_seen`;
  `useTips` + dismissible `Tip` cards. Add an `ffcs` entry to
  `TabHelpFooter.TAB_GUIDES`.
- **Tests:** settings persistence, tour render/persist.

## Phase 4 — Share page

- **New** `src/lib/ffcsShare.ts` — `lz-string` encode/decode with version +
  shape validation and an oversize warning.
- **New** `src/app/share/ffcs/page.tsx` — static route; `useSearchParams`
  wrapped in `Suspense` (required by static export, same as
  `ShareTargetView.tsx`). Read-only timetable, metrics, course list, PNG share
  card, "Open in planner".
- **`package.json`:** add `lz-string`.
- **Tests:** `ffcsShare.test.ts`, share-page render test.

## Phase 5 — Usage analytics

- **New** `src/lib/analytics.ts` — consent-gated `track(event, props)`; GA
  `gtag` sink + capped local queue (`ffcs_analytics_queue`); typed event map
  (`generation_started/done`, `share_created`, `export_*`, `import_*`,
  `settings_changed`, `tour_step`). Counts only — no PII.
- **Tests:** `analytics.test.ts`.

## Phase 6 — Full FFCS tab migration (new paradigm)

- Migrate `FFCSTimetableTab.tsx` + all modals onto `uiTokens.ts` and
  `shared/primitives`:
  - `bg-background`→`bg-surface`, `text-foreground`→`text-text-heading`,
    `bg-muted`→`bg-surface-secondary/tertiary`, `border-border`→`border-border-muted/strong`,
    `solid-card`→`card-surface`/`TILE`.
- Replace the inline toggle with `Switch`; replace fixed modals with
  `BottomSheet` (registered in `overlayStack` for predictive back).
- New generator modal with progressive/lazy results + compare.
- Update `FFCSGuideModal.tsx`; add changelog entries.

**Risk:** largest diff. Phases 1–5 land on the current UI first so they are
testable in isolation; migration follows as a dedicated pass.

## Phase 7 — Test sweep + docs

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (CI runs all four).
- Update `README.md` + `guide.md`; add changelog entries.

---

## Out of scope

- Live Supabase catalog, VTOP scraper, server-side saved schedules / short
  links (blocked by static export).
- Any change to existing `sortTimetables` / `timetableMetrics` behaviour.
- Non-FFCS parts of the app.

## Conventions

- Commands run with **pnpm only** (never bare `npm`).
- Semantic colour tokens from `@/lib/uiTokens`; no raw zinc/indigo steps on new
  surfaces.
- Components from `@/components/custom/shared/primitives`.
- Comment style: explain *why*, not *what*.
