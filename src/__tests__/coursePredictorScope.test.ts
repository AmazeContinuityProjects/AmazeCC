import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { computeComponentStats, estimateComponentGrades } from "../lib/marksPredictor";
import { assessmentKeyFor } from "../lib/marksSync";
import {
  buildCourseConfig,
  buildEnrolledCourses,
  pinReservedFinalExamWeight,
  remainingWeightFor,
  useCoursePredictionScope,
  useRemappedCourseStats,
  weightFreezeFor,
} from "../components/custom/exams/marks-predictor/useCoursePredictionScope";

/**
 * Embedded courses in the predictor.
 *
 * VTOP emits each half of an embedded course as its own row — same course
 * code, the lab's slot starts with "L" — and the predictor has to treat them
 * the way vtop does: one blended course whose halves each keep their own
 * sub-total. Three regressions these tests pin:
 *
 * - a merged "Embedded Theory" course whose label carries no "lab" substring
 *   still defaults its lab half to one credit (zero = the lab silently
 *   disappears from the blended grade),
 * - the merged item carries theory + lab credits for SGPA weighting,
 * - a lab half is visible under the parent as its own pace/ceiling line
 *   (`estimateComponentGrades`), not only in the combined figure.
 */

const theoryPayload = (over: Record<string, unknown> = {}): any => ({
  courseCode: "BCSE202E",
  courseTitle: "Data Structures",
  courseType: "Embedded Theory",
  credits: "3",
  slot: "B1+TB1",
  classNbr: "21101",
  assessments: [
    { title: "CAT - I", maxMark: "50", weightagePercent: "15", scoredMark: "40" },
    { title: "CAT - II", maxMark: "50", weightagePercent: "15", scoredMark: "45" },
    { title: "FAT", maxMark: "100", weightagePercent: "40" },
  ],
  ...over,
});

const labPayload = (over: Record<string, unknown> = {}): any => ({
  courseCode: "BCSE202E",
  courseTitle: "Data Structures",
  courseType: "Lab Only",
  credits: "1",
  slot: "L31+L32",
  classNbr: "21102",
  assessments: [
    { title: "Continuous", maxMark: "100", weightagePercent: "60", scoredMark: "88" },
    { title: "Lab FAT", maxMark: "50", weightagePercent: "40" },
  ],
  ...over,
});

