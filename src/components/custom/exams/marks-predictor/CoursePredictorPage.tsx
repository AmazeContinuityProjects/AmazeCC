"use client";

import React, { useEffect, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Gauge,
  Lock,
  Plus,
  RotateCcw,
  Sliders,
  Zap,
} from "lucide-react";
import { TONE_TEXT } from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";
import {
  GhostButton,
  InsightCarousel,
  IconButton,
  ListRowText,
  ListShell,
  SectionHeader,
  StatTile,
  ToneBadge,
  ToneDot,
  ToneLegend,
  useCarousel,
  type InsightSlide,
} from "../../shared/primitives";
import { estimateComponentGrades } from "@/lib/marksPredictor";
import {
  remainingWeightFor,
  useCoursePredictionScope,
  weightFreezeFor,
  type EnrolledCourseItem,
} from "./useCoursePredictionScope";
import AssessmentMarkSheet from "./AssessmentMarkSheet";
import AddAssessmentSheet from "./AddAssessmentSheet";
import GradeLadderChart, { type LadderBand } from "./GradeLadderChart";
import AssessmentRegimenEditor from "./AssessmentRegimenEditor";
import TargetGradeSolver from "./TargetGradeSolver";

/* ------------------------------------------------------------------ */
/* Per-assessment row: the outer list's row language; editing lives in  */
/* the bottom sheet                                                     */
/* ------------------------------------------------------------------ */

