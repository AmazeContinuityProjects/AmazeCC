import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AddedCourse, TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import chennai from "../data/campus/chennai.json";
import VerticalTimetableGrid from "../components/custom/timetable/VerticalTimetableGrid";

/**
 * The projection tests in `timetable-vertical.test.ts` prove the data is right.
 * These prove the *markup* is right, which is a different failure mode: a
 * `rowSpan` that never reaches the DOM, a covered band that still emits a `<td>`,
 * or a tap that never reaches the cell. All three render as a plausible-looking
 * table and are invisible to a pure-function test.
 */

const THEORY = chennai.theory as TimetablePeriod[];
const LAB = chennai.lab as TimetablePeriod[];
const MON = [{ id: "mon", name: "MON" }];

function course(id: string, slots: string[]): AddedCourse {
  return {
    id,
    code: id.toUpperCase(),
    title: `Course ${id}`,
    slots,
    faculty: "Dr Someone",
    venue: "AB1-101",
    credits: "3",
    type: "",
    color: "bg-blue-600",
  };
}

/** The `<tr>` for a band index. Rows come out of `<tbody>` in band order. */
function bandRow(container: HTMLElement, index: number): HTMLTableRowElement {
  return container.querySelectorAll("tbody tr")[index] as HTMLTableRowElement;
}

/** The `<tr>` whose sticky-left gutter says `label`, or null. */
function rowFor(container: HTMLElement, start: string): HTMLTableRowElement | null {
  const rows = Array.from(
    container.querySelectorAll("tbody tr")
  ) as HTMLTableRowElement[];
  return rows.find((tr) => tr.querySelector("th")?.textContent?.includes(start)) ?? null;
}

const cellButtons = (row: HTMLTableRowElement) =>
  Array.from(row.querySelectorAll("td button"));

describe("the table geometry a merged run produces", () => {
  it("emits rowSpan=3 on the run and leaves the bands it covers with no cells", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("ela", ["L1", "L2", "L3"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );

    const merged = cellButtons(rowFor(container, "8:00 AM")!);
    expect(merged).toHaveLength(1);
    expect(merged[0].closest("td")!.getAttribute("rowspan")).toBe("3");
    expect(merged[0].textContent).toContain("L1+L2+L3");

    // The rows themselves still exist — a rowspan leaves those positions empty
    // in the following rows rather than deleting them — but a stray <td> would
    // push every later cell one column out of alignment. Located by band index,
    // since the gutter no longer names a time there.
    for (const index of [1, 2]) {
      const row = bandRow(container, index);
      expect(`band${index}:${row.querySelectorAll("td").length}`).toBe(`band${index}:0`);
      // With a single day, those bands belong to the class above, so the gutter
      // must not imply a period starts there.
      expect(row.querySelector("th")?.textContent?.trim()).toBe("···");
    }
    // ...and the next unrelated band is still there, aligned to the gutter.
    expect(cellButtons(rowFor(container, "10:45 AM")!)).toHaveLength(1);
  });

  it("keeps the gutter labelled where only some days are covered", () => {
    const days = [
      { id: "mon", name: "MON" },
      { id: "tue", name: "TUE" },
    ];
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("ela", ["L1", "L2", "L3"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={days}
      />
    );
    // Tuesday holds nothing, so its 08:55 band is a real, separate period and
    // the shared gutter has to keep saying so.
    const row = rowFor(container, "8:55 AM")!;
    expect(row.querySelector("th")?.textContent).toContain("8:55 AM");
    expect(row.querySelectorAll("td")).toHaveLength(1);
  });

  it("makes a merged tile fill its whole rowSpan, so the run is one block", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("ela", ["L1", "L2", "L3"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );

    const tile = cellButtons(rowFor(container, "8:00 AM")!)[0];
    const cell = tile.closest("td")!;

    // The tile is absolutely positioned, so its <td> has to be a containing
    // block — otherwise it stretches to the whole page and the run stops being
    // one coloured block. `p-0` alone does not establish that.
    expect(cell.className).toContain("relative");
    expect(tile.className).toContain("absolute");
    expect(tile.className).toContain("inset-0");
    // And the tile must not also carry align-top, which is what used to strand
    // it at the top of the span with empty space beneath.
    expect(cell.className).not.toContain("align-top");
  });

  it("keeps one cell per band when nothing merges", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("eth", ["A1"]), course("sth", ["F1"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );
    for (const start of ["8:00 AM", "8:55 AM", "9:50 AM", "10:45 AM"]) {
      const cells = rowFor(container, start)!.querySelectorAll("td");
      expect(`${start}:${cells.length}`).toBe(`${start}:1`);
      // A redundant rowspan="1" would be noise in a printout.
      expect(cells[0].getAttribute("rowspan")).toBeNull();
    }
  });

  it("renders the lunch spacer as one full-width divider, not a cell", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );
    const lunch = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.querySelector("th")?.textContent?.includes("Lunch")
    )!;
    expect(lunch).toBeTruthy();
    const tds = lunch.querySelectorAll("td");
    expect(tds).toHaveLength(1);
    expect(tds[0].getAttribute("colspan")).toBe("1");
    expect(lunch.querySelector("button")).toBeNull();
  });

  it("emits exactly one column per day in every non-lunch row", () => {
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((id) => ({
      id,
      name: id.toUpperCase(),
    }));
    const { container } = render(
      <VerticalTimetableGrid courses={[]} theoryPeriods={THEORY} labPeriods={LAB} days={days} />
    );
    const rows = Array.from(container.querySelectorAll("tbody tr")).filter(
      (tr) => !tr.querySelector("th")?.textContent?.includes("Lunch")
    );
    // 13 theory periods, one of which is the lunch spacer.
    expect(rows).toHaveLength(12);
    for (const tr of rows) {
      const sum = Array.from(tr.querySelectorAll("td")).reduce(
        (n, td) => n + Number(td.getAttribute("rowspan") ?? 1),
        0
      );
      expect(sum).toBe(days.length);
    }
  });
});

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((id) => ({
  id,
  name: id.toUpperCase(),
}));

