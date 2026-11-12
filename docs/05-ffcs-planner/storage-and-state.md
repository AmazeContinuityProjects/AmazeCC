# FFCS Planner — Storage & State (complete)

> Every `ffcs_*` key this feature reads or writes, plus the two families that hold FFCS data
> outside `localStorage` (the SW runtime cache for CSVs, and atoms).

## localStorage keys (exhaustive)

| Key                           | Writer                     | Reader              | Semantics                                                     |
| ----------------------------- | -------------------------- | ------------------- | ------------------------------------------------------------- |
| `ffcs_timetables`             | planner save flows         | boot restore        | array-of-weeks "saved timetables" — unbounded growth possible |
| `ffcs_activeTimetableId`      | timetable switcher         | boot                | id string                                                     |
| `ffcs_settings`               | settings UI                | planner + generator | FFCSSettings (see ffcsSettings.ts) — merge-on-read shim       |
| `ffcs_layout_mode`            | FFCSLayoutModeModal        | boot                | "guided"\|"modern"\|"classic"                                 |
| `ffcs_tour_seen`              | tour engine                | boot                | TOUR_VERSION; do NOT manually edit to replay                  |
| `ffcs_tips_dismissed`         | hint system                | boot                | string[]                                                      |
| `ffcs_generator_targets`      | target locker              | generator           | GeneratorTarget[] (pruned by `pruneGeneratorTargets`)         |
| `ffcs_generator_session`      | generator prefs UI         | generator           | GeneratorSessionPreferences (composable ranking order)        |
| `ffcs_generator_view_mode`    | FFCSGeneratorViewModeModal | generator           | "modern"\|"classic"                                           |
| `ffcs_results_filter`         | results filter bar         | generator           | ResultFilters                                                 |
| `ffcs_faculty_priority`       | FacultyPriorityModal       | planner + generator | FacultyPriorityMap                                            |
| `ffcs_final_list_notice_seen` | planner notice             | mount gate          | one-shot flag                                                 |
| `ffcs_raw_courses`            | import pipeline            | import              | transient raw staging payload                                 |
| `cache_ffcs_feedback`         | distributeFfcsCache        | Dashboard badge     | feedback status cache                                         |
| `cache_registration_schedule` | same                       | ProfileStatusCards  | receipt tables                                                |
| `course_dashboard_target/tab` | cross-feature nav          | Academics           | deep-link intent                                              |

## Atoms consumed

`attendanceDataAtom` (attendance-pre-fill helpers), `allGradesDataAtom` (exclude known-graded),
`settingsAtom.currSemesterID`, `socialOwnBusyMapAtom` (friend-finder pull), plus tab atoms from `uiAtoms`.

## sessionStorage keys

`ffcs_generator_session` variant is sometimes stored there for torn sessions — implementation treats it as
interchangeable; `safeSessionStorage` handles quota/echo issues.

## SW runtime cache families

`/ffcs/*.csv` (ParsedCourse sources) — requested on semester switch; served NetworkFirst-ish via the
default cache strategy; excluded from precache by policy. Treat first-offline as unreliable.
