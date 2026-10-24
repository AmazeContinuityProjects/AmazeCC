import { describe, it, expect, vi } from "vitest";
import { generateModernTimetableHtml, downloadModernTimetableImage } from "../lib/exportTimetable";
import type { AddedCourse, TimetablePeriod } from "../components/custom/exams/FFCS/types";

describe("Modern Timetable Export", () => {
  const mockCourses: AddedCourse[] = [
    {
      id: "course-1",
      code: "BCSE202",
      title: "Data Structures",
      faculty: "Dr. Ramesh",
      employeeId: "10090",
      venue: "AB1-201",
      slots: ["A1", "TA1"],
      credits: "3",
      type: "TH",
      color: "bg-blue-600",
    },
    {
      id: "course-2",
      code: "BCSE202L",
      title: "Data Structures Lab",
      faculty: "Dr. Ramesh",
      employeeId: "10090",
      venue: "SJT-LAB1",
      slots: ["L31", "L32"],
      credits: "1",
      type: "LO",
      color: "bg-purple-600",
    },
  ];

  const mockTheoryPeriods: TimetablePeriod[] = [
    {
      slot: "P1",
      start: "8:00 AM",
      end: "8:50 AM",
      days: { mon: "A1", wed: "A1" },
    },
    {
      slot: "P2",
      start: "8:55 AM",
      end: "9:45 AM",
      days: { fri: "TA1" },
    },
    {
      lunch: true,
      slot: "LUNCH",
      start: "1:20 PM",
      end: "2:00 PM",
      days: {},
    },
  ];

  const mockLabPeriods: TimetablePeriod[] = [
    {
      slot: "L1",
      start: "8:00 AM",
      end: "8:50 AM",
      days: { mon: "L1" },
    },
    {
      slot: "L2",
      start: "8:50 AM",
      end: "9:40 AM",
      days: { mon: "L2" },
    },
    {
      lunch: true,
      slot: "LUNCH",
      start: "1:20 PM",
      end: "2:00 PM",
      days: {},
    },
  ];

  it("generates modern HTML for vertical view with review showcase", () => {
    const html = generateModernTimetableHtml({
      timetableName: "Draft Timetable",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "vertical",
    });

    expect(html).toContain("Draft Timetable");
    expect(html).toContain("BCSE202");
    expect(html).toContain("Vertical Heatmap");
    expect(html).toContain("Vitfac");
    expect(html).toContain("Dr. Ramesh");
    expect(html).toContain("TIME");
    expect(html).toContain("MON");
  });

  it("generates modern HTML for horizontal grid view", () => {
    const html = generateModernTimetableHtml({
      timetableName: "Final Grid",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "horizontal",
    });

    expect(html).toContain("Final Grid");
    expect(html).toContain("Horizontal University Grid");
    expect(html).toContain("BCSE202");
    expect(html).toContain("DAY");
    expect(html).toContain("LUNCH");
  });
});
