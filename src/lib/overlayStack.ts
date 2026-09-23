"use client";

import { useEffect, useRef } from "react";

interface OverlayEntry {
  id: string;
  close: () => void;
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
 * Dismiss the topmost overlay. Returns true when something was closed.
 * Called from the global popstate handler: the OS gesture already popped a
 * history entry, so the caller re-pushes the current screen to resync.
 */
export function closeTopOverlayFromPop(): boolean {
  const top = stack.pop() || null;
  if (!top) return false;
  try { top.close(); } catch {}
  return true;
}

/**
 * Bind an overlay's open state to the system back gesture/button.
 *
 * While open, the overlay sits on the stack; a system back press closes the
 * topmost overlay instead of navigating screens. Closing in-app (or
 * unmounting) simply unregisters — no history bookkeeping needed because
 * overlays never push their own entries.
 */
export function useOverlayBack(id: string, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    removeEntry(id);
    stack.push({ id, close: () => closeRef.current() });
    return () => {
      removeEntry(id);
    };
  }, [id, open]);
}
