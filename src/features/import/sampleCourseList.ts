/**
 * The sample course sheet the "Switch Course List" import offers.
 *
 * A student who wants to bring their own list needs to know two things before
 * opening a spreadsheet: what the columns are called, and which of them the
 * app will refuse to run without. Both live in this one file so the sample can
 * never drift from the importer that reads it back — the headings come from
 * `IMPORTABLE_FIELDS` and the required marker from `REQUIRED_FIELDS`, the same
 * constants `importFile` is built on.
 *
 * The marker rides in the heading itself (`CODE (required)`, `TITLE`), because
 * `canonicalHeader` strips bracketed annotations before matching — so the
 * sample states its own rules *and* still round-trips through the importer
 * unedited. Import the file as downloaded and it loads; delete a column and
 * the preview says which one went missing.
 */

import { IMPORTABLE_FIELDS, REQUIRED_FIELDS } from "./normalizeColumns";

/** Filename offered by the download button. */
export const SAMPLE_COURSE_LIST_FILENAME = "amaze-course-list.csv";

/**
 * Example rows, in `IMPORTABLE_FIELDS` order.
 *
 * Deliberately fictional: a sample that used real codes would import as a
 * plausible-looking semester the moment a student tested the button. Values
 * follow VIT's shapes so the edited file lands beside real rows without
 * looking foreign — an `A1+TA1` slot, an `AB3-101` room, a `TH`/`ELA` type.
 * The second row leaves its optional columns blank, which is the part of the
 * shape words cannot say: a lab row with no faculty or room is still a row.
 */
const SAMPLE_ROWS: readonly (readonly string[])[] = [
  ["CSX1001", "Example Theory Course", "TH", "4", "A1+TA1", "DR. EXAMPLE", "AB3-101", "A"],
  ["CSX1002L", "Example Lab Course", "ELA", "1", "L23+L24", "", "", "A"],
];

/** Quote a cell only when a comma, quote or newline makes it necessary. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The sample sheet as CSV text, headings first. */
export function buildSampleCourseListCsv(): string {
  const heading = IMPORTABLE_FIELDS.map((field) =>
    REQUIRED_FIELDS.includes(field) ? `${field} (required)` : field
  );
  const lines = [heading, ...SAMPLE_ROWS].map((row) => row.map(csvCell).join(","));
  return lines.join("\n") + "\n";
}
