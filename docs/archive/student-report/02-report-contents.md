> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/README.md` for current documentation.

# Report contents and order

The main report is a complete academic and student-services dossier. Put the active/current semester first in semester-oriented sections, followed by prior semesters in reverse chronological order. Retain original semester labels and source order metadata where ordering is ambiguous.

## Cover and student particulars

- AmazeCC logo, report title (“Student Academic and Services Record”), profile photograph, and a report identifier.
- Student name, registration number, programme/branch, school, campus, current semester, and available profile fields.
- Generated timestamp, data-through timestamp, selected semester/date range, and concise “student-generated informational report; not an official institutional document” notice.
- Do not print date of birth, gender, email, phone, or hostel room in the cover banner by default; allow inclusion through section controls where the source has the field.

## 1. Academic summary

Compact formal summary: CGPA, current/most recent SGPA, registered/earned/required credits, grade counts, curriculum credits remaining/completion, total courses/credits, and source sync freshness. Show a modest term-by-term GPA table and optional thin trend line. Avoid decorative charts where a table communicates the same values.

## 2. Current semester at a glance

Course roster with code, title, type, credits, faculty, slot/venue, attendance fraction and percent, internal assessment summary, current predicted final score/grade where available, and next scheduled exam. Include risk/eligibility status only when produced by existing logic, with threshold and assumptions visible.

## 3. Semester academic record

For current semester first, then each previous semester:

- Semester GPA and credits; course count and earned/pass status when derivable.
- Course grade record: code, title, type, credits, final grade, grand total, component/grade breakdown and grade range where available.
- Detailed assessment marks: assessment title, status, score/max, weightage, weighted score, and date if present.
- Attendance by course: attended/total, percentage, faculty, slot and course metadata.
- Datewise attendance register: date, course, class/category, status (including OD if explicitly represented), and source detail. Group or page by date, never compress away the underlying entries. Add per-date and per-course totals if derivable.
- Attendance summary: total conducted, attended, missed, OD hours/classes kept separate, percentage, and missed-class dates. Mark incomplete date detail.
- Exam schedule for each course: exam type, date, session/time and venue/room, with unscheduled exams listed separately as unavailable/not published.

## 4. Cumulative grade and curriculum history

- Complete grade history across all semesters, including repeat/withdrawal/failed grades exactly as source provides; don't deduplicate retakes.
- Grade distribution and semester SGPA/CGPA chronology.
- Curriculum distribution and basket progress: required/earned/remaining credits and percentage, when source supports those fields.
- Distinguish source-provided figures from AmazeCC totals.

## 5. Current semester AmazeCC forecasts

Per course show the predictor's current estimate/range, assessment inputs, target grade, required marks or score scenarios, and date calculated. State model assumptions and missing/assumed assessments. Include GPA goal scenarios only if configured. Never place forecast values in official grade tables or let forecasts masquerade as published grades.

## 6. Calendar and academic schedule

- Student's course timetable by weekday and slot, including time, venue and faculty when available.
- Exam schedule and calendar dates, preserving event type and source.
- Semester holidays, special day orders, and instruction-day exceptions only where relevant to attendance interpretation.

## 7. Fees and payment record (opt-in)

- Current dues/status summary, fee categories and due dates if present.
- Receipts with date, receipt number, description/category, amount, method and source status.
- Wallet ledger in chronological order, including credit/debit/refund, amount, date, particulars and balance-after when available.
- Payment status transition events only when actual event history is stored. Keep financial totals separated by currency and avoid double-counting receipts and wallet debits.

## 8. Other student services (opt-in subsections)

Hostel/room/mess and own leave records; library loans/dues; transport registration/status; Moodle assignments and submission/grade status; registered events; EPT/acknowledgement records; and relevant academic circulars. Keep contact details, roommate identities, private comments and credentials out of the default PDF.

## 9. Student planning appendix (opt-in)

Show predictor configuration, saved goals, tasks/homework and due dates only if enabled. Identify user-entered content. Keep friend/classmate schedules and non-student app state out of the report.

## Appendices and index

Add a compact data coverage index listing included sections, semesters/date ranges, source freshness, and unavailable sections with reason (not synced, not supplied, empty, partial, or unsupported). Add page numbers and a generated report version. Long tables may continue across pages with repeated headers; do not omit rows to fit a page.
