# Attendance — Storage & State

> No atom lives without its boot rehydration or an honest "empty state".

## Atoms owned/consumed

`attendanceDataAtom` **(own)** · `calendarDataAtom` **(own)** · `odHoursDataAtom` **(own)** ·
`marksDataAtom` (read for cross-render coloring) · `marksStatsAtom` (read for distribution chip) ·
`settingsAtom` (dark mode, privacy flags)

## Storage keys

`attendance` (payload) · `marks` (shared with marks UI) · `calendar` · `frozen_marks_<sem>`
(grades side; referenced for frozen attendance equivalent receipts) · `sync_times` (refresh stamp) ·
`officialOD_*` per semester · `uni_cc_acustom…` (legacy leftovers, tolerated)

## Lifecycle

Boot → `useAppBootstrap` reads `storage.attendance`/`calendar` → atoms → tab renders stale-labeled
data → student taps sync → op writes fresh → `setAttendanceAndOD` updates atoms + storage → re-render.

Semester switch wipes attendance-linked caches implicitly (full sync replaces, never merges across terms).
