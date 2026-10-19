"use client";

import React from "react";
import {
  Sliders,
  RotateCcw,
  BarChart3,
} from "lucide-react";
import { CoursePredictionResult, estimateComponentGrades } from "@/lib/marksPredictor";
import {
  GhostButton,
  ListRowText,
  ListShell,
  SectionHeader,
  StatTile,
  ToneBadge,
  ToneDot,
  ToneLegend,
} from "../../shared/primitives";
import { LIST_ROW, TILE_CARD } from "@/lib/uiTokens";

interface CoursePredictorHeroProps {
  prediction: CoursePredictionResult;
  /**
   * Cohort statistics for this course's assessments, keyed by VTOP title —
   * the same `class_user_marks`-backed numbers the course marks subpage shows.
   * Null when the class has not synced, or for a custom subject (no class id).
   */
  assessmentStats?: Record<string, { count: number; mean: number; sd: number }> | null;
  onOpenRegimenEditor: () => void;
  onResetCourse: () => void;
}

const fmtStat = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");

export default function CoursePredictorHero({
  prediction,
  assessmentStats,
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
    currentScoredScaled,
    potentialPendingScaled,
    pointsLostScaled,
    maxPossibleScaled,
    pacePct,
    theoryStats,
    labStats,
    projectStats,
    optimalGrade,
    maximisableGrade,
  } = prediction;

  const scoredPercent = Math.min(100, Math.max(0, currentScoredScaled));
  const pendingPercent = Math.min(100 - scoredPercent, Math.max(0, potentialPendingScaled));
  const lostPercent = Math.min(100 - (scoredPercent + pendingPercent), Math.max(0, pointsLostScaled));

  // Each half's own sub-total. `estimateComponentGrades` rates the half on its
  // released weight the same way the combined course is rated on the released
  // whole, so the lab's letter means the same thing as the course letter above.
  const totalWeightText = (theoryStats?.totalWeightConfigured ?? 0) + (labStats?.totalWeightConfigured ?? 0) > 0
    ? `${((theoryStats?.totalWeightConfigured ?? 0) + (labStats?.totalWeightConfigured ?? 0)).toFixed(0)} points`
    : "the regimen";
  const theoryPace = theoryStats ? estimateComponentGrades(theoryStats, prediction.boundaries) : null;
  const labPace = labStats ? estimateComponentGrades(labStats, prediction.boundaries) : null;

  // Which of this course's assessments the class has synced statistics for.
  // Only those get a row — the rest are the same "not enough data" case the
  // course marks subpage renders, and inventing a row for them would read as
  // a number that isn't there.
  const assessmentEntries: { asm: any; tone: "blue" | "emerald" | "violet" }[] = [
    ...(theoryStats?.assessments ?? []).map((asm: any) => ({ asm, tone: "blue" as const })),
    ...(labStats?.assessments ?? []).map((asm: any) => ({ asm, tone: "emerald" as const })),
    ...(projectStats?.assessments ?? []).map((asm: any) => ({ asm, tone: "violet" as const })),
  ];
  const withStats = assessmentEntries.filter(({ asm }) => assessmentStats?.[asm.title]);

  return (
    <div className={`${TILE_CARD} w-full max-w-full space-y-3.5`}>
      {/* Header */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <ToneBadge tone="indigo">{courseCode}</ToneBadge>
          <ToneBadge tone="zinc">{courseType}</ToneBadge>
          {prediction.isCurved ? (
            <ToneBadge tone="amber">Curved</ToneBadge>
          ) : null}
          {isEmbedded ? (
            <ToneBadge tone="violet">
              Embedded {theoryCredits}T + {labCredits}L
            </ToneBadge>
          ) : (
            <ToneBadge tone="zinc">{theoryCredits || labCredits} credits</ToneBadge>
          )}
        </div>
        <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit tracking-tight leading-tight break-words">
          {courseTitle}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={onOpenRegimenEditor} title="Edit assessment regimen">
            <Sliders className="w-3.5 h-3.5" />
            Assessment Regimen
          </GhostButton>
          <GhostButton onClick={onResetCourse} title="Reset to VTOP marks">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </GhostButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Max possible"
          value={maxPossibleScaled.toFixed(1)}
          tone="emerald"
          sub={`Maximisable ${maximisableGrade.letter} · of 100`}
          height="h-28"
        />
        <StatTile
          label="Points lost"
          value={pointsLostScaled > 0 ? `-${pointsLostScaled.toFixed(1)}` : "0.0"}
          tone={pointsLostScaled > 0 ? "red" : "emerald"}
          sub={
            isEmbedded
              ? `Theory -${theoryStats?.lostWeight?.toFixed(1) ?? "0.0"} · Lab -${labStats?.lostWeight?.toFixed(1) ?? "0.0"}`
              : "Permanent deficit"
          }
          height="h-28"
        />
        <StatTile
          label="Secured"
          value={currentScoredScaled.toFixed(1)}
          tone="indigo"
          sub={`Pace ${pacePct.toFixed(1)}% · Pending ${potentialPendingScaled.toFixed(1)} pts`}
          height="h-28"
        />
        <StatTile
          label="Optimal grade"
          value={optimalGrade?.letter ?? "—"}
          tone={optimalGrade?.tone ?? "zinc"}
          sub={optimalGrade?.description ?? "No marks recorded yet"}
          height="h-28"
        />
      </div>

      {/* Segmented progress */}
      <div className="space-y-2.5">
        <ToneLegend
          items={[
            { tone: "indigo", label: `Locked ${scoredPercent.toFixed(1)}%` },
            { tone: "sky", label: `Pending ${pendingPercent.toFixed(1)}%` },
            { tone: "red", label: `Lost ${lostPercent.toFixed(1)}%` },
          ]}
        />
        <div className="h-3 w-full rounded-xl bg-surface-tertiary dark:bg-surface-secondary overflow-hidden flex">
          <div style={{ width: `${scoredPercent}%` }} className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" />
          <div
            style={{ width: `${pendingPercent}%` }}
            className="h-full bg-sky-400 dark:bg-sky-500 transition-all duration-300"
          />
          <div style={{ width: `${lostPercent}%` }} className="h-full bg-red-500 dark:bg-red-600 transition-all duration-300" />
        </div>
      </div>

      {/* Per-assessment cohort statistics.
          Only the assessments this class has actually synced get a row; the
          rest are the same "not enough data" case the marks subpage renders. */}
      {withStats.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader icon={BarChart3} title="Assessment statistics" count={withStats.length} />
          <p className="px-1 -mt-1 text-[11px] leading-relaxed text-text-secondary dark:text-text-muted font-medium">
            Class mean and spread for each synced assessment.
          </p>
          <ListShell>
            {withStats.map(({ asm, tone }) => {
              const stat = assessmentStats?.[asm.title];
              return (
                <div key={asm.id} className={LIST_ROW}>
                  <ToneDot tone={tone} />
                  <ListRowText
                    title={asm.title}
                    subtitle={`${stat?.count ?? 0} samples · μ ${fmtStat(stat?.mean ?? 0)} · σ ${fmtStat(stat?.sd ?? 0)}`}
                  />
                </div>
              );
            })}
          </ListShell>
        </div>
      )}

      {/* Embedded course = one blended grade, but its two halves each carry
          their own total — the lab's pace and ceiling stand beside the theory's,
          and the tiles above are the combination. Same shape as the marks
          subpage's embedded segments. */}
      {isEmbedded && (theoryStats || labStats) && (
        <ListShell>
          {theoryStats && (
            <div className={LIST_ROW}>
              <ToneDot tone="blue" />
              <ListRowText
                title={`Theory · ${theoryCredits} credits`}
                subtitle={
                  theoryPace?.optimal
                    ? `Optimal ${theoryPace.optimal.letter} · maximisable ${theoryPace.maximisable.letter} · scored ${theoryStats.scoredWeight.toFixed(1)} / lost ${theoryStats.lostWeight.toFixed(1)}`
                    : `No theory marks recorded yet · maximisable ${theoryPace?.maximisable.letter ?? "—"}`
                }
              />
            </div>
          )}
          {labStats && (
            <div className={LIST_ROW}>
              <ToneDot tone="emerald" />
              <ListRowText
                title={`Lab · ${labCredits} credit${labCredits === 1 ? "" : "s"}`}
                subtitle={
                  labPace?.optimal
                    ? `Optimal ${labPace.optimal.letter} · maximisable ${labPace.maximisable.letter} · scored ${labStats.scoredWeight.toFixed(1)} / lost ${labStats.lostWeight.toFixed(1)}`
                    : `No lab marks recorded yet · maximisable ${labPace?.maximisable.letter ?? "—"}`
                }
              />
            </div>
          )}
          <div className={LIST_ROW}>
            <ToneDot tone="violet" />
            <ListRowText
              title="Combined"
              subtitle={`${currentScoredScaled.toFixed(1)} secured of ${totalWeightText} · optimal ${optimalGrade?.letter ?? "—"} / maximisable ${maximisableGrade.letter}`}
            />
          </div>
        </ListShell>
      )}
    </div>
  );
}
