# Tasks — Week Scheduling + Home Integration

## 1. Chunk model

`schedule: WeekChunk[]` with `{ day: AttendanceDay; start: "HH:MM"; end: "HH:MM" }`
(24h). Matching against a timetable card uses `parseAttendanceTime` /
`getAttendanceTimeRange` (`attendanceTimetable.ts:8-25`): overlap iff
`chunk.start < cardEnd && cardStart < chunk.end`, same `day`, plus the
course-link join from `02-data-model.md §3`.

`taskMatch.ts` exposes:
- `tasksForClass(cls, day): Task[]` — linked + time-overlapping, non-done first.
- `classTaskSummary(tasks)` — `{ total, tests, das, pending }` for badges.
- `tasksForDay(day, attendance)` — week-pill dots.

## 2. SimplifiedMobileHome integration

Hook points from research (no existing task code):

- **Compact pill** (`SimplifiedMobileHome.tsx`): third line under
  time•venue•bunk, or beside `bunkText`; `TaskBadge` gets the session-scoped
  summary (see §4 for the label/tint table).
- **Detailed card**: same badge in the bottom row.
- **Week pills**: dot next to the `N cls` count via `tasksForDay`.
- `TaskBadge` stops propagation so tapping it never triggers
  `handleCourseClick`.
- `isTodayView` (`isSameCalendarDay(selectedDayMeta.fullDate, new Date())`) gates
  every "today" claim; `effectiveTimetableDay` and the Saturday override still
  decide which sessions are rendered.

## 3. Placement setting

`tasksInlineOnHome: boolean` (default `true`) in `settingsAtoms.ts`, UI next
to `timetablePillStyle` (`ProfilePage.tsx` area).

- `true` (unified): badges/lines render inline as above.
- `false`: classes render clean; a "Today's tasks" joined-list section
  renders below the timetable (same row component, grouped by time).
- **Always inline regardless:** test/DA-linked badges + color shift
  (per user).

## 4. Card copy + tint rules

Labels are **session-scoped**: a task only claims "…today" on the card of the
class session it is actually scheduled into. `classTaskSummary(tasks, cls, day,
timeRange, { dayDate, literalToday })` returns a `today` breakdown
(`total/tests/das/sessionTotal/dueTotal`), and `TaskBadge` renders from it.

| `literalToday` | Task state | Badge | Card tint |
|---|---|---|---|
| ✅ (viewed day = real date) | `test` chunked to this session | `Test today · N` | **red** border + ring |
| ✅ | `digital-assignment` chunked to this session | `Digital assignment today · N` | amber border + ring |
| ✅ | linked, `dueDate` = that date, no session chunk | `Test today` / `Digital assignment today` | amber border + ring |
| ❌ (browsing another day) | any linked task | `Task pending · N` | amber border + ring |
| — | nothing linked | no badge | neutral |

- `literalToday` is computed as `isSameCalendarDay(selectedDayMeta.fullDate,
  new Date())`; the `today` breakdown stays all-zero otherwise, so a browsed
  weekday can never render a "…today" claim.
- Test outranks digital assignment when both qualify. `N` counts only
  today-qualifying tasks for specific labels; the generic badge counts all
  linked tasks.
- Red is reserved for a test sitting in today's session; every other
  linked-task state (including a test that is only *due* today) gets amber.
- `tasksInlineOnHome: false` section lists chunked-on-this-day tasks plus, on
  the real current date, tasks that are only due that day — otherwise a Moodle
  DA is invisible in that mode.
- Copy stays terse on cards; details live in the task sheet. Vocabulary:
  `Test today` / `Digital assignment today` / `Task pending` (sentence case).
