"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { useTour } from "./TourProvider";

/**
 * The tour's visible layer: a dim with a lit hole over the current anchor and
 * a card carrying the words.
 *
 * ## Sits above everything the tab owns
 *
 * The tab can be fullscreen (z-100) and its sheets live at 200–400, so the
 * spotlight claims 500+. It is its own layer rather than a `BottomSheet`
 * because a sheet is the wrong shape here — this is a pointer-events-blocking
 * dim anchored to a measured rectangle, not a panel over the viewport bottom.
 *
 * ## Keyboard
 *
 * While a step is up, every keydown is swallowed in the *capture* phase. The
 * tab's single-letter shortcuts (`g`, `t`, `f`, …) listen on window too, and a
 * bubble-phase listener of ours would race theirs; capture with an immediate
 * stop is the only ordering that guarantees the planner does not act on keys
 * pressed while it is covered. Esc ends the run, arrows page it.
 */

/** Above the tab's fullscreen z-100 and its highest sheet (400). */
const TOUR_Z = 500;
const CARD_WIDTH = 320;
/** Estimated, for placement before the card has measured itself. */
const CARD_EST_HEIGHT = 200;
const GAP = 14;
const MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function TourSpotlight() {
  const tour = useTour();
  const { step } = tour;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure the anchor, following it through scrolls and resizes. A missing
  // anchor degrades to a centred card — the step still teaches.
  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    };

    measure();
    // Bring the anchor into view first, then re-measure next frame so the
    // spotlight is not left behind where the element used to be.
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === "Escape") tour.stop();
      else if (e.key === "ArrowRight" || e.key === "Enter") tour.next();
      else if (e.key === "ArrowLeft") tour.prev();
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, tour]);

  // Focus lands on the card each step, so screen readers announce it and the
  // keyboard is already where the buttons are.
  useEffect(() => {
    if (step) cardRef.current?.focus();
  }, [step]);

  if (!step) return null;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 0;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const cardLeft = rect ? clamp(rect.left, MARGIN, viewportW - CARD_WIDTH - MARGIN) : null;
  const cardTop =
    rect && rect.bottom + GAP + CARD_EST_HEIGHT < viewportH
      ? rect.bottom + GAP
      : rect
        ? clamp(rect.top - CARD_EST_HEIGHT - GAP, MARGIN, viewportH)
        : null;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: TOUR_Z }}
      data-prevent-swipe="true"
      aria-hidden={false}
    >
      {/* The dim, with a lit hole where the anchor is. The enormous shadow is
          the dim; the transparent middle is the spotlight. Clicks land here
          and go nowhere — the tour is modal on purpose. */}
      <div
        className="absolute inset-0"
        style={
          rect
            ? {
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                borderRadius: 14,
                boxShadow:
                  "0 0 0 9999px color-mix(in srgb, oklch(0.21 0.034 265) 62%, transparent)",
              }
            : {
                backgroundColor: "color-mix(in srgb, oklch(0.21 0.034 265) 62%, transparent)",
              }
        }
      />

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${tour.stepIndex + 1} of ${tour.total}. ${step.title}`}
        className="card-surface border border-border-strong rounded-2xl shadow-2xl p-4 outline-none"
        style={
          cardTop !== null && cardLeft !== null
            ? { position: "fixed", left: cardLeft, top: cardTop, width: CARD_WIDTH }
            : {
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: `min(${CARD_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
              }
        }
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Step {tour.stepIndex + 1} of {tour.total}
        </p>
        <h3 className="mt-1 font-bold text-sm text-text-heading">{step.title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{step.body}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={tour.stop}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-text-heading transition-colors px-2 py-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={tour.prev}
              disabled={tour.stepIndex === 0}
              aria-label="Previous step"
              className="p-2 rounded-lg border border-border-strong text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={tour.next}
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {tour.stepIndex + 1 === tour.total ? "Finish" : "Next"}
              {tour.stepIndex + 1 !== tour.total && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
