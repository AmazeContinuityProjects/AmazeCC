import { describe, expect, it } from "vitest";
import {
  buildFacultyNameGroups,
  facultyGroupKey,
  facultyGroupToAddedCourses,
  facultyNameMatches,
  findFirstMatchingGroup,
  normalizeFacultyName,
  type FacultyOffering,
} from "../components/custom/exams/FFCS/logic/facultyGroups";

/**
 * The faculty name-grouping model.
 *
 * The whole feature rests on one behaviour: a directory name must resolve to the
 * *first* group whose spellings match, and reordered spellings of one person must
 * not become two groups. These tests pin both, plus the normalisation that makes
 * them hold, because a silent mismatch here shows up as "this professor teaches
 * nothing" rather than as an error.
 */

const offering = (over: Partial<FacultyOffering> = {}): FacultyOffering => ({
  CODE: "BCSE101",
  TITLE: "Programming",
  TYPE: "TH",
  CREDITS: "3",
  SLOT: "A1",
  FACULTY: "PARTHIBAN V",
  ROOM: "AB3-101",
  ...over,
});

describe("normalizeFacultyName", () => {
  it("strips honorifics, punctuation and parenthetical suffixes", () => {
    expect(normalizeFacultyName("Dr. Parthiban, V.")).toBe("PARTHIBAN V");
    expect(normalizeFacultyName("FACE (APT)")).toBe("FACE");
    expect(normalizeFacultyName("  Prof   Parthiban  ")).toBe("PARTHIBAN");
  });

  it("keeps a single-token name intact", () => {
    expect(normalizeFacultyName("RADHA")).toBe("RADHA");
  });
});

describe("facultyGroupKey", () => {
  it("is independent of word order", () => {
    expect(facultyGroupKey("PARTHIBAN V")).toBe(facultyGroupKey("V PARTHIBAN"));
  });
});

describe("facultyNameMatches", () => {
  it("matches reordered spellings of the same name", () => {
    expect(facultyNameMatches("PARTHIBAN V", "V PARTHIBAN")).toBe(true);
  });

  it("matches when the directory entry carries an extra middle name", () => {
    expect(facultyNameMatches("PARTHIBAN V", "PARTHIBAN V X")).toBe(true);
  });

  it("does not let a single shared initial claim identity", () => {
    expect(facultyNameMatches("S", "RADHA S")).toBe(false);
  });

  it("rejects genuinely different names", () => {
    expect(facultyNameMatches("PARTHIBAN V", "RADHA S")).toBe(false);
  });
});

describe("buildFacultyNameGroups", () => {
  it("groups reordered spellings under the first spelling seen", () => {
    const groups = buildFacultyNameGroups([
      offering({ FACULTY: "V PARTHIBAN" }),
      offering({ FACULTY: "PARTHIBAN V" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBe("V PARTHIBAN");
    expect(groups[0].names).toEqual(["V PARTHIBAN", "PARTHIBAN V"]);
    expect(groups[0].offerings).toHaveLength(2);
  });

  it("preserves first-seen order across distinct faculty", () => {
    const groups = buildFacultyNameGroups([
      offering({ FACULTY: "RADHA S" }),
      offering({ FACULTY: "PARTHIBAN V" }),
      offering({ FACULTY: "RADHA S" }),
    ]);

    expect(groups.map((g) => g.canonical)).toEqual(["RADHA S", "PARTHIBAN V"]);
  });

  it("skips rows with no faculty name", () => {
    const groups = buildFacultyNameGroups([offering({ FACULTY: "   " })]);
    expect(groups).toHaveLength(0);
  });
});

describe("findFirstMatchingGroup", () => {
  it("returns the first group whose spellings match", () => {
    const groups = buildFacultyNameGroups([
      offering({ FACULTY: "RADHA S" }),
      offering({ FACULTY: "PARTHIBAN V" }),
    ]);

    expect(findFirstMatchingGroup(groups, "V PARTHIBAN")?.canonical).toBe("PARTHIBAN V");
    expect(findFirstMatchingGroup(groups, "RADHA S")?.canonical).toBe("RADHA S");
  });

  it("returns null when nothing matches", () => {
    const groups = buildFacultyNameGroups([offering({ FACULTY: "RADHA S" })]);
    expect(findFirstMatchingGroup(groups, "NOBODY HERE")).toBeNull();
  });
});

describe("facultyGroupToAddedCourses", () => {
  it("splits combined slots and drops NIL", () => {
    const [course] = facultyGroupToAddedCourses(
      buildFacultyNameGroups([
        offering({ SLOT: "A1+TA1" }),
        offering({ SLOT: "NIL" }),
      ])[0]
    );

    expect(course.slots).toEqual(["A1", "TA1"]);
  });

  it("maps the report fields onto a timetable course", () => {
    const [course] = facultyGroupToAddedCourses(
      buildFacultyNameGroups([offering()])[0]
    );

    expect(course.code).toBe("BCSE101");
    expect(course.faculty).toBe("PARTHIBAN V");
    expect(course.venue).toBe("AB3-101");
    expect(course.credits).toBe("3");
    expect(course.type).toBe("TH");
  });
});
