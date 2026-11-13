---
title: "Attendance — UI Map (annotated, with line counts)"
---

# Attendance — UI Map (annotated, with line counts)

| File                                                      | Lines       | Job                                                        |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `attendance/DesktopCourseDetail.tsx`                      | ~409        | per-course detail: predicted skips, notes, OD ledger strip |
| `attendance/AttendanceCalendarView.tsx` + `MonthGrid.tsx` | ~357 / ~300 | month grid; color-coded shapes                             |
| `attendance/CalendarSubpage.tsx`                          | ~939        | academic calendar tab inside attendance                    |
| `attendance/OverallAttendancePredictor.tsx`               | ~126        | capstone skip-simulation card                              |
| `attendance/ODTrackerSubpage.tsx`                         | ~800        | OD history + apply sheet entry                             |
| `attendance/OfficialOdSection.tsx`                        | ~750        | official OD list w/ other-semester picker                  |
| `attendance/TimetableGrid.tsx`                            | ~600        | attendance-flavored timetable sheet                        |
| `attendance/UpcomingClassesList.tsx`                      | ~500        | week-ahead classes, per-course chips                       |
| `attendance/AttendanceSubpage.tsx`                        | 3           | alias re-export (`@/lib/attendanceRemainingClasses`)       |
| `attendance/DesktopCourseDetailPane.tsx`                  | 3           | alias re-export (bundle compat)                            |
| `attendance/MoodleConnectSheet.tsx`                       | ~400        | LMS credential sheet                                       |

## Composition rules

- The tab's root is `DashboardAttendanceFeature.tsx` (feature boundary) — no eager imports there;
  every leaf is `next/dynamic(..., { loading: PageSkeleton })`.
- Sheets compose from `BottomSheet` (portal + focus trap + stack); never bespoke modals here.
- All percentage labels render through `AttendancePercentageChip`? — inline span pair in `MonthGrid`;
  don't duplicate the tone map — it exists in `courseDetailHelpers.ts` as `ATT_TONE/ATT_DOT`.
