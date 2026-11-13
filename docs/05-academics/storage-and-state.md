---
title: "Academics — Storage & State"
---

# Academics — Storage & State

## Atoms (all written by the engine; read everywhere)

`marksDataAtom` · `marksStatsAtom` · `gradesDataAtom` · `allGradesDataAtom` · `scheduleDataAtom` ·
`vitolDataAtom` · `qcmDataAtom` · `attendanceDataAtom` (read for overlap)

## Storage keys

`marks` · `allGrades` · `grades` · `schedule` · `frozen_grade_*` · `cache_curriculum` (via op `curriculum`) ·
`cache_proof_pdf_*`? (not used) · `course_dashboard_target` / `_tab` (hand-off, session-scoped)

## Session scope

Everything here is _current semester only_ except `allGrades` (full degree). The exam schedule from the
FFCS bundle is re-fetched per sync — fine to cache for a single session, stale across semesters.

## The stale-label contract

Every number on this tab is labeled freshness. If you see one without a "synced" badge or a
"last updated" line, that's a bug — file it.
