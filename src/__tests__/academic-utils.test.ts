import { describe, it, expect } from "vitest";
import {
  formatSemesterName,
  getGradePoint,
  getGradeColor,
  calculateGPA,
  calculateCGPA,
} from "../lib/academic-utils";

describe("academic-utils", () => {
  describe("formatSemesterName", () => {
    it("should format valid Fall semester ID", () => {
      expect(formatSemesterName("CH20252601")).toBe("Fall 2025-26");
    });

    it("should format valid Winter semester ID", () => {
      expect(formatSemesterName("CH20242505")).toBe("Winter 2024-25");
    });

    it("should format valid Summer semester ID", () => {
      expect(formatSemesterName("CH20232407")).toBe("Summer 2023-24");
    });

    it("should return unchanged if invalid or non-standard format", () => {
      expect(formatSemesterName("Fall 2025")).toBe("Fall 2025");
      expect(formatSemesterName("")).toBe("Unknown Semester");
    });
  });

  describe("getGradePoint", () => {
    it("should return correct grade points", () => {
      expect(getGradePoint("S")).toBe(10);
      expect(getGradePoint("A")).toBe(9);
      expect(getGradePoint("B")).toBe(8);
      expect(getGradePoint("C")).toBe(7);
      expect(getGradePoint("D")).toBe(6);
      expect(getGradePoint("E")).toBe(5);
      expect(getGradePoint("F")).toBe(0);
      expect(getGradePoint("N")).toBe(0);
    });
  });

  describe("calculateGPA and calculateCGPA", () => {
    it("should calculate weighted GPA accurately", () => {
      const courses = [
        { credits: 4, grade: "S" }, // 40
        { credits: 3, grade: "A" }, // 27
        { credits: 3, grade: "B" }, // 24
      ];
      // (40 + 27 + 24) / 10 = 91 / 10 = 9.1
      expect(calculateGPA(courses)).toBe(9.1);
    });

    it("should calculate cumulative CGPA accurately", () => {
      const sems = [
        { gpa: 9.0, credits: 20 },
        { gpa: 8.5, credits: 20 },
      ];
      // (180 + 170) / 40 = 350 / 40 = 8.75
      expect(calculateCGPA(sems)).toBe(8.75);
    });
  });
});
