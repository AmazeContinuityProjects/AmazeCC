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
 *   uses the class distribution: S at mean+1.5σ and each lower letter a
 *   half σ down, clamped by VIT's minimums. Needs `classStats`; without them there
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

/**
 * The fixed ladder: earned percentage → the band it falls in.
 *
 * FFCS Academic Regulations v5.0 (ACE), §9.5 Table 6: S ≥ 90,
 * A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 55, E ≥ 50, F < 50. D and E are five points
 * wide, not ten — the pass line is 50 (§9.4 c), so nothing below 50 passes.
 */
export const ABSOLUTE_GRADE_BOUNDARIES: GradedBoundary[] = [
  { grade: "S", limit: 90 },
  { grade: "A", limit: 80 },
  { grade: "B", limit: 70 },
  { grade: "C", limit: 60 },
  { grade: "D", limit: 55 },
  { grade: "E", limit: 50 },
  { grade: "F", limit: 0 },
];

/**
 * How many classmates must have synced before we curve at all.
 *
 * This is *not* the regulation's "class strength ≤ 10 → absolute" rule (v5.0
 * §9.5). That rule is about the real class roll, which for a VIT theory class
 * is normally 60-odd, so the real grading is relative. What we lack is a big
 * enough sample of that class to estimate its mean and σ. The floor of 5 is
 * set by two things:
 *
 * - Privacy: with 3 contributors, one who knows their own mark can solve the
 *   published mean and σ for the other two marks exactly. From 4 up the
 *   system is under-determined; 5 leaves a margin.
 * - Statistics: below 5 a sample σ is noise, and even the prior below cannot
 *   carry the whole estimate.
 */
export const MIN_CURVE_SAMPLE = 5;

/** Below this many contributors the curve is flagged as an early estimate. */
export const CONFIDENT_CURVE_SAMPLE = 15;

/**
 * A typical σ for a VIT theory class's grand totals, and how many degrees of
 * freedom it is worth. A sample of 5 can report σ = 3 or σ = 25 for the same
 * class; trusting either swings every band by ten marks. So the sample
 * variance is pooled with this one, weighted as if it were 4 extra degrees
 * of freedom: at 5 contributors it is half the estimate, at 30 about 12%, at
 * 60 about 6%. Tunable once the server has enough classes to measure it.
 */
const PRIOR_SD = 12;
const PRIOR_DF = 4;

/**
 * The σ the ladder actually uses: the sample σ pooled with `PRIOR_SD`.
 * `((n − 1)·s² + k·σ₀²) / ((n − 1) + k)`, the standard pooled-variance form.
 */
export function effectiveSd(classStats: ClassStats): number {
  const df = Math.max(0, classStats.count - 1);
  const s2 = Number.isFinite(classStats.sd) ? Math.max(0, classStats.sd) ** 2 : 0;
  return Math.sqrt((df * s2 + PRIOR_DF * PRIOR_SD * PRIOR_SD) / (df + PRIOR_DF));
}

/**
 * Whether these statistics are enough to curve on.
 *
 * The server answers every class id it was asked about, so a class nobody has
 * synced comes back as `{ count: 0, mean: 0, sd: 0 }`. Curving on that put
 * every band at 0%, and every student in the class read as an S. A σ of 0 is
 * allowed (five identical totals happen); the prior gives it a spread.
 */
export function hasUsableClassStats(
  classStats?: ClassStats | null
): classStats is ClassStats {
  return (
    !!classStats &&
    Number.isFinite(classStats.count) &&
    classStats.count >= MIN_CURVE_SAMPLE &&
    Number.isFinite(classStats.mean) &&
    Number.isFinite(classStats.sd) &&
    classStats.sd >= 0
  );
}

/** The statistics the ladder is built from, with σ stabilised; null when unusable. */
export function effectiveClassStats(classStats?: ClassStats | null): ClassStats | null {
  if (!hasUsableClassStats(classStats)) return null;
  return { count: classStats.count, mean: classStats.mean, sd: effectiveSd(classStats) };
}

/** Whether a curve rests on few enough contributors to call it an early estimate. */
export function isEarlyEstimate(classStats?: ClassStats | null): boolean {
  return hasUsableClassStats(classStats) && classStats.count < CONFIDENT_CURVE_SAMPLE;
}

/**
 * Whether this course is graded on a curve.
 *
 * Shared with `courseHelpers.checkIsRelative` — which delegates here, so there
 * is exactly one definition. FFCS Academic Regulations v5.0 §9.5 (and v3.2
 * before it — the rule did not change between CBCS and ACE): "All the theory
 * components of the courses … shall follow a class-wise relative grading",
 * covering "a theory or lab-embedded theory course". "All the Laboratory, soft
 * skills, extra-curricular, NGCR courses, and project courses shall adopt the
 * absolute grading method only."
 *
 * So the grading system does not change the answer; the course type does:
 *
 * - Curved: Theory Only, any Embedded Theory variant, and the halves of an
 *   embedded course ("Embedded", "Embedded Lab") — an embedded course gets one
 *   letter on its credit-weighted total, so its lab half reads the same curve.
 * - Fixed: Lab Only, Project, Soft Skill, Online Course, and anything without
 *   a theory component (e.g. Embedded Lab and Project).
 *
 * `courseSystem` stays in the signature so callers that pass it keep working.
 * The "class strength > 10" half of the rule cannot be checked — we never see
 * the class roll — and VIT theory classes are normally far larger, so curving
 * courses are assumed to be above it.
 */
export function isRelativeGrading(
  _courseSystem?: string | null,
  courseType?: string | null
): boolean {
  const type = String(courseType ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!type) return false;
  if (type.includes("theory")) return true;
  return type === "embedded" || type === "embedded lab";
}

