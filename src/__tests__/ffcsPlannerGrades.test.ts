import { describe, expect, it } from "vitest";
import {
  buildGradeIndex,
  courseGrade,
  dispositionForGrade,
  gradeBadge,
  gradeLetter,
  retriesFirst,
  GRADE_BADGE_TONE_CLASSES,
} from "../lib/ffcsPlannerGrades";
import type { AllGradesRes } from "../types/data/allgrades";

/**
 * The planner's grade rules, exactly as specified:
 *
 *  - `S` → selection disallowed (done, nothing to improve).
 *  - `A`–`E` → allowed, with a "grade improvement" warning.
 *  - `F`, `N`, `NX`, `NX1`–`NX4` → allowed and surfaced to the top.
 *  - anything else → no rule at all.
 *
 * Plus the two properties every host depends on: the LATEST record for a
 * code wins (a retake then a pass must not still look like a retake), and
 * `retriesFirst` is stable and returns the same array when it has nothing
 * to do (memo dependencies stay honest).
 */

const item = (courseCode: string, grade: string) => ({
  slNo: "1",
  courseCode,
  courseTitle: `Title of ${courseCode}`,
  courseType: "Theory",
  grandTotal: "85",
  grade,
  courseId: null,
});

const payload = (semesters: Record<string, ReturnType<typeof item>[]>): AllGradesRes => ({
  grades: Object.fromEntries(Object.entries(semesters).map(([id, grades]) => [id, { gpa: "8.5", grades }])),
});

describe("dispositionForGrade", () => {
  it("blocks S — the subject is complete", () => {
    expect(dispositionForGrade("S")).toBe("completed");
    expect(dispositionForGrade(" s ")).toBe("completed"); // normalised
  });

  it("warns for A–E — selectable, counts as grade improvement", () => {
    for (const grade of ["A", "B", "C", "D", "E"]) {
      expect(dispositionForGrade(grade)).toBe("improvement");
    }
  });

  it("surfaces F, N, NX and NX1–NX4 — retakes", () => {
    for (const grade of ["F", "N", "NX", "NX1", "NX2", "NX3", "NX4"]) {
      expect(dispositionForGrade(grade)).toBe("retry");
    }
  });

  it("applies no rule to grades the specification does not name", () => {
    // `P` (pass), blank, an NX nobody issues (NX0/NX5), and garbage: none of
    // these may block, warn, or reorder anything.
    for (const grade of ["P", "", "   ", "NX0", "NX5", "W", "I", "Z"]) {
      expect(dispositionForGrade(grade)).toBe("clear");
    }
  });
});

describe("buildGradeIndex", () => {
  it("returns null when there is nothing recorded", () => {
    expect(buildGradeIndex(null)).toBeNull();
    expect(buildGradeIndex(undefined)).toBeNull();
    expect(buildGradeIndex({})).toBeNull();
    expect(buildGradeIndex({ grades: {} })).toBeNull();
    expect(buildGradeIndex({ grades: { CH1: { gpa: null, grades: [] } } })).toBeNull();
  });

  it("indexes by normalised course code", () => {
    const index = buildGradeIndex(payload({ CH1: [item(" bcse101 ", "A")] }));
    expect(index?.size).toBe(1);
    expect(courseGrade("BCSE101", index)?.grade).toBe("A");
    expect(courseGrade("bcse101", index)?.disposition).toBe("improvement");
  });

  it("lets the newest record for a code win", () => {
    // Term 1: F. Term 2 (retake): S. The subject must read as COMPLETED —
    // a stale F would keep surfacing a finished subject as a retake.
    const index = buildGradeIndex(
      payload({
        CH20242501: [item("BCSE101", "F")],
        CH20252601: [item("BCSE101", "S")],
      }),
    );
    expect(courseGrade("BCSE101", index)?.grade).toBe("S");
    expect(courseGrade("BCSE101", index)?.disposition).toBe("completed");
  });

  it("skips records without a code or grade", () => {
    const index = buildGradeIndex(payload({ CH1: [item("", "A"), item("BCSE101", ""), item("BCSE101", "B")] }));
    expect(index?.size).toBe(1);
    expect(courseGrade("BCSE101", index)?.grade).toBe("B");
  });
});

