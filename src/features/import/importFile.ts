/**
 * Reading an uploaded course sheet into this app's rows.
 *
 * Replaced heavy SheetJS (xlsx) with a fast, zero-dependency delimited text
 * parser (CSV, TSV, TXT). Users uploading Excel workbooks are guided to export
 * or save as CSV.
 */

import type { ParsedCourse } from "@/lib/ffcsTypes";
import {
  detectColumns,
  hasField,
  normalizeRow,
  toParsedCourse,
  unrecognizedColumns,
  type ImportableField,
} from "./normalizeColumns";

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

/**
 * Parse delimited text (CSV, TSV, or semicolon-delimited) with support for RFC 4180
 * quoted values, escaped quotes (""), embedded delimiters, and multiline cells.
 */
export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, "");
  const firstNonEmpty = clean.split(/\r?\n/).find((l) => l.trim().length > 0) || "";

  // Detect delimiter: comma, tab, or semicolon
  let delimiter = ",";
  const commas = (firstNonEmpty.match(/,/g) || []).length;
  const tabs = (firstNonEmpty.match(/\t/g) || []).length;
  const semis = (firstNonEmpty.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) delimiter = "\t";
  else if (semis > commas) delimiter = ";";

  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRecord.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRecord.push(currentField.trim());
        currentField = "";
        if (currentRecord.some((f) => f.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
      } else if (char === "\n") {
        currentRecord.push(currentField.trim());
        currentField = "";
        if (currentRecord.some((f) => f.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    if (currentRecord.some((f) => f.length > 0)) {
      records.push(currentRecord);
    }
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = records[0];
  const headers = rawHeaders.map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < records.length; r++) {
    const rowRecord = records[r];
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        rowObj[header] = rowRecord[c] ?? "";
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Read a file the student picked into importable rows.
 *
 * Never throws: corrupt files or unsupported binary files come back as an `error`
 * with no rows, safely displayed in the preview UI.
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

  if (/\.(xlsx|xls|xlsb)$/i.test(source)) {
    return empty(
      "Excel .xlsx workbooks are not supported directly. Please save or export your spreadsheet as a CSV (.csv) file and upload again.",
    );
  }

  try {
    const text = await file.text();
    if (!text.trim()) {
      return empty("The selected file is empty.");
    }

    const { headers, rows: rawRows } = parseDelimitedText(text);

    if (!headers.some((header) => header)) {
      return empty("The first row of this file has no column headings.");
    }

    const columns = detectColumns(headers);
    const rows = rawRows.map((row) => normalizeRow(row, columns));
    const courses: ParsedCourse[] = [];
    let skipped = 0;
    for (const row of rows) {
      const course = toParsedCourse(row);
      if (course) courses.push(course);
      else skipped++;
    }

    const missingFields = (["CODE", "SLOT", "TITLE", "FACULTY"] as ImportableField[]).filter(
      (field) => !hasField(columns, field),
    );

    if (courses.length === 0) {
      return {
        ...empty(
          hasField(columns, "CODE") && hasField(columns, "SLOT")
            ? "No rows in this file had both a course code and a slot."
            : `This file has no ${!hasField(columns, "CODE") ? "course code" : "slot"} column.`,
        ),
        headers,
        ignoredHeaders: unrecognizedColumns(headers),
        missingFields,
        sheet: "Sheet1",
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
      sheet: "Sheet1",
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
export function mergeCourses(existing: readonly ParsedCourse[], incoming: readonly ParsedCourse[]): ParsedCourse[] {
  const replaced = new Set(incoming.map((course) => course.CODE));
  return [...existing.filter((course) => !replaced.has(course.CODE)), ...incoming];
}