describe("buildCourseConfig — embedded defaults", () => {
  it("keeps the lab half alive on a merged 'Embedded Theory' item", () => {
    const item = buildEnrolledCourses(
      { courses: [theoryPayload(), labPayload()] } as any,
      undefined,
      []
    )[0];

    const config = buildCourseConfig(item, null);
    // The label says "Embedded Theory", which contains no "lab" — the payloads
    // decide, not the string.
    expect(config.theoryCredits).toBe(3);
    expect(config.labCredits).toBe(1);
    expect(config.theory).toHaveLength(3);
    expect(config.lab).toHaveLength(2);
  });

  it("collapses the two halves into one course with summed credits", () => {
    const roster = buildEnrolledCourses(
      { courses: [theoryPayload(), labPayload()] } as any,
      undefined,
      []
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].courseCode).toBe("BCSE202E");
    expect(roster[0].credits).toBe(4);
    expect(roster[0].theoryCourse).toBeTruthy();
    expect(roster[0].labCourse).toBeTruthy();
  });

  it("reads the theory half's name when a lab row arrived first", () => {
    const roster = buildEnrolledCourses(
      { courses: [labPayload({ courseTitle: "Data Structures Lab" }), theoryPayload()] } as any,
      undefined,
      []
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].courseTitle).toBe("Data Structures");
  });

  it("leaves a real lab-only elective as its own subject", () => {
    const roster = buildEnrolledCourses(
      {
        courses: [
          labPayload({ courseCode: "BTCS999L", courseTitle: "Workshop" }),
        ],
      } as any,
      undefined,
      []
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].courseCode).toBe("BTCS999L");
    const config = buildCourseConfig(roster[0], null);
    expect(config.theoryCredits).toBe(0);
    expect(config.labCredits).toBe(1);
  });

  it("keeps a lab-only elective honest when its attendance twin arrives", () => {
    // Every course gets an attendance row under the same code; the old
    // merge relabelled the first fill-in to "Embedded Theory", so real
    // lab-only electives read as ETL on the list.
    const marksRow = labPayload({ courseCode: "BTCS999L", courseTitle: "Workshop" });
    const attRow = {
      ...marksRow,
      classId: "21199",
    };

    const roster = buildEnrolledCourses(
      { courses: [marksRow] } as any,
      [attRow],
      []
    );

    expect(roster[0].courseType).toBe("Lab Only");
  });

  it("keeps a theory-only elective honest when its attendance twin arrives", () => {
    const marksRow = theoryPayload({ courseType: "Theory Only" });
    const roster = buildEnrolledCourses(
      { courses: [marksRow] } as any,
      [{ ...marksRow, classId: "21198" }],
      []
    );

    expect(roster[0].courseType).toBe("Theory Only");
  });

  it("declares an embedded pair once both halves genuinely compose", () => {
    // An oddly-typed pair (theory row says "Theory Only", its lab arrives
    // late from attendance) is still a blended course — relabel only when
    // the halves are both really present.
    const roster = buildEnrolledCourses(
      { courses: [theoryPayload({ courseType: "Theory Only" })] } as any,
      [{ ...labPayload(), classId: "21102" }],
      []
    );

    expect(roster[0].courseType).toBe("Embedded Theory");
    expect(roster[0].theoryCourse).toBeTruthy();
    expect(roster[0].labCourse).toBeTruthy();
  });

  it("prefers per-component credits the payloads publish, role-corrected", () => {
    // Missing credits fall back by role, present ones are honoured.
    const roster = buildEnrolledCourses(
      {
        courses: [
          theoryPayload({ credits: "" }),
          labPayload({ credits: null }),
        ],
      } as any,
      undefined,
      []
    );
    expect(roster[0].credits).toBe(4); // 3 + 1 fallbacks
  });

  it("lets a stored regimen override the defaults", () => {
    const item = buildEnrolledCourses({ courses: [theoryPayload(), labPayload()] } as any, undefined, [])[0];
    const config = buildCourseConfig(item, {
      theoryCredits: 2,
      labCredits: 2,
      theoryAssessments: [],
      labAssessments: [],
    });
    expect(config.theoryCredits).toBe(2);
    expect(config.labCredits).toBe(2);
    expect(config.theory).toHaveLength(0);
  });
});

describe("estimateComponentGrades — a half's sub-total", () => {
  it("paces the half on its released weight only", () => {
    const stats = computeComponentStats(
      [
        { id: "t1", title: "CAT", maxMark: 100, weightagePercent: 80, scoredMark: 50, component: "theory" },
        { id: "t2", title: "FAT", maxMark: 100, weightagePercent: 20, scoredMark: null, component: "theory" },
      ],
      "theory",
      3
    );
    const grades = estimateComponentGrades(stats);
    // Released = 80 (the unscored 20 is pending). pace = 50 → D.
    expect(grades.pacePct).toBe(50);
    expect(grades.optimal?.letter).toBe("D");
    // Ceiling = total − lost = 100 − 40 = 60 → C, capped by points lost.
    expect(grades.maximisablePct).toBe(60);
    expect(grades.maximisable.letter).toBe("C");
  });

  it("has no pace before the half records anything", () => {
    const stats = computeComponentStats(
      [{ id: "l1", title: "Continuous", maxMark: 100, weightagePercent: 60, scoredMark: null, component: "lab" }],
      "lab",
      1
    );
    const grades = estimateComponentGrades(stats);
    expect(grades.optimal).toBeNull();
    // Nothing lost yet, and the half's 60 configured points are its own full
    // ladder: ceiling 100% → S.
    expect(grades.maximisablePct).toBe(100);
    expect(grades.maximisable.letter).toBe("S");
  });

  it("reads a lab half's partial regimen as its own ladder", () => {
    const stats = computeComponentStats(
      [{ id: "l1", title: "Continuous", maxMark: 100, weightagePercent: 60, scoredMark: 50, component: "lab" }],
      "lab",
      1
    );
    const grades = estimateComponentGrades(stats);
    // Half of the max mark on the half's 60-point ladder = 30 secured of 60;
    // everything is released, so pace = 30/60 = 50% → D.
    expect(grades.pacePct).toBe(50);
    expect(grades.optimal?.letter).toBe("D");
    // Ceiling = (60−30)/60 = 50% → D (the ≥50 band). The lost 30 points are
    // gone however the continuous assessment finishes.
    expect(grades.maximisablePct).toBe(50);
    expect(grades.maximisable.letter).toBe("D");
  });
});

