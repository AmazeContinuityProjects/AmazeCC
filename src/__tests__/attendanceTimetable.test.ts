import { describe, expect, it } from "vitest";
import {
  buildAttendanceDayCardsMap,
  getTodayAttendanceClasses,
  isTeachingDay,
  resolveTeachingDay,
} from "../lib/attendanceTimetable";

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

describe("resolveTeachingDay", () => {
  // A reschedule names the weekday whose timetable runs, which is very often not
  // the weekday the date falls on — the point of publishing one is to recover a
  // day lost to a holiday, and the spare day is a Saturday.
  const saturday = new Date(2026, 7, 8); // 8 Aug 2026
  const thursday = new Date(2026, 7, 13); // 13 Aug 2026

  it("follows the published day order over the date's own weekday", () => {
    expect(resolveTeachingDay(saturday, "THU")).toBe("THU");
  });

  it("falls back to the weekday when nothing was published", () => {
    expect(resolveTeachingDay(saturday)).toBe("SAT");
    expect(resolveTeachingDay(thursday)).toBe("THU");
  });

  it("ignores a day order that is not one of the seven", () => {
    // A typo or an unexpected value must not send the lookup off to nowhere and
    // render the day as having no classes.
    expect(resolveTeachingDay(saturday, "FUNDAY" as any)).toBe("SAT");
    expect(resolveTeachingDay(saturday, undefined)).toBe("SAT");
  });

  it("applies the day order to a date that is not a weekend at all", () => {
    // Mid-week reschedules happen too; the rule is about the order, not the date.
    expect(resolveTeachingDay(new Date(2026, 7, 12), "MON")).toBe("MON");
  });
});

describe("isTeachingDay", () => {
  it("accepts the seven day keys", () => {
    for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
      expect(isTeachingDay(day)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const bad of ["Monday", "mon", "", null, undefined, 3]) {
      expect(isTeachingDay(bad)).toBe(false);
    }
  });
});
