# Calculations, provenance, and missing data

## Source labeling

Every report section or field must be traceable to one of:

- **Source record**: copied from a VTOP, Moodle, KOHA, EventHub, transport, or other connected system payload.
- **AmazeCC calculation**: computed from source records using named formulas.
- **Student entry**: locally entered planning data or notes.
- **Forecast**: predictor output, never an official result.

Include source system, semester or date range, fetched/generated timestamp where available, and coverage state. Avoid presenting the app/API's illustrative documentation examples as actual schema guarantees; use runtime payload fields and app types.

## Required calculation rules

- Attendance course percentage = attended classes / total classes, using source counts. Overall attendance = total attended / total conducted across the selected set, not an unweighted mean of course percentages. If totals are absent or zero, render unavailable.
- Classes missed = total conducted minus attended only when both counts are compatible and supplied. Do not count OD hours as attended classes unless the source explicitly includes them in attendance totals. Show official OD separately.
- Datewise missed classes are only available from detailed attendance rows. Do not infer absence from a registration date, aggregate count, calendar day, or missing detail row.
- Grade/credit totals must retain published source values. SGPA/CGPA should be source-provided whenever possible; any AmazeCC recomputation must be labeled and must use documented grade points and credit eligibility rules.
- Grade distribution counts must identify their population (all history or selected term). Do not assume F/N treatment, retakes, or non-graded courses when reporting pass rates.
- Curriculum completion = earned / required credits only when the source reports both and denominator is positive. Report missing basket progress separately from zero progress.
- Marks weighted totals and prediction values must use the existing AmazeCC predictor logic and its assessment weights. Expose assumptions, excluded/missing assessments, predictor scope and calculation timestamp. Do not recreate formulas in the PDF renderer.
- Payment summaries must use exact currency and transaction semantics. Keep fee dues, successful receipts, wallet debits, refunds and pending/failed payments in separate categories; don't sum the same payment twice.

## Semester ordering and identity

Determine the active semester from current app identity/sync context, not by lexical sorting alone. Pin current semester first. Order older semesters chronologically where IDs can be interpreted, and preserve the source label for display. Historical attendance snapshots must remain attached to their source semester; never combine term counts into current-term totals.

## Missing, partial, and conflicting values

Use explicit states: `Available`, `Not synced`, `Not provided by source`, `No records`, `Partial`, or `Conflicting source values`. Do not render a missing numeric value as 0. Retain source strings for statuses and dates that cannot be normalized safely. Where two sources conflict, prefer the authoritative connected source for that field, show the discrepancy in the coverage notes, and do not silently choose a favorable value.

If a fetch fails, use cached data only with its original fetched timestamp and a stale marker. A report should snapshot the data used so its displayed timestamp and values remain internally consistent even if a sync occurs during PDF rendering.

## Forecast labels

Every forecast must say “AmazeCC estimate” and include a concise statement that it is not an institutional grade/result. Show assumptions and scope next to the result, such as remaining assessments, selected courses, target grade, assumed scores, or attendance forecast. Do not place prediction values in the published grade history table.

## Collection completeness

Report the time window and pagination/completeness status per source. For current app state, distinguish “no record exists” from “the app does not retain historical events.” In particular, a current payment state is not a payment event log, and an attendance aggregate is not datewise attendance history. Include all available past semesters and detail rows; never synthesize absent records.
