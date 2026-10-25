import { describe, it, expect, vi } from "vitest";
import {
  generateModernTimetableHtml,
  downloadModernTimetableImage,
  generateModernPrintableHtml,
  generateModernDossierInnerHtml,
  downloadModernTimetablePdf,
  openModernPrintableDossier,
  openTimetablePrintablePage,
} from "../lib/exportTimetable";
import type { AddedCourse, TimetablePeriod, ParsedCourse } from "../components/custom/exams/FFCS/types";

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

  const mockMasterCourses: ParsedCourse[] = [
    {
      CODE: "BCSE202",
      TITLE: "Data Structures",
      FACULTY: "Dr. Ramesh",
      ERP_ID: "10090",
      ROOM: "AB1-201",
      SLOT: "A1+TA1",
      CREDITS: "3",
      TYPE: "TH",
    },
    {
      CODE: "BCSE202",
      TITLE: "Data Structures",
      FACULTY: "Dr. Suresh",
      ERP_ID: "10095",
      ROOM: "AB1-205",
      SLOT: "A1+TA1",
      CREDITS: "3",
      TYPE: "TH",
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

  it("generates comprehensive modern printable dossier with faculty scores and drop-in replacements", () => {
    const html = generateModernPrintableHtml({
      timetableName: "Semester 5 Timetable",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "horizontal",
      masterCourses: mockMasterCourses,
    });

    // Check header & executive summary
    expect(html).toContain("Semester 5 Timetable");
    expect(html).toContain("Official Registration Dossier");
    expect(html).toContain("Total Credits");

    // Check print toolbar & theme toggle
    expect(html).toContain("print-toolbar");
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain("toggleTheme");
    expect(html).toContain("Ink-Saver Light");

    // Check schedule grid & lunch column
    expect(html).toContain("LUNCH");

    // Check Enrolled Courses reference table
    expect(html).toContain("ENROLLED COURSES");
    expect(html).toContain("BCSE202");
    expect(html).toContain("Data Structures");

    // Check Faculty Intelligence & Sentiment Dossier
    expect(html).toContain("FACULTY INTELLIGENCE &amp; SENTIMENT REPORT");
    expect(html).toContain("Dr. Ramesh");
    expect(html).toContain("10090");

    // Check Drop-In Replacements with 0 clash risk
    expect(html).toContain("EMERGENCY DROP-IN SLOT REPLACEMENTS");
    expect(html).toContain("Dr. Suresh");
    expect(html).toContain("AB1-205");
    expect(html).toContain("0 Clash Risk");
  });

  it("opens printable window via openModernPrintableDossier and openTimetablePrintablePage", () => {
    const mockWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);

    const win1 = openModernPrintableDossier({
      timetableName: "Test TT",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
    });
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(mockWindow.document.write).toHaveBeenCalled();
    expect(win1).toBe(mockWindow);

    // Test openTimetablePrintablePage delegation
    const win2 = openTimetablePrintablePage({
      timetableName: "Delegated TT",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
    });
    expect(win2).toBe(mockWindow);

    openSpy.mockRestore();
  });

  it("generates Light Mode and Dark Mode dossier HTML with appropriate tokens", () => {
    const lightHtml = generateModernDossierInnerHtml(
      {
        timetableName: "Winter 2026 Light",
        courses: mockCourses,
        theoryPeriods: mockTheoryPeriods,
        labPeriods: mockLabPeriods,
        masterCourses: mockMasterCourses,
      },
      true
    );

    const darkHtml = generateModernDossierInnerHtml(
      {
        timetableName: "Winter 2026 Dark",
        courses: mockCourses,
        theoryPeriods: mockTheoryPeriods,
        labPeriods: mockLabPeriods,
        masterCourses: mockMasterCourses,
      },
      false
    );

    // Light Mode tokens
    expect(lightHtml).toContain("background: #ffffff");
    expect(lightHtml).toContain("color: #0f172a");
    expect(lightHtml).toContain("Winter 2026 Light");

    // Dark Mode tokens
    expect(darkHtml).toContain("color: #ffffff");
    expect(darkHtml).toContain("Winter 2026 Dark");
  });
});
