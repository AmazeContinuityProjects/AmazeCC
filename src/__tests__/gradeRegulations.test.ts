import { describe, expect, it, vi } from "vitest";
import {
  ABSOLUTE_GRADE_BOUNDARIES,
  buildGradeBoundaries,
  effectiveClassStats,
  effectiveSd,
  estimateTopShareCutoff,
  isEarlyEstimate,
  MIN_CURVE_SAMPLE,
  gradeAt,
  hasUsableClassStats,
  isRelativeGrading,
  type ClassStats,
  type GradedBoundary,
} from "../lib/gradeBoundaries";
import {
  computeCoursePrediction,
  solveTargetFAT,
  type PredictorAssessment,
} from "../lib/marksPredictor";

vi.mock("@/lib/sync-engine", () => ({ api: vi.fn() }));
import { api } from "@/lib/sync-engine";
import { syncMarksDiff } from "@/lib/marksSync";

/**
 * Grade prediction checked against FFCS Academic Regulations v5.0 (ACE, 80th
 * Academic Council, 20.11.2025), §9.4–9.5, Tables 5 and 6.
 *
 * The oracle below (`officialGrade`) is written straight from the regulation
 * text, independently of `gradeBoundaries.ts`, so the two are checked against
 * each other rather than the module against itself.
 */

