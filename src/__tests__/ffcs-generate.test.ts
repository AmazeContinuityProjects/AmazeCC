import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { generateTimetables } from "../components/custom/exams/FFCS/logic/generate";
import type { GenerateParams } from "../components/custom/exams/FFCS/logic/generate";
import type { ParsedCourse, CourseLock, Friend } from "../components/custom/exams/FFCS/types";
import chennai from "../data/campus/chennai.json";

/**
 * The generator, pinned.
 *
 * This is the test the duplication did not have. The two inline copies were
 * byte-for-byte identical when this was written, which meant the invariant held
 * by luck — and the day one of them got an extra filter, or lost one, nothing
 * would have said so. Both surfaces now call this function, so "they agree" is
 * structural rather than a thing to remember.
 *
 * The fixtures are real rows from `ffcsReport.csv` wherever a test can get away
 * with it, so a slot id in a test is one a student actually has.
 */

const ALL_SLOTS = { minStartTime: null, maxEndTime: null } as const;

const row = (
  over: Partial<ParsedCourse> & Pick<ParsedCourse, "CODE" | "SLOT">
): ParsedCourse => ({
  CODE: over.CODE,
  TITLE: over.TITLE ?? "Course",
  TYPE: over.TYPE ?? "TH",
  CREDITS: over.CREDITS ?? "3",
  ROOM: over.ROOM ?? "AB1-101",
  SLOT: over.SLOT,
  FACULTY: over.FACULTY ?? "Dr Someone",
  ...over,
});

const lock = (
  over: Partial<CourseLock> & Pick<CourseLock, "code">
): CourseLock => ({
  code: over.code,
  title: over.title ?? "Course",
  allowedSlots: over.allowedSlots ?? [],
  allowedFaculty: over.allowedFaculty ?? [],
  offerings: over.offerings,
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
  noLimit: false,
  minHalfDays: 0,
  sortBy: "balanced",
  ...over,
});

/** The slot layout of every generated option, sorted — the stable identity. */
const layouts = (r: ReturnType<typeof generateTimetables>): string[] => {
  if (r.kind !== "ok") return [];
  return r.timetables
    .map((t) =>
      t.courses
        .flatMap((c) => c.slots)
        .slice()
        .sort()
        .join("|")
    )
    .sort();
};

describe("generating", () => {
  it("returns nothing to do when no course is picked", () => {
    const r = generateTimetables(params());
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_courses_selected");
  });

  it("generates a timetable for one course", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          // A1 is Monday 8:00 and Wednesday 8:55, so this has two offerings.
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(1);
  });

  it("keeps two courses off each other's periods", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          // B1 is Tuesday 8:00, which does not overlap A1.
          row({ CODE: "BCSE102", SLOT: "B1+TB1" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
      })
    );
    expect(r.kind).toBe("ok");
  });

  it("rejects a combination that would clash, and says so", () => {
    // Both offerings of BOTH courses are booked on Tuesday 8:00, so there is no
    // way to take one of each without a time clash.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "B1" }),
          row({ CODE: "BCSE102", SLOT: "B1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_conflict_free");
  });

  it("names the course that has no options left", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1" })],
        courseLocks: [
          lock({ code: "BCSE101" }),
          // No rows for this code at all.
          lock({ code: "BCSE999" }),
        ],
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.code).toBe("no_valid_slots");
      expect(r.subjectCode).toBe("BCSE999");
    }
  });
});

describe("the filters", () => {
  it("keeps only the slots the student named", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101", allowedSlots: ["B1", "TB1"] })],
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("keeps only the faculty the student named", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "One" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "Two", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101", allowedFaculty: ["Two"] })],
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("drops an offering blocked under either spelling of the period", () => {
    // The student blocked "A" — the law school's spelling. The schema calls that
    // period "A1", and the offering is booked "A1", so this only works because
    // the block is resolved through both spellings.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        blockedSlots: ["A"],
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("keeps only morning offerings when asked", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }), // morning
          row({ CODE: "BCSE101", SLOT: "A2+TA2", ROOM: "AB2-202" }), // evening
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        preference: "morning",
      })
    );
    expect(layouts(r)).toEqual(["A1|TA1"]);
  });

  it("keeps only evening offerings when asked", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "A2+TA2", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        preference: "evening",
      })
    );
    expect(layouts(r)).toEqual(["A2|TA2"]);
  });

  it("keeps only offerings inside the time bounds", () => {
    // A1 is 08:00–08:50 and TA1 is 09:50–10:40, so a 11:00 cutoff keeps the
    // whole booking. TA1 is the binding constraint, not A1.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "A2+TA2", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        minStartTime: "08:00",
        maxEndTime: "11:00",
      })
    );
    expect(layouts(r)).toEqual(["A1|TA1"]);
  });

  it("drops a booking that runs past the cutoff", () => {
    // The same booking against a 10:00 cutoff loses TA1, which ends at 10:40.
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
        minStartTime: "08:00",
        maxEndTime: "10:00",
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_valid_slots");
  });

  it("drops an embedded course whose halves never paired", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          // Says "Embedded" but has no lab slot.
          row({ CODE: "BCSE101", SLOT: "A1+TA1", TYPE: "Embedded Theory and Lab" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("leaves an ordinary course alone even though it has one slot", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    // Both survive: neither is embedded, so the completeness filter skips them.
    expect(layouts(r)).toHaveLength(2);
  });
});

