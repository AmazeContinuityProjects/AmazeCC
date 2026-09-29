import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { InsightCarousel, type InsightSlide } from "../components/custom/shared/primitives/InsightCarousel";
import { useCarousel } from "../components/custom/shared/primitives/useCarousel";

/**
 * The carousel, through the gesture rather than the state.
 *
 * The dots have always worked, so what needed testing is the drag: that a
 * horizontal swipe advances, that it does not fire the slide's own `onClick` on
 * the way, and — the two failures that are easy to ship and hard to notice —
 * that a short drag and a vertical drag both do nothing at all. The second
 * matters most on a phone, where the tile sits inside a scrolling page and a
 * gesture that hijacks vertical panning makes the whole page feel broken.
 *
 * Autoplay is off (`autoplayMs = 0`) so nothing moves on its own and every
 * assertion is about the gesture.
 */

const slides: InsightSlide[] = [
  { id: "a", label: "First", value: "11%" },
  { id: "b", label: "Second", value: "22%" },
  { id: "c", label: "Third", value: "33%" },
];

function Harness({
  items = slides,
  onClick,
}: {
  items?: InsightSlide[];
  onClick?: (id: string) => void;
}) {
  const carousel = useCarousel(items.length, 0);
  return (
    <InsightCarousel
      slides={items.map((s) => (onClick ? { ...s, onClick: () => onClick(s.id) } : s))}
      carousel={carousel}
      interactiveDots
      ariaLabel="Test carousel"
    />
  );
}

/** The tile the gesture handlers live on. */
function tile(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

/** A drag: down at (x,y), two moves, up at (x2,y2). */
function drag(
  container: HTMLElement,
  from: [number, number],
  to: [number, number],
  pointerType = "touch"
) {
  const node = tile(container);
  fireEvent.pointerDown(node, { pointerId: 1, pointerType, clientX: from[0], clientY: from[1] });
  // Two moves, so the axis check sees travel before it commits.
  fireEvent.pointerMove(node, {
    pointerId: 1,
    pointerType,
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
  });
  fireEvent.pointerMove(node, { pointerId: 1, pointerType, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(node, { pointerId: 1, pointerType, clientX: to[0], clientY: to[1] });
}

const shown = () => (screen.getByText(/^\d+%$/)?.textContent ?? "");

describe("carousel swipe", () => {
  it("advances on a left swipe and goes back on a right swipe", () => {
    const { container } = render(<Harness />);
    expect(shown()).toBe("11%");

    drag(container, [300, 100], [120, 105]);
    expect(shown()).toBe("22%");

    drag(container, [120, 105], [300, 100]);
    expect(shown()).toBe("11%");
  });

  it("wraps around at both ends", () => {
    const { container } = render(<Harness />);
    // Backwards from the first slide lands on the last.
    drag(container, [120, 100], [300, 100]);
    expect(shown()).toBe("33%");
    // And forwards off the end returns to the first.
    drag(container, [300, 100], [120, 100]);
    expect(shown()).toBe("11%");
  });

  it("swipes with a mouse as well as a finger", () => {
    const { container } = render(<Harness />);
    drag(container, [300, 100], [120, 100], "mouse");
    expect(shown()).toBe("22%");
  });

  it("ignores a drag too short to be a swipe", () => {
    const { container } = render(<Harness />);
    // Under the threshold this has to stay a tap, or a scroll that grazes the
    // card changes the slide.
    drag(container, [300, 100], [290, 100]);
    expect(shown()).toBe("11%");
  });

  it("ignores a vertical drag, which belongs to the page", () => {
    const { container } = render(<Harness />);
    drag(container, [200, 300], [195, 80]);
    expect(shown()).toBe("11%");
  });

  it("ignores a mostly-vertical drag that happens to travel further", () => {
    const { container } = render(<Harness />);
    // Slightly diagonal: a page scroll with a shaky hand, not a swipe.
    drag(container, [200, 300], [260, 60]);
    expect(shown()).toBe("11%");
  });

  it("does not fire a slide's click when the gesture was a swipe", () => {
    const onClick = vi.fn();
    const { container } = render(<Harness onClick={onClick} />);

    drag(container, [300, 100], [120, 100]);

    expect(shown()).toBe("22%");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("still fires a slide's click on a plain tap", () => {
    const onClick = vi.fn();
    const { container } = render(<Harness onClick={onClick} />);

    // Down and up in the same place: no travel, so no swipe, so a tap.
    const node = tile(container);
    fireEvent.pointerDown(node, { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerUp(node, { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Test carousel" }));

    expect(onClick).toHaveBeenCalledWith("a");
  });

  it("swallows only the one click that follows a swipe", () => {
    const onClick = vi.fn();
    const { container } = render(<Harness onClick={onClick} />);

    drag(container, [300, 100], [120, 100]);
    fireEvent.click(screen.getByRole("button", { name: "Test carousel" }));
    expect(onClick).not.toHaveBeenCalled();

    // The next tap is a real tap again — a permanently-armed guard would make
    // the card unclickable after the first swipe.
    fireEvent.click(screen.getByRole("button", { name: "Test carousel" }));
    expect(onClick).toHaveBeenCalledWith("b");
  });

  it("re-arms the click guard if a swipe produced no click at all", () => {
    vi.useFakeTimers();
    try {
      const onClick = vi.fn();
      const { container } = render(<Harness onClick={onClick} />);

      // A swipe whose pointer came up off the tile: the slide advanced, but the
      // browser synthesised no click, so nothing consumed the guard.
      drag(container, [300, 100], [120, 100]);
      expect(shown()).toBe("22%");

      // Past the window, a real click must get through — otherwise one swipe
      // that ended off-target leaves the card unclickable.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(screen.getByRole("button", { name: "Test carousel" }));
      expect(onClick).toHaveBeenCalledWith("b");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not arm the gesture on a right-click", () => {
    const { container } = render(<Harness />);
    const node = tile(container);
    fireEvent.pointerDown(node, {
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
      clientX: 300,
      clientY: 100,
    });
    fireEvent.pointerMove(node, { pointerId: 1, pointerType: "mouse", clientX: 120, clientY: 100 });
    fireEvent.pointerUp(node, { pointerId: 1, pointerType: "mouse", clientX: 120, clientY: 100 });
    expect(shown()).toBe("11%");
  });

  it("does not swipe a single-slide carousel", () => {
    const { container } = render(<Harness items={[{ id: "only", label: "Only", value: "99%" }]} />);
    drag(container, [300, 100], [120, 100]);
    expect(shown()).toBe("99%");
  });

  it("still navigates with the arrow keys", () => {
    render(<Harness />);
    const dot = screen.getByRole("button", { name: "Show First" });
    dot.focus();

    fireEvent.keyDown(dot, { key: "ArrowRight" });
    expect(shown()).toBe("22%");

    fireEvent.keyDown(dot, { key: "ArrowLeft" });
    expect(shown()).toBe("11%");
  });

  it("claims the horizontal axis and leaves vertical panning to the page", () => {
    const { container } = render(<Harness />);
    // Without `touch-pan-y` the browser has already committed the touch to a
    // scroll by the time pointermove runs, and the gesture silently does
    // nothing on a phone.
    expect(tile(container).className).toContain("touch-pan-y");
  });
});
