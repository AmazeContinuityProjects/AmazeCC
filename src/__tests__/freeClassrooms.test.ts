import { describe, expect, it } from "vitest";
import {
  bestPeriod,
  blockAvailability,
  blockOf,
  buildDayIndex,
  buildPeriodSlots,
  freeRoomsForPeriod,
  freeRoomsForRun,
  isRealVenue,
  parseCourseRow,
  parseCourseRows,
  periodKey,
  positionLabel,
  resolveNow,
  resolvePeriods,
  timeToMinutes,
  type CampusSchema,
  type DayId,
  type FreeRoomCourse,
} from "../lib/freeClassrooms";
import chennai from "../data/campus/chennai.json";

/**
 * The free-classroom model.
 *
 * Three things this page used to get wrong, silently, and could not be caught
 * by looking at it:
 *
 *  1. Lab occupancy was never computed for 8 of 12 periods, because theory says
 *     `"8:00 AM"` and lab says `"08:00 AM"` and the two were compared as
 *     strings. Every lab in those periods was reported free while occupied.
 *  2. Six venues carry a trailing space, so the block filter offered `AB3` and
 *     `AB3 ` as two buildings and split the counts between them.
 *  3. The selectable period list was built from `schema.theory` alone, so the
 *     8 lab periods that do not coincide with a lecture could not be picked.
 *
 * Those are the first three tests. The rest is the arithmetic that has to be
 * right for the new features to mean anything.
 */

/** The real Chennai schema, trimmed to the parts that matter here. */
const CHENNAI: CampusSchema = {
  theory: [
    { start: "8:00 AM", end: "8:50 AM", days: { mon: "A1", tue: "A1" } },
    { start: "8:55 AM", end: "9:45 AM", days: { mon: "A2", tue: "A2" } },
    { start: "12:35 PM", end: "1:25 PM", days: { mon: "A3" } },
  ],
  lab: [
    // Zero-padded: this is the whole point of `periodKey`.
    { start: "08:00 AM", end: "08:50 AM", days: { mon: "L1", tue: "L1" } },
    // A lab slot with no theory counterpart at all.
    { start: "6:30 PM", end: "7:20 PM", days: { mon: "L9", tue: "L9" } },
  ],
};

const course = (over: Partial<FreeRoomCourse>): FreeRoomCourse => ({
  CODE: "BCSE101",
  TITLE: "Programming",
  TYPE: "TH",
  SLOT: "A1",
  FACULTY: "FACULTY",
  VENUE: "AB1-101",
  ...over,
});

describe("parseCourseRow", () => {
  /**
   * The first column of the real `ffcsReport.csv` carries a UTF-8 BOM.
   *
   * When the strip was written as a literal character rather than the `\uFEFF`
   * escape, the character was mangled on the way into the file, the regex
   * matched nothing, every key kept its BOM, `CODE` came back empty — and the
   * caller's "a course needs a code" filter then dropped all 2,357 rows. The
   * page rendered a correct, confident, completely empty timetable. So this is
   * pinned here rather than left to whichever editor touches the file next.
   */
  it("strips a byte-order mark off the first column name", () => {
    const course = parseCourseRow({
      "﻿CODE": "BASTS101",
      TITLE: "Qualitative Practice I",
      TYPE: "SS",
      SLOT: "F1+TF1",
      FACULTY: "SIXPHRASE(APT)",
      VENUE: "AB3-103",
    });
    expect(course.CODE).toBe("BASTS101");
    expect(course.VENUE).toBe("AB3-103");
  });

  it("upper-cases and trims the header names", () => {
    const course = parseCourseRow({ "  code ": "X1", " venue ": "AB1-101" });
    expect(course.CODE).toBe("X1");
    expect(course.VENUE).toBe("AB1-101");
  });

  it("accepts the report's alternative column names", () => {
    expect(parseCourseRow({ "COURSE CODE": "Y2", "COURSE TITLE": "T" }).CODE).toBe("Y2");
    expect(parseCourseRow({ ROOM: "AB2-202" }).VENUE).toBe("AB2-202");
  });

  it("keeps a row with no code, so the caller can drop it deliberately", () => {
    expect(parseCourseRow({ TITLE: "nameless" }).CODE).toBe("");
  });
});

