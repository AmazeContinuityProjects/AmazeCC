import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TourProvider, useTour } from "../components/custom/exams/FFCS/features/tour/TourProvider";
import { TOUR_VERSION } from "../components/custom/exams/FFCS/features/tour/tourSteps";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import { installLocalStorage, stubScrollIntoView } from "./helpers/localStorage";

/**
 * The tour's contract with the planner: it offers itself once per version,
 * remembers either outcome (finished *or* skipped), never auto-starts when
 * told not to, and never dies on an anchor that has gone missing — a step
 * whose element cannot be found still shows its card, centred, because an
 * anchor lost to a layout change should still teach.
 */

const store = installLocalStorage();

/**
 * Native clicks, flushed. React 18 does not flush state from events
 * dispatched outside `act`, so a bare `.click()` would leave the step change
 * pending and every assertion after it reading the previous render.
 */
function click(name: string | RegExp) {
  act(() => {
    screen.getByRole("button", { name }).click();
  });
}

function Probe() {
  const tour = useTour();
  return (
    <div>
      <span data-testid="active">{String(tour.isActive)}</span>
      <button type="button" onClick={tour.start}>
        Start tour
      </button>
    </div>
  );
}

function TourHost({ offerTour = true, anchors = ["ffcs-banner", "ffcs-grid"] }) {
  return (
    <TourProvider offerTour={offerTour}>
      {anchors.map((target) => (
        <div key={target} data-tour-id={target}>
          {target}
        </div>
      ))}
      <Probe />
    </TourProvider>
  );
}

/** Advances past the auto-start delay and any frame the measure needs. */
function passAutoStartDelay() {
  act(() => {
    vi.advanceTimersByTime(700);
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
  });
  stubScrollIntoView();
  store.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  while (closeTopOverlayFromPop()) {
    /* drain: the provider registers with the overlay stack while active */
  }
});

describe("the guided tour", () => {
  it("auto-starts once per version, and never again after a finish", () => {
    const first = render(<TourHost />);
    passAutoStartDelay();
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Walk it to the end.
    for (let step = 1; step <= 6; step++) {
      click(/finish|next/i);
    }

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getItem("ffcs_tour_seen")).toBe(String(TOUR_VERSION));

    first.unmount();

    // A later visit: the memory holds, so the planner is left alone.
    render(<TourHost />);
    passAutoStartDelay();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("treats a skip as seen too", () => {
    render(<TourHost />);
    passAutoStartDelay();
    expect(screen.getByRole("dialog")).toBeTruthy();

    click(/skip/i);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getItem("ffcs_tour_seen")).toBe(String(TOUR_VERSION));
  });

  it("never auto-starts when the settings switch is off, but can still be started", () => {
    render(<TourHost offerTour={false} />);
    passAutoStartDelay();
    expect(screen.queryByRole("dialog")).toBeNull();

    click("Start tour");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a centred card even when the anchor is gone", () => {
    render(<TourHost anchors={["a-target-that-was-deleted"]} />);
    passAutoStartDelay();

    const card = screen.getByRole("dialog");
    expect(card.getAttribute("aria-label")).toContain("Welcome to FFCS");
  });

  it("keeps Back disabled on the first step", () => {
    render(<TourHost />);
    passAutoStartDelay();

    const back = screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);

    click(/next/i);
    const backSecond = screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement;
    expect(backSecond.disabled).toBe(false);
  });

  it("swallows the planner's single-key shortcuts while a step is up", () => {
    render(<TourHost />);
    passAutoStartDelay();

    // The tab listens on window in the bubble phase; the spotlight must eat
    // keys in capture so `g`/`t`/`f` never reach it under the dim.
    const leaked: string[] = [];
    const spy = (e: KeyboardEvent) => leaked.push(e.key);
    window.addEventListener("keydown", spy);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
    });

    expect(leaked).toEqual([]);
    window.removeEventListener("keydown", spy);
  });
});
