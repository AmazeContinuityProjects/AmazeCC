"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  Database,
  UserCheck,
  TrendingUp,
  Users,
  Car,
  DoorOpen,
  Compass,
  Layers,
  Sparkles,
} from "lucide-react";
import ToolsHub from "./ToolsHub";
import FacultyInfoTab from "../exams/FacultyInfoTab";
import FreeClassroomsTab from "../exams/FreeClassroomsTab";
import FFCSTimetableTab from "../exams/FFCSTimetableTab";
import SocialTab from "../social/SocialTab";
import CabShareTab from "../hostel/CabShare/CabShareTab";
import QBankSubpage from "../qbank/QBankSubpage";
import OverallAttendancePredictor from "../attendance/OverallAttendancePredictor";
import { buildAttendanceDayCardsMap } from "@/lib/attendanceTimetable";
import { buildMilestoneDates } from "@/lib/milestoneDates";
import MarksPredictorTab from "../exams/MarksPredictorTab";
import TasksTab from "../tasks/TasksTab";

interface ToolsTabProps {
  marksData: any;
  allGradesData?: any;
  attendanceData?: any;
  loginToVTOP?: any;
  IDs?: any;
  activeToolsSubTab: string;
  setActiveToolsSubTab: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
  /**
   * Main's history-aware back. Required by any page here that should consume a
   * history entry rather than push one — see the note on the predictor below.
   */
  onSystemBack?: () => void;
  /** Raw `/api/calendar` payload, for the surfaces that read milestone dates. */
  calendarData?: any;
  decimalValues?: boolean;
  isDayscholarWithBus?: boolean;
}

export default function ToolsTab({
  marksData,
  allGradesData,
  attendanceData,
  loginToVTOP,
  IDs,
  activeToolsSubTab,
  setActiveToolsSubTab,
  setActiveTab,
  onSystemBack,
  calendarData,
  decimalValues,
  isDayscholarWithBus,
}: ToolsTabProps) {
  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto space-y-4 md:pb-8">
      {/* Main View Router */}
      <div>
        {activeToolsSubTab === "overview" && (
          <ToolsHub
            setActiveToolsSubTab={setActiveToolsSubTab}
            setActiveTab={setActiveTab}
          />
        )}

        {activeToolsSubTab === "qbank" && (
          <QBankSubpage
            allGradesData={allGradesData}
            marksData={marksData}
            username={IDs?.VtopUsername}
            setActiveSubTab={setActiveToolsSubTab}
          />
        )}

        {activeToolsSubTab === "faculty-info" && (
          <div className="animate-fadeIn">
            <FacultyInfoTab
              loginToVTOP={loginToVTOP}
              setActiveSubTab={setActiveToolsSubTab}
            />
          </div>
        )}

        {activeToolsSubTab === "marks-predictor" && (
          <div className="animate-fadeIn">
            <MarksPredictorTab
              marksData={marksData}
              attendance={attendanceData?.attendance}
              setActiveSubTab={setActiveToolsSubTab}
            />
          </div>
        )}

        {activeToolsSubTab === "social" && (
          <div className="animate-fadeIn">
            <SocialTab
              attendanceData={attendanceData}
              isDemo={IDs?.VtopUsername === "demo"}
            />
          </div>
        )}

        {activeToolsSubTab === "cabshare" && (
          <div className="animate-fadeIn">
            <CabShareTab onBack={() => setActiveToolsSubTab("overview")} />
          </div>
        )}

        {activeToolsSubTab === "free-class" && (
          <div className="animate-fadeIn">
            <FreeClassroomsTab onBack={() => setActiveToolsSubTab("overview")} />
          </div>
        )}

        {activeToolsSubTab === "attendance-predictor" && (
          <div className="animate-fadeIn">
            {(() => {
              // Without the calendar the predictor has no working days, no
              // milestones and therefore no locks — every course showed "no
              // classes left to project". It was reachable from this hub, so it
              // gets the same data the Dashboard hands its own copy.
              const { results, impDates } = buildMilestoneDates(calendarData);
              return (
                <OverallAttendancePredictor
                  attendanceData={attendanceData?.attendance || []}
                  analyzeCalendars={results}
                  dayCardsMap={buildAttendanceDayCardsMap(
                    attendanceData?.attendance || [],
                    undefined,
                    (typeof window !== "undefined"
                      ? localStorage.getItem("saturday_timetable_override")
                      : null) || "SAT"
                  )}
                  impDates={impDates}
                  isDayscholarWithBus={isDayscholarWithBus}
                  decimalValues={decimalValues}
                  onBack={onSystemBack ?? (() => setActiveToolsSubTab("overview"))}
                />
              );
            })()}
          </div>
        )}

        {activeToolsSubTab === "ffcs" && (
          <div className="animate-fadeIn">
            <FFCSTimetableTab />
          </div>
        )}

        {activeToolsSubTab === "tasks" && (
          <div className="animate-fadeIn">
            <TasksTab onBack={() => setActiveToolsSubTab("overview")} />
          </div>
        )}
      </div>
    </div>
  );
}

