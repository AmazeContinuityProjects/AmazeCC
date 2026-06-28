import React, { useState, useMemo } from "react";
import { getDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, X } from "lucide-react";

export default function AttendanceCalendarView({ analyzeCalendars, historyList, notesTracker, toggleNotes, courseCode, isOverall, toggleIndividualNote, isODTracker = false }) {
    const [activeIdx, setActiveIdx] = useState(0);
    const [selectedOverallDate, setSelectedOverallDate] = useState(null);

    const safeCalendars = useMemo(() => {
        if (!analyzeCalendars || !Array.isArray(analyzeCalendars)) return [];
        return analyzeCalendars;
    }, [analyzeCalendars]);

    const activeMonth = safeCalendars[activeIdx];
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const monthData = useMemo(() => {
        if (!activeMonth) return null;

        const monthStr = activeMonth.month?.toLowerCase() || "";
        const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(m => monthStr.includes(m));
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
        historyList.forEach(d => {
            const dateObj = new Date(d.date);
            if (dateObj.getFullYear() === year && dateObj.getMonth() === mIndex) {
                historyMap[dateObj.getDate()] = {
                    status: isOverall ? d.overallStatus : d.status.toLowerCase(),
                    entry: d
                };
            }
        });

        return { blanks, daysInMonth, historyMap, mIndex, year };
    }, [activeMonth, historyList]);

    if (safeCalendars.length === 0 || !monthData) {
        return <div className="p-8 text-center text-gray-500 dark:text-gray-400">No calendar data available for this semester.</div>;
    }

    return (
        <div className="flex-1 min-w-0 md:p-6 p-3 flex flex-col items-center">
            {/* Month Selector */}
            <div className="w-full max-w-5xl flex flex-wrap justify-center gap-2 pb-4 px-1">
                {safeCalendars.map((cal, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActiveIdx(idx)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${idx === activeIdx
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
                    <motion.div
                        key={activeIdx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full overflow-x-auto hide-scrollbar"
                    >
                        <div className="min-w-0 w-full grid grid-cols-7 text-center border-collapse">
                            {weekdays.map((day) => (
                                <div
                                    key={day}
                                    className="font-bold py-2 border-b border-gray-100  dark:border-gray-800 text-[10px] tracking-wider uppercase text-gray-500 dark:text-gray-400 bg-gray-55/50  dark:bg-gray-900/40"
                                >
                                    {day}
                                </div>
                            ))}

                            {monthData.blanks.map((_, i) => (
                                <div key={`blank-${i}`} className="h-14 sm:h-18 border-b border-r border-gray-100/50  dark:border-gray-800/30" />
                            ))}

                            {monthData.daysInMonth.map((dayInfo, i) => {
                                const date = Number(dayInfo.date);
                                const dataObj = monthData.historyMap[date];
                                const status = dataObj?.status;
                                const entry = dataObj?.entry;

                                let bgClass = "bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-900/50";
                                let dotColor = "";

                                if (isODTracker) {
                                    if (status === "valid od") {
                                        bgClass = "bg-emerald-50/50  dark:bg-emerald-500/10";
                                        dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
                                    } else if (status === "wasted od") {
                                        bgClass = "bg-red-50/50  dark:bg-red-500/10";
                                        dotColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
                                    } else if (status === "partial wasted od") {
                                        bgClass = "bg-amber-50/50  dark:bg-amber-500/10";
                                        dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
                                    }
                                } else {
                                    if (status === "present") {
                                        bgClass = "bg-emerald-50/50  dark:bg-emerald-500/10";
                                        dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
                                    } else if (status === "absent") {
                                        bgClass = "bg-red-50/50  dark:bg-red-500/10";
                                        dotColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
                                    } else if (status === "on duty" || status === "partial od") {
                                        bgClass = "bg-yellow-50/50  dark:bg-amber-500/10";
                                        dotColor = "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]";
                                    } else if (status && status.includes("half-day")) {
                                        bgClass = "bg-orange-50/50  dark:bg-orange-500/10";
                                        dotColor = "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]";
                                    } else if (status === "partially absent") {
                                        bgClass = "bg-rose-50/50  dark:bg-rose-500/10";
                                        dotColor = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]";
                                    }
                                }

                                const isLastCol = (monthData.blanks.length + i + 1) % 7 === 0;

                                const dateStr = monthData.daysInMonth[i]?.fullDate ? new Date(monthData.daysInMonth[i].fullDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : null;

                                const exactDateStr = entry ? entry.date : null;

                                let hasNotes = false;
                                const isMissed = isOverall ? (entry?.missedClasses?.length > 0) : (status === "absent" || status === "on duty");

                                if (isOverall && isMissed && exactDateStr) {
                                    hasNotes = entry.missedClasses.every(c => notesTracker[c.courseCode]?.[exactDateStr] === true);
                                } else if (!isOverall && exactDateStr) {
                                    hasNotes = notesTracker[courseCode]?.[exactDateStr] === true;
                                }

                                return (
                                    <div
                                        key={date}
                                        onClick={() => { if (isOverall && isMissed) setSelectedOverallDate(entry); }}
                                        className={`relative flex flex-col p-1.5 h-16 sm:h-20 border-b border-gray-100  dark:border-gray-800/50 transition-all ${bgClass} ${isLastCol ? '' : 'border-r'} ${isOverall && isMissed ? 'cursor-pointer hover:shadow-inner' : ''}`}
                                    >
                                        <div className="w-full flex justify-between items-start">
                                            <span className={`text-[11px] sm:text-xs font-semibold ${status ? 'text-gray-900  dark:text-gray-100' : 'text-gray-500  dark:text-gray-400'}`}>
                                                {date}
                                            </span>
                                            {dotColor && <div className={`w-2 h-2 rounded-full mt-1 ${dotColor}`} />}
                                        </div>
                                        {status && (
                                            <div className="mt-auto text-left flex flex-col gap-1.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                    isODTracker ? (
                                                        status === "valid od" ? "text-emerald-600  dark:text-emerald-400" :
                                                        status === "wasted od" ? "text-red-600  dark:text-red-400" :
                                                        "text-amber-600  dark:text-amber-400"
                                                    ) : (
                                                        status === "present" ? "text-emerald-600  dark:text-emerald-400" :
                                                        status === "absent" ? "text-red-600  dark:text-red-400" :
                                                        status.includes("half-day") ? "text-orange-600  dark:text-orange-400" :
                                                        status.includes("partially absent") ? "text-rose-600  dark:text-rose-400" :
                                                        "text-yellow-600  dark:text-yellow-400"
                                                    )
                                                }`}>
                                                    {status}
                                                </span>

                                                {isMissed && exactDateStr && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isOverall) toggleNotes(exactDateStr, entry.missedClasses, e);
                                                            else toggleNotes(exactDateStr);
                                                        }}
                                                        className={`flex items-center justify-center gap-1 p-1 sm:px-2 sm:py-1 rounded-md border text-[9px] sm:text-[10px] font-semibold transition-all shrink-0 mt-auto ${
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
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Individual Notes Modal for Overall Mode */}
            <AnimatePresence>
                {selectedOverallDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 " onClick={() => setSelectedOverallDate(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-white  dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200  dark:border-gray-800 overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-100  dark:border-gray-800 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100">
                                    {selectedOverallDate.date}
                                </h3>
                                <button onClick={() => setSelectedOverallDate(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
                                {selectedOverallDate.missedClasses.map((c, idx) => {
                                    const isSecured = notesTracker[c.courseCode]?.[selectedOverallDate.date] === true;
                                    return (
                                        <div key={idx} className="flex items-center justify-between gap-4 bg-gray-50  dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100  dark:border-gray-800">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900  dark:text-gray-200">{c.courseTitle}</p>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">{c.courseCode} • {c.status}</p>
                                            </div>
                                            <button
                                                onClick={(e) => toggleIndividualNote(selectedOverallDate.date, c.courseCode, e)}
                                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
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
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
