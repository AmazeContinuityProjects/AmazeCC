import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  closeTopOverlayFromPop,
  hasOpenOverlays,
  useOverlayBack,
  useOverlayBackBoundary,
} from "../lib/overlayStack";

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

function RetainingHarness({ onBack }: { onBack: () => boolean }) {
  useOverlayBack("retaining-overlay", true, onBack);
  return null;
}

function StandaloneRouteHarness({ onClose }: { onClose: () => void }) {
  useOverlayBackBoundary("standalone-route");
  useOverlayBack("route-overlay", true, onClose);
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

  it("re-registers an overlay when it consumes system back internally", () => {
    const onBack = vi.fn(() => true);
    render(<RetainingHarness onBack={onBack} />);

    expect(closeTopOverlayFromPop()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(hasOpenOverlays()).toBe(true);
    expect(window.history.state).toMatchObject({
      op: { kind: "overlay", id: "retaining-overlay" },
      __NA: true,
    });
  });

  it("closes route overlays on browser back outside Main", async () => {
    const onClose = vi.fn();
    window.history.replaceState({}, "", "/standalone-route");
    render(<StandaloneRouteHarness onClose={onClose} />);

    expect(window.history.state).toMatchObject({
      op: { kind: "overlay", id: "route-overlay" },
      __NA: true,
    });
    window.history.back();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(hasOpenOverlays()).toBe(false);
    expect(window.location.pathname).toBe("/standalone-route");
  });
});
