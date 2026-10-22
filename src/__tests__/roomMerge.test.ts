import { describe, expect, it } from "vitest";
import {
  buildDayIndex,
  buildPeriodSlots,
  resolvePeriods,
  type CampusSchema,
  type FreeRoomCourse,
} from "../lib/freeClassrooms";
import { mergeDay } from "../lib/roomMerge";
import type { LiveDay, LiveOccupant, LivePeriod } from "../lib/roomAvailability";

/**
 * Merging the report with the server's answer.
 *
 * The rule under test is the one that matters: **a room is free only when both
 * sources say it is free.** The report is stale in the direction that hides
 * free rooms and the server is incomplete in the direction that invents them,
 * so the union of their occupancy sets is the only answer that is never
 * confidently wrong in either direction.
 */

const SCHEMA: CampusSchema = {
  theory: [
    { start: "8:00 AM", end: "8:50 AM", days: { mon: "A1" } },
    { start: "8:55 AM", end: "9:45 AM", days: { mon: "F1" } },
  ],
  lab: [],
};

const course = (over: Partial<FreeRoomCourse>): FreeRoomCourse => ({
  CODE: "BCSE101",
  TITLE: "Programming",
  TYPE: "",
  SLOT: "A1",
  FACULTY: "Report Faculty",
  VENUE: "AB1-101",
  ...over,
});

/**
 * The report's view.
 *
 * Three rooms, so the merge has something to disagree about:
 *
 * - AB1-101 is booked in the first period.
 * - AB1-102 is booked in the second period.
 * - AB1-103 is booked in a slot that runs in neither period, so it is free in
 *   both.
 */
const REPORT: FreeRoomCourse[] = [
  course({ CODE: "BCSE101", VENUE: "AB1-101", SLOT: "A1" }),
  course({
    CODE: "BCSE102",
    TITLE: "Networks",
    VENUE: "AB1-102",
    SLOT: "F1",
    FACULTY: "Report Faculty Two",
  }),
  course({
    CODE: "BCSE103",
    TITLE: "Databases",
    VENUE: "AB1-103",
    SLOT: "L9",
    FACULTY: "Report Faculty Three",
  }),
];

const periods = resolvePeriods(SCHEMA, "mon");
const periodKeys = periods.map((p) => p.key);
const slots = buildPeriodSlots(periods);
const index = buildDayIndex(REPORT, periods, slots);

const occupant = (code: string, over: Partial<LiveOccupant> = {}): LiveOccupant => ({
  code,
  classId: "C1",
  courseCode: "BCSE101",
  title: "Programming",
  faculty: "Live Faculty",
  component: "theory",
  slots: ["A1"],
  ...over,
});

const livePeriod = (over: Partial<LivePeriod> = {}): LivePeriod => ({
  key: periodKeys[0],
  slots: ["A1"],
  free: [],
  theory: [],
  lab: [],
  occupied: [],
  blocks: [],
  ...over,
});

const liveDay = (over: Partial<LiveDay> = {}): LiveDay => ({
  semesterId: "SEM",
  day: "MON",
  rooms: [
    { code: "AB1-101", block: "AB1", kind: "theory" },
    { code: "AB1-102", block: "AB1", kind: "theory" },
    { code: "AB3-205", block: "AB3", kind: "lab" },
  ],
  periods: [livePeriod(), livePeriod({ key: periodKeys[1], slots: ["F1"] })],
  runs: [],
  ...over,
});

