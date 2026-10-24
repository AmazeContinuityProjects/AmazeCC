import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FFCSDossierSubpage from "../components/custom/exams/FFCS/components/FFCSDossierSubpage";
import type { AddedCourse, TimetablePeriod, ParsedCourse, TimetableState } from "../components/custom/exams/FFCS/types";

vi.mock("@/lib/exportTimetable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exportTimetable")>();
  return {
    ...actual,
    downloadModernTimetablePdf: vi.fn().mockResolvedValue(undefined),
  };
});

describe("FFCSDossierSubpage Component", () => {
  const mockTimetable: TimetableState = {
    id: "tt-1",
    name: "Winter 2026 Primary",
    courses: [],
  };

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
      lunch: true,
      slot: "LUNCH",
      start: "1:20 PM",
      end: "2:00 PM",
      days: {},
    },
  ];

  const mockDays = [
    { id: "mon", name: "Monday" },
    { id: "tue", name: "Tuesday" },
    { id: "wed", name: "Wednesday" },
    { id: "thu", name: "Thursday" },
    { id: "fri", name: "Friday" },
  ];

  it("renders embedded dossier subpage with header, courses, faculty intelligence, and drop-in replacements", () => {
    const onClose = vi.fn();
    render(
      <FFCSDossierSubpage
        timetable={mockTimetable}
        courses={mockCourses}
        theoryPeriods={mockTheoryPeriods}
        labPeriods={mockLabPeriods}
        days={mockDays}
        masterCourses={mockMasterCourses}
        onClose={onClose}
      />
    );

    // Header info
    expect(screen.getAllByText("Winter 2026 Primary").length).toBeGreaterThan(0);
    expect(screen.getByText("Official Registration Dossier")).toBeDefined();
    expect(screen.getByText("Total Credits")).toBeDefined();

    // Enrolled courses table
    expect(screen.getAllByText("BCSE202").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Data Structures").length).toBeGreaterThan(0);

    // Faculty Intelligence section
    expect(screen.getByText("Faculty Intelligence & Sentiment Report")).toBeDefined();
    expect(screen.getAllByText("Dr. Ramesh").length).toBeGreaterThan(0);

    // Drop-in replacements section
    expect(screen.getByText("Emergency Drop-In Slot Replacements")).toBeDefined();
    expect(screen.getByText("Dr. Suresh")).toBeDefined();
    expect(screen.getByText("Room: AB1-205 • ID: 10095")).toBeDefined();
    expect(screen.getAllByText(/0 Clash/i).length).toBeGreaterThan(0);

    // Back button
    const backBtn = screen.getByText("Back to Timetable");
    fireEvent.click(backBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("handles theme toggle and print triggers", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <FFCSDossierSubpage
        timetable={mockTimetable}
        courses={mockCourses}
        theoryPeriods={mockTheoryPeriods}
        labPeriods={mockLabPeriods}
        days={mockDays}
        masterCourses={mockMasterCourses}
        onClose={vi.fn()}
      />
    );

    // Toggle theme button
    const themeBtn = screen.getByTitle("Toggle between Ink-Saver Light Mode and Dark Mode");
    expect(themeBtn.textContent).toContain("Ink-Saver Light");
    fireEvent.click(themeBtn);
    expect(themeBtn.textContent).toContain("Dark Theme");

    // Download PDF button
    const downloadPdfBtn = screen.getByText("Download PDF");
    expect(downloadPdfBtn).toBeDefined();
    fireEvent.click(downloadPdfBtn);

    // Print button
    const printBtn = screen.getByText("Print");
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it("toggles between horizontal and vertical view modes", () => {
    render(
      <FFCSDossierSubpage
        timetable={mockTimetable}
        courses={mockCourses}
        theoryPeriods={mockTheoryPeriods}
        labPeriods={mockLabPeriods}
        days={mockDays}
        masterCourses={mockMasterCourses}
        onClose={vi.fn()}
        initialViewMode="horizontal"
      />
    );

    const verticalBtn = screen.getByText("Vertical");
    fireEvent.click(verticalBtn);
    expect(screen.getByText("Mobile Vertical Heatmap")).toBeDefined();

    const horizontalBtn = screen.getByText("Horizontal");
    fireEvent.click(horizontalBtn);
    expect(screen.getByText("Horizontal University Grid")).toBeDefined();
  });
});
