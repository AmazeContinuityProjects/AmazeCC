import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CourseWeeklySchedule from "@/components/custom/exams/CourseWeeklySchedule";
import CourseFacultyCard, { parseFacultyInfo } from "@/components/custom/exams/CourseFacultyCard";
import CourseDetailSubpage from "@/components/custom/exams/CourseDetailSubpage";
import type { AttendanceDayCardsMap } from "@/lib/attendanceTimetable";

describe("parseFacultyInfo", () => {
  it("parses faculty name with employee id and school acronym", () => {
    const res = parseFacultyInfo("12345 - DR. JOHN DOE - SCOPE");
    expect(res.cleanName).toBe("DR. JOHN DOE");
    expect(res.employeeId).toBe("12345");
    expect(res.school).toBe("SCOPE");
    expect(res.department).toBe("SCOPE");
  });

  it("parses multi-word department as the last segment and employee id as first segment", () => {
    const res = parseFacultyInfo("10293 - DR. CHARLES BABBAGE - SCHOOL OF ADVANCED SCIENCES");
    expect(res.cleanName).toBe("DR. CHARLES BABBAGE");
    expect(res.employeeId).toBe("10293");
    expect(res.school).toBe("SCHOOL OF ADVANCED SCIENCES");
    expect(res.department).toBe("SCHOOL OF ADVANCED SCIENCES");
  });

  it("parses department with special characters and symbols", () => {
    const res = parseFacultyInfo("50123 - PROF. ALAN KAY - DEPT. OF CSE & AI");
    expect(res.cleanName).toBe("PROF. ALAN KAY");
    expect(res.employeeId).toBe("50123");
    expect(res.department).toBe("DEPT. OF CSE & AI");
  });

  it("parses space-separated faculty name record with employee id and department", () => {
    const res = parseFacultyInfo("50772 NATHIYA N SAS");
    expect(res.cleanName).toBe("NATHIYA N");
    expect(res.employeeId).toBe("50772");
    expect(res.department).toBe("SAS");
    expect(res.school).toBe("SAS");
  });

  it("parses space-separated faculty record with honorific title", () => {
    const res = parseFacultyInfo("51351 DR. RAJESH GOSWAMI SCOPE");
    expect(res.cleanName).toBe("DR. RAJESH GOSWAMI");
    expect(res.employeeId).toBe("51351");
    expect(res.department).toBe("SCOPE");
  });

  it("parses mixed space and hyphen separated faculty record", () => {
    const res = parseFacultyInfo("50772 NATHIYA N - SAS");
    expect(res.cleanName).toBe("NATHIYA N");
    expect(res.employeeId).toBe("50772");
    expect(res.department).toBe("SAS");
  });

  it("parses space-separated faculty record without employee id", () => {
    const res = parseFacultyInfo("DR. JANE SMITH SELECT");
    expect(res.cleanName).toBe("DR. JANE SMITH");
    expect(res.employeeId).toBeUndefined();
    expect(res.department).toBe("SELECT");
  });

  it("parses faculty name without employee id but with school", () => {
    const res = parseFacultyInfo("DR. JANE SMITH - SELECT");
    expect(res.cleanName).toBe("DR. JANE SMITH");
    expect(res.employeeId).toBeUndefined();
    expect(res.school).toBe("SELECT");
    expect(res.department).toBe("SELECT");
  });

  it("handles plain faculty name gracefully", () => {
    const res = parseFacultyInfo("PROF. ALAN TURING");
    expect(res.cleanName).toBe("PROF. ALAN TURING");
    expect(res.employeeId).toBeUndefined();
    expect(res.school).toBeUndefined();
    expect(res.department).toBeUndefined();
  });
});

