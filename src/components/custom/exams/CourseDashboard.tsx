"use client";
import { useState, useEffect } from "react";
import SimplifiedAcademicsPage from "./SimplifiedAcademicsPage";
import CourseDetailSubpage from "./CourseDetailSubpage";
import { Creds } from "./courseHelpers";
import { getTypedStorageItem, removeTypedStorageItem } from "@/lib/storage";
import { extractBaseCourseCode } from "@/lib/courseNormalizer";

export default function CourseDashboard({
  marksData,
  attendanceData,
  allGradesData,
  pastSemesterData,
  loginToVTOP,
  setActiveSubTab,
  calendars,
  decimalValues,
  isDayscholarWithBus,
  targetCourseCode,
  targetTab,
  onClearTarget,
  resetKey,
}: {
  marksData: any;
  attendanceData: any;
  allGradesData?: any;
  pastSemesterData?: any;
  loginToVTOP: () => Promise<Creds>;
  setActiveSubTab: (tab: string) => void;
  calendars?: any;
  decimalValues?: boolean;
  isDayscholarWithBus?: boolean;
  targetCourseCode?: string;
  targetTab?: string;
  onClearTarget?: () => void;
  resetKey?: number;
}) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState("overview");

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSelectedCode(null);
      setInitialTab("overview");
      onClearTarget?.();
    }
  }, [resetKey, onClearTarget]);

  useEffect(() => {
    // 1. Target from props
    if (targetCourseCode) {
      const cleanCode = extractBaseCourseCode(targetCourseCode) || targetCourseCode.replace(/\([LPT]\)$/i, "").trim();
      setSelectedCode(cleanCode);
      if (targetTab) {
        setInitialTab(targetTab);
      }
      if (onClearTarget) onClearTarget();
      return;
    }

    // 2. Target from typed storage
    try {
      const rawTarget = getTypedStorageItem("course_dashboard_target");
      const rawTab = getTypedStorageItem("course_dashboard_tab");
      if (rawTarget) {
        let code = String(rawTarget);
        let tab = rawTab || "overview";
        if (typeof rawTarget === "string" && rawTarget.startsWith("{")) {
          try {
            const parsed = JSON.parse(rawTarget);
            if (parsed.courseCode) code = parsed.courseCode;
            if (parsed.targetTab) tab = parsed.targetTab;
          } catch {}
        }
        const cleanCode = extractBaseCourseCode(code) || code.replace(/\([LPT]\)$/i, "").trim();
        setSelectedCode(cleanCode);
        if (tab) {
          setInitialTab(tab);
        }
        removeTypedStorageItem("course_dashboard_target");
        removeTypedStorageItem("course_dashboard_tab");
      }
    } catch {}
  }, [targetCourseCode, targetTab, onClearTarget]);

  const handleSelectCourse = (code: string) => {
    setSelectedCode(code);
    setInitialTab("overview");
  };

  // ---- LANDING VIEW: ALL COURSES & MARKS ----
  if (!selectedCode) {
    return (
      <SimplifiedAcademicsPage
        marksData={marksData}
        allGradesData={allGradesData}
        pastSemesterData={pastSemesterData}
        attendanceData={attendanceData}
        loginToVTOP={loginToVTOP}
        setActiveSubTab={setActiveSubTab}
        decimalValues={decimalValues}
        onSelectCourse={(courseCode) => handleSelectCourse(courseCode)}
      />
    );
  }

  return (
    <CourseDetailSubpage
      marksData={marksData}
      attendanceData={attendanceData}
      allGradesData={allGradesData}
      pastSemesterData={pastSemesterData}
      loginToVTOP={loginToVTOP}
      setActiveSubTab={setActiveSubTab}
      calendars={calendars}
      decimalValues={decimalValues}
      isDayscholarWithBus={isDayscholarWithBus}
      selectedCode={selectedCode}
      initialTab={initialTab}
      onBack={() => setSelectedCode(null)}
    />
  );
}
