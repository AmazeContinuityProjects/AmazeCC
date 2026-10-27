import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  FFCSGeneratorSubpage,
  type FFCSGeneratorSubpageProps,
} from "../components/custom/exams/FFCS/FFCSGeneratorSubpage";
import { closeTopOverlayFromPop, hasOpenOverlays } from "../lib/overlayStack";
import { FFCSSettingsDefaults } from "../lib/ffcsSettings";
import { periodsForSlot, type SlotPeriod } from "../lib/slots";
import chennai from "../data/campus/chennai.json";
import type { CourseLock, ParsedCourse } from "../components/custom/exams/FFCS/types";
import { installLocalStorage } from "./helpers/localStorage";
import {
  clearSessionPreferences,
  loadSessionPreferences,
  saveSessionPreferences,
} from "../lib/ffcsGeneratorSessionPrefs";

// The generator persists its private picks under "ffcs_generator_targets", and
// this jsdom environment ships without a localStorage — the repo stub fills it
// in for both `window`'s (which `safeStorage` guards) and `globalThis`'s.
const storage = installLocalStorage();

/**
 * The generator as a subpage of the FFCS tab rather than a sheet over it.
 *
 * What is worth pinning here is everything that changed when the wrapper did.
 * It keeps every piece of planner state the tab passes down, so the screen is
 * reached and left without anything being copied, serialised or re-fetched —
 * and that is exactly the part no other test can see.
 *
 * Two behaviours regress quietly without a test, and both are pinned here:
 *
 * - the run's own messages ("Found N… review them below!") used to be written
 *   into the *planner's* banner, behind the sheet, and outlived the results
 *   they pointed at; they now render on the screen that produces them.
 * - system back is not a sheet's dismissal any more. The subpage registers
 *   itself with the overlay stack instead, which is what turns the OS gesture
 *   into "return to the planner".
 */

const courseLock = (code: string) => ({
  code,
  title: `${code} course`,
  allowedSlots: [],
  allowedFaculty: [],
});

/**
 * Slot ids derived from the schema, never written by hand — a slot that
 * "looks free" but quietly runs on a second day is how a fixture drifts from
 * the solver. Same approach as the streaming test, so both files read the
 * same truth about the campus.
 */
const declaredSlotIds = (): string[] => {
  const ids = new Set<string>();
  for (const period of [...(chennai.theory ?? []), ...(chennai.lab ?? [])]) {
    for (const slot of Object.values(period?.days ?? {})) {
      if (slot) ids.add(String(slot));
    }
  }
  return [...ids].sort();
};

const collide = (a: SlotPeriod[], b: SlotPeriod[]): boolean =>
  a.some((x) =>
    b.some((y) => x.day === y.day && Math.max(x.startMin, y.startMin) < Math.min(x.endMin, y.endMin))
  );

const nonClashingSlots = (count: number): string[] => {
  const chosen: string[] = [];
  const windows: SlotPeriod[][] = [];
  for (const id of declaredSlotIds()) {
    const periods = periodsForSlot(chennai as never, id);
    if (!periods.length) continue;
    // Fully inside the generator's own default time window (08:00–19:30):
    // a slot the run window would filter out cannot participate in the
    // arithmetic the test asserts on.
    const inRunWindow = periods.every((p) => p.startMin >= 480 && p.endMin <= 1170);
    if (!inRunWindow) continue;
    if (windows.some((taken) => collide(taken, periods))) continue;
    chosen.push(id);
    windows.push(periods);
    if (chosen.length === count) break;
  }
  return chosen;
};

const courseRow = (code: string, slot: string, room: string): ParsedCourse => ({
  CODE: code,
  TITLE: "Course",
  TYPE: "TH",
  CREDITS: "3",
  ROOM: room,
  SLOT: slot,
  FACULTY: "Dr Someone",
});

const props = (over: Partial<FFCSGeneratorSubpageProps> = {}): FFCSGeneratorSubpageProps => ({
  onClose: vi.fn(),
  settings: FFCSSettingsDefaults,
  courseLocks: [],
  friends: [],
  socialScoreGroupMethod: "cumulative",
  friendGroups: [],
  masterCourses: [],
  blockedSlots: new Set<string>(),
  timetables: [{ id: "default", name: "Timetable 1", courses: [] }],
  setTimetables: vi.fn(),
  setActiveTimetableId: vi.fn(),
  error: null,
  setError: vi.fn(),
  successMsg: null,
  setSuccessMsg: vi.fn(),
  renderTypeChips: () => null,
  getGroupedCourses: () => [],
  generatorDisplayCourses: [],
  theoryPeriods: [],
  labPeriods: [],
  toggleBlockSlot: vi.fn(),
  ...over,
});

