import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useHorizontalSwipe } from "../components/custom/shared/primitives/useHorizontalSwipe";

/**
 * The swipe gesture, on its own.
 *
 * It is now shared by the insight tile and the home page's week strip, so its
 * behaviour is load-bearing in two places instead of one and a regression has
 * twice the blast radius. `insightCarousel.test.tsx` still covers the tile; this
 * file pins the contract both consumers depend on, and — more usefully — pins
 * the two ways a gesture is allowed to *fail to fire*, because those are silent
 * failures. A strip that stops responding to swipes still renders, still
 * passes a snapshot, and simply becomes a thing you aim chevrons at.
 */

function Harness({
  enabled = true,
  onNext = () => {},
  onPrev = () => {},
  onActiveChange,
  onCellClick,
}: {
  enabled?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onActiveChange?: (active: boolean) => void;
  onCellClick?: () => void;
}) {
  const swipe = useHorizontalSwipe({ enabled, onNext, onPrev, onActiveChange });
  return (
    <div data-testid="surface" {...swipe.handlers} className={swipe.className}>
      <button type="button" onClick={onCellClick}>
        cell
      </button>
    </div>
  );
}

const surface = () => screen.getByTestId("surface");

/** A drag: down at (x,y), two moves, up at (x2,y2). */
function drag(
  node: HTMLElement,
  from: [number, number],
  to: [number, number],
  pointerType = "touch"
) {
  const opts = { pointerId: 1, pointerType };
  fireEvent.pointerDown(node, { ...opts, clientX: from[0], clientY: from[1] });
  // Two moves, so the axis check sees travel before it commits.
  fireEvent.pointerMove(node, {
    ...opts,
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
  });
  fireEvent.pointerMove(node, { ...opts, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(node, { ...opts, clientX: to[0], clientY: to[1] });
}

describe("useHorizontalSwipe", () => {
  it("advances on a left swipe and goes back on a right swipe", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);

    drag(surface(), [300, 100], [120, 105]);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();

    drag(surface(), [120, 105], [300, 100]);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("claims the horizontal axis but leaves vertical to the page", () => {
    // `touch-pan-y` is the whole reason the gesture works: without it the
    // browser has already decided the touch is a scroll by the time
    // `pointermove` fires. It is asserted rather than assumed because the class
    // name is a silent no-op if it lands on the wrong element.
    const { container } = render(<Harness />);
    expect(container.firstElementChild?.className).toContain("touch-pan-y");
  });

  it("ignores a drag that never gets past the slop", () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    drag(surface(), [200, 100], [200, 100]);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("ignores a short sideways flick", () => {
    // Under 40px it is a tap. Firing here is how a strip pages itself every
    // time the user grazes it while scrolling past.
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    drag(surface(), [200, 100], [180, 100]);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("leaves a steep diagonal to the page", () => {
    // Both consumers sit in a vertically scrolling page, so a drag that is
    // more vertical than horizontal has to stay a scroll.
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    drag(surface(), [300, 100], [220, 300]);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("ignores a non-primary mouse button", () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    const node = surface();
    fireEvent.pointerDown(node, { pointerId: 1, pointerType: "mouse", button: 2, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(node, { pointerId: 1, pointerType: "mouse", clientX: 120, clientY: 105 });
    fireEvent.pointerUp(node, { pointerId: 1, pointerType: "mouse", clientX: 120, clientY: 105 });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("swallows the click a swipe produces, so the day under it is not opened", () => {
    // The bug this prevents: swipe to the next week, and the circle you
    // happened to lift off gets an onClick on the way, selecting a day in the
    // new week without the user ever looking at it.
    const onNext = vi.fn();
    const onCellClick = vi.fn();
    render(<Harness onNext={onNext} onCellClick={onCellClick} />);

    drag(surface(), [300, 100], [120, 105]);
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "cell" }));
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("re-arms after the swallow, so the next real tap lands", () => {
    // A guard that stayed armed would eat every subsequent tap and make the
    // strip look broken rather than guarded.
    vi.useFakeTimers();
    try {
      const onCellClick = vi.fn();
      render(<Harness onCellClick={onCellClick} />);

      drag(surface(), [300, 100], [120, 105]);
      fireEvent.click(screen.getByRole("button", { name: "cell" }));
      expect(onCellClick).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      fireEvent.click(screen.getByRole("button", { name: "cell" }));
      expect(onCellClick).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never swallows a click when no swipe happened", () => {
    const onCellClick = vi.fn();
    render(<Harness onCellClick={onCellClick} />);
    fireEvent.click(screen.getByRole("button", { name: "cell" }));
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it("reports gesture start and end, so autoplay can pause", () => {
    const onActiveChange = vi.fn();
    render(<Harness onActiveChange={onActiveChange} />);
    drag(surface(), [300, 100], [120, 105]);
    expect(onActiveChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it("pages on the arrow keys", () => {
    // The week strip's circles are not a composite widget, so this fires from
    // whatever has focus inside the strip. That is the point: it is what makes
    // the strip reachable without a pointer.
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);

    fireEvent.keyDown(surface(), { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(surface(), { key: "ArrowLeft" });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("is completely inert when disabled", () => {
    const onNext = vi.fn();
    const { container } = render(<Harness enabled={false} onNext={onNext} />);

    drag(surface(), [300, 100], [120, 105]);
    fireEvent.keyDown(surface(), { key: "ArrowRight" });

    expect(onNext).not.toHaveBeenCalled();
    // No `touch-pan-y` either: a surface that is not swipeable must hand the
    // horizontal axis straight back to the page.
    expect(container.firstElementChild?.className).not.toContain("touch-pan-y");
  });
});