function AssessmentStatRow({
  asm,
  tone,
  cohortStat,
  onOpen,
}: {
  asm: {
    id: string;
    title: string;
    maxMark: number;
    weightagePercent: number;
    scoredMark: number | null;
    percentage: number;
    isPending: boolean;
    isSimulated: boolean;
    scoredWeight: number;
    lostWeight: number;
  };
  tone: "blue" | "emerald" | "violet";
  /** μ/σ the class synced for this assessment (null = no data yet). */
  cohortStat?: { count: number; mean: number; sd: number } | null;
  onOpen: () => void;
}) {
  const freeze = weightFreezeFor(asm);

  const stateBadge = asm.isSimulated
    ? { tone: "indigo", text: `${asm.percentage.toFixed(0)}%` }
    : asm.isPending
      ? { tone: "zinc", text: "—" }
      : { tone: "emerald", text: `${asm.percentage.toFixed(0)}%` };

  const parts = [`Max ${asm.maxMark}`, `wt ${asm.weightagePercent}%`];
  if (cohortStat) {
    parts.push(`μ ${cohortStat.mean.toFixed(1)}`, `σ ${cohortStat.sd.toFixed(1)}`);
  } else if (!asm.isPending) {
    parts.push(`earned ${asm.scoredWeight.toFixed(1)}`, `lost -${asm.lostWeight.toFixed(1)}`);
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 py-3 px-4 text-left cursor-pointer min-w-0 group"
    >
      <ToneDot tone={tone} />
      <ListRowText title={asm.title} titleTooltip={asm.title} subtitle={parts.join(" · ")} />
      <span className="flex items-center gap-2 shrink-0">
        {freeze.frozen ? (
          <Lock className="w-3 h-3 text-zinc-400" aria-label="Weightage frozen" />
        ) : null}
        <ToneBadge tone={stateBadge.tone} size="sm">
          {stateBadge.text}
        </ToneBadge>
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                             */
/* ------------------------------------------------------------------ */

/**
 * The predictor for a single course: one fixed stat card beside one carousel
 * stat card, then every assessment as list rows spread evenly across theory
 * and lab.
 *
 * This is the page the course subpage's "Grade Predictor" entry opens and the
 * destination the global predictor's subject list leads to — one component so
 * both places show the same numbers for the same course. It mounts nothing that
 * can add or remove subjects; that belongs to the global list, which sees every
 * course. From inside a course, the subject roster is not this page's business.
 *
 * Editing happens in bottom sheets only: a row's tap opens the mark editor,
 * a half's add button opens the add-assessment form (which can claim only the
 * weight still open — published weightages are frozen facts and the FAT's 40%
 * is reserved until VTOP publishes it). Everything the user shapes — marks,
 * regimen, target — persists per course in storage.
 *
 * Custom subjects (say, an elective VTOP does not record) still work here: a
 * page for one simply has no class id, so it shows no cohort statistics and its
 * regimen comes entirely from storage.
 */
export default function CoursePredictorPage({
  course,
  marksStats,
  actionsSlotRef,
}: {
  course: EnrolledCourseItem;
  /** Cohort stats keyed by class id; null for custom subjects (no class id). */
  marksStats?: Record<string, any>;
  /**
   * When the parent hands this over, the page portals its square controls
   * (regimen editor + reset) into that element — the parent shell's own
   * action row, so they sit beside the back button like the curriculum
   * page's toolbar. Without it the controls stay in the page's header line.
   */
  actionsSlotRef?: RefObject<HTMLElement | null>;
}) {
  const {
    config,
    updateConfig,
    reset,
    prediction,
    assessmentStats,
    classStats,
    targetScore,
    persistTargetScore,
  } = useCoursePredictionScope(course, marksStats);

  const [isRegimenEditorOpen, setIsRegimenEditorOpen] = useState(false);
  /** The assessment whose mark sheet is open, with its half's tone. */
  const [sheetAsm, setSheetAsm] = useState<{
    asm: Parameters<typeof AssessmentStatRow>[0]["asm"];
    tone: "blue" | "emerald" | "violet";
  } | null>(null);
  /** The half the add-assessment sheet targets. */
  const [addFor, setAddFor] = useState<"theory" | "lab" | null>(null);

  // The parent's action row hands over a DOM slot; refs land during the commit,
  // so the first paint falls back to the inline header line and the portal
  // adopts the row on the next tick.
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActionsEl(actionsSlotRef?.current ?? null);
  }, [actionsSlotRef, course.courseCode]);

  // The regimen editor only offers a lab tab when there is a lab side to edit.
  // The type string is the ground truth VTOP gives; course payloads back it up
  // (an embedded course carries both payloads, a theory-only one does not).
  const type = course.courseType.toLowerCase();
  const isEmbedded = type.includes("lab") || Boolean(course.theoryCourse && course.labCourse);

  // Carousel slide count must be derived before the early return below — hooks
  // cannot sit behind it. The slides (built once the prediction exists) push
  // the theory/lab half pages under the same three conditionals.
  const carouselCount =
    3 +
    (isEmbedded && prediction?.theoryStats ? 1 : 0) +
    (isEmbedded && prediction?.labStats ? 1 : 0);
  const carousel = useCarousel(carouselCount);

  if (!prediction) return null;

  // The page's square controls — rendered inline in the header line, or
  // portaled into the parent shell's action row when it provides the slot.
  const predictorButtons = (
    <>
      <IconButton onClick={() => setIsRegimenEditorOpen(true)} title="Edit assessment regimen">
        <Sliders className="w-4 h-4" />
      </IconButton>
      <IconButton onClick={reset} title="Reset to VTOP marks">
        <RotateCcw className="w-4 h-4" />
      </IconButton>
    </>
  );

  const handleUpdateScoredMark = (id: string, mark: number | null, isSimulated: boolean) => {
    const updateList = (list: any[]) =>
      list.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          scoredMark: mark,
          isSimulated,
          status: isSimulated ? "Simulated" : mark === null ? "Pending" : item.status,
        };
      });
    updateConfig({
      ...config,
      theory: updateList(config.theory),
      lab: updateList(config.lab),
    });
  };

  const handleBatchSimulate = (percentage: number) => {
    const apply = (list: any[]) =>
      list.map((item) => {
        if (item.scoredMark !== null && !item.isSimulated) return item;
        const simulatedMark = Math.round((percentage / 100) * item.maxMark * 10) / 10;
        return { ...item, scoredMark: simulatedMark, isSimulated: true, status: "Simulated" };
      });
    updateConfig({ ...config, theory: apply(config.theory), lab: apply(config.lab) });
  };

  const handleClearSimulations = () => {
    const clear = (list: any[]) =>
      list.map((item) => {
        if (!item.isSimulated) return item;
        return { ...item, scoredMark: null, isSimulated: false, status: "Pending" };
      });
    updateConfig({ ...config, theory: clear(config.theory), lab: clear(config.lab) });
  };

  const handleAddAssessment = (next: {
    title: string;
    maxMark: number;
    weightagePercent: number;
    component: "theory" | "lab";
  }) => {
    const fresh = {
      id: `${next.component}-custom-${Date.now()}`,
      title: next.title,
      maxMark: next.maxMark,
      weightagePercent: next.weightagePercent,
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component: next.component,
    };
    updateConfig({
      ...config,
      [next.component === "theory" ? "theory" : "lab"]: [
        ...(next.component === "theory" ? config.theory : config.lab),
        fresh,
      ],
    });
  };

  /* Stat pair: the fixed card carries the headline read (the predicted
     grade); the carousel cycles what feeds it — the ceiling, the pocketed
     points, the lost ones, and each half's own pace. The old hero's four
     stacked tiles were this pair read four ways. */
  const {
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
  const theoryPace = theoryStats ? estimateComponentGrades(theoryStats, prediction.boundaries) : null;
  const labPace = labStats ? estimateComponentGrades(labStats, prediction.boundaries) : null;

  const scoredPercent = Math.min(100, Math.max(0, currentScoredScaled));
  const pendingPercent = Math.min(100 - scoredPercent, Math.max(0, potentialPendingScaled));
  const lostPercent = Math.min(100 - (scoredPercent + pendingPercent), Math.max(0, pointsLostScaled));

  // The engine's ladder, expanded into the chart's band rows. The predicted
  // letter above is read by ceil-ing the standing onto these exact limits (the
  // same read gradeAt makes), so this chart alone justifies the letter.
  const ladderBands: LadderBand[] = (() => {
    const limits = prediction.boundaries.map((b) => b.limit);
    const [sB = 90, aB = 80, bB = 70, cB = 60, dB = 50, eB = 40] = limits;
    return [
      { grade: "S", limit: sB, width: 100 - sB, range: `≥ ${sB}` },
      { grade: "A", limit: aB, width: sB - aB, range: `≥ ${aB}` },
      { grade: "B", limit: bB, width: aB - bB, range: `≥ ${bB}` },
      { grade: "C", limit: cB, width: bB - cB, range: `≥ ${cB}` },
      { grade: "D", limit: dB, width: cB - dB, range: `≥ ${dB}` },
      { grade: "E", limit: eB, width: dB - eB, range: `≥ ${eB}` },
      { grade: "F", limit: 0, width: eB, range: `< ${eB}` },
    ];
  })();
  const standingGrade =
    ladderBands.find((b) => Math.ceil(currentScoredScaled) >= b.limit)?.grade ?? "F";

  // The mark sheet must track the LIVE row, not the snapshot captured when the
  // user tapped it: every drag rewrites the config, the prediction rebuilds its
  // assessment objects, and the sheet re-binds by id — otherwise the controlled
  // slider would snap back to its open-time value and never move (the exact
  // freeze on unpublished FATs and user-added assessments, whose values only
  // ever change through this sheet).
  const markSheetAsm = sheetAsm
    ? ((theoryStats?.assessments ?? [])
        .concat(labStats?.assessments ?? [], projectStats?.assessments ?? [])
        .find((a) => a.id === sheetAsm.asm.id) ?? null)
    : null;

  const carouselSlides: InsightSlide[] = [
    {
      id: "maximisable",
      label: "Maximisable",
      value: maximisableGrade.letter,
      sub: `Max possible ${maxPossibleScaled.toFixed(1)} / 100`,
      tone: maximisableGrade.tone,
    },
    {
      id: "secured",
      label: "Secured",
      value: currentScoredScaled.toFixed(1),
      sub: `Pending ${potentialPendingScaled.toFixed(1)} pts`,
      tone: "indigo",
    },
    {
      id: "lost",
      label: "Points lost",
      value: pointsLostScaled > 0 ? `-${pointsLostScaled.toFixed(1)}` : "0.0",
      sub: "Permanent deficit",
      tone: pointsLostScaled > 0 ? "red" : "emerald",
    },
  ];
  if (isEmbedded && theoryStats) {
    carouselSlides.push({
      id: "theory-half",
      label: `Theory · ${prediction.theoryCredits} cr`,
      value: theoryPace?.optimal?.letter ?? "—",
      sub: `Scored ${theoryStats.scoredWeight.toFixed(1)} · lost ${theoryStats.lostWeight.toFixed(1)}`,
      tone: theoryPace?.optimal?.tone ?? "blue",
    });
  }
  if (isEmbedded && labStats) {
    carouselSlides.push({
      id: "lab-half",
      label: `Lab · ${prediction.labCredits} cr`,
      value: labPace?.optimal?.letter ?? "—",
      sub: `Scored ${labStats.scoredWeight.toFixed(1)} · lost ${labStats.lostWeight.toFixed(1)}`,
      tone: labPace?.optimal?.tone ?? "emerald",
    });
  }

  const theoryRemaining = remainingWeightFor(config.theory);
  const labRemaining = remainingWeightFor(config.lab);

  const totalCount =
    (theoryStats?.assessments.length ?? 0) +
    (labStats?.assessments.length ?? 0) +
    (projectStats?.assessments.length ?? 0);

  const renderHalf = (
    tone: "blue" | "emerald" | "violet",
    label: string,
    component: "theory" | "lab",
    stats: typeof theoryStats,
    dotClass: string,
    remaining: number
  ) => {
    if (!stats || stats.assessments.length === 0) return null;
    return (
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shrink-0`} />
            <h4 className="text-xs font-black text-text-heading dark:text-white font-outfit uppercase tracking-wider truncate">
              {label} ({stats.assessments.length})
            </h4>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-[10px] font-bold text-text-secondary">
              <strong className="text-text-heading dark:text-zinc-200">{stats.scoredWeight.toFixed(1)}</strong>
              {" / "}
              {stats.totalWeightConfigured} wt
            </div>
            {remaining > 0 ? (
              <button
                type="button"
                onClick={() => setAddFor(component)}
                title={`Add an assessment — ${remaining} wt still open`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border-strong dark:border-border text-text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500 text-[10px] font-black transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            ) : null}
          </div>
        </div>
        <ListShell>
          {stats.assessments.map((asm) => (
            <AssessmentStatRow
              key={asm.id}
              asm={asm}
              tone={tone}
              cohortStat={assessmentStats?.[asm.title] ?? null}
              onOpen={() => setSheetAsm({ asm, tone })}
            />
          ))}
        </ListShell>
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Header line: the PageShell already carries the code and title, so this
          line only carries the regimen facts and their controls. */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <ToneBadge tone="zinc">{course.courseType}</ToneBadge>
        <ToneBadge tone="violet">
          {prediction.theoryCredits}T + {prediction.labCredits}L
        </ToneBadge>
        {prediction.isCurved ? <ToneBadge tone="amber">Curved</ToneBadge> : null}
        {targetScore != null ? <ToneBadge tone="cyan">Goal {targetScore.toFixed(0)}%</ToneBadge> : null}
        {actionsEl ? null : (
          <>
            <span className="flex-1" />
            {predictorButtons}
          </>
        )}
      </div>

      {/* One fixed stat card, one carousel stat card — the list page's
          side-by-side pair. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Predicted"
          value={optimalGrade?.letter ?? "—"}
          tone={optimalGrade?.tone ?? "zinc"}
          sub={`${pacePct.toFixed(1)}% pace · ${potentialPendingScaled.toFixed(1)} pts pending`}
          badge={prediction.isCurved ? "Curved" : undefined}
        />
        <InsightCarousel slides={carouselSlides} carousel={carousel} />
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

      {isRegimenEditorOpen && (
        <AssessmentRegimenEditor
          courseCode={course.courseCode}
          isEmbedded={isEmbedded}
          theoryAssessments={config.theory}
          labAssessments={config.lab}
          theoryCredits={config.theoryCredits}
          labCredits={config.labCredits}
          onUpdateAssessments={(theory, lab, theoryCreds, labCreds) =>
            updateConfig({
              theory,
              lab,
              theoryCredits: theoryCreds ?? config.theoryCredits,
              labCredits: labCreds ?? config.labCredits,
            })
          }
          onClose={() => setIsRegimenEditorOpen(false)}
        />
      )}

      {/* Assessments — the outer list's row language, theory and lab taking
          an even share. Tapping a row opens the mark sheet; a half's Add opens
          the add form for the weight still open. Every edit — marks, regimen,
          add — is a bottom sheet. */}
      <div className="space-y-3">
        <SectionHeader
          icon={Zap}
          title="Assessments"
          count={totalCount}
          right={
            <GhostButton onClick={handleClearSimulations} title="Clear all simulated marks">
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </GhostButton>
          }
        />
        <p className="px-1 -mt-1 text-[11px] leading-relaxed text-text-secondary dark:text-text-muted font-medium">
          Tap a test to set what you expect on it — the predicted grade follows
          the engine&apos;s class band live. Locked weightages are frozen.
        </p>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          {[
            { pct: 100, tone: "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20" },
            { pct: 90, tone: "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/20" },
            { pct: 80, tone: "text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 border-cyan-500/20" },
            { pct: 50, tone: "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/20" },
          ].map(({ pct, tone }) => (
            <button
              key={pct}
              type="button"
              onClick={() => handleBatchSimulate(pct)}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl bg-surface dark:bg-surface-secondary ${tone} text-[11px] font-black border cursor-pointer shadow-3xs whitespace-nowrap transition-colors hover:text-current`}
            >
              All {pct}%
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          {renderHalf("blue", "Theory", "theory", theoryStats, "bg-indigo-500", theoryRemaining)}
          {renderHalf("emerald", "Lab", "lab", labStats, "bg-emerald-500", labRemaining)}
        </div>
        {projectStats && projectStats.assessments.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border-muted dark:border-border/70">
            {renderHalf("violet", "Project", "theory", projectStats, "bg-violet-500", 0)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          icon={Sliders}
          title="Target grade & FAT solver"
          count={prediction.theoryStats?.assessments.length ?? 0}
        />
        <div className="overflow-hidden">
          <TargetGradeSolver
            prediction={prediction}
            savedTargetScore={targetScore}
            onPersistTargetScore={persistTargetScore}
          />
        </div>
      </div>

      {/* Grade insights — the engine's own ladder for the whole course, not a
          half's: the predicted letter above came from these very bands, so the
          page shows where the reader stands and why the letter is what it is.
          The same shared chart the course marks subpage renders. */}
      <div className="space-y-3">
        <SectionHeader
          icon={Gauge}
          title="Grade insights"
          right={
            prediction.isCurved ? (
              classStats ? (
                <ToneBadge tone="emerald">
                  {classStats.count} peers · μ {classStats.mean.toFixed(1)} · σ {classStats.sd.toFixed(1)}
                </ToneBadge>
              ) : (
                <ToneBadge tone="zinc">Awaiting class data</ToneBadge>
              )
            ) : (
              <ToneBadge tone="blue">Absolute</ToneBadge>
            )
          }
        />
        <div className="rounded-3xl border border-border-muted bg-surface dark:bg-surface-secondary px-4 py-3.5 space-y-2.5">
          <GradeLadderChart bands={ladderBands} standingGrade={standingGrade} currentPct={currentScoredScaled} />
          <p className="text-[11px] leading-relaxed text-text-secondary dark:text-text-muted font-medium">
            The predicted{" "}
            <strong className={TONE_TEXT[toneForGrade(optimalGrade?.letter ?? "")]}>
              {optimalGrade?.letter ?? "—"}
            </strong>{" "}
            is read straight off this ladder —
            {prediction.isCurved
              ? " shifted by the class's distribution, exactly like the course marks page reads it."
              : " fixed percentage bands, not how the class performed."}
          </p>
        </div>
      </div>

      {/* Sheets — the one route in and out of assessment editing. The mark
          sheet binds the live assessment (resolved by id from the current
          prediction), so drags apply as they move. */}
      {sheetAsm && markSheetAsm ? (
        <AssessmentMarkSheet
          asm={markSheetAsm as any}
          tone={sheetAsm.tone}
          cohortStat={assessmentStats?.[markSheetAsm.title] ?? null}
          onClose={() => setSheetAsm(null)}
          onUpdateScoredMark={handleUpdateScoredMark}
        />
      ) : null}
      {addFor ? (
        <AddAssessmentSheet
          component={addFor}
          remaining={addFor === "theory" ? theoryRemaining : labRemaining}
          onAdd={handleAddAssessment}
          onClose={() => setAddFor(null)}
        />
      ) : null}
      {actionsEl ? createPortal(predictorButtons, actionsEl) : null}
    </div>
  );
}
