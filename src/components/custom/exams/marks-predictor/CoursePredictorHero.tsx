"use client";

import React from "react";
import {
  Trophy,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Lock,
  Layers,
  Sliders,
  RotateCcw,
  BookOpen,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { CoursePredictionResult } from "@/lib/marksPredictor";
import Badge from "../../shared/Badge";

interface CoursePredictorHeroProps {
  prediction: CoursePredictionResult;
  onOpenRegimenEditor: () => void;
  onResetCourse: () => void;
  onScrollToSimulator: () => void;
  onScrollToTargetSolver: () => void;
}

export default function CoursePredictorHero({
  prediction,
  onOpenRegimenEditor,
  onResetCourse,
  onScrollToSimulator,
  onScrollToTargetSolver,
}: CoursePredictorHeroProps) {
  const {
    courseCode,
    courseTitle,
    courseType,
    isEmbedded,
    theoryCredits,
    labCredits,
    totalCredits,
    currentScoredScaled,
    potentialPendingScaled,
    pointsLostScaled,
    maxPossibleScaled,
    theoryStats,
    labStats,
    estimatedGrade,
    ceilingGrade,
    riskLevel,
  } = prediction;

  // Percentage calculations for segmented bar
  const scoredPercent = Math.min(100, Math.max(0, currentScoredScaled));
  const pendingPercent = Math.min(100 - scoredPercent, Math.max(0, potentialPendingScaled));
  const lostPercent = Math.min(100 - (scoredPercent + pendingPercent), Math.max(0, pointsLostScaled));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-br from-white via-zinc-50/50 to-indigo-50/20 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-indigo-950/20 p-5 sm:p-7 shadow-xs">
      {/* Decorative Glow Background */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/8 dark:bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-emerald-500/5 dark:bg-emerald-500/8 blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs font-outfit shadow-2xs">
              {courseCode}
            </span>
            <Badge variant="default" className="text-[10px] font-bold py-0.5">
              {courseType}
            </Badge>
            {isEmbedded && (
              <Badge variant="default" className="text-[10px] font-bold py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                Embedded ({theoryCredits}T + {labCredits}L = {totalCredits} Credits)
              </Badge>
            )}
            {!isEmbedded && (
              <Badge variant="default" className="text-[10px] font-bold py-0.5">
                {totalCredits} Credits
              </Badge>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-outfit mt-2 tracking-tight">
            {courseTitle}
          </h2>
        </div>

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenRegimenEditor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-black transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60"
            title="Configure assessments, weightages and presets"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Assessment Regimen</span>
          </button>

          <button
            onClick={onResetCourse}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-black transition-all cursor-pointer"
            title="Reset to default VTOP assessment data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
        {/* 1. Max Possible Ceiling */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Max Possible
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-outfit tracking-tight">
                {maxPossibleScaled.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">/ 100</span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
              Ceiling: <span className="font-bold text-zinc-700 dark:text-zinc-300">{ceilingGrade.letter} Grade</span> max
            </p>
          </div>
        </div>

        {/* 2. Weightage Points Lost */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Points Lost
            </span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
              pointsLostScaled > 20
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight ${
                pointsLostScaled > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {pointsLostScaled > 0 ? `-${pointsLostScaled.toFixed(1)}` : "0.0"}
              </span>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">wt pts</span>
            </div>
            <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {isEmbedded ? (
                <span>
                  T: <strong className="text-zinc-700 dark:text-zinc-300">-{theoryStats?.lostWeight.toFixed(1) || "0.0"}</strong> | L: <strong className="text-zinc-700 dark:text-zinc-300">-{labStats?.lostWeight.toFixed(1) || "0.0"}</strong>
                </span>
              ) : (
                <span>Permanent weightage deficit</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Locked / Secured Scored Marks */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Secured Scored
            </span>
            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-outfit tracking-tight">
                {currentScoredScaled.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">pts locked</span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
              Pending: <strong className="text-zinc-700 dark:text-zinc-300">{potentialPendingScaled.toFixed(1)} pts</strong>
            </p>
          </div>
        </div>

        {/* 4. Current / Estimated Grade */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Est. Grade
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight ${estimatedGrade.color}`}>
                {estimatedGrade.letter}
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${estimatedGrade.bg} ${estimatedGrade.color} ${estimatedGrade.border}`}>
                {estimatedGrade.letter} Grade
              </span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {estimatedGrade.description}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Segmented Progress Bar */}
      <div className="relative z-10 mt-6 p-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
            Course Marks Breakdown (100 Scale)
          </span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-500" />
              Locked: {scoredPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 dark:bg-sky-500" />
              Pending: {pendingPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Lost: {lostPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="h-4 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${scoredPercent}%` }}
            className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
            title={`Locked: ${scoredPercent.toFixed(1)}%`}
          />
          <div
            style={{ width: `${pendingPercent}%` }}
            className="h-full bg-sky-400 dark:bg-sky-500/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.2)_6px,rgba(255,255,255,0.2)_12px)] transition-all duration-300"
            title={`Pending / Potential: ${pendingPercent.toFixed(1)}%`}
          />
          <div
            style={{ width: `${lostPercent}%` }}
            className="h-full bg-rose-500 dark:bg-rose-600 transition-all duration-300"
            title={`Lost: ${lostPercent.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Embedded Breakdown Pill Info */}
      {isEmbedded && (theoryStats || labStats) && (
        <div className="relative z-10 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {theoryStats && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="font-bold text-zinc-700 dark:text-zinc-300">Theory ({theoryCredits} Credits)</span>
              </div>
              <div className="font-extrabold text-zinc-600 dark:text-zinc-400">
                Scored: <span className="text-indigo-600 dark:text-indigo-400">{theoryStats.scoredWeight.toFixed(1)}</span> / {theoryStats.totalWeightConfigured} wt · Lost: <span className="text-rose-500">-{theoryStats.lostWeight.toFixed(1)}</span>
              </div>
            </div>
          )}
          {labStats && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-zinc-700 dark:text-zinc-300">Lab ({labCredits} Credits)</span>
              </div>
              <div className="font-extrabold text-zinc-600 dark:text-zinc-400">
                Scored: <span className="text-emerald-600 dark:text-emerald-400">{labStats.scoredWeight.toFixed(1)}</span> / {labStats.totalWeightConfigured} wt · Lost: <span className="text-rose-500">-{labStats.lostWeight.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
