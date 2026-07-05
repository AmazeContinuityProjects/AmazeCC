"use client";
import { useState, useEffect } from "react";
import config from "../../../../config.json";
import { Coffee, Pizza, MapPin, User, CheckCircle2 } from "lucide-react";

function toMinutes(t: string) {
  if (!t) return 0;
  const [hs = "0", ms = "0"] = String(t).split(":");
  let h = parseInt(hs || "0", 10);
  const m = parseInt(ms || "0", 10);
  const isPM = h === 12 || (h >= 1 && h <= 7);
  if (isPM && h !== 12) h += 12;
  return h * 60 + m;
}

function minutesToTimeStr(mins: number) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDuration(mins: number) {
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

const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getTodayDay() {
  const daysShort = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const d = new Date().getDay();
  const current = daysShort[d];
  return days.includes(current) ? current : "MON";
}

interface DailyPlannerProps {
  attendance: any[];
  activeDay?: string;
  onActiveDayChange?: (day: string) => void;
  onClassClick?: (course: any) => void;
  simulatedSkips?: Record<string, number>;
  isDayscholarWithBus?: boolean;
}

export default function DailyPlanner({ attendance, activeDay: controlledDay, onActiveDayChange, onClassClick, simulatedSkips = {}, isDayscholarWithBus = false }: DailyPlannerProps) {
  const slotMap = (config as any).slotMap || {};
  const [internalDay, setInternalDay] = useState(getTodayDay());
  const [nowMins, setNowMins] = useState(0);

  const activeDay = controlledDay ?? internalDay;
  const setActiveDay = (day: string) => {
    setInternalDay(day);
    onActiveDayChange?.(day);
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setNowMins(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const isToday = activeDay === (todayDay === "SUN" ? "SUN" : todayDay);

  const getClassCountForDay = (day: string) => {
    const uniqueCourses = new Set();
    (attendance || []).forEach((course: any) => {
      const slots = String(course.slotName || "")
        .split("+")
        .map((s) => s.trim())
        .filter(Boolean);
      slots.forEach((slot) => {
        if ((slotMap as any)[day]?.[slot]) {
          uniqueCourses.add(course.courseCode);
        }
      });
    });
    return uniqueCourses.size;
  };

  const buildDailySchedule = (day: string) => {
    const dayClasses: any[] = [];
    (attendance || []).forEach((course: any) => {
      const slots = String(course.slotName || "")
        .split("+")
        .map((s) => s.trim())
        .filter(Boolean);
      slots.forEach((slot) => {
        const slotInfo = (slotMap as any)[day]?.[slot];
        if (slotInfo?.time) {
          dayClasses.push({
            type: "class",
            slot,
            time: slotInfo.time,
            start: toMinutes(slotInfo.time.split("-")[0]),
            end: toMinutes(slotInfo.time.split("-")[1]),
            course,
          });
        }
      });
    });

    if (dayClasses.length === 0) return [];

    const merged: any[] = [];
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

    const DAY_START = 480;
    const LUNCH_START = 800;
    const LUNCH_END = 840;
    const DAY_END = 1160;

    const timeline: any[] = [];
    let pointer = DAY_START;

    merged.forEach((c) => {
      const gapStart = pointer;
      const gapEnd = c.start;
      const gap = gapEnd - gapStart;

      if (gap > 10) {
        if (gapStart < LUNCH_END && gapEnd > LUNCH_START) {
          if (gapStart < LUNCH_START && LUNCH_START - gapStart > 10) {
            timeline.push({ type: "free", start: gapStart, end: LUNCH_START, duration: LUNCH_START - gapStart });
          }
          timeline.push({ type: "lunch", start: LUNCH_START, end: LUNCH_END, duration: 40 });
          if (gapEnd > LUNCH_END && gapEnd - LUNCH_END > 10) {
            timeline.push({ type: "free", start: LUNCH_END, end: gapEnd, duration: gapEnd - LUNCH_END });
          }
        } else {
          timeline.push({ type: "free", start: gapStart, end: gapEnd, duration: gap });
        }
      }

      timeline.push(c);
      pointer = c.end;
    });

    if (pointer < LUNCH_START) {
      if (LUNCH_START - pointer > 10) {
        timeline.push({ type: "free", start: pointer, end: LUNCH_START, duration: LUNCH_START - pointer });
      }
      timeline.push({ type: "lunch", start: LUNCH_START, end: LUNCH_END, duration: 40 });
      pointer = LUNCH_END;
    }

    if (pointer < DAY_END) {
      const finalGap = DAY_END - pointer;
      if (finalGap > 10) {
        timeline.push({ type: "free", start: pointer, end: DAY_END, duration: finalGap });
      }
    }

    return timeline;
  };

  const scheduleData = buildDailySchedule(activeDay);

  // Count classes for empty-state check
  const dayHasClasses = (attendance || []).some((course: any) => {
    const slots = String(course.slotName || "").split("+").map(s => s.trim()).filter(Boolean);
    return slots.some(slot => (slotMap as any)[activeDay]?.[slot]);
  });

  return (
    <div className="space-y-4">
      {/* Day selector tabs */}
      {controlledDay === undefined && (
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
                    : "bg-white dark:bg-[#060606] border-gray-200 dark:border-gray-855 hover:border-gray-300 dark:hover:border-gray-700 text-gray-650 dark:text-gray-300"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-blue-100" : "text-gray-400 dark:text-gray-500"}`}>
                  {day}
                </span>
                <span className="text-sm font-black mt-1">
                  {count > 0 ? count : "\u2014"}
                </span>
                {isDayToday && (
                  <span className={`w-1 h-1 rounded-full mt-1 ${isActive ? "bg-white" : "bg-blue-600"}`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {!dayHasClasses ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-55/50 dark:bg-black/30 border border-dashed border-gray-250 dark:border-gray-855 rounded-2xl py-12">
          <span className="text-4xl mb-3" role="img" aria-label="party">🎉</span>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">No Classes Scheduled</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
            Enjoy your day off! Use this time to rest, study, or pursue hobbies.
          </p>
        </div>
      ) : (
        <div className="space-y-4 relative pl-4 sm:pl-6 border-l border-gray-100 dark:border-gray-855 py-2">
          {scheduleData.map((item: any, index: number) => {
            if (item.type === "free") {
              return (
                <div key={index} className="relative">
                  <div className="absolute left-[-21px] sm:left-[-29px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-750" />
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-855 bg-gray-55/35 dark:bg-black/10 select-none transition-all hover:bg-gray-50/50 dark:hover:bg-slate-900/20">
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
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/20 bg-amber-50/15 dark:bg-amber-955/2 select-none transition-all hover:bg-amber-50/20 dark:hover:bg-amber-955/10">
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

            const courseSkips = simulatedSkips[c.courseCode] || 0;
            const originalPercentage = parseFloat(c.attendancePercentage);
            const attendedClassesCount = parseInt(c.attendedClasses);
            const totalClassesCount = parseInt(c.totalClasses) + courseSkips;
            const simulatedPercentage = totalClassesCount > 0
              ? parseFloat(((attendedClassesCount / totalClassesCount) * 100).toFixed(1))
              : originalPercentage;

            const thresholdPct = isDayscholarWithBus ? 85 : 75;

            let borderStyle = isLab ? "border-l-4 border-l-purple-500" : "border-l-4 border-l-blue-500";
            let cardStyle = "bg-white dark:bg-[#060606] border-gray-200 dark:border-gray-800";
            let dotColor = isLab ? "bg-purple-500" : "bg-blue-500";

            if (isOngoing) {
              cardStyle = "bg-blue-50/10 dark:bg-blue-950/5 border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/20 shadow-sm";
              dotColor = "bg-amber-500 ring-4 ring-amber-400/35";
            } else if (isCompleted) {
              cardStyle = "bg-white dark:bg-[#060606] border-gray-100 dark:border-gray-855 opacity-60";
              dotColor = "bg-emerald-500";
            }

            const displayPct = courseSkips > 0 ? simulatedPercentage : originalPercentage;
            const isDanger = displayPct < thresholdPct;
            const isWarning = !isDanger && displayPct < (isDayscholarWithBus ? 90 : 85);
            const pctColor = isDanger
              ? "text-red-500 dark:text-red-400"
              : isWarning
                ? "text-yellow-500 dark:text-yellow-400"
                : "text-emerald-500 dark:text-emerald-400";
            const pctBg = isDanger
              ? "bg-red-500/15 dark:bg-red-400/15"
              : isWarning
                ? "bg-yellow-500/15 dark:bg-yellow-400/15"
                : "bg-emerald-500/15 dark:bg-emerald-400/15";

            return (
              <div key={index} className="relative">
                <div className={`absolute left-[-21px] sm:left-[-29px] top-[24px] w-2.5 h-2.5 rounded-full transition-all duration-300 ${dotColor}`}>
                  {isOngoing && <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />}
                </div>

                <div
                  onClick={() => onClassClick?.(c)}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md cursor-pointer relative ${borderStyle} ${cardStyle}`}
                >
                  <div className="flex-1 min-w-0 space-y-1 pr-14">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-850 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase">
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

                  <div className="absolute top-3 right-3 flex flex-col items-end gap-0.5">
                    <div className={`px-2.5 py-1 rounded-lg font-black text-sm sm:text-base leading-none ${pctBg} ${pctColor}`}>
                      {courseSkips > 0 ? `${simulatedPercentage}%` : `${originalPercentage}%`}
                    </div>
                    {courseSkips > 0 && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 line-through">{originalPercentage}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
