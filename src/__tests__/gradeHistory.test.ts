import { describe, expect, it } from "vitest";
import {
  GRADE_ORDER,
  averageByType,
  bestTerm,
  cumulativeGpa,
  embeddedSegments,
  gradeDistribution,
  isEmbeddedCourse,
  segmentBlend,
  gradePoints,
  latestSemester,
  semesterRows,
  toneForGrade,
  weightedTotal,
  weightedTotalDiffers,
} from "../lib/gradeHistory";
import type { GradeItem, GradeResultsMap } from "../types/data/allgrades";
import type { CourseItem } from "../types/data/marks";

/**
 * Grade history, as numbers.
 *
 * These derivations were inline in the screen, where the only way to find out
 * whether they were right was to already have the grades they were wrong about.
 * Three of the cases below are regressions for defects that shipped.
 */

const course = (over: Partial<GradeItem> = {}): GradeItem => ({
  slNo: "1",
  courseCode: "CSE1001",
  courseTitle: "Algorithms",
  courseType: "Theory",
  grandTotal: "88",
  grade: "A",
  courseId: null,
  details: null,
  range: null,
  ...over,
});

/** Real VTOP semester ids: `CH` + entry year + calendar year + term. */
const FALL_25 = "CH20252601";
const WINTER_25 = "CH20252605";
const SUMMER_25 = "CH20252607";
const FALL_26 = "CH20262701";

const payload = (over: Partial<GradeResultsMap> = {}): GradeResultsMap =>
  ({
    [WINTER_25]: { gpa: "8.10", grades: [course({ grandTotal: "81", grade: "B" })] },
    [FALL_25]: {
      gpa: "9.20",
      grades: [
        course({ grandTotal: "95", grade: "S" }),
        course({ courseCode: "MAT1001", grandTotal: "72", grade: "C" }),
      ],
    },
    ...over,
  }) as GradeResultsMap;

describe("semesterRows", () => {
  it("returns terms oldest first, regardless of the key order", () => {
    const rows = semesterRows(payload());
    expect(rows.map((r) => r.id)).toEqual([FALL_25, WINTER_25]);
  });

  it("names each term with the shared semester formatter", () => {
    // The bug this pins: the screen derived its own label as
    // `id.endsWith("1") ? Fall : Winter`, which labelled **summer** "Winter".
    // The expectation is `formatSemesterName`'s real output — the point of
    // delegating is that there is exactly one answer, not one this file likes.
    const rows = semesterRows(
      payload({ [SUMMER_25]: { gpa: "8.50", grades: [course()] } })
    );
    expect(rows.map((r) => r.label)).toEqual([
      "Fall 2025-26",
      "Winter 2025-26",
      "Summer 2025-26",
    ]);
  });

  it("keeps a term with no grades rather than dropping it", () => {
    // A term the college has not published yet is information, not noise.
    const rows = semesterRows(
      payload({ [FALL_26]: { gpa: null, grades: [] } })
    );
    expect(rows.map((r) => r.id)).toEqual([FALL_25, WINTER_25, FALL_26]);
    expect(rows[2].courses).toEqual([]);
    expect(rows[2].gpa).toBe(0);
  });

  it("survives a payload that is not a map of terms", () => {
    expect(semesterRows(undefined)).toEqual([]);
    expect(semesterRows(null)).toEqual([]);
    expect(semesterRows({} as GradeResultsMap)).toEqual([]);
    expect(
      semesterRows({ [FALL_25]: null } as unknown as GradeResultsMap).map((r) => r.id)
    ).toEqual([]);
  });

  it("averages only the courses that are actually scored", () => {
    const rows = semesterRows(
      payload({
        [WINTER_25]: {
          gpa: "8.00",
          grades: [
            course({ grandTotal: "90" }),
            course({ courseCode: "X1", grandTotal: "", grade: "" }),
            course({ courseCode: "X2", grandTotal: null, grade: "N" }),
          ],
        },
      })
    );
    const winter = rows.find((r) => r.id === WINTER_25)!;
    expect(winter.scored).toHaveLength(1);
    expect(winter.avgScore).toBe(90);
  });

  it("reports zero for an average when nothing is scored", () => {
    const rows = semesterRows(
      payload({ [WINTER_25]: { gpa: "8.00", grades: [course({ grandTotal: "" })] } })
    );
    expect(rows.find((r) => r.id === WINTER_25)!.avgScore).toBe(0);
  });

  it("rounds to two decimals so a page never renders 8.899999999", () => {
    const rows = semesterRows(
      payload({
        [WINTER_25]: {
          gpa: "8.00",
          grades: [course({ grandTotal: "70" }), course({ courseCode: "B", grandTotal: "72.5" })],
        },
      })
    );
    expect(rows.find((r) => r.id === WINTER_25)!.avgScore).toBe(71.25);
  });
});

