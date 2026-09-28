import { longestCanonicalMatch, looseNormalise } from "./examSeries";
import type {
    AnalyzeAllCalendarsReturn,
    AnalyzeCalendarReturn,
    AnalyzedDay,
    CalendarEvent,
    CalendarInput,
    CalendarResult,
    ImportantEvent,
} from "@/types/data/semTT";
import { eachDayOfInterval, endOfMonth } from "date-fns";

const HOLIDAY_KEYWORDS = [
    "holiday", "pooja", "puja", "ayudha", "diwali", "pongal", "eid", "christmas", "good friday",
    "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
    "vacation", "term end",
    // The calendar page historically carried a longer list than this file. It is
    // the same vocabulary plus the festival names VTOP lists under `text`, so
    // the two copies were already agreeing; they are now one list.
    //
    // "no instructional" is deliberately NOT here. A non-instructional day is
    // not a holiday — the college is open and staff are on campus, there is
    // simply no teaching. It used to be in this list, which is how a working
    // day came to be reported as a day off. See `isNonInstructionalEvent`.
    "vinayakar chathurthi", "gandhi jayanthi", "thaipoosam", "telugu", "tamil", "ambedkar",
];

/**
 * The vocabulary VTOP uses for "campus is open, no classes today".
 *
 * Split out from `HOLIDAY_KEYWORDS` because these three are different facts:
 * a day with no classes, a day the college is shut, and a day with a shortened
 * list. Collapsing the first into the second is what made the old calendar
 * paint a red day for a normal working day.
 */
const NON_INSTRUCTIONAL_KEYWORDS = [
    "no instructional", "non instructional", "noninstructional", "non instructional day",
    "no class", "no classes", "no teaching", "instructors retreat", "student senate",
];

/**
 * Lower-case, strip punctuation, and collapse whitespace runs to one space.
 *
 * Delegates to `examSeries.looseNormalise`; kept as a named export because the
 * day-type classifiers and the milestone matcher both read through it, and it is
 * the rule that decides whether a working day is a day off.
 *
 * The whitespace collapse is load-bearing and was missing until the calendar
 * page needed it. VTOP writes milestones as `"CAT - I"`, and replacing the
 * punctuation gave `"cat   i"` — three spaces, because each of `"-"` and its
 * neighbours became a space. Every keyword below is a single-spaced phrase, so
 * `"cat   i".includes("cat i")` was false.
 */
export function normalize(str = ""): string {
    return looseNormalise(str);
}

/**
 * The only three fields a classifier reads.
 *
 * `CalendarEvent` types the VTOP response, where `type` is one of three day
 * types. The calendar page has always fed these functions a wider set of bags
 * — Moodle deadlines, exams, OD records and attendance rows all arrive with
 * their own `type` string and their own extra fields — and they worked, because
 * every line below stringifies before comparing. Typing the parameter as what
 * is actually read is the honest version of that, and it stops the "no
 * overlap" comparison errors that a literal union produces.
 */
export type ClassifiableEvent = {
    type?: string;
    text?: string;
    category?: string;
};

export function isHolidayEvent(e: ClassifiableEvent): boolean {
    if (!e) return false;
    const type = String(e.type || "").toLowerCase();
    const text = normalize(e.text || "");
    const cat = normalize(e.category || "");
    if (type.includes("holiday")) return true;
    for (const kw of HOLIDAY_KEYWORDS) {
        if (text.includes(kw) || cat.includes(kw)) return true;
    }
    return false;
}

/**
 * Campus open, no teaching.
 *
 * Checked *before* `isInstructionalEvent`, and it has to be: VTOP writes
 * "Non Instructional Day" with a category of "Working day", so the
 * instructional test's `category.includes("working")` also matches it. Whichever
 * runs first wins, and getting this order wrong reports a working day as
 * teaching.
 */
export function isNonInstructionalEvent(e: ClassifiableEvent): boolean {
    if (!e) return false;
    if (isHolidayEvent(e)) return false;
    const type = String(e.type || "").toLowerCase();
    const text = normalize(e.text || "");
    const cat = normalize(e.category || "");
    for (const kw of NON_INSTRUCTIONAL_KEYWORDS) {
        if (type.includes(kw) || text.includes(kw) || cat.includes(kw)) return true;
    }
    return false;
}

