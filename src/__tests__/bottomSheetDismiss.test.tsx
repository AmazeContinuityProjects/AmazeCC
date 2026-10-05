import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import BottomSheet from "../components/custom/shared/BottomSheet";

/**
 * Sheet dismissal.
 *
 * The Escape path was the broken one. Every mounted sheet installs its own
 * document-level `keydown` listener, so with a sheet stacked on another sheet a
 * single Escape fired both: the inner sheet closed *and* the outer one. System
 * back was already LIFO because it goes through `closeTopOverlayFromPop`, which
 * pops — Escape had no equivalent check and now asks `isTopOverlay`.
 *
 * The second case is the sync sheet: it repoints swipe and backdrop at a *park*
 * handler so that tapping outside leaves it on screen, but Escape used to call
 * `onClose` and hard-cancel it. Escape is a dismissal gesture like the rest, so
 * it now routes through the same overridable handler.
 */

afterEach(cleanup);

/**
 * A sheet host that actually unmounts on close.
 *
 * Recording the call and leaving the sheet mounted is not enough: a sheet that
 * is still on screen is still the topmost overlay, so a second Escape would
 * correctly hit it again and the test would be measuring the harness rather than
 * the behaviour. This mirrors what the app does — `onClose` flips the state that
 * gates the sheet.
 */
function Stack({ ids, onClose }: { ids: string[]; onClose: (id: string) => void }) {
  const [open, setOpen] = useState<string[]>(ids);
  return (
    <>
      {open.map((id, i) => (
        <BottomSheet
          key={id}
          overlayId={id}
          placement="bottom-center"
          onClose={() => {
            onClose(id);
            setOpen((prev) => prev.filter((x) => x !== id));
          }}
        >
          <span>sheet {i}</span>
        </BottomSheet>
      ))}
    </>
  );
}

/** One sheet, with overridable dismiss handlers, that unmounts when closed. */
function Solo({
  onClose,
  onSwipeDown,
  onBackdropClick,
  dismissable = true,
  showClose = true,
}: {
  onClose: () => void;
  onSwipeDown?: () => void;
  onBackdropClick?: () => void;
  dismissable?: boolean;
  showClose?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <BottomSheet
      overlayId="solo"
      dismissable={dismissable}
      showClose={showClose}
      onClose={close}
      onSwipeDown={onSwipeDown}
      onBackdropClick={onBackdropClick}
    >
      <span>solo</span>
    </BottomSheet>
  );
}

const renderStack = (ids: string[], onClose: (id: string) => void) =>
  render(<Stack ids={ids} onClose={onClose} />);

describe("BottomSheet dismissal", () => {
  it("closes the top sheet on Escape, not every sheet", () => {
    const closed: string[] = [];
    renderStack(["outer", "inner"], (id) => closed.push(id));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closed).toEqual(["inner"]);
  });

  it("lets a second Escape close the one below", () => {
    const closed: string[] = [];
    renderStack(["outer", "inner"], (id) => closed.push(id));

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(closed).toEqual(["inner", "outer"]);
  });

  it("ignores Escape when the sheet is not dismissable", () => {
    const closed: string[] = [];
    render(<Solo onClose={() => closed.push("locked")} dismissable={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closed).toEqual([]);
  });

  it("ignores keys other than Escape", () => {
    const closed: string[] = [];
    renderStack(["solo"], (id) => closed.push(id));

    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });

    expect(closed).toEqual([]);
  });

  it("routes Escape through an overridden swipe handler, not straight to onClose", () => {
    // The sync sheet's shape: swipe and backdrop *park*, only the X cancels.
    const parked: string[] = [];
    const cancelled: string[] = [];
    render(
      <Solo
        onClose={() => cancelled.push("x")}
        onSwipeDown={() => parked.push("park")}
        showClose={false}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(parked).toEqual(["park"]);
    expect(cancelled).toEqual([]);
  });

  it("closes on the X button", () => {
    const closed: string[] = [];
    renderStack(["solo"], (id) => closed.push(id));

    fireEvent.click(screen.getByLabelText("Close"));

    expect(closed).toEqual(["solo"]);
  });

  it("closes only the top sheet when the top one's X is pressed", () => {
    const closed: string[] = [];
    renderStack(["outer", "inner"], (id) => closed.push(id));

    // Two X buttons exist; the last one in the DOM is the inner sheet's.
    const buttons = screen.getAllByLabelText("Close");
    fireEvent.click(buttons[buttons.length - 1]);

    expect(closed).toEqual(["inner"]);
  });

  it("closes on a backdrop tap", () => {
    const closed: string[] = [];
    renderStack(["solo"], (id) => closed.push(id));

    const backdrop = document.querySelector(".fixed.inset-0.z-\\[55\\]") as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);

    expect(closed).toEqual(["solo"]);
  });

  it("honours a custom backdrop handler", () => {
    const parked: string[] = [];
    const closed: string[] = [];
    render(
      <Solo onClose={() => closed.push("x")} onBackdropClick={() => parked.push("park")} />,
    );

    const backdrop = document.querySelector(".fixed.inset-0.z-\\[55\\]") as HTMLElement;
    fireEvent.click(backdrop);

    expect(parked).toEqual(["park"]);
    expect(closed).toEqual([]);
  });

  it("plays its exit when the caller wraps it in AnimatePresence", () => {
    // A guard on the documented contract rather than a behavioural test: the
    // exit variants cannot run unless something above them keeps them mounted.
    const { container } = render(
      <AnimatePresence>
        <BottomSheet overlayId="solo" onClose={() => {}}>
          <span>solo</span>
        </BottomSheet>
      </AnimatePresence>,
    );
    expect(container).toBeTruthy();
    expect(screen.getByLabelText("Close")).toBeTruthy();
  });

  it("keeps the X clear of the content it used to overlap", () => {
    // The chrome row is `pt-3 pb-2` plus a 4px grabber = 24px, and the old X was
    // a 32px box at `top-2`, so its lower half sat over the first line of sheet
    // content. The button is now a flex child, so the row has to grow to fit it.
    render(<Solo onClose={() => {}} />);

    const close = screen.getByLabelText("Close");
    const row = close.parentElement as HTMLElement;
    expect(row).toBeTruthy();
    // Not absolutely positioned out of the row any more, and it is the first
    // flex child rather than overlapping the centred grabber.
    expect(close.className).not.toContain("absolute");
    expect(getComputedStyle(close).position).not.toBe("absolute");
  });
});
