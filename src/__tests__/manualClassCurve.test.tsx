import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import {
  ABSOLUTE_GRADE_BOUNDARIES,
  buildGradeBoundaries,
  effectiveSd,
  hasUsableClassStats,
  isEarlyEstimate,
  manualClassStats,
} from "../lib/gradeBoundaries";
import { gradeRange } from "../lib/gradeInsights";
import {
  buildEnrolledCourses,
  useCoursePredictionScope,
} from "../components/custom/exams/marks-predictor/useCoursePredictionScope";
import ClassCurveEditor from "../components/custom/exams/marks-predictor/ClassCurveEditor";

/**
 * The reader's own class mean and σ: "what if the class averages 62, σ 11?"
 */

describe("manualClassStats — validating a typed curve", () => {
  it("accepts a sane mean and σ and marks them manual", () => {
    expect(manualClassStats({ mean: 62, sd: 11 })).toEqual({ count: 0, mean: 62, sd: 11, manual: true });
    expect(manualClassStats({ mean: "62.5", sd: "9.4" })).toEqual({ count: 0, mean: 62.5, sd: 9.4, manual: true });
  });

  it("rejects anything out of range or not a number", () => {
    for (const bad of [
      null,
      undefined,
      {},
      { mean: -1, sd: 10 },
      { mean: 101, sd: 10 },
      { mean: 60, sd: 0 },
      { mean: 60, sd: 0.4 },
      { mean: 60, sd: 51 },
      { mean: "abc", sd: 10 },
      { mean: 60, sd: NaN },
    ]) {
      expect(manualClassStats(bad as never)).toBeNull();
    }
  });
});

describe("a manual curve is taken exactly as typed", () => {
  const mine = manualClassStats({ mean: 60, sd: 4 })!;

  it("curves with no contributors at all", () => {
    expect(hasUsableClassStats(mine)).toBe(true);
    expect(buildGradeBoundaries(mine, true)).not.toBe(ABSOLUTE_GRADE_BOUNDARIES);
  });

  it("is not pooled toward the typical σ", () => {
    expect(effectiveSd(mine)).toBe(4);
    // S = 60 + 6 = 66, A = 62, B = 58 — exactly the typed σ.
    expect(buildGradeBoundaries(mine, true).slice(0, 3).map((b) => b.limit)).toEqual([66, 62, 58]);
  });

  it("is neither an early estimate nor given an uncertainty range", () => {
    expect(isEarlyEstimate(mine)).toBe(false);
    expect(gradeRange(63, mine, true)).toBeNull();
  });

  it("still does nothing on a course graded on fixed bands", () => {
    expect(buildGradeBoundaries(mine, false)).toBe(ABSOLUTE_GRADE_BOUNDARIES);
  });
});

/* ── the hook: persisted per course, wins over synced data, clears back ── */

const makeLS = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
};

const payload = (courseType: string): any => ({
  courseCode: "BCSE202L",
  courseTitle: "Data Structures",
  courseType,
  credits: "3",
  slot: "B1+TB1",
  classNbr: "21101",
  courseSystem: "ACE",
  assessments: [
    // 25/50 + 42/50 → 7.5 + 12.6 = 20.1 of 30 released → pace 67%.
    { title: "CAT - I", maxMark: "50", weightagePercent: "15", scoredMark: "25" },
    { title: "CAT - II", maxMark: "50", weightagePercent: "15", scoredMark: "42" },
    { title: "FAT", maxMark: "100", weightagePercent: "40" },
  ],
});

