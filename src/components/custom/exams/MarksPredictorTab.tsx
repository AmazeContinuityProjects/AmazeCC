"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sparkles,
  GraduationCap,
  Sliders,
  Target,
  BarChart3,
  RotateCcw,
  BookOpen,
  ArrowLeft,
  Share2,
  Check,
} from "lucide-react";
import SubpageLayout from "../shared/SubpageLayout";
import PageHeader from "../shared/PageHeader";
import Badge from "../shared/Badge";
import CourseSelectorStrip, { EnrolledCourseItem } from "./marks-predictor/CourseSelectorStrip";
import CoursePredictorHero from "./marks-predictor/CoursePredictorHero";
import AssessmentRegimenEditor from "./marks-predictor/AssessmentRegimenEditor";
import WhatIfSimulator from "./marks-predictor/WhatIfSimulator";
import TargetGradeSolver from "./marks-predictor/TargetGradeSolver";
import AllCoursesMatrix from "./marks-predictor/AllCoursesMatrix";
import AddCustomCourseModal from "./marks-predictor/AddCustomCourseModal";

import {
  PredictorAssessment,
  CoursePredictionResult,
  computeCoursePrediction,
  createPredictorAssessmentsFromVTOP,
  safeNumber,
  PRESET_REGIMENS,
} from "@/lib/marksPredictor";

import {
  getStoredPredictorState,
  saveCoursePredictorState,
  resetCoursePredictorState,
  getCustomCourses,
  saveCustomCourse,
  deleteCustomCourse,
  CustomCourseMock,
} from "@/lib/marksPredictorStorage";

interface MarksPredictorTabProps {
  marksData: any;
  attendance?: any[];
  setActiveSubTab?: (subTab: string) => void;
  initialCourseCode?: string;
}

