import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_GRADE_BOUNDARIES,
  buildGradeBoundaries,
  gradeAt,
  isRelativeGrading,
} from "../lib/gradeBoundaries";
import { estimateGrade } from "../lib/marksPredictor";
import { checkIsRelative } from "../components/custom/exams/courseHelpers";

/**
 * The one ladder both screens read.
 *
 * A student saw the marks page call their 67% "A" while the predictor's
 * subject list called the same course "C". Both screens averaged the same
 * payload correctly — the physics was never in question. What disagreed was
 * the ladder: the marks page shifts its bands by the class mean ± σ for
 * curve-graded courses, the predictor was hardcoded to the fixed one. These
 * tests pin the shared module that now feeds both.
 *
 * Fixture note: `estimateGrade(50)` → "D" and `estimateGrade(100)` → "S" on
 * the absolute ladder, and `estimateGrade` without boundaries must keep
 * returning exactly that — it predates curves and other screens read it.
 */

const stats = (mean: number, sd: number) => ({ count: 69, mean, sd });

describe("isRelativeGrading — which courses sit on a curve", () => {
  it("curves ACE theory halves and embedded pairs", () => {
    expect(isRelativeGrading("ACE", "Embedded Theory")).toBe(true);
    expect(isRelativeGrading("ACE", "Embedded Lab")).toBe(true);
    expect(isRelativeGrading("ACE", "Theory Only")).toBe(true);
  });

  it("leaves ACE lab-only electives on the fixed ladder", () => {
    expect(isRelativeGrading("ACE", "Lab Only")).toBe(false);
    expect(isRelativeGrading("ACE", "")).toBe(false);
  });

  it("matches checkIsRelative — one rule, two screens", () => {
    // The marks subpage's own helper now delegates here; sample both on the
    // same inputs so a future drift cannot pass silently.
    for (const [system, type] of [
      ["ACE", "Embedded Theory"],
      ["ACE", "Lab Only"],
      ["FC", "Theory Only"],
      ["FC", "Embedded Theory"],
      ["", "Theory Only"],
      ["", "Lab Only"],
    ] as const) {
      expect(isRelativeGrading(system, type)).toBe(checkIsRelative(system, type));
    }
  });
});

