"use client";

import config from "../../../../config.json";
import { useState } from "react";
import { Friend } from "../../../lib/socialUtils";
import { Calendar, LayoutGrid, List, Sparkles, Filter, CheckCircle2, XCircle, Info, Clock } from "lucide-react";

export default function CommonFreeSlotsGrid({ myAttendance, friends }: { myAttendance: any[]; friends: Friend[] }) {
    const [activeCell, setActiveCell] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [everyoneFreeOnly, setEveryoneFreeOnly] = useState(false);
    const [selectedDayFilter, setSelectedDayFilter] = useState<string>("ALL");

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const slotMap = config.slotMap || {};

    function toMinutes(t: string) {
        if (!t) return 0;
        const [hs = "0", ms = "0"] = String(t).split(":");
        let h = parseInt(hs || "0", 10);
        const m = parseInt(ms || "0", 10);
        const isPM = h === 12 || (h >= 1 && h <= 7);
        if (isPM && h !== 12) h += 12;
        return h * 60 + m;
    }

    function fmt(t: string) {
        if (!t) return "";
        const [hs = "0", ms = "0"] = String(t).split(":");
        let h = parseInt(hs || "0", 10);
        const m = parseInt(ms || "0", 10);
        const isPM = h === 12 || (h >= 1 && h <= 7);
        let disp = h;
        if (!isPM && h === 0) disp = 12;
        if (disp > 12) disp -= 12;
        return `${disp}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
    }

    function fmtRange(r: string) {
        if (!r) return null;
        const [s, e] = r.split("-");
        return (
            <div className="flex flex-col text-[11px] leading-tight">
                <span>{fmt(s)}</span>
                <span className="text-[9px] opacity-60">to</span>
                <span>{fmt(e)}</span>
            </div>
        );
    }

    // Build user busy grid
    const userGrid: any = {};
    days.forEach((d) => (userGrid[d] = {}));
    (myAttendance || []).forEach((course) => {
        const slots = String(course.slotName || "")
            .split("+")
            .map((s) => s.trim())
            .filter(Boolean);
        slots.forEach((slot) => {
            days.forEach((day) => {
                if (slotMap[day]?.[slot]) {
                    userGrid[day][slot] = course.courseTitle || true;
                }
            });
        });
    });

    // Build friends busy grid
    const friendsGrid: any = {};
    friends.forEach((friend) => {
        friendsGrid[friend.id] = {};
        days.forEach((d) => (friendsGrid[friend.id][d] = {}));
        friend.classSlots.forEach((slot) => {
            days.forEach((day) => {
                if (slotMap[day]?.[slot.slotId]) {
                    friendsGrid[friend.id][day][slot.slotId] = slot.courseTitle || true;
                }
            });
        });
    });

    const monTheory: any[] = [];
    const monLab: any[] = [];

    Object.keys(slotMap["MON"] || {}).forEach((slot) => {
        const time = slotMap["MON"][slot]?.time;
        if (!time) return;
        const start = toMinutes(time.split("-")[0]);
        if (slot.startsWith("L")) monLab.push({ slot, time, start });
        else monTheory.push({ slot, time, start });
    });

    monTheory.sort((a, b) => a.start - b.start);
    monLab.sort((a, b) => a.start - b.start);

    const maxPairs = Math.max(monTheory.length, monLab.length);
    const mergedPairs = Array.from({ length: maxPairs }).map((_, i) => ({
        theory: monTheory[i] || null,
        lab: monLab[i] || null,
    }));

    const LUNCH_START_MIN = toMinutes("1:20");
    let insertIndex = mergedPairs.findIndex((p) => {
        const start = Math.min(
            p.theory ? p.theory.start : Infinity,
            p.lab ? p.lab.start : Infinity
        );
        return start >= LUNCH_START_MIN;
    });
    if (insertIndex === -1) insertIndex = mergedPairs.length;

    const beforeLunch = mergedPairs.slice(0, insertIndex);
    const afterLunch = mergedPairs.slice(insertIndex);

    function slotsMatchingTimes(day: string, pair: any) {
        const times = new Set();
        if (pair.theory?.time) times.add(pair.theory.time);
        if (pair.lab?.time) times.add(pair.lab.time);

        const out: string[] = [];
        Object.keys(slotMap[day] || {}).forEach((s) => {
            const t = slotMap[day][s]?.time;
            if (times.has(t)) out.push(s);
        });

        if (out.length === 0) {
            const wanted: number[] = [];
            if (pair.theory?.time)
                wanted.push(toMinutes(pair.theory.time.split("-")[0]));
            if (pair.lab?.time)
                wanted.push(toMinutes(pair.lab.time.split("-")[0]));

            Object.keys(slotMap[day] || {}).forEach((s) => {
                const t = slotMap[day][s]?.time;
                if (!t) return;
                const st = toMinutes(t.split("-")[0]);
                if (wanted.some((ws) => Math.abs(st - ws) <= 7)) out.push(s);
            });
        }

        return [...new Set(out)];
    }

    function buildCell(day: string, pair: any) {
        const matched = slotsMatchingTimes(day, pair);
        const slotsNow = matched.length
            ? matched
            : [pair.theory?.slot, pair.lab?.slot].filter(Boolean);

        const uniqueSlots = [...new Set(slotsNow)];
        
        let busyCount = 0;
        let busyDetails: { name: string; course?: string; color?: string }[] = [];
        let freeDetails: { name: string; color?: string }[] = [];
        
        const isUserBusy = uniqueSlots.some((s) => userGrid[day][s]);
        if (isUserBusy) {
            busyCount++;
            let courseName = "";
            for (const s of uniqueSlots) {
                if (typeof userGrid[day][s] === "string") {
                    courseName = userGrid[day][s];
                    break;
                }
            }
            busyDetails.push({ name: "You", course: courseName, color: "#6366f1" });
        } else {
            freeDetails.push({ name: "You", color: "#6366f1" });
        }

        friends.forEach((friend) => {
            const isFriendBusy = uniqueSlots.some((s) => friendsGrid[friend.id][day][s]);
            if (isFriendBusy) {
                busyCount++;
                let courseName = "";
                for (const s of uniqueSlots) {
                    if (typeof friendsGrid[friend.id][day][s] === "string") {
                        courseName = friendsGrid[friend.id][day][s];
                        break;
                    }
                }
                busyDetails.push({ name: friend.nickname, course: courseName, color: friend.color });
            } else {
                freeDetails.push({ name: friend.nickname, color: friend.color });
            }
        });

        const totalPeople = friends.length + 1;
        const freeCount = totalPeople - busyCount;

        const timeString = pair.theory?.time || pair.lab?.time || "";

        return { 
            slotLabel: uniqueSlots.join(" / "), 
            timeString,
            busyCount, 
            freeCount, 
            totalPeople, 
            busyDetails, 
            freeDetails,
            busyNames: busyDetails.map(b => b.name),
            freeNames: freeDetails.map(f => f.name)
        };
    }

    // Collect all slots for list view
    const allSlotList: { day: string; timeString: string; slotLabel: string; freeCount: number; totalPeople: number; freeNames: string[]; busyDetails: any[]; freeDetails: any[] }[] = [];
    
    days.forEach((day) => {
        [...beforeLunch, ...afterLunch].forEach((pair) => {
            const cell = buildCell(day, pair);
            if (cell.slotLabel) {
                allSlotList.push({
                    day,
                    timeString: cell.timeString,
                    slotLabel: cell.slotLabel,
                    freeCount: cell.freeCount,
                    totalPeople: cell.totalPeople,
                    freeNames: cell.freeNames,
                    busyDetails: cell.busyDetails,
                    freeDetails: cell.freeDetails
                });
            }
        });
    });

    const activeCellObj = activeCell ? (() => {
        const [day, slotLabel] = activeCell.split("::");
        let pairMatch = null;
        for (const p of [...beforeLunch, ...afterLunch]) {
            const cell = buildCell(day, p);
            if (cell.slotLabel === slotLabel) {
                pairMatch = { ...cell, day };
                break;
            }
        }
        return pairMatch;
    })() : null;

    const filteredSlots = allSlotList.filter((s) => {
        if (everyoneFreeOnly && s.freeCount !== s.totalPeople) return false;
        if (selectedDayFilter !== "ALL" && s.day !== selectedDayFilter) return false;
        return true;
    });

    const headerClass = "border border-zinc-200 dark:border-zinc-800/80 px-2 py-2 bg-indigo-50/50 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 font-bold text-[11px]";
    const lunchHeaderClass = "border border-zinc-200 dark:border-zinc-800/80 px-2 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] font-extrabold tracking-wider";
    const cellBase = "border border-zinc-200 dark:border-zinc-800/60 px-2 py-2.5 min-w-[105px] h-[62px] text-[11px] relative transition-all duration-150 select-none";

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-sm text-foreground">Common Free Hours Matrix</h3>
                        <p className="text-[11px] text-muted-foreground">Comparing your schedule with {friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* View Switcher */}
                    <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 border border-zinc-200/60 dark:border-zinc-800/60">
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === "grid"
                                    ? "bg-white text-indigo-600 dark:bg-zinc-900 dark:text-indigo-400 shadow-2xs"
                                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Grid View
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === "list"
                                    ? "bg-white text-indigo-600 dark:bg-zinc-900 dark:text-indigo-400 shadow-2xs"
                                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                            }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            List View
                        </button>
                    </div>

                    {/* Filter Toggle */}
                    <button
                        type="button"
                        onClick={() => setEveryoneFreeOnly(!everyoneFreeOnly)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            everyoneFreeOnly
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        Everyone Free
                    </button>
                </div>
            </div>

            {/* Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-2xs"></span>
                        <span className="text-foreground text-[11px] font-bold">100% Free</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-amber-400 shadow-2xs"></span>
                        <span className="text-foreground text-[11px] font-bold">Partially Free</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-rose-500 shadow-2xs"></span>
                        <span className="text-foreground text-[11px] font-bold">All Busy</span>
                    </div>
                </div>

                <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-indigo-500" />
                    Click any slot to view detailed member availability
                </div>
            </div>

            {/* Grid View */}
            {viewMode === "grid" ? (
                <div className="w-full overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-950">
                    <table className="border-collapse w-full text-center min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-black">
                                    DAY
                                </th>

                                {beforeLunch.map((p, i) => (
                                    <th key={i} className={headerClass}>
                                        {p.theory && fmtRange(p.theory.time)}
                                        {p.lab && (
                                            <div className="opacity-70">{fmtRange(p.lab.time)}</div>
                                        )}
                                    </th>
                                ))}

                                <th className={lunchHeaderClass}>
                                    <div className="flex flex-col items-center">
                                        <span>LUNCH</span>
                                    </div>
                                </th>

                                {afterLunch.map((p, i) => (
                                    <th key={i} className={headerClass}>
                                        {p.theory && fmtRange(p.theory.time)}
                                        {p.lab && (
                                            <div className="opacity-70">{fmtRange(p.lab.time)}</div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {days.map((day) => (
                                <tr key={day}>
                                    <td className="border border-zinc-200 dark:border-zinc-800 font-black text-xs bg-zinc-50 dark:bg-zinc-900/70 text-foreground">
                                        {day}
                                    </td>

                                    {beforeLunch.map((p, i) => {
                                        const cell = buildCell(day, p);
                                        const { slotLabel, freeCount, totalPeople } = cell;
                                        
                                        if (everyoneFreeOnly && freeCount !== totalPeople) {
                                            return (
                                                <td key={i} className="border border-zinc-200/50 dark:border-zinc-800/40 bg-zinc-100/40 dark:bg-zinc-950/40 h-[62px]">
                                                    <span className="text-[10px] text-zinc-300 dark:text-zinc-700 font-mono">—</span>
                                                </td>
                                            );
                                        }

                                        let colorClass = "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/60";
                                        if (freeCount === totalPeople) {
                                            colorClass = "bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60 border-emerald-200/80 dark:border-emerald-800/60";
                                        } else if (freeCount === 0) {
                                            colorClass = "bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 border-rose-200/60 dark:border-rose-900/50";
                                        } else {
                                            colorClass = "bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 hover:bg-amber-100/90 dark:hover:bg-amber-900/50 border-amber-200/70 dark:border-amber-900/50";
                                        }

                                        const isActive = activeCell === `${day}::${slotLabel}`;

                                        return (
                                            <td 
                                                key={i} 
                                                className={`${cellBase} ${colorClass} ${isActive ? 'ring-2 ring-indigo-500 z-10 scale-[1.02] shadow-md' : ''} cursor-pointer`}
                                                onClick={() => setActiveCell(isActive ? null : `${day}::${slotLabel}`)}
                                            >
                                                <div className="font-extrabold text-[11px] truncate tracking-tight">{slotLabel}</div>
                                                <div className="mt-1 flex items-center justify-center gap-1">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                                        freeCount === totalPeople
                                                            ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                                                            : freeCount === 0
                                                            ? "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200"
                                                            : "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                                                    }`}>
                                                        {freeCount}/{totalPeople} Free
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}

                                    <td className={lunchHeaderClass}></td>

                                    {afterLunch.map((p, i) => {
                                        const cell = buildCell(day, p);
                                        const { slotLabel, freeCount, totalPeople } = cell;

                                        if (everyoneFreeOnly && freeCount !== totalPeople) {
                                            return (
                                                <td key={i} className="border border-zinc-200/50 dark:border-zinc-800/40 bg-zinc-100/40 dark:bg-zinc-950/40 h-[62px]">
                                                    <span className="text-[10px] text-zinc-300 dark:text-zinc-700 font-mono">—</span>
                                                </td>
                                            );
                                        }

                                        let colorClass = "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/60";
                                        if (freeCount === totalPeople) {
                                            colorClass = "bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60 border-emerald-200/80 dark:border-emerald-800/60";
                                        } else if (freeCount === 0) {
                                            colorClass = "bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 border-rose-200/60 dark:border-rose-900/50";
                                        } else {
                                            colorClass = "bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 hover:bg-amber-100/90 dark:hover:bg-amber-900/50 border-amber-200/70 dark:border-amber-900/50";
                                        }

                                        const isActive = activeCell === `${day}::${slotLabel}`;

                                        return (
                                            <td 
                                                key={i} 
                                                className={`${cellBase} ${colorClass} ${isActive ? 'ring-2 ring-indigo-500 z-10 scale-[1.02] shadow-md' : ''} cursor-pointer`}
                                                onClick={() => setActiveCell(isActive ? null : `${day}::${slotLabel}`)}
                                            >
                                                <div className="font-extrabold text-[11px] truncate tracking-tight">{slotLabel}</div>
                                                <div className="mt-1 flex items-center justify-center gap-1">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                                        freeCount === totalPeople
                                                            ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                                                            : freeCount === 0
                                                            ? "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200"
                                                            : "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                                                    }`}>
                                                        {freeCount}/{totalPeople} Free
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* List View for Mobile & Easy Scanning */
                <div className="space-y-4">
                    {/* Day Filter Pills */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setSelectedDayFilter("ALL")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                selectedDayFilter === "ALL"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            }`}
                        >
                            All Days
                        </button>
                        {days.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setSelectedDayFilter(d)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                    selectedDayFilter === d
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredSlots.length === 0 ? (
                            <div className="col-span-full py-12 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                <Filter className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                                <p className="text-xs font-bold text-zinc-500">No matching slots found for this filter</p>
                            </div>
                        ) : (
                            filteredSlots.map((item, idx) => {
                                const isAllFree = item.freeCount === item.totalPeople;
                                const isAllBusy = item.freeCount === 0;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveCell(`${item.day}::${item.slotLabel}`)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                                            isAllFree
                                                ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400"
                                                : isAllBusy
                                                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 hover:border-rose-400"
                                                : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-foreground font-black text-xs shadow-2xs border border-zinc-200/50 dark:border-zinc-800">
                                                    {item.day} • {item.slotLabel}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                    isAllFree
                                                        ? "bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300"
                                                        : isAllBusy
                                                        ? "bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300"
                                                        : "bg-amber-100 dark:bg-amber-900/70 text-amber-700 dark:text-amber-300"
                                                }`}>
                                                    {item.freeCount}/{item.totalPeople} Free
                                                </span>
                                            </div>
                                            {item.timeString && (
                                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium mb-3">
                                                    <Clock className="w-3 h-3 text-indigo-500" />
                                                    {fmt(item.timeString.split("-")[0])} - {fmt(item.timeString.split("-")[1])}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between text-xs">
                                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                Free: {item.freeNames.join(", ")}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Active Cell Detail Inspector Modal / Drawer */}
            {activeCellObj && (
                <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-900 dark:border dark:border-zinc-800 shadow-xl space-y-3 animate-slideUp">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500 text-white font-extrabold text-xs">
                                {activeCellObj.day}
                            </span>
                            <span className="font-extrabold text-sm">{activeCellObj.slotLabel}</span>
                            {activeCellObj.timeString && (
                                <span className="text-xs text-zinc-400 font-mono">
                                    ({fmt(activeCellObj.timeString.split("-")[0])} - {fmt(activeCellObj.timeString.split("-")[1])})
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setActiveCell(null)}
                            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-800"
                        >
                            Close
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* Free People */}
                        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Available ({activeCellObj.freeDetails.length})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {activeCellObj.freeDetails.map((f: any, i: number) => (
                                    <span
                                        key={i}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-900/80 text-emerald-200 text-xs font-bold border border-emerald-700/60"
                                    >
                                        {f.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Busy People */}
                        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                                    <XCircle className="w-4 h-4 text-rose-400" />
                                    Busy in Class ({activeCellObj.busyDetails.length})
                                </span>
                            </div>
                            {activeCellObj.busyDetails.length === 0 ? (
                                <p className="text-xs text-zinc-400 italic">No one has class during this slot!</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {activeCellObj.busyDetails.map((b: any, i: number) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-rose-900/40 text-rose-200 text-xs border border-rose-800/40"
                                        >
                                            <span className="font-bold">{b.name}</span>
                                            {b.course && <span className="text-[10px] text-rose-300/80 max-w-[160px] truncate">{b.course}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
