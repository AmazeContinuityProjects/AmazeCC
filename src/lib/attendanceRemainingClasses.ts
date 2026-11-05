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

export { UpcomingClassesList } from "@/components/custom/attendance/UpcomingClassesList";
