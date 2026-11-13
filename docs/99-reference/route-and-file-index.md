---
title: "Route & File Index"
description: "mega-index from user-facing surface → every file that implements/tests it — grep-driven, regenerated per release."
---

# Route & File Index

> **In one line:** mega-index from user-facing surface → every file that implements/tests it —
> grep-driven, regenerated per release.

## Frontend routes

| Route                 | Source                                                               | Implements           | Tests                                                        |
| --------------------- | -------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| `/`                   | `src/app/page.tsx` → `app/HomeEntryController.tsx`                   | guest→app transition | `homeEntryController.test.tsx`                               |
| `/` (signed in)       | `components/custom/Main.tsx` → `AppHousing`/`AuthenticatedWorkspace` | whole shell          | syncMode suites, sync-session, Main-tree tests               |
| `/ffcs`               | `app/ffcs/{page,layout,FFCSPageView}.tsx`                            | standalone planner   | `ffcsTab.render.test.tsx` (embedded), standalone view suites |
| `/friend-finder`      | `app/friend-finder/*`                                                | public finder        | `friendFinderRouting.test.tsx`                               |
| `/privacy` · `/terms` | `app/privacy                                                         | terms/page.tsx`      | legal                                                        | —   |
| `/share`              | `app/share/{page,ShareTargetView}.tsx`                               | share target         | —                                                            |
| `/share/ffcs`         | `app/share/ffcs/*`                                                   | received plan        | `ffcsShareView.render.test.tsx`                              |
| `/~offline`           | `app/~offline/page.tsx`                                              | offline fallback     | `serviceWorker.test.ts`                                      |
| 404                   | `app/not-found.tsx`                                                  | 404                  | —                                                            |

## Signed-in tab screens (mount paths)

| Tab        | Mount                                                         | Composition files (representative)                                                   |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Home       | Dashboard→Route → DashboardHomeFeature → SimplifiedMobileHome | SimplifiedMobileHome + attendance/OD/marks widgets                                   |
| Attendance | Route → DashboardAttendanceFeature                            | AttendanceCalendarView, MonthGrid, DayDetailSheet, DesktopCourseDetail               |
| Academics  | Route → DashboardAcademicsFeature                             | MarksHistoryTab, MarksPredictorTab, CurriculumPage, ScheduleDisplay, CourseDashboard |
| Tools      | Route → DashboardToolsFeature → ToolsTab                      | ToolsHub + qbank/predictor/tasks/scanner/FFCS                                        |
| Hostel     | Route → DashboardHostelFeature                                | HostelOverview, MessDisplay, LeaveDisplay                                            |
| Profile    | Route → DashboardProfileFeature → ProfileTab → ProfilePage    | Account, sync modes, About, API picker                                               |
| More       | UtilityRoutes → MoreTab                                       | SocialTab, FFCSTimetableTab                                                          |

## Feature → code → tests (quick jumps)

- **FFCS planner**: `exams/FFCSTimetableTab.tsx`, `exams/FFCS/*` ← `ffcs*` suites
- **Sync engine**: `lib/sync-engine/*` ← `sync*` suites, `credential*`, `marksSync.test.ts`
- **Timetable UI**: `timetable/*` ← `timetable-*` suites
- **Marks predictor**: `lib/marksPredictor.ts` ← `marksPredictor*`
- **Social**: `lib/social/*` ← `social-*` suites
- **Vault**: `lib/credentialVault.ts` ← `credentialVault.test.ts`
- **SW**: `app/sw.ts` ← `worker-artifact.test.ts`, `serviceWorker.test.ts`

## Rebuilding this index

`git ls-files src/components src/lib src/app src/store | sort` — this page never replaces the
output; it annotates it. The grounding checklist tracks per-file documentation status.
