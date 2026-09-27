"use client";

import type { ReactNode } from "react";
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
  if (slides.length === 0) return null;

  const slide = slides[carousel.index] ?? slides[0];
  const clickable = slides.some((s) => s.onClick);
  const slideClickable = !!slide.onClick;

  const tone = slide.tone;
  const valueTone =
    !tone || tone === "neutral" || tone === "default"
      ? "text-zinc-900 dark:text-white"
      : TONE_TEXT[tone] ?? "text-zinc-900 dark:text-white";

  const hoverProps =
    slideClickable && pauseOnHover
      ? {
          onMouseEnter: () => carousel.setPaused(true),
          onMouseLeave: () => carousel.setPaused(false),
          onTouchStart: () => carousel.setPaused(true),
          onTouchEnd: () => carousel.setPaused(false),
        }
      : {};

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
        className
      )}
      {...hoverProps}
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
