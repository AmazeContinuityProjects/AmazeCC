import { describe, expect, it } from "vitest";
import {
  deriveCgpa,
  effectiveGradeRows,
  resolveCgpa,
  resolveCumulative,
} from "../lib/gradesEffective";

/**
 * CGPA resolution across payload combinations.
 *
 * Every payload in this file has the shape a real deployment returns, including
 * the ones that are wrong. The cases that matter are the ones where a naive
 * reader shows a number that is not the student's CGPA.
 */

/**
 * A real course row. `creditsEarned` is the credits column — the parser's name
 * for it is a wire artefact, see `gradesEffective.ts`.
 */
const course = (over: Partial<{ credits: number; grade: string }> = {}) => ({
  basketTitle: "Network Theory",
  courseType: "TH",
  creditsEarned: String(over.credits ?? 4),
  grade: over.grade ?? "A",
  distributionType: "PCC",
});

/**
 * The eight rows an unfixed parser returns alongside the fourteen real ones:
 * the header row of each embedded-course sub-table, parsed as a course.
 *
 * This is a verbatim record of the bug, not a synthetic case. `creditsEarned`
 * is the literal string "Credits", which `Number()` turns into NaN.
 */
const PHANTOM_ROWS = Array.from({ length: 8 }, () => ({
  basketTitle: "Course Title",
  courseType: "Course Type",
  creditsEarned: "Credits",
  grade: "Grade",
  distributionType: "BAEEE101",
}));

describe("effectiveGradeRows", () => {
  it("drops the phantom sub-table headers", () => {
    const rows = effectiveGradeRows({
      effectiveGrades: [...PHANTOM_ROWS, ...Array.from({ length: 14 }, () => course())],
    });
    expect(rows).toHaveLength(14);
  });

  it("does not let a non-numeric credit through", () => {
    // The specific hazard: NaN in the CGPA accumulator, which would poison the
    // whole total rather than just adding one bad row.
    const rows = effectiveGradeRows({ effectiveGrades: PHANTOM_ROWS });
    expect(rows).toEqual([]);
    expect(deriveCgpa(rows).source).toBe("none");
  });

  it("keeps every real course, whatever the letter", () => {
    const letters = ["S", "A", "B", "C", "D", "E", "F"];
    const rows = effectiveGradeRows({
      effectiveGrades: letters.map((g) => course({ grade: g, credits: 3 })),
    });
    expect(rows).toHaveLength(7);
  });

  it("drops N and P — awarded nothing, so they are not courses in the sum", () => {
    const rows = effectiveGradeRows({
      effectiveGrades: [course({ grade: "N" }), course({ grade: "P" }), course({ grade: "S" })],
    });
    expect(rows.map((r) => r.grade)).toEqual(["S"]);
  });

  it("drops zero and negative credits", () => {
    const rows = effectiveGradeRows({
      effectiveGrades: [course({ credits: 0 }), course({ credits: -3 }), course()],
    });
    expect(rows).toHaveLength(1);
  });

  it("copes with a payload that is not there", () => {
    expect(effectiveGradeRows(null)).toEqual([]);
    expect(effectiveGradeRows(undefined)).toEqual([]);
    expect(effectiveGradeRows({})).toEqual([]);
    expect(effectiveGradeRows({ effectiveGrades: "nope" })).toEqual([]);
  });
});

describe("deriveCgpa", () => {
  it("reproduces the figure VTOP published", () => {
    // The real capture, transcribed: 14 courses, credits 2,2,4,4,4,4,4,4,4,2,
    // 4,4,1,4 (47 total) with grades A,S,A,A,S,S,S,A,S,S,A,S,S,S. The weighted
    // sum gives 9.6170 against VTOP's published 9.62 — same formula, same
    // 10-point scale, so agreement to two decimals is expected.
    //
    // Note the credits are NOT uniform per grade, which is the whole point of
    // weighting: an unweighted mean of the 9 S's and 5 A's would give 9.64 by
    // luck here, and the wrong answer for any real term where the S's happen to
    // be the 4-credit ones.
    const real: [string, number][] = [
      ["A", 2], ["S", 2], ["A", 4], ["A", 4],
      ["S", 4], ["S", 4], ["S", 4], ["A", 4],
      ["S", 4], ["S", 2], ["A", 4], ["S", 4],
      ["S", 1], ["S", 4],
    ];
    const d = deriveCgpa(
      effectiveGradeRows({
        effectiveGrades: real.map(([grade, credits]) => course({ grade, credits })),
      })
    );
    expect(d.courses).toBe(14);
    expect(d.creditsEarned).toBe(47);
    expect(d.value).toBeCloseTo(9.62, 2);
    expect(d.source).toBe("derived");
  });

  it("weights by credits, so a 4-credit course counts four times a 1-credit one", () => {
    const d = deriveCgpa(
      effectiveGradeRows({
        effectiveGrades: [
          course({ grade: "S", credits: 1 }),
          course({ grade: "F", credits: 4 }),
        ],
      })
    );
    // (10*1 + 0*4) / 5 = 2
    expect(d.value).toBe(2);
  });

  it("reports nothing rather than zero when there is nothing to weigh", () => {
    // "No figure" and "a CGPA of zero" are different claims; the UI must be
    // able to tell them apart.
    expect(deriveCgpa([])).toEqual({
      value: 0,
      creditsEarned: 0,
      courses: 0,
      source: "none",
    });
  });

  it("is unaffected by the phantom rows sitting beside it", () => {
    const real = Array.from({ length: 9 }, () => course({ grade: "S", credits: 4 }));
    const withJunk = deriveCgpa(
      effectiveGradeRows({ effectiveGrades: [...PHANTOM_ROWS, ...real] })
    );
    const without = deriveCgpa(effectiveGradeRows({ effectiveGrades: real }));
    expect(withJunk).toEqual(without);
    expect(withJunk.value).toBe(10);
  });
});

