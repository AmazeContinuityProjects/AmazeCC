"use client";

import React, { useState } from "react";
import { Target, AlertTriangle, CheckCircle2, Sparkles, Flame, ShieldAlert } from "lucide-react";
import { solveTargetFAT, TargetFATSolverResult, CoursePredictionResult, estimateGrade } from "@/lib/marksPredictor";
import { isAssessmentPublished, isFinalExamAssessment, onlyFatRemains } from "./useCoursePredictionScope";
import { ChipTabs, ToneBadge } from "../../shared/primitives";
import { FIELD_INPUT, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

interface TargetGradeSolverProps {
  prediction: CoursePredictionResult;
  /** The goal saved for this course (a percentage), if any. */
  savedTargetScore?: number | null;
  /** Writes the goal to the course's storage key on every change. */
  onPersistTargetScore?: (score: number) => void;
}

export default function TargetGradeSolver({
  prediction,
  savedTargetScore,
  onPersistTargetScore,
}: TargetGradeSolverProps) {
  // Band floors read off the prediction's own ladder: the presets name the
  // same letters the hero shows, so on a curved course targeting "A" means the
  // curve's A threshold, not the fixed 80. Absolute ladders reproduce the
  // historic presets exactly (90/80/70/60/50/40).
  const TARGET_PRESETS = prediction.boundaries.slice(0, 5).map((band) => ({
    grade: band.grade === "E" ? "Pass" : band.grade,
    score: Math.max(0, band.limit),
    desc: estimateGrade(band.limit, prediction.boundaries).description,
  }));

  const [selectedTargetScore, setSelectedTargetScore] = useState<number>(
    savedTargetScore ?? TARGET_PRESETS[0]?.score ?? 90,
  );
  const [customTargetInput, setCustomTargetInput] = useState<string>(
    String(savedTargetScore ?? TARGET_PRESETS[0]?.score ?? 90),
  );

  const { isEmbedded, theoryCredits, labCredits, theoryStats, labStats, currentScoredScaled } = prediction;

  // The final exam that actually decides this course. A theory-carrying course
  // solves against the theory FAT; a lab-only course has no theory half, so its
  // final is the Lab FAT and the solve runs in the lab's own weight space.
  // Hardcoding the theory side made a lab subject ask "what do I need in a FAT
  // that does not exist" while its Lab FAT just sat there deciding the grade.
  const finalRow = theoryStats
    ? theoryStats.assessments.find((a) => /FAT|Final Assessment/i.test(a.title))
    : labStats?.assessments.find((a) => /FAT|Final Assessment/i.test(a.title));
  const solvesLab = !theoryStats;
  const fatExamName = finalRow?.title?.trim() || (solvesLab ? "Lab FAT" : "FAT");
  const fatWeight = finalRow?.weightagePercent || 40;
  const fatMax = finalRow?.maxMark || 100;
  // The current score is the earned weight points of the half being solved —
  // published marks plus every what-if the reader entered on this page, which
  // is the point of the exercise: set what you expect on the CATs and the
  // required final-exam mark moves right away. It must NOT contain the final
  // exam's own points, though: `scoredWeight` sums every marked row, and a
  // graded (or what-if'd) FAT would count as ground already won before the
  // very exam this solve is asking about — subtract the final row's own
  // earn and the deficit stays honest. Unmarked, that row contributes 0 and
  // nothing changes. The lab half as "other" keeps its full score on
  // purpose: whatever it already delivered, FAT included, is fixed ground
  // the theory solve must plan around.
  const earnedExcludingFinal = (stats: typeof theoryStats) =>
    stats
      ? stats.scoredWeight -
        stats.assessments.filter((row) => isFinalExamAssessment(row)).reduce((sum, row) => sum + row.scoredWeight, 0)
      : 0;
  const currentComponentWeighted = theoryStats
    ? earnedExcludingFinal(theoryStats)
    : labStats
      ? earnedExcludingFinal(labStats)
      : currentScoredScaled;
  const otherComponentWeighted = solvesLab ? 0 : labStats?.scoredWeight || 0;

  // The card's two gates. The solve speaks only once every other assessment
  // carries a mark — before that the answer moves with each blank the reader
  // has yet to fill — and a posted FAT is a fact, not a variable: the card
  // leaves the page entirely instead of answering.
  const gateOpen = onlyFatRemains(prediction);
  const fatPublished = finalRow ? isAssessmentPublished(finalRow) : false;

  // What the gate is still waiting on, named for the reader — blanks in the
  // lists, and the other component's own FAT (the Lab FAT of a combined
  // course), which is an ordinary mark the reader has to place by hand.
  const otherHalfList = solvesLab ? theoryStats?.assessments : labStats?.assessments;
  const otherFat = otherHalfList?.find((a) => isFinalExamAssessment(a));
  const otherFatMissing = Boolean(otherFat && otherFat.scoredMark === null);
  const otherHalfLabel = solvesLab ? "Theory" : "Lab";
  const missingBlanks = [theoryStats?.assessments, labStats?.assessments]
    .flatMap((list) => list ?? [])
    .filter((a) => !isFinalExamAssessment(a) && (a.scoredMark === null || a.scoredMark === undefined)).length;

  const solverResult: TargetFATSolverResult = solveTargetFAT({
    targetScore: selectedTargetScore,
    currentScoredScaled: currentComponentWeighted,
    fatWeightagePercent: fatWeight,
    fatMaxMark: fatMax,
    theoryCredits,
    labCredits,
    isEmbedded: isEmbedded && !solvesLab,
    component: solvesLab ? "lab" : "theory",
    otherComponentWeighted,
  });

  // The goal, named: at this ladder the chosen percentage lands in this band —
  // the belt between "90" and "grade B" closed.
  const targetGradeOnLadder = estimateGrade(selectedTargetScore, prediction.boundaries).letter;

  const handleSelectPreset = (score: number) => {
    setSelectedTargetScore(score);
    setCustomTargetInput(score.toString());
    // The target is the user's goal for this course — it persists in the
    // course's storage key, not just this page's lifetime.
    onPersistTargetScore?.(score);
  };

  const handleCustomChange = (val: string) => {
    setCustomTargetInput(val);
    const num = parseFloat(val);
    if (Number.isFinite(num) && num > 0 && num <= 100) {
      setSelectedTargetScore(num);
      onPersistTargetScore?.(num);
    }
  };

  const getFeasibility = (feasibility: TargetFATSolverResult["feasibility"]) => {
    switch (feasibility) {
      case "secured":
        return { label: "Already secured", tone: "emerald", icon: CheckCircle2 };
      case "easy":
        return { label: "Comfortable", tone: "cyan", icon: Sparkles };
      case "moderate":
        return { label: "Achievable", tone: "blue", icon: Target };
      case "tough":
        return { label: "Tough", tone: "amber", icon: Flame };
      case "miracle":
        return { label: "Miracle", tone: "violet", icon: ShieldAlert };
      default:
        return { label: "Out of reach", tone: "red", icon: AlertTriangle };
    }
  };

  const badge = getFeasibility(solverResult.feasibility);
  const BadgeIcon = badge.icon;

  // A posted FAT is a fact: there is nothing left to aim at, so the card
  // steps aside entirely — the list's locked row and the ladder carry the
  // course from here.
  if (fatPublished) return null;

  return (
    <div className={`${TILE_CARD} w-full max-w-full space-y-4`}>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
        Aim {targetGradeOnLadder} ({selectedTargetScore}%) on this ladder
        {gateOpen ? ` — calculated as the exact marks needed in ${fatExamName}.` : "."}
      </p>

      {/* Presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-500 shrink-0">Target:</span>
          <span className="relative w-20 shrink-0">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={customTargetInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              aria-label="Target percentage"
              className={`${FIELD_INPUT} text-center pr-7`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 pointer-events-none">
              %
            </span>
          </span>
        </div>
        <ChipTabs
          value={String(selectedTargetScore)}
          onChange={(v) => handleSelectPreset(Number(v))}
          options={TARGET_PRESETS.map((preset) => ({
            value: String(preset.score),
            label: (
              <span className="inline-flex flex-col items-center leading-tight">
                <span>{preset.grade}</span>
                <span className="opacity-80">{preset.score}%</span>
              </span>
            ),
            title: preset.desc,
          }))}
        />
      </div>

      {/* The final exam's slot — frozen, not a way in. The FAT is never
          editable: the prediction counts it as zero and only ever *asks*
          about it, so the tile states the freeze and the solve below does
          the talking. */}
      <div className="w-full flex items-center gap-3 py-3 px-3.5 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 text-left">
        <span
          className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.amber}`}
        >
          <Flame className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black text-text-heading font-outfit uppercase tracking-wider truncate">
            {fatExamName} · {fatWeight} wt · /{fatMax}
          </span>
          <span className="block text-[11px] font-semibold mt-0.5 text-zinc-500 dark:text-zinc-400">
            Counted as 0 — frozen; the prediction never lets this be filled.
          </span>
        </span>
        <ToneBadge tone="amber" size="sm">
          Frozen
        </ToneBadge>
      </div>

      {/* Solution — gated: the solve speaks only when every other assessment
          carries a mark. The gate's copy does the teaching too — people
          stall here without knowing the blanks are theirs to fill. */}
      {!gateOpen ? (
        <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3.5 py-3">
          <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300 font-medium">
            <strong className="font-black text-zinc-800 dark:text-zinc-100">
              Assign a mark to every other assessment first.
            </strong>{" "}
            {otherFatMissing ? (
              <>
                That includes the{" "}
                <strong className="font-black text-zinc-800 dark:text-zinc-100">{otherFat?.title}</strong> — tap its row
                in the {otherHalfLabel} list above and type what you expect.{" "}
              </>
            ) : null}
            {missingBlanks > 0 ? (
              <>
                {missingBlanks === 1 ? "One assessment is" : `${missingBlanks} assessments are`} still blank in the
                lists above — tap a row to enter what you expect, or use Simulate… to fill them all at once.{" "}
              </>
            ) : null}
            Once only {fatExamName} remains, this card answers exactly what you need in it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                Required in {fatExamName}
              </p>
              <p className="mt-1 flex items-baseline gap-2 flex-wrap min-w-0">
                <span className="text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                  {solverResult.isAlreadyAchieved ? "0" : solverResult.requiredFATRawScore.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-zinc-400">/ {solverResult.fatMaxMark}</span>
                <ToneBadge tone="indigo">
                  {solverResult.isAlreadyAchieved ? "0%" : `${solverResult.requiredFATPercentage.toFixed(1)}%`}
                </ToneBadge>
              </p>
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
                Contributes{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {solverResult.requiredFATWeight.toFixed(1)}
                </strong>{" "}
                / {solverResult.fatWeightagePercent} wt
              </p>
            </div>
            <ToneBadge tone={badge.tone} size="lg" icon={<BadgeIcon className="h-3.5 w-3.5" />}>
              {badge.label}
            </ToneBadge>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
            {solverResult.feasibilityMessage}
          </p>
          {!solverResult.meetsVITMinimumCutoff && !solverResult.isAlreadyAchieved && (
            <div className={`${TILE_CARD} flex items-center gap-3`}>
              <span
                className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.amber}`}
              >
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                <strong className="font-black">VIT Regulation:</strong> Even though you only need{" "}
                {solverResult.requiredFATRawScore.toFixed(1)}/{solverResult.fatMaxMark} for {selectedTargetScore}%, a{" "}
                <strong>minimum 40% in FAT (40/100)</strong> is required to pass.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
