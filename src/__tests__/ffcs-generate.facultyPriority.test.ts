import { describe, expect, it } from "vitest";
import { generateTimetablesStream } from "../components/custom/exams/FFCS/logic/generate";
import type { GenerateParams } from "../components/custom/exams/FFCS/logic/generate";
import type { CourseLock, ParsedCourse, TimetableState } from "../components/custom/exams/FFCS/types";
import chennai from "../data/campus/chennai.json";

/**
 * Per-course faculty priority inside the solver.
 *
 * Preference is ordering, never filtering: the same set of plans must come
 * out with and without a `facultyPriority`, only in a different order and
 * with different survivors at a result cap. These tests hold both halves of
 * that promise.
 */

const ALL_SLOTS = { minStartTime: null, maxEndTime: null } as const;

const row = (over: Partial<ParsedCourse> & Pick<ParsedCourse, "CODE" | "SLOT">): ParsedCourse => ({
  CODE: over.CODE,
  TITLE: over.TITLE ?? "Course",
  TYPE: over.TYPE ?? "TH",
  CREDITS: over.CREDITS ?? "3",
  ROOM: over.ROOM ?? "AB1-101",
  SLOT: over.SLOT,
  FACULTY: over.FACULTY ?? "Dr Someone",
  ...over,
});

const lock = (code: string): CourseLock => ({
  code,
  title: "Course",
  allowedSlots: [],
  allowedFaculty: [],
});

const params = (over: Partial<GenerateParams> = {}): GenerateParams => ({
  schema: chennai as never,
  masterCourses: [],
  courseLocks: [],
  blockedSlots: [],
  friends: [],
  preference: "none",
  syncFriendClasses: false,
  maximizeFreeTimeFriends: [],
  ...ALL_SLOTS,
  uniqueFaculties: false,
  noLimit: true,
  minHalfDays: 0,
  sortBy: "balanced",
  ...over,
});

/** The faculty of each variant's single course, in result order. */
const facultiesInResultOrder = (result: { kind: string }): string[] => {
  if (result.kind !== "ok") return [];
  return (result as unknown as { timetables: TimetableState[] }).timetables.map((t) => t.courses[0]?.faculty ?? "");
};

describe("facultyPriority in generation", () => {
  // Three disjoint offerings of one code: A1, C1, E1 — no clash possible
  // between them, so all three are valid on their own and only *order* can
  // distinguish the results.
  const masterCourses = [
    row({ CODE: "TEST1001", SLOT: "A1", FACULTY: "ALPHA" }),
    row({ CODE: "TEST1001", SLOT: "C1", FACULTY: "BETA" }),
    row({ CODE: "TEST1001", SLOT: "E1", FACULTY: "GAMMA" }),
  ];

  it("orders results by the student's ranking when one exists", () => {
    const result = generateTimetablesStream(
      params({
        masterCourses,
        courseLocks: [lock("TEST1001")],
        facultyPriority: { TEST1001: ["GAMMA", "ALPHA", "BETA"] },
      }),
    );
    expect(facultiesInResultOrder(result)).toEqual(["GAMMA", "ALPHA", "BETA"]);
  });

  it("leaves the default order untouched when no ranking exists", () => {
    const withNothing = generateTimetablesStream(params({ masterCourses, courseLocks: [lock("TEST1001")] }));
    const withOtherCourse = generateTimetablesStream(
      params({
        masterCourses,
        courseLocks: [lock("TEST1001")],
        facultyPriority: { OTHER9999: ["NOBODY"] },
      }),
    );
    // An ordering for an absent course must not disturb this one's order.
    expect(facultiesInResultOrder(withOtherCourse)).toEqual(facultiesInResultOrder(withNothing));
    expect(facultiesInResultOrder(withNothing)).toEqual(["ALPHA", "BETA", "GAMMA"]);
  });

  it("ranks an unlisted faculty behind every listed one", () => {
    const result = generateTimetablesStream(
      params({
        masterCourses,
        courseLocks: [lock("TEST1001")],
        facultyPriority: { TEST1001: ["BETA"] },
      }),
    );
    expect(facultiesInResultOrder(result)[0]).toBe("BETA");
  });

  it("does not filter: the same set of faculties appears with and without a ranking", () => {
    const without = facultiesInResultOrder(
      generateTimetablesStream(params({ masterCourses, courseLocks: [lock("TEST1001")] })),
    );
    const withPriority = facultiesInResultOrder(
      generateTimetablesStream(
        params({
          masterCourses,
          courseLocks: [lock("TEST1001")],
          facultyPriority: { TEST1001: ["GAMMA"] },
        }),
      ),
    );
    expect([...withPriority].sort()).toEqual([...without].sort());
  });

  it("honours a lock's restricted faculty before the ranking applies", () => {
    const result = generateTimetablesStream(
      params({
        masterCourses,
        courseLocks: [{ ...lock("TEST1001"), allowedFaculty: ["ALPHA"] }],
        facultyPriority: { TEST1001: ["GAMMA", "ALPHA"] },
      }),
    );
    // GAMMA is filtered out by the lock — preference orders survivors only.
    expect(facultiesInResultOrder(result)).toEqual(["ALPHA"]);
  });
});
