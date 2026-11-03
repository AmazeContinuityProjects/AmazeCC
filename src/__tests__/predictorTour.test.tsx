import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PredictorTourProvider, usePredictorTour } from "../components/custom/exams/marks-predictor/tour/TourProvider";
import { TOUR_VERSION } from "../components/custom/exams/marks-predictor/tour/tourSteps";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import { installLocalStorage, stubScrollIntoView } from "./helpers/localStorage";

/**
 * The predictor tour's contract with the page: it offers itself once per
 * version, remembers either outcome (finished *or* skipped), can be replayed
 * from the header's "?" control at any time, and never dies on an anchor that
 * has gone missing — a step whose element cannot be found still shows its
 * card, centred, because an anchor lost to a layout change should still teach.
 *
 * Unlike the FFCS tour there is no settings switch and no phone suppression:
 * this page is exactly where first-time users get lost, and phones are where
 * most of them read it.
 */

const store = installLocalStorage();

/** Advances past the auto-start delay and any frame the measure needs. */
function passAutoStartDelay() {
  act(() => {
    vi.advanceTimersByTime(700);
  });
}

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
  const tour = usePredictorTour();
  return (
    <div>
      <span data-testid="active">{String(tour.isActive)}</span>
      <button type="button" onClick={tour.start}>
        Start tour
      </button>
    </div>
  );
}

function TourHost({ anchors = ["predictor-stats", "predictor-target"] }) {
  return (
    <PredictorTourProvider>
      {anchors.map((target) => (
        <div key={target} data-tour-id={target}>
          {target}
        </div>
      ))}
      <Probe />
    </PredictorTourProvider>
  );
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

describe("the predictor tour", () => {
  it("auto-starts once per version, and never again after a finish", () => {
    const first = render(<TourHost />);
    passAutoStartDelay();
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Walk it to the end (four steps).
    for (let step = 1; step <= 4; step++) {
      click(/finish|next/i);
    }

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getItem("predictor_tour_seen")).toBe(String(TOUR_VERSION));

    first.unmount();

    // A later visit: the memory holds, so the page is left alone.
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
    expect(store.getItem("predictor_tour_seen")).toBe(String(TOUR_VERSION));
  });

  it("can be replayed from the header's ? control after it has been seen", () => {
    // Seen in an earlier session.
    store.setItem("predictor_tour_seen", String(TOUR_VERSION));
    render(<TourHost />);
    passAutoStartDelay();
    expect(screen.queryByRole("dialog")).toBeNull();

    // The page's HelpCircle button calls `tour.start()` — the Probe stands in
    // for it here; the page test covers the button wiring itself.
    click("Start tour");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a centred card even when the anchor is gone", () => {
    render(<TourHost anchors={["a-target-that-was-deleted"]} />);
    passAutoStartDelay();

    const card = screen.getByRole("dialog");
    expect(card.getAttribute("aria-label")).toContain("of 4");
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

  it("swallows keys while a step is up", () => {
    render(<TourHost />);
    passAutoStartDelay();

    // The spotlight eats keys in capture so nothing behind the dim acts on
    // them while the tour covers the page.
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
