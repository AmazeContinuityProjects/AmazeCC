"use client";

import dynamic from "next/dynamic";
import { useAtomValue } from "jotai";
import { unifiedAcademicsAtom, unifiedMarksAtom } from "@/store";
import type { NormalizedCourse } from "@/types";
import type { attendanceRes } from "@/types/data/attendance";
import type { AllGradesRes } from "@/types/data/allgrades";
import type { Settings } from "@/store/settingsAtoms";
import type { Creds } from "../exams/courseHelpers";

interface DashboardAcademicsFeatureProps {
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  marksData: object;
  marksStats: Record<string, unknown>;
  allGradesData: AllGradesRes;
  gradesData: object;
  attendanceData: attendanceRes | null;
  pastSemesterData: any;
  calendarData: any;
  scheduleData: object;
  settings: Settings;
  loginToVTOP: () => Promise<Creds>;
  handleFetchGrades: () => Promise<unknown>;
  handleScheduleFetch: () => Promise<unknown>;
  courseDashboardTarget: { courseCode: string; targetTab?: string } | null;
  onClearCourseTarget: () => void;
  resetKey?: number;
}

function FeatureLoading() {
  return (
    <div className="min-h-40 space-y-4 p-4" role="status" aria-label="Loading academics">
      <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-neutral-800" />
      <div className="h-36 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-neutral-800" />
    </div>
  );
}

const CourseDashboard = dynamic(() => import("../exams/CourseDashboard"), { loading: FeatureLoading });
const MarksHistoryTab = dynamic(() => import("../exams/MarksHistoryTab"), { loading: FeatureLoading });
const CurriculumPage = dynamic(() => import("../exams/CurriculumPage"), { loading: FeatureLoading });
const ExamSchedule = dynamic(() => import("../exams/ScheduleDisplay"), { loading: FeatureLoading });
const MarksPredictorTab = dynamic(() => import("../exams/MarksPredictorTab"), { loading: FeatureLoading });

/** Academic subpages and their feature-specific navigation/data contract. */
export default function DashboardAcademicsFeature({
  activeSubTab,
  setActiveSubTab,
  marksData,
  marksStats,
  allGradesData,
  gradesData,
  attendanceData,
  pastSemesterData,
  calendarData,
  scheduleData,
  settings,
  loginToVTOP,
  handleFetchGrades,
  handleScheduleFetch,
  courseDashboardTarget,
  onClearCourseTarget,
  resetKey,
}: DashboardAcademicsFeatureProps) {
  const unifiedAcademics = useAtomValue(unifiedAcademicsAtom);
  const unifiedMarks = useAtomValue(unifiedMarksAtom);
  void unifiedMarks;
  const effectiveAttendance: NormalizedCourse[] | undefined =
    (attendanceData?.attendance as unknown as NormalizedCourse[]) ??
    (unifiedAcademics.courses.length > 0 ? unifiedAcademics.courses : undefined);

  return (
    <div className="animate-fadeIn">
      {(activeSubTab === "courses-simplified" || activeSubTab === "simplified-academics" || activeSubTab === "overview" || activeSubTab === "course-dashboard") && (
        <CourseDashboard
          marksData={marksData}
          allGradesData={allGradesData}
          pastSemesterData={pastSemesterData}
          attendanceData={attendanceData}
          loginToVTOP={loginToVTOP}
          setActiveSubTab={setActiveSubTab}
          calendars={calendarData?.calendars}
          decimalValues={settings.decimalValues}
          isDayscholarWithBus={settings.isDayscholarWithBus}
          targetCourseCode={courseDashboardTarget?.courseCode}
          targetTab={courseDashboardTarget?.targetTab}
          onClearTarget={onClearCourseTarget}
          resetKey={resetKey}
        />
      )}

      {activeSubTab === "grades" && (
        <MarksHistoryTab
          data={allGradesData}
          marksData={marksData}
          gradesData={gradesData}
          pastSemesters={pastSemesterData}
          onRefresh={handleFetchGrades}
          onBack={() => setActiveSubTab("overview")}
        />
      )}

      {(activeSubTab === "curriculum" || activeSubTab === "cgpa-predictor") && (
        <CurriculumPage
          marksData={marksData}
          allGradesData={allGradesData}
          gradesData={gradesData}
          attendance={effectiveAttendance}
          handleFetchGrades={handleFetchGrades}
          setActiveSubTab={setActiveSubTab}
          loginToVTOP={loginToVTOP}
          initialScreen={activeSubTab === "cgpa-predictor" ? "planner" : undefined}
        />
      )}

      {activeSubTab === "schedule" && (
        <ExamSchedule
          data={scheduleData}
          handleScheduleFetch={handleScheduleFetch}
          onBack={() => setActiveSubTab("courses-simplified")}
        />
      )}

      {activeSubTab === "marks-predictor" && (
        <MarksPredictorTab
          marksData={marksData}
          marksStats={marksStats}
          attendance={effectiveAttendance}
          setActiveSubTab={setActiveSubTab}
        />
      )}
    </div>
  );
}
