"use client";

import React from "react";
import { Lock } from "lucide-react";
import BottomSheet from "../../shared/BottomSheet";
import { ToneBadge } from "../../shared/primitives";
import { weightFreezeFor, type WeightFreeze } from "./useCoursePredictionScope";

const FIELD =
  "w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500";
const PCT_CHIPS = [100, 80, 50];

interface SheetAssessment {
  id: string;
  title: string;
  maxMark: number;
  weightagePercent: number;
  component: string;
  scoredMark: number | null;
  percentage: number;
  isPending: boolean;
  isSimulated: boolean;
  scoredWeight: number;
  lostWeight: number;
}

/**
 * The per-assessment mark editor, in a bottom sheet.
 *
 * Editing marks never happens inline on the row anymore — the sheet is the one
 * place a what-if mark is entered, so every surface taps into the same editor
 * and the row stays a clean list item. The mark updates live (the prediction
 * re-renders behind the sheet); the row's weightage is read-only info here,
 * because weightage edits live in the regimen editor and freeze rules apply
 * there.
 */
export default function AssessmentMarkSheet({
  asm,
  tone,
  cohortStat,
  onClose,
  onUpdateScoredMark,
}: {
  asm: SheetAssessment;
  tone: "blue" | "emerald" | "violet";
  /** μ/σ the class synced for this assessment (null = no data yet). */
  cohortStat?: { count: number; mean: number; sd: number } | null;
  onClose: () => void;
  onUpdateScoredMark: (id: string, mark: number | null, isSimulated: boolean) => void;
}) {
  const maxMark = asm.maxMark;
  const freeze: WeightFreeze = weightFreezeFor(asm);

  return (
    <BottomSheet
      onClose={onClose}
      overlayId={`predictor-mark-${asm.component}-${asm.id}`}
      maxWidth="max-w-md"
      avoidKeyboard
      title={asm.title}
      closeLabel="Close mark entry"
    >
      <div className="space-y-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ToneBadge tone="zinc">
              Max {maxMark} · wt {asm.weightagePercent}%
              {freeze.frozen ? (
                <Lock className="inline w-2.5 h-2.5 ml-1 -mt-0.5" aria-label="Weightage frozen" />
              ) : null}
            </ToneBadge>
            {asm.isSimulated ? <ToneBadge tone="indigo">Simulated</ToneBadge> : null}
            {!asm.isPending && !asm.isSimulated ? <ToneBadge tone="emerald">Published</ToneBadge> : null}
            {asm.isPending && !asm.isSimulated ? <ToneBadge tone="amber">Pending</ToneBadge> : null}
            {cohortStat ? (
              <ToneBadge tone="blue">
                Class μ {cohortStat.mean.toFixed(1)} · σ {cohortStat.sd.toFixed(1)}
              </ToneBadge>
            ) : null}
          </div>
        </div>

        {/* Mark entry */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={maxMark}
              step="0.5"
              placeholder="—"
              value={asm.scoredMark === null ? "" : asm.scoredMark}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val === "") onUpdateScoredMark(asm.id, null, false);
                else
                  onUpdateScoredMark(
                    asm.id,
                    Math.max(0, Math.min(maxMark, Number(val) || 0)),
                    true
                  );
              }}
              aria-label={`Mark for ${asm.title}`}
              className={`${FIELD} w-24 text-center`}
            />
            <span className="text-sm font-bold text-zinc-400 shrink-0">/ {maxMark}</span>
            <span className="flex-1" />
            <span className="flex items-center gap-1">
              {PCT_CHIPS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    onUpdateScoredMark(asm.id, Math.round((pct / 100) * maxMark * 10) / 10, true)
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-indigo-500/10 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-black transition-colors cursor-pointer"
                >
                  {pct}%
                </button>
              ))}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={maxMark}
              step="0.5"
              value={asm.scoredMark === null ? 0 : asm.scoredMark}
              onChange={(e) => onUpdateScoredMark(asm.id, Number(e.target.value), true)}
              aria-label={`Drag mark for ${asm.title}`}
              style={
                {
                  "--range-fill": `${Math.min(
                    100,
                    Math.max(0, ((asm.scoredMark ?? 0) / Math.max(1, maxMark)) * 100)
                  )}%`,
                } as React.CSSProperties
              }
              className="m3-range w-full"
            />
            <span className="text-xs font-bold text-zinc-500 w-12 text-right shrink-0">
              {asm.scoredMark === null ? "0%" : `${asm.percentage.toFixed(0)}%`}
            </span>
          </div>
        </div>

        {/* Weight impact */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          <span>
            Earned <strong className="text-emerald-600 dark:text-emerald-400">{asm.scoredWeight.toFixed(1)}</strong> wt
          </span>
          <span>
            Lost <strong className="text-red-500">-{asm.lostWeight.toFixed(1)}</strong> wt
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}
