"use client";

import config from "../../../../config.json";
import { useRef, useCallback, useState, useEffect } from "react";
import { Download, Printer, CalendarDays, Grid, Clock, MapPin, User, Coffee, Pizza, Sparkles, BookOpen, ChevronRight, CheckCircle2 } from "lucide-react";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";
import { useTheme } from "next-themes";
import Badge from "../shared/Badge";
import { useIsMobile } from "../shared";

export default function TimetableVtop({ attendance }) {
    const captureRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewMode, setViewMode] = useState<"schedule" | "grid">("grid");

    useEffect(() => {
        if (isMobile) {
            setViewMode("schedule");
        }
    }, [isMobile]);
    const { theme, resolvedTheme } = useTheme();
    const currentTheme = resolvedTheme || theme || "light";
    const rootStyles = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
    const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
    const themeTextColor = rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
    const themeHtmlClass = typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const slotMap = config.slotMap || {};

    const getTodayDay = () => {
        const daysShort = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const d = new Date().getDay();
        const current = daysShort[d];
        return days.includes(current) ? current : "MON";
    };

    const [activeDay, setActiveDay] = useState(getTodayDay());
    const [nowMins, setNowMins] = useState(0);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setNowMins(now.getHours() * 60 + now.getMinutes());
        };
        updateTime();
        const interval = setInterval(updateTime, 30000); // update every 30s
        return () => clearInterval(interval);
    }, []);

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

    // Build the sorted, merged vertical timeline for a selected day
    const buildDailySchedule = (day) => {
        const dayClasses = [];
        (attendance || []).forEach((course) => {
            const slots = String(course.slotName || "")
                .split("+")
                .map((s) => s.trim())
                .filter(Boolean);

            slots.forEach((slot) => {
                const slotInfo = slotMap[day]?.[slot];
                if (slotInfo?.time) {
                    dayClasses.push({
                        type: "class",
                        slot,
                        time: slotInfo.time,
                        start: toMinutes(slotInfo.time.split("-")[0]),
                        end: toMinutes(slotInfo.time.split("-")[1]),
                        course
                    });
                }
            });
        });

        // Merge consecutive sessions for the same subject
        const merged = [];
        dayClasses.sort((a, b) => a.start - b.start).forEach((item) => {
            if (merged.length === 0) {
                merged.push({ ...item, slots: [item.slot] });
                return;
            }
            const last = merged[merged.length - 1];
            if (last.course.courseCode === item.course.courseCode && Math.abs(last.end - item.start) <= 10) {
                last.end = Math.max(last.end, item.end);
                last.slots.push(item.slot);
            } else {
                merged.push({ ...item, slots: [item.slot] });
            }
        });

        const DAY_START = 480; // 8:05 AM
        const LUNCH_START = 800; // 1:20 PM
        const LUNCH_END = 840; // 2:00 PM

        const timeline = [];
        let pointer = DAY_START;

        merged.forEach((c) => {
            if (pointer < LUNCH_START && c.start >= LUNCH_END) {
                if (LUNCH_START - pointer > 10) {
                    timeline.push({
                        type: "free",
                        start: pointer,
                        end: LUNCH_START,
                        duration: LUNCH_START - pointer
                    });
                }
                timeline.push({
                    type: "lunch",
                    start: LUNCH_START,
                    end: LUNCH_END,
                    duration: 40
                });
                pointer = LUNCH_END;
            }

            if (c.start - pointer > 10) {
                if (pointer < LUNCH_START && c.start > LUNCH_START) {
                    if (LUNCH_START - pointer > 10) {
                        timeline.push({
                            type: "free",
                            start: pointer,
                            end: LUNCH_START,
                            duration: LUNCH_START - pointer
                        });
                    }
                    timeline.push({
                        type: "lunch",
                        start: LUNCH_START,
                        end: LUNCH_END,
                        duration: 40
                    });
                    const remainingGap = c.start - LUNCH_END;
                    if (remainingGap > 10) {
                        timeline.push({
                            type: "free",
                            start: LUNCH_END,
                            end: c.start,
                            duration: remainingGap
                        });
                    }
                } else {
                    timeline.push({
                        type: "free",
                        start: pointer,
                        end: c.start,
                        duration: c.start - pointer
                    });
                }
            }

            timeline.push(c);
            pointer = c.end;
        });

        if (pointer < LUNCH_START && merged.some(c => c.start >= LUNCH_END)) {
            if (LUNCH_START - pointer > 10) {
                timeline.push({
                    type: "free",
                    start: pointer,
                    end: LUNCH_START,
                    duration: LUNCH_START - pointer
                });
            }
            timeline.push({
                type: "lunch",
                start: LUNCH_START,
                end: LUNCH_END,
                duration: 40
            });
            pointer = LUNCH_END;
        }

        const DAY_END = 1160; // 7:20 PM
        if (pointer < DAY_END && merged.length > 0) {
            const finalGap = DAY_END - pointer;
            if (finalGap > 10) {
                timeline.push({
                    type: "free",
                    start: pointer,
                    end: DAY_END,
                    duration: finalGap
                });
            }
        }

        return timeline;
    };

    const getClassCountForDay = (day) => {
        const uniqueCourses = new Set();
        (attendance || []).forEach((course) => {
            const slots = String(course.slotName || "")
                .split("+")
                .map((s) => s.trim())
                .filter(Boolean);
            slots.forEach((slot) => {
                if (slotMap[day]?.[slot]) {
                    uniqueCourses.add(course.courseCode);
                }
            });
        });
        return uniqueCourses.size;
    };

    function formatDuration(mins) {
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        let out = "";
        if (hrs > 0) {
            out += `${hrs} hr${hrs > 1 ? "s" : ""}`;
        }
        if (remainingMins > 0) {
            if (out) out += " ";
            out += `${remainingMins} min${remainingMins > 1 ? "s" : ""}`;
        }
        return out;
    }

    const currentSchedule = buildDailySchedule(activeDay);
    const todayDay = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const isToday = activeDay === (todayDay === "SUN" ? "SUN" : todayDay);

    const renderTraditionalGrid = () => (
        <div className="space-y-4">
            <table className="border-collapse w-full text-center border-gray-200 dark:border-gray-800">
                <thead>
                    <tr>
                        <th className="border px-1 py-1 bg-gray-255  dark:bg-black text-[9px] font-bold text-gray-800 dark:text-gray-100 w-[40px] min-w-[40px] max-w-[40px] truncate">
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
                                <div className="text-[9px] font-semibold">LUNCH</div>
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
                            <td className="border font-semibold bg-gray-100  dark:bg-[#020409] text-gray-900  dark:text-gray-100 text-[10px] w-[40px] min-w-[40px] max-w-[40px] truncate">
                                {day}
                            </td>

                            {beforeLunch.map((p, i) => {
                                const { slotLabel, title, code } = buildCell(day, p);
                                const colorClass = code ? neon : normal;
                                return (
                                    <td key={i} className={`${cellBase} ${colorClass}`} title={title ? `${code}: ${title}` : undefined}>
                                        <div className="font-semibold text-[9px]">{slotLabel}</div>
                                        {code && (
                                            <div className="text-[9px] font-black mt-0.5 tracking-tight text-blue-650 dark:text-blue-400">
                                                {code}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}

                            <td className={lunchHeaderClass}></td>

                            {afterLunch.map((p, i) => {
                                const { slotLabel, title, code } = buildCell(day, p);
                                const colorClass = code ? neon : normal;
                                return (
                                    <td key={i} className={`${cellBase} ${colorClass}`} title={title ? `${code}: ${title}` : undefined}>
                                        <div className="font-semibold text-[9px]">{slotLabel}</div>
                                        {code && (
                                            <div className="text-[9px] font-black mt-0.5 tracking-tight text-blue-650 dark:text-blue-400">
                                                {code}
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

    const renderDailyPlanner = () => (
        <div className="space-y-4">
            {/* Day selector tabs */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                {days.map((day) => {
                    const count = getClassCountForDay(day);
                    const isActive = activeDay === day;
                    const isDayToday = todayDay === day;

                    return (
                        <button
                            key={day}
                            onClick={() => setActiveDay(day)}
                            className={`flex flex-col items-center min-w-[68px] p-2 rounded-xl border transition-all ${
                                isActive
                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                    : "bg-white  dark:bg-[#060606] border-gray-200 dark:border-gray-855 hover:border-gray-300 dark:hover:border-gray-700 text-gray-650 dark:text-gray-300"
                            }`}
                        >
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-blue-100" : "text-gray-400 dark:text-gray-500"}`}>
                                {day}
                            </span>
                            <span className="text-sm font-black mt-1">
                                {count > 0 ? count : "—"}
                            </span>
                            {isDayToday && (
                                <span className={`w-1 h-1 rounded-full mt-1 ${isActive ? "bg-white" : "bg-blue-600"}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Timeline display */}
            {currentSchedule.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-55/50  dark:bg-black/30 border border-dashed border-gray-250 dark:border-gray-855 rounded-2xl py-12">
                    <span className="text-4xl mb-3">🎉</span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">No Classes Scheduled</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                        Enjoy your day off! Use this time to rest, study, or pursue hobbies.
                    </p>
                </div>
            ) : (
                <div className="space-y-4 relative pl-4 sm:pl-6 border-l border-gray-100  dark:border-gray-855 py-2">
                    {currentSchedule.map((item, index) => {
                        if (item.type === "free") {
                            return (
                                <div key={index} className="relative">
                                    <div className="absolute left-[-21px] sm:left-[-29px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-750" />
                                    <div
                                        className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-gray-200  dark:border-gray-855 bg-gray-55/35  dark:bg-black/10 select-none transition-all hover:bg-gray-50/50 dark:hover:bg-slate-900/20"
                                    >
                                        <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-slate-850 text-gray-500 dark:text-gray-400">
                                            <Coffee size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                Free Period — {formatDuration(item.duration)} Gap
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                                {minutesToTimeStr(item.start)} to {minutesToTimeStr(item.end)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (item.type === "lunch") {
                            return (
                                <div key={index} className="relative">
                                    <div className="absolute left-[-21px] sm:left-[-29px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-amber-600" />
                                    <div
                                        className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/20 bg-amber-50/15  dark:bg-amber-955/2 select-none transition-all hover:bg-amber-50/20 dark:hover:bg-amber-955/10"
                                    >
                                        <div className="p-2.5 rounded-lg bg-amber-100/60 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                                            <Pizza size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                                Lunch Break 🍔
                                            </p>
                                            <p className="text-[10px] text-amber-650 dark:text-amber-400/60 mt-0.5">
                                                {minutesToTimeStr(item.start)} to {minutesToTimeStr(item.end)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const c = item.course;
                        const isLab = item.slot.startsWith("L");

                        const isOngoing = isToday && nowMins >= item.start && nowMins <= item.end;
                        const isCompleted = isToday && nowMins > item.end;
                        const minsRemaining = item.end - nowMins;

                        let borderStyle = isLab ? "border-l-4 border-l-purple-500" : "border-l-4 border-l-blue-500";
                        let cardStyle = "bg-white  dark:bg-[#060606] border-gray-200 dark:border-gray-800";
                        let dotColor = isLab ? "bg-purple-500" : "bg-blue-500";

                        if (isOngoing) {
                            cardStyle = "bg-blue-50/10 dark:bg-blue-950/5 border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/20 shadow-sm";
                            dotColor = "bg-amber-500 ring-4 ring-amber-400/35";
                        } else if (isCompleted) {
                            cardStyle = "bg-white  dark:bg-[#060606] border-gray-100 dark:border-gray-855 opacity-60";
                            dotColor = "bg-emerald-500";
                        }

                        return (
                            <div key={index} className="relative">
                                {/* Vertical Schedule Dot */}
                                <div className={`absolute left-[-21px] sm:left-[-29px] top-[24px] w-2.5 h-2.5 rounded-full transition-all duration-300 ${dotColor}`}>
                                    {isOngoing && <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />}
                                </div>

                                <div
                                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md ${borderStyle} ${cardStyle}`}
                                >
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-850 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase">
                                                {item.slots.join(" + ")}
                                            </span>

                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                                                {minutesToTimeStr(item.start)} to {minutesToTimeStr(item.end)}
                                            </span>

                                            {isOngoing && (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                                    Ongoing ({minsRemaining}m left)
                                                </span>
                                            )}

                                            {isCompleted && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-55 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                                                    <CheckCircle2 size={10} />
                                                    Completed
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                                            {c.courseTitle}
                                        </h4>

                                        <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="text-gray-400 dark:text-gray-500" />
                                                <span>{c.slotVenue}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <User size={12} className="text-gray-400 dark:text-gray-500" />
                                                <span>{c.faculty}</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-550">
                                                {c.courseCode} • {c.credits} Credits
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-gray-100 dark:border-gray-800 pt-2 sm:pt-0 shrink-0">
                                        <span className="text-[10px] text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wider">
                                            Attendance
                                        </span>
                                        <span className={`text-base sm:text-lg font-black ${
                                            parseFloat(c.attendancePercentage) < 75
                                                ? "text-red-500 dark:text-red-400"
                                                : parseFloat(c.attendancePercentage) < 85
                                                    ? "text-yellow-500 dark:text-yellow-400"
                                                    : "text-emerald-500 dark:text-emerald-400"
                                        }`}>
                                            {c.attendancePercentage}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150  dark:border-gray-855 pb-3">
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">
                        Class Schedule
                    </h2>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        View daily plans, breaks, gaps, or export the full grid.
                    </p>
                </div>

                {/* View Controls & Action Buttons */}
                <div className="flex items-center flex-wrap gap-2">
                    {/* View Switcher */}
                    {!isMobile && (
                        <div className="flex items-center bg-gray-100  dark:bg-gray-950 p-1 rounded-xl border border-gray-200/60  dark:border-gray-800/80 text-xs font-semibold">
                            <button
                                onClick={() => setViewMode("schedule")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                    viewMode === "schedule"
                                        ? "bg-white  dark:bg-black text-blue-600  dark:text-blue-400 shadow-xs"
                                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-250"
                                }`}
                            >
                                <CalendarDays size={13} />
                                <span>Planner</span>
                            </button>
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                    viewMode === "grid"
                                        ? "bg-white  dark:bg-black text-blue-600  dark:text-blue-400 shadow-xs"
                                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-250"
                                }`}
                            >
                                <Grid size={13} />
                                <span>Grid Matrix</span>
                            </button>
                        </div>
                    )}

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
            </div>

            {/* Timetable Contents */}
            {viewMode === "schedule" ? (
                renderDailyPlanner()
            ) : (
                <div ref={captureRef} className="space-y-4 overflow-x-auto">
                    {renderTraditionalGrid()}
                </div>
            )}

            {/* Hidden Offscreen Container for Print/Download while viewing the Daily Planner */}
            {viewMode === "schedule" && (
                <div className="absolute left-[-9999px] top-[-9999px] w-[1200px] pointer-events-none" ref={captureRef}>
                    {renderTraditionalGrid()}
                </div>
            )}
        </div>
    );
}
