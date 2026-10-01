/**
 * Attendance projection, as numbers.
 *
 * This is the arithmetic behind the "Attendance Predictor & Simulator" screen.
 * It was all inline in a 1082-line component, which is the only reason the lock
 * dates went wrong and stayed wrong: the rule that decides the last day a class
 * can still count was three lines of `setDate(getDate() - 2)` buried between a
 * `useMemo` and a month grid.
 *
 * Pure and React-free, same rule as `gradeHistory.ts` and `calendarDay.ts`. The
 * screen decides which milestone is selected; this module decides what that
 * means.
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Midnight local, so a `Date` and its timestamp compare against a grid cell. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Stable join key. Not zero-padded, but only ever compared against itself. */
export function dayKey(d: Date): string {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
}

/**
 * The day a milestone's attendance stops counting.
 *
 * `offsetDays` is subtracted from the milestone's own date. CAT I and CAT II
 * use 3: the exam is the last thing that can be sat, so three days before it is
 * the last day the record can still move.
 *
 * CAT dates are 3 calendar days back, not three working days. The rule as the
 * college states it is a plain "three days before", and inventing a
 * working-day count would silently disagree with the notice on the board.
 */
export function lockDateFor(milestone: Date | null | undefined, offsetDays = 0): Date | null {
  if (!milestone) return null;
  const d = new Date(startOfDay(milestone));
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() - offsetDays);
  return d;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export type MilestoneKey = "cat1" | "cat2" | "lidLab" | "lidTheory";

export type MilestoneDates = {
  cat1Date?: Date | null;
  cat2Date?: Date | null;
  lidLabDate?: Date | null;
  lidTheoryDate?: Date | null;
};

/** Calendar days before a CAT at which attendance freezes. */
export const CAT_LOCK_OFFSET_DAYS = 3;

/**
 * How long before each CAT attendance locks.
 *
 * The predictor used to lock the Thursday and Friday two and one days before the
 * exam, and only if those days happened to be a Thursday or Friday - so for a
 * CAT starting on a Saturday the set came back empty and nothing was locked at
 * all. Three days before, unconditionally.
 */
export const CAT_LOCK_DATES: readonly { key: MilestoneKey; offset: number }[] = [
  { key: "cat1", offset: CAT_LOCK_OFFSET_DAYS },
  { key: "cat2", offset: CAT_LOCK_OFFSET_DAYS },
];

