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
import GPAPredictorTab from "../exams/GPAPredictorTab";
import FacultyInfoTab from "../exams/FacultyInfoTab";
import FreeClassroomsTab from "../exams/FreeClassroomsTab";
import FFCSTimetableTab from "../exams/FFCSTimetableTab";
import SocialTab from "../social/SocialTab";
import CabShareTab from "../hostel/CabShare/CabShareTab";
import QBankSubTabs from "../qbank/QBankSubTabs";
import OverallAttendancePredictor from "../attendance/OverallAttendancePredictor";

const PapersArchiveTab = dynamic(() => import("../qbank/PapersArchiveTab"), {
  ssr: false,
});
const PureQBankTab = dynamic(() => import("../qbank/PureQBankTab"), {
  ssr: false,
});

interface ToolsTabProps {
  marksData: any;
  allGradesData?: any;
  attendanceData?: any;
  loginToVTOP?: any;
  IDs?: any;
  activeToolsSubTab: string;
  setActiveToolsSubTab: (subTab: string) => void;
  activeQBankSubTab?: string;
  setActiveQBankSubTab?: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function ToolsTab({
  marksData,
  allGradesData,
  attendanceData,
  loginToVTOP,
  IDs,
  activeToolsSubTab,
  setActiveToolsSubTab,
  activeQBankSubTab = "archive",
  setActiveQBankSubTab,
  setActiveTab,
}: ToolsTabProps) {
  const [internalQBankSubTab, setInternalQBankSubTab] = useState("archive");
  const currentQBankSubTab = setActiveQBankSubTab
    ? activeQBankSubTab
    : internalQBankSubTab;
  const setQBankSubTab = setActiveQBankSubTab || setInternalQBankSubTab;

  const toolNavItems = [
    { id: "overview", label: "Tools Hub", icon: Layers },
    { id: "qbank", label: "Question Bank", icon: Database },
    { id: "faculty-info", label: "Faculty Explorer", icon: UserCheck },
    { id: "predictor", label: "CGPA Predictor", icon: TrendingUp },
    { id: "social", label: "Social Timetable", icon: Users },
    { id: "cabshare", label: "Cab Share", icon: Car },
    { id: "free-class", label: "Free Classrooms", icon: DoorOpen },
    { id: "ffcs", label: "FFCS Planner", icon: Compass },
  ];

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto space-y-4 pb-24 md:pb-8">
      {/* Top Navigation & Subtabs Bar when inside a specific tool */}
      {activeToolsSubTab !== "overview" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <button
            onClick={() => setActiveToolsSubTab("overview")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-black hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer w-fit"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to All Tools</span>
          </button>

          {/* Quick switcher pill strip */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {toolNavItems.map((item) => {
              const isActive = activeToolsSubTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveToolsSubTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main View Router */}
      <div>
        {activeToolsSubTab === "overview" && (
          <ToolsHub
            setActiveToolsSubTab={setActiveToolsSubTab}
            setActiveTab={setActiveTab}
          />
        )}

        {activeToolsSubTab === "qbank" && (
          <div className="animate-fadeIn space-y-4">
            <QBankSubTabs
              activeSubTab={currentQBankSubTab}
              setActiveSubTab={setQBankSubTab}
            />
            {currentQBankSubTab === "archive" && (
              <PapersArchiveTab
                allGradesData={allGradesData}
                marksData={marksData}
                username={IDs?.VtopUsername}
                setActiveSubTab={setActiveToolsSubTab}
              />
            )}
            {currentQBankSubTab === "pure" && (
              <PureQBankTab
                allGradesData={allGradesData}
                marksData={marksData}
                setActiveSubTab={setActiveToolsSubTab}
              />
            )}
          </div>
        )}

        {activeToolsSubTab === "faculty-info" && (
          <div className="animate-fadeIn">
            <FacultyInfoTab
              loginToVTOP={loginToVTOP}
              setActiveSubTab={setActiveToolsSubTab}
            />
          </div>
        )}

        {activeToolsSubTab === "predictor" && (
          <div className="animate-fadeIn">
            <GPAPredictorTab
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
            <CabShareTab />
          </div>
        )}

        {activeToolsSubTab === "free-class" && (
          <div className="animate-fadeIn">
            <FreeClassroomsTab setActiveSubTab={setActiveToolsSubTab} />
          </div>
        )}

        {activeToolsSubTab === "attendance-predictor" && (
          <div className="animate-fadeIn">
            <OverallAttendancePredictor
              attendanceData={attendanceData?.attendance || []}
              onBack={() => setActiveToolsSubTab("overview")}
            />
          </div>
        )}

        {activeToolsSubTab === "ffcs" && (
          <div className="animate-fadeIn">
            <FFCSTimetableTab />
          </div>
        )}
      </div>
    </div>
  );
}
