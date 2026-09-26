# Tasks — Reminders, In-App Scheduler (Phase 4)

## 1. Constraint (verified in research)

The app has **no client-side scheduler**: `src/app/sw.ts:63-83` only renders
inbound server `push` events; all reminder prefs (`notifyAssignments`,
`classReminderLeadMinutes`, quiet hours) are flags sent to the backend cron
(`supabase_setup.sql:25-34`, backend out of repo). So timed task reminders
need a new foreground scheduler.

## 2. Scheduler (`src/lib/taskReminders.ts` + `useTaskReminderScheduler.ts`)

- Pure queue logic stays in `taskReminders.ts`: `buildReminderQueue(tasks,
  settings, now?)` collects `reminders[]` plus `dueDate` (due − default lead)
  into a sorted queue; skips past, done, and quiet-hours windows
  (`pushQuietHoursStart/End`).
- Ownership: `useTaskReminderScheduler()` is mounted **once from `Main`**, so
  the scheduler is app-wide rather than tied to the Tasks tab being open
  (`TasksTab` only subscribes for its in-tab banner). It also requests
  Notification permission once and re-arms on `visibilitychange`.
- Arm a `setTimeout` chain for the head of queue; on fire: `new Notification`
  (if permission granted) plus an app message via `messageAtom`; then advance.
  Rebuild triggers: task CRUD, settings change, app resume.
- `subscribeReminders(fn)` lets any mounted view react to fires without owning
  the timer (used by the Tasks hub banner).
- Works only while the app/PWA is alive — stated in UI copy
  ("Reminders fire while AmazeCC is open").
- Quiet hours: suppress fire, re-queue at window end.
- Default lead setting `taskDefaultReminderMinutes` (default 30), per-task
  `reminders[]` always wins.

## 3. Per-task reminder UX (in `TaskEditSheet`)

- Quick chips: 15m / 1h / 1 day before due + custom datetime picker; list of
  armed times with delete; each maps to an ISO string in `reminders[]`.

## 4. Non-goals

No background/closed-app delivery (would need backend cron extension +
`dueDate` payloads — documented here for later, not built).
