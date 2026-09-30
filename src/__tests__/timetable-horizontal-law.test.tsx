import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { AddedCourse, TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import chennai from "../data/campus/chennai.json";
import HorizontalTimetableGrid from "../components/custom/timetable/HorizontalTimetableGrid";

/**
 * The horizontal grid is amazeui's, and its source is in another repository, so
 * these tests are really about the adapter in `HorizontalTimetableGrid` — the
 * thing that has to make the dependency's three schema-id assumptions hold for a
 * law course.
 *
 * The failure they guard is a cell that renders as a plausible free period: the
 * grid prints the period's own slot id in grey and nothing else, so an empty
 * law cell is indistinguishable from a genuinely free one. That is how a whole
 * law student's timetable came back blank.
 */

const THEORY = chennai.theory as TimetablePeriod[];
const LAB = chennai.lab as TimetablePeriod[];
const DAYS = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

function course(id: string, slots: string[]): AddedCourse {
  return {
    id,
    code: id.toUpperCase(),
    title: `Course ${id}`,
    slots,
    faculty: "Dr Someone",
    venue: "AB5-405",
    credits: "3",
    type: "",
    color: "bg-blue-600",
  };
}

/** The Monday cell of the theory column at `periodIndex`, as rendered text. */
const mondayCell = (container: HTMLElement, periodIndex: number) =>
  (container.querySelectorAll("tbody tr")[0]?.children[periodIndex + 1]?.textContent ?? "");

const renderGrid = (props: Partial<Parameters<typeof HorizontalTimetableGrid>[0]> = {}) =>
  render(
    <HorizontalTimetableGrid
      courses={[course("TLAW524L", ["A", "TA"])]}
      theoryPeriods={THEORY}
      labPeriods={LAB}
      days={DAYS}
      {...props}
    />
  );

describe("a law course in the horizontal grid", () => {
  it("fills the Monday 8:00 cell instead of leaving it free", () => {
    // Period 0 of the theory skeleton is Monday 8:00, where the schema says A1.
    const { container } = renderGrid();
    expect(mondayCell(container, 0)).toContain("TLAW524L");
  });

  it("prints the law school's spelling, not the schema's", () => {
    // "A", because the student's own timetable says A and the cell would
    // otherwise disagree with the course list beside it.
    const { container } = renderGrid();
    const cell = mondayCell(container, 0);
    expect(cell).toContain("A");
    expect(cell).not.toContain("A1");
  });

  it("still renders a normal course exactly as before", () => {
    const { container } = renderGrid({
      courses: [course("BCSE101", ["A1"])],
    });
    const cell = mondayCell(container, 0);
    expect(cell).toContain("BCSE101");
    expect(cell).toContain("A1");
  });

  it("shows a law course under a free period as free", () => {
    // Column 10 is Monday 4:45, where the schema says TB2 — an evening slot the
    // law alias must not reach. Counted off the raw theory skeleton, which
    // carries the `lunch: true` spacer at index 6, so the afternoon is shifted.
    const { container } = renderGrid();
    expect(mondayCell(container, 10)).toContain("TB2");
    expect(mondayCell(container, 10)).not.toContain("TLAW524L");
  });

  it("hatches a cell blocked under the law spelling", () => {
    const { container } = renderGrid({ blockedSlots: new Set(["A"]) });
    expect(mondayCell(container, 0)).toContain("Blocked");
  });

  it("hatches a cell blocked under the schema spelling too", () => {
    // The same period, blocked from the vertical view where the chip offered
    // the schema's id.
    const { container } = renderGrid({ blockedSlots: new Set(["A1"]) });
    expect(mondayCell(container, 0)).toContain("Blocked");
  });

  it("hands the toggler the spelling the generator filters by", () => {
    // The generator drops options by the slot on the *course*, so a recorded
    // "A1" would sit in blockedSlots matching nothing.
    let toggled: string | null = null;
    const { container } = renderGrid({
      onToggleBlockSlot: (slot: string) => {
        toggled = slot;
      },
    });
    const clickable = Array.from(
      container.querySelectorAll("tbody tr")[0].children[1].querySelectorAll("div")
    ).find((d) => (d as HTMLElement).className.includes("cursor-pointer"));
    (clickable as HTMLElement).click();
    expect(toggled).toBe("A");
  });

  it("leaves the schema's id on a free cell", () => {
    // Nothing occupies Monday 4:45, so the schema's ids are the only thing on
    // offer — TB2 for the theory half and L34 for the lab — and no course code.
    const { container } = renderGrid();
    const cell = mondayCell(container, 10);
    expect(cell).toContain("TB2");
    expect(cell).toContain("L34");
    expect(cell).not.toContain("TLAW524L");
  });
});
