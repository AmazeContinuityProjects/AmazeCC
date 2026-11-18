import { describe, it, expect, beforeEach } from "vitest";
import { normalizeCourse, normalizeFaculty, normalizeSlots, normalizeCourseList } from "@/lib/courseNormalizer";
import { getTypedStorageItem, setTypedStorageItem, removeTypedStorageItem, hasTypedStorageItem } from "@/lib/storage";
import { installLocalStorage } from "./helpers/localStorage";

const storageStub = installLocalStorage();

describe("Unified Course & Faculty Normalizer", () => {
  describe("normalizeFaculty", () => {
    it("parses faculty with hyphenated employee ID and school", () => {
      const result = normalizeFaculty("12345 - DR. JOHN DOE - SCOPE");
      expect(result.employeeId).toBe("12345");
      expect(result.title).toBe("DR.");
      expect(result.name).toBe("JOHN DOE");
      expect(result.school).toBe("SCOPE");
      expect(result.initials).toBe("JD");
    });

    it("parses faculty with unhyphenated employee ID and hyphenated school", () => {
      const result = normalizeFaculty("50772 NATHIYA N - SAS");
      expect(result.employeeId).toBe("50772");
      expect(result.name).toBe("NATHIYA N");
      expect(result.school).toBe("SAS");
      expect(result.initials).toBe("NN");
    });

    it("parses faculty with space-delimited employee ID and school", () => {
      const result = normalizeFaculty("50772 NATHIYA N SAS");
      expect(result.employeeId).toBe("50772");
      expect(result.name).toBe("NATHIYA N");
      expect(result.school).toBe("SAS");
    });

    it("handles empty or null faculty gracefully", () => {
      const result = normalizeFaculty(null);
      expect(result.name).toBe("");
      expect(result.employeeId).toBeNull();
      expect(result.school).toBeNull();
      expect(result.initials).toBe("");
    });
  });

  describe("normalizeSlots", () => {
    it("splits plus-delimited slot string", () => {
      expect(normalizeSlots("L31+L32+L37+L38")).toEqual(["L31", "L32", "L37", "L38"]);
    });

    it("handles array of slots", () => {
      expect(normalizeSlots(["A1", "TA1"])).toEqual(["A1", "TA1"]);
    });

    it("handles empty or null input", () => {
      expect(normalizeSlots(null)).toEqual([]);
    });
  });

  describe("normalizeCourse", () => {
    it("normalizes an attendance course payload from user localStorage dump", () => {
      const rawAttendanceItem = {
        slNo: "1",
        courseCode: "BACSE102(L)",
        courseTitle: "Problem Solving Using Java",
        courseType: "Lab Only",
        slotName: "L31+L32+L37+L38",
        faculty: "50772 NATHIYA N - SAS",
        registrationDate: "01-Aug-2026",
        attendanceDate: "17-Nov-2026",
        attendedClasses: 36,
        totalClasses: 40,
        attendancePercentage: "90.00%",
        viewLink: [{ date: "04-Aug-2026", status: "Present" }],
        classId: "CH2026270100046",
        credits: "2",
        slotVenue: "AB1-402",
        category: "Programme Core",
      };

      const course = normalizeCourse(rawAttendanceItem);

      expect(course.id).toBe("CH2026270100046");
      expect(course.code).toBe("BACSE102(L)");
      expect(course.baseCode).toBe("BACSE102");
      expect(course.title).toBe("Problem Solving Using Java");
      expect(course.componentType).toBe("Lab Only");
      expect(course.isLab).toBe(true);
      expect(course.isTheory).toBe(false);
      expect(course.credits).toBe(2);
      expect(course.slots).toEqual(["L31", "L32", "L37", "L38"]);
      expect(course.slotDisplay).toBe("L31+L32+L37+L38");
      expect(course.venue).toBe("AB1-402");
      expect(course.category).toBe("Programme Core");

      // Faculty
      expect(course.faculty.employeeId).toBe("50772");
      expect(course.faculty.name).toBe("NATHIYA N");
      expect(course.faculty.school).toBe("SAS");

      // Attendance details
      expect(course.attendance?.attendedClasses).toBe(36);
      expect(course.attendance?.totalClasses).toBe(40);
      expect(course.attendance?.attendancePercentage).toBe(90);
      expect(course.attendance?.history).toHaveLength(1);
    });

    it("normalizes an FFCS catalog course payload", () => {
      const rawFFCSCourse = {
        CODE: "BCSE101E",
        TITLE: "DATA STRUCTURES AND ALGORITHMS",
        TYPE: "Embedded Theory",
        CREDITS: "4",
        ROOM: "SJT-311",
        SLOT: "A1+TA1",
        FACULTY: "12345 - DR. JOHN DOE - SCOPE",
        CLASS_ID: "CH2026270102069",
      };

      const course = normalizeCourse(rawFFCSCourse);

      expect(course.id).toBe("CH2026270102069");
      expect(course.baseCode).toBe("BCSE101E");
      expect(course.title).toBe("DATA STRUCTURES AND ALGORITHMS");
      expect(course.componentType).toBe("Embedded Theory");
      expect(course.isTheory).toBe(true);
      expect(course.isLab).toBe(false);
      expect(course.credits).toBe(4);
      expect(course.slots).toEqual(["A1", "TA1"]);
      expect(course.venue).toBe("SJT-311");
      expect(course.faculty.employeeId).toBe("12345");
      expect(course.faculty.title).toBe("DR.");
      expect(course.faculty.name).toBe("JOHN DOE");
      expect(course.faculty.school).toBe("SCOPE");
    });

    it("normalizes marks course item", () => {
      const rawMarksCourse = {
        slNo: "1",
        classNbr: "CH2026270100046",
        courseCode: "BACSE102",
        courseTitle: "Problem Solving Using Java",
        courseType: "Lab Only",
        courseSystem: "CAL",
        credits: 2,
        faculty: "50772 NATHIYA N",
        slot: "L31+L32",
        courseMode: "Regular",
        assessments: [
          {
            slNo: "1",
            title: "Lab Assessment 1",
            maxMark: "50",
            weightagePercent: "25",
            status: "Scored",
            scoredMark: "45.0",
            weightageMark: "22.5",
          },
        ],
      };

      const course = normalizeCourse(rawMarksCourse);

      expect(course.baseCode).toBe("BACSE102");
      expect(course.marks?.assessments).toHaveLength(1);
      expect(course.marks?.assessments[0].scoredMark).toBe(45);
      expect(course.marks?.assessments[0].maxMark).toBe(50);
      expect(course.marks?.assessments[0].weightagePercent).toBe(25);
    });

    it("normalizes a list of courses", () => {
      const list = normalizeCourseList([
        { code: "MAT1001", title: "Calculus", type: "Theory Only", slot: "B1" },
        { code: "PHY1001", title: "Physics", type: "Lab Only", slot: "L1" },
      ]);
      expect(list).toHaveLength(2);
      expect(list[0].baseCode).toBe("MAT1001");
      expect(list[1].baseCode).toBe("PHY1001");
    });
  });
});

