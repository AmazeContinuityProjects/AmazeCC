import { describe, expect, it } from "vitest";
import { ABSOLUTE_GRADE_BOUNDARIES, buildGradeBoundaries, gradeAt, type GradedBoundary } from "../lib/gradeBoundaries";
import { fatNeededForEachGrade, gradeMargin, gradeRange } from "../lib/gradeInsights";
import { solveTargetFAT } from "../lib/marksPredictor";

const ORDER = ["S", "A", "B", "C", "D", "E", "F"];

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

describe("gradeRange — how sure the curve is", () => {
  it("is null off the curve or without usable statistics", () => {
    expect(gradeRange(70, { count: 40, mean: 60, sd: 12 }, false)).toBeNull();
    expect(gradeRange(70, { count: 3, mean: 60, sd: 12 }, true)).toBeNull();
    expect(gradeRange(70, null, true)).toBeNull();
    expect(gradeRange(NaN, { count: 40, mean: 60, sd: 12 }, true)).toBeNull();
  });

  it("brackets the likely letter: best ≤ likely ≤ worst", () => {
    const r = rng(1);
    for (let i = 0; i < 3000; i++) {
      const stats = { count: 5 + Math.floor(r() * 80), mean: 30 + r() * 60, sd: r() * 25 };
      const pct = r() * 100;
      const g = gradeRange(pct, stats, true)!;
      expect(g.likely).toBe(gradeAt(pct, buildGradeBoundaries(stats, true)));
      expect(ORDER.indexOf(g.best)).toBeLessThanOrEqual(ORDER.indexOf(g.likely));
      expect(ORDER.indexOf(g.likely)).toBeLessThanOrEqual(ORDER.indexOf(g.worst));
    }
  });

  it("is wide at 6 contributors and narrow at 200", () => {
    // A total sitting just inside A on a (60, 12) curve.
    const few = gradeRange(67, { count: 6, mean: 60, sd: 12 }, true)!;
    const many = gradeRange(67, { count: 200, mean: 60, sd: 12 }, true)!;
    expect(few.best).not.toBe(few.worst);
    expect(ORDER.indexOf(many.worst) - ORDER.indexOf(many.best)).toBeLessThanOrEqual(1);
  });

  it("never goes past F or above S", () => {
    for (const pct of [0, 100]) {
      const g = gradeRange(pct, { count: 6, mean: 60, sd: 12 }, true)!;
      expect(ORDER).toContain(g.best);
      expect(ORDER).toContain(g.worst);
    }
  });
});

describe("gradeMargin — distance to the next letter", () => {
  it("reads Table 6 exactly, with rounding-up taken into account", () => {
    // B band 70–79: the A floor 80 is reached by anything above 79.
    expect(gradeMargin(76.5, ABSOLUTE_GRADE_BOUNDARIES)).toEqual({
      letter: "B",
      next: "A",
      toNext: 2.5,
      previous: "C",
      cushion: 7.5, // still B down to anything above 69
    });
  });

  it("has nothing above S and nothing below F", () => {
    const top = gradeMargin(95, ABSOLUTE_GRADE_BOUNDARIES)!;
    expect(top.next).toBeNull();
    expect(top.toNext).toBeNull();
    const bottom = gradeMargin(20, ABSOLUTE_GRADE_BOUNDARIES)!;
    expect(bottom.previous).toBeNull();
    expect(bottom.cushion).toBeNull();
    expect(bottom.next).toBe("E");
  });

  it("agrees with brute force on random curves", () => {
    const r = rng(2);
    for (let i = 0; i < 1500; i++) {
      const ladder = buildGradeBoundaries({ count: 5 + Math.floor(r() * 80), mean: r() * 100, sd: r() * 30 }, true);
      const pct = Math.round(r() * 10000) / 100;
      const m = gradeMargin(pct, ladder)!;
      if (m.next && m.toNext !== null) {
        // Just past toNext reaches `next`; exactly at it does not.
        expect(gradeAt(pct + m.toNext + 0.001, ladder)).toBe(m.next);
        if (m.toNext > 0.001) expect(gradeAt(pct + m.toNext - 0.001, ladder)).toBe(m.letter);
      }
      if (m.previous && m.cushion !== null && m.cushion > 0.001) {
        expect(gradeAt(pct - m.cushion + 0.001, ladder)).toBe(m.letter);
        expect(ORDER.indexOf(gradeAt(pct - m.cushion, ladder))).toBeGreaterThan(ORDER.indexOf(m.letter));
      }
    }
  });

  it("skips a letter the class cannot be awarded", () => {
    // A squeezed to S's floor: from B the next reachable letter is S.
    const ladder: GradedBoundary[] = [
      { grade: "S", limit: 95 },
      { grade: "A", limit: 95 },
      { grade: "B", limit: 85 },
      { grade: "C", limit: 80 },
      { grade: "D", limit: 75 },
      { grade: "E", limit: 50 },
      { grade: "F", limit: 0 },
    ];
    expect(gradeMargin(88, ladder)).toMatchObject({ letter: "B", next: "S", toNext: 6 });
  });
});

