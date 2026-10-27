import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { consecutiveLabPeriodPairs, generateTimetables } from "../components/custom/exams/FFCS/logic/generate";
import type { GenerateParams, GenerateResult } from "../components/custom/exams/FFCS/logic/generate";
import type {
  ParsedCourse,
  CourseLock,
  Friend,
  AddedCourse,
  TimetableState,
} from "../components/custom/exams/FFCS/types";
import { periodsForSlot, type SlotPeriod } from "../lib/slots";
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

  it("keeps only the offering with the selected employee id", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "A SHARED NAME", ERP_ID: "1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "A SHARED NAME", ERP_ID: "2" }),
        ],
        courseLocks: [lock({ code: "BCSE101", offerings: ["A SHARED NAME|B1+TB1|AB1-101|2"] })],
      })
    );
    expect(layouts(r)).toEqual(["B1|TB1"]);
  });

  it("still matches an offering id saved before employee ids were used", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "A SHARED NAME", ERP_ID: "1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "A SHARED NAME", ERP_ID: "2" }),
        ],
        courseLocks: [lock({ code: "BCSE101", offerings: ["A SHARED NAME|B1+TB1|AB1-101"] })],
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

  it("lets relaxed morning theory include evening offerings but ranks morning theory first", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
          row({ CODE: "BCSE101", SLOT: "A2+TA2", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        preference: "morning",
        strictTheoryPreference: false,
      })
    );
    expect(layouts(r)).toEqual(["A1|TA1", "A2|TA2"]);
    if (r.kind === "ok") {
      expect(r.timetables[0].rankingComponents?.time).toBeGreaterThan(
        r.timetables[1].rankingComponents?.time ?? 0
      );
    }
  });

  it("does not apply theory preferences to lab-only offerings", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", TYPE: "LO", SLOT: "L1" }),
          row({ CODE: "BCSE101", TYPE: "LO", SLOT: "L21", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        preference: "evening",
      })
    );
    expect(layouts(r)).toEqual(["L1", "L21"]);
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

  it("applies separate latest-end limits only on selected days", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1", ROOM: "AB1-101" }),
          row({ CODE: "BCSE101", SLOT: "B1", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" })],
        maxEndTimeByDay: { mon: "08:30" },
      })
    );

    expect(layouts(r)).toEqual(["B1"]);
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

  it("uses employee ids to tell two people with one name apart", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "A1+TA1", FACULTY: "A SHARED NAME", ERP_ID: "1" }),
          row({ CODE: "BCSE101", SLOT: "B1+TB1", FACULTY: "A SHARED NAME", ERP_ID: "2" }),
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

describe("labs on separate days", () => {
  /**
   * The rule is about which DAYS lab bookings fall on, so the fixtures use
   * the morning lab ladder from the real chennai schema: L1 is Monday 08:00,
   * L2 Monday 08:50, L7 Tuesday 08:00, L8 Tuesday 08:50, L13 Wednesday 08:00.
   * Adjacent lab periods do not conflict time-wise, which matters: a week that
   * pairs them is conflict-free and must still be ruled out when the option
   * asks for one lab per day.
   */

  it("keeps two labs that fall on different days", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE102", SLOT: "L7" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        separateLabDays: true,
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(1);
  });

  it("keeps one lab that spans two days on its own", () => {
    // A single booking's lab periods are one lab, not two: `L1+L7` runs
    // Monday and Tuesday and never pairs with another lab.
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "L1+L7" })],
        courseLocks: [lock({ code: "BCSE101" })],
        separateLabDays: true,
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(1);
  });

  it("with the option off, back-to-back labs on one day are fine as before", () => {
    // L1 and L2 are adjacent, so they are conflict-free; the unset option
    // changes nothing about weeks like this.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE102", SLOT: "L2" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(1);
  });

  it("drops a week that puts two labs on the same day, and names why", () => {
    // L1 and L2 are adjacent — monday 08:00 and 08:50 — so the search finds
    // them, and the lab rule is what rejects them. The failure must not read
    // as "no conflict-free week exists".
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE102", SLOT: "L2" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        separateLabDays: true,
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_separate_labs");
  });

  it("picks the mixed-day pairings when two sections each are offered", () => {
    // Each course has a Monday section and a Tuesday one. Of the four
    // conflict-free pairings, two put both labs on one day (L1+L2, L7+L8) and
    // must not be kept; the mixed pairings are.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1", ROOM: "AB1-101" }),
          row({ CODE: "BCSE101", SLOT: "L7", ROOM: "AB1-102" }),
          row({ CODE: "BCSE102", SLOT: "L2", ROOM: "AB1-201" }),
          row({ CODE: "BCSE102", SLOT: "L8", ROOM: "AB1-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        separateLabDays: true,
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(2);
  });

  it("still judges theory-heavy weeks normally when the option is on", () => {
    // A theory course the same day as a lab is not "two labs on a day": the
    // rule only counts lab halves. F1 is Monday 08:55, the same day as L1 and
    // not same period.
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE103", SLOT: "F1" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE103" })],
        separateLabDays: true,
      })
    );
    expect(r.kind).toBe("ok");
    expect(layouts(r)).toHaveLength(1);
  });

  it("rejects separate lab classes in consecutive time slots", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE102", SLOT: "L2" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        avoidConsecutiveLabs: true,
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_consecutive_labs");
  });

  it("does not call non-adjacent lab periods consecutive", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L1" }),
          row({ CODE: "BCSE102", SLOT: "L3" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        avoidConsecutiveLabs: true,
      })
    );
    expect(r.kind).toBe("ok");
  });

  it("treats lab periods immediately before and after lunch as consecutive by default", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L6" }),
          row({ CODE: "BCSE102", SLOT: "L31" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        avoidConsecutiveLabs: true,
      })
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_consecutive_labs");
  });

  it("lets students treat the schema-defined lunch break as a break between lab classes", () => {
    const r = generateTimetables(
      params({
        masterCourses: [
          row({ CODE: "BCSE101", SLOT: "L6" }),
          row({ CODE: "BCSE102", SLOT: "L31" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
        avoidConsecutiveLabs: true,
        lunchBreakSeparatesLabs: true,
      })
    );
    expect(r.kind).toBe("ok");
  });

  it("does not treat slots within a single multi-slot lab class as consecutive classes", () => {
    const r = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "L1+L2" })],
        courseLocks: [lock({ code: "BCSE101" })],
        avoidConsecutiveLabs: true,
      })
    );
    expect(r.kind).toBe("ok");
  });
});

