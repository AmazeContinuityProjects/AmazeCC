/**
 * Smart filters over a list of generated plans.
 *
 * Ported from FFCS-inator's result view (`codechefvit/ffcs` →
 * `src/components/cards/ViewTimeTable.tsx` + `src/lib/{filterUtils,
 * groupTimetables}.ts`): after a run, "N options" is a number nobody can act
 * on — these cuts are how a student narrows N to a handful by the things they
 * actually decide on: where the courses are, when the day starts, who teaches,
 * and which slot layouts are even distinct.
 *
 * Pure on purpose: no state, no storage, no schema singleton. Every predicate
 * is `plan => boolean`, so the results list stays the single source of truth
 * and a filter is a `useMemo` away.
 */

import { periodsForSlot, splitSlots, MORNING_BEFORE_MIN, type CampusSchema, type SlotPeriod } from "./slots";
import type { TimetableState } from "../components/custom/exams/FFCS/types";

/** How a plan's days are cut between morning and evening. */
export type TheorySession = "morning" | "evening" | "mixed";

/**
 * The building a venue names — the letters before the first digit.
 *
 * `"AB3-509"` → `"AB"`, `"PRP230"` → `"PRP"`, `"MAB301"` → `"MAB"`. Their
 * building filter compares venue prefixes, and this is the same rule with the
 * case they normalize to. `null` for nothing usable: a roomless row is
 * *unknown*, not a building every plan shares, which is the trap their filter
 * had to special-case and this one does by construction.
 */
export function buildingOf(venue: string | undefined | null): string | null {
  const raw = String(venue ?? "").trim();
  // `NIL` is the report's own "no venue" marker — all letters, so the regex
  // below would happily read it as a building named NIL and a roomless plan
  // would claim a building nobody teaches in.
  if (!raw || raw.toUpperCase() === "NIL") return null;
  const match = /^[A-Za-z]+/.exec(raw);
  return match ? match[0].toUpperCase() : null;
}

/** Every course in a plan that names a building, in plan order. */
function knownBuildings(plan: TimetableState): string[] {
  const out: string[] = [];
  for (const course of plan.courses) {
    const building = buildingOf(course.venue);
    if (building && !out.includes(building)) out.push(building);
  }
  return out;
}

/**
 * True when every roomed course in the plan sits in one building.
 *
 * A plan with *no* venues is not "same building" — it is unknowable, and
 * grouping it with the AB1-heavy plans would answer a question nobody asked.
 * Returns false for those, so the filter stays honest.
 */
export function isSameBuildingPlan(plan: TimetableState): boolean {
  const buildings = knownBuildings(plan);
  return buildings.length === 1 && plan.courses.some((course) => buildingOf(course.venue) !== null);
}

/** The distinct buildings a plan spans, in plan order (empty = unknown). */
export function planBuildings(plan: TimetableState): string[] {
  return knownBuildings(plan);
}

/**
 * Where a plan's *theory* periods fall relative to the lunch boundary.
 *
 * Labs are excluded on purpose: lab shifts (L1–L60) have their own
 * morning/afternoon numbering that does not track the theory session, and a
 * plan with a 4 PM lab every day would read as "evening" under a naive union.
 * Theory is what students mean when they say "my mornings are free".
 *
 * `"mixed"` for a plan straddling the boundary, and for one with no
 * theory periods at all — a lab-only week is neither.
 */
export function theorySessionOf(plan: TimetableState, schema: CampusSchema): TheorySession {
  let morning = false;
  let evening = false;
  for (const course of plan.courses) {
    for (const slot of course.slots ?? []) {
      for (const period of splitSlots(slot).flatMap((s) => periodsForSlot(schema, s))) {
        if (period.type !== "theory") continue;
        if (period.endMin <= MORNING_BEFORE_MIN) morning = true;
        else evening = true;
      }
    }
  }
  if (morning && evening) return "mixed";
  if (morning) return "morning";
  if (evening) return "evening";
  return "mixed";
}

/** Case-insensitive substring over a course's faculty and code. */
export function planHasFaculty(plan: TimetableState, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return plan.courses.some(
    (course) => course.faculty.toLowerCase().includes(needle) || course.code.toLowerCase().includes(needle),
  );
}

/**
 * The slot signature of a plan — the sorted union of every slot it books.
 *
 * Two options that differ only in *which* faculty holds a slot share a
 * signature; that is what makes "group by slot layout" collapse the twelve
 * `A1+TA1/L15+L16` copies of one week into a single tab with arrows, exactly
 * as their Group-by-Slot view does. `variants` are deliberately not walked:
 * a variant is a sibling result, and folding it into its group's identity
 * would make the representative's signature depend on its siblings.
 */
export function slotSignature(plan: TimetableState): string {
  return Array.from(new Set((plan.courses ?? []).flatMap((course) => splitSlots(course.slots?.join("+") ?? ""))))
    .sort()
    .join("|");
}

/**
 * One representative per distinct slot layout, first-seen.
 *
 * The collapse a student wants before paging: 200 options that are four
 * layouts wearing different faculty become four rows to choose between, and
 * the faculty variations live one click in (the existing variant switcher).
 */
export function uniqueSlotLayouts(plans: readonly TimetableState[]): TimetableState[] {
  const seen = new Set<string>();
  const out: TimetableState[] = [];
  for (const plan of plans) {
    const key = slotSignature(plan);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(plan);
  }
  return out;
}

/** What the result-view filter bar can be set to. */
export interface ResultFilters {
  /** `"all"` = every plan. */
  session: TheorySession | "all";
  /** Only plans whose courses share one building. */
  sameBuilding: boolean;
  /** Case-insensitive faculty *or* code substring; empty = off. */
  facultyQuery: string;
  /** Collapse to one representative per slot layout. */
  groupBySlot: boolean;
}

export const DEFAULT_RESULT_FILTERS: ResultFilters = {
  session: "all",
  sameBuilding: false,
  facultyQuery: "",
  groupBySlot: false,
};

/** True when the bar would change the list at all. */
export function filtersActive(filters: ResultFilters): boolean {
  return filters.session !== "all" || filters.sameBuilding || filters.facultyQuery.trim() !== "" || filters.groupBySlot;
}

/**
 * Apply the bar to a result list, in a fixed order.
 *
 * Layout grouping runs *last*: collapsing before filtering would hide
 * options a student could have matched, and the whole point of the collapse
 * is to summarise the list they already narrowed.
 */
export function applyResultFilters(
  plans: readonly TimetableState[],
  filters: ResultFilters,
  schema: CampusSchema,
): TimetableState[] {
  let out = plans.filter((plan) => {
    if (filters.session !== "all" && theorySessionOf(plan, schema) !== filters.session) return false;
    if (filters.sameBuilding && !isSameBuildingPlan(plan)) return false;
    if (!planHasFaculty(plan, filters.facultyQuery)) return false;
    return true;
  });
  if (filters.groupBySlot) out = uniqueSlotLayouts(out);
  return out;
}

/** The periods a plan books, per day — reused by the pager's summary line. */
export function planPeriods(plan: TimetableState, schema: CampusSchema): SlotPeriod[] {
  return (plan.courses ?? []).flatMap((course) =>
    (course.slots ?? []).flatMap((slot) => splitSlots(slot).flatMap((s) => periodsForSlot(schema, s))),
  );
}
