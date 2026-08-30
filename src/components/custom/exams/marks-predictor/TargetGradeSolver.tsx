"use client";

import React, { useState } from "react";
import {
  Target,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Flame,
  Check,
} from "lucide-react";
import {
  solveTargetFAT,
  TargetFATSolverResult,
  safeNumber,
  CoursePredictionResult,
} from "@/lib/marksPredictor";

interface TargetGradeSolverProps {
  prediction: CoursePredictionResult;
}

const TARGET_PRESETS = [
  { grade: "S", score: 90, desc: "Outstanding (10 GP)", color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" },
  { grade: "A", score: 80, desc: "Excellent (9 GP)", color: "text-teal-500 border-teal-500/30 bg-teal-500/10" },
  { grade: "B", score: 70, desc: "Very Good (8 GP)", color: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  { grade: "C", score: 60, desc: "Good (7 GP)", color: "text-indigo-500 border-indigo-500/30 bg-indigo-500/10" },
  { grade: "D", score: 50, desc: "Average (6 GP)", color: "text-purple-500 border-purple-500/30 bg-purple-500/10" },
  { grade: "Pass", score: 40, desc: "Minimum Pass (5 GP)", color: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
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

  // Identify FAT in Theory or Lab
  const theoryFAT = theoryStats?.assessments.find((a) => /FAT|Final Assessment/i.test(a.title));
  const labFAT = labStats?.assessments.find((a) => /FAT|Final Assessment/i.test(a.title));

  const fatWeight = theoryFAT?.weightagePercent || 40;
  const fatMax = theoryFAT?.maxMark || 100;

  const otherLabWeight = labStats?.scoredWeight || 0;

  // Calculate FAT solver result
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
    if (Number.isFinite(num) && num > 0 && num <= 100) {
      setSelectedTargetScore(num);
    }
  };

  const getFeasibilityBadge = (feasibility: TargetFATSolverResult["feasibility"]) => {
    switch (feasibility) {
      case "secured":
        return {
          label: "Already Secured 🎉",
          color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
          icon: CheckCircle2,
        };
      case "easy":
        return {
          label: "Comfortable Target ✅",
          color: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30",
          icon: Sparkles,
        };
      case "moderate":
        return {
          label: "Achievable with Solid Prep 📚",
          color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
          icon: Target,
        };
      case "tough":
        return {
          label: "Tough Challenge 🔥",
          color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
          icon: Flame,
        };
      case "miracle":
        return {
          label: "Miracle Required ⚡",
          color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
          icon: ShieldAlert,
        };
      case "impossible":
      default:
        return {
          label: "Out of Reach ❌",
          color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
          icon: AlertTriangle,
        };
    }
  };

  const badge = getFeasibilityBadge(solverResult.feasibility);
  const BadgeIcon = badge.icon;

  return (
    <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-outfit">
              Target Grade & FAT Solver
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Calculate exact marks needed in FAT to secure your target grade
            </p>
          </div>
        </div>

        {/* Custom Target Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500">Custom Target:</span>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={customTargetInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-20 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center text-xs font-black text-zinc-900 dark:text-white"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Target Grade Preset Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TARGET_PRESETS.map((preset) => {
          const isSelected = selectedTargetScore === preset.score;
          return (
            <button
              key={preset.grade}
              onClick={() => handleSelectPreset(preset.score)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102"
                  : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-lg font-black font-outfit">{preset.grade}</span>
              <span
                className={`text-[10px] font-bold ${
                  isSelected ? "text-indigo-100" : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {preset.score}% Target
              </span>
            </button>
          );
        })}
      </div>

      {/* Solution Display Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/15 dark:border-indigo-500/20 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">
              Required Score in FAT
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                {solverResult.isAlreadyAchieved ? "0" : solverResult.requiredFATRawScore.toFixed(1)}
              </span>
              <span className="text-sm font-bold text-zinc-400">/ {solverResult.fatMaxMark}</span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 ml-1">
                {solverResult.isAlreadyAchieved ? "0%" : `${solverResult.requiredFATPercentage.toFixed(1)}%`}
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
              Contributes <strong className="text-zinc-800 dark:text-zinc-200">{solverResult.requiredFATWeight.toFixed(1)}</strong> out of {solverResult.fatWeightagePercent} weightage points
            </p>
          </div>

          {/* Feasibility Pill */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border ${badge.color} font-black text-xs sm:text-sm self-start md:self-center shadow-3xs`}>
            <BadgeIcon className="w-4 h-4 shrink-0" />
            <span>{badge.label}</span>
          </div>
        </div>

        {/* Advice Text */}
        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed bg-white/60 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
          💡 {solverResult.feasibilityMessage}
        </p>

        {/* VIT Regulation 40% Minimum Cutoff Warning */}
        {!solverResult.meetsVITMinimumCutoff && !solverResult.isAlreadyAchieved && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-black">VIT Regulation Alert:</strong> Even though you only mathematically need{" "}
              {solverResult.requiredFATRawScore.toFixed(1)}/{solverResult.fatMaxMark} to reach {selectedTargetScore}%, VIT academic regulations mandate a{" "}
              <strong>minimum of 40% in FAT (40/100 or 20/50)</strong> to pass the course.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
