"use client"

import { useEffect, useState, useMemo } from "react";
import { Building2, Clock, User, Star, Calendar, Calendar as CalendarIcon, AlertCircle, CheckCircle2, FileText, List, Grid3x3 } from "lucide-react"
import ExpandableSection from "../shared/ExpandableSection"
import ViewModeToggle from "../shared/ViewModeToggle"
import CircularProgress from "../shared/CircularProgress"
import HeatMap from "@uiw/react-heat-map";
import AttendanceCalendarView from "./AttendanceCalendarView";
import SubpageLayout from "../shared/SubpageLayout";
import Badge from "../shared/Badge";

type CalendarEvent = {
    text: string;
    type: "working" | "holiday";
    color: string;
    category?: string;
};

type RemainingClassDay = {
    date: number;
    weekday: string;
    type: string;
    events?: CalendarEvent[];
    fullDate: Date;
};

const normalize = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
};

export function countRemainingClasses(courseCode, slotTime, dayCardsMap, calendarMonths, fromDate = new Date()): RemainingClassDay[] | null {
    if (!courseCode || !dayCardsMap || !calendarMonths) return null;

    const daysWithSubject = Object.keys(dayCardsMap).filter(day =>
        dayCardsMap[day].some(c => c.courseCode === courseCode)
    );
    if (daysWithSubject.length === 0) return null;

    const normalizeDay = (d) => d.slice(0, 3).toUpperCase();
    const subjectDays = daysWithSubject.map(normalizeDay);

    const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ];

    let startHour = 8, startMinute = 0;
    if (slotTime && slotTime.includes("-")) {
        const [start] = slotTime.split("-");
        const [hRaw, mRaw] = start.split(":");
        let h = Number(hRaw);
        const m = Number(mRaw) || 0;
        if (h >= 8 && h <= 11) {
        } else if (h === 12) {
            h = 12;
        } else if (h >= 1 && h <= 7) {
            h += 12;
        }
        startHour = h;
        startMinute = m;
    }

    const allDays = calendarMonths.flatMap(monthObj => {
        const monthStr = monthObj.month?.toString().toLowerCase() || "";
        const year = monthObj.year || new Date().getFullYear();

        const foundMonth = monthNames.find(m => monthStr.includes(m));
        const mIndex = foundMonth ? monthNames.indexOf(foundMonth) : -1;

        return (monthObj.days || []).map(day => {
            const fullDate = mIndex === -1 ? null : new Date(year, mIndex, day.date);
            const weekday = fullDate
                ? fullDate.toLocaleString("en-US", { weekday: "short" })
                : "";

            return { ...day, fullDate, weekday };
        });
    });

    const remainingWorkingDays = allDays.filter((d) => {
        if (!d || !d.fullDate || isNaN(d.fullDate.getTime())) return false;

        const isWorkingDay =
            d.type?.toLowerCase() === "working" ||
            (d.events?.some(ev =>
                ev.text?.toLowerCase() === "instructional day" ||
                ev.text?.toLowerCase().includes("working")
            ));

        if (!isWorkingDay) return false;

        let effectiveDay = normalizeDay(d.weekday || "");
        if (effectiveDay === "SAT" && Array.isArray(d.events)) {
            const dayOrderMap = {
                "monday": "MON",
                "tuesday": "TUE",
                "wednesday": "WED",
                "thursday": "THU",
                "friday": "FRI",
            };

            const found = d.events.find(ev =>
                /monday|tuesday|wednesday|thursday|friday/i.test(ev.category || ev.text)
            );

            if (found) {
                const match = found.category?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i) ||
                    found.text?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i);
                if (match) effectiveDay = dayOrderMap[match[1].toLowerCase()];
            }
        }

        if (!subjectDays.includes(effectiveDay)) return false;

        const classTime = new Date(d.fullDate);
        classTime.setHours(startHour, startMinute, 0, 0);
        if (classTime < fromDate) return false;

        return true;
    });

    return remainingWorkingDays;
}

function getEffectiveState(
    time: number,
    dateStates: Record<number, number>,
    attendanceLockDates?: Set<number>
): number {
    if (dateStates[time] !== undefined) return dateStates[time];
    if (attendanceLockDates?.has(time)) return 2; // default ignored
    return 0; // default attending
}

