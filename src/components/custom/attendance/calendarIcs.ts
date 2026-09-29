import {
  formatDayHeading,
  type CalendarDayEvent,
  type CalendarDayModel,
  type CalendarMonthModel,
} from "@/lib/calendarDay";

/**
 * `.ics` export for the academic calendar.
 *
 * The old page carried a `generateCalendarICS` that built the whole VCALENDAR
 * inline in a component and handed it to a synthetic `<a download>`. Splitting
 * the string from the click means the day sheet can export a single day without
 * duplicating the VCALENDAR boilerplate, and the escaping rules live in one
 * place instead of next to one `blob.push`.
 *
 * Everything is a `VALUE=DATE` all-day event. An academic calendar has no
 * times — an exam's session time is in the description, because the exam
 * schedule page already exports those as timed events with reporting time.
 */

const CRLF = "\r\n";

/** RFC 5545 requires `,` `;` and newlines escaped, and a single leading space. */
function escapeIcs(value: string): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
    .trim();
}

/** Stable-ish uid: the same day must not duplicate on re-import. */
function uidFor(scope: string, dayKey: string, index: number): string {
  return `${scope}-${dayKey}-${index}@amazecc`;
}

function vevent(scope: string, dayKey: string, index: number, summary: string, description: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${uidFor(scope, dayKey, index)}`,
    `DTSTART;VALUE=DATE:${dayKey.replace(/-/g, "")}`,
    // DTEND is exclusive in iCalendar, so a one-day event ends on the next day.
    `DTEND;VALUE=DATE:${nextDay(dayKey).replace(/-/g, "")}`,
    `SUMMARY:${escapeIcs(summary)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : "",
    "END:VEVENT",
  ].filter(Boolean);
}

function nextDay(dayKey: string): string {
  const d = new Date(
    Number(dayKey.slice(0, 4)),
    Number(dayKey.slice(5, 7)) - 1,
    Number(dayKey.slice(8, 10)) + 1
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Events worth putting in someone's real calendar. */
function isExportable(day: CalendarDayModel): boolean {
  return day.events.some((e) => e.kind !== "class" && e.kind !== "working");
}

/**
 * A milestone's description has to carry its papers.
 *
 * A folded milestone is the only event on a CAT day, so exporting it alone
 * writes "CAT II" into the user's calendar with no courses on it — less useful
 * than exporting nothing. The paper lines go in the description, which is where
 * an all-day event's detail belongs.
 */
function describe(event: CalendarDayEvent): string {
  const head = [event.detail, event.courseCode].filter(Boolean).join(" — ");
  if (!event.papers?.length) return head;
  const papers = event.papers.map((p) => `${p.title}${p.detail ? ` (${p.detail})` : ""}`).join("; ");
  return [head, papers].filter(Boolean).join(" | ");
}

function dayBody(day: CalendarDayModel): string[] {
  return day.events
    .filter((e) => e.kind !== "class" && e.kind !== "working")
    .flatMap((event, i) =>
      vevent("amazecc-day", day.dateKey, i, event.title, describe(event))
    );
}

function build(blocks: string[]): Blob {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AmazeCC//Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...blocks,
    "END:VCALENDAR",
  ];
  return new Blob([lines.join(CRLF)], { type: "text/calendar;charset=utf-8" });
}

/** Every non-class event in the semester, one file. */
export function buildCalendarIcs(months: CalendarMonthModel[]): Blob {
  const blocks = months.flatMap((m) => m.days.filter(isExportable).flatMap(dayBody));
  return build(blocks);
}

/** One day only — what the day sheet's "add to calendar" offers. */
export function buildDayIcs(day: CalendarDayModel): Blob {
  return build(dayBody(day));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick: revoking synchronously races the download in
  // Safari, which has not finished reading the blob when `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadCalendar(months: CalendarMonthModel[]): void {
  downloadBlob(buildCalendarIcs(months), "AmazeCC_Academic_Calendar.ics");
}

export function downloadDay(day: CalendarDayModel): void {
  const slug = formatDayHeading(day.fullDate).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  downloadBlob(buildDayIcs(day), `AmazeCC_${slug}.ics`);
}
