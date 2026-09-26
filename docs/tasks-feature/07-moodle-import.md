# Tasks — Moodle One-Way Import (Phase 4)

## 1. Source shapes (verified)

- Store: `moodleDataAtom: any[]` (`src/store/dataAtoms.ts:21`), persisted to
  `localStorage "moodleData"` with `hidden` merge on `url`
  (`Dashboard.tsx:558-569`, `Main.tsx:726-737`).
- Assignment fields (observed): `name` (`"SemCode/Course/Assignment"`,
  `MoodleDisplay.tsx:91`), `due`, `url`, `done`, `hidden`, `teachers`
  (`MoodleDisplay.tsx:37-132`); VITOL variant uses `opens`
  (`VitolDisplay.tsx:35-104`).
- Inconsistency note: some surfaces read `dueDate/title/courseName`
  (`SimplifiedMobileHome.tsx:349-351`, `MobileHome.tsx:364`) vs canonical
  `due/name` — importer uses canonical fields with fallbacks.

## 2. Mapping → Task

| Moodle | Task |
|---|---|
| `name.split("/")[2] \|\| name` | `title` |
| `name.split("/")[0]` → sanitized | `courseCode` (+ component guess) |
| `due` (skip if `done`/`hidden`/past) | `dueDate` |
| `url` | `moodleUrl` (**dedupe key**) |
| — | `kind: "digital-assignment"`, `status: "pending"` |

## 3. Flow (`moodleImport.ts` in `src/lib/`, new)

- `previewMoodleImport(assignments, tasks)` → matchable list with course
  resolution status; skip `done`, `hidden`, URL-already-linked.
- `importMoodleTasks(selected)` creates tasks; re-running import is idempotent
  via `moodleUrl`.
- Entry points: "Import from Moodle" button in Tasks hub + auto-suggest on
  LMS sync when new assignments appear (toast only, never auto-create).
- Local `done` never writes back (documented limitation).