describe("buildGradeBoundaries — the shifted ladder", () => {
  it("keeps the absolute ladder when nothing curves", () => {
    expect(buildGradeBoundaries(stats(55, 12), false)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
    expect(buildGradeBoundaries(null, true)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
    expect(buildGradeBoundaries(undefined, true)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
  });

  it("shifts bands to mean ± σ under a curve", () => {
    // mean 55 sd 12: S = min(round(mean+1.5σ)=73, 100) → 73 — no 80 floor, S
    // rides the σ policy; A → mean+0.5σ = 61; B → 49; C → 43; D → 37; E → 31.
    expect(buildGradeBoundaries(stats(55, 12), true)).toEqual([
      { grade: "S", limit: 73 },
      { grade: "A", limit: 61 },
      { grade: "B", limit: 49 },
      { grade: "C", limit: 43 },
      { grade: "D", limit: 37 },
      { grade: "E", limit: 31 },
      { grade: "F", limit: 0 },
    ]);
  });

  it("leaves S free of any fixed floor", () => {
    // A brutal class (mean 30, σ 10) puts S at round(45) — no letter is
    // pinned to the fixed ladder's percentage.
    expect(buildGradeBoundaries(stats(30, 10), true)[0]).toEqual({ grade: "S", limit: 45 });
  });

  it("caps S at 100 so a perfect score can still earn it", () => {
    // An exceptional class: mean+1.5σ = 107 floors at the attainable ceiling.
    expect(buildGradeBoundaries(stats(95, 8), true)[0]).toEqual({ grade: "S", limit: 100 });
  });

  it("keeps the E–F boundary from rising above 50 on weak classes", () => {
    // mean 80, σ 5: the σ line (70) wants the pass bar higher than the
    // absolute pass mark — the lower bar (50) wins, so nothing above 50 fails.
    expect(buildGradeBoundaries(stats(80, 5), true)[5]).toEqual({ grade: "E", limit: 50 });
  });

  it("lets the E–F boundary sink to the σ line on strong classes", () => {
    // mean 62, σ 8: mean−2σ = 46 — the pass line is the σ value itself,
    // below 50, exactly where the class curve puts it.
    expect(buildGradeBoundaries(stats(62, 8), true)[5]).toEqual({ grade: "E", limit: 46 });
  });
});

describe("gradeAt — reading the ladder", () => {
  it("sits on the absolute ladder by default (parity with the old switch)", () => {
    expect(gradeAt(90)).toBe("S");
    expect(gradeAt(89)).toBe("A");
    expect(gradeAt(80)).toBe("A");
    expect(gradeAt(79)).toBe("B");
    expect(gradeAt(70)).toBe("B");
    expect(gradeAt(60)).toBe("C");
    expect(gradeAt(50)).toBe("D");
    expect(gradeAt(40)).toBe("E");
    expect(gradeAt(39)).toBe("F");
    expect(gradeAt(100)).toBe("S");
  });

  it("ceils the student's weightage to the next whole number", () => {
    // Grades are calculated against a ceiled weightage: a fractional total
    // rounds UP before it meets the table. 79.5 reads as an 80 → A; an exact
    // whole number stays exact (89.0 is an A — the ceil only lifts fractions).
    expect(gradeAt(79.5)).toBe("A");
    expect(gradeAt(89.99)).toBe("S");
    expect(gradeAt(59.2)).toBe("C");
    expect(gradeAt(89)).toBe("A");
  });

  it("hands out S when the ceiled weightage reaches the band's σ boundary", () => {
    // The rule verbatim: an S at 78, a student at 77.2 — the ceiled
    // weightage (78) reaches the S limit, so that student is S.
    // stats(60, 12): S = min(round(60 + 1.5σ = 78), 100) = 78.
    const curved = buildGradeBoundaries(stats(60, 12), true);
    expect(curved[0].limit).toBe(78);
    expect(gradeAt(77.2, curved)).toBe("S");
    expect(gradeAt(77.05, curved)).toBe("S");
    // 77.0 ceils to 77, misses the boundary, and reads A.
    expect(gradeAt(77, curved)).toBe("A");
  });

  it("returns the F tail on garbage percentages", () => {
    expect(gradeAt(NaN, ABSOLUTE_GRADE_BOUNDARIES)).toBe("F");
    expect(gradeAt(-5)).toBe("F");
  });
});

describe("estimateGrade — the predictor reads the same ladder", () => {
  const curved = buildGradeBoundaries(stats(55, 12), true);

  it("keeps the absolute ladder without boundaries", () => {
    expect(estimateGrade(67).letter).toBe("C");
    expect(estimateGrade(67)).toEqual(estimateGrade(67, ABSOLUTE_GRADE_BOUNDARIES));
  });

  it("calls the same 67% an A under the class curve — the reported bug", () => {
    // Absolute band: 60 ≤ 67 < 70 → C. Curved band with mean 55 sd 12:
    // A starts at 61 → A. Fixed ladder, same numbers, two letters — this is
    // the exact mismatch the user saw between the marks page and the list.
    expect(estimateGrade(67, curved)).toEqual({
      letter: "A",
      tone: "cyan",
      description: "Excellent (9 Grade Points)",
    });
  });

  it("ceils the weightage before the band read on either ladder", () => {
    // Absolute: 79.5 → 80 → A, not B. Curved (mean 55 σ 12, S at 73):
    // 80 ≥ 73 → S.
    expect(estimateGrade(79.5).letter).toBe("A");
    expect(estimateGrade(79.5, curved).letter).toBe("S");
  });
});
