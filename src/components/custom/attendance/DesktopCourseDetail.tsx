"use client"

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Badge from "../shared/Badge";
import { Building2, Clock, User, Star, AlertCircle, FileText, CheckCircle2, CalendarDays, ExternalLink, HelpCircle, Calendar as CalendarIcon, Minus, Plus } from "lucide-react";
import ExpandableSection from "../shared/ExpandableSection";
import CircularProgress from "../shared/CircularProgress";
import EmptyState from "../shared/EmptyState";
import { countRemainingClasses } from "./AttendanceSubpage";

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
            <p className="text-gray-500  dark:text-gray-400 text-xs text-center py-4">
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
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium bg-gray-50  dark:bg-gray-950 p-4 rounded-xl border border-gray-100  dark:border-gray-800/80 text-gray-800  dark:text-gray-200">
                <div className="flex gap-4">
                    <span className="text-emerald-600 dark:text-emerald-400">Attending: <strong>{attending}</strong></span>
                    <span className="text-red-500 dark:text-red-400">Skipping: <strong>{missed}</strong></span>
                </div>
                <Badge variant={predictedPercent >= thresholdPct ? "success" : "danger"} className={`border font-bold ${predictedPercent >= thresholdPct ? "border-emerald-200  dark:border-emerald-800/50" : "border-red-200  dark:border-red-800/50"}`}>
                    Predicted: {predictedPercent}%
                </Badge>
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
                                    ? "bg-red-50/50 border-red-200 text-red-700   dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                                    : isIgnored
                                        ? "bg-gray-100 border-gray-200   text-gray-400 dark:text-gray-500 dark:bg-gray-900 dark:border-gray-800 opacity-50"
                                        : "bg-white border-gray-200   dark:bg-black dark:border-gray-800/80 text-gray-800  dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500"
                            }`}
                        >
                            <span className={`font-bold text-xs ${isSkipped ? "text-red-700  dark:text-red-400" : "text-gray-800  dark:text-gray-200"}`}>{dateStr}</span>
                            <span className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60 ${isSkipped ? "text-red-500 dark:text-red-400" : "text-gray-500  dark:text-gray-400"}`}>{weekday}</span>
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
    simulatedSkips?: number;
    onSimulateSkipsChange?: (val: number) => void;
}

