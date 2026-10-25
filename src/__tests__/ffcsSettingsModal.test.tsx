import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FFCSSettingsModal, type FFCSSettingsModalProps } from "../components/custom/exams/FFCS/components/modals/FFCSSettingsModal";
import { FFCSSettingsDefaults } from "../lib/ffcsSettings";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import { installLocalStorage } from "./helpers/localStorage";

/**
 * The settings sheet's two loyalties: defaults that go through
 * `useFFCSSettings`'s `update`, and the two rows that edit the *tab's* live
 * state instead (batch grouping, social method) — the tab has its own storage
 * keys for those, and a second copy here would drift the first time someone
 * used the planner's own control. Plus the rows with side effects beyond the
 * record: analytics consent (its own key) and tour replay.
 */

const store = installLocalStorage();

/**
 * Native clicks, flushed — React 18 does not flush state from un-`act`ed
 * events. Accepts `role="tab"` too: ChipTabs is a tablist, and these suites
 * click through both kinds of control.
 */
function click(name: string | RegExp) {
  act(() => {
    const target =
      screen.queryByRole("button", { name }) ?? screen.queryByRole("tab", { name });
    if (!target) throw new Error(`no control named ${String(name)}`);
    target.click();
  });
}

const props = (over: Partial<FFCSSettingsModalProps> = {}): FFCSSettingsModalProps => ({
  isOpen: true,
  onClose: vi.fn(),
  settings: FFCSSettingsDefaults,
  update: vi.fn(),
  reset: vi.fn(),
  isGroupingEnabled: true,
  setIsGroupingEnabled: vi.fn(),
  socialScoreGroupMethod: "intersection",
  setSocialScoreGroupMethod: vi.fn(),
  onReplayTour: vi.fn(),
  ...over,
});

beforeEach(() => store.clear());

afterEach(() => {
  vi.restoreAllMocks();
  while (closeTopOverlayFromPop()) {
    /* the sheet registers with the overlay stack while mounted */
  }
});

describe("FFCSSettingsModal", () => {
  it("routes a default through update, keyed by its name", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    screen.getByText("Result cap", { exact: false });
    click("250");

    expect(p.update).toHaveBeenCalledWith("resultCap", 250);
  });

  it("selects default sort order and ranking profile through radio button rows", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    // Click "Social" radio row
    const socialRadio = screen.getByDisplayValue("social");
    act(() => socialRadio.click());
    expect(p.update).toHaveBeenCalledWith("defaultSortBy", "social");

    // Click "Half Days" ranking profile radio row
    const halfDaysRadio = screen.getByDisplayValue("Half Days");
    act(() => halfDaysRadio.click());
    expect(p.update).toHaveBeenCalledWith("rankingMode", "Half Days");

    // Click "Cumulative" group social score radio row
    const cumulativeRadio = screen.getByDisplayValue("cumulative");
    act(() => cumulativeRadio.click());
    expect(p.setSocialScoreGroupMethod).toHaveBeenCalledWith("cumulative");
  });

  it("keeps radio-setting prompts and options in a single vertical pane", () => {
    render(<FFCSSettingsModal {...props()} />);

    const rankingGroup = screen.getByDisplayValue("Balanced").parentElement?.parentElement;
    expect(rankingGroup?.className).toContain("flex-col");
    expect(rankingGroup?.className).not.toContain("sm:flex-row");
    expect(rankingGroup?.parentElement?.className).toContain("w-full");
    expect(rankingGroup?.parentElement?.parentElement?.className).toContain("flex-col");
    expect(rankingGroup?.parentElement?.parentElement?.className).not.toContain("sm:flex-row");
  });

  it("edits the tab's own state for grouping, not a copy in settings", () => {
    const p = props({ isGroupingEnabled: false });
    render(<FFCSSettingsModal {...p} />);

    // Grouping's switch is unnamed on purpose; the wide-screen layout switch
    // is labelled because it is a new presentation preference.
    const grouping = (screen.getAllByRole("switch") as HTMLButtonElement[]).find(
      (control) => !control.hasAttribute("aria-label")
    );
    expect(grouping).toBeDefined();
    act(() => grouping.click());

    expect(p.setIsGroupingEnabled).toHaveBeenCalledWith(true);
    expect(p.update).not.toHaveBeenCalled();
  });

  it("updates the wide-screen vertical timetable layout preference", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    const layoutSwitch = screen.getByRole("switch", {
      name: "Vertical timetable beside widgets",
    });
    act(() => layoutSwitch.click());

    expect(p.update).toHaveBeenCalledWith("showVerticalTimetableBesideWidgets", true);
  });

  it("updates the generator timetable options pane preference", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    const description = screen.getByText(
      "Show the desktop side pane for switching between generated timetable options while reviewing."
    );
    expect(description.className).toContain("whitespace-normal");
    expect(description.className).not.toContain("truncate");

    act(() =>
      screen.getByRole("switch", { name: "Generator timetable options pane" }).click()
    );

    expect(p.update).toHaveBeenCalledWith("showGeneratorOptionPane", false);
  });

  it("updates the separate course-list image export preference", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    act(() => screen.getByRole("switch", { name: "Separate course-list image" }).click());

    expect(p.update).toHaveBeenCalledWith("separateCourseListExport", true);
  });

  it("updates the unlimited-search safety ceiling preference", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    act(() =>
      screen.getByRole("switch", { name: "Remove 30,000-result safety ceiling" }).click()
    );

    expect(p.update).toHaveBeenCalledWith("removeHardResultLimit", true);
  });

  it("reorders the combined ranking priority through planner settings", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    act(() => screen.getByRole("button", { name: "Move Faculty reviews up" }).click());

    expect(p.update).toHaveBeenCalledWith("rankingPriorityOrder", [
      "faculty",
      "profile",
      "sort",
      "time",
    ]);
  });

  it("writes analytics consent to the analytics key, not to settings", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    const switches = screen.getAllByRole("switch") as HTMLButtonElement[];
    const analytics = switches[switches.length - 1];
    expect(analytics.getAttribute("aria-checked")).toBe("true");

    act(() => analytics.click());

    expect(store.getItem("ffcs_analytics_enabled")).toBe("false");
    expect(p.update).not.toHaveBeenCalled();
  });

  it("replay closes the sheet and starts the tour", () => {
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    click(/replay/i);

    expect(p.onClose).toHaveBeenCalled();
    expect(p.onReplayTour).toHaveBeenCalled();
  });

  it("reset asks first, then defers to the tab's reset — consent untouched", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    click(/reset/i);

    expect(confirmSpy).toHaveBeenCalled();
    expect(p.reset).toHaveBeenCalled();
    expect(store.getItem("ffcs_analytics_enabled")).toBeNull();
  });

  it("refuses to reset when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const p = props();
    render(<FFCSSettingsModal {...p} />);

    click(/reset/i);

    expect(p.reset).not.toHaveBeenCalled();
  });
});
