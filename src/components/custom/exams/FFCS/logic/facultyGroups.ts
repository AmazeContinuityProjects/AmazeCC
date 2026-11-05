import chennaiSchema from "@/data/campus/chennai.json";
import type { TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import { parseCourseRows } from "@/lib/freeClassrooms";
import { COLORS } from "@/lib/ffcsConstants";
import type { AddedCourse } from "@/lib/ffcsTypes";
import { splitSlots } from "@/lib/slots";
import { getSelectedFinalReportPath } from "@/lib/ffcsReports";

/**
 * Faculty name groups, and the schedule built from one group.
 *
 * The FFCS report names a faculty member once per row, in whatever spelling the
 * spreadsheet author typed — `"PARTHIBAN V"` on one row, `"V PARTHIBAN"` on the
 * next, `"Dr. Parthiban"` on the portal. Nothing else in the app can tell those
 * apart, so a faculty schedule asked for by name either comes back empty or
 * comes back half a person.
 *
 * This module does the one thing that makes a faculty schedule possible: it
 * collapses the spellings into groups, keeps every spelling it saw, and answers
 * "which group does this name belong to?" deterministically. The matching is
 * deliberately rote — normalise, compare token sets, take the first group that
 * matches — because the ordering is what the Faculty Explorer relies on: the
 * first group whose names match a directory entry is the one whose schedule is
 * shown, so the answer does not depend on how the list happened to be sorted
 * that day.
 *
 * Pure except for `loadFacultyOfferings`, which is the only function here that
 * touches `localStorage`/the network.
 */

/**
 * A report row as the faculty model sees it.
 *
 * `ParsedCourse` (which carries `ROOM`) and `FreeRoomCourse` (which carries
 * `VENUE`) are both structurally compatible, so the FFCS tab can hand over its
 * own `rawParsedCourses` and the Faculty Explorer can hand over rows read from
 * the shared `ffcs_raw_courses` cache without either side translating.
 */
export interface FacultyOffering {
  CODE: string;
  TITLE: string;
  TYPE: string;
  CREDITS: string;
  SLOT: string;
  FACULTY: string;
  ROOM?: string;
  VENUE?: string;
  ERP_ID?: string;
  CLASS_ID?: string;
}

/**
 * One faculty member, as the report's spellings of them.
 *
 * `key` is either the unique ERP ID (`erp:${erpId}`) when the report supplies
 * one or the sorted-token identity. `canonical` is the first spelling seen and
 * is what the UI displays. `names` is every spelling observed, in first-seen
 * order, so the UI can show that a group is more than one string. `erpId` is
 * the faculty member's employee ID.
 */
export interface FacultyNameGroup {
  key: string;
  canonical: string;
  names: string[];
  offerings: FacultyOffering[];
  erpId?: string;
}

/** Loose titles that prefix a portal name and never carry identity. */
const HONORIFICS = new Set(["DR", "PROF", "PROFESSOR", "MR", "MRS", "MS", "MISS", "SMT", "SHRI", "SRI", "ER", "KUM"]);

/**
 * Fold a name to its comparable form.
 *
 * Uppercased, punctuation and digits dropped, parenthetical suffixes (`"(APT)"`)
 * removed, whitespace collapsed, leading honorifics stripped. Only letters and
 * spaces survive, which is the point: `"Dr. Parthiban, V."` and `"PARTHIBAN V"`
 * both become `"PARTHIBAN V"`.
 */
export function normalizeFacultyName(name: string): string {
  let value = String(name ?? "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = value.split(" ").filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.has(tokens[0])) {
    tokens.shift();
  }
  return tokens.join(" ");
}

/** The group identity: normalised tokens, sorted, so word order cannot split a group. */
export function facultyGroupKey(name: string): string {
  return normalizeFacultyName(name).split(" ").filter(Boolean).sort().join(" ");
}

/**
 * Whether two names refer to the same group.
 *
 * Exact group-key equality covers every reordering of the same tokens. The
 * subset fallback covers a directory entry carrying a middle name the report
 * omits (`"PARTHIBAN V X"` vs `"PARTHIBAN V"`), but only when the smaller set
 * has two tokens or more — a single shared initial is not identity, and letting
 * it match would make `"S"` resolve to the first faculty whose name contains an
 * `S`.
 */
export function facultyNameMatches(a: string, b: string): boolean {
  const keyA = facultyGroupKey(a);
  const keyB = facultyGroupKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const tokensA = new Set(keyA.split(" "));
  const tokensB = new Set(keyB.split(" "));
  const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  return smaller.size >= 2 && [...smaller].every((token) => larger.has(token));
}

/**
 * Collapse report rows into faculty groups, in first-seen order.
 *
 * Order is load-bearing: `findFirstMatchingGroup` walks this array and returns
 * the first hit, which is the contract the Faculty Explorer depends on.
 */
export function buildFacultyNameGroups(offerings: readonly FacultyOffering[]): FacultyNameGroup[] {
  const groups: FacultyNameGroup[] = [];
  const byKey = new Map<string, FacultyNameGroup>();

  for (const offering of offerings) {
    const raw = String(offering.FACULTY ?? "").trim();
    const erpId = String(offering.ERP_ID ?? "").trim();
    if (!raw && !erpId) continue;
    // When an ERP ID is present, it uniquely identifies the faculty member,
    // avoiding collisions between distinct instructors sharing the same name
    // and correctly grouping all classes taught by that instructor.
    const key = erpId ? `erp:${erpId}` : facultyGroupKey(raw);
    if (!key) continue;

    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        canonical: raw || `Faculty (${erpId})`,
        names: raw ? [raw] : [],
        offerings: [],
        erpId: erpId || undefined,
      };
      byKey.set(key, group);
      groups.push(group);
    } else {
      if (raw && !group.names.includes(raw)) {
        group.names.push(raw);
      }
      if (!group.erpId && erpId) {
        group.erpId = erpId;
      }
    }
    group.offerings.push(offering);
  }

  return groups;
}

