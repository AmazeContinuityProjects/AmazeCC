import { useState, useMemo } from "react";
import { getDay } from "date-fns";
import { AnimatePresence, m } from "framer-motion";
import { CheckCircle2, FileText } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { clickable } from "@/lib/a11y";
import { DAY_LABELS, DAY_ORDER } from "@/lib/generated/timetable";
import type { CourseAttendanceHistoryEntry } from "@/types/course";

/**
 * One memoised lookup for a calendar cell's status fill. `statusTint` is called
 * for every cell of every month and every re-render, so the branch chain is
 * resolved once per (variant, tracker mode, status) and cached. The helpers
 * themselves live at module scope rather than being rebuilt inside the render.
 *
 * The dots carry only hue now — the old `shadow-[0_0_…]` neon glow was a second,
 * decorative signal on top of the tint, and shape + the screen-reader status
 * already say the same thing without it.
 */
type StatusFill = { bg: string; dot: string };
const FILL_CACHE = new Map<string, StatusFill>();

function statusFill(status: string | undefined, isODTracker: boolean, wide: boolean): StatusFill {
  const key = `${wide ? "wide" : "compact"}|${isODTracker ? "od" : "std"}|${status ?? ""}`;
  const cached = FILL_CACHE.get(key);
  if (cached) return cached;

  const fill: StatusFill = { bg: "", dot: "" };
  const set = (bg: string, dot: string) => {
    fill.bg = bg;
    fill.dot = dot;
  };

  if (wide) {
    if (isODTracker) {
      if (status === "valid od") set("bg-emerald-50/50  dark:bg-emerald-500/10", "bg-emerald-500");
      else if (status === "wasted od") set("bg-red-50/50  dark:bg-red-500/10", "bg-red-500");
      else if (status === "partial wasted od") set("bg-amber-50/50  dark:bg-amber-500/10", "bg-amber-500");
    } else {
      if (status === "present") set("bg-emerald-50/50  dark:bg-emerald-500/10", "bg-emerald-500");
      else if (status === "absent") set("bg-red-50/50  dark:bg-red-500/10", "bg-red-500");
      else if (status === "on duty" || status === "partial od")
        set("bg-yellow-50/50  dark:bg-amber-500/10", "bg-yellow-500");
      else if (status && status.includes("half-day")) set("bg-orange-50/50  dark:bg-orange-500/10", "bg-orange-500");
      else if (status === "partially absent") set("bg-rose-50/50  dark:bg-rose-500/10", "bg-rose-500");
    }
  } else if (isODTracker) {
    if (status === "valid od") set("bg-emerald-500/15 dark:bg-emerald-500/15", "bg-emerald-500");
    else if (status === "wasted od") set("bg-red-500/15 dark:bg-red-500/15", "bg-red-500");
    else if (status === "partial wasted od") set("bg-amber-500/15 dark:bg-amber-500/15", "bg-amber-500");
  } else {
    if (status === "present") set("bg-emerald-500/15 dark:bg-emerald-500/15", "bg-emerald-500");
    else if (status === "absent") set("bg-red-500/15 dark:bg-red-500/15", "bg-red-500");
    else if (status === "on duty" || status === "partial od")
      set("bg-amber-500/15 dark:bg-amber-500/15", "bg-amber-500");
    else if (status && status.includes("half-day")) set("bg-orange-500/15 dark:bg-orange-500/15", "bg-orange-500");
    else if (status === "partially absent") set("bg-rose-500/15 dark:bg-rose-500/15", "bg-rose-500");
  }

  FILL_CACHE.set(key, fill);
  return fill;
}

/** Compact-mode tint; named alias so the call site reads clearly. */
const statusTint = (status: string | undefined, isODTracker: boolean): StatusFill =>
  statusFill(status, isODTracker, false);

/** Present: dot. Absent: diamond. On duty: square. Partial or half-day: short bar. */
function dotShape(status: string | undefined): string {
  if (!status) return "w-1.5 h-1.5 rounded-full";
  if (status === "absent" || status === "wasted od") return "w-1.5 h-1.5 rotate-45 rounded-[1px]";
  if (status === "on duty" || status === "partial od" || status === "valid od") return "w-1.5 h-1.5 rounded-[1px]";
  if (status.includes("partial") || status.includes("half-day")) return "w-2.5 h-1 rounded-full";
  return "w-1.5 h-1.5 rounded-full";
}

export interface AttendanceCalendarViewProps {
  analyzeCalendars?: any[];
  historyList: (CourseAttendanceHistoryEntry | any)[];
  notesTracker?: Record<string, Record<string, boolean>>;
  toggleNotes?: (...args: any[]) => void;
  courseCode?: string;
  isOverall?: boolean;
  toggleIndividualNote?: (...args: any[]) => void;
  isODTracker?: boolean;
  compact?: boolean;
}

