"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@amazecontinuityprojects/amazeui"
import InfoRow from "../shared/InfoRow"
import { Building2, Clock, Minus, Plus } from "lucide-react"
import CircularProgress from "../shared/CircularProgress"
import { useState, useEffect } from "react"

export default function CourseCard({ a, onClick, activeDay, isHoliday, decimalValues, isDayscholarWithBus, simulatedSkips = 0, onSimulateSkipsChange }) {
    const [status, setStatus] = useState("upcoming");
    const lab = a.slotName.split('')[0] === "L";

    const getClassStatus = () => {
        if (!a.time || !activeDay) return "upcoming";

        const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        if (!today.startsWith(activeDay.slice(0, 3).toUpperCase())) return "upcoming";

        const [startStr, endStr] = a.time.split("-").map(t => t.trim());
        if (!startStr || !endStr) return "upcoming";

        const parseTime = (str) => {
            const [hour, minute] = str.split(":").map(Number);
            const d = new Date();
            let h = hour;
            let m = minute || 0;
            if (h < 8) h += 12;
            d.setHours(h, m, 0, 0);
            return d;
        };

        const start = parseTime(startStr);
        const end = parseTime(endStr);
        const now = new Date();

        if (now >= start && now <= end) return "ongoing";
        if (now > end) return "completed";
        return "upcoming";
    };

    useEffect(() => {
        setStatus(getClassStatus());
    }, [a.time, activeDay]);

    const isOngoing = status === "ongoing";
    const isCompleted = status === "completed";

    // Attendance calculations incorporating simulated skips
    const originalPercentage = parseFloat(a.attendancePercentage);
    const attended = parseInt(a.attendedClasses);
    const total = parseInt(a.totalClasses) + simulatedSkips;
    const simulatedPercentage = total > 0 ? parseFloat(((attended / total) * 100).toFixed(1)) : originalPercentage;

    const thresholdPct = isDayscholarWithBus ? 85 : 75;
    const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;
    const isBelowThreshold = simulatedPercentage < thresholdPct;

    let cardBg = "bg-white  dark:bg-black";
    let cardBorder = "border-gray-200  dark:border-gray-800/80";
    let cardOpacity = "opacity-100";

    if (isOngoing && !isHoliday) {
        cardBg = "bg-amber-50/45  dark:bg-amber-950/10";
        cardBorder = "border-amber-500  dark:border-amber-500 ring-1 ring-amber-500/20 shadow-md";
    } else if (isCompleted && !isHoliday) {
        cardOpacity = "opacity-65";
    }

    if (simulatedSkips > 0 && isBelowThreshold) {
        cardBorder = "border-red-500 dark:border-red-500 ring-1 ring-red-500/30";
        cardBg = "bg-red-50/10  dark:bg-red-950/5";
    }

    return (
        <Card
            onClick={onClick}
            className={`p-4 rounded-xl shadow-sm transition-all duration-200 cursor-pointer h-full flex flex-col justify-between ${cardBg} ${cardBorder} ${cardOpacity} hover:shadow-md hover:scale-[1.01]`}
        >
            <div className="flex justify-between items-start w-full gap-2">
                <div className="flex flex-col gap-2 flex-1 min-w-0 pr-3">
                    <CardHeader className="p-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-black text-blue-600  dark:text-blue-400 uppercase tracking-wider">
                                {a.slotName}
                            </span>
                            {isOngoing && !isHoliday && (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-600  dark:text-amber-400 bg-amber-100  dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                    Live
                                </span>
                            )}
                            {isCompleted && !isHoliday && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500  dark:text-gray-400 bg-gray-100  dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                    Completed
                                </span>
                            )}
                        </div>
                        <CardTitle className="text-base font-bold text-gray-900  dark:text-gray-100 leading-snug">
                            {a.courseTitle}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="p-0 text-xs text-gray-500  dark:text-gray-400 space-y-1.5 mt-2">
                        <InfoRow icon={<Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}>{a.slotVenue}</InfoRow>
                        <InfoRow icon={<Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}>{a.time}</InfoRow>
                        <p className="truncate">
                            <strong className="text-gray-700 dark:text-gray-300">Faculty:</strong> {a.faculty}
                        </p>
                        <p className="text-xs font-semibold text-gray-700  dark:text-gray-300 mt-1">
                            Classes: <span className="font-bold text-gray-900  dark:text-white">{a.attendedClasses}/{total}</span>
                            {simulatedSkips > 0 && <span className="text-red-500 dark:text-red-400 font-bold ml-1.5">({simulatedSkips} skipped)</span>}
                        </p>
                    </CardContent>

                    {/* Inline Skip Predictor Widget */}
                    {onSimulateSkipsChange && (
                        <div
                            className="mt-3 flex items-center justify-between p-2 rounded-lg bg-gray-50  dark:bg-gray-900 border border-gray-100  dark:border-gray-850"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Simulate Skips</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onSimulateSkipsChange(simulatedSkips - 1)}
                                    className="p-1 rounded bg-white  border border-gray-200  hover:bg-gray-50 dark:hover:bg-slate-600 dark:bg-black dark:border-gray-800"
                                >
                                    <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                </button>
                                <span
                                    onClick={() => {
                                        if (simulatedSkips !== 0) {
                                            onSimulateSkipsChange(0);
                                        }
                                    }}
                                    className={`text-xs font-bold w-4 text-center select-none ${
                                        simulatedSkips !== 0
                                            ? "cursor-pointer hover:text-red-500 hover:scale-110 active:scale-95 transition-all text-blue-600 dark:text-blue-400 font-extrabold"
                                            : "text-gray-700 dark:text-gray-300"
                                    }`}
                                    title={simulatedSkips !== 0 ? "Click to reset to 0" : ""}
                                >
                                    {simulatedSkips}
                                </span>
                                <button
                                    onClick={() => onSimulateSkipsChange(simulatedSkips + 1)}
                                    className="p-1 rounded bg-white  border border-gray-200  hover:bg-gray-50 dark:hover:bg-slate-600 dark:bg-black dark:border-gray-800"
                                >
                                    <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                    )}

                    {total > 0 && (() => {
                        if (simulatedPercentage < thresholdPct) {
                            const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
                            const neededValue = lab ? Math.ceil(needed / 2) : needed;
                            return (
                                <span className="text-red-600  dark:text-red-400 text-xs font-bold bg-red-50/80  dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 px-2 py-0.5 rounded-lg w-fit mt-2">
                                    Need {neededValue} class{neededValue > 1 ? "es" : ""}
                                </span>
                            );
                        } else {
                            const canMiss = Math.floor(attended / thresholdDec - total);
                            const canMissValue = lab ? Math.floor(canMiss / 2) : canMiss;
                            if (canMissValue === 0) {
                                return (
                                    <span className="text-amber-600  dark:text-amber-400 text-xs font-bold bg-amber-50/80  dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded-lg w-fit mt-2">
                                        Danger zone! Don't skip
                                    </span>
                                );
                            } else {
                                return (
                                    <span className="text-emerald-600  dark:text-emerald-400 text-xs font-bold bg-emerald-50/80  dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded-lg w-fit mt-2">
                                        Can miss {canMissValue} class{canMissValue > 1 ? "es" : ""}
                                    </span>
                                );
                            }
                        }
                    })()}
                </div>

                <div className="w-16 h-16 flex-shrink-0 flex flex-col items-center justify-center">
                    <CircularProgress
                        value={simulatedPercentage}
                        text={`${!decimalValues ? simulatedPercentage.toFixed(0) : simulatedPercentage.toFixed(1)}%`}
                        threshold={isDayscholarWithBus ? 85 : 75}
                        midThreshold={isDayscholarWithBus ? 90 : 85}
                        size={64}
                    />
                    {simulatedSkips > 0 && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-1 text-center line-through">
                            {originalPercentage}%
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
}
