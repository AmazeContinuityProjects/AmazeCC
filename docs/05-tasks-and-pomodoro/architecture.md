---
title: "Tasks & Pomodoro — Architecture (deep)"
description: "the task board is a local-first planner wired into the ambient app — Moodle feeds it, Pomodoro runs against it, reminders fire while the app is open."
---

# Tasks & Pomodoro — Architecture (deep)

> **In one line:** the task board is a local-first planner wired into the ambient app —
> Moodle feeds it, Pomodoro runs against it, reminders fire while the app is open.

## 1. The data lifecycle

```
Create/edit → tasksStorage.ts (tasks_v1) → tasksAtom (boot-seed)
Moodle fetch → moodleImport.ts → taskPreviews (not persisted) → user approves → tasks
Pomodoro → timer tick → sessions log → tasksStorage → FocusPage renders
```

## 2. Matching to classes (`taskMatch.ts`)

Tasks tagged with courseCode join against the current timetable; the week strip shows them inline;
`taskMatch` is the only bridge between moodle-imported deadlines and the calendar.

## 3. Reminders (`taskReminders.ts`)

Foreground-only scheduler (next fire within 1h tab); no background push — that would need service-worker complicity, deliberately avoided to prevent spam.

## 4. Pomodoro (`PomodoroTimer.tsx`)

Classic 25/5 cadence with custom durations; auto-log `PomodoroSession` on mode end; break suggestions attach to task type.
