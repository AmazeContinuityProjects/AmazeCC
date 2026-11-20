"use client";

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
  marksStats?: Record<string, any>;
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
  /**
   * The shell's reload action, forwarded to the semester picker in Free
   * Classrooms so a switch triggers a full sync. Optional: without it the tab
   * falls back to relabeling only.
   */
  handleReloadRequest?: (semesterId?: string, modeId?: string) => Promise<void>;
}

export default function ToolsTab({
  marksData,
  marksStats,
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
  handleReloadRequest,
}: ToolsTabProps) {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 md:pb-8">
      {/* Main View Router */}
      <div>
        {activeToolsSubTab === "overview" && (
          <ToolsHub setActiveToolsSubTab={setActiveToolsSubTab} setActiveTab={setActiveTab} />
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
          <div>
            <FacultyInfoTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveToolsSubTab} />
          </div>
        )}

        {activeToolsSubTab === "marks-predictor" && (
          <div>
            <MarksPredictorTab
              marksData={marksData}
              marksStats={marksStats}
              attendance={attendanceData?.attendance}
              setActiveSubTab={setActiveToolsSubTab}
            />
          </div>
        )}

        {activeToolsSubTab === "social" && (
          <div>
            <SocialTab attendanceData={attendanceData} isDemo={IDs?.VtopUsername === "demo"} />
          </div>
        )}

        {activeToolsSubTab === "cabshare" && (
          <div>
            <CabShareTab onBack={() => setActiveToolsSubTab("overview")} />
          </div>
        )}

        {activeToolsSubTab === "free-class" && (
          <div>
            <FreeClassroomsTab
              onBack={() => setActiveToolsSubTab("overview")}
              handleReloadRequest={handleReloadRequest}
            />
          </div>
        )}

        {activeToolsSubTab === "attendance-predictor" && (
          <div>
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
                    (typeof window !== "undefined" ? localStorage.getItem("saturday_timetable_override") : null) ||
                      "SAT",
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
          <div>
            <FFCSTimetableTab />
          </div>
        )}

        {activeToolsSubTab === "tasks" && (
          <div>
            <TasksTab onBack={() => setActiveToolsSubTab("overview")} />
          </div>
        )}
      </div>
    </div>
  );
}