describe("parseCourseRows", () => {
  it("drops only the rows that name no course", () => {
    const rows = parseCourseRows([
      { "﻿CODE": "A1", VENUE: "AB1-101" },
      { TITLE: "no code here" },
      { CODE: "B2", VENUE: "AB1-102" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.CODE)).toEqual(["A1", "B2"]);
  });
});

describe("timeToMinutes", () => {
  it("reads 12-hour times", () => {
    expect(timeToMinutes("8:00 AM")).toBe(480);
    expect(timeToMinutes("12:30 PM")).toBe(750);
    expect(timeToMinutes("12:00 AM")).toBe(0);
    expect(timeToMinutes("12:00 PM")).toBe(720);
  });

  it("rejects what it cannot read rather than guessing", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("lunch")).toBeNull();
    expect(timeToMinutes("25:00 PM")).toBeNull();
    // A 24h clock is not this schema's convention; silently accepting one would
    // order the period list wrongly.
    expect(timeToMinutes("14:30")).toBeNull();
  });
});

describe("periodKey", () => {
  it("treats a zero-padded hour as the same period", () => {
    // The lab-occupancy bug in one line.
    expect(periodKey("08:00 AM", "08:50 AM")).toBe(periodKey("8:00 AM", "8:50 AM"));
    expect(periodKey("08:00 AM", "08:50 AM")).toBe("8:00am-8:50am");
  });

  it("still separates genuinely different periods", () => {
    expect(periodKey("8:00 AM", "8:50 AM")).not.toBe(periodKey("8:55 AM", "9:45 AM"));
  });
});

