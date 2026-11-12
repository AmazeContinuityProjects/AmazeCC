# 05 — Sync Modes

> **In one line:** named, ordered lists of ops — Quick (attendance only) … Balanced … Full — and
> everything in between, including user-built customs.
> **Read:** `src/lib/sync-engine/sync-modes.ts`.

## Built-in modes

| id          | Label          | Steps (in order)                                                                                                                                                   |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quick`     | Quick Sync     | `attendanceMarks → marksStats` (background)                                                                                                                        |
| `balanced`  | Balanced Sync  | `attendanceMarks, marksStats, core, studentProfile` + background tail: `pastAttendance, fresher, buses, transport, events, curriculum, qcm, bulk, lms, officialOd` |
| `full`      | Full Sync      | same as balanced, but the background tail is **awaited**                                                                                                           |
| `academics` | Academics Only | `attendanceMarks, marksStats, grades, schedule, calendar, all-grades` + background `curriculum, qcm`                                                               |
| `campus`    | Campus Life    | `events, buses, transport, hostel` + background `social, officialOd`                                                                                               |

Background steps run concurrently after the foreground chain settles — except `full`, which
awaits them and therefore never opens the sheet-close race (the sheet stays open until done).

## The three control elements

- `mode.id` — stable identity (used by `resolveReloadModeId`).
- `mode.steps[]` — `{op, args?, background?}`.
- `mode` ownership — `BUILT_IN_MODES` immutable; customs stored in localStorage
  `sync_custom_modes_v1` (validated by `validateMode` — max 20 steps, known ops only).

## How "Which mode do I run?" is decided

`resolveReloadModeId({switchedSemester, modeId, defaultSyncMode})`:

- **semester switched** → always `full` (all caches are keyed to the term just left)
- explicit `modeId` (palette, settings) wins otherwise
- fallback: `settings.defaultSyncMode` → `"quick"`

## Custom modes

- `expandBulkSteps` / `collapseBulkSteps` — editor stores `bulk` as one step with `args.only`
- `loadCustomModes` filters invalid/unknown ids silently — a mode broken by an upgrade is
  dropped, not crashed on
- `estimateModeCost` badge for the picker: light ≤3, standard ≤10, heavy above

## Quiz

1. Why does a semester switch force `full`, even for Quick-mode fans?
2. What exactly does the `bulk` op do with `args.only`?
3. What does the engine do with a custom mode containing an unknown op after upgrade?