describe("useCoursePredictionScope — the reader's own curve", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeLS()));
  afterEach(() => vi.unstubAllGlobals());

  const synced = { "21101": { overall: { count: 40, mean: 55, sd: 12 }, assessments: {} } };

  it("replaces the synced curve, survives a remount, and clears back", () => {
    const course = buildEnrolledCourses({ courses: [payload("Theory Only")] } as any, undefined, [])[0];
    const first = renderHook(() => useCoursePredictionScope(course, synced));
    expect(first.result.current.curveEligible).toBe(true);
    // Synced (55, 12): A from 61 → pace 67 reads A.
    expect(first.result.current.prediction?.optimalGrade?.letter).toBe("A");

    // A harder class: mean 70, σ 6 → B from 67, A from 73 → 67 reads B.
    act(() => first.result.current.setClassStatsOverride({ mean: 70, sd: 6 }));
    expect(first.result.current.classStats).toMatchObject({ mean: 70, sd: 6, manual: true });
    expect(first.result.current.prediction?.optimalGrade?.letter).toBe("B");
    expect(first.result.current.syncedClassStats).toMatchObject({ count: 40, mean: 55 });
    first.unmount();

    const second = renderHook(() => useCoursePredictionScope(course, synced));
    expect(second.result.current.classStatsOverride).toEqual({ mean: 70, sd: 6 });
    expect(second.result.current.prediction?.optimalGrade?.letter).toBe("B");

    act(() => second.result.current.setClassStatsOverride(null));
    expect(second.result.current.classStatsOverride).toBeNull();
    expect(second.result.current.prediction?.optimalGrade?.letter).toBe("A");
  });

  it("curves a course nobody else has synced yet", () => {
    const course = buildEnrolledCourses({ courses: [payload("Theory Only")] } as any, undefined, [])[0];
    const { result } = renderHook(() => useCoursePredictionScope(course, {}));
    expect(result.current.prediction?.isCurved).toBe(false);
    act(() => result.current.setClassStatsOverride({ mean: 55, sd: 12 }));
    expect(result.current.prediction?.isCurved).toBe(true);
    expect(result.current.prediction?.optimalGrade?.letter).toBe("A");
  });

  it("ignores invalid values instead of storing them", () => {
    const course = buildEnrolledCourses({ courses: [payload("Theory Only")] } as any, undefined, [])[0];
    const { result } = renderHook(() => useCoursePredictionScope(course, synced));
    act(() => result.current.setClassStatsOverride({ mean: 150, sd: 10 }));
    expect(result.current.classStatsOverride).toBeNull();
  });

  it("reports lab-only courses as not curve-eligible", () => {
    const course = buildEnrolledCourses({ courses: [payload("Lab Only")] } as any, undefined, [])[0];
    const { result } = renderHook(() => useCoursePredictionScope(course, synced));
    expect(result.current.curveEligible).toBe(false);
  });
});

/* ── the editor ─────────────────────────────────────────────────────────── */

describe("ClassCurveEditor", () => {
  afterEach(() => cleanup());

  it("prefills from class data and applies typed numbers", () => {
    const onChange = vi.fn();
    render(<ClassCurveEditor synced={{ count: 12, mean: 58.04, sd: 11.27 }} override={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /use your own/i }));
    const mean = screen.getByLabelText("Class mean") as HTMLInputElement;
    const sd = screen.getByLabelText("Class standard deviation") as HTMLInputElement;
    expect(mean.value).toBe("58");
    expect(sd.value).toBe("11.3");

    fireEvent.change(mean, { target: { value: "64" } });
    fireEvent.change(sd, { target: { value: "9.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ mean: 64, sd: 9.5 });
  });

  it("will not apply an out-of-range σ", () => {
    const onChange = vi.fn();
    render(<ClassCurveEditor synced={null} override={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /use your own/i }));
    fireEvent.change(screen.getByLabelText("Class standard deviation"), { target: { value: "0" } });
    const apply = screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/σ between 0.5 and 50/)).toBeTruthy();
  });

  it("offers the way back to class data while an override is set", () => {
    const onChange = vi.fn();
    render(
      <ClassCurveEditor synced={{ count: 12, mean: 58, sd: 11 }} override={{ mean: 64, sd: 9 }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /back to class data/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
