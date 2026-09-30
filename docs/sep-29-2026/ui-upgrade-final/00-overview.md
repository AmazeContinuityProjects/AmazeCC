# UI upgrade — final: adopting the course-subpage primitives everywhere

**Date:** 2026-09-29
**Status:** planned, not started
**Baseline:** 854 tests passing across 46 files; working tree has 14 modified + 6 untracked files in the timetable/FFCS area
**Reference implementation:** `src/components/custom/exams/CourseDetailSubpage.tsx` (`innerTab === "overview"`, L1388-1550)
**Out of scope:** home screens — `mobile/MobileHome.tsx`, `mobile/SimplifiedMobileHome.tsx`

## What this is

The course subpage overview and the mobile home already speak one grammar: `InsightCarousel`
heroes over a `ListShell` of `LIST_ROW` rows, each row a 40×40 `TONE_ICON_TILE` on the left,
`ListRowText` in the middle, a value and `ChevronRight` on the right. That grammar was written
into `@/lib/uiTokens` and `shared/primitives/` and then used by about a dozen screens.

Everything else rolled its own.

| Measure | Count |
|---|---|
| `.tsx` files in `src/` | 215 |
| Import `shared/primitives` | 27 |
| Import `@/lib/uiTokens` | 22 |
| Import **both** | **16** |
| Import **neither** | **182** |

So the primitives are a minority position, and the old dialect is not a memory — it is a live
dependency. 77 files import `@amazecontinuityprojects/amazeui` directly, and 20 files in
`src/components/custom/shared/` are one-line re-exports of its gray+blue components, reached
from roughly 60 call sites.

This plan converts the remaining 182 files, in six phases, cheapest first.

## Locked decisions

| Question | Decision |
|---|---|
| Scope | All 182 files, in 6 phases |
| Reference implementation | `CourseDetailSubpage` overview block (L1388-1550) |
| Second reference | `attendance/CalendarSubpage.tsx` — 0 violations, 15 primitives |
| Third reference | `events/EventHubTab.tsx` — 1 violation |
| Best tone discipline | `libraries/LibrariesTab.tsx` — the only file with no local tone map |
| amazeui shims | Migrate the ~60 call sites, then **delete all 20 shim files** |
| Foreign dialects | Converted too, in Phase 5 — not left behind |
| Radius | **Code wins.** `DESIGN_LANGUAGE.md` is updated to match what ships |
| Suspected dead code | Verify reachability first; delete if confirmed dead, never migrate |
| Home screens | Excluded. Already on-grammar |
| amazeui package itself | Never edited — it is a published dependency |

## Phases

| Phase | Work | Independently testable |
|-------|------|------------------------|
| 0 | Reachability check, delete dead code, sync `DESIGN_LANGUAGE.md` radius scale | yes |
| 1 | Prove the grammar: ~5 near-clean files, 1-3 swaps each | yes |
| 2 | The big zinc offenders: `OverallAttendancePredictor`, `SimplifiedAcademicsPage`, both qbank tabs | yes |
| 3 | Kill tone-map shadowing and duplicate token homes | yes |
| 4 | Shim migration, then delete the 20 re-export files | yes |
| 5 | The four foreign-dialect rewrites (FFCS, hostel, dayscholar, CabShare) | yes |
| 6 | Convert the reference implementation itself | yes |

Each phase typechecks, lints and tests on its own, so a failure is always attributable to the
phase it landed in. Phases 1-4 are mechanical. Phase 5 is not — see the note below.

## The four dialects

Not every off-grammar file is a token swap. Four areas speak class languages the tokens do not
cover, and these need a surface rewrite:

| Dialect | Signature | Files | Example |
|---|---|---|---|
| **zinc** (target) | `bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl` | the 16 already-clean files | `CalendarSubpage` |
| **gray/slate** | `bg-white/50 dark:bg-slate-900/50 border-gray-200/80` | 3 core, 6+ shared | `hostel/HostelOverview.tsx` L120 |
| **white-alpha** | `bg-white/40 dark:bg-white/5 border-white/50` | 2 core, 8+ shared | `dayscholar/BusFinder.tsx` (7 hits) |
| **semantic** | `bg-background` / `border-border` / `text-muted-foreground` | 6 | `FFCSTimetableTab.tsx` (**139 hits**) |

`FFCSTimetableTab.tsx` alone is 2,612 lines with 139 semantic-token hits, and
`AutoGeneratorModal.tsx` has 97. That is Phase 5, and it is the honest reason this plan is
phased rather than a single sweep: the first four phases are a few hours of mechanical work,
Phase 5 is a project of its own.

## The most valuable single finding

`TaskCard.tsx` L27-56, `PaymentsTab.tsx` L107-129, `TasksTab.tsx` L56-78,
`CourseDetailSubpage.tsx` L1012-1018 and `EventHubSubpage.tsx` L42-50 each **redeclare** the
tone maps and tokens that already exist in `@/lib/uiTokens`.

Worse, `TasksTab.tsx` L75-78 declares a local `SEG_ACTIVE` that bakes in
`bg-indigo-600 text-white`, while the real token at `uiTokens.ts:65` deliberately carries no
text colour so the caller's accent wins. The two definitions disagree, and the file that
declares it is not using it from the module at all.

`libraries/LibrariesTab.tsx` is the counter-example: ten tokens, one import, no local map
anywhere. That is the discipline Phase 3 spreads.

## Abort conditions

**AmazeUI internals.** The primitives live in this repo precisely because amazeui's
`PageHeader` / `SectionHeader` / `SubpageLayout` are the older gray+blue dialect. If a Phase 4
conversion appears to require changing a component *inside* `node_modules/@amazecontinuityprojects/amazeui`,
**stop and report.** The fix is always a local primitive, never a patch to the package.

**Radius.** We decided code wins, so `DESIGN_LANGUAGE.md` gets updated rather than the code
normalized. But if a conversion turns out to need a radius value that fits neither the existing
tokens nor a defensible doc amendment, **stop and report that specific value** rather than
inventing an eighth step in the scale.

**Test damage.** Nine test files assert on rendered DOM. `simplifiedMobileHome.weekStrip.test.tsx`
has 15 class assertions and `timetable-vertical-render.test.tsx` has 9. If a phase breaks one
of these, **fix the assertion only if the new markup is the intended grammar**, and report
which. Do not weaken an assertion to make a migration pass.

**Scope creep into home screens.** They are excluded. If a phase needs a home-screen change to
avoid a duplicated primitive, that is a design question — stop and report, do not quietly widen.

## Net effect

Roughly **−800 lines** of hand-rolled class strings and per-file tone maps, one dialect in the
product instead of four, 20 dead shim files deleted, and the old gray+blue components no longer
reachable by any import path.

## One correction worth carrying forward

An earlier read of the audit treated `AttendanceCalendarView.tsx` as superseded by
`CalendarSubpage` + `MonthGrid`, on the grounds that it is the older calendar. That was wrong.
It has three live call sites: `AttendanceSubpage.tsx:551`, `OverallTrackerSubpage.tsx:230` and
`CourseDetailSubpage.tsx:1126`. It gets migrated, not deleted.

Two files *are* confirmed dead: `attendance/PopupCard.tsx` and `exams/AllGradesDisplay.tsx`
each have zero importers and zero render sites. See [03-phase-0-dead-and-docs.md](./03-phase-0-dead-and-docs.md).
