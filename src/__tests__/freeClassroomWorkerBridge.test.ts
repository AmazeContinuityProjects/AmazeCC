import { describe, expect, it } from "vitest";
import { buildWeekIndex, type CampusSchema, type FreeRoomCourse } from "@/lib/freeClassrooms";
import { buildWeekIndexAsync } from "@/lib/freeClassroomWorkerBridge";

const testSchema: CampusSchema = {
  theory: [
    { start: "08:00 AM", end: "08:50 AM", days: { mon: "A1", tue: "B1", wed: "C1", thu: "D1", fri: "E1" } },
    { start: "08:50 AM", end: "09:40 AM", days: { mon: "F1", tue: "G1", wed: "A1", thu: "B1", fri: "C1" } },
  ],
  lab: [{ start: "08:00 AM", end: "08:50 AM", days: { mon: "L1", tue: "L7", wed: "L13", thu: "L19", fri: "L25" } }],
};

const sampleCourses: FreeRoomCourse[] = [
  {
    CODE: "CSE1001",
    TITLE: "Problem Solving",
    SLOT: "A1+TA1",
    VENUE: "AB1-101",
    FACULTY: "Dr Smith",
  },
  {
    CODE: "CSE1002",
    TITLE: "Data Structures",
    SLOT: "L1+L2",
    VENUE: "AB1-LAB1",
    FACULTY: "Dr Jones",
  },
  {
    CODE: "TLAW101",
    TITLE: "Legal Studies",
    SLOT: "A+TA",
    VENUE: "AB5-201",
    FACULTY: "Prof Law",
  },
];

describe("freeClassroomWorkerBridge", () => {
  it("buildWeekIndex indexes all 5 weekdays accurately", () => {
    const week = buildWeekIndex(sampleCourses, testSchema);

    expect(week.size).toBe(5);
    expect(Array.from(week.keys())).toEqual(["mon", "tue", "wed", "thu", "fri"]);

    const mon = week.get("mon");
    expect(mon).toBeDefined();
    expect(mon?.index.rooms.has("AB1-101")).toBe(true);
    expect(mon?.index.rooms.get("AB1-101")?.kind).toBe("theory");
    expect(mon?.index.rooms.get("AB1-LAB1")?.kind).toBe("lab");

    // Check AB1-101 occupancy on Monday
    const p1 = mon?.periods[0].key;
    expect(p1).toBeDefined();
    expect(mon?.index.occupancy.get("AB1-101")?.has(p1!)).toBe(true);
  });

  it("buildWeekIndexAsync falls back to synchronous inline execution when Worker is unavailable", async () => {
    const weekSync = buildWeekIndex(sampleCourses, testSchema);
    const weekAsync = await buildWeekIndexAsync(sampleCourses, testSchema);

    expect(weekAsync.size).toBe(weekSync.size);
    for (const day of ["mon", "tue", "wed", "thu", "fri"] as const) {
      const syncDay = weekSync.get(day);
      const asyncDay = weekAsync.get(day);
      expect(asyncDay?.periods.length).toBe(syncDay?.periods.length);
      expect(asyncDay?.index.rooms.size).toBe(syncDay?.index.rooms.size);
      expect(asyncDay?.index.occupancy.size).toBe(syncDay?.index.occupancy.size);
    }
  });

  it("handles empty course list cleanly", async () => {
    const week = await buildWeekIndexAsync([], testSchema);
    expect(week.size).toBe(5);
    const mon = week.get("mon");
    expect(mon?.index.rooms.size).toBe(0);
  });
});
