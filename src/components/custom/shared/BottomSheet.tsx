"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";
import { X } from "lucide-react";
import { useOverlayBack } from "@/lib/overlayStack";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

interface BottomSheetProps {
  onClose: () => void;
  /** Width cap on sm+ (e.g. "max-w-md", "max-w-5xl"). Sheet stays bottom-anchored. */
  maxWidth?: string;
  /** Unique id for the system-back (predictive back) overlay stack. */
  overlayId: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Extra classes for the scrolling content wrapper. Use it to opt out of the
   * default padding when the child needs full-bleed edges (e.g. a docked
   * bottom bar). Defaults to "".
   */
  contentClassName?: string;
  /** Show the floating X button. Default true. */
  showClose?: boolean;
  /**
   * Where the panel sits.
   *
   * `"bottom"` is the default drawer: anchored to the bottom edge, full width,
   * swipe-down to dismiss. Correct for anything long or form-shaped, and every
   * pre-existing caller relies on it.
   *
   * `"center"` is a floating card, vertically and horizontally centred with a
   * gutter, for short read-only detail about something the user just tapped.
   * It has no drag handle — there is no edge to drag from — so the X moves to
   * the top right of the card, and it enters by scaling rather than sliding up
   * from below, which would read as a drawer.
   */
  placement?: "bottom" | "center";
  /** Backdrop tap handler. Defaults to onClose. */
  onBackdropClick?: () => void;
  /** Swipe-down handler. Defaults to onClose. */
  onSwipeDown?: () => void;
  /** System-back (predictive back) handler. Defaults to onClose. */
  onSystemBack?: () => void;
  /**
   * Whether the sheet can be dismissed at all. When false, the grabber,
   * swipe-down, backdrop tap, X, Escape and system back are all disabled.
   * Defaults to true.
   */
  dismissable?: boolean;
  /**
   * Lift the sheet clear of the on-screen keyboard. Off by default: most
   * sheets hold no focused text input, and an inert listener is cheaper than
   * an unconditional layout subscription.
   *
   * Only needed on iOS, where the layout viewport does not shrink when the
   * keyboard opens. Android Chrome uses `resizes-visual` by default, so its
   * `dvh` already tracks the keyboard and the measured inset stays 0 there.
   */
  avoidKeyboard?: boolean;
}

/**
 * Overlay pane, in one of two shapes.
 *
 * `"bottom"` (the default) is a bottom-anchored drawer that maximises screen
 * estate: slides up on open, grabber + swipe-down + tap-outside + X + Escape +
 * predictive back all dismiss.
 *
 * `"center"` is a floating card for short read-only detail — see `placement`.
 * Both shapes share one overlay-stack entry, one Escape handler, one scroll
 * lock and one body, so the two can never drift apart on dismissal.
 *
 * Render inside an AnimatePresence for the exit animation to play.
 */
