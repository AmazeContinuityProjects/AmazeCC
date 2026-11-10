"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { attendanceRes, ODListItem } from "@/types/data/attendance";
import type { AllGradesRes } from "@/types/data/allgrades";
import type { Credentials } from "@/store/authAtoms";
import type { Settings } from "@/store/settingsAtoms";
import type { Creds } from "../exams/courseHelpers";
import { buildAttendanceDayCardsMap } from "@/lib/attendanceTimetable";
import { buildMilestoneDates } from "@/lib/milestoneDates";
import { PageSkeleton } from "../shared/primitives/PageSkeleton";

interface DashboardAttendanceFeatureProps {
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  attendanceData: attendanceRes | null;
  calendarData: any;
  scheduleData: object;
  moodleData: any[];
  IDs: Credentials;
  settings: Settings;
  ODhoursData: ODListItem[];
  ODhoursIsOpen: boolean;
  setODhoursIsOpen: (isOpen: boolean) => void;
  setIsSubpageOpen: (isOpen: boolean) => void;
  allGradesData: AllGradesRes;
  handleCalendarFetch: (calendarType?: string) => Promise<void>;
  handleFetchMoodle: (username?: string, password?: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
  onOpenCourse: (courseCode: string) => void;
  onSystemBack: () => void;
  loginToVTOP: () => Promise<Creds>;
  resetKey: number;
}

function FeatureLoading() {
  return <PageSkeleton label="Loading attendance" />;
}

const CalendarSubpage = dynamic(() => import("../attendance/CalendarSubpage"), { loading: FeatureLoading });
const CircularsTab = dynamic(() => import("../exams/CircularsTab"), { loading: FeatureLoading });
const OverallAttendancePredictor = dynamic(() => import("../attendance/OverallAttendancePredictor"), {
  loading: FeatureLoading,
});
const ODTrackerSubpage = dynamic(() => import("../attendance/ODTrackerSubpage"), { loading: FeatureLoading });

/** Attendance, calendar, predictor, circulars, and OD screens. */
export default function DashboardAttendanceFeature({
  activeSubTab,
  setActiveSubTab,
  attendanceData,
  calendarData,
  scheduleData,
  moodleData,
  IDs,
  settings,
  ODhoursData,
  ODhoursIsOpen,
  setODhoursIsOpen,
  setIsSubpageOpen,
  allGradesData,
  handleCalendarFetch,
  handleFetchMoodle,
  setActiveTab,
  onOpenCourse,
  onSystemBack,
  loginToVTOP,
  resetKey,
}: DashboardAttendanceFeatureProps) {
  const attendance = attendanceData?.attendance ?? [];

  useEffect(() => {
    if (activeSubTab === "attendance") {
      setActiveSubTab("calendar");
    }
  }, [activeSubTab, setActiveSubTab]);

  return (
    <div className="animate-fadeIn">
      {(activeSubTab === "calendar" || activeSubTab === "attendance") && (
        <CalendarSubpage
          calendars={calendarData?.calendars}
          calendarType={settings.calendarType}
          handleCalendarFetch={handleCalendarFetch}
          moodleData={moodleData}
          scheduleData={scheduleData}
          attendanceData={attendanceData}
          ODhoursData={ODhoursData}
          handleFetchMoodle={handleFetchMoodle}
          IDs={IDs}
          currSemesterID={settings.currSemesterID}
          targetAttendance={settings.targetAttendance}
          onOpenCirculars={() => setActiveSubTab("circulars")}
          onOpenCourse={onOpenCourse}
          onBack={onSystemBack}
        />
      )}

      {activeSubTab === "circulars" && (
        <CircularsTab loginToVTOP={loginToVTOP} onBack={() => setActiveSubTab("calendar")} />
      )}

      {activeSubTab === "predictor" &&
        (() => {
          const { results, impDates } = buildMilestoneDates(calendarData);
          return (
            <OverallAttendancePredictor
              attendanceData={attendance}
              analyzeCalendars={results}
              dayCardsMap={buildAttendanceDayCardsMap(
                attendance,
                undefined,
                (typeof window !== "undefined" ? localStorage.getItem("saturday_timetable_override") : null) || "SAT",
              )}
              impDates={impDates}
              isDayscholarWithBus={settings.isDayscholarWithBus}
              decimalValues={settings.decimalValues}
              onBack={onSystemBack}
            />
          );
        })()}

      {activeSubTab === "od" && (
        <ODTrackerSubpage
          ODhoursData={ODhoursData}
          attendanceData={attendanceData?.attendance}
          onBack={onSystemBack}
          currSemesterID={settings.currSemesterID}
          allGradesData={allGradesData}
        />
      )}
    </div>
  );
}
