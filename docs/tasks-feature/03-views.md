# Tasks — Views (`src/components/custom/tasks/`, new)

Hub: `TasksTab.tsx` with internal view switch (kanban | list | week), registered
in `ToolsHub.tsx:30-103` as `{ id: "tasks", category: "academic" }`, routed in
`ToolsTab.tsx:70-164`, nav entries in `NavigationTabs.tsx:585-643` + palette
command in `Main.tsx:1310+`.

## 1. Page shell (`TasksTab.tsx`)

Deliberately mirrors the courses page (`SimplifiedAcademicsPage` /
`CourseDetailSubpage`) so the tool feels native to Academics:

- Wrapper `w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8
  animate-in fade-in duration-300 text-left select-none`.
- **Header block**: `BackButton` alone on its own row (`mb-5 flex` +
  `self-start`), then eyebrow (`Tools · Tasks`, uppercase
  `tracking-[0.2em]`) → title (`Tasks & Schedule`, `font-black font-outfit`) →
  subtitle. Same arrangement as `CourseDetailSubpage.tsx:1320-1338`.
- **Actions**: `Import LMS` (amber tint) + `New Task` (solid indigo).
- **Two stat cards** (`grid grid-cols-2 gap-3 sm:gap-4`, each
  `rounded-[24px] bg-white/80 backdrop-blur-xl … min-h-36 sm:min-h-40`):
  1. static **Open tasks** — count headline, `Overdue`/`On track` badge,
     `N due this week · M done` subline;
  2. **rotating carousel** — 5s auto-advance, paused on hover/touch,
     framer-motion `AnimatePresence mode="wait"` (`y: 6 → 0 → -6`), clickable
     dots, slides = Today / Overdue / Focus / Completed, each jumping to the
     relevant view. Card 2 is a static 24px card; only its body rotates.
- **Segments**: view switcher (Kanban / List / Week / Focus) in a
  `bg-zinc-100/80 … rounded-2xl` group, active = `bg-indigo-600 text-white`;
  course filter is a horizontally scrollable pill rail (`All courses` + codes),
  replacing the old `<select>`.
- **Section header**: per-view icon + label (`Board` / `Timeline` /
  `Week plan` / `Focus`) + count chip, with overdue / today / done quick chips
  on the right.

## 2. Kanban (`KanbanView.tsx`)

- Columns: Pending / In Progress / Done. Cards show kind icon, title, course
  chip (`baseCode` + component dot), due chip (red if overdue), chunk count.
- Move via status menu (‹ › buttons or dropdown; HTML5 drag optional P2 —
  keep menu in P1 for reliability).
- Writes go through `src/lib/tasksStorage.ts` (`updateTask`) + `tasksAtom`.

## 2. Task / list view (`TaskListView.tsx`)

- Groups: Overdue / Today / This week / Later / No date (derived from
  `dueDate`), then by course.
- Row: checkbox (cycles pending → in_progress → done), title, kind + course
  chips, due text, chevron to edit sheet (reuse `BottomSheet`).
- Shared `TaskCard.tsx` + `TaskEditSheet.tsx` (create/edit form: title, kind,
  course picker from `uniqueCourses`-style grouping, component segmented
  control, due datetime, reminders list editor, week-chunk editor, pomodoro
  overrides).

## 3. Week view (`TaskWeekView.tsx`)

- 7-column grid reusing `buildAttendanceDayCardsMap` layout conventions;
  task chunks render as blocks in `{day, start–end}` cells, colored by kind.
- Overlap warnings (two tasks, same cell) as amber chip; read-only in P1,
  drag-to-move deferred.

## 4. Quick-add

- Palette command `tasks-quick-add` (`Main.tsx` "Tools" group) sets
  `tasksQuickAddRequestAtom` then routes to `Tools > Tasks`; `TasksTab`
  consumes the request, opens `TaskEditSheet` in create mode and clears the
  atom (`nonce` forces a re-fire for repeat adds).
- **Known limitation:** the title is *not* prefilled from the palette query.
  `CommandPalette` filters commands by splitting the query into words and
  requiring each word to appear in `label/description/category`
  (`CommandPalette.tsx:197-211`), so a free-text query never reaches
  `onSelect` and the command would only match when the query happens to
  contain its own name. Prefilling would require widening `CommandItem`/
  `CommandPalette` to hand the query to `onSelect`, or a `subpage` form
  (the `search-library` pattern). The sheet autofocuses the title instead.
- Per-course entry: "Add task" button on `CourseDetailSubpage` overview
  pre-fills `courseCode` + component.

## 5. Files

| File | Purpose |
|---|---|
| `src/types/tasks.ts` | Model (see `02-data-model.md`) |
| `src/lib/tasksStorage.ts` | CRUD + migrate `customHomework` + jotai `tasksAtom` (atom lives in `src/store/dataAtoms.ts` next to `moodleDataAtom:21`) |
| `src/lib/taskMatch.ts` | `tasksForClass(cls, day)` matcher + `classTaskSummary` (counts by kind) |
| `src/components/custom/tasks/TasksTab.tsx` | Hub + view switch |
| `src/components/custom/tasks/{KanbanView,TaskListView,TaskWeekView,TaskCard,TaskEditSheet}.tsx` | Views |
| `src/components/custom/tasks/PomodoroTimer.tsx`, `FocusPage.tsx` | Phase 3 (see `05-pomodoro-focus.md`) |
