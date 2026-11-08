"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Lightbulb, X } from "lucide-react";
import type { FFCSHint } from "./useTips";

/**
 * One dismissible hint. Pure presentation — visibility and the persisted
 * dismissal live in `useTips`, so the same hint list can render anywhere the
 * tab wants it without each call site re-deriving "is this still relevant".
 */
export function Tip({ hint, onDismiss }: { hint: FFCSHint; onDismiss: () => void }) {
  return (
    <div className="card-surface border border-border-strong rounded-xl px-3 py-2.5 flex items-start gap-2.5">
      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{hint.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tip"
        className="p-1 rounded-md text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/50 transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * All current hints in one card, one at a time.
 *
 * Stacked, four hints filled a phone's whole first screen before the planner
 * itself began. The deck keeps the same hints and the same per-hint dismissal,
 * but costs one row: "Got it" retires the hint on screen for good, the arrows
 * page through the rest.
 */
export function TipDeck({ hints, onDismiss }: { hints: readonly FFCSHint[]; onDismiss: (id: string) => void }) {
  const [index, setIndex] = React.useState(0);
  if (hints.length === 0) return null;
  const at = Math.min(index, hints.length - 1);
  const hint = hints[at];
  const many = hints.length > 1;
  const step = (delta: number) => setIndex((at + delta + hints.length) % hints.length);
  const navButton =
    "p-1.5 rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

  return (
    <div
      role="region"
      aria-label="Planner tips"
      className="card-surface border border-border-strong rounded-2xl pl-3 pr-1.5 py-2 flex items-center gap-2.5"
    >
      <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
      </span>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1 min-w-0" aria-live="polite">
        {many ? (
          <span className="font-bold text-text-secondary dark:text-text-muted mr-1.5">
            Tip {at + 1}/{hints.length}
          </span>
        ) : null}
        {hint.text}
      </p>
      <div className="flex items-center shrink-0">
        {many ? (
          <>
            <button type="button" aria-label="Previous tip" className={navButton} onClick={() => step(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" aria-label="Next tip" className={navButton} onClick={() => step(1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onDismiss(hint.id)}
          aria-label="Dismiss tip"
          title="Got it, don't show again"
          className={navButton}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
