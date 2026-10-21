import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useOverlayBack } from "../lib/overlayStack";

/**
 * Overlay history entries.
 *
 * Every back-able overlay owns a history entry while it is open, so the OS back
 * gesture always has something to pop — including on the very first screen,
 * where there is no screen entry to borrow. The entry is what the popstate
 * handler reads to know the popped step was an overlay's own, so the overlay
 * is dismissed rather than a screen being re-pushed.
 */

afterEach(cleanup);

function Harness({ open }: { open: boolean }) {
  useOverlayBack("test-overlay", open, () => {});
  return null;
}

describe("overlay history entries", () => {
  it("does not touch history while the overlay is closed", () => {
    const before = window.history.length;
    render(<Harness open={false} />);
    expect(window.history.length).toBe(before);
  });

  it("pushes an entry the moment the overlay opens", () => {
    const before = window.history.length;
    const { rerender } = render(<Harness open={false} />);

    rerender(<Harness open />);

    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toMatchObject({
      op: { kind: "overlay", id: "test-overlay" },
      __NA: true,
    });
  });

  it("writes a fresh entry each time the overlay re-opens", () => {
    const before = window.history.length;
    const { rerender } = render(<Harness open />);
    rerender(<Harness open={false} />);
    rerender(<Harness open />);

    expect(window.history.length).toBe(before + 2);
  });
});
