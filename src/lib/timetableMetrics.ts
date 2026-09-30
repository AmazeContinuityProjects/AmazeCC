/**
 * What a timetable occupies, and how good it is.
 *
 * ## Why this module exists
 *
 * "Which periods does this timetable fill, and which half-days are therefore
 * free" was written out four times. Two were live and byte-for-byte identical;
 * two were dead and had both rotted. One of the dead ones kept a private day
 * list of `{ id: "monday" }` while the campus schema keys its days `"mon"`, so
 * every lookup missed, no period was ever occupied, and the whole metrics block
 * returned a constant — a perfect ten half-days and a long weekend, whatever the
 * timetable held.
 *
 * None of that reached a user, because the dead copies were only reachable from a
 * worker that nothing invoked. It is still the reason this exists: a copy that is
 * never executed does not stay correct by accident, it stays correct until
 * somebody runs it.
 *
 * ## Units
 *
 * **`gaps` and `gapsPerDay` are minutes.** The same field name once meant minutes
 * in one copy and hours in another, and the compactness sort read whichever it
 * was handed. Minutes is the unit the raw arithmetic produces and the unit a
 * person can check: two one-hour classes back to back with a fifteen minute
 * changeover leave 15. `formatHours` is the only place minutes become hours, and
 * it is called from the three places that print a number with an `h` on it.
 *
 * ## The day walk
 *
 * `dayOccupancy` is the only place that walks a day. `freeHalfDays` is five lines
 * on top of it, and `timetableMetrics` is the gap and dash derivation on top of
 * that. Everything that used to contain a copy of the walk now calls one of these.
 *
 * The theory and lab lists are read as **index-aligned pairs** — the i-th theory
 * period of the day with the i-th lab period of the day. Both campus schemas are
 * written that way, and it is the reason a cell can hold a theory booking in its
 * top half and a lab booking in its bottom half at the same wall-clock time.
 */

import {
  DAYS_OF_WEEK,
  MORNING_BEFORE_MIN,
  expandSlotSpellings,
  hasSlot,
  timeToMinutes,
  type CampusSchema,
  type DayId,
  type SchemaPeriod,
} from "./slots";

/**
 * The only fields of a course this module reads.
 *
 * Structural on purpose, so the app's `AddedCourse` satisfies it without this
 * module importing a type from a component tree. Same reasoning as
 * `FreeRoomCourse` in `freeClassrooms.ts`.
 */
export interface MetricCourse {
  slots: readonly string[];
  code?: string;
  title?: string;
  faculty?: string;
  venue?: string;
  type?: string;
}

/** One class on one day, as the gap and dash passes need it. */
export interface OccupiedClass {
  startMin: number;
  endMin: number;
  /** The schema's own clock strings, for the detail panels. */
  start: string;
  end: string;
  code: string;
  title: string;
  venue: string;
}

export interface DayOccupancy {
  /** Occupied classes, sorted by start time. */
  classes: OccupiedClass[];
  morningOccupied: boolean;
  eveningOccupied: boolean;
}

const nonLunch = (periods: SchemaPeriod[] | undefined): SchemaPeriod[] =>
  (periods ?? []).filter((p) => !p?.lunch);

/**
 * True for an embedded course, which may carry a combined room string.
 *
 * An embedded booking records one room per half — `"AB1-101 / AB2-3"` — because it
 * is a theory class and a lab class that share a course code. The theory takes
 * the first room and the lab the second; without that split a dash report would
 * credit a block change that never happened, since both halves would read as the
 * same building.
 */
const isEmbedded = (type: string | undefined) =>
  String(type ?? "").toLowerCase().includes("embedded");

/** Pull the half of a combined room string that belongs to this half. */
function venueForHalf(venue: string, half: "theory" | "lab"): string {
  if (!isEmbedded(venue) && !venue.includes("/")) return venue;
  const parts = venue.split("/");
  if (parts.length < 2) return venue;
  return (half === "theory" ? parts[0] : parts[1]).trim();
}

/**
 * What one timetable occupies on one day.
 *
 * The `else if` between the theory and lab halves is deliberate and matches
 * every copy this replaces: a period whose theory and lab slots are both held by
 * the same student is reported once, as a theory class, rather than twice.
 */