export default function MarksPredictorTab({
  marksData,
  attendance = [],
  setActiveSubTab,
  initialCourseCode,
}: MarksPredictorTabProps) {
  const [viewMode, setViewMode] = useState<"individual" | "matrix">("individual");
  const [activeCourseCode, setActiveCourseCode] = useState<string>("");
  const [isRegimenEditorOpen, setIsRegimenEditorOpen] = useState(false);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customCourses, setCustomCourses] = useState<CustomCourseMock[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Per-course dynamic assessment configurations
  const [courseAssessments, setCourseAssessments] = useState<
    Record<
      string,
      {
        theory: PredictorAssessment[];
        lab: PredictorAssessment[];
        theoryCredits: number;
        labCredits: number;
      }
    >
  >({});

  // Load custom courses from storage
  useEffect(() => {
    setCustomCourses(getCustomCourses());
  }, [refreshTrigger]);

  // Parse all enrolled courses from VTOP marksData and attendance
  const enrolledCourses: EnrolledCourseItem[] = useMemo(() => {
    const map = new Map<string, EnrolledCourseItem>();

    const rawCourses = Array.isArray(marksData?.courses) ? marksData.courses : [];
    rawCourses.forEach((c: any) => {
      if (!c) return;
      const rawCode = String(c.courseCode || c.code || "").trim();
      if (!rawCode) return;
      const baseCode = rawCode.replace(/\s*\([LPT]\)$/i, "").trim();
      const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
      const credits = safeNumber(c.credits, isLab ? 1 : 3);

      if (!map.has(baseCode)) {
        map.set(baseCode, {
          courseCode: baseCode,
          courseTitle: String(c.courseTitle || c.title || baseCode).trim(),
          courseType: c.courseType || (isLab ? "Lab Only" : "Theory Only"),
          credits,
          theoryCourse: !isLab ? c : undefined,
          labCourse: isLab ? c : undefined,
        });
      } else {
        const existing = map.get(baseCode)!;
        if (isLab) {
          existing.labCourse = c;
          if (!existing.courseType.includes("Embedded")) existing.courseType = "Embedded Theory";
        } else {
          existing.theoryCourse = c;
          if (!existing.courseType.includes("Embedded")) existing.courseType = "Embedded Theory";
        }
      }
    });

    // Also check attendance for any missing subjects
    if (Array.isArray(attendance)) {
      attendance.forEach((att: any) => {
        if (!att?.courseCode) return;
        const baseCode = String(att.courseCode).replace(/\s*\([LPT]\)$/i, "").trim();
        if (!map.has(baseCode)) {
          const isLab = att.courseType?.toLowerCase().includes("lab") || att.slot?.toLowerCase().startsWith("l");
          map.set(baseCode, {
            courseCode: baseCode,
            courseTitle: String(att.courseTitle || baseCode).trim(),
            courseType: att.courseType || (isLab ? "Lab Only" : "Theory Only"),
            credits: safeNumber(att.credits, isLab ? 1 : 3),
          });
        }
      });
    }

    // Append custom mock courses
    customCourses.forEach((custom) => {
      map.set(custom.courseCode, {
        courseCode: custom.courseCode,
        courseTitle: custom.courseTitle,
        courseType: custom.courseType,
        credits: custom.theoryCredits + custom.labCredits,
        isCustom: true,
      });
    });

    return Array.from(map.values());
  }, [marksData, attendance, customCourses]);

  // Set initial active course
  useEffect(() => {
    if (enrolledCourses.length > 0) {
      if (initialCourseCode && enrolledCourses.some((c) => c.courseCode === initialCourseCode)) {
        setActiveCourseCode(initialCourseCode);
      } else if (!activeCourseCode || !enrolledCourses.some((c) => c.courseCode === activeCourseCode)) {
        setActiveCourseCode(enrolledCourses[0].courseCode);
      }
    }
  }, [enrolledCourses, initialCourseCode, activeCourseCode]);

  // Initialize course assessments with stored state or VTOP defaults
  useEffect(() => {
    if (enrolledCourses.length === 0) return;

    const storedState = getStoredPredictorState();
    const newAssessmentsMap: Record<string, any> = {};

    enrolledCourses.forEach((course) => {
      const saved = storedState[course.courseCode];

      let theory = saved?.theoryAssessments;
      let lab = saved?.labAssessments;
      const theoryCreds = saved?.theoryCredits ?? (course.courseType.includes("Lab") && !course.courseType.includes("Embedded") ? 0 : 3);
      const labCreds = saved?.labCredits ?? (course.courseType.includes("Lab") || course.courseType.includes("Embedded") ? 1 : 0);

      if (!theory && !course.courseType.toLowerCase().includes("lab only")) {
        theory = createPredictorAssessmentsFromVTOP(course.theoryCourse, "theory");
      }
      if (!lab && (course.courseType.toLowerCase().includes("lab") || course.labCourse)) {
        lab = createPredictorAssessmentsFromVTOP(course.labCourse, "lab");
      }

      newAssessmentsMap[course.courseCode] = {
        theory: theory || [],
        lab: lab || [],
        theoryCredits: theoryCreds,
        labCredits: labCreds,
      };
    });

    setCourseAssessments(newAssessmentsMap);
  }, [enrolledCourses, refreshTrigger]);

  // Current active course configuration
  const currentCourseConfig = courseAssessments[activeCourseCode] || {
    theory: [],
    lab: [],
    theoryCredits: 3,
    labCredits: 1,
  };

  const activeCourseMeta = enrolledCourses.find((c) => c.courseCode === activeCourseCode) || {
    courseCode: activeCourseCode || "COURSE",
    courseTitle: "Course Marks Predictor",
    courseType: "Theory Only",
    credits: 3,
  };

  // Compute prediction for active course
  const activePrediction: CoursePredictionResult = useMemo(() => {
    return computeCoursePrediction({
      courseCode: activeCourseMeta.courseCode,
      courseTitle: activeCourseMeta.courseTitle,
      courseType: activeCourseMeta.courseType,
      theoryAssessments: currentCourseConfig.theory,
      labAssessments: currentCourseConfig.lab,
      theoryCredits: currentCourseConfig.theoryCredits,
      labCredits: currentCourseConfig.labCredits,
    });
  }, [activeCourseMeta, currentCourseConfig]);

  // Compute predictions for all courses (for Matrix & Strips)
  const allPredictions: CoursePredictionResult[] = useMemo(() => {
    return enrolledCourses.map((c) => {
      const cfg = courseAssessments[c.courseCode] || {
        theory: [],
        lab: [],
        theoryCredits: 3,
        labCredits: 1,
      };
      return computeCoursePrediction({
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        courseType: c.courseType,
        theoryAssessments: cfg.theory,
        labAssessments: cfg.lab,
        theoryCredits: cfg.theoryCredits,
        labCredits: cfg.labCredits,
      });
    });
  }, [enrolledCourses, courseAssessments]);

  // Enriched course items for the strip with computed deficit and ceiling
  const stripCourses: EnrolledCourseItem[] = useMemo(() => {
    return enrolledCourses.map((c) => {
      const pred = allPredictions.find((p) => p.courseCode === c.courseCode);
      return {
        ...c,
        maxPossible: pred?.maxPossibleScaled ?? 100,
        pointsLost: pred?.pointsLostScaled ?? 0,
      };
    });
  }, [enrolledCourses, allPredictions]);

  // Handlers for What-If Simulation updates
  const handleUpdateScoredMark = (
    id: string,
    mark: number | null,
    isSimulated: boolean
  ) => {
    setCourseAssessments((prev) => {
      const curr = prev[activeCourseCode] || { theory: [], lab: [], theoryCredits: 3, labCredits: 1 };
      const updateList = (list: PredictorAssessment[]) =>
        list.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            scoredMark: mark,
            isSimulated,
            status: isSimulated ? "Simulated" : mark === null ? "Pending" : item.status,
          };
        });

      const updatedTheory = updateList(curr.theory);
      const updatedLab = updateList(curr.lab);

      const next = {
        ...prev,
        [activeCourseCode]: {
          ...curr,
          theory: updatedTheory,
          lab: updatedLab,
        },
      };

      // Persist to storage
      saveCoursePredictorState(activeCourseCode, {
        theoryAssessments: updatedTheory,
        labAssessments: updatedLab,
        theoryCredits: curr.theoryCredits,
        labCredits: curr.labCredits,
      });

      return next;
    });
  };

  // Batch simulate all pending assessments for active course
  const handleBatchSimulate = (percentage: number) => {
    setCourseAssessments((prev) => {
      const curr = prev[activeCourseCode] || { theory: [], lab: [], theoryCredits: 3, labCredits: 1 };
      const batchList = (list: PredictorAssessment[]) =>
        list.map((item) => {
          // If already scored and not simulated, keep as is
          if (item.scoredMark !== null && !item.isSimulated) return item;
          const simulatedMark = Math.round((percentage / 100) * item.maxMark * 10) / 10;
          return {
            ...item,
            scoredMark: simulatedMark,
            isSimulated: true,
            status: "Simulated",
          };
        });

      const updatedTheory = batchList(curr.theory);
      const updatedLab = batchList(curr.lab);

      const next = {
        ...prev,
        [activeCourseCode]: {
          ...curr,
          theory: updatedTheory,
          lab: updatedLab,
        },
      };

      saveCoursePredictorState(activeCourseCode, {
        theoryAssessments: updatedTheory,
        labAssessments: updatedLab,
        theoryCredits: curr.theoryCredits,
        labCredits: curr.labCredits,
      });

      return next;
    });
  };

  // Clear all simulations for active course (revert to VTOP verified marks)
  const handleClearSimulations = () => {
    setCourseAssessments((prev) => {
      const curr = prev[activeCourseCode] || { theory: [], lab: [], theoryCredits: 3, labCredits: 1 };
      const clearList = (list: PredictorAssessment[]) =>
        list.map((item) => {
          if (!item.isSimulated) return item;
          return {
            ...item,
            scoredMark: null,
            isSimulated: false,
            status: "Pending",
          };
        });

      const updatedTheory = clearList(curr.theory);
      const updatedLab = clearList(curr.lab);

      const next = {
        ...prev,
        [activeCourseCode]: {
          ...curr,
          theory: updatedTheory,
          lab: updatedLab,
        },
      };

      saveCoursePredictorState(activeCourseCode, {
        theoryAssessments: updatedTheory,
        labAssessments: updatedLab,
        theoryCredits: curr.theoryCredits,
        labCredits: curr.labCredits,
      });

      return next;
    });
  };

  // Reset entire course regimen and simulations back to fresh VTOP data
  const handleResetCourse = () => {
    resetCoursePredictorState(activeCourseCode);
    setRefreshTrigger((r) => r + 1);
  };

  // Update regimen assessments from Regimen Editor
  const handleUpdateRegimenAssessments = (
    theory: PredictorAssessment[],
    lab: PredictorAssessment[],
    theoryCreds = 3,
    labCreds = 1
  ) => {
    setCourseAssessments((prev) => {
      const next = {
        ...prev,
        [activeCourseCode]: {
          theory,
          lab,
          theoryCredits: theoryCreds,
          labCredits: labCreds,
        },
      };

      saveCoursePredictorState(activeCourseCode, {
        theoryAssessments: theory,
        labAssessments: lab,
        theoryCredits: theoryCreds,
        labCredits: labCreds,
      });

      return next;
    });
  };

  // Handle adding custom subject
  const handleAddCustomCourse = (course: CustomCourseMock) => {
    saveCustomCourse(course);
    setRefreshTrigger((r) => r + 1);
    setActiveCourseCode(course.courseCode);
    setViewMode("individual");
  };

  return (
    <SubpageLayout
      title="Marks Predictor & Simulator"
      onBack={() => setActiveSubTab && setActiveSubTab("overview")}
    >
      <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-fadeIn">
        {/* Page Header */}
        <PageHeader
          icon={<Sparkles className="w-5 h-5 text-indigo-500" />}
          title="Marks Predictor & Regimen Simulator"
          meta={
            <Badge
              variant="default"
              className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300"
            >
              Academic AI Simulator
            </Badge>
          }
        />

        {/* Course Pills Strip */}
        <CourseSelectorStrip
          courses={stripCourses}
          activeCourseCode={activeCourseCode}
          onSelectCourse={(code) => {
            setActiveCourseCode(code);
            setViewMode("individual");
          }}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          onOpenAddCustomCourse={() => setIsAddCustomOpen(true)}
        />

        {/* View Mode 1: All Courses Risk Matrix */}
        {viewMode === "matrix" && (
          <div className="animate-fadeIn">
            <AllCoursesMatrix
              predictions={allPredictions}
              onSelectCourse={(code) => {
                setActiveCourseCode(code);
                setViewMode("individual");
              }}
            />
          </div>
        )}

        {/* View Mode 2: Individual Course Predictor */}
        {viewMode === "individual" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Hero Card with Gauge, Deficit, Ceiling */}
            <CoursePredictorHero
              prediction={activePrediction}
              onOpenRegimenEditor={() => setIsRegimenEditorOpen(true)}
              onResetCourse={handleResetCourse}
              onScrollToSimulator={() => {}}
              onScrollToTargetSolver={() => {}}
            />

            {/* Assessment Regimen Editor Modal/Drawer */}
            {isRegimenEditorOpen && (
              <div className="animate-fadeIn">
                <AssessmentRegimenEditor
                  courseCode={activeCourseMeta.courseCode}
                  isEmbedded={activePrediction.isEmbedded}
                  theoryAssessments={currentCourseConfig.theory}
                  labAssessments={currentCourseConfig.lab}
                  theoryCredits={currentCourseConfig.theoryCredits}
                  labCredits={currentCourseConfig.labCredits}
                  onUpdateAssessments={handleUpdateRegimenAssessments}
                  onClose={() => setIsRegimenEditorOpen(false)}
                />
              </div>
            )}

            {/* Target Grade & FAT Solver */}
            <TargetGradeSolver prediction={activePrediction} />

            {/* What-If Scenario Simulator */}
            <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-outfit">
                    Interactive What-If Marks Simulator
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    Drag sliders or input test marks to simulate hypothetical final outcomes
                  </p>
                </div>
              </div>

              <WhatIfSimulator
                theoryStats={activePrediction.theoryStats}
                labStats={activePrediction.labStats}
                projectStats={activePrediction.projectStats}
                onUpdateScoredMark={handleUpdateScoredMark}
                onBatchSimulate={handleBatchSimulate}
                onClearSimulations={handleClearSimulations}
              />
            </div>
          </div>
        )}

        {/* Add Custom Mock Course Modal */}
        <AddCustomCourseModal
          isOpen={isAddCustomOpen}
          onClose={() => setIsAddCustomOpen(false)}
          onAddCourse={handleAddCustomCourse}
        />
      </div>
    </SubpageLayout>
  );
}
