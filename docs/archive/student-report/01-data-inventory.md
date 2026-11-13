---
title: "Data inventory and source coverage"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# Data inventory and source coverage

This inventory is based on AmazeCC sync operations, local storage abstractions, data types, and the connected screens/features. Sync success and field availability vary by student, campus, VTOP response, and selected sync mode. Report generation must collect only the active student's data.

## Identity and profile

| Data                                                                               | AmazeCC source                                         | Report use                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Name, registration number, programme/branch, school, campus and profile attributes | `studentProfile` sync; `profile` storage               | Header and student particulars; show only fields actually present                   |
| Profile image                                                                      | `profile-images` sync; `profileImages` storage         | Optional identity photograph in report header; never substitute an unrelated avatar |
| Friendly name/nickname                                                             | local settings                                         | Optional display name only when configured                                          |
| Semester identity                                                                  | active identity, attendance/marks payloads, grade maps | Identify current semester and label each dataset with its own semester              |

Exclude VTOP/Moodle/KOHA usernames and passwords, `IDs`, cookies, CSRF, authorizedID, EventHub session IDs, access tokens, and any other authentication material.

## Academic performance and course records

| Data                                  | Source                                                                        | Coverage / caveat                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current semester registered courses   | timetable/schedule, attendance and marks                                      | Course code/title, type/category, credits, faculty, slot, venue/class identifiers when available                                                                              |
| Attendance course summary             | `attendanceMarks` -> attendance payload                                       | Attended, total, percentage, registration date, faculty, slot/venue, class ID and category where present                                                                      |
| Attendance dates and status           | each attendance item's `viewLink` detail rows                                 | Include all available rows per date with original status. Some payloads omit details or contain only a link; disclose that limitation rather than fabricate daily attendance. |
| Official OD                           | `officialOd` sync and OD data                                                 | Preserve date, course/type, hours and source status. Distinguish confirmed official OD from inferred/locally tracked OD.                                                      |
| Attendance snapshots across semesters | `pastAttendance` and `frozenAttendance` storage                               | Historical semester attendance summaries/details when available; a snapshot is not necessarily a complete daily ledger.                                                       |
| Current assessment marks              | `attendanceMarks` marks response                                              | Assessment title, max mark, score, weighted mark, weightage, status and course identity as supplied                                                                           |
| Cohort/class mark statistics          | `marksStats`                                                                  | Optional anonymized aggregate context. Include only aggregate statistics and clarify cohort basis; never expose individual classmates.                                        |
| Semester grade history                | `grades` and `all-grades`                                                     | Semester GPA, course code/title/type, final grade, grand total, grade breakdown/components and grade range when present                                                       |
| CGPA and grade distribution           | grade/CGPA details                                                            | CGPA, registered/earned/required credits and S/A/B/C/D/E/F/N counts when supplied. Keep registered, earned, and required distinct.                                            |
| Curriculum and basket progress        | `curriculum` sync                                                             | Basket/distribution, required credits, earned credits and derived completion; preserve source labels                                                                          |
| GPA and marks projections             | marks predictor state, `gpaGoal`, `marksPredictorStorage` and predictor logic | Include current-semester prediction range/grade ladder, target grade and required marks only when a valid calculation exists; mark as estimate and state assumptions          |
| Semester course plan / FFCS data      | FFCS timetable and course selections                                          | Include active registered timetable only in academic schedule section; optional appendix may list saved planner schedules as planning data, clearly separated from enrollment |
| Exam schedule                         | core `schedule` / `ept-schedule` sync and exam schedule helpers               | Per course exam type/date/session/time/venue/room if returned; mark absent values as unavailable                                                                              |
| Academic calendar                     | `calendar`                                                                    | Academic events, holidays, instruction-day order and exam windows with dates; distinguish calendar entries from exams scheduled for the student                               |
| Circulars                             | `circulars` cache                                                             | Optional academic notices relevant to semester. Include title/date/reference and only full text if source payload contains it.                                                |

## Student services and financial records

| Data                                   | Source                                                            | Report use / caveat                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fee dues / payment status              | `bulk` payments request; cache `payments`; legacy `payments_dues` | Dues status and amounts only if present in actual payload. Preserve source status and last sync.                                                                                                               |
| Receipt list and receipt detail tables | `payment-receipts`; caches                                        | Receipt number/date/campus/amount and receipt detail fields. Do not print receipt download URLs or disclose gateway secrets. Paginated source data must be fully collected where supported or labeled partial. |
| Wallet ledger                          | `wallet`                                                          | INR/USD ledger entries, credit/debit/refund amounts, particulars, transaction date, book balance and receipt reference. Treat as sensitive and opt-in.                                                         |
| Payment status events                  | payment flow/status results if locally retained                   | Include timestamped initiated/pending/success/failure/cancel/refund transitions only when the app actually has event history. A current dues status is not a status event history.                             |
| Hostel                                 | `hostel` sync                                                     | Room/block/mess and related student-specific fields that are present. Highly sensitive: opt-in; omit roommates' names and contacts.                                                                            |
| Leave / EPT / acknowledgement          | `ept-schedule`, `acknowledgement` bulk data                       | Student's own requests/records and statuses with dates. Do not treat a class schedule or acknowledgement as an approved leave unless its status says so.                                                       |
| Library dues                           | `library-due`                                                     | Borrowed/overdue/dues information returned for the student; omit unrelated catalogue searches and other patrons' data.                                                                                         |
| Transport                              | `transport`, bus cache                                            | Student-linked route/registration/transport status when returned. Public bus route catalogue and broad bus data do not belong in a personal report.                                                            |
| Moodle/LMS                             | `lms` sync / `lms-data`                                           | Course-linked assignments, deadlines, submission/completion status and grades where present. Include current and historical records returned; do not include LMS credentials.                                  |
| Registered events                      | EventHub `events/profile`                                         | Student's own registrations and status. Public event listings are excluded unless useful as a dated academic calendar item.                                                                                    |

## Locally maintained student data

Include only records that are meaningfully student-specific and support an academic record or its interpretation:

- Predictor course/assessment setup, target grade and saved GPA goal.
- Custom homework/tasks and due dates, optionally as a clearly labeled planning appendix.
- Pomodoro/focus session totals only if the user explicitly enables a study activity appendix; individual session history is not part of the default academic record.
- Official OD helper state and wasted-OD tracker as derived tracking, never as an institutional record.
- User-authored notes/homework, with opt-in because text may be private.

Exclude credentials, UI theme/layout, dismissed tips, tour state, app installation/device state, analytics/PostHog, crash logs, sync diagnostics, bug reports, local caches that duplicate included data, FFCS generator preferences, classmate/friend schedules, and public datasets. These do not represent the student's academic record. Never include any friend's/classmate's personal data.

## Coverage checklist for implementation

Before calling the report complete, confirm the collector checks: `attendance`, `marks`, `grades`, `allGrades`, `schedule`, `hostel`, `calendar`, `profile`, `profileImages`, `marksStats`, `registeredEvents`, `moodleData`, `vitolData`, `transportData`, `officialOd` for every available semester, frozen/past attendance, `curriculum`, caches for payments/receipts/wallet, EPT schedule, acknowledgement, buses, library dues, circulars, predictor storage, GPA goal, custom tasks/homework, and optional focus history. This is a source checklist, not a directive to print every cache verbatim.
