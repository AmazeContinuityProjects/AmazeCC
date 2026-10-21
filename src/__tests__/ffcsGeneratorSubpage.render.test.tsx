import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  FFCSGeneratorSubpage,
  type FFCSGeneratorSubpageProps,
} from "../components/custom/exams/FFCS/FFCSGeneratorSubpage";
import { closeTopOverlayFromPop, hasOpenOverlays } from "../lib/overlayStack";
import { FFCSSettingsDefaults } from "../lib/ffcsSettings";

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

const props = (over: Partial<FFCSGeneratorSubpageProps> = {}): FFCSGeneratorSubpageProps => ({
  onClose: vi.fn(),
  settings: FFCSSettingsDefaults,
  courseLocks: [],
  setCourseLocks: vi.fn(),
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
  screen.getByRole("button", { name: /generate timetables/i }) as HTMLButtonElement;

describe("FFCSGeneratorSubpage", () => {
  afterEach(() => {
    // The overlay stack is module-global. An entry leaked by one test would
    // make the next test's system-back assertion pass for the wrong reason.
    while (closeTopOverlayFromPop()) {
      /* drain */
    }
  });

  it("renders as the tab's screen, with the layout's own back chrome", () => {
    render(<FFCSGeneratorSubpage {...props()} />);

    // Twice, not once: the layout draws a mobile header and a desktop one.
    expect(screen.getAllByText("Advanced Timetable Generator").length).toBeGreaterThan(0);
    // Back comes from the layout, not from a sheet's X: `SubpageLayout` is the
    // only thing on this screen that renders a back control.
    expect(hasOpenOverlays()).toBe(true);
  });

  it("holds generate back until a target course is chosen", () => {
    const { rerender } = render(<FFCSGeneratorSubpage {...props()} />);

    expect(generateButton().disabled).toBe(true);

    rerender(<FFCSGeneratorSubpage {...props({ courseLocks: [courseLock("BCSE101")] })} />);
    expect(generateButton().disabled).toBe(false);
  });

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
});
