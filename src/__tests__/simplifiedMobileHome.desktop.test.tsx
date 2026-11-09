import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SimplifiedMobileHome from "../components/custom/mobile/SimplifiedMobileHome";
import { installLocalStorage } from "./helpers/localStorage";

const TODAY = new Date(2026, 8, 29, 10, 0, 0); // Tuesday, 10am local

const course1 = {
  courseCode: "CSE1001",
  courseTitle: "Problem Solving and Programming",
  slotName: "B1",
  attendancePercentage: "92",
  attendedClasses: "23",
  totalClasses: "25",
  courseType: "Theory",
  faculty: "Prof. Ada",
  slotVenue: "SJT 101",
  time: "8:00-8:50",
};

const course2 = {
  courseCode: "CSE1002",
  courseTitle: "Data Structures and Algorithms",
  slotName: "B2",
  attendancePercentage: "84",
  attendedClasses: "21",
  totalClasses: "25",
  courseType: "Theory",
  faculty: "Prof. Alan",
  slotVenue: "SJT 202",
  time: "2:00-2:50",
};

function defaultProps(over: Record<string, unknown> = {}) {
  return {
    attendanceData: { attendance: [course1, course2] },
    marksData: {
      cgpa: { cgpa: "9.15", creditsEarned: "78" },
    },
    hostelData: {},
    moodleData: [],
    calendarData: {
      calendars: [
        {
          calendarType: "General Semester",
          month: "Sept 2026",
          days: [],
        },
      ],
    },
    ScheduleData: { Schedule: {} },
    settings: {
      showGpa: true,
      decimalValues: false,
    },
    setSettings: vi.fn(),
    IDs: {},
    setActiveTab: vi.fn(),
    setActiveSubTab: vi.fn(),
    setActiveAttendanceSubTab: vi.fn(),
    handleReloadRequest: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    ...over,
  } as any;
}

let ls: Storage;

beforeEach(() => {
  ls = installLocalStorage();
  ls.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
});

afterEach(() => {
  vi.useRealTimers();
  ls?.clear();
});

describe("SimplifiedMobileHome Desktop Layout & Course Pane", () => {
  it("aligns content to the left on desktop with lg:max-w-none and lg:mx-0", () => {
    const { container } = render(<SimplifiedMobileHome {...defaultProps()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("lg:max-w-none");
    expect(root.className).toContain("lg:mx-0");
  });

  it("does not render the desktop course detail pane initially until a class is clicked", () => {
    render(<SimplifiedMobileHome {...defaultProps()} />);
    // No aside rendered yet before user click
    expect(document.querySelector("aside")).toBeNull();
  });

  it("shows the desktop course detail pane when a user clicks on a particular class in desktop mode", () => {
    render(<SimplifiedMobileHome {...defaultProps()} />);

    // Click on course1
    const course1Card = screen.getByText("Problem Solving and Programming");
    fireEvent.click(course1Card);

    // Desktop pane is now shown
    const aside = document.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("hidden");
    expect(aside?.className).toContain("lg:block");

    // Displays course1 details in the side pane
    expect(within(aside!).getByText("Prof. Ada")).toBeDefined();
    expect(within(aside!).getByText("SJT 101")).toBeDefined();
  });

  it("switches course in the desktop pane when clicking another class", () => {
    render(<SimplifiedMobileHome {...defaultProps()} />);

    // First click course1
    fireEvent.click(screen.getByText("Problem Solving and Programming"));
    const aside = document.querySelector("aside")!;
    expect(within(aside).getByText("Prof. Ada")).toBeDefined();

    // Now click course2
    fireEvent.click(screen.getByText("Data Structures and Algorithms"));
    expect(within(aside).getByText("Prof. Alan")).toBeDefined();
    expect(within(aside).getByText("SJT 202")).toBeDefined();
  });

  it("allows closing the desktop side view pane via the close button", () => {
    render(<SimplifiedMobileHome {...defaultProps()} />);

    // Open pane by clicking course1
    fireEvent.click(screen.getByText("Problem Solving and Programming"));
    expect(document.querySelector("aside")).not.toBeNull();

    // Click close button
    const closeBtn = screen.getByRole("button", { name: /close side view/i });
    fireEvent.click(closeBtn);

    // Pane is closed
    expect(document.querySelector("aside")).toBeNull();
  });

  it("navigates to academics/course-dashboard when clicking an already selected course on desktop", () => {
    const setActiveTab = vi.fn();
    const setActiveSubTab = vi.fn();
    render(<SimplifiedMobileHome {...defaultProps({ setActiveTab, setActiveSubTab })} />);

    const course1Card = screen.getByText("Problem Solving and Programming");

    // First click selects course1 and displays pane
    fireEvent.click(course1Card);
    expect(setActiveTab).not.toHaveBeenCalled();

    // Second click on the same course navigates to full page dashboard
    fireEvent.click(course1Card);
    expect(setActiveTab).toHaveBeenCalledWith("academics");
    expect(setActiveSubTab).toHaveBeenCalledWith("course-dashboard");
  });

  it("navigates immediately on mobile mode (< 1024px)", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    const setActiveTab = vi.fn();
    const setActiveSubTab = vi.fn();
    render(<SimplifiedMobileHome {...defaultProps({ setActiveTab, setActiveSubTab })} />);

    const course1Card = screen.getByText("Problem Solving and Programming");
    fireEvent.click(course1Card);

    // Immediately navigates on mobile without opening side pane
    expect(setActiveTab).toHaveBeenCalledWith("academics");
    expect(setActiveSubTab).toHaveBeenCalledWith("course-dashboard");
    expect(document.querySelector("aside")).toBeNull();
  });

  it("renders stat cards and dynamic insight carousel", () => {
    render(<SimplifiedMobileHome {...defaultProps()} />);

    // Pinned Attendance StatTile is present
    expect(screen.getByText("Attendance")).toBeDefined();
    // 92% is rendered
    expect(screen.getByText("92%")).toBeDefined();
    // CGPA slide in carousel
    expect(screen.getByText("9.15")).toBeDefined();
  });

  it("navigates to friend-finder tab and sets friend_finder_source on clicking Find Classmates", () => {
    const setActiveTab = vi.fn();
    render(<SimplifiedMobileHome {...defaultProps({ setActiveTab })} />);

    const btn = screen.getByRole("button", { name: /find classmates/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);

    expect(window.localStorage.getItem("friend_finder_source")).toBe("home");
    expect(setActiveTab).toHaveBeenCalledWith("friend-finder");
  });
});