function UpcomingClassesList({ classes, attendedClasses = 0, totalClasses = 0, isLab = false, impDates, isDayscholarWithBus }) {
    const [dayStates, setDayStates] = useState<Record<number, number>>({});
    const CLASS_WEIGHT = isLab ? 2 : 1;

    if (!classes || classes.length === 0) {
        return (
            <p className="text-gray-500 dark:text-gray-400 midnight:text-gray-400 text-xs text-center py-4">
                No upcoming classes 🎉
            </p>
        );
    }

    const lockDates = useMemo(() => {
        const locked = new Set<number>();
        if (!classes || classes.length === 0) return locked;

        const isThuOrFri = (d: Date) => {
            const day = d.getDay();
            return day === 4 || day === 5;
        };

        const lastTwo = classes.slice(-2);

        lastTwo.forEach(day => {
            const d = day.fullDate;
            if (isThuOrFri(d) && (impDates.lidLabDate - d > 7)) {
                locked.add(normalize(d));
            }
        });

        return locked;
    }, [classes, impDates]);

    const toggleAttendance = (time: number) => {
        setDayStates(prev => {
            const effectiveState = getEffectiveState(time, prev, lockDates);
            const nextState = (effectiveState + 1) % 3;
            return { ...prev, [time]: nextState };
        });
    };

    let attending = 0;
    let missed = 0;

    classes.forEach(day => {
        const time = normalize(day.fullDate);
        const state = getEffectiveState(time, dayStates, lockDates);

        if (state === 0) attending += CLASS_WEIGHT;
        if (state === 1) missed += CLASS_WEIGHT;
    });

    const upcomingCount = (attending + missed);
    const predictedAttended = attendedClasses + attending;
    const predictedTotal = totalClasses + upcomingCount;
    const predictedPercent: number = predictedTotal > 0 ? parseFloat(((predictedAttended / predictedTotal) * 100).toFixed(1)) : 0;

    const thresholdPct = isDayscholarWithBus ? 85 : 75;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium bg-gray-50 dark:bg-slate-800/50 midnight:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                <div className="flex gap-4">
                    <span className="text-emerald-600 dark:text-emerald-400">Attending: <strong>{attending}</strong></span>
                    <span className="text-red-500 dark:text-red-400">Skipping: <strong>{missed}</strong></span>
                </div>
                <div className={`px-3 py-1 rounded-full border ${predictedPercent >= thresholdPct ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50 midnight:bg-emerald-900/30 midnight:text-emerald-400 midnight:border-emerald-800/50" : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50 midnight:bg-red-900/30 midnight:text-red-400 midnight:border-red-800/50"}`}>
                    Predicted: {predictedPercent}%
                </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 text-xs">
                {classes.map((day, i) => {
                    const time = normalize(day.fullDate);
                    const state = getEffectiveState(time, dayStates, lockDates);
                    const d = new Date(day.fullDate);
                    const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
                    
                    const isSkipped = state === 1;
                    const isIgnored = state === 2;

                    return (
                        <div
                            key={i}
                            onClick={() => toggleAttendance(time)}
                            className={`flex flex-col items-center justify-center rounded-xl border p-3 shadow-sm cursor-pointer select-none transform-gpu transition-all duration-200 ease-in-out hover:scale-[1.02] active:scale-[0.98] ${
                                isSkipped ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50 midnight:bg-red-950 midnight:border-red-900" : 
                                isIgnored ? "bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700 midnight:bg-gray-900 midnight:border-gray-800 opacity-60" : 
                                "bg-white border-gray-200 dark:bg-slate-800 dark:border-gray-700 midnight:bg-gray-950 midnight:border-gray-800"
                            }`}
                        >
                            <span className={`font-bold text-sm ${isSkipped ? "text-red-700 dark:text-red-400 midnight:text-red-400" : "text-gray-800 dark:text-gray-200 midnight:text-gray-200"}`}>{dateStr}</span>
                            <span className={`text-[10px] uppercase tracking-wider font-semibold mt-1 ${isSkipped ? "text-red-500 dark:text-red-500 midnight:text-red-500" : "text-gray-500 dark:text-gray-400 midnight:text-gray-400"}`}>{weekday}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border border-gray-300 dark:bg-slate-800 dark:border-gray-600 midnight:bg-gray-900 midnight:border-gray-700"></div>Attending</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-100 border border-red-300 dark:bg-red-900/40 dark:border-red-800 midnight:bg-red-900/40 midnight:border-red-800"></div>Skipping</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 midnight:bg-gray-800 midnight:border-gray-700"></div>Ignored</div>
            </div>
        </div>
    );
}

export default function AttendanceSubpage({ a, onBack, dayCardsMap, analyzeCalendars, impDates, decimalValues, isDayscholarWithBus }) {
    const lab = a.courseCode.endsWith("(L)");
    const isTheory = a.courseCode.endsWith("(T)");

    const [filter, setFilter] = useState("All"); // All, Present, Absent, On Duty
    const [viewMode, setViewMode] = useState<"list" | "heatmap" | "calendar">("list");
    const [notesTracker, setNotesTracker] = useState({});

    // Load notes tracker from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("uniCC_notes_tracker");
            if (saved) {
                setNotesTracker(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load notes tracker", e);
        }
    }, []);

    const toggleNotes = (dateStr) => {
        const key = a.courseCode;
        setNotesTracker(prev => {
            const newState = {
                ...prev,
                [key]: {
                    ...(prev[key] || {}),
                    [dateStr]: !(prev[key]?.[dateStr])
                }
            };
            localStorage.setItem("uniCC_notes_tracker", JSON.stringify(newState));
            return newState;
        });
    };

    const countTillDate = (endDate): RemainingClassDay[] | null => {
        if (!endDate) return null;
        const endMid = new Date(endDate);
        endMid.setHours(23, 59, 59, 999);

        const filteredMonths = analyzeCalendars.map((monthObj) => ({
            ...monthObj,
            days: monthObj.days.filter((d) => {
                if (!d.date || !d.weekday) return false;
                const monthStr = monthObj.month?.toLowerCase() || "";
                const mIndex = [
                    "january", "february", "march", "april", "may", "june",
                    "july", "august", "september", "october", "november", "december"
                ].findIndex((m) => monthStr.includes(m));

                const dFull = new Date(monthObj.year, mIndex, d.date);
                dFull.setHours(0, 0, 0, 0);
                return dFull <= endMid;
            }),
        }));

        return countRemainingClasses(a.courseCode, a.time, dayCardsMap, filteredMonths, new Date());
    };

    let classesTillCAT1: RemainingClassDay[] | null = null;
    let classesTillCAT2: RemainingClassDay[] | null = null;
    let classesTillMidSem: RemainingClassDay[] | null = null;
    let classesTillLID: RemainingClassDay[] | null = null;

    if (Array.isArray(analyzeCalendars) && analyzeCalendars.length > 0) {
        const allMonthsAreHolidays = analyzeCalendars.every(month => month?.summary?.working === 0);
        if (!allMonthsAreHolidays) {
            if (lab) {
                classesTillCAT1 = countTillDate(impDates.cat1Date);
                classesTillCAT2 = countTillDate(impDates.cat2Date);
                classesTillMidSem = countTillDate(impDates.midsemStart);
                classesTillLID = countTillDate(impDates.lidLabDate);
            } else if (isTheory) {
                classesTillCAT1 = countTillDate(impDates.cat1Date);
                classesTillCAT2 = countTillDate(impDates.cat2Date);
                classesTillMidSem = countTillDate(impDates.midsemStart);
                classesTillLID = countTillDate(impDates.lidTheoryDate);
            }
        }
    }

    const thresholdPct = isDayscholarWithBus ? 85 : 75;
    const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;
    
    // Process History
    const historyList = a.viewLink || [];
    const filteredHistory = historyList.filter(d => {
        if (filter === "All") return true;
        return d.status.toLowerCase() === filter.toLowerCase();
    });

    const isMissingNotes = (d) => {
        const status = d.status.toLowerCase();
        if (status === "present") return false;
        return !(notesTracker[a.courseCode]?.[d.date]);
    };

    const missingNotesCount = historyList.filter(d => d.status.toLowerCase() !== "present" && !notesTracker[a.courseCode]?.[d.date]).length;

    const hasPredictor = [classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID].some(data => Array.isArray(data) && data.length > 0);

    // Heatmap data prep
    const heatmapData = useMemo(() => {
        const dateMap: Record<string, { present: number; absent: number; od: number }> = {};
        
        historyList.forEach(d => {
            const dateObj = new Date(d.date);
            const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = { present: 0, absent: 0, od: 0 };
            }
            
            const status = d.status.toLowerCase();
            if (status === "present") dateMap[dateStr].present++;
            else if (status === "absent") dateMap[dateStr].absent++;
            else if (status === "on duty") dateMap[dateStr].od++;
        });

        return Object.entries(dateMap).map(([dateStr, counts]) => {
            let val = 0;
            let status = "";
            if (counts.absent > 0) {
                val = 2; // Red (Absent)
                status = "Absent";
            } else if (counts.od > 0) {
                val = 3; // Yellow (On Duty)
                status = "On Duty";
            } else if (counts.present > 0) {
                val = 1; // Green (Present)
                status = "Present";
            }
            return { date: dateStr, count: val, status };
        });
    }, [historyList]);
    
    // Calculate start date for heatmap (approx 5 months ago to cover the semester)
    const heatmapStartDate = useMemo(() => {
        if (analyzeCalendars && analyzeCalendars.length > 0) {
            const firstMonth = analyzeCalendars[0];
            const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(m => firstMonth.month?.toLowerCase().includes(m));
            if (mIndex !== -1) {
                return new Date(firstMonth.year, mIndex, 1);
            }
        }
        const date = new Date();
        date.setMonth(date.getMonth() - 5);
        return date;
    }, [analyzeCalendars]);

    const heatmapEndDate = useMemo(() => {
        if (analyzeCalendars && analyzeCalendars.length > 0) {
            const lastMonth = analyzeCalendars[analyzeCalendars.length - 1];
            const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(m => lastMonth.month?.toLowerCase().includes(m));
            if (mIndex !== -1) {
                return new Date(lastMonth.year, mIndex + 1, 0);
            }
        }
        return new Date();
    }, [analyzeCalendars]);

    return (
        <SubpageLayout
            title={a.courseTitle}
            subtitle={`${a.courseCode.slice(0, -3)} • ${a.courseCode.endsWith('(L)') ? "Lab" : "Theory"} • ${a.credits} Credits`}
            onBack={onBack}
        >

            {/* Badges Row */}
            <div className="flex flex-wrap gap-3 mb-8">
                <Badge variant="info" className="rounded-lg border border-blue-100 dark:border-blue-900/30 midnight:border-blue-900/40 gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400 midnight:text-blue-400" /> {a.slotName}
                </Badge>
                <Badge variant="purple" className="rounded-lg border border-purple-100 dark:border-purple-900/30 midnight:border-purple-900/40 gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-500 dark:text-purple-400 midnight:text-purple-400" /> {a.slotVenue}
                </Badge>
                <Badge variant="warning" className="rounded-lg border border-amber-100 dark:border-amber-900/30 midnight:border-amber-900/40 gap-1.5">
                    <Clock className="w-4 h-4 text-orange-500 dark:text-amber-400 midnight:text-amber-400" /> {a.time}
                </Badge>
                <Badge variant="success" className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 midnight:border-emerald-900/40 gap-1.5">
                    <User className="w-4 h-4 text-green-500 dark:text-emerald-400 midnight:text-emerald-400" /> {a.faculty}
                </Badge>
            </div>

            {/* Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Attendance Dial Card */}
                <div className="bg-white dark:bg-slate-800 midnight:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 flex items-center justify-between shadow-sm md:col-span-1">
                    <div>
                        <h3 className="text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-semibold uppercase tracking-wider text-xs mb-1">Attendance</h3>
                        <p className="text-3xl font-black text-gray-900 dark:text-gray-100 midnight:text-gray-100">{a.attendancePercentage}%</p>
                        <p className="text-sm text-gray-500 midnight:text-gray-400 font-medium mt-1">{a.attendedClasses} / {a.totalClasses} Classes</p>
                    </div>
                    <div className="w-24 h-24">
                        <CircularProgress
                            value={a.attendancePercentage}
                            text={`${!decimalValues ? a.attendancePercentage : (a.attendedClasses/a.totalClasses * 100).toFixed(1)}%`}
                            size={96}
                            threshold={thresholdPct}
                            midThreshold={thresholdPct + 10}
                        />
                    </div>
                </div>

                {/* Insights Card */}
                <div className="bg-white dark:bg-slate-800 midnight:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 shadow-sm md:col-span-2 flex flex-col justify-center">
                    <h3 className="text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-semibold uppercase tracking-wider text-xs mb-3">Status Insight</h3>
                    {a.totalClasses > 0 && (() => {
                        const attended = a.attendedClasses;
                        const total = a.totalClasses;
                        const percentage = (attended / total) * 100;

                        if (percentage < thresholdPct) {
                            const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
                            const neededValue = lab ? Math.ceil(needed / 2) : needed;

                            return (
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-red-100 dark:bg-red-900/30 midnight:bg-red-900/30 text-red-600 dark:text-red-400 midnight:text-red-400 rounded-xl">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Critical Status</p>
                                        <p className="text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-1">You need to attend <strong>{neededValue}</strong> more {lab ? "lab" : "class"}{neededValue > 1 && (lab ? "s" : "es")} consecutively to reach the safe {thresholdPct}% threshold.</p>
                                    </div>
                                </div>
                            );
                        } else {
                            const canMiss = Math.floor(attended / thresholdDec - total);
                            const canMissValue = lab ? Math.floor(canMiss / 2) : canMiss;

                            if (canMissValue === 0) {
                                return (
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 midnight:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400 rounded-xl">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">On the Edge</p>
                                            <p className="text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-1">You cannot afford to miss the next {lab ? "lab" : "class"}. Attend to build a safety buffer.</p>
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 midnight:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400 rounded-xl">
                                            <Star size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Safe Margin</p>
                                            <p className="text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-1">You can safely miss <strong>{canMissValue}</strong> {lab ? "lab" : "class"}{canMissValue !== 1 && (lab ? "s" : "es")} and still stay above the {thresholdPct}% threshold.</p>
                                        </div>
                                    </div>
                                );
                            }
                        }
                    })()}
                </div>
            </div>

            {/* Layout Split for Desktop (if predictor is visible) */}
            <div className={`grid grid-cols-1 gap-6 ${hasPredictor ? 'xl:grid-cols-3' : ''}`}>
                
                {/* Left Pane (Predictor) */}
                {hasPredictor && (
                    <div className="xl:col-span-2">
                        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full">
                            <div className="p-5 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Interactive Predictor</h2>
                                <p className="text-sm text-gray-500 midnight:text-gray-400">Tap on upcoming classes to see how skipping them affects your attendance before exams.</p>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 midnight:divide-gray-800">
                                {[
                                    { key: "CAT1", label: "Classes before CAT I", data: classesTillCAT1 },
                                    { key: "CAT2", label: "Classes before CAT II", data: classesTillCAT2 },
                                    { key: "MIDSEM", label: "Classes before Mid Term Test", data: classesTillMidSem },
                                    { key: "LID", label: "Classes before FAT", data: classesTillLID },
                                ].map(({ key, label, data }) => (
                                    Array.isArray(data) && data.length > 0 ? (
                                        <ExpandableSection
                                            key={key}
                                            title={label}
                                            icon={<CalendarIcon size={18} className="text-blue-500" />}
                                            badge={<span className="text-sm font-medium bg-gray-100 dark:bg-slate-800 midnight:bg-gray-800 px-2 py-0.5 rounded-md">{data.length} Left</span>}
                                        >
                                            <UpcomingClassesList
                                                classes={data}
                                                attendedClasses={a.attendedClasses}
                                                totalClasses={a.totalClasses}
                                                isLab={lab}
                                                impDates={impDates}
                                                isDayscholarWithBus={isDayscholarWithBus}
                                            />
                                        </ExpandableSection>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Pane (Attendance Log) */}
                <div className={`${hasPredictor ? "xl:col-span-1" : ""} min-w-0 w-full`}>
                    <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex items-center gap-2">
                                        Attendance Log
                                        {missingNotesCount > 0 && (
                                            <Badge variant="danger" className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 midnight:bg-red-900/30 midnight:text-red-400 font-bold">
                                                {missingNotesCount} Missing Notes
                                            </Badge>
                                        )}
                                    </h2>
                                    {!hasPredictor && <p className="text-sm text-gray-500 midnight:text-gray-400 mt-1">Track your past classes and secure notes for days you missed.</p>}
                                </div>
                                <ViewModeToggle
                                    options={[
                                        { key: "calendar", icon: <CalendarIcon size={18} /> },
                                        { key: "heatmap", icon: <Grid3x3 size={18} /> },
                                        { key: "list", icon: <List size={18} /> },
                                    ]}
                                    value={viewMode}
                                    onChange={(key) => setViewMode(key as "list" | "heatmap" | "calendar")}
                                    className="self-start sm:self-auto"
                                />
                            </div>

                            {/* Filters (only in list mode) */}
                            {viewMode === "list" && (
                                <div className="flex bg-gray-100 dark:bg-slate-800 midnight:bg-gray-900 p-1 rounded-lg overflow-x-auto hide-scrollbar w-max">
                                    {["All", "Present", "Absent", "On Duty"].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${filter === f ? "bg-white dark:bg-slate-700 midnight:bg-black text-gray-900 dark:text-gray-100 midnight:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 midnight:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 midnight:hover:text-gray-300"}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[450px] xl:max-h-[500px]">
                            {viewMode === "calendar" ? (
                                <div className="p-0 sm:p-4 w-full overflow-x-auto hide-scrollbar">
                                    <div className="min-w-[600px]">
                                        <AttendanceCalendarView 
                                            analyzeCalendars={analyzeCalendars} 
                                            historyList={historyList} 
                                            notesTracker={notesTracker}
                                            toggleNotes={toggleNotes}
                                            courseCode={a.courseCode}
                                            isOverall={false}
                                            toggleIndividualNote={() => {}}
                                        />
                                    </div>
                                </div>
                            ) : viewMode === "heatmap" ? (
                                <div className="p-6 flex justify-center w-full overflow-x-auto hide-scrollbar" style={{ direction: "rtl" }}>
                                    <div style={{ direction: "ltr", minWidth: "500px" }}>
                                        <HeatMap
                                            value={heatmapData}
                                            startDate={heatmapStartDate}
                                            endDate={heatmapEndDate}
                                            width={550}
                                            rectProps={{
                                                rx: 4,
                                                ry: 4,
                                            }}
                                            rectRender={(props, dayData) => {
                                                const data = dayData as any;
                                                const status = data.count === 1 ? "Present" : data.count === 2 ? "Absent" : data.count === 3 ? "On Duty" : "No Class";
                                                return (
                                                    <rect {...props}>
                                                        <title>{`${data.date}: ${status}`}</title>
                                                    </rect>
                                                );
                                            }}
                                            panelColors={{
                                                0: "rgba(156, 163, 175, 0.1)", // Empty/gray out
                                                1: "#10B981", // Present (Emerald)
                                                2: "#EF4444", // Absent (Red)
                                                3: "#EAB308", // On Duty (Yellow)
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400 midnight:text-gray-400">
                                    No records found for "{filter}".
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800 midnight:divide-gray-800">
                                    {filteredHistory.map((d, i) => {
                                        const status = d.status.toLowerCase();
                                        const isPresent = status === "present";
                                        const isAbsent = status === "absent";
                                        
                                        const hasNotes = notesTracker[a.courseCode]?.[d.date] === true;

                                        return (
                                            <div key={i} className="flex sm:items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 midnight:hover:bg-gray-900/30 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-2 h-10 rounded-full ${isPresent ? "bg-emerald-500" : isAbsent ? "bg-red-500" : "bg-yellow-500"}`}></div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{d.date}</p>
                                                        <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isPresent ? "text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400" : isAbsent ? "text-red-600 dark:text-red-400 midnight:text-red-400" : "text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400"}`}>
                                                            {d.status}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                {!isPresent && (
                                                    <button 
                                                        onClick={() => toggleNotes(d.date)}
                                                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                                                            hasNotes 
                                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400 midnight:bg-emerald-900/20 midnight:border-emerald-800/50 midnight:text-emerald-400" 
                                                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-slate-700 midnight:bg-gray-900 midnight:border-gray-800 midnight:text-gray-300 midnight:hover:bg-gray-800"
                                                        }`}
                                                    >
                                                        {hasNotes ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                                                        <span className="hidden sm:inline">{hasNotes ? "Secured" : "Get Notes"}</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SubpageLayout>
    );
}