describe("in-tree pruning on the monotone rules", () => {
  /**
   * The three monotone result filters — separate lab days, no consecutive
   * labs, the half-days floor — used to run only after the walk, on every
   * conflict-free week it produced. They now also run *inside* it: the walk
   * carries bitmasks for the partial week and declines an offering the moment
   * it would break a rule, which is what lets `limit` count weeks worth
   * showing rather than every week that merely does not collide.
   *
   * Pruning is only sound if it drops exactly what enumerating-then-filtering
   * would have dropped, and in the same order. This asserts that directly:
   * enumerate the whole tree with every rule off (the pipeline as it was, one
   * flag away), filter that list here with plain implementations of the two
   * lab rules and the metrics' own half-days number, and require the pruned
   * run's output to be that list — element for element, in order.
   *
   * The fixture is five courses chosen so the three kinds of pruning meet
   * each other in one tree: L1 and L2 are adjacent Monday lab periods (a
   * same-day and a consecutive violation in one pair), L7 and L8 the same on
   * Tuesday, F1 collides with L2 and G1 with L8 so clash-pruning and
   * rule-pruning interleave, and E1 clashes with nothing so every surviving
   * subtree reaches a leaf. Four weeks survive the clash check; the lab rules
   * keep two of them.
   */
  const fixture = (): Partial<GenerateParams> => ({
    masterCourses: [
      row({ CODE: "BCSE101", SLOT: "L1", ROOM: "AB1-101" }),
      row({ CODE: "BCSE102", SLOT: "L2", ROOM: "AB2-101" }),
      row({ CODE: "BCSE102", SLOT: "L7", ROOM: "AB2-102" }),
      row({ CODE: "BCSE103", SLOT: "L8", ROOM: "AB3-101" }),
      row({ CODE: "BCSE103", SLOT: "L13", ROOM: "AB3-102" }),
      row({ CODE: "BCSE104", SLOT: "F1", ROOM: "AB4-101" }),
      row({ CODE: "BCSE104", SLOT: "G1", ROOM: "AB4-102" }),
      row({ CODE: "BCSE105", SLOT: "E1", ROOM: "AB5-101" }),
    ],
    courseLocks: ["BCSE101", "BCSE102", "BCSE103", "BCSE104", "BCSE105"].map((code) =>
      lock({ code })
    ),
    noLimit: true,
    removeHardResultLimit: true,
  });

  const labPeriodsOf = (course: AddedCourse): SlotPeriod[] =>
    course.slots.flatMap((slot) =>
      periodsForSlot(chennai as never, slot).filter((period) => period.type === "lab")
    );

  /** The lab-day rule, read straight off the week: two courses, one day. */
  const twoLabsOnADay = (timetable: TimetableState): boolean => {
    const days = timetable.courses.flatMap(
      (course) => [...new Set(labPeriodsOf(course).map((period) => period.day))]
    );
    return new Set(days).size !== days.length;
  };

  /** The pair key the walk uses, rebuilt here rather than shared with it. */
  const pairKey = (day: string, first: number, second: number): string =>
    `${day}:${Math.min(first, second)}:${Math.max(first, second)}`;

  const labsAreConsecutive = (
    timetable: TimetableState,
    pairs: ReadonlySet<string>
  ): boolean => {
    const perCourse = timetable.courses.map(labPeriodsOf);
    for (let i = 0; i < perCourse.length; i++) {
      for (let j = i + 1; j < perCourse.length; j++) {
        for (const first of perCourse[i]) {
          for (const second of perCourse[j]) {
            if (
              first.day === second.day &&
              pairs.has(pairKey(first.day, first.index, second.index))
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  /** One week's identity: what it makes a week, with nothing meta included. */
  const weekId = (timetable: TimetableState): string =>
    JSON.stringify(
      timetable.courses.map((course) => [course.code, course.slots, course.faculty])
    );

  /** Grouped options flattened to one id per real week, in list order. */
  const weekIds = (timetables: readonly TimetableState[]): string[] =>
    timetables.flatMap((t) => [t, ...(t.variants ?? [])]).map(weekId);

  interface Case {
    name: string;
    over: Partial<GenerateParams>;
    /** How many of the four conflict-free weeks pass this case's rules. */
    expected: number;
    /** The failure code, for the cases that end in nothing at all. */
    code?: string;
  }

  const CASES: Case[] = [
    { name: "separate lab days", over: { separateLabDays: true }, expected: 2 },
    { name: "no consecutive labs", over: { avoidConsecutiveLabs: true }, expected: 2 },
    {
      name: "both lab rules",
      over: { separateLabDays: true, avoidConsecutiveLabs: true },
      expected: 2,
    },
    {
      name: "lunch keeps its gap",
      over: { avoidConsecutiveLabs: true, lunchBreakSeparatesLabs: true },
      expected: 2,
    },
    // The two surviving weeks fill four morning cells each (six free); the
    // two that carry G1 — which names both Tuesday 08:55 *and* Thursday 09:50
    // — fill five, so a floor of six keeps exactly the F1 pair. Partial weeks
    // dip below it only if the mask marks cells `dayOccupancy` would not.
    { name: "floor of six", over: { minHalfDays: 6 }, expected: 2 },
    // …and a floor of seven is one too many for every leaf: each is pruned
    // before any leaf exists, which must still read as a half-days failure
    // rather than "no conflict-free week".
    { name: "floor of seven", over: { minHalfDays: 7 }, expected: 0, code: "below_min_half_days" },
    { name: "floor of nine", over: { minHalfDays: 9 }, expected: 0, code: "below_min_half_days" },
    {
      name: "everything at once",
      over: { separateLabDays: true, avoidConsecutiveLabs: true, minHalfDays: 6 },
      // Lab rules keep the F1 and G1 weeks; the floor then drops the G1 one.
      expected: 1,
    },
  ];

  it("drops exactly what enumerating-then-filtering drops, in order", () => {
    const plain = generateTimetables(params(fixture()));
    if (plain.kind !== "ok") throw new Error(`the fixture must enumerate, got ${plain.kind}`);
    // Pin the fixture itself: four conflict-free weeks, all distinct enough
    // to survive grouping one per option.
    expect(plain.timetables).toHaveLength(4);

    for (const testCase of CASES) {
      const pairs = consecutiveLabPeriodPairs(
        chennai as never,
        testCase.over.lunchBreakSeparatesLabs ?? false
      );
      const oracle = plain.timetables.filter((timetable) => {
        if (testCase.over.separateLabDays && twoLabsOnADay(timetable)) return false;
        if (testCase.over.avoidConsecutiveLabs && labsAreConsecutive(timetable, pairs)) {
          return false;
        }
        const floor = testCase.over.minHalfDays ?? 0;
        if (floor > 0 && (timetable.metrics?.halfDays ?? 0) < floor) return false;
        return true;
      });
      expect(oracle, testCase.name).toHaveLength(testCase.expected);

      const pruned = generateTimetables(params({ ...fixture(), ...testCase.over }));
      if (testCase.expected === 0) {
        expect(pruned.kind, testCase.name).toBe("error");
        if (pruned.kind === "error" && testCase.code) {
          expect(pruned.code, testCase.name).toBe(testCase.code);
        }
      } else {
        expect(pruned.kind, testCase.name).toBe("ok");
      }
      expect(weekIds(pruned.kind === "ok" ? pruned.timetables : []), testCase.name).toEqual(
        weekIds(oracle)
      );
    }
  });
});
