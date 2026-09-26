# Tasks — Build Plan

## Phase 1 — Core (CRUD + views + linking)

1. `src/types/tasks.ts` — model from `02-data-model.md`.
2. `src/lib/tasksStorage.ts` + `tasksAtom` (in `src/store/dataAtoms.ts`) +
   `customHomework` migration.
3. `src/lib/taskMatch.ts` — course/component matcher.
4. `TasksTab` + `KanbanView` + `TaskListView` + `TaskCard` + `TaskEditSheet`
   (+ `BottomSheet`), ToolsHub card, `ToolsTab` branch, palette quick-add.
5. Vitest: status transitions, matcher, migration, overlap warning.

Accept: create/edit/delete/complete persists across reload; links resolve to
real courses; kanban + list render; no `tsc`/eslint errors.

## Phase 2 — Scheduling + home

1. Week-chunk editor + `TaskWeekView`.
2. `TaskBadge` + home hooks (`SimplifiedMobileHome.tsx:1359-1423,1478-1564`
   week pills `:1111-1113`), color rules + third-line copy from
   `04-scheduling-home.md §4`.
3. `tasksInlineOnHome` setting + separate section + per-course add-task entry.

Accept: chunks render in week view; linked class shows badge/third line on
home; test/DA tint + copy exact; setting toggles placement.

## Phase 3 — Pomodoro + focus

1. Settings keys + Profile UI.
2. `PomodoroTimer` + `FocusPage` + session log.
3. Chunk→plan suggestion.

Accept: timer completes rounds, sessions persist, focus page navigable.

## Phase 4 — Reminders + Moodle

1. `taskReminders.ts` scheduler + quiet hours + default lead setting.
2. `moodleImport.ts` + hub UI + sync toast suggestion.

Accept: reminder fires while app open (fake-timer test + manual);
idempotent import; local done stays local.

## Verification (every phase)

- `npx tsc --noEmit -p tsconfig.json`
- Targeted `npx eslint <files>`
- `npx vitest run <new tests>`
- Manual matrix: embedded + theory-only courses, dark/light, 360px, demo
  mode guards where creation is disabled.
