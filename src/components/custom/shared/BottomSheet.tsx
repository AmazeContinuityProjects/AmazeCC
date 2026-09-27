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
 * Bottom-anchored overlay pane (App Library style) that maximises screen
 * estate: slides up on open, grabber + swipe-down + tap-outside + X +
 * Escape + predictive back all dismiss. Render inside an AnimatePresence
 * for the exit animation to play.
 */
export default function BottomSheet({
  onClose,
  maxWidth = "max-w-md",
  overlayId,
  children,
  className = "",
  contentClassName = "",
  showClose = true,
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

  // Grabber + scrolling content, optionally wrapped so the whole sheet can be
  // translated up by the keyboard inset. The offset deliberately lives on an
  // inner wrapper: the panel's own transform belongs to framer-motion and to
  // the grabber drag, so writing the offset there would fight both.
  const panelBody = (
    <>
      {/* Grabber + close */}
      <div
        className="relative flex w-full shrink-0 justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
        onPointerDown={onGrabberPointerDown}
        onPointerMove={onGrabberPointerMove}
        onPointerUp={endGrabberDrag}
        onPointerCancel={endGrabberDrag}
      >
        <div className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        {showClose && dismissable && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-2 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div
        className={`overflow-y-auto px-4 sm:px-5 pb-5 sm:pb-6 pt-1 min-h-0 ${contentClassName}`}
      >
        {children}
      </div>
    </>
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
      <m.div
        ref={panelRef}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
        className={`fixed bottom-0 left-0 right-0 z-[60] w-full ${maxWidth} sm:mx-auto flex max-h-[92dvh] flex-col overflow-hidden bg-white dark:bg-zinc-950 rounded-t-[28px] sm:bottom-6 sm:rounded-[28px] border border-zinc-200/70 dark:border-zinc-800/80 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)] ${className}`}
        style={
          {
            willChange: "transform",
            paddingBottom: lifted ? 0 : "env(safe-area-inset-bottom, 0px)",
            // An explicit height (not min-height) so descendants can resolve
            // against a definite box. Open: a comfortable sheet. With the
            // keyboard up: exactly the region above it, since the sheet is
            // bottom-anchored and then translated up by the same amount.
            height: avoidKeyboard
              ? lifted
                ? `calc(100dvh - ${keyboardInset}px)`
                : "70dvh"
              : undefined,
            // Published so descendants can zero out safe-area padding while the
            // keyboard is up (the sheet has already been lifted clear of it).
            "--sheet-kb-inset": `${keyboardInset}px`,
          } as React.CSSProperties
        }
      >
        {lifted ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{
              transform: `translateY(-${keyboardInset}px)`,
              willChange: "transform",
            }}
          >
            {panelBody}
          </div>
        ) : (
          panelBody
        )}
      </m.div>
    </>,
    document.body
  );
}
