# Phase 4 — retire the amazeui shims

The old dialect is currently reachable by import. This phase closes that path.

## What a shim is

20 files in `src/components/custom/shared/` are one line each:

```ts
// PageHeader.tsx
export { PageHeader as default } from "@amazecontinuityprojects/amazeui";
```

That is the whole file. They exist so screens could import `../shared/PageHeader` instead of
reaching into amazeui directly, which is a reasonable thing to do once and a trap forever after:
the re-export makes the old dialect look like a first-class local primitive.

`primitives/index.ts:9-14` says why the local versions exist at all:

> *"They deliberately do not live in `@amazecontinuityprojects/amazeui`: that package's
> `PageHeader` / `SectionHeader` / `SubpageLayout` are still the older gray + blue-band dialect,
> which is why every page rolled its own. These speak the current zinc dialect."*

So the shims re-export precisely the components the local primitives were written to replace.

## Shim families and their replacements

| Shim | Call sites | Replacement | Notes |
|---|---|---|---|
| `SubpageLayout` | 14 | `PageShell onBack` + `SubpageScreen` | the back button and the shell in one |
| `EmptyState` | 10 | `EmptyPanel` | `variant="dashed"` or `variant="card"` |
| `PageHeader` | 9 | `PageShell` | with `eyebrow`/`title`/`subtitle` |
| `Badge` | 9 | `ToneBadge` + `TONE_BADGE` | 3 shims import it and never use it |
| `SubTabStrip` | 6 | `SegmentedControl` (`grow` + `scroll`) | 6 files, all tiny |
| `SearchInput` | 6 | `SEARCH_FIELD` | or `FieldInput` if it was a real input |
| `ExpandableSection` | 6 | keep, or fold into `PageShell` | judgement per call site |
| `FetchButton` | 6 | `GhostButton` | the loading-spinner variant |
| `BackButton` | 5 | `PageShell onBack` | all 5 in `social/` |
| `ViewModeToggle` | 2 | `SegmentedControl` with icons | 2 files |
| `Modal` | 1 | `BottomSheet` | file is deleted in Phase 0 |
| `Card` | — | `TILE` / `TILE_CARD` | imported from amazeui directly, not the shim |
| Others (`InfoRow`, `DataTable`, `CircularProgress`, `ProgressBar`, `ErrorDisplay`, `Input`) | ~8 | see below | low-use |

**Not shims, and they stay:** `BottomSheet.tsx` (289 loc, locally implemented, 32 call sites),
`Button.tsx` (38 loc, locally implemented), `CommandPalette.tsx`, `TabHelpFooter.tsx`,
`SyncNotification.tsx`, `useSyncTrigger.ts`, `index.ts`, `useIsMobile.ts`.

`BottomSheet` is the most-used component in the repo and is already zinc. It stays.

## The 46 caller files

Sorted by shim count, with the replacement that clears the most.

