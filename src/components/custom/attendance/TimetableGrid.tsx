"use client";

import config from "../../../../config.json";
import { useRef, useCallback, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";
import { useTheme } from "next-themes";

export default function TimetableVtop({ attendance }) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const { theme, resolvedTheme } = useTheme();
    const isDark = theme === "dark" || resolvedTheme === "dark";
    const isMidnight = theme === "midnight";
    const themeBgColor = isMidnight ? "#020617" : isDark ? "#0f172a" : "#ffffff";
    const themeTextColor = isDark ? "#ffffff" : "#000000";
    const themeHtmlClass = isMidnight ? "dark midnight" : isDark ? "dark" : "light";

    const handlePrint = useCallback(() => {
        if (!captureRef.current) return;
        setIsDownloading(true);
        try {
            const el = captureRef.current;
            const originalOverflow = el.style.overflowX;
            el.style.overflowX = "visible";
            el.classList.add("w-max", "min-w-full");

            openTimetablePrintablePage(
                el.innerHTML,
                "Timetable",
                themeHtmlClass,
                themeBgColor,
                themeTextColor
            );

            el.style.overflowX = originalOverflow;
            el.classList.remove("w-max", "min-w-full");
        } catch (err) {
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    }, [themeHtmlClass, themeBgColor, themeTextColor]);

    const handleDownloadImage = useCallback(async () => {
        if (!captureRef.current) return;
        setIsDownloading(true);
        try {
            await downloadTimetableImage(captureRef.current, "Timetable", themeBgColor, "png");
        } catch (err) {
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    }, [themeBgColor]);

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const slotMap = config.slotMap || {};

    function toMinutes(t) {
        const [hs = "0", ms = "0"] = String(t).split(":");
        let h = parseInt(hs || "0", 10);
        const m = parseInt(ms || "0", 10);
        const isPM = h === 12 || (h >= 1 && h <= 7);
        if (isPM && h !== 12) h += 12;
        return h * 60 + m;
    }

    function fmt(t) {
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

    function fmtRange(r) {
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

    const grid = {};
    days.forEach((d) => (grid[d] = {}));
    (attendance || []).forEach((course) => {
        const slots = String(course.slotName || "")
            .split("+")
            .map((s) => s.trim())
            .filter(Boolean);

        slots.forEach((slot) => {
            days.forEach((day) => {
                if (slotMap[day]?.[slot]) {
                    grid[day][slot] = { title: course.courseTitle || "" };
                }
            });
        });
    });

    const monTheory = [];
    const monLab = [];

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

    function slotsMatchingTimes(day, pair) {
        const times = new Set();
        if (pair.theory?.time) times.add(pair.theory.time);
        if (pair.lab?.time) times.add(pair.lab.time);

        const out = [];
        Object.keys(slotMap[day] || {}).forEach((s) => {
            const t = slotMap[day][s]?.time;
            if (times.has(t)) out.push(s);
        });

        if (out.length === 0) {
            const wanted = [];
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

    function buildCell(day, pair) {
        const matched = slotsMatchingTimes(day, pair);
        const slotsNow = matched.length
            ? matched
            : [pair.theory?.slot, pair.lab?.slot].filter(Boolean);

        const unique = [...new Set(slotsNow)];
        const title = unique.map((s) => grid[day][s]?.title).find(Boolean);

        return { slotLabel: unique.join(" / "), title };
    }

    const neon = "bg-[#39FF14]/30 dark:bg-[#39FF14]/20 midnight:bg-[#39FF14]/10 text-white";
    const normal = "bg-white dark:bg-[#061017] midnight:bg-[#030507] text-gray-900 dark:text-gray-100 midnight:text-gray-100";

    const headerClass =
        "border px-1 py-1 bg-[#eef2ff] dark:bg-[#071925] midnight:bg-[#04070a] min-w-[100px] text-[11px] text-gray-900 dark:text-gray-100 midnight:text-gray-100 font-semibold";
    const lunchHeaderClass =
        "border px-1 py-1 bg-gray-300 dark:bg-[#162029] midnight:bg-[#0b1a22] min-w-[100px] text-[11px] font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100";
    const cellBase =
        "border px-2 py-1 min-w-[100px] h-[56px] text-[12px]";

    const uniqueCourses = (attendance || []).filter((c, i, arr) => arr.findIndex(x => x.courseCode === c.courseCode) === i);

    return (
        <div className="overflow-x-auto mt-3 w-full">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 midnight:text-gray-100">
                    Timetable
                </h2>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleDownloadImage}
                        disabled={isDownloading}
                        className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
                        title="Download PNG"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={isDownloading}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors"
                        title="Print / PDF"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div ref={captureRef} className="space-y-4">
            <table data-scrollable className="border-collapse w-full text-center">
                <thead>
                    <tr>
                        <th className="border px-3 py-2 bg-gray-200 dark:bg-gray-800 midnight:bg-black">
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
                            <td className="border font-semibold bg-gray-100 dark:bg-[#07101a] midnight:bg-[#020409] text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                                {day}
                            </td>

                            {beforeLunch.map((p, i) => {
                                const { slotLabel, title } = buildCell(day, p);
                                const colorClass = title ? neon : normal;
                                return (
                                    <td key={i} className={`${cellBase} ${colorClass}`}>
                                        <div>{slotLabel}</div>
                                        {title && (
                                            <div className="text-[11px] opacity-80 mt-1">
                                                {title}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}

                            <td className={lunchHeaderClass}></td>

                            {afterLunch.map((p, i) => {
                                const { slotLabel, title } = buildCell(day, p);
                                const colorClass = title ? neon : normal;
                                return (
                                    <td key={i} className={`${cellBase} ${colorClass}`}>
                                        <div>{slotLabel}</div>
                                        {title && (
                                            <div className="text-[11px] opacity-80 mt-1">
                                                {title}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {uniqueCourses.length > 0 && (
            <div className="bg-white dark:bg-[#0a1628] midnight:bg-[#03070e] border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-[#071925] midnight:bg-[#04070a] border-b border-gray-200 dark:border-gray-700 midnight:border-gray-800">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Course List</h3>
                </div>
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-[#0d1f2e] midnight:bg-[#050a15]">
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider">Course</th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider">Faculty</th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider">Slots</th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider">Venue</th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 uppercase tracking-wider text-center">Credits</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 midnight:divide-gray-800/50">
                        {uniqueCourses.map((c, i) => (
                            <tr key={i} className="bg-white dark:bg-[#061017] midnight:bg-[#030507] hover:bg-gray-50 dark:hover:bg-[#0a1825] midnight:hover:bg-[#050a12] transition-colors">
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <span className="px-2 py-0.5 rounded-md text-xs font-bold text-white bg-[#39FF14]/60 dark:bg-[#39FF14]/40 midnight:bg-[#39FF14]/30 shadow-sm shrink-0">{c.courseCode}</span>
                                        <div>
                                            <p className="text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-xs font-medium">{c.courseTitle}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 midnight:bg-blue-900/30 midnight:text-blue-300 border border-blue-200 dark:border-blue-800/50 midnight:border-blue-800/40">
                                        {c.courseType || (String(c.slotName || "").startsWith("L") ? "Lab" : "Theory")}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300">{c.faculty}</td>
                                <td className="py-3 px-4">
                                    <div className="flex flex-wrap gap-1">
                                        {(c.slotName || "").split("+").map((s, si) => (
                                            <span key={si} className="bg-gray-100 dark:bg-[#0d1f2e] midnight:bg-[#080f1a] border border-gray-200 dark:border-gray-700 midnight:border-gray-800 text-gray-700 dark:text-gray-300 midnight:text-gray-300 text-[10px] px-1.5 py-0.5 rounded-md">{s.trim()}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 max-w-[120px] truncate">{c.slotVenue || "-"}</td>
                                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 text-center">{c.credits || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
            </div>
        </div>
    );
}
