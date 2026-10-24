import chennaiSchema from "@/data/campus/chennai.json";
import type { TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import { parseCachedCourses, parseCourseRows } from "@/lib/freeClassrooms";
import { COLORS } from "../constants";
import type { AddedCourse } from "../types";

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
}

/**
 * One faculty member, as the report's spellings of them.
 *
 * `key` is the sorted-token identity (order-independent, so `"PARTHIBAN V"` and
 * `"V PARTHIBAN"` land in the same group). `canonical` is the first spelling
 * seen and is what the UI displays. `names` is every spelling observed, in
 * first-seen order, so the UI can show that a group is more than one string.
 */
export interface FacultyNameGroup {
  key: string;
  canonical: string;
  names: string[];
  offerings: FacultyOffering[];
}

/** Loose titles that prefix a portal name and never carry identity. */
const HONORIFICS = new Set([
  "DR",
  "PROF",
  "PROFESSOR",
  "MR",
  "MRS",
  "MS",
  "MISS",
  "SMT",
  "SHRI",
  "SRI",
  "ER",
  "KUM",
]);

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
  return normalizeFacultyName(name)
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
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
    if (!raw) continue;
    const key = facultyGroupKey(raw);
    if (!key) continue;

    let group = byKey.get(key);
    if (!group) {
      group = { key, canonical: raw, names: [raw], offerings: [] };
      byKey.set(key, group);
      groups.push(group);
    } else if (!group.names.includes(raw)) {
      group.names.push(raw);
    }
    group.offerings.push(offering);
  }

  return groups;
}

/**
 * The first group whose names match `name`, or null.
 *
 * "First" is the requirement, not a detail: a directory entry is matched against
 * the group list in report order, so the schedule shown is the one belonging to
 * the first spelling the report used for that person.
 */
export function findFirstMatchingGroup(
  groups: readonly FacultyNameGroup[],
  name: string
): FacultyNameGroup | null {
  for (const group of groups) {
    if (group.names.some((candidate) => facultyNameMatches(candidate, name))) {
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
    slots: String(offering.SLOT ?? "")
      .split("+")
      .map((slot) => slot.trim().toUpperCase())
      .filter((slot) => slot && slot !== "NIL"),
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
};

function toOffering(row: OfferingLike): FacultyOffering {
  return {
    CODE: String(row.CODE ?? "").trim(),
    TITLE: String(row.TITLE ?? "").trim(),
    TYPE: String(row.TYPE ?? "").trim(),
    CREDITS: String(row.CREDITS ?? "0").trim(),
    SLOT: String(row.SLOT ?? "").trim(),
    FACULTY: String(row.FACULTY ?? "").trim(),
    ROOM: String(row.ROOM ?? row.VENUE ?? "").trim(),
  };
}

/**
 * Load the FFCS report rows for a consumer that is not the planner itself.
 *
 * The planner keeps its own `rawParsedCourses`; everyone else (the Faculty
 * Explorer, the free-classroom surfaces) reads the shared `ffcs_raw_courses`
 * cache, which `lib/freeClassrooms` normalises — folding the `ROOM`/`VENUE`
 * aliases and stripping the header BOM — and returns nothing rather than
 * throwing when the cache is corrupt. Only when there is no cache at all does
 * this fetch the CSV, so a consumer that has already been to the planner pays
 * nothing.
 */
export async function loadFacultyOfferings(): Promise<FacultyOffering[]> {
  if (typeof window !== "undefined") {
    try {
      const cached = parseCachedCourses(window.localStorage.getItem("ffcs_raw_courses"));
      if (cached.length > 0) return cached.map(toOffering);
    } catch {
      // A cache this function cannot read is "no rows"; fall through to the fetch.
    }
  }

  const XLSX = await import("xlsx");
  const response = await fetch("/ffcs/ffcsReport.csv");
  if (!response.ok) throw new Error("Failed to load FFCS course report");
  const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[workbook.SheetNames[0]]
  );
  const parsed = parseCourseRows(rows);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("ffcs_raw_courses", JSON.stringify(parsed));
    } catch {
      // Quota or privacy mode: the schedule still renders from memory.
    }
  }
  return parsed.map(toOffering);
}
