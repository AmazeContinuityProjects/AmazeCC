"use client";

import { useRef, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "@amazecontinuityprojects/amazeui";
import { TILE, TONE_BADGE, TONE_TEXT } from "@/lib/uiTokens";
import type { CarouselState } from "./useCarousel";

/**
 * The rotating "insight" tile.
 *
 * Eight pages had this tile: hero stat, an auto-advancing carousel of them. The
 * three-slot body (label + badge / big value / subline + dots), the 6px
 * cross-fade between slides and the dot indicator were character-identical in
 * all eight — what differed was the headline size, whether the tile was
 * clickable, and whether the dots were buttons.
 *
 * ## Swiping
 *
 * Every instance is swipeable, because a card that moves on its own but cannot
 * be moved by hand is a card you have to wait out. Drag left or right, on a
 * touch screen or a mouse, and it advances; the dots and the arrow keys do the
 * same thing for anyone not dragging.
 *
 * Three details make it feel like a carousel rather than a scroll container:
 *
 *  - `touch-action: pan-y`. The tile claims horizontal panning and leaves
 *    vertical to the page, so a swipe never steals a scroll. This is why the
 *    gesture works at all — without it the browser has already decided the
 *    touch is a scroll by the time `pointermove` fires.
 *  - an axis check. A drag commits to horizontal only once it has travelled
 *    further sideways than vertically, so a slightly diagonal scroll stays a
 *    scroll.
 *  - click suppression. A swipe that ends over a clickable slide would
 *    otherwise fire that slide's `onClick` on top of navigating, which is how a
 *    "swipe for the next course" turns into "open a course page you did not
 *    ask for". The click is swallowed once per gesture, in the capture phase, so
 *    it never reaches the slide's own handler.
 */

const LABEL =
  "text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate";
const BADGE =
  "text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0";
const SUBLINE =
  "text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate";
const HEADLINE: Record<string, string> = {
  sm: "text-2xl sm:text-3xl leading-tight",
  lg: "text-3xl sm:text-4xl leading-none",
};
const DOT_ACTIVE = "w-3 bg-indigo-500";
const DOT_IDLE = "w-1.5 bg-zinc-200 dark:bg-zinc-700";

/** Shorter than this is a tap, not a swipe — under it, nothing should move. */
const SWIPE_MIN_PX = 40;
/** Travel before a drag commits to an axis. Absorbs hand tremor. */
const DRAG_SLOP_PX = 8;
/** How far sideways must beat vertical for a drag to count as a swipe. */
const AXIS_BIAS = 1.2;

export interface InsightSlide {
  id: string;
  /** Small kicker, e.g. "CGPA" or "Next Exam". */
  label: ReactNode;
  /** The big number or code. */
  value: ReactNode;
  sub?: ReactNode;
  /** Top-right pill. Omit for none. */
  badge?: ReactNode;
  /** Colours the value and the badge. `neutral` = heading ink. */
  tone?: string;
  onClick?: () => void;
  /** Overrides the tone-derived value colour (for pages with bespoke colours). */
  valueClassName?: string;
  /** Overrides the tone-derived badge colour. */
  badgeClassName?: string;
  /** Blur class applied in place, e.g. `blur-[5px]` for the CGPA privacy toggle. */
  blur?: string;
  /**
   * Accessible name for this slide's dot. Needed when the visible `label` is
   * identical across slides (e.g. two attendance tiles both labelled
   * "Attendance"), otherwise the dots announce the same thing twice.
   */
  dotLabel?: string;
}

interface Gesture {
  active: boolean;
  pointerId: number;
  x: number;
  y: number;
  horizontal: boolean;
}

const IDLE_GESTURE: Gesture = { active: false, pointerId: -1, x: 0, y: 0, horizontal: false };

export function InsightCarousel({
  slides,
  carousel,
  headlineSize = "sm",
  height = "h-32 sm:h-36",
  interactiveDots = false,
  footerRight,
  pauseOnHover = true,
  ariaLabel,
  className = "",
}: {
  slides: readonly InsightSlide[];
  carousel: CarouselState;
  headlineSize?: "sm" | "lg";
  /** Pinned height by default; some pages use a min-height. */
  height?: string;
  interactiveDots?: boolean;
  /** Trailing content on the footer line, next to the dots. */
  footerRight?: ReactNode;
  pauseOnHover?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });
  // Set when a gesture navigated, so the click the browser synthesises on
  // pointerup is swallowed instead of opening a slide.
  const swallowClick = useRef(false);
  // Tracked separately from `paused` so that letting go of a touch while the
  // pointer is still over the tile does not resume autoplay underneath a
  // mouse cursor that is deliberately hovering.
  const hovering = useRef(false);

  if (slides.length === 0) return null;

  const slide = slides[carousel.index] ?? slides[0];
  const clickable = slides.some((s) => s.onClick);
  const slideClickable = !!slide.onClick;
  const swipeable = slides.length > 1;

  const tone = slide.tone;
  const valueTone =
    !tone || tone === "neutral" || tone === "default"
      ? "text-zinc-900 dark:text-white"
      : TONE_TEXT[tone] ?? "text-zinc-900 dark:text-white";

  const resume = () => carousel.setPaused(pauseOnHover && hovering.current);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeable) return;
    // A right-click or a second finger is not a swipe.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = {
      active: true,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      horizontal: false,
    };
    carousel.setPaused(true);
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
    resume();

    if (!wasHorizontal) return;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) <= Math.abs(dy) * AXIS_BIAS) return;

    if (dx < 0) carousel.next();
    else carousel.prev();
    swallowClick.current = true;
    // Disarm shortly after. A pointer that comes up *off* the tile synthesises
    // no click at all, and a guard that stayed armed would eat the user's next
    // real tap — making the card look broken rather than guarded. The window
    // only has to outlast the click the same gesture produces.
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
    if (!swipeable) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      carousel.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      carousel.prev();
    }
  };

  // The tile is a div, not a button: `interactiveDots` needs real sibling
  // buttons and a button-inside-button is invalid HTML (and swallows the dot
  // click). The whole tile stays clickable via one absolutely positioned
  // overlay button, with the decorative body made click-transparent on top.
  return (
    <div
      className={cn(
        TILE,
        height,
        slideClickable &&
          "transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer",
        !slideClickable && "cursor-default",
        // Ours to pan horizontally; the page keeps its own vertical scroll.
        swipeable && "touch-pan-y select-none",
        className
      )}
      onMouseEnter={() => {
        if (!pauseOnHover || !swipeable) return;
        hovering.current = true;
        carousel.setPaused(true);
      }}
      onMouseLeave={() => {
        hovering.current = false;
        carousel.setPaused(false);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
    >
      {clickable ? (
        <button
          type="button"
          onClick={slide.onClick}
          disabled={!slideClickable}
          aria-label={ariaLabel}
          tabIndex={slideClickable ? 0 : -1}
          className="absolute inset-0 z-0 rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-inset"
        />
      ) : null}

      <div className="flex items-center justify-between gap-1 relative z-10 pointer-events-none">
        <span className={LABEL}>{slide.label}</span>
        {slide.badge ? (
          <span
            className={cn(
              BADGE,
              slide.badgeClassName ?? TONE_BADGE[tone] ?? TONE_BADGE.zinc
            )}
          >
            {slide.badge}
          </span>
        ) : null}
      </div>

      <div className="my-auto min-w-0 relative z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          <m.div
            key={slide.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="min-w-0"
          >
            <p
              className={cn(
                "font-black font-outfit tracking-tight truncate block",
                HEADLINE[headlineSize],
                valueTone,
                slide.valueClassName,
                slide.blur && `select-none ${slide.blur}`
              )}
            >
              {slide.value}
            </p>
          </m.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-2 relative z-10">
        {slide.sub ? (
          <p className={cn(SUBLINE, "pointer-events-none")}>{slide.sub}</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2 shrink-0">
          {footerRight}
          {slides.length > 1 ? (
            <span className="flex items-center gap-1" aria-hidden={!interactiveDots}>
              {slides.map((s, i) =>
                interactiveDots ? (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => carousel.go(i)}
                    aria-label={`Show ${
                      s.dotLabel ??
                      (typeof s.label === "string" ? s.label : `slide ${i + 1}`)
                    }`}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
                      i === carousel.index ? DOT_ACTIVE : DOT_IDLE
                    )}
                  />
                ) : (
                  <span
                    key={s.id}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === carousel.index ? DOT_ACTIVE : DOT_IDLE
                    )}
                  />
                )
              )}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
