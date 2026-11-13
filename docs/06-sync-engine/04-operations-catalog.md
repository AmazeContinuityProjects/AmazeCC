---
title: "Operations Catalog"
description: "every named engine operation, what it costs, what it fetches, and what it writes — the vocabulary of the sync engine."
---

# 04 — Operations Catalog

> **In one line:** every named engine operation, what it costs, what it fetches, and what it
> writes — the vocabulary of the sync engine.
> **Verify:** `src/lib/sync-engine/operations.ts` and `sync-engine/index.ts` re-exports.

## All registered ops (name → meta)

| Op                | Label / category                                                                       | Auth        | Cost   | Writes                                               |
| ----------------- | -------------------------------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------- |
| `attendanceMarks` | Attendance & marks — academics                                                         | vtop        | heavy  | atoms + `attendance`/`marks`; sets OD/percentage     |
| `marksStats`      | Cohort statistics — academics                                                          | vtop        | medium | `marksStatsAtom` merged; cache                       |
| `grades`          | Grades — academics                                                                     | vtop        | medium | grades summary + all-grades                          |
| `schedule`        | Exam schedule (via FFCS bundle) — exams                                                | vtop        | heavy  | `scheduleAtom`, cache                                |
| `hostel`          | Hostel — campus                                                                        | vtop        | medium | `hostelDataAtom`                                     |
| `calendar`        | Academic calendar — academics                                                          | vtop        | medium | `calendarDataAtom`                                   |
| `core`            | Core bundle (unified /grades + FFCS fetch + hostel + calendar + images) — bundle       | vtop        | heavy  | grades/marks/schedule/hostel/calendar/profile-images |
| `officialOd`      | Official OD records                                                                    | vtop        | light  | `officialOdAtom`                                     |
| `whoami`          | Identity & profile (cached) — profile                                                  | vtop        | medium | storage cache                                        |
| `studentProfile`  | Profile details — profile                                                              | vtop        | medium | `profile` storage; `activeRegNumberAtom`             |
| `pastAttendance`  | Past semester attendance — profile                                                     | vtop        | heavy  | `frozen_attendance_*`                                |
| `fresher`         | Fresher resources — onboarding                                                         | none        | light  | `fresherCache`                                       |
| `buses`           | Dayscholar buses — campus                                                              | none/worker | light  | `busesCache`                                         |
| `transport`       | Transport registration — campus                                                        | vtop        | medium | `transportCache`                                     |
| `events`          | EventHub events — campus                                                               | eventhub    | heavy  | `eventHubEventsAtom`, `registeredEventsAtom`         |
| `bulk`            | Extra endpoints (exc-reg, minor-honour, course-completion, payments, wallet…) — bundle | vtop        | heavy  | `cache_*` each                                       |
| `lms`             | Moodle deadlines — productivity                                                        | vtop        | heavy  | `lmsCache`                                           |
| `circulars`       | Circulars viewer — information                                                         | vtop        | medium | cache                                                |
| `curriculum`      | Curriculum & branches — academics                                                      | vtop        | medium | `curriculumCache` (FFCS pickers read this)           |
| `qcm`             | QCM view — information                                                                 | vtop        | medium | cache                                                |
| `ffcs`            | FFCS bundle (feedback/registration/wishlist/schedule/qcm) — registration               | vtop        | heavy  | everything FFCS-related; the one legal source        |
| `social`          | Social sync — social                                                                   | vtop        | medium | peer list, grants, busy maps (see social atoms)      |
| `finance`         | Fee dues/receipts/wallet — finance                                                     | vtop        | medium | dues caches                                          |

## FFCS fan-out — the sentence to memorize

Anything that ends up as **exam schedule**, **registration schedule**, **wishlist**, or
**feedback status** is parsed from the single `/api/ffcs` response. `schedule` and `core`
both reach it via `fetchFfcsAll()` (tracking labels: `"schedule"` vs `"ffcs"`). One HTTP call.
No parallel paths. If you need one slice only, pass `section:` to the API through the same op.

## Demo mode

Every op short-circuits: `storage.demoMode.get()` guard suppresses captcha, failure recording,
and VTOP-specific work. Demo returns fixtures; engine behaves as if it succeeded (with
`console.warn` traces in places).

## A note on `core`

`core` is not an extra endpoint — it's the **bundle** the API returns for the bulk of a fresh
login (`unified /grades` + FFCS bundle + optional hostel/calendar/profile images). Running it
during sign-in gives the student a populated app for the price of ~3 VTOP pages.

## Quiz

1. Student taps "Refresh" on the schedule screen — which single op fires, and which API payload does it parse?
2. Why is `grades` not called separately during sign-in?
3. Which op publishes `activeRegNumberAtom`, and who consumes it?