describe("gradeBadge", () => {
  const index = buildGradeIndex(
    payload({
      CH1: [item("BCSE101", "S"), item("BCSE102", "B"), item("BCSE103", "F"), item("BCSE104", "NX2")],
    }),
  );

  it("is null when no rule applies", () => {
    expect(gradeBadge("UNKNOWN101", index)).toBeNull();
    expect(gradeBadge("BCSE104", null)).toBeNull();
    const passIndex = buildGradeIndex(payload({ CH1: [item("PHY101", "P")] }));
    expect(gradeBadge("PHY101", passIndex)).toBeNull(); // `P` has no rule
  });

  it("says S is completed and blocks selection", () => {
    const badge = gradeBadge("BCSE101", index)!;
    expect(badge.text).toBe("Completed · S");
    expect(badge.blocked).toBe(true);
    expect(badge.tone).toBe("red");
    expect(badge.title).toContain("cannot be selected");
  });

  it("says A–E is a grade improvement and stays selectable", () => {
    const badge = gradeBadge("BCSE102", index)!;
    expect(badge.text).toBe("Grade improvement");
    expect(badge.blocked).toBe(false);
    expect(badge.tone).toBe("amber");
    expect(badge.title).toContain("grade improvement");
  });

  it("says F and NX* are retakes and stay selectable", () => {
    for (const code of ["BCSE103", "BCSE104"]) {
      const badge = gradeBadge(code, index)!;
      expect(badge.text).toMatch(/^Retake · /);
      expect(badge.blocked).toBe(false);
      expect(badge.tone).toBe("blue");
    }
  });

  it("ships one shared set of tone classes for every host", () => {
    // The two picker hosts must style a badge identically: one record, so a
    // colour can never mean "blocked" in one sheet and "warning" in another.
    expect(GRADE_BADGE_TONE_CLASSES.red).toContain("text-red-500");
    expect(GRADE_BADGE_TONE_CLASSES.amber).toContain("border-amber-500/30");
    expect(GRADE_BADGE_TONE_CLASSES.amber).toContain("text-amber-600");
    expect(GRADE_BADGE_TONE_CLASSES.blue).toContain("text-blue-500");
  });
});

describe("gradeLetter", () => {
  const index = buildGradeIndex(
    payload({ CH1: [item("BCSE101", "S"), item("BCSE102", "B"), item("BCSE103", "F"), item("BCSE104", "NX2")] }),
  );

  it("is null when the course has no recorded grade", () => {
    expect(gradeLetter("UNKNOWN101", index)).toBeNull();
    expect(gradeLetter("BCSE101", null)).toBeNull();
  });

  it("shows the recorded grade itself, big, coloured by disposition", () => {
    // A completed `S`: the same red as its "Completed · S" badge, one size
    // up from everything around it — the glance answer to "do I have this?".
    const s = gradeLetter("BCSE101", index)!;
    expect(s.text).toBe("S");
    expect(s.className).toContain("text-2xl");
    expect(s.className).toContain("text-red-500");

    // `NX2` is three characters: same weight, one step smaller so a two-line
    // row never happens, and the retake blue matching its badge.
    const nx2 = gradeLetter("BCSE104", index)!;
    expect(nx2.text).toBe("NX2");
    expect(nx2.className).toContain("text-base");
    expect(nx2.className).not.toContain("text-2xl");
    expect(nx2.className).toContain("text-blue-500");

    const b = gradeLetter("BCSE102", index)!;
    expect(b.className).toContain("text-amber");
  });

  it("still shows a grade no rule applies to — in neutral", () => {
    // `P` wears no badge (no rule), but "I have a grade here" is worth
    // seeing; it just must not borrow a tone that implies a rule.
    const passIndex = buildGradeIndex(payload({ CH1: [item("PHY101", "P")] }));
    const p = gradeLetter("PHY101", passIndex)!;
    expect(p.text).toBe("P");
    expect(p.className).toContain("text-zinc-400");
    expect(p.className).not.toMatch(/text-(red|amber|blue)-/);
  });

  it("says what the letter is on hover", () => {
    expect(gradeLetter("BCSE101", index)!.title).toBe("Recorded grade: S");
    expect(gradeLetter("BCSE104", index)!.title).toBe("Recorded grade: NX2");
  });
});

describe("retriesFirst", () => {
  const codes = ["A1", "A2", "A3", "A4", "A5"];
  const index = buildGradeIndex(payload({ CH1: [item("A2", "F"), item("A4", "NX1"), item("A5", "S")] }));

  it("surfaces retakes to the top, keeping every other order", () => {
    const result = retriesFirst(codes, (c) => c, index);
    expect(result).toEqual(["A2", "A4", "A1", "A3", "A5"]);
  });

  it("is stable among retakes themselves", () => {
    // Input order decides among retakes — a sort that reordered them would
    // reshuffle the list on every unrelated change upstream.
    const result = retriesFirst(["A2", "A1", "A4", "A3"], (c) => c, index);
    expect(result).toEqual(["A2", "A4", "A1", "A3"]);
  });

  it("returns the SAME array when there is nothing to reorder", () => {
    // Callers memo on this result: a fresh array every render would re-run
    // downstream work for no reason.
    const nothing = ["A1", "A3"];
    expect(retriesFirst(nothing, (c) => c, index)).toBe(nothing);
    expect(retriesFirst(codes, (c) => c, null)).toBe(codes); // no index
    const empty: string[] = [];
    expect(retriesFirst(empty, (c) => c, index)).toBe(empty); // one item or none
  });

  it("does not treat completed or improvement subjects as retakes", () => {
    const result = retriesFirst(["A5", "A1"], (c) => c, index);
    expect(result).toEqual(["A5", "A1"]); // A5 is `S`, not a retake
  });
});
