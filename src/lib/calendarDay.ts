import { isHolidayEvent, isInstructionalEvent, isNonInstructionalEvent, matchImportantEvent, prettySeriesName } from "./analyzeCalendar";
import { canonicalSeriesName, sameSeries } from "./examSeries";
import { isDueOnDay } from "./taskMatch";
import type { CalendarInput } from "@/types/data/semTT";
import type { Task } from "@/types/tasks";
import type { EventHubRegistration } from "@/types/data/eventhub";

/**
 * The academic-calendar day model.
 *
 * The old calendar page kept this inside `CalendarView.tsx` — about 500 lines of
 * `isHolidayEvent` / `getEventMeta` / `getEventTitle` / `getEventPriority` /
 * `getTooltipGroups` / `safeCalendars` / `masterHistory`, with events as
 * `{ type: string }` bags and a two-way door between the grid and the day panel.
 * Now that the grid and the day bottom sheet are two components, the model has
 * to be somewhere both can read, and it has no business importing React.
 *
 * Two rules everything else follows from:
 *
 *  1. **One `CalendarEvent` shape, discriminated by `kind`.** The old code
 *     re-derived an event's type from its text on every render and every sort.
 *     Classification happens once, in `buildEnrichedCalendars`, and the tone /
 *     label / title are stored on the event.
 *  2. **Day type is a property of the day, not of any one event.** A day with an
 *     exam on a holiday is a holiday that has an exam, and the log and the grid
 *     both need to be able to say that.
 */

/** The calendar variants VTOP exposes, and their human labels. */
export const CALENDAR_TYPES = {
  ALL: "General Semester",
  ALL02: "General Flexible",
  ALL03: "General Freshers",
  ALL05: "General LAW",
  ALL06: "Flexible Freshers",
  ALL08: "Cohort LAW",
  ALL11: "Flexible Research",
  WEI: "Weekend Intra Semester",
} as const;

export type CalendarTypeKey = keyof typeof CALENDAR_TYPES;

/** Every kind of thing that can land on a day, in one union. */
export type EventKind =
  | "exam"
  | "milestone"
  | "assignment"
  | "od"
  | "class"
  | "holiday"
  | "working"
  | "event";

/**
 * A calendar event as it arrives — from VTOP, or from one of the sources
 * injected into the same list.
 *
 * `CalendarEvent` in `@/types/data/semTT` types the VTOP response, where `type`
 * is one of three day types and the only payload is `text` + `category`. The
 * old calendar page then pushed Moodle deadlines, exam rows, OD records and
 * attendance rows onto the same bags with their own `type` string and their own
 * extra fields, all untyped. This is that shape written down, so the classifier
 * below has something real to switch on.
 */
export type RawCalendarEvent = {
  type?: string;
  text?: string;
  category?: string;
  color?: string;
  /** Moodle submission link. */
  url?: string;
  /** Moodle withholds the grades of a hidden submission until the deadline. */
  hidden?: boolean;
  /** Moodle deadline, on a moodle event. */
  due?: string;
  /** The attendance status, on a class event. */
  status?: string;
  courseCode?: string;
  courseTitle?: string;
  slotName?: string;
  /** OD hours. */
  hours?: number;
};

export type CalendarDayEvent = {
  kind: EventKind;
  /** Human label, already stripped of the old `[Moodle]` / `[HW]` prefixes. */
  title: string;
  /** Secondary line: the VTOP `category`, an exam venue, an OD hour count. */
  detail?: string;
  /** Sort weight inside a day. Lower is more important. */
  priority: number;
  tone: string;
  courseCode?: string;
  courseTitle?: string;
  slotName?: string;
  /** Moodle submission link. */
  url?: string;
  /** Moodle marks a submission as hidden while its grades are withheld. */
  hidden?: boolean;
  /** The deadline, for anything that has one (assignment, task). */
  dueAt?: Date;
  /** The exam series this paper belongs to, in whatever spelling VTOP used. */
  series?: string;
  /**
   * Whether classes still run on this event's day. Set on milestones only, and
   * `false` for an assessment (a CAT, a mid-term) and `true` for a boundary
   * (an LID, which is the last day you attend).
   */
  classesRun?: boolean;
  /**
   * The papers of a milestone, when a milestone on this day has been folded
   * into one event. Only set on a `milestone`.
   */
  papers?: CalendarDayEvent[];
  /** A class you were marked absent for. */
  absent?: boolean;
  /** OD hours, when this event is an OD record. */
  hours?: number;
  /** The task this came from, when it came from the task store. */
  taskId?: string;
  /**
   * The user's own photo, for events they registered for themselves.
   *
   * Deliberately absent by default. The caller resolves it and only passes it
   * when `shouldShowProfilePhoto` allows, so a photo the user turned off never
   * reaches the model — and everything downstream of the model is
   * export-shaped, so a field that got in here once would be one refactor away
   * from a shared calendar file.
   */
  avatarUrl?: string;
  /** The EventHub id, so a row can deep-link back to the registration. */
  eventhubId?: string;
  raw?: any;
};

/**
 * What kind of day this is.
 *
 * Three questions that used to be conflated into one, and the reason this is a
 * union rather than a boolean:
 *
 *  - `instructional`    — classes run.
 *  - `semiholiday`      — a *shortened* list. Classes still run, fewer of them.
 *  - `nonInstructional` — **no classes, but the college is open.** Staff are on
 *                         campus; you are expected in. Not a day off.
 *  - `holiday`          — the college is shut.
 *  - `other`            — nothing published. Not a claim in either direction.
 *
 * The `nonInstructional` / `holiday` split is the one that matters. Folding
 * them together is how a working day ends up painted red and labelled a day
 * off, and it is what the old page did: "no instructional" was in the holiday
 * keyword list, so every non-teaching working day came back as a holiday.
 */
export type DayType =
  | "instructional"
  | "semiholiday"
  | "nonInstructional"
  | "holiday"
  | "other";

export type DayClassRecord = {
  courseCode: string;
  courseTitle: string;
  status: string;
  date: string;
  /**
   * The date string exactly as VTOP wrote it in `viewLink[].date`.
   *
   * This is the key the notes tracker is written under, and the Theory and Lab
   * log pages write it under `h.date` — the raw string. Writing a normalised
   * `YYYY-MM-DD` here instead would make the two pages disagree about whether
   * notes for the 12th are already secured, which is invisible until someone
   * marks notes on one page and checks the other.
   */
  rawDate: string;
};

export type DayAttendance = {
  held: number;
  present: number;
  absent: number;
  onDuty: number;
  courses: DayClassRecord[];
};

export type CalendarDayModel = {
  /** 1-31. */
  date: number;
  fullDate: Date;
  /** `YYYY-MM-DD`, the join key against tasks, moodle and OD data. */
  dateKey: string;
  /** `Mon`, `Tue`, ... — the calendar weekday, which is not always the teaching day. */
  weekday: string;
  /**
   * The timetable this date actually follows, when the college said so.
   *
   * A "day order" is a reschedule: the college publishes
   * `"Instructional Day (Instructional Day Order - Thursday Day Order)"` and
   * means that *on this date* you attend your **Thursday** classes, whatever
   * weekday this date falls on. It exists to recover teaching lost to a holiday,
   * so it lands on Saturdays surprisingly often, and it is the reason
   * `weekday` alone cannot answer "what do I have today".
   *
   * `undefined` means the ordinary case — this date follows its own weekday —
   * which is the majority of days and must stay the cheap path.
   */
  dayOrder?: TeachingDay;
  dayType: DayType;
  events: CalendarDayEvent[];
  attendance: DayAttendance;
  /** Number of unfinished tasks due today. */
  taskCount: number;
};

