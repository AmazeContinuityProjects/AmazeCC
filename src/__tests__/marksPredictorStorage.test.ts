import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomCourse,
  getCoursePredictorState,
  getCustomCourses,
  resetCoursePredictorState,
  saveCoursePredictorState,
  saveCustomCourse,
  setCourseIgnored,
} from "@/lib/marksPredictorStorage";

describe("marks predictor storage — exclusion and deletion", () => {
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

  it("ignores a subject without touching its neighbour's shaped state", () => {
    // Two courses with work the user shaped; ignoring one must not disturb
    // the other's saved regimen, sims or goal.
    saveCoursePredictorState("BCSE202E", { targetScore: 8 });
    saveCoursePredictorState("BCSE1013", { targetScore: 5.5 });

    setCourseIgnored("BCSE202E", true);

    expect(getCoursePredictorState("BCSE202E")?.ignored).toBe(true);
    // The ignore flip adds a field, never rewrites the course's what-ifs.
    expect(getCoursePredictorState("BCSE202E")?.targetScore).toBe(8);
    // Untouched: still there, and never opted out by side effect.
    expect(getCoursePredictorState("BCSE1013")?.ignored).toBeUndefined();
    expect(getCoursePredictorState("BCSE1013")?.targetScore).toBe(5.5);
  });

  it("flips the ignored flag back off — exclusion is reversible", () => {
    setCourseIgnored("BCSE202E", true);
    expect(getCoursePredictorState("BCSE202E")?.ignored).toBe(true);

    // Include it in the SGPA/CGPA pair again.
    setCourseIgnored("BCSE202E", false);
    expect(getCoursePredictorState("BCSE202E")?.ignored).toBe(false);
  });

  it("keeps the ignored choice out of a full state reset", () => {
    setCourseIgnored("BCSE202E", true);
    resetCoursePredictorState("BCSE202E");

    // The reset drops the entire saved state for the course, ignore included.
    expect(getCoursePredictorState("BCSE202E")).toBeNull();
  });

  it("deleting a custom subject removes it and its saved state", () => {
    saveCustomCourse({
      courseCode: "CUSTOM1",
      courseTitle: "Elective I made up",
      courseType: "Theory Only",
      theoryCredits: 3,
      labCredits: 1,
      isCustom: true,
    });
    saveCoursePredictorState("CUSTOM1", { targetScore: 7 });

    expect(getCustomCourses().map((c) => c.courseCode)).toContain("CUSTOM1");
    deleteCustomCourse("CUSTOM1");

    expect(getCustomCourses().map((c) => c.courseCode)).not.toContain("CUSTOM1");
    // The subject's keystones live in the state store — deletion must not
    // leave them orphaned against a code the list can no longer resolve.
    expect(getCoursePredictorState("CUSTOM1")).toBeNull();
  });
});
