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

  it("edits the tab's own state for grouping, not a copy in settings", () => {
    const p = props({ isGroupingEnabled: false });
    render(<FFCSSettingsModal {...p} />);

    // Switches are unnamed on purpose — SettingRow names the row — so pick
    // them in document order: grouping, tour, analytics.
    const [grouping] = screen.getAllByRole("switch") as HTMLButtonElement[];
    act(() => grouping.click());

    expect(p.setIsGroupingEnabled).toHaveBeenCalledWith(true);
    expect(p.update).not.toHaveBeenCalled();
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