export type CalendarMonthModel = {
  id: string;
  /** `August 2026` */
  label: string;
  /** `Aug 2026` */
  shortLabel: string;
  monthIndex: number;
  year: number;
  days: CalendarDayModel[];
  summary: { total: number; working: number; holiday: number; other: number };
};

/** An event with no meaningful text still has to render as something. */
const GENERIC_TITLE = "Untitled event";

const KIND_TONE: Record<EventKind, string> = {
  exam: "amber",
  milestone: "indigo",
  assignment: "violet",
  od: "sky",
  class: "emerald",
  holiday: "red",
  working: "zinc",
  event: "zinc",
};

const KIND_LABEL: Record<EventKind, string> = {
  exam: "Exam",
  milestone: "Milestone",
  assignment: "Assignment",
  od: "OD",
  class: "Class",
  holiday: "Holiday",
  working: "Day Type",
  event: "Event",
};

/** What the month grid draws, in legend order. */
export const LEGEND_ITEMS = [
  { tone: KIND_TONE.class, label: "Class" },
  { tone: KIND_TONE.exam, label: "Exam" },
  { tone: KIND_TONE.assignment, label: "Assignment" },
  { tone: KIND_TONE.milestone, label: "Milestone" },
  { tone: KIND_TONE.od, label: "OD" },
  { tone: KIND_TONE.holiday, label: "Holiday" },
] as const;

/**
 * A shortened class list is a *semi*-holiday, not an "other" day.
 *
 * VTOP marks these on the day itself rather than in the day's type, so a CAT
 * weekend reads as an ordinary teaching day until you read the text.
 */
const SEMI_HOLIDAY_KEYWORDS = ["cat - i", "cat - ii", "technovit", "vibrance", "oneday"];

function stripPrefix(text: string, prefix: string): string {
  return String(text ?? "").replace(prefix, "").trim();
}

function makeEvent(partial: Omit<CalendarDayEvent, "priority" | "tone"> & { priority?: number }): CalendarDayEvent {
  const priority = partial.priority ?? DEFAULT_PRIORITY[partial.kind];
  return {
    ...partial,
    title: (partial.title || "").trim() || GENERIC_TITLE,
    priority,
    tone: KIND_TONE[partial.kind],
  };
}

const DEFAULT_PRIORITY: Record<EventKind, number> = {
  exam: 0,
  milestone: 1,
  assignment: 2,
  class: 3,
  od: 4,
  holiday: 5,
  working: 6,
  event: 7,
};

function isSemiHolidayEvent(e: RawCalendarEvent): boolean {
  if (isHolidayEvent(e) || isNonInstructionalEvent(e)) return false;
  const haystack = `${e?.text ?? ""} ${e?.category ?? ""}`.toLowerCase();
  return SEMI_HOLIDAY_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** The type words VTOP writes into `text`, which say no more than the kind. */
const TYPE_WORDS = [
  "instructional day",
  "no instructional day",
  "non instructional day",
  "noninstructional day",
  "holiday",
  "working day",
  "working",
];

function isTypeWord(value: string): boolean {
  return TYPE_WORDS.includes(value.toLowerCase());
}

// ---------------------------------------------------------------------------
// Instructional day order
// ---------------------------------------------------------------------------

/**
 * A teaching day, `MON`-first to match `config.json`'s `slotMap` keys.
 *
 * Declared here rather than imported from `attendanceTimetable` because that
 * module reads `config.json` and `localStorage`, and this one is the pure model
 * that everything else is derived from. `attendanceTimetable` re-exports nothing
 * from here either — the two agree on the seven keys and nothing else.
 */
export type TeachingDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const TEACHING_DAYS: readonly TeachingDay[] = [
  "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN",
];

/** `Mon`, `Thu`, … for display, from a `MON`-first key. */
export const TEACHING_DAY_LABEL: Record<TeachingDay, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};

/**
 * The stem of a weekday, plus whatever letters the rest of the word is made of.
 *
 * The tail is `[a-z]*` and the *whole* match is then looked up in a table rather
 * than matched against a list of suffixes. Enumerating the suffixes is the
 * obvious way to write this and it is wrong in a way that hides: the seven long
 * forms are `day / sday / nesday / rsday / urday / nes / rs` depending on the
 * stem, and forgetting one silently loses that weekday completely — a Tuesday
 * reschedule then reads as an ordinary teaching day, which is the exact failure
 * this is here to prevent. Looking the word up cannot forget a case, and it also
 * gives a place to put the abbreviations VTOP actually writes (`SAT`).
 *
 * `[a-z]*` is greedy, so `"monsoon"` matches whole and is then *not* in the
 * table — skipped, rather than read as a Monday.
 */
const WEEKDAY_IN_TEXT = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*/gi;

const WEEKDAY_KEY: Record<string, TeachingDay> = {
  mon: "MON", monday: "MON",
  tue: "TUE", tues: "TUE", tuesday: "TUE",
  wed: "WED", weds: "WED", wednesday: "WED",
  thu: "THU", thur: "THU", thurs: "THU", thursday: "THU",
  fri: "FRI", friday: "FRI",
  sat: "SAT", saturday: "SAT",
  sun: "SUN", sunday: "SUN",
};

function lastWeekdayIn(text: string): TeachingDay | undefined {
  let found: TeachingDay | undefined;
  // `exec` on a /g regex walks the whole string, so this ends on the LAST
  // weekday named rather than the first. See `parseDayOrder` for why that is the
  // one we want. `lastIndex` is reset first so a caller that arrives mid-string
  // cannot inherit a previous call's position.
  WEEKDAY_IN_TEXT.lastIndex = 0;
  for (let m = WEEKDAY_IN_TEXT.exec(text); m; m = WEEKDAY_IN_TEXT.exec(text)) {
    const key = WEEKDAY_KEY[m[0].toLowerCase()];
    if (key) found = key;
  }
  WEEKDAY_IN_TEXT.lastIndex = 0;
  return found;
}

/**
 * The day order the college published for a date, if any.
 *
 * VTOP writes it into the `category` of an instructional-day entry, under any of
 * these shapes:
 *
 *   `"Instructional Day Order - Thursday Day Order"`   ← the full phrase
 *   `"Instructional Day Order – Thursday Day Order"`   ← en dash
 *   `"Thursday Day Order"`                             ← already stripped
 *   `"Instructional Day Order: Thursday"`
 *   `"Instructional Day Order - SAT"`
 *
 * Three decisions worth stating, because all three are load-bearing:
 *
 *  - **Only instructional entries are read.** A holiday named "Sunday Observance"
 *    or a festival containing a weekday must not be able to declare a
 *    reschedule, so the scan is restricted to events `isInstructionalEvent`
 *    accepts. Everything else on a day is an exam, a milestone or a notice.
 *  - **The LAST weekday named wins.** A reschedule lands on Saturdays
 *    surprisingly often — that is the whole point of publishing one — and the
 *    natural way to write it names the real date first. A Saturday row reading
 *    `"Saturday - Instruction Day Order - Thursday Day Order"` has two weekdays
 *    in it, and the first one is not the answer.
 *  - **`text` is searched too, not just `category`.** VTOP has been seen splitting
 *    the phrase across the two fields, and a reschedule is far too consequential
 *    to drop because it arrived in the other one.
 */
export function parseDayOrder(events: RawCalendarEvent[]): TeachingDay | undefined {
  let found: TeachingDay | undefined;
  for (const e of events) {
    if (!e || !isInstructionalEvent(e)) continue;
    found = lastWeekdayIn(`${e.text ?? ""} ${e.category ?? ""}`) ?? found;
  }
  return found;
}