describe("resolveCumulative", () => {
  it("prefers the marks figure", () => {
    const c = resolveCumulative(
      { cgpa: "8.75", creditsEarned: "96", creditsRequired: "160" },
      { cgpa: "9.62", creditsEarned: "47" }
    );
    expect(c).toEqual({
      value: 8.75,
      creditsEarned: 96,
      creditsRequired: 160,
      source: "marks",
    });
  });

  it("uses the grades figure when marks has none — the UniCC case", () => {
    const c = resolveCumulative(null, {
      cgpa: "9.62",
      creditsEarned: "47",
      creditsRegistered: "47",
    });
    expect(c).toEqual({
      value: 9.62,
      creditsEarned: 47,
      creditsRequired: 0,
      source: "grades",
    });
  });

  it("falls through to nothing when neither published a figure", () => {
    expect(resolveCumulative(null, null)).toEqual({
      value: 0,
      creditsEarned: 0,
      creditsRequired: 0,
      source: "none",
    });
  });

  it("does not let an unsynced zero win", () => {
    // `cgpa: "0"` is what an empty payload looks like. Treating it as a figure
    // would tell a student with no grades that their CGPA is 0.
    expect(resolveCumulative({ cgpa: "0" }, { cgpa: "9.62" }).source).toBe("grades");
    expect(resolveCumulative({ cgpa: "" }, null).source).toBe("none");
  });

  it("ignores a non-numeric figure instead of showing NaN", () => {
    expect(resolveCumulative({ cgpa: "N/A" }, null).source).toBe("none");
  });
});

describe("resolveCgpa", () => {
  it("uses the published figure and never the derivation", () => {
    const r = resolveCgpa({ cgpa: "8.75", creditsEarned: "96" }, {
      effectiveGrades: [...PHANTOM_ROWS, course({ grade: "F", credits: 4 })],
    });
    expect(r).toEqual({ cgpa: "8.75", creditsEarned: "96", source: "marks" });
  });

  it("derives when the deployment publishes no CGPA at all", () => {
    // The older UniCC shape: grade distribution present, CGPA cells absent.
    const real: [string, number][] = [
      ["A", 2], ["S", 2], ["A", 4], ["A", 4],
      ["S", 4], ["S", 4], ["S", 4], ["A", 4],
      ["S", 4], ["S", 2], ["A", 4], ["S", 4],
      ["S", 1], ["S", 4],
    ];
    const r = resolveCgpa(null, {
      effectiveGrades: real.map(([grade, credits]) => course({ grade, credits })),
    });
    expect(r.source).toBe("derived");
    expect(Number(r.cgpa)).toBeCloseTo(9.62, 2);
  });

  it("reads the CGPA off a grades payload that publishes one", () => {
    const r = resolveCgpa(null, {
      cgpa: { cgpa: "9.62", creditsEarned: "47" },
      effectiveGrades: [course({ grade: "F", credits: 4 })],
    });
    // The published 9.62 must beat the 0 that F alone would derive.
    expect(r).toEqual({ cgpa: "9.62", creditsEarned: "47", source: "grades" });
  });

  it("prefers published credits over derived ones", () => {
    // The derived total is the sum of the courses we happened to receive, not
    // the college's record. A published figure is authoritative.
    const r = resolveCgpa({ cgpa: "", creditsEarned: "47" }, {
      effectiveGrades: [course({ grade: "S", credits: 4 })],
    });
    expect(r.creditsEarned).toBe("47");
    expect(r.cgpa).toBe("10");
  });

  it("returns nothing rather than a zero CGPA", () => {
    expect(resolveCgpa(null, null)).toEqual({
      cgpa: undefined,
      creditsEarned: undefined,
      source: "none",
    });
  });

  it("survives the phantom rows as the only content", () => {
    expect(resolveCgpa(null, { effectiveGrades: PHANTOM_ROWS }).source).toBe("none");
  });
});