"use client";

import React from "react";
import { TONE_TEXT } from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";

/**
 * The single grade-ladder visual.
 *
 * One proportional band bar rather than rows: on a phone a row per grade is a
 * wall of scrolling, and the only thing each row said was a letter and a
 * number. The letter carries the meaning; the tint only says "this slice of
 * the ladder". Both the course marks subpage and the course predictor page
 * render the engine's ladder through this, so the two screens cannot disagree
 * about where a band starts again.
 */
const GRADE_BAR: Record<string, string> = {
  S: "bg-amber-500",
  A: "bg-emerald-500",
  B: "bg-blue-500",
  C: "bg-cyan-500",
  D: "bg-violet-500",
  E: "bg-red-500",
  F: "bg-red-600",
  N: "bg-zinc-400",
  P: "bg-violet-500",
};

const GRADE_TINT: Record<string, string> = {
  S: "bg-amber-500/15",
  A: "bg-emerald-500/15",
  B: "bg-blue-500/15",
  C: "bg-cyan-500/15",
  D: "bg-violet-500/15",
  E: "bg-red-500/15",
  F: "bg-red-500/10",
  N: "bg-zinc-500/10",
  P: "bg-violet-500/15",
};

export interface LadderBand {
  grade: string;
  limit: number;
  /** Percentage points the band spans, so the bar shows "how much room is in this grade". */
  width: number;
  range: string;
}

export default function GradeLadderChart({
  bands,
  standingGrade,
  currentPct,
  dimmed = false,
}: {
  bands: LadderBand[];
  /** The band the reader is standing in right now (ringed). */
  standingGrade?: string | null;
  /** The reader's position on the 0-100 ladder, for the standing note below. */
  currentPct?: number | null;
  /** Grayscale until the data the ladder depends on resolves. */
  dimmed?: boolean;
}) {
  return (
    <>
      <div
        className={`flex h-10 w-full gap-0.5 overflow-hidden ${dimmed ? "opacity-60 grayscale" : ""}`}
      >
        {bands.map((b) => (
          <div
            key={b.grade}
            title={`Grade ${b.grade} · ${b.range}`}
            style={{ flexGrow: Math.max(b.width, 1.5), flexBasis: 0, flexShrink: 1 }}
            className={`min-w-0 flex items-center justify-center rounded-lg ${
              GRADE_TINT[b.grade] ?? "bg-zinc-500/10"
            } ${standingGrade === b.grade && !dimmed ? "ring-2 ring-inset ring-indigo-500" : ""}`}
          >
            <span className={`text-[11px] font-black font-outfit ${TONE_TEXT[toneForGrade(b.grade)]}`}>
              {b.grade}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
        {bands.map((b) => (
          <span key={b.grade} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${GRADE_BAR[b.grade] ?? "bg-zinc-400"}`} />
            {b.grade} {b.range}
          </span>
        ))}
      </div>

      {standingGrade && currentPct != null && !dimmed ? (
        <p className="mt-2.5 text-[11px] font-bold text-text-heading">
          On {currentPct.toFixed(1)}% of the ladder — inside the{" "}
          <span className={TONE_TEXT[toneForGrade(standingGrade)]}>{standingGrade}</span> band.
        </p>
      ) : null}
    </>
  );
}
