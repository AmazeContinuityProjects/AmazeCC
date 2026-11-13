---
title: "FFCS Planner — UI Map (annotated, with sizes)"
---

# FFCS Planner — UI Map (annotated, with sizes)

> **Entry files:** `exams/FFCSTimetableTab.tsx` (~4,436 lines) · `exams/FFCS/FFCSGeneratorSubpage.tsx` (~3,665) ·
> `exams/FFCS/components/FFCSGuidedSelector.tsx` (~5,126). Everything else is a satellite.

## The tab's mount map (dynamic imports → screens)

| Lines   | Imports (representative)                                                                                                                                                                                                                   | Lines |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 158–163 | FFCSGeneratorSubpage, FFCSFriendsSubpage, FFCSDossierSubpage, FFCSGuidedSelector                                                                                                                                                           | lazy  |
| 164–192 | SlotFacultySwapSheet, FFCSLayoutModeModal, FacultyPriorityModal, TargetCoursesModal, PasteRegisteredCoursesModal, FacultyScheduleModal, SocialMatrixModal, FFCSGuideModal, FacultyReviewSheetHost, SelectedCoursesList, PdfGenerationBadge | lazy  |
| 200–203 | notice key + component entry                                                                                                                                                                                                               | —     |

## State clusters (approximate line ranges)

| Range     | Cluster                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| 216–320   | raw/semester/master courses, grouping toggle, blocked slots, timetables, locks, sheet editing                       |
| 340–475   | layout mode (guided/modern/classic), guided fullscreen, final list notice, vitfac hydration ref, tour wiring        |
| 604–672   | friends/groups/social-matrix, social target                                                                         |
| 672–700   | `loadSemesterReport` — CSV fetch + parse path                                                                       |
| 731–760   | `handleSemesterChange` — semester broadcast → reload                                                                |
| 830–960   | overlays: final list notice, report catalog changed, faculty groups hydration                                       |
| 1020–1190 | `catalogSlotIndex`, `uniqueCourses`, curriculum-only, search filter memo                                            |
| 1289–1650 | export hub: image, share plan, share JSON, AmazeCC share, dossier HTML, clash report, print dossier, detached print |
| 1683–1835 | slot catalog (theory/lab filtered), `handleAddGuidedCourse`                                                         |
| 1831–1960 | guided mount, close handlers, generator preview holder                                                              |
| 4101      | paste mapping line — power users dumping CSV lines one per row                                                      |

## Satellite components (name → job)

Friends management (GroupMembersSheet, AddPeerSheet…). Export dialogs (ExportDossierWidget, PdfGenerationBadge…).
Catalog pickers (CourseCatalogFilters, CourseTypeChips, FFCSResultsFilterBar…). Faculty rating (FacultyAvatar,
FacultyReviewSheet, GuidedFacultyStats…). Modals (FacultyPriorityModal, FacultyScheduleModal, SocialMatrixModal,
TargetCoursesModal, PasteRegisteredCoursesModal, FFCSLayoutModeModal, FFCSSettingsModal, FFCSShortcutsModal? (via assembled)).

Presentational mass: `components/guided/*` (7 files) owns the wizard's cards; `components/modals/*` owns the
10 modal sheets; `logic/*` (imports never run in render path except drops), `hooks/*` (React-state leaves).
