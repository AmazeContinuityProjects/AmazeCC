"use client";
import React, { useMemo, useState, useEffect } from "react";
import { eachDayOfInterval, endOfMonth, getDay, isSameDay } from "date-fns";
import NoContentFound from "../NoContentFound";
import { RefreshCcw, Download, Calendar as CalendarIcon, Info, ChevronRight, BookOpen, Clock, EyeOff, Plus, CheckCircle2, ShieldAlert, Award, FileText } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import { motion, AnimatePresence } from "framer-motion";
import ExamsScheduleDisplay from "../Exams/SchduleDisplay";
import { MoodleUserPassForm } from "../Exams/moodleDisplay";
import config from "../../../../config.json";
import OverallTrackerSubpage from "./OverallTrackerSubpage";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import Badge from "../shared/Badge";
import EmptyState from "../shared/EmptyState";
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

export default function CalendarView({ calendars, calendarType, handleCalendarFetch, moodleData, scheduleData, attendanceData, ODhoursData, setIsSubpageOpen, setMoodleData, handleFetchMoodle, IDs, registeredEvents, setActiveAttendanceSubTab }) {
    
    const [homeworkTracker, setHomeworkTracker] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("customHomework");
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    const [showOverallTracker, setShowOverallTracker] = useState(false);

    useEffect(() => {
        if (setIsSubpageOpen) {
            setIsSubpageOpen(showOverallTracker);
        }
    }, [showOverallTracker, setIsSubpageOpen]);

    const dayCardsMap = useMemo(() => {
        const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const map: Record<string, any[]> = {};
        days.forEach(day => map[day] = []);
        const slotMap = (config as any).slotMap;
        
        const arr = attendanceData?.attendance || [];
        if (!arr.length) return map;

        arr.forEach((a: any) => {
            const slots = a.slotName.split("+");
            slots.forEach((slotName: string) => {
                const cleanSlot = slotName.trim();
                for (const day of days) {
                    if (slotMap[day] && slotMap[day][cleanSlot]) {
                        const info = slotMap[day][cleanSlot];
                        const pct = parseInt(a.attendancePercentage);
                        const cleanCourseCode = a.courseCode;
                        const cls = pct < 50 ? "low" : pct < 75 ? "medium" : "high";
                        map[day].push({
                            ...a,
                            courseCode: cleanCourseCode,
                            slotName: cleanSlot,
                            time: info.time,
                            cls,
                        });
                    }
                }
            });
        });

        function parseTime(timeStr: string) {
            let [h, m] = timeStr.trim().split(":").map(Number);
            if (h < 8) h += 12;
            return h * 60 + m;
        }

        function getTimeRange(time: string) {
            const [start, end] = time.split("-").map(t => t.trim());
            return { start: parseTime(start), end: parseTime(end) };
        }

        for (const day of days) {
            map[day].sort((a, b) => {
                const timeA = getTimeRange(a.time);
                const timeB = getTimeRange(b.time);
                if (timeA.start !== timeB.start) return timeA.start - timeB.start;
                return a.slotName.localeCompare(b.slotName, undefined, { numeric: true });
            });

            const merged = [];
            for (let i = 0; i < map[day].length; i++) {
                const current = map[day][i];
                const next = map[day][i + 1];

                if (next && current.courseTitle === next.courseTitle && current.courseType === next.courseType && current.faculty === next.faculty && current.cls === next.cls) {
                    const currentRange = getTimeRange(current.time);
                    const nextRange = getTimeRange(next.time);
                    const gapInMinutes = nextRange.start - currentRange.end;

                    if (gapInMinutes >= 0 && gapInMinutes <= 5) {
                        merged.push({
                            ...current,
                            slotName: `${current.slotName}+${next.slotName}`,
                            time: `${current.time.split("-")[0]}-${next.time.split("-")[1]}`,
                        });
                        i++;
                    } else {
                        merged.push(current);
                    }
                } else {
                    merged.push(current);
                }
            }

            merged.sort((a, b) => parseTime(a.time.split("-")[0]) - parseTime(b.time.split("-")[0]));
            map[day] = merged;
        }
        return map;
    }, [attendanceData]);

    const analyzeCalendars = useMemo(() => {
        return analyzeAllCalendars(calendars).results;
    }, [calendars]);

    const masterHistory = useMemo(() => {
        const dateMap: Record<string, { dateObj: Date, allClasses: Array<{ courseCode: string, courseTitle: string, status: string }> }> = {};
        
        const arr = attendanceData?.attendance || [];
        if (!arr.length) return [];

        arr.forEach((a: any) => {
            a.viewLink?.forEach((h: any) => {
                if (!dateMap[h.date]) {
                    dateMap[h.date] = { dateObj: new Date(h.date), allClasses: [] };
                }
                dateMap[h.date].allClasses.push({
                    courseCode: a.courseCode,
                    courseTitle: a.courseTitle,
                    status: h.status.toLowerCase()
                });
            });
        });

        const dates = Object.keys(dateMap).sort((a, b) => dateMap[b].dateObj.getTime() - dateMap[a].dateObj.getTime());

        return dates.map(dateStr => {
            const d = dateMap[dateStr];
            const weekdayNum = d.dateObj.getDay();
            const daysArr = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            const weekday = daysArr[weekdayNum];
            const scheduled = dayCardsMap[weekday] || [];
            
            const morningClasses: any[] = [];
            const eveningClasses: any[] = [];
            const missedClasses: any[] = []; 

            d.allClasses.forEach(historyEntry => {
                let sc = scheduled.find(s => s.courseCode === historyEntry.courseCode);
                if (!sc) {
                    Object.values(dayCardsMap).flat().forEach(s => {
                        if (s.courseCode === historyEntry.courseCode) sc = s;
                    });
                }
                
                let isMorning = true;
                if (sc && sc.time) {
                    const startStr = sc.time.split("-")[0].trim();
                    const [h, m] = startStr.split(":").map(Number);
                    let hrs = h;
                    if (startStr.includes("PM") && h !== 12) hrs += 12;
                    isMorning = (hrs * 60 + m) < (13 * 60);
                }

                const classObj = { ...historyEntry, isMorning };
                if (isMorning) morningClasses.push(classObj);
                else eveningClasses.push(classObj);

                if (classObj.status !== "present") missedClasses.push(classObj);
            });

            let overallStatus = "present";
            if (missedClasses.length > 0) {
                const morningMissedCount = morningClasses.filter(c => c.status !== "present").length;
                const eveningMissedCount = eveningClasses.filter(c => c.status !== "present").length;
                
                const isAllMorningMissed = morningClasses.length > 0 && morningMissedCount === morningClasses.length;
                const isAllEveningMissed = eveningClasses.length > 0 && eveningMissedCount === eveningClasses.length;

                if (isAllMorningMissed && isAllEveningMissed) {
                    overallStatus = "absent"; 
                } else if (isAllMorningMissed && eveningMissedCount === 0) {
                    overallStatus = "morning half-day";
                } else if (isAllEveningMissed && morningMissedCount === 0) {
                    overallStatus = "evening half-day";
                } else {
                    const hasAbsent = missedClasses.some(c => c.status === "absent");
                    overallStatus = hasAbsent ? "partially absent" : "partial od";
                }
            }

            return { date: dateStr, overallStatus, missedClasses, allClasses: d.allClasses };
        });
    }, [attendanceData, dayCardsMap]);

    const totalMissedDaysCount = masterHistory.filter(d => d.missedClasses.length > 0).length;
    const totalClassesCount = masterHistory.length;

    useEffect(() => {
        localStorage.setItem("customHomework", JSON.stringify(homeworkTracker));
    }, [homeworkTracker]);

    const addHomework = (courseName, dateStr, dueDate) => {
        const text = prompt(`Add homework for ${courseName}:\n(e.g., 'Read Chapter 5')`);
        if(!text) return;
        const newHw = {
            id: Date.now().toString(),
            courseName,
            text,
            dueDate: dueDate.toISOString(),
            done: false
        };
        setHomeworkTracker(prev => [...prev, newHw]);
    };

    const toggleHomework = (id) => {
        setHomeworkTracker(prev => prev.map(h => h.id === id ? { ...h, done: !h.done } : h));
    };

    const safeCalendars = useMemo(() => {
        let baseCals = [];
        if (calendars) {
            if (Array.isArray(calendars)) baseCals = calendars;
            else if (calendars.calendars) baseCals = calendars.calendars;
            else baseCals = [calendars];
        }

        return baseCals.map(cal => {
            if(!cal.days) return cal;
            const cMatch = String(cal.month || "").match(/([a-zA-Z]+)\s+(\d{4})/);
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
                                text: `[Moodle] ${m.name.split("/").pop() || "Assignment"}`,
                                category: `Due: ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
                                hidden: m.hidden,
                                url: m.url
                            });
                        }
                    });
                }

                homeworkTracker.forEach(h => {
                    const hDate = new Date(h.dueDate);
                    if(hDate.getFullYear() === cYear && hDate.getMonth() === cMonth && hDate.getDate() === Number(d.date) && !h.done) {
                        extraEvents.push({
                            type: "homework",
                            text: `[HW] ${h.courseName}`,
                            category: h.text,
                            id: h.id
                        });
                    }
                });

                if (scheduleData && scheduleData.Schedule) {
                    Object.entries(scheduleData.Schedule).forEach(([examType, subjects]) => {
                        if(Array.isArray(subjects)) {
                            subjects.forEach(subj => {
                                if(!subj.examDate) return;
                                const examD = new Date(subj.examDate);
                                if(examD.getFullYear() === cYear && examD.getMonth() === cMonth && examD.getDate() === Number(d.date)) {
                                    extraEvents.push({
                                        type: "exam",
                                        text: `[${examType}] ${subj.courseCode}`,
                                        category: `${subj.examTime} | ${subj.venue}`
                                    });
                                }
                            });
                        }
                    });
                }

                if (attendanceData && attendanceData.attendance) {
                    attendanceData.attendance.forEach(course => {
                        if(course.viewLink) {
                            course.viewLink.forEach(vl => {
                                const vlDate = new Date(vl.date);
                                if(vlDate.getFullYear() === cYear && vlDate.getMonth() === cMonth && vlDate.getDate() === Number(d.date)) {
                                    extraEvents.push({
                                        type: "attendance",
                                        status: vl.status.toLowerCase(),
                                        courseTitle: course.courseTitle,
                                        text: course.courseTitle,
                                        category: vl.status,
                                        isAbsent: vl.status.toLowerCase() === "absent"
                                    });
                                }
                            });
                        }
                    });
                }

                if (ODhoursData && Array.isArray(ODhoursData)) {
                    ODhoursData.forEach(od => {
                        const odDate = new Date(od.date);
                        if(odDate.getFullYear() === cYear && odDate.getMonth() === cMonth && odDate.getDate() === Number(d.date)) {
                            if (od.courses && Array.isArray(od.courses)) {
                                od.courses.forEach(c => {
                                    extraEvents.push({
                                        type: "od",
                                        courseTitle: c.title,
                                        text: c.title,
                                        category: "On-Duty"
                                    });
                                });
                            } else {
                                extraEvents.push({
                                    type: "od",
                                    courseTitle: "OD",
                                    text: `[OD] ${od.total} Hours`,
                                    category: "On-Duty"
                                });
                            }
                        }
                    });
                }

                if (registeredEvents && Array.isArray(registeredEvents)) {
                    registeredEvents.forEach(ev => {
                        if (!ev.date) return;
                        const evDateParts = ev.date.split('-');
                        if (evDateParts.length !== 3) return;
                        // Assuming format DD-MMM-YYYY or YYYY-MM-DD - the scraper outputs things like '20-Oct-2023'
                        const evDate = new Date(ev.date);
                        if (evDate.getFullYear() === cYear && evDate.getMonth() === cMonth && evDate.getDate() === Number(d.date)) {
                            extraEvents.push({
                                type: "event",
                                text: `[Event] ${ev.name}`,
                                category: `${ev.time} | ${ev.venue}`
                            });
                        }
                    });
                }

                return { ...d, events: [...d.events, ...extraEvents], fullDate: dayDate };
            });

            return { ...cal, days: newDays };
        });
    }, [calendars, moodleData, scheduleData, attendanceData, ODhoursData, homeworkTracker, registeredEvents]);

    const { wastedODsCount, validODsCount, recoveredODsCount, totalODHours } = useMemo(() => {
        let wastedCount = 0;
        let validCount = 0;
        let recoveredCount = 0;
        let totalHours = 0;

        if (!ODhoursData || !Array.isArray(ODhoursData)) {
            return { wastedODsCount: 0, validODsCount: 0, recoveredODsCount: 0, totalODHours: 0 };
        }

        const trackerRaw = typeof window !== 'undefined' ? localStorage.getItem("wastedODsTracker") : null;
        const tracker = trackerRaw ? JSON.parse(trackerRaw) : {};

        ODhoursData.forEach(dayOD => {
            const displayDate = dayOD.date;
            
            dayOD.courses?.forEach(c => {
                let isWasted = false;
                let isRecovered = false;
                
                const trackedDay = tracker[displayDate];
                if (trackedDay) {
                    const matchedTrack: any = Object.values(trackedDay).find((t: any) => 
                        t.courseTitle.toLowerCase().includes(c.title.toLowerCase()) || 
                        c.title.toLowerCase().includes(t.courseTitle.toLowerCase())
                    );

                    if (matchedTrack) {
                        if (matchedTrack.status === "wasted") isWasted = true;
                        if (matchedTrack.status === "recovered") isRecovered = true;
                    }
                }
                
                const isLab = c.type.toLowerCase().includes("lab") || c.type.toLowerCase().includes("ela") || c.type.toLowerCase().includes("pbl");
                const hours = isLab ? 2 : 1;

                if (isWasted) {
                    wastedCount += hours;
                } else if (isRecovered) {
                    recoveredCount += hours;
                    validCount += hours; 
                } else {
                    validCount += hours;
                }
            });

            totalHours += dayOD.total;
        });

        return { wastedODsCount: wastedCount, validODsCount: validCount, recoveredODsCount: recoveredCount, totalODHours: totalHours };
    }, [ODhoursData]);

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
        const match = rawMonth.match(/([a-zA-Z]+)\s+(\d{4})/);

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
                    className="mb-4 text-blue-600 dark:text-blue-400 hover:underline flex items-center font-semibold midnight:text-blue-400"
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
                    <FetchButton
                        onClick={() => handleCalendarFetch(selectedType)}
                        className="px-6 py-2"
                    >
                        Load Calendar
                    </FetchButton>
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
                    upcomingMoodleList.push({ ...m, type: "moodle", d: dueDate });
                }
            }
        });
    }
    homeworkTracker.forEach(h => {
        if(!h.done) {
            const hDate = new Date(h.dueDate);
            if(hDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                upcomingMoodleList.push({ 
                    type: "homework", 
                    name: h.text, 
                    courseName: h.courseName,
                    d: hDate, 
                    hidden: false,
                    id: h.id 
                });
            }
        }
    });

    upcomingExamsList.sort((a,b) => a.d - b.d);
    upcomingMoodleList.sort((a,b) => a.d - b.d);
    const next3Exams = upcomingExamsList.slice(0, 3);
    const next3Moodle = upcomingMoodleList.slice(0, 3);

    return (
        <>
        <div className="flex flex-col gap-6 max-w-full overflow-x-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="text-blue-500 shrink-0" />
                        <span>Super Calendar</span>
                    </div>
                    <Badge variant="default" className="rounded-md border border-gray-200 dark:border-gray-700 midnight:border-gray-800 font-medium">
                        {CALENDAR_TYPES[calendarType || "ALL"]}
                    </Badge>
                </h1>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setActiveAttendanceSubTab?.("circulars")} 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm"
                    >
                        <FileText size={16} /> <span className="text-sm">Circulars</span>
                    </button>
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
                        key={calendar.id || idx}
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

            <div className="flex items-center justify-center gap-4 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 flex-wrap midnight:text-gray-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Exam</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Task/Assignment</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> OD Approved</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"></div> Missed Class</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Class Present</span>
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
                                const hasExam = events.some(e => e.type === "exam");
                                const hasMoodle = events.some(e => e.type === "moodle" || e.type === "homework");
                                const hasAbsent = events.some(e => e.type === "attendance" && e.isAbsent);
                                const hasPresent = events.some(e => e.type === "attendance" && !e.isAbsent);
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
                                        className={`relative flex flex-col p-2 h-32 backdrop-blur-sm transition-all cursor-pointer hover:shadow-inner
                                            ${bgClass} ${borderClasses} ${isLastCol ? 'border-r-0' : ''}
                                            ${isSelected ? "ring-2 ring-inset ring-purple-500 dark:ring-purple-400 midnight:ring-purple-500 z-10" : isToday ? "ring-2 ring-inset ring-blue-500 z-10" : ""}
                                    `}
                                    >
                                        <div className="w-full flex items-center justify-between mb-1">
                                            <span className={`text-base font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400 midnight:text-blue-400' : 'text-gray-700 dark:text-gray-300 midnight:text-gray-400'}`}>
                                                {date}
                                            </span>
                                            <div className="flex gap-1 flex-wrap justify-end">
                                                {hasExam && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" title="Exam"/>}
                                                {hasMoodle && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title="Moodle Due"/>}
                                                {hasOD && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" title="OD Approved"/>}
                                                {hasAbsent && <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)]" title="Missed Classes"/>}
                                                {hasPresent && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Classes Attended"/>}
                                            </div>
                                        </div>

                                        <div className="w-full flex-1 overflow-hidden flex flex-col gap-1">
                                            {events.length > 0 && events.slice(0, 3).map((e, idx) => {
                                                let eClass = "bg-white/50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 midnight:bg-gray-900/50 midnight:text-gray-300";
                                                if(e.type === "exam") eClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 midnight:bg-orange-900/50 midnight:text-orange-300 border border-orange-200 dark:border-orange-800";
                                                if(e.type === "moodle" || e.type === "homework") eClass = `bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 midnight:bg-purple-900/50 midnight:text-purple-300 ${e.hidden ? 'opacity-50 line-through' : 'border border-purple-200 dark:border-purple-800'}`;
                                                if(e.type === "od") eClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 midnight:bg-blue-900/50 midnight:text-blue-300";
                                                if(e.type === "attendance") {
                                                    eClass = e.isAbsent ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
                                                }

                                                return (
                                                    <div key={idx} className={`truncate text-[10px] font-medium px-1.5 py-0.5 rounded text-left w-full ${eClass}`}>
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
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 midnight:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 midnight:text-purple-400">
                                <CalendarIcon size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Day Details</h3>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400">
                                    {selectedDay ? `${selectedDay.date} ${activeCalendar.month ?? ""}` : "Select a day"}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-5">
                            {!selectedDay || selectedDay.events.length === 0 ? (
                                <EmptyState title="No events for this day." className="mt-10" />
                            ) : (
                                <>
                                    {/* Render Helper for an Event */}
                                    {(() => {
                                        const renderEvent = (e: any, i: number) => {
                                            const isHol = isHolidayEvent(e);
                                            const isIns = isInstructionalEvent(e);
                                            let style = `bg-gray-50 border-gray-100 text-gray-900 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-200 midnight:bg-gray-800/50 midnight:border-gray-700/50 midnight:text-gray-200`;
                                            
                                            if(e.type === "exam") style = "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-200 midnight:bg-orange-900/20 midnight:border-orange-800/50 midnight:text-orange-200";
                                            else if(e.type === "moodle" || e.type === "homework") style = `bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-200 midnight:bg-purple-900/20 midnight:border-purple-800/50 midnight:text-purple-200 ${e.hidden ? "opacity-60" : ""}`;
                                            else if(e.type === "od") style = "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-200 midnight:bg-blue-900/20 midnight:border-blue-800/50 midnight:text-blue-200";
                                            else if(e.type === "attendance") {
                                                style = e.isAbsent ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200" : "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-200";
                                            }
                                            else if(e.type === "event") style = "bg-pink-50 border-pink-200 text-pink-900 dark:bg-pink-900/20 dark:border-pink-800/50 dark:text-pink-200 midnight:bg-pink-900/20 midnight:border-pink-800/50 midnight:text-pink-200";
                                            else if(isHol) style = 'bg-red-50 border-red-100 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200 midnight:bg-red-500/10 midnight:border-red-500/30 midnight:text-red-300';
                                            else if(isIns) style = 'bg-green-50 border-green-100 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-200 midnight:bg-green-500/10 midnight:border-green-500/30 midnight:text-green-300';
                                            
                                            const canAddHomework = (e.type === "attendance" || e.type === "od");

                                            return (
                                                <div key={i} className={`p-3 rounded-xl border flex gap-3 ${style}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-semibold text-sm mb-1 ${e.hidden ? 'line-through' : ''}`}>{e.text}</p>
                                                        {e.category && <p className="text-xs opacity-80 font-medium">{e.category}</p>}
                                                    </div>
                                                    {canAddHomework && (
                                                        <button 
                                                            onClick={() => addHomework(e.courseTitle || e.text, selectedDay.date, selectedDay.fullDate)}
                                                            className="shrink-0 self-center p-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors text-gray-700 dark:text-gray-300 midnight:bg-white/10 midnight:hover:bg-white/20 midnight:text-gray-300"
                                                            title="Add Homework for this Class"
                                                        >
                                                            <Plus size={16}/>
                                                        </button>
                                                    )}
                                                    {e.type === "moodle" && e.url && !e.hidden && (
                                                        <a href={e.url} target="_blank" rel="noreferrer" className="shrink-0 p-2 bg-white/50 dark:bg-black/20 rounded-lg hover:bg-white dark:hover:bg-black/40 transition-colors self-start midnight:bg-black/20 midnight:hover:bg-black/40">
                                                            <BookOpen size={16} className="text-purple-600 dark:text-purple-400 midnight:text-purple-400" />
                                                        </a>
                                                    )}
                                                    {(e.type === "moodle" && e.hidden) && (
                                                        <div className="shrink-0 self-start text-gray-500" title="Hidden Assignment"><EyeOff size={16}/></div>
                                                    )}
                                                </div>
                                            );
                                        };

                                        const dayTypeEvents = selectedDay.events.filter(e => isHolidayEvent(e) || isInstructionalEvent(e));
                                        const dayClassEvents = selectedDay.events.filter(e => e.type === "attendance" || e.type === "od");
                                        const dayOtherEvents = selectedDay.events.filter(e => e.type !== "attendance" && e.type !== "od" && !isHolidayEvent(e) && !isInstructionalEvent(e));

                                        return (
                                            <>
                                                {dayTypeEvents.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 midnight:text-gray-500 mb-2">Day Type</h4>
                                                        {dayTypeEvents.map((e, i) => renderEvent(e, i))}
                                                    </div>
                                                )}
                                                {dayOtherEvents.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 midnight:text-gray-500 mb-2 mt-4">Day Events</h4>
                                                        {dayOtherEvents.map((e, i) => renderEvent(e, i))}
                                                    </div>
                                                )}
                                                {dayClassEvents.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 midnight:text-gray-500 mb-2 mt-4">Day Classes</h4>
                                                        {dayClassEvents.map((e, i) => renderEvent(e, i))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Upcoming Widgets & Stats */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Stats Widget */}
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 midnight:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center midnight:text-blue-400">
                                <Award size={16} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Attendance & OD Overview</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 midnight:bg-gray-900 rounded-xl relative group midnight:border-red-900/30">
                                <div className="absolute top-2 right-2 text-red-400 opacity-50"><ShieldAlert size={12} /></div>
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Missed Days</p>
                                <p className="text-2xl font-black text-red-600 dark:text-red-400 midnight:text-red-400">{totalMissedDaysCount}</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 midnight:bg-gray-900 rounded-xl relative group midnight:border-blue-900/30">
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Total Classes</p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 midnight:text-blue-400">{totalClassesCount}</p>
                            </div>
                            <div className="p-3 bg-emerald-50 border border-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-900/10 midnight:bg-gray-900 rounded-xl midnight:border-emerald-900/30">
                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1 midnight:text-emerald-500">Total OD Hours</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400">{totalODHours}</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-xl">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valid ODs</p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 midnight:text-blue-400">{validODsCount}</p>
                            </div>
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 midnight:bg-gray-900 rounded-xl relative group midnight:border-purple-900/30">
                                <div className="absolute top-2 right-2 text-purple-400 opacity-50"><CheckCircle2 size={12} /></div>
                                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Recovered ODs</p>
                                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 midnight:text-purple-400">{recoveredODsCount}</p>
                            </div>
                            
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 midnight:bg-gray-900 rounded-xl relative group midnight:border-orange-900/30">
                                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">Wasted ODs</p>
                                <p className="text-2xl font-black text-orange-600 dark:text-orange-400 midnight:text-orange-400">{wastedODsCount}</p>
                            </div>
                        </div>

                        {/* Full Width Button for Aggregated Log */}
                        <button 
                            onClick={() => setShowOverallTracker(true)}
                            className="mt-4 w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 midnight:bg-gray-900/50 midnight:hover:bg-gray-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 midnight:bg-blue-900/30 rounded-lg">
                                    <Clock size={18} className="text-blue-600 dark:text-blue-400 midnight:text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Aggregated Log</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400">View your attendance heatmap & full class log</p>
                                </div>
                            </div>
                            <div className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                                &rarr;
                            </div>
                        </button>
                    </div>

                    {/* Upcoming Moodle Widget */}
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 midnight:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center midnight:text-purple-400">
                                    <BookOpen size={16} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Upcoming Tasks & Assignments</h3>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {(!moodleData || moodleData.length === 0) && (!IDs || !IDs.MoodleUsername || !IDs.MoodlePassword) && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 midnight:bg-gray-900/50 midnight:border-gray-800">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 midnight:text-gray-300">Sign in to Moodle to see upcoming assignments.</p>
                                    <MoodleUserPassForm handleFetchMoodle={handleFetchMoodle} IDs={IDs} />
                                </div>
                            )}

                            {next3Moodle.length === 0 && (moodleData?.length > 0 || homeworkTracker.length > 0) ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400">All caught up! No upcoming tasks.</p>
                            ) : (
                                next3Moodle.map((md, i) => (
                                    <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${md.hidden ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-60' : 'bg-purple-50 dark:bg-purple-900/10 midnight:bg-purple-900/10 border-purple-100 dark:border-purple-900/30'}`}>
                                        <div className="flex flex-col shrink-0 min-w-[100px]">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${md.hidden ? 'text-gray-500' : 'text-purple-600 dark:text-purple-400'}`}>
                                                {md.hidden ? "Hidden" : "Due Date"}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                                                {md.d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-2 sm:pt-0 sm:pl-3 flex items-center justify-between midnight:border-gray-800">
                                            <div className="min-w-0 flex-1">
                                                <p className={`font-bold truncate ${md.hidden ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{md.name.split("/").pop()}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate midnight:text-gray-400">{md.type === "homework" ? md.courseName : (md.name.split("/")[1] || md.name)}</p>
                                            </div>
                                            
                                            {md.type === "homework" && (
                                                <button onClick={() => toggleHomework(md.id)} className="shrink-0 p-2 ml-2 bg-purple-200 dark:bg-purple-900/50 rounded-lg text-purple-700 dark:text-purple-300 font-bold text-xs hover:bg-purple-300 transition-colors midnight:bg-purple-900/50 midnight:text-purple-300">
                                                    Mark Done
                                                </button>
                                            )}

                                            {md.type === "moodle" && !md.hidden && md.url && (
                                                <a href={md.url} target="_blank" rel="noreferrer" className="shrink-0 p-2 ml-2 bg-white dark:bg-black/20 rounded-lg hover:bg-gray-100 dark:hover:bg-black/40 transition-colors midnight:bg-black/20 midnight:hover:bg-black/40">
                                                    <ChevronRight size={16} className="text-purple-600 dark:text-purple-400 midnight:text-purple-400" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upcoming Exams Widget */}
                    <div className="bg-white dark:bg-gray-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 midnight:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center midnight:text-orange-400">
                                    <Clock size={16} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Upcoming Exams</h3>
                            </div>
                            <button 
                                onClick={() => toggleSchedulePage(true)} 
                                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 midnight:text-blue-400"
                            >
                                View Full Schedule <ChevronRight size={16}/>
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {next3Exams.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400">No upcoming exams found.</p>
                            ) : (
                                next3Exams.map((ex, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-900/50 border border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                                        <div className="flex flex-col shrink-0 min-w-[80px]">
                                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider midnight:text-orange-400">{ex.type}</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{ex.examDate}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-2 sm:pt-0 sm:pl-3 midnight:border-gray-800">
                                            <p className="font-bold text-gray-900 dark:text-gray-100 truncate midnight:text-gray-100">{ex.courseTitle}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="default" size="sm" className="bg-gray-200 dark:bg-gray-700 midnight:bg-gray-700 rounded font-medium">{ex.courseCode}</Badge>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate midnight:text-gray-400">{ex.examTime} | {ex.venue}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <AnimatePresence>
            {showOverallTracker && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed inset-0 z-[100] bg-white dark:bg-black midnight:bg-black overflow-y-auto"
                >
                    <div className="max-w-7xl mx-auto min-h-screen">
                        <OverallTrackerSubpage 
                            attendanceData={attendanceData?.attendance || []}
                            dayCardsMap={dayCardsMap}
                            analyzeCalendars={analyzeCalendars}
                            onBack={() => setShowOverallTracker(false)}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}