describe("grading context — the ladder the marks page shows", () => {
  /**
   * A student saw the marks page call their ~67% "A" while the predictor list
   * said "C": the subpage shifts its bands by the class distribution under a
   * curve, the predictor was hardcoded to the fixed ladder. The hook now
   * resolves `marksStats[classNbr].overall` and hands the same grading
   * context `computeCoursePrediction` gets on the marks page.
   */

  const curvedTheory = theoryPayload({
    assessments: [
      { title: "CAT - I", maxMark: "50", weightagePercent: "15", scoredMark: "25" },
      { title: "CAT - II", maxMark: "50", weightagePercent: "15", scoredMark: "42" },
      { title: "FAT", maxMark: "100", weightagePercent: "40" },
    ],
    courseSystem: "ACE",
  });
  // Released 30 wt, scored 7.5 + 12.6 = 20.1 → pace 67%. Fixed ladder → C;
  // curved (mean 55, sd 12) → A starts at 61 → A. Both readings cite the same
  // arithmetic the marks subpage runs.
  const curveStats = { "21101": { overall: { count: 69, mean: 55, sd: 12 }, assessments: {} } };

  it("carries courseSystem out of a merged item", () => {
    const item = buildEnrolledCourses(
      { courses: [curvedTheory, labPayload()] } as any,
      undefined,
      []
    )[0];
    expect(item.courseSystem).toBe("ACE");
  });

  it("keeps a lab-published system when the theory half publishes none", () => {
    const item = buildEnrolledCourses(
      { courses: [labPayload({ courseSystem: "ACE" }), theoryPayload()] } as any,
      undefined,
      []
    )[0];
    expect(item.courseSystem).toBe("ACE");
  });

  it("resolves class stats and curves the prediction through the hook", () => {
    const course = buildEnrolledCourses(
      { courses: [curvedTheory] } as any,
      undefined,
      []
    )[0];

    const { result } = renderHook(() =>
      useCoursePredictionScope(course, curveStats as Record<string, any>)
    );

    expect(result.current.classStats).toEqual({ count: 69, mean: 55, sd: 12 });
    expect(result.current.prediction?.pacePct).toBeCloseTo(67, 0);
    expect(result.current.prediction?.optimalGrade?.letter).toBe("A");
    expect(result.current.prediction?.isCurved).toBe(true);
  });

  it("stays on the fixed ladder with no class statistics", () => {
    const course = buildEnrolledCourses(
      { courses: [curvedTheory] } as any,
      undefined,
      []
    )[0];

    const { result } = renderHook(() =>
      useCoursePredictionScope(course, undefined)
    );

    expect(result.current.classStats).toBeNull();
    expect(result.current.prediction?.optimalGrade?.letter).toBe("C");
    expect(result.current.prediction?.isCurved).toBe(false);
  });

  it("leaves custom subjects unreadable rather than inventing a curve", () => {
    const { result } = renderHook(() =>
      useCoursePredictionScope(
        { courseCode: "CUSTOM01", courseTitle: "Self-spun subject", courseType: "Theory Only", credits: 3, isCustom: true },
        curveStats as Record<string, any>
      )
    );

    expect(result.current.classStats).toBeNull();
    // A custom subject publishes no courseSystem either — absolute ladder.
    expect(result.current.prediction?.isCurved).toBe(false);
  });
});

