"use client";

import { useRef } from "react";

/**
 * Horizontal swipe for a surface that shows one thing at a time.
 *
 * A tile that moves on its own but cannot be moved by hand is a tile you have
 * to wait out; a strip of dates that changes only via two chevrons is a strip
 * you have to aim at. Both consumers here — the rotating insight tile and the
 * home page's week strip — are one-visible-thing surfaces, so the gesture is
 * identical for both: drag left or right, on a touch screen or a mouse, and it
 * moves to the neighbour.
 *
 * ## Three details make it feel like a carousel rather than a scroll container
 *
 *  - `touch-action: pan-y`. The surface claims horizontal panning and leaves
 *    vertical to the page, so a swipe never steals a scroll. This is why the
 *    gesture works at all — without it the browser has already decided the
 *    touch is a scroll by the time `pointermove` fires.
 *  - an axis check. A drag commits to horizontal only once it has travelled
 *    further sideways than vertically, so a slightly diagonal scroll stays a
 *    scroll. This matters most on a phone, where both consumers sit inside a
 *    vertically scrolling page.
 *  - click suppression. A swipe that ends over a clickable child would
 *    otherwise fire that child's `onClick` on top of navigating, which is how a
 *    "swipe for the next course" turns into "open a course page you did not ask
 *    for". The click is swallowed once per gesture, in the capture phase, so it
 *    never reaches the child's own handler.
 *
 * ## Usage
 *
 * `handlers` and `className` must land on the *same* element — the class is
 * what tells the browser we own the horizontal axis, and it does nothing at all
 * sitting on a parent. The child that owns the direction (a slide index, a week
 * offset) is told which way the gesture went by `onNext` / `onPrev`, not by a
 * value read back from here, so there is exactly one place direction lives.
 */

/** Shorter than this is a tap, not a swipe — under it, nothing should move. */
const SWIPE_MIN_PX = 40;
/** Travel before a drag commits to an axis. Absorbs hand tremor. */
const DRAG_SLOP_PX = 8;
/** How far sideways must beat vertical for a drag to count as a swipe. */
const AXIS_BIAS = 1.2;

interface Gesture {
  active: boolean;
  pointerId: number;
  x: number;
  y: number;
  horizontal: boolean;
}

const IDLE_GESTURE: Gesture = { active: false, pointerId: -1, x: 0, y: 0, horizontal: false };

export interface HorizontalSwipeOptions {
  /** Committed on a leftward swipe. */
  onNext: () => void;
  /** Committed on a rightward swipe. */
  onPrev: () => void;
  /** When false the surface is inert: no handlers fire and no class is added. */
  enabled?: boolean;
  /**
   * Fires `true` when a gesture starts and `false` when it ends. A surface
   * with autoplay pauses here, so a swipe can never be undone by the tick that
   * happened to land under the finger.
   */
  onActiveChange?: (active: boolean) => void;
}

export interface HorizontalSwipe {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onClickCapture: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  /** `touch-pan-y select-none`, or `""` when disabled. */
  className: string;
}

export function useHorizontalSwipe({
  onNext,
  onPrev,
  enabled = true,
  onActiveChange,
}: HorizontalSwipeOptions): HorizontalSwipe {
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });
  // Set when a gesture navigated, so the click the browser synthesises on
  // pointerup is swallowed instead of hitting whatever is underneath.
  const swallowClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    // A right-click or a second finger is not a swipe.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = {
      active: true,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      horizontal: false,
    };
    onActiveChange?.(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.active || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.horizontal) {
      if (Math.abs(dx) < DRAG_SLOP_PX) return;
      // Still ambiguous until the horizontal lead is clear.
      if (Math.abs(dx) < Math.abs(dy) * AXIS_BIAS) return;
      g.horizontal = true;
    }
    // `touch-action: pan-y` has already promised the browser we own the
    // horizontal axis, so this only has to stop text selection on a mouse drag.
    if (e.cancelable) e.preventDefault();
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.active || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const wasHorizontal = g.horizontal;
    gesture.current = { ...IDLE_GESTURE };
    onActiveChange?.(false);

    if (!wasHorizontal) return;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) <= Math.abs(dy) * AXIS_BIAS) return;

    if (dx < 0) onNext();
    else onPrev();
    swallowClick.current = true;
    // Disarm shortly after. A pointer that comes up *off* the surface
    // synthesises no click at all, and a guard that stayed armed would eat the
    // user's next real tap — making the surface look broken rather than
    // guarded. The window only has to outlast the click the same gesture
    // produces.
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 400);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
      onClickCapture,
      onKeyDown,
    },
    className: enabled ? "touch-pan-y select-none" : "",
  };
}