export function dayOccupancy(
  courses: readonly MetricCourse[],
  schema: CampusSchema,
  day: DayId
): DayOccupancy {
  const theoryPeriods = nonLunch(schema.theory);
  const labPeriods = nonLunch(schema.lab);
  // Both spellings, so a law course booked "A" answers to the schema's "A1".
  const owned = expandSlotSpellings(courses.flatMap((c) => c.slots));

  const classes: OccupiedClass[] = [];

  theoryPeriods.forEach((period, index) => {
    if (!period?.start || !period?.end) return;
    const labSlot = labPeriods[index]?.days?.[day];
    const startMin = timeToMinutes(period.start);
    const endMin = timeToMinutes(period.end);
    if (startMin === null || endMin === null) return;

    for (const half of ["theory", "lab"] as const) {
      const slot = half === "theory" ? period.days?.[day] : labSlot;
      if (!slot || !owned.has(slot)) continue;
      const course = courses.find((c) => hasSlot(c.slots, slot));
      classes.push({
        startMin,
        endMin,
        start: period.start,
        end: period.end,
        code: course?.code ?? "",
        title: course?.title ?? "",
        venue: venueForHalf(course?.venue ?? "", half),
      });
      // Reported once even if both halves are held.
      break;
    }
  });

  classes.sort((a, b) => a.startMin - b.startMin);

  return {
    classes,
    morningOccupied: classes.some((c) => c.startMin < MORNING_BEFORE_MIN),
    eveningOccupied: classes.some((c) => c.startMin >= MORNING_BEFORE_MIN),
  };
}

/**
 * The free half-days of a timetable, as `"mon_morning"` / `"fri_evening"`.
 *
 * Ten is the maximum, and it is the score every timetable used to get.
 */
export function freeHalfDays(courses: readonly MetricCourse[], schema: CampusSchema): string[] {
  const free: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    const { morningOccupied, eveningOccupied } = dayOccupancy(courses, schema, day);
    if (!morningOccupied) free.push(`${day}_morning`);
    if (!eveningOccupied) free.push(`${day}_evening`);
  }
  return free;
}

/* ── metrics ────────────────────────────────────────────────────────────── */

/**
 * A stretch of dead time between two classes, worth showing.
 *
 * Five minutes is below the shortest changeover the timetable actually has, so a
 * smaller gap is the walk between rooms rather than a hole in the day.
 */
const GAP_WORTH_REPORTING_MIN = 5;

/**
 * A gap short enough to walk between blocks without losing a class, and long
 * enough to feel like a dash. Above `GAP_WORTH_REPORTING_MIN` it is just a gap;
 * below zero the classes overlap, which is a clash the generator should have
 * stopped.
 */
const DASH_WINDOW_MIN = 15;

/** The block a room sits in: `"AB5-405"` → `"AB5"`. */
const blockOfVenue = (venue: string) => venue.split("-")[0]?.trim() ?? "";

/** An unassigned venue is not a block, and must not read as one. */
const isRealBlock = (block: string) => !!block && block !== "NIL";

export interface GapDetail {
  day: DayId;
  startMin: number;
  endMin: number;
  durationMins: number;
  fromClass?: string;
  toClass?: string;
  fromTime?: string;
  toTime?: string;
}

export interface DashDetail {
  fromClass: string;
  toClass: string;
  fromTime: string;
  toTime: string;
  /** The day id, `"mon"` — the same key `gapsPerDay` uses. */
  day: string;
  fromBlock: string;
  toBlock: string;
}

/**
 * The whole scoring contract, in one type.
 *
 * `FFCS/types.ts` derives its `TimetableState.metrics` from this, which is what
 * makes a producer that fills in some of these fields a compile error rather
 * than a field that renders as blank.
 */
export interface TimetableMetrics {
  /** Out of a possible ten. */
  halfDays: number;
  /** Minutes of dead time across the week. */
  gaps: number;
  /** Minutes, keyed by day id. */
  gapsPerDay: Record<string, number>;
  gapDetails: GapDetail[];
  buildingDashes: number;
  dashDetails: DashDetail[];
  isLongWeekend: boolean;
  /** Attached by the caller, which owns the friends list. */
  socialScore: number;
  bestFriendMatches: string[];
}

