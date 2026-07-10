"use client";

import config from "../../../../config.json";
import { useRef, useCallback, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";
import { useTheme } from "next-themes";
import { TimetableGrid as AmazeUITimetableGrid, type AddedCourse, type TimetablePeriod } from '@amazecontinuityprojects/amazeui';

export default function TimetableVtop({ attendance }) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const { theme, resolvedTheme } = useTheme();
    const currentTheme = resolvedTheme || theme || "light";
    const rootStyles = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
    const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
    const themeTextColor = rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
    const themeHtmlClass = typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const slotMap = config.slotMap || {};



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

    function toMinutes(t) {
        if (!t) return 0;
        const [hs = "0", ms = "0"] = String(t).split(":");
        let h = parseInt(hs || "0", 10);
        const m = parseInt(ms || "0", 10);
        const isPM = h === 12 || (h >= 1 && h <= 7);
        if (isPM && h !== 12) h += 12;
        return h * 60 + m;
    }

    function minutesToTimeStr(mins) {
        let h = Math.floor(mins / 60);
        const m = mins % 60;
        const ampm = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
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
            <div className="flex flex-col text-[10px] leading-tight">
                <span>{fmt(s)}</span>
                <span className="text-[8px] opacity-60">to</span>
                <span>{fmt(e)}</span>
            </div>
        );
    }

    // Build grid data for weekly matrix
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
                    grid[day][slot] = {
                        title: course.courseTitle || "",
                        code: course.courseCode || ""
                    };
                }
            });
        });
    });

    const monTheory = [];
    const monLab = [];

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

        let title = "";
        let code = "";
        for (const s of unique) {
            if (grid[day]?.[s]) {
                title = grid[day][s].title || "";
                code = grid[day][s].code || "";
                if (code) break;
            }
        }

        return { slotLabel: unique.join(" / "), title, code };
    }

    const neon = "bg-emerald-500/15 border-emerald-500/35 text-gray-900 dark:text-white";
    const normal = "bg-white  dark:bg-[#030507] text-gray-900  dark:text-gray-100";

    const headerClass =
        "border px-0.5 py-1 bg-[#eef2ff]  dark:bg-[#04070a] w-[70px] min-w-[70px] max-w-[70px] text-[9px] text-gray-900  dark:text-gray-100 font-semibold truncate";
    const lunchHeaderClass =
        "border px-0.5 py-1 bg-gray-300  dark:bg-[#0b1a22] w-[36px] min-w-[36px] max-w-[36px] text-[9px] font-semibold text-gray-900  dark:text-gray-100 truncate";
    const cellBase =
        "border px-0.5 py-1 w-[70px] min-w-[70px] max-w-[70px] h-[52px] text-[9px] truncate overflow-hidden";

    const uniqueCourses = (attendance || []).filter((c, i, arr) => arr.findIndex(x => x.courseCode === c.courseCode) === i);



    const ATT_COLORS = [
      "bg-blue-600", "bg-purple-600", "bg-emerald-500", "bg-red-600",
      "bg-amber-500", "bg-pink-500", "bg-indigo-600", "bg-teal-500",
      "bg-cyan-600", "bg-fuchsia-500", "bg-lime-500", "bg-rose-600",
    ];

    function convertToAddedCourses(data: any[]): AddedCourse[] {
      const colorMap: Record<string, string> = {};
      let colorIdx = 0;
      return (data || []).map((c: any) => {
        const code = c.courseCode || '';
        if (!colorMap[code]) colorMap[code] = ATT_COLORS[colorIdx++ % ATT_COLORS.length];
        return {
          id: `att-${code}`,
          code,
          title: c.courseTitle || '',
          slots: (c.slotName || '').split('+').map((s: string) => s.trim()).filter(Boolean),
          faculty: c.faculty || '',
          venue: c.slotVenue || '',
          credits: c.credits || '0',
          type: c.courseType || '',
          color: colorMap[code],
        };
      });
    }

    const addedCourses = convertToAddedCourses(attendance);
    const attDaysList = days.map(d => ({ id: d.toLowerCase(), name: d }));

    function buildPeriodForPair(pair: any, isLab: boolean): TimetablePeriod {
      const entry = isLab ? pair.lab : pair.theory;
      if (!entry) return { start: '', end: '', days: {} };
      const [start, end] = entry.time.split('-');
      const daysMap: Record<string, string> = {};
      for (const d of days) {
        const matched = slotsMatchingTimes(d, pair);
        const match = matched.find((s: string) => isLab ? s.startsWith('L') : !s.startsWith('L'));
        if (match) daysMap[d.toLowerCase()] = match;
      }
      return { start, end, days: daysMap };
    }

    const amazeTheoryPeriods = mergedPairs.map(p => buildPeriodForPair(p, false));
    const amazeLabPeriods = mergedPairs.map(p => buildPeriodForPair(p, true));

    const renderTraditionalGrid = () => (
        <div className="space-y-4">
            <AmazeUITimetableGrid
              courses={addedCourses}
              theoryPeriods={amazeTheoryPeriods}
              labPeriods={amazeLabPeriods}
              days={attDaysList}
              title=""
              showLegend={false}
            />
            {uniqueCourses.length > 0 && (
                <div className="bg-white  dark:bg-[#03070e] border border-gray-200  dark:border-gray-800/80 rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-55  dark:bg-[#04070a] border-b border-gray-200  dark:border-gray-800/80">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Course Reference</h3>
                    </div>
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50  dark:bg-[#050a15] border-b border-gray-150 dark:border-gray-800">
                                <th className="py-2 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Course</th>
                                <th className="py-2 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="py-2 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Faculty</th>
                                <th className="py-2 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Slots</th>
                                <th className="py-2 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Venue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100  dark:divide-gray-800/40">
                            {uniqueCourses.map((c, i) => (
                                <tr key={i} className="bg-white  dark:bg-[#030507] hover:bg-gray-55 dark:hover:bg-[#0a1825] transition-colors">
                                    <td className="py-2 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-blue-600 dark:bg-blue-850 shrink-0">{c.courseCode}</span>
                                            <span className="text-gray-900 dark:text-gray-100 text-xs font-semibold">{c.courseTitle}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-4">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            {c.courseType || (String(c.slotName || "").startsWith("L") ? "Lab" : "Theory")}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300">{c.faculty}</td>
                                    <td className="py-2 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(c.slotName || "").split("+").map((s, si) => (
                                                <span key={si} className="bg-gray-100 dark:bg-[#0d1f2e] border border-gray-250/60 dark:border-gray-800 text-[9px] px-1 py-0.5 rounded font-semibold">{s.trim()}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{c.slotVenue || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-800 pb-3">
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 font-outfit">
                        Class Schedule
                    </h2>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        View course slots, venues, and export the full grid.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleDownloadImage}
                        disabled={isDownloading}
                        className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
                        title="Download PNG"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={isDownloading}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
                        title="Print / PDF"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Timetable Contents */}
            <div ref={captureRef} className="space-y-6">
                {/* Scrollable container for the timetable grid */}
                <div className="w-full overflow-x-auto scrollbar-thin pb-2">
                    <div className="min-w-[850px] w-full">
                        <AmazeUITimetableGrid
                          courses={addedCourses}
                          theoryPeriods={amazeTheoryPeriods}
                          labPeriods={amazeLabPeriods}
                          days={attDaysList}
                          title=""
                          showLegend={false}
                        />
                    </div>
                </div>

                {/* Course Reference Section */}
                {uniqueCourses.length > 0 && (
                    <div className="bg-white dark:bg-[#03070e] border border-gray-200 dark:border-gray-800/80 rounded-[16px] overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800/80">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-outfit">Course Reference</h3>
                        </div>
                        <div className="w-full overflow-x-auto scrollbar-thin">
                            <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-zinc-950 border-b border-gray-150 dark:border-gray-800">
                                        <th className="py-2.5 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Course</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Faculty</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Slots</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Venue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                                    {uniqueCourses.map((c, i) => (
                                        <tr key={i} className="bg-white dark:bg-[#030507] hover:bg-gray-55 dark:hover:bg-[#0a1825] transition-colors">
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-blue-600 dark:bg-blue-800 shrink-0">{c.courseCode}</span>
                                                    <span className="text-gray-900 dark:text-white text-xs font-semibold">{c.courseTitle}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                    {c.courseType || (String(c.slotName || "").startsWith("L") ? "Lab" : "Theory")}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">{c.faculty}</td>
                                            <td className="py-2.5 px-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(c.slotName || "").split("+").map((s, si) => (
                                                        <span key={si} className="bg-gray-100 dark:bg-[#0d1f2e] border border-gray-250/60 dark:border-gray-800 text-[9px] px-1 py-0.5 rounded font-semibold">{s.trim()}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{c.slotVenue || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