/**
 * A one-line note for the day sheet, or `undefined` when the day is ordinary.
 *
 * The timetable changing under you with no explanation is the failure this whole
 * feature exists to prevent, so anything that reads a day's classes has to be
 * able to say *why* they are not that weekday's.
 */
export function dayOrderNote(day: {
  dayOrder?: TeachingDay;
  fullDate: Date;
}): string | undefined {
  if (!day.dayOrder) return undefined;
  const actual = TEACHING_DAYS[(day.fullDate.getDay() + 6) % 7];
  if (actual === day.dayOrder) return undefined;
  return `Following the ${TEACHING_DAY_LABEL[day.dayOrder]} timetable on this ${TEACHING_DAY_LABEL[actual]}.`;
}

/**
 * The best name for a day-type entry.
 *
 * VTOP writes these as `text (category)` and the split is consistent: `text` is
 * a type word, `category` is the name. `"Holiday (Gandhi Jayanthi)"`,
 * `"No Instructional Day"`, `"Instructional Day (Working Day)"`,
 * `"Instructional Day (Instructional Day Order - Friday Day Order)"`,
 * `"Instructional Day (Working Day / LID for LAB classes)"`.
 *
 * So the category wins the title, the type word is dropped, and whatever
 * survives is capitalised. The category is split on `/` and each segment that is
 * only a type word is discarded, which is what turns `"Working Day / LAB FAT"`
 * into `"LAB FAT"` while leaving a bare `"Working Day"` with nothing to say.
 * Only `/` splits: the `-` in `"Instructional Day Order - Friday Day Order"`
 * is part of the name, not a separator, so that prefix is stripped instead and
 * `"Friday Day Order"` is what remains.
 *
 * The subtitle is the `text` only when it is not itself a type word, so a row
 * never prints "Working day" twice — which is exactly what the previous code
 * did on every instructional day of the calendar.
 */
function dayTypeTitle(e: RawCalendarEvent, fallback: string): { title: string; detail?: string } {
  const text = (e?.text ?? "").trim();
  const cat = (e?.category ?? "").trim();

  const segments = cat
    ? cat
        .split(/\s*\/\s*/)
        .map((s) => s.trim())
        .filter((s) => s && !isTypeWord(s))
    : [];

  const name = segments
    .join(" · ")
    .replace(/^instructional day order\s*[-–:]?\s*/i, "")
    .trim();

  if (!name) return { title: fallback || "Event" };

  return {
    title: name.charAt(0).toUpperCase() + name.slice(1),
    detail: text && !isTypeWord(text) && text.toLowerCase() !== name.toLowerCase() ? text : undefined,
  };
}

function classify(e: RawCalendarEvent): CalendarDayEvent {
  if (e?.type === "exam") {
    return makeEvent({
      kind: "exam",
      title: stripPrefix(e.text, "exam") || e.text,
      detail: e.category,
      raw: e,
    });
  }
  if (e?.type === "moodle") {
    return makeEvent({
      kind: "assignment",
      title: e.text ? stripPrefix(e.text, "[Moodle]") || e.text : GENERIC_TITLE,
      detail: e.category,
      dueAt: e.due ? parseDayDate(e.due) : undefined,
      url: e.url,
      hidden: e.hidden,
      raw: e,
    });
  }
  if (e?.type === "homework") {
    return makeEvent({
      kind: "assignment",
      title: e.category || stripPrefix(e.text, "[HW]"),
      detail: e.courseTitle,
      raw: e,
    });
  }
  if (e?.type === "od") {
    return makeEvent({
      kind: "od",
      title: e.courseTitle || e.text || "On-Duty",
      detail: "On-Duty",
      hours: e.hours,
      raw: e,
    });
  }
  if (e?.type === "attendance") {
    return makeEvent({
      kind: "class",
      title: e.courseTitle || e.text || "Class",
      detail: e.category,
      courseCode: e.courseCode,
      courseTitle: e.courseTitle,
      slotName: e.slotName,
      absent: e.status === "absent",
      raw: e,
    });
  }
  if (isHolidayEvent(e)) {
    const { title, detail } = dayTypeTitle(e, "Holiday");
    return makeEvent({ kind: "holiday", title, detail, raw: e });
  }
  if (isNonInstructionalEvent(e)) {
    // The payload's own wording is the name here: a non-instructional day has
    // no category at all, so "No Instructional Day" is the best thing to show.
    const { title, detail } = dayTypeTitle(e, e?.text?.trim() || "No classes");
    return makeEvent({ kind: "working", title, detail, raw: e });
  }

  // Checked *before* the instructional test, and this ordering is load-bearing
  // twice over. VTOP's day-type entries carry `text: "Instructional Day"` and
  // put the milestone in `category` — `"Working Day / LID for LAB classes"` —
  // so the instructional branch would claim it and the LID would vanish. And a
  // semester boundary is not the same fact as "teaching happens".
  const milestone = matchImportantEvent(e);
  if (milestone) {
    return makeEvent({
      kind: "milestone",
      title: milestone.short,
      detail: milestone.blurb,
      classesRun: milestone.classesRun,
      raw: e,
    });
  }

  if (isInstructionalEvent(e)) {
    const { title, detail } = dayTypeTitle(e, "Working day");
    return makeEvent({ kind: "working", title, detail, raw: e });
  }
  return unclassifiedEvent(e);
}

/**
 * The catch-all, and the only branch that flips title and detail.
 *
 * Everywhere else the title is a name we chose — "Working Day", "CAT II", the
 * holiday's own text — and the detail is supporting context. Here we have
 * neither: VTOP gave two free-text fields and no type, and for a plain college
 * notice the `category` is the name worth showing ("Gandhi Jayanti") while
 * `text` is the rest ("Gandhi Jayanthi"). Reading them the other way round puts
 * the weaker string in the position the eye reads first.
 *
 * Deliberately scoped to this branch. Swapping `text` and `category` for the
 * classified kinds would overwrite a curated title with a raw payload, which is
 * the thing this whole file exists to avoid.
 */
function unclassifiedEvent(e: RawCalendarEvent): CalendarDayEvent {
  const title = (e?.category || "").trim() || (e?.text || "").trim() || KIND_LABEL.event;
  const rest = (e?.text || "").trim();
  // Identical fields would render the same string twice, once bold and once not.
  return makeEvent({
    kind: "event",
    title,
    detail: rest && rest !== title ? rest : undefined,
    raw: e,
  });
}

/** Human name for a kind, independent of any event. */
export function kindLabel(kind: EventKind): string {
  return KIND_LABEL[kind];
}

/**
 * The exam papers on one date.
 *
 * Papers normally sit at the top level of a day, but a paper that belongs to a
 * milestone on the same day is folded into that milestone — see
 * `foldPapersIntoMilestones`. So this flattens both, and callers that ask
 * "does this day have a paper" cannot be fooled by the folding.
 */
export function examsOn(day: CalendarDayModel): CalendarDayEvent[] {
  return day.events.flatMap((e) => (e.kind === "exam" ? [e] : e.papers ?? []));
}

/** Milestones on a day, with any folded papers still attached. */
export function milestonesOn(day: CalendarDayModel): CalendarDayEvent[] {
  return day.events.filter((e) => e.kind === "milestone");
}