describe("the compact density", () => {
  it("never shows the course code, and says nothing in a free cell", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("eth", ["A1"]), course("ela", ["L1", "L2", "L3"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        compact
      />
    );

    // Monday 08:00 is a lab-precedence collision, so the cell carries L1's
    // course and the theory is in the shadow list. Neither code may be on screen.
    expect(container.textContent).not.toContain("ELA");
    expect(container.textContent).not.toContain("ETH");

    // The occupied cell still names every slot in the run, stacked down the
    // tile so each one survives a 36px column. It used to read "L1 +2", which
    // hid which slots those were.
    const merged = cellButtons(rowFor(container, "8:00")!)[0];
    const stacked = Array.from(
      merged.querySelectorAll("span span")
    ).map((el) => el.textContent);
    expect(stacked).toEqual(["L1", "+L2", "+L3"]);
    expect(merged.textContent).toBe("L1+L2+L3");
  });

  it("leaves free and gap cells with no text at all", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        compact
      />
    );
    // Not even the "—" placeholder the full density shows.
    expect(container.textContent).not.toContain("—");
    expect(container.textContent).not.toContain("L1 / A1");
    for (const button of Array.from(container.querySelectorAll("td button"))) {
      expect(button.textContent).toBe("");
    }
  });

  it("fits the viewport rather than scrolling: table-fixed and no overflow", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={WEEK}
        compact
      />
    );
    const table = container.querySelector("table")!;
    // Under `table-fixed` the browser sizes columns from their declared widths
    // and ignores content, so seven days cannot push the table wider than this.
    expect(table.className).toContain("table-fixed");
    expect(table.className).toContain("w-full");

    // And the wrapper is not a scrollport, which is what keeps `sticky top-0`
    // on the day header bound to the sheet instead of a box that cannot scroll.
    const wrapper = table.parentElement!;
    expect(wrapper.className).not.toContain("overflow");
  });

  it("still scrolls in full density, where a second line per cell needs room", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={WEEK}
      />
    );
    const table = container.querySelector("table")!;
    expect(table.className).not.toContain("table-fixed");
    expect(table.parentElement!.className).toContain("overflow-x-auto");
  });

  it("scales with the viewport rather than overflowing at any column count", () => {
    for (const count of [1, 5, 7]) {
      const { container, unmount } = render(
        <VerticalTimetableGrid
          courses={[]}
          theoryPeriods={THEORY}
          labPeriods={LAB}
          days={WEEK.slice(0, count)}
          compact
        />
      );
      // `table-fixed` + `w-full` means the day columns absorb whatever width is
      // left after the fixed gutter, so no count can push the table past its
      // container. The gutter is the only sized column.
      const headers = container.querySelectorAll("thead th");
      expect(headers[0].getAttribute("class")).toContain("w-12");
      for (let i = 1; i < count; i++) {
        expect(headers[i].getAttribute("class")).not.toContain("w-");
      }
      unmount();
    }
  });

  it("shows only the start time in the gutter, with no end time", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        compact
      />
    );
    const gutter = rowFor(container, "8:00")!.querySelector("th")!;
    expect(gutter.textContent).toBe("8:00");
    // The full view has both, so this is a real difference and not an artefact.
    const full = render(
      <VerticalTimetableGrid
        courses={[]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );
    expect(full.container.textContent).toContain("8:00 AM");
    expect(full.container.textContent).toContain("8:50 AM");
  });

  it("still tappable, and still opens the sheet, with no text to aim at", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("eth", ["A1"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        compact
      />
    );
    fireEvent.click(cellButtons(rowFor(container, "8:00")!)[0]);
    expect(document.body.textContent).toContain("Course eth");
  });
});

describe("a tap", () => {
  it("opens the detail sheet when there is no block handler", () => {
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("eth", ["A1"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
      />
    );

    expect(screen.queryByText(/Course eth/)).toBeNull();
    fireEvent.click(cellButtons(rowFor(container, "8:00 AM")!)[0]);

    const sheet = document.querySelector('[role="dialog"]') ?? document.body;
    expect(sheet.textContent).toContain("MON");
    expect(sheet.textContent).toContain("Course eth");
    expect(sheet.textContent).toContain("Dr Someone");
  });

  it("toggles the block instead, and does not open a sheet, when there is one", () => {
    const toggle = vi.fn();
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("eth", ["A1"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        onToggleBlockSlot={toggle}
      />
    );

    fireEvent.click(cellButtons(rowFor(container, "8:00 AM")!)[0]);

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledWith("A1");
    expect(document.body.textContent).not.toContain("Dr Someone");
  });

  it("blocks the run's first slot, so a merged lab is still individually ruleable", () => {
    const toggle = vi.fn();
    const { container } = render(
      <VerticalTimetableGrid
        courses={[course("ela", ["L1", "L2", "L3"])]}
        theoryPeriods={THEORY}
        labPeriods={LAB}
        days={MON}
        onToggleBlockSlot={toggle}
      />
    );

    fireEvent.click(cellButtons(rowFor(container, "8:00 AM")!)[0]);
    expect(toggle).toHaveBeenCalledWith("L1");
  });
});