/**
 * The first group whose names or ERP ID match, or null.
 *
 * "First" is the requirement, not a detail: a directory entry is matched against
 * the group list in report order, so the schedule shown is the one belonging to
 * the first spelling the report used for that person. When an ERP ID is supplied
 * or detected, exact ERP matching takes precedence over heuristic name comparison.
 */
export function findFirstMatchingGroup(
  groups: readonly FacultyNameGroup[],
  identifier: string,
  erpId?: string | null,
): FacultyNameGroup | null {
  const cleanErp = String(erpId ?? "").trim();
  if (cleanErp) {
    const match = groups.find((g) => g.erpId === cleanErp || g.key === `erp:${cleanErp}`);
    if (match) return match;
  }

  const cleanIdent = String(identifier ?? "").trim();
  if (cleanIdent.startsWith("erp:") || /^\d{3,}$/.test(cleanIdent)) {
    const targetErp = cleanIdent.replace(/^erp:/, "").trim();
    const match = groups.find((g) => g.erpId === targetErp || g.key === `erp:${targetErp}`);
    if (match) return match;
  }

  for (const group of groups) {
    if (group.names.some((candidate) => facultyNameMatches(candidate, cleanIdent))) {
      return group;
    }
  }
  return null;
}

/**
 * A group's offerings as a timetable.
 *
 * Each report row is one class: `SLOT` is `"A1+TA1"`, so it is split into the
 * individual slots the grid expects. Rows with no real slot (`NIL`) become a
 * course with no slots, which the grid renders as a plain list entry.
 */
export function facultyGroupToAddedCourses(group: FacultyNameGroup): AddedCourse[] {
  return group.offerings.map((offering, index) => ({
    id: `${group.key}::${index}`,
    code: offering.CODE,
    title: offering.TITLE,
    slots: splitSlots(offering.SLOT).filter((slot) => slot !== "NIL"),
    faculty: offering.FACULTY,
    venue: offering.ROOM || offering.VENUE || "TBA",
    credits: offering.CREDITS || "0",
    type: offering.TYPE || "Theory",
    color: COLORS[index % COLORS.length],
  }));
}

/**
 * The Chennai periods a faculty schedule is drawn on.
 *
 * The FFCS planner hardcodes `GLOBAL_CAMPUS = "chennai"` (there is no setter),
 * so this is the one schema the schedule can be drawn against. Theory and lab
 * are filtered the same way the planner filters them — lunch is not a class.
 */
export function facultySchedulePeriods(): { theory: TimetablePeriod[]; lab: TimetablePeriod[] } {
  const theory = (chennaiSchema.theory as TimetablePeriod[]).filter((period) => !period.lunch);
  const lab = (chennaiSchema.lab as TimetablePeriod[]).filter((period) => !period.lunch);
  return { theory, lab };
}

type OfferingLike = {
  CODE?: string;
  TITLE?: string;
  TYPE?: string;
  CREDITS?: string;
  SLOT?: string;
  FACULTY?: string;
  ROOM?: string;
  VENUE?: string;
  ERP_ID?: string;
  "ERP ID"?: string;
  EMPLOYEE_ID?: string;
  "EMPLOYEE ID"?: string;
  CLASS_ID?: string;
  "CLASS ID"?: string;
  CLASS_NBR?: string;
  "CLASS NBR"?: string;
};

function toOffering(row: OfferingLike): FacultyOffering {
  const erp = String(row.ERP_ID ?? row["ERP ID"] ?? row.EMPLOYEE_ID ?? row["EMPLOYEE ID"] ?? "").trim();
  const classId = String(row.CLASS_ID ?? row["CLASS ID"] ?? row.CLASS_NBR ?? row["CLASS NBR"] ?? "").trim();
  return {
    CODE: String(row.CODE ?? "").trim(),
    TITLE: String(row.TITLE ?? "").trim(),
    TYPE: String(row.TYPE ?? "").trim(),
    CREDITS: String(row.CREDITS ?? "0").trim(),
    SLOT: String(row.SLOT ?? "").trim(),
    FACULTY: String(row.FACULTY ?? "").trim(),
    ROOM: String(row.ROOM ?? row.VENUE ?? "").trim(),
    ERP_ID: erp || undefined,
    CLASS_ID: classId || undefined,
  };
}

/**
 * Load the FFCS report rows for a consumer that is not the planner itself.
 *
 * Dynamically resolves from the selected semester's final course allocation
 * report (`/ffcs/winter-2026-2027-final-ffcs.csv` or `/ffcs/fall-2026-2027-final-ffcs.csv`).
 */
export async function loadFacultyOfferings(semesterId?: string | null): Promise<FacultyOffering[]> {
  const XLSX = await import("xlsx");
  const reportPath = getSelectedFinalReportPath(semesterId);
  const response = await fetch(reportPath);
  if (!response.ok) throw new Error("Failed to load FFCS course report");
  const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
  const parsed = parseCourseRows(rows);
  return parsed.map(toOffering);
}
