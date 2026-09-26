# Tasks — Data Model (`src/types/tasks.ts`, new)

## 1. Core types

```ts
type TaskStatus = "pending" | "in_progress" | "done";
// NOTE: user vocabulary "over" maps to "done". Overdue is derived, never stored.
type TaskKind = "homework" | "reminder" | "digital-assignment" | "study" | "test";
type TaskComponent = "theory" | "lab" | "both";

interface WeekChunk { day: AttendanceDay; start: string; end: string }
// AttendanceDay from src/lib/attendanceTimetable.ts:3-6; times "HH:MM" 24h.

interface Task {
  id: string;                       // `${Date.now()}-${rand}`
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  courseCode: string;               // sanitized baseCode, courseHelpers.tsx:46-50
  component: TaskComponent;
  classNbr?: string;                // marksData classNbr / attendance classId
  slotName?: string;
  courseTitleSnapshot?: string;     // denormalized for offline list rendering
  dueDate?: string;                 // ISO datetime, optional
  reminders: string[];              // ISO datetimes, user-defined, sorted
  schedule: WeekChunk[];            // weekly study/completion chunks
  pomodoro?: { focusMin: number; breakMin: number; rounds: number };
  moodleUrl?: string;               // dedupe key for one-way import
  notes?: string;
  createdAt: string; updatedAt: string; completedAt?: string;
}

interface PomodoroSession {
  id: string; taskId: string | null; // null = standalone focus
  startedAt: string; focusMin: number; breakMin: number;
  roundsPlanned: number; roundsDone: number;
  done: boolean; linkedChunk?: WeekChunk;
}
```

## 2. Status machine

- `pending → in_progress → done` (linear; reopening sets back to `in_progress`).
- `completedAt` set on transition to `done`, cleared on reopen.
- **Overdue** (derived): `dueDate && new Date(dueDate) < now && status !== "done"`.
- Kanban columns: Pending / In Progress / Done; overdue shown as a red chip
  on the card + optional swimlane in list view (derived at render).

## 3. Course-linking rules

1. Normalize input with `sanitizeCourseCode` (strip `([LPT])` suffixes).
2. Resolve component with `getComponentType` logic
   (`MobileHome.tsx:565-574`: code suffix `(L|P)`, type contains LAB/PRACTICAL,
   or slot starts with `L` → lab, else theory).
3. Optional `classNbr`/`slotName` pin the exact class section.
4. Join to timetable cards (`attendanceTimetable.ts:44-68`) on
   `sanitizeCourseCode(cls.courseCode) === task.courseCode &&
   (task.component === "both" || componentOf(cls) === task.component)`.
5. Moodle matching: `courseCode = assignment.name.split("/")[0]` (cf.
   `Main.tsx:1889`), matched against `baseCode`; links set `moodleUrl`.

## 4. Validation invariants (unit-tested)

- `dueDate`, `reminders[]`, chunk times must parse as dates/times; reminders
  must be future at creation (warn, don't block).
- Chunk `{day,start,end}` requires `start < end`; overlapping chunks in one
  task are allowed (user intent), overlapping chunks across tasks surface a
  warning in week view (non-blocking).
- `reminders[]` kept sorted ascending; deduped.
