/**
 * Reading a uploaded course sheet into this app's rows.
 *
 * The same job the static `ffcsReport.csv` loader does on mount, but for a
 * file a student chose, and therefore for headings nobody here wrote. The
 * shipped report works because its columns are known in advance; an arbitrary
 * export does not, so this goes through `normalizeColumns` instead of assuming
 * `CODE`/`SLOT` and reading `VENUE` under whichever of two spellings happens
 * to be present.
 *
 * `xlsx` is imported dynamically, as the rest of the app already does. It is
 * the largest dependency in the project and the planner reaches it only when a
 * student actually uploads something — the course list the app starts with
 * never pays for it.
 */

import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";
import { detectColumns, hasField, normalizeRow, toParsedCourse, unrecognizedColumns, type ImportableField } from "./normalizeColumns";

/** What an upload produced, in enough detail to preview it before importing. */
export interface FileImport {
  /** Usable rows, in sheet order. Empty when `error` is set. */
  courses: ParsedCourse[];
  /** The raw normalised rows behind `courses`, for the preview table. */
  rows: Partial<Record<ImportableField, string>>[];
  /** Headings found, in sheet order. */
  headers: string[];
  /** Columns this importer did not recognise. */
  ignoredHeaders: string[];
  /** Fields no column supplied at all — `SLOT` among them means nothing can run. */
  missingFields: ImportableField[];
  /** The sheet that was read. */
  sheet: string | null;
  /** The file's name, echoed so the preview can say what it is showing. */
  source: string;
  /** Rows that arrived but could not become a course. */
  skipped: number;
  /** Set when there is nothing to show. */
  error: string | null;
}

const NO_SHEET = "No readable sheet found in this file.";

/** Extensions read as delimited text rather than as a zip. */
const TEXTUAL = /\.(csv|tsv|txt)$/i;

/**
 * Read a file the student picked into importable rows.
 *
 * Never throws: a corrupt file, a sheet of formulas, or a non-spreadsheet
 * renamed to `.xlsx` all come back as an `error` with no rows, because this is
 * called straight from a file input where an exception would surface as a
 * blank screen instead of as a message.
 */
export async function importFile(file: File | Blob): Promise<FileImport> {
  const source = (file as File).name || "uploaded file";

  const empty = (error: string): FileImport => ({
    courses: [],
    rows: [],
    headers: [],
    ignoredHeaders: [],
    missingFields: [],
    sheet: null,
    source,
    skipped: 0,
    error,
  });

  try {
    const XLSX = await import("xlsx");

    // A `.csv` is read as text and a workbook as bytes. SheetJS sniffs both
    // formats from a byte array, but reading the text path as bytes would
    // hand it a UTF-8 BOM it does not strip reliably — which turns the first
    // heading into `\uFEFFCODE` and, because no heading then matches, every
    // column in the file into an unnamed one.
    const isText = TEXTUAL.test(source);
    const workbook = isText
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) return empty(NO_SHEET);

    const sheet = workbook.Sheets[sheetName];

    // The header row read separately, because `sheet_to_json` otherwise uses
    // the first row as the key *and* consumes it — there is no second read
    // that gives both the names and the row beneath them.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const headerRow = (grid[0] ?? []) as unknown[];
    const headers = headerRow.map((cell) => String(cell ?? "").trim());
    if (!headers.some((header) => header)) return empty("The first row of this file has no column headings.");

    const columns = detectColumns(headers);
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const rows = rawRows.map((row) => normalizeRow(row, columns));
    const courses: ParsedCourse[] = [];
    let skipped = 0;
    for (const row of rows) {
      const course = toParsedCourse(row);
      if (course) courses.push(course);
      else skipped++;
    }

    const missingFields = (
      ["CODE", "SLOT", "TITLE", "FACULTY"] as ImportableField[]
    ).filter((field) => !hasField(columns, field));

    if (courses.length === 0) {
      return {
        ...empty(
          hasField(columns, "CODE") && hasField(columns, "SLOT")
            ? "No rows in this file had both a course code and a slot."
            : `This file has no ${!hasField(columns, "CODE") ? "course code" : "slot"} column.`
        ),
        headers,
        ignoredHeaders: unrecognizedColumns(headers),
        missingFields,
        sheet: sheetName,
        skipped: rows.length,
        rows,
      };
    }

    return {
      courses,
      rows,
      headers,
      ignoredHeaders: unrecognizedColumns(headers),
      missingFields,
      sheet: sheetName,
      source,
      skipped,
      error: null,
    };
  } catch (err) {
    return empty(err instanceof Error && err.message ? err.message : "This file could not be read.");
  }
}

/**
 * Merge an upload into an existing course list, replacing same-course rows.
 *
 * A student who re-uploads a corrected sheet expects it to *take*, not to be
 * appended beside the version it fixes. Rows are matched on course code, so
 * the second upload replaces every offering of that course while courses it
 * does not mention survive — which is what allows a partial sheet to be
 * imported without losing the rest of the semester.
 */
export function mergeCourses(
  existing: readonly ParsedCourse[],
  incoming: readonly ParsedCourse[]
): ParsedCourse[] {
  const replaced = new Set(incoming.map((course) => course.CODE));
  return [...existing.filter((course) => !replaced.has(course.CODE)), ...incoming];
}
