import { describe, expect, it, vi, afterEach } from "vitest";
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

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

/**
 * The backdrop, not the panel.
 *
 * Selected by its own styling rather than a z-index class: the z-index is an
 * inline style (a sheet rendered above a z-300 surface passes a higher pair),
 * so it no longer appears in `className`. The backdrop's translucent overlay
 * classes are what distinguish it from the panel and the keyboard-lift wrapper,
 * which are also `fixed inset-0`.
 */
const backdrop = () => document.querySelector(".fixed.inset-0.bg-black\\/45") as HTMLElement | null;

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

const renderStack = (ids: string[], onClose: (id: string) => void) => render(<Stack ids={ids} onClose={onClose} />);

describe("BottomSheet dismissal", () => {
  it("keeps sheet content natively scrollable on touch devices without scroll chaining", () => {
    render(
      <BottomSheet overlayId="scrollable-sheet" onClose={() => {}}>
        <span>Scrollable sheet content</span>
      </BottomSheet>,
    );

    const content = document.querySelector(".overflow-y-auto");
    expect(content?.className).toContain("overflow-y-auto");
    expect(content?.className).toContain("overscroll-y-contain");
    expect(content?.className).toContain("touch-pan-y");
  });

  it("keeps the page locked until the last stacked sheet closes", () => {
    document.body.style.overflow = "auto";
    const closed: string[] = [];
    renderStack(["outer", "inner"], (id) => closed.push(id));

    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getAllByLabelText("Close")[0]);
    expect(closed).toEqual(["outer"]);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByLabelText("Close"));
    expect(closed).toEqual(["outer", "inner"]);
    expect(document.body.style.overflow).toBe("auto");
  });

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
    render(<Solo onClose={() => cancelled.push("x")} onSwipeDown={() => parked.push("park")} showClose={false} />);

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

    const overlay = backdrop();
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);

    expect(closed).toEqual(["solo"]);
  });

  it("honours a custom backdrop handler", () => {
    const parked: string[] = [];
    const closed: string[] = [];
    render(<Solo onClose={() => closed.push("x")} onBackdropClick={() => parked.push("park")} />);

    const overlay = backdrop();
    fireEvent.click(overlay!);

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

/**
 * The grabber gesture.
 *
 * A sheet that only dismisses when every pointer behaves is a sheet you have
 * to aim at. These pin the ways a real touch sequence is allowed to fail: a
 * second finger, an unrelated pointerup, a cancel, a lost capture and a window
 * blur must all leave the sheet usable, and only a completed pull past the
 * threshold may close it.
 */
describe("BottomSheet grabber gesture", () => {
  const grabber = () => document.querySelector(".cursor-grab") as HTMLElement | null;
  const panel = () => document.querySelector("[data-prevent-swipe]") as HTMLElement | null;

  const renderSheet = (onSwipeDown: () => void, dismissable = true) =>
    render(
      <BottomSheet overlayId="gesture-sheet" dismissable={dismissable} onClose={() => {}} onSwipeDown={onSwipeDown}>
        <span>content</span>
      </BottomSheet>,
    );

  const down = (id: number, y: number) =>
    fireEvent.pointerDown(grabber()!, { pointerId: id, pointerType: "touch", clientY: y });
  const move = (id: number, y: number) =>
    fireEvent.pointerMove(grabber()!, { pointerId: id, pointerType: "touch", clientY: y });
  const up = (id: number, y: number) =>
    fireEvent.pointerUp(grabber()!, { pointerId: id, pointerType: "touch", clientY: y });

  it("dismisses on a completed pull and restores the panel transform", () => {
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 300);
    expect(panel()?.style.transform).toBe("translateY(200px)");

    up(1, 300);
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
    expect(panel()?.style.transform).toBe("");
  });

  it("treats a short pull as a tap, not a dismissal", () => {
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 160);
    up(1, 160);

    expect(onSwipeDown).not.toHaveBeenCalled();
    expect(panel()?.style.transform).toBe("");
  });

  it("keeps the first pointer's drag when a second finger lands mid-drag", () => {
    // The old code re-anchored `startY` to the second finger, so the first
    // drag either jumped to the new finger or never crossed the threshold.
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    down(2, 500); // ignored: a second finger is not a new gesture
    move(1, 300);
    expect(panel()?.style.transform).toBe("translateY(200px)");

    up(1, 300);
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
  });

  it("ignores a pointerup from a pointer that never started the drag", () => {
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 300);
    up(2, 300); // another finger lifting off must not close or end the drag
    expect(onSwipeDown).not.toHaveBeenCalled();
    expect(panel()?.style.transform).toBe("translateY(200px)");

    up(1, 300); // the owning pointer still closes it
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "pointercancel",
      interrupt: () => fireEvent.pointerCancel(grabber()!, { pointerId: 1 }),
    },
    {
      name: "lostpointercapture",
      interrupt: () => fireEvent.lostPointerCapture(grabber()!, { pointerId: 1 }),
    },
    { name: "window blur", interrupt: () => fireEvent.blur(window) },
  ])("restores without dismissing on $name", ({ interrupt }) => {
    // An interrupted gesture is not a completed swipe. It must put the panel
    // back, not read the distance travelled as an instruction to close.
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 300);
    expect(panel()?.style.transform).toBe("translateY(200px)");

    interrupt();
    expect(onSwipeDown).not.toHaveBeenCalled();
    expect(panel()?.style.transform).toBe("");
  });

  it("commits a release that lands outside the grabber", () => {
    // Safety net for engines without pointer capture: the pointerup lands on
    // the page, not the handle, but it is still the owning pointer finishing
    // its own drag.
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 300);
    fireEvent.pointerUp(document.body, { pointerId: 1, pointerType: "touch", clientY: 300 });

    expect(onSwipeDown).toHaveBeenCalledTimes(1);
    expect(panel()?.style.transform).toBe("");
  });

  it("accepts a fresh drag after an interrupted one", () => {
    // Clearing state is only half the fix: the next gesture must work without
    // a reload, and a new pointer must be free to own it.
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown);

    down(1, 100);
    move(1, 300);
    fireEvent.pointerCancel(grabber()!, { pointerId: 1 });
    expect(onSwipeDown).not.toHaveBeenCalled();

    down(3, 100);
    move(3, 300);
    up(3, 300);
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
  });

  it("does not start a drag when the sheet is not dismissable", () => {
    const onSwipeDown = vi.fn();
    renderSheet(onSwipeDown, false);

    // framer-motion owns the panel's inline transform (initial `y: "100%"`).
    // A non-dismissable sheet must never have that replaced with a drag offset,
    // so compare against the value before the gesture instead of assuming "".
    const before = panel()?.style.transform;
    down(1, 100);
    move(1, 300);
    up(1, 300);

    expect(onSwipeDown).not.toHaveBeenCalled();
    expect(panel()?.style.transform).toBe(before);
    expect(panel()?.style.transform).not.toMatch(/translateY\(\d+px\)/);
  });
});
