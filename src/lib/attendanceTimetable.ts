import config from "../../config.json";
import { DAYS, dayKeyForDate, slotRange, toMinutes } from "./social/schedule";
import { TEACHING_DAYS, type TeachingDay } from "./calendarDay";

export const ATTENDANCE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type AttendanceDay = (typeof DAYS)[number];
export type AttendanceDayCardsMap = Record<AttendanceDay, any[]>;

/**
 * Delegated to the one parser in `social/schedule.ts`.
 *
 * This used to carry its own rule, `if (h < 8) h += 12`, which is *not* the same
 * rule as the two grid components' `isPM = h === 12 || (h >= 1 && h <= 7)`.
 * They diverged only at `h === 0`, and `config.json` has no hour below 1, so all
 * three agreed on the real vocabulary — agreement by coincidence, not by design.
 *
 * It is kept as a named export because four call sites
 * (`ODTrackerSubpage.tsx`, `SimplifiedMobileHome.tsx`, `taskMatch.ts`, and the
 * range helper below) import it, and renaming those is churn for no gain. The
 * implementation is now shared rather than triplicated.
 */
export function parseAttendanceTime(timeStr: string): number {
  return toMinutes(timeStr);
}

export function getAttendanceTimeRange(time: string) {
  return slotRange(time);
}

export function getTodayAttendanceDay(date = new Date()): AttendanceDay {
  // NOT `DAYS[date.getDay()]`. `DAYS` is MON-first (it mirrors config.slotMap's
  // key order) while `Date.getDay()` is 0=Sunday, so indexing one with the other
  // silently shifts every day by one. `dayKeyForDate` owns that mapping.
  return dayKeyForDate(date);
}

/** A `dayOrder` that is not one of the seven is ignored rather than trusted. */
export function isTeachingDay(value: unknown): value is TeachingDay {
  return typeof value === "string" && (TEACHING_DAYS as readonly string[]).includes(value);
}

/**
 * Which timetable a *date* follows.
 *
 * Three things can decide this, in priority order:
 *
 *  1. **The published day order.** The college reschedules to recover teaching
 *     lost to a holiday, publishing `"Instructional Day Order - Thursday Day
 *     Order"` against a specific date. On that date you attend your Thursday
 *     classes even though the date is a Saturday, and reading the weekday off the
 *     calendar gets it wrong. This is per-date and beats everything else.
 *  2. **The term-wide Saturday setting.** Saturday classes in FFCS usually follow
 *     another weekday (Monday, in the common case) and the student picks that once
 *     for the whole term. `buildAttendanceDayCardsMap` has already applied it —
 *     it rewrites `map.SAT` at build time — so reading `map["SAT"]` needs no
 *     second pass here, and applying the override again would be the double-shift
 *     this comment exists to prevent.
 *  3. **The date's own weekday.** The ordinary case, and the only one most days
 *     take.
 *
 * So the day order wins and everything else falls through to the weekday, with
 * the Saturday override already baked into the map it is about to be read from.
 */
export function resolveTeachingDay(date: Date, dayOrder?: TeachingDay): AttendanceDay {
  if (isTeachingDay(dayOrder)) return dayOrder as AttendanceDay;
  return dayKeyForDate(date);
}

export function buildAttendanceDayCardsMap(
  attendance: any[] = [],
  slotMap: any = (config as any).slotMap,
  saturdayOverride?: string
): AttendanceDayCardsMap {
  let satDay = saturdayOverride;
  if (!satDay && typeof window !== "undefined") {
    try {
      satDay = localStorage.getItem("saturday_timetable_override") || undefined;
    } catch {}
  }

  const map = ATTENDANCE_DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {} as AttendanceDayCardsMap);

  attendance.forEach((course) => {
    const slots = String(course?.slotName || "")
      .split("+")
      .map((slot) => slot.trim())
      .filter(Boolean);

    slots.forEach((cleanSlot) => {
      ATTENDANCE_DAYS.forEach((day) => {
        const lookupDay = (day === "SAT" && satDay && satDay !== "SAT") ? satDay : day;
        const info = slotMap?.[lookupDay]?.[cleanSlot];
        if (!info) return;

        const pct = parseInt(course.attendancePercentage);
        const cls = pct < 50 ? "low" : pct < 75 ? "medium" : "high";

        map[day].push({
          ...course,
          courseCode: course.courseCode,
          slotName: cleanSlot,
          time: info.time,
          cls,
        });
      });
    });
  });

  ATTENDANCE_DAYS.forEach((day) => {
    map[day].sort((a, b) => {
      const timeA = getAttendanceTimeRange(a.time);
      const timeB = getAttendanceTimeRange(b.time);
      if (timeA.start !== timeB.start) return timeA.start - timeB.start;
      return String(a.slotName).localeCompare(String(b.slotName), undefined, { numeric: true });
    });

    const merged: any[] = [];
    for (const current of map[day]) {
      const previous = merged[merged.length - 1];

      if (
        previous &&
        previous.courseTitle === current.courseTitle &&
        previous.courseType === current.courseType &&
        previous.faculty === current.faculty &&
        previous.cls === current.cls
      ) {
        const previousRange = getAttendanceTimeRange(previous.time);
        const currentRange = getAttendanceTimeRange(current.time);
        const gapInMinutes = currentRange.start - previousRange.end;

        if (gapInMinutes >= 0 && gapInMinutes <= 5) {
          previous.slotName = `${previous.slotName}+${current.slotName}`;
          previous.time = `${previous.time.split("-")[0]}-${current.time.split("-")[1]}`;
          continue;
        }
      }

      merged.push({ ...current });
    }

    merged.sort((a, b) => parseAttendanceTime(a.time.split("-")[0]) - parseAttendanceTime(b.time.split("-")[0]));
    map[day] = merged;
  });

  return map;
}

export function getTodayAttendanceClasses(
  attendance: any[] = [],
  date = new Date(),
  slotMap: any = (config as any).slotMap
) {
  const dayCardsMap = buildAttendanceDayCardsMap(attendance, slotMap);
  return dayCardsMap[getTodayAttendanceDay(date)] || [];
}
