/**
 * Read-outs built on the grade ladder: how sure a curve is, how far the next
 * letter is, and what the FAT has to deliver for each letter.
 *
 * Pure, no React. The ladder itself lives in `gradeBoundaries.ts`; this file
 * only asks it questions.
 */

import {
  buildGradeBoundaries,
  effectiveClassStats,
  gradeAt,
  type ClassStats,
  type GradedBoundary,
} from "./gradeBoundaries";
import { solveTargetFAT, type TargetFATSolverResult } from "./marksPredictor";

type Letter = GradedBoundary["grade"];
const ORDER: Letter[] = ["S", "A", "B", "C", "D", "E", "F"];

/* ── curve uncertainty ──────────────────────────────────────────────────── */

export type GradeRange = {
  /** The letter on the ladder built from the point estimates. */
  likely: Letter;
  /** Best and worst letter the same total reads across the 95% band of the curve. */
  best: Letter;
  worst: Letter;
};

/**
 * Which letters a total could read once the curve's own uncertainty is counted.
 *
 * The class mean and σ come from the classmates who synced, so they are
 * estimates: the mean is off by about `σ/√n`, and σ itself by about
 * `σ/√(2(n−1))`. The ladder is rebuilt at the corners of the 95% box around
 * both (±1.96 of each) and the total is read on every one. With 60 contributors
 * the corners agree and `best === worst`; with 6 they usually do not.
 *
 * A higher mean makes every band harder, so the best letter comes from the
 * low-mean corners and the worst from the high-mean ones. Null when the course
 * is not curved or the statistics are not usable.
 */
export function gradeRange(
  pct: number,
  classStats: ClassStats | null | undefined,
  relative: boolean
): GradeRange | null {
  const used = relative ? effectiveClassStats(classStats) : null;
  // A hand-entered curve is a what-if, not an estimate: it has no sampling error.
  if (!used || used.manual || !Number.isFinite(pct)) return null;

  const n = used.count;
  const seMean = used.sd / Math.sqrt(n);
  const relSd = 1.96 / Math.sqrt(2 * Math.max(1, n - 1));
  const z = 1.96;

  const likely = gradeAt(pct, ladderAt(used.mean, used.sd));
  let best = likely;
  let worst = likely;
  for (const dm of [-1, 1]) {
    for (const ds of [-1, 1]) {
      // Built directly from these corners: the pooling already happened in
      // `used`, and `buildGradeBoundaries` would pool a second time.
      const corner = ladderAt(used.mean + dm * z * seMean, Math.max(0.1, used.sd * (1 + ds * relSd)));
      const letter = gradeAt(pct, corner);
      if (ORDER.indexOf(letter) < ORDER.indexOf(best)) best = letter;
      if (ORDER.indexOf(letter) > ORDER.indexOf(worst)) worst = letter;
    }
  }
  return { likely, best, worst };
}

/**
 * The ladder for an exact mean and σ, skipping the pooling step.
 *
 * Pooling pulls σ toward the prior by an amount set by `count`; a huge count
 * makes it negligible, so this reuses the one ladder builder rather than
 * keeping a second copy of the Table 5 rules.
 */
function ladderAt(mean: number, sd: number): GradedBoundary[] {
  return buildGradeBoundaries({ count: 1e9, mean, sd }, true);
}

/* ── distance to the next letter ────────────────────────────────────────── */

export type GradeMargin = {
  letter: Letter;
  /** The letter above, or null at S. */
  next: Letter | null;
  /**
   * Percentage points the total must rise by *more than* to reach `next`.
   * Totals are rounded up before they are read (§9.5), so a band starting at L
   * is reached by anything above L − 1.
   */
  toNext: number | null;
  /** The letter below, or null at F. */
  previous: Letter | null;
  /**
   * Percentage points the total can fall by and still keep `letter` (it drops
   * once it falls to L − 1 or below). Null at F.
   */
  cushion: number | null;
};

/**
 * How far a total sits from the bands either side of it.
 *
 * Bands squeezed to zero width (a letter the class cannot be awarded) are
 * skipped, so "next" is always a letter that can actually be reached.
 */
export function gradeMargin(pct: number, boundaries: GradedBoundary[]): GradeMargin | null {
  if (!Number.isFinite(pct)) return null;
  const letter = gradeAt(pct, boundaries);
  const i = boundaries.findIndex((b) => b.grade === letter);
  if (i < 0) return null;

  let next: GradedBoundary | null = null;
  for (let k = i - 1; k >= 0; k--) {
    if (boundaries[k].limit > boundaries[i].limit && boundaries[k].limit <= 100) {
      next = boundaries[k];
      // Keep walking past equal limits so the *best* letter at that limit wins.
      while (k - 1 >= 0 && boundaries[k - 1].limit === next.limit) next = boundaries[--k];
      break;
    }
  }
  const floor = boundaries[i].limit;
  const previous = boundaries.slice(i + 1).find((b) => b.limit < floor) ?? null;

  return {
    letter,
    next: next?.grade ?? null,
    toNext: next ? Math.max(0, round2(next.limit - 1 - pct)) : null,
    previous: letter === "F" ? null : (previous?.grade ?? "F"),
    cushion: letter === "F" ? null : Math.max(0, round2(pct - (floor - 1))),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/* ── FAT needed for every letter ────────────────────────────────────────── */

export type FatNeed = {
  grade: Letter;
  /** The band floor used as the target total. */
  target: number;
  /** Raw FAT mark needed (already at least the 40% theory minimum), or null when out of reach. */
  raw: number | null;
  /** True when the marks so far already reach the band and only the FAT minimum remains. */
  secured: boolean;
  feasibility: TargetFATSolverResult["feasibility"];
};

/**
 * The lowest FAT mark that lands each passing letter — the solver's question
 * asked once per band, so the whole ladder reads in one row.
 *
 * The theory FAT's 40% floor (§9.4 a) is folded in: a band whose maths needs
 * 20/100 still needs 40/100 to pass, so `raw` never sits below the floor for
 * a theory FAT. Bands squeezed to zero width are dropped; F is never a target.
 */
export function fatNeededForEachGrade(
  boundaries: GradedBoundary[],
  solve: Omit<Parameters<typeof solveTargetFAT>[0], "targetScore">
): FatNeed[] {
  const fatMax = solve.fatMaxMark ?? 100;
  const floor = (solve.component ?? "theory") === "theory" ? 0.4 * fatMax : 0;
  const out: FatNeed[] = [];
  boundaries.forEach((band, k) => {
    if (band.grade === "F") return;
    // A band with the same floor as the one above it cannot be awarded.
    if (k > 0 && boundaries[k - 1].limit === band.limit) return;
    const res = solveTargetFAT({ ...solve, targetScore: band.limit });
    out.push({
      grade: band.grade,
      target: band.limit,
      raw: res.isAchievable ? round2(Math.max(floor, res.isAlreadyAchieved ? 0 : res.requiredFATRawScore)) : null,
      secured: res.isAlreadyAchieved,
      feasibility: res.feasibility,
    });
  });
  return out;
}
