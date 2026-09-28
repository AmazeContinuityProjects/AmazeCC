/**
 * Exam schedule parsing, ordering and display formatting.
 *
 * Kept free of React/DOM imports so the schedule page and its tests can share
 * it. The VTOP payload is `{ semester, Schedule: { FAT: [...], CAT1: [...] } }`,
 * where the series keys are data-driven — nothing here assumes CAT or FAT.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export type ExamState = "past" | "today" | "upcoming";

export interface ExamRow {
  key: string;
  examType: string;
  raw: any;
  /** Local midnight of the exam date — what we display and group by. */
  date: Date | null;
  /** Date + reported start time, when VTOP gives one. */
  startAt: Date | null;
  /** Date + reported end time, when it can be determined. */
  endAt: Date | null;
  state: ExamState;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "19-Nov-2025" / "19/11/2025" -> Date, with month-name support. */
export function parseExamDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length !== 3) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [d, m, y] = parts;
  const dayNum = parseInt(d, 10);
  if (isNaN(dayNum)) return null;
  const yearNum = parseInt(y, 10);
  if (isNaN(parseInt(m, 10))) {
    const mIndex = MONTHS.findIndex((x) => m.toLowerCase().startsWith(x));
    if (mIndex === -1) return null;
    return new Date(yearNum, mIndex, dayNum);
  }
  return new Date(yearNum, parseInt(m, 10) - 1, dayNum);
}

/** "09:15 AM" -> minutes since midnight, or null. */
export function clockMinutes(value: string | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  const [, hours, minutes, meridian] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
  if (meridian.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/** "09:15 AM - 12:30 PM" -> [start, end] in minutes, either side may be null. */
export function slotMinutes(range: string | undefined): [number | null, number | null] {
  if (!range || typeof range !== "string") return [null, null];
  const [from, to] = range.split(/\s*-\s*/);
  return [clockMinutes(from), clockMinutes(to)];
}

/** "09:15 AM - 12:30 PM" / "09:15 AM" -> minutes since midnight, or null. */
export function examStartMinutes(raw: any): number | null {
  const [start] = slotMinutes(raw?.examTime);
  return start ?? clockMinutes(raw?.reportingTime);
}

/** How long a paper runs when VTOP gives no end time: CAT 1h45, FAT 3h30. */
const SERIES_DURATION_MIN: Record<string, number> = { CAT: 105, FAT: 210 };

function seriesDurationMin(examType: string): number {
  const upper = String(examType).toUpperCase();
  if (upper.includes("CAT")) return SERIES_DURATION_MIN.CAT;
  if (upper.includes("FAT")) return SERIES_DURATION_MIN.FAT;
  return 0;
}

/**
 * Resolve a paper's real start/end instants on its own local day.
 *
 * `examTime` is "09:15 AM - 12:30 PM"; when only `reportingTime` is present the
 * end is derived from the series duration. Returns nulls when the payload has
 * no usable time at all, so callers can fall back to day-level reasoning.
 */
export function examWindow(
  raw: any,
  examType: string,
  date: Date | null
): { startAt: Date | null; endAt: Date | null } {
  if (!date) return { startAt: null, endAt: null };

  const [rangeStart, rangeEnd] = slotMinutes(raw?.examTime);
  const startMin = rangeStart ?? clockMinutes(raw?.reportingTime);
  if (startMin === null) return { startAt: null, endAt: null };

  let endMin = rangeEnd;
  if (endMin === null) {
    const duration = seriesDurationMin(examType);
    endMin = duration > 0 ? startMin + duration : null;
  }

  const at = (mins: number) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);

  return { startAt: at(startMin), endAt: endMin === null ? null : at(endMin) };
}

/**
 * Past / today / upcoming for a paper, judged against `now`.
 *
 * Time of day matters: a CAT that finished at 12:30 PM is done by 3 PM, not at
 * midnight. When no end time is known we can only judge by calendar day, which
 * is the old behaviour.
 */
export function classifyExamState(
  date: Date | null,
  endAt: Date | null,
  now: Date
): ExamState {
  if (!date) return "upcoming";

  const nowMs = now.getTime();
  if (endAt && nowMs >= endAt.getTime()) return "past";

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dayStart < todayStart) return "past";
  if (dayStart === todayStart) return "today";
  return "upcoming";
}