describe("useRemappedCourseStats — the raw atom into the predictor's shape", () => {
  /**
   * The sync atom stores the server payload verbatim (flat
   * `{ count, mean, sd, assessments }`, digests as keys). The predictor reads
   * `{ overall, assessments-by-title }`. Reading the raw atom missed every
   * `overall`, silently locking the global list to the fixed ladder while
   * course pages — fed a remapped map by the subpage — curved.
   */

  const curvedTheory = theoryPayload({
    courseSystem: "ACE",
    assessments: [
      { title: "CAT - I", maxMark: "50", weightagePercent: "15", scoredMark: "25" },
      { title: "CAT - II", maxMark: "50", weightagePercent: "15", scoredMark: "42" },
      { title: "FAT", maxMark: "100", weightagePercent: "40" },
    ],
  });

  /**
   * The remap awaits a SHA-256 digest whose resolution can land a macrotask
   * past a single zero-timeout drain, so settles are awaited through
   * `waitFor` instead of guessed.
   */
  const roster = buildEnrolledCourses({ courses: [curvedTheory] } as any, undefined, []);

  it("lifts the flat overall and joins assessment digests", async () => {
    const digest = await assessmentKeyFor("21101", "theory", "CAT - I");
    const stored = {
      "21101": {
        count: "69",
        mean: "55",
        sd: "12",
        assessments: { [digest]: { count: 69, mean: 40, sd: 4 } },
      },
    };

    const { result } = renderHook(() => useRemappedCourseStats(stored, roster));

    await waitFor(() => expect(result.current["21101"]?.overall).toEqual({ count: 69, mean: 55, sd: 12 }));
    expect(result.current["21101"].assessments["CAT - I"]).toEqual({ count: 69, mean: 40, sd: 4 });
  });

  it("stays empty on a missing atom — no invented distribution", async () => {
    const { result } = renderHook(() => useRemappedCourseStats(undefined, roster));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(Object.keys(result.current)).toHaveLength(0);
  });

  it("closes the loop: raw atom → remap → curved prediction in the hook", async () => {
    const { result: remapResult } = renderHook(() =>
      useRemappedCourseStats({ "21101": { count: "69", mean: "55", sd: "12" } } as any, roster)
    );
    await waitFor(() => expect(remapResult.current["21101"]).toBeTruthy());

    const { result } = renderHook(() =>
      useCoursePredictionScope(roster[0], remapResult.current as Record<string, any>)
    );

    // Released 30, scored 20.1 → pace 67%: fixed ladder says C, the curve
    // (mean 55, σ 12 → A at 61) says A — the exact read the list must render.
    expect(result.current.classStats).toEqual({ count: 69, mean: 55, sd: 12 });
    expect(result.current.prediction?.optimalGrade?.letter).toBe("A");
    expect(result.current.prediction?.isCurved).toBe(true);
  });
});

