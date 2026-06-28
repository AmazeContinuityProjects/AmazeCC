"use client"

import { useMemo, useState } from "react";
import { List, CalendarDays, Grid3x3, CheckCircle2, ShieldAlert, Award } from "lucide-react";
import ViewModeToggle from "../shared/ViewModeToggle";
import HeatMap from "@uiw/react-heat-map";
import AttendanceCalendarView from "./AttendanceCalendarView";
import config from "../../../../config.json";
import SubpageLayout from "../shared/SubpageLayout";

export default function ODTrackerSubpage({ ODhoursData, attendanceData, analyzeCalendars, onBack }) {
    const [viewMode, setViewMode] = useState<"list" | "heatmap" | "calendar">("list");

    const { masterODHistory, wastedODsCount, validODsCount, recoveredODsCount, totalODHours } = useMemo(() => {
        let wastedCount = 0;
        let validCount = 0;
        let recoveredCount = 0;
        let totalHours = 0;

        if (!ODhoursData || !Array.isArray(ODhoursData)) {
            return { masterODHistory: [], wastedODsCount: 0, validODsCount: 0, recoveredODsCount: 0, totalODHours: 0 };
        }

        const trackerRaw = typeof window !== 'undefined' ? localStorage.getItem("wastedODsTracker") : null;
        const tracker = trackerRaw ? JSON.parse(trackerRaw) : {};
        const slotMap: any = config.slotMap || {};

        const history = ODhoursData.map(dayOD => {
            const dateObj = new Date(dayOD.date);
            const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            const displayDate = dayOD.date;

            const coursesWithStatus = dayOD.courses.map(c => {
                let isWasted = false;
                let isRecovered = false;
                let timeString = "";

                const trackedDay = tracker[displayDate];
                if (trackedDay) {
                    const matchedTrack: any = Object.values(trackedDay).find((t: any) =>
                        t.courseTitle.toLowerCase().includes(c.title.toLowerCase()) ||
                        c.title.toLowerCase().includes(t.courseTitle.toLowerCase())
                    );

                    if (matchedTrack) {
                        if (matchedTrack.status === "wasted") isWasted = true;
                        if (matchedTrack.status === "recovered") isRecovered = true;

                        if (matchedTrack.slotName) {
                            const slots = matchedTrack.slotName.split('+');
                            if (slots.length > 0) {
                                const firstSlot = slotMap[slots[0]];
                                const lastSlot = slotMap[slots[slots.length - 1]];
                                if (firstSlot && lastSlot) {
                                    timeString = `${firstSlot.split('-')[0]} - ${lastSlot.split('-')[1]}`;
                                } else if (firstSlot) {
                                    timeString = firstSlot;
                                }
                            }
                        }
                    }
                }

                const isLab = c.type.toLowerCase().includes("lab") || c.type.toLowerCase().includes("ela") || c.type.toLowerCase().includes("pbl");
                const hours = isLab ? 2 : 1;

                if (isWasted) {
                    wastedCount += hours;
                } else if (isRecovered) {
                    recoveredCount += hours;
                    validCount += hours; // Recovered means it's valid again
                } else {
                    validCount += hours;
                }

                return {
                    ...c,
                    isWasted,
                    isRecovered,
                    timeString,
                    hours
                };
            });

            totalHours += dayOD.total;

            return {
                date: displayDate,
                dateStr, // YYYY/MM/DD for heatmap
                totalHours: dayOD.total,
                courses: coursesWithStatus,
                hasWasted: coursesWithStatus.some(c => c.isWasted),
                allWasted: coursesWithStatus.every(c => c.isWasted)
            };
        });

        // Sort by date (newest first)
        history.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

        return { masterODHistory: history, wastedODsCount: wastedCount, validODsCount: validCount, recoveredODsCount: recoveredCount, totalODHours: totalHours };
    }, [ODhoursData, attendanceData]);


    const heatmapStartDate = useMemo(() => {
        if (analyzeCalendars && analyzeCalendars.length > 0) {
            const firstMonth = analyzeCalendars[0];
            const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(m => firstMonth.month?.toLowerCase().includes(m));
            if (mIndex !== -1) return new Date(firstMonth.year, mIndex, 1);
        }
        const date = new Date();
        date.setMonth(date.getMonth() - 5);
        return date;
    }, [analyzeCalendars]);

    const heatmapEndDate = useMemo(() => {
        if (analyzeCalendars && analyzeCalendars.length > 0) {
            const lastMonth = analyzeCalendars[analyzeCalendars.length - 1];
            const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(m => lastMonth.month?.toLowerCase().includes(m));
            if (mIndex !== -1) return new Date(lastMonth.year, mIndex + 1, 0);
        }
        return new Date();
    }, [analyzeCalendars]);

    const heatmapData = useMemo(() => {
        return masterODHistory.map(d => {
            let val = 1; // Used successfully
            if (d.allWasted) val = 3; // Entire day wasted (Red)
            else if (d.hasWasted) val = 2; // Partially wasted (Orange)

            return { date: d.dateStr, count: val, status: d.allWasted ? "Wasted OD" : d.hasWasted ? "Partial Wasted OD" : "Valid OD" };
        });
    }, [masterODHistory]);

    // Format for AttendanceCalendarView
    const calendarHistory = useMemo(() => {
        return masterODHistory.map(d => {
            return {
                date: d.date,
                overallStatus: d.allWasted ? "wasted od" : d.hasWasted ? "partial wasted od" : "valid od",
                missedClasses: [], // Not used for OD Tracker
                allClasses: []
            };
        });
    }, [masterODHistory]);

    return (
        <SubpageLayout title="OD Tracker" subtitle="Track your approved On-Duty hours and find out if you attended classes while on OD." onBack={onBack}>
            <div className="grid xl:grid-cols-3 gap-6 items-start h-full">
                {/* Left Pane (Stats) */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-yellow-100  dark:bg-yellow-900/30 text-yellow-600  dark:text-yellow-400 flex items-center justify-center mb-4">
                            <Award size={32} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className={`p-4 bg-emerald-50 border border-emerald-100 dark:border-emerald-900/30  dark:bg-gray-900 rounded-xl ${recoveredODsCount > 0 ? "col-span-2" : "col-span-2"}`}>
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1">Total OD Hours</p>
                                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{totalODHours}</p>
                            </div>
                            <div className="p-4 bg-gray-50  dark:bg-gray-900 rounded-xl">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Valid Hours</p>
                                <p className="text-xl sm:text-2xl font-black text-blue-600  dark:text-blue-400">{validODsCount}</p>
                            </div>
                            <div className="p-4 bg-red-50  border border-red-100 dark:border-red-900/30 dark:bg-gray-900 rounded-xl relative group">
                                <div className="absolute top-2 right-2 text-red-400 opacity-50"><ShieldAlert size={14} /></div>
                                <p className="text-[10px] sm:text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Wasted Hours</p>
                                <p className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">{wastedODsCount}</p>
                            </div>
                            {recoveredODsCount > 0 && (
                                <div className="p-4 bg-purple-50  border border-purple-100 dark:border-purple-900/30 dark:bg-gray-900 rounded-xl relative group col-span-2">
                                    <div className="absolute top-2 right-2 text-purple-400 opacity-50"><CheckCircle2 size={14} /></div>
                                    <p className="text-[10px] sm:text-xs font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Recovered Hours</p>
                                    <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">{recoveredODsCount}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Pane (Log) */}
                <div className="xl:col-span-2 min-w-0 w-full">
                    <div className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-5 border-b border-gray-100  dark:border-gray-800 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
                                        OD History Log
                                    </h2>
                                </div>
                                <ViewModeToggle
                                    options={[
                                        { key: "calendar", icon: <CalendarDays size={18} /> },
                                        { key: "heatmap", icon: <Grid3x3 size={18} /> },
                                        { key: "list", icon: <List size={18} /> },
                                    ]}
                                    value={viewMode}
                                    onChange={(key) => setViewMode(key as "list" | "heatmap" | "calendar")}
                                    className="self-start sm:self-auto shrink-0"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[600px] min-w-0">
                            {viewMode === "calendar" ? (
                                <div className="p-0 sm:p-4 w-full overflow-x-auto hide-scrollbar">
                                    <div className="min-w-[600px]">
                                        <AttendanceCalendarView
                                            analyzeCalendars={analyzeCalendars}
                                            historyList={calendarHistory}
                                            notesTracker={{}}
                                            toggleNotes={() => {}}
                                            courseCode={"ALL"}
                                            isOverall={true}
                                            toggleIndividualNote={() => {}}
                                            isODTracker={true}
                                        />
                                    </div>
                                </div>
                            ) : viewMode === "heatmap" ? (
                                <div className="p-6 flex flex-col items-center justify-center w-full overflow-x-auto hide-scrollbar" style={{ direction: "rtl" }}>
                                    <div style={{ direction: "ltr", minWidth: "500px" }} className="flex flex-col items-center">
                                        <HeatMap
                                            value={heatmapData}
                                            startDate={heatmapStartDate}
                                            endDate={heatmapEndDate}
                                            width={550}
                                            legendCellSize={0}
                                            rectProps={{ rx: 4, ry: 4 }}
                                            rectRender={(props, dayData) => {
                                                const data = dayData as any;
                                                return <rect {...props}><title>{`${data.date}: ${data.status}`}</title></rect>;
                                            }}
                                            panelColors={{
                                                0: "rgba(156, 163, 175, 0.1)", // Empty
                                                1: "#10B981", // Valid OD (Green/Emerald)
                                                2: "#F59E0B", // Partial Wasted OD (Amber)
                                                3: "#EF4444", // Fully Wasted OD (Red)
                                            }}
                                        />
                                        <div className="flex flex-wrap items-center justify-center gap-5 mt-5 text-xs font-semibold text-gray-550  dark:text-gray-400">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded bg-[#10B981] shadow-sm"></div>
                                                <span>Valid OD</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded bg-[#F59E0B] shadow-sm"></div>
                                                <span>Partial Wasted OD</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded bg-[#EF4444] shadow-sm"></div>
                                                <span>Fully Wasted OD</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100  dark:divide-gray-800 min-w-0">
                                    {masterODHistory.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No OD hours recorded. Please reload data.</div>
                                    ) : (
                                        masterODHistory.map((d, i) => {
                                            let dotColor = "bg-emerald-500";
                                            let textCol = "text-emerald-600  dark:text-emerald-400";
                                            let title = "Valid OD";

                                            if (d.allWasted) {
                                                dotColor = "bg-red-500";
                                                textCol = "text-red-600  dark:text-red-400";
                                                title = "Wasted OD";
                                            } else if (d.hasWasted) {
                                                dotColor = "bg-amber-500";
                                                textCol = "text-amber-600  dark:text-amber-400";
                                                title = "Partial Wasted";
                                            }

                                            return (
                                                <div key={i} className="flex flex-col p-4 bg-white  dark:bg-black min-w-0">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-2 h-10 rounded-full shrink-0 ${dotColor}`}></div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-baseline justify-between gap-2 min-w-0">
                                                                <p className="font-bold text-gray-900  dark:text-gray-100 truncate">{d.date}</p>
                                                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{d.totalHours} Hours</span>
                                                            </div>
                                                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate ${textCol}`}>
                                                                {title}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 pl-6 border-l-2 border-gray-100  dark:border-gray-800 ml-1 space-y-2 min-w-0">
                                                        {d.courses.map((c, idx) => (
                                                            <div key={idx} className={`flex items-center justify-between gap-3 p-2 rounded-lg border min-w-0 ${c.isWasted ? 'bg-red-50 border-red-100   dark:bg-gray-900 dark:border-red-900/30' : c.isRecovered ? 'bg-purple-50 border-purple-100   dark:bg-gray-900 dark:border-purple-900/30' : 'bg-gray-50/50 border-transparent  dark:bg-gray-900/50'}`}>
                                                                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className={`text-xs font-bold truncate ${c.isWasted ? 'text-red-700  dark:text-red-400 line-through opacity-70' : c.isRecovered ? 'text-purple-700  dark:text-purple-400' : 'text-gray-900  dark:text-gray-200'}`}>{c.title}</p>
                                                                        {c.timeString && (
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${c.isWasted ? 'bg-red-100 text-red-600 border-red-200   dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : c.isRecovered ? 'bg-purple-100 text-purple-600 border-purple-200   dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : 'bg-gray-100 text-gray-500 border-gray-200   dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>
                                                                                {c.timeString}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{c.type}</p>
                                                                </div>
                                                                {c.isWasted && (
                                                                    <span className="shrink-0 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded flex items-center gap-1   dark:bg-red-900/30 dark:text-red-400">
                                                                        <ShieldAlert size={12}/> Wasted
                                                                    </span>
                                                                )}
                                                                {c.isRecovered && (
                                                                    <span className="shrink-0 text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded flex items-center gap-1   dark:bg-purple-900/30 dark:text-purple-400">
                                                                        <CheckCircle2 size={12}/> Recovered
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SubpageLayout>
    );
}
