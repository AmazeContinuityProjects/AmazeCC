import { describe, expect, it } from "vitest";
import {
  facultyPreferenceScore,
  hasFacultyPriority,
  sanitizeFacultyPriority,
  sortOptionsByFacultyPriority,
  splitFacultyNames,
  timetablePreferenceScore,
} from "../lib/ffcsFacultyPriority";

/**
 * Per-course faculty ordering, pinned.
 *
 * The orderings a student saves are matched against the report's own
 * `FACULTY` strings, so the case rules and the `/`-split are the contract —
 * a change to either silently re-orders someone's saved preferences.
 */

describe("splitFacultyNames", () => {
  it("splits a combined theory/lab cell into both teachers", () => {
    expect(splitFacultyNames("KAVITHA / MOHAN RAJ")).toEqual(["KAVITHA", "MOHAN RAJ"]);
  });

  it("trims and drops empty halves", () => {
    expect(splitFacultyNames("  ANAND  / / PRIYA ")).toEqual(["ANAND", "PRIYA"]);
  });

  it("treats a plain name as one entry", () => {
    expect(splitFacultyNames("SATHISH KUMAR P")).toEqual(["SATHISH KUMAR P"]);
  });

  it("is safe on empty and missing values", () => {
    expect(splitFacultyNames("")).toEqual([]);
    expect(splitFacultyNames(undefined as unknown as string)).toEqual([]);
  });
});

describe("sanitizeFacultyPriority", () => {
  it("keeps valid entries and drops malformed ones independently", () => {
    const out = sanitizeFacultyPriority({
      CSE1001: ["PROF A", "PROF B"],
      CSE1002: "not-a-list",
      CSE1003: [1, null, "  "],
      "": ["PROF A"],
    });
    expect(out).toEqual({ CSE1001: ["PROF A", "PROF B"] });
  });

  it("collapses case-insensitive duplicates to the first spelling", () => {
    expect(sanitizeFacultyPriority({ CSE1001: ["Prof A", "PROF A", "prof a"] })).toEqual({
      CSE1001: ["Prof A"],
    });
  });

  it("drops entries that end up empty rather than storing a blank ranking", () => {
    expect(sanitizeFacultyPriority({ CSE1001: ["", "  "] })).toEqual({});
  });

  it("refuses non-object roots", () => {
    expect(sanitizeFacultyPriority(null)).toEqual({});
    expect(sanitizeFacultyPriority([])).toEqual({});
    expect(sanitizeFacultyPriority("x")).toEqual({});
  });
});

describe("facultyPreferenceScore", () => {
  it("is null when the course has no ordering — not zero", () => {
    // An unranked course must contribute nothing: zero would drag its plans
    // below every ranked one instead of leaving them tied.
    expect(facultyPreferenceScore(undefined, "ANYONE")).toBeNull();
    expect(facultyPreferenceScore([], "ANYONE")).toBeNull();
  });

  it("scores the top pick highest and every rank distinguishably", () => {
    const list = ["A", "B", "C"];
    const top = facultyPreferenceScore(list, "A")!;
    const mid = facultyPreferenceScore(list, "B")!;
    const last = facultyPreferenceScore(list, "C")!;
    expect(top).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(last);
    expect(last).toBeGreaterThan(0);
  });

  it("matches case-insensitively and against either half of a combined cell", () => {
    const list = ["prof a", "prof b"];
    expect(facultyPreferenceScore(list, "PROF A")).toBe(facultyPreferenceScore(list, "prof a"));
    expect(facultyPreferenceScore(list, "PROF X / PROF B")).toBe(facultyPreferenceScore(list, "PROF B"));
  });

  it("scores an unlisted faculty zero, behind every listed one", () => {
    const list = ["A", "B"];
    const worst = facultyPreferenceScore(list, "C")!;
    expect(worst).toBe(0);
    expect(worst).toBeLessThan(facultyPreferenceScore(list, "B")!);
  });
});

describe("timetablePreferenceScore", () => {
  const map = { CSE1001: ["A", "B"] };

  it("averages only the courses that have an ordering", () => {
    const all = timetablePreferenceScore(
      [
        { code: "CSE1001", faculty: "A" },
        { code: "CSE9999", faculty: "NOBODY" },
      ],
      map,
    )!;
    // The unranked course must not dilute the ranked one's score.
    expect(all).toBe(facultyPreferenceScore(map.CSE1001, "A")!);
  });

  it("prefers a plan with the top faculty over one with the fallback", () => {
    const withTop = timetablePreferenceScore([{ code: "CSE1001", faculty: "A" }], map)!;
    const withOther = timetablePreferenceScore([{ code: "CSE1001", faculty: "B" }], map)!;
    expect(withTop).toBeGreaterThan(withOther);
  });

  it("is null when nothing applies, so callers skip the sort", () => {
    expect(timetablePreferenceScore([{ code: "X", faculty: "Y" }], undefined)).toBeNull();
    expect(timetablePreferenceScore([{ code: "X", faculty: "Y" }], {})).toBeNull();
  });
});

describe("sortOptionsByFacultyPriority", () => {
  const option = (faculty: string) => ({ FACULTY: faculty });

  it("brings preferred offerings first, keeping the student's order among them", () => {
    const options = [option("C"), option("A"), option("D"), option("B")];
    const sorted = sortOptionsByFacultyPriority(options, { X: ["A", "B"] }, "X", (o) => o.FACULTY);
    expect(sorted.map((o) => o.FACULTY)).toEqual(["A", "B", "C", "D"]);
  });

  it("is a no-op for a course with no ordering (report order preserved)", () => {
    const options = [option("C"), option("A"), option("B")];
    expect(sortOptionsByFacultyPriority(options, { Y: ["A"] }, "X", (o) => o.FACULTY)).toEqual(options);
  });

  it("matches either half of a combined theory/lab faculty cell", () => {
    const options = [option("UNKNOWN"), option("THEORY P / LAB Q")];
    const sorted = sortOptionsByFacultyPriority(options, { X: ["LAB Q"] }, "X", (o) => o.FACULTY);
    expect(sorted[0].FACULTY).toBe("THEORY P / LAB Q");
  });

  it("does not mutate the input array", () => {
    const options = [option("C"), option("A")];
    sortOptionsByFacultyPriority(options, { X: ["A"] }, "X", (o) => o.FACULTY);
    expect(options.map((o) => o.FACULTY)).toEqual(["C", "A"]);
  });
});

describe("hasFacultyPriority", () => {
  it("is false for empty and missing maps", () => {
    expect(hasFacultyPriority(undefined)).toBe(false);
    expect(hasFacultyPriority({})).toBe(false);
  });

  it("is true when at least one ordering exists", () => {
    expect(hasFacultyPriority({ X: ["A"] })).toBe(true);
  });
});
