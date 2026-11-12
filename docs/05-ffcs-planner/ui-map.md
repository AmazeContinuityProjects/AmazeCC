# FFCS Planner — Component Map (the ~90-file atlas)

> **Entry files**
>
> - `exams/FFCSTimetableTab.tsx` (~4.4k) — the planner tab itself
> - `exams/FFCS/FFCSGuidedSelector.tsx` (~5.1k) — guided wizard
> - `exams/FFCS/FFCSGeneratorSubpage.tsx` (~3.7k) — the generator UI

## Layout & header

`FFCSDashboardHeader.tsx` (stats, timetable switcher) · `FFCSDashboardDetails.tsx` (sheets) ·
`SelectedCoursesList.tsx` · `TargetCoursesModal.tsx` · `TargetCourseLocker.tsx` ·
`TargetCourseLockCard.tsx` · `SlotFacultySwapSheet.tsx`

## Pickers & filters

`CourseCatalogFilters.tsx` · `CourseListImportSection.tsx` · `CourseImportPanel.tsx` ·
`PasteRegisteredCoursesModal.tsx` · `CourseTypeChips.tsx` · `FFCSResultsFilterBar.tsx` ·
`GeneratorTargetCoursesWidget.tsx`

## Guided mode

`components/guided/`: MobilePreflightCard · SetupModeCard · SetupStrategyCard · AutoBlockingCard ·
AutoTimetableViewCard · AutoTimingsCard · AutoSocialCard — each = one wizard step.

## Generator internals

`components/GeneratorStatParts.tsx` · `TargetCourseLocker.tsx` · `logic/generator.ts` ·
`logic/dropPolicy.ts` · `logic/groupSelectedCourses.ts` · `logic/facultyGroups.ts` ·
`workers/generator.worker.ts`

## Views

`components/TimetableGrid.tsx` · `timetable/TimetableView.tsx` (canonical) ·
`ClassicHorizontalTimetableGrid.tsx` · `HorizontalTimetableGrid.tsx` · `ModernHorizontalTimetableGrid.tsx` ·
`VerticalTimetableGrid.tsx` · `TimetableGridShell.tsx` · `TimeperiodSkeleton…`

## Ranking & social

`ffcsRanking.ts` · `ffcsFacultyRanking.ts` · `ffcsFacultyPriority.ts` · `components/FacultyAvatar.tsx` ·
`FacultyReviewSheet(Host).tsx` · `GuidedFacultyStats.tsx` · `FFCSFriendsSubpage.tsx`

## Exports & dossier

`ExportDossierWidget.tsx` · `FFCSDossierSubpage.tsx` · `PdfGenerationBadge.tsx` ·
`lib/exportTimetable.ts` · `lib/exportTimetableHtml.ts` · `lib/portraitDossier.ts` ·
`lib/formDossier.ts` · `lib/exportIcal.ts` · `lib/exportClashReport.ts` · `imageDownload.ts`

## Modals & sheets

Settings/Shortcuts/View-mode/Layout-mode/Faculty-Priority/Faculty-Schedule/Social-Matrix/
Paste-courses/Guide/Run-Summary sheets live under `components/modals/` + `features/tour/`.

Line-count guidance for handoff: the three ~4–5k-line files are intentionally monolithic for
inline commenting; do not split without the test net green.
