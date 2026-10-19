"use client";

import React, { useState } from "react";
import { FlaskConical, RotateCcw, Target } from "lucide-react";
import { GhostButton, SectionHeader } from "../../shared/primitives";
import { TILE_CARD } from "@/lib/uiTokens";
import CoursePredictorHero from "./CoursePredictorHero";
import AssessmentRegimenEditor from "./AssessmentRegimenEditor";
import WhatIfSimulator from "./WhatIfSimulator";
import TargetGradeSolver from "./TargetGradeSolver";
import {
  useCoursePredictionScope,
  type EnrolledCourseItem,
} from "./useCoursePredictionScope";

/**
 * The predictor for a single course: hero, regimen editor, what-if simulator,
 * target-grade solver.
 *
 * This is the page the course subpage's "Grade Predictor" entry opens and the
 * destination the global predictor's subject list leads to — one component so
 * both places show the same numbers for the same course. It mounts nothing that
 * can add or remove subjects; that belongs to the global list, which sees every
 * course. From inside a course, the subject roster is not this page's business.
 *
 * Custom subjects (say, an elective VTOP does not record) still work here: a
 * page for one simply has no class id, so it shows no cohort statistics and its
 * regimen comes entirely from storage.
 */
export default function CoursePredictorPage({
  course,
  marksStats,
}: {
  course: EnrolledCourseItem;
  /** Cohort stats keyed by class id; null for custom subjects (no class id). */
  marksStats?: Record<string, any>;
}) {
  const { config, updateConfig, reset, prediction, assessmentStats } =
    useCoursePredictionScope(course, marksStats);

  const [isRegimenEditorOpen, setIsRegimenEditorOpen] = useState(false);

  // The regimen editor only offers a lab tab when there is a lab side to edit.
  // The type string is the ground truth VTOP gives; course payloads back it up
  // (an embedded course carries both payloads, a theory-only one does not).
  const type = course.courseType.toLowerCase();
  const isEmbedded = type.includes("lab") || Boolean(course.theoryCourse && course.labCourse);

  if (!prediction) return null;

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

  return (
    <div className="space-y-3.5">
      <CoursePredictorHero
        prediction={prediction}
        assessmentStats={assessmentStats}
        onOpenRegimenEditor={() => setIsRegimenEditorOpen(true)}
        onResetCourse={reset}
      />

      {isRegimenEditorOpen && (
        <div className="animate-in fade-in duration-200">
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
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader
          icon={FlaskConical}
          title="What-if simulator"
          count={(prediction.theoryStats?.assessments.length ?? 0) + (prediction.labStats?.assessments.length ?? 0)}
          right={
            <GhostButton onClick={handleClearSimulations} title="Clear all simulated marks">
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </GhostButton>
          }
        />
        <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          Drag a test&apos;s mark to see the semester grade move before VTOP ever
          records it.
        </p>
        <div className={TILE_CARD}>
          <WhatIfSimulator
            theoryStats={prediction.theoryStats}
            labStats={prediction.labStats}
            projectStats={prediction.projectStats}
            onUpdateScoredMark={handleUpdateScoredMark}
            onBatchSimulate={handleBatchSimulate}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          icon={Target}
          title="Target grade & FAT solver"
          count={prediction.theoryStats?.assessments.length ?? 0}
        />
        <div className="overflow-hidden">
          <TargetGradeSolver prediction={prediction} />
        </div>
      </div>
    </div>
  );
}