| File | loc | Shims | Primary replacement |
|---|---|---|---|
| `attendance/AttendanceSubpage.tsx` | 673 | `SubpageLayout`, `Badge`, `ExpandableSection`, `ViewModeToggle`, `CircularProgress` | `PageShell`, `SegmentedControl`, `ToneLegend` |
| `exams/MarksDisplay.tsx` | 750 | `PageHeader`, `SubpageLayout`, `Badge`, `ExpandableSection`, `CircularProgress` | `PageShell`, `SubpageScreen`, `TONE_BADGE` |
| `attendance/DesktopCourseDetail.tsx` | 538 | `EmptyState`, `Badge`, `ExpandableSection`, `CircularProgress` | `TILE_CARD` ×4, `EmptyPanel`, `ToneBadge` |
| `exams/AllGradesDisplay.tsx` | 457 | `PageHeader`, `Badge`, `FetchButton` | **deleted in Phase 0** |
| `attendance/PopupCard.tsx` | 535 | `ExpandableSection`, `Modal`, `InfoRow` | **deleted in Phase 0** |
| `exams/MarksPredictorTab.tsx` | 523 | `PageHeader`, `SubpageLayout`, `Badge` | `PageShell` |
| `attendance/AttendanceTabs.tsx` | 588 | `PageHeader` | `PageShell` |
| `exams/AcademicsHub.tsx` | 449 | `PageHeader`, `Badge` | `PageShell`, `StatTile` |
| `attendance/OverallTrackerSubpage.tsx` | 388 | `SubpageLayout`, `ExpandableSection`, `ViewModeToggle` | `PageShell`, `SegmentedControl` |
| `qbank/PureQBankTab.tsx` | 208 | `SubpageLayout`, `EmptyState`, `SearchInput` | **Phase 2** |
| `qbank/PapersArchiveTab.tsx` | 333 | `SubpageLayout`, `EmptyState`, `SearchInput` | **Phase 2** |
| `exams/AllGrades*` (see above) | | | |
| `exams/GPAPredictorTab.tsx` | 333 | `SubpageLayout` | `PageShell` |
| `exams/CircularsTab.tsx` | 238 | `SubpageLayout` ×2 | `PageShell` ×2, `ListSkeleton` |
| `exams/CoursePageTab.tsx` | 353 | `SubpageLayout` | `PageShell`, 6 `CardShell` → `TILE_CARD` |
| `exams/CurriculumCategoriesTab.tsx` | 330 | `SubpageLayout` | `PageShell`, `ListSkeleton` |
| `exams/FacultyInfoTab.tsx` | 601 | `SubpageLayout` ×2 | `PageShell` + `SubpageScreen` (2 levels) |
| `exams/MarksHistoryTab.tsx` | 282 | `Badge` | 4 amazeui `Card` → `TILE_CARD` |
| `exams/GradesModal.tsx` | 389 | `FetchButton` | 2 `Card` → `TILE_CARD` |
| `exams/MoodleDisplay.tsx` | 251 | `EmptyState`, `FetchButton` | `EmptyPanel`, `GhostButton` |
| `exams/VitolDisplay.tsx` | 206 | `EmptyState`, `FetchButton` | 1 `EmptyState` → `EmptyPanel` |
| `exams/CourseQBankTab.tsx` | 310 | `EmptyState`, `FetchButton` | Phase 2 |
| `exams/CourseDetailSubpage.tsx` | 2140 | `Badge` | **Phase 6** |
| `exams/courseHelpers.tsx` | 269 | `ExpandableSection` | Phase 3 |
| `exams/marks-predictor/CoursePredictorHero.tsx` | 264 | `Badge` | `TONE_BADGE` ×3 |
| `exams/FFCS/FFCSTimetableTab.tsx` | 2612 | `EmptyState`, `SearchInput` | **Phase 5** |
| `exams/FFCS/…/AutoGeneratorModal.tsx` | 1250 | `SearchInput` | **Phase 5** |
| `exams/FFCS/…/TargetCoursesModal.tsx` | 218 | `SearchInput` | **Phase 5** |
| `exams/TestGradesContainer.tsx` | 40 | `SubpageLayout`, `FetchButton` | `PageShell title="Grade History"` |
| `exams/MarksSubTab.tsx` | 15 | `SubpageLayout` | 4-line swap to `PageShell` |
| `attendance/AttendanceSummary.tsx` | 141 | `CircularProgress` | Phase 1 |
| `attendance/CourseCard.tsx` | 213 | `InfoRow`, `CircularProgress` | Phase 1 |
| `attendance/OverallAttendancePredictor.tsx` | 1134 | `PageHeader` | Phase 2 |
| `attendance/ODTrackerSubpage.tsx` | 552 | `BackButton` | Phase 1 |
| `attendance/CalendarSubpage.tsx` | 1034 | — | already clean |
| `attendance/AttendanceSubsTabs.tsx` | 18 | `SubTabStrip` | `SegmentedControl` |
| `attendance/MonthGrid.tsx` | 201 | — | already clean |
| `attendance/MoodleConnectSheet.tsx` | 49 | — | already clean |
| `dayscholar/BusFinder.tsx` | 298 | `EmptyState`, `SearchInput` | **Phase 5** |
| `hostel/CabShare/SearchTrips.tsx` | 323 | `EmptyState` | **Phase 5** |
| `hostel/CabShare/MyTrips.tsx` | 223 | `EmptyState` | **Phase 5** |
| `hostel/CabShare/CabShareTab.tsx` | 141 | `PageHeader`, `SubTabStrip` | **Phase 5** |
| `hostel/HostelSubsTab.tsx` | 22 | `SubTabStrip` | **Phase 5** |
| `more/MoreTab.tsx` | 34 | `PageHeader` | `PageShell`; also drop the unused `isSubpageOpen` |
| `more/MoreSubTabs.tsx` | 14 | `SubTabStrip` | `SegmentedControl grow`, then inline into `MoreTab` |
| `profile/ProfileSubTabs.tsx` | 14 | `SubTabStrip` | `SegmentedControl grow` |
| `profile/FeedbackStatusModal.tsx` | 170 | — (amazeui direct) | `TONE_BADGE` |
| `qbank/QBankSubTabs.tsx` | 14 | `SubTabStrip` | `SegmentedControl grow` |
| `social/PeopleSubpage.tsx` | 155 | `BackButton` | `PageShell onBack` |
| `social/PairsSubpage.tsx` | 192 | `BackButton` | `PageShell onBack` |
| `social/GroupsSubpage.tsx` | 151 | `BackButton` | `PageShell onBack` |
| `social/FreeNowSubpage.tsx` | 123 | `BackButton` | `PageShell onBack` |
| `social/CommonFreeGridSubpage.tsx` | 77 | `BackButton` | `PageShell onBack` |
| `Dashboard.tsx` | 1256 | `SubpageLayout` | the screen switch; see below |

