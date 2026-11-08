import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DesktopCourseDetail, { DesktopCourseDetailPane } from "../components/custom/attendance/DesktopCourseDetail";

describe("DesktopCourseDetail / DesktopCourseDetailPane", () => {
  const sampleCourse = {
    courseTitle: "Mathematical Foundations for Computation",
    courseCode: "BAMAT209(T)",
    credits: "4.0",
    slotName: "D1",
    time: "8:00-8:50",
    slotVenue: "AB1-610",
    faculty: "50772 NATHIYA N SAS",
    attendancePercentage: "82.1",
    attendedClasses: "46",
    totalClasses: "56",
    viewLink: [
      { date: "02-Nov-2026", status: "Present" },
      { date: "30-Oct-2026", status: "Present" },
      { date: "28-Oct-2026", status: "Present" },
      { date: "27-Oct-2026", status: "Absent" },
      { date: "26-Oct-2026", status: "Present" },
    ],
  };

  it("renders empty placeholder when no course is provided", () => {
    const { container } = render(<DesktopCourseDetail />);
    const className = (container.firstChild as HTMLElement)?.className || "";
    expect(className).toContain("hidden md:block");
    expect(className).toContain("bg-surface");
    expect(className).toContain("");
    expect(className).toContain("border border-gray-200");
    expect(className).toContain("rounded-md p-6 shadow-sm sticky top-4");
    expect(screen.getByText("Select a class on the timeline to view details.")).toBeDefined();
  });

  it("renders full course details when course is provided via 'course' or 'a'", () => {
    const onViewFullPage = vi.fn();
    render(<DesktopCourseDetailPane course={sampleCourse} onViewFullPage={onViewFullPage} />);

    // Checks header
    expect(screen.getByText("Mathematical Foundations for Computation")).toBeDefined();
    expect(screen.getByText("BAMAT209 • Theory • 4.0 Credits")).toBeDefined();
    expect(screen.getByText("D1 (8:00-8:50)")).toBeDefined();
    expect(screen.getByText("AB1-610")).toBeDefined();
    expect(screen.getByText("50772 NATHIYA N SAS")).toBeDefined();

    // Checks attendance stat card
    expect(screen.getByText("82.1%")).toBeDefined();
    expect(screen.getByText("(46 / 56)")).toBeDefined();
    expect(screen.getByText("Simulate Skips")).toBeDefined();

    // Checks next class impact
    expect(screen.getByText("Next Class Impact")).toBeDefined();
    expect(screen.getByText("If Attend")).toBeDefined();
    expect(screen.getByText("If Skip")).toBeDefined();

    // Checks history
    expect(screen.getByText("Recent Attendance History")).toBeDefined();
    expect(screen.getByText("5 total records")).toBeDefined();
    expect(screen.getByText("02-Nov-2026")).toBeDefined();
    expect(screen.getByText("Get Notes")).toBeDefined();

    // Checks view full history button
    const button = screen.getByRole("button", { name: /view full history & heatmap/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(onViewFullPage).toHaveBeenCalledTimes(1);
  });

  it("allows simulating skips internally when uncontrolled", () => {
    render(<DesktopCourseDetail a={sampleCourse} />);

    // Initially 0 skips
    expect(screen.getByText("82.1%")).toBeDefined();

    const increaseBtn = screen.getByTitle("Increase simulated skips");
    fireEvent.click(increaseBtn);

    // After 1 skip: 46 / 57 = 80.7%
    expect(screen.getByText("80.7%")).toBeDefined();
    expect(screen.getByText("(46 / 57)")).toBeDefined();

    const decreaseBtn = screen.getByTitle("Decrease simulated skips");
    fireEvent.click(decreaseBtn);
    expect(screen.getByText("82.1%")).toBeDefined();
  });
});
