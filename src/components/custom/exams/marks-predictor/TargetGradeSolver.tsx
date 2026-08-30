"use client";

import React, { useState } from "react";
import {
  Target,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Flame,
  ShieldAlert,
} from "lucide-react";
import {
  solveTargetFAT,
  TargetFATSolverResult,
  CoursePredictionResult,
} from "@/lib/marksPredictor";

interface TargetGradeSolverProps {
  prediction: CoursePredictionResult;
}

const TARGET_PRESETS = [
  { grade: "S", score: 90, desc: "Outstanding (10 GP)" },
  { grade: "A", score: 80, desc: "Excellent (9 GP)" },
  { grade: "B", score: 70, desc: "Very Good (8 GP)" },
  { grade: "C", score: 60, desc: "Good (7 GP)" },
  { grade: "D", score: 50, desc: "Average (6 GP)" },
  { grade: "Pass", score: 40, desc: "Minimum Pass (5 GP)" },
];

export default function TargetGradeSolver({ prediction }: TargetGradeSolverProps) {
  const [selectedTargetScore, setSelectedTargetScore] = useState<number>(90);
  const [customTargetInput, setCustomTargetInput] = useState<string>("90");

  const {
    isEmbedded,
    theoryCredits,
    labCredits,
    theoryStats,
    labStats,
    currentScoredScaled,
  } = prediction;

  const theoryFAT = theoryStats?.assessments.find((a) => /FAT|Final Assessment/i.test(a.title));
  const fatWeight = theoryFAT?.weightagePercent || 40;
  const fatMax = theoryFAT?.maxMark || 100;
  const otherLabWeight = labStats?.scoredWeight || 0;

  const solverResult: TargetFATSolverResult = solveTargetFAT({
    targetScore: selectedTargetScore,
    currentScoredScaled: theoryStats?.scoredWeight || currentScoredScaled,
    fatWeightagePercent: fatWeight,
    fatMaxMark: fatMax,
    theoryCredits,
    labCredits,
    isEmbedded,
    component: "theory",
    otherComponentWeighted: otherLabWeight,
  });

  const handleSelectPreset = (score: number) => {
    setSelectedTargetScore(score);
    setCustomTargetInput(score.toString());
  };

  const handleCustomChange = (val: string) => {
    setCustomTargetInput(val);
    const num = parseFloat(val);
    if (Number.isFinite(num) && num > 0 && num <= 100) setSelectedTargetScore(num);
  };

  const getFeasibilityBadge = (feasibility: TargetFATSolverResult["feasibility"]) => {
    switch (feasibility) {
      case "secured":
        return { label: "Already Secured 🎉", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 };
      case "easy":
        return { label: "Comfortable ✅", color: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30", icon: Sparkles };
      case "moderate":
        return { label: "Achievable 📚", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30", icon: Target };
      case "tough":
        return { label: "Tough 🔥", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Flame };
      case "miracle":
        return { label: "Miracle ⚡", color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30", icon: ShieldAlert };
      default:
        return { label: "Out of Reach ❌", color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30", icon: AlertTriangle };
    }
  };

  const badge = getFeasibilityBadge(solverResult.feasibility);
  const BadgeIcon = badge.icon;

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[22px] border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
      {/* Header — stacks on mobile, like SimplifiedAcademicsPage pills header */}
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit truncate">Target Grade & FAT Solver</h3>
            <p className="text-[11px] text-zinc-400 font-medium truncate">Calculate exact marks needed in FAT</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-500 shrink-0">Target:</span>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={customTargetInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-20 pl-3 pr-6 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center text-xs font-black text-zinc-900 dark:text-white min-w-0"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 pointer-events-none">%</span>
          </div>
        </div>
      </div>

      {/* Presets — horizontally scrollable on mobile, never forces viewport overflow */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {TARGET_PRESETS.map((preset) => {
          const isSelected = selectedTargetScore === preset.score;
          return (
            <button
              key={preset.grade}
              onClick={() => handleSelectPreset(preset.score)}
              className={`shrink-0 flex flex-col items-center justify-center px-3 py-2.5 rounded-2xl border transition-all cursor-pointer min-w-[72px] ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40"
              }`}
            >
              <span className="text-sm font-black font-outfit">{preset.grade}</span>
              <span className={`text-[10px] font-bold whitespace-nowrap ${isSelected ? "text-indigo-100" : "text-zinc-400 dark:text-zinc-500"}`}>
                {preset.score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Solution */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/15 dark:border-indigo-500/20 space-y-3 overflow-hidden">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Required in FAT</span>
            <div className="flex items-baseline gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                {solverResult.isAlreadyAchieved ? "0" : solverResult.requiredFATRawScore.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-zinc-400">/ {solverResult.fatMaxMark}</span>
              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                {solverResult.isAlreadyAchieved ? "0%" : `${solverResult.requiredFATPercentage.toFixed(1)}%`}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-1 break-words">
              Contributes <strong className="text-zinc-800 dark:text-zinc-200">{solverResult.requiredFATWeight.toFixed(1)}</strong> / {solverResult.fatWeightagePercent} wt
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${badge.color} font-black text-xs shadow-3xs w-fit max-w-full`}>
            <BadgeIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{badge.label}</span>
          </div>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed bg-white/60 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 break-words">
          💡 {solverResult.feasibilityMessage}
        </p>
        {!solverResult.meetsVITMinimumCutoff && !solverResult.isAlreadyAchieved && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium break-words">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-black">VIT Regulation:</strong> Even though you only need {solverResult.requiredFATRawScore.toFixed(1)}/
              {solverResult.fatMaxMark} for {selectedTargetScore}%, a <strong>minimum 40% in FAT (40/100)</strong> is required to pass.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