describe("a law course generates like any other", () => {
  // The whole point of the slot-spelling layer, measured end to end: a booking
  // written the law school's way has to reach the generator and come back with
  // the periods it actually occupies.
  it("books TEE at the 12:35 period, where S11 sits", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "TLAW304L", SLOT: "E+TE+TEE", TYPE: "TH" })],
        courseLocks: [lock({ code: "TLAW304L" })],
      })
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      // One option — a law booking has a single slot string, so there is
      // nothing to choose between.
      expect(r.timetables).toHaveLength(1);
      const m = r.timetables[0].metrics!;
      // E1 is Tuesday and Friday, TE1 is Thursday, TEE is S11 on Monday: four
      // distinct mornings, so four half-days are gone.
      expect(m.halfDays).toBe(6);
    }
  });

  it("is blocked by blocking its own spelling", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "TLAW304L", SLOT: "E+TE+TEE" })],
        courseLocks: [lock({ code: "TLAW304L" })],
        blockedSlots: ["TEE"],
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_valid_slots");
  });
});

describe("the result", () => {
  it("scores every option", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      for (const tt of r.timetables) {
        const m = tt.metrics!;
        expect(m).toBeDefined();
        expect(m.gaps).toBeGreaterThanOrEqual(0);
        expect(m.gapsPerDay).toBeDefined();
        expect(Array.isArray(m.gapDetails)).toBe(true);
        expect(m.socialScore).toBe(0);
        expect(m.bestFriendMatches).toEqual([]);
        expect(typeof m.isLongWeekend).toBe("boolean");
        expect(typeof m.buildingDashes).toBe("number");
        expect(Array.isArray(m.dashDetails)).toBe(true);
      }
    }
  });

  it("numbers the options in the order it ranked them", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    if (r.kind === "ok") {
      expect(r.timetables.map((t) => t.name)).toEqual(
        r.timetables.map((_, i) => `Option ${i + 1}`)
      );
    }
  });

  it("gives every option at least one variant", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    if (r.kind === "ok") {
      for (const t of r.timetables) {
        expect(t.variants?.length).toBeGreaterThan(0);
      }
    }
  });

  it("stops early once it has enough", () => {
    const r = generateTimetables(
      params({
        masterCourses: Array.from({ length: 10 }, (_, i) =>
          row({ CODE: `BCSE1${i}0`, SLOT: ["A1", "B1", "C1", "D1", "A2"][i] })
        ),
        courseLocks: Array.from({ length: 10 }, (_, i) => lock({ code: `BCSE1${i}0` })),
        noLimit: false,
      })
    );
    // The cap is 50; the cartesian product here is 5^10, so this must not
    // enumerate all of it.
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.timetables.length).toBeLessThanOrEqual(50);
  });

  it("reports the half-days minimum rather than returning too few", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
          row({ CODE: "BCSE101", SLOT: "C1+TC1", ROOM: "AB2-303" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        minHalfDays: 10,
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("below_min_half_days");
  });
});