describe("Type-safe Storage Layer", () => {
  beforeEach(() => {
    storageStub.clear();
  });

  it("stores and retrieves raw strings correctly without extra JSON quotes", () => {
    setTypedStorageItem("theme", "dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(getTypedStorageItem("theme")).toBe("dark");

    setTypedStorageItem("IDs", "25BLC1081");
    expect(window.localStorage.getItem("IDs")).toBe("25BLC1081");
    expect(getTypedStorageItem("IDs")).toBe("25BLC1081");
  });

  it("stores and retrieves JSON serialized complex payloads correctly", () => {
    const tripPayload = [
      {
        trip_id: 1794800365116,
        reg_number: "25BLC1081",
        from_hub_id: 2,
        hub_id: 1,
        travel_date: "2026-11-16",
        preferred_time: "10:10",
        tolerance_hours: 1,
        seat_options: { requested: 2 },
        gender_preference: "mixed",
        notes: "Test",
        hub_name: "VIT Chennai",
        from_hub_name: "Chennai Airport",
        name: "SUGEETH JAYARAJ S A",
        owner_name: "SUGEETH JAYARAJ S A",
        owner_phone: "8122654796",
        status: "active" as const,
        requests: [],
        local_only: true,
      },
    ];

    setTypedStorageItem("cabshare_local_trips", tripPayload);
    const retrieved = getTypedStorageItem("cabshare_local_trips");

    expect(retrieved).not.toBeNull();
    expect(retrieved).toHaveLength(1);
    expect(retrieved![0].reg_number).toBe("25BLC1081");
    expect(retrieved![0].hub_name).toBe("VIT Chennai");
  });

  it("handles removeTypedStorageItem and hasTypedStorageItem", () => {
    expect(hasTypedStorageItem("ph_debug")).toBe(false);
    setTypedStorageItem("ph_debug", "true");
    expect(hasTypedStorageItem("ph_debug")).toBe(true);
    removeTypedStorageItem("ph_debug");
    expect(hasTypedStorageItem("ph_debug")).toBe(false);
  });

  it("returns fallback value when item does not exist", () => {
    const fallback = { semester: "CH20262701", attendance: [] };
    const result = getTypedStorageItem("attendance", fallback);
    expect(result).toBe(fallback);
  });
});
