import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CommonFreeTimetableGrid from "../components/custom/social/CommonFreeTimetableGrid";
import type { BusyMap } from "../lib/social/types";

/**
 * The common-free grid is now a timetable: days across the top, time bands
 * down the left.
 *
 * The projection tests in `social-grid.test.ts` prove the *bands* are right.
 * These prove the *shape* is right and that the count means what it says —
 * the two things a timetable-shaped grid can get wrong that a pure-function
 * test cannot see.
 */

/** Monday band 0 is theory `A1` and lab `L1`, both 08:00-08:50. */
const MON_FIRST = "MON 8:00-8:50";

const me: BusyMap = {
  "MON:A1": { c: "CS101", t: "Intro to CS", v: "AB1-101" },
};

/** Busy in BOTH halves of Monday's first band. */
const bothHalves: BusyMap = {
  "MON:A1": { c: "MA201", t: "Maths", v: "AB1-202" },
  "MON:L1": { c: "ME203", t: "Mech Lab", v: "LAB-1" },
};

const freePeer: BusyMap = {
  "MON:F1": { c: "CS102", t: "Another course", v: "AB1-303" },
};

const peers = [
  { handle: "AMZ-AAAA", name: "Neha", busyMap: bothHalves, visibility: "full" as const, loaded: true },
  { handle: "AMZ-BBBB", name: "Aarav", busyMap: freePeer, visibility: "full" as const, loaded: true },
];

function renderGrid() {
  return render(<CommonFreeTimetableGrid ownBusyMap={me} peers={peers} />);
}

describe("the grid is a timetable", () => {
  it("puts the days across the top and the time bands down the left", () => {
    const { container } = renderGrid();

    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim()
    );
    // A gutter, then one column per day. Today's column also carries the date
    // under its name, so only the name is compared.
    expect(headers[0]).toBe("Time");
    expect(headers.slice(1, 8).map((h) => h?.slice(0, 3))).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);

    // One row per band of the week, each labelled with its start time.
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(12);
    expect(rows[0].querySelector("th")?.textContent).toContain("8:00 AM");
  });

  it("shows the free count over the number of people it is counted against", () => {
    renderGrid();

    // Me and Neha are busy in Monday's first band, Aarav is free: 1 of 3.
    const cell = screen.getByLabelText(`${MON_FIRST} — 1 of 3 free`);
    expect(cell.textContent).toBe("1/3");
  });

  it("counts a person once, however many halves of the band they hold", () => {
    renderGrid();

    // Neha holds both `A1` and `L1`, which sit at the same time on Monday.
    // Counting (person, slot) pairs would call this "0 of 3 free"; a band is
    // one period of a person's day, so she is busy and Aarav is not.
    expect(screen.getByLabelText(`${MON_FIRST} — 1 of 3 free`)).toBeTruthy();
    expect(screen.queryByLabelText(`${MON_FIRST} — 0 of 3 free`)).toBeNull();
  });
});

describe("a tap", () => {
  it("opens the sheet and says who is busy and who is free", () => {
    renderGrid();

    fireEvent.click(screen.getByLabelText(`${MON_FIRST} — 1 of 3 free`));

    const body = document.body.textContent ?? "";
    expect(body).toContain("Neha");
    expect(body).toContain("Aarav");
    expect(body).toContain("1 of 3 free");
    // Neha appears once, not once per half she holds.
    expect(body.match(/Neha/g)?.length).toBe(1);
  });

  it("opens the peer's own sheet from a name in the detail", () => {
    const opened: string[] = [];
    render(
      <CommonFreeTimetableGrid
        ownBusyMap={me}
        peers={peers}
        onOpenPeer={(handle) => opened.push(handle)}
      />
    );

    fireEvent.click(screen.getByLabelText(`${MON_FIRST} — 1 of 3 free`));
    const name = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Neha"
    );
    expect(name).toBeTruthy();
    fireEvent.click(name!);

    expect(opened).toEqual(["AMZ-AAAA"]);
  });
});

describe("the day filter", () => {
  it("hides the other days rather than blanking their cells", () => {
    const { container } = renderGrid();

    const toggle = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "TUE"
    );
    fireEvent.click(toggle!);

    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim()
    );
    expect(headers).toEqual(["Time", "TUE"]);
    // The bands are still the whole week's — only the columns changed.
    expect(container.querySelectorAll("tbody tr")).toHaveLength(12);
  });
});
