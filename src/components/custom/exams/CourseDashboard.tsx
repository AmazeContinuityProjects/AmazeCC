"use client";
import { useState, useEffect } from "react";
import SimplifiedAcademicsPage from "./SimplifiedAcademicsPage";
import CourseDetailSubpage from "./CourseDetailSubpage";
import { Creds } from "./courseHelpers";

export default function CourseDashboard({
  marksData, attendanceData, allGradesData, pastSemesterData, loginToVTOP, setActiveSubTab,
  calendars, decimalValues, isDayscholarWithBus,
  targetCourseCode, targetTab, onClearTarget
}: {
  marksData: any; attendanceData: any; allGradesData?: any;
  pastSemesterData?: any; loginToVTOP: () => Promise<Creds>; setActiveSubTab: (tab: string) => void;
  calendars?: any; decimalValues?: boolean; isDayscholarWithBus?: boolean;
  targetCourseCode?: string; targetTab?: string; onClearTarget?: () => void;
}) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState("overview");

  useEffect(() => {
    // 1. Target from props
    if (targetCourseCode) {
      const cleanCode = targetCourseCode.replace(/\([LPT]\)$/i, "").trim();
      setSelectedCode(cleanCode);
      if (targetTab) {
        setInitialTab(targetTab);
      }
      if (onClearTarget) onClearTarget();
      return;
    }

    // 2. Target from localStorage
    try {
      const rawTarget = localStorage.getItem("course_dashboard_target");
      const rawTab = localStorage.getItem("course_dashboard_tab");
      if (rawTarget) {
        let code = rawTarget;
        let tab = rawTab || "overview";
        if (rawTarget.startsWith("{")) {
          try {
            const parsed = JSON.parse(rawTarget);
            if (parsed.courseCode) code = parsed.courseCode;
            if (parsed.targetTab) tab = parsed.targetTab;
          } catch {}
        }
        const cleanCode = code.replace(/\([LPT]\)$/i, "").trim();
        setSelectedCode(cleanCode);
        if (tab) {
          setInitialTab(tab);
        }
        localStorage.removeItem("course_dashboard_target");
        localStorage.removeItem("course_dashboard_tab");
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
