import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FriendTimetableViewModal } from "../components/custom/exams/FFCS/components/modals/FriendTimetableViewModal";
import type { AddedCourse, TimetableState } from "../components/custom/exams/FFCS/types";

/**
 * The friend sheet's course list, on the planner's grouper.
 *
 * A friend's saved timetable holds the halves the planner holds: the theory
 * row and the lab row of one course, as two `AddedCourse`s sharing a code.
 * `CourseListTable` renders one row per given course *and* a Credits column
 * per row, so what feeds it decides what the friend's numbers are.
 *
 * The local reduce this replaced keyed on `code` but kept the **first** row
 * only: the lab half dropped out of the merged row entirely — its slots, its
 * venue, and the credit it carried. Under a Credits column that reads as a
 * confident wrong number (2 for a 3-credit course), and a Slots cell missing
 * the lab. `groupSelectedCourses` — the planner's own merge, already pinned
 * by the attendance-grid tests — joins the halves instead.
 *
 * jsdom applies no media queries, so both the grid's table and this list's
 * table land in the DOM; every assertion below is scoped to the table that
 * has a Credits column, which only `CourseListTable` has.
 */

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

const THEORY_HALF: AddedCourse = {
  id: "c1",
  code: "CSE201",
  title: "Data Structures",
  slots: ["A1", "A2"],
  faculty: "DR A",
  venue: "AB3-101",
  credits: "2",
  type: "ETH",
  color: "bg-blue-600",
};

const LAB_HALF: AddedCourse = {
  id: "c2",
  code: "CSE201",
  title: "Data Structures",
  slots: ["L1", "L2", "L3"],
  faculty: "DR A",
  venue: "LAB-3",
  credits: "1",
  type: "LO",
  color: "bg-blue-600",
};

const timetable: TimetableState = {
  id: "t1",
  name: "Option A",
  courses: [THEORY_HALF, LAB_HALF],
};

function courseListTable() {
  const tables = screen.getAllByRole("table");
  const list = tables.find((t) => t.textContent?.includes("Credits"));
  expect(list).toBeDefined();
  return within(list as HTMLElement);
}

describe("friend timetable sheet course list", () => {
  it("merges a course's theory and lab halves into one complete row", () => {
    render(
      <FriendTimetableViewModal
        data={{ name: "Rahul", timetables: [timetable], currentIndex: 0 }}
        setData={() => {}}
        theoryPeriods={[]}
        labPeriods={[]}
      />
    );

    const list = courseListTable();

    // One row for the code — the table is per-course, not per-half.
    expect(list.getAllByText("CSE201")).toHaveLength(1);

    // Credits are summed across the halves: 2 + 1, not the first row's 2.
    // The old reduce produced "2" here — a wrong number in a Credits column.
    expect(list.getByText("3")).toBeDefined();

    // The lab half's slots and venue survive into the merged row.
    // The old reduce dropped the lab row outright, so none of these exist.
    expect(list.getByText("L1")).toBeDefined();
    expect(list.getByText("L2")).toBeDefined();
    expect(list.getByText("AB3-101 / LAB-3")).toBeDefined();
  });

  it("shows both halves' types as chips rather than only the first", () => {
    render(
      <FriendTimetableViewModal
        data={{ name: "Rahul", timetables: [timetable], currentIndex: 0 }}
        setData={() => {}}
        theoryPeriods={[]}
        labPeriods={[]}
      />
    );

    const list = courseListTable();

    // The chips render typeLabels, and only the merged type ("ETH + LO")
    // produces both: the old reduce showed just the first row's "Embedded
    // Theory" and never the lab's.
    expect(list.getByText("Embedded Theory")).toBeDefined();
    expect(list.getByText("Lab Only")).toBeDefined();
  });
});
