import config from "../../config.json";

export const ATTENDANCE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number];
export type AttendanceDayCardsMap = Record<AttendanceDay, any[]>;

export function parseAttendanceTime(timeStr: string) {
  let [h, m] = timeStr.trim().split(":").map(Number);
  if (h < 8) h += 12;
  return h * 60 + (m || 0);
}

export function getAttendanceTimeRange(time: string) {
  const [start, end] = time.split("-").map((t) => t.trim());
  return {
    start: parseAttendanceTime(start),
    end: parseAttendanceTime(end),
  };
}

export function getTodayAttendanceDay(date = new Date()): AttendanceDay {
  const days: AttendanceDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[date.getDay()];
}

export function buildAttendanceDayCardsMap(
  attendance: any[] = [],
  slotMap: any = (config as any).slotMap
): AttendanceDayCardsMap {
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
        const info = slotMap?.[day]?.[cleanSlot];
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