/**
 * Soonest-first by real start time, then course code.
 *
 * Times must be compared numerically — sorting the "09:15 AM" / "02:00 PM"
 * strings as text would put every afternoon exam before every morning one.
 */
function compareRows(a: ExamRow, b: ExamRow) {
  const at = (a.startAt ?? a.date)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = (b.startAt ?? b.date)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return `${a.raw.courseCode ?? ""}`.localeCompare(`${b.raw.courseCode ?? ""}`);
}

/**
 * Flatten `{ FAT: [...], CAT1: [...] }` into one ordered list of rows, each
 * classified against `now` and keyed for stable expansion state.
 */
export function buildExamRows(scheduleObj: unknown, now: Date = new Date()): ExamRow[] {
  if (!scheduleObj || typeof scheduleObj !== "object") return [];
  const rows: ExamRow[] = [];

  Object.entries(scheduleObj as Record<string, unknown>).forEach(([examType, subjects]) => {
    if (!Array.isArray(subjects)) return;
    (subjects as any[]).forEach((raw, idx) => {
      const date = parseExamDate(raw?.examDate);
      const { startAt, endAt } = examWindow(raw, examType, date);
      rows.push({
        key: `${examType}-${raw?.courseCode ?? idx}-${raw?.examDate ?? idx}-${idx}`,
        examType,
        raw,
        date,
        startAt,
        endAt,
        state: classifyExamState(date, endAt, now),
      });
    });
  });

  return rows.sort(compareRows);
}

/** "Saturday, Dec 14" — the house date format from the OD hours page. */
export function prettyDate(date: Date | null) {
  if (!date) return "Date TBA";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function shortDate(date: Date | null) {
  if (!date) return "TBA";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Today" / "Tomorrow" / "in 3 days" / "12 days ago". */
export function relativeDay(date: Date | null, now: Date = new Date()) {
  if (!date) return "Date to be announced";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((examDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
}

/** "9:15 AM" for the hero tile's clock line. */
export function formatClock(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "Time TBA";
  let h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const meridian = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${meridian}`;
}

/**
 * Headline for the "Next exam" tile.
 *
 * Day-level wording alone ("Today") is misleading for a paper already under
 * way, so fall back to the clock while the window is open.
 */
export function nextExamLabel(row: ExamRow | null, now: Date = new Date()): string {
  if (!row) return "All done";
  const startMin = examStartMinutes(row.raw);
  const day = relativeDay(row.date, now);
  if (day !== "Today" || !row.startAt) return day;
  if (now.getTime() >= row.startAt.getTime()) return `Now · ${formatClock(startMin)}`;
  return `Today · ${formatClock(startMin)}`;
}

/**
 * VTOP returns "-" for language papers (no seat allocated) and a bare number
 * for everything else, from which the hall position is derived: 18 seats per
 * group, split across two columns.
 */
export function calculateSeatLocation(seatNo: string, courseTitle: string): string {
  const n = Number(seatNo);
  if (isNaN(n) || n <= 0) return "-";
  if (
    courseTitle.startsWith("Qualitative") ||
    courseTitle.startsWith("Quantitative") ||
    courseTitle.startsWith("French") ||
    courseTitle.startsWith("German") ||
    courseTitle.startsWith("Spanish") ||
    courseTitle.startsWith("Japanese")
  ) {
    return "-";
  }

  const groupIndex = Math.floor((n - 1) / 18);
  const C1 = groupIndex * 2 + 1;
  const C2 = C1 + 1;
  const pos = (n - 1) % 18;
  const row = Math.floor(pos / 2) + 1;
  const col = pos % 2 === 0 ? C1 : C2;

  return `R${row}C${col}`;
}

/** "-" seat location + a real seat number means "derive it". */
export function seatLabel(subj: any) {
  if (subj.seatLocation === "-" && subj.seatNo && subj.seatNo !== "-") {
    return calculateSeatLocation(subj.seatNo, subj.courseTitle || "");
  }
  return subj.seatLocation;
}

/** Series tone for the section header — violet for FAT, sky for CAT. */
export function seriesTone(examType: string) {
  const upper = String(examType).toUpperCase();
  if (upper.includes("FAT")) return "violet";
  if (upper.includes("CAT")) return "sky";
  return "indigo";
}