export default function BottomSheet({
  onClose,
  maxWidth = "max-w-md",
  overlayId,
  children,
  className = "",
  contentClassName = "",
  showClose = true,
  placement = "bottom",
  onBackdropClick,
  onSwipeDown,
  onSystemBack,
  dismissable = true,
  avoidKeyboard = false,
}: BottomSheetProps) {
  const handleBackdropClick = onBackdropClick ?? onClose;
  const handleSwipeDown = onSwipeDown ?? onClose;
  const handleSystemBack = onSystemBack ?? onClose;

  const keyboardInset = useKeyboardInset(avoidKeyboard);
  const lifted = avoidKeyboard && keyboardInset > 0;

  // Mounted = open: system back dismisses the topmost sheet first
  useOverlayBack(overlayId, dismissable, handleSystemBack);

  // Portal to document.body so the sheet escapes any transformed/filtered
  // ancestor: true viewport-fixed positioning, full screen width, and a
  // z-index that reliably sits above the nav bar.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Escape to close + lock body scroll while open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, dismissable]);

  // Grabber-initiated swipe-down to dismiss (content keeps native scrolling)
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ startY: 0, dy: 0, dragging: false });

  const onGrabberPointerDown = (e: React.PointerEvent) => {
    if (!dismissable) return;
    // Never hijack presses that start on interactive elements (e.g. the X
    // button): capturing the pointer would retarget pointer-up and kill
    // their click, which breaks the X on mouse-driven viewports.
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, [role='button']")) return;
    dragState.current = { startY: e.clientY, dy: 0, dragging: true };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onGrabberPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.dragging || !panelRef.current) return;
    s.dy = Math.max(0, e.clientY - s.startY);
    panelRef.current.style.transition = "none";
    panelRef.current.style.transform = `translateY(${s.dy}px)`;
  };

  const endGrabberDrag = () => {
    const s = dragState.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (panelRef.current) {
      panelRef.current.style.transition = "";
      panelRef.current.style.transform = "";
    }
    const dy = s.dy;
    s.dy = 0;
    if (dy > 120) handleSwipeDown();
  };

  if (!portalReady) return null;

  const centered = placement === "center";

  // Same button both ways; only its positioning differs, because the drawer
  // floats it over the grabber row while the card gives it a row of its own.
  const closeButton = (position = "") =>
    showClose &&
    dismissable && (
      <button
        onClick={onClose}
        aria-label="Close"
        className={`p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer ${position}`.trim()}
      >
        <X className="w-4 h-4" />
      </button>
    );

  /**
   * Top chrome. A drawer leads with a drag handle centred on the top edge, with
   * the X floating over its right end. A centred card has no edge to pull from,
   * so the handle is dropped and the X gets a short right-aligned row of its own
   * — which also means the content below never has to dodge an absolute button.
   */
  const chrome = centered ? (
    <div className="flex w-full shrink-0 justify-end pt-3 pr-3">{closeButton()}</div>
  ) : (
    <div
      className="relative flex w-full shrink-0 justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={onGrabberPointerDown}
      onPointerMove={onGrabberPointerMove}
      onPointerUp={endGrabberDrag}
      onPointerCancel={endGrabberDrag}
    >
      <div className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      {closeButton("absolute right-4 top-2")}
    </div>
  );

  // Chrome + scrolling content, optionally wrapped by the caller so the whole
  // sheet can be translated up by the keyboard inset. That offset deliberately
  // lives on an inner wrapper: the panel's own transform belongs to framer-motion
  // and to the grabber drag, so writing the offset there would fight both.
  const panelBody = (
    <>
      {chrome}
      <div
        className={`overflow-y-auto px-4 sm:px-5 pb-5 sm:pb-6 pt-1 min-h-0 ${contentClassName}`}
      >
        {children}
      </div>
    </>
  );

  const surface =
    "flex flex-col overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800/80";

  const drawerPanel = (
    <m.div
      ref={panelRef}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
      className={`fixed bottom-0 left-0 right-0 z-[60] w-full ${maxWidth} sm:mx-auto max-h-[92dvh] ${surface} rounded-t-[28px] sm:bottom-6 sm:rounded-[28px] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)] ${className}`}
      style={
        {
          willChange: "transform",
          paddingBottom: lifted ? 0 : "env(safe-area-inset-bottom, 0px)",
          // Published so descendants can zero out safe-area padding while the
          // keyboard is up (the sheet has already been lifted clear of it).
          "--sheet-kb-inset": `${keyboardInset}px`,
        } as React.CSSProperties
      }
    >
      {panelBody}
    </m.div>
  );

  const centrePanel = (
    // The positioning layer is a plain div rather than the panel itself: the
    // panel's `transform` belongs to framer-motion, so centring with
    // `-translate-x-1/2` on the panel would be overwritten on the first frame.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className={`pointer-events-auto relative w-full ${maxWidth} max-h-[88dvh] ${surface} rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] ${className}`}
        style={{ willChange: "transform" }}
      >
        {panelBody}
      </m.div>
    </div>
  );

  const panel = centered
    ? centrePanel
    : lifted
      ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{
              transform: `translateY(-${keyboardInset}px)`,
              willChange: "transform",
            }}
          >
            {drawerPanel}
          </div>
        )
      : drawerPanel;

  return createPortal(
    <>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={dismissable ? handleBackdropClick : undefined}
        className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-xs"
        style={{ willChange: "opacity" }}
      />
      {panel}
    </>,
    document.body
  );
}
