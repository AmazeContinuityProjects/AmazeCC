/**
 * Grade boundaries, shared by the marks subpage's grade-insights ladder and
 * the marks predictor.
 *
 * ## Why this file exists
 *
 * The two screens had two different ideas of where a letter starts, and a
 * student saw them disagree about the same course: the marks page said "A"
 * while the predictor's subject list said "C" for the same 67%. The subpage's
 * ladder is not always the fixed one — for courses graded on a curve it shifts
 * to the class distribution — while the predictor read every course off the
 * fixed ladder. Same numbers, different ladder, different letter.
 *
 * The one ladder is defined here in a fixed order of trust:
 *
 * - **Relative grading** (a curve, per `courseSystem` + the subject's type)
 *   uses the class distribution: S at mean+1.5σ and each lower letter a half
 *   σ down, clamped by VIT's minimums. Needs `classStats`; without them there
 *   is nothing to curve around, and the ladder falls back to absolute — the
 *   same "No class data yet — showing default bands" the subpage renders.
 * - **Absolute grading** is the fixed percentage ladder, unchanged for every
 *   caller that predates curves.
 *
 * Pure, no React, no config, no localStorage.
 */

export type GradedBoundary = {
  grade: "S" | "A" | "B" | "C" | "D" | "E" | "F";
  /** lowest percentage (inclusive) that sits in this band */
  limit: number;
};

/** Class-level cohort statistics, as `marksStats[classNbr].overall` carries them. */
export type ClassStats = {
  count: number;
  mean: number;
  sd: number;
};

/** The fixed 10-point ladder: earned percentage → the band it falls in. */
export const ABSOLUTE_GRADE_BOUNDARIES: GradedBoundary[] = [
  { grade: "S", limit: 90 },
  { grade: "A", limit: 80 },
  { grade: "B", limit: 70 },
  { grade: "C", limit: 60 },
  { grade: "D", limit: 50 },
  { grade: "E", limit: 40 },
  { grade: "F", limit: 0 },
];

/**
 * Whether this course is graded on a curve.
 *
 * Shared with `courseHelpers.checkIsRelative` — which delegates here, so there
 * is exactly one definition:
 *
 * - ACE courses: the theory halves (and embedded pairs) are curved; lab halves
 *   keep their fixed thresholds.
 * - Everything else: only pure theory courses curve.
 */
export function isRelativeGrading(
  courseSystem?: string | null,
  courseType?: string | null
): boolean {
  const isACE = courseSystem === "ACE";
  if (isACE) {
    return ["Embedded Theory", "Embedded Lab", "Embedded", "Theory Only"].includes(
      courseType ?? ""
    );
  }
  return courseType === "Theory Only";
}

/**
 * The ladder for one course.
 *
 * The bands land at whole percentages (VTOP's marks table reports whole
 * numbers), and both screens read these very rows so they cannot drift about
 * where a band starts again:
 *
 * - Every rung is a σ step from the class mean — S at +1.5σ, A at +0.5σ,
 *   B at −0.5σ, C at −1σ, D at −1.5σ, E at −2σ. No letter is pinned to the
 *   fixed ladder's percentage: S need not sit at 80+, and the bands slide
 *   wherever the class distribution puts them.
 * - S is capped at 100 so a perfect score can still earn it (and the marks
 *   page's band chart keeps non-negative widths).
 * - The E–F boundary — the pass line — sits at whichever bar is lower: the
 *   σ value (`mean − 2σ`) or the absolute pass mark 50. E's band stretches
 *   down to that boundary: on a weak class E starts at 50, so nobody scoring
 *   above the absolute pass mark fails; on a strong class the pass line is
 *   the σ value itself and lies below 50.
 */
export function buildGradeBoundaries(
  classStats?: ClassStats | null,
  relative?: boolean
): GradedBoundary[] {
  const usable =
    relative &&
    classStats &&
    Number.isFinite(classStats.mean) &&
    Number.isFinite(classStats.sd) &&
    classStats.sd != null;

  if (!usable) return ABSOLUTE_GRADE_BOUNDARIES;

  const { mean, sd } = classStats;
  const sBoundary = Math.min(Math.round(mean + 1.5 * sd), 100);
  const aLower = Math.round(mean + 0.5 * sd);
  const bLower = Math.round(mean - 0.5 * sd);
  const cLower = Math.round(mean - 1.0 * sd);
  const dLower = Math.round(mean - 1.5 * sd);
  const eLower = Math.min(Math.round(mean - 2.0 * sd), 50);

  return [
    { grade: "S", limit: sBoundary },
    { grade: "A", limit: aLower },
    { grade: "B", limit: bLower },
    { grade: "C", limit: cLower },
    { grade: "D", limit: dLower },
    { grade: "E", limit: eLower },
    { grade: "F", limit: 0 },
  ];
}

/**
 * Scan the ladder down until the student's weightage meets a band's floor.
 *
 * The student's weightage ceils to the next whole number first — that is how
 * grades are calculated against these tables: a 79.5 total is an 80 when the
 * band is read, not a 79. Fractional totals never land a band below their
 * whole-number weightage. Band limits themselves are already whole numbers,
 * so the ceil only ever moves the student up, into a better band or the same
 * one — never down.
 */
export function gradeAt(
  pct: number,
  boundaries: GradedBoundary[] = ABSOLUTE_GRADE_BOUNDARIES
): GradedBoundary["grade"] {
  const weightage = Math.ceil(pct);
  for (const band of boundaries) {
    if (weightage >= band.limit) return band.grade;
  }
  return "F";
}
