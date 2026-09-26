# Tasks — Pomodoro + Focus Page (Phase 3)

## 1. Settings (`settingsAtoms.ts`, ProfilePage Academic section)

| Key | Default | Meaning |
|---|---|---|
| `taskPomodoroFocus` | 25 | Focus minutes per round |
| `taskPomodoroBreak` | 5 | Break minutes between rounds |
| `taskPomodoroRounds` | 4 | Rounds before a long break (long break = 3× break) |

Reuse the `updateSetting(key, val)` pattern (`ProfilePage.tsx:265`).

## 2. Timer (`PomodoroTimer.tsx`)

- Modes: per-task (bound `taskId`, defaults from task override → settings)
  or standalone (course picker optional).
- `setInterval` 1s tick, phase machine focus → break → … → done; round dots;
  pause/resume/reset/skip; completion chime via `soundEnabled` setting.
- On finish: append `PomodoroSession` to localStorage `pomodoroSessions`
  (cap 200, FIFO trim); optionally mark linked chunk covered.
- Compact variant embeds in `TaskEditSheet`; full variant lives on Focus page.

## 3. Focus page (`FocusPage.tsx`, route inside Tasks hub)

- Distraction-free: current task title + course chip, big timer ring (reuse
  `CircularProgress` from amazeui), round progress, pause / complete / skip,
  "up next" from today's chunks.
- Entering focus sets a `focusingTaskId` atom; home "today" strip can show a
  subtle "Focusing: X" pill linking back (P3 stretch).

## 4. Chunk → plan suggestion

For a task with `schedule` chunks: `suggestPomodoros(chunkMinutes)` returns
`{ rounds, focusMin }` filling the chunk with focus+break cycles; one-tap
"Apply" writes it to `task.pomodoro`. Pure function in `taskMatch.ts`,
unit-tested.
