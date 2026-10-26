import type { ParsedCourse } from "./types";

/**
 * The two course reports the planner can load.
 *
 * The previous semester remains available by design: a student comparing an
 * old plan with the new one should not have to clear localStorage or re-upload
 * a spreadsheet to do it. The winter report is the default because it is the
 * semester the planner is being used for now; the previous report is the same
 * `ffcsReport.csv` the app has always shipped.
 */
export type FFCSSemesterId = "winter-2026-2027" | "previous";

export interface FFCSSemesterReport {
  id: FFCSSemesterId;
  /** Full name for headings and status messages. */
  label: string;
  /** Short name for the segmented control. */
  shortLabel: string;
  /** Public path the loader fetches. */
  path: string;
  /** Unique namespace carried by this report's registration class IDs. */
  classIdPrefix?: string;
  /** What the dataset is called in prose, e.g. in an error message. */
  name: string;
}

export const FFCS_SEMESTER_REPORTS: readonly FFCSSemesterReport[] = [
  {
    id: "winter-2026-2027",
    label: "Winter Semester 2026-2027",
    shortLabel: "Winter 2026-27",
    path: "/ffcs/winter-2026-2027-slot-timetable.csv",
    classIdPrefix: "CH202627050",
    name: "Winter Semester 2026-2027 slot timetable",
  },
  {
    id: "previous",
    label: "Previous Semester",
    shortLabel: "Previous",
    path: "/ffcs/ffcsReport.csv",
    name: "previous semester slot timetable",
  },
];

export const DEFAULT_FFCS_SEMESTER: FFCSSemesterId = "winter-2026-2027";
export const FFCS_SEMESTER_STORAGE_KEY = "ffcs_semester";

export function isFFCSSemesterId(value: unknown): value is FFCSSemesterId {
  return FFCS_SEMESTER_REPORTS.some((report) => report.id === value);
}

export function getFFCSSemester(id: string | null | undefined): FFCSSemesterReport {
  return (
    FFCS_SEMESTER_REPORTS.find((report) => report.id === id) ??
    FFCS_SEMESTER_REPORTS.find((report) => report.id === DEFAULT_FFCS_SEMESTER)!
  );
}

/** Resolve a report from a class-ID namespace carried by a name-free share link. */
export function getFFCSSemesterByClassIdPrefix(prefix: string): FFCSSemesterReport | null {
  const matches = FFCS_SEMESTER_REPORTS
    .filter((report) => report.classIdPrefix && prefix.startsWith(report.classIdPrefix))
    .sort((a, b) => (b.classIdPrefix?.length ?? 0) - (a.classIdPrefix?.length ?? 0));
  if (matches.length === 0) return null;
  const longestLength = matches[0].classIdPrefix!.length;
  if (matches.filter((report) => report.classIdPrefix!.length === longestLength).length !== 1) {
    return null;
  }
  return matches[0];
}

export interface OfferingIdentity {
  FACULTY: string;
  SLOT: string;
  ROOM: string;
  ERP_ID?: string;
}

/**
 * Stable identity for one report offering.
 *
 * The old report identified a class by `FACULTY|SLOT|ROOM`, but a name is not
 * an identity: two people can share one, and one person can be spelled several
 * ways. The winter report carries the employee's ERP ID, so it is appended when
 * present. The legacy form is still accepted so locks saved before the switch
 * keep matching their offering.
 */
export function offeringId(offering: OfferingIdentity): string {
  const base = `${offering.FACULTY}|${offering.SLOT}|${offering.ROOM}`;
  return offering.ERP_ID ? `${base}|${offering.ERP_ID}` : base;
}

export function legacyOfferingId(offering: OfferingIdentity): string {
  return `${offering.FACULTY}|${offering.SLOT}|${offering.ROOM}`;
}

export function offeringMatches(
  offering: OfferingIdentity,
  selected: readonly string[]
): boolean {
  return selected.includes(offeringId(offering)) || selected.includes(legacyOfferingId(offering));
}

/** A spreadsheet cell as the planner wants it: one trimmed line of text. */
const cleanReportText = (value: unknown): string =>
  String(value ?? "").replace(/\s+/g, " ").trim();

/** The first non-empty spelling of a column the report may use. */
const readReportText = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = cleanReportText(row[key]);
    if (value) return value;
  }
  return "";
};

/**
 * Parse the shipped reports into the planner's course shape.
 *
 * The winter report keeps the registration list's own headings (`COURSE CODE`,
 * `EMPLOYEE NAME`, `CLASS ID`, `ERP ID`, `EMPLOYEE SCHOOL`), while the previous
 * report uses the planner's shorter names. Both are accepted here so the same
 * loader can switch between them; extra columns are kept rather than dropped,
 * because the ERP ID is what identifies a faculty member when two people share
 * a name or one person is spelled two ways.
 */
export function parseReportRows(rows: readonly Record<string, unknown>[]): ParsedCourse[] {
  return rows
    .map((row) => {
      const clean: Record<string, unknown> = {};
      for (const key in row) {
        clean[key.replace(/^\uFEFF/, "").trim().toUpperCase()] = row[key];
      }

      const course: ParsedCourse = {
        CODE: readReportText(clean, "CODE", "COURSE CODE", "COURSE_CODE"),
        TITLE: readReportText(clean, "TITLE", "COURSE TITLE", "COURSE_TITLE"),
        TYPE: readReportText(clean, "TYPE"),
        CREDITS: readReportText(clean, "CREDITS") || "0",
        ROOM: readReportText(clean, "VENUE", "ROOM"),
        SLOT: readReportText(clean, "SLOT"),
        FACULTY: readReportText(clean, "FACULTY", "EMPLOYEE NAME", "EMPLOYEE_NAME"),
        BATCH: readReportText(clean, "BATCH"),
      };

      const classId = readReportText(clean, "CLASS ID", "CLASS_ID");
      if (classId) course.CLASS_ID = classId;

      const erpId = readReportText(clean, "ERP ID", "ERP_ID");
      if (erpId) course.ERP_ID = erpId;

      const school = readReportText(clean, "EMPLOYEE SCHOOL", "EMPLOYEE_SCHOOL");
      if (school) course.EMPLOYEE_SCHOOL = school;

      return course;
    })
    .filter((course) => course.CODE);
}
