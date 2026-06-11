"use client"

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Clock, User, Star, AlertCircle, FileText, CheckCircle2, CalendarDays, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Calendar as CalendarIcon } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { countRemainingClasses } from "./AttendanceSubpage";
import "react-circular-progressbar/dist/styles.css";

const normalize = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
};

function getEffectiveState(
    time: number,
    dateStates: Record<number, number>,
    attendanceLockDates?: Set<number>
): number {
    if (dateStates[time] !== undefined) return dateStates[time];
    if (attendanceLockDates?.has(time)) return 2; // default ignored
    return 0; // default attending
}

interface UpcomingClassesListProps {
    classes: any[];
    attendedClasses: number;
    totalClasses: number;
    isLab: boolean;
    impDates: any;
    isDayscholarWithBus: boolean;
}

function UpcomingClassesList({
    classes,
    attendedClasses = 0,
    totalClasses = 0,
    isLab = false,
    impDates,
    isDayscholarWithBus
}: UpcomingClassesListProps) {
    const [dayStates, setDayStates] = useState<Record<number, number>>({});
    const CLASS_WEIGHT = isLab ? 2 : 1;

    // Reset simulator states when classes list changes
    useEffect(() => {
        setDayStates({});
    }, [classes]);

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
            if (isThuOrFri(d) && ((impDates.lidLabDate as any) - (d as any) > 7)) {
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
    const predictedPercent = predictedTotal > 0 
        ? parseFloat(((predictedAttended / predictedTotal) * 100).toFixed(1)) 
        : 0;

    const thresholdPct = isDayscholarWithBus ? 85 : 75;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium bg-gray-50 dark:bg-slate-800/40 midnight:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 midnight:border-gray-800/80 text-gray-800 dark:text-gray-200 midnight:text-gray-200">
                <div className="flex gap-4">
                    <span className="text-emerald-600 dark:text-emerald-400">Attending: <strong>{attending}</strong></span>
                    <span className="text-red-500 dark:text-red-400">Skipping: <strong>{missed}</strong></span>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-bold ${predictedPercent >= thresholdPct ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50 midnight:bg-emerald-950/20 midnight:text-emerald-400 midnight:border-emerald-800/50" : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50 midnight:bg-red-950/20 midnight:text-red-400 midnight:border-red-800/50"}`}>
                    Predicted: {predictedPercent}%
                </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5">
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
                            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center cursor-pointer select-none transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                                isSkipped 
                                    ? "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/50 midnight:bg-red-950/20 midnight:border-red-900/40 midnight:text-red-400" 
                                    : isIgnored 
                                        ? "bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-gray-400 midnight:text-gray-500 midnight:bg-gray-900 midnight:border-gray-800 opacity-50" 
                                        : "bg-white border-gray-200 dark:bg-slate-900 dark:border-gray-800 midnight:bg-black midnight:border-gray-800/80 text-gray-800 dark:text-gray-200 midnight:text-gray-300 hover:border-blue-400 midnight:hover:border-blue-500"
                            }`}
                        >
                            <span className={`font-bold text-xs ${isSkipped ? "text-red-700 dark:text-red-400 midnight:text-red-400" : "text-gray-800 dark:text-gray-200 midnight:text-gray-200"}`}>{dateStr}</span>
                            <span className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60 ${isSkipped ? "text-red-500" : "text-gray-500 dark:text-gray-400 midnight:text-gray-400"}`}>{weekday}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface DesktopCourseDetailProps {
    a: any;
    isDayscholarWithBus: boolean;
    decimalValues: boolean;
    results: any;
    dayCardsMap: any;
    impDates: any;
    onViewFullPage: () => void;
}

export default function DesktopCourseDetail({
    a,
    isDayscholarWithBus,
    decimalValues,
    results,
    dayCardsMap,
    impDates,
    onViewFullPage
}: DesktopCourseDetailProps) {
    const lab = a.courseCode.endsWith("(L)");
    const isTheory = a.courseCode.endsWith("(T)");
    const thresholdPct = isDayscholarWithBus ? 85 : 75;
    const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const toggleDropdown = (key: string) => setOpenDropdown(openDropdown === key ? null : key);

    // Calculate remaining classes till milestones
    const countTillDate = (endDate: any) => {
        if (!endDate || !results) return [];
        const endMid = new Date(endDate);
        endMid.setHours(23, 59, 59, 999);

        const filteredMonths = results.map((monthObj: any) => ({
            ...monthObj,
            days: monthObj.days.filter((d: any) => {
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

        return countRemainingClasses(a.courseCode, a.time, dayCardsMap, filteredMonths, new Date()) || [];
    };

    const classesTillCAT1 = useMemo(() => countTillDate(impDates.cat1Date), [a.courseCode, a.time, results, dayCardsMap, impDates.cat1Date]);
    const classesTillCAT2 = useMemo(() => countTillDate(impDates.cat2Date), [a.courseCode, a.time, results, dayCardsMap, impDates.cat2Date]);
    const classesTillMidSem = useMemo(() => countTillDate(impDates.midsemStart), [a.courseCode, a.time, results, dayCardsMap, impDates.midsemStart]);
    const classesTillLID = useMemo(() => {
        const lidDate = lab ? impDates.lidLabDate : impDates.lidTheoryDate;
        return countTillDate(lidDate);
    }, [a.courseCode, a.time, results, dayCardsMap, impDates.lidLabDate, impDates.lidTheoryDate, lab]);

    const hasPredictor = [classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID].some(data => Array.isArray(data) && data.length > 0);

    // Process History (Last 5 records)
    const historyList = a.viewLink || [];
    const recentHistory = historyList.slice(0, 5);

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

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800/80 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 midnight:text-gray-100 leading-tight">
                        {a.courseTitle}
                    </h2>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-1">
                        {a.courseCode.slice(0, -3)} <span className="mx-1.5">•</span> {lab ? "Lab" : "Theory"} <span className="mx-1.5">•</span> {a.credits} Credits
                    </p>
                </div>
                
                <button 
                    onClick={onViewFullPage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 midnight:bg-slate-900 midnight:hover:bg-slate-800 midnight:text-blue-400 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors shadow-sm self-start"
                >
                    <ExternalLink size={14} /> Full History & Heatmap
                </button>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 midnight:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 midnight:border-blue-900/40 text-blue-700 dark:text-blue-300 midnight:text-blue-300">
                    <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 midnight:text-blue-400" /> {a.slotName} ({a.time})
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 midnight:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 midnight:border-purple-900/40 text-purple-700 dark:text-purple-300 midnight:text-purple-300">
                    <Building2 className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 midnight:text-purple-400" /> {a.slotVenue}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 midnight:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 midnight:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 midnight:text-emerald-300">
                    <User className="w-3.5 h-3.5 text-green-500 dark:text-emerald-400 midnight:text-emerald-400" /> {a.faculty}
                </div>
            </div>

            {/* Premium Stat Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dial */}
                <div className="bg-gray-50/50 dark:bg-slate-800/25 midnight:bg-gray-950 border border-gray-200 dark:border-gray-800/80 midnight:border-gray-800/80 rounded-xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 midnight:text-gray-500 mb-1">Attendance</h4>
                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100 midnight:text-gray-100">{a.attendancePercentage}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-1 font-semibold">{a.attendedClasses} / {a.totalClasses} Classes</p>
                    </div>
                    <div className="w-16 h-16">
                        <CircularProgressbar
                            value={a.attendancePercentage}
                            text={`${!decimalValues ? a.attendancePercentage : (a.attendedClasses/a.totalClasses * 100).toFixed(1)}%`}
                            strokeWidth={10}
                            styles={buildStyles({
                                pathColor: a.attendancePercentage < thresholdPct ? "#EF4444" : a.attendancePercentage < thresholdPct + 10 ? "#FACC15" : "#10B981",
                                textColor: "currentColor",
                                trailColor: "rgba(163, 198, 240, 0.1)",
                                strokeLinecap: "round",
                                pathTransitionDuration: 0.5,
                            })}
                        />
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-gray-50/50 dark:bg-slate-800/25 midnight:bg-gray-950 border border-gray-200 dark:border-gray-800/80 midnight:border-gray-800/80 rounded-xl p-5 flex flex-col justify-center shadow-xs md:col-span-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 midnight:text-gray-500 mb-2">Status Insight</h4>
                    {a.totalClasses > 0 && (() => {
                        const attended = a.attendedClasses;
                        const total = a.totalClasses;
                        const percentage = (attended / total) * 100;

                        if (percentage < thresholdPct) {
                            const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
                            const neededValue = lab ? Math.ceil(needed / 2) : needed;

                            return (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/30 midnight:bg-red-900/20 text-red-600 dark:text-red-400 midnight:text-red-400 rounded-lg shrink-0">
                                        <AlertCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Below Threshold</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-0.5">Need to attend next <strong>{neededValue}</strong> {lab ? "lab" : "class"}{neededValue > 1 && (lab ? "s" : "es")} to hit {thresholdPct}%.</p>
                                    </div>
                                </div>
                            );
                        } else {
                            const canMiss = Math.floor(attended / thresholdDec - total);
                            const canMissValue = lab ? Math.floor(canMiss / 2) : canMiss;

                            if (canMissValue === 0) {
                                return (
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 midnight:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400 rounded-lg shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Edge Case Buffer</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-0.5">Cannot miss next {lab ? "lab" : "class"}. Attend to stay safe.</p>
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 midnight:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400 rounded-lg shrink-0">
                                            <Star size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 font-semibold">Safe Buffer</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-0.5">Can safely miss next <strong>{canMissValue}</strong> {lab ? "lab" : "class"}{canMissValue !== 1 && (lab ? "s" : "es")}.</p>
                                        </div>
                                    </div>
                                );
                            }
                        }
                    })()}
                </div>
            </div>

            {/* Predictor Section (Milestone based chevrons) */}
            {hasPredictor && (
                <div className="bg-gray-50/30 dark:bg-slate-900/30 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800/80 rounded-xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800/80">
                        <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 midnight:text-gray-100">Interactive Predictor</h3>
                        <p className="text-[10px] text-gray-400">Toggle upcoming classes to predict your target attendance before exams.</p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 midnight:divide-gray-800/60">
                        {[
                            { key: "CAT1", label: "Classes before CAT I", data: classesTillCAT1 },
                            { key: "CAT2", label: "Classes before CAT II", data: classesTillCAT2 },
                            { key: "MIDSEM", label: "Classes before Mid Term Test", data: classesTillMidSem },
                            { key: "LID", label: "Classes before FAT", data: classesTillLID },
                        ].map(({ key, label, data }) => (
                            Array.isArray(data) && data.length > 0 ? (
                                <div key={key} className="w-full">
                                    <button
                                        onClick={() => toggleDropdown(key)}
                                        className="flex items-center justify-between w-full p-4 text-left font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/50 midnight:hover:bg-gray-900 transition-colors"
                                    >
                                        <span className="flex items-center gap-2 text-xs font-bold">
                                            <CalendarIcon size={16} className="text-blue-500" />
                                            {label}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-800 midnight:bg-gray-800 px-2 py-0.5 rounded-md">{data.length} Left</span>
                                            {openDropdown === key ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        </div>
                                    </button>
                                    <div className={`transition-all duration-300 ease-in-out ${openDropdown === key ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}>
                                        <div className="p-4 bg-gray-50/50 dark:bg-slate-800/20 midnight:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800/60">
                                            <UpcomingClassesList
                                                classes={data}
                                                attendedClasses={a.attendedClasses}
                                                totalClasses={a.totalClasses}
                                                isLab={lab}
                                                impDates={impDates}
                                                isDayscholarWithBus={isDayscholarWithBus}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null
                        ))}
                    </div>
                </div>
            )}

            {/* Quick History Log */}
            <div className="bg-transparent border border-gray-200 dark:border-gray-800 midnight:border-gray-800/80 rounded-xl overflow-hidden">
                <div className="p-4 bg-gray-50/50 dark:bg-slate-800/25 midnight:bg-gray-950 border-b border-gray-200 dark:border-gray-800 midnight:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Recent Attendance History</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{historyList.length} total records</span>
                </div>
                {recentHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500">No attendance history records found.</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 midnight:divide-gray-800/60">
                        {recentHistory.map((d: any, idx: number) => {
                            const status = d.status.toLowerCase();
                            const isPresent = status === "present";
                            const isAbsent = status === "absent";
                            const hasNotes = notesTracker[a.courseCode]?.[d.date] === true;

                            return (
                                <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 dark:hover:bg-slate-800/10 midnight:hover:bg-gray-950/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-7 rounded-full ${isPresent ? "bg-emerald-500" : isAbsent ? "bg-red-500" : "bg-yellow-500"}`}></div>
                                        <div>
                                            <p className="font-bold text-xs text-gray-900 dark:text-gray-100 midnight:text-gray-100">{d.date}</p>
                                            <p className={`text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${isPresent ? "text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400" : isAbsent ? "text-red-600 dark:text-red-400 midnight:text-red-400" : "text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400"}`}>
                                                {d.status}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {!isPresent && (
                                        <button 
                                            onClick={() => toggleNotes(d.date)}
                                            className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                                                hasNotes 
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400 midnight:bg-emerald-950/30 midnight:border-emerald-900/40 midnight:text-emerald-400" 
                                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-gray-700 dark:text-gray-300 midnight:bg-black midnight:border-gray-800 midnight:text-gray-400 midnight:hover:bg-gray-900"
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
        </div>
    );
}
