"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import InfoRow from "../shared/InfoRow"
import { Building2, Clock } from "lucide-react"
import CircularProgress from "../shared/CircularProgress"
import { useState, useEffect } from "react"

export default function CourseCard({ a, onClick, activeDay, isHoliday, decimalValues, isDayscholarWithBus }) {
    const [ongoing, setOngoing] = useState(false);
    const lab = a.slotName.split('')[0] === "L";

    const isOngoing = () => {
        if (!a.time || !activeDay) return false;

        const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        if (!today.startsWith(activeDay.slice(0, 3).toUpperCase())) return false;

        const [startStr, endStr] = a.time.split("-").map(t => t.trim());
        if (!startStr || !endStr) return false;

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

        return now >= start && now <= end;
    };

    useEffect(() => {
        setOngoing(isOngoing());
    }, [a.time, activeDay]);

    return (
        <Card
            onClick={onClick}
            className={`p-4 rounded-lg shadow-sm transition-shadow duration-300 cursor-pointer h-full flex flex-col justify-between
                ${(ongoing && !isHoliday)
                    ? "ring-2 ring-yellow-200 shadow-lg bg-yellow-50 dark:bg-yellow-900/40 midnight:bg-yellow-900/40"
                    : "hover:shadow-md dark:hover:shadow-lg midnight:hover:shadow-lg"
                }`}
        >
            <div className="flex justify-between items-center w-full">
                {/* Unified Layout for both Mobile and Desktop Grid */}
                <div className="flex flex-col gap-2 flex-1 min-w-0 pr-3">
                    <CardHeader className="p-0">
                        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100 midnight:text-gray-100 truncate whitespace-normal leading-tight">
                            {a.courseTitle}
                        </CardTitle>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 midnight:text-blue-400 mt-0.5">
                            {a.slotName}
                        </p>
                    </CardHeader>

                    <CardContent className="p-0 text-sm text-gray-600 dark:text-gray-300 midnight:text-gray-300 space-y-1 mt-1">
                        <InfoRow icon={<Building2 className="w-4 h-4" />}>{a.slotVenue}</InfoRow>
                        <InfoRow icon={<Clock className="w-4 h-4" />}>{a.time}</InfoRow>
                        <p className="truncate">
                            <strong className="text-gray-700 dark:text-gray-200 midnight:text-gray-200">Faculty:</strong> {a.faculty}
                        </p>
                        <p>
                            <strong className="text-gray-700 dark:text-gray-200 midnight:text-gray-200">Classes Attended:</strong>{" "}
                            <span className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-white">
                                {a.attendedClasses}/{a.totalClasses}
                            </span>
                        </p>
                    </CardContent>
                    
                    {a.totalClasses > 0 && (() => {
                        const attended = a.attendedClasses;
                        const total = a.totalClasses;
                        const percentage = (attended / total) * 100;
                        const threshold = isDayscholarWithBus ? 0.85 : 0.75;
                        const thresholdPct = isDayscholarWithBus ? 85 : 75;

                        if (percentage < thresholdPct) {
                            const needed = Math.ceil((threshold * total - attended) / (1 - threshold));
                            const neededValue = lab ? Math.ceil(needed / 2) : needed;
                            return (
                                <p className="text-red-600 dark:text-red-400 midnight:text-red-400 text-xs sm:text-sm font-medium bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20 px-2 py-1 rounded w-fit mt-1">
                                    Need <strong>{neededValue}</strong> {lab ? "lab" : "class"}{neededValue > 1 && (lab ? "s" : "es")} for {thresholdPct}%
                                </p>
                            );
                        } else {
                            const canMiss = Math.floor(attended / threshold - total);
                            const canMissValue = lab ? Math.floor(canMiss / 2) : canMiss;
                            if (canMissValue === 0) {
                                return (
                                    <p className="text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400 text-xs sm:text-sm font-medium bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20 px-2 py-1 rounded w-fit mt-1">
                                        Edge! Attend next {lab ? "lab" : "class"}
                                    </p>
                                );
                            } else {
                                return (
                                    <p className="text-green-600 dark:text-green-400 midnight:text-green-400 text-xs sm:text-sm font-medium bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20 px-2 py-1 rounded w-fit mt-1">
                                        Can miss <strong>{canMissValue}</strong> {lab ? "lab" : "class"}{canMissValue !== 1 && (lab ? "s" : "es")}
                                    </p>
                                );
                            }
                        }
                    })()}
                </div>
                
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 flex flex-col items-center justify-center pl-1">
                    <CircularProgress
                        value={a.attendancePercentage}
                        text={`${!decimalValues ? a.attendancePercentage : (a.attendedClasses/a.totalClasses * 100).toFixed(1)}%`}
                        threshold={isDayscholarWithBus ? 85 : 75}
                        midThreshold={isDayscholarWithBus ? 90 : 85}
                    />
                    <p className="text-center text-[10px] sm:text-xs font-semibold mt-1.5 text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                        Attendance
                    </p>
                </div>
            </div>
        </Card>
    );
}
