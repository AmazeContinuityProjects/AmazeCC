"use client";

import React from "react";
import {
  Trophy,
  Sparkles,
  TrendingDown,
  Lock,
  Sliders,
  RotateCcw,
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
  } = prediction;

  const scoredPercent = Math.min(100, Math.max(0, currentScoredScaled));
  const pendingPercent = Math.min(100 - scoredPercent, Math.max(0, potentialPendingScaled));
  const lostPercent = Math.min(100 - (scoredPercent + pendingPercent), Math.max(0, pointsLostScaled));

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[22px] border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 shadow-2xs p-3.5 sm:p-4 space-y-3.5">
      {/* Header — simple row like SimplifiedAcademicsPage */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs font-outfit shadow-2xs shrink-0">
            {courseCode}
          </span>
          <Badge variant="default" className="text-[10px] font-bold py-0.5 shrink-0">
            {courseType}
          </Badge>
          {isEmbedded ? (
            <Badge
              variant="default"
              className="text-[10px] font-bold py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shrink-0 max-w-full truncate"
            >
              Embedded {theoryCredits}T + {labCredits}L = {totalCredits} Credits
            </Badge>
          ) : (
            <Badge variant="default" className="text-[10px] font-bold py-0.5 shrink-0">
              {totalCredits} Credits
            </Badge>
          )}
        </div>
        <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit tracking-tight leading-tight break-words">
          {courseTitle}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenRegimenEditor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-black transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Assessment Regimen</span>
          </button>
          <button
            onClick={onResetCourse}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-black transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Stats — stays 2 columns on mobile, same as SimplifiedAcademicsPage insight cards, no wide lg:grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col justify-between p-3 rounded-[18px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
              Max Possible
            </span>
            <div className="w-6 h-6 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-outfit tracking-tight">
                {maxPossibleScaled.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-zinc-400">/ 100</span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Ceiling: <span className="font-bold text-zinc-700 dark:text-zinc-300">{ceilingGrade.letter}</span> max
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-[18px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
              Points Lost
            </span>
            <div
              className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 ${
                pointsLostScaled > 20
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span
                className={`text-xl font-black font-outfit tracking-tight ${
                  pointsLostScaled > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pointsLostScaled > 0 ? `-${pointsLostScaled.toFixed(1)}` : "0.0"}
              </span>
              <span className="text-[10px] font-bold text-zinc-400">wt pts</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {isEmbedded ? (
                <span>
                  T: <strong className="text-zinc-700 dark:text-zinc-300">-{theoryStats?.lostWeight.toFixed(1) ?? "0.0"}</strong> · L:{" "}
                  <strong className="text-zinc-700 dark:text-zinc-300">-{labStats?.lostWeight.toFixed(1) ?? "0.0"}</strong>
                </span>
              ) : (
                <span>Permanent deficit</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-[18px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
              Secured
            </span>
            <div className="w-6 h-6 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-outfit tracking-tight">
                {currentScoredScaled.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-zinc-400">pts</span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Pending: <strong className="text-zinc-700 dark:text-zinc-300">{potentialPendingScaled.toFixed(1)} pts</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-[18px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
              Est. Grade
            </span>
            <div className="w-6 h-6 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xl font-black font-outfit tracking-tight ${estimatedGrade.color}`}>
                {estimatedGrade.letter}
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${estimatedGrade.bg} ${estimatedGrade.color} ${estimatedGrade.border}`}>
                {estimatedGrade.letter}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {estimatedGrade.description}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Progress — compact, no overflow */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
        <div className="flex flex-col gap-2 mb-2.5 min-w-0">
          <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 truncate">Course Marks Breakdown (100 Scale)</span>
          <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 shrink-0" />
              Locked: {scoredPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400 dark:bg-sky-500 shrink-0" />
              Pending: {pendingPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              Lost: {lostPercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="h-3 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
          <div style={{ width: `${scoredPercent}%` }} className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" />
          <div
            style={{ width: `${pendingPercent}%` }}
            className="h-full bg-sky-400 dark:bg-sky-500/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.2)_6px,rgba(255,255,255,0.2)_12px)] transition-all duration-300"
          />
          <div style={{ width: `${lostPercent}%` }} className="h-full bg-rose-500 dark:bg-rose-600 transition-all duration-300" />
        </div>
      </div>

      {isEmbedded && (theoryStats || labStats) && (
        <div className="grid grid-cols-1 gap-2.5">
          {theoryStats && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/50 text-xs min-w-0 overflow-hidden">
              <span className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300 truncate">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                Theory ({theoryCredits} Credits)
              </span>
              <span className="font-extrabold text-zinc-600 dark:text-zinc-400 text-[11px] truncate">
                Scored: <span className="text-indigo-600 dark:text-indigo-400">{theoryStats.scoredWeight.toFixed(1)}</span> / {theoryStats.totalWeightConfigured} · Lost:{" "}
                <span className="text-rose-500">-{theoryStats.lostWeight.toFixed(1)}</span>
              </span>
            </div>
          )}
          {labStats && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/50 text-xs min-w-0 overflow-hidden">
              <span className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                Lab ({labCredits} Credits)
              </span>
              <span className="font-extrabold text-zinc-600 dark:text-zinc-400 text-[11px] truncate">
                Scored: <span className="text-emerald-600 dark:text-emerald-400">{labStats.scoredWeight.toFixed(1)}</span> / {labStats.totalWeightConfigured} · Lost:{" "}
                <span className="text-rose-500">-{labStats.lostWeight.toFixed(1)}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
