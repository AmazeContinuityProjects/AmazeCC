import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import FFCSTimetableTab from "../components/custom/exams/FFCSTimetableTab";
import { getFittingStatTileCount } from "../components/custom/exams/FFCS/components/FFCSDashboardHeader";
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
    vi.unstubAllGlobals();
  });

  it("fits as many stat tiles as the available width allows", () => {
    expect(getFittingStatTileCount(155)).toBe(1);
    expect(getFittingStatTileCount(156)).toBe(1);
    expect(getFittingStatTileCount(323)).toBe(1);
    expect(getFittingStatTileCount(324)).toBe(2);
    expect(getFittingStatTileCount(491)).toBe(2);
    expect(getFittingStatTileCount(492)).toBe(3);
    expect(getFittingStatTileCount(659)).toBe(3);
    expect(getFittingStatTileCount(660)).toBe(4);
    expect(getFittingStatTileCount(1200)).toBe(4);
    expect(getFittingStatTileCount(0)).toBe(4);
  });

  it("renders the FFCS planner interface without crashing", () => {
    render(<FFCSTimetableTab />);
    expect(screen.getByText("FFCS Planner")).toBeDefined();
    // The tab's first mount is heavy (its report load, sheets and the planner
    // grid all come up together), so its budget is the suite's, not the 5s
    // default — under a full parallel run the default starves it.
  }, 30_000);

  it("renders the original dashboard in Classic mode", () => {
    storage.setItem("ffcs_layout_mode", "classic");
    render(<FFCSTimetableTab />);

    expect(screen.getByText("Timetable Manager")).toBeDefined();
    expect(screen.getByText("Course Selector")).toBeDefined();
    expect(screen.getByText("Social Score")).toBeDefined();
  }, 30_000);

  it("maps the legacy Revamp preference to Modern", () => {
    storage.setItem("ffcs_layout_mode", "revamp");
    render(<FFCSTimetableTab />);

    expect(screen.getByRole("button", { name: "New Plan" })).toBeDefined();
    expect(screen.queryByText("Timetable Manager")).toBeNull();
  }, 30_000);

  it("shows the overflow statistic in the responsive carousel", async () => {
    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "default",
          name: "Credit Test",
          courses: [
            {
              id: "course-theory",
              code: "CSE2001",
              title: "Course",
              slots: ["A1"],
              faculty: "Faculty One",
              venue: "SJT",
              credits: "3",
              type: "ETH",
              color: "blue",
            },
          ],
        },
      ])
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) {
          this.callback(
            [{ target, contentRect: { width: 324 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver
          );
        }
        unobserve() {}
        disconnect() {}
      }
    );
    render(<FFCSTimetableTab />);

    const carousel = await screen.findByRole("region", { name: "More timetable statistics" });
    expect(carousel.textContent).toContain("Total Credits");
    expect(carousel.textContent).toContain("3 / 27");
  }, 30_000);

  it("hides course-dependent stats for an empty single timetable", () => {
    render(<FFCSTimetableTab />);

    expect(screen.queryByTestId("ffcs-stat-strip")).toBeNull();
    expect(screen.queryByText("Total Credits")).toBeNull();
    expect(screen.queryByText("Weekly Rhythm")).toBeNull();
    expect(screen.queryByText("Active Timetable")).toBeNull();
  }, 30_000);

  it("shows the timetable stat when multiple timetables exist even if they are empty", () => {
    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        { id: "default", name: "Plan One", courses: [] },
        { id: "plan-two", name: "Plan Two", courses: [] },
      ])
    );
    render(<FFCSTimetableTab />);

    expect(screen.getByText("Active Timetable")).toBeDefined();
    expect(screen.queryByText("Total Credits")).toBeNull();
    expect(screen.queryByText("Weekly Rhythm")).toBeNull();
  }, 30_000);

  it("matches the Selected Courses credit total and opens the timetable switcher from its stat", () => {
    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "default",
          name: "Credit Test",
          courses: [
            {
              id: "course-theory",
              code: "CSE2001",
              title: "Course",
              slots: ["A1"],
              faculty: "Faculty One",
              venue: "SJT",
              credits: "3",
              type: "ETH",
              color: "blue",
            },
            {
              id: "course-lab",
              code: "CSE2001",
              title: "Course",
              slots: ["L1"],
              faculty: "Faculty Two",
              venue: "SJT",
              credits: "1",
              type: "ELA",
              color: "red",
            },
          ],
        },
      ])
    );
    render(<FFCSTimetableTab />);

    expect(screen.getByText("Total Credits: 4")).toBeDefined();
    expect(screen.getByText("4 / 27")).toBeDefined();
    const statStrip = screen.getByTestId("ffcs-stat-strip").textContent ?? "";
    expect(statStrip.indexOf("Total Credits")).toBeLessThan(
      statStrip.indexOf("Active Timetable")
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Active Timetable: Credit Test. 2 courses enrolled. Switch timetable.",
      })
    );
    expect(screen.getByRole("heading", { name: "Select Timetable" })).toBeDefined();
  }, 30_000);

  it("shows free half-days in Weekly Rhythm and opens the full schedule details", () => {
    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "default",
          name: "Schedule Test",
          courses: [
            {
              id: "course-theory",
              code: "CSE2001",
              title: "Course",
              slots: ["A1"],
              faculty: "Faculty One",
              venue: "SJT",
              credits: "3",
              type: "ETH",
              color: "blue",
            },
          ],
        },
      ])
    );
    render(<FFCSTimetableTab />);

    const weeklyRhythm = screen.getByRole("button", {
      name: /Weekly Rhythm: 8 free half-days out of 10/,
    });
    expect(weeklyRhythm.textContent).toContain("8 / 10");
    fireEvent.click(weeklyRhythm);

    expect(screen.getByRole("heading", { name: "Weekly Rhythm" })).toBeDefined();
    expect(screen.getAllByText("Free half-days").length).toBeGreaterThan(0);
    expect(screen.getByText("Morning theory")).toBeDefined();
    expect(screen.getByText("Evening theory")).toBeDefined();
    expect(screen.getByText("Latest class end")).toBeDefined();
    expect(screen.getAllByText("Best faculty").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Worst faculty").length).toBeGreaterThan(0);
    const weeklyContent = document.body.textContent ?? "";
    expect(weeklyContent.indexOf("Faculty ratings in this timetable")).toBeLessThan(
      weeklyContent.indexOf("Day-by-day schedule")
    );
    expect(weeklyContent.indexOf("Largest class gaps")).toBeLessThan(
      weeklyContent.indexOf("Faculty average win rate")
    );
  }, 30_000);

  it("hides the clash statistic when there are no clashes", () => {
    render(<FFCSTimetableTab />);

    expect(screen.queryByText("Clash Status")).toBeNull();
  }, 30_000);

  it("lists clashing courses with their faculty and removes the selected course", () => {
    storage.setItem(
      "ffcs_timetables",
      JSON.stringify([
        {
          id: "default",
          name: "Clash Test",
          courses: [
            {
              id: "course-a",
              code: "CSE1001",
              title: "Course A",
              slots: ["A1"],
              faculty: "Faculty One",
              employeeId: "1001",
              venue: "SJT",
              credits: "3",
              type: "ETH",
              color: "blue",
            },
            {
              id: "course-b",
              code: "CSE1002",
              title: "Course B",
              slots: ["A1"],
              faculty: "Faculty Two",
              employeeId: "1002",
              venue: "SJT",
              credits: "3",
              type: "ETH",
              color: "red",
            },
          ],
        },
      ])
    );
    render(<FFCSTimetableTab />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clash Status: 1 clash. View clashing courses.",
      })
    );
    expect(screen.getAllByText("CSE1001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Faculty One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CSE1002").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove CSE1001 — Faculty One" })
    );
    expect(screen.getByText("This timetable has no course or blocked-slot clashes.")).toBeDefined();
  }, 30_000);

  it("shows planner actions as selectable menu rows", () => {
    const { unmount } = render(<FFCSTimetableTab />);

    expect(screen.getByRole("region", { name: "Add Courses widget" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Manually Add Course/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Target Courses/ })).toBeDefined();
    expect(screen.getByRole("region", { name: "Timetable Actions widget" })).toBeDefined();
    expect(JSON.parse(storage.getItem("ffcs_dashboard_widgets") || "[]")).toEqual([
      "add-courses",
      "timetables",
    ]);

    const socialToggle = screen.getByRole("button", { name: /Social & Friends/ });
    fireEvent.click(socialToggle);
    expect(socialToggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Social & Friends widget" })).toBeDefined();
    expect(screen.getByText("Social Overlap")).toBeDefined();

    expect(JSON.parse(storage.getItem("ffcs_dashboard_widgets") || "[]")).toEqual([
      "add-courses",
      "timetables",
      "social",
    ]);

    unmount();
    render(<FFCSTimetableTab />);
    expect(screen.getByRole("region", { name: "Add Courses widget" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Social & Friends widget" })).toBeDefined();
  }, 30_000);

  it("lets the desktop Add Courses menu entry toggle its widget", () => {
    render(<FFCSTimetableTab />);

    const plannerMenu = within(screen.getByRole("navigation", { name: "Planner menu" }));
    const addCourses = plannerMenu.getByRole("button", { name: /Add Courses/ });
    expect(addCourses.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Add Courses widget" })).toBeDefined();

    fireEvent.click(addCourses);
    expect(addCourses.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "Add Courses widget" })).toBeNull();
  }, 30_000);

  it("opens a selected planner widget in a mobile sheet", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    render(<FFCSTimetableTab />);

    fireEvent.click(screen.getByRole("button", { name: /Social & Friends/ }));
    expect(await screen.findByRole("heading", { name: "Social & Friends" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Social & Friends widget" })).toBeDefined();
    expect(screen.queryByRole("region", { name: "Timetable Actions widget" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Add Courses widget" })).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "Planner menu" })).queryByRole("button", {
        name: /^Add Courses$/,
      })
    ).toBeNull();
    expect(screen.getByRole("button", { name: /Manually Add Course/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Social & Friends widget" })).toBeNull();
  }, 30_000);

  it("opens Configure Selected Course in a mobile sheet when a course is selected", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    const csvContent =
      "COURSE CODE,COURSE TITLE,TYPE,CREDITS,SLOT,FACULTY,ROOM,ERP ID\n" +
      "BCSE101,Programming,TH,3,A1,PARTHIBAN V,AB3-101,1001\n";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(csvContent).buffer,
      json: async () => [],
    } as any);

    render(<FFCSTimetableTab />);
    fireEvent.click(screen.getByRole("button", { name: /Manually Add Course/ }));

    fireEvent.click(await screen.findByText("BCSE101", {}, { timeout: 5000 }));

    expect(
      await screen.findByRole("heading", { name: "Configure Selected Course" })
    ).toBeDefined();
    expect(
      screen.getByRole("region", { name: "Configure Selected Course widget" })
    ).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]);
    expect(
      screen.queryByRole("region", { name: "Configure Selected Course widget" })
    ).toBeNull();
  }, 30_000);

  it("puts course-planning actions in the menu and keeps their actions wired", () => {
    render(<FFCSTimetableTab />);

    expect(screen.getByRole("navigation", { name: "Planner menu" })).toBeDefined();
    const manualAdd = screen.getByRole("button", { name: /Manually Add Course/ });
    const targetCourses = screen.getByRole("button", { name: /Target Courses/ });
    expect(manualAdd).toBeDefined();
    expect(targetCourses).toBeDefined();
    expect(screen.getByRole("button", { name: /Auto-Generate/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Paste VTOP/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Advanced Linker/ })).toBeDefined();
    expect(targetCourses.firstElementChild?.className).toContain("text-purple-600");
  }, 30_000);

  it("opens planner settings from the planner menu", () => {
    render(<FFCSTimetableTab />);

    const plannerMenu = within(screen.getByRole("navigation", { name: "Planner menu" }));
    fireEvent.click(plannerMenu.getByRole("button", { name: /Planner Settings/ }));
    expect(screen.getAllByRole("heading", { name: "Planner Settings" })).toHaveLength(2);
    expect(screen.getByText("Ranking profile")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Target Courses/ }));
    expect(screen.getByText(/Select the courses you intend to take/)).toBeDefined();
  }, 30_000);

  it("opens view and course-list switching from Modern menu rows", () => {
    render(<FFCSTimetableTab />);

    expect(screen.queryByTitle("Load the Winter Semester 2026-2027 slot timetable")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Switch Course List/ }));
    expect(screen.getByRole("heading", { name: "Switch Course List" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Previous Semester/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: /Switch Planner View/ }));
    expect(screen.getByText("Choose Your Planner Experience")).toBeDefined();
    expect(screen.getByRole("radio", { name: /Guided Hero/ })).toBeDefined();
  }, 30_000);

  it("renames and deletes timetables inside the Select Timetable sheet", () => {
    // jsdom's confirm exists but answers "no" forever. Every delete rides on
    // the tab's own handler, so the user's yes is the one decision faked here
    // — and the spy doubles as the pin that the ask still happens.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<FFCSTimetableTab />);

    // A second timetable, so the sheet has a row to rename and a deletable
    // one without tripping the one-timetable floor. "New Plan" from the
    // dashboard header makes the fresh table active, so the picker below is
    // named for it. The name is scoped with ^ because the accessible name
    // carries the trailing course count next to it.
    fireEvent.click(screen.getByRole("button", { name: "New Plan" }));
    fireEvent.click(screen.getByTitle("Switch or manage saved timetables"));

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

    // Open Course Search from its menu item.
    fireEvent.click(screen.getByRole("button", { name: /Manually Add Course/ }));

    // Pick BCSE101 from modal
    const courseOption = await screen.findByText("BCSE101", {}, { timeout: 5000 });
    fireEvent.click(courseOption);
    expect(screen.getByRole("region", { name: "Configure Selected Course widget" })).toBeDefined();
    expect(screen.getByText("Faculty, slots & timetable conflicts")).toBeDefined();
    expect(screen.getAllByText(/A1/).length).toBeGreaterThan(0);

    // Step 2 appears, open Slot Search
    const chooseSlotBtn = await screen.findByText(
      "Click to choose slot & faculty option...",
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

    // Open the planner-view menu sheet, choose Guided, and apply it.
    fireEvent.click(screen.getByRole("button", { name: /Switch Planner View/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Guided Hero/ }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to Guided Hero Mode" }));

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
