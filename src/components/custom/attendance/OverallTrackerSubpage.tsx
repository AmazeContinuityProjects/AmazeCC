"use client"

import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, List, CalendarDays, Grid3x3, CheckCircle2, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button";
import HeatMap from "@uiw/react-heat-map";
import AttendanceCalendarView from "./AttendanceCalendarView";

export default function OverallTrackerSubpage({ attendanceData, dayCardsMap, analyzeCalendars, onBack }) {
    const [viewMode, setViewMode] = useState<"list" | "heatmap" | "calendar">("list");
    const [notesTracker, setNotesTracker] = useState({});
    const [expandedDates, setExpandedDates] = useState({});

    // Load notes tracker from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("uniCC_notes_tracker");
            if (saved) {
                setNotesTracker(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to parse notes tracker data", e);
        }
    }, []);

    const toggleMasterNotes = (dateStr, missedClasses, e) => {
        e.stopPropagation();
        const allSecured = missedClasses.every(c => notesTracker[c.courseCode]?.[dateStr] === true);
        const newState = !allSecured;
        const updatedTracker = { ...notesTracker };
        missedClasses.forEach(c => {
            if (!updatedTracker[c.courseCode]) updatedTracker[c.courseCode] = {};
            updatedTracker[c.courseCode][dateStr] = newState;
        });
        setNotesTracker(updatedTracker);
        localStorage.setItem("uniCC_notes_tracker", JSON.stringify(updatedTracker));
    };

    const toggleIndividualNote = (dateStr, courseCode, e) => {
        e.stopPropagation();
        const updatedTracker = { ...notesTracker };
        if (!updatedTracker[courseCode]) updatedTracker[courseCode] = {};
        updatedTracker[courseCode][dateStr] = !updatedTracker[courseCode][dateStr];
        setNotesTracker(updatedTracker);
        localStorage.setItem("uniCC_notes_tracker", JSON.stringify(updatedTracker));
    };

    const toggleExpand = (dateStr) => {
        setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    const masterHistory = useMemo(() => {
        const dateMap: Record<string, {
            dateObj: Date,
            allClasses: Array<{ courseCode: string, courseTitle: string, status: string }>,
        }> = {};

        attendanceData.forEach(a => {
            a.viewLink?.forEach(h => {
                if (!dateMap[h.date]) {
                    dateMap[h.date] = {
                        dateObj: new Date(h.date),
                        allClasses: []
                    };
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
            
            const morningClasses = [];
            const eveningClasses = [];
            const missedClasses = []; 

            d.allClasses.forEach(historyEntry => {
                let sc = scheduled.find(s => s.courseCode === historyEntry.courseCode);
                if (!sc) {
                    Object.values(dayCardsMap).flat().forEach((s: any) => {
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

            return {
                date: dateStr,
                overallStatus,
                missedClasses,
                allClasses: d.allClasses
            };
        });
    }, [attendanceData, dayCardsMap]);

    const totalMissedDaysCount = masterHistory.filter(d => d.missedClasses.length > 0).length;

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
        return masterHistory.map(d => {
            const dateObj = new Date(d.date);
            const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            let val = 0;
            if (d.overallStatus === "present") val = 1;
            else if (d.overallStatus === "absent") val = 2;
            else if (d.overallStatus.includes("half-day")) val = 3;
            else if (d.overallStatus.includes("partial")) val = 4;
            else val = 5; // On duty fallback
            
            // Map OD to yellow if it's OD only
            if (d.overallStatus === "partial od" && d.missedClasses.every(c => c.status.includes("duty"))) {
                val = 5;
            }
            
            return { date: dateStr, count: val, status: d.overallStatus };
        });
    }, [masterHistory]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6 pb-20">
            <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                <ChevronLeft className="mr-1 h-4 w-4" /> Back to Dashboard
            </Button>

            <div className="grid xl:grid-cols-3 gap-6 items-start h-full">
                {/* Left Pane (Predictor could go here later, or stats) */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                            <FileText size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">Overall Tracker</h2>
                        <p className="text-sm text-gray-500 mb-6">Manage notes and track all absences across your entire timetable in one place.</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="p-4 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-xl">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Missed Days</p>
                                <p className="text-2xl font-black text-red-600 dark:text-red-400">{totalMissedDaysCount}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-xl">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Classes</p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{masterHistory.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Pane (Log) */}
                <div className="xl:col-span-2 min-w-0 w-full">
                    <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        Aggregated Log
                                    </h2>
                                </div>
                                <div className="flex bg-gray-100 dark:bg-slate-800 midnight:bg-gray-900 p-1 rounded-lg w-max self-start sm:self-auto">
                                    <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-white dark:bg-slate-700 midnight:bg-black text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                                        <CalendarDays size={18} />
                                    </button>
                                    <button onClick={() => setViewMode("heatmap")} className={`p-1.5 rounded-md transition-colors ${viewMode === "heatmap" ? "bg-white dark:bg-slate-700 midnight:bg-black text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                                        <Grid3x3 size={18} />
                                    </button>
                                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-slate-700 midnight:bg-black text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                                        <List size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[600px]">
                            {viewMode === "calendar" ? (
                                <div className="p-0 sm:p-4 w-full overflow-x-auto hide-scrollbar">
                                    <div className="min-w-[600px]">
                                        <AttendanceCalendarView 
                                            analyzeCalendars={analyzeCalendars} 
                                            historyList={masterHistory} 
                                            notesTracker={notesTracker}
                                            toggleNotes={toggleMasterNotes}
                                            courseCode={"ALL"}
                                            isOverall={true}
                                            toggleIndividualNote={toggleIndividualNote}
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
                                            rectProps={{ rx: 4, ry: 4 }}
                                            rectRender={(props, dayData) => {
                                                const data = dayData as any;
                                                return <rect {...props}><title>{`${data.date}: ${data.status}`}</title></rect>;
                                            }}
                                            panelColors={{
                                                0: "rgba(156, 163, 175, 0.1)", // Empty
                                                1: "#10B981", // Present (Emerald)
                                                2: "#EF4444", // Full Absent (Red)
                                                3: "#F97316", // Half-day (Orange)
                                                4: "#F43F5E", // Partial absent (Rose)
                                                5: "#EAB308", // OD (Yellow)
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800 midnight:divide-gray-800">
                                    {masterHistory.map((d, i) => {
                                        const isPresent = d.overallStatus === "present";
                                        const allSecured = d.missedClasses.length > 0 && d.missedClasses.every(c => notesTracker[c.courseCode]?.[d.date] === true);
                                        const isExpanded = expandedDates[d.date];

                                        let dotColor = "bg-emerald-500";
                                        let textCol = "text-emerald-600 dark:text-emerald-400";
                                        if (d.overallStatus === "absent") { dotColor = "bg-red-500"; textCol = "text-red-600 dark:text-red-400"; }
                                        else if (d.overallStatus.includes("half-day")) { dotColor = "bg-orange-500"; textCol = "text-orange-600 dark:text-orange-400"; }
                                        else if (d.overallStatus.includes("partial absent")) { dotColor = "bg-rose-500"; textCol = "text-rose-600 dark:text-rose-400"; }
                                        else if (d.overallStatus.includes("od")) { dotColor = "bg-yellow-500"; textCol = "text-yellow-600 dark:text-yellow-400"; }

                                        return (
                                            <div key={i} className="flex flex-col p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => !isPresent && toggleExpand(d.date)}>
                                                <div className="flex sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-2 h-10 rounded-full ${dotColor}`}></div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-gray-100">{d.date}</p>
                                                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${textCol}`}>
                                                                {d.overallStatus}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    {!isPresent && (
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={(e) => toggleMasterNotes(d.date, d.missedClasses, e)}
                                                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                                                                    allSecured 
                                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400" 
                                                                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-slate-700"
                                                                }`}
                                                            >
                                                                {allSecured ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                                                                <span className="hidden sm:inline">{allSecured ? "All Secured" : "Get Notes"}</span>
                                                            </button>
                                                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Expanded Details */}
                                                {!isPresent && isExpanded && (
                                                    <div className="mt-4 pl-6 border-l-2 border-gray-100 dark:border-gray-800 ml-1 space-y-3">
                                                        {d.missedClasses.map((c, idx) => {
                                                            const isSecured = notesTracker[c.courseCode]?.[d.date] === true;
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/50 p-2 rounded-lg">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-gray-900 dark:text-gray-200">{c.courseTitle}</p>
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{c.courseCode} • {c.status}</p>
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => toggleIndividualNote(d.date, c.courseCode, e)}
                                                                        className={`flex items-center justify-center p-1.5 rounded text-[10px] font-semibold transition-all shrink-0 ${
                                                                            isSecured 
                                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                                                                : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300"
                                                                        }`}
                                                                    >
                                                                        {isSecured ? <CheckCircle2 size={12} /> : <FileText size={12} />}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
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
        </div>
    );
}