describe("latestSemester and bestTerm", () => {
  it("opens on the newest term that has courses in it", () => {
    const rows = semesterRows(
      payload({ [FALL_26]: { gpa: null, grades: [] } })
    );
    expect(latestSemester(rows)?.id).toBe(WINTER_25);
  });

  it("falls back to the newest term when none has courses", () => {
    const rows = semesterRows(payload({ [FALL_26]: { gpa: null, grades: [] } }));
    expect(latestSemester(rows.map((r) => ({ ...r, courses: [], scored: [] })))?.id).toBe(FALL_26);
  });

  it("picks the highest GPA, ignoring terms that have none", () => {
    const rows = semesterRows(payload({ [FALL_26]: { gpa: null, grades: [] } }));
    expect(bestTerm(rows)?.id).toBe(FALL_25);
    expect(bestTerm(rows)?.gpa).toBe(9.2);
  });

  it("returns undefined rather than inventing a best term", () => {
    expect(bestTerm([])).toBeUndefined();
    expect(
      bestTerm(semesterRows({ [FALL_25]: { gpa: null, grades: [] } } as GradeResultsMap))
    ).toBeUndefined();
  });
});

describe("cumulativeGpa", () => {
  it("prefers the figure VTOP published", () => {
    const rows = semesterRows(payload());
    const c = cumulativeGpa(rows, {
      cgpa: "8.75",
      creditsEarned: "96",
      creditsRequired: "160",
    });
    expect(c).toEqual({
      value: 8.75,
      creditsEarned: 96,
      creditsRequired: 160,
      source: "vtop",
    });
  });

  it("falls back to a mean of the terms, and says that is what it did", () => {
    // Unweighted, so it is NOT the real CGPA — a 3-credit term counts the same as
    // a 24-credit one. The label is the point of the `source` field.
    const rows = semesterRows(payload());
    const c = cumulativeGpa(rows, { cgpa: "", creditsEarned: "0", creditsRequired: "160" });
    expect(c.source).toBe("derived");
    expect(c.value).toBe(8.65); // (9.20 + 8.10) / 2
  });

  it("reports nothing when there is no figure and no terms", () => {
    expect(cumulativeGpa([], null)).toEqual({
      value: 0,
      creditsEarned: 0,
      creditsRequired: 0,
      source: "none",
    });
  });

  it("ignores a published zero in favour of a real figure", () => {
    // `cgpa: "0"` is what an unsynced payload looks like, and it must not win.
    const c = cumulativeGpa(semesterRows(payload()), { cgpa: "0" });
    expect(c.source).toBe("derived");
  });
});

