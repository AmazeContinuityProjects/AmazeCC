const fs = require('fs');
const path = require('path');

const content = `"use client";
import React, { useMemo, useState, useEffect } from "react";
import { eachDayOfInterval, endOfMonth, getDay, isSameDay } from "date-fns";
import NoContentFound from "../NoContentFound";
import { RefreshCcw, Download, Calendar as CalendarIcon, Info, ChevronRight, BookOpen, Clock, AlertCircle, EyeOff, ShieldAlert, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ExamsScheduleDisplay from "../Exams/SchduleDisplay";

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
    return String(str).toLowerCase().replace(/[^a-z0-9\\s]/g, " ").trim();
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

export default function CalendarView({ calendars, calendarType, handleCalendarFetch, moodleData, scheduleData, attendanceData, ODhoursData, setIsSubpageOpen }) {
    const safeCalendars = useMemo(() => {
        let baseCals = [];
        if (calendars) {
            if (Array.isArray(calendars)) baseCals = calendars;
            else if (calendars.calendars) baseCals = calendars.calendars;
            else baseCals = [calendars];
        }

        return baseCals.map(cal => {
            if(!cal.days) return cal;
            const cMatch = String(cal.month || "").match(/([a-zA-Z]+)\\s+(\\d{4})/);
            if (!cMatch) return cal;
            const cMonthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const cYear = parseInt(cMatch[2], 10);
            const cMonth = cMonthMap[cMatch[1].toLowerCase().slice(0, 3)] ?? 0;

            const newDays = cal.days.map(d => {
                const dayDate = new Date(cYear, cMonth, Number(d.date));
                const extraEvents = [];

                if (moodleData && Array.isArray(moodleData)) {
                    moodleData.forEach(m => {
                        if(m.done) return;
                        const dueStr = m.due;
                        if(!dueStr) return;
                        const dueDate = new Date(dueStr);
                        if(dueDate.getFullYear() === cYear && dueDate.getMonth() === cMonth && dueDate.getDate() === Number(d.date)) {
                            extraEvents.push({
                                type: "moodle",
                                text: \`[Moodle] \${m.name.split("/").pop() || "Assignment"}\`,
                                category: \`Due: \${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\`,
                                hidden: m.hidden,
                                url: m.url
                            });
                        }
                    });
                }

                if (scheduleData && scheduleData.Schedule) {
                    Object.entries(scheduleData.Schedule).forEach(([examType, subjects]) => {
                        if(Array.isArray(subjects)) {
                            subjects.forEach(subj => {
                                if(!subj.examDate) return;
                                const examD = new Date(subj.examDate);
                                if(examD.getFullYear() === cYear && examD.getMonth() === cMonth && examD.getDate() === Number(d.date)) {
                                    extraEvents.push({
                                        type: "exam",
                                        text: \`[\${examType}] \${subj.courseCode}\`,
                                        category: \`\${subj.examTime} | \${subj.venue}\`
                                    });
                                }
                            });
                        }
                    });
                }

                if (attendanceData && attendanceData.attendance) {
                    let presentCount = 0;
                    let absentCount = 0;
                    attendanceData.attendance.forEach(course => {
                        if(course.viewLink) {
                            course.viewLink.forEach(vl => {
                                const vlDate = new Date(vl.date);
                                if(vlDate.getFullYear() === cYear && vlDate.getMonth() === cMonth && vlDate.getDate() === Number(d.date)) {
                                    if(vl.status.toLowerCase() === "present") presentCount++;
                                    else if(vl.status.toLowerCase() === "absent") absentCount++;
                                }
                            });
                        }
                    });
                    if (presentCount > 0 || absentCount > 0) {
                         extraEvents.push({
                             type: "attendance",
                             text: "Classes",
                             category: \`\${presentCount} Present, \${absentCount} Absent\`,
                             presentCount,
                             absentCount
                         });
                    }
                }

                if (ODhoursData && Array.isArray(ODhoursData)) {
                    ODhoursData.forEach(od => {
                        const odDate = new Date(od.date);
                        if(odDate.getFullYear() === cYear && odDate.getMonth() === cMonth && odDate.getDate() === Number(d.date)) {
                            extraEvents.push({
                                type: "od",
                                text: \`[OD] \${od.total} Hours\`,
                                category: "On-Duty"
                            });
                        }
                    });
                }

                return { ...d, events: [...d.events, ...extraEvents], fullDate: dayDate };
            });

            return { ...cal, days: newDays };
        });
    }, [calendars, moodleData, scheduleData, attendanceData, ODhoursData]);

    const [activeIdx, setActiveIdx] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("calendar-active-index");
            return saved ? Number(saved) || 0 : 0;
        }
        return 0;
    });

    const [selectedType, setSelectedType] = useState(calendarType || "ALL");
    const [selectedDay, setSelectedDay] = useState(null);
    const [isSchedulePageOpen, setIsSchedulePageOpenInternal] = useState(false);

    const toggleSchedulePage = (state) => {
        setIsSchedulePageOpenInternal(state);
        if(setIsSubpageOpen) setIsSubpageOpen(state);
    }

    useEffect(() => {
        localStorage.setItem("calendar-active-index", String(activeIdx));
    }, [activeIdx]);

    const activeCalendar = safeCalendars[activeIdx] || {};
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const { year, monthIndex } = useMemo(() => {
        const now = new Date();
        const MONTH_NAME_MAP = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const rawMonth = String(activeCalendar.month || "").trim();
        const match = rawMonth.match(/([a-zA-Z]+)\\s+(\\d{4})/);

        let parsedMonthIndex = now.getMonth();
        let parsedYear = now.getFullYear();

        if (match) {
            const monthName = match[1].toLowerCase().slice(0, 3);
            parsedMonthIndex = MONTH_NAME_MAP[monthName] ?? parsedMonthIndex;
            parsedYear = parseInt(match[2], 10);
        }
        return { year: parsedYear, monthIndex: parsedMonthIndex };
    }, [activeCalendar.month]);

    const today = new Date();

    useEffect(() => {
        if(safeCalendars.length > 0 && !selectedDay) {
            // Find today's events if they exist
            for (let c of safeCalendars) {
                if(!c.days) continue;
                for (let d of c.days) {
                    if (d.fullDate && isSameDay(d.fullDate, today)) {
                        setSelectedDay({ date: d.date, dayType: "today", events: d.events, fullDate: d.fullDate });
                        return;
                    }
                }
            }
        }
    }, [safeCalendars]);

    if(isSchedulePageOpen) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
                <button 
                    onClick={() => toggleSchedulePage(false)} 
                    className="mb-4 text-blue-600 dark:text-blue-400 hover:underline flex items-center font-semibold"
                >
                    &larr; Back to Calendar
                </button>
                <ExamsScheduleDisplay data={scheduleData} handleScheduleFetch={() => {}} />
            </div>
        )
    }

    if (!safeCalendars.length) {
        return (
            <div className="relative flex flex-col items-center justify-center min-h-[400px] w-full p-6 text-center">
                <div className="absolute top-0 right-0 w-full md:w-auto flex flex-col md:flex-row gap-3">
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 midnight:border-gray-800 bg-white dark:bg-gray-800 midnight:bg-gray-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 shadow-sm"
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
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

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
            const cMatch = String(c.month || "").match(/([a-zA-Z]+)\\s+(\\d{4})/);
            if (!cMatch) return;
            const cYear = parseInt(cMatch[2], 10);
            const cMonth = cMonthMap[cMatch[1].toLowerCase().slice(0, 3)] ?? 0;

            c.days.forEach((d) => {
                if (d.events && d.events.length > 0) {
                    const dateStr = \`\${cYear}\${String(cMonth + 1).padStart(2, '0')}\${String(d.date).padStart(2, '0')}\`;
                    d.events.forEach((e) => {
                        const summary = String(e.text || "Event").replace(/[,;\\n]/g, " ");
                        ics.push(
                            "BEGIN:VEVENT",
                            \`DTSTART;VALUE=DATE:\${dateStr}\`,
                            \`DTEND;VALUE=DATE:\${dateStr}\`,
                            \`SUMMARY:\${summary}\`,
                            \`DESCRIPTION:\${e.category || ""}\`,
                            "END:VEVENT"
                        );
                    });
                }
            });
        });

        ics.push("END:VCALENDAR");
        const blob = new Blob([ics.join("\\r\\n")], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "AmazeCC_Academic_Calendar.ics";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate upcoming exams and moodle
    let upcomingExamsList = [];
    let upcomingMoodleList = [];
    if(scheduleData && scheduleData.Schedule) {
        Object.entries(scheduleData.Schedule).forEach(([examType, subjects]) => {
            if(Array.isArray(subjects)) {
                subjects.forEach(subj => {
                    if(!subj.examDate) return;
                    const examD = new Date(subj.examDate);
                    if(examD >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                        upcomingExamsList.push({ ...subj, type: examType, d: examD });
                    }
                });
            }
        });
    }
    if(moodleData && Array.isArray(moodleData)) {
        moodleData.forEach(m => {
            if(!m.done && m.due) {
                const dueDate = new Date(m.due);
                if(dueDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                    upcomingMoodleList.push({ ...m, d: dueDate });
                }
            }
        });
    }
    upcomingExamsList.sort((a,b) => a.d - b.d);
    upcomingMoodleList.sort((a,b) => a.d - b.d);
    const next3Exams = upcomingExamsList.slice(0, 3);
    const next3Moodle = upcomingMoodleList.slice(0, 3);

    return (
        <div className="flex flex-col gap-6 max-w-full overflow-x-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="text-blue-500 shrink-0" />
                        <span>Super Calendar</span>
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

            <div className="flex gap-2 justify-center md:justify-end flex-wrap overflow-x-auto pb-2 scrollbar-hide">
                {safeCalendars.map((calendar, idx) => (
                    <button
                        key={calendar.id}
                        onClick={() => setActiveIdx(idx)}
                        className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 \${idx === activeIdx
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 midnight:bg-gray-900 midnight:text-gray-300 midnight:border-gray-800 midnight:hover:bg-gray-800"
                            }\`}
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
                                <div key={\`blank-\${i}\`} className="h-32 border-b border-r border-gray-100/50 dark:border-gray-800/50 midnight:border-gray-800/30" />
                            ))}

                            {daysInMonth.map((dateObj, i) => {
                                const date = dateObj.getDate();
                                const dayInfo = Array.isArray(activeCalendar.days)
                                    ? activeCalendar.days.find((d) => Number(d.date) === date)
                                    : undefined;
                                const events = dayInfo?.events || [];

                                const hasHoliday = events.some(isHolidayEvent);
                                const hasInstructional = events.some(isInstructionalEvent);
                                const hasExam = events.some(e => e.type === "exam");
                                const hasMoodle = events.some(e => e.type === "moodle");
                                const hasAttendance = events.some(e => e.type === "attendance" && e.absentCount > 0);
                                const hasOD = events.some(e => e.type === "od");
                                const isEmpty = events.length === 0;
                                const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();
                                const isSelected = selectedDay && selectedDay.date === date;

                                const semiHolidayEvents = ["CAT - I", "CAT - II", "TechnoVIT", "Vibrance"];
                                const hasSemiHoliday = events.some(e =>
                                    semiHolidayEvents.some(keyword =>
                                        (e.text || "").toLowerCase().includes(keyword.toLowerCase()) ||
                                        (e.category || "").toLowerCase().includes(keyword.toLowerCase())
                                    )
                                );

                                let dayType = "other";
                                if (hasSemiHoliday) dayType = "semiholiday";
                                else if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0 && !hasExam && !hasMoodle)) dayType = "holiday";
                                else if (hasInstructional) dayType = "instructional";

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
                                        onClick={() => setSelectedDay({ date, dayType, events, fullDate: dayInfo?.fullDate || dateObj })}
                                        className={\`relative flex flex-col p-2 h-32 backdrop-blur-sm transition-all cursor-pointer hover:shadow-inner
                                            \${bgClass} \${borderClasses} \${isLastCol ? 'border-r-0' : ''}
                                            \${isSelected ? "ring-2 ring-inset ring-purple-500 dark:ring-purple-400 midnight:ring-purple-500 z-10" : isToday ? "ring-2 ring-inset ring-blue-500 z-10" : ""}
                                    \`}
                                    >
                                        <div className="w-full flex items-center justify-between mb-1">
                                            <span className={\`text-base font-semibold \${isToday ? 'text-blue-600 dark:text-blue-400 midnight:text-blue-400' : 'text-gray-700 dark:text-gray-300 midnight:text-gray-400'}\`}>
                                                {date}
                                            </span>
                                            <div className="flex gap-1">
                                                {hasExam && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" title="Exam"/>}
                                                {hasMoodle && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title="Moodle Due"/>}
                                                {hasOD && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" title="OD Approved"/>}
                                                {hasAttendance && <div className="w-2 h-2 rounded-full bg-red-600" title="Missed Classes"/>}
                                            </div>
                                        </div>

                                        <div className="w-full flex-1 overflow-hidden flex flex-col gap-1">
                                            {events.length > 0 && events.slice(0, 3).map((e, idx) => {
                                                let eClass = "bg-white/50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 midnight:bg-gray-900/50 midnight:text-gray-300";
                                                if(e.type === "exam") eClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 midnight:bg-orange-900/50 midnight:text-orange-300 border border-orange-200 dark:border-orange-800";
                                                if(e.type === "moodle") eClass = \`bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 midnight:bg-purple-900/50 midnight:text-purple-300 \${e.hidden ? 'opacity-50 line-through' : 'border border-purple-200 dark:border-purple-800'}\`;
                                                if(e.type === "od") eClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 midnight:bg-blue-900/50 midnight:text-blue-300";

                                                return (
                                                    <div key={idx} className={\`truncate text-[10px] font-medium px-1.5 py-0.5 rounded text-left w-full \${eClass}\`}>
                                                        {e.text}
                                                    </div>
                                                )
                                            })}
                                            {events.length > 3 && (
                                                <div className="text-[10px] font-bold text-gray-400 text-left pl-1">
                                                    +{events.length - 3} more
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

            {/* FOCUS PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                {/* Left: Selected Day Details */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 midnight:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                                <CalendarIcon size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Day Details</h3>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {selectedDay ? \`\${selectedDay.date} \${activeCalendar.month ?? ""}\` : "Select a day"}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {!selectedDay || selectedDay.events.length === 0 ? (
                                <div className="text-center text-gray-500 dark:text-gray-400 mt-10">No events for this day.</div>
                            ) : (
                                selectedDay.events.map((e, i) => {
                                    const isHol = isHolidayEvent(e);
                                    const isIns = isInstructionalEvent(e);
                                    let style = \`bg-gray-50 border-gray-100 text-gray-900 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-200 midnight:bg-gray-800/50 midnight:border-gray-700/50 midnight:text-gray-200\`;
                                    
                                    if(e.type === "exam") style = "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-200 midnight:bg-orange-900/20 midnight:border-orange-800/50 midnight:text-orange-200";
                                    else if(e.type === "moodle") style = \`bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-200 midnight:bg-purple-900/20 midnight:border-purple-800/50 midnight:text-purple-200 \${e.hidden ? "opacity-60" : ""}\`;
                                    else if(e.type === "od") style = "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-200 midnight:bg-blue-900/20 midnight:border-blue-800/50 midnight:text-blue-200";
                                    else if(e.type === "attendance") {
                                        style = e.absentCount > 0 ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200" : "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-200";
                                    }
                                    else if(isHol) style = 'bg-red-50 border-red-100 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200 midnight:bg-red-500/10 midnight:border-red-500/30 midnight:text-red-300';
                                    else if(isIns) style = 'bg-green-50 border-green-100 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-200 midnight:bg-green-500/10 midnight:border-green-500/30 midnight:text-green-300';
                                    
                                    return (
                                        <div key={i} className={\`p-3 rounded-xl border flex gap-3 \${style}\`}>
                                            <div className="flex-1 min-w-0">
                                                <p className={\`font-semibold text-sm mb-1 \${e.hidden ? 'line-through' : ''}\`}>{e.text}</p>
                                                {e.category && <p className="text-xs opacity-80 font-medium">{e.category}</p>}
                                            </div>
                                            {e.type === "moodle" && e.url && !e.hidden && (
                                                <a href={e.url} target="_blank" rel="noreferrer" className="shrink-0 p-2 bg-white/50 dark:bg-black/20 rounded-lg hover:bg-white dark:hover:bg-black/40 transition-colors self-start">
                                                    <BookOpen size={16} className="text-purple-600 dark:text-purple-400" />
                                                </a>
                                            )}
                                            {e.type === "moodle" && e.hidden && (
                                                <div className="shrink-0 self-start text-gray-500" title="Hidden Assignment"><EyeOff size={16}/></div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Upcoming Widgets */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Upcoming Exams Widget */}
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 midnight:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                                    <Clock size={16} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Upcoming Exams</h3>
                            </div>
                            <button 
                                onClick={() => toggleSchedulePage(true)} 
                                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                            >
                                View Full Schedule <ChevronRight size={16}/>
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {next3Exams.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming exams found.</p>
                            ) : (
                                next3Exams.map((ex, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                        <div className="flex flex-col shrink-0 min-w-[80px]">
                                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">{ex.type}</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ex.examDate}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-2 sm:pt-0 sm:pl-3">
                                            <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{ex.courseTitle}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">{ex.courseCode}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{ex.examTime} | {ex.venue}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upcoming Moodle Widget */}
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 midnight:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <BookOpen size={16} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Upcoming Assignments</h3>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {next3Moodle.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">All caught up! No upcoming assignments.</p>
                            ) : (
                                next3Moodle.map((md, i) => (
                                    <div key={i} className={\`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border \${md.hidden ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-60' : 'bg-purple-50 dark:bg-purple-900/10 midnight:bg-purple-900/10 border-purple-100 dark:border-purple-900/30'}\`}>
                                        <div className="flex flex-col shrink-0 min-w-[100px]">
                                            <span className={\`text-xs font-bold uppercase tracking-wider \${md.hidden ? 'text-gray-500' : 'text-purple-600 dark:text-purple-400'}\`}>
                                                {md.hidden ? "Hidden" : "Due Date"}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                {md.d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-2 sm:pt-0 sm:pl-3 flex items-center justify-between">
                                            <div className="min-w-0">
                                                <p className={\`font-bold truncate \${md.hidden ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}\`}>{md.name.split("/").pop()}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{md.name.split("/")[1] || md.name}</p>
                                            </div>
                                            {!md.hidden && md.url && (
                                                <a href={md.url} target="_blank" rel="noreferrer" className="shrink-0 p-2 ml-2 bg-white dark:bg-black/20 rounded-lg hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                                                    <ChevronRight size={16} className="text-purple-600 dark:text-purple-400" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
`;

fs.writeFileSync(path.join(__dirname, 'CalendarView.tsx'), content);
console.log('Successfully updated CalendarView.tsx');
