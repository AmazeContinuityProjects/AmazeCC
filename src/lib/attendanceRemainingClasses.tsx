"use client";

import { useEffect, useState, useMemo } from "react";
import { getTargetAttendancePct } from "@/store/settingsAtoms";

export type CalendarEvent = {
  text: string;
  type: "working" | "holiday";
  color: string;
  category?: string;
};

export type RemainingClassDay = {
  date: number;
  weekday: string;
  type: string;
  events?: CalendarEvent[];
  fullDate: Date;
};

export const normalize = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export function countRemainingClasses(
  courseCode: string,
  slotTime: string,
  dayCardsMap: any,
  calendarMonths: any[],
  fromDate: Date = new Date(),
): RemainingClassDay[] | null {
  if (!courseCode || !dayCardsMap || !calendarMonths) return null;

  const daysWithSubject = Object.keys(dayCardsMap).filter((day) =>
    dayCardsMap[day].some((c: any) => c.courseCode === courseCode),
  );
  if (daysWithSubject.length === 0) return null;

  const normalizeDay = (d: string) => d.slice(0, 3).toUpperCase();
  const subjectDays = daysWithSubject.map(normalizeDay);

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  let startHour = 8,
    startMinute = 0;
  if (slotTime && slotTime.includes("-")) {
    const [start] = slotTime.split("-");
    const [hRaw, mRaw] = start.split(":");
    let h = Number(hRaw);
    const m = Number(mRaw) || 0;
    if (h >= 8 && h <= 11) {
    } else if (h === 12) {
      h = 12;
    } else if (h >= 1 && h <= 7) {
      h += 12;
    }
    startHour = h;
    startMinute = m;
  }

  const allDays = calendarMonths.flatMap((monthObj) => {
    const monthStr = monthObj.month?.toString().toLowerCase() || "";
    const year = monthObj.year || new Date().getFullYear();

    const foundMonth = monthNames.find((m) => monthStr.includes(m));
    const mIndex = foundMonth ? monthNames.indexOf(foundMonth) : -1;

    return (monthObj.days || []).map((day: any) => {
      const fullDate = mIndex === -1 ? null : new Date(year, mIndex, day.date);
      const weekday = fullDate ? fullDate.toLocaleString("en-US", { weekday: "short" }) : "";

      return { ...day, fullDate, weekday };
    });
  });

  const remainingWorkingDays = allDays.filter((d) => {
    if (!d || !d.fullDate || isNaN(d.fullDate.getTime())) return false;

    const isWorkingDay =
      d.type?.toLowerCase() === "working" ||
      d.events?.some(
        (ev: any) => ev.text?.toLowerCase() === "instructional day" || ev.text?.toLowerCase().includes("working"),
      );

    if (!isWorkingDay) return false;

    let effectiveDay = normalizeDay(d.weekday || "");
    if (effectiveDay === "SAT" && Array.isArray(d.events)) {
      const dayOrderMap: Record<string, string> = {
        monday: "MON",
        tuesday: "TUE",
        wednesday: "WED",
        thursday: "THU",
        friday: "FRI",
      };

      const found = d.events.find((ev: any) =>
        /monday|tuesday|wednesday|thursday|friday/i.test(ev.category || ev.text),
      );

      if (found) {
        const match =
          found.category?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i) ||
          found.text?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i);
        if (match) effectiveDay = dayOrderMap[match[1].toLowerCase()];
      }
    }

    if (!subjectDays.includes(effectiveDay)) return false;

    const classTime = new Date(d.fullDate);
    classTime.setHours(startHour, startMinute, 0, 0);
    if (classTime < fromDate) return false;

    return true;
  });

  return remainingWorkingDays;
}

export function getEffectiveState(
  time: number,
  dateStates: Record<number, number>,
  attendanceLockDates?: Set<number>,
): number {
  if (dateStates[time] !== undefined) return dateStates[time];
  if (attendanceLockDates?.has(time)) return 2; // default ignored
  return 0; // default attending
}

export interface UpcomingClassesListProps {
  classes: any[];
  attendedClasses?: number;
  totalClasses?: number;
  isLab?: boolean;
  impDates?: any;
  isDayscholarWithBus?: boolean;
}

export function UpcomingClassesList({
  classes,
  attendedClasses = 0,
  totalClasses = 0,
  isLab = false,
  impDates,
  isDayscholarWithBus,
}: UpcomingClassesListProps) {
  const [dayStates, setDayStates] = useState<Record<number, number>>({});
  const CLASS_WEIGHT = isLab ? 2 : 1;

  if (!classes || classes.length === 0) {
    return <p className="text-gray-500  dark:text-gray-400 text-xs text-center py-4">No upcoming classes 🎉</p>;
  }

  const lockDates = useMemo(() => {
    const locked = new Set<number>();
    if (!classes || classes.length === 0) return locked;

    const isThuOrFri = (d: Date) => {
      const day = d.getDay();
      return day === 4 || day === 5;
    };

    const lastTwo = classes.slice(-2);

    lastTwo.forEach((day) => {
      const d = day.fullDate;
      if (isThuOrFri(d) && impDates?.lidLabDate && (impDates.lidLabDate as any) - (d as any) > 7) {
        locked.add(normalize(d));
      }
    });

    return locked;
  }, [classes, impDates]);

  const toggleAttendance = (time: number) => {
    setDayStates((prev) => {
      const effectiveState = getEffectiveState(time, prev, lockDates);
      const nextState = (effectiveState + 1) % 3;
      return { ...prev, [time]: nextState };
    });
  };

  let attending = 0;
  let missed = 0;

  classes.forEach((day) => {
    const time = normalize(day.fullDate);
    const state = getEffectiveState(time, dayStates, lockDates);

    if (state === 0) attending += CLASS_WEIGHT;
    if (state === 1) missed += CLASS_WEIGHT;
  });

  const upcomingCount = attending + missed;
  const predictedAttended = attendedClasses + attending;
  const predictedTotal = totalClasses + upcomingCount;
  const predictedPercent: number =
    predictedTotal > 0 ? parseFloat(((predictedAttended / predictedTotal) * 100).toFixed(1)) : 0;

  const thresholdPct = getTargetAttendancePct();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium bg-gray-50  dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100  dark:border-gray-800">
        <div className="flex gap-4">
          <span className="text-emerald-600 dark:text-emerald-400">
            Attending: <strong>{attending}</strong>
          </span>
          <span className="text-red-500 dark:text-red-400">
            Skipping: <strong>{missed}</strong>
          </span>
        </div>
        <div
          className={`px-3 py-1 rounded-full border ${
            predictedPercent >= thresholdPct
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50"
              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50"
          }`}
        >
          Predicted: {predictedPercent}%
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 text-xs">
        {classes.map((day, i) => {
          const time = normalize(day.fullDate);
          const state = getEffectiveState(time, dayStates, lockDates);
          const d = new Date(day.fullDate);
          const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });

          const isSkipped = state === 1;
          const isIgnored = state === 2;

          return (
            <div
              key={i}
              onClick={() => toggleAttendance(time)}
              className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center cursor-pointer select-none transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                isSkipped
                  ? "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                  : isIgnored
                    ? "bg-gray-100 border-gray-200 text-gray-400 dark:text-gray-500 dark:bg-gray-900 dark:border-gray-800 opacity-50"
                    : "bg-white border-gray-200 dark:bg-black dark:border-gray-800/80 text-gray-800 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500"
              }`}
            >
              <span
                className={`font-bold text-xs ${isSkipped ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}
              >
                {dateStr}
              </span>
              <span
                className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60 ${
                  isSkipped ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {weekday}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
