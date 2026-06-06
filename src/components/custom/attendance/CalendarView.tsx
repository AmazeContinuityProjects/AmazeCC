"use client";
import React, { useMemo, useState, useEffect } from "react";
import { eachDayOfInterval, endOfMonth, getDay } from "date-fns";
import NoContentFound from "../NoContentFound";
import { RefreshCcw, Download, Calendar as CalendarIcon, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CALENDAR_TYPES = {
    ALL: "General Semester",
    ALL02: "General Flexible",
    ALL03: "General Freshers",
    ALL05: "General LAW",
    ALL06: "Flexible Freshers",
    ALL08: "Cohort LAW",
    ALL11: "Flexible Research",
    WEI: "Weekend Intra Semester",
};

const HOLIDAY_KEYWORDS = [
    "holiday", "pooja", "puja", "ayudha", "diwali", "pongal", "eid", "christmas", "good friday",
    "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
    "vacation", "term end", "no instructional", "noinstructional", "vinayakar chathurthi", "gandhi jayanthi",
    "thaipoosam", "telugu", "tamil", "ambedkar"
];

function normalize(str = "") {
    return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function isHolidayEvent(e) {
    if (!e) return false;
    const type = String(e.type || "").toLowerCase();
    const text = normalize(e.text || "");
    const cat = normalize(e.category || "");
    if (type.includes("holiday")) return true;
    if (type.includes("no instructional")) return true;
    if (cat.includes("no instructional")) return true;
    for (const kw of HOLIDAY_KEYWORDS) {
        if (text.includes(kw) || cat.includes(kw)) return true;
    }
    return false;
}

function isInstructionalEvent(e) {
    if (!e) return false;
    const type = String(e.type || "").toLowerCase();
    const cat = normalize(e.category || "");
    if (type === "instructional day") return true;
    if (cat.includes("working")) return true;
    return false;
}

export default function CalendarView({ calendars, calendarType, handleCalendarFetch }) {
    const safeCalendars = useMemo(() => {
        if (!calendars) return [];
        if (Array.isArray(calendars)) return calendars;
        if (calendars.calendars) return calendars.calendars;
        return [calendars];
    }, [calendars]);

    const [activeIdx, setActiveIdx] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("calendar-active-index");
            return saved ? Number(saved) || 0 : 0;
        }
        return 0;
    });

    const [selectedType, setSelectedType] = useState(calendarType || "ALL");
    const [selectedDay, setSelectedDay] = useState(null); // For the details modal

    useEffect(() => {
        localStorage.setItem("calendar-active-index", String(activeIdx));
    }, [activeIdx]);

    const activeCalendar = safeCalendars[activeIdx] || {};
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const { year, monthIndex } = useMemo(() => {
        const now = new Date();

        const MONTH_NAME_MAP = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };

        const rawMonth = String(activeCalendar.month || "").trim();
        const match = rawMonth.match(/([a-zA-Z]+)\s+(\d{4})/);

        let parsedMonthIndex = now.getMonth();
        let parsedYear = now.getFullYear();

        if (match) {
            const monthName = match[1].toLowerCase().slice(0, 3);
            parsedMonthIndex = MONTH_NAME_MAP[monthName] ?? parsedMonthIndex;
            parsedYear = parseInt(match[2], 10);
        }

        return {
            year: parsedYear,
            monthIndex: parsedMonthIndex,
        };
    }, [activeCalendar.month]);


    if (!safeCalendars.length) {
        return (
            <div className="relative flex flex-col items-center justify-center min-h-[400px] w-full p-6 text-center">
                <div className="absolute top-0 right-0 w-full md:w-auto flex flex-col md:flex-row gap-3">
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 midnight:border-gray-800 bg-white dark:bg-gray-800 midnight:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                    >
                        {Object.entries(CALENDAR_TYPES).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => handleCalendarFetch(selectedType)}
                        className="px-6 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        Load Calendar
                    </button>
                </div>
                <div className="mt-20">
                    <NoContentFound />
                </div>
            </div>
        );
    }

    let monthStart = new Date(year, monthIndex, 1);
    let daysInMonth = [];
    try {
        const monthEnd = endOfMonth(monthStart);
        daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    } catch {
        const totalDays = Number(activeCalendar.totalDays) || 31;
        daysInMonth = Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1));
    }

    const firstDay = getDay(monthStart);
    const blanksCount = (firstDay + 6) % 7;
    const blanks = Array.from({ length: blanksCount }, (_, i) => i);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

    // Up Next logic
    let upcomingEvent = null;
    let upcomingDays = -1;
    for (let c of safeCalendars) {
        if (!c.days) continue;
        const cMatch = String(c.month || "").match(/([a-zA-Z]+)\s+(\d{4})/);
        if (!cMatch) continue;
        const cMonthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const cYear = parseInt(cMatch[2], 10);
        const cMonth = cMonthMap[cMatch[1].toLowerCase().slice(0, 3)] ?? 0;
        
        for (let d of c.days) {
            const dateObj = new Date(cYear, cMonth, Number(d.date));
            if (dateObj >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                const holidays = d.events.filter(e => isHolidayEvent(e) || String(e.category).toLowerCase().includes("cat") || String(e.text).toLowerCase().includes("cat"));
                if (holidays.length > 0) {
                    const diffTime = Math.abs(dateObj.getTime() - today.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (!upcomingEvent || diffDays < upcomingDays) {
                        upcomingEvent = holidays[0];
                        upcomingDays = diffDays;
                    }
                }
            }
        }
    }

    const generateCalendarICS = () => {
        let ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AmazeCC//Academic Calendar//EN",
            "CALSCALE:GREGORIAN"
        ];
        
        const cMonthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

        safeCalendars.forEach((c) => {
            if (!c.days) return;
            const cMatch = String(c.month || "").match(/([a-zA-Z]+)\s+(\d{4})/);
            if (!cMatch) return;
            const cYear = parseInt(cMatch[2], 10);
            const cMonth = cMonthMap[cMatch[1].toLowerCase().slice(0, 3)] ?? 0;

            c.days.forEach((d) => {
                if (d.events && d.events.length > 0) {
                    const dateStr = `${cYear}${String(cMonth + 1).padStart(2, '0')}${String(d.date).padStart(2, '0')}`;
                    d.events.forEach((e) => {
                        const summary = String(e.text || "Event").replace(/[,;\n]/g, " ");
                        ics.push(
                            "BEGIN:VEVENT",
                            `DTSTART;VALUE=DATE:${dateStr}`,
                            `DTEND;VALUE=DATE:${dateStr}`,
                            `SUMMARY:${summary}`,
                            `DESCRIPTION:${e.category || ""}`,
                            "END:VEVENT"
                        );
                    });
                }
            });
        });

        ics.push("END:VCALENDAR");
        const blob = new Blob([ics.join("\r\n")], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "AmazeCC_Academic_Calendar.ics";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="text-blue-500 shrink-0" />
                        <span>Academic Calendar</span>
                    </div>
                    <span className="text-xs md:text-sm font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 rounded-md text-gray-600 dark:text-gray-300 midnight:text-gray-400 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 whitespace-nowrap">
                        {CALENDAR_TYPES[calendarType || "ALL"]}
                    </span>
                </h1>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={generateCalendarICS} 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 midnight:bg-emerald-500/10 midnight:text-emerald-400 border border-emerald-200 dark:border-emerald-800 midnight:border-emerald-500/30 transition-colors text-sm font-medium"
                    >
                        <Download size={16} /> Sync .ics
                    </button>
                    <button 
                        onClick={() => handleCalendarFetch(calendarType || "ALL")} 
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 midnight:bg-blue-500/10 midnight:text-blue-400 border border-blue-200 dark:border-blue-800 midnight:border-blue-500/30 transition-colors"
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Up Next Banner */}
            {upcomingEvent && (
                <div className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 dark:border-blue-800/50 midnight:border-blue-500/30 rounded-2xl p-4 backdrop-blur-md flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 midnight:bg-blue-500/20 rounded-lg">
                            <Info size={20} className="text-blue-600 dark:text-blue-400 midnight:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Up Next</p>
                            <p className="text-sm md:text-base font-bold text-gray-800 dark:text-gray-200">{upcomingEvent.text}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                            {upcomingDays === 0 ? "Today" : `${upcomingDays} days`}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex gap-2 justify-center md:justify-end flex-wrap overflow-x-auto pb-2 scrollbar-hide">
                {safeCalendars.map((calendar, idx) => (
                    <button
                        key={calendar.id}
                        onClick={() => setActiveIdx(idx)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${idx === activeIdx
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 midnight:bg-gray-900 midnight:text-gray-300 midnight:border-gray-800 midnight:hover:bg-gray-800"
                            }`}
                    >
                        {calendar.month ?? "Month"} {calendar.year ?? ""}
                    </button>
                ))}
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 midnight:border-gray-800 bg-white dark:bg-gray-900 midnight:bg-black shadow-sm">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIdx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full overflow-x-auto"
                    >
                        <div className="min-w-[800px] w-full grid grid-cols-7 text-center border-collapse">
                            {weekdays.map((day) => (
                                <div
                                    key={day}
                                    className="font-bold py-3 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800 text-xs tracking-wider uppercase text-gray-500 dark:text-gray-400 midnight:text-gray-500 bg-gray-50/50 dark:bg-gray-900/50 midnight:bg-gray-900/40"
                                >
                                    {day}
                                </div>
                            ))}

                            {blanks.map((_, i) => (
                                <div key={`blank-${i}`} className="h-32 border-b border-r border-gray-100/50 dark:border-gray-800/50 midnight:border-gray-800/30" />
                            ))}

                            {daysInMonth.map((dateObj, i) => {
                                const date = dateObj.getDate();
                                const dayInfo = Array.isArray(activeCalendar.days)
                                    ? activeCalendar.days.find((d) => Number(d.date) === date)
                                    : undefined;
                                const events = dayInfo?.events || [];

                                const hasHoliday = events.some(isHolidayEvent);
                                const hasInstructional = events.some(isInstructionalEvent);
                                const isEmpty = events.length === 0;
                                const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();

                                const semiHolidayEvents = ["CAT - I", "CAT - II", "TechnoVIT", "Vibrance"];
                                const hasSemiHoliday = events.some(e =>
                                    semiHolidayEvents.some(keyword =>
                                        (e.text || "").toLowerCase().includes(keyword.toLowerCase()) ||
                                        (e.category || "").toLowerCase().includes(keyword.toLowerCase())
                                    )
                                );

                                let dayType = "other";
                                if (hasSemiHoliday) dayType = "semiholiday";
                                else if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) dayType = "holiday";
                                else if (hasInstructional) dayType = "instructional";

                                // Glassmorphic Gradients
                                const bgClass =
                                    dayType === "holiday"
                                        ? "bg-gradient-to-br from-red-50/80 to-transparent dark:from-red-900/20 midnight:from-red-500/10"
                                        : dayType === "instructional"
                                            ? "bg-gradient-to-br from-green-50/80 to-transparent dark:from-green-900/20 midnight:from-green-500/10"
                                            : dayType === "semiholiday"
                                                ? "bg-gradient-to-br from-yellow-50/80 to-transparent dark:from-yellow-900/20 midnight:from-amber-500/10"
                                                : "bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50 midnight:hover:bg-gray-900/50";

                                const borderClasses = "border-b border-r border-gray-100 dark:border-gray-800/50 midnight:border-gray-800/50";
                                const isLastCol = (blanksCount + i + 1) % 7 === 0;

                                return (
                                    <div
                                        key={date}
                                        onClick={() => events.length > 0 && setSelectedDay({ date, dayType, events })}
                                        className={`relative flex flex-col p-2 h-32 backdrop-blur-sm transition-all
                                            ${bgClass} ${borderClasses} ${isLastCol ? 'border-r-0' : ''}
                                            ${events.length > 0 ? "cursor-pointer hover:shadow-inner" : ""}
                                            ${isToday ? "ring-2 ring-inset ring-blue-500 z-10" : ""}
                                    `}
                                    >
                                        <div className="w-full flex items-center justify-between mb-1">
                                            <span className={`text-base font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 midnight:text-gray-400'}`}>
                                                {date}
                                            </span>
                                            {dayType !== "other" && events.length > 0 && (
                                                <div className={`w-2 h-2 rounded-full ${
                                                    dayType === 'holiday' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                                    dayType === 'instructional' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                                    'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                                }`} />
                                            )}
                                        </div>

                                        <div className="w-full flex-1 overflow-hidden flex flex-col gap-1">
                                            {events.length > 0 && events.slice(0, 2).map((e, idx) => (
                                                <div key={idx} className="truncate text-[10px] font-medium px-1.5 py-0.5 rounded text-left w-full
                                                    bg-white/50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 midnight:bg-gray-900/50 midnight:text-gray-300"
                                                >
                                                    {e.text}
                                                </div>
                                            ))}
                                            {events.length > 2 && (
                                                <div className="text-[10px] font-bold text-gray-400 text-left pl-1">
                                                    +{events.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Event Details Modal */}
            <AnimatePresence>
                {selectedDay && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-white dark:bg-gray-900 midnight:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 midnight:border-gray-800 overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                                    {selectedDay.date} {activeCalendar.month ?? ""}
                                </h3>
                                <button onClick={() => setSelectedDay(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-800 text-gray-500 midnight:text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 max-h-96 overflow-y-auto">
                                <ul className="space-y-3">
                                    {selectedDay.events.map((e, i) => {
                                        const isHol = isHolidayEvent(e);
                                        const isIns = isInstructionalEvent(e);
                                        return (
                                            <li key={i} className={`p-3 rounded-xl border ${
                                                isHol ? 'bg-red-50 border-red-100 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200 midnight:bg-red-500/10 midnight:border-red-500/30 midnight:text-red-300' :
                                                isIns ? 'bg-green-50 border-green-100 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-200 midnight:bg-green-500/10 midnight:border-green-500/30 midnight:text-green-300' :
                                                'bg-gray-50 border-gray-100 text-gray-900 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-200 midnight:bg-gray-800/50 midnight:border-gray-700/50 midnight:text-gray-200'
                                            }`}>
                                                <p className="font-semibold text-sm mb-1">{e.text}</p>
                                                {e.category && <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">{e.category}</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
