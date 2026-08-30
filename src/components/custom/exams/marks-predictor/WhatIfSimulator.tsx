"use client";

import React from "react";
import {
  Sparkles,
  Zap,
  RotateCcw,
} from "lucide-react";
import { PredictorAssessment, ComponentStats, safeNumber } from "@/lib/marksPredictor";

interface WhatIfSimulatorProps {
  theoryStats: ComponentStats | null;
  labStats: ComponentStats | null;
  projectStats: ComponentStats | null;
  onUpdateScoredMark: (id: string, mark: number | null, isSimulated: boolean) => void;
  onBatchSimulate: (percentage: number) => void;
  onClearSimulations: () => void;
}

export default function WhatIfSimulator({
  theoryStats,
  labStats,
  projectStats,
  onUpdateScoredMark,
  onBatchSimulate,
  onClearSimulations,
}: WhatIfSimulatorProps) {
  const renderAssessmentList = (stats: ComponentStats, label: string, accentColor: string) => {
    return (
      <div className="space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full ${accentColor} shrink-0`} />
            <h4 className="text-xs font-black text-zinc-900 dark:text-white font-outfit uppercase tracking-wider truncate">
              {label} ({stats.assessments.length})
            </h4>
          </div>
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0">
            <strong className="text-zinc-800 dark:text-zinc-200">{stats.scoredWeight.toFixed(1)}</strong> / {stats.totalWeightConfigured} wt
          </div>
        </div>

        <div className="space-y-2">
          {stats.assessments.map((asm) => {
            const isPending = asm.isPending;
            const isSimulated = asm.isSimulated;
            const percentage = asm.percentage;

            return (
              <div
                key={asm.id}
                className={`p-3 rounded-[18px] border transition-all min-w-0 overflow-hidden ${
                  isSimulated
                    ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800/80 shadow-2xs"
                    : isPending
                    ? "bg-white dark:bg-zinc-900/60 border-dashed border-zinc-300 dark:border-zinc-800"
                    : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-3xs"
                }`}
              >
                {/* Title row — wraps, never overflows */}
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-xs font-black text-zinc-900 dark:text-white font-outfit truncate min-w-0 flex-1">
                      {asm.title}
                    </span>
                    {isSimulated && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-500/20 shrink-0">
                        Simulated
                      </span>
                    )}
                    {!isPending && !isSimulated && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 shrink-0">
                        Locked
                      </span>
                    )}
                    {isPending && !isSimulated && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-500/20 shrink-0">
                        Pending
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    <span>Max: {asm.maxMark}</span>
                    <span className="text-zinc-300">•</span>
                    <span>Wt: {asm.weightagePercent}%</span>
                    {!isPending && (
                      <>
                        <span className="text-zinc-300">•</span>
                        <span className="text-indigo-600 dark:text-indigo-400">Earned: {asm.scoredWeight.toFixed(1)}</span>
                        <span className="text-zinc-300">•</span>
                        <span className="text-rose-500">Lost: -{asm.lostWeight.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Controls — stack on mobile, row on larger */}
                <div className="flex flex-col xs:flex-row xs:items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <input
                      type="number"
                      min="0"
                      max={asm.maxMark}
                      step="0.5"
                      placeholder="—"
                      value={asm.scoredMark === null ? "" : asm.scoredMark}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === "") onUpdateScoredMark(asm.id, null, false);
                        else {
                          const num = Math.max(0, Math.min(asm.maxMark, safeNumber(val, 0)));
                          onUpdateScoredMark(asm.id, num, true);
                        }
                      }}
                      className="w-full xs:w-20 px-2.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center text-xs font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                    />
                    <span className="text-[11px] font-bold text-zinc-400 shrink-0">/ {asm.maxMark}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[100, 80, 50].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => {
                          const calc = Math.round((pct / 100) * asm.maxMark * 10) / 10;
                          onUpdateScoredMark(asm.id, calc, true);
                        }}
                        className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 text-[10px] font-black transition-colors cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2.5">
                  <input
                    type="range"
                    min="0"
                    max={asm.maxMark}
                    step="0.5"
                    value={asm.scoredMark === null ? 0 : asm.scoredMark}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateScoredMark(asm.id, val, true);
                    }}
                    className="flex-1 min-w-0 h-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-zinc-500 w-10 text-right shrink-0">
                    {asm.scoredMark === null ? "0%" : `${percentage.toFixed(0)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Quick presets — single scrollable row on mobile, wraps on larger */}
      <div className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 truncate">Quick Scenario Presets</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          <button onClick={() => onBatchSimulate(100)} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-black border border-emerald-500/20 cursor-pointer shadow-3xs whitespace-nowrap">
            All 100%
          </button>
          <button onClick={() => onBatchSimulate(90)} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-black border border-indigo-500/20 cursor-pointer shadow-3xs whitespace-nowrap">
            All 90%
          </button>
          <button onClick={() => onBatchSimulate(80)} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-600 dark:text-teal-400 text-[11px] font-black border border-teal-500/20 cursor-pointer shadow-3xs whitespace-nowrap">
            All 80%
          </button>
          <button onClick={() => onBatchSimulate(50)} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[11px] font-black border border-amber-500/20 cursor-pointer shadow-3xs whitespace-nowrap">
            All 50%
          </button>
          <button onClick={onClearSimulations} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-black border border-zinc-200 dark:border-zinc-700 cursor-pointer shadow-3xs whitespace-nowrap">
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {theoryStats && renderAssessmentList(theoryStats, "Theory", "bg-indigo-500")}
      {labStats && renderAssessmentList(labStats, "Lab", "bg-emerald-500")}
      {projectStats && renderAssessmentList(projectStats, "Project", "bg-purple-500")}
    </div>
  );
}