/* ── deterministic randomness ───────────────────────────────────────────── */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller normal. */
function normal(r: () => number, mean: number, sd: number) {
  const u = Math.max(1e-12, r());
  const v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/* ── the oracle: §9.5 read literally ─────────────────────────────────────── */

/** Sample mean and σ over the rounded-up totals, as the server reports them. */
function classStatsOf(totals: number[]): ClassStats {
  const xs = totals.map((t) => Math.ceil(t - 1e-9));
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const m2 = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
  return { count: n, mean, sd: n > 1 ? Math.sqrt(m2 / (n - 1)) : 0 };
}

/** Table 5 + the §9.5 adjustments, for a class whose S boundary is ≤ 100. */
function officialGrade(total: number, s: ClassStats): GradedBoundary["grade"] {
  const t = Math.ceil(total - 1e-9); // "rounded-up" total
  const r = (x: number) => Math.round(x); // "rounded-off" band limits
  const S = Math.max(r(s.mean + 1.5 * s.sd), 90); // "with a minimum of 90%"
  const A = r(s.mean + 0.5 * s.sd);
  const B = r(s.mean - 0.5 * s.sd);
  const C = r(s.mean - 1.0 * s.sd);
  const D = r(s.mean - 1.5 * s.sd);
  const E = Math.min(r(s.mean - 2.0 * s.sd), 50); // F line: mean − 2σ, or 50 if lower
  if (t >= S) return "S";
  if (t >= A && t < S) return "A";
  if (t >= B) return "B";
  if (t >= C) return "C";
  if (t >= D) return "D";
  if (t >= E) return "E";
  return "F";
}

/** Table 6, read literally. */
function officialAbsolute(total: number): GradedBoundary["grade"] {
  const t = Math.ceil(total - 1e-9);
  if (t >= 90) return "S";
  if (t >= 80) return "A";
  if (t >= 70) return "B";
  if (t >= 60) return "C";
  if (t >= 55) return "D";
  if (t >= 50) return "E";
  return "F";
}

const ORDER = ["S", "A", "B", "C", "D", "E", "F"];

/* ── Table 6 ─────────────────────────────────────────────────────────────── */

describe("Table 6 — absolute grading", () => {
  it("matches the regulation at every integer and every half mark 0–100", () => {
    for (let x = 0; x <= 100; x += 0.5) {
      expect(gradeAt(x), `total ${x}`).toBe(officialAbsolute(x));
    }
  });

  it("fails everything below 50 (§9.4 c — the pass line is 50)", () => {
    for (let x = 0; x < 49.0001; x += 0.25) expect(gradeAt(x)).toBe("F");
    expect(gradeAt(49.01)).toBe("E"); // rounds up to 50
  });

  it("does not let float noise push a whole number up a band", () => {
    // 0.1 + 0.2 style residue on a weighted sum must not read 79 → 80.
    expect(gradeAt(79.00000000001)).toBe("B");
    expect(gradeAt(89 + 1e-12)).toBe("A");
  });
});

/* ── Table 5 ─────────────────────────────────────────────────────────────── */

describe("Table 5 — relative grading against the literal oracle", () => {
  it("agrees on 2000 random classes × every whole and fractional total", () => {
    const r = rng(20251120);
    let checked = 0;
    for (let trial = 0; trial < 2000; trial++) {
      const stats: ClassStats = {
        count: 11 + Math.floor(r() * 80),
        mean: 25 + r() * 65,
        sd: 1 + r() * 25,
      };
      // The regulation is applied to the σ we estimate for the class.
      const used = effectiveClassStats(stats)!;
      if (Math.round(used.mean + 1.5 * used.sd) > 100) continue; // rank rule, tested below
      const ladder = buildGradeBoundaries(stats, true);
      for (let x = 0; x <= 100; x += 0.37) {
        expect(gradeAt(x, ladder), `${JSON.stringify(stats)} @ ${x}`).toBe(officialGrade(x, used));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200_000);
  }, 60_000);

  it("keeps every ladder ordered, within 0–100, and with E at or below 50", () => {
    const r = rng(7);
    for (let i = 0; i < 5000; i++) {
      const stats: ClassStats = { count: 11 + Math.floor(r() * 200), mean: r() * 100, sd: 0.1 + r() * 40 };
      const ladder = buildGradeBoundaries(stats, true);
      expect(ladder.map((b) => b.grade)).toEqual(ORDER);
      for (let k = 0; k < ladder.length; k++) {
        expect(ladder[k].limit).toBeGreaterThanOrEqual(0);
        expect(ladder[k].limit).toBeLessThanOrEqual(100);
        if (k > 0) expect(ladder[k].limit).toBeLessThanOrEqual(ladder[k - 1].limit);
      }
      expect(ladder[0].limit).toBeGreaterThanOrEqual(80); // S: ≥ 90, or ≥ 80 under the rank rule
      expect(ladder[5].limit).toBeLessThanOrEqual(50);
      expect(ladder[6].limit).toBe(0);
    }
  });

  it("never gives a better grade for a lower total", () => {
    const r = rng(11);
    for (let i = 0; i < 500; i++) {
      const ladder = buildGradeBoundaries(
        { count: 11 + Math.floor(r() * 100), mean: r() * 100, sd: 0.5 + r() * 30 },
        true
      );
      let prev = ORDER.indexOf("F");
      for (let x = 0; x <= 100; x += 0.5) {
        const g = ORDER.indexOf(gradeAt(x, ladder));
        expect(g).toBeLessThanOrEqual(prev);
        prev = g;
      }
    }
  });

  it("passes every total ≥ 50 even when the class average is high (§9.5)", () => {
    // mean 85, σ 10: mean − 2σ = 65 would fail a 60. The regulation awards E.
    const ladder = buildGradeBoundaries({ count: 60, mean: 85, sd: 10 }, true);
    expect(gradeAt(50, ladder)).toBe("E");
    expect(gradeAt(64, ladder)).toBe("E");
    expect(gradeAt(49, ladder)).toBe("F");
  });

  it("lowers the pass mark to mean − 2σ on a hard paper (§9.5)", () => {
    // mean 45, σ 10: the F line is 25.
    const ladder = buildGradeBoundaries({ count: 60, mean: 45, sd: 10 }, true);
    expect(ladder[5]).toEqual({ grade: "E", limit: 25 });
    expect(gradeAt(25, ladder)).toBe("E");
    expect(gradeAt(24, ladder)).toBe("F");
  });

  it("puts the class average at the middle of B", () => {
    for (const [mean, sd] of [[55, 12], [62.4, 9.3], [70, 15]]) {
      const ladder = buildGradeBoundaries({ count: 40, mean, sd }, true);
      expect(gradeAt(mean, ladder)).toBe("B");
    }
  });
});

/* ── class strength ──────────────────────────────────────────────────────── */

describe("small samples — curving on the classmates who synced", () => {
  it("curves from 5 contributors and not before", () => {
    expect(MIN_CURVE_SAMPLE).toBe(5);
    for (let n = 0; n < 5; n++) {
      expect(buildGradeBoundaries({ count: n, mean: 55, sd: 12 }, true)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
    }
    expect(buildGradeBoundaries({ count: 5, mean: 55, sd: 12 }, true)).not.toBe(ABSOLUTE_GRADE_BOUNDARIES);
  });

  it("pools σ with a typical class spread, fading as contributors grow", () => {
    // ((n−1)s² + 4·12²) / ((n−1) + 4)
    expect(effectiveSd({ count: 5, mean: 60, sd: 4 })).toBeCloseTo(Math.sqrt((4 * 16 + 576) / 8), 9);
    expect(effectiveSd({ count: 5, mean: 60, sd: 30 })).toBeCloseTo(Math.sqrt((4 * 900 + 576) / 8), 9);
    // A σ of 0 from five identical totals still gets a spread.
    expect(effectiveSd({ count: 5, mean: 60, sd: 0 })).toBeGreaterThan(8);
    // Large samples are left essentially alone.
    expect(effectiveSd({ count: 200, mean: 60, sd: 18 })).toBeCloseTo(18, 0);
    // And the pull is always toward the prior, never past it.
    for (const sd of [2, 6, 12, 20, 35]) {
      const e = effectiveSd({ count: 8, mean: 60, sd });
      expect(Math.abs(e - 12)).toBeLessThanOrEqual(Math.abs(sd - 12) + 1e-9);
    }
  });

  it("tracks the true class σ more closely than the raw sample does at 5–10 contributors", () => {
    // 60-seat classes with a true σ between 8 and 18; sample 5–10 of them.
    const r = rng(314);
    let rawErr = 0;
    let pooledErr = 0;
    for (let t = 0; t < 4000; t++) {
      const trueSd = 8 + r() * 10;
      const n = 5 + Math.floor(r() * 6);
      const xs = Array.from({ length: n }, () => normal(r, 60, trueSd));
      const st = classStatsOf(xs);
      rawErr += (st.sd - trueSd) ** 2;
      pooledErr += (effectiveSd(st) - trueSd) ** 2;
    }
    expect(pooledErr).toBeLessThan(rawErr * 0.6);
  });

  it("flags curves under 15 contributors as an early estimate", () => {
    expect(isEarlyEstimate({ count: 5, mean: 60, sd: 10 })).toBe(true);
    expect(isEarlyEstimate({ count: 14, mean: 60, sd: 10 })).toBe(true);
    expect(isEarlyEstimate({ count: 15, mean: 60, sd: 10 })).toBe(false);
    expect(isEarlyEstimate({ count: 3, mean: 60, sd: 10 })).toBe(false); // not a curve at all
  });

  it("rejects NaN, infinite and negative statistics", () => {
    for (const bad of [
      { count: 30, mean: NaN, sd: 10 },
      { count: 30, mean: 60, sd: NaN },
      { count: 30, mean: 60, sd: Infinity },
      { count: 30, mean: 60, sd: -1 },
      { count: NaN, mean: 60, sd: 10 },
    ]) {
      expect(hasUsableClassStats(bad)).toBe(false);
      expect(buildGradeBoundaries(bad, true)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
    }
  });
});

/* ── S above 100 ─────────────────────────────────────────────────────────── */

describe("S boundary above 100 — the top 5% / at least 3 rule (§9.5)", () => {
  it("only switches to the rank rule once mean + 1.5σ rounds past 100", () => {
    const at = (mean: number, sd: number) => ({ count: 200, mean, sd });
    // Under the line → plain Table 5 (S at round(mean + 1.5σ), here 100).
    const under = at(93, 4.5);
    expect(Math.round(93 + 1.5 * effectiveSd(under))).toBe(100);
    expect(buildGradeBoundaries(under, true)[0].limit).toBe(100);
    // Over it → rank rule, S drops below 100.
    const over = at(93, 6);
    expect(Math.round(93 + 1.5 * effectiveSd(over))).toBeGreaterThan(100);
    expect(buildGradeBoundaries(over, true)[0].limit).toBeLessThan(100);
  });

  it("reduces to the exponential quantile when σ equals the deficit", () => {
    // Deficit mean 10 = σ → gamma shape 1 = exponential(scale 10). Top 5% of
    // totals ↔ deficit ≤ −10·ln(0.95) = 0.513 → cutoff 99.49 → 99.
    expect(estimateTopShareCutoff(90, 10)).toBe(Math.round(100 + 10 * Math.log(0.95)));
  });

  it("never sets the S cutoff below 80 ('students who have scored ≥ 80')", () => {
    for (const [m, s] of [[70, 40], [80, 30], [85, 25]]) {
      expect(estimateTopShareCutoff(m, s)).toBeGreaterThanOrEqual(80);
    }
  });

  it("lands within 2 marks of the real top-5% mark on simulated near-perfect classes", () => {
    // Simulated classes piled against 100, generated from a *different* shape
    // than the model (a clipped normal), so this is a real check of the
    // estimate rather than of its own assumptions.
    const r = rng(99);
    let tested = 0;
    for (let trial = 0; trial < 300 && tested < 60; trial++) {
      const n = 60 + Math.floor(r() * 30);
      const totals = Array.from({ length: n }, () => clamp(normal(r, 95, 7), 40, 100));
      const stats = classStatsOf(totals);
      if (Math.round(stats.mean + 1.5 * stats.sd) <= 100) continue;
      tested++;
      const sorted = totals.map((t) => Math.ceil(t - 1e-9)).sort((a, b) => b - a);
      const k = Math.max(3, Math.ceil(0.05 * n));
      const actual = sorted[k - 1];
      expect(Math.abs(estimateTopShareCutoff(stats.mean, stats.sd) - actual)).toBeLessThanOrEqual(2);
    }
    expect(tested).toBeGreaterThan(20);
  });
});

/* ── which courses curve ─────────────────────────────────────────────────── */

describe("which courses are relatively graded (§9.5)", () => {
  const curved = ["Theory Only", "Embedded Theory", "Embedded Lab", "Embedded", "Embedded Theory and Lab", "Embedded Theory and Project", "embedded  theory"];
  const fixed = ["Lab Only", "Project", "Soft Skill", "Online Course", "Embedded Lab and Project", "", null, undefined];

  it("curves every theory-carrying course, in ACE and CBCS alike", () => {
    for (const system of ["ACE", "CBCS", "", null]) {
      for (const t of curved) expect(isRelativeGrading(system, t), `${system}/${t}`).toBe(true);
    }
  });

  it("keeps lab, project, soft-skill and online courses on Table 6", () => {
    for (const system of ["ACE", "CBCS"]) {
      for (const t of fixed) expect(isRelativeGrading(system, t), `${system}/${t}`).toBe(false);
    }
  });
});

/* ── end to end: a whole class through the client pipeline ──────────────── */

describe("a simulated class, through the real contribution path", () => {
  /** One VTOP theory course for one student, with these marks (null = not yet posted). */
  function vtopCourse(marks: Array<number | null>) {
    const plan = [
      { title: "CAT - I", maxMark: 50, weightagePercent: 15 },
      { title: "CAT - II", maxMark: 50, weightagePercent: 15 },
      { title: "DA - I", maxMark: 10, weightagePercent: 10 },
      { title: "DA - II", maxMark: 10, weightagePercent: 10 },
      { title: "Quiz", maxMark: 10, weightagePercent: 10 },
      { title: "FAT", maxMark: 100, weightagePercent: 40 },
    ];
    return {
      courses: [
        {
          courseCode: "BCSE301L",
          courseType: "Theory Only",
          classNbr: "CH2026270100001",
          slot: "A1+TA1",
          credits: 3,
          assessments: plan.map((p, i) => {
            const m = marks[i];
            return {
              title: p.title,
              maxMark: String(p.maxMark),
              weightagePercent: String(p.weightagePercent),
              scoredMark: m === null ? "-" : String(m),
              weightageMark: m === null ? "" : String(((m / p.maxMark) * p.weightagePercent).toFixed(2)),
            };
          }),
        },
      ],
    };
  }

  async function contributedOverall(marks: Array<number | null>): Promise<number | undefined> {
    window.localStorage.clear();
    window.localStorage.setItem("marksSyncBackfillV2", "true");
    (api as ReturnType<typeof vi.fn>).mockReset();
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ tally: {}, tokens: {} }) });
    const data = vtopCourse(marks);
    await syncMarksDiff(null, data);
    const call = (api as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === "marks/sync");
    const contributions = (call?.[1]?.body?.contributions ?? []) as Array<{ scope: string; mark: number }>;
    return contributions.find((c) => c.scope === "overall")?.mark;
  }

  it("contributes whole, rounded-up totals and the same letters the regulation gives", async () => {
    const r = rng(42);
    const students: number[][] = Array.from({ length: 45 }, () => {
      const ability = clamp(normal(r, 0.62, 0.16), 0, 1);
      const mark = (max: number) => Math.round(clamp(normal(r, ability, 0.08), 0, 1) * max * 2) / 2;
      return [mark(50), mark(50), mark(10), mark(10), mark(10), mark(100)];
    });

    const finals: number[] = [];
    for (const m of students) {
      const contributed = await contributedOverall(m);
      const exact = (m[0] / 50) * 15 + (m[1] / 50) * 15 + m[2] + m[3] + m[4] + (m[5] / 100) * 40;
      // VTOP's weightageMark is posted to 2 decimals; the total is rounded up.
      expect(contributed).toBe(Math.min(100, Math.ceil(
        ((+((m[0] / 50) * 15).toFixed(2) + +((m[1] / 50) * 15).toFixed(2) + +m[2].toFixed(2) + +m[3].toFixed(2) + +m[4].toFixed(2) + +((m[5] / 100) * 40).toFixed(2))) - 1e-9
      )));
      expect(Number.isInteger(contributed)).toBe(true);
      expect(Math.abs((contributed as number) - exact)).toBeLessThanOrEqual(1.01);
      finals.push(contributed as number);
    }

    const stats = classStatsOf(finals);
    expect(hasUsableClassStats(stats)).toBe(true);
    const ladder = buildGradeBoundaries(stats, isRelativeGrading("ACE", "Theory Only"));
    const used = effectiveClassStats(stats)!;
    for (const total of finals) {
      expect(gradeAt(total, ladder)).toBe(officialGrade(total, used));
    }
  });

  it("leaves pending assessments out instead of counting them as zero", async () => {
    // CAT-I 40/50 only: 12 of 15 released weight → 80%, not 12%.
    expect(await contributedOverall([40, null, null, null, null, null])).toBe(80);
    // A recorded zero is a real mark and does pull the total down.
    expect(await contributedOverall([40, 0, null, null, null, null])).toBe(40);
  });

  it("contributes nothing for a course with no marks yet", async () => {
    expect(await contributedOverall([null, null, null, null, null, null])).toBeUndefined();
  });
});

