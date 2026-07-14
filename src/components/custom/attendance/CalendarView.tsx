"use client";
import React, { useMemo, useState, useEffect } from "react";
import { eachDayOfInterval, endOfMonth, getDay, isSameDay } from "date-fns";
import NoContentFound from "../NoContentFound";
import { RefreshCcw, Download, Calendar as CalendarIcon, ChevronRight, BookOpen, EyeOff, Plus, CheckCircle2, Award, FileText, ListChecks, GraduationCap } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import { motion, AnimatePresence } from "framer-motion";
import ExamsScheduleDisplay from "../Exams/SchduleDisplay";
import { MoodleUserPassForm } from "../Exams/moodleDisplay";
import config from "../../../../config.json";
import OverallTrackerSubpage from "./OverallTrackerSubpage";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import Badge from "../shared/Badge";
import PageHeader from "../shared/PageHeader";
import Modal from "../shared/Modal";
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
    const [showMoodleModal, setShowMoodleModal] = useState(false);

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
            if (Array.isArray(a.viewLink)) {
                a.viewLink.forEach((h: any) => {
                    if (!dateMap[h.date]) {
                        dateMap[h.date] = { dateObj: new Date(h.date), allClasses: [] };
                    }
                    dateMap[h.date].allClasses.push({
                        courseCode: a.courseCode,
                        courseTitle: a.courseTitle,
                        status: h.status.toLowerCase()
                    });
                });
            }
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
                        if (Array.isArray(course.viewLink)) {
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
                    className="mb-4 text-blue-600  hover:underline flex items-center font-semibold dark:text-blue-400"
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
                        className="px-4 py-2 rounded-lg border border-gray-300  dark:border-gray-800 bg-white  dark:bg-gray-900 text-gray-900  dark:text-gray-100 shadow-sm"
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

    const formatMonthLabel = (calendar: any) => {
        const raw = `${calendar.month ?? "Month"} ${calendar.year ?? ""}`.trim();
        return raw.replace(/\s+\d{4}\s+\d{4}$/g, "");
    };

    const formatDateLabel = (date: Date) => {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        return date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
    };

    const getDaysRemaining = (date: Date) => {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return Math.max(0, Math.round((target.getTime() - start.getTime()) / 86400000));
    };

    const getEventMeta = (event: any) => {
        if (event.type === "exam") return { label: "Exam", dot: "bg-orange-500", badge: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300" };
        if (event.type === "moodle" || event.type === "homework") return { label: "Assignment", dot: "bg-purple-500", badge: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300" };
        if (event.type === "od") return { label: "OD", dot: "bg-blue-500", badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300" };
        if (event.type === "attendance" && event.isAbsent) return { label: "Missed", dot: "bg-red-500", badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" };
        if (event.type === "attendance") return { label: "Class", dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" };
        if (isHolidayEvent(event)) return { label: "Holiday", dot: "bg-red-500", badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" };
        if (isInstructionalEvent(event)) return { label: "Day Type", dot: "bg-gray-400", badge: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300" };
        return { label: "Event", dot: "bg-gray-400", badge: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300" };
    };

    const EventTypePill = ({ event, compact = false }: { event: any, compact?: boolean }) => {
        const meta = getEventMeta(event);
        return (
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${meta.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
            </span>
        );
    };

    const getEventPriority = (event: any) => {
        if (event.type === "exam") return 0;
        if (event.type === "moodle" || event.type === "homework") return 1;
        if (event.type === "attendance" && event.isAbsent) return 2;
        if (event.type === "od") return 3;
        if (isHolidayEvent(event)) return 4;
        if (isInstructionalEvent(event)) return 5;
        if (event.type === "attendance") return 6;
        return 7;
    };

    const isWorkingOnlyEvent = (event: any) => isInstructionalEvent(event) && !["attendance", "exam", "moodle", "homework", "od", "event"].includes(event.type);

    const getCellPrimaryEvent = (events: any[]) => {
        const important = events.filter(event => !isWorkingOnlyEvent(event));
        return [...(important.length ? important : events)].sort((a, b) => getEventPriority(a) - getEventPriority(b))[0];
    };

    const getEventTitle = (event: any) => {
        if (event.type === "exam" && event.text) return String(event.text).replace(/^\[[^\]]+\]\s*/, "");
        if (event.type === "moodle" && event.text) return String(event.text).replace(/^\[Moodle\]\s*/, "");
        if (event.type === "homework") return event.category || String(event.text || "").replace(/^\[HW\]\s*/, "");
        if (isInstructionalEvent(event)) {
            const value = event.category || event.text || "Working Day";
            return String(value).replace(/instructional day/ig, "Working Day");
        }
        return event.courseTitle || event.text || getEventMeta(event).label;
    };

    const getEventTimeLabel = (event: any) => {
        const text = `${event.category || ""} ${event.text || ""}`;
        const match = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[-|]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?/i);
        if (match) return match[0].replace(/\s+/g, " ").trim();
        if (isHolidayEvent(event) || isInstructionalEvent(event)) return "Day";
        return "All day";
    };

    const getTooltipGroups = (events: any[]) => {
        const dayTypeEvents = events.filter(e => isHolidayEvent(e) || isInstructionalEvent(e));
        const classEvents = events.filter(e => e.type === "attendance" || e.type === "od");
        const assessmentEvents = events.filter(e => e.type === "exam" || e.type === "moodle" || e.type === "homework");
        const otherEvents = events.filter(e =>
            e.type !== "attendance" &&
            e.type !== "od" &&
            e.type !== "exam" &&
            e.type !== "moodle" &&
            e.type !== "homework" &&
            !isHolidayEvent(e) &&
            !isInstructionalEvent(e)
        );

        return [
            ["Day Type", dayTypeEvents],
            ["Classes", classEvents],
            ["Assessments", assessmentEvents],
            ["Events", otherEvents],
        ].filter(([, items]: any) => items.length > 0);
    };

    const getHiddenSummary = (hiddenEvents: any[]) => {
        const meaningful = hiddenEvents.filter(event => !isWorkingOnlyEvent(event));
        const source = meaningful.length ? meaningful : hiddenEvents;
        if (!source.length) return "";
        const pluralLabels: Record<string, string> = {
            Assignment: "Assignments",
            Exam: "Exams",
            OD: "ODs",
            Class: "Classes",
            Missed: "Missed",
            Holiday: "Holidays",
            Event: "Events",
        };
        const counts = source.reduce((acc: Record<string, number>, event: any) => {
            const meta = getEventMeta(event);
            const key = pluralLabels[meta.label] || `${meta.label}s`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const [label, count] = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
        return count === source.length ? `${label} +${count}` : `${source.length} more events`;
    };

    const groupedTasks = next3Moodle.reduce((acc: Record<string, any[]>, item: any) => {
        const label = formatDateLabel(item.d);
        acc[label] = acc[label] || [];
        acc[label].push(item);
        return acc;
    }, {});
    const presentCount = Math.max(totalClassesCount - totalMissedDaysCount, 0);
    const attendanceRate = totalClassesCount > 0 ? Math.round((presentCount / totalClassesCount) * 100) : 0;
    const isMoodleConnected = Boolean(moodleData?.length || IDs?.MoodleUsername || IDs?.MoodlePassword);

    return (
        <>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 overflow-x-hidden pb-20">
            <PageHeader
                icon={<CalendarIcon className="w-5.5 h-5.5 text-blue-605 dark:text-blue-400" />}
                title="Super Calendar"
                meta={
                    <Badge variant="default" className="rounded-xl border border-gray-200 font-semibold  dark:border-gray-800">
                        {CALENDAR_TYPES[calendarType || "ALL"]}
                    </Badge>
                }
                actions={
                    <>
                        <button
                            onClick={() => setActiveAttendanceSubTab?.("circulars")}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors shadow-sm text-[11px] uppercase tracking-wider cursor-pointer"
                        >
                            <FileText size={16} /> <span>Circulars</span>
                        </button>
                        <button
                            onClick={generateCalendarICS}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100/85 hover:bg-gray-200/80 text-gray-700 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-gray-200 border border-gray-200/60 dark:border-gray-700/60 font-extrabold text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            <Download size={16} /> <span>Sync .ics</span>
                        </button>
                        <button
                            onClick={() => handleCalendarFetch(calendarType || "ALL")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100/85 hover:bg-gray-200/80 text-gray-700 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-gray-200 border border-gray-200/60 dark:border-gray-700/60 transition-colors cursor-pointer"
                            aria-label="Refresh calendar"
                        >
                            <RefreshCcw size={16} />
                        </button>
                    </>
                }
            />

            <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4">
                <div className="flex w-full snap-x gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:justify-center md:overflow-visible">
                    {safeCalendars.map((calendar, idx) => (
                        <button
                            key={calendar.id || idx}
                            onClick={() => setActiveIdx(idx)}
                            className={`shrink-0 snap-center rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors duration-150 ${
                                idx === activeIdx
                                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50   dark:text-gray-300 dark:hover:bg-gray-800 dark:border-gray-800 dark:bg-black"
                            }`}
                        >
                            {formatMonthLabel(calendar)}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-gray-500  dark:text-gray-400">
                    {[
                        ["bg-emerald-500", "Class"],
                        ["bg-orange-500", "Exam"],
                        ["bg-purple-500", "Assignment"],
                        ["bg-blue-500", "OD"],
                        ["bg-red-500", "Holiday"],
                    ].map(([dot, label]) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                            {label}
                        </span>
                    ))}
                </div>

                <div className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm   dark:border-gray-800 dark:bg-black">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeIdx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="w-full"
                        >
                            <div className="grid w-full grid-cols-7 text-center">
                                {weekdays.map((day) => (
                                    <div
                                        key={day}
                                        className="border-b border-gray-100 bg-gray-50/70 py-3 text-xs font-bold uppercase tracking-wider text-gray-500   dark:text-gray-400 dark:border-gray-800 dark:bg-gray-900/40"
                                    >
                                        {day}
                                    </div>
                                ))}

                                {blanks.map((_, i) => (
                                    <div key={`blank-${i}`} className="min-h-20 border-b border-r border-gray-100 bg-gray-50/30  dark:bg-gray-900/20 dark:border-gray-800/50" />
                                ))}

                                {daysInMonth.map((dateObj, i) => {
                                    const date = dateObj.getDate();
                                    const dayInfo = Array.isArray(activeCalendar.days)
                                        ? activeCalendar.days.find((d) => Number(d.date) === date)
                                        : undefined;
                                    const events = dayInfo?.events || [];
                                    const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();
                                    const isSelected = selectedDay && selectedDay.date === date;
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                    const hasHoliday = events.some(isHolidayEvent);
                                    const hasInstructional = events.some(isInstructionalEvent);
                                    const hasExam = events.some(e => e.type === "exam");
                                    const hasMoodle = events.some(e => e.type === "moodle" || e.type === "homework");
                                    const isEmpty = events.length === 0;

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

                                    const priorityEvent = getCellPrimaryEvent(events);
                                    const priorityMeta = priorityEvent ? getEventMeta(priorityEvent) : null;
                                    const hiddenEvents = priorityEvent ? events.filter((event) => event !== priorityEvent) : [];
                                    const hiddenSummary = getHiddenSummary(hiddenEvents);
                                    let tooltipShownCount = 0;
                                    const tooltipPreviewGroups = getTooltipGroups([...events].sort((a, b) => getEventPriority(a) - getEventPriority(b)))
                                        .map(([label, items]: any) => {
                                            const availableSlots = Math.max(0, 6 - tooltipShownCount);
                                            const visibleItems = items.slice(0, availableSlots);
                                            tooltipShownCount += visibleItems.length;
                                            return [label, visibleItems];
                                        })
                                        .filter(([, items]: any) => items.length > 0);
                                    const tooltipMoreCount = Math.max(events.length - tooltipShownCount, 0);

                                    const dayTone = dayType === "holiday"
                                        ? "text-red-600 dark:text-red-400"
                                        : dayType === "instructional"
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : dayType === "semiholiday"
                                                ? "text-amber-700 dark:text-amber-400"
                                                : "text-gray-700 dark:text-gray-300";

                                    const isLastCol = (blanksCount + i + 1) % 7 === 0;

                                    return (
                                        <button
                                            key={date}
                                            onClick={() => setSelectedDay({ date, dayType, events, fullDate: dayInfo?.fullDate || dateObj })}
                                            className={`group relative flex min-h-20 cursor-pointer flex-col border-b border-r border-gray-100 p-2 text-left transition-[background-color,box-shadow,transform] duration-150 hover:z-20 hover:bg-gray-50 dark:hover:bg-gray-900/30 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:focus:ring-blue-400 sm:min-h-28 sm:p-3 lg:min-h-32 ${
                                                isWeekend ? "bg-gray-50/70  dark:bg-gray-900/25" : "bg-white  dark:bg-black"
                                            } ${isLastCol ? "border-r-0" : ""}  dark:border-gray-800/50 ${
                                                isSelected ? "z-10 ring-2 ring-inset ring-blue-600 dark:ring-blue-400" : ""
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={`inline-flex h-7 min-w-7 items-center gap-1 rounded-xl px-1.5 text-sm font-black ${
                                                    isToday
                                                        ? "bg-blue-600 text-white"
                                                        : dayTone
                                                }`}>
                                                    {date}
                                                    {priorityMeta && <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`} />}
                                                </span>
                                            </div>

                                            <div className="mt-3 hidden flex-1 flex-col gap-1 overflow-hidden sm:flex">
                                                {priorityMeta && priorityEvent && (
                                                    <EventTypePill event={priorityEvent} compact />
                                                )}
                                                {hiddenSummary && (
                                                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{hiddenSummary}</span>
                                                )}
                                            </div>

                                            {events.length > 0 && (
                                                <div className={`pointer-events-none absolute left-3 top-12 z-50 hidden w-64 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-lg group-hover:block   dark:border-gray-800 dark:bg-black ${isLastCol ? "right-3 left-auto" : ""}`}>
                                                    <p className="text-xs font-black text-gray-900 dark:text-gray-100">
                                                        {dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "long" })}
                                                    </p>
                                                    <div className="mt-3 space-y-2.5">
                                                        {tooltipPreviewGroups.map(([label, items]: any) => (
                                                            <div key={label} className="space-y-1.5">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
                                                                {items.map((event: any, idx: number) => (
                                                                    <div key={`${label}-${event.text}-${idx}`} className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                                                        <EventTypePill event={event} compact />
                                                                        <span className="truncate">{getEventTitle(event)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                        {tooltipMoreCount > 0 && (
                                                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500">{tooltipMoreCount} more events</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </section>

            <section className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm   dark:border-gray-800 dark:bg-black md:p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                    <Award size={18} />
                                </div>
                                <div>
                                    <h3 className="font-[family-name:var(--font-outfit)] text-xl font-black text-gray-900  dark:text-gray-100">Attendance Overview</h3>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{totalClassesCount} classes tracked</p>
                                </div>
                            </div>
                            <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Attendance</p>
                                    <p className="mt-1 text-4xl font-black text-gray-950 dark:text-gray-50">{attendanceRate}%</p>
                                    <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{presentCount} / {totalClassesCount} present</p>
                                </div>
                                <div className="min-w-[220px] flex-1">
                                    <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div
                                            className="h-full rounded-full bg-blue-600 transition-all duration-200"
                                            style={{ width: `${attendanceRate}%` }}
                                        />
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                        {[
                                            ["Present", presentCount, "text-emerald-600 dark:text-emerald-400"],
                                            ["Missed", totalMissedDaysCount, "text-red-600 dark:text-red-400"],
                                            ["OD Hours", totalODHours, "text-blue-600 dark:text-blue-400"],
                                            ["Valid OD", validODsCount, "text-gray-900 dark:text-gray-100"],
                                            ["Recovered", recoveredODsCount, "text-purple-600 dark:text-purple-400"],
                                        ].map(([label, value, color]) => (
                                            <div key={label as string}>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
                                                <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowOverallTracker(true)}
                            className="group flex min-w-0 items-center justify-between gap-5 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 text-left transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/60 dark:border-gray-800 dark:bg-gray-950/30 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20 lg:w-80"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-black text-gray-900 dark:text-gray-100">Attendance Timeline</p>
                                <p className="mt-1 text-xs font-medium leading-5 text-gray-500 dark:text-gray-400">View heatmap, recovered classes and attendance history</p>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm   dark:border-gray-800 dark:bg-black">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                <CalendarIcon size={18} />
                            </div>
                            <div>
                                <h3 className="font-[family-name:var(--font-outfit)] text-lg font-black text-gray-900  dark:text-gray-100">Day Details</h3>
                                <p className="text-sm font-medium text-gray-500  dark:text-gray-400">
                                    {selectedDay ? `${selectedDay.date} ${activeCalendar.month ?? ""}` : "Select a day"}
                                </p>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedDay ? `${selectedDay.fullDate instanceof Date ? selectedDay.fullDate.getTime() : selectedDay.date}` : "empty"}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                          >
                            {!selectedDay ? (
                              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 dark:border-gray-800">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:text-gray-500 dark:bg-gray-950/50">
                                      <CalendarIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Select a day</h4>
                                      <p className="mt-0.5 text-xs text-gray-550 dark:text-gray-400">View schedule, classes, exams and events.</p>
                                  </div>
                              </div>
                            ) : selectedDay.events.length === 0 ? (
                              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 dark:border-gray-800">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:text-gray-500 dark:bg-gray-950/50">
                                      <CalendarIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">No events scheduled</h4>
                                      <p className="mt-0.5 text-xs text-gray-550 dark:text-gray-400">Nothing on this day.</p>
                                  </div>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-4">
                                  {(() => {
                                      const uniqueByTitle = (items: any[]) => {
                                          const seen = new Set<string>();
                                          return items.filter((item) => {
                                              const key = `${getEventMeta(item).label}-${getEventTitle(item)}`.toLowerCase();
                                              if (seen.has(key)) return false;
                                              seen.add(key);
                                              return true;
                                          });
                                      };

                                      const dayTypeItems = uniqueByTitle(selectedDay.events.filter((e: any) => isHolidayEvent(e) || isInstructionalEvent(e)));
                                      const classItems = uniqueByTitle(selectedDay.events.filter((e: any) => e.type === "attendance" || e.type === "od"));
                                      const assessmentItems = uniqueByTitle(selectedDay.events.filter((e: any) => e.type === "exam" || e.type === "moodle" || e.type === "homework"));
                                      const eventItems = uniqueByTitle(selectedDay.events.filter((e: any) =>
                                          e.type !== "attendance" &&
                                          e.type !== "od" &&
                                          e.type !== "exam" &&
                                          e.type !== "moodle" &&
                                          e.type !== "homework" &&
                                          !isHolidayEvent(e) &&
                                          !isInstructionalEvent(e)
                                      ));

                                      const renderActions = (e: any) => {
                                          const canAddHomework = e.type === "attendance" || e.type === "od";
                                          return (
                                              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                                  {e.hidden && <EyeOff size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />}
                                                  {canAddHomework && (
                                                      <button
                                                          onClick={() => addHomework(e.courseTitle || e.text, selectedDay.date, selectedDay.fullDate)}
                                                          className="rounded-xl border border-gray-200 bg-white p-1.5 text-gray-600 transition-colors duration-150 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                                          title="Add Homework for this Class"
                                                      >
                                                          <Plus size={14} />
                                                      </button>
                                                  )}
                                                  {e.type === "moodle" && e.url && !e.hidden && (
                                                      <a href={e.url} target="_blank" rel="noreferrer" className="rounded-xl border border-gray-200 bg-white p-1.5 text-purple-600 transition-colors duration-150 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-purple-400 dark:hover:bg-gray-800">
                                                          <BookOpen size={14} />
                                                      </a>
                                                  )}
                                              </div>
                                          );
                                      };

                                      return (
                                          <>
                                              {dayTypeItems.length > 0 && (
                                                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                                                      <div className="flex flex-wrap gap-2">
                                                          {dayTypeItems.map((e: any, i: number) => (
                                                              <span key={`${e.text}-${i}`} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                                                                  <span className={`h-1.5 w-1.5 rounded-full ${getEventMeta(e).dot}`} />
                                                                  {getEventTitle(e)}
                                                              </span>
                                                          ))}
                                                      </div>
                                                  </div>
                                              )}

                                              {classItems.length > 0 && (
                                                  <div className="space-y-2">
                                                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-405 dark:text-gray-500">Classes</h4>
                                                      <div className="space-y-1.5">
                                                          {classItems.map((e: any, i: number) => (
                                                              <div key={`${e.text}-${i}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-950/30">
                                                                  <span className={`h-2 w-2 shrink-0 rounded-full ${getEventMeta(e).dot}`} />
                                                                  <p className={`min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-gray-100 ${e.hidden ? "line-through opacity-60" : ""}`}>{getEventTitle(e)}</p>
                                                                  <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-gray-500">{e.category || "Present"}</span>
                                                                  {renderActions(e)}
                                                              </div>
                                                          ))}
                                                      </div>
                                                  </div>
                                              )}

                                              {assessmentItems.length > 0 && (
                                                  <div className="space-y-2">
                                                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-405 dark:text-gray-500">Assessments</h4>
                                                      {assessmentItems.map((e: any, i: number) => (
                                                          <div key={`${e.text}-${i}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-950/30">
                                                              <EventTypePill event={e} compact />
                                                              <p className={`min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-gray-100 ${e.hidden ? "line-through opacity-60" : ""}`}>{getEventTitle(e)}</p>
                                                              {renderActions(e)}
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}

                                              {eventItems.length > 0 && (
                                                  <div className="space-y-2">
                                                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-405 dark:text-gray-500">Events</h4>
                                                      {eventItems.map((e: any, i: number) => (
                                                          <div key={`${e.text}-${i}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-950/30">
                                                              <EventTypePill event={e} compact />
                                                              <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-gray-100">{getEventTitle(e)}</p>
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </>
                                      );
                                  })()}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm   dark:border-gray-800 dark:bg-black">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                                    <BookOpen size={18} />
                                </div>
                                <h3 className="font-[family-name:var(--font-outfit)] text-xl font-black text-gray-900  dark:text-gray-100">Upcoming Tasks</h3>
                            </div>
                        </div>

                        {!isMoodleConnected ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Not connected</p>
                                    <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Connect Moodle to sync assignments.</p>
                                </div>
                                <button
                                    onClick={() => setShowMoodleModal(true)}
                                    className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-blue-700"
                                >
                                    Connect Moodle
                                </button>
                            </div>
                        ) : next3Moodle.length === 0 ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 dark:border-gray-800">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">All caught up</p>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">No upcoming tasks or assignments.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(Object.entries(groupedTasks) as [string, any[]][]).map(([label, items]) => (
                                    <div key={label} className="relative pl-5">
                                        <div className="absolute left-1 top-2 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
                                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
                                        <div className="space-y-2">
                                            {items.map((md: any, i: number) => (
                                                <div key={i} className="relative rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                                                    <span className="absolute -left-[19px] top-4 h-2 w-2 rounded-full bg-purple-500" />
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className={`truncate text-sm font-bold text-gray-900 dark:text-gray-100 ${md.hidden ? "line-through opacity-60" : ""}`}>{md.name.split("/").pop()}</p>
                                                            <p className="mt-1 truncate text-xs font-medium text-gray-500 dark:text-gray-400">{md.type === "homework" ? md.courseName : (md.name.split("/")[1] || md.name)}</p>
                                                        </div>
                                                        {md.type === "homework" && (
                                                            <button onClick={() => toggleHomework(md.id)} className="shrink-0 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition-colors duration-150 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300">
                                                                Done
                                                            </button>
                                                        )}
                                                        {md.type === "moodle" && !md.hidden && md.url && (
                                                            <a href={md.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-gray-200 bg-white p-2 text-purple-600 transition-colors duration-150 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-purple-400 dark:hover:bg-gray-950">
                                                                <ChevronRight size={16} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm   dark:border-gray-800 dark:bg-black">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                                <GraduationCap size={18} />
                            </div>
                            <h3 className="font-[family-name:var(--font-outfit)] text-xl font-black text-gray-900  dark:text-gray-100">Upcoming Exams</h3>
                        </div>
                        <button
                            onClick={() => toggleSchedulePage(true)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors duration-150 hover:text-blue-700 dark:text-blue-400"
                        >
                            Schedule <ChevronRight size={16} />
                        </button>
                    </div>

                    {next3Exams.length === 0 ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 dark:border-gray-800">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">No exams scheduled</p>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">You're all caught up.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            {next3Exams.map((ex, i) => {
                                const daysLeft = getDaysRemaining(ex.d);
                                return (
                                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                                        <div className="w-16 shrink-0 text-center">
                                            <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">{ex.type}</p>
                                            <p className="mt-1 text-sm font-black text-gray-900 dark:text-gray-100">{ex.d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                                        </div>
                                        <div className="min-w-0 flex-1 border-l border-gray-200 pl-3 dark:border-gray-800">
                                            <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{ex.courseTitle}</p>
                                            <p className="mt-1 truncate text-xs font-medium text-gray-500 dark:text-gray-400">{ex.courseCode} · {ex.examTime} · {ex.venue}</p>
                                        </div>
                                        <Badge variant={daysLeft <= 3 ? "warning" : "default"} className="shrink-0 rounded-xl font-bold">
                                            {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>

        <Modal
            isOpen={showMoodleModal}
            onClose={() => setShowMoodleModal(false)}
            title="Connect Moodle"
            maxWidth="max-w-md"
        >
            <div className="space-y-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Sign in once to sync assignments into the calendar.
                </p>
                <MoodleUserPassForm handleFetchMoodle={handleFetchMoodle} IDs={IDs} />
            </div>
        </Modal>
        
        <AnimatePresence>
            {showOverallTracker && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed inset-0 z-[100] bg-white  dark:bg-black overflow-y-auto"
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
