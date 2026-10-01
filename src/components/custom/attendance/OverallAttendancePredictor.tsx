"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChipTabs,
  EmptyPanel,
  GhostButton,
  InsightCarousel,
  KeyValue,
  ListShell,
  PageShell,
  SectionHeader,
  SegmentedControl,
  StatTile,
  SubpageScreen,
  ToneBadge,
  useCarousel,
  useSubpageStack,
  type InsightSlide,
} from "../shared/primitives";
import { SEARCH_FIELD, TILE_CARD } from "@/lib/uiTokens";
import {
  buildEffectiveDayMap,
  courseCeiling,
  courseLockDate,
  courseMeetingDates,
  dayKey,
  formatPct,
  gridCeiling,
  isLabCourse,
  isProjectableCourse,
  lockDateFor,
  projectCourse,
  skipCountFor,
  skipSetFor,
  summarise,
  toggleCourseSkip,
  CAT_LOCK_OFFSET_DAYS,
  type CourseDateSkips,
  type DayStates,
  type SimulationMode,
} from "@/lib/attendancePredictor";
import {
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
  FlaskConical,
  Snowflake,
  Zap,
} from "lucide-react";

/** The four attendance targets the picker offers, and their option values. */
const THRESHOLD_OPTIONS = [75, 80, 85, 90] as const;
type TargetThresholdOption = `${(typeof THRESHOLD_OPTIONS)[number]}`;

type FilterType = "all" | "safe" | "risk" | "theory" | "lab";

