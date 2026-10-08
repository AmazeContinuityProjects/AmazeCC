/**
 * CGPA, as a number.
 *
 * ## Why this file exists
 *
 * The Grade History screen has exactly one source for the cumulative figure:
 * `marksData.cgpa`, which comes from the `marks` route. That worked while
 * AmazeCC was the only backend. It stops working the moment a *different*
 * service answers, because `marks` is the one academics route the UniCC
 * fallback does not implement (`marks` is folded into `attendance` there) — so
 * on a UniCC-served session the CGPA tile goes blank and the hero tile falls
 * back to an unweighted mean of term GPAs, which is a different number wearing
 * the same label.
 *
 * Meanwhile `POST /api/grades` — a route UniCC *does* implement — was carrying
 * the published CGPA the whole time, in the row immediately left of the letter
 * counts, and both parsers read only the counts. So the number was on the wire
 * and discarded at the edge.
 *
 * This file turns whatever *is* available into one figure, in a fixed order of
 * trust, and always reports which rung it used. Pure, no React, no config, no
 * storage — same rule as `gradeHistory.ts`, and it shares that file's scale so
 * the two cannot drift apart.
 *
 * ## The order of trust
 *
 * 1. `marks` — VTOP's dashboard CGPA endpoint. Authoritative when present.
 * 2. `grades` — VTOP's own CGPA Details table, same authority, different route.
 * 3. **Derived**: `sum(credits x gradePoints) / sum(credits)` over the effective
 *    grades. This reconstructs VTOP's own formula rather than inventing one.
 *
 * The derived rung exists because of an older UniCC deployment: it serves the
 * grade distribution but not the CGPA cells, so a client that only trusts
 * published figures shows nothing there. It is a reconstruction and the UI says
 * so — {@link Cumulative.source} carries the distinction.
 *
 * ## Why the derived figure is trustworthy
 *
 * Measured against a real published term: the weighted sum over the effective
 * grades gives **9.6170** where VTOP published **9.62**. Same formula VTOP uses
 * (credits as weights, 10-point scale), so agreement to the second decimal is
 * expected rather than lucky. It is still a reconstruction and never overrides
 * a published number when one exists.
 */

import { gradePoints, isGradedLetter } from "./gradeHistory";
import type { CGPA } from "@/types/data/marks";

/**
 * The `grades` route's payload, as far as this file reads it.
 *
 * Typed here rather than imported because the published CGPA fields live on
 * *this* route's shape, which is a different type from `marks`' CGPA — see
 * {@link GradesCgpa}. Both are declared so the two sources stay visibly
 * distinct instead of one being widened into the other.
 */
export type GradesPayload = {
  cgpa?: GradesCgpa;
  effectiveGrades?: unknown;
} | null;

/**
 * The CGPA object on the `grades` route.
 *
 * Overlaps `CGPA` from `marks` but carries `creditsRegistered`, which the
 * dashboard endpoint does not publish. Registered is enrolled-so-far, so it is
 * neither earned nor required and must not be substituted for either.
 */
export type GradesCgpa = CGPA & {
  creditsRegistered?: string;
};

/**
 * One row of the `grades` route's effective-grade table.
 *
 * Named for the payload rather than the meaning: the parser calls the course's
 * title `basketTitle` and its credits `creditsEarned`, which is the wire shape
 * rather than an accurate description. Both names are load-bearing here — see
 * {@link effectiveGradeRows}.
 */
export type EffectiveGradeRow = {
  basketTitle?: string;
  courseType?: string;
  creditsEarned?: string;
  grade?: string;
  distributionType?: string;
};

/** A parsed number, or `null`. Every figure VTOP sends is a string. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Round to 2dp, so a page never renders `8.899999999999999`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The real courses in an `effectiveGrades` payload.
 *
 * ## Why the filter is not optional
 *
 * An older UniCC deployment (and AmazeCC before its parser was fixed) returns
 * eight phantom rows alongside fourteen real courses. They are the header rows
 * of the embedded-course sub-tables, parsed as if they were courses:
 *
 * ```json
 * { "basketTitle": "Course Title", "courseType": "Course Type",
 *   "creditsEarned": "Credits", "grade": "Grade" }
 * ```
 *
 * `creditsEarned` is the literal string `"Credits"`. Left in, they inflate the
 * course count by 57% and, worse, put a non-numeric weight into the CGPA sum
 * below — `Number("Credits")` is `NaN`, which would poison the entire
 * accumulator rather than merely adding a bad row.
 *
 * A real row has numeric credits and a letter on the 10-point scale. Against a
 * real capture the two conditions select an identical set, so both are
 * required and neither is doing the work alone.
 */
export function effectiveGradeRows(payload: GradesPayload): EffectiveGradeRow[] {
  const raw = payload?.effectiveGrades;
  if (!Array.isArray(raw)) return [];
  return (raw as EffectiveGradeRow[]).filter((row) => {
    const credits = num(row?.creditsEarned);
    return credits !== null && credits > 0 && isGradedLetter(row?.grade);
  });
}

export type DerivedCgpa = {
  value: number;
  creditsEarned: number;
  /** How many real courses contributed. */
  courses: number;
  source: "none" | "derived";
};