export default function AttendanceCalendarView({
  analyzeCalendars,
  historyList,
  notesTracker,
  toggleNotes,
  courseCode,
  isOverall,
  toggleIndividualNote,
  isODTracker = false,
  compact = false,
}: AttendanceCalendarViewProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedOverallDate, setSelectedOverallDate] = useState(null);

  const safeCalendars = useMemo(() => {
    if (!analyzeCalendars || !Array.isArray(analyzeCalendars)) return [];
    return analyzeCalendars;
  }, [analyzeCalendars]);

  const activeMonth = safeCalendars[activeIdx];
  // Mon-first weekday headers from the canonical day order/labels.
  const weekdays = DAY_ORDER.map((d) => DAY_LABELS[d].slice(0, 3));

  const monthData = useMemo(() => {
    if (!activeMonth) return null;

    const monthStr = activeMonth.month?.toLowerCase() || "";
    const mIndex = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].findIndex((m) => monthStr.includes(m));
    const year = activeMonth.year || new Date().getFullYear();

    if (mIndex === -1) return null;

    const firstDayOfMonth = new Date(year, mIndex, 1);
    let firstDay = getDay(firstDayOfMonth); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Adjust for Mon-Sun week
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const blanksCount = firstDay;
    const blanks = Array.from({ length: blanksCount }, (_, i) => i);

    // We use activeMonth.days to render exactly the days available, or generate standard days
    // Assuming activeMonth.days is an array of { date: number, type: string, events: [] }
    const daysInMonth = activeMonth.days || [];

    // Let's create a map for history dates
    const historyMap = {};
    historyList.forEach((d) => {
      const dateObj = new Date(d.date);
      if (dateObj.getFullYear() === year && dateObj.getMonth() === mIndex) {
        historyMap[dateObj.getDate()] = {
          status: isOverall ? d.overallStatus : d.status.toLowerCase(),
          entry: d,
        };
      }
    });

    return { blanks, daysInMonth, historyMap, mIndex, year };
  }, [activeMonth, historyList]);

  if (safeCalendars.length === 0 || !monthData) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No calendar data available for this semester.
      </div>
    );
  }

  // Compact mode: edge-to-edge squircle date grid. Dates carry their own
  // coloured tint + shape-only dot — no status words, no per-day actions.
  if (compact) {
    return (
      <div className="w-full min-w-0 flex flex-col">
        {/* Month Selector */}
        <div className="w-full flex gap-1.5 pb-3 overflow-x-auto hide-scrollbar">
          {safeCalendars.map((cal, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`px-3 py-1.5 min-h-11 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 ${
                idx === activeIdx
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {cal.month}
            </button>
          ))}
        </div>

        {/* Compact date grid. The weekday header lives inside the same grid, so
            it scrolls with the cells instead of staying pinned over them. */}
        <div className="w-full overflow-x-auto hide-scrollbar">
          <AnimatePresence mode="wait">
            <m.div
              key={activeIdx}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full min-w-[420px] grid grid-cols-7 gap-1 text-center"
            >
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 py-1"
                >
                  {day.slice(0, 2)}
                </div>
              ))}

              {monthData.blanks.map((_, i) => (
                <div key={`blank-${i}`} className="aspect-square" />
              ))}

              {monthData.daysInMonth.map((dayInfo, i) => {
                const date = Number(dayInfo.date);
                const dataObj = monthData.historyMap[date];
                const tint = statusTint(dataObj?.status, isODTracker);
                return (
                  <div
                    key={date}
                    title={dataObj?.status ? `${date}: ${dataObj.status}` : undefined}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${tint.bg}`}
                  >
                    <span
                      className={`text-xs font-black font-outfit leading-none ${dataObj ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600"}`}
                    >
                      {date}
                    </span>
                    {tint.dot ? (
                      // Shape as well as colour, so present/absent is
                      // readable without telling red from green.
                      <span aria-hidden="true" className={`${dotShape(dataObj?.status)} ${tint.dot}`} />
                    ) : (
                      <span className="w-1.5 h-1.5" />
                    )}
                    {dataObj?.status ? <span className="sr-only">{dataObj.status}</span> : null}
                  </div>
                );
              })}
            </m.div>
          </AnimatePresence>
        </div>

        {/* Individual Notes Sheet for Overall Mode */}
        <AnimatePresence>
          {selectedOverallDate && (
            <BottomSheet
              onClose={() => setSelectedOverallDate(null)}
              overlayId="attendance-date-notes-compact"
              maxWidth="max-w-sm"
              title={selectedOverallDate.date}
              closeLabel="Close date notes"
            >
              <div className="space-y-3 pt-1">
                {selectedOverallDate.missedClasses.map((c, idx) => {
                  const isSecured = notesTracker[c.courseCode]?.[selectedOverallDate.date] === true;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-4 bg-gray-50  dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100  dark:border-gray-800"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900  dark:text-gray-200">{c.courseTitle}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          {c.courseCode} • {c.status}
                        </p>
                      </div>
                      <button
                        onClick={(e) => toggleIndividualNote(selectedOverallDate.date, c.courseCode, e)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-11 rounded-lg border text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                          isSecured
                            ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50    dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        {isSecured ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                        {isSecured ? "Secured" : "Get Notes"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </BottomSheet>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 md:p-6 p-3 flex flex-col items-center">
      {/* Month Selector */}
      <div className="w-full max-w-5xl flex flex-wrap justify-center gap-2 pb-4 px-1">
        {safeCalendars.map((cal, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIdx(idx)}
            className={`px-4 py-1.5 min-h-11 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
              idx === activeIdx
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100  dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
            }`}
          >
            {cal.month}
          </button>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-200  dark:border-gray-800 bg-white  dark:bg-black shadow-sm">
        <AnimatePresence mode="wait">
          <m.div
            key={activeIdx}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full overflow-x-auto hide-scrollbar"
          >
            <div className="w-full min-w-[420px] grid grid-cols-7 text-center border-collapse">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="font-bold py-2 border-b border-gray-100  dark:border-gray-800 text-xs tracking-wider uppercase text-gray-500 dark:text-gray-400 bg-gray-50/50  dark:bg-gray-900/40"
                >
                  {day}
                </div>
              ))}

              {monthData.blanks.map((_, i) => (
                <div
                  key={`blank-${i}`}
                  className="h-14 sm:h-18 border-b border-r border-gray-100/50  dark:border-gray-800/30"
                />
              ))}

              {monthData.daysInMonth.map((dayInfo, i) => {
                const date = Number(dayInfo.date);
                const dataObj = monthData.historyMap[date];
                const status = dataObj?.status;
                const entry = dataObj?.entry;

                // One fill channel per cell: the tinted background. The dot
                // carries status by hue, and the status itself stays available
                // to screen readers, so the old coloured status word was a
                // second, redundant channel. The lookup is memoised at module
                // scope (see `statusFill`).
                const tint = statusFill(status, isODTracker, true);
                const bgClass = tint.bg || "bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-900/50";
                const dotColor = tint.dot;

                const isLastCol = (monthData.blanks.length + i + 1) % 7 === 0;

                const exactDateStr = entry ? entry.date : null;

                let hasNotes = false;
                const isMissed = isOverall
                  ? entry?.missedClasses?.length > 0
                  : status === "absent" || status === "on duty";

                if (isOverall && isMissed && exactDateStr) {
                  hasNotes = entry.missedClasses.every((c) => notesTracker[c.courseCode]?.[exactDateStr] === true);
                } else if (!isOverall && exactDateStr) {
                  hasNotes = notesTracker[courseCode]?.[exactDateStr] === true;
                }

                return (
                  <div
                    key={date}
                    {...clickable(() => {
                      if (isOverall && isMissed) setSelectedOverallDate(entry);
                    })}
                    className={`relative flex flex-col p-1.5 h-16 sm:h-20 border-b border-gray-100  dark:border-gray-800/50 transition-all ${bgClass} ${isLastCol ? "" : "border-r"} ${isOverall && isMissed ? "cursor-pointer hover:shadow-inner" : ""}`}
                  >
                    <div className="w-full flex justify-between items-start">
                      <span
                        className={`text-xs font-semibold ${status ? "text-gray-900  dark:text-gray-100" : "text-gray-500  dark:text-gray-400"}`}
                      >
                        {date}
                      </span>
                      {dotColor && <div className={`w-2 h-2 rounded-full mt-1 ${dotColor}`} />}
                    </div>
                    {status && (
                      <div className="mt-auto text-left flex flex-col gap-1.5">
                        <span className="sr-only">{status}</span>

                        {isMissed && exactDateStr && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOverall) toggleNotes(exactDateStr, entry.missedClasses, e);
                              else toggleNotes(exactDateStr);
                            }}
                            className={`relative hit-expand flex items-center justify-center gap-1 p-1 sm:px-2 sm:py-1 rounded-md border text-xs font-semibold transition-all shrink-0 mt-auto ${
                              hasNotes
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-700    dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50    dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                          >
                            {hasNotes ? <CheckCircle2 size={12} /> : <FileText size={12} />}
                            <span className="truncate">{hasNotes ? "Secured" : "Notes"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </m.div>
        </AnimatePresence>
      </div>

      {/* Individual Notes Sheet for Overall Mode */}
      <AnimatePresence>
        {selectedOverallDate && (
          <BottomSheet
            onClose={() => setSelectedOverallDate(null)}
            overlayId="attendance-date-notes-wide"
            maxWidth="max-w-sm"
            title={selectedOverallDate.date}
            closeLabel="Close date notes"
          >
            <div className="space-y-3 pt-1">
              {selectedOverallDate.missedClasses.map((c, idx) => {
                const isSecured = notesTracker[c.courseCode]?.[selectedOverallDate.date] === true;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 bg-gray-50  dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100  dark:border-gray-800"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900  dark:text-gray-200">{c.courseTitle}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        {c.courseCode} • {c.status}
                      </p>
                    </div>
                    <button
                      onClick={(e) => toggleIndividualNote(selectedOverallDate.date, c.courseCode, e)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-11 rounded-lg border text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                        isSecured
                          ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50    dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {isSecured ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                      {isSecured ? "Secured" : "Get Notes"}
                    </button>
                  </div>
                );
              })}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
