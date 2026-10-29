import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TimetableGrid from "../components/custom/attendance/TimetableGrid";

/**
 * The attendance timetable's course reference, as the planner's own list.
 *
 * This used to be a second, hand-rolled copy of a course table — a fixed
 * `min-w-[700px]` grid that could not be read on a phone without scrolling it
 * sideways, which is the one place the home screen's "Full Weekly Timetable"
 * sheet is opened. It now renders `SelectedCoursesList`, the same component
 * the planner and the share view use, which splits at `md` into a card list
 * under it and the table above it.
 *
 * Two things are worth pinning, and neither is visible by looking at the
 * sheet on a desktop:
 *
 *  1. It really is the shared component — its markup is the card list's (an
 *     `<h3>` title per card) *and* the table's (a `<p>` title per row),
 *     because jsdom applies no media queries and both responsive halves land
 *     in the DOM at once. The old table had neither.
 *  2. Credits are not double-counted. The shared list merges the rows it is
 *     given per course code and sums their credits — right for the planner,
 *     where a theory half and a lab half each carry their own share, but
 *     wrong here: every attendance row carries the course's full credit, so
 *     a course listed as both a theory and a lab row would be counted twice
 *     without the dedupe this grid does on the way in.
 */

const row = (over: Record<string, unknown>) => ({
  courseTitle: "Programming",
  slotName: "A1",
  faculty: "PARTHIBAN V",
  slotVenue: "AB3-101",
  credits: "3",
  courseType: "ETH",
  attendancePercentage: "85",
  ...over,
});

describe("attendance timetable course reference", () => {
  it("renders the planner's shared course list, not a private table", async () => {
    render(
      <TimetableGrid
        attendance={[
          row({ courseCode: "BCSE101" }),
          row({ courseCode: "BCSE202", courseTitle: "Networks", slotName: "F1", slotVenue: "AB3-102" }),
        ]}
      />
    );

    const heading = await screen.findByRole("heading", { name: /Course Reference/ });
    expect(heading).toBeDefined();

    // The shared component's two responsive halves are both in the DOM: the
    // mobile card list carries an <h3> per course, the desktop table a <p>.
    // The old hand-rolled table had neither.
    expect(screen.getAllByRole("heading", { name: "Programming" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Networks").length).toBeGreaterThan(0);

    // The faculty and venue the old table showed still arrive.
    expect(screen.getAllByText("PARTHIBAN V").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AB3-102").length).toBeGreaterThan(0);
  });

  it("counts a course listed as both theory and lab rows once", async () => {
    render(
      <TimetableGrid
        attendance={[
          row({ courseCode: "BCSE101", slotName: "A1", courseType: "TH" }),
          row({ courseCode: "BCSE101", slotName: "L1", courseType: "LO", slotVenue: "LAB-1" }),
        ]}
      />
    );

    // The shared list sums credits across the rows it merges per code. Each
    // attendance row carries the course's full credit, so without the dedupe
    // this grid would report 6 for a 3-credit course.
    const credits = await screen.findByText(/Total Credits:/);
    expect(credits.textContent).toBe("Total Credits: 3");

    // Both halves survive into the one merged row: the theory venue and the
    // lab venue are joined rather than one replacing the other.
    expect(screen.getAllByText(/AB3-101/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LAB-1/).length).toBeGreaterThan(0);
  });

  it("shows no course reference at all when there is nothing to reference", async () => {
    const { container } = render(<TimetableGrid attendance={[]} />);
    expect(screen.queryByRole("heading", { name: /Course Reference/ })).toBeNull();
    // The grid itself still renders — an empty week is not an empty sheet.
    expect(container.querySelector("table, .vertical-timetable, [class*='timetable']")).not.toBeNull();
  });
});