/**
 * Whether the day is an instructional one.
 *
 * All three fields are consulted, because the real payload spreads the signal:
 * a teaching day arrives as `text: "Instructional Day"`, `category: "Working
 * Day"`, and — on the days that carry a day order or a FAT run — as
 * `category: "Working Day / LAB FAT"`. Checking `type` and `category` alone
 * misses `"Instructional Day Order - Friday Day Order"` entirely, because its
 * type is `"Other"` and its category never says "working", so that day came
 * back as non-instructional: no classes, college open, timetable gone.
 *
 * The non-instructional guard is what makes reading `text` safe here — "No
 * Instructional Day" contains the same words in the opposite sense.
 */
export function isInstructionalEvent(e: ClassifiableEvent): boolean {
    if (!e) return false;
    if (isNonInstructionalEvent(e)) return false;
    const type = String(e.type || "").toLowerCase();
    const text = normalize(e.text || "");
    const cat = normalize(e.category || "");
    if (type === "instructional day") return true;
    if (cat.includes("working")) return true;
    return text.includes("instructional day");
}

const MONTH_NAME_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const FULL_MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
];

export interface ImportantEventName {
    key: string;
    display: string;
    short: string;
    blurb: string;
    aliases?: readonly string[];
    /**
     * Whether classes still run on the day.
     *
     * A CAT or a mid-term is an assessment, so the timetable is replaced — the
     * same rule the exam schedule applies. An LID is the opposite: it is the
     * *last* day of instruction, so it is a day you attend. Reading every
     * milestone as class-free would blank the timetable on the day the student
     * most needs to see it.
     */
    classesRun: boolean;
}

/**
 * The semester's milestones, and the only vocabulary for them.
 *
 * These are the dates a student actually plans around — when the continuous
 * tests are, when instruction stops. VTOP publishes them as ordinary calendar
 * entries with no distinguishing type, so they are found by text match, and
 * that match has to live in one place: the calendar page classifies days by it
 * and this module indexes them by it, and two copies would drift the first time
 * a name was edited.
 *
 * `display` is load-bearing and must not be reworded: `CourseDetailSubpage` and
 * the overall predictor look milestones up by exact string against it. `short`
 * is the label for a tile or a list row, where the full uppercase name is too
 * long to read.
 */
export const IMPORTANT_EVENTS: readonly ImportantEventName[] = [
    {
        key: "cat i",
        display: "CAT I",
        short: "CAT I",
        blurb: "Continuous Assessment Test I",
        classesRun: false,
    },
    {
        key: "cat ii",
        display: "CAT II",
        short: "CAT II",
        blurb: "Continuous Assessment Test II",
        classesRun: false,
    },
    {
        key: "lid for laboratory classes",
        display: "LID FOR LABORATORY CLASSES",
        short: "LID — Lab",
        blurb: "Last instructional day for laboratory classes",
        aliases: ["lid for lab"],
        classesRun: true,
    },
    {
        key: "lid for theory classes",
        display: "LID FOR THEORY CLASSES",
        short: "LID — Theory",
        blurb: "Last instructional day for theory classes",
        classesRun: true,
    },
    {
        key: "mid term test",
        display: "MID TERM TEST",
        short: "Mid Term Test",
        blurb: "Mid Term Test begins",
        classesRun: false,
    },
];

/**
 * The milestone an event names, if any.
 *
 * Both `text` and `category` are searched, `text` first. That is not
 * belt-and-braces: the academic calendar's day-type entries are
 * `"Instructional Day"` in `text` with the milestone in `category` —
 * `"Working Day / LID for LAB classes"`. Reading `text` alone loses every LID
 * date on the calendar.
 *
 * The two fields are searched separately rather than concatenated, so a
 * `text` of "CAT" and a `category` of "II" cannot combine across the boundary
 * into a CAT II that VTOP never wrote.
 */
export function matchImportantEvent(e: ClassifiableEvent): ImportantEventName | null {
  if (!e) return null;
  return matchImportantText(e.text) ?? matchImportantText(e.category);
}

function matchImportantText(text: string | undefined): ImportantEventName | null {
  if (!normalize(text ?? "")) return null;
  const needles = IMPORTANT_EVENTS.flatMap((entry) => [entry.key, ...(entry.aliases ?? [])]);
  const best = longestCanonicalMatch(text ?? "", needles);
  if (!best) return null;
  return (
    IMPORTANT_EVENTS.find(
      (entry) => entry.key === best || (entry.aliases ?? []).includes(best)
    ) ?? null
  );
}