describe("scoring against friends", () => {
  const friend = (
    name: string,
    courses: { code: string; slots: string[]; faculty?: string }[]
  ): Friend => ({
    id: name,
    name,
    timetables: [
      {
        id: `${name}-tt`,
        name: `${name} timetable`,
        courses: courses.map((c, i) => ({
          id: `${name}-${i}`,
          code: c.code,
          title: "Course",
          faculty: c.faculty ?? "F",
          venue: "AB1-101",
          slots: c.slots,
          credits: "3",
          type: "TH",
          color: "bg-blue-600",
        })),
      },
    ],
  });

  it("gives a friend who takes the same course a share", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
        friends: [friend("Ada", [{ code: "BCSE101", slots: ["A1", "TA1"] }])],
        maximizeFreeTimeFriends: ["Ada"],
      })
    );
    if (r.kind === "ok") {
      expect(r.timetables[0].metrics!.socialScore).toBeGreaterThan(0);
      expect(r.timetables[0].metrics!.bestFriendMatches).toContain("Ada");
    }
  });

  it("scores zero against an empty room", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    if (r.kind === "ok") {
      expect(r.timetables[0].metrics!.socialScore).toBe(0);
      expect(r.timetables[0].metrics!.bestFriendMatches).toEqual([]);
    }
  });

  it("scores zero when friends exist but none were picked", () => {
    // Having a friend list is not the same as choosing a friend, and conflating
    // the two is a bug this test exists to prevent.
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
        friends: [friend("Ada", [{ code: "BCSE101", slots: ["A1", "TA1"] }])],
        maximizeFreeTimeFriends: [],
      })
    );
    if (r.kind === "ok") {
      expect(r.timetables[0].metrics!.socialScore).toBe(0);
    }
  });

  it("matches a friend's exact offering when asked to sync", () => {
    // The offering has to be the friend's faculty *and* slots: the sync filter
    // compares both, so a friend booked with a different lecturer is not a
    // match and the offering is correctly dropped.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "One" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "Two", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        friends: [
          friend("Ada", [{ code: "BCSE101", slots: ["B1", "TB1"], faculty: "Two" }]),
        ],
        syncFriendClasses: true,
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("scores against friends without applying the sync filter", () => {
    // The two settings are independent: asking to be scored against someone
    // must not narrow the search to what they are taking.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "One" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "Two", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        friends: [
          friend("Ada", [{ code: "BCSE101", slots: ["B1", "TB1"], faculty: "Two" }]),
        ],
        syncFriendClasses: false,
        maximizeFreeTimeFriends: ["Ada"],
      })
    );
    expect(layouts(r)).toHaveLength(2);
  });
});

describe("deduplicating by faculty", () => {
  it("keeps one timetable per faculty pairing", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          // Two offerings of the same course, same faculty, different slots.
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "One" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "One", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        uniqueFaculties: true,
      })
    );
    expect(layouts(r)).toHaveLength(1);
  });

  it("keeps both when they are different faculty", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "One" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "Two", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        uniqueFaculties: true,
      })
    );
    expect(layouts(r)).toHaveLength(2);
  });
});

describe("purity", () => {
  it("gives the same answer twice for the same input", () => {
    const make = () =>
      generateTimetables(
        params({
          masterCourses: [
            row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
            row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
          ],
          courseLocks: [lock({ code: "BCSE101" })],
        })
      );
    // Ids are random by design, so the comparison is over slot layouts — which
    // is what a student actually sees.
    expect(layouts(make())).toEqual(layouts(make()));
  });

  it("does not mutate the params it is given", () => {
    const p = params({
      masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
      courseLocks: [lock({ code: "BCSE101" })],
      blockedSlots: ["B1"],
    });
    const before = JSON.stringify(p);
    generateTimetables(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe("the real report", () => {
  it("generates from real rows", () => {
    const rows = readFileSync("public/ffcs/ffcsReport.csv", "utf8").split(/\r?\n/);
    const head = rows[0].split(",");
    const parsed: ParsedCourse[] = rows
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const cells = line.split(",");
        const r: Record<string, string> = {};
        head.forEach((h, i) => (r[h.trim()] = cells[i] ?? ""));
        return r as unknown as ParsedCourse;
      })
      .filter((c) => c.CODE && c.SLOT && c.SLOT !== "NIL");

    expect(parsed.length).toBeGreaterThan(2000);

    const r = generateTimetables(
      params({
        masterCourses: parsed,
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        noLimit: false,
      })
    );
    // Whatever it finds, it must be a coherent answer rather than a throw.
    expect(["ok", "error"]).toContain(r.kind);
    if (r.kind === "ok") {
      expect(r.timetables.length).toBeGreaterThan(0);
      for (const tt of r.timetables) {
        expect(tt.courses).toHaveLength(2);
        expect(tt.metrics!.halfDays).toBeGreaterThanOrEqual(0);
        expect(tt.metrics!.halfDays).toBeLessThanOrEqual(10);
      }
    }
  });
});
