import { describe, it, expect } from "vitest";
import {
  calculateAttendancePercentage,
  formatAttendanceDisplay,
  calculateClassesToAttend,
  calculateBunkMargin,
  getAttendanceStatus,
} from "../lib/attendance-utils";

describe("attendance-utils", () => {
  describe("calculateAttendancePercentage and formatAttendanceDisplay", () => {
    it("should calculate percentage accurately without decimals", () => {
      expect(calculateAttendancePercentage(38, 40)).toBe(95);
      expect(calculateAttendancePercentage(27, 36)).toBe(75);
    });

    it("should calculate percentage with decimals", () => {
      expect(calculateAttendancePercentage(35, 40, true)).toBe(87.5);
    });

    it("should format string display correctly", () => {
      expect(formatAttendanceDisplay(38, 40, "str")).toBe("38/40");
      expect(formatAttendanceDisplay(38, 40, "percentage")).toBe("95%");
    });
  });

  describe("calculateClassesToAttend", () => {
    it("should return 0 if already at or above target", () => {
      expect(calculateClassesToAttend(30, 40, 75)).toBe(0);
      expect(calculateClassesToAttend(32, 40, 75)).toBe(0);
    });

    it("should calculate required classes to reach 75%", () => {
      // 20/30 = 66.67%. Target 75%: (20+x)/(30+x) = 0.75 -> 20+x = 22.5 + 0.75x -> 0.25x = 2.5 -> x = 10
      expect(calculateClassesToAttend(20, 30, 75)).toBe(10);
    });
  });

  describe("calculateBunkMargin", () => {
    it("should calculate safely bunkable classes while staying above 75%", () => {
      // 36/40 = 90%. Min 75%: 36 / (40 + y) = 0.75 -> 40 + y = 48 -> y = 8
      expect(calculateBunkMargin(36, 40, 75)).toBe(8);
    });

    it("should return 0 if already below minimum", () => {
      expect(calculateBunkMargin(20, 30, 75)).toBe(0);
    });
  });

  describe("getAttendanceStatus", () => {
    it("should classify attendance correctly", () => {
      expect(getAttendanceStatus(70, false)).toBe("critical");
      expect(getAttendanceStatus(80, false)).toBe("warning");
      expect(getAttendanceStatus(90, false)).toBe("safe");
    });

    it("should respect dayscholar bus thresholds (85% min, 90% warn)", () => {
      expect(getAttendanceStatus(80, true)).toBe("critical");
      expect(getAttendanceStatus(86, true)).toBe("warning");
      expect(getAttendanceStatus(92, true)).toBe("safe");
    });
  });
});
