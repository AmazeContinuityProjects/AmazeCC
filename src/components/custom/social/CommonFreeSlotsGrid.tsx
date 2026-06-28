"use client";

import config from "../../../../config.json";
import { useEffect, useState } from "react";
import { Friend } from "../../../lib/socialUtils";

export default function CommonFreeSlotsGrid({ myAttendance, friends }: { myAttendance: any[], friends: Friend[] }) {
    const [activeCell, setActiveCell] = useState<string | null>(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);
    
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const slotMap = config.slotMap || {};

    function toMinutes(t: string) {
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
                    userGrid[day][slot] = true;
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
                    friendsGrid[friend.id][day][slot.slotId] = true;
                }
            });
        });
    });

    const monTheory: any[] = [];
    const monLab: any[] = [];

    Object.keys(slotMap["MON"]).forEach((slot) => {
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
        let busyNames: string[] = [];
        let freeNames: string[] = [];
        
        const isUserBusy = uniqueSlots.some((s) => userGrid[day][s]);
        if (isUserBusy) {
            busyCount++;
            busyNames.push("You");
        } else {
            freeNames.push("You");
        }

        friends.forEach((friend) => {
            const isFriendBusy = uniqueSlots.some((s) => friendsGrid[friend.id][day][s]);
            if (isFriendBusy) {
                busyCount++;
                busyNames.push(friend.nickname);
            } else {
                freeNames.push(friend.nickname);
            }
        });

        const totalPeople = friends.length + 1;
        const freeCount = totalPeople - busyCount;

        return { slotLabel: uniqueSlots.join(" / "), busyCount, freeCount, totalPeople, busyNames, freeNames };
    }

    const handleCellClick = (day: string, slotLabel: string, freeNames: string[], busyNames: string[]) => {
        if (activeCell === `${day}-${slotLabel}`) {
            setActiveCell(null);
        } else {
            setActiveCell(`${day}-${slotLabel}`);
        }
    };

    const headerClass =
        "border px-1 py-1 bg-[#eef2ff]  dark:bg-[#04070a] min-w-[100px] text-[11px]";
    const lunchHeaderClass =
        "border px-1 py-1 bg-gray-300  dark:bg-[#0b1a22] min-w-[100px] text-[11px] font-semibold";
    const cellBase =
        "border px-2 py-1 min-w-[100px] h-[56px] text-[12px] relative group";

    return (
        <div className="overflow-x-auto mt-3 w-full animate-fadeIn">
            <h2 className="text-lg font-semibold text-gray-800  dark:text-gray-100 mb-2">
                Common Free Slots
            </h2>
            <div className="flex gap-4 mb-3 text-xs font-medium">
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> Everyone Free</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-sm"></span> Some Free</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Everyone Busy</div>
            </div>
            <table data-scrollable className="border-collapse w-full text-center">
                <thead>
                    <tr>
                        <th className="border px-3 py-2 bg-gray-200  dark:bg-black">
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
                            <div className="flex flex-col items-center gap-1">
                                <div className="text-[11px] font-semibold">LUNCH</div>
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
                            <td className="border font-semibold bg-gray-100  dark:bg-[#020409]">
                                {day}
                            </td>

                            {beforeLunch.map((p, i) => {
                                const { slotLabel, busyCount, freeCount, totalPeople, busyNames, freeNames } = buildCell(day, p);
                                let colorClass = "bg-white  dark:bg-[#030507]";
                                if (freeCount === totalPeople) colorClass = "bg-green-200  dark:bg-green-900/40 text-green-900 dark:text-green-100";
                                else if (freeCount === 0) colorClass = "bg-red-200  dark:bg-red-900/40 text-red-900 dark:text-red-100";
                                else colorClass = "bg-yellow-200  dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100";

                                const isActive = activeCell === `${day}-${slotLabel}`;

                                return (
                                    <td 
                                        key={i} 
                                        className={`${cellBase} ${colorClass} cursor-pointer`}
                                        onClick={() => handleCellClick(day, slotLabel, freeNames, busyNames)}
                                    >
                                        <div className="font-semibold">{slotLabel}</div>
                                        <div className="text-[10px] mt-1 opacity-80">{freeCount}/{totalPeople} Free</div>
                                        {/* Tooltip / Popover */}
                                        {(isActive || busyCount > 0) && (
                                            <div className={`absolute ${isActive ? 'block z-20 shadow-xl border border-border scale-110' : 'hidden group-hover:block z-10'} bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] p-2 rounded w-max transition-transform`}>
                                                <div className="text-green-400 font-semibold mb-0.5">Free: {freeNames.length > 0 ? freeNames.join(", ") : "None"}</div>
                                                {busyCount > 0 && <div className="text-red-400 opacity-80">Busy: {busyNames.join(", ")}</div>}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}

                            <td className={lunchHeaderClass}></td>

                            {afterLunch.map((p, i) => {
                                const { slotLabel, busyCount, freeCount, totalPeople, busyNames, freeNames } = buildCell(day, p);
                                let colorClass = "bg-white  dark:bg-[#030507]";
                                if (freeCount === totalPeople) colorClass = "bg-green-200  dark:bg-green-900/40 text-green-900 dark:text-green-100";
                                else if (freeCount === 0) colorClass = "bg-red-200  dark:bg-red-900/40 text-red-900 dark:text-red-100";
                                else colorClass = "bg-yellow-200  dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100";

                                const isActive = activeCell === `${day}-${slotLabel}`;

                                return (
                                    <td 
                                        key={i} 
                                        className={`${cellBase} ${colorClass} cursor-pointer`}
                                        onClick={() => handleCellClick(day, slotLabel, freeNames, busyNames)}
                                    >
                                        <div className="font-semibold">{slotLabel}</div>
                                        <div className="text-[10px] mt-1 opacity-80">{freeCount}/{totalPeople} Free</div>
                                        {/* Tooltip / Popover */}
                                        {(isActive || busyCount > 0) && (
                                            <div className={`absolute ${isActive ? 'block z-20 shadow-xl border border-border scale-110' : 'hidden group-hover:block z-10'} bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] p-2 rounded w-max transition-transform`}>
                                                <div className="text-green-400 font-semibold mb-0.5">Free: {freeNames.length > 0 ? freeNames.join(", ") : "None"}</div>
                                                {busyCount > 0 && <div className="text-red-400 opacity-80">Busy: {busyNames.join(", ")}</div>}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
