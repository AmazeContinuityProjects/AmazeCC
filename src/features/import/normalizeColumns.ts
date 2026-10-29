/**
 * Turning a spreadsheet's column headings into this app's fields.
 *
 * A student's file did not come from anywhere in particular — VTOP export,
 * an instructor's own sheet, a hand-typed CSV — so the headings are the one
 * part of an import that can never be trusted. "Course Code", "COURSE_CODE",
 * "code" and "Sub Code" all mean the same column, and a file that guesses
 * wrong about which is which silently imports a semester with no slots.
 *
 * Everything here is deliberately forgiving on input and strict on output:
 * headings are case- and punctuation-insensitive and may carry a BOM, but a
 * column that matches nothing is *left out* rather than mapped to a
 * neighbouring field. An absent field is a visible error; a misfiled one is
 * not.
 */

import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";

/** The columns this app can consume, as they appear on `ParsedCourse`. */
export type ImportableField = "CODE" | "TITLE" | "TYPE" | "CREDITS" | "SLOT" | "FACULTY" | "ROOM" | "BATCH";

/**
 * Every importable field, in sheet order.
 *
 * The order is the one a course list reads best in — identify, describe,
 * classify, then where and with whom — and is what the downloadable sample
 * sheet is built from, so the sample and this table cannot disagree.
 */
export const IMPORTABLE_FIELDS: readonly ImportableField[] = [
  "CODE",
  "TITLE",
  "TYPE",
  "CREDITS",
  "SLOT",
  "FACULTY",
  "ROOM",
  "BATCH",
];

/** Everything a row is required to have before it can become a course. */
export const REQUIRED_FIELDS: readonly ImportableField[] = ["CODE", "SLOT"];

/**
 * Accepted spellings per field, most specific first.
 *
 * Order matters where an alias is a prefix of another: `"credits"` must be
 * tested before `"credit"` would be, and `"course code"` before `"code"`, so
 * that a heading matching the long form is not later stolen by the short one
 * when two candidates are compared by length.
 */
const ALIASES: Record<ImportableField, readonly string[]> = {
  CODE: ["course code", "coursecode", "course_code", "subject code", "subjectcode", "sub code", "subcode", "code", "courseno", "course no", "course number", "crs code"],
  TITLE: ["course title", "coursetitle", "course_title", "course name", "coursename", "subject name", "subjectname", "title", "name", "description"],
  TYPE: ["course type", "coursetype", "type", "category", "course category", "kind"],
  CREDITS: ["credit hours", "credithours", "l-t-p", "ltp", "credits", "credit", "crs", "cr"],
  SLOT: ["course slot", "courseslot", "time slot", "timeslot", "theory slot", "slot(s)", "slots", "slot"],
  FACULTY: ["faculty name", "facultyname", "faculty/fac", "professor", "professor name", "instructor", "instructor name", "faculty", "prof", "staff", "teacher"],
  ROOM: ["class room", "classroom", "venue", "room", "room no", "location", "building"],
  BATCH: ["batch name", "batchname", "batch", "section", "group", "division"],
};

/**
 * `Venue` is what the shipped `ffcsReport.csv` calls the room column while the
 * loader has always read `VENUE` — so both spellings land on one field and the
 * two readers cannot disagree about where a class meets.
 */
const CANONICAL_BY_FIELD: Record<ImportableField, string> = {
  CODE: "CODE",
  TITLE: "TITLE",
  TYPE: "TYPE",
  CREDITS: "CREDITS",
  SLOT: "SLOT",
  FACULTY: "FACULTY",
  ROOM: "ROOM",
  BATCH: "BATCH",
};

/**
 * The name `ParsedCourse` uses for each importable field.
 *
 * Everything but the room is spelled identically to the import name; `ROOM`
 * arrives from a sheet as `VENUE`. Kept as a map rather than assumed equal so
 * that renaming a field on the type is a one-line change here rather than a
 * silent mismatch across the import.
 */
export const PARSED_COURSE_KEY: Record<ImportableField, keyof ParsedCourse> = {
  CODE: "CODE",
  TITLE: "TITLE",
  TYPE: "TYPE",
  CREDITS: "CREDITS",
  SLOT: "SLOT",
  FACULTY: "FACULTY",
  ROOM: "ROOM",
  BATCH: "BATCH",
};