/**
 * Share of the class the regulations hand S to when its σ boundary passes 100:
 * "the maximum of 3 or the top 5%". The class roll is unknown (our count is
 * only who synced); for a typical 60-seat class 5% *is* 3, so 5% stands.
 */
const S_TOP_SHARE = 0.05;
/** …and only among students with at least this aggregate. */
const S_TOP_MIN_MARK = 80;

/**
 * The S cutoff when `mean + 1.5σ` exceeds 100 (v5.0 §9.5): "the maximum of 3 or
 * the top 5% students who have scored ≥ 80 marks in aggregate … will be awarded
 * 'S' grade".
 *
 * That is a rank, and a mean and σ alone do not give one. So the cutoff is an
 * estimate: the score the top 5% of the class clears, read off a
 * distribution matched to the class's mean and σ. A normal curve is the wrong
 * shape here — a class whose `mean + 1.5σ` is past 100 is piled against the
 * 100 ceiling, and a normal would put its top 5% above 100 too. Instead the
 * *deficit* `100 − total` is modelled as a gamma distribution with the same
 * mean (`100 − mean`) and σ: bounded at the ceiling, skewed away from it, which
 * is what a near-perfect class looks like. Clamped to [80, 100].
 */
export function estimateTopShareCutoff(mean: number, sd: number): number {
  const deficit = 100 - mean;
  if (!(deficit > 0) || !(sd > 0)) return 100;
  const share = S_TOP_SHARE;
  const shape = (deficit * deficit) / (sd * sd);
  const scale = (sd * sd) / deficit;
  const cutoff = 100 - gammaQuantile(share, shape) * scale;
  return Math.min(100, Math.max(S_TOP_MIN_MARK, Math.round(cutoff)));
}

/** ln Γ(x), Lanczos (g = 7, n = 9); accurate to ~15 digits for x > 0. */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularised lower incomplete gamma P(a, x): series below a + 1, continued fraction above. */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const lnPrefix = a * Math.log(x) - x - lnGamma(a);
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return Math.min(1, sum * Math.exp(lnPrefix));
  }
  // Lentz's continued fraction for Q(a, x) = 1 − P(a, x).
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.max(0, 1 - Math.exp(lnPrefix) * h);
}

/** The p-quantile of a unit-scale gamma(shape): bisection on the monotone CDF. */
function gammaQuantile(p: number, shape: number): number {
  if (p <= 0) return 0;
  let lo = 0;
  let hi = Math.max(1, shape);
  while (gammaP(shape, hi) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (gammaP(shape, mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The ladder for one course: FFCS Academic Regulations v5.0 (ACE), §9.5 Table 5.
 *
 * - Every rung is a σ step from the class mean — S at +1.5σ, A at +0.5σ,
 *   B at −0.5σ, C at −1σ, D at −1.5σ, E at −2σ.
 * - S sits at `mean + 1.5σ` itself. Table 5 prints "with a minimum of 90%
 *   total marks", but that floor (and the fixed S ceilings with it) is
 *   suspended in practice, so on a hard paper S can sit well below 90.
 * - When `mean + 1.5σ` passes 100 the regulations switch S to a rank: "the
 *   maximum of 3 or the top 5% students who have scored ≥ 80 marks in
 *   aggregate" — estimated in `estimateTopShareCutoff`. The same rule covers
 *   a class where nobody reaches the S boundary; that cannot be seen from a
 *   mean and σ, so it is not modelled.
 * - The E–F line is the lower of `mean − 2σ` and 50: on a weak class the
 *   σ value is the pass mark, and on a strong class anyone above 50 that
 *   the formula would fail gets an E instead.
 * - "If the minimum of the grade band exceeds 100%, … the specific letter
 *   grade or better letter grade(s) cannot be issued": a band whose floor
 *   sits above the band over it is squeezed to zero width (never reachable),
 *   and no floor drops below 0.
 * - Limits are "rounded-off" integers (half up) — `Math.round`. The
 *   student's total is rounded *up* before it is read; see `gradeAt`.
 * - σ is `effectiveSd` (sample σ pooled with a typical class σ, so a handful
 *   of contributors cannot swing the bands); fewer than `MIN_CURVE_SAMPLE`
 *   contributors → the absolute ladder.
 */
export function buildGradeBoundaries(
  classStats?: ClassStats | null,
  relative?: boolean
): GradedBoundary[] {
  const stats = relative ? effectiveClassStats(classStats) : null;
  if (!stats) return ABSOLUTE_GRADE_BOUNDARIES;

  const { mean, sd } = stats;
  const sRaw = Math.round(mean + 1.5 * sd);
  const sBoundary = sRaw > 100 ? estimateTopShareCutoff(mean, sd) : sRaw;

  const raw: Array<[GradedBoundary["grade"], number]> = [
    ["S", sBoundary],
    ["A", Math.round(mean + 0.5 * sd)],
    ["B", Math.round(mean - 0.5 * sd)],
    ["C", Math.round(mean - 1.0 * sd)],
    ["D", Math.round(mean - 1.5 * sd)],
    ["E", Math.min(Math.round(mean - 2.0 * sd), 50)],
  ];

  const ladder: GradedBoundary[] = [];
  let ceiling = 100;
  for (const [grade, limit] of raw) {
    const clamped = Math.max(0, Math.min(limit, ceiling));
    ladder.push({ grade, limit: clamped });
    ceiling = clamped;
  }
  ladder.push({ grade: "F", limit: 0 });
  return ladder;
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
  // The epsilon keeps float noise (80.00000000001 from a weighted sum) from
  // ceiling a whole-number total up a mark.
  const weightage = Math.ceil(pct - 1e-9);
  for (const band of boundaries) {
    if (weightage >= band.limit) return band.grade;
  }
  return "F";
}
