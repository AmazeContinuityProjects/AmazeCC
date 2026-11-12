# FFCS Planner — Storage & State

> Every `ffcs_*` localStorage key, every atom the planner touches.

| Key                                                | Type                          | Meaning                             |
| -------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `ffcs_timetables`                                  | `TimetableState[]`            | saved wk timetables                 |
| `ffcs_active_timetable` / `ffcs_activeTimetableId` | id                            | which saved TT is on screen         |
| `ffcs_settings`                                    | `FFCSSettings`                | UI prefs: colors, density, defaults |
| `ffcs_tour_seen`                                   | string (`TOUR_VERSION`)       | first-visit tour gate               |
| `ffcs_tips_dismissed`                              | string[]                      | rotating hints                      |
| `ffcs_generator_targets`                           | `GeneratorTarget[]`           | locked target courses               |
| `ffcs_generator_session`                           | `GeneratorSessionPreferences` | search behavior prefs               |
| `ffcs_generator_results`                           | `RankedResult[]`              | last run (session-only consumers)   |
| `ffcs_layout_mode` / `ffcs_view_mode`              | `"guided"/"modern"/"classic"` | per-user layout                     |
| `ffcs_results_filter`                              | `ResultFilters`               | post-generation cuts                |
| `ffcs_faculty_priority`                            | `FacultyPriority[]`           | manual faculty ordering             |
| `cache_ffcs_feedback`                              | `SimpleFeedback`              | dashboard feedback cache            |
| `ffcs_open.task`?                                  | —                             | (none — that's the tasks feature)   |

Remember: `storage.ts` centralizes typed access; new keys must be added there AND to
`03-local-storage-key-catalog.md` in the same PR.

## Atoms read/written

`attendanceDataAtom` (for "My Courses" pre-fill), `allGradesDataAtom` (course picker exclusion),
`settingsAtom.currSemesterID`, plus planner-local ones shared with Social (`socialOwnBusyMapAtom`).

## Quiz

1. Which keys would you want on a fresh device migration export, and which wouldn't you?
2. What invalidates a saved timetable when the semester flips?