/**
 * Credit-weighted CGPA from the effective grades.
 *
 * The weight is the course's own credit value and the scale is VIT's 10-point
 * one, both shared with `gradeHistory.ts` — a second hard-coded scale here
 * would be exactly the kind of drift that makes two CGPAs disagree.
 *
 * `N` (not yet graded) and `P` are excluded entirely, from numerator *and*
 * denominator. They are worth zero on the scale, so including them would report
 * a term the student has not been assessed on as one they failed. Verified
 * against a real capture: excluding them yields 9.6170 where VTOP published
 * 9.62.
 *
 * Returns `source: "none"` when nothing is gradable, so a caller can tell "no
 * figure" from "a figure of zero".
 */
export function deriveCgpa(rows: EffectiveGradeRow[]): DerivedCgpa {
  let weighted = 0;
  let credits = 0;
  let courses = 0;

  for (const row of rows) {
    const points = gradePoints(row?.grade);
    const credit = num(row?.creditsEarned);
    if (points === null || credit === null || credit <= 0) continue;
    weighted += points * credit;
    credits += credit;
    courses += 1;
  }

  if (credits <= 0) return { value: 0, creditsEarned: 0, courses: 0, source: "none" };

  return {
    value: round2(weighted / credits),
    creditsEarned: round2(credits),
    courses,
    source: "derived",
  };
}

export type CumulativeSource = "marks" | "grades" | "derived" | "none";

export type Cumulative = {
  value: number;
  creditsEarned: number;
  creditsRequired: number;
  source: CumulativeSource;
};

/**
 * One CGPA, from whatever is available.
 *
 * `marks` and `grades` are each a VTOP-published figure; `derived` is this
 * file's reconstruction and must be labelled as such wherever it is shown. The
 * UI switches on {@link Cumulative.source} for exactly that reason.
 *
 * A published figure only wins when it is a positive number. `"0"` is what an
 * unsynced or empty payload looks like, and letting it win would report a
 * student with no grades a CGPA of zero.
 */
export function resolveCumulative(
  marks: CGPA | null | undefined,
  grades: CGPA | null | undefined
): Cumulative {
  const creditsRequired =
    num(marks?.creditsRequired) ?? num(grades?.creditsRequired) ?? 0;

  const candidates: [CumulativeSource, CGPA | null | undefined][] = [
    ["marks", marks],
    ["grades", grades],
  ];

  for (const [source, payload] of candidates) {
    const value = num(payload?.cgpa);
    if (value !== null && value > 0) {
      return {
        value,
        creditsEarned: num(payload?.creditsEarned) ?? 0,
        creditsRequired,
        source,
      };
    }
  }

  return { value: 0, creditsEarned: 0, creditsRequired, source: "none" };
}

/**
 * The CGPA figure plus where it came from, for the screens that read
 * `marksData.cgpa` directly.
 *
 * The derived rung is only consulted when neither route published anything.
 * Credits earned are taken from whichever source published, because a derived
 * total is the sum of the courses we happened to receive — not the same as the
 * college's record, and preferring it would quietly replace an authoritative
 * credits figure with a partial one.
 */
export function resolveCgpa(
  marks: CGPA | null | undefined,
  gradesPayload: GradesPayload
): {
  cgpa: string | undefined;
  creditsEarned: string | undefined;
  source: CumulativeSource;
} {
  const published = resolveCumulative(marks, marksCgpaFromGrades(gradesPayload));

  if (published.source !== "none") {
    // Passed through as the strings VTOP sends, not the numbers
    // `resolveCumulative` parsed them into. Callers do `Number(...)` on this
    // and a number here would be re-stringified differently depending on the
    // source, which is exactly the kind of drift this file exists to prevent.
    return {
      cgpa: published.value > 0 ? String(published.value) : undefined,
      creditsEarned:
        marks?.creditsEarned ?? marksCgpaFromGrades(gradesPayload)?.creditsEarned ?? undefined,
      source: published.source,
    };
  }

  const derived = deriveCgpa(effectiveGradeRows(gradesPayload));
  if (derived.source === "none") {
    return { cgpa: undefined, creditsEarned: undefined, source: "none" };
  }

  return {
    cgpa: String(derived.value),
    // A route can publish credits without publishing a CGPA — `marks` does
    // exactly that on a session where VTOP's dashboard CGPA came back blank.
    // Those credits are still the college's record, so they win; only the CGPA
    // itself falls back to the derivation. Without this, a student who had 47
    // credits recorded would be shown the 4 that happened to be in the payload
    // we derived from.
    creditsEarned:
      marks?.creditsEarned ??
      marksCgpaFromGrades(gradesPayload)?.creditsEarned ??
      String(derived.creditsEarned),
    source: "derived",
  };
}

/**
 * Pull the `grades` route's CGPA object out of its payload.
 *
 * Only the published cells — never the derived sum. Keeping derivation in one
 * place is what stops `resolveCumulative` and `resolveCgpa` disagreeing about
 * what "published" means.
 */
function marksCgpaFromGrades(gradesPayload: GradesPayload): GradesCgpa | null {
  const cgpa = gradesPayload?.cgpa;
  return cgpa && typeof cgpa === "object" ? cgpa : null;
}