/** The nine keys, for the test that asserts a producer fills all of them. */
export const TIMETABLE_METRICS_KEYS = [
  "halfDays",
  "gaps",
  "gapsPerDay",
  "gapDetails",
  "buildingDashes",
  "dashDetails",
  "isLongWeekend",
  "socialScore",
  "bestFriendMatches",
] as const;

const nameOf = (c: OccupiedClass) => `${c.code} (${c.title})`;

/**
 * Score a timetable.
 *
 * The social fields are part of the returned contract but are **not** computed
 * here — they depend on the friends list, which belongs to the caller. They are
 * initialised so that a caller which does not care about them still produces a
 * complete object rather than one with holes in it.
 */
export function timetableMetrics(
  courses: readonly MetricCourse[],
  schema: CampusSchema
): TimetableMetrics {
  const gapDetails: GapDetail[] = [];
  const dashDetails: DashDetail[] = [];
  const gapsPerDay: Record<string, number> = {};
  let totalGaps = 0;
  let buildingDashes = 0;
  let freeHalfDayCount = 0;
  let mondayFree = true;
  let fridayFree = true;

  for (const day of DAYS_OF_WEEK) {
    const { classes, morningOccupied, eveningOccupied } = dayOccupancy(
      courses,
      schema,
      day
    );

    if (classes.length > 0) {
      if (day === "mon") mondayFree = false;
      if (day === "fri") fridayFree = false;
    }
    if (!morningOccupied) freeHalfDayCount++;
    if (!eveningOccupied) freeHalfDayCount++;

    let dayGaps = 0;
    for (let i = 1; i < classes.length; i++) {
      const prev = classes[i - 1];
      const curr = classes[i];
      const gap = curr.startMin - prev.endMin;

      if (gap > GAP_WORTH_REPORTING_MIN) {
        dayGaps += gap;
        gapDetails.push({
          day,
          startMin: prev.endMin,
          endMin: curr.startMin,
          durationMins: gap,
          fromClass: nameOf(prev),
          toClass: nameOf(curr),
          fromTime: prev.end,
          toTime: curr.start,
        });
      }

      if (gap >= 0 && gap <= DASH_WINDOW_MIN) {
        const fromBlock = blockOfVenue(prev.venue);
        const toBlock = blockOfVenue(curr.venue);
        if (
          isRealBlock(fromBlock) &&
          isRealBlock(toBlock) &&
          fromBlock !== toBlock
        ) {
          buildingDashes++;
          dashDetails.push({
            fromClass: nameOf(prev),
            toClass: nameOf(curr),
            fromTime: prev.end,
            toTime: curr.start,
            day,
            fromBlock,
            toBlock,
          });
        }
      }
    }

    gapsPerDay[day] = dayGaps;
    totalGaps += dayGaps;
  }

  return {
    halfDays: freeHalfDayCount,
    gaps: totalGaps,
    gapsPerDay,
    gapDetails,
    buildingDashes,
    dashDetails,
    isLongWeekend: mondayFree || fridayFree,
    socialScore: 0,
    bestFriendMatches: [],
  };
}

/* ── social score ───────────────────────────────────────────────────────── */

/**
 * How many slots exist in total, for the "mutually free slots" term.
 *
 * A hardcoded 60 — the 18 theory and 30 lab periods of the Chennai grid, times
 * the days they run on, rounded. Deduced from the schema instead would be more
 * honest about what it is measuring, and would change every friend's score if
 * a campus ever added a period, so it stays until somebody asks the question.
 */
const TOTAL_SLOT_COUNT = 60;

export interface SocialScore {
  percentage: number;
  actualScore: number;
  maxScore: number;
}

/**
 * How well two timetables overlap, out of three things: the classes they share,
 * the slots neither takes, and the half-days both leave free.
 *
 * The three terms are weighted 3 / 1 / 5, which was chosen when this was written
 * and has never been argued with. It is the one piece of arithmetic in the
 * planner that is a preference rather than a measurement.
 */