/* ── prediction while marks are still arriving ───────────────────────────── */

describe("predicting with partial marks", () => {
  const plan = [
    { title: "CAT - I", maxMark: 50, weightagePercent: 15 },
    { title: "CAT - II", maxMark: 50, weightagePercent: 15 },
    { title: "DA - I", maxMark: 10, weightagePercent: 10 },
    { title: "DA - II", maxMark: 10, weightagePercent: 10 },
    { title: "Quiz", maxMark: 10, weightagePercent: 10 },
    { title: "FAT", maxMark: 100, weightagePercent: 40 },
  ];
  const rows = (marks: Array<number | null>, component: "theory" | "lab" = "theory"): PredictorAssessment[] =>
    plan.map((p, i) => ({ id: `${component}${i}`, title: p.title, maxMark: p.maxMark, weightagePercent: p.weightagePercent, scoredMark: marks[i] ?? null, component }));

  const predict = (marks: Array<number | null>, classStats: ClassStats | null = null) =>
    computeCoursePrediction({
      courseCode: "BCSE301L",
      courseTitle: "Software Engineering",
      courseType: "Theory Only",
      theoryAssessments: rows(marks),
      courseSystem: "ACE",
      classStats,
    });

  const fin = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  const CLASS: ClassStats = { count: 48, mean: 58, sd: 13 };

  it("keeps the books balanced at every stage: secured + lost + pending = 100", () => {
    const full = [38, 41, 9, 8, 7, 66];
    for (let k = 0; k <= full.length; k++) {
      const marks = full.map((m, i) => (i < k ? m : null));
      const p = predict(marks, CLASS);
      expect(p.currentScoredScaled + p.pointsLostScaled + p.potentialPendingScaled).toBeCloseTo(100, 1);
      expect(p.maxPossibleScaled).toBeCloseTo(100 - p.pointsLostScaled, 6);
      for (const v of [p.currentScoredScaled, p.pointsLostScaled, p.maxPossibleScaled, p.pacePct, p.currentStandingPct]) {
        expect(fin(v)).toBe(true);
      }
    }
  });

  it("has no pace before the first mark, and the best case is still S", () => {
    const p = predict([null, null, null, null, null, null], CLASS);
    expect(p.optimalGrade).toBeNull();
    expect(p.maximisableGrade.letter).toBe("S");
    expect(p.isCurved).toBe(true);
  });

  it("reads the pace off the curved ladder from the first CAT on", () => {
    // CAT-I 33/50 = 66% pace. Curve (58, σ≈12.9): A from round(64.5) = 64 → A.
    // On Table 6 the same 66% is only a C.
    const curved = predict([33, null, null, null, null, null], CLASS);
    expect(curved.pacePct).toBe(66);
    expect(curved.optimalGrade?.letter).toBe(gradeAt(66, buildGradeBoundaries(CLASS, true)));
    expect(curved.optimalGrade?.letter).toBe("A");
    expect(predict([33, null, null, null, null, null]).optimalGrade?.letter).toBe("C");
  });

  it("falls back to Table 6 while too few classmates have synced", () => {
    const thin = predict([33, null, null, null, null, null], { count: 4, mean: 58, sd: 13 });
    expect(thin.isCurved).toBe(false);
    expect(thin.optimalGrade?.letter).toBe("C");
  });

  it("predicts on a curve from just 5 classmates, CAT-I only", () => {
    const five: ClassStats = { count: 5, mean: 58, sd: 4 }; // a suspiciously tight sample
    const p = predict([33, null, null, null, null, null], five);
    expect(p.isCurved).toBe(true);
    // σ 4 alone would put A at round(58 + 2) = 60 and B at 56; pooled σ ≈ 8.9
    // keeps the bands a realistic width.
    const ladder = buildGradeBoundaries(five, true);
    expect(ladder[1].limit - ladder[2].limit).toBeGreaterThanOrEqual(8);
    expect(p.optimalGrade?.letter).toBe(gradeAt(66, ladder));
  });

  it("only ever lowers the ceiling as marks arrive", () => {
    const r = rng(5);
    for (let s = 0; s < 300; s++) {
      const full = plan.map((p) => Math.round(r() * p.maxMark));
      let prevCeiling = Infinity;
      let prevBest = -1;
      for (let k = 0; k <= full.length; k++) {
        const p = predict(full.map((m, i) => (i < k ? m : null)), CLASS);
        expect(p.maxPossibleScaled).toBeLessThanOrEqual(prevCeiling + 1e-9);
        const best = ORDER.indexOf(p.maximisableGrade.letter);
        expect(best).toBeGreaterThanOrEqual(prevBest); // never a better best case
        prevCeiling = p.maxPossibleScaled;
        prevBest = best;
      }
    }
  });

  it("lands on the regulation's letter once every mark is in", () => {
    const r = rng(8);
    for (let s = 0; s < 500; s++) {
      const full = plan.map((p) => Math.round(r() * p.maxMark * 2) / 2);
      const total = full.reduce((a, m, i) => a + (m / plan[i].maxMark) * plan[i].weightagePercent, 0);
      const p = predict(full, CLASS);
      expect(p.currentScoredScaled).toBeCloseTo(total, 1);
      // §9.4 (a): a FAT below 40% fails the course whatever the total.
      const fatFails = full[5] / 100 < 0.4;
      expect(p.optimalGrade?.letter).toBe(p.maximisableGrade.letter);
      expect(p.maximisableGrade.letter).toBe(
        fatFails ? "F" : officialGrade(p.maxPossibleScaled, effectiveClassStats(CLASS)!)
      );
      expect(predict(full).maximisableGrade.letter).toBe(fatFails ? "F" : officialAbsolute(p.maxPossibleScaled));
    }
  });

  it("weighs an embedded course by credits, L+T : P/2 (§9.7)", () => {
    // 3-0-2-4: theory 3 credits, lab 1. Theory 70%, lab 90% → (3·70 + 1·90)/4 = 75.
    const theory = rows([35, 35, 7, 7, 7, 70]);
    const lab: PredictorAssessment[] = [
      { id: "l0", title: "Lab Continuous", maxMark: 100, weightagePercent: 60, scoredMark: 90, component: "lab" },
      { id: "l1", title: "Lab FAT", maxMark: 50, weightagePercent: 40, scoredMark: 45, component: "lab" },
    ];
    const p = computeCoursePrediction({
      courseCode: "BCSE302P",
      courseTitle: "Embedded",
      courseType: "Embedded Theory",
      theoryAssessments: theory,
      labAssessments: lab,
      theoryCredits: 3,
      labCredits: 1,
      courseSystem: "CBCS",
      classStats: CLASS,
    });
    expect(p.isEmbedded).toBe(true);
    expect(p.currentScoredScaled).toBeCloseTo(75, 6);
    expect(p.isCurved).toBe(true); // embedded theory curves under CBCS too
    expect(p.optimalGrade?.letter).toBe(officialGrade(75, effectiveClassStats(CLASS)!));
  });

  it("survives junk input without NaN", () => {
    const r = rng(13);
    for (let s = 0; s < 300; s++) {
      const junk: PredictorAssessment[] = plan.map((p, i) => ({
        id: `j${i}`,
        title: p.title,
        maxMark: [p.maxMark, 0, -5, NaN][Math.floor(r() * 4)],
        weightagePercent: [p.weightagePercent, 0, NaN][Math.floor(r() * 3)],
        scoredMark: [null, Math.round(r() * 120) - 10, NaN as unknown as number][Math.floor(r() * 3)],
        component: "theory",
      }));
      const p = computeCoursePrediction({
        courseCode: "X",
        courseTitle: "X",
        courseType: "Theory Only",
        theoryAssessments: junk,
        courseSystem: "ACE",
        classStats: [CLASS, null, { count: 0, mean: 0, sd: 0 }][s % 3],
      });
      for (const v of [p.currentScoredScaled, p.pointsLostScaled, p.maxPossibleScaled, p.pacePct]) {
        expect(fin(v)).toBe(true);
      }
      expect(ORDER).toContain(p.maximisableGrade.letter);
    }
  });
});