/**
 * A heading as it is comparable: annotation removed, no byte-order mark (a CSV
 * written on Windows starts with one and Excel strips it only sometimes), no
 * case, no punctuation.
 *
 * `" Slot(s) "` → `"slot"` — note the non-breaking space a spreadsheet will
 * happily use where a person would type a normal one, and the bracketed `(s)`,
 * which is an annotation on the name rather than part of it. Brackets come off
 * *before* the punctuation is flattened: afterwards they are indistinguishable
 * from any other space and the distinction is gone for good.
 */
export function canonicalHeader(header: string): string {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9+-]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Which field this heading names, or `null` if it names none.
 *
 * Three passes, each narrower than the last, and every one of them willing to
 * return nothing:
 *
 * 1. Exact — by far the common case.
 * 2. Bracket-stripped exact, for `"Slot(s)"`.
 * 3. A heading that *starts or ends with* a multi-word alias, for
 *    `"Course Code (VIT)"` or `"Subject Code - Undergraduate"`.
 *
 * The third pass is restricted to multi-word aliases on purpose. A lone
 * `"slot"` or `"batch"` sitting inside a longer phrase is far likelier to be
 * describing the column than naming it — `Slot Machine` and `Batch Intake
 * Capacity` are both real headings in the wild — and claiming them would file
 * a number of seats under a field nobody can see was filled wrong. A
 * misfiled column is silent; an unmatched one shows up as "no course code
 * column" and the student can act on it.
 */
export function normalizeHeader(header: string): ImportableField | null {
  const key = canonicalHeader(header);
  if (!key) return null;

  const entries = Object.entries(ALIASES) as [ImportableField, readonly string[]][];
  for (const [field, aliases] of entries) {
    if (aliases.includes(key)) return field;
  }

  for (const [field, aliases] of entries) {
    if (aliases.some((alias) => alias.includes(" ") && (key.startsWith(alias + " ") || key.endsWith(" " + alias)))) {
      return field;
    }
  }

  return null;
}

/** All headings a row carries, keyed by the field each one names. */
export function detectColumns(headers: readonly string[]): Map<string, ImportableField> {
  const found = new Map<string, ImportableField>();
  const claimed = new Set<ImportableField>();
  for (const header of headers) {
    const field = normalizeHeader(header);
    // First spelling wins: if a sheet has both `COURSE CODE` and `CODE`, the
    // first is the one its author meant, and silently preferring the other
    // would import the wrong column without saying so. The key stays the
    // heading, because that is the spelling `row` will later be read under.
    if (field && !claimed.has(field)) {
      claimed.add(field);
      found.set(header, field);
    }
  }
  return found;
}

/** Was any column in this sheet recognised as `field`? */
export function hasField(columns: ReadonlyMap<string, ImportableField>, field: ImportableField): boolean {
  for (const detected of columns.values()) if (detected === field) return true;
  return false;
}

/**
 * A row as raw text, for every field a detected column supplied.
 *
 * Values are read as written and trimmed; a missing column yields `undefined`
 * rather than `""` so the caller can tell "this sheet has no room column"
 * from "this room is blank".
 */
export function normalizeRow(
  row: Record<string, unknown>,
  columns: ReadonlyMap<string, ImportableField>
): Partial<Record<ImportableField, string>> {
  const out: Partial<Record<ImportableField, string>> = {};
  for (const [header, field] of columns) {
    const raw = row[header];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).replace(/^\uFEFF/, "").trim();
    if (value) out[field] = value;
  }
  return out;
}

/**
 * A normalised row as a `ParsedCourse`, or `null` when it cannot be one.
 *
 * A course without a code cannot be targeted and a course without a slot
 * cannot be timetabled, so both are dropped here rather than imported as a
 * row that would fail later and for a less obvious reason.
 *
 * `TYPE` defaults to `TH` because that is what a VIT course is unless the
 * sheet says otherwise, and an unknown type would render as an empty chip
 * everywhere it is displayed.
 */
export function toParsedCourse(
  values: Partial<Record<ImportableField, string>>
): ParsedCourse | null {
  const code = values.CODE?.toUpperCase();
  const slot = values.SLOT?.toUpperCase();
  if (!code || !slot) return null;

  return {
    CODE: code,
    TITLE: values.TITLE ?? "",
    TYPE: (values.TYPE ?? "TH").toUpperCase(),
    CREDITS: values.CREDITS ?? "0",
    ROOM: values.ROOM ?? "",
    SLOT: slot,
    FACULTY: values.FACULTY ?? "",
    BATCH: values.BATCH ?? "",
  };
}

/** Every heading in `headers` this importer did not recognise. */
export function unrecognizedColumns(headers: readonly string[]): string[] {
  return headers.filter((header) => String(header ?? "").trim() && !normalizeHeader(header));
}
