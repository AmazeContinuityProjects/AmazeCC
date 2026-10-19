"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, FlaskConical, Plus, RotateCcw } from "lucide-react";
import AddCustomCourseModal from "./marks-predictor/AddCustomCourseModal";
import BottomSheet from "../shared/BottomSheet";
import {
  GhostButton,
  IconButton,
  ListRowText,
  ListShell,
  PageShell,
  SectionHeader,
  StatTile,
  ToneBadge,
} from "../shared/primitives";
import { LIST_ROW } from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";
import { predictGpa } from "@/lib/predictorGpa";
import {
  type CoursePredictionResult,
  computeCoursePrediction,
  safeNumber,
} from "@/lib/marksPredictor";
import {
  getCustomCourses,
  resetAllCoursePredictorState,
  saveCustomCourse,
  getCoursePredictorState,
  type CustomCourseMock,
} from "@/lib/marksPredictorStorage";
import {
  buildCourseConfig,
  buildEnrolledCourses,
  useRemappedCourseStats,
  type EnrolledCourseItem,
} from "./marks-predictor/useCoursePredictionScope";
import CoursePredictorPage from "./marks-predictor/CoursePredictorPage";

interface MarksPredictorTabProps {
  marksData: any;
  marksStats?: Record<string, any>;
  attendance?: any[];
  setActiveSubTab?: (subTab: string) => void;
}

/**
 * The marks predictor.
 *
 * This used to be two toggled views over one combined screen: a course strip
 * that switched between "individual" and an all-courses risk matrix. That put
 * the subject list and the prediction in the same place, so the matrix was the
 * first thing you saw and the individual course was a mode you had to find.
 *
 * It now follows the same shape as Grade History — a list of subjects, each
 * opening its own predictor page. The list is where you scan ("which course is
 * furthest behind"), the page is where you work ("what do I need on the FAT").
 *
 * The per-course page is shared with the course subpage's "Grade Predictor"
 * entry, so both places show the same numbers for the same course.
 */

/**
 * The list's subtitle backs the type into the same line as the code, so the
 * catalogue jargon takes the shorthand the space deserves: "Embedded Theory"
 * is the theory half of a blended theory+lab pair — "ETL"; "Theory Only"
 * collapses to "TO" and "Lab Only" to "LO".
 */
const typeLabel = (course: EnrolledCourseItem) => {
  const type = course.courseType.toLowerCase();
  if (type.includes("theory only")) return "TO";
  if (type.includes("lab only")) return "LO";
  return type.includes("embedded") ? "ETL" : course.courseType;
};

