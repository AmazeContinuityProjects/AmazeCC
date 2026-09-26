# Tasks Feature — Overview

- **Status:** Approved for phased build
- **Scope:** Homework, reminders, digital assignments, study items, and test records linked to subjects — with week scheduling, kanban/task views, pomodoro + focus page, in-app reminders, one-way Moodle import, and home timetable integration.
- **Mode decision:** Phased build, local-only storage, in-app scheduler, one-way Moodle import (per user).

---

## 1. Vision

A timetable-native task manager: tasks live attached to courses (and their
theory/lab components), occupy real weekly time slots, surface inline on the
home timetable, and escalate visually for tests and digital assignments. It is
deliberately **not** a Notion/Todoist clone — no workspaces, no collaboration,
no cloud — but it should feel more powerful for a VIT student because every
task knows *when* (week chunks, due dates, reminders), *where* (which class it
belongs to), and *how long* (pomodoro plan) it takes.

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Build order | Phased (P1 core → P2 schedule/home → P3 pomodoro/focus → P4 reminders+Moodle) | Each phase independently verifiable |
| Storage | `localStorage` JSON bucket + jotai atom | Matches `notesTracker`/`customHomework`; offline-first, zero backend work |
| Reminders | In-app scheduler (`setTimeout` chain + `Notification`/toast) | No client scheduler exists today (server-push only, `src/app/sw.ts:63-83`); works while app/PWA alive |
| Moodle | One-way import (`moodleUrl` dedupe key) | Backend scrapes LMS; write-back infeasible; local `done` stays local |
| Home placement | Tasks at allotted times inline with linked classes; setting for separate-below-classes section; tests/integrated links always inline | Per user |

## 3. Non-goals

- Cloud sync / multi-device tasks (revisit only if backend tables are added).
- Two-way Moodle status sync.
- Server-side push for task reminders (backend cron is out of repo).
- Recurring tasks v1 (due dates + weekly chunks cover it; recurrence later).
- Time-tracking beyond pomodoro session log.

## 4. Design language

All surfaces follow the established tokens: `rounded-[24px]` hero cards,
`rounded-2xl` joined `divide-y` rows, zinc borders, `font-outfit` black
headlines, emerald/amber/red status colors, `AnimatePresence` transitions.
See `docs/plan-1/attendance-overview.md` for the convention precedent.

## 5. Map of this folder

- `02-data-model.md` — types, status machine, linking rules.
- `03-views.md` — kanban / list / week / quick-add specs + file map.
- `04-scheduling-home.md` — chunks, matching, badges, color rules, setting.
- `05-pomodoro-focus.md` — timer, settings, session log.
- `06-reminders.md` — scheduler design, quiet hours, limitations.
- `07-moodle-import.md` — field mapping, dedupe, refresh.
- `08-build-plan.md` — phases, acceptance criteria, verification.
