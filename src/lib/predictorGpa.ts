import { gradePoints } from "./gradeHistory";
import type { CGPA } from "@/types/data/marks";

/**
 * GPA as the marks predictor reports it — two readings of the same roster.
 *
 * Each course carries two engine-derived grade letters:
 *
 * - **optimal** — the pace extended over the remaining weight: where the
 *   ladder lands if current performance just continues. Null until at least
 *   one assessment of the course is recorded.
 * - **maximisable** — the absolute ceiling: every remaining point earned in
 *   full, `100 − points lost` with the grades the lost weight could have
 *   bought subtracted for good. Always defined while the course has a regimen.
 *
 * The scale is VIT's 10-point one and the letter→points table is shared with
 * `gradeHistory.ts`, so a grade is worth the same here as on the grade history
 * screen.
 */

export type GpaCourse = {
  credits: number;
  /** Pace-grade letter, or null while the course has nothing recorded. */
  optimal?: string | null;
  /** Absolute-ceiling letter (`100 − points lost` under fixed boundaries). */
  maximisable?: string | null;
};

export type GpaBreakdown = {
  /**
   * Credit-weighted GPA over the courses whose pace grade exists, 0–10.
   *
   * A course with no prediction contributes neither points nor credits —
   * counting it as a zero would report a semester you failed rather than one
   * you have not sat. The tile pairs this with `optimalCredits`, so it can
   * say "4 of 7 credits graded" instead of hiding the gap.
   */
  optimalSgpa: number;
  /**
   * Credit-weighted GPA over the courses whose ceiling grade exists — the
   * figure the maximisable reading aggregates to, i.e. the semester SGPA if
   * every remaining assessment were scored at its maximum.
   */
  maximisableSgpa: number;
  /** Credits backing `optimalSgpa` (only courses with a pace grade). */
  optimalCredits: number;
  /** Credits backing `maximisableSgpa`. */
  maximisableCredits: number;
  /** Credits on the whole roster, graded or not. */
  semesterCredits: number;
  /**
   * Optimal CGPA, or null when there is nothing to project onto.
   *
   * `null` rather than 0: a zero reads as "you are failing", and the only
   * honest answer before any anchor exists is "not yet".
   */
  optimalCgpa: number | null;
  /**
   * Most desirable CGPA — the projection of the maximisable semester, the
   * best cumulative figure the remaining assessments can still deliver.
   * `optimalCgpa ≤ desirableCgpa` always: maximising per course never lowers
   * a grade.
   */
  desirableCgpa: number | null;
  /** Credits the published CGPA anchor was earned over. */
  cumulativeCredits: number;
  /** True when the optimal projection is the published figure untouched (nothing pace-graded yet). */
  optimalCgpaIsAnchor: boolean;
  /** True when the desirable projection is the published figure untouched. */
  desirableCgpaIsAnchor: boolean;
};

/** Round to 2dp so a tile never renders `8.899999999999999`. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** VTOP numbers travel as strings; a blank or malformed one is a zero, not NaN. */
const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sync the published cumulative figure with one semester reading.
 *
 * The anchor's weight is `creditsEarned` — on the VTOP marks row that is
 * credits *already earned*, prior terms; the semester still in progress has
 * not earned its credits yet, so it is not sitting in that weight. Blending
 * uses the credits actually graded on the reading's side, so one predicted
 * letter leaves the projection mostly at the anchor, and the projection walks
 * towards the semester GPA as grades land.
 */
function projectedCumulative(
  cumulativeCredits: number,
  published: number,
  sgpa: number,
  gradedCredits: number
): { value: number | null; isAnchor: boolean } {
  // No published figure to anchor on: nothing can be projected, whichever
  // side is asking. A blend onto a zero anchor would read as a real decline.
  if (published <= 0 || cumulativeCredits <= 0) {
    return { value: null, isAnchor: false };
  }
  if (gradedCredits <= 0) {
    // No prediction on this side to move the number: the published figure
    // IS this side's best answer.
    return { value: round2(published), isAnchor: true };
  }
  return {
    value: round2(
      (cumulativeCredits * published + gradedCredits * sgpa) /
        (cumulativeCredits + gradedCredits)
    ),
    isAnchor: false,
  };
}

export function predictGpa(
  courses: readonly GpaCourse[],
  cumulative?: CGPA | null
): GpaBreakdown {
  const creditOf = (c: GpaCourse) =>
    Number.isFinite(c.credits) && c.credits > 0 ? c.credits : 0;

  // Each reading sums over its own origin: only courses whose letter the
  // engine actually produced.
  let optimalCredits = 0;
  let optimalWeighted = 0;
  let maximisableCredits = 0;
  let maximisableWeighted = 0;
  for (const c of courses) {
    const credits = creditOf(c);
    if (credits === 0) continue;
    const optimalPoints = gradePoints(c.optimal);
    if (optimalPoints !== null) {
      optimalCredits += credits;
      optimalWeighted += optimalPoints * credits;
    }
    const maximisablePoints = gradePoints(c.maximisable);
    if (maximisablePoints !== null) {
      maximisableCredits += credits;
      maximisableWeighted += maximisablePoints * credits;
    }
  }
  const semesterCredits = courses.reduce((sum, c) => sum + creditOf(c), 0);

  const optimalSgpa = optimalCredits > 0 ? round2(optimalWeighted / optimalCredits) : 0;
  const maximisableSgpa =
    maximisableCredits > 0 ? round2(maximisableWeighted / maximisableCredits) : 0;

  const cumulativeCredits = toNumber(cumulative?.creditsEarned);
  const published = toNumber(cumulative?.cgpa);
  const optimalProjection = projectedCumulative(cumulativeCredits, published, optimalSgpa, optimalCredits);
  const desirableProjection = projectedCumulative(cumulativeCredits, published, maximisableSgpa, maximisableCredits);

  return {
    optimalSgpa,
    maximisableSgpa,
    optimalCredits,
    maximisableCredits,
    semesterCredits,
    optimalCgpa: optimalProjection.value,
    desirableCgpa: desirableProjection.value,
    cumulativeCredits,
    optimalCgpaIsAnchor: optimalProjection.isAnchor,
    desirableCgpaIsAnchor: desirableProjection.isAnchor,
  };
}