## The `SubTabStrip` cluster — 6 files, all tiny

`HostelSubsTab` (22), `MoreSubTabs` (14), `ProfileSubTabs` (14), `QBankSubTabs` (14),
`AttendanceSubsTabs` (18), `CabShareTab` (141).

All six are 14-22 lines except `CabShareTab`, and all six use amazeui's `SubTabStrip` for the
same job: 2-5 peer views. `SegmentedControl` with `grow` + `scroll` is the local equivalent
(`Controls.tsx:70`), and the docstring at `Controls.tsx:62-69` says the `grow` and `scroll`
shapes exist for exactly this case.

This is the cheapest 6 files in the plan. Do it first, as the phase's proof of concept.

After the swap, four of the six (`MoreSubTabs`, `ProfileSubTabs`, `QBankSubTabs`,
`AttendanceSubsTabs`) are 14-line components whose whole body is one control call. Consider
inlining each into its parent and deleting the file. That is a judgement call per file — the
`shared/` barrel exists for a reason — so decide per site and say which you did.

## `Dashboard.tsx` and the screen switch

`Dashboard.tsx` imports `SubpageLayout` (L1056-1069 area) and at L1058-1067 wraps
`HostelCounsellingView` in a **second** hand-rolled header plus a `bg-info-surface text-info`
reload button.

That duplicate is a Phase 5 item — fixing `HostelCounsellingView` without it leaves two headers
on screen — but the `SubpageLayout` import is this phase's. Replacing it means deciding whether
`Dashboard` owns screen chrome or each screen does.

**Decision: each screen owns its own.** That is what `PageShell` is for, it is what the 16 clean
files already do, and the alternative would mean editing 18 screens every time the chrome
changes. Convert the `Dashboard` usage to the same thing and leave the switch alone.

## Deletion, last

Only when `grep -rn "shared/\(PageHeader\|SubpageLayout\|SubTabStrip\|EmptyState\|Badge\|SearchInput\|ExpandableSection\|FetchButton\|BackButton\|ViewModeToggle\|Modal\|InfoRow\|CircularProgress\|ProgressBar\|ErrorDisplay\|DataTable\|Input\|Card\)" src/` returns nothing:

```
BackButton.tsx       Badge.tsx        Card.tsx          CircularProgress.tsx
DataTable.tsx        EmptyState.tsx   ErrorDisplay.tsx  ExpandableSection.tsx
FetchButton.tsx      InfoRow.tsx      Input.tsx         LoadingSpinner.tsx
Modal.tsx            PageHeader.tsx   ProgressBar.tsx   SearchInput.tsx
SectionHeader.tsx    SubpageLayout.tsx SubTabStrip.tsx  ViewModeToggle.tsx
```

`LoadingSpinner.tsx` has 0 shim callers but 2 amazeui-direct users
(`dayscholar/TransportRegistration.tsx:5`, `qbank/…`) — those are Phase 5. Keep the file until
then, delete it with the rest.

**Keep:** `BottomSheet.tsx`, `Button.tsx`, `CommandPalette.tsx`, `TabHelpFooter.tsx`,
`SyncNotification.tsx`, `useSyncTrigger.ts`, `useIsMobile.ts`, `index.ts`.

## What still remains after this phase

Deleting the shims does **not** remove the old dialect. As of the audit, 77 files import amazeui
directly, and most of those are component imports, not `cn` or a type. The bulk are in Phase 5
(FFCS, hostel, dayscholar), and the `primitives/` barrel itself imports amazeui's `cn`.

So Phase 4 ends with: **no import path named `shared/*` reaches the old dialect**, but amazeui
remains a direct dependency. The ESLint rule from Phase 0 is what makes that durable.

## Gate

```
pnpm test        # 854
pnpm typecheck
pnpm lint
```

Plus the two greps above. `pnpm lint` is the real check here: deleting 19 files that something
still imports produces typecheck errors, not lint warnings, so `tsc` is the gate that matters.

No test imports a shim, so 854 is exact.

## Net effect

19 files deleted, ~85 import lines repointed, and the old gray+blue dialect no longer reachable
under a name that looks local.