const generateButton = () =>
  screen.getAllByRole("button", { name: /generate timetables/i })[0] as HTMLButtonElement;

/**
 * The target-course row's checkbox, without an accessible name of its own.
 *
 * Scoped through the course row itself because the screen carries several
 * other checkboxes (`sr-only` inputs inside its segmented controls). Modern
 * mode also repeats selected codes in the summary pane, so we take the row
 * that owns a checkbox.
 */
const courseCheckbox = () =>
  {
    const row = screen
      .getAllByText("BCSE101")
      .map((node) => node.closest("label"))
      .find((label) => label?.querySelector("input[type='checkbox']"));
    return (row?.querySelector("input[type='checkbox']") ?? null) as HTMLInputElement | null;
  };

describe("FFCSGeneratorSubpage", () => {
  afterEach(() => {
    // The overlay stack is module-global. An entry leaked by one test would
    // make the next test's system-back assertion pass for the wrong reason.
    while (closeTopOverlayFromPop()) {
      /* drain */
    }
    // So is the generator's private picks key: one test's tick must not seed
    // another test's mount.
    storage.clear();
    clearSessionPreferences();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders as the tab's screen, with the layout's own back chrome", () => {
    render(<FFCSGeneratorSubpage {...props()} />);

    // Twice, not once: the layout draws a mobile header and a desktop one.
    expect(screen.getAllByText("Advanced Timetable Generator").length).toBeGreaterThan(0);
    // Back comes from the layout, not from a sheet's X: `SubpageLayout` is the
    // only thing on this screen that renders a back control.
    expect(hasOpenOverlays()).toBe(true);
  });

  it("lets the generator and its content use the available viewport width", () => {
    const { container } = render(<FFCSGeneratorSubpage {...props()} />);

    const shell = Array.from(container.querySelectorAll("div")).find((element) =>
      element.className.includes("!max-w-none")
    );
    const contentGrid = Array.from(container.querySelectorAll("div")).find((element) =>
      element.className.includes("minmax(220px,0.8fr)")
    );

    expect(shell).toBeDefined();
    expect(shell?.className).toContain("px-4");
    expect(contentGrid?.className).toContain("w-full");
    expect(contentGrid?.className).toContain("max-w-none");
    expect(contentGrid?.className).toContain("lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]");
    expect(container.querySelector(".max-w-6xl")).toBeNull();
  });

  it("opens the generator view switcher from the menu entry", () => {
    render(<FFCSGeneratorSubpage {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: /Switch Generator View/i }));
    expect(screen.getByText("Choose Your Generator Experience")).toBeDefined();
    fireEvent.click(screen.getByRole("radio", { name: /Classic full form/ }));
    fireEvent.click(screen.getByRole("button", { name: /Switch to Classic full form/ }));

    expect(storage.getItem("ffcs_generator_view_mode")).toBe("classic");
    expect(screen.getByRole("button", { name: /Switch Generator View/i })).toBeDefined();
    expect(screen.queryByText("Choose Your Generator Experience")).toBeNull();
  });

  it("fits generator stats into a planner-style strip with an overflow carousel", async () => {
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

    render(<FFCSGeneratorSubpage {...props()} />);

    const strip = await screen.findByTestId("ffcs-generator-stat-strip");
    expect(strip.getAttribute("aria-label")).toBe("Generator statistics");
    // At ~324px only one 280px track fits, so the planner rule parks every
    // tile in the overflow carousel (same behaviour as the planner strip).
    const carousel = await within(strip).findByRole("region", {
      name: "More generator statistics",
    });
    expect(carousel.textContent).toMatch(
      /Target courses|Blocked slots|Friend matches|Options found/
    );
  });

  it("lets users re-rank factors and override boundary filters before generating", () => {
    render(<FFCSGeneratorSubpage {...props()} />);

    // One ranked list replaces the old sort/profile pickers.
    expect(screen.getByText("What matters most")).toBeDefined();
    expect(screen.queryByText("Sort Timetables By")).toBeNull();
    expect(screen.queryByText("Combined Ranking Priority")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Move Faculty quality up" }));
    fireEvent.click(screen.getByRole("switch", { name: "Time with friends enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Move DA up" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum Overall W %" }), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^250$/ }));

    expect(screen.getByRole("switch", { name: "Time with friends enabled" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("spinbutton", { name: "Minimum Overall W %" })).toHaveProperty(
      "value",
      "80"
    );
    expect(loadSessionPreferences()).toMatchObject({
      rankingFactorOrder: [
        "gaps",
        "halfdays",
        "faculty",
        "balancedLoad",
        "social",
        "earlyFinish",
        "lateStart",
        "time",
      ],
      rankingFactorDisabled: ["social"],
      facultyMetricOrder: ["wPct", "da", "lecture", "vibe"],
      facultyMetricWeights: { da: 4 },
      facultyScoreFilters: { minWPct: 80 },
      resultCap: 250,
    });
  });

  it("uses slot-based time pickers and allows independent day end limits", () => {
    render(
      <FFCSGeneratorSubpage
        {...props({
          theoryPeriods: chennai.theory,
          labPeriods: chennai.lab,
        })}
      />
    );

    expect(screen.queryByLabelText("Min Start Time")).toBeNull();
    expect(screen.queryByLabelText("Max End Time")).toBeNull();
    const mondayLimit = screen.getByRole("switch", { name: "Monday end-time limit" });
    expect(mondayLimit.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(mondayLimit);
    expect(mondayLimit.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Day-specific class end times")).toBeDefined();
  });

  it("offers and remembers per-run lab scheduling rules", () => {
    render(<FFCSGeneratorSubpage {...props()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /At most one lab class per day/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Avoid consecutive lab slots/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Treat lunch as a break/i }));

    expect(loadSessionPreferences()).toMatchObject({
      separateLabDays: true,
      avoidConsecutiveLabs: true,
      lunchBreakSeparatesLabs: true,
    });
  });

  it("holds generate back until a course is picked, and keeps the pick private", () => {
    const courses = [{ code: "BCSE101", title: "Structured Programming", types: [] as string[] }];
    const { unmount } = render(<FFCSGeneratorSubpage {...props({ generatorDisplayCourses: courses })} />);

    expect(generateButton().disabled).toBe(true);

    // Tick the course in the generator's own list. This used to create a
    // CourseLock the moment it flipped — a Target Courses entry outside, and a
    // persisted one at that — which is the leak this state no longer shares.
    fireEvent.click(courseCheckbox());
    expect(generateButton().disabled).toBe(false);
    expect(document.body.textContent).toContain("Selected: 1 target courses");

    unmount();

    // The pick is remembered across opens under the generator's own key,
    // still a private selection: nothing here names a planner lock.
    render(<FFCSGeneratorSubpage {...props({ generatorDisplayCourses: courses })} />);
    expect(courseCheckbox()?.checked).toBe(true);
    expect(generateButton().disabled).toBe(false);
  });

  it("seeds this run from the planner's locked targets, and never writes back", () => {
    render(
      <FFCSGeneratorSubpage
        {...props({
          courseLocks: [courseLock("BCSE101")],
          generatorDisplayCourses: [{ code: "BCSE101", title: "Structured Programming", types: [] as string[] }],
        })}
      />
    );

    // The locked course arrives already ticked, and the counter says where
    // this run's picks came from: seeded, not recreated.
    expect(courseCheckbox()?.checked).toBe(true);
    expect(document.body.textContent).toContain("from your locked Target Courses");

    // The compile already guarantees no write-back: no setCourseLocks prop
    // exists to call. At runtime, the seeded path must not touch the
    // generator's private key either — it owns nothing yet.
    expect(storage.getItem("ffcs_generator_targets")).toBeNull();
  });

  it("paints a bounded window of a long result list, expanding on demand", async () => {
    // Four courses, each with three options from disjoint stretches of the
    // non-clashing, run-window pool. A week needs every course in a distinct
    // window or the pairs clash, and with disjoint pools each of the 3^4 = 81
    // weeks owns a layout no other week shares — 81 distinct options, above
    // the render window, with the solver's own cap (here raised to 5000, the
    // settings sheet cannot ask for that, but nothing re-sanitises on the way
    // in) never stopping the run.
    const pool = nonClashingSlots(12);
    const masterCourses: ParsedCourse[] = [];
    const courseLocksState: CourseLock[] = [0, 1, 2, 3].map((courseIndex) => {
      const code = `BCSE4${courseIndex}0`;
      for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
        masterCourses.push(
          courseRow(code, pool[courseIndex * 3 + slotIndex], `AB1-${100 + courseIndex * 3 + slotIndex}`)
        );
      }
      return courseLock(code);
    });

    // The success message is written through the parent-held setter, so the
    // only way to await the settle on the settled message is a host that
    // keeps that state for real — `props`' `vi.fn` would swallow it.
    const Harness = () => {
      const [msg, setMsg] = useState<string | null>(null);
      return (
        <FFCSGeneratorSubpage
          {...props({
            successMsg: msg,
            setSuccessMsg: setMsg,
            settings: { ...FFCSSettingsDefaults, resultCap: 5000 },
            courseLocks: courseLocksState,
            masterCourses,
          })}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(generateButton());

    // The settle is the anchor for everything after it: the success message
    // and the final (renumbered, ranked) list land in the same commit, so
    // once the message is readable the window below is the settled one.
    await screen.findByText(/Found \d+ unique timetables/, {}, { timeout: 15_000 });

    expect(screen.getAllByText(/^Option \d+$/)).toHaveLength(60);
    expect(document.body.textContent).toContain("Showing the first 60 of 81 options.");

    // The step is what the window still misses, so 21 of the 240 asked for.
    fireEvent.click(screen.getByRole("button", { name: /Show 21 more/ }));
    expect(screen.getAllByText(/^Option \d+$/)).toHaveLength(81);
    // ...and once every option is painted, the headline goes with it.
    expect(document.body.textContent).not.toContain("Showing the first 60 of 81");
    // Raised past the 5s default: the run itself is fast, but this is the one
    // test that runs the real solver through the real subpage, and a busy
    // suite is not a reason to fail a timing-budget that a phone would miss.
  }, 20_000);

  it("shows the run's own message on the screen that produced it", () => {
    render(
      <FFCSGeneratorSubpage {...props({ successMsg: "Found 12 unique timetables" })} />
    );

    expect(document.body.textContent).toContain("Found 12 unique timetables");
  });

  it("lets a failure take precedence over the message it superseded", () => {
    render(
      <FFCSGeneratorSubpage
        {...props({
          error: "Could not generate any conflict-free timetables from the selected options.",
          successMsg: "Found 12 unique timetables",
        })}
      />
    );

    expect(document.body.textContent).toContain(
      "Could not generate any conflict-free timetables"
    );
    expect(document.body.textContent).not.toContain("Found 12 unique timetables");
  });

  it("hands system back to the tab, and releases the stack on leave", () => {
    const onClose = vi.fn();
    const { unmount } = render(<FFCSGeneratorSubpage {...props({ onClose })} />);

    // The OS gesture arrives as a popstate; the overlay stack is what decides
    // the subpage — not the planner behind it — is what it dismisses.
    expect(hasOpenOverlays()).toBe(true);
    expect(closeTopOverlayFromPop()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(hasOpenOverlays()).toBe(false);
    expect(closeTopOverlayFromPop()).toBe(false);
  });

  it("renders the faculty count badge next to faculty name in preview mode", async () => {
    const pool = nonClashingSlots(3);
    const masterCourses: ParsedCourse[] = [
      { ...courseRow("BCSE101", pool[0], "AB1-101"), FACULTY: "Prof Alpha" },
      { ...courseRow("BCSE101", pool[0], "AB1-102"), FACULTY: "Prof Beta" },
      { ...courseRow("BCSE101", pool[1], "AB2-201"), FACULTY: "Prof Gamma" },
    ];
    const courses = [{ code: "BCSE101", title: "Structured Programming", types: [] as string[] }];

    const Harness = () => {
      const [msg, setMsg] = useState<string | null>(null);
      const [showGeneratorOptionPane, setShowGeneratorOptionPane] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShowGeneratorOptionPane(false)}>
            Disable options pane
          </button>
          <FFCSGeneratorSubpage
            {...props({
              settings: { ...FFCSSettingsDefaults, showGeneratorOptionPane },
              successMsg: msg,
              setSuccessMsg: setMsg,
              courseLocks: [courseLock("BCSE101")],
              generatorDisplayCourses: courses,
              masterCourses,
              getGroupedCourses: (list) => {
                return list.map((c) => ({
                  id: c.id,
                  code: c.code,
                  title: c.title,
                  type: c.type,
                  faculty: c.faculty,
                  slots: c.slots,
                  venue: c.venue,
                  credits: c.credits,
                  color: c.color,
                  ids: [c.id],
                }));
              },
            })}
          />
        </>
      );
    };

    render(<Harness />);

    fireEvent.click(generateButton());
    await screen.findByText(/Found \d+ unique timetables/, {}, { timeout: 15_000 });

    expect(screen.getAllByText(/free half-days$/).length).toBeGreaterThan(0);
    const detailedMetrics = screen.getAllByText("Free Half-Days")[0].parentElement?.parentElement;
    expect(detailedMetrics?.className).toContain("hidden sm:grid");
    expect(screen.getByRole("button", { name: /Back to Options/ }).className).toContain(
      "hidden sm:flex"
    );
    expect(
      screen.getByRole("button", { name: "Discard all generated timetables" }).querySelector("svg")
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: /Save \d+ selected timetables/ }).querySelector("svg"))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Preview Option 1" })).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Compare" }).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Preview Option 1" }));

    // Enters preview mode
    await screen.findByText("Selected Courses");
    expect(screen.getByText("Timetable options")).toBeDefined();
    expect(screen.getByRole("button", { name: /Option 1: .*free half-days/ })).toBeDefined();

    // The badge next to the faculty should show 2 (both Prof Alpha and Prof Beta teach this slot)
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getAllByTitle("2 faculties teaching this slot · Click to switch").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Option 2:/ }));
    expect(screen.getByText("Preview: Option 2")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Disable options pane" }));
    expect(screen.queryByText("Timetable options")).toBeNull();
  }, 20_000);

  it("navigates back to the generator options page when Back to Options is clicked after generating", async () => {
    const pool = nonClashingSlots(1);
    const masterCourses: ParsedCourse[] = [courseRow("BCSE101", pool[0], "AB1-101")];
    const courses = [{ code: "BCSE101", title: "Structured Programming", types: [] as string[] }];

    const Harness = () => {
      const [msg, setMsg] = useState<string | null>(null);
      return (
        <FFCSGeneratorSubpage
          {...props({
            successMsg: msg,
            setSuccessMsg: setMsg,
            courseLocks: [courseLock("BCSE101")],
            generatorDisplayCourses: courses,
            masterCourses,
          })}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(generateButton());
    await screen.findByText(/Found \d+ unique timetables/, {}, { timeout: 15_000 });

    // Review screen should be active
    expect(screen.getAllByText("Review Timetables").length).toBeGreaterThan(0);

    // Click "Back to Options"
    const backToOptionsButtons = screen.getAllByRole("button", { name: /back to options/i });
    expect(backToOptionsButtons.length).toBeGreaterThan(0);
    fireEvent.click(backToOptionsButtons[0]);

    // Options view should now be displayed again with target courses
    expect(screen.getAllByText(/target courses/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Results (1)")).toBeTruthy();

    // Clicking "Results (1)" brings the user back to the review view
    fireEvent.click(screen.getByRole("button", { name: /results \(1\)/i }));
    expect(screen.getAllByText("Review Timetables").length).toBeGreaterThan(0);
  }, 20_000);

  it("persists session preferences statefully across subpage mounts in sessionStorage", () => {
    saveSessionPreferences({
      preference: "morning",
      uniqueFaculties: true,
      minStartTime: "09:00",
      maxEndTime: "17:00",
      minHalfDays: 3,
    });

    const { unmount } = render(<FFCSGeneratorSubpage {...props()} />);

    // Search-limit ToggleRows are a single control: the row button IS the
    // switch (role="switch" + aria-checked); no nested button inside.
    const uniqueRow = screen.getByRole("switch", { name: /unique faculties/i });
    expect(uniqueRow.getAttribute("aria-checked")).toBe("true");

    // The redesigned search-limit rows both render self-explanatory copy.
    expect(screen.getByRole("switch", { name: /remove result cap/i })).toBeTruthy();
    expect(screen.getByText("Result cap")).toBeTruthy();

    // Min half days should be 3
    expect(screen.getByDisplayValue("3")).toBeTruthy();

    unmount();
  });
});