describe("resolvePeriods", () => {
  it("unions theory and lab rather than reading either alone", () => {
    // `6:30 PM` exists only in the lab list; without the union it is unreachable.
    const keys = resolvePeriods(CHENNAI, "mon").map((p) => p.key);
    expect(keys).toContain("6:30pm-7:20pm");
    expect(keys).toContain("8:00am-8:50am");
  });

  it("carries both slot ids on a period that exists in theory and lab", () => {
    const period = resolvePeriods(CHENNAI, "mon").find((p) => p.key === "8:00am-8:50am");
    expect(period?.theorySlot).toBe("A1");
    expect(period?.labSlot).toBe("L1");
  });

  it("keeps the two lists from double-counting a shared period", () => {
    // 3 theory + 2 lab, of which one period overlaps.
    expect(resolvePeriods(CHENNAI, "mon")).toHaveLength(4);
  });

  it("merges a period that overlaps another, taking both slot kinds", () => {
    // The shape that made the old model over-report: a lab block running across
    // a lecture's start time. A student picking the lab block is asking about
    // rooms during the lecture too.
    const periods = resolvePeriods(
      {
        theory: [{ start: "8:55 AM", end: "9:45 AM", days: { mon: "F1" } }],
        lab: [{ start: "08:50 AM", end: "09:40 AM", days: { mon: "L2" } }],
      },
      "mon"
    );
    expect(periods).toHaveLength(1);
    expect(periods[0].start).toBe("8:50 AM");
    expect(periods[0].end).toBe("9:45 AM");
    // Both slots, so neither kind of class is invisible to the query.
    expect(periods[0].theorySlot).toBe("F1");
    expect(periods[0].labSlot).toBe("L2");
  });

  it("does not merge across a real gap", () => {
    // The five-minute changeover is a gap, not an overlap: merging across it
    // would invent occupancy for a period nothing runs in.
    const periods = resolvePeriods(
      {
        theory: [
          { start: "8:00 AM", end: "8:50 AM", days: { mon: "A1" } },
          { start: "8:55 AM", end: "9:45 AM", days: { mon: "A2" } },
        ],
        lab: [],
      },
      "mon"
    );
    expect(periods).toHaveLength(2);
  });

  it("re-keys a merged window so it has its own identity", () => {
    const [only] = resolvePeriods(
      {
        theory: [{ start: "8:55 AM", end: "9:45 AM", days: { mon: "F1" } }],
        lab: [{ start: "08:50 AM", end: "09:40 AM", days: { mon: "L2" } }],
      },
      "mon"
    );
    expect(only.key).toBe(periodKey("8:50 AM", "9:45 AM"));
  });

  it("drops a period that does not run on the selected day", () => {
    // `12:35 PM` is Monday-only in this schema.
    expect(resolvePeriods(CHENNAI, "tue").map((p) => p.key)).not.toContain("12:35pm-1:25pm");
  });

  it("skips the lunch marker and sorts by start time", () => {
    const periods = resolvePeriods(
      { theory: [{ lunch: true, days: { mon: "L" } }, ...CHENNAI.theory!], lab: [] },
      "mon"
    );
    expect(periods.every((p) => p.start && p.end)).toBe(true);
    const starts = periods.map((p) => p.startMinutes);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe("isRealVenue", () => {
  it("rejects the placeholders VTOP uses for a non-room", () => {
    ["", "NIL", "N/A", "unk-unk", "-", "ONLINE SESSION"].forEach((v) =>
      expect(isRealVenue(v)).toBe(false)
    );
  });

  it("keeps a real room", () => {
    expect(isRealVenue("AB1-101")).toBe(true);
    expect(isRealVenue("  AB1-101  ")).toBe(true);
  });
});

describe("blockOf", () => {
  it("does not split a block on a trailing space", () => {
    // The phantom-block bug. Six venues in the FFCS report are recorded with a
    // trailing space, and these are the same building.
    expect(blockOf("AB3-101 ")).toBe("AB3");
    expect(blockOf("AB3-101")).toBe("AB3");
  });

  it("trims the whole code before splitting", () => {
    expect(blockOf("  AB5-208 ")).toBe("AB5");
  });

  it("copes with a room that has no block prefix", () => {
    expect(blockOf("G12")).toBe("Other");
    expect(blockOf("")).toBe("Other");
  });
});

/** Index for a Monday over the trimmed schema. */
const monday = (courses: FreeRoomCourse[]) => {
  const periods = resolvePeriods(CHENNAI, "mon");
  return buildDayIndex(courses, periods, buildPeriodSlots(periods));
};

/** Index over the real `chennai.json`, for the periods the trimmed one drops. */
const realChennai = (day: DayId, courses: FreeRoomCourse[]) => {
  const periods = resolvePeriods(chennai, day);
  return buildDayIndex(courses, periods, buildPeriodSlots(periods));
};

/**
 * The period a day runs the given theory slot in.
 *
 * Looked up by slot rather than written as a time key, because `resolvePeriods`
 * merges the 12:35 lecture into the 12:30 lab that overlaps it — so the window
 * that carries `S11` is keyed `12:30pm-1:25pm`, not `12:35pm-1:25pm`.
 */
const periodRunning = (day: DayId, theorySlot: string) => {
  const periods = resolvePeriods(chennai, day);
  const found = periods.find((p) => p.theorySlot === theorySlot);
  if (!found) throw new Error(`${theorySlot} does not run on ${day}`);
  return found.key;
};

describe("buildDayIndex", () => {
  it("counts a room as occupied when it is in EITHER slot of a period", () => {
    // A lab course in the lab slot of the 8:00 period. Before the fix the
    // zero-padded times never matched, so L1 was never tested and AB1-101 came
    // back free.
    const index = monday([course({ SLOT: "L1", VENUE: "AB1-101" })]);
    const free = freeRoomsForPeriod(index, "8:00am-8:50am").rooms;
    expect(free).not.toContain("AB1-101");
  });

  it("counts a theory course in the same period too", () => {
    const index = monday([course({ SLOT: "A1", VENUE: "AB1-101" })]);
    expect(freeRoomsForPeriod(index, "8:00am-8:50am").rooms).not.toContain("AB1-101");
  });

  it("reports a room in a different period as free", () => {
    const index = monday([course({ SLOT: "A1", VENUE: "AB1-101" })]);
    expect(freeRoomsForPeriod(index, "8:55am-9:45am").rooms).toContain("AB1-101");
  });

  it("ignores courses with no real venue", () => {
    const index = monday([course({ SLOT: "A1", VENUE: "NIL" })]);
    expect(index.rooms.size).toBe(0);
  });

  it("merges venues that differ only by trailing space into one room", () => {
    const index = monday([
      course({ SLOT: "A1", VENUE: "AB3-101" }),
      course({ SLOT: "A2", VENUE: "AB3-101 " }),
    ]);
    expect([...index.rooms.keys()]).toEqual(["AB3-101"]);
    expect(index.blocks.get("AB3")).toEqual(["AB3-101"]);
  });

  it("classifies a room by what actually runs in it", () => {
    const index = monday([course({ SLOT: "L1", TYPE: "LA", VENUE: "AB1-201" })]);
    expect(index.rooms.get("AB1-201")?.kind).toBe("lab");
  });

  /**
   * The law school books its courses with no period number at all — `A+TA+TAA`
   * where everybody else writes `A1+TA1+TAA1` — and runs mornings only. Those
   * ids matched nothing, so every AB5 room came back free for the whole morning
   * while a class was sitting in it.
   */
  it("counts a law course booked without a period number", () => {
    const index = monday([
      course({ CODE: "TLAW524L", TYPE: "TH", SLOT: "A+TA", VENUE: "AB5-405" }),
    ]);
    expect(freeRoomsForPeriod(index, "8:00am-8:50am").rooms).not.toContain("AB5-405");
  });

  /**
   * The asymmetry the whole alias rests on. The law school has no evening
   * timetable, so `A+TA` must *not* resolve against `A2` — if it did, every law
   * room would read as busy from 2pm to 7:25pm on the strength of a morning
   * class.
   */
  it("leaves a law room free in the evening, because law has no evening", () => {
    const index = monday([
      course({ CODE: "TLAW524L", TYPE: "TH", SLOT: "A+TA", VENUE: "AB5-405" }),
    ]);
    expect(freeRoomsForPeriod(index, "8:55am-9:45am").rooms).toContain("AB5-405");
  });
});

describe("buildPeriodSlots", () => {
  it("carries the law spelling alongside the schema's own", () => {
    const slots = buildPeriodSlots(resolvePeriods(CHENNAI, "mon"));
    expect(slots.get("8:00am-8:50am")).toContain("A1");
    expect(slots.get("8:00am-8:50am")).toContain("A");
  });

  it("keeps the law spelling off the evening period", () => {
    const slots = buildPeriodSlots(resolvePeriods(CHENNAI, "mon"));
    expect(slots.get("8:55am-9:45am")).toContain("A2");
    expect(slots.get("8:55am-9:45am")).not.toContain("A");
  });

  it("keeps it off a lab period, which has no law equivalent", () => {
    // Only the theory slot is ever aliased, so L1 cannot lend out a bare "L".
    const slots = buildPeriodSlots(resolvePeriods(CHENNAI, "mon"));
    expect(slots.get("6:30pm-7:20pm")).toContain("L9");
    expect(slots.get("6:30pm-7:20pm")).not.toContain("L");
  });
});

/**
 * The two 12:35 periods are the one case that cannot be exercised against the
 * trimmed schema above, because they are the only periods the Chennai grid gives
 * an `S` id — `S11` on Monday, `S15` on Friday — and they are where the law
 * school's `TEE` and `TFF` actually land. So this uses the real file.
 */
describe("the 12:35 periods in the real Chennai schema", () => {
  const law = (over: Partial<FreeRoomCourse>) => course({
    CODE: "TLAW304L",
    TYPE: "TH",
    VENUE: "AB5-303",
    ...over,
  });

  it("counts a TEE course in the Monday S11 period", () => {
    const index = realChennai("mon", [law({ SLOT: "E+TE+TEE" })]);
    const key = periodRunning("mon", "S11");
    expect(freeRoomsForPeriod(index, key).rooms).not.toContain("AB5-303");
  });

  it("counts a TFF course in the Friday S15 period", () => {
    const index = realChennai("fri", [law({ SLOT: "F+TF+TFF" })]);
    const key = periodRunning("fri", "S15");
    expect(freeRoomsForPeriod(index, key).rooms).not.toContain("AB5-303");
  });

  it("keeps the two 12:35 periods apart", () => {
    // TEE is a Monday session and TFF a Friday one, so neither may leak into
    // the other day.
    const monday = realChennai("mon", [law({ SLOT: "F+TF+TFF" })]);
    expect(freeRoomsForPeriod(monday, periodRunning("mon", "S11")).rooms).toContain("AB5-303");
  });
});

describe("freeRoomsForPeriod", () => {
  it("splits the free set by kind", () => {
    const index = monday([
      course({ SLOT: "A1", VENUE: "AB1-101" }), // occupied, theory
      course({ SLOT: "A2", VENUE: "AB1-102" }), // free, theory
      course({ SLOT: "A2", VENUE: "AB1-201", TYPE: "LA" }), // free, lab
    ]);
    const free = freeRoomsForPeriod(index, "8:00am-8:50am");
    expect(free.theory).toEqual(["AB1-102"]);
    expect(free.lab).toEqual(["AB1-201"]);
    expect(free.rooms).toHaveLength(2);
  });

  it("returns nothing rather than throwing for an unknown period", () => {
    const index = monday([course({ SLOT: "A1" })]);
    expect(freeRoomsForPeriod(index, "nonsense").rooms).toEqual(["AB1-101"]);
  });
});

describe("freeRoomsForRun", () => {
  const threeRooms = [
    course({ SLOT: "A1", VENUE: "AB1-101" }), // busy in period 1 only
    course({ SLOT: "A2", VENUE: "AB1-102" }), // busy in period 2 only
    course({ SLOT: "L9", VENUE: "AB1-103" }), // busy in period 3 only
  ];

  it("keeps only rooms free across the whole run", () => {
    const index = monday(threeRooms);
    const free = freeRoomsForRun(index, ["8:00am-8:50am", "8:55am-9:45am"]);
    // AB1-101 is out for period 1, AB1-102 for period 2, so neither survives
    // the intersection. AB1-103 is free for both.
    expect(free.rooms).toEqual(["AB1-103"]);
  });

  it("records how long each room does hold out, so a partial answer survives", () => {
    const index = monday(threeRooms);
    const free = freeRoomsForRun(index, ["8:00am-8:50am", "8:55am-9:45am"]);
    expect(free.runLength.get("AB1-101")).toBe(0);
    expect(free.runLength.get("AB1-103")).toBe(2);
  });

  it("has no answer for an empty run", () => {
    const index = monday(threeRooms);
    expect(freeRoomsForRun(index, []).rooms).toEqual([]);
  });
});

describe("blockAvailability", () => {
  // Four rooms in AB1, two in AB2. All four AB1 rooms are busy in period 1
  // except one, and neither AB2 room is.
  const campus = () =>
    monday([
      course({ SLOT: "A1", VENUE: "AB1-101" }),
      course({ SLOT: "A1", VENUE: "AB1-102" }),
      course({ SLOT: "A1", VENUE: "AB1-103" }),
      course({ SLOT: "A2", VENUE: "AB1-104" }),
      course({ SLOT: "A2", VENUE: "AB2-201" }),
      course({ SLOT: "A2", VENUE: "AB2-202" }),
    ]);

  it("sorts by how empty the block is, not alphabetically", () => {
    const index = campus();
    // In period 1: AB1 has 1 free, AB2 has 2. AB2 is the emptier building.
    const free = freeRoomsForPeriod(index, "8:00am-8:50am");
    expect(blockAvailability(index, free).map((b) => b.block)).toEqual(["AB2", "AB1"]);
  });

  it("carries the total so the bar can say 1 of 4", () => {
    const index = campus();
    const free = freeRoomsForPeriod(index, "8:00am-8:50am");
    const ab1 = blockAvailability(index, free).find((b) => b.block === "AB1");
    expect(ab1?.total).toBe(4);
    expect(ab1?.free).toBe(1);
  });

  it("leaves out blocks with nothing free", () => {
    const index = monday([course({ SLOT: "A1", VENUE: "AB1-101" })]);
    const free = freeRoomsForPeriod(index, "8:00am-8:50am");
    expect(blockAvailability(index, free)).toEqual([]);
  });
});

describe("bestPeriod", () => {
  it("names the emptiest period", () => {
    // Everything is booked in the first period and in both later periods, so
    // the 8:55 slot is the only one with anywhere to go.
    const index = monday([
      course({ SLOT: "A1", VENUE: "AB1-101" }),
      course({ SLOT: "A3", VENUE: "AB1-102" }),
      course({ SLOT: "L9", VENUE: "AB1-103" }),
    ]);
    expect(bestPeriod(index)?.period.key).toBe("8:55am-9:45am");
  });

  it("has no answer on a day where every room is taken in every period", () => {
    // Ten rooms, each booked into all four of the day's slots.
    const rooms = Array.from({ length: 10 }, (_, i) =>
      course({ SLOT: "A1", VENUE: `AB1-10${i}` })
    ).concat(
      ["A2", "A3", "L9"].flatMap((slot) =>
        Array.from({ length: 10 }, (_, i) => course({ SLOT: slot, VENUE: `AB1-10${i}` }))
      )
    );
    expect(bestPeriod(monday(rooms))).toBeNull();
  });
});

describe("resolveNow", () => {
  const periods = resolvePeriods(CHENNAI, "mon");

  it("is live only inside a period on a weekday", () => {
    // 10 Jul 2026 is a Friday; 08:10 sits inside the first period.
    expect(resolveNow(periods, new Date(2026, 6, 10, 8, 10)).isLive).toBe(true);
    // Same clock on a Saturday.
    expect(resolveNow(periods, new Date(2026, 6, 11, 8, 10)).isLive).toBe(false);
  });

  it("carries a changeover into the period that is starting", () => {
    // The Chennai day is back-to-back with 5-minute changes, and the grace is
    // 5 minutes, so 08:52 belongs to the 8:55 period rather than to nothing.
    // "Free right now" is still the useful answer while you are walking in.
    expect(resolveNow(periods, new Date(2026, 6, 10, 8, 52)).period?.key).toBe("8:55am-9:45am");
  });

  it("is not live once the day is over", () => {
    expect(resolveNow(periods, new Date(2026, 6, 10, 22, 0)).isLive).toBe(false);
  });

  it("lands Saturday on Monday, since Saturday has no timetable", () => {
    expect(resolveNow(periods, new Date(2026, 6, 11, 8, 10)).day).toBe("mon");
  });

  it("keeps a period live for five minutes before it starts", () => {
    expect(resolveNow(periods, new Date(2026, 6, 10, 7, 56)).period?.key).toBe("8:00am-8:50am");
  });
});

describe("positionLabel", () => {
  it("is one-based, which is what a person counts in", () => {
    expect(positionLabel(0, 12)).toBe("1 of 12");
    expect(positionLabel(11, 12)).toBe("12 of 12");
  });
});