describe("gradeDistribution", () => {
  it("counts letters and orders them best to worst", () => {
    const rows = gradeDistribution([
      course({ grade: "B" }),
      course({ grade: "S" }),
      course({ grade: "A" }),
      course({ grade: "A" }),
      course({ grade: "C" }),
    ]);
    expect(rows.map((r) => r.grade)).toEqual(["S", "A", "B", "C"]);
    expect(rows.map((r) => r.count)).toEqual([1, 2, 1, 1]);
    expect(rows.find((r) => r.grade === "A")!.share).toBe(40);
  });

  it("excludes ungraded and unknown courses from the share", () => {
    // A term with `N`s in it must not make an `S` look like a minority, and `N`
    // is not a grade the student received — it is the absence of one.
    const rows = gradeDistribution([
      course({ grade: "S" }),
      course({ grade: "N" }),
      course({ grade: "" }),
      course({ grade: "P" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grade: "S", count: 1, share: 100 });
  });

  it("is empty when no course carries a graded letter", () => {
    expect(gradeDistribution([])).toEqual([]);
    expect(gradeDistribution([course({ grade: "" }), course({ grade: "N" })])).toEqual([]);
  });

  it("carries a tone for every band it emits", () => {
    const rows = gradeDistribution(GRADE_ORDER.map((g) => course({ grade: g })));
    expect(rows).toHaveLength(GRADE_ORDER.length);
    for (const r of rows) expect(r.tone).toBeTruthy();
  });
});

describe("averageByType", () => {
  it("keeps theory and lab apart, which is the point of the split", () => {
    const rows = averageByType([
      course({ courseType: "Theory", grandTotal: "90" }),
      course({ courseType: "Theory", grandTotal: "80" }),
      course({ courseType: "Lab", grandTotal: "60" }),
    ]);
    expect(rows.map((r) => r.type)).toEqual(["Theory", "Lab"]);
    expect(rows[0]).toMatchObject({ avg: 85, count: 2 });
    expect(rows[1]).toMatchObject({ avg: 60, count: 1 });
  });

  it("buckets a course with no type as Other", () => {
    expect(averageByType([course({ courseType: "" })])[0].type).toBe("Other");
  });

  it("omits a type with nothing scored instead of showing zero", () => {
    expect(averageByType([course({ grandTotal: "" })])).toEqual([]);
  });
});

describe("gradePoints and toneForGrade", () => {
  it("maps the 10-point scale", () => {
    expect(gradePoints("S")).toBe(10);
    expect(gradePoints("A")).toBe(9);
    expect(gradePoints("E")).toBe(5);
    expect(gradePoints("F")).toBe(0);
  });

  it("is case and whitespace tolerant", () => {
    expect(gradePoints(" a ")).toBe(9);
  });

  it("returns null for a letter it does not know", () => {
    expect(gradePoints("Z")).toBeNull();
    expect(gradePoints(undefined)).toBeNull();
    expect(gradePoints("")).toBeNull();
  });

  it("gives every known grade a tone, and zinc for anything else", () => {
    for (const g of GRADE_ORDER) expect(toneForGrade(g)).toBeTruthy();
    expect(toneForGrade("Z")).toBe("zinc");
    expect(toneForGrade(undefined)).toBe("zinc");
  });
});

describe("weightedTotal", () => {
  const detail = (component: string, scoredMark: string, weightageMark: string) => ({
    slNo: "1",
    component,
    maxMark: "50",
    weightagePercent: "50",
    status: "Present",
    scoredMark,
    weightageMark,
  });

  it("sums the weightage, not the raw marks", () => {
    // The distinction is the whole reason the helper exists: a 40/50 worth 60%
    // contributes 24, not 40.
    const total = weightedTotal([
      detail("Quiz 1", "40", "24"),
      detail("Quiz 2", "30", "26"),
    ]);
    expect(total).toBe(50);
  });

  it("distinguishes 'sums to nothing' from 'no usable breakdown'", () => {
    expect(weightedTotal([])).toBeNull();
    expect(weightedTotal(null)).toBeNull();
    expect(
      weightedTotal([{ ...detail("Quiz 1", "40", ""), weightageMark: "" }])
    ).toBeNull();
  });

  it("skips the assessments that carry no weightage and uses the rest", () => {
    expect(weightedTotal([detail("Quiz 1", "40", "24"), { ...detail("Lab", "50", "") }])).toBe(24);
  });
});

describe("weightedTotalDiffers", () => {
  const withBreakdown = (weightageMark: string, grandTotal: string) =>
    course({
      grandTotal,
      details: [
        {
          slNo: "1",
          component: "Quiz 1",
          maxMark: "50",
          weightagePercent: "100",
          status: "Present",
          scoredMark: weightageMark,
          weightageMark,
        },
      ],
    });

  it("is quiet about rounding noise", () => {
    expect(weightedTotalDiffers(withBreakdown("86.2", "86"))).toBe(false);
  });
  it("flags a real disagreement", () => {
    expect(weightedTotalDiffers(withBreakdown("72", "88"))).toBe(true);
  });

  it("cannot flag a course with no breakdown or no reported total", () => {
    expect(weightedTotalDiffers(course({ details: null, grandTotal: "88" }))).toBe(false);
    expect(weightedTotalDiffers(withBreakdown("88", ""))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Embedded courses
// ---------------------------------------------------------------------------

/**
 * A marks-payload course. `weightageMark` is VTOP's own weighted contribution,
 * so the sum over a half's assessments is that half's score out of 100.
 */
const marksCourse = (over: Partial<CourseItem> = {}): CourseItem => ({
  slNo: "1",
  classNbr: "CH2025260103149",
  courseCode: "BAEEE101",
  courseTitle: "Basic Engineering",
  courseType: "Embedded Theory",
  courseSystem: "ACE",
  credits: 3,
  faculty: "FACULTY",
  slot: "F1+TF1",
  courseMode: "Regular",
  assessments: [],
  ...over,
});

const assess = (title: string, weightageMark: string) => ({
  slNo: "1",
  title,
  maxMark: "100",
  weightagePercent: "40",
  status: "Present",
  scoredMark: weightageMark,
  weightageMark,
});

/**
 * BAEEE101 from CH20252601, verbatim in shape: published as one combined
 * grade of 84, with the halves only visible in the marks payload.
 */
const BAEEE101 = {
  published: course({
    courseCode: "BAEEE101",
    courseType: "Embedded Theory and Lab",
    grandTotal: "84",
    grade: "A",
  }),
  marks: {
    courses: [
      marksCourse({
        courseType: "Embedded Theory",
        credits: 3,
        assessments: [
          assess("Continuous Assessment Test - I", "10.8"),
          assess("Continuous Assessment Test - II", "10.2"),
          assess("Digital Assignment - I", "9"),
          assess("Digital Assignment - II", "9"),
          assess("Digital Assignment - III", "9"),
          assess("Final Assessment Test", "33.2"),
        ],
      }),
      marksCourse({
        classNbr: "CH2025260103150",
        courseType: "Embedded Lab",
        credits: 1,
        assessments: [
          assess("Assessment - 1", "5.4"),
          assess("Assessment - 2", "6"),
          assess("Assessment - 3", "5.4"),
          assess("Assessment - 4", "6"),
          assess("Assessment - 5", "5.4"),
          assess("Assessment - 6", "5.4"),
          assess("Assessment - 7", "5.4"),
          assess("Assessment - 8", "5.4"),
          assess("Assessment - 9", "4.8"),
          assess("Assessment - 10", "5.4"),
          assess("Final Assessment Test", "33.8"),
        ],
      }),
    ],
  },
};

describe("isEmbeddedCourse", () => {
  it("recognises the combined and half types VTOP publishes", () => {
    expect(isEmbeddedCourse({ courseType: "Embedded Theory and Lab" })).toBe(true);
    expect(isEmbeddedCourse({ courseType: "Embedded Theory" })).toBe(true);
    expect(isEmbeddedCourse({ courseType: "Embedded Lab" })).toBe(true);
  });

  it("does not claim theory-only, lab-only, project or online courses", () => {
    expect(isEmbeddedCourse({ courseType: "Theory Only" })).toBe(false);
    expect(isEmbeddedCourse({ courseType: "Lab Only" })).toBe(false);
    expect(isEmbeddedCourse({ courseType: "Project" })).toBe(false);
    expect(isEmbeddedCourse({ courseType: "Online Course" })).toBe(false);
    expect(isEmbeddedCourse({ courseType: "" })).toBe(false);
  });
});

describe("embeddedSegments", () => {
  it("splits an embedded course into its two halves, theory first", () => {
    const segments = embeddedSegments("BAEEE101", BAEEE101.marks);
    expect(segments).not.toBeNull();
    expect(segments!.map((s) => s.kind)).toEqual(["Theory", "Lab"]);
  });

  it("scores each half as the sum of its own weighted assessments", () => {
    const [theory, lab] = embeddedSegments("BAEEE101", BAEEE101.marks)!;
    // 10.8 + 10.2 + 9 + 9 + 9 + 33.2
    expect(theory.score).toBe(81.2);
    expect(theory.credits).toBe(3);
    // 5.4 + 6 + 5.4 + 6 + 5.4 + 5.4 + 5.4 + 5.4 + 4.8 + 5.4 + 33.8
    expect(lab.score).toBe(88.4);
    expect(lab.credits).toBe(1);
    expect(theory.assessments).toHaveLength(6);
    expect(lab.assessments).toHaveLength(11);
  });

  it("keeps VTOP's own type string on each half", () => {
    const [theory, lab] = embeddedSegments("BAEEE101", BAEEE101.marks)!;
    expect(theory.courseType).toBe("Embedded Theory");
    expect(lab.courseType).toBe("Embedded Lab");
  });

  it("returns whatever half exists when only one is published", () => {
    const onlyLab = {
      courses: [
        marksCourse({ courseType: "Embedded Lab", credits: 1, assessments: [assess("FAT", "50")] }),
      ],
    };
    const segments = embeddedSegments("BAEEE101", onlyLab);
    expect(segments!.map((s) => s.kind)).toEqual(["Lab"]);
    expect(segments![0].score).toBe(50);
  });

  it("is null when the halves are not cached, so the caller can fall back", () => {
    expect(embeddedSegments("BAEEE101", null)).toBeNull();
    expect(embeddedSegments("BAEEE101", undefined)).toBeNull();
    expect(embeddedSegments("BAEEE101", { courses: [] })).toBeNull();
    expect(embeddedSegments("BAEEE101", { courses: null as never })).toBeNull();
  });

  it("is null for a code with no marks rows of its own", () => {
    expect(embeddedSegments("BAPHY107", BAEEE101.marks)).toBeNull();
    expect(embeddedSegments("", BAEEE101.marks)).toBeNull();
  });

  it("ignores non-embedded courses sharing the code", () => {
    const noise = {
      courses: [
        marksCourse({ courseType: "Theory Only", credits: 4, assessments: [assess("FAT", "70")] }),
        marksCourse({ courseType: "Embedded Theory", credits: 3, assessments: [assess("FAT", "40")] }),
        marksCourse({ courseType: "Embedded Lab", credits: 1, assessments: [assess("FAT", "60")] }),
      ],
    };
    const segments = embeddedSegments("BAEEE101", noise)!;
    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.score)).toEqual([40, 60]);
  });

  it("has a null score, not a zero, when a half has no weighted marks", () => {
    const noMarks = {
      courses: [
        marksCourse({ courseType: "Embedded Theory", credits: 3, assessments: [] }),
        marksCourse({ courseType: "Embedded Lab", credits: 1, assessments: [] }),
      ],
    };
    const [theory, lab] = embeddedSegments("BAEEE101", noMarks)!;
    expect(theory.score).toBeNull();
    expect(lab.score).toBeNull();
  });
});

describe("segmentBlend", () => {
  it("reproduces the published total as the credit-weighted mean of the halves", () => {
    const segments = embeddedSegments("BAEEE101", BAEEE101.marks)!;
    const blend = segmentBlend(segments, "84")!;
    // (81.2 * 3 + 88.4 * 1) / 4
    expect(blend.theoryCredits).toBe(3);
    expect(blend.labCredits).toBe(1);
    expect(blend.blended).toBe(83);
    expect(blend.published).toBe(84);
    expect(blend.delta).toBe(-1);
  });

  it("stays close on real published terms", () => {
    const terms: Array<[number, number, number, number, number]> = [
      // theory score, lab score, theory cr, lab cr, published total
      [85.6, 94.0, 3, 1, 88],
      [85.95, 94.9, 3, 1, 89],
      [83.5, 89.2, 3, 1, 85],
      [95.0, 99.2, 3, 1, 97],
    ];
    for (const [th, lab, thc, labc, pub] of terms) {
      const blend = segmentBlend(
        [
          { kind: "Theory", courseType: "Embedded Theory", credits: thc, score: th, assessments: [] },
          { kind: "Lab", courseType: "Embedded Lab", credits: labc, score: lab, assessments: [] },
        ],
        String(pub)
      )!;
      expect(Math.abs(blend.delta)).toBeLessThanOrEqual(1);
    }
  });

  it("will not blend on an assumed credit ratio", () => {
    const segments = embeddedSegments("BAEEE101", BAEEE101.marks)!;
    const noCredits = segments.map((s) => ({ ...s, credits: null }));
    expect(segmentBlend(noCredits, "84")).toBeNull();
    const oneSided = [segments[0]];
    expect(segmentBlend(oneSided, "84")).toBeNull();
  });

  it("is null when a score or the published total is missing", () => {
    const segments = embeddedSegments("BAEEE101", BAEEE101.marks)!;
    expect(segmentBlend(segments, "")).toBeNull();
    expect(segmentBlend(segments, "-")).toBeNull();
    const noScores = segments.map((s) => ({ ...s, score: null }));
    expect(segmentBlend(noScores, "84")).toBeNull();
  });
});