export function milestoneDate(dates: MilestoneDates, key: MilestoneKey): Date | null {
  const raw =
    key === "cat1"
      ? dates.cat1Date
      : key === "cat2"
        ? dates.cat2Date
        : key === "lidLab"
          ? dates.lidLabDate
          : dates.lidTheoryDate;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

// ---------------------------------------------------------------------------
// Effective weekday, including published day orders
// ---------------------------------------------------------------------------

const DAY_ORDER_MAP: Record<string, string> = {
  monday: "MON",
  tuesday: "TUE",
  wednesday: "WED",
  thursday: "THU",
  friday: "FRI",
};

/** `"Thursday"` -> `"THU"`. Anything already three letters is upper-cased. */
export function normalizeDay(raw: string | undefined | null): string {
  return String(raw ?? "").slice(0, 3).toUpperCase();
}

/**
 * One event on a calendar day.
 *
 * Both shapes the app has for these are accepted. The predictor's own calendar
 * day carries VTOP's `text` and `category`; `calendarDay`'s enriched model
 * carries a rewritten `title` and `detail`. A day order can live in either, and
 * the whole point of reading it is that one of them is always populated.
 */
export type PredictorDayEvent = {
  text?: string;
  category?: string;
  title?: string;
  detail?: string;
};

/** A calendar day, in whichever of the two shapes the caller already has. */
export type DayLike = {
  date?: Date;
  fullDate?: Date;
  weekday?: string;
  events?: ReadonlyArray<PredictorDayEvent> | null;
};

/** `fullDate` on the enriched model, `date` on the raw one. */
export function dayDate(d: DayLike | null | undefined): Date | null {
  if (!d) return null;
  const date = d.fullDate ?? d.date;
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

/**
 * The weekday a calendar date actually follows.
 *
 * Normally the date's own weekday, except on a Saturday that VTOP has published
 * a day order for: `"Instructional Day - Thursday Day Order"` means students
 * attend Thursday classes that Saturday. Without this the projector counts a
 * Thursday course on the rescheduled Saturday *and* on the real Thursday.
 */
export function effectiveWeekday(
  weekday: string | undefined,
  events: ReadonlyArray<PredictorDayEvent> | null | undefined
): string {
  const own = normalizeDay(weekday);
  if (own !== "SAT" || !Array.isArray(events) || events.length === 0) return own;

  for (const ev of events) {
    const haystack = `${ev?.text ?? ""} ${ev?.category ?? ""} ${ev?.title ?? ""} ${ev?.detail ?? ""}`;
    const m = haystack.match(/\b(monday|tuesday|wednesday|thursday|friday)\b/i);
    if (!m?.[1]) continue;
    const mapped = DAY_ORDER_MAP[m[1].toLowerCase()];
    if (mapped) return mapped;
  }
  return own;
}

/**
 * `dayKey -> effective weekday` for every day passed in.
 *
 * Built once and shared by every course, because it depends only on the calendar
 * and not on which course is being counted. The screen used to rebuild this same
 * map inside both of its counting helpers.
 */
export function buildEffectiveDayMap(
  days: ReadonlyArray<DayLike> | null | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of days ?? []) {
    const date = dayDate(d);
    if (!date) continue;
    map.set(dayKey(date), effectiveWeekday(d?.weekday, d?.events));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export type PredictorCourse = {
  courseCode: string;
  courseTitle?: string;
  courseType?: string;
  slotName?: string;
  faculty?: string;
  attendedClasses?: number | string;
  totalClasses?: number | string;
};

function toInt(v: unknown): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A lab session is two continuous hours, so one absence costs two classes.
 *
 * The predictor has always applied this to the future and missed counts; it is
 * kept here so the weighting lives beside the arithmetic that depends on it.
 */
export function isLabCourse(c: Pick<PredictorCourse, "courseCode" | "courseType">): boolean {
  if (/\blab\b/i.test(String(c?.courseType ?? ""))) return true;
  return String(c?.courseCode ?? "").endsWith("(L)");
}

/** Whether the course is worth projecting at all. */
export function isProjectableCourse(c: PredictorCourse): boolean {
  return Boolean(c?.courseCode) && c.slotName !== "NILL" && toInt(c.totalClasses) >= 0;
}

// ---------------------------------------------------------------------------
// Simulation inputs
// ---------------------------------------------------------------------------

export type SimulationMode = "CAT1" | "CAT2" | "LID" | "ALL";

/**
 * Per-course day states.
 *
 * `0` attending, `1` absent, `2` off/excluded. A key that is absent means the
 * reader has not touched that day, which is not the same as attending: a locked
 * day is also "absent from the map" and must still resolve to `2`.
 */
export type DayStates = Record<number, number>;

/**
 * Dates skipped for one subject.
 *
 * Keyed `courseCode -> timestamp -> true`. A skipped date is an absence for
 * that subject only: the class is still scheduled, so it stays in the
 * denominator and goes in the numerator's place. It does not touch the global
 * day state, which is what makes "I am going to a placement interview on the
 * 14th and I will miss Data Structures but attend everything else" expressible.
 */
export type CourseDateSkips = Record<string, Record<number, true>>;

export const GLOBAL_SKIP = "__all__";

export function skipSetFor(
  skips: CourseDateSkips | null | undefined,
  courseCode: string
): Set<number> {
  const raw = skips?.[courseCode];
  const out = new Set<number>();
  if (!raw) return out;
  for (const key of Object.keys(raw)) {
    const n = Number(key);
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/** Toggle one date for one subject. Returns a new object; never mutates. */
export function toggleCourseSkip(
  skips: CourseDateSkips,
  courseCode: string,
  timestamp: number
): CourseDateSkips {
  const forCourse = { ...(skips[courseCode] ?? {}) };
  if (forCourse[timestamp]) delete forCourse[timestamp];
  else forCourse[timestamp] = true;
  return { ...skips, [courseCode]: forCourse };
}

/** How many dates are skipped for one subject. */
export function skipCountFor(skips: CourseDateSkips | null | undefined, courseCode: string): number {
  return Object.keys(skips?.[courseCode] ?? {}).length;
}

// ---------------------------------------------------------------------------
// Cutoffs and locks
// ---------------------------------------------------------------------------

/**
 * The last date the projection runs to, per course type.
 *
 * A lock is a suffix: once attendance is frozen everything after it is frozen
 * too, so the mode has to choose *which* milestone's lock applies rather than
 * applying all of them at once. CAT I's lock is 5 August; applying it in "All
 * Days" alongside CAT II's and the two LIDs would leave nothing after the 5th to
 * simulate.
 *
 * `CAT1`/`CAT2` therefore project to three days before that exam for every
 * course. `LID` splits by course type, because lab instruction ends on 23
 * October and theory on 3 November and using the later of the two let lab
 * classes keep counting for a month after lab had stopped. `ALL` has no exam
 * ceiling but is still bounded by the two LIDs - after the last instructional
 * day there is genuinely nothing left to attend.
 */
export function courseCeiling(
  mode: SimulationMode,
  isLab: boolean,
  dates: MilestoneDates
): Date | null {
  if (mode === "CAT1") return lockDateFor(milestoneDate(dates, "cat1"), CAT_LOCK_OFFSET_DAYS);
  if (mode === "CAT2") return lockDateFor(milestoneDate(dates, "cat2"), CAT_LOCK_OFFSET_DAYS);
  if (mode === "LID") return milestoneDate(dates, isLab ? "lidLab" : "lidTheory");
  // ALL: bounded by the last instructional day for this course type.
  return milestoneDate(dates, isLab ? "lidLab" : "lidTheory");
}

/**
 * The single simulated ceiling for the shared calendar grid.
 *
 * The grid shows one window, so it takes the latest ceiling any course has. A
 * per-course ceiling still applies inside each course's own arithmetic; this
 * only decides how far the month switcher may page.
 */
export function gridCeiling(mode: SimulationMode, dates: MilestoneDates): Date | null {
  if (mode === "CAT1") return lockDateFor(milestoneDate(dates, "cat1"), CAT_LOCK_OFFSET_DAYS);
  if (mode === "CAT2") return lockDateFor(milestoneDate(dates, "cat2"), CAT_LOCK_OFFSET_DAYS);
  if (mode === "LID" || mode === "ALL") {
    const lab = milestoneDate(dates, "lidLab")?.getTime() ?? 0;
    const theory = milestoneDate(dates, "lidTheory")?.getTime() ?? 0;
    const max = Math.max(lab, theory);
    return max > 0 ? new Date(max) : null;
  }
  return null;
}

/**
 * The day on which this course's attendance freezes.
 *
 * The chosen milestone's own lock: three days before a CAT, or the LID itself.
 * Returned as a single date rather than a set because it always resolves to one
 * day - the screen used to build a `Set` of Thursday-and-Friday candidates and
 * frequently produce an empty one.
 */
export function courseLockDate(
  mode: SimulationMode,
  isLab: boolean,
  dates: MilestoneDates
): Date | null {
  return courseCeiling(mode, isLab, dates);
}

// ---------------------------------------------------------------------------
// Per-course projection
// ---------------------------------------------------------------------------

export type ScheduleInput = {
  /** The course. */
  course: PredictorCourse;
  /** Weekday-keyed timetable template, `MON`..`SUN`. */
  dayCardsMap: Record<string, any[]> | null | undefined;
  /** Future working days from the calendar. */
  workingDays: ReadonlyArray<DayLike>;
  /** `dayKey -> effective weekday`. */
  effectiveMap: ReadonlyMap<string, string>;
  dateStates: DayStates | null | undefined;
  /** Dates skipped for *this* subject. */
  skips: ReadonlySet<number>;
  ceiling: Date | null;
  lockDate: Date | null;
  threshold: number;
};

export type ScheduleResult = {
  /** Days ahead on which this course still meets. */
  futureDays: number;
  /** Days missed by simulation: global "Absent" days plus this course's skips. */
  missedDays: number;
  /** Three-letter weekdays the course meets on. */
  meetingDays: string[];
  attended: number;
  total: number;
  currentPct: number;
  predictedAttended: number;
  predictedTotal: number;
  predictedPct: number;
  deltaPct: number;
  safeBunks: number;
  classesNeeded: number;
  isLab: boolean;
  skippedCount: number;
};

/** The weekdays a course is timetabled on. */
export function courseMeetingDays(
  courseCode: string,
  dayCardsMap: Record<string, any[]> | null | undefined
): string[] {
  if (!courseCode || !dayCardsMap) return [];
  return Object.keys(dayCardsMap)
    .filter((day) => (dayCardsMap[day] ?? []).some((c) => c?.courseCode === courseCode))
    .map((day) => normalizeDay(day));
}

/** Whether this date is a day the course meets, honouring day orders. */
export function courseMeetsOn(
  date: Date,
  courseCode: string,
  dayCardsMap: Record<string, any[]> | null | undefined,
  effectiveMap: ReadonlyMap<string, string>
): boolean {
  const meeting = courseMeetingDays(courseCode, dayCardsMap);
  if (meeting.length === 0) return false;
  const eff = effectiveMap.get(dayKey(date));
  if (!eff) return false;
  return meeting.includes(eff);
}

/**
 * The specific dates a course still has to attend, oldest first.
 *
 * What the per-subject skipper lists. Distinct from `projectCourse`, which only
 * returns counts: this returns the dates themselves so a screen can offer them
 * one by one. The lock is applied here too, so the list cannot offer a date on
 * which attendance has already frozen - a skipper offering to skip a locked
 * class is worse than one that omits it.
 */
export function courseMeetingDates(
  courseCode: string,
  dayCardsMap: Record<string, any[]> | null | undefined,
  workingDays: ReadonlyArray<DayLike> | null | undefined,
  effectiveMap: ReadonlyMap<string, string>,
  ceiling: Date | null = null,
  lockDate: Date | null = null
): Date[] {
  const meeting = courseMeetingDays(courseCode, dayCardsMap);
  if (meeting.length === 0) return [];

  const lockTime = lockDate ? startOfDay(lockDate).getTime() : null;
  const ceilingTime = ceiling ? startOfDay(ceiling).getTime() : null;

  const out: Date[] = [];
  for (const day of workingDays ?? []) {
    const date = dayDate(day);
    if (!date) continue;
    const time = startOfDay(date).getTime();
    if (ceilingTime != null && time > ceilingTime) continue;
    if (lockTime != null && time >= lockTime) continue;
    const eff = effectiveMap.get(dayKey(date));
    if (!eff || !meeting.includes(eff)) continue;
    out.push(date);
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

/**
 * The whole projection for one course.
 *
 * A date counts against the course when it is a meeting day, on or before the
 * ceiling, and either the reader marked the whole day absent or skipped this
 * subject specifically. A locked day resolves to state `2` and is dropped from
 * both sides of the fraction, which is what "attendance is frozen" means for a
 * number that is a ratio.
 */
export function projectCourse(input: ScheduleInput): ScheduleResult {
  const {
    course,
    dayCardsMap,
    workingDays,
    effectiveMap,
    dateStates,
    skips,
    ceiling,
    lockDate,
    threshold,
  } = input;

  const attended = toInt(course.attendedClasses);
  const total = toInt(course.totalClasses);
  const isLab = isLabCourse(course);
  const meetingDays = courseMeetingDays(course.courseCode, dayCardsMap);
  const currentPct = total > 0 ? (attended / total) * 100 : 0;

  const base = {
    attended,
    total,
    currentPct,
    meetingDays,
    isLab,
    skippedCount: skips?.size ?? 0,
  };

  if (meetingDays.length === 0) {
    return {
      ...base,
      futureDays: 0,
      missedDays: 0,
      predictedAttended: attended,
      predictedTotal: total,
      predictedPct: currentPct,
      deltaPct: 0,
      safeBunks: 0,
      classesNeeded: 0,
    };
  }

  const lockTime = lockDate ? startOfDay(lockDate).getTime() : null;
  const ceilingTime = ceiling ? startOfDay(ceiling).getTime() : null;

  const withinWindow = (d: Date): boolean => {
    const t = startOfDay(d).getTime();
    if (ceilingTime != null && t > ceilingTime) return false;
    if (lockTime != null && t >= lockTime) return false;
    return true;
  };

  let futureDays = 0;
  let missedDays = 0;

  for (const day of workingDays ?? []) {
    const date = dayDate(day);
    if (!date) continue;
    if (!withinWindow(date)) continue;
    const eff = effectiveMap.get(dayKey(date));
    if (!eff || !meetingDays.includes(eff)) continue;

    const time = startOfDay(date).getTime();
    futureDays++;

    // A skipped date is an absence for this subject and nothing else.
    if (skips?.has(time)) {
      missedDays++;
      continue;
    }

    const state = dateStates?.[time];
    if (state === 1) missedDays++;
  }

  // A lab session is two hours, so scale both sides.
  const weight = isLab ? 2 : 1;
  const futureClasses = futureDays * weight;
  const missedClasses = Math.min(missedDays * weight, futureClasses);

  const predictedAttended = attended + (futureClasses - missedClasses);
  const predictedTotal = total + futureClasses;
  const predictedPct = predictedTotal > 0 ? (predictedAttended / predictedTotal) * 100 : 0;

  const ratio = threshold / 100;
  let safeBunks = 0;
  let classesNeeded = 0;
  if (ratio > 0 && ratio < 1) {
    if (predictedPct >= threshold) {
      const raw = Math.floor((predictedAttended - ratio * predictedTotal) / ratio);
      safeBunks = Math.max(0, isLab ? Math.floor(raw / weight) : raw);
    } else {
      const raw = Math.ceil((ratio * predictedTotal - predictedAttended) / (1 - ratio));
      classesNeeded = Math.max(0, isLab ? Math.ceil(raw / weight) : raw);
    }
  }

  return {
    ...base,
    futureDays,
    missedDays,
    predictedAttended,
    predictedTotal,
    predictedPct,
    deltaPct: predictedPct - currentPct,
    safeBunks,
    classesNeeded,
  };
}

// ---------------------------------------------------------------------------
// Overall
// ---------------------------------------------------------------------------

export type OverallSummary = {
  currentPct: number;
  predictedPct: number;
  delta: number;
  safeCount: number;
  atRiskCount: number;
  totalCourses: number;
  totalSafeBunks: number;
  /** Meeting days still ahead across every course, before lab weighting. */
  remainingDays: number;
};

export function summarise(
  courses: readonly ScheduleResult[],
  threshold: number
): OverallSummary {
  let attended = 0;
  let total = 0;
  let predictedAttended = 0;
  let predictedTotal = 0;
  let safeCount = 0;
  let totalSafeBunks = 0;
  let maxCeilingDays = 0;

  for (const c of courses) {
    attended += c.attended;
    total += c.total;
    predictedAttended += c.predictedAttended;
    predictedTotal += c.predictedTotal;
    if (c.predictedPct >= threshold) {
      safeCount++;
      totalSafeBunks += c.safeBunks;
    }
    maxCeilingDays = Math.max(maxCeilingDays, c.futureDays);
  }

  const currentPct = total > 0 ? (attended / total) * 100 : 0;
  const predictedPct = predictedTotal > 0 ? (predictedAttended / predictedTotal) * 100 : 0;

  return {
    currentPct,
    predictedPct,
    delta: predictedPct - currentPct,
    safeCount,
    atRiskCount: courses.length - safeCount,
    totalCourses: courses.length,
    totalSafeBunks,
    remainingDays: maxCeilingDays,
  };
}

/** Two decimal places, or one when the app-wide setting says so. */
export function formatPct(value: number, decimals = true): string {
  return decimals ? value.toFixed(2) : value.toFixed(1);
}