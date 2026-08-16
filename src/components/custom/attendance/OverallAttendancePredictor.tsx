"use client";

import React, { useState, useMemo, useCallback } from "react";
import PageHeader from "../shared/PageHeader";
import {
  CalendarCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flame,
  Search,
  BookOpen,
  Minus,
  Plus,
  Zap,
} from "lucide-react";

interface CalendarEvent {
  text: string;
  type: "working" | "holiday";
  color: string;
  category?: string;
}

interface CalendarDay {
  date: Date;
  weekday: string;
  month: string;
  year: number;
  events?: CalendarEvent[];
}

interface OverallAttendancePredictorProps {
  attendanceData: any[];
  analyzeCalendars?: any[];
  dayCardsMap?: Record<string, any[]>;
  impDates?: {
    cat1Date?: Date | null;
    cat2Date?: Date | null;
    lidLabDate?: Date | null;
    lidTheoryDate?: Date | null;
  };
  isDayscholarWithBus?: boolean;
  onBack?: () => void;
  decimalValues?: boolean;
}

export default function OverallAttendancePredictor({
  attendanceData = [],
  analyzeCalendars = [],
  dayCardsMap = {},
  impDates = {},
  isDayscholarWithBus = false,
  onBack,
  decimalValues = true,
}: OverallAttendancePredictorProps) {
  // Target threshold state (default from localStorage or bus status)
  const [targetThreshold, setTargetThreshold] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.targetAttendance) return Number(parsed.targetAttendance);
        }
      } catch (e) {}
    }
    return isDayscholarWithBus ? 85 : 75;
  });

  // Simulation mode: "CAT1" | "CAT2" | "LID" | "ALL"
  const [mode, setMode] = useState<string>(() => {
    const now = new Date();
    if (impDates.cat1Date && impDates.cat1Date > now) return "CAT1";
    if (impDates.cat2Date && impDates.cat2Date > now) return "CAT2";
    return "LID";
  });

  // Date States: timestamp -> 0 (Attending), 1 (Absent / Bunked), 2 (Off / Holiday)
  const [dateStates, setDateStates] = useState<Record<number, number>>({});
  // Per-course manual skip overrides
  const [courseManualSkips, setCourseManualSkips] = useState<Record<string, number>>({});
  // Active calendar month index
  const [monthIdx, setMonthIdx] = useState<number>(0);
  // Search and Filter
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Normalize all calendar working days from analyzeCalendars
  const allWorkingDays = useMemo<CalendarDay[]>(() => {
    if (!Array.isArray(analyzeCalendars) || analyzeCalendars.length === 0) return [];

    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];

    return analyzeCalendars.flatMap((monthObj) => {
      const monthStr = monthObj.month?.toLowerCase() || "";
      const year = monthObj.year || new Date().getFullYear();
      const foundMonth = monthNames.find((m) => monthStr.includes(m));
      const mIndex = foundMonth ? monthNames.indexOf(foundMonth) : -1;

      return (monthObj.days || [])
        .filter((d: any) => d.type?.toLowerCase() === "working")
        .map((d: any) => {
          const dateObj = mIndex === -1 ? null : new Date(year, mIndex, d.date);
          if (!dateObj || dateObj < today) return null;
          return {
            date: dateObj,
            weekday: d.weekday || "",
            month: monthObj.month || "",
            year: monthObj.year || year,
            events: d.events || [],
          };
        })
        .filter(Boolean) as CalendarDay[];
    });
  }, [analyzeCalendars, today]);

  // Cutoff date based on selected mode
  const cutoffDate = useMemo(() => {
    if (mode === "CAT1") return impDates.cat1Date || null;
    if (mode === "CAT2") return impDates.cat2Date || null;
    if (mode === "LID") {
      const labTime = impDates.lidLabDate?.getTime?.() || 0;
      const theoryTime = impDates.lidTheoryDate?.getTime?.() || 0;
      const maxTime = Math.max(labTime, theoryTime);
      return maxTime > 0 ? new Date(maxTime) : null;
    }
    return null;
  }, [mode, impDates]);

  // Attendance lock dates (Thursday/Friday prior to CAT exams)
  const attendanceLockDates = useMemo(() => {
    if (!cutoffDate || mode === "LID" || mode === "ALL") return new Set<number>();

    const normalize = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    };

    const isThuOrFri = (d: Date) => {
      const day = d.getDay();
      return day === 4 || day === 5;
    };

    const locked = new Set<number>();
    const d1 = new Date(cutoffDate);
    d1.setDate(d1.getDate() - 2);

    const d2 = new Date(cutoffDate);
    d2.setDate(d2.getDate() - 1);

    if (isThuOrFri(d1)) locked.add(normalize(d1));
    if (isThuOrFri(d2)) locked.add(normalize(d2));

    return locked;
  }, [cutoffDate, mode]);

  // Available months list for navigation
  const monthsAvailable = useMemo(() => {
    return Array.from(new Set(allWorkingDays.map((d) => `${d.month} ${d.year}`)));
  }, [allWorkingDays]);

  const currentMonth = monthsAvailable[monthIdx] || monthsAvailable[0] || "";

  // Visible working days for the currently selected month & cutoff
  const visibleMonthDays = useMemo(() => {
    return allWorkingDays.filter((d) => {
      if (!d || !d.date) return false;
      const sameMonth = `${d.month} ${d.year}` === currentMonth;
      if (!sameMonth) return false;
      if (cutoffDate && d.date > cutoffDate) return false;
      return true;
    });
  }, [allWorkingDays, currentMonth, cutoffDate]);

  // Toggle single calendar day state: 0 (Attending) -> 1 (Absent) -> 2 (Off) -> 0
  const toggleDayState = useCallback((date: Date) => {
    const time = date.getTime();
    setDateStates((prev) => {
      const effectiveState =
        prev[time] !== undefined
          ? prev[time]
          : attendanceLockDates.has(time)
            ? 2
            : 0;
      const nextState = (effectiveState + 1) % 3;
      return { ...prev, [time]: nextState };
    });
  }, [attendanceLockDates]);

  // Reset all simulation overrides
  const handleResetAll = useCallback(() => {
    setDateStates({});
    setCourseManualSkips({});
  }, []);

  // Quick Action: Mark all upcoming Fridays as absent
  const handleBunkFridays = useCallback(() => {
    const newStates = { ...dateStates };
    allWorkingDays.forEach((d) => {
      if (d.weekday?.toUpperCase().startsWith("FRI") || d.date.getDay() === 5) {
        if (!cutoffDate || d.date <= cutoffDate) {
          newStates[d.date.getTime()] = 1;
        }
      }
    });
    setDateStates(newStates);
  }, [allWorkingDays, cutoffDate, dateStates]);

  // Quick Action: Attend all upcoming classes
  const handleAttendAll = useCallback(() => {
    const newStates = { ...dateStates };
    allWorkingDays.forEach((d) => {
      if (!cutoffDate || d.date <= cutoffDate) {
        newStates[d.date.getTime()] = 0;
      }
    });
    setDateStates(newStates);
    setCourseManualSkips({});
  }, [allWorkingDays, cutoffDate, dateStates]);

  // Total working days remaining till cutoff
  const totalRemainingWorkingDays = useMemo(() => {
    return allWorkingDays.filter((d) => !cutoffDate || d.date <= cutoffDate).length;
  }, [allWorkingDays, cutoffDate]);

  // Main Course-by-Course Attendance Predictions
  const predictions = useMemo(() => {
    const validCourses = attendanceData.filter((c) => c.slotName !== "NILL" && c.courseCode);

    return validCourses.map((c) => {
      const attended = parseInt(c.attendedClasses) || 0;
      const total = parseInt(c.totalClasses) || 0;
      const isLab = c.courseCode.endsWith("(L)") || c.courseType?.toLowerCase()?.includes("lab");
      const currentPct = total > 0 ? (attended / total) * 100 : 0;

      let effectiveCutoff: Date | null = null;
      if (mode === "CAT1") {
        effectiveCutoff = impDates.cat1Date || null;
      } else if (mode === "CAT2") {
        effectiveCutoff = impDates.cat2Date || null;
      } else if (mode === "LID") {
        effectiveCutoff = isLab ? (impDates.lidLabDate || null) : (impDates.lidTheoryDate || null);
      }

      const filteredDays = allWorkingDays.filter(
        (d) => !effectiveCutoff || d.date <= effectiveCutoff
      );

      const { futureCount, meetingDays } = countFutureClassesForCourse(
        c.courseCode,
        dayCardsMap,
        filteredDays,
        dateStates,
        effectiveCutoff,
        attendanceLockDates
      );

      const missedFromCalendar = countMissedClassesForCourse(
        c.courseCode,
        dayCardsMap,
        dateStates,
        filteredDays,
        effectiveCutoff,
        attendanceLockDates
      );

      const manualSkips = courseManualSkips[c.courseCode] || 0;
      const totalMissedDays = missedFromCalendar + manualSkips;

      const effectiveFutureClasses = isLab ? futureCount * 2 : futureCount;
      const effectiveMissedClasses = effectiveFutureClasses > 0
        ? Math.min(isLab ? totalMissedDays * 2 : totalMissedDays, effectiveFutureClasses)
        : 0;

      const predictedAttended = attended + (effectiveFutureClasses - effectiveMissedClasses);
      const predictedTotal = total + effectiveFutureClasses;
      const predictedPct = predictedTotal > 0 ? (predictedAttended / predictedTotal) * 100 : 0;
      const deltaPct = predictedPct - currentPct;

      // Safe Bunks / Classes Needed Calculations
      const thresholdRatio = targetThreshold / 100;
      let safeBunks = 0;
      let classesNeeded = 0;

      if (predictedPct >= targetThreshold) {
        const rawSafe = Math.floor((predictedAttended - thresholdRatio * predictedTotal) / thresholdRatio);
        safeBunks = Math.max(0, isLab ? Math.floor(rawSafe / 2) : rawSafe);
      } else {
        const rawNeeded = Math.ceil((thresholdRatio * predictedTotal - predictedAttended) / (1 - thresholdRatio));
        classesNeeded = Math.max(0, isLab ? Math.ceil(rawNeeded / 2) : rawNeeded);
      }

      return {
        ...c,
        currentAttended: attended,
        currentTotal: total,
        currentPct,
        futureClasses: effectiveFutureClasses,
        missedClasses: effectiveMissedClasses,
        predictedAttended,
        predictedTotal,
        predictedPct,
        deltaPct,
        safeBunks,
        classesNeeded,
        isLab,
        meetingDays,
        manualSkips,
      };
    });
  }, [
    attendanceData,
    mode,
    impDates,
    allWorkingDays,
    dayCardsMap,
    dateStates,
    attendanceLockDates,
    courseManualSkips,
    targetThreshold,
  ]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    const currentAttendedSum = predictions.reduce((sum, p) => sum + p.currentAttended, 0);
    const currentTotalSum = predictions.reduce((sum, p) => sum + p.currentTotal, 0);
    const predictedAttendedSum = predictions.reduce((sum, p) => sum + p.predictedAttended, 0);
    const predictedTotalSum = predictions.reduce((sum, p) => sum + p.predictedTotal, 0);

    const currentOverallPct = currentTotalSum > 0 ? (currentAttendedSum / currentTotalSum) * 100 : 0;
    const predictedOverallPct = predictedTotalSum > 0 ? (predictedAttendedSum / predictedTotalSum) * 100 : 0;
    const deltaOverall = predictedOverallPct - currentOverallPct;

    const safeCount = predictions.filter((p) => p.predictedPct >= targetThreshold).length;
    const atRiskCount = predictions.filter((p) => p.predictedPct < targetThreshold).length;
    const totalSafeBunksAcrossCourses = predictions.reduce((sum, p) => sum + p.safeBunks, 0);

    return {
      currentOverallPct: decimalValues ? currentOverallPct.toFixed(2) : currentOverallPct.toFixed(1),
      predictedOverallPct: decimalValues ? predictedOverallPct.toFixed(2) : predictedOverallPct.toFixed(1),
      deltaOverall: deltaOverall.toFixed(2),
      isDeltaPositive: deltaOverall >= 0,
      safeCount,
      atRiskCount,
      totalSafeBunksAcrossCourses,
      totalCourses: predictions.length,
    };
  }, [predictions, targetThreshold, decimalValues]);

  // Filtered courses based on search and status filter
  const filteredCourses = useMemo(() => {
    return predictions.filter((p) => {
      const matchesSearch =
        p.courseCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.courseTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.faculty?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === "safe") return p.predictedPct >= targetThreshold;
      if (filterType === "risk") return p.predictedPct < targetThreshold;
      if (filterType === "theory") return !p.isLab;
      if (filterType === "lab") return p.isLab;
      return true;
    });
  }, [predictions, searchTerm, filterType, targetThreshold]);

  // Milestone button options
  const milestoneOptions = useMemo(() => {
    const now = new Date();
    return [
      { id: "CAT1", label: "Till CAT I", date: impDates.cat1Date, available: !impDates.cat1Date || impDates.cat1Date > now },
      { id: "CAT2", label: "Till CAT II", date: impDates.cat2Date, available: !impDates.cat2Date || impDates.cat2Date > now },
      { id: "LID", label: "Till LID", date: impDates.lidTheoryDate || impDates.lidLabDate, available: true },
      { id: "ALL", label: "All Days", date: null, available: true },
    ];
  }, [impDates]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-16 animate-in fade-in duration-200 text-left select-none font-[family-name:var(--font-outfit)]">
      {/* ── HEADER ── */}
      <PageHeader
        icon={<CalendarCheck className="w-5.5 h-5.5 text-blue-600 dark:text-blue-400" />}
        title="Attendance Predictor & Simulator"
        meta={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
              Projected: {overallStats.predictedOverallPct}%
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100/85 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
              Target: {targetThreshold}%
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Target Threshold Picker */}
            <div className="flex items-center bg-gray-100/90 dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-xl p-1 shadow-2xs">
              {[75, 80, 85, 90].map((th) => (
                <button
                  key={th}
                  onClick={() => {
                    setTargetThreshold(th);
                    try {
                      const saved = localStorage.getItem("settings");
                      const parsed = saved ? JSON.parse(saved) : {};
                      parsed.targetAttendance = th;
                      localStorage.setItem("settings", JSON.stringify(parsed));
                    } catch {}
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    targetThreshold === th
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {th}%
                </button>
              ))}
            </div>

            {/* Reset All Button */}
            <button
              onClick={handleResetAll}
              title="Reset all simulated leaves and skips"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100/90 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-gray-200/80 dark:border-zinc-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Back Button if available */}
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Overall Projected Avg */}
        <div className="rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-4 shadow-2xs dark:border-gray-800/80 dark:bg-zinc-900/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider">
              Projected Avg
            </span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${
                Number(overallStats.predictedOverallPct) >= targetThreshold
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}>
                {overallStats.predictedOverallPct}%
              </span>
              <span className={`text-xs font-bold ${
                overallStats.isDeltaPositive ? "text-emerald-500" : "text-rose-500"
              }`}>
                {overallStats.isDeltaPositive ? `+${overallStats.deltaOverall}%` : `${overallStats.deltaOverall}%`}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium truncate">
              Current: {overallStats.currentOverallPct}%
            </p>
          </div>
        </div>

        {/* Card 2: Safe Bunk Buffer */}
        <div className="rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-4 shadow-2xs dark:border-gray-800/80 dark:bg-zinc-900/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider">
              Total Safe Leaves
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {overallStats.totalSafeBunksAcrossCourses}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">classes</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
              {overallStats.safeCount} of {overallStats.totalCourses} courses safe
            </p>
          </div>
        </div>

        {/* Card 3: At Risk Courses */}
        <div className="rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-4 shadow-2xs dark:border-gray-800/80 dark:bg-zinc-900/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider">
              Courses At Risk
            </span>
            <ShieldAlert className={`w-4 h-4 ${overallStats.atRiskCount > 0 ? "text-rose-500" : "text-emerald-500"}`} />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black ${
                overallStats.atRiskCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {overallStats.atRiskCount}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">below {targetThreshold}%</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium truncate">
              {overallStats.atRiskCount === 0 ? "All courses compliant 🎉" : "Requires attention"}
            </p>
          </div>
        </div>

        {/* Card 4: Remaining Milestone Timeline */}
        <div className="rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-4 shadow-2xs dark:border-gray-800/80 dark:bg-zinc-900/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider">
              Remaining Days
            </span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {totalRemainingWorkingDays}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">working days</span>
            </div>
            <p className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
              Mode: {mode === "LID" ? "Till Last Day" : `Till ${mode}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── MILESTONE SELECTOR STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 dark:bg-zinc-900/40 p-3 rounded-2xl border border-gray-200/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {milestoneOptions.map((opt) => (
            <button
              key={opt.id}
              disabled={!opt.available}
              onClick={() => setMode(opt.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === opt.id
                  ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                  : opt.available
                    ? "bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    : "opacity-40 cursor-not-allowed bg-transparent text-gray-400"
              }`}
            >
              {opt.label}
              {opt.date && (
                <span className="ml-1.5 opacity-80 text-[10px] font-normal">
                  ({opt.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick Batch Simulation Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAttendAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Attend All</span>
          </button>
          <button
            onClick={handleBunkFridays}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-black transition-colors cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Bunk Fridays</span>
          </button>
        </div>
      </div>

      {/* ── INTERACTIVE CALENDAR SIMULATOR SECTION ── */}
      <div className="rounded-3xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-5 shadow-sm dark:border-gray-800/80 dark:bg-zinc-900/60 space-y-4">
        {/* Calendar Header & Month Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>Interactive Day Simulator ({currentMonth})</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mt-0.5">
              Tap any date to toggle: <strong>Present</strong> → <strong>Absent (Bunk)</strong> → <strong>Off (Holiday)</strong>
            </p>
          </div>

          {/* Month Switcher Controls */}
          {monthsAvailable.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={monthIdx === 0}
                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                className="p-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-gray-800 dark:text-gray-200 min-w-[100px] text-center font-outfit">
                {currentMonth}
              </span>
              <button
                disabled={monthIdx >= monthsAvailable.length - 1}
                onClick={() => setMonthIdx((i) => Math.min(monthsAvailable.length - 1, i + 1))}
                className="p-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Working Days Grid for the selected month */}
        {visibleMonthDays.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold text-gray-400 dark:text-zinc-500">
            No working days scheduled in {currentMonth} for the selected milestone.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-8 gap-2">
            {visibleMonthDays.map((d, i) => {
              const time = d.date.getTime();
              const state =
                dateStates[time] !== undefined
                  ? dateStates[time]
                  : attendanceLockDates.has(time)
                    ? 2
                    : 0;

              const isToday = d.date.toDateString() === today.toDateString();
              const dateNumber = d.date.getDate();
              const shortWeekday = d.weekday?.slice(0, 3).toUpperCase() || d.date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

              // Count classes scheduled on this day
              const dayCards = dayCardsMap[shortWeekday] || [];
              const classCount = dayCards.length;

              return (
                <div
                  key={time || i}
                  onClick={() => toggleDayState(d.date)}
                  className={`group relative flex flex-col items-center justify-between p-2.5 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    state === 1
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm scale-[1.02]"
                      : state === 2
                        ? "bg-gray-200/80 dark:bg-zinc-800/80 text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-zinc-700 opacity-60"
                        : isToday
                          ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                          : "bg-white dark:bg-zinc-950 text-gray-800 dark:text-zinc-100 border-gray-200/80 dark:border-zinc-800/90 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs"
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
                    {shortWeekday}
                  </span>
                  <span className="text-base sm:text-lg font-black my-0.5">
                    {dateNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      state === 1
                        ? "bg-rose-600 text-white"
                        : state === 2
                          ? "bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300"
                          : isToday
                            ? "bg-blue-700 text-white"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                    }`}>
                      {state === 1 ? "Absent" : state === 2 ? "Off" : `${classCount} cl`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] font-bold text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-600" />
            <span>Present / Attending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-500" />
            <span>Absent / Bunked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-300 dark:bg-zinc-700" />
            <span>Off / Excluded</span>
          </div>
        </div>
      </div>

      {/* ── COURSE SIMULATION BREAKDOWN ── */}
      <div className="space-y-4 pt-2">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search courses by code, title, or faculty..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 text-xs sm:text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
            {[
              { id: "all", label: "All" },
              { id: "safe", label: `Safe (≥${targetThreshold}%)` },
              { id: "risk", label: `At Risk (<${targetThreshold}%)` },
              { id: "theory", label: "Theory" },
              { id: "lab", label: "Lab" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  filterType === tab.id
                    ? "bg-blue-600 text-white shadow-xs scale-105"
                    : "bg-gray-100/90 dark:bg-zinc-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200/70 dark:border-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Course Cards Grid */}
        {filteredCourses.length === 0 ? (
          <div className="rounded-3xl border border-gray-200/60 bg-white/60 dark:border-gray-800/60 dark:bg-zinc-900/40 p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-gray-300 dark:text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">No courses match your filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCourses.map((course) => {
              const isSafe = course.predictedPct >= targetThreshold;
              const isClose = isSafe && course.predictedPct < targetThreshold + 4;
              const formattedPredPct = decimalValues ? course.predictedPct.toFixed(2) : course.predictedPct.toFixed(1);
              const formattedCurrPct = decimalValues ? course.currentPct.toFixed(2) : course.currentPct.toFixed(1);

              return (
                <div
                  key={course.courseCode}
                  className="rounded-3xl border border-gray-200/70 bg-white/70 backdrop-blur-xl p-5 shadow-sm dark:border-gray-800/80 dark:bg-zinc-900/60 space-y-4 hover:border-blue-500/30 transition-all flex flex-col justify-between"
                >
                  {/* Top: Code, Title & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {course.courseCode}
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate font-outfit mt-0.5">
                          {course.courseTitle}
                        </h4>
                      </div>

                      {/* Health Status Badge */}
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                        !isSafe
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : isClose
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}>
                        {!isSafe ? "At Risk" : isClose ? "Caution" : "Safe"}
                      </span>
                    </div>

                    {/* Metadata strip */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-bold text-gray-500 dark:text-zinc-400">
                      <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        {course.isLab ? "Lab Course (2 hrs)" : "Theory Course"}
                      </span>
                      {course.slotName && (
                        <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          Slot: {course.slotName}
                        </span>
                      )}
                      {course.meetingDays?.length > 0 && (
                        <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md">
                          {course.meetingDays.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Attendance Comparison & Progress */}
                  <div className="space-y-3 pt-1">
                    {/* Live Stats Row */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-gray-50/80 dark:bg-zinc-950/60 border border-gray-100 dark:border-zinc-800/80">
                      {/* Current */}
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block">
                          Current
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black text-gray-700 dark:text-zinc-300">
                            {formattedCurrPct}%
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            ({course.currentAttended}/{course.currentTotal})
                          </span>
                        </div>
                      </div>

                      {/* Projected */}
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block">
                          Simulated
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className={`text-base font-black ${
                            isSafe ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}>
                            {formattedPredPct}%
                          </span>
                          <span className={`text-[10px] font-bold ${
                            course.deltaPct >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}>
                            ({course.deltaPct >= 0 ? `+${course.deltaPct.toFixed(1)}%` : `${course.deltaPct.toFixed(1)}%`})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dual Layer Progress Bar with Target Marker */}
                    <div className="relative pt-1">
                      <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                        {/* Target Threshold Marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-zinc-500 z-10"
                          style={{ left: `${targetThreshold}%` }}
                          title={`Target: ${targetThreshold}%`}
                        />
                        {/* Projected Fill */}
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isSafe ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(Math.max(course.predictedPct, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Margin Callout & Single Course Skip Stepper */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800/80">
                    {/* Bunk / Catchup Intelligence */}
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      {isSafe ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Can miss <strong>{course.safeBunks}</strong> {course.safeBunks === 1 ? "class" : "classes"}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Need <strong>{course.classesNeeded}</strong> {course.classesNeeded === 1 ? "class" : "classes"}</span>
                        </span>
                      )}
                    </div>

                    {/* Single Course Custom Skip Stepper */}
                    <div className="flex items-center gap-1 bg-gray-100/90 dark:bg-zinc-800 px-2 py-1 rounded-xl">
                      <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 mr-1">
                        Skips:
                      </span>
                      <button
                        onClick={() => {
                          setCourseManualSkips((prev) => ({
                            ...prev,
                            [course.courseCode]: Math.max(0, (prev[course.courseCode] || 0) - 1),
                          }));
                        }}
                        className="w-5 h-5 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black text-gray-900 dark:text-white px-1.5">
                        {course.manualSkips}
                      </span>
                      <button
                        onClick={() => {
                          setCourseManualSkips((prev) => ({
                            ...prev,
                            [course.courseCode]: (prev[course.courseCode] || 0) + 1,
                          }));
                        }}
                        className="w-5 h-5 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SMART ATTENDANCE ADVISOR & EXAM LOCK RULES ── */}
      <div className="rounded-3xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 font-outfit">
            Smart Attendance Insights & Exam Guidelines
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-blue-800/90 dark:text-blue-300 font-medium">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong>Exam Freeze Rule:</strong> For CAT-1 and CAT-2, attendance is frozen on Thursday and Friday directly preceding the exam start date.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong>Lab Session Weight:</strong> Each scheduled lab session accounts for 2 continuous hours, meaning 1 lab absence is equal to 2 missed classes.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong>Target Safety:</strong> Keeping attendance at or above {targetThreshold}% ensures full eligibility for CAT examinations and FAT hall tickets.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong>Real-Time Simulation:</strong> All date toggles and skip steppers simulate your projected percentages instantly without modifying actual portal records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Count future scheduled working days for a specific course
function countFutureClassesForCourse(
  courseCode: string,
  dayCardsMap: Record<string, any[]>,
  allWorkingDays: CalendarDay[],
  dateStates: Record<number, number>,
  cutoffDate: Date | null,
  attendanceLockDates?: Set<number>
) {
  if (!courseCode || !dayCardsMap || !Array.isArray(allWorkingDays))
    return { futureCount: 0, meetingDays: [] };

  const normalizeDay = (d: string) => d.slice(0, 3).toUpperCase();

  const subjectDays = Object.keys(dayCardsMap).filter((day) =>
    dayCardsMap[day]?.some((c) => c.courseCode === courseCode)
  );
  if (subjectDays.length === 0)
    return { futureCount: 0, meetingDays: [] };

  const subjectDaysShort = subjectDays.map(normalizeDay);

  const dayOrderMap: Record<string, string> = {
    monday: "MON",
    tuesday: "TUE",
    wednesday: "WED",
    thursday: "THU",
    friday: "FRI",
  };

  const ymd = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
  };

  const effectiveMap = new Map<string, string>();
  for (const d of allWorkingDays) {
    if (!d?.date) continue;
    let effectiveDay = normalizeDay(d.weekday || "");
    if (effectiveDay === "SAT" && Array.isArray(d.events) && d.events.length > 0) {
      const found = d.events.find((ev) =>
        /(monday|tuesday|wednesday|thursday|friday)/i.test(ev.text || ev.category || "")
      );
      if (found) {
        const match = (found.text || found.category || "").match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
        );
        if (match && match[1]) {
          const mapped = dayOrderMap[match[1].toLowerCase()];
          if (mapped) effectiveDay = mapped;
        }
      }
    }
    effectiveMap.set(ymd(d.date), effectiveDay);
  }

  const remainingWorkingDays = allWorkingDays.filter((d) => {
    if (!d || !d.date || isNaN(d.date.getTime?.())) return false;
    if (cutoffDate && d.date > cutoffDate) return false;

    const time = d.date.getTime();
    const effectiveState =
      dateStates[time] !== undefined
        ? dateStates[time]
        : attendanceLockDates?.has(time)
          ? 2
          : 0;

    const eff = effectiveMap.get(ymd(d.date)) || normalizeDay(d.weekday || "");
    return subjectDaysShort.includes(eff) && effectiveState !== 2;
  });

  return {
    futureCount: remainingWorkingDays.length,
    meetingDays: subjectDaysShort,
  };
}

// Helper: Count missed days for a specific course
function countMissedClassesForCourse(
  courseCode: string,
  dayCardsMap: Record<string, any[]>,
  dateStates: Record<number, number>,
  allWorkingDays: CalendarDay[],
  cutoffDate: Date | null,
  attendanceLockDates?: Set<number>
) {
  if (!courseCode || !dayCardsMap || typeof dateStates !== "object") return 0;

  const normalizeDay = (d: string) => d.slice(0, 3).toUpperCase();

  const subjectDays = Object.keys(dayCardsMap).filter((day) =>
    dayCardsMap[day]?.some((c) => c.courseCode === courseCode)
  );
  if (subjectDays.length === 0) return 0;

  const subjectDaysShort = subjectDays.map(normalizeDay);
  const dayOrderMap: Record<string, string> = {
    monday: "MON",
    tuesday: "TUE",
    wednesday: "WED",
    thursday: "THU",
    friday: "FRI",
  };

  const ymd = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
  };

  const effectiveMap = new Map<string, string>();
  for (const d of allWorkingDays) {
    if (!d?.date) continue;
    let effectiveDay = normalizeDay(d.weekday || "");
    if (effectiveDay === "SAT" && Array.isArray(d.events) && d.events.length > 0) {
      const found = d.events.find((ev) =>
        /(monday|tuesday|wednesday|thursday|friday)/i.test(ev.text || ev.category || "")
      );
      if (found) {
        const match = (found.text || found.category || "").match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
        );
        if (match && match[1]) {
          const mapped = dayOrderMap[match[1].toLowerCase()];
          if (mapped) effectiveDay = mapped;
        }
      }
    }
    effectiveMap.set(ymd(d.date), effectiveDay);
  }

  let missed = 0;

  for (const [timestamp, state] of Object.entries(dateStates)) {
    const s = new Date(parseInt(timestamp));
    if (cutoffDate && s > cutoffDate) continue;

    const time = s.getTime();
    const effectiveState =
      dateStates[time] !== undefined
        ? dateStates[time]
        : attendanceLockDates?.has(time)
          ? 2
          : 0;

    const key = ymd(s);
    const eff = effectiveMap.get(key);
    if (!eff) continue;

    if (effectiveState === 1 && subjectDaysShort.includes(eff)) {
      missed++;
    }
  }
  return missed;
}