/**
 * Everything on a day that is an assessment, as one list.
 *
 * The academic calendar and the exam schedule are two systems writing the same
 * news: one says "CAT - II is on the 12th", the other says "Biology, 9am,
 * Room 204, on the 12th". `foldPapersIntoMilestones` joins them when the series
 * names match, and a reader should never have to know which system won. So a
 * day with a milestone *and* a paper whose series did not match — a FAT landing
 * on the same day, or a schedule key spelled nothing like the calendar's — is
 * still one assessment, and belongs in one place rather than as a headline plus
 * a separate section further down the sheet.
 *
 * Milestones lead the order. A milestone is the day's announcement and a loose
 * paper is the detail, and that holds whichever of the two sorts first by
 * `priority` on its own.
 *
 * Distinct from `examsOn`, which answers "does this day have a paper" and so
 * flattens the folded ones out of their parents. This one is for display and
 * must not flatten anything.
 */
export function assessmentsOn(day: CalendarDayModel): CalendarDayEvent[] {
  return day.events
    .filter((e) => e.kind === "exam" || e.kind === "milestone")
    .sort((a, b) => {
      const aLead = a.kind === "milestone" ? 0 : 1;
      const bLead = b.kind === "milestone" ? 0 : 1;
      return aLead - bLead || a.priority - b.priority || a.title.localeCompare(b.title);
    });
}

/**
 * Fold a milestone's papers into the milestone.
 *
 * The academic calendar says a milestone happens; the exam schedule says which
 * papers, where and when. Those are one event described twice, and rendering
 * them as separate rows is what the user sees as duplication — a "CAT II"
 * milestone beside a "CAT2" paper that is the same event. So the papers move
 * under the milestone, keyed on the canonical series name so any spelling of
 * the series folds into the same parent.
 *
 * Papers that match no milestone stay at the top level; a FAT paper with no
 * milestone entry on the calendar is still an event.
 *
 * It also settles two milestones competing for one date, which is the other way
 * this arrives. VTOP will put a "CAT - I" row and a "CAT - II" row on the *same*
 * date — around a combined test block the calendar marks the surrounding dates
 * and the reader sees two tests where the schedule has one. The exam schedule is
 * the authority on which of them actually happened, because it is the system
 * that has to name a room and a seat. So once papers have been folded in, a
 * milestone that owns some has been confirmed, and a rival assessment with none
 * has not — the rival goes.
 *
 * Two constraints keep this from eating real information:
 *
 *  - if *no* milestone owns papers there is no authority to appeal to, so
 *    nothing is dropped. Two CATs on one date with no schedule data is two
 *    things the college said, and guessing between them would be inventing a
 *    date.
 *  - only assessments are dropped. An LID is not a rival, it is a separate
 *    claim about the last day of instruction, and it is not an "assessment" even
 *    though it shares the `milestone` kind.
 */
function foldPapersIntoMilestones(events: CalendarDayEvent[]): CalendarDayEvent[] {
  const milestones = events.filter((e) => e.kind === "milestone");
  if (!milestones.length) return events;

  const exams = events.filter((e) => e.kind === "exam");
  const claimed = new Set<CalendarDayEvent>();

  const folded = milestones.map((m) => {
    const mine = exams.filter((e) => sameSeries(String(e.series ?? ""), m.title));
    mine.forEach((e) => claimed.add(e));
    return mine.length ? { ...m, papers: mine } : m;
  });

  // The schedule has spoken. Every milestone carrying papers is confirmed; an
  // assessment with no papers beside a confirmed one is the calendar's noise.
  const confirmed = folded.filter((m) => (m.papers?.length ?? 0) > 0);
  const kept =
    confirmed.length === 0
      ? folded
      : folded.filter((m) => (m.papers?.length ?? 0) > 0 || m.classesRun === true);

  return [
    ...kept,
    ...events.filter((e) => e.kind !== "exam" && e.kind !== "milestone"),
    ...exams.filter((e) => !claimed.has(e)),
  ];
}

/** The holidays written on a day. */
export function holidaysOn(day: CalendarDayModel): CalendarDayEvent[] {
  return day.events.filter((e) => e.kind === "holiday");
}

/** What a day is "about" — the slot its sheet leads with. */
export type DayHeadlineKind = "milestone" | "exam" | "nonInstructional" | "holiday" | "schedule";

export type DayHeadline = {
  kind: DayHeadlineKind;
  /**
   * Every event in that slot, not just one. A milestone that owns its papers
   * leads with itself; a day carrying three loose papers leads with all three,
   * because a reader wants the list and not the first entry of it.
   */
  events: CalendarDayEvent[];
};

/**
 * Which events a day is about.
 *
 * A day can carry a dozen things at once - a holiday, a club workshop, three
 * CAT papers - and they are not peers. One of them is the day's headline and
 * the rest are footnotes to it, so both the day sheet and the Upcoming list
 * have to agree on which is which. If they picked independently they would
 * drift, and the sheet would say "CAT II" while Upcoming said "Robotics Club"
 * for the same date, which reads as a bug in the data rather than in the rule.
 *
 * So the rule lives here once. The order is a claim about consequence, not
 * about importance: an assessment cancels the timetable, a holiday cancels the
 * college, and an event is what is left over.
 */
export function dayHeadline(day: CalendarDayModel): DayHeadline {
  // A milestone that already owns its papers speaks for itself.
  const owner = day.events.find((e) => e.kind === "milestone" && (e.papers?.length ?? 0) > 0);
  if (owner) return { kind: "milestone", events: [owner] };

  // An assessment milestone with no papers attached is still a milestone the
  // college published. The exam schedule may simply not have been fetched yet,
  // or may file the papers under a name the fold could not match — and either
  // way the day has no classes, which `hasClasses` and `isExamDay` already say
  // by looking at `classesRun`. If this did not lead, the sheet would show a
  // timetable for a day that has none, and the three rules would disagree.
  const assessment = day.events.find((e) => e.kind === "milestone" && e.classesRun === false);
  if (assessment) return { kind: "milestone", events: [assessment] };

  // Papers with no milestone to fold under still head the day: no classes run.
  const papers = examsOn(day);
  if (papers.length) return { kind: "exam", events: papers };

  if (day.dayType === "nonInstructional") return { kind: "nonInstructional", events: holidaysOn(day) };
  if (day.dayType === "holiday") return { kind: "holiday", events: holidaysOn(day) };

  return { kind: "schedule", events: [] };
}

/**
 * The single event that stands for a day, for callers that can only show one.
 *
 * `dayHeadline` can return a list - three loose papers are three entries in the
 * day's slot - but Upcoming shows one row per date. The first entry stands in,
 * and the rest ride along as extras.
 */
export function primaryEventOn(day: CalendarDayModel): CalendarDayEvent | undefined {
  return dayHeadline(day).events[0];
}

/**
 * Whether classes run on this day.
 *
 * Four things say they do not, and they are different claims:
 *  - the day type is `nonInstructional` — no teaching, college open;
 *  - the day type is `holiday` — the college is shut;
 *  - there is an exam paper on it, from the exam schedule;
 *  - there is an *assessment* milestone on it, from the academic calendar. A
 *    CAT is an exam whether or not the schedule row came through, and a
 *    calendar that says "CAT - II" with no paper attached still is not a
 *    teaching day.
 *
 * An LID milestone is the deliberate exception: it is the last day of
 * instruction, so the timetable is exactly what the user needs to see. That
 * distinction is why `classesRun` is carried on the event rather than assumed
 * from "is a milestone".
 */
export function hasClasses(day: CalendarDayModel): boolean {
  if (examsOn(day).length > 0) return false;
  if (day.events.some((e) => e.kind === "milestone" && e.classesRun === false)) return false;
  return day.dayType === "instructional" || day.dayType === "semiholiday";
}

/** Whether the college is open that day, independently of whether it teaches. */
export function isCollegeOpen(day: CalendarDayModel): boolean {
  if (day.dayType === "holiday") return false;
  if (day.dayType === "other") return true;
  return true;
}

