import { dateKey, parseCalendarMonth } from "./calendarDay";
import { buildExamRows } from "./examSchedule";

/**
 * Lab FAT week — the join between the two signals the API already sends but
 * nothing used to connect:
 *
 *  - the academic calendar marks the days, as events whose `text`/`category`
 *    read `"(Working Day / LAB FAT)"` — day-granular, no slots;
 *  - the exam schedule carries the papers, whose `slot` names the lab the
 *    exam belongs to (`"L27+L28"`) — slot-granular, no week marking.
 *
 * Joining them per date is what lets a day view say "your L1+L2 lab is a
 * Lab FAT today" instead of rendering the lab as an ordinary class.
 */

export interface LabFatPaper {
  courseCode: string;
  courseTitle: string;
  /** The paper's own slot string, e.g. `"L27+L28"`. */
  slot: string;
  /** The lab tokens of that slot — the join key onto a timetable row. */
  labTokens: string[];
  /** The exam series as VTOP spelled it. */
  series: string;
  /** The paper's raw date string, e.g. `"19-Nov-2025"`. */
  examDate: string;
  /** `YYYY-MM-DD`, for joining onto day models via {@link dateKey}. */
  dateKey: string;
  examTime?: string;
  reportingTime?: string;
  examSession?: string;
  venue?: string;
  seatNo?: string;
}

const LAB_FAT_RE = /\blab[\s-]*fat\b/i;

/** Whether a calendar event marks its day as a Lab FAT day. */
export function isLabFatMarked(text?: string, category?: string): boolean {
  return LAB_FAT_RE.test(`${text ?? ""} ${category ?? ""}`);
}

/**
 * L-prefixed tokens are labs — the same convention the timetable grids and
 * the home's own bunk math use (`startsWith("L")`), so exam slots and
 * attendance slot names classify identically.
 */
export function isLabSlotToken(token: string): boolean {
  return /^l\d/i.test(token.trim().toUpperCase());
}

/** The lab tokens of a `+`-joined slot string (`"A1+TA1+L1+L2"` → `["L1","L2"]`). */
export function labSlotTokens(slot: string | undefined | null): string[] {
  return String(slot ?? "")
    .split("+")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && isLabSlotToken(token));
}

/**
 * `YYYY-MM-DD` for every calendar day marked LAB FAT.
 *
 * Accepts the calendar payload in any shape the rest of the app stores it —
 * a months array, a `{ calendars: [...] }` wrapper, or one month object.
 */
export function labFatDateKeys(calendars: unknown): Set<string> {
  const keys = new Set<string>();
  const wrapped = calendars as { calendars?: unknown } | null | undefined;
  const months: any[] = Array.isArray(calendars)
    ? calendars
    : Array.isArray(wrapped?.calendars)
      ? (wrapped!.calendars as any[])
      : calendars
        ? [calendars]
        : [];

  for (const cal of months) {
    const { monthIndex, year } = parseCalendarMonth(cal);
    const days: any[] = Array.isArray(cal?.days) ? cal.days : [];
    for (const day of days) {
      const events: any[] = Array.isArray(day?.events) ? day.events : [];
      if (!events.some((e) => isLabFatMarked(e?.text, e?.category))) continue;
      const date = Number(day?.date);
      if (!Number.isInteger(date)) continue;
      const d = new Date(year, monthIndex, date);
      // Reject overflowed constructions (Feb 30 rolling into March).
      if (d.getMonth() !== monthIndex || d.getDate() !== date) continue;
      keys.add(dateKey(d));
    }
  }
  return keys;
}

/**
 * The lab FAT papers of the schedule — papers with a lab slot that sit on a
 * calendar-marked Lab FAT day. Empty when either signal is missing, so a
 * user without the academic calendar fetched simply sees no Lab FAT state.
 */
export function labFatPapers(
  schedule: unknown,
  calendars: unknown,
  now: Date = new Date()
): LabFatPaper[] {
  const fatDates = labFatDateKeys(calendars);
  if (fatDates.size === 0) return [];

  const out: LabFatPaper[] = [];
  for (const row of buildExamRows(schedule, now)) {
    if (!row.date) continue;
    const dateKeyOfRow = dateKey(row.date);
    if (!fatDates.has(dateKeyOfRow)) continue;
    const labTokens = labSlotTokens(row.raw?.slot);
    if (labTokens.length === 0) continue;

    out.push({
      courseCode: String(row.raw?.courseCode ?? ""),
      courseTitle: String(row.raw?.courseTitle ?? ""),
      slot: String(row.raw?.slot ?? ""),
      labTokens,
      series: row.examType,
      examDate: String(row.raw?.examDate ?? ""),
      dateKey: dateKeyOfRow,
      examTime: row.raw?.examTime,
      reportingTime: row.raw?.reportingTime,
      examSession: row.raw?.examSession,
      venue: row.raw?.venue,
      seatNo: row.raw?.seatNo,
    });
  }
  return out;
}

/** {@link labFatPapers}, bucketed by `YYYY-MM-DD` for per-day lookup. */
export function labFatPapersByDate(
  schedule: unknown,
  calendars: unknown,
  now: Date = new Date()
): Map<string, LabFatPaper[]> {
  const map = new Map<string, LabFatPaper[]>();
  for (const paper of labFatPapers(schedule, calendars, now)) {
    const list = map.get(paper.dateKey);
    if (list) list.push(paper);
    else map.set(paper.dateKey, [paper]);
  }
  return map;
}

/**
 * The Lab FAT paper for a timetable row, if any: a token-wise slot overlap
 * first (the exam sits in the same lab batch as the class), falling back to
 * the course code when VTOP spells the paper's slot differently from the
 * attendance record's.
 */
export function paperForClassSlot(
  papers: LabFatPaper[],
  courseCode: string | undefined,
  slotName: string | undefined
): LabFatPaper | undefined {
  const classTokens = new Set(labSlotTokens(slotName));
  if (classTokens.size > 0) {
    const byToken = papers.find((p) => p.labTokens.some((t) => classTokens.has(t)));
    if (byToken) return byToken;
  }
  if (!courseCode) return undefined;
  return papers.find((p) => p.courseCode === courseCode);
}