/** Midnight today, for the milestone countdowns. */
function startOfToday(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** `5 Aug`, the form a milestone date reads well in. */
function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** One course row: the raw attendance record plus its projection. */
type Prediction = any & {
  currentAttended: number;
  currentTotal: number;
  currentPct: number;
  futureClasses: number;
  missedClasses: number;
  predictedAttended: number;
  predictedTotal: number;
  predictedPct: number;
  deltaPct: number;
  safeBunks: number;
  classesNeeded: number;
  isLab: boolean;
  meetingDays: string[];
  skippedCount: number;
  locked: boolean;
  lockDate: Date | null;
  ceiling: Date | null;
};

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
  /**
   * The course whose date skipper is expanded.
   *
   * One at a time, and it expands *in place* rather than navigating: the menu
   * rows are the "Course sections" pattern from the course subpage overview, and
   * a row that swapped the page out from under itself would lose the reader's
   * place in the list.
   */
  const [openSubject, setOpenSubject] = useState<Prediction | null>(null);

  // Target threshold state (default from localStorage or bus status)
  const [targetThreshold, setTargetThreshold] = useState<number>(() => {    if (typeof window !== "undefined") {
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
  const [mode, setMode] = useState<SimulationMode>(() => {
    const now = new Date();
    if (impDates.cat1Date && impDates.cat1Date > now) return "CAT1";
    if (impDates.cat2Date && impDates.cat2Date > now) return "CAT2";
    return "LID";
  });

  // Date States: timestamp -> 0 (Attending), 1 (Absent / Bunked), 2 (Off / Holiday)
  const [dateStates, setDateStates] = useState<DayStates>({});
  /**
   * Dates skipped for one subject only, keyed `courseCode -> timestamp -> true`.
   *
   * Separate from `dateStates` on purpose: the global toggle says "I am away all
   * day", this says "I am away from *this* course on this date", which is the
   * situation that actually comes up - a placement interview costs you Data
   * Structures and nothing else on the timetable.
   */
  const [courseSkips, setCourseSkips] = useState<CourseDateSkips>({});
  // Active calendar month index
  const [monthIdx, setMonthIdx] = useState<number>(0);
  // Search and Filter
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<FilterType>("all");

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
      // VTOP sends the year inside the month string ("JULY 2026") and leaves
      // `year` undefined, so reading it off the string is the only thing that
      // survives a calendar fetched for a different year than the one we are in.
      const year =
        Number(monthStr.split(" ").pop()) || monthObj.year || new Date().getFullYear();
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

  /**
   * `dayKey -> the weekday students actually follow that date`.
   *
   * Built once here rather than inside each of the two counting helpers, which
   * between them rebuilt it four times over.
   */
  const effectiveDayMap = useMemo(() => buildEffectiveDayMap(allWorkingDays), [allWorkingDays]);

  /**
   * How far the shared month grid may page: the latest ceiling any course has.
   *
   * Each course still gets its own ceiling in the arithmetic below - lab stops
   * at LID Lab and theory at LID Theory - but one grid can only show one window.
   */
  const cutoffDate = useMemo(
    () => gridCeiling(mode, impDates),
    [mode, impDates]
  );

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

  /** Whole-day toggle: present -> absent -> off. */
  const toggleDayState = useCallback((date: Date) => {
    const time = date.getTime();
    setDateStates((prev) => {
      const nextState = ((prev[time] ?? 0) + 1) % 3;
      return { ...prev, [time]: nextState };
    });
  }, []);

  /** Skip or un-skip one date for one subject. */
  const toggleSubjectSkip = useCallback((courseCode: string, date: Date) => {
    const time = date.getTime();
    setCourseSkips((prev) => toggleCourseSkip(prev, courseCode, time));
  }, []);

  // Reset all simulation overrides
  const handleResetAll = useCallback(() => {
    setDateStates({});
    setCourseSkips({});
    setOpenSubject(null);
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
    setCourseSkips({});
  }, [allWorkingDays, cutoffDate, dateStates]);

  // Main Course-by-Course Attendance Predictions
  const predictions: Prediction[] = useMemo(() => {
    const validCourses = attendanceData.filter((c) => isProjectableCourse(c));

    return validCourses.map((c) => {
      const isLab = isLabCourse(c);
      const ceiling = courseCeiling(mode, isLab, impDates);
      const lockDate = courseLockDate(mode, isLab, impDates);

      const result = projectCourse({
        course: c,
        dayCardsMap,
        workingDays: allWorkingDays,
        effectiveMap: effectiveDayMap,
        dateStates,
        skips: skipSetFor(courseSkips, c.courseCode),
        ceiling,
        lockDate,
        threshold: targetThreshold,
      });

      return {
        ...c,
        currentAttended: result.attended,
        currentTotal: result.total,
        currentPct: result.currentPct,
        futureClasses: result.futureDays,
        missedClasses: result.missedDays,
        predictedAttended: result.predictedAttended,
        predictedTotal: result.predictedTotal,
        predictedPct: result.predictedPct,
        deltaPct: result.deltaPct,
        safeBunks: result.safeBunks,
        classesNeeded: result.classesNeeded,
        isLab: result.isLab,
        meetingDays: result.meetingDays,
        skippedCount: skipCountFor(courseSkips, c.courseCode),
        /** Whether this course's attendance is already frozen. */
        locked: Boolean(lockDate && lockDate <= today),
        lockDate,
        ceiling,
      };
    });
  }, [
    attendanceData,
    mode,
    impDates,
    allWorkingDays,
    effectiveDayMap,
    dayCardsMap,
    dateStates,
    courseSkips,
    targetThreshold,
    today,
  ]);

  const overallStats = useMemo(() => summarise(predictions, targetThreshold), [
    predictions,
    targetThreshold,
  ]);

  // Working days still ahead inside the selected window.
  const totalRemainingWorkingDays = useMemo(
    () => allWorkingDays.filter((d) => !cutoffDate || d.date <= cutoffDate).length,
    [allWorkingDays, cutoffDate]
  );

  /**
   * The course whose date skipper is expanded, re-read from `predictions` every
   * render so its percentage moves as dates are toggled rather than freezing at
   * the value it had when the row was tapped.
   */
  const activeSubject = useMemo(
    () =>
      openSubject
        ? predictions.find((p) => p.courseCode === openSubject.courseCode) ?? null
        : null,
    [openSubject, predictions]
  );
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

  // Milestone button options. The date shown is the last day attendance can
  // still move in that mode, which is three days before a CAT.
  const milestoneOptions = useMemo(() => {
    const now = new Date();
    return [
      {
        id: "CAT1" as SimulationMode,
        label: "Till CAT I",
        lockLabel: "3 days before CAT I",
        date: lockDateFor(impDates.cat1Date, CAT_LOCK_OFFSET_DAYS),
        available: !impDates.cat1Date || impDates.cat1Date > now,
      },
      {
        id: "CAT2" as SimulationMode,
        label: "Till CAT II",
        lockLabel: "3 days before CAT II",
        date: lockDateFor(impDates.cat2Date, CAT_LOCK_OFFSET_DAYS),
        available: !impDates.cat2Date || impDates.cat2Date > now,
      },
      {
        id: "LID" as SimulationMode,
        label: "Till LID",
        lockLabel: "Lab and theory lock separately",
        date: impDates.lidTheoryDate || impDates.lidLabDate,
        available: true,
      },
      {
        id: "ALL" as SimulationMode,
        label: "All Days",
        lockLabel: "Bounded by the last instructional day",
        date: null,
        available: true,
      },
    ];
  }, [impDates]);

  const activeMilestone = useMemo(
    () => milestoneOptions.find((o) => o.id === mode) ?? milestoneOptions[0],
    [milestoneOptions, mode]
  );

  /**
   * The rotating half of the summary row.
   *
   * The headline - projected average - is a single number and belongs in a
   * `StatTile`; these are a set worth rotating through, which is what
   * `InsightCarousel` is for. Same pairing as `FreeClassroomsTab`.
   */
  const summarySlides = useMemo<InsightSlide[]>(() => {
    const slides: InsightSlide[] = [
      {
        id: "safe",
        label: "Total Safe Leaves",
        value: overallStats.totalSafeBunks,
        sub: `${overallStats.safeCount} of ${overallStats.totalCourses} courses safe`,
        badge: "classes",
        tone: "emerald",
        dotLabel: "Total safe leaves",
      },
      {
        id: "risk",
        label: "Courses At Risk",
        value: overallStats.atRiskCount,
        sub:
          overallStats.atRiskCount === 0
            ? "All courses compliant"
            : `Below ${targetThreshold}%`,
        badge: `under ${targetThreshold}%`,
        tone: overallStats.atRiskCount > 0 ? "red" : "emerald",
        dotLabel: "Courses at risk",
      },
      {
        id: "remaining",
        label: "Remaining Days",
        value: totalRemainingWorkingDays,
        sub: activeMilestone.lockLabel,
        badge: "working days",
        tone: "indigo",
        dotLabel: "Remaining working days",
      },
    ];

    // One slide per milestone that has a real date, so the countdown to the next
    // thing that changes a number is on the tile rather than buried in a chip.
    for (const opt of milestoneOptions) {
      if (!opt.date) continue;
      const days = Math.ceil((startOfToday(opt.date) - startOfToday(new Date())) / 86_400_000);
      slides.push({
        id: `milestone-${opt.id}`,
        label: opt.label,
        value: days > 0 ? `${days}d` : "now",
        sub:
          days > 0
            ? `Attendance locks ${formatShortDate(opt.date)}`
            : `Locked ${formatShortDate(opt.date)}`,
        badge: "milestone",
        tone: days > 0 ? (days <= 7 ? "amber" : "indigo") : "zinc",
        dotLabel: `${opt.label} countdown`,
      });
    }
    return slides;
  }, [
    overallStats,
    totalRemainingWorkingDays,
    activeMilestone,
    milestoneOptions,
    targetThreshold,
  ]);

  const lockedNow = predictions.filter((p) => p.locked).length;
  const carousel = useCarousel(summarySlides.length);

  return (
    <PageShell
      eyebrow="Attendance · Predictor"
      title="Attendance Predictor & Simulator"
      subtitle={`Projected ${formatPct(overallStats.predictedPct, decimalValues)}% · target ${targetThreshold}%`}
      onBack={onBack}
      actions={
        <>
          {/* Target Threshold Picker */}
          <SegmentedControl
            options={THRESHOLD_OPTIONS.map((th) => ({
              value: String(th) as TargetThresholdOption,
              label: `${th}%`,
            }))}
            value={String(targetThreshold) as TargetThresholdOption}
            onChange={(next) => {
              const th = Number(next);
              setTargetThreshold(th);
              try {
                const saved = localStorage.getItem("settings");
                const parsed = saved ? JSON.parse(saved) : {};
                parsed.targetAttendance = th;
                localStorage.setItem("settings", JSON.stringify(parsed));
              } catch {}
            }}
          />
          <GhostButton onClick={handleResetAll} title="Reset all simulated leaves and skips">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </GhostButton>
        </>
      }
    >
      {/* ── SUMMARY: one stat card and one auto carousel, side by side ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          height="h-32 sm:h-36"
          label="Projected Avg"
          icon={<Sparkles className="w-4 h-4 text-sky-500" />}
          tone={overallStats.predictedPct >= targetThreshold ? "emerald" : "red"}
          value={`${formatPct(overallStats.predictedPct, decimalValues)}%`}
          sub={`Now ${formatPct(overallStats.currentPct, decimalValues)}%`}
          badge={
            overallStats.delta >= 0
              ? `+${formatPct(overallStats.delta, decimalValues)}`
              : formatPct(overallStats.delta, decimalValues)
          }
        />
        <InsightCarousel
          slides={summarySlides}
          carousel={carousel}
          height="h-32 sm:h-36"
          interactiveDots
          ariaLabel="Attendance summary"
        />
      </div>

      {/* The lock the reader is currently projecting against, spelled out. */}
      <p className="px-1 -mt-1 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
        <Snowflake className="h-3.5 w-3.5 shrink-0 mt-px" />
        <span>
          {mode === "CAT1" || mode === "CAT2" ? (
            <>
              Attendance freezes <strong>{CAT_LOCK_OFFSET_DAYS} days before</strong>{" "}
              {mode === "CAT1" ? "CAT I" : "CAT II"}
              {activeMilestone.date ? <> — {formatShortDate(activeMilestone.date)}</> : null}. Classes
              from that day on are not counted.
            </>
          ) : mode === "LID" || mode === "ALL" ? (
            <>
              Lab attendance locks at LID — Lab
              {impDates.lidLabDate ? <> ({formatShortDate(impDates.lidLabDate)})</> : null}; theory at
              LID — Theory
              {impDates.lidTheoryDate ? <> ({formatShortDate(impDates.lidTheoryDate)})</> : null}.
              {lockedNow > 0 ? ` ${lockedNow} course${lockedNow === 1 ? " is" : "s are"} already frozen.` : null}
            </>
          ) : (
            <>Every scheduled working day is projected.</>
          )}
        </span>
      </p>

      {/* ── MILESTONE SELECTOR STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipTabs
          options={milestoneOptions.map((opt) => ({
            value: opt.id,
            label: (
              <>
                {opt.label}
                {opt.date ? (
                  <span className="ml-1.5 opacity-80 text-[10px] font-normal">
                    ({opt.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                  </span>
                ) : null}
              </>
            ),
            title: opt.available ? `Simulate up to ${opt.label}` : `${opt.label} (no data)`,
          }))}
          value={mode}
          onChange={(next) => {
            if (next === mode) return;
            const opt = milestoneOptions.find((o) => o.id === next);
            if (opt?.available) setMode(next);
          }}
        />

        {/* Quick Batch Simulation Actions */}
        <div className="flex items-center gap-2">
          <ToneBadge tone="emerald" size="lg" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            <button type="button" onClick={handleAttendAll} className="cursor-pointer">
              Attend All
            </button>
          </ToneBadge>
          <ToneBadge tone="amber" size="lg" icon={<Flame className="w-3.5 h-3.5" />}>
            <button type="button" onClick={handleBunkFridays} className="cursor-pointer">
              Bunk Fridays
            </button>
          </ToneBadge>
        </div>
      </div>

      {/* ── INTERACTIVE CALENDAR SIMULATOR SECTION ── */}
      <div className={`${TILE_CARD} p-5 space-y-4`}>
        {/* Calendar Header & Month Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-muted dark:border-border">
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>Interactive Day Simulator ({currentMonth})</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mt-0.5">
              Whole day, every subject: <strong>Present</strong> → <strong>Absent (Bunk)</strong> →{" "}
              <strong>Off (Holiday)</strong>. To miss one subject only, open it from the list below.
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
              const state = dateStates[time] ?? 0;

              const isToday = d.date.toDateString() === today.toDateString();
              const dateNumber = d.date.getDate();
              const shortWeekday = d.weekday?.slice(0, 3).toUpperCase() || d.date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

              // Classes scheduled that weekday. A published day order means the
              // real weekday's cards apply, which the raw weekday lookup misses.
              const effWeekday = effectiveDayMap.get(dayKey(d.date)) || shortWeekday;
              const dayCards = dayCardsMap[effWeekday] || [];
              const classCount = dayCards.length;

              return (
                <div
                  key={time || i}
                  onClick={() => toggleDayState(d.date)}
                  aria-pressed={state === 1}
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
              className={`${SEARCH_FIELD} pl-9 pr-4 text-xs sm:text-sm shadow-2xs focus:ring-2 focus:ring-sky-500`}
            />
          </div>

          {/* Filter Pills */}
          <ChipTabs
            options={[
              { value: "all" as FilterType, label: "All" },
              { value: "safe", label: `Safe (≥${targetThreshold}%)` },
              { value: "risk", label: `At Risk (<${targetThreshold}%)` },
              { value: "theory", label: "Theory" },
              { value: "lab", label: "Lab" },
            ]}
            value={filterType}
            onChange={setFilterType}
          />
        </div>

        {/* Course menu: one row per subject, each opening its own date skipper. */}
        {filteredCourses.length === 0 ? (
          <EmptyPanel
            icon={<BookOpen className="w-7 h-7" />}
            title="No courses match your filter"
            description="Try a different filter, or clear the search."
            variant="dashed"
          />
        ) : (
          <ListShell>
            {filteredCourses.map((course) => {
              const isSafe = course.predictedPct >= targetThreshold;
              const isClose = isSafe && course.predictedPct < targetThreshold + 4;
              const expanded = openSubject?.courseCode === course.courseCode;
              const dates = expanded
                ? courseMeetingDates(
                    course.courseCode,
                    dayCardsMap,
                    allWorkingDays,
                    effectiveDayMap,
                    course.ceiling,
                    course.lockDate
                  )
                : [];
              const skips = skipSetFor(courseSkips, course.courseCode);

              return (
                <div key={course.courseCode} className={expanded ? "bg-zinc-50/60 dark:bg-zinc-800/25" : ""}>
                  {/* The menu item itself, mirroring "Course sections" in the
                      course subpage overview: tile, title, value, chevron. */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSubject(expanded ? null : course)
                    }
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Hide" : "Choose dates to skip for"} ${course.courseCode}`}
                    className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                        course.locked
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200/60 dark:border-zinc-700/60"
                          : isSafe
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : isClose
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {course.isLab ? <FlaskConical className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight flex items-center gap-1.5">
                        <span className="font-mono text-[11px] uppercase text-zinc-500 dark:text-zinc-400">
                          {course.courseCode}
                        </span>
                        {course.skippedCount > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            {course.skippedCount} skip{course.skippedCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {course.locked && (
                          <Snowflake className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" aria-label="Attendance locked" />
                        )}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                        {course.slotName ? `${course.slotName} · ` : ""}
                        {course.meetingDays?.join(", ") || "No timetable"} · now{" "}
                        {formatPct(course.currentPct, decimalValues)}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-base font-black font-outfit tracking-tight leading-none ${
                          course.locked
                            ? "text-zinc-400 dark:text-zinc-500"
                            : isSafe
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatPct(course.predictedPct, decimalValues)}%
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                      />
                    </div>
                  </button>

                  {/* The dropdown: this subject's dates, revealed in place. */}
                  {expanded && (
                    <div className="px-4 pb-4 -mt-1">
                      {course.locked ? (
                        <p className="flex items-start gap-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 p-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                          <Snowflake className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>
                            Attendance is frozen
                            {course.lockDate ? <> as of {formatShortDate(course.lockDate)}</> : null}
                            {course.isLab ? " for lab" : " for theory"}, so there is nothing left to skip.
                          </span>
                        </p>
                      ) : dates.length === 0 ? (
                        <EmptyPanel
                          variant="dashed"
                          title="No classes left to project"
                          description="Every scheduled class for this course is in the past, or its attendance is already locked."
                        />
                      ) : (
                        <>
                          <p className="px-1 pb-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                            {course.isLab
                              ? "A lab session counts as two hours, so skipping one costs two classes."
                              : "Skipped dates count as absent for this subject only — nothing else on the timetable moves."}
                          </p>
                          <ListShell>
                            {dates.map((date) => {
                              const time = date.getTime();
                              const skipped = skips.has(time);
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => toggleSubjectSkip(course.courseCode, date)}
                                  aria-pressed={skipped}
                                  className="w-full py-2 px-3 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 active:bg-zinc-200/70 dark:active:bg-zinc-800"
                                >
                                  <span
                                    className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl border ${
                                      skipped
                                        ? "border-amber-500/40 bg-amber-500 text-white"
                                        : "border-border-muted bg-surface-secondary"
                                    }`}
                                  >
                                    <span className="text-[9px] font-black uppercase leading-none opacity-80">
                                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                                    </span>
                                    <span className="text-sm font-black font-outfit leading-tight">
                                      {date.getDate()}
                                    </span>
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-text-heading dark:text-text-heading">
                                      {date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                                    </span>
                                    <span className="block text-[11px] font-medium text-text-muted dark:text-text-muted">
                                      {skipped
                                        ? `Will be marked absent${course.isLab ? " (2 hrs)" : ""}`
                                        : "Scheduled class"}
                                    </span>
                                  </span>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                      skipped
                                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                    }`}
                                  >
                                    {skipped ? "Skipped" : "Skip"}
                                  </span>
                                </button>
                              );
                            })}
                          </ListShell>
                          {course.skippedCount > 0 && (
                            <div className="pt-2">
                              <GhostButton
                                onClick={() =>
                                  setCourseSkips((prev) => ({
                                    ...prev,
                                    [course.courseCode]: {},
                                  }))
                                }
                                title="Clear every skipped date for this subject"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Clear {course.skippedCount} skipped date
                                {course.skippedCount === 1 ? "" : "s"}
                              </GhostButton>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </ListShell>
        )}
      </div>

      {/* ── SMART ATTENDANCE ADVISOR & EXAM LOCK RULES ── */}
        <div className={`${TILE_CARD} p-5 space-y-3 border-sky-500/20`}>
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
              <strong>Exam Freeze Rule:</strong> Attendance freezes three days before CAT I and CAT II, so classes from that day onward are no longer counted.
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
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
              <p>
                <strong>Real-Time Simulation:</strong> Whole-day toggles and per-subject skipped
                dates simulate your projected percentages instantly without modifying actual
                portal records.
              </p>
            </div>
          </div>
        </div>
    </PageShell>
  );
}
