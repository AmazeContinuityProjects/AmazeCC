import { TimetableState, AddedCourse } from "@/components/custom/Exams/FFCS/types";

// Helper to convert time like "8:00 AM" to "080000"
function formatIcalTime(timeStr: string): string {
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}00`;
}

function formatIcalDateTime(date: string, timeStr: string): string {
  return `${date.replace(/-/g, "")}T${formatIcalTime(timeStr)}`;
}

function formatIcalDate(date: string): string {
  return `${date.replace(/-/g, "")}T235959Z`;
}

function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function getFirstOccurrence(fromDate: string, dayShort: string): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const targetDay = days.indexOf(dayShort.toLowerCase());
  const date = new Date(`${fromDate}T00:00:00+05:30`);
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

const DAY_TO_ICAL: Record<string, string> = {
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
};

export function exportTimetableIcal(
  timetable: TimetableState,
  timetableSchema: any,
  semesterStartDate: string,
  semesterEndDate: string
) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AmazeCC FFCS Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(timetable.name || "My FFCS Timetable")}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
  ];

  const createdAt = Date.now();

  // Pre-process schema into a quick lookup: slotName -> [{ day, start, end }]
  const slotLookup = new Map<string, { day: string; start: string; end: string }[]>();

  const processCategory = (category: any[]) => {
    category.forEach((period: any) => {
      if (!period.start || !period.end || !period.days) return;
      Object.entries(period.days).forEach(([day, slotsStr]) => {
        const slots = (slotsStr as string).split("/").map((s) => s.trim());
        slots.forEach((slotName) => {
          if (!slotLookup.has(slotName)) {
            slotLookup.set(slotName, []);
          }
          slotLookup.get(slotName)!.push({
            day,
            start: period.start,
            end: period.end,
          });
        });
      });
    });
  };

  if (timetableSchema.theory) processCategory(timetableSchema.theory);
  if (timetableSchema.lab) processCategory(timetableSchema.lab);

  timetable.courses.forEach((course) => {
    course.slots.forEach((slotName) => {
      // Ignore 'NIL'
      if (slotName === "NIL") return;

      const occurrences = slotLookup.get(slotName);
      if (!occurrences) return; // Slot not found in schema

      occurrences.forEach((occ) => {
        const firstDate = getFirstOccurrence(semesterStartDate, occ.day);
        const dtstart = formatIcalDateTime(firstDate, occ.start);
        const dtend = formatIcalDateTime(firstDate, occ.end);
        const until = formatIcalDate(semesterEndDate);

        lines.push(
          "BEGIN:VEVENT",
          `UID:${course.code}-${slotName}-${occ.day}-${createdAt}@amazecc`,
          `SUMMARY:${escapeIcal(`${course.code} - ${course.title}`)}`,
          `DESCRIPTION:${escapeIcal(
            `Faculty: ${course.faculty}\\nSlot: ${slotName}\\nType: ${course.type}`
          )}`,
          `LOCATION:${escapeIcal(course.venue)}`,
          `DTSTART;TZID=Asia/Kolkata:${dtstart}`,
          `DTEND;TZID=Asia/Kolkata:${dtend}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICAL[occ.day]};UNTIL=${until}`,
          "END:VEVENT"
        );
      });
    });
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(timetable.name || "timetable").replace(/\s+/g, "_")}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
