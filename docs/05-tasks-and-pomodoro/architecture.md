# Tasks — Architecture

`tasksStorage.ts` — persistence (tasks, Pomodoro sessions); `taskReminders.ts` — foreground scheduler; `taskMatch.ts` — matches tasks to classes/courses; `moodleImport.ts` — LMS → task previews.
`tasksAtom`, `pomodoroSessionsAtom` — atoms; reminders fire only with the app open (no background alarms).
