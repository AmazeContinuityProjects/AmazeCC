"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";
import { X } from "lucide-react";
import { isTopOverlay, useOverlayBack } from "@/lib/overlayStack";
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
   * Where the panel sits horizontally.
   *
   * `"bottom"` is the default drawer: edge to edge, rounded at the top, swipe
   * down to dismiss. Correct for anything long or form-shaped, and every
   * pre-existing caller relies on it.
   *
   * `"bottom-center"` is the same bottom-anchored panel with a gutter on each
   * side and all four corners rounded, so it reads as a card that rose out of
   * the bottom edge rather than a sheet that took over the page. For short
   * read-only detail about something the user just tapped. It keeps the
   * grabber and the slide-up entry — a pop from the bottom is the motion that
   * connects it to the cell that summoned it.
   */
  placement?: "bottom" | "bottom-center";
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
 * estate: edge to edge, slides up on open, grabber + swipe-down + tap-outside +
 * X + Escape + predictive back all dismiss.
 *
 * `"bottom-center"` is the same panel inset from both sides with all four
 * corners rounded — a card that rises out of the bottom edge. See `placement`.
 *
 * Both shapes share one overlay-stack entry, one Escape handler, one scroll lock
 * and one body, so the two can never drift apart on dismissal. Render inside an
 * AnimatePresence for the exit animation to play.
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
  /**
   * What Escape does.
   *
   * An overridable handler rather than `onClose` directly, so a sheet that
   * repoints its swipe and backdrop handlers does not still hard-cancel on the
   * keyboard. `SyncNotification` is the caller that cares: it *parks* on
   * backdrop, swipe and system back, and only its X cancels.
   */
  const handleDismiss = useCallback(
    () => (onSwipeDown ?? onClose)(),
    [onSwipeDown, onClose]
  );

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
  //
  // Two things had to be fixed here.
  //
  // 1. LIFO. Every mounted sheet installs its own document-level listener, so a
  //    sheet nested on another sheet closed both on one Escape. System back was
  //    already LIFO via `closeTopOverlayFromPop`; Escape now checks it is the top
  //    overlay, so both dismiss paths agree.
  // 2. The X is the only affordance that means "cancel" for some sheets. The sync
  //    sheet passes `onSwipeDown`/`onBackdropClick` that *park* rather than close,
  //    so tapping outside leaves it on screen — but Escape used to call `onClose`
  //    and hard-cancel it. Escape is a dismissal gesture like the others, so it
  //    routes through the same overridable handler.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !dismissable) return;
      if (!isTopOverlay(overlayId)) return;
      handleDismiss();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleDismiss, dismissable, overlayId]);

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

  const centered = placement === "bottom-center";

  // One chrome row for both placements. The centred card keeps the grabber:
  // it is still anchored to the bottom edge, so a handle there is honest and it
  // is what makes swipe-down dismissal available. Only the panel's horizontal
  // box and corner radius differ between the two.
  //
  // The X used to be `absolute right-4 top-2` inside this row. The row is 24px
  // tall — 12px padding, a 4px grabber, 8px padding — and the button is 32px, so
  // its bottom half hung over the first line of sheet content and covered it.
  // It is now a real flex child with a matching spacer, so the row grows to fit
  // it and nothing overlaps. The grabber sits in an absolutely-positioned strip
  // of its own, which keeps it optically centred *and* keeps the X out of the
  // drag subtree entirely.
  const chrome = (
    <div className="relative flex w-full shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2">
      {showClose && dismissable ? (
        <button
          onClick={onClose}
          aria-label="Close"
          className="relative z-10 shrink-0 rounded-full bg-zinc-100 p-2 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-9 shrink-0" aria-hidden />
      )}

      <div
        className="absolute inset-x-0 top-0 flex cursor-grab justify-center pt-3 active:cursor-grabbing touch-none select-none"
        onPointerDown={onGrabberPointerDown}
        onPointerMove={onGrabberPointerMove}
        onPointerUp={endGrabberDrag}
        onPointerCancel={endGrabberDrag}
      >
        <div className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      </div>

      <span className="w-9 shrink-0" aria-hidden />
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

  // Shared by both placements: bottom-anchored, so both keep the safe-area
  // inset and both slide up out of the bottom edge. The only difference is the
  // horizontal box — a drawer runs edge to edge, a centred card does not.
  const anchoredBottom =
    "fixed bottom-0 left-0 right-0 z-[60] mx-auto sm:bottom-6 max-h-[88dvh] ";

  const rawPanel = centered ? (
    // A card, not a drawer: it stops short of both screen edges and rounds on
    // every corner, so it reads as a panel the tap summoned rather than a sheet
    // that took over the page. `w-[calc(100%-2rem)]` is what leaves the gutter —
    // `w-full` with only a max-width would sit flush against the edges on a
    // phone, which is the thing this placement exists to avoid.
    <m.div
      ref={panelRef}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
      className={`${anchoredBottom}w-[calc(100%-2rem)] ${maxWidth} ${surface} rounded-[28px] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)] ${className}`}
      style={
        {
          willChange: "transform",
          paddingBottom: lifted ? 0 : "env(safe-area-inset-bottom, 0px)",
          "--sheet-kb-inset": `${keyboardInset}px`,
        } as React.CSSProperties
      }
    >
      {panelBody}
    </m.div>
  ) : (
    <m.div
      ref={panelRef}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
      className={`${anchoredBottom}w-full ${maxWidth} ${surface} rounded-t-[28px] sm:rounded-[28px] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)] ${className}`}
      style={
        {
          willChange: "transform",
          paddingBottom: lifted ? 0 : "env(safe-area-inset-bottom, 0px)",
          "--sheet-kb-inset": `${keyboardInset}px`,
        } as React.CSSProperties
      }
    >
      {panelBody}
    </m.div>
  );

  // The keyboard offset lives on a wrapper rather than on the panel: the panel's
  // own `transform` belongs to framer-motion and to the grabber drag, so
  // writing the offset there would be overwritten on the next frame.
  const panel = lifted ? (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        transform: `translateY(-${keyboardInset}px)`,
        willChange: "transform",
      }}
    >
      {rawPanel}
    </div>
  ) : (
    rawPanel
  );

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