/* ── the 40% theory FAT minimum ──────────────────────────────────────────── */

describe("theory FAT minimum — 40% in the FAT alone (§9.4 a)", () => {
  it("flags a secured target whose FAT would still be below 40%", () => {
    const res = solveTargetFAT({ targetScore: 50, currentScoredScaled: 55, fatWeightagePercent: 40, fatMaxMark: 100 });
    expect(res.isAlreadyAchieved).toBe(true);
    expect(res.meetsVITMinimumCutoff).toBe(false);
    expect(res.feasibilityMessage).toMatch(/40\.0 \/ 100 \(40%\)/);
  });

  it("scales the minimum to the FAT's own maximum", () => {
    const res = solveTargetFAT({ targetScore: 60, currentScoredScaled: 50, fatWeightagePercent: 40, fatMaxMark: 50 });
    // Needs 10 wt of 40 → 12.5/50 = 25%, below the 20/50 minimum.
    expect(res.requiredFATRawScore).toBe(12.5);
    expect(res.meetsVITMinimumCutoff).toBe(false);
  });

  it("does not apply to a lab FAT", () => {
    const res = solveTargetFAT({ targetScore: 50, currentScoredScaled: 55, fatWeightagePercent: 40, fatMaxMark: 50, component: "lab" });
    expect(res.meetsVITMinimumCutoff).toBe(true);
  });
});

