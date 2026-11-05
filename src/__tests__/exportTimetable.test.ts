import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateModernTimetableHtml,
  downloadModernTimetableImage,
  generateModernPrintableHtml,
  generateModernDossierInnerHtml,
  downloadModernTimetablePdf,
  compileDossierPdfInline,
  compileDossierPdf,
  generateModernDossierHtml,
  downloadModernDossierHtml,
  openModernPrintableDossier,
  openTimetablePrintablePage,
  generateExamScheduleHtml,
  compileExamSchedulePdf,
  downloadExamSchedulePdf,
} from "../lib/exportTimetable";
import { renderVerticalGridHtml } from "../lib/exportTimetableHtml";
import type { AddedCourse, TimetablePeriod, ParsedCourse } from "@/lib/ffcsTypes";
import * as vitfacService from "../lib/vitfacService";

describe("Modern Timetable Export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
    expect(html).toContain("table-layout: fixed");
    expect(html).toContain("<colgroup>");
    expect(html).toContain("calc((100% - 110px) / 5)");
  });

  it("ensures every day column in vertical timetable has equal width and Wednesday is not squished", () => {
    const days = [
      { id: "mon", name: "Monday" },
      { id: "tue", name: "Tuesday" },
      { id: "wed", name: "Wednesday" },
      { id: "thu", name: "Thursday" },
      { id: "fri", name: "Friday" },
    ];
    const html = renderVerticalGridHtml(mockCourses, mockTheoryPeriods, mockLabPeriods, days, false);

    expect(html).toContain("table-layout: fixed");
    expect(html).toContain("<colgroup>");
    // Each day column gets the exact same calculated width
    const expectedWidth = "calc((100% - 110px) / 5)";
    expect(html).toContain(`width: ${expectedWidth}`);
    // Check that Wednesday's th has the exact same width as Monday and Friday
    expect(html).toContain(
      `<th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: #93c5fd; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: ${expectedWidth}; box-sizing: border-box;">\n      WED\n    </th>`,
    );
  });

  it("generates exam schedule HTML with all exams rendered as cards by default", () => {
    const mockSchedule = {
      CAT1: [
        {
          courseCode: "BCSE301L",
          courseTitle: "Database Management Systems",
          slot: "B1+TB1",
          examDate: "19-Nov-2025",
          examTime: "09:15 AM - 12:30 PM",
          examSession: "FN",
          reportingTime: "08:45 AM",
          venue: "SJT 401",
          seatLocation: "R3C4",
          seatNo: "42",
        },
      ],
      FAT: [
        {
          courseCode: "BCSE302L",
          courseTitle: "Operating Systems",
          slot: "C1",
          examDate: "10-Dec-2025",
          examTime: "02:00 PM - 05:30 PM",
          examSession: "AN",
          reportingTime: "01:30 PM",
          venue: "TT 202",
          seatLocation: "-",
          seatNo: "18",
        },
      ],
    };

    const html = generateExamScheduleHtml({
      scheduleObj: mockSchedule,
      semester: "Winter 2025-26",
      isLight: false,
    });

    // Check header info
    expect(html).toContain("AmazeCC");
    expect(html).toContain("Exam Schedule");
    expect(html).toContain("Winter 2025-26");
    expect(html).toContain("Total Exams");
    expect(html).toContain(">2<"); // 2 exams
    expect(html).toContain(">2<"); // 2 series

    // Check series headers
    expect(html).toContain("CAT1");
    expect(html).toContain("FAT");

    // Check card details
    expect(html).toContain("BCSE301L");
    expect(html).toContain("Database Management Systems");
    expect(html).toContain("Slot: B1+TB1");
    expect(html).toContain("19-Nov-2025");
    expect(html).toContain("09:15 AM - 12:30 PM");
    expect(html).toContain("SJT 401");
    expect(html).toContain("FN · Report: 08:45 AM");
    expect(html).toContain("Loc: R3C4 · No: 42");

    // Check second exam
    expect(html).toContain("BCSE302L");
    expect(html).toContain("Operating Systems");
    expect(html).toContain("TT 202");
    expect(html).toContain("Loc: R9C2 · No: 18"); // Seat calculation for seat 18
  });

  it("generates exam schedule HTML with all exams rendered as tables when layout is table", () => {
    const mockSchedule = {
      FAT: [
        {
          courseCode: "BCSE301L",
          courseTitle: "Database Management Systems",
          slot: "B1",
          examDate: "19-Nov-2025",
          examTime: "09:15 AM - 12:30 PM",
          examSession: "FN",
          reportingTime: "08:45 AM",
          venue: "SJT 401",
          seatLocation: "R3C4",
          seatNo: "42",
        },
      ],
    };

    const html = generateExamScheduleHtml({
      scheduleObj: mockSchedule,
      semester: "Winter 2025-26",
      isLight: true,
      layout: "table",
    });

    expect(html).toContain("<table");
    expect(html).toContain("COURSE");
    expect(html).toContain("SLOT");
    expect(html).toContain("DATE &amp; TIME");
    expect(html).toContain("SESSION");
    expect(html).toContain("VENUE");
    expect(html).toContain("SEAT");
    expect(html).toContain("BCSE301L");
    expect(html).toContain("Database Management Systems");
  });

  it("generates print-friendly exam schedule document HTML when layout is admit_card or document", () => {
    const mockSchedule = {
      FAT: [
        {
          courseCode: "BAECE203",
          courseTitle: "Analog Electronics",
          slot: "A1+TA1",
          examDate: "14-Nov-2026",
          examTime: "09:30 AM - 12:30 PM",
          examSession: "FN1",
          reportingTime: "09:15 AM",
          venue: "AB1-811",
          seatLocation: "R5C6",
          seatNo: "46",
        },
      ],
    };

    const html = generateExamScheduleHtml({
      scheduleObj: mockSchedule,
      semester: "CH20262701",
      layout: "admit_card",
    });

    // Student initiative header
    expect(html).toContain("AmazeCC");
    expect(html).toContain("Student Academic Initiative");
    expect(html).toContain("EXAMINATION SCHEDULE — Fall 2026-27");

    // Metadata summary box
    expect(html).toContain("Academic Term:");
    expect(html).toContain("Fall 2026-27");
    expect(html).toContain("1 Examination");
    expect(html).toContain("FAT");

    // Table header and row
    expect(html).toContain("Course Code &amp; Title");
    expect(html).toContain("Final Assessment Test (FAT)");
    expect(html).toContain("BAECE203");
    expect(html).toContain("Analog Electronics");
    expect(html).toContain("A1+TA1");
    expect(html).toContain("14-Nov-2026");
    expect(html).toContain("09:30 AM - 12:30 PM");
    expect(html).toContain("FN1 · Report: 09:15 AM");
    expect(html).toContain("AB1-811");
    expect(html).toContain("Loc: R5C6 · No: 46");

    // Candidate guidelines
    expect(html).toContain("Important Exam Guidelines &amp; Student Notes");
    expect(html).toContain("Reporting &amp; Punctuality:");
    expect(html).toContain("Identification:");
    expect(html).toContain("Seating Protocols:");
    expect(html).toContain("Prohibited Items:");

    // Student initiative footer
    expect(html).toContain("AmazeCC is an independent student initiative");
  });

  it("filters download to specific exam series (e.g. FAT only) when selectedSeries is provided", () => {
    const multiSchedule = {
      CAT1: [
        {
          courseCode: "CAT1_ONLY",
          courseTitle: "CAT1 Subject",
          slot: "A1",
          examDate: "10-Aug-2026",
          examTime: "09:30 AM - 11:00 AM",
        },
      ],
      FAT: [
        {
          courseCode: "FAT_ONLY",
          courseTitle: "FAT Subject",
          slot: "B1",
          examDate: "14-Nov-2026",
          examTime: "09:30 AM - 12:30 PM",
        },
      ],
    };

    const html = generateExamScheduleHtml({
      scheduleObj: multiSchedule,
      semester: "Fall 2026-27",
      layout: "admit_card",
      selectedSeries: "FAT",
    });

    expect(html).toContain("FAT_ONLY");
    expect(html).toContain("FAT Subject");
    expect(html).toContain("FINAL ASSESSMENT TEST (FAT) — EXAMINATION SCHEDULE");
    // CAT1 exam is excluded when selectedSeries is FAT
    expect(html).not.toContain("CAT1_ONLY");
    expect(html).not.toContain("CAT1 Subject");
  });

  it("handles empty exam schedule gracefully in generateExamScheduleHtml", () => {
    const html = generateExamScheduleHtml({
      scheduleObj: {},
      isLight: false,
    });

    expect(html).toContain("No exam schedule data available to export");
  });

  it("accurately renders user real-world exam payload (CH20262701 with CAT1, CAT2, FAT)", () => {
    const userPayload = {
      semester: "CH20262701",
      Schedule: {
        FAT: [
          {
            courseCode: "BAECE203",
            courseTitle: "Analog Electronics",
            classId: "CH2026270102001",
            slot: "A1+TA1",
            examDate: "14-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BASTS101",
            courseTitle: "Qualitative and Quantitative Skills Practice I",
            classId: "CH2026270100046",
            slot: "B1+TB1",
            examDate: "17-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 10:30 AM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BACSE106",
            courseTitle: "Operating Systems",
            classId: "CH2026270102163",
            slot: "C1+TC1",
            examDate: "19-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BAMAT209",
            courseTitle: "Mathematical Foundations for Computation",
            classId: "CH2026270100228",
            slot: "D1+TD1+TDD1",
            examDate: "21-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BACSE105",
            courseTitle: "Data Structures and Algorithms",
            classId: "CH2026270102407",
            slot: "F1+TF1",
            examDate: "26-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BAHUM251",
            courseTitle: "Indian Constitution",
            classId: "CH2026270100946",
            slot: "G1+TG1",
            examDate: "28-Nov-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
          {
            courseCode: "BAGER101",
            courseTitle: "German Level I",
            classId: "CH2026270101766",
            slot: "TE1",
            examDate: "01-Dec-2026",
            examSession: "FN2",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 12:30 PM",
            venue: "",
            seatLocation: "-",
            seatNo: "",
          },
        ],
        CAT2: [
          {
            courseCode: "BAECE203",
            courseTitle: "Analog Electronics",
            classId: "CH2026270102001",
            slot: "A1+TA1",
            examDate: "25-Sep-2026",
            examSession: "AN2",
            reportingTime: "01:45 PM",
            examTime: "02:00 PM - 03:30 PM",
            venue: "AB1-811",
            seatLocation: "R5C6",
            seatNo: "46",
          },
          {
            courseCode: "BASTS101",
            courseTitle: "Qualitative and Quantitative Skills Practice I",
            classId: "CH2026270100046",
            slot: "B1+TB1",
            examDate: "26-Sep-2026",
            examSession: "FN3",
            reportingTime: "11:45 AM",
            examTime: "12:00 PM - 01:00 PM",
            venue: "AB3-202",
            seatLocation: "R3C2",
            seatNo: "13",
          },
          {
            courseCode: "BACSE106",
            courseTitle: "Operating Systems",
            classId: "CH2026270102163",
            slot: "C1+TC1",
            examDate: "27-Sep-2026",
            examSession: "AN1",
            reportingTime: "11:45 AM",
            examTime: "12:00 PM - 01:30 PM",
            venue: "AB1-701",
            seatLocation: "R8C7",
            seatNo: "69",
          },
          {
            courseCode: "BAMAT209",
            courseTitle: "Mathematical Foundations for Computation",
            classId: "CH2026270100228",
            slot: "D1+TD1+TDD1",
            examDate: "28-Sep-2026",
            examSession: "AN2",
            reportingTime: "01:45 PM",
            examTime: "02:00 PM - 03:30 PM",
            venue: "AB4-211",
            seatLocation: "R2C4",
            seatNo: "16",
          },
          {
            courseCode: "BACSE105",
            courseTitle: "Data Structures and Algorithms",
            classId: "CH2026270102407",
            slot: "F1+TF1",
            examDate: "30-Sep-2026",
            examSession: "AN2",
            reportingTime: "01:45 PM",
            examTime: "02:00 PM - 03:30 PM",
            venue: "AB3-609",
            seatLocation: "R2C4",
            seatNo: "22",
          },
          {
            courseCode: "BAHUM251",
            courseTitle: "Indian Constitution",
            classId: "CH2026270100946",
            slot: "G1+TG1",
            examDate: "01-Oct-2026",
            examSession: "AN2",
            reportingTime: "01:45 PM",
            examTime: "02:00 PM - 03:30 PM",
            venue: "AB3-704",
            seatLocation: "R2C8",
            seatNo: "58",
          },
          {
            courseCode: "BAGER101",
            courseTitle: "German Level I",
            classId: "CH2026270101766",
            slot: "TE1",
            examDate: "29-Sep-2026",
            examSession: "AN1",
            reportingTime: "11:45 AM",
            examTime: "12:00 PM - 01:30 PM",
            venue: "AB1-308",
            seatLocation: "R6C4",
            seatNo: "30",
          },
        ],
        CAT1: [
          {
            courseCode: "BAECE203",
            courseTitle: "Analog Electronics",
            classId: "CH2026270102001",
            slot: "A1+TA1",
            examDate: "08-Aug-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 11:00 AM",
            venue: "AB1-811",
            seatLocation: "R6C5",
            seatNo: "47",
          },
          {
            courseCode: "BASTS101",
            courseTitle: "Qualitative and Quantitative Skills Practice I",
            classId: "CH2026270100046",
            slot: "B1+TB1",
            examDate: "09-Aug-2026",
            examSession: "FN2",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 10:30 AM",
            venue: "AB3-202",
            seatLocation: "R3C2",
            seatNo: "13",
          },
          {
            courseCode: "BACSE106",
            courseTitle: "Operating Systems",
            classId: "CH2026270102163",
            slot: "C1+TC1",
            examDate: "10-Aug-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 11:00 AM",
            venue: "AB1-701",
            seatLocation: "R8C7",
            seatNo: "69",
          },
          {
            courseCode: "BAMAT209",
            courseTitle: "Mathematical Foundations for Computation",
            classId: "CH2026270100228",
            slot: "D1+TD1+TDD1",
            examDate: "11-Aug-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 11:00 AM",
            venue: "AB3-506",
            seatLocation: "R2C6",
            seatNo: "40",
          },
          {
            courseCode: "BACSE105",
            courseTitle: "Data Structures and Algorithms",
            classId: "CH2026270102407",
            slot: "F1+TF1",
            examDate: "13-Aug-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 11:00 AM",
            venue: "AB3-406",
            seatLocation: "R2C4",
            seatNo: "22",
          },
          {
            courseCode: "BAHUM251",
            courseTitle: "Indian Constitution",
            classId: "CH2026270100946",
            slot: "G1+TG1",
            examDate: "14-Aug-2026",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            examTime: "09:30 AM - 11:00 AM",
            venue: "AB3-603",
            seatLocation: "R9C6",
            seatNo: "54",
          },
          {
            courseCode: "BAGER101",
            courseTitle: "German Level I",
            classId: "CH2026270101766",
            slot: "TE1",
            examDate: "12-Aug-2026",
            examSession: "AN1",
            reportingTime: "11:45 AM",
            examTime: "12:00 PM - 01:30 PM",
            venue: "AB1-308",
            seatLocation: "R6C4",
            seatNo: "30",
          },
        ],
      },
    };

    const htmlCards = generateExamScheduleHtml({
      scheduleObj: userPayload.Schedule,
      semester: userPayload.semester,
      isLight: false,
      layout: "cards",
    });

    // Formatted semester
    expect(htmlCards).toContain("Fall 2026-27");
    // Stats: 21 total exams across 3 series
    expect(htmlCards).toContain(">21<");
    expect(htmlCards).toContain(">3<");

    // All courses rendered
    expect(htmlCards).toContain("BAECE203");
    expect(htmlCards).toContain("Analog Electronics");
    expect(htmlCards).toContain("Qualitative and Quantitative Skills Practice I");
    expect(htmlCards).toContain("BACSE106");
    expect(htmlCards).toContain("BAMAT209");
    expect(htmlCards).toContain("BACSE105");
    expect(htmlCards).toContain("BAHUM251");
    expect(htmlCards).toContain("BAGER101");

    // Empty/unallocated seats and venues in FAT display cleanly as TBA
    expect(htmlCards).toContain("TBA");

    // Allocated seats and venues in CAT1 & CAT2 display accurately
    expect(htmlCards).toContain("Loc: R5C6 · No: 46");
    expect(htmlCards).toContain("AB1-811");
    expect(htmlCards).toContain("Loc: R8C7 · No: 69");
    expect(htmlCards).toContain("AB1-701");

    // Chronological order: CAT1 (Aug) appears before CAT2 (Sep) which appears before FAT (Nov)
    const cat1Index = htmlCards.indexOf("CAT1");
    const cat2Index = htmlCards.indexOf("CAT2");
    const fatIndex = htmlCards.indexOf("FAT");
    expect(cat1Index).toBeGreaterThan(-1);
    expect(cat2Index).toBeGreaterThan(cat1Index);
    expect(fatIndex).toBeGreaterThan(cat2Index);

    // Also verify table layout works seamlessly on this payload
    const htmlTable = generateExamScheduleHtml({
      scheduleObj: userPayload.Schedule,
      semester: userPayload.semester,
      isLight: true,
      layout: "table",
    });
    expect(htmlTable).toContain("<table");
    expect(htmlTable).toContain("Fall 2026-27");
    expect(htmlTable).toContain("Qualitative and Quantitative Skills Practice I");
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

  it("can omit the course table when exporting it separately", () => {
    const html = generateModernTimetableHtml({
      timetableName: "Grid Only",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "horizontal",
      includeCourseList: false,
    });

    expect(html).toContain("Horizontal University Grid");
    expect(html).not.toContain("Faculty &amp; Vitfac Review");
    expect(html).not.toContain("Data Structures");
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

  it("generates standalone responsive horizontal HTML without print controls or handlers", () => {
    const html = generateModernDossierHtml({
      timetableName: "Standalone Dossier",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "dark",
    });

    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('class="dark-theme"');
    expect(html).toContain("background: #090d16");
    expect(html).toContain("Horizontal University Grid");
    expect(html).toContain("lunch-column");
    expect(html).toContain("pdf-course-table");
    expect(html).toContain("viewport");
    expect(html).not.toContain("window.print");
    expect(html).not.toContain("print-toolbar");
    expect(html).not.toContain("@page");
    expect(html).not.toContain("<script");
    expect(html).toContain("FACULTY INTELLIGENCE &amp; SENTIMENT REPORT");
    expect(html).toContain("0 Clash Risk");
  });

  it("waits for VITFAC and downloads a standalone HTML dossier with theme filename", async () => {
    let resolveCatalog!: (catalog: Map<string, vitfacService.VitfacFaculty>) => void;
    const catalogPromise = new Promise<Map<string, vitfacService.VitfacFaculty>>((resolve) => {
      resolveCatalog = resolve;
    });
    vi.spyOn(vitfacService, "loadVitfacCatalog").mockReturnValue(catalogPromise);
    const createObjectURL = vi.fn((_blob: Blob) => "blob:html-dossier");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedFile = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFile = this.download;
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const pending = downloadModernDossierHtml({
      timetableName: "Print Dossier",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "light",
    });

    expect(createObjectURL).not.toHaveBeenCalled();

    resolveCatalog(new Map());
    await pending;

    expect(openSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    expect(await blob.text()).toContain("Horizontal University Grid");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadedFile).toBe("Print_Dossier_LIGHT_FFCS_Dossier.html");
  });

  it("embeds reduced VITFAC portraits as data URLs without external image URLs", async () => {
    vi.spyOn(vitfacService, "loadVitfacCatalog").mockResolvedValue(
      new Map([
        [
          "10090",
          {
            id: "MTAwOTA=",
            employeeId: "10090",
            name: "Dr. Ramesh",
            wPct: 80,
            reviews: 10,
            wCount: 8,
            lCount: 2,
            image_url: "data:image/png;base64,fixture-image",
          },
        ],
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.mode).toBe("cors");
        return { ok: true, blob: async () => new Blob(["fixture-image"], { type: "image/png" }) };
      }),
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 192,
        height: 128,
        close: vi.fn(),
      })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,smallportrait");
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:portrait"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadModernDossierHtml({
      timetableName: "Portraits",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "dark",
    });

    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    const html = await blob.text();
    expect(html).toContain('<img src="data:image/jpeg;base64,smallportrait" alt="Dr. Ramesh" width="36" height="36"');
    expect(html).not.toContain('src="data:image/png;base64,fixture-image"');
    expect(html).not.toContain('<img src="https://');
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
      true,
    );

    const darkHtml = generateModernDossierInnerHtml(
      {
        timetableName: "Winter 2026 Dark",
        courses: mockCourses,
        theoryPeriods: mockTheoryPeriods,
        labPeriods: mockLabPeriods,
        masterCourses: mockMasterCourses,
      },
      false,
    );

    // Light Mode tokens
    expect(lightHtml).toContain("background: #ffffff");
    expect(lightHtml).toContain("color: #0f172a");
    expect(lightHtml).toContain("Winter 2026 Light");

    // Dark Mode tokens
    expect(darkHtml).toContain("color: #ffffff");
    expect(darkHtml).toContain("Winter 2026 Dark");
  });

  describe("compileDossierPdfInline & compileDossierPdf", () => {
    /**
     * jsdom ships without the `canvas` package, so a real `Image` given a
     * `data:` URL fires neither `load` nor `error` — the inline compiler's
     * `await` on `img.onload` would hang until the 5s test timeout. This stub
     * answers on the next macrotask, which is after the caller has installed
     * its handlers (`src` is assigned before `onload` in the source).
     */
    class StubImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1400;
      naturalHeight = 2000;
      private _src = "";
      set src(value: string) {
        this._src = value;
        setTimeout(() => this.onload?.(), 0);
      }
      get src(): string {
        return this._src;
      }
    }

    beforeEach(() => {
      vi.stubGlobal("Image", StubImage);
    });

    // Runs even when a test fails or times out: the in-test
    // `vi.restoreAllMocks()` never executes on a timeout, and a leaked
    // `document.createElement` spy makes the *next* test recurse without end —
    // its `origCreateElement` binds the spy itself, so every createElement
    // call routes straight back into the active implementation.
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("compiles PDF inline and returns ArrayBuffer and formatted filename", async () => {
      // Mock canvas getContext and toDataURL in jsdom
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        return el;
      });

      const dummy1x1DataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const lightResult = await compileDossierPdfInline({
        timetableName: "Winter 2026",
        theme: "light",
        isLight: true,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(lightResult.fileName).toBe("Winter_2026_LIGHT_FFCS_Dossier.pdf");
      expect(lightResult.pdfBuffer).toBeInstanceOf(ArrayBuffer);
      expect(lightResult.pdfBuffer.byteLength).toBeGreaterThan(0);

      const darkResult = await compileDossierPdfInline({
        timetableName: "Winter 2026",
        theme: "dark",
        isLight: false,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(darkResult.fileName).toBe("Winter_2026_DARK_FFCS_Dossier.pdf");
      expect(darkResult.pdfBuffer).toBeInstanceOf(ArrayBuffer);
      expect(darkResult.pdfBuffer.byteLength).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it("compileDossierPdf falls back gracefully to inline when Worker is undefined", async () => {
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        return el;
      });

      const dummy1x1DataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      // In Node/JSDOM, Worker or OffscreenCanvas might be undefined or mockable
      const res = await compileDossierPdf({
        timetableName: "Fallback Test",
        theme: "dark",
        isLight: false,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(res.fileName).toBe("Fallback_Test_DARK_FFCS_Dossier.pdf");
      expect(res.pdfBuffer).toBeInstanceOf(ArrayBuffer);

      vi.restoreAllMocks();
    });

    it("compileExamSchedulePdf compiles exam schedule PDF in A4 portrait format", async () => {
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        return el;
      });

      const dummy1x1DataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const mockSchedule = {
        FAT: [
          {
            courseCode: "BAECE203",
            courseTitle: "Analog Electronics",
            slot: "A1+TA1",
            examDate: "14-Nov-2026",
            examTime: "09:30 AM - 12:30 PM",
            examSession: "FN1",
            reportingTime: "09:15 AM",
            venue: "AB1-811",
            seatLocation: "R5C6",
            seatNo: "46",
          },
        ],
      };

      const result = await compileExamSchedulePdf({
        scheduleObj: mockSchedule,
        semester: "CH20262701",
        dataUrl: dummy1x1DataUrl,
      });

      expect(result.fileName).toBe("CH20262701_Exam_Schedule.pdf");
      expect(result.pdfBuffer).toBeInstanceOf(ArrayBuffer);
      expect(result.pdfBuffer.byteLength).toBeGreaterThan(0);
      expect(result.pdfBlob).toBeInstanceOf(Blob);

      // Also test with selectedSeries = "FAT"
      const fatResult = await compileExamSchedulePdf({
        scheduleObj: mockSchedule,
        semester: "CH20262701",
        selectedSeries: "FAT",
        dataUrl: dummy1x1DataUrl,
      });
      expect(fatResult.fileName).toBe("CH20262701_FAT_Exam_Schedule.pdf");

      vi.restoreAllMocks();
    });

    it("downloadExamSchedulePdf creates download anchor and clicks it without opening a new tab", async () => {
      const origCreateElement = document.createElement.bind(document);
      let clicked = false;
      let downloadName = "";
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        if (tagName.toLowerCase() === "a") {
          const a = el as HTMLAnchorElement;
          a.click = () => {
            clicked = true;
            downloadName = a.download;
          };
        }
        return el;
      });

      // Ensure window.open is NOT called
      const openSpy = vi.spyOn(window, "open");

      const dummy1x1DataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      await downloadExamSchedulePdf({
        scheduleObj: { FAT: [] },
        semester: "Fall 2026",
        dataUrl: dummy1x1DataUrl,
      });

      expect(clicked).toBe(true);
      expect(downloadName).toBe("Fall_2026_Exam_Schedule.pdf");
      expect(openSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