describe("fatNeededForEachGrade — the solver, once per band", () => {
  const solve = { currentScoredScaled: 48, fatWeightagePercent: 40, fatMaxMark: 100 };

  it("matches solveTargetFAT band by band on Table 6", () => {
    const rows = fatNeededForEachGrade(ABSOLUTE_GRADE_BOUNDARIES, solve);
    expect(rows.map((r) => r.grade)).toEqual(["S", "A", "B", "C", "D", "E"]);
    for (const row of rows) {
      const res = solveTargetFAT({ ...solve, targetScore: row.target });
      if (!res.isAchievable) expect(row.raw).toBeNull();
      else expect(row.raw).toBe(Math.max(40, res.requiredFATRawScore));
    }
    // 48 secured: S needs 42 wt → 105/100, out of reach; A needs 32 → 80.
    expect(rows[0].raw).toBeNull();
    expect(rows[1].raw).toBe(80);
  });

  it("never asks for less than 40% of a theory FAT", () => {
    const rows = fatNeededForEachGrade(ABSOLUTE_GRADE_BOUNDARIES, { ...solve, currentScoredScaled: 58 });
    const e = rows.find((r) => r.grade === "E")!;
    expect(e.secured).toBe(true);
    expect(e.raw).toBe(40);
    for (const r of rows) if (r.raw !== null) expect(r.raw).toBeGreaterThanOrEqual(40);
  });

  it("drops the floor for a lab FAT and scales to its maximum", () => {
    const rows = fatNeededForEachGrade(ABSOLUTE_GRADE_BOUNDARIES, {
      currentScoredScaled: 58,
      fatWeightagePercent: 40,
      fatMaxMark: 50,
      component: "lab",
    });
    expect(rows.find((r) => r.grade === "E")!.raw).toBe(0);
    // D at 55 is secured too; C at 60 needs 2 wt → 2.5/50.
    expect(rows.find((r) => r.grade === "C")!.raw).toBe(2.5);
  });

  it("asks less of every lower letter", () => {
    const ladder = buildGradeBoundaries({ count: 30, mean: 62, sd: 11 }, true);
    const rows = fatNeededForEachGrade(ladder, solve);
    for (let k = 1; k < rows.length; k++) {
      const a = rows[k - 1].raw ?? Infinity;
      const b = rows[k].raw ?? Infinity;
      expect(b).toBeLessThanOrEqual(a);
    }
  });

  it("leaves out bands the class cannot be awarded", () => {
    const squeezed: GradedBoundary[] = [
      { grade: "S", limit: 95 },
      { grade: "A", limit: 95 },
      { grade: "B", limit: 85 },
      { grade: "C", limit: 80 },
      { grade: "D", limit: 75 },
      { grade: "E", limit: 50 },
      { grade: "F", limit: 0 },
    ];
    expect(fatNeededForEachGrade(squeezed, solve).map((r) => r.grade)).toEqual(["S", "B", "C", "D", "E"]);
  });
});
