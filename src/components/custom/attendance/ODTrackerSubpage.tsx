"use client"

import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { officialOdDataAtom } from "@/store";
import { AnimatePresence, m } from "framer-motion";
import { Award, CheckCircle2, ChevronDown, Clock, FileText, ShieldAlert } from "lucide-react";
import { BackButton } from "../shared";
import { parseAttendanceTime } from "@/lib/attendanceTimetable";
import config from "../../../../config.json";
import OfficialOdSection from "./OfficialOdSection";
import TabHelpFooter from "../shared/TabHelpFooter";
import { getOfficialOd, matchOfficialOdForDate } from "@/lib/officialOd";

type StatusFilter = "all" | "valid" | "wasted";

interface ODTrackerSubpageProps {
    ODhoursData: any;
    attendanceData?: any[];
    onBack?: () => void;
    currSemesterID?: string;
    allGradesData?: any;
}

const WEEKDAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

// Minutes-since-midnight → "8:00 AM"
function formatClock(mins: number) {
    const h24 = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const suffix = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatRange(startMin: number, endMin: number) {
    return `${formatClock(startMin)} – ${formatClock(endMin)}`;
}

function normalizeTitle(title: string) {
    return String(title || "")
        .replace(/\s*\([A-Z0-9]+\)\s*$/i, "")
        .trim()
        .toLowerCase();
}

export default function ODTrackerSubpage({ ODhoursData, attendanceData, onBack, currSemesterID, allGradesData }: ODTrackerSubpageProps) {
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const [engineOd] = useAtom(officialOdDataAtom);

    const officialRecords = useMemo(() => {
        if (engineOd && (!currSemesterID || engineOd.semesterId === currSemesterID)) return engineOd.records || [];
        return getOfficialOd(currSemesterID)?.records || [];
    }, [engineOd, currSemesterID]);
    const officialTotalCount = useMemo(() => {
        if (engineOd && (!currSemesterID || engineOd.semesterId === currSemesterID)) return engineOd.totalCount;
        return getOfficialOd(currSemesterID)?.totalCount ?? null;
    }, [engineOd, currSemesterID]);

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
        const slotMap: any = (config as any).slotMap || {};

        // Course title → slotName lookup from live attendance (OD entries only carry titles)
        const attendanceSlotByTitle = new Map<string, string>();
        if (Array.isArray(attendanceData)) {
            attendanceData.forEach((course: any) => {
                const key = normalizeTitle(course?.courseTitle);
                const slot = String(course?.slotName || "").trim();
                if (key && slot && !attendanceSlotByTitle.has(key)) {
                    attendanceSlotByTitle.set(key, slot);
                }
            });
        }

        const resolveRange = (slotName: string, daySlots: Record<string, { time?: string }>) => {
            const slots = String(slotName || "").split("+").map(s => s.trim()).filter(Boolean);
            let startMin: number | null = null;
            let endMin: number | null = null;
            slots.forEach((slot) => {
                const raw = daySlots?.[slot]?.time;
                if (!raw || !raw.includes("-")) return;
                const [rawStart, rawEnd] = raw.split("-").map(t => t.trim());
                try {
                    const s = parseAttendanceTime(rawStart);
                    const e = parseAttendanceTime(rawEnd);
                    if (startMin === null || s < startMin) startMin = s;
                    if (endMin === null || e > endMin) endMin = e;
                } catch {}
            });
            if (startMin === null || endMin === null) return null;
            return { startMin, endMin };
        };

        const history = ODhoursData.map(dayOD => {
            const dateObj = new Date(dayOD.date);
            const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            const displayDate = dayOD.date;
            const weekday = WEEKDAY_KEYS[isNaN(dateObj.getTime()) ? 1 : dateObj.getDay()];
            const daySlots = slotMap?.[weekday] || {};

            const coursesWithStatus = dayOD.courses.map(c => {
                let isWasted = false;
                let isRecovered = false;
                let slotName = "";

                const trackedDay = tracker[displayDate];
                if (trackedDay) {
                    const matchedTrack: any = Object.values(trackedDay).find((t: any) =>
                        t.courseTitle.toLowerCase().includes(c.title.toLowerCase()) ||
                        c.title.toLowerCase().includes(t.courseTitle.toLowerCase())
                    );

                    if (matchedTrack) {
                        if (matchedTrack.status === "wasted") isWasted = true;
                        if (matchedTrack.status === "recovered") isRecovered = true;
                        if (matchedTrack.slotName) slotName = String(matchedTrack.slotName);
                    }
                }

                // Fall back to the live attendance timetable for this course's slot
                if (!slotName) {
                    slotName = attendanceSlotByTitle.get(normalizeTitle(c.title)) || "";
                }

                const range = slotName ? resolveRange(slotName, daySlots) : null;
                const timeString = range ? formatRange(range.startMin, range.endMin) : "";

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
                    slotName,
                    timeString,
                    startMin: range ? range.startMin : null,
                    endMin: range ? range.endMin : null,
                    hours
                };
            });

            totalHours += dayOD.total;

            // Group timed courses into contiguous blocks (≤10 min passing gap merges).
            // An OD spanning several back-to-back classes becomes one block with a combined span.
            const timed = coursesWithStatus
                .filter(c => c.startMin !== null && c.endMin !== null)
                .sort((a, b) => a.startMin - b.startMin);
            const blocks: Array<{ startMin: number | null; endMin: number | null; hours: number; courses: typeof coursesWithStatus }> = [];
            timed.forEach((c) => {
                const last = blocks[blocks.length - 1];
                if (last && last.startMin !== null && last.endMin !== null && c.startMin - last.endMin <= 10) {
                    last.courses.push(c);
                    if (c.endMin > last.endMin) last.endMin = c.endMin;
                    last.hours += c.hours;
                } else {
                    blocks.push({ startMin: c.startMin, endMin: c.endMin, hours: c.hours, courses: [c] });
                }
            });
            // Untimed courses each stand alone (no invented grouping)
            coursesWithStatus
                .filter(c => c.startMin === null || c.endMin === null)
                .forEach((c) => blocks.push({ startMin: null, endMin: null, hours: c.hours, courses: [c] }));

            const timedBlocks = blocks.filter(b => b.startMin !== null && b.endMin !== null);
            const daySpan = timedBlocks.length > 0
                ? formatRange(
                    Math.min(...timedBlocks.map(b => b.startMin as number)),
                    Math.max(...timedBlocks.map(b => b.endMin as number))
                  )
                : null;

            return {
                date: displayDate,
                dateStr, // YYYY/MM/DD
                totalHours: dayOD.total,
                courses: coursesWithStatus,
                blocks,
                daySpan,
                hasWasted: coursesWithStatus.some(c => c.isWasted),
                allWasted: coursesWithStatus.every(c => c.isWasted),
                officialWhy: matchOfficialOdForDate(displayDate, officialRecords)
            };
        });

        // Sort by date (newest first)
        history.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

        return { masterODHistory: history, wastedODsCount: wastedCount, validODsCount: validCount, recoveredODsCount: recoveredCount, totalODHours: totalHours };
    }, [ODhoursData, attendanceData, officialRecords]);

    const matchedDaysCount = useMemo(() => masterODHistory.filter(d => d.officialWhy && d.officialWhy.length > 0).length, [masterODHistory]);

    const visibleHistory = useMemo(() => {
        if (filter === "valid") return masterODHistory.filter(d => !d.hasWasted);
        if (filter === "wasted") return masterODHistory.filter(d => d.hasWasted);
        return masterODHistory;
    }, [masterODHistory, filter]);

    const wastedDaysCount = useMemo(() => masterODHistory.filter(d => d.hasWasted).length, [masterODHistory]);

    // Rotating insight slides for the second hero card (same pattern as the home dashboard carousel)
    const insightSlides = useMemo(() => {
        const slides: Array<{
            id: string;
            title: string;
            headline: string;
            subline: string;
            badge: string;
            badgeColor?: string;
            headlineColor?: string;
        }> = [];

        if (officialTotalCount !== null) {
            slides.push({
                id: "official",
                title: "VTOP Official",
                headline: `${officialTotalCount}`,
                subline: `${matchedDaysCount} of ${masterODHistory.length} days matched`,
                badge: "VTOP",
            });
        }

        slides.push({
            id: "valid",
            title: "Valid",
            headline: `${validODsCount} hrs`,
            subline: "Counted from your timetable",
            badge: "Valid",
            badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
            headlineColor: "text-emerald-600 dark:text-emerald-400",
        });

        slides.push({
            id: "wasted",
            title: "Wasted",
            headline: `${wastedODsCount} hrs`,
            subline: "OD credited while you were present",
            badge: "Wasted",
            badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
            headlineColor: "text-red-500 dark:text-red-400",
        });

        slides.push({
            id: "recovered",
            title: "Recovered",
            headline: `${recoveredODsCount} hrs`,
            subline: "Credited back as present since",
            badge: "Back",
            badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
            headlineColor: "text-indigo-600 dark:text-indigo-400",
        });

        return slides;
    }, [officialTotalCount, matchedDaysCount, masterODHistory.length, validODsCount, wastedODsCount, recoveredODsCount]);

    useEffect(() => {
        if (isCarouselPaused || insightSlides.length <= 1) return;
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % insightSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isCarouselPaused, insightSlides.length]);

    useEffect(() => {
        setActiveSlide(0);
    }, [insightSlides.length]);

    const currentSlideData = insightSlides[activeSlide] || insightSlides[0];

    const prettyDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300">

            {/* ── HEADER ── */}
            <div className="px-1">
                {onBack && (
                    <div className="mb-5 flex">
                        <BackButton onClick={onBack} className="self-start" />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1.5">
                        Attendance · On-Duty
                    </p>
                    <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit">
                        On-Duty hours
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                        Approved leave, matched against VTOP records.
                    </p>
                </div>
            </div>

            {/* ── HERO STATS ── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-32 sm:min-h-36 text-left relative overflow-hidden">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit">
                        Total OD
                    </span>
                    <div className="my-auto">
                        <span className="text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block text-emerald-600 dark:text-emerald-400">
                            {totalODHours}
                            <span className="text-base sm:text-lg font-extrabold text-zinc-400 dark:text-zinc-500 ml-1">hrs</span>
                        </span>
                    </div>
                    <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        Across {masterODHistory.length} {masterODHistory.length === 1 ? "day" : "days"} on duty
                    </p>
                </div>

                {currentSlideData && (
                    <div
                        onMouseEnter={() => setIsCarouselPaused(true)}
                        onMouseLeave={() => setIsCarouselPaused(false)}
                        onTouchStart={() => setIsCarouselPaused(true)}
                        onTouchEnd={() => setIsCarouselPaused(false)}
                        className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-32 sm:min-h-36 text-left relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                                {currentSlideData.title}
                            </span>
                            <span
                                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                                    currentSlideData.badgeColor || "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40"
                                }`}
                            >
                                {currentSlideData.badge}
                            </span>
                        </div>

                        <AnimatePresence mode="wait">
                            <m.div
                                key={currentSlideData.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                                className="my-auto min-w-0"
                            >
                                <span
                                    className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${
                                        currentSlideData.headlineColor || "text-zinc-900 dark:text-white"
                                    }`}
                                >
                                    {currentSlideData.headline}
                                </span>
                            </m.div>
                        </AnimatePresence>

                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                {currentSlideData.subline}
                            </p>
                            {insightSlides.length > 1 && (
                                <div className="flex items-center gap-1 shrink-0">
                                    {insightSlides.map((slide, idx) => (
                                        <span
                                            key={slide.id}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                                activeSlide === idx
                                                    ? "w-3 bg-indigo-500"
                                                    : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── WASTED-OD EXPLAINER ── */}
            <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
                Wasted ODs were credited even though you were present in class — detected when VTOP
                flips a session from present to on-duty after the fact.
            </p>

            {/* ── HISTORY ── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                            History
                        </h2>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                            {visibleHistory.length}
                        </span>
                    </div>
                    {wastedDaysCount > 0 && (
                        <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                            {(["all", "valid", "wasted"] as StatusFilter[]).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setFilter(key)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${
                                        filter === key
                                            ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                    }`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {visibleHistory.length === 0 ? (
                    <div className="p-10 rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-4 shadow-2xs">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                            <Award className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="font-black text-base text-zinc-900 dark:text-white font-outfit">
                                {masterODHistory.length === 0 ? "No OD hours yet" : "Nothing under this filter"}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
                                {masterODHistory.length === 0
                                    ? "Approved On-Duty leave will appear here once your data syncs from VTOP."
                                    : "Try a different filter to see the rest of your history."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {visibleHistory.map((d, i) => {
                            const status = d.allWasted ? "wasted" : d.hasWasted ? "partial" : "valid";
                            const key = `${d.date}-${i}`;
                            const isExpanded = expandedKey === key;
                            return (
                                <div
                                    key={key}
                                    className="rounded-2xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                                >
                                    {/* Compressed row */}
                                    <button
                                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                                        className="w-full relative py-3 px-4 flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                        status === "valid" ? "bg-emerald-500" : status === "partial" ? "bg-amber-500" : "bg-red-500"
                                                    }`}
                                                />
                                                <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                                                    {prettyDate(d.date)}
                                                </h3>
                                                {status !== "valid" && (
                                                    <span
                                                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${
                                                            status === "partial"
                                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                                        }`}
                                                    >
                                                        {status === "partial" ? "Partial" : "Wasted"}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1 truncate pl-3.5">
                                                {d.courses.length} {d.courses.length === 1 ? "session" : "sessions"}
                                                {d.daySpan && (
                                                    <span> · {d.daySpan}</span>
                                                )}
                                                {d.officialWhy && d.officialWhy.length > 0 && (
                                                    <span className="text-indigo-500 dark:text-indigo-400 font-semibold"> · {d.officialWhy[0].reason}</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right flex flex-col items-end justify-center">
                                                <span
                                                    className={`text-base font-black font-outfit tracking-tight leading-none ${
                                                        status === "valid"
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : status === "partial"
                                                            ? "text-amber-600 dark:text-amber-400"
                                                            : "text-red-500 dark:text-red-400"
                                                    }`}
                                                >
                                                    {d.totalHours}h
                                                </span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <m.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-1">
                                                    {d.officialWhy && d.officialWhy.length > 0 && (
                                                        <div className="space-y-1.5 pt-2.5">
                                                            {d.officialWhy.map((o, oi) => (
                                                                <p key={oi} className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-snug flex items-start gap-1.5 font-medium">
                                                                    <FileText size={12} className="mt-0.5 shrink-0 text-indigo-400" />
                                                                    <span>
                                                                        <span className="font-bold">{o.reason}</span>
                                                                        {o.remarks ? ` — ${o.remarks}` : ""}
                                                                    </span>
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="space-y-3 pt-1">
                                                        {d.blocks.map((block, bi) => {
                                                            const showBlockHeader =
                                                                block.startMin !== null &&
                                                                block.endMin !== null &&
                                                                (d.blocks.length > 1 || block.courses.length > 1);
                                                            return (
                                                                <div key={bi} className="space-y-1.5">
                                                                    {showBlockHeader && (
                                                                        <div className="flex items-center justify-between gap-2 pt-1">
                                                                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                                                <Clock size={12} className="shrink-0" />
                                                                                {formatRange(block.startMin as number, block.endMin as number)}
                                                                            </span>
                                                                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                                                {block.hours} {block.hours === 1 ? "hr" : "hrs"}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {block.courses.map((c, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between gap-3 min-w-0 py-1">
                                                                            <div className="min-w-0 flex-1 flex items-center gap-2">
                                                                                <p className={`text-[13px] font-semibold truncate ${c.isWasted ? "text-zinc-400 dark:text-zinc-500 line-through" : "text-zinc-800 dark:text-zinc-100"}`}>
                                                                                    {c.title}
                                                                                </p>
                                                                                {c.timeString ? (
                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                                                                                        {c.timeString}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-zinc-100/60 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500 shrink-0">
                                                                                        Time N/A
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider shrink-0">
                                                                                {c.type} · {c.hours}h
                                                                            </span>
                                                                            {c.isWasted && (
                                                                                    <span className="shrink-0 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                        <ShieldAlert size={11} /> Wasted
                                                                                    </span>
                                                                            )}
                                                                            {c.isRecovered && (
                                                                                <span className="shrink-0 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                    <CheckCircle2 size={11} /> Recovered
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </m.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── OFFICIAL VTOP RECORDS ── */}
            {currSemesterID && (
                <div className="pt-2">
                    <OfficialOdSection
                        currSemesterID={currSemesterID}
                        allGradesData={allGradesData}
                    />
                </div>
            )}

            <TabHelpFooter tabId="attendance" />
        </div>
    );
}
