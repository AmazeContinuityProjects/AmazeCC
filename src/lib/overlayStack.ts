"use client";

import { useEffect, useRef } from "react";
import { continueBackPastDeadEntry, readHistoryOp, writeHistoryEntry } from "./historyStack";

interface OverlayEntry {
  id: string;
  close: () => void | boolean;
}

// LIFO stack of currently open overlays (modals, palettes, in-tab subpages).
// The top entry is what the system back gesture/button dismisses first —
// ahead of screen navigation, matching Android back behavior.
const stack: OverlayEntry[] = [];

function removeEntry(id: string) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx !== -1) stack.splice(idx, 1);
}

export function hasOpenOverlays(): boolean {
  return stack.length > 0;
}

/**
 * Install the overlay popstate handler for standalone routes that do not
 * render Main's app-wide screen-history handler. Replacing the current route
 * entry gives its first sheet a same-route entry to return to, including when
 * the route was opened directly from outside the app.
 */
export function useOverlayBackBoundary(id: string) {
  useEffect(() => {
    writeHistoryEntry("replace", { op: { kind: "page", id } });

    const handlePopState = (event: PopStateEvent) => {
      if (closeTopOverlayFromPop()) return;
      const op = readHistoryOp(event.state);
      // An overlay entry left behind by an in-app close has nothing to dismiss:
      // keep walking so the gesture reaches a real step. Landing on *this*
      // route's own entry means the walk has reached the present (the sheet's
      // entry sat above it) — back with nothing open should leave the route, so
      // it keeps walking too. A *different* route's page entry is a real step
      // back to that route and is left to the browser.
      if (op?.kind === "overlay" || (op?.kind === "page" && op.id === id)) {
        continueBackPastDeadEntry(event);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [id]);
}

/**
 * Handle the topmost overlay's back action. Returns true when something
 * consumed it, whether it closed or moved to an earlier state in place.
 * Called from the global popstate handler: the OS gesture already popped a
 * history entry, so the caller decides whether the screen beneath needs to be
 * re-pushed.
 */
export function closeTopOverlayFromPop(): boolean {
  const top = stack.pop() || null;
  if (!top) return false;
  try {
    // A page-like overlay can consume back internally (for example, move to
    // the previous guided step). Recreate its entry so the next gesture can
    // continue through that page instead of leaving the app's history stack.
    if (top.close() === true) {
      stack.push(top);
      writeHistoryEntry("push", { op: { kind: "overlay", id: top.id } });
    }
  } catch {}
  return true;
}

/**
 * Whether `id` is the overlay the user is currently looking at.
 *
 * The Escape key is a document-level event, so every mounted sheet sees it —
 * unlike system back, which goes through `closeTopOverlayFromPop` and is
 * therefore already LIFO. Without this check a single Escape in a sheet stacked
 * on another sheet closed both of them, because each sheet's own listener fired.
 */
export function isTopOverlay(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1]?.id === id;
}

/**
 * Bind an overlay's open state to the system back gesture/button.
 *
 * Every back-able overlay owns a history entry while it is open. The OS back
 * gesture pops that entry and the popstate handler dismisses the overlay —
 * the entry *is* the op. Owning it, instead of borrowing a screen's entry,
 * is what makes back work on the very first screen (where there is no screen
 * entry to borrow) and keeps the whole chain of ops addressable by back, not
 * just the screens.
 *
 * `onClose` may return `true` when back was handled inside the overlay (for
 * example, by moving to a previous wizard step). That keeps the entry active
 * and writes a replacement history entry for the next gesture.
 *
 * Closing an overlay in-app (X, backdrop, Escape) deliberately leaves its
 * entry in place rather than rewriting or rewinding it. `replaceState` cannot
 * delete an entry, and rewinding races the next navigation (the pop lands
 * asynchronously, after whatever the close triggered has already pushed). The
 * entry is instead inert: the popstate handler finds no overlay to dismiss and
 * walks back past it, so the gesture that eventually pops it still lands on a
 * real step — see `continueBackPastDeadEntry`.
 */
export function useOverlayBack(id: string, open: boolean, onClose: () => void | boolean) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    removeEntry(id);
    stack.push({ id, close: () => closeRef.current() });
    writeHistoryEntry("push", { op: { kind: "overlay", id } });
    return () => {
      removeEntry(id);
    };
  }, [id, open]);
}