/** Kept as the calendar-page's headline case: an exam day has no classes. */
export function isExamDay(day: CalendarDayModel): boolean {
  return (
    examsOn(day).length > 0 ||
    day.events.some((e) => e.kind === "milestone" && e.classesRun === false)
  );
}

/**
 * The tones worth drawing on a month cell, in priority order.
 *
 * "Worth drawing" is a rule about the cell, not about the day: a class and an
 * instructional-day marker are the grid's background state, not news, and an
 * absent class outranks an exam because it is the one you can still act on.
 * Lives here rather than in the grid so the rule stays next to `LEGEND_ITEMS`,
 * which has to agree with it.
 */
export function dayMarkers(day: CalendarDayModel): string[] {
  const tones: string[] = [];
  if (day.attendance.absent > 0) tones.push("red");
  day.events.forEach((e) => {
    if (e.kind === "class" || e.kind === "working") return;
    if (!tones.includes(e.tone)) tones.push(e.tone);
  });
  if (tones.length === 0 && day.attendance.present > 0) tones.push("emerald");
  return tones.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * `YYYY-MM-DD` for a local date.
 *
 * The join key for everything: tasks, Moodle deadlines, OD records and the
 * `viewLink` history all have to line up on one string, and they all carry
 * different date formats natively.
 */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Parse a date from any of the sources.
 *
 * `new Date(str)` is what the rest of the app does with `viewLink.date` and
 * `ODhoursData[].date`, and diverging from that here would make this page
 * disagree with the attendance pages about which day a record belongs to. The
 * `YYYY-MM-DD` case is pinned to a local-midnight construction because a bare
 * `new Date("2026-08-12")` is parsed as UTC and lands on the 11th west of
 * Greenwich.
 */
export function parseDayDate(value: string | Date | undefined | null): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // `Aug 12, 2026` / `12 Aug 2026` — native parse, guarded.
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
}

export function isValidDay(d: Date): boolean {
  return !isNaN(d.getTime());
}

