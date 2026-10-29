import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SimplifiedMobileHome from "../components/custom/mobile/SimplifiedMobileHome";

/**
 * Lab FAT week on the home page.
 *
 * Two API signals describe it and only their join says what a slot becomes:
 * the academic calendar marks the day (`"(Working Day / LAB FAT)"`), the exam
 * schedule names the paper and its lab slot. These tests render the real page
 * over both, and pin the behaviour that makes the day honest:
 *
 *  - the day is a working day — its timetable stays, unlike a full exam day;
 *  - the lab slot becomes its own exam, collapsed, in the class's place;
 *  - the marking survives each signal arriving alone (calendar without
 *    schedule, schedule without timetable rows).
 */

const TODAY = new Date(2026, 8, 29, 10, 0, 0); // Tuesday, 10am local

const LAB_COURSE = {
  courseCode: "CSC201L",
  courseTitle: "Object Oriented Programming Lab",
  slot: "L37+L38",
  examDate: "29-09-2026",
  examSession: "AN",
  reportingTime: "01:30 PM",
  examTime: "02:00 PM - 05:00 PM",
  venue: "AB3-402",
  seatLocation: "R5C3",
  seatNo: "41",
};

/** The lab class the paper takes over (TUE L37+L38 lives at 2:00 in config.json). */
const labClass = {
  courseCode: "CSC201L",
  courseTitle: "Object Oriented Programming Lab",
  slotName: "L37+L38",
  attendancePercentage: "90",
  courseType: "Lab",
  faculty: "Dr. Lab",
};

/** An ordinary theory class the same day — must survive the Lab FAT. */
const theoryClass = {
  courseCode: "CSC201",
  courseTitle: "Object Oriented Programming",
  slotName: "B2",
  attendancePercentage: "85",
  courseType: "Theory",
  faculty: "Dr. Theory",
};

function props(over: Record<string, unknown> = {}) {
  return {
    attendanceData: { attendance: [labClass, theoryClass] },
    marksData: {},
    hostelData: {},
    moodleData: [],
    calendarData: {
      calendars: [
        {
          calendarType: "General Semester",
          month: "Sept 2026",
          days: [
            {
              date: 29,
              events: [
                {
                  text: "(Working Day / LAB FAT)",
                  type: "Instructional Day",
                  category: "Working Day / LAB FAT",
                },
              ],
            },
          ],
        },
      ],
    },
    ScheduleData: {
      Schedule: {
        FAT: [LAB_COURSE],
        // A theory paper the same day: without the Lab FAT join this would
        // flip the whole day into the all-exam view.
        CAT2: [
          {
            courseCode: "BAGER101",
            courseTitle: "German Level I",
            slot: "A1+TA1",
            examDate: "29-09-2026",
            examSession: "FN1",
            reportingTime: "09:00 AM",
            examTime: "09:15 AM - 12:30 PM",
            venue: "AB1-201",
            seatNo: "12",
          },
        ],
      },
    },
    settings: {},
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

function renderHome(over: Record<string, unknown> = {}) {
  return render(<SimplifiedMobileHome {...props(over)} />);
}

/**
 * The collapsed exam slot's disclosure button. The week-strip circle also says
 * "Lab FAT" in its accessible name; the slot's name carries the slot code.
 */
const slotButton = () =>
  screen.getByRole("button", { name: /Lab FAT exam slot L37\+L38/ }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Lab FAT day", () => {
  it("keeps the day's timetable and swaps only the lab slot for its collapsed exam", () => {
    renderHome();

    // The day is working: no all-exam takeover despite two papers today.
    expect(screen.queryByText("No regular lectures on exam day")).toBeNull();
    // The theory class still renders as a class.
    expect(screen.getByText("Object Oriented Programming")).toBeDefined();

    // The lab slot is now the exam — collapsed, with its time and venue shown.
    const button = slotButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toContain("L37+L38");
    expect(button.textContent).toContain("02:00 PM - 05:00 PM");
    expect(button.textContent).toContain("AB3-402");
    // The details are not painted while collapsed.
    expect(screen.queryByText("Reporting")).toBeNull();
  });

  it("expands to the session, reporting time and seat", () => {
    renderHome();

    fireEvent.click(slotButton());

    expect(slotButton().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Reporting")).toBeDefined();
    expect(screen.getByText("01:30 PM")).toBeDefined();
    expect(screen.getByText("No. 41")).toBeDefined();
    const hall = screen.getByRole("button", { name: "Hall Details" });
    fireEvent.click(hall);
  });

  it("marks the day in the sub-header and the week strip", () => {
    renderHome();

    // Sub-header span + the card's badge both say it.
    expect(screen.getAllByText("Lab FAT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1 session still on/)).toBeDefined();

    const strip = screen.queryByRole("group", { name: "Week" });
    expect(strip).not.toBeNull();
    const marked = within(strip as HTMLElement)
      .getAllByRole("button")
      .filter((b) => (b.title || "").includes("Lab FAT"));
    expect(marked).toHaveLength(1);
  });

  it("still marks the day and keeps classes when only the calendar arrived", () => {
    // No schedule at all: there is no paper to paint, but the day is known.
    renderHome({ ScheduleData: {} });

    expect(screen.queryByText("No regular lectures on exam day")).toBeNull();
    expect(screen.getAllByText("Lab FAT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2 sessions still on/)).toBeDefined();
    // The lab renders as its ordinary class card.
    expect(screen.getByText("L37+L38")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Lab FAT exam slot L37/ })).toBeNull();
  });

  it("shows the exam slot even when no timetable rows match", () => {
    // Attendance not synced: the paper still deserves its slot.
    renderHome({ attendanceData: { attendance: [] } });

    const button = slotButton();
    expect(button.textContent).toContain("Object Oriented Programming Lab");
    expect(screen.getAllByText("Lab FAT").length).toBeGreaterThanOrEqual(1);
  });

  it("leaves an ordinary week alone", () => {
    // Same page, no calendar mark and no papers: Tuesday is just a teaching
    // day, and the lab renders as its ordinary class card.
    renderHome({
      calendarData: { calendars: [{ calendarType: "General Semester", month: "Sept 2026", days: [] }] },
      ScheduleData: {},
    });

    expect(screen.queryByRole("button", { name: /Lab FAT/ })).toBeNull();
    expect(screen.getByText("L37+L38")).toBeDefined();
  });
});