describe("CourseWeeklySchedule", () => {
  const sampleDayCardsMap: AttendanceDayCardsMap = {
    MON: [
      {
        courseCode: "BCSE301L",
        slotName: "A1",
        time: "08:00-08:50",
        slotVenue: "SJT 412",
        courseType: "Theory",
      },
      {
        courseCode: "BMTH201L",
        slotName: "B1",
        time: "08:55-09:45",
        slotVenue: "TT 201",
        courseType: "Theory",
      },
    ],
    TUE: [],
    WED: [
      {
        courseCode: "BCSE301L",
        slotName: "A1",
        time: "08:00-08:50",
        slotVenue: "SJT 412",
        courseType: "Theory",
      },
      {
        courseCode: "BCSE301L(L)",
        slotName: "L1+L2",
        time: "10:00-11:40",
        slotVenue: "SJT 118",
        courseType: "Lab",
      },
    ],
    THU: [],
    FRI: [
      {
        courseCode: "BCSE301L",
        slotName: "A1",
        time: "08:00-08:50",
        slotVenue: "SJT 412",
        courseType: "Theory",
      },
    ],
    SAT: [],
    SUN: [],
  };

  it("filters and displays weekly classes for the selected course", () => {
    render(<CourseWeeklySchedule courseCode="BCSE301L" dayCardsMap={sampleDayCardsMap} />);

    // Should display Monday, Wednesday, and Friday
    expect(screen.getByText("Monday")).toBeDefined();
    expect(screen.getByText("Wednesday")).toBeDefined();
    expect(screen.getByText("Friday")).toBeDefined();

    // Should not display Tuesday since no BCSE301L classes on Tuesday
    expect(screen.queryByText("Tuesday")).toBeNull();

    // Venues for BCSE301L are displayed
    const sjtVenues = screen.getAllByText("SJT 412");
    expect(sjtVenues.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SJT 118")).toBeDefined();

    // Both Theory and Lab badges appear
    expect(screen.getAllByText("Theory").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lab").length).toBeGreaterThan(0);
  });

  it("falls back to slot mapping when dayCardsMap has no matching entries", () => {
    render(
      <CourseWeeklySchedule
        courseCode="BCSE999L"
        dayCardsMap={{} as AttendanceDayCardsMap}
        theorySlot="A1+TA1"
        theoryVenue="SJT 505"
      />,
    );

    // Monday has A1 in config.slotMap
    expect(screen.getByText("Monday")).toBeDefined();
    expect(screen.getAllByText("SJT 505").length).toBeGreaterThan(0);
  });
});

describe("CourseFacultyCard", () => {
  const onReviewSpy = vi.fn();
  const onScheduleSpy = vi.fn();

  const sampleCourseComp = {
    faculty: "10293 - DR. CHARLES BABBAGE - SCOPE",
    slot: "A1+TA1",
    courseType: "Theory",
    credits: 3,
  };

  const sampleAttItem = {
    faculty: "10293 - DR. CHARLES BABBAGE - SCOPE",
    slotName: "A1+TA1",
    slotVenue: "SJT 412",
    credits: 3,
  };

  it("renders faculty name, component scope, and buttons", () => {
    render(
      <CourseFacultyCard
        scope="Theory"
        courseComp={sampleCourseComp}
        attItem={sampleAttItem}
        courseCode="BCSE301L"
        onOpenFacultyReview={onReviewSpy}
        onOpenFacultySchedule={onScheduleSpy}
      />,
    );

    expect(screen.getByText("DR. CHARLES BABBAGE")).toBeDefined();
    expect(screen.getByText("Theory Component")).toBeDefined();

    // Clicking Faculty Schedule calls the callback
    const scheduleBtn = screen.getByTitle("View faculty teaching schedule and timetable");
    fireEvent.click(scheduleBtn);
    expect(onScheduleSpy).toHaveBeenCalledWith("DR. CHARLES BABBAGE", "10293");

    // Clicking Vitfac Review calls the callback
    const reviewBtn = screen.getByTitle("View Vitfac student ratings and reviews");
    fireEvent.click(reviewBtn);
    expect(onReviewSpy).toHaveBeenCalledWith({
      name: "DR. CHARLES BABBAGE",
      employeeId: "10293",
      courseCode: "BCSE301L",
    });
  });

  it("expands and toggles faculty details info card", () => {
    render(
      <CourseFacultyCard scope="Theory" courseComp={sampleCourseComp} attItem={sampleAttItem} courseCode="BCSE301L" />,
    );

    const detailsBtn = screen.getByText("Details");
    fireEvent.click(detailsBtn);

    // Shows Employee ID and Class Venue in expanded view
    expect(screen.getByText("10293")).toBeDefined();
    expect(screen.getByText("Class Venue")).toBeDefined();
    expect(screen.getByText("SJT 412")).toBeDefined();
  });
});

describe("CourseDetailSubpage Plan tab with QCM", () => {
  it("renders without crashing when QCM data is initially null/loading", () => {
    render(
      <CourseDetailSubpage
        marksData={{}}
        attendanceData={{
          attendance: [
            {
              courseCode: "BCSE301L",
              courseTitle: "Operating Systems",
              courseType: "Theory",
              slotName: "A1+TA1",
              slotVenue: "SJT 412",
              faculty: "10293 - DR. CHARLES BABBAGE - SCOPE",
              attendancePercentage: "92",
            },
          ],
        }}
        loginToVTOP={() => Promise.resolve({} as any)}
        setActiveSubTab={() => {}}
        selectedCode="BCSE301L"
        initialTab="plan"
        onBack={() => {}}
      />,
    );

    // QCM header is rendered without throwing flatMap of null
    expect(screen.getByText("Quality Circle Meeting (QCM)")).toBeDefined();
  });
});