export function pairwiseSocialScore(
  mine: readonly MetricCourse[],
  theirs: readonly MetricCourse[],
  schema: CampusSchema
): SocialScore {
  const mySlots = new Set(mine.flatMap((c) => c.slots));
  const theirSlots = new Set(theirs.flatMap((c) => c.slots));

  // 1. Mutually free slots: the bigger of the two slot sets, less the union.
  const mutuallyFree = TOTAL_SLOT_COUNT - new Set([...mySlots, ...theirSlots]).size;
  const maxMutuallyFree = TOTAL_SLOT_COUNT - theirSlots.size;

  // 2. Shared classes: same code on the same slot.
  const myCourseBySlot = new Map<string, string>();
  mine.forEach((c) => c.slots.forEach((s) => myCourseBySlot.set(s, c.code ?? "")));
  let sharedClasses = 0;
  for (const [slot, code] of myCourseBySlot) {
    if (theirs.some((c) => c.code === code && hasSlot(c.slots, slot))) sharedClasses++;
  }
  const maxSharedClasses = theirSlots.size;

  // 3. Shared free half-days.
  const myFree = new Set(freeHalfDays(mine, schema));
  const theirFree = freeHalfDays(theirs, schema);
  const sharedHalfDays = theirFree.filter((d) => myFree.has(d)).length;

  const actualScore =
    sharedClasses * 3 + mutuallyFree * 1 + sharedHalfDays * 5;
  const maxScore =
    maxSharedClasses * 3 + maxMutuallyFree * 1 + theirFree.length * 5;

  return {
    percentage: maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0,
    actualScore,
    maxScore,
  };
}

/* ── sorting ────────────────────────────────────────────────────────────── */

/**
 * A week of dead time, in minutes, at which the gaps term stops scoring.
 *
 * Twenty gap-hours. This is the `20` that appeared unexplained in three copies
 * of the balanced sort, now named and expressed in the same unit as `gaps`.
 */
export const MAX_WEEKLY_GAP_MIN = 1200;

export type SortBy = "social" | "halfdays" | "compactness" | "balanced";

/**
 * Anything that can be ordered, with its score.
 *
 * `metrics` is optional because `TimetableState.metrics` is — a hand-built or
 * freshly imported timetable may not have been scored yet. Unscored entries sort
 * last, which is the only safe place for them: an unscored option is one this
 * generator did not produce, and it has no claim to be better than one it did.
 */
export interface SortableTimetable {
  metrics?: TimetableMetrics;
}

/**
 * Order generated timetables, strongest first.
 *
 * The balanced score is `halfDays * 10 + gapCredit + socialScore`, which says
 * that ten free half-days is worth about two hours of dead time, and that a
 * friend's opinion is worth two and a half half-days. Those are preferences, not
 * measurements, and they are the weights the planner has always used.
 *
 * `gapCredit` is `((MAX_WEEKLY_GAP_MIN - gaps) / 60) * 5`, which is the old
 * `(20 - gaps) * 5` restated for minutes. Identical arithmetic: dividing by 60
 * converts the gap back to the hours the constant was written in, so a timetable
 * with 60 minutes of gaps scores 19 here rather than the −40 it used to when it
 * was handed 60 where the formula expected hours.
 */
export function balancedScore(metrics: TimetableMetrics): number {
  const gapCredit = ((MAX_WEEKLY_GAP_MIN - metrics.gaps) / 60) * 5;
  return metrics.halfDays * 10 + gapCredit + metrics.socialScore;
}

/** Sort strongest first, unscored last. */
export function sortTimetables<T extends SortableTimetable>(timetables: T[], by: SortBy): T[] {
  const rank = (m: TimetableMetrics | undefined) => (m ? balancedScore(m) : -Infinity);

  return [...timetables].sort((a, b) => {
    const am = a.metrics;
    const bm = b.metrics;
    if (!am && !bm) return 0;
    if (!am) return 1;
    if (!bm) return -1;
    switch (by) {
      case "social":
        return bm.socialScore - am.socialScore;
      case "halfdays":
        return bm.halfDays - am.halfDays;
      case "compactness":
        return am.gaps - bm.gaps; // fewer minutes of dead time is better
      case "balanced":
      default:
        return rank(bm) - rank(am);
    }
  });
}

/* ── display ────────────────────────────────────────────────────────────── */

/**
 * Minutes as the hours the UI prints: `75` → `"1.3"`, `120` → `"2"`.
 *
 * The three call sites render `{metrics.gaps}h`, and the value behind it used to
 * be minutes in one producer and hours in another, so a sixty-minute gap
 * displayed as "60h". Rounding to one decimal is enough for a summary figure and
 * keeps the label from becoming "1.25h" in a badge.
 */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