/** Whole days from today. Negative in the past. */
export function daysLeft(target: Date | string | null | undefined, from = new Date()): number | null {
  if (!target) return null;
  const d = target instanceof Date ? target : parseDayDate(target);
  if (!isValidDay(d)) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function relativeDayLabel(target: Date | string | null | undefined, from = new Date()): string {
  const d = target instanceof Date ? target : parseDayDate(target);
  if (!isValidDay(d)) return "";
  const delta = daysLeft(d, from);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

export function formatDayHeading(d: Date): string {
  if (!isValidDay(d)) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Month parsing
// ---------------------------------------------------------------------------

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const FULL_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export type ParsedMonth = { monthIndex: number; year: number };

/**
 * Pull `monthIndex` and `year` out of a calendar's `month` string.
 *
 * VTOP sends `"August 2026"`, sometimes with a trailing range. Falls back to
 * the calendar's own `year`, then to today, so a malformed month never
 * produces `NaN` indices that would poison the whole grid.
 */
export function parseCalendarMonth(cal: CalendarInput | any): ParsedMonth {
  const now = new Date();
  let year = NaN;
  let monthIndex = NaN;

  const raw = String(cal?.month ?? "").trim();
  const match = raw.match(/([a-zA-Z]+)\s*(\d{4})/);
  if (match) {
    monthIndex = MONTH_NAME_MAP[match[1].toLowerCase().slice(0, 3)] ?? NaN;
    year = Number(match[2]);
  }

  if (!Number.isFinite(monthIndex) && raw) {
    const byName = FULL_MONTHS.findIndex((m) => raw.toLowerCase().includes(m));
    if (byName !== -1) monthIndex = byName;
  }
  if (!Number.isFinite(monthIndex) && cal?.month != null) {
    const n = Number(cal.month);
    if (Number.isFinite(n)) monthIndex = n >= 1 && n <= 12 ? n - 1 : n;
  }
  if (!Number.isFinite(year)) {
    const n = Number(cal?.year);
    year = Number.isFinite(n) ? n : NaN;
  }

  return {
    monthIndex: Number.isFinite(monthIndex) ? monthIndex : now.getMonth(),
    year: Number.isFinite(year) ? year : now.getFullYear(),
  };
}

export function monthLabel(monthIndex: number, year: number, short = false): string {
  const d = new Date(year, monthIndex, 1);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: short ? "short" : "long", year: "numeric" });
}

/** Monday-first weekday header, matching both the grid and `slotMap`. */
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Number of Monday-first blanks before the 1st. */
export function leadingBlanks(year: number, monthIndex: number): number {
  const jsDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sun
  return (jsDay + 6) % 7;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

function emptyAttendance(): DayAttendance {
  return { held: 0, present: 0, absent: 0, onDuty: 0, courses: [] };
}

function statusBucket(status: string): keyof Omit<DayAttendance, "courses"> {
  const s = String(status || "").toLowerCase();
  if (s === "present") return "present";
  if (s === "absent") return "absent";
  if (s === "on duty" || s === "partial od") return "onDuty";
  return "present";
}

/** `attendance[].viewLink[]` collapsed to one record per calendar day. */
export function buildAttendanceByDate(attendance: any[] = []): Map<string, DayAttendance> {
  const byDate = new Map<string, DayAttendance>();

  attendance.forEach((course) => {
    if (!Array.isArray(course?.viewLink)) return;
    course.viewLink.forEach((entry: any) => {
      const d = parseDayDate(entry?.date);
      if (!isValidDay(d)) return;
      const key = dateKey(d);
      if (!byDate.has(key)) byDate.set(key, emptyAttendance());
      const bucket = byDate.get(key)!;
      const field = statusBucket(entry?.status);
      bucket[field] += 1;
      bucket.held += 1;
      bucket.courses.push({
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        status: String(entry?.status ?? ""),
        date: key,
        rawDate: String(entry?.date ?? ""),
      });
    });
  });

  return byDate;
}

/** Look up the recorded status of one course on one day. */
export function statusForClass(
  byDate: Map<string, DayAttendance>,
  dayKey: string,
  courseCode: string
): string | null {
  const record = byDate.get(dayKey)?.courses.find((c) => c.courseCode === courseCode);
  return record ? record.status : null;
}

// ---------------------------------------------------------------------------
// The day log
// ---------------------------------------------------------------------------

export type LogStatus =
  | "present"
  | "absent"
  | "morning half-day"
  | "evening half-day"
  | "partially absent"
  | "partial od";

export type AttendanceLogRow = {
  /** The raw `viewLink` date, kept so the notes tracker keeps matching. */
  date: string;
  dateObj: Date;
  dateKey: string;
  weekday: string;
  status: LogStatus;
  label: string;
  tone: string;
  attendance: DayAttendance;
  missedClasses: DayClassRecord[];
  isMissed: boolean;
  isFuture: boolean;
};

const LOG_STATUS_TONE: Record<LogStatus, string> = {
  present: "emerald",
  absent: "red",
  "morning half-day": "amber",
  "evening half-day": "amber",
  "partially absent": "red",
  "partial od": "amber",
};

const LOG_STATUS_LABEL: Record<LogStatus, string> = {
  present: "Full day",
  absent: "Absent",
  "morning half-day": "Morning half-day",
  "evening half-day": "Evening half-day",
  "partially absent": "Partially absent",
  "partial od": "Partial OD",
};

/**
 * One row per day with any recorded class, newest first.
 *
 * The morning/evening split is what makes the row worth reading: an absent 8am
 * lab and an absent 2pm theory are different problems, and "you missed a
 * class" is not actionable. Morning is anything starting before 1pm.
 *
 * Two different ideas of "missed" meet here and are deliberately kept apart:
 *
 *  - `missedClasses` / `isMissed` mean *you have no notes for this class*, so
 *    they include on-duty. That is the same set the theory and lab log pages
 *    offer "Get Notes" for, and it is what the log filter counts.
 *  - the day's *verdict* counts only absences. An on-duty is an approved
 *    absence, so treating it as a miss made an absent morning plus an on-duty
 *    evening render as a wholly absent day, and the morning/evening
 *    distinction — the entire point of the row — collapsed.
 */
export function buildAttendanceLog(
  byDate: Map<string, DayAttendance>,
  startMinutes: (courseCode: string) => number | null,
  now = new Date()
): AttendanceLogRow[] {
  const todayKey = dateKey(now);
  const isAbsent = (c: DayClassRecord) => c.status.toLowerCase() === "absent";
  const isOd = (c: DayClassRecord) => {
    const s = c.status.toLowerCase();
    return s === "on duty" || s === "partial od";
  };

  return Array.from(byDate.entries())
    .map(([key, attendance]) => {
      // key is `YYYY-MM-DD`; slice-to-number because the Date ctor has no
      // (string, string, string) overload.
      const dateObj = new Date(
        Number(key.slice(0, 4)),
        Number(key.slice(5, 7)) - 1,
        Number(key.slice(8, 10))
      );
      const weekday = WEEKDAY_SHORT[(dateObj.getDay() + 6) % 7];

      const needsNotes = attendance.courses.filter((c) => c.status.toLowerCase() !== "present");
      const morning = attendance.courses.filter(
        (c) => (startMinutes(c.courseCode) ?? 0) < 13 * 60
      );
      const evening = attendance.courses.filter(
        (c) => (startMinutes(c.courseCode) ?? 0) >= 13 * 60
      );

      const allMissed = (list: DayClassRecord[]) =>
        list.length > 0 && list.every(isAbsent);
      const noneMissed = (list: DayClassRecord[]) => !list.some(isAbsent);

      let status: LogStatus = "present";
      if (attendance.courses.some(isAbsent)) {
        const morningClear = allMissed(morning);
        const eveningClear = allMissed(evening);

        if (morningClear && eveningClear) status = "absent";
        else if (morningClear && noneMissed(evening)) status = "morning half-day";
        else if (eveningClear && noneMissed(morning)) status = "evening half-day";
        else status = attendance.courses.every((c) => isAbsent(c) || isOd(c))
          ? "partial od"
          : "partially absent";
      } else if (attendance.courses.some(isOd)) {
        status = "partial od";
      }

      return {
        date: attendance.courses[0]?.date ?? key,
        dateObj,
        dateKey: key,
        weekday,
        status,
        label: LOG_STATUS_LABEL[status],
        tone: LOG_STATUS_TONE[status],
        attendance,
        missedClasses: needsNotes,
        isMissed: needsNotes.length > 0,
        isFuture: key > todayKey,
      };
    })
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

export type LogFilter = "all" | "missed" | "present" | "upcoming";

export function filterLog(rows: AttendanceLogRow[], filter: LogFilter): AttendanceLogRow[] {
  switch (filter) {
    case "missed":
      return rows.filter((r) => r.isMissed);
    case "present":
      return rows.filter((r) => !r.isMissed);
    case "upcoming":
      return rows.filter((r) => r.isFuture);
    default:
      return rows;
  }
}

// ---------------------------------------------------------------------------
// OD summary
// ---------------------------------------------------------------------------

export type OdSummary = {
  totalHours: number;
  validHours: number;
  wastedHours: number;
  recoveredHours: number;
  wastedCount: number;
  recoveredCount: number;
};

/**
 * Match a day's OD records against what the user recorded about that day.
 *
 * `wastedODsTracker[date][courseCode] = { courseTitle, status }` is written by
 * hand, keyed by the course title as it was typed, while an OD record carries
 * the title as VTOP sent it. The two drift ("Design & Analysis" vs "Design and
 * Analysis"), so a containment match is the fallback.
 *
 * Containment alone is not enough, and the old code got this wrong. For an
 * embedded course "Biology" is a substring of "Biology Lab", so marking the
 * theory OD as wasted also marked the lab wasted and double-counted the hours.
 * So this is an assignment, not a lookup: each tracked entry claims at most
 * one record, each record is claimed at most once, and an exact title match
 * outranks a substring one. Returns one entry per record, `null` where the user
 * recorded nothing.
 */
function resolveTrackedOds(courses: any[], tracked: Record<string, any> | undefined): any[] {
  const assigned: any[] = new Array(courses.length).fill(null);
  if (!tracked) return assigned;

  Object.values(tracked).forEach((t: any) => {
    const known = String(t?.courseTitle ?? "").toLowerCase().trim();
    if (!known) return;

    let best = -1;
    let bestScore = 0;
    courses.forEach((c, i) => {
      if (assigned[i]) return;
      const title = String(c?.title ?? "").toLowerCase().trim();
      if (!title) return;
      const score = title === known ? 3 : title.includes(known) || known.includes(title) ? 1 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });

    if (best !== -1) assigned[best] = t;
  });

  return assigned;
}

/** A lab/ELA/PBL is worth two hours against the requirement. */
function odWeight(type: string): number {
  const t = String(type || "").toLowerCase();
  return t.includes("lab") || t.includes("ela") || t.includes("pbl") ? 2 : 1;
}

/**
 * OD hours split by what actually happened to them.
 *
 * A "valid" OD that was later marked Present was wasted; one that was later
 * marked Absent was recovered. The user tracks that transition by hand in
 * `wastedODsTracker`, so the tracker is the only place that knowledge exists.
 */
export function summariseOd(odData: any, tracker: Record<string, any> = {}): OdSummary {
  const empty: OdSummary = {
    totalHours: 0,
    validHours: 0,
    wastedHours: 0,
    recoveredHours: 0,
    wastedCount: 0,
    recoveredCount: 0,
  };
  if (!Array.isArray(odData) || odData.length === 0) return empty;

  const out = { ...empty };

  odData.forEach((dayOD) => {
    const tracked = tracker[dayOD.date] as Record<string, any> | undefined;
    const courses = Array.isArray(dayOD.courses) ? dayOD.courses : [];
    const matches = resolveTrackedOds(courses, tracked);

    courses.forEach((c: any, i: number) => {
      const hours = odWeight(c.type);
      const status = matches[i]?.status;

      if (status === "wasted") {
        out.wastedHours += hours;
        out.wastedCount += 1;
      } else if (status === "recovered") {
        out.recoveredHours += hours;
        out.recoveredCount += 1;
        out.validHours += hours;
      } else {
        out.validHours += hours;
      }
    });

    out.totalHours += Number(dayOD.total) || 0;
  });

  return out;
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

export type CalendarSources = {
  /** Optional: the page mounts before the calendar has been fetched. */
  calendars?: any;
  moodle?: any[];
  schedule?: any;
  attendance?: any[];
  od?: any;
  tasks?: Task[];
  /** `wastedODsTracker` from localStorage, for OD status inside the day. */
  odTracker?: Record<string, any>;
  /**
   * EventHub registrations, from `registeredEventsAtom`.
   *
   * The only source in here the user created rather than the college
   * publishing, which is why its events can carry `avatarUrl`: these are things
   * *you* signed up for, so your own picture is a fair marker for them.
   */
  registeredEvents?: EventHubRegistration[];
  /**
   * The user's profile photo, already gated by `shouldShowProfilePhoto`.
   *
   * Resolved by the caller and passed in rather than read here, so the privacy
   * decision stays in one place and this module never has to know the
   * setting exists.
   */
  profileImageUrl?: string;
};

function asCalendarArray(calendars: any): CalendarInput[] {
  if (!calendars) return [];
  if (Array.isArray(calendars)) return calendars;
  if (Array.isArray(calendars.calendars)) return calendars.calendars;
  return [calendars];
}

function isSameDay(a: Date, year: number, monthIndex: number, date: number): boolean {
  return a.getFullYear() === year && a.getMonth() === monthIndex && a.getDate() === date;
}

function moodleEventsFor(moodle: any[], year: number, monthIndex: number, date: number) {
  const out: CalendarDayEvent[] = [];
  moodle.forEach((m) => {
    if (m.done || !m.due) return;
    const due = parseDayDate(m.due);
    if (!isValidDay(due) || !isSameDay(due, year, monthIndex, date)) return;
    out.push(
      makeEvent({
        kind: "assignment",
        title: String(m.name ?? "").split("/").pop() || "Assignment",
        detail: due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        dueAt: due,
        url: m.url,
        hidden: m.hidden,
        raw: m,
      })
    );
  });
  return out;
}

/**
 * The exam papers on one date, with duplicate series merged.
 *
 * The schedule is keyed by series name, and those keys are not stable: the same
 * exam has been seen as both `"CAT II"` and `"CAT2"`. Iterating the object
 * would emit every paper of both series, so a day could show the same subject
 * twice. Keys are therefore grouped by their canonical name first, and a paper
 * is deduped on course + time + venue so a genuinely repeated entry still
 * collapses.
 */
function examEventsFor(schedule: any, year: number, monthIndex: number, date: number) {
  const out: CalendarDayEvent[] = [];
  const table = schedule?.Schedule ?? schedule;
  if (!table || typeof table !== "object") return out;

  // Scoped to the day, not to one key: "CAT II" and "CAT2" are two keys for one
  // exam, so a per-key set would emit every paper of both.
  const seen = new Set<string>();

  Object.entries(table).forEach(([examType, subjects]) => {
    if (!Array.isArray(subjects)) return;
    const series = canonicalSeriesName(examType);

    subjects.forEach((s: any) => {
      if (!s?.examDate) return;
      const d = parseDayDate(s.examDate);
      if (!isValidDay(d) || !isSameDay(d, year, monthIndex, date)) return;

      const time = s.examTime || "TBA";
      const venue = s.venue && s.venue !== "-" ? s.venue : "";
      const fingerprint = `${series}|${s.courseCode ?? s.courseTitle}|${time}|${venue}`;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);

      out.push(
        makeEvent({
          kind: "exam",
          title: s.courseTitle || s.courseCode,
          detail: [prettySeriesName(examType), time, venue].filter(Boolean).join(" · "),
          series: examType,
          courseCode: s.courseCode,
          courseTitle: s.courseTitle,
          raw: s,
        })
      );
    });
  });

  return out;
}

function odEventsFor(
  od: any,
  odTracker: Record<string, any>,
  year: number,
  monthIndex: number,
  date: number
) {
  const out: CalendarDayEvent[] = [];
  if (!Array.isArray(od)) return out;

  od.forEach((dayOD) => {
    const d = parseDayDate(dayOD.date);
    if (!isValidDay(d) || !isSameDay(d, year, monthIndex, date)) return;
    const tracked = odTracker[dayOD.date] as Record<string, any> | undefined;
    const courses = Array.isArray(dayOD.courses) ? dayOD.courses : [];
    const matches = resolveTrackedOds(courses, tracked);

    if (courses.length === 0) {
      out.push(makeEvent({ kind: "od", title: `On-Duty · ${dayOD.total} hrs`, hours: dayOD.total, raw: dayOD }));
      return;
    }

    courses.forEach((c: any, i: number) => {
      const status = matches[i]?.status;
      out.push(
        makeEvent({
          kind: "od",
          title: c.title ?? "On-Duty",
          detail:
            status === "wasted"
              ? "OD · wasted"
              : status === "recovered"
                ? "OD · recovered"
                : "On-Duty",
          hours: odWeight(c.type),
          raw: { day: dayOD, course: c, status },
        })
      );
    });
  });

  return out;
}

function classEventsFor(record: DayAttendance | undefined) {
  if (!record) return [];
  return record.courses.map((c) =>
    makeEvent({
      kind: "class",
      title: c.courseTitle || c.courseCode,
      detail: c.status,
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      absent: c.status.toLowerCase() === "absent",
      raw: c,
    })
  );
}

function taskEventsFor(tasks: Task[], fullDate: Date) {
  return tasks
    .filter((t) => t.status !== "done" && isDueOnDay(t.dueDate, fullDate))
    .map((t) =>
      makeEvent({
        kind: "assignment",
        title: t.title,
        detail: t.courseCode || t.courseTitleSnapshot,
        dueAt: t.dueDate ? new Date(t.dueDate) : undefined,
        taskId: t.id,
        raw: t,
      })
    );
}

/**
 * Whether a registration is one the user is actually going to.
 *
 * EventHub records a registration when the form is submitted, and for a paid
 * event that is *before* the money moves. Listing a pending payment in a section
 * called "Upcoming" would tell the user to turn up to something they have not
 * bought, and the "pay now" button they need is on the EventHub page, not here.
 *
 * A free event has no `paymentStatus` at all, so absent means "nothing to pay"
 * and is treated as confirmed. Dropping those would silently lose every club
 * signup on the list, which is the bulk of what the user registered for.
 */
function isRegistrationConfirmed(r: EventHubRegistration): boolean {
  const status = String(r.paymentStatus ?? "").toLowerCase();
  if (!status) return true;
  return ["paid", "free", "success", "confirmed"].some((word) => status.includes(word));
}

/**
 * EventHub registrations on one date, as calendar events.
 *
 * The last source in, and the only one the user authored: a club workshop they
 * signed up for is a real commitment on a real date, and it belongs on the same
 * calendar as the exam that is the reason they cannot attend it. It is `kind:
 * "event"`, which already had a tone, a label and a low priority, so it never
 * outranks a holiday or a CAT on the same day — it rides underneath them.
 */
function eventhubEventsFor(
  registrations: EventHubRegistration[] | undefined,
  profileImageUrl: string | undefined,
  year: number,
  monthIndex: number,
  date: number
) {
  const out: CalendarDayEvent[] = [];
  (registrations ?? []).forEach((r) => {
    const d = parseDayDate(r.date);
    if (!isValidDay(d) || !isSameDay(d, year, monthIndex, date)) return;
    if (!isRegistrationConfirmed(r)) return;

    out.push(
      makeEvent({
        kind: "event",
        title: (r.name || "").trim() || KIND_LABEL.event,
        detail: [r.time, r.venue].filter(Boolean).join(" · ") || undefined,
        avatarUrl: profileImageUrl,
        eventhubId: r.eid,
        raw: r,
      })
    );
  });
  return out;
}

/**
 * Classify a day.
 *
 * `published` is the important input: a date the calendar lists with no events
 * is a *non-instructional day* (the college is open, there is no teaching),
 * whereas a date the calendar never mentions at all is simply outside the
 * published range. Without that distinction every gap in the data reads as a
 * day off, which is the failure mode this whole taxonomy exists to prevent.
 *
 * Order is load-bearing throughout. Non-instructional is tested before
 * instructional because VTOP's "Non Instructional Day" carries a category of
 * "Working day", so the instructional test would otherwise match it too.
 */
function decideDayType(
  vtop: RawCalendarEvent[],
  events: CalendarDayEvent[],
  attendance: DayAttendance,
  published: boolean
): DayType {
  if (vtop.some(isHolidayEvent)) return "holiday";
  if (vtop.some(isNonInstructionalEvent)) return "nonInstructional";
  if (vtop.some(isSemiHolidayEvent)) return "semiholiday";

  const hasAssessment = events.some((e) => e.kind === "exam" || e.kind === "assignment");
  if (vtop.some(isInstructionalEvent)) return hasAssessment ? "semiholiday" : "instructional";

  // Published with nothing on it: a day the college lists but does not teach.
  if (published) return "nonInstructional";

  // Not published, but classes were actually held on it — the record is
  // stronger evidence than the absence of a calendar entry.
  if (attendance.held > 0) return "instructional";

  return "other";
}

/**
 * The whole calendar, classified once.
 *
 * Every source that can put something on a day is folded in here — the VTOP
 * academic calendar, the exam schedule, Moodle deadlines, recorded attendance,
 * OD records, the task store and the user's own EventHub registrations — so the
 * grid, the log, the day sheet and the `.ics` export all read the same objects
 * instead of each re-deriving events from raw payloads. That is the whole reason
 * the old page's day panel and its grid could disagree about what a day
 * contained.
 */
export function buildEnrichedCalendars(sources: CalendarSources): CalendarMonthModel[] {
  const {
    moodle = [],
    schedule,
    attendance = [],
    od,
    tasks = [],
    odTracker = {},
    registeredEvents = [],
    profileImageUrl,
  } = sources;
  const attendanceByDate = buildAttendanceByDate(attendance);

  return asCalendarArray(sources.calendars)
    .map((cal, index) => {
      const { monthIndex, year } = parseCalendarMonth(cal);
      const rawDays: any[] = Array.isArray(cal?.days) ? cal.days : [];

      // Trust the calendar's own day count only when it is *longer* than a real
      // month, and trust a short `days` array only when it is clearly a full
      // month. The old page used `rawDays.length` unconditionally, so a payload
      // that listed three days rendered a three-day month and every later date
      // in the semester silently vanished from the grid.
      const realLength = new Date(year, monthIndex + 1, 0).getDate();
      const declared = Number(cal?.totalDays);
      const totalDays = Math.max(
        realLength,
        Number.isFinite(declared) && declared > realLength ? declared : 0,
        rawDays.length >= 28 ? rawDays.length : 0
      );

      const days: CalendarDayModel[] = [];

      for (let date = 1; date <= totalDays; date += 1) {
        const fullDate = new Date(year, monthIndex, date);
        const key = dateKey(fullDate);
        const dayRecord = attendanceByDate.get(key);

        const rawDay = rawDays.find((d) => Number(d?.date) === date);
        const vtop: RawCalendarEvent[] = Array.isArray(rawDay?.events) ? rawDay.events : [];
        // De-duplicate by kind + title: VTOP repeats a course across the theory
        // and lab halves of an embedded course, and the same holiday shows up
        // under both `text` and `category` on some months.
        const calendarEvents = Array.from(
          new Map(
            vtop
              .filter(Boolean)
              .map((e) => {
                const ev = classify(e);
                return [`${ev.kind}|${ev.title}`, ev];
              })
          ).values()
        );

        const events = [
          ...examEventsFor(schedule, year, monthIndex, date),
          ...moodleEventsFor(moodle, year, monthIndex, date),
          ...taskEventsFor(tasks, fullDate),
          ...odEventsFor(od, odTracker, year, monthIndex, date),
          ...eventhubEventsFor(registeredEvents, profileImageUrl, year, monthIndex, date),
          ...classEventsFor(dayRecord),
          ...calendarEvents,
        ].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

        const attendanceForDay = dayRecord ?? emptyAttendance();
        const dueTasks = tasks.filter((t) => t.status !== "done" && isDueOnDay(t.dueDate, fullDate));

        days.push({
          date,
          fullDate,
          dateKey: key,
          weekday: WEEKDAY_SHORT[(fullDate.getDay() + 6) % 7],
          // A reschedule, when the college published one for this date. Read
          // from the *raw* VTOP entries rather than the classified events: the
          // classifier deliberately drops the "Instructional Day Order" prefix to
          // make a readable title, and the day it names is exactly the part that
          // got dropped.
          dayOrder: parseDayOrder(vtop),
          // Decided before the fold: a day carrying a paper is a shortened list
          // either way, and whether that paper is nested under a milestone does
          // not change what kind of day it is.
          dayType: decideDayType(vtop, events, attendanceForDay, rawDay !== undefined),
          events: foldPapersIntoMilestones(events),
          attendance: attendanceForDay,
          taskCount: dueTasks.length,
        });
      }

  // `working` is "has classes" — instructional plus shortened, exam days
  // excluded. `holiday` counts days the college is shut, so a non-instructional
  // working day lands in `other`: it is neither of those two things.
  const summary = { total: days.length, working: 0, holiday: 0, other: 0 };
  days.forEach((d) => {
    if (hasClasses(d)) summary.working += 1;
    else if (d.dayType === "holiday") summary.holiday += 1;
    else summary.other += 1;
  });

      return {
        id: `${year}-${monthIndex}-${index}`,
        label: monthLabel(monthIndex, year),
        shortLabel: monthLabel(monthIndex, year, true),
        monthIndex,
        year,
        days,
        summary,
      };
    })
    .sort((a, b) => a.monthIndex - b.monthIndex || a.year - b.year);
}

/**
 * Which month the page should open on.
 *
 * Today if today is inside the published calendar, otherwise the first month
 * that has not ended yet — a user checking the calendar in the last week of
 * July for an August–November semester wants August, not a January that has
 * already been and gone. Falls back to the last month when the whole calendar
 * is in the past, because that is the one they actually want to read.
 *
 * Deliberately not persisted: "which month am I looking at" is a cursor, and
 * the old page stored it in `calendar-active-index` so reopening the tab months
 * later dropped you in a month with nothing in it.
 */
export function activeMonthIndex(months: CalendarMonthModel[]): number {
  const now = new Date();
  const current = months.findIndex(
    (m) => m.monthIndex === now.getMonth() && m.year === now.getFullYear()
  );
  if (current !== -1) return current;

  const next = months.findIndex(
    (m) => m.year > now.getFullYear() ||
      (m.year === now.getFullYear() && m.monthIndex >= now.getMonth())
  );
  return next === -1 ? Math.max(0, months.length - 1) : next;
}

export function findDay(
  months: CalendarMonthModel[],
  dayKeyValue: string
): { month: CalendarMonthModel; day: CalendarDayModel } | null {
  for (const month of months) {
    const day = month.days.find((d) => d.dateKey === dayKeyValue);
    if (day) return { month, day };
  }
  return null;
}

export function todayKey(now = new Date()): string {
  return dateKey(now);
}

/**
 * A day model for a date the published calendar does not cover.
 *
 * Attendance is recorded against a whole semester and the academic calendar is
 * a published, sometimes-truncated document, so `viewLink` legitimately holds
 * dates with no matching month — a class held in the week before the calendar
 * starts, or after it ends. Those rows still have to open: a log full of dead
 * rows is worse than a slightly emptier one, because the user cannot tell the
 * difference between "no data" and "broken".
 */
export function synthesiseDay(attendance: DayAttendance): CalendarDayModel {
  const d = attendance.courses[0]?.date;
  const fullDate = d ? parseDayDate(d) : new Date(NaN);
  const safeDate = isValidDay(fullDate) ? fullDate : new Date();
  const key = dateKey(safeDate);

  return {
    date: safeDate.getDate(),
    fullDate: safeDate,
    dateKey: key,
    weekday: WEEKDAY_SHORT[(safeDate.getDay() + 6) % 7],
    // Attendance was recorded for this date, so it taught something even
    // though the published calendar never covered it.
    dayType: attendance.held > 0 ? "instructional" : "other",
    events: classEventsFor(attendance),
    attendance,
    taskCount: 0,
  };
}
