"use client";

import React from "react";
import {
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Percent,
  Check,
  TrendingDown,
  Lock,
} from "lucide-react";
import { PredictorAssessment, ComponentStats, safeNumber } from "@/lib/marksPredictor";
import Badge from "../../shared/Badge";

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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${accentColor}`} />
            <h4 className="text-sm font-black text-zinc-900 dark:text-white font-outfit uppercase tracking-wider">
              {label} Assessments ({stats.assessments.length})
            </h4>
          </div>
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            Scored: <strong className="text-zinc-800 dark:text-zinc-200">{stats.scoredWeight.toFixed(1)}</strong> / {stats.totalWeightConfigured} wt pts
          </div>
        </div>

        <div className="space-y-2.5">
          {stats.assessments.map((asm) => {
            const isPending = asm.isPending;
            const isSimulated = asm.isSimulated;
            const currentScore = asm.scoredMark ?? 0;
            const percentage = asm.percentage;

            return (
              <div
                key={asm.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isSimulated
                    ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800/80 shadow-2xs"
                    : isPending
                    ? "bg-white dark:bg-zinc-900/60 border-dashed border-zinc-300 dark:border-zinc-800"
                    : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-3xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Title & Status Badge */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-outfit truncate">
                        {asm.title}
                      </span>
                      {isSimulated && (
                        <span className="px-2 py-0.2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-500/20">
                          Simulated
                        </span>
                      )}
                      {!isPending && !isSimulated && (
                        <span className="px-2 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                          Locked
                        </span>
                      )}
                      {isPending && !isSimulated && (
                        <span className="px-2 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-500/20">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 mt-1">
                      <span>Max: {asm.maxMark}</span>
                      <span>•</span>
                      <span>Weightage: {asm.weightagePercent}%</span>
                      {!isPending && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            Earned: {asm.scoredWeight.toFixed(1)} wt
                          </span>
                          <span>•</span>
                          <span className="text-rose-500">
                            Lost: -{asm.lostWeight.toFixed(1)} wt
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Scored Mark / Simulation Input */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={asm.maxMark}
                        step="0.5"
                        placeholder="Pending"
                        value={asm.scoredMark === null ? "" : asm.scoredMark}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === "") {
                            onUpdateScoredMark(asm.id, null, false);
                          } else {
                            const num = Math.max(0, Math.min(asm.maxMark, safeNumber(val, 0)));
                            onUpdateScoredMark(asm.id, num, true);
                          }
                        }}
                        className="w-20 px-2.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center text-xs sm:text-sm font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-zinc-400">/ {asm.maxMark}</span>
                    </div>

                    {/* Quick Percentage Presets for this item */}
                    <div className="hidden sm:flex items-center gap-1">
                      {[100, 80, 50].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => {
                            const calc = Math.round((pct / 100) * asm.maxMark * 10) / 10;
                            onUpdateScoredMark(asm.id, calc, true);
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 text-[10px] font-black transition-colors cursor-pointer"
                          title={`Set to ${pct}% (${(pct / 100) * asm.maxMark})`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Range Slider for Interactive Simulation */}
                <div className="mt-3 flex items-center gap-3">
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
                    className="flex-1 h-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-zinc-500 w-12 text-right">
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
    <div className="space-y-6">
      {/* Simulation Quick Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-850/80 border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
            Quick Scenario Batch Presets:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onBatchSimulate(100)}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-black transition-colors border border-emerald-500/20 cursor-pointer shadow-3xs"
          >
            All 100% (Ceiling)
          </button>
          <button
            onClick={() => onBatchSimulate(90)}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-black transition-colors border border-indigo-500/20 cursor-pointer shadow-3xs"
          >
            All 90% (S Grade)
          </button>
          <button
            onClick={() => onBatchSimulate(80)}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-600 dark:text-teal-400 text-xs font-black transition-colors border border-teal-500/20 cursor-pointer shadow-3xs"
          >
            All 80% (A Grade)
          </button>
          <button
            onClick={() => onBatchSimulate(50)}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-black transition-colors border border-amber-500/20 cursor-pointer shadow-3xs"
          >
            All 50% (Average)
          </button>
          <button
            onClick={onClearSimulations}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-black transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer shadow-3xs"
            title="Reset simulations back to VTOP values"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Component Sections */}
      {theoryStats && renderAssessmentList(theoryStats, "Theory", "bg-indigo-500")}
      {labStats && renderAssessmentList(labStats, "Lab", "bg-emerald-500")}
      {projectStats && renderAssessmentList(projectStats, "Project", "bg-purple-500")}
    </div>
  );
}
