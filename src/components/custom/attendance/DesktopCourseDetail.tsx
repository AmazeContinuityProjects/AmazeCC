"use client";

import { useState, useEffect } from "react";
import { Building2, Clock, User, FileText, CheckCircle2, Minus, Plus } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import { findOfficialOdWhy } from "@/lib/officialOd";
import { getTargetAttendancePct } from "@/store/settingsAtoms";

export interface DesktopCourseDetailProps {
  a?: any;
  course?: any;
  isDayscholarWithBus?: boolean;
  decimalValues?: boolean;
  results?: any;
  dayCardsMap?: any;
  impDates?: any;
  onViewFullPage?: () => void;
  simulatedSkips?: number;
  onSimulateSkipsChange?: (val: number) => void;
  className?: string;
  emptyPlaceholder?: React.ReactNode;
}

export default function DesktopCourseDetail({
  a,
  course,
  isDayscholarWithBus,
  decimalValues,
  results,
  dayCardsMap,
  impDates,
  onViewFullPage,
  simulatedSkips: propSimulatedSkips,
  onSimulateSkipsChange,
  className,
  emptyPlaceholder,
}: DesktopCourseDetailProps) {
  const item = a || course;

  const [internalSkips, setInternalSkips] = useState(0);
  const simulatedSkips = propSimulatedSkips !== undefined ? propSimulatedSkips : internalSkips;

  const handleSimulateSkipsChange = (val: number) => {
    const next = Math.max(0, val);
    if (onSimulateSkipsChange) {
      onSimulateSkipsChange(next);
    } else {
      setInternalSkips(next);
    }
  };

  const [notesTracker, setNotesTracker] = useState<Record<string, Record<string, boolean>>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem("uniCC_notes_tracker");
      if (saved) setNotesTracker(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleNotes = (dateStr: string) => {
    if (!item?.courseCode) return;
    const key = item.courseCode;
    setNotesTracker((prev) => {
      const newState = {
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          [dateStr]: !prev[key]?.[dateStr],
        },
      };
      try {
        localStorage.setItem("uniCC_notes_tracker", JSON.stringify(newState));
      } catch (e) {
        console.error(e);
      }
      return newState;
    });
  };

  const handleViewFullPage = () => {
    if (onViewFullPage) {
      onViewFullPage();
      return;
    }
    const code = item?.courseCode;
    if (code && typeof window !== "undefined") {
      localStorage.setItem("course_dashboard_target", code);
      localStorage.setItem("course_dashboard_tab", "attendance");
    }
  };

  const containerClasses =
    className !== undefined
      ? className
      : "hidden md:block bg-white  dark:bg-[#080808] border border-gray-200  dark:border-gray-800/80 rounded-2xl p-6 shadow-sm sticky top-4";

  if (!item) {
    return (
      <div className={containerClasses}>
        {emptyPlaceholder || (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-20">
            <p>Select a class on the timeline to view details.</p>
          </div>
        )}
      </div>
    );
  }

  const codeRaw = item.courseCode || "";
  const lab = Boolean(codeRaw.endsWith("(L)") || item.courseType?.toLowerCase().includes("lab"));
  const isTheory = Boolean(codeRaw.endsWith("(T)") || item.courseType?.toLowerCase().includes("theory"));
  const displayCode = codeRaw.endsWith("(L)") || codeRaw.endsWith("(T)") ? codeRaw.slice(0, -3) : codeRaw;
  const displayType = lab ? "Lab" : isTheory ? "Theory" : item.courseType || "Theory";
  const credits = item.credits ?? item.credit ?? "4.0";

  const thresholdPct = getTargetAttendancePct();
  const originalPercentage = parseFloat(item.attendancePercentage || "0");
  const attended = parseInt(item.attendedClasses || "0", 10);
  const total = parseInt(item.totalClasses || "0", 10) + simulatedSkips;
  const simulatedPercentage = total > 0 ? parseFloat(((attended / total) * 100).toFixed(1)) : originalPercentage;

  const isSafe = simulatedPercentage >= thresholdPct;
  const canMissVal = isSafe && total > 0 ? Math.floor(attended / (thresholdPct / 100) - total) : 0;
  const canMissClasses = lab ? Math.floor(canMissVal / 2) : canMissVal;

  const neededVal = !isSafe ? Math.ceil(((thresholdPct / 100) * total - attended) / (1 - thresholdPct / 100)) : 0;
  const neededClasses = lab ? Math.ceil(neededVal / 2) : neededVal;

  const historyList = Array.isArray(item.viewLink) ? item.viewLink : [];
  const recentHistory = historyList.slice(0, 5);

  const CLASS_WEIGHT = lab ? 2 : 1;
  const nextAttendPct =
    total + CLASS_WEIGHT > 0 ? parseFloat((((attended + CLASS_WEIGHT) / (total + CLASS_WEIGHT)) * 100).toFixed(1)) : 0;
  const nextSkipPct = total + CLASS_WEIGHT > 0 ? parseFloat(((attended / (total + CLASS_WEIGHT)) * 100).toFixed(1)) : 0;

  const attendDiff = parseFloat((nextAttendPct - simulatedPercentage).toFixed(1));
  const skipDiff = parseFloat((nextSkipPct - simulatedPercentage).toFixed(1));

  const attendDiffStr = attendDiff >= 0 ? `+${attendDiff}%` : `${attendDiff}%`;
  const skipDiffStr = skipDiff >= 0 ? `+${skipDiff}%` : `${skipDiff}%`;

  return (
    <div className={containerClasses}>
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex flex-col gap-3.5 border-b border-gray-150 dark:border-gray-800/80 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black font-[family-name:var(--font-outfit)] text-gray-900 dark:text-gray-100 leading-tight">
              {item.courseTitle}
            </h2>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              {displayCode} • {displayType} • {credits} Credits
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-xl border border-gray-150/40 dark:border-gray-800/60">
              <Clock className="w-3.5 h-3.5 text-blue-550 dark:text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-555 font-bold leading-none mb-0.5">
                  Slot & Time
                </p>
                <p className="font-extrabold text-gray-800 dark:text-gray-200 truncate">
                  {item.slotName} ({item.time})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-xl border border-gray-150/40 dark:border-gray-800/60">
              <Building2 className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-555 font-bold leading-none mb-0.5">
                  Venue
                </p>
                <p className="font-extrabold text-gray-800 dark:text-gray-200 truncate">{item.slotVenue}</p>
              </div>
            </div>
            {item.faculty && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-xl border border-gray-150/40 dark:border-gray-800/60 col-span-2">
                <User className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-450 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-555 font-bold leading-none mb-0.5">
                    Faculty
                  </p>
                  <p className="font-extrabold text-gray-800 dark:text-gray-200 truncate">{item.faculty}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Premium Stat Boxes */}
        <div className="flex flex-col gap-4">
          {/* Attendance Status Card */}
          <div className="bg-gray-50/50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-455 dark:text-gray-500 mb-1">
                Attendance
              </h4>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{simulatedPercentage}%</p>
                {simulatedSkips > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-555 line-through font-bold">
                    {originalPercentage}%
                  </span>
                )}
                <span className="text-xs text-gray-555 dark:text-gray-400 font-semibold">
                  ({attended} / {total})
                </span>
              </div>

              {/* Horizontal Progress Bar */}
              <div className="w-full mt-3 bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    simulatedPercentage < thresholdPct
                      ? "bg-red-500"
                      : simulatedPercentage < thresholdPct + 10
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, simulatedPercentage)}%` }}
                />
              </div>

              {/* Status & Buffer metrics */}
              <div className="mt-4 pt-3.5 border-t border-gray-200/60 dark:border-gray-800/60 flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    Status
                  </span>
                  <span
                    className={`font-black uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded ${
                      isSafe
                        ? "bg-emerald-550/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400"
                        : "bg-red-550/10 text-red-500 dark:bg-red-500/5 dark:text-red-400"
                    }`}
                  >
                    {isSafe ? "Safe" : "Critical"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    {isSafe ? "Safe Buffer" : "Shortage"}
                  </span>
                  <span
                    className={`font-extrabold ${isSafe ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                  >
                    {isSafe
                      ? canMissClasses === 0
                        ? "No buffer"
                        : `Can skip ${canMissClasses} class${canMissClasses !== 1 ? "es" : ""}`
                      : `Need +${neededClasses} class${neededClasses !== 1 ? "es" : ""}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Inline Skip Predictor Widget for Desktop */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-black border border-gray-200/60 dark:border-gray-800/80 mt-1">
              <span className="text-[10px] font-black text-gray-450 dark:text-gray-555 uppercase tracking-wider pl-1">
                Simulate Skips
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSimulateSkipsChange(simulatedSkips - 1)}
                  className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 dark:bg-gray-900 dark:border-gray-800 cursor-pointer"
                  title="Decrease simulated skips"
                >
                  <Minus className="w-3 h-3 text-gray-655 dark:text-gray-300" />
                </button>
                <span
                  onClick={() => {
                    if (simulatedSkips !== 0) {
                      handleSimulateSkipsChange(0);
                    }
                  }}
                  className={`text-xs font-bold w-4 text-center select-none ${
                    simulatedSkips !== 0
                      ? "cursor-pointer hover:text-red-500 hover:scale-110 active:scale-95 transition-all text-blue-605 dark:text-blue-400 font-extrabold"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                  title={simulatedSkips !== 0 ? "Click to reset to 0" : ""}
                >
                  {simulatedSkips}
                </span>
                <button
                  onClick={() => handleSimulateSkipsChange(simulatedSkips + 1)}
                  className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 dark:bg-gray-900 dark:border-gray-800 cursor-pointer"
                  title="Increase simulated skips"
                >
                  <Plus className="w-3 h-3 text-gray-655 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gray-50/50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-455 dark:text-gray-550 mb-3">
              Next Class Impact
            </h4>
            <div className="flex flex-col h-full justify-between gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-450 leading-relaxed">
                Simulate the outcome of your next scheduled class. Attending will improve your average, while skipping
                will reduce it.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full">
                {/* Attend Card */}
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 dark:border-emerald-500/25 rounded-xl p-4 flex flex-col justify-between transition-all hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      If Attend
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{nextAttendPct}%</span>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded w-fit">
                      {attendDiffStr}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-555 mt-1.5">Increases buffer.</p>
                </div>

                {/* Skip Card */}
                <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 dark:border-red-500/25 rounded-xl p-4 flex flex-col justify-between transition-all hover:bg-red-500/10 dark:hover:bg-red-500/15">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                      If Skip
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-2xl font-black text-red-600 dark:text-red-400">{nextSkipPct}%</span>
                    <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 px-1.5 py-0.5 rounded w-fit">
                      {skipDiffStr}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-555 mt-1.5">Reduces buffer.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick History Log */}
        <div className="bg-transparent border border-gray-200 dark:border-gray-800/80 rounded-2xl overflow-hidden">
          <div className="p-4 bg-gray-50/50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-455 dark:text-gray-550">
              Recent Attendance History
            </h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {historyList.length} total records
            </span>
          </div>
          {recentHistory.length === 0 ? (
            <EmptyState title="No attendance history records found" className="p-6" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {recentHistory.map((d: any, idx: number) => {
                const status = (d.status || "").toLowerCase();
                const isPresent = status === "present";
                const isAbsent = status === "absent";
                const hasNotes = notesTracker[item.courseCode]?.[d.date] === true;
                const isOD = status === "on duty" || status === "partial od";
                const officialWhy = isOD ? findOfficialOdWhy(d.date) : [];

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-950/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-1.5 h-7 rounded-full shrink-0 ${
                          isPresent ? "bg-emerald-500" : isAbsent ? "bg-red-500" : "bg-yellow-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-gray-900 dark:text-gray-100">{d.date}</p>
                        <p
                          className={`text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${
                            isPresent
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isAbsent
                                ? "text-red-600 dark:text-red-400"
                                : "text-yellow-600 dark:text-yellow-400"
                          }`}
                        >
                          {d.status}
                        </p>
                        {officialWhy.length > 0 && (
                          <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-snug mt-1 break-words">
                            <span className="font-bold">{officialWhy[0].reason}</span>
                            {officialWhy[0].remarks ? ` — ${officialWhy[0].remarks}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isPresent && (
                      <button
                        onClick={() => toggleNotes(d.date)}
                        className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                          hasNotes
                            ? "bg-emerald-55/15 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-black dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 cursor-pointer"
                        }`}
                      >
                        {hasNotes ? <CheckCircle2 size={11} /> : <FileText size={11} />}
                        <span>{hasNotes ? "Secured" : "Get Notes"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View Full History Button */}
        <button
          onClick={handleViewFullPage}
          className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.985]"
        >
          View Full History & Heatmap
        </button>
      </div>
    </div>
  );
}

export { DesktopCourseDetail as DesktopCourseDetailPane };
