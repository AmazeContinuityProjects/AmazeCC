import { describe, it, expect } from "vitest";
import { formatClock, formatMinutes24, parseTimeToMinutes, formatRelativeTime } from "../lib/timeUtils";
import { isLabCourse, sanitizeCourseCode, sanitizeCourseTitle } from "../lib/courseClassifier";
import { calculateAttendanceMargin } from "../lib/attendanceCalculators";
import { getInitials } from "../lib/textUtils";

describe("Canonical timeUtils", () => {
  it("formats minutes into 12-hour clock", () => {
    expect(formatClock(480)).toBe("8:00 AM");
    expect(formatClock(720)).toBe("12:00 PM");
    expect(formatClock(750)).toBe("12:30 PM");
    expect(formatClock(1165)).toBe("7:25 PM");
    expect(formatClock(null)).toBe("Time TBA");
    expect(formatClock(undefined, "TBD")).toBe("TBD");
  });

  it("formats minutes into 24-hour clock", () => {
    expect(formatMinutes24(480)).toBe("08:00");
    expect(formatMinutes24(1165)).toBe("19:25");
    expect(formatMinutes24(null)).toBe("00:00");
  });

  it("parses diverse time formats into minutes", () => {
    expect(parseTimeToMinutes("8:00 AM")).toBe(480);
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(parseTimeToMinutes("12:30 PM")).toBe(750);
    expect(parseTimeToMinutes("19:25")).toBe(1165);
    expect(parseTimeToMinutes(500)).toBe(500);
    expect(parseTimeToMinutes("")).toBeNull();
  });

  it("formats relative time cleanly", () => {
    const now = 1700000000000;
    expect(formatRelativeTime(now - 30 * 1000, now)).toBe("just now");
    expect(formatRelativeTime(now - 120 * 1000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 7200 * 1000, now)).toBe("2h ago");
    expect(formatRelativeTime(now - 86400 * 1000, now)).toBe("yesterday");
    expect(formatRelativeTime(null)).toBe("never");
  });
});

describe("Canonical courseClassifier", () => {
  it("detects lab courses correctly", () => {
    expect(isLabCourse({ componentType: "lab" })).toBe(true);
    expect(isLabCourse({ courseType: "Embedded Lab" })).toBe(true);
    expect(isLabCourse({ slotName: "L1+L2" })).toBe(true);
    expect(isLabCourse({ slot: "L31+L32" })).toBe(true);
    expect(isLabCourse({ slot: "LT1" })).toBe(false); // Theory slot
    expect(isLabCourse({ courseType: "Theory Only", slot: "A1" })).toBe(false);
  });

  it("sanitizes course codes and titles", () => {
    expect(sanitizeCourseCode(" cse 1001 ")).toBe("CSE1001");
    expect(sanitizeCourseTitle("Problem Solving &amp; Programming")).toBe("Problem Solving & Programming");
  });
});

describe("Canonical attendanceCalculators", () => {
  it("calculates safe bunks for high attendance", () => {
    // 30 attended out of 32 conducted, threshold 75%
    // 75% of 32 = 24. Attended = 30. (30 - 0.75*32)/0.75 = 8 bunks
    const margin = calculateAttendanceMargin(30, 32, 75, false);
    expect(margin.isSafe).toBe(true);
    expect(margin.canMiss).toBe(8);
    expect(margin.classesNeeded).toBe(0);
  });

  it("calculates recovery classes for low attendance", () => {
    // 20 attended out of 30 conducted = 66.7%, threshold 75%
    const margin = calculateAttendanceMargin(20, 30, 75, false);
    expect(margin.isSafe).toBe(false);
    expect(margin.classesNeeded).toBeGreaterThan(0);
    expect(margin.canMiss).toBe(0);
  });
});

describe("Canonical textUtils", () => {
  it("extracts initials correctly", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Dr. Alan Turing")).toBe("AT");
    expect(getInitials("Prof. Grace Brewster Murray Hopper")).toBe("GH");
    expect(getInitials("Alice")).toBe("AL");
    expect(getInitials(null)).toBe("?");
  });
});