/* ── pass conditions the ladder does not show ───────────────────────────── */

describe("pass conditions — §9.4, §9.6, §9.7", () => {
  const theoryRows = (fat: number | null, internals = 50): PredictorAssessment[] => [
    { id: "t0", title: "Internals", maxMark: 60, weightagePercent: 60, scoredMark: internals, component: "theory" },
    { id: "t1", title: "FAT", maxMark: 100, weightagePercent: 40, scoredMark: fat, component: "theory" },
  ];
  const labRows = (cont: number | null, fat: number | null): PredictorAssessment[] => [
    { id: "l0", title: "Lab Continuous", maxMark: 100, weightagePercent: 60, scoredMark: cont, component: "lab" },
    { id: "l1", title: "Lab FAT", maxMark: 50, weightagePercent: 40, scoredMark: fat, component: "lab" },
  ];
  const course = (theory: PredictorAssessment[], lab: PredictorAssessment[] = [], type = "Theory Only") =>
    computeCoursePrediction({
      courseCode: "X",
      courseTitle: "X",
      courseType: type,
      theoryAssessments: theory,
      labAssessments: lab,
      theoryCredits: 3,
      labCredits: 1,
      courseSystem: "ACE",
    });

  it("fails a strong course whose theory FAT is under 40%", () => {
    // 50/60 internals + 39/100 FAT = 65.6% — a C on Table 6, but the FAT fails it.
    const p = course(theoryRows(39));
    expect(p.currentScoredScaled).toBeCloseTo(65.6, 6);
    expect(p.optimalGrade?.letter).toBe("F");
    expect(p.maximisableGrade.letter).toBe("F");
    expect(p.passIssues.map((i) => i.code)).toEqual(["theory-fat-below-40"]);
    expect(p.passIssues[0].certain).toBe(true);
  });

  it("passes at exactly 40% in the FAT", () => {
    const p = course(theoryRows(40));
    expect(p.optimalGrade?.letter).toBe("C");
    expect(p.passIssues).toEqual([]);
  });

  it("projects an F from a pace below 40% but keeps the perfect-FAT ceiling", () => {
    // 20/60 internals: 33% pace, FAT pending. Lost 40 of 60 → ceiling 60 → C.
    const p = course(theoryRows(null, 20));
    expect(p.optimalGrade?.letter).toBe("F");
    expect(p.maximisableGrade.letter).toBe("C");
    expect(p.passIssues.map((i) => i.code)).toEqual(["theory-fat-pace-below-40"]);
  });

  it("gives N when the lab can no longer reach 50%", () => {
    // Lab continuous 10/100 → lost 54 of 60; ceiling (100 − 54)/100 = 46%.
    const p = course(theoryRows(90), labRows(10, null), "Embedded Theory");
    expect(p.optimalGrade?.letter).toBe("N");
    expect(p.maximisableGrade.letter).toBe("N");
    expect(p.passIssues.find((i) => i.code === "component-below-50")?.certain).toBe(false); // Lab FAT still pending
  });

  it("projects N from a lab pace below 50% while 50% is still reachable", () => {
    const p = course(theoryRows(90), labRows(45, null), "Embedded Theory");
    expect(p.optimalGrade?.letter).toBe("N");
    expect(p.maximisableGrade.letter).not.toBe("N");
    expect(p.passIssues.map((i) => i.code)).toEqual(["component-pace-below-50"]);
  });

  it("prefers N over F when both halves fail", () => {
    const p = course(theoryRows(10), labRows(10, 5), "Embedded Theory");
    expect(p.optimalGrade?.letter).toBe("N");
    expect(p.maximisableGrade.letter).toBe("N");
  });

  it("applies the 50% lab rule to lab-only courses too (§9.6)", () => {
    const p = course([], labRows(40, 20), "Lab Only");
    expect(p.optimalGrade?.letter).toBe("N");
    expect(p.passIssues[0].certain).toBe(true);
  });

  it("flags a what-if FAT as uncertain", () => {
    const rows = theoryRows(30);
    rows[1].isSimulated = true;
    expect(course(rows).passIssues[0].certain).toBe(false);
  });
});
