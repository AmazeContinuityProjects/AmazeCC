"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import SubpageLayout from "../shared/SubpageLayout";
import Modal from "../shared/Modal";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import {
  Search,
  Clock,
  CalendarDays,
  Building2,
  Sparkles,
  Check,
  Copy,
  DoorOpen,
  Laptop,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import type { ParsedCourse } from "../exams/FFCS/types";

// Campus Schemas
import chennaiSchema from "@/data/campus/chennai.json";
import apSchema from "@/data/campus/ap.json";
import bhopalSchema from "@/data/campus/bhopal.json";

const CAMPUS_SCHEMAS: Record<string, any> = {
  chennai: chennaiSchema,
  ap: apSchema,
  bhopal: bhopalSchema,
};

const GLOBAL_CAMPUS = "chennai";

const DAYS_OF_WEEK = [
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
];

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export default function FreeClassroomsTab({
  setActiveSubTab,
}: {
  setActiveSubTab?: (tab: string) => void;
}) {
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCampus] = useState<string>(GLOBAL_CAMPUS);
  const [selectedDay, setSelectedDay] = useState<string>("mon");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("All");
  const [venueTypeFilter, setVenueTypeFilter] = useState<"all" | "theory" | "lab">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Room Inspector Modal
  const [inspectedRoom, setInspectedRoom] = useState<string | null>(null);
  const [copiedRoom, setCopiedRoom] = useState<string | null>(null);

  const schema = CAMPUS_SCHEMAS[selectedCampus] || chennaiSchema;

  // Extract all valid time periods from schema
  const timePeriods = useMemo(() => {
    const periods: string[] = [];
    schema.theory.forEach((p: any) => {
      if (!p.lunch && p.start && p.end) {
        periods.push(`${p.start} - ${p.end}`);
      }
    });
    return periods;
  }, [schema]);

  // Determine current active slot right now
  const getCurrentSlotInfo = useCallback(() => {
    const now = new Date();
    const dayIndex = now.getDay();
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const todayStr = days[dayIndex];

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let currentPeriod = "";

    schema.theory.forEach((p: any) => {
      if (!p.lunch && p.start && p.end) {
        const startMins = timeToMinutes(p.start);
        const endMins = timeToMinutes(p.end);
        if (nowMinutes >= startMins - 10 && nowMinutes <= endMins) {
          currentPeriod = `${p.start} - ${p.end}`;
        }
      }
    });

    return {
      todayStr: dayIndex >= 1 && dayIndex <= 5 ? todayStr : "mon",
      currentPeriod: currentPeriod || timePeriods[0] || "",
      isLiveTime: !!currentPeriod && dayIndex >= 1 && dayIndex <= 5,
    };
  }, [schema, timePeriods]);

  // Autofill current day and time on mount
  useEffect(() => {
    const { todayStr, currentPeriod } = getCurrentSlotInfo();
    setSelectedDay(todayStr);
    if (currentPeriod) {
      setSelectedTime(currentPeriod);
    }
  }, [getCurrentSlotInfo]);

  // Load Course Data (with cache fallback)
  const loadCoursesData = useCallback(async (forceReload = false) => {
    setLoading(true);
    setError(null);

    if (!forceReload) {
      try {
        const cached = localStorage.getItem("ffcs_raw_courses");
        if (cached) {
          const parsedCached = JSON.parse(cached);
          if (parsedCached && parsedCached.length > 0) {
            setCourses(parsedCached);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    try {
      const XLSX = await import("xlsx");
      const response = await fetch("/ffcs/ffcsReport.csv");
      if (!response.ok) throw new Error("Failed to load campus timetable records");
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

      const parsed: ParsedCourse[] = jsonData
        .map((row: any) => {
          const cleanRow: any = {};
          for (const k in row) {
            const cleanKey = k.replace(/^\uFEFF/, "").trim().toUpperCase();
            cleanRow[cleanKey] = row[k];
          }
          return {
            CODE: String(cleanRow.CODE || cleanRow["COURSE CODE"] || cleanRow.COURSE_CODE || "").trim(),
            TITLE: String(cleanRow.TITLE || cleanRow["COURSE TITLE"] || cleanRow.COURSE_TITLE || "").trim(),
            TYPE: String(cleanRow.TYPE || "").trim(),
            CREDITS: String(cleanRow.CREDITS || "0").trim(),
            ROOM: String(cleanRow.ROOM || cleanRow.VENUE || "").trim(),
            SLOT: String(cleanRow.SLOT || "").trim(),
            FACULTY: String(cleanRow.FACULTY || "").trim(),
          };
        })
        .filter((c) => c.CODE);

      setCourses(parsed);
      try {
        localStorage.setItem("ffcs_raw_courses", JSON.stringify(parsed));
      } catch (e) {}
    } catch (err: any) {
      setError(err.message || "Failed to load timetable data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoursesData();
  }, [loadCoursesData]);

  // Set to Right Now
  const handleJumpToNow = () => {
    const { todayStr, currentPeriod } = getCurrentSlotInfo();
    setSelectedDay(todayStr);
    setSelectedTime(currentPeriod || timePeriods[0] || "");
  };

  // Compute free rooms by block for the selected day and time slot
  const freeVenuesByBlock = useMemo(() => {
    if (!selectedTime || !selectedDay || courses.length === 0) return {};

    const [reqStart, reqEnd] = selectedTime.split(" - ");
    const targetSlots = new Set<string>();

    const theoryPeriod = schema.theory.find((p: any) => p.start === reqStart && p.end === reqEnd);
    if (theoryPeriod && theoryPeriod.days && theoryPeriod.days[selectedDay]) {
      targetSlots.add(theoryPeriod.days[selectedDay]);
    }

    const labPeriod = schema.lab.find((p: any) => p.start === reqStart && p.end === reqEnd);
    if (labPeriod && labPeriod.days && labPeriod.days[selectedDay]) {
      targetSlots.add(labPeriod.days[selectedDay]);
    }

    if (targetSlots.size === 0) return {};

    const roomTypes = new Map<string, { theory: number; lab: number }>();
    const allRooms = new Set<string>();
    const occupiedRooms = new Set<string>();

    courses.forEach((course) => {
      const room = course.ROOM.toUpperCase();
      if (!room || room === "NIL" || room === "UNK-UNK" || room.includes("ONLINE") || room === "N/A") return;

      allRooms.add(room);

      if (!roomTypes.has(room)) roomTypes.set(room, { theory: 0, lab: 0 });
      const t = course.TYPE.toUpperCase();
      if (t.includes("LA") || t === "LO" || course.SLOT.toUpperCase().includes("L")) {
        roomTypes.get(room)!.lab++;
      } else {
        roomTypes.get(room)!.theory++;
      }

      const courseSlots = course.SLOT.split("+").map((s) => s.trim().toUpperCase());
      const isOccupied = [...targetSlots].some((ts) => courseSlots.includes(ts.toUpperCase()));
      if (isOccupied) {
        occupiedRooms.add(room);
      }
    });

    const freeRooms = [...allRooms].filter((r) => !occupiedRooms.has(r));

    // Group by block (e.g. "AB5-208" -> "AB5")
    const grouped: Record<string, { theory: string[]; lab: string[] }> = {};
    freeRooms.forEach((room) => {
      const parts = room.split("-");
      const block = parts.length > 1 ? parts[0] : "Other";
      if (!grouped[block]) grouped[block] = { theory: [], lab: [] };

      const counts = roomTypes.get(room)!;
      const type = counts.lab > counts.theory ? "lab" : "theory";

      grouped[block][type].push(room);
    });

    // Sort rooms inside blocks
    Object.keys(grouped).forEach((block) => {
      grouped[block].theory.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      grouped[block].lab.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    });

    return grouped;
  }, [courses, selectedTime, selectedDay, schema]);

  // Overall metric totals
  const metrics = useMemo(() => {
    let totalFree = 0;
    let totalTheory = 0;
    let totalLab = 0;

    Object.values(freeVenuesByBlock).forEach(({ theory, lab }) => {
      totalTheory += theory.length;
      totalLab += lab.length;
      totalFree += theory.length + lab.length;
    });

    return { totalFree, totalTheory, totalLab };
  }, [freeVenuesByBlock]);

  // Filtered blocks and rooms based on UI options
  const displayBlocks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const blocks = Object.keys(freeVenuesByBlock).sort();

    const filtered: Array<{
      block: string;
      theory: string[];
      lab: string[];
      totalCount: number;
    }> = [];

    blocks.forEach((block) => {
      if (selectedBlock !== "All" && block !== selectedBlock) return;

      let blockTheory = freeVenuesByBlock[block].theory;
      let blockLab = freeVenuesByBlock[block].lab;

      if (venueTypeFilter === "theory") blockLab = [];
      if (venueTypeFilter === "lab") blockTheory = [];

      if (query) {
        blockTheory = blockTheory.filter((r) => r.toLowerCase().includes(query));
        blockLab = blockLab.filter((r) => r.toLowerCase().includes(query));
      }

      const totalCount = blockTheory.length + blockLab.length;
      if (totalCount > 0) {
        filtered.push({
          block,
          theory: blockTheory,
          lab: blockLab,
          totalCount,
        });
      }
    });

    return filtered;
  }, [freeVenuesByBlock, selectedBlock, venueTypeFilter, searchQuery]);

  // Handle Copy room code
  const handleCopyRoom = (e: React.MouseEvent, room: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(room);
    setCopiedRoom(room);
    setTimeout(() => setCopiedRoom(null), 2000);
  };

  // Inspect Room Full Daily Schedule
  const inspectedRoomSchedule = useMemo(() => {
    if (!inspectedRoom || courses.length === 0) return [];

    const roomUpper = inspectedRoom.toUpperCase();
    const roomCourses = courses.filter((c) => c.ROOM.toUpperCase() === roomUpper);

    return timePeriods.map((period) => {
      const [reqStart, reqEnd] = period.split(" - ");
      const targetSlots = new Set<string>();

      const theoryPeriod = schema.theory.find((p: any) => p.start === reqStart && p.end === reqEnd);
      if (theoryPeriod?.days?.[selectedDay]) {
        targetSlots.add(theoryPeriod.days[selectedDay]);
      }

      const labPeriod = schema.lab.find((p: any) => p.start === reqStart && p.end === reqEnd);
      if (labPeriod?.days?.[selectedDay]) {
        targetSlots.add(labPeriod.days[selectedDay]);
      }

      const occupyingCourse = roomCourses.find((c) => {
        const cSlots = c.SLOT.split("+").map((s) => s.trim().toUpperCase());
        return [...targetSlots].some((ts) => cSlots.includes(ts.toUpperCase()));
      });

      return {
        period,
        isFree: !occupyingCourse,
        course: occupyingCourse || null,
        isSelectedSlot: period === selectedTime,
      };
    });
  }, [inspectedRoom, courses, timePeriods, schema, selectedDay, selectedTime]);

  const liveInfo = getCurrentSlotInfo();
  const isCurrentSlotActive =
    liveInfo.isLiveTime && selectedDay === liveInfo.todayStr && selectedTime === liveInfo.currentPeriod;

  return (
    <SubpageLayout
      title="Free Classrooms"
      onBack={() => setActiveSubTab && setActiveSubTab("overview")}
    >
      <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 text-left overflow-x-hidden">
        
        {/* ═══════════════════════════════════════════════════════
            1. HERO & LIVE STATUS BANNER (FLUID & COMPACT ON MOBILE)
           ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/5 border border-emerald-500/20 p-4 sm:p-6 shadow-xs">
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shadow-2xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Spot Finder</span>
                </span>

                {isCurrentSlotActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Real-Time</span>
                  </span>
                ) : (
                  <button
                    onClick={handleJumpToNow}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>Jump to Right Now</span>
                  </button>
                )}
              </div>

              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white font-outfit tracking-tight leading-tight">
                Find an Empty Classroom or Lab
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
                Scan campus blocks to find unoccupied study spaces and computer labs.
              </p>
            </div>

            {/* Quick Metrics Cards (Fluid 3-Columns on Mobile) */}
            <div className="grid grid-cols-3 gap-2 shrink-0 w-full md:w-auto">
              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-emerald-500/20 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-outfit">
                  Total
                </span>
                <span className="text-base sm:text-2xl font-black text-gray-900 dark:text-white">
                  {loading ? "..." : metrics.totalFree}
                </span>
                <span className="text-[8.5px] sm:text-[9px] text-gray-400 dark:text-gray-500 font-semibold">Free</span>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-outfit">
                  Theory
                </span>
                <span className="text-base sm:text-2xl font-black text-gray-900 dark:text-white">
                  {loading ? "..." : metrics.totalTheory}
                </span>
                <span className="text-[8.5px] sm:text-[9px] text-gray-400 dark:text-gray-500 font-semibold">Classrooms</span>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-outfit">
                  Labs
                </span>
                <span className="text-base sm:text-2xl font-black text-gray-900 dark:text-white">
                  {loading ? "..." : metrics.totalLab}
                </span>
                <span className="text-[8.5px] sm:text-[9px] text-gray-400 dark:text-gray-500 font-semibold">Practical</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            2. INTERACTIVE CONTROLS & OPTION EXPLORER
           ═══════════════════════════════════════════════════════ */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 shadow-xs space-y-4">
          
          {/* Day Selector Pills (Responsive Text & Spacing) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-extrabold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[10px] sm:text-[11px] flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                <span>Day of Week</span>
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                Timetable Order
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDay === day.id;
                const isToday = liveInfo.todayStr === day.id;

                return (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-2xs ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-200/60 dark:border-zinc-700/60"
                    }`}
                  >
                    <span className="sm:hidden">{day.short}</span>
                    <span className="hidden sm:inline">{day.label}</span>
                    {isToday && (
                      <span
                        className={`text-[7.5px] sm:text-[8px] font-extrabold uppercase px-1 rounded-full ${
                          isSelected
                            ? "bg-white/25 text-white"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Horizontal Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-extrabold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[10px] sm:text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Time Period</span>
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold truncate max-w-[150px] text-right">
                Slot: <strong className="text-gray-700 dark:text-gray-200">{selectedTime || "None"}</strong>
              </span>
            </div>

            <div className="flex overflow-x-auto pb-1 gap-1.5 sm:gap-2 hide-scrollbar snap-x snap-mandatory">
              {timePeriods.map((period) => {
                const isSelected = selectedTime === period;
                const isNow = liveInfo.isLiveTime && period === liveInfo.currentPeriod && selectedDay === liveInfo.todayStr;

                return (
                  <button
                    key={period}
                    onClick={() => setSelectedTime(period)}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 snap-start flex items-center gap-1.5 active:scale-95 shadow-2xs ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold"
                        : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60"
                    }`}
                  >
                    {isNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    <span>{period}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Bar: Venue Type Toggle + Search Box + Block Pills */}
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              
              {/* Venue Type Segmented Control (Fluid on Mobile) */}
              <div className="grid grid-cols-3 sm:flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl sm:rounded-2xl border border-gray-200/60 dark:border-zinc-700/60 text-xs shrink-0">
                <button
                  onClick={() => setVenueTypeFilter("all")}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                    venueTypeFilter === "all"
                      ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-2xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  All ({metrics.totalFree})
                </button>
                <button
                  onClick={() => setVenueTypeFilter("theory")}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                    venueTypeFilter === "theory"
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Theory ({metrics.totalTheory})
                </button>
                <button
                  onClick={() => setVenueTypeFilter("lab")}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                    venueTypeFilter === "lab"
                      ? "bg-white dark:bg-zinc-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Labs ({metrics.totalLab})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 w-full min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter room e.g. 208, AB5-302..."
                  className="w-full pl-8 pr-7 py-1.5 sm:py-2 text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-800/80 rounded-xl border border-gray-200/80 dark:border-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Block Selector Pills */}
            <div className="flex overflow-x-auto pb-1 gap-1.5 hide-scrollbar">
              <button
                onClick={() => setSelectedBlock("All")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedBlock === "All"
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold shadow-2xs"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                All Blocks
              </button>
              {Object.keys(freeVenuesByBlock)
                .sort()
                .map((block) => {
                  const isSelected = selectedBlock === block;
                  const count =
                    (freeVenuesByBlock[block].theory.length || 0) +
                    (freeVenuesByBlock[block].lab.length || 0);

                  return (
                    <button
                      key={block}
                      onClick={() => setSelectedBlock(block)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold shadow-2xs"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      <span>{block}</span>
                      <span
                        className={`text-[9.5px] px-1.5 py-0.2 rounded-md ${
                          isSelected
                            ? "bg-white/20 dark:bg-black/20 text-white dark:text-black font-extrabold"
                            : "bg-gray-200/80 dark:bg-zinc-700 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            3. FREE VENUES RESULTS DISPLAY
           ═══════════════════════════════════════════════════════ */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2.5">
            <XCircle className="w-7 h-7 text-rose-500 mx-auto" />
            <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              onClick={() => loadCoursesData(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Retry Loading
            </button>
          </div>
        ) : displayBlocks.length === 0 ? (
          <div className="py-14 text-center rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30 space-y-2.5 px-4">
            <DoorOpen className="w-10 h-10 text-gray-400 opacity-40 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">
              No Free Classrooms Found
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
              All registered classrooms in this building are currently occupied for this time slot.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedBlock("All");
                  setVenueTypeFilter("all");
                  setSearchQuery("");
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between text-xs px-0.5 text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-[10.5px] sm:text-[11px] truncate">
                {displayBlocks.reduce((acc, b) => acc + b.totalCount, 0)} available rooms across {displayBlocks.length} blocks
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                Tap any room to view full day schedule
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {displayBlocks.map(({ block, theory, lab, totalCount }) => (
                <div
                  key={block}
                  className="rounded-2xl sm:rounded-3xl border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3.5 text-left"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white font-outfit">
                          {block} Block
                        </h3>
                        <p className="text-[9.5px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                          Academic Building
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                      {totalCount} Free
                    </span>
                  </div>

                  {/* Classrooms List */}
                  <div className="space-y-3 flex-1">
                    {/* Theory Classrooms */}
                    {theory.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          <BookOpen className="w-3 h-3 text-indigo-500" />
                          <span>Classrooms ({theory.length})</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {theory.map((room) => {
                            const shortRoom = room.includes("-") ? room.split("-")[1] : room;
                            return (
                              <button
                                key={room}
                                onClick={() => setInspectedRoom(room)}
                                className="group relative px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gray-50 hover:bg-indigo-50 dark:bg-zinc-800/70 dark:hover:bg-indigo-950/40 border border-gray-200/80 hover:border-indigo-300 dark:border-zinc-700/80 dark:hover:border-indigo-800/60 text-xs font-bold text-gray-800 hover:text-indigo-600 dark:text-gray-200 dark:hover:text-indigo-300 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                title={`Click to view schedule for ${room}`}
                              >
                                <span>{shortRoom}</span>
                                <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 transition-all hidden xs:inline" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Labs */}
                    {lab.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          <Laptop className="w-3 h-3 text-cyan-500" />
                          <span>Laboratories ({lab.length})</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {lab.map((room) => {
                            const shortRoom = room.includes("-") ? room.split("-")[1] : room;
                            return (
                              <button
                                key={room}
                                onClick={() => setInspectedRoom(room)}
                                className="group relative px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-50/50 hover:bg-cyan-100/60 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 border border-cyan-200/60 hover:border-cyan-300 dark:border-cyan-800/50 text-xs font-bold text-cyan-800 dark:text-cyan-300 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                title={`Click to view schedule for ${room}`}
                              >
                                <span>{shortRoom}</span>
                                <span className="text-[7.5px] sm:text-[8px] font-black uppercase px-1 rounded bg-cyan-200/60 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300">
                                  Lab
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            4. ROOM SCHEDULE TIMELINE INSPECTOR MODAL (FLUID ON MOBILE)
           ═══════════════════════════════════════════════════════ */}
        {inspectedRoom && (
          <Modal onClose={() => setInspectedRoom(null)} maxWidth="max-w-xl" noPadding>
            <div className="flex flex-col max-h-[85vh] text-left">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-indigo-50/50 dark:from-zinc-900 dark:to-zinc-900 rounded-t-2xl sm:rounded-t-3xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 shrink-0">
                    <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white font-outfit truncate">
                        Room {inspectedRoom}
                      </h2>
                      <button
                        onClick={(e) => handleCopyRoom(e, inspectedRoom)}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0"
                        title="Copy Room Code"
                      >
                        {copiedRoom === inspectedRoom ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                      Schedule • {DAYS_OF_WEEK.find((d) => d.id === selectedDay)?.label}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pr-6">
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300">
                    {inspectedRoomSchedule.filter((s) => s.isFree).length}/{inspectedRoomSchedule.length} Free
                  </span>
                </div>
              </div>

              {/* Timeline Schedule Body */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2 bg-gray-50/50 dark:bg-zinc-950/50">
                <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-semibold px-0.5 uppercase tracking-wider">
                  Hourly Slot Timeline
                </p>

                <div className="space-y-1.5 sm:space-y-2">
                  {inspectedRoomSchedule.map((slot, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between gap-2 sm:gap-3 text-xs ${
                        slot.isSelectedSlot
                          ? "ring-2 ring-emerald-500/40 border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/30"
                          : slot.isFree
                          ? "bg-white dark:bg-zinc-900 border-gray-200/80 dark:border-zinc-800"
                          : "bg-gray-100/70 dark:bg-zinc-900/40 border-gray-200/50 dark:border-zinc-800/50 opacity-80"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1 font-mono font-bold text-gray-600 dark:text-gray-300 shrink-0 text-[10px] sm:text-[11px]">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{slot.period}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          {slot.isFree ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>Free & Available</span>
                            </span>
                          ) : (
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 dark:text-gray-200 truncate text-[11px] sm:text-xs">
                                {slot.course?.TITLE || slot.course?.CODE || "Occupied"}
                              </p>
                              {slot.course?.FACULTY && (
                                <p className="text-[9.5px] sm:text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                  Faculty: {slot.course.FACULTY}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {slot.isSelectedSlot && (
                          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end rounded-b-2xl sm:rounded-b-3xl">
                <button
                  onClick={() => setInspectedRoom(null)}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </SubpageLayout>
  );
}