/** A single tidy spelling for a series name, for a row or a badge. */
export function prettySeriesName(raw: string): string {
    const milestone = matchImportantEvent({ text: raw });
    if (milestone) return milestone.short;
    const cleaned = looseNormalise(raw);
    if (!cleaned) return "Exam";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function analyzeCalendar(calendar: CalendarInput = {}): AnalyzeCalendarReturn {
    const now = new Date();

    // ---- YEAR ----
    let year = Number(String(calendar.month ?? "").split(" ").pop()) || Number(calendar.year);
    if (!Number.isFinite(year)) year = now.getFullYear();

    // ---- MONTH ----
    let monthIndex: number;
    try {
        const mRaw = calendar.month;
        if (mRaw == null) monthIndex = now.getMonth();
        else if (typeof mRaw === "number") {
            if (mRaw >= 1 && mRaw <= 12) monthIndex = mRaw - 1;
            else if (mRaw >= 0 && mRaw <= 11) monthIndex = mRaw;
            else monthIndex = now.getMonth();
        } else {
            const s = String(mRaw).trim();
            const n = Number(s);
            if (!Number.isNaN(n)) {
                monthIndex = n >= 1 && n <= 12 ? n - 1 : now.getMonth();
            } else {
                const parsed = Date.parse(`${s} 1, ${year}`);
                monthIndex = !Number.isNaN(parsed)
                    ? new Date(parsed).getMonth()
                    : MONTH_NAME_MAP[s.toLowerCase().slice(0, 3)] ?? now.getMonth();
            }
        }
    } catch {
        monthIndex = now.getMonth();
    }

    // ---- DATES ----
    let monthStart = new Date(year, monthIndex, 1);
    let daysInMonth: Date[] = [];
    try {
        const monthEnd = endOfMonth(monthStart);
        daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    } catch {
        const totalDays = Number(calendar.totalDays) || 31;
        daysInMonth = Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1));
    }

    // ---- DAY LABELS ----
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // ---- OUTPUT ----
    const result: CalendarResult = {
        month: calendar.month ?? monthStart.toLocaleString(undefined, { month: "long" }),
        year,
        days: [],
        summary: {
            total: daysInMonth.length,
            working: 0,
            holiday: 0,
            other: 0,
        },
    };

    for (const dateObj of daysInMonth) {
        const date = dateObj.getDate();
        const dayName = weekdayNames[dateObj.getDay()];
        const dayInfo = Array.isArray(calendar.days)
            ? calendar.days.find((d) => Number(d.date) === date)
            : undefined;

        const events = dayInfo?.events || [];

        const hasHoliday = events.some(isHolidayEvent);
        const hasInstructional = events.some(isInstructionalEvent);
        const isEmpty = events.length === 0;

        let dayType: AnalyzedDay["type"] = "other";
        if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) dayType = "holiday";
        else if (hasInstructional) dayType = "working";

        result.days.push({
            date,
            weekday: dayName,
            type: dayType,
            events,
        });

        result.summary[dayType]++;
    }

    const importantEvents = new Map<string, ImportantEvent>();
    const milestoneMonth = FULL_MONTH_NAMES.findIndex((m) =>
        String(result.month).toLowerCase().includes(m)
    );

    for (const day of result.days) {
        for (const ev of day.events) {
            // The same matcher the calendar page classifies days with, so a
            // milestone cannot be indexed under one name and drawn as another.
            const matched = matchImportantEvent(ev);
            if (!matched || importantEvents.has(matched.key)) continue;
            importantEvents.set(matched.key, {
                event: matched.display,
                date: day.date,
                weekday: day.weekday,
                month: result.month,
                year: result.year,
                formattedDate: new Date(result.year, milestoneMonth, day.date),
            });
        }
    }
    return { result, importantEvents };
}

export function analyzeAllCalendars(calendars: unknown): AnalyzeAllCalendarsReturn {
    if (!calendars) return { results: [], importantEvents: new Map() };

    const calArray: CalendarInput[] = Array.isArray(calendars)
        ? calendars
        : (calendars as any).calendars
            ? (calendars as any).calendars
            : [calendars];

    const results: CalendarResult[] = [];
    const importantEvents = new Map<string, ImportantEvent>();

    for (const cal of calArray) {
        const { result, importantEvents: imp } = analyzeCalendar(cal);
        results.push(result);
        for (const [key, val] of imp.entries()) {
            if (!importantEvents.has(key)) importantEvents.set(key, val);
        }
    }

    return { results, importantEvents };
}
