import { describe, expect, it } from "vitest";
import { buildAttendanceDayCardsMap, getTodayAttendanceClasses } from "../lib/attendanceTimetable";

const slotMap = {
  MON: {
    A1: { time: "8:00-8:50" },
    F1: { time: "8:55-9:45" },
    L1: { time: "10:00-10:50" },
    L2: { time: "10:50-11:40" },
    L3: { time: "11:40-12:30" },
  },
  TUE: {},
  WED: {},
  THU: {},
  FRI: {},
  SAT: {},
  SUN: {},
};

const attendance = [
  {
    courseCode: "CSE1001",
    courseTitle: "Algorithms",
    courseType: "Theory",
    slotName: "A1",
    faculty: "Prof A",
    attendancePercentage: "88",
  },
  {
    courseCode: "MAT1001",
    courseTitle: "Calculus",
    courseType: "Theory",
    slotName: "F1",
    faculty: "Prof B",
    attendancePercentage: "78",
  },
  {
    courseCode: "CSE1002",
    courseTitle: "Systems Lab",
    courseType: "Lab",
    slotName: "L1+L2+L3",
    faculty: "Prof C",
    attendancePercentage: "91",
  },
];

describe("attendance timetable helpers", () => {
  it("keeps all classes for a day and merges adjacent slots for the same course", () => {
    const map = buildAttendanceDayCardsMap(attendance, slotMap);

    expect(map.MON).toHaveLength(3);
    expect(map.MON.map((course) => course.courseTitle)).toEqual([
      "Algorithms",
      "Calculus",
      "Systems Lab",
    ]);
    expect(map.MON[2].slotName).toBe("L1+L2+L3");
    expect(map.MON[2].time).toBe("10:00-12:30");
  });

  it("returns every class scheduled for the supplied date", () => {
    const monday = new Date("2026-06-29T08:00:00");
    const today = getTodayAttendanceClasses(attendance, monday, slotMap);

    expect(today.map((course) => course.courseCode)).toEqual(["CSE1001", "MAT1001", "CSE1002"]);
  });
});