export default function MarksPredictorTab({
  marksData,
  marksStats = {},
  attendance = [],
  setActiveSubTab,
}: MarksPredictorTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "course">("list");
  const [activeCourseCode, setActiveCourseCode] = useState<string>("");
  /** DOM slot in the shell's back-button row; the page portals its controls here. */
  const courseActionsRef = useRef<HTMLDivElement>(null);
  const [customCourses, setCustomCourses] = useState<CustomCourseMock[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  /** The overall-reset confirmation sheet — destructive, so it asks first. */
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    setCustomCourses(getCustomCourses());
  }, [refreshTrigger]);

  // Parse all enrolled courses from VTOP marksData and attendance
  const enrolledCourses: EnrolledCourseItem[] = useMemo(
    () => buildEnrolledCourses(marksData, attendance, customCourses),
    [marksData, attendance, customCourses]
  );

  const activeCourse = useMemo(
    () => enrolledCourses.find((c) => c.courseCode === activeCourseCode) ?? null,
    [enrolledCourses, activeCourseCode]
  );

  // The grading context the engine read needs the REMAPPED cohort statistics —
  // `{ overall, assessments-by-title }` per class id — the same shape the marks
  // subpage builds before its ladder resolves. Reading the raw sync atom
  // directly found no `overall` key on any entry, which silently resolved
  // every curved course to the fixed ladder on this list.
  const cohortStats = useRemappedCourseStats(marksStats, enrolledCourses);

  // One prediction per course, computed from whatever regimen is stored for it.
  // Read-only: the list never mutates a course's configuration, it just reflects it.
  // Grading context resolves the same ladder the marks subpage shows: the
  // theory half's class distribution shifts the bands for curve-graded
  // courses, so a subject cannot say "A" on one screen and "C" on the other.
  const predictions = useMemo(() => {
    // The revision rides the deps on purpose: the course page saves its changes
    // into the course's storage key while this list is mounted, and storage
    // offers no subscription — coming back must re-read it.
    void refreshTrigger;
    const byCode = new Map<string, CoursePredictionResult>();
    for (const course of enrolledCourses) {
      const config = buildCourseConfig(course, getCoursePredictorState(course.courseCode));
      const classNbr = course.theoryCourse?.classNbr || course.labCourse?.classNbr;
      const overall = classNbr ? cohortStats?.[classNbr]?.overall : null;
      const classStats = overall && Number.isFinite(overall.mean) ? overall : null;
      byCode.set(
        course.courseCode,
        computeCoursePrediction({
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          courseType: course.courseType,
          theoryAssessments: config.theory,
          labAssessments: config.lab,
          theoryCredits: config.theoryCredits,
          labCredits: config.labCredits,
          courseSystem: course.courseSystem ?? null,
          classStats,
        })
      );
    }
    return byCode;
  }, [enrolledCourses, cohortStats, refreshTrigger]);

  const sortedCourses = useMemo(
    () =>
      [...enrolledCourses].sort(
        (a, b) =>
          (predictions.get(b.courseCode)?.pointsLostScaled ?? 0) -
          (predictions.get(a.courseCode)?.pointsLostScaled ?? 0)
      ),
    [enrolledCourses, predictions]
  );

  // The engine-derived letters the GPA pair aggregates: the pace grade per
  // course (current performance continued) and the absolute ceiling
  // (`100 − points lost`).
  const paceGrades = useMemo(
    () => Object.fromEntries([...predictions].map(([code, p]) => [code, p.optimalGrade?.letter ?? null])),
    [predictions]
  );
  const ceilingGrades = useMemo(
    () => Object.fromEntries([...predictions].map(([code, p]) => [code, p.maximisableGrade.letter])),
    [predictions]
  );

  // The headline pair above the subject list: where the semester's predicted
  // grades land as a GPA, and what that does to the cumulative figure. Both
  // readings come from the grade-insights engine's letters (`predictGpa`);
  // each tile leads with optimal (current performance continued) and quotes
  // its maximisable / most-desirable companion underneath.
  const gpa = useMemo(
    () => predictGpa(enrolledCourses.map((c) => ({ credits: c.credits, optimal: paceGrades[c.courseCode] ?? null, maximisable: ceilingGrades[c.courseCode] ?? null })), marksData?.cgpa),
    [enrolledCourses, paceGrades, ceilingGrades, marksData]
  );

  const openCourse = (code: string) => {
    setActiveCourseCode(code);
    setViewMode("course");
  };

  const handleAddCustomCourse = (course: CustomCourseMock) => {
    saveCustomCourse(course);
    setRefreshTrigger((r) => r + 1);
    openCourse(course.courseCode);
  };

  // The overall reset: wipe the store (what-ifs, regimens, goals, custom
  // subjects) and re-derive everything from VTOP. The revision bump makes the
  // list's prediction memo re-read the emptied storage immediately.
  const handleResetAll = () => {
    resetAllCoursePredictorState();
    setCustomCourses([]);
    setRefreshTrigger((r) => r + 1);
    setIsResetConfirmOpen(false);
  };

  const title =
    viewMode === "course" ? activeCourse?.courseCode ?? "Course" : "Marks Predictor";
  const subtitle =
    viewMode === "course"
      ? activeCourse?.courseTitle
      : "Pick a course to test what-if scores and see exactly what each remaining assessment can still earn.";

  return (
    <PageShell
      eyebrow="Academics · Simulator"
      title={title}
      subtitle={subtitle}
      onBack={() => {
        if (viewMode === "course") {
          setViewMode("list");
          // The course page just saved its what-ifs into this course's storage
          // key; localStorage has no subscription, so the list's prediction
          // memo needs a revision to re-read it — otherwise the subject rows
          // keep showing the letters from before the user changed anything.
          setRefreshTrigger((r) => r + 1);
          return;
        }
        setActiveSubTab && setActiveSubTab("overview");
      }}
      actions={
        viewMode === "course" ? (
          // The slot the per-course page portals its regimen/reset controls
          // into, so they share the back button's row like the curriculum
          // page's toolbar; the badge keeps the mode visible.
          <div ref={courseActionsRef} className="flex items-center gap-2 pt-0.5 shrink-0">
            <ToneBadge tone="indigo">What-if</ToneBadge>
          </div>
        ) : (
          // The list's square control on the back button's row: the overall
          // reset. It wipes what every course saved into its storage key, so
          // it asks before doing anything.
          <IconButton
            onClick={() => setIsResetConfirmOpen(true)}
            title="Reset every course's predictor stats"
          >
            <RotateCcw className="w-4 h-4" />
          </IconButton>
        )
      }
    >
      <div className="w-full max-w-3xl mx-auto space-y-3.5 pb-12 animate-in fade-in duration-200 text-left select-none overflow-hidden">
        {viewMode === "list" ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* Optimal value leads; the maximisable reading — semester SGPA if
                  every remaining assessment were maxed — quotes underneath. */}
              <StatTile
                label="Predicted SGPA"
                value={gpa.optimalCredits > 0 ? gpa.optimalSgpa.toFixed(2) : "—"}
                badge={`${gpa.optimalCredits} cr`}
                tone="indigo"
                sub={
                  gpa.optimalCredits < gpa.semesterCredits
                    ? `${gpa.optimalCredits}/${gpa.semesterCredits} graded · max ${gpa.maximisableSgpa.toFixed(2)}`
                    : `maximisable ${gpa.maximisableSgpa.toFixed(2)}`
                }
              />
              <StatTile
                label="Predicted CGPA"
                value={gpa.optimalCgpa == null ? "—" : gpa.optimalCgpa.toFixed(2)}
                badge={gpa.optimalCgpa == null ? "—" : gpa.optimalCgpaIsAnchor ? "VTOP" : "Projected"}
                tone="cyan"
                sub={
                  gpa.desirableCgpa == null
                    ? "sync grades for a base figure"
                    : `most desirable ${gpa.desirableCgpa.toFixed(2)}`
                }
              />
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={FlaskConical}
                title="Courses"
                count={enrolledCourses.length}
                right={
                  <GhostButton onClick={() => setIsAddCustomOpen(true)} title="Add a custom subject">
                    <Plus className="w-3.5 h-3.5" />
                    Add Subject
                  </GhostButton>
                }
              />
              <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
                Sorted by how much is left to lose. Tap one to simulate it.
              </p>

              {enrolledCourses.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                  <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                    No courses found
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    Pull your marks from VTOP, or add a custom subject to simulate.
                  </p>
                </div>
              ) : (
                <ListShell>
                  {sortedCourses.map((course) => {
                    const prediction = predictions.get(course.courseCode)!;
                    const deficit = prediction.pointsLostScaled;
                    return (
                      <button
                        key={course.courseCode}
                        type="button"
                        onClick={() => openCourse(course.courseCode)}
                        className={`${LIST_ROW} cursor-pointer group`}
                      >
                        <ListRowText
                          title={course.courseTitle}
                          subtitle={`${course.courseCode} · ${typeLabel(course)} · ${course.credits} credits`}
                        />
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="w-20 text-right">
                            <span className="block text-sm font-black font-outfit text-zinc-900 dark:text-white">
                              {deficit > 0 ? `-${deficit.toFixed(1)}` : "0.0"}
                            </span>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              pts lost
                            </span>
                          </span>
                          <ToneBadge
                            tone={toneForGrade(prediction.optimalGrade?.letter ?? "")}
                            size="lg"
                          >
                            {prediction.optimalGrade?.letter ?? "—"}
                          </ToneBadge>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </span>
                      </button>
                    );
                  })}
                </ListShell>
              )}
            </div>
          </>
        ) : (
          <AnimatePresence mode="wait">
            {activeCourse ? (
              <CoursePredictorPage
                key={activeCourse.courseCode}
                course={activeCourse}
                marksStats={cohortStats}
                actionsSlotRef={courseActionsRef}
              />
            ) : (
              <div
                key="empty"
                className="p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center"
              >
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                  No course selected
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("list");
                    setRefreshTrigger((r) => r + 1);
                  }}
                  className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Back to the list
                </button>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {isAddCustomOpen && (
          <AddCustomCourseModal
            isOpen={isAddCustomOpen}
            onClose={() => setIsAddCustomOpen(false)}
            onAddCourse={handleAddCustomCourse}
          />
        )}
      </AnimatePresence>

      {/* Overall reset — asks before it wipes what every course saved. */}
      {isResetConfirmOpen ? (
        <ResetAllConfirmSheet
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={handleResetAll}
        />
      ) : null}
    </PageShell>
  );
}

/**
 * The overall reset's confirmation, as a bottom sheet — native `confirm()` is
 * blocked in some in-app browsers, and this page already speaks in sheets.
 * Red because what it discards is work the user shaped: earlier sims, custom
 * regimens, goals and custom subjects.
 */
function ResetAllConfirmSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <BottomSheet onClose={onClose} overlayId="predictor-reset-all" maxWidth="max-w-md">
      <div className="space-y-3.5 pb-2">
        <div className="space-y-1.5">
          <h3 className="text-base font-black text-red-600 dark:text-red-400 font-outfit tracking-tight">
            Reset every course&apos;s stats?
          </h3>
          <p className="text-[11px] font-medium leading-relaxed text-text-secondary dark:text-text-muted">
            All saved changes drop — what-if marks, custom regimens, goals and any
            custom subjects. Every course row returns to the marks VTOP
            published, and the SGPA pair recomputes from those. This cannot be
            undone.
          </p>
        </div>
        <div className="flex gap-2.5">
          <GhostButton onClick={onClose} title="Keep the saved changes" className="flex-1 justify-center">
            Keep changes
          </GhostButton>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to zero
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