describe("mergeDay", () => {
  it("answers from the report alone when the server has nothing", () => {
    const merged = mergeDay({ index, periodKeys, live: null, runLength: 2 });
    const period = merged.periods.get(periodKeys[0])!;

    // The report has a class in AB1-101 in the first period.
    expect(period.free.rooms).toEqual(["AB1-102", "AB1-103"]);
  });

  it("keeps a room the report says is taken, even when the server says it is free", () => {
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        periods: [
          livePeriod({ free: ["AB1-101", "AB1-102"] }),
          livePeriod({ key: periodKeys[1], slots: ["F1"] }),
        ],
      }),
      runLength: 2,
    });

    const period = merged.periods.get(periodKeys[0])!;
    expect(period.free.rooms).not.toContain("AB1-101");
  });

  it("takes a room the server says is taken, even when the report does not", () => {
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        periods: [
          livePeriod({
            occupied: [occupant("AB3-205")],
            free: ["AB1-102"],
          }),
          livePeriod({ key: periodKeys[1], slots: ["F1"] }),
        ],
      }),
      runLength: 2,
    });

    const period = merged.periods.get(periodKeys[0])!;
    expect(period.free.rooms).not.toContain("AB3-205");
  });

  it("offers a room neither source has anything in", () => {
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        periods: [
          livePeriod({
            occupied: [occupant("AB3-205")],
            free: ["AB1-102"],
          }),
          livePeriod({ key: periodKeys[1], slots: ["F1"] }),
        ],
      }),
      runLength: 2,
    });

    const period = merged.periods.get(periodKeys[0])!;
    expect(period.free.rooms).toContain("AB1-102");
  });

  it("prefers the server's occupant for a room both sources have booked", () => {
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        periods: [
          livePeriod({ occupied: [occupant("AB1-101")] }),
          livePeriod({ key: periodKeys[1], slots: ["F1"] }),
        ],
      }),
      runLength: 2,
    });

    const occupants = merged.periods.get(periodKeys[0])!.occupants.get("AB1-101")!;
    expect(occupants[0].faculty).toBe("Live Faculty");
    expect(occupants[0].source).toBe("live");
  });

  it("falls back to the report's row for a room only the report has booked", () => {
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        periods: [
          livePeriod({ occupied: [occupant("AB3-205")] }),
          livePeriod({ key: periodKeys[1], slots: ["F1"] }),
        ],
      }),
      runLength: 2,
    });

    const occupants = merged.periods.get(periodKeys[0])!.occupants.get("AB1-101")!;
    expect(occupants[0].faculty).toBe("Report Faculty");
    expect(occupants[0].source).toBe("report");
  });

  it("holds a run to the shorter of the two sources", () => {
    // The report says AB1-102 is taken in the second period of the run, so it
    // holds out for one period; the server says it is free for both. The
    // merged answer is the shorter of the two.
    const merged = mergeDay({
      index,
      periodKeys,
      live: liveDay({
        rooms: [
          { code: "AB1-101", block: "AB1", kind: "theory" },
          { code: "AB1-102", block: "AB1", kind: "theory" },
          { code: "AB1-103", block: "AB1", kind: "lab" },
        ],
        periods: [
          livePeriod({ free: ["AB1-101", "AB1-102", "AB1-103"] }),
          livePeriod({
            key: periodKeys[1],
            slots: ["F1"],
            occupied: [occupant("AB1-101", { slots: ["F1"] })],
          }),
        ],
        runs: [
          {
            startKey: periodKeys[0],
            length: 2,
            rooms: ["AB1-101", "AB1-102", "AB1-103"],
            runLength: { "AB1-101": 2, "AB1-102": 2, "AB1-103": 2 },
          },
        ],
      }),
      runLength: 2,
    });

    const run = merged.runs.get(periodKeys[0])!;
    // Taken in the first period of the run by the report.
    expect(run.runLength.get("AB1-101")).toBe(0);
    // Taken in the second period of the run by the report.
    expect(run.runLength.get("AB1-102")).toBe(1);
    // Free in both, by both.
    expect(run.runLength.get("AB1-103")).toBe(2);
    expect(run.rooms).toEqual(["AB1-103"]);
  });

  it("counts the free rooms per block", () => {
    const merged = mergeDay({ index, periodKeys, live: null, runLength: 2 });
    const blocks = merged.periods.get(periodKeys[0])!.blocks;
    expect(blocks[0]).toMatchObject({ block: "AB1", total: 3, free: 2 });
  });
});
