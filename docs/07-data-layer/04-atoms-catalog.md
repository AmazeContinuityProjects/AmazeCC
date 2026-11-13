---
title: "Atoms Catalog (all 59)"
---

# Atoms Catalog (all 59)

> **Method:** count of `export const …Atom` under `src/store/*.ts(x)` at snapshot time — re-count
> per release. Grouped by file. Columns: `persisted?` = does the value also land in localStorage/vault?

## `authAtoms.ts` (5) — never persist credentials in atoms

| Atom               | Default | Written by                         | Persisted                                                           |
| ------------------ | ------- | ---------------------------------- | ------------------------------------------------------------------- |
| `credentialsAtom`  | `{}`    | Main.tsx / AppHousing hydration    | via vault (`IDs`/password) — atoms hold copies, not source of truth |
| `isLoggedInAtom`   | `false` | AppHousing hydration / login flows | derived from stored session                                         |
| `demoModeAtom`     | `false` | `handleDemoClick`                  | `demoMode` key                                                      |
| `showIntroAtom`    | `true`  | onboarding completes/first visit   | sessionStorage semantics                                            |
| `authorizedIDAtom` | `""`    | sync-engine `login()` publish      | **never** (memory only)                                             |

## `dataAtoms.ts` (19) — everything the engine pushes

`attendanceDataAtom` (attendanceRes) · `marksDataAtom` (marksRes) · `marksStatsAtom`
(`{ [classId]: { μ,σ,topFraction,n } }` merged) · `gradesDataAtom` · `allGradesDataAtom` ·
`scheduleDataAtom` · `hostelDataAtom` · `calendarDataAtom` · `attendancePercentageAtom` ·
`odHoursDataAtom` · `officialOdDataAtom` · `moodleDataAtom` · `vitolDataAtom` (legacy surface) ·
`registeredEventsAtom` · `eventHubEventsAtom` · `tasksAtom` · `pomodoroSessionsAtom` ·
`focusingTaskIdAtom` · `qcmDataAtom`

All written by `state-bridge.ts`; read by screens; persisted by the engine's caches — not by default.

## `settingsAtoms.ts` (1 atom, ~70 fields)

`settingsAtom = atomWithStorage("settings", defaultSettings)` + merge-on-read shim. Sub-atoms:
`showInterfaceOnboardingAtom`? none — kept in same object (`interfaceChosen`, `showIntro`-ish keys).

## `uiAtoms.ts` (26)

`activeTabAtom` · `activeSubTabAtom` · `activeAttendanceSubTabAtom` · `activeToolsSubTabAtom` ·
`activeDayscholarSubTabAtom` · `activeMoreSubTabAtom` · `activeProfileSubTabAtom` ·
`hostelActiveSubTabAtom` · `commandPaletteOpenAtom` · `isShortcutsHelpOpenAtom` ·
`isFeedbackModalOpenAtom` (+ `feedbackModalCategoryAtom`) · `isBugRecordingActiveAtom` (+ 3 recorder atoms) ·
`tasksQuickAddRequestAtom` · `isReloadingAtom` · `progressBarAtom` · `messageAtom` ·
`odHoursIsOpenAtom` · `gradesDisplayIsOpenAtom` · `isOfflineAtom` · `isAPIworkingAtom` · `showReloadBannerAtom`

## `socialAtoms.ts` (8)

`socialIdentityAtom` · `socialPeersAtom` · `socialGrantsAtom` · `socialOwnBusyMapAtom` ·
`socialOwnCoursesAtom` · `activeRegNumberAtom` (from studentProfile op) · `socialSyncStateAtom` ·
`pendingInviteHandleAtom`

## Rules to live by

- Never write atoms outside `state-bridge.ts` or an explicit screen action.
- Never persist `authorizedIDAtom` — if a test shows it surviving refresh, that's a bug.
- Adding an atom → register it here + `state-bridge.ts` + `useAppBootstrap.ts` + this page (in this PR).
