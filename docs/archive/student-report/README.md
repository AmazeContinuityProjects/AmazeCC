> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/README.md` for current documentation.

# AmazeCC Student Report

## Purpose

Define a complete, printable student report assembled from the information AmazeCC currently stores or fetches. The visual reference is a restrained Indian examination hall ticket: formal hierarchy, compact tables, restrained rules, and readable typography. This is a student generated informational document, not a VIT or government issued certificate.

## Documents

- [Data inventory](./01-data-inventory.md): app data sources, coverage, and completeness limits.
- [Report contents](./02-report-contents.md): proposed sections and ordering.
- [Visual and export specification](./03-visual-and-export.md): page design, greyscale/color modes, and long report behavior.
- [Calculations and provenance](./04-calculations-and-provenance.md): formulas, labels, missing data, and prediction rules.
- [Privacy and inclusion](./05-privacy-and-inclusion.md): sensitive fields and explicit inclusion controls.

## Scope

“Full” means include all student-linked academic and student-service records that AmazeCC can currently retrieve, plus relevant local academic planning data. It does not mean every cache, credential, analytics event, app preference, public catalogue, or other student's data. The report must never include passwords, auth tokens, cookies, session identifiers, private keys, or credentials.

The report should include an at-a-glance core followed by detailed appendices. Each section indicates source, semester/date range, last fetched time where known, and whether it is official source data, user-entered data, or an AmazeCC calculation. Unavailable and empty are distinct states.

## Reference review

The sibling `../fkvit` report generator was reviewed: `student_report_data.dart`, `report_data_collector.dart`, `pdf_generator.dart`, and `json_export_service.dart`. Useful coverage includes identity and academic profile, CGPA/credits/grade distribution, curriculum and basket progress, semester GPA, complete grade and assessment history, receipts, JSON/CSV/text exports, and a non-affiliation disclaimer. AmazeCC's scope extends this with datewise attendance, official OD, current marks predictions, schedules, payment ledger/status data, timetable/calendar, LMS, hostel, library, transport, and local study-planning records. FKVIT's assumptions should not override AmazeCC's source payloads.

## Implementation status

These files are a product and data contract, not an implemented report feature. No app code or tests have been changed as part of this documentation pass.
