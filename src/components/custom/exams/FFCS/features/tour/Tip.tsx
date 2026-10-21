"use client";

import React from "react";
import { Lightbulb, X } from "lucide-react";
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
