---
title: "Tasks — Data Model"
---

# Tasks — Data Model

`Task = { id, kind, title, notes?, courseCode?, dueAt?, completedAt?, pomodoroEstimate, status }` · `PomodoroSession = { taskId?, startedAt, minutes, kind: "focus"|"break" }` · `WeekChunk` groups for week view (lib/tasksStorage + types/tasks.ts).