describe("weightage freeze — the facts a regimen may not touch", () => {
  it("freezes published rows and leaves pending user-made rows editable", () => {
    // Real VTOP marks → a fact; a what-if or a pending row stays a knob.
    expect(weightFreezeFor({ title: "CAT - I", scoredMark: 25, isSimulated: false })).toEqual({
      frozen: true,
      reason: "published",
    });
    expect(weightFreezeFor({ title: "Quiz 2", scoredMark: 30, isSimulated: true })).toEqual({
      frozen: false,
    });
    expect(weightFreezeFor({ title: "Assignment", scoredMark: null })).toEqual({
      frozen: false,
    });
  });

  it("reserves the final exam at 40% until it publishes", () => {
    // Unpublished FAT: reserved at 40% of the component total — the slot must
    // not be spendable on extra quizzes, and it cannot be deleted.
    expect(weightFreezeFor({ title: "FAT", scoredMark: null })).toEqual({
      frozen: true,
      reason: "fat-reserved",
    });
    expect(weightFreezeFor({ title: "Lab FAT", scoredMark: null })).toEqual({
      frozen: true,
      reason: "fat-reserved",
    });
    // Once published it stays frozen — now as a cohort fact.
    expect(weightFreezeFor({ title: "FAT", scoredMark: 72 })).toEqual({
      frozen: true,
      reason: "fat-published",
    });
  });

  it("pins the final exam's weightage at exactly 40% of its component", () => {
    // FAT is only worth 40% weightage per component: a stale payload value is
    // corrected, and it only lifts once the marks publish as a cohort fact.
    expect(
      pinReservedFinalExamWeight([
        { title: "FAT", scoredMark: null, weightagePercent: 30 },
        { title: "Lab FAT", scoredMark: null, weightagePercent: 60 },
        { title: "CAT - I", scoredMark: 25, weightagePercent: 15 },
      ])
    ).toEqual([
      { title: "FAT", scoredMark: null, weightagePercent: 40 },
      { title: "Lab FAT", scoredMark: null, weightagePercent: 40 },
      { title: "CAT - I", scoredMark: 25, weightagePercent: 15 },
    ]);
    // A published final exam keeps its own recorded weightage.
    expect(
      pinReservedFinalExamWeight([{ title: "FAT", scoredMark: 72, weightagePercent: 45 }])
    ).toEqual([{ title: "FAT", scoredMark: 72, weightagePercent: 45 }]);
  });

  it("builds every regimen — payload, stored, or preset — with FAT at 40%", () => {
    const roster = buildEnrolledCourses({ courses: [theoryPayload()] } as any, undefined, []);
    const config = buildCourseConfig(roster[0], {
      theoryAssessments: [
        {
          id: "t1",
          title: "CAT - I",
          maxMark: 50,
          weightagePercent: 15,
          scoredMark: 25,
          component: "theory",
        },
        {
          id: "t2",
          title: "FAT",
          maxMark: 100,
          weightagePercent: 25,
          scoredMark: null,
          component: "theory",
        },
      ],
      labAssessments: [],
      theoryCredits: 3,
      labCredits: 0,
    });
    expect(config.theory.find((a) => a.title === "FAT")?.weightagePercent).toBe(40);
    // The remaining pool pays for whatever the corrected FAT did not take.
    expect(remainingWeightFor(config.theory)).toBe(45);
  });

  it("pays out only the weight a component still has open", () => {
    // CAT-I 15 + CAT-II 15 (published) + FAT 40 (reserved) = 70 allocated.
    expect(remainingWeightFor([{ weightagePercent: 15 }, { weightagePercent: 15 }, { weightagePercent: 40 }])).toBe(30);
    // Fully allocated — nothing left for a new assessment to claim.
    expect(
      remainingWeightFor([
        { weightagePercent: 15 },
        { weightagePercent: 30 },
        { weightagePercent: 40 },
        { weightagePercent: 15 },
      ])
    ).toBe(0);
  });
});

describe("per-course persistence — what the user shapes survives the session", () => {
  /**
   * jsdom's localStorage is inert in this environment (reads come back dead),
   * so these stub a working one. The storage module reads the global lazily,
   * which is exactly what `vi.stubGlobal` covers.
   */
  const makeLS = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, String(value));
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
      clear: () => map.clear(),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      get length() {
        return map.size;
      },
    };
  };

  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLS());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const STORAGE_KEY = "uni_cc_marks_predictor_state";

  it("writes a saved target grade into the course's storage key", () => {
    const course = buildEnrolledCourses({ courses: [theoryPayload()] } as any, undefined, [])[0];
    const { result } = renderHook(() => useCoursePredictionScope(course, {}));
    expect(result.current.targetScore).toBeNull();

    act(() => {
      result.current.persistTargetScore(80);
    });

    const raw = (globalThis as any).localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw).BCSE202E.targetScore).toBe(80);
    expect(result.current.targetScore).toBe(80);
  });

  it("reopens with the goal a previous session saved", () => {
    (globalThis as any).localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ BCSE202E: { targetScore: 75 } })
    );
    const course = buildEnrolledCourses({ courses: [theoryPayload()] } as any, undefined, [])[0];
    const { result } = renderHook(() => useCoursePredictionScope(course, {}));

    expect(result.current.targetScore).toBe(75);
  });

  it("round-trips: set the goal, remount, the goal is still there", () => {
    const course = buildEnrolledCourses({ courses: [theoryPayload()] } as any, undefined, [])[0];
    const first = renderHook(() => useCoursePredictionScope(course, {}));
    act(() => {
      first.result.current.persistTargetScore(90);
    });
    first.unmount();

    const second = renderHook(() => useCoursePredictionScope(course, {}));
    expect(second.result.current.targetScore).toBe(90);
  });
});