export default function DesktopCourseDetail({
    a,
    isDayscholarWithBus,
    decimalValues,
    results,
    dayCardsMap,
    impDates,
    onViewFullPage,
    simulatedSkips = 0,
    onSimulateSkipsChange
}: DesktopCourseDetailProps) {
    const lab = a.courseCode.endsWith("(L)");
    const isTheory = a.courseCode.endsWith("(T)");
    const thresholdPct = isDayscholarWithBus ? 85 : 75;
    const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;

    const originalPercentage = parseFloat(a.attendancePercentage);
    const attended = parseInt(a.attendedClasses);
    const total = parseInt(a.totalClasses) + simulatedSkips;
    const simulatedPercentage = total > 0 ? parseFloat(((attended / total) * 100).toFixed(1)) : originalPercentage;

    const isSafe = simulatedPercentage >= thresholdPct;
    const targetDec = thresholdPct / 105 ? thresholdPct / 100 : thresholdPct / 100; // safe fallback
    const canMissVal = isSafe && total > 0 ? Math.floor(attended / (thresholdPct / 100) - total) : 0;
    const canMissClasses = lab ? Math.floor(canMissVal / 2) : canMissVal;

    const neededVal = !isSafe ? Math.ceil(((thresholdPct / 100) * total - attended) / (1 - (thresholdPct / 100))) : 0;
    const neededClasses = lab ? Math.ceil(neededVal / 2) : neededVal;

    const getClassesNeededForGoal = (goalPct: number, currentAttended: number, currentTotal: number) => {
        const goalDec = goalPct / 100;
        if (currentTotal === 0 || (currentAttended / currentTotal) * 100 >= goalPct) return 0;
        const needed = Math.ceil((goalDec * currentTotal - currentAttended) / (1 - goalDec));
        return lab ? Math.ceil(needed / 2) : needed;
    };

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
            <div className="flex items-start justify-between gap-4 border-b border-gray-150  dark:border-gray-800/80 pb-3">
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black font-[family-name:var(--font-outfit)] text-gray-900  dark:text-gray-100 leading-tight">
                        {a.courseTitle}
                    </h2>
                    <p className="text-xs font-semibold text-gray-500  dark:text-gray-400 mt-1">
                        {a.courseCode.slice(0, -3)} <span className="mx-1">•</span> {lab ? "Lab" : "Theory"} <span className="mx-1">•</span> {a.credits} Credits
                    </p>
                    {/* Tags row integrated right below details */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-455 bg-blue-50/50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-100/40 dark:border-blue-900/30">
                            <Clock className="w-3 h-3 text-blue-500 dark:text-blue-400" /> {a.slotName} ({a.time})
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-650 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-100/40 dark:border-purple-900/30">
                            <Building2 className="w-3 h-3 text-purple-500 dark:text-purple-400" /> {a.slotVenue}
                        </span>
                        {a.faculty && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-650 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100/40 dark:border-emerald-900/30">
                                <User className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> {a.faculty}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={onViewFullPage}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/45 bg-blue-50/60 hover:bg-blue-100/70 text-blue-700  dark:text-blue-300 dark:border-blue-500/35 dark:bg-blue-950/10 dark:hover:bg-blue-950/20 font-bold text-[10px] uppercase tracking-wider transition-colors shadow-xs shrink-0 self-start cursor-pointer"
                >
                    Full History & Heatmap →
                </button>
            </div>

            {/* Premium Stat Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Attendance Status Card */}
                <div className="bg-gray-50/50  dark:bg-gray-950 border border-gray-200  dark:border-gray-800/80 rounded-xl p-5 flex flex-col justify-between shadow-xs gap-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Attendance</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-gray-900  dark:text-gray-100">{simulatedPercentage}%</p>
                            {simulatedSkips > 0 && (
                                <span className="text-xs text-gray-400 dark:text-gray-555 line-through font-bold">
                                    {originalPercentage}%
                                </span>
                            )}
                            <span className="text-xs text-gray-550 dark:text-gray-400 font-semibold">
                              ({attended} / {total})
                            </span>
                        </div>

                        {/* Horizontal Progress Bar */}
                        <div className="w-full mt-3 bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${
                                    simulatedPercentage < thresholdPct
                                        ? 'bg-red-500'
                                        : simulatedPercentage < thresholdPct + 10
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${Math.min(100, simulatedPercentage)}%` }}
                            />
                        </div>

                        {/* Status & Buffer metrics */}
                        <div className="mt-4 pt-3.5 border-t border-gray-200/60  dark:border-gray-800/60 flex flex-col gap-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 dark:text-gray-550 font-bold uppercase tracking-wider text-[9px]">Status</span>
                                <span className={`font-black uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded ${
                                    isSafe
                                        ? "bg-emerald-550/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400"
                                        : "bg-red-550/10 text-red-500 dark:bg-red-500/5 dark:text-red-400"
                                }`}>
                                    {isSafe ? "Safe" : "Critical"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 dark:text-gray-555 font-bold uppercase tracking-wider text-[9px]">
                                    {isSafe ? "Safe Buffer" : "Shortage"}
                                </span>
                                                <span className={`font-extrabold ${isSafe ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                    {isSafe
                                        ? (canMissClasses === 0 ? "No buffer" : `Can skip ${canMissClasses} class${canMissClasses !== 1 ? 'es' : ''}`)
                                        : `Need +${neededClasses} class${neededClasses !== 1 ? 'es' : ''}`}
                                </span>
                        </div>
                    </div>
                </div>

                                       {/* Inline Skip Predictor Widget for Desktop */}
                    {onSimulateSkipsChange && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white  dark:bg-black border border-gray-200/60  dark:border-gray-800/80 mt-1">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-wider">Simulate Skips</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onSimulateSkipsChange(simulatedSkips - 1)}
                                    className="p-1 rounded bg-gray-55  border border-gray-200  hover:bg-gray-100 dark:hover:bg-slate-700/80 dark:bg-gray-900 dark:border-gray-800 cursor-pointer"
                                    title="Decrease simulated skips"
                                >
                                    <Minus className="w-3 h-3 text-gray-655 dark:text-gray-300" />
                                </button>
                                <span
                                    onClick={() => {
                                        if (simulatedSkips !== 0) {
                                            onSimulateSkipsChange(0);
                                        }
                                    }}
                                    className={`text-xs font-bold w-4 text-center select-none ${
                                        simulatedSkips !== 0
                                            ? "cursor-pointer hover:text-red-500 hover:scale-110 active:scale-95 transition-all text-blue-605 dark:text-blue-400 font-extrabold"
                                            : "text-gray-700 dark:text-gray-300"
                                    }`}
                                    title={simulatedSkips !== 0 ? "Click to reset to 0" : ""}
                                >
                                    {simulatedSkips}
                                </span>
                                <button
                                    onClick={() => onSimulateSkipsChange(simulatedSkips + 1)}
                                    className="p-1 rounded bg-gray-55  border border-gray-200  hover:bg-gray-100 dark:hover:bg-slate-700/80 dark:bg-gray-900 dark:border-gray-800 cursor-pointer"
                                    title="Increase simulated skips"
                                >
                                    <Plus className="w-3 h-3 text-gray-655 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-gray-50/50  dark:bg-gray-950 border border-gray-200  dark:border-gray-800/80 rounded-xl p-5 flex flex-col justify-between shadow-xs md:col-span-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Next Class Impact</h4>
                    {total > 0 && (() => {
                        const percentage = simulatedPercentage;
                        const CLASS_WEIGHT = lab ? 2 : 1;
                        const nextAttendPct = parseFloat((((attended + CLASS_WEIGHT) / (total + CLASS_WEIGHT)) * 100).toFixed(1));
                        const nextSkipPct = parseFloat(((attended / (total + CLASS_WEIGHT)) * 100).toFixed(1));

                        const attendDiff = parseFloat((nextAttendPct - percentage).toFixed(1));
                        const skipDiff = parseFloat((nextSkipPct - percentage).toFixed(1));

                        const attendDiffStr = attendDiff >= 0 ? `+${attendDiff}%` : `${attendDiff}%`;
                        const skipDiffStr = skipDiff >= 0 ? `+${skipDiff}%` : `${skipDiff}%`;

                        return (
                            <div className="flex flex-col h-full justify-between gap-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Simulate the outcome of your next scheduled class. Attending will improve your average, while skipping will reduce it.
                                </p>
                                <div className="grid grid-cols-2 gap-4 w-full">
                                    {/* Attend Card */}
                                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 dark:border-emerald-500/25 rounded-xl p-4 flex flex-col justify-between transition-all hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">If Attend</span>
                                        </div>
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{nextAttendPct}%</span>
                                            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded w-fit">{attendDiffStr}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                                            Increases threshold buffer.
                                        </p>
                                    </div>

                                    {/* Skip Card */}
                                    <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 dark:border-red-500/25 rounded-xl p-4 flex flex-col justify-between transition-all hover:bg-red-500/10 dark:hover:bg-red-500/15">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">If Skip</span>
                                        </div>
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="text-2xl font-black text-red-600 dark:text-red-400">{nextSkipPct}%</span>
                                            <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 px-1.5 py-0.5 rounded w-fit">{skipDiffStr}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                                            Reduces threshold buffer.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Quick History Log */}
            <div className="bg-transparent border border-gray-200  dark:border-gray-800/80 rounded-xl overflow-hidden">
                <div className="p-4 bg-gray-50/50  dark:bg-gray-950 border-b border-gray-200  dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Recent Attendance History</h3>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{historyList.length} total records</span>
                </div>
                {recentHistory.length === 0 ? (
                    <EmptyState title="No attendance history records found" className="p-6" />
                ) : (
                    <div className="divide-y divide-gray-100  dark:divide-gray-800/60">
                        {recentHistory.map((d: any, idx: number) => {
                            const status = d.status.toLowerCase();
                            const isPresent = status === "present";
                            const isAbsent = status === "absent";
                            const hasNotes = notesTracker[a.courseCode]?.[d.date] === true;

                            return (
                                <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-950/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-7 rounded-full ${isPresent ? "bg-emerald-500" : isAbsent ? "bg-red-500" : "bg-yellow-500"}`}></div>
                                        <div>
                                            <p className="font-bold text-xs text-gray-900  dark:text-gray-100">{d.date}</p>
                                            <p className={`text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${isPresent ? "text-emerald-600  dark:text-emerald-400" : isAbsent ? "text-red-600  dark:text-red-400" : "text-yellow-600  dark:text-yellow-400"}`}>
                                                {d.status}
                                            </p>
                                        </div>
                                    </div>

                                    {!isPresent && (
                                        <button
                                            onClick={() => toggleNotes(d.date)}
                                            className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                                                hasNotes
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700    dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400"
                                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50    dark:bg-black dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900"
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
