> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/README.md` for current documentation.

# Visual and export specification

## Page and typography

- Primary target: print-ready A4 portrait PDF, with sensible margins and no bleed. Use a consistent page grid and repeated page header/footer.
- Visual character: official examination document structure with restrained color, clear labels and table-first information design. Avoid gradients, large illustrations, decorative cards, and ornamental charting.
- Use embedded, legible fonts with broad Indian-script/Unicode support. Body text should remain readable in print; tables may be compact but must not become microscopic. Prefer wrapping long course titles over clipping.
- Keep headings, student identity, semester labels and table headers consistent. Repeat table headings after page breaks; avoid splitting a row where possible.
- Header: AmazeCC logo at left and student's selected profile photo at right; student name and registration number are prominent. Keep the photo proportionally cropped with a neutral border. If unavailable, use a labeled neutral placeholder, not a generated likeness.
- Footer: report generation date, page number, report version, and non-official status. No sensitive identifiers in a public URL or QR code.

## Color modes

Provide two explicit export choices:

1. **Greyscale**: white paper, black/dark gray text, light gray table fills/rules, and shape/text labels in addition to any status color. It must remain distinguishable on a monochrome printer.
2. **Color**: restrained institutional-style navy/blue accent with one muted secondary accent. Use color for section markers, subtle table header fills and status emphasis only. Maintain readable contrast and never encode status through color alone.

Both modes use the same content, pagination logic, and data. No semantic meaning may depend on color. Provide an on-screen print preview and estimated page count before download.

## Content density and navigation

- Summary first, then current semester, historical semesters, cumulative progress, forecasts, schedules, services and appendices.
- Use compact key-value blocks for particulars, aligned numeric columns for marks/credits, and date-first tables for attendance.
- Use restrained rules and whitespace to separate sections. Charts are optional and secondary; use a small GPA trend only if it remains legible in greyscale.
- Include a contents/index page for long reports and section bookmarks in the PDF where supported.
- Tables sort semesters current-first; attendance sorts by date then course; transactions sort newest-first in display unless a chronological ledger is clearer. State sort order.
- Use locale-aware dates and INR formatting, while retaining original source strings when parsing would be ambiguous. Keep decimals appropriate to source precision.

## Output and completeness

PDF is the primary artifact and is generated directly in the browser with jsPDF drawing real text and vector table rules. Embed only photographic/logo assets as images; keep report text searchable and crisp. It should download without opening the browser print dialog. An optional machine-readable JSON export should accompany the PDF for audit/analysis, with the same provenance, inclusion settings, and missing-data markers. A flat unescaped CSV is not an acceptable substitute for nested report data; if provided, create separate well-formed files/tables for courses, attendance rows, assessments, payments, etc.

The export must include all selected source rows, not just the first page of a paginated endpoint. On oversized reports, paginate and repeat headers; never silently truncate. If a source cannot be fully collected, label that section partial and state what was collected. Report generation must be reproducible from a frozen collection snapshot and timestamped.

## Suggested visual hierarchy

1. Cover particulars and report metadata.
2. One-page academic summary.
3. Semester dossier pages (current semester first).
4. Cumulative history and curriculum.
5. Predictions, schedules and calendar.
6. Opt-in services/finance sections.
7. Optional student planning appendix and data coverage index.
