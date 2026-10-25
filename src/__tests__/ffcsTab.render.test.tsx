import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FFCSTimetableTab from "../components/custom/exams/FFCSTimetableTab";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import { installLocalStorage, stubScrollIntoView } from "./helpers/localStorage";

// The tab persists its lists through `safeStorage`; this jsdom environment
// ships without a localStorage, so the repo stub fills it in — the same shape
// the generator subpage's tests use.
const storage = installLocalStorage();
stubScrollIntoView();

describe("FFCSTimetableTab", () => {
  afterEach(() => {
    // The overlay stack is module-global: a sheet left open by one test must
    // not sit under the next test's feet.
    while (closeTopOverlayFromPop()) {
      /* drain */
    }
    storage.clear();
    vi.restoreAllMocks();
  });

  it("renders the FFCS planner interface without crashing", () => {
    render(<FFCSTimetableTab />);
    expect(screen.getByText("FFCS Planner")).toBeDefined();
    // The tab's first mount is heavy (its report load, sheets and the planner
    // grid all come up together), so its budget is the suite's, not the 5s
    // default — under a full parallel run the default starves it.
  }, 30_000);

  it("renames and deletes timetables inside the Select Timetable sheet", () => {
    // jsdom's confirm exists but answers "no" forever. Every delete rides on
    // the tab's own handler, so the user's yes is the one decision faked here
    // — and the spy doubles as the pin that the ask still happens.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<FFCSTimetableTab />);

    // A second timetable, so the sheet has a row to rename and a deletable
    // one without tripping the one-timetable floor. "New" from the header
    // makes the fresh table active, so the picker below is named for it.
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("button", { name: /Timetable 2/ }));

    // Every row carries its own Rename and Delete next to the select area.
    fireEvent.click(screen.getByTitle("Rename Timetable 2"));
    const input = screen.getByLabelText("Timetable name") as HTMLInputElement;
    expect(input.value).toBe("Timetable 2");
    fireEvent.change(input, { target: { value: "  Weekend Plan  " } });
    // Enter commits, and the trim rule drops the padding the same way the
    // header's rename does.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getAllByText("Weekend Plan").length).toBeGreaterThan(0);
    expect(screen.queryByText("Timetable 2")).toBeNull();

    // Delete asks before acting, then acts while the sheet stays open —
    // managing the list is what the sheet is for now.
    fireEvent.click(screen.getByTitle("Delete Weekend Plan"));
    expect(confirmSpy).toHaveBeenCalledWith("Are you sure you want to delete this timetable?");
    expect(screen.queryByText("Weekend Plan")).toBeNull();
    // The deleted row was the active one, so the radio falls back to the
    // first remaining table inside the sheet rather than after a reopen.
    expect(screen.getByTitle("Delete Timetable 1")).toBeDefined();

    // The one-timetable floor holds from the sheet too: no dialog on the
    // blocked attempt, a banner says why, and the row survives.
    fireEvent.click(screen.getByTitle("Delete Timetable 1"));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("You must have at least one timetable.")).toBeDefined();
    // Same heavy-mount budget as the smoke test above.
  }, 30_000);

  it("renders the faculty count badge in Selected Courses table and opens SlotFacultySwapSheet", async () => {
    const csvContent =
      "COURSE CODE,COURSE TITLE,TYPE,CREDITS,SLOT,FACULTY,ROOM,ERP ID\n" +
      "BCSE101,Programming,TH,3,A1,PARTHIBAN V,AB3-101,1001\n" +
      "BCSE101,Programming,TH,3,A1,SURESH K,AB3-102,1002\n";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(csvContent).buffer,
    } as any);

    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "1",
          name: "Timetable 1",
          courses: [
            {
              id: "c-1",
              code: "BCSE101",
              title: "Programming",
              type: "TH",
              credits: "3",
              slots: ["A1"],
              venue: "AB3-101",
              faculty: "PARTHIBAN V",
              employeeId: "1001",
              color: "bg-blue-600",
            },
          ],
        },
      ])
    );
    storage.setItem("ffcs_activeTimetableId", "1");

    render(<FFCSTimetableTab />);

    // Wait for async loadSemesterReport
    const badges = await screen.findAllByTitle(
      /2 (drop-in replacements|faculties teaching this slot)/,
      {},
      { timeout: 10000 }
    );
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].textContent).toContain("2");

    // Click the badge to open SlotFacultySwapSheet
    fireEvent.click(badges[0]);

    // Should open sheet and display download button and guide
    expect(screen.getByText("Switch Faculty")).toBeTruthy();
    expect(screen.getByText("How to Pick It Out in FFCS:")).toBeTruthy();
    expect(screen.getByTestId("download-faculty-jpeg-btn")).toBeTruthy();
    expect(screen.getAllByText("SURESH K").length).toBeGreaterThan(0);

    // Click SURESH K to swap faculty
    fireEvent.click(screen.getAllByText("SURESH K")[0]);

    // Timetable should now reflect SURESH K
    expect(screen.getAllByText("SURESH K").length).toBeGreaterThan(0);
  }, 30_000);

  it("renders the faculty count badge in the Search Slot & Faculty selector modal", async () => {
    const csvContent =
      "COURSE CODE,COURSE TITLE,TYPE,CREDITS,SLOT,FACULTY,ROOM,ERP ID\n" +
      "BCSE101,Programming,TH,3,A1,PARTHIBAN V,AB3-101,1001\n" +
      "BCSE101,Programming,TH,3,A1,SURESH K,AB3-102,1002\n";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(csvContent).buffer,
    } as any);

    render(<FFCSTimetableTab />);

    // Open Course Search
    const chooseCourseBtn = await screen.findByText(
      "-- Search & Choose Course --",
      {},
      { timeout: 5000 }
    );
    fireEvent.click(chooseCourseBtn);

    // Pick BCSE101 from modal
    const courseOption = await screen.findByText("BCSE101", {}, { timeout: 5000 });
    fireEvent.click(courseOption);

    // Step 2 appears, open Slot Search
    const chooseSlotBtn = await screen.findByText(
      "-- Search & Choose Slot --",
      {},
      { timeout: 5000 }
    );
    fireEvent.click(chooseSlotBtn);

    // Search Slot & Faculty modal is open
    expect(screen.getByText("Search Slot & Faculty")).toBeTruthy();

    // Verify faculty count badges appear in the slot list
    const slotFacultyBadges = screen.getAllByTitle("2 faculties teaching this slot");
    expect(slotFacultyBadges.length).toBeGreaterThan(0);
    expect(slotFacultyBadges[0].textContent).toContain("2");
  }, 30_000);

  it("shows alternative faculty count for embedded theory groups added via VTOP paste and allows switching", async () => {
    const csvContent =
      "COURSE CODE,COURSE TITLE,TYPE,CREDITS,SLOT,FACULTY,ROOM,ERP ID\n" +
      "BCSE202L,Database Systems,ETH,3,F1+TF1,DR ALICE,SJT101,2001\n" +
      "BCSE202L,Database Systems,ELA,1,L23+L24,DR ALICE,SJT102,2001\n" +
      "BCSE202L,Database Systems,ETH,3,F1+TF1,DR BOB,SJT103,2002\n" +
      "BCSE202L,Database Systems,ELA,1,L31+L32,DR BOB,SJT104,2002\n";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(csvContent).buffer,
    } as any);

    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "1",
          name: "Timetable 1",
          courses: [
            {
              id: "c-eth",
              code: "BCSE202L",
              title: "Database Systems",
              type: "Embedded Theory",
              credits: "3",
              slots: ["F1", "TF1"],
              venue: "SJT101",
              faculty: "DR ALICE",
              employeeId: "2001",
              color: "bg-blue-600",
            },
          ],
        },
      ])
    );
    storage.setItem("ffcs_activeTimetableId", "1");

    render(<FFCSTimetableTab />);

    // Wait for async loadSemesterReport and find faculty count badge
    const badges = await screen.findAllByTitle(/2 faculties teaching this slot/);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].textContent).toContain("2");

    // Click the badge to open SlotFacultySwapSheet
    fireEvent.click(badges[0]);

    // Should open sheet and display DR BOB as alternative
    expect(screen.getByText("Switch Faculty")).toBeTruthy();
    expect(screen.getAllByText("DR BOB").length).toBeGreaterThan(0);

    // Click DR BOB to swap faculty
    fireEvent.click(screen.getAllByText("DR BOB")[0]);

    // Timetable should now reflect DR BOB
    expect(screen.getAllByText("DR BOB").length).toBeGreaterThan(0);
  }, 30_000);

  it("automatically greets the user with full-screen hero when clicking on Guided, removing legacy banner and grid", async () => {
    render(<FFCSTimetableTab />);

    // Initially in modern mode: timetable grid is in DOM
    expect(document.getElementById("ffcs-timetable-grid")).not.toBeNull();

    // Click on Guided in the layout SegmentedControl
    const guidedButton = screen.getByTitle("Step-by-step mobile-first course selector");
    fireEvent.click(guidedButton);

    // Should display Guided Hero with full-screen exit button and mode selection
    expect(screen.getByTitle("Exit Fullscreen")).toBeDefined();
    expect(screen.getByText("Choose Creation Mode")).toBeDefined();

    // Legacy banner card and controls must NOT be present
    expect(screen.queryByText("Guided Flow")).toBeNull();
    expect(screen.queryByText("Full-Screen Course Adder")).toBeNull();

    // Standard timetable grid must NOT be rendered in guided mode
    expect(document.getElementById("ffcs-timetable-grid")).toBeNull();

    // Clicking Single Page View restores modern layout and timetable grid
    const singlePageViewBtn = screen.getByTitle("Switch to Single Page View");
    fireEvent.click(singlePageViewBtn);

    expect(document.getElementById("ffcs-timetable-grid")).not.toBeNull();
  }, 30_000);
});
