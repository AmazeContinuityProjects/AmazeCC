/**
 * The timetable generator.
 *
 * ## Why this is a pure function
 *
 * It used to exist three times: inline in `FFCSTimetableTab`, inline again in
 * `FFCSGeneratorSubpage` (then `AutoGeneratorModal`), and in a web worker. The
 * two inline copies were
 * byte-for-byte identical, and the worker was reachable only through a function
 * that the generator screen imported and never called — so it had never run.
 *
 * All three are now this function. The UI call sites set state and render
 * whatever comes back; the worker posts the result across. Nothing here touches
 * React, `window`, `localStorage` or `next-themes`, which is what lets the same
 * code run on the main thread and off it.
 *
 * ## What it does
 *
 * For each locked course, narrow the report's offerings to the ones the student
 * allows (eight filters, in the order the UI has always applied them), then
 * backtrack over the cartesian product keeping only combinations whose periods
 * do not overlap on any day. Each surviving combination is scored, filtered by
 * the free-half-days minimum, optionally deduped by faculty, grouped into
 * variants that share a physical slot layout, and sorted.
 *
 * ## Why the errors are codes
 *
 * Each surface has its own wording for the same four failures, and the wording
 * is user-facing copy. So the result carries a code plus whatever the message
 * needs, and each caller maps it to its own string. One place decides *which*
 * failure happened; two places decide how to say it.
 */

import {
  MORNING_BEFORE_MIN,
  expandSlotSpellings,
  periodsForSlot,
  slotSpellings,
  splitSlots,
  timeToMinutes,
  periodListsClash,
  type CampusSchema,
  type DayId,
  type SlotPeriod,
  DAYS_OF_WEEK,
} from "@/lib/slots";
import {
  pairwiseSocialScore,
  balancedScore,
  sortTimetables,
  timetableMetrics,
  type SortBy,
} from "@/lib/timetableMetrics";
import {
  combineFactorScores,
  combineRankingScores,
  rankingFactorScores,
  rankingInputs,
  rankCourses,
  type RankingFactor,
  type RankingInputs,
  type RankingMode,
  type RankingPriority,
  type RankingScore,
} from "@/lib/ffcsRanking";
import {
  DEFAULT_FACULTY_METRIC_WEIGHTS,
  DEFAULT_FACULTY_SCORE_FILTERS,
  facultyRankingSummary,
  passesFacultyScoreFilters,
  type FacultyMetricWeights,
  type FacultyRatingLookup,
  type FacultyScoreFilters,
} from "@/lib/ffcsFacultyRanking";
import { offeringMatches } from "../reports";
import type { ParsedCourse, TimetableState, Friend, CourseLock, AddedCourse } from "../types";

/** The ways a narrowing can end with nothing to offer. */
export type GeneratorErrorCode =
  | "no_courses_selected"
  | "no_valid_slots"
  | "no_conflict_free"
  | "below_min_half_days"
  | "below_min_faculty_scores"
  | "no_separate_labs"
  | "no_consecutive_labs"
  /**
   * The solver itself threw. Not a filtering outcome — the worker catches it and
   * reports it under this code so the caller can tell "nothing matched" from
   * "something broke", which are very different things to show a student.
   */
  | "error";

export interface GenerateParams {
  schema: CampusSchema;
  /** Every row of the FFCS report, as parsed. */
  masterCourses: readonly ParsedCourse[];
  /** The courses the student picked, each with their constraints. */
  courseLocks: readonly CourseLock[];
  /**
   * Slots the student ruled out.
   *
   * An array rather than a `Set` because this crosses a structured clone to
   * reach the worker, and being explicit about the wire shape keeps the boundary
   * from depending on `Set` surviving it.
   */
  blockedSlots: readonly string[];
  friends: readonly Friend[];
  /**
   * Which half of the day the student wants.
   *
   * `"morning"` and `"evening"` can filter strictly or score preferred-side
   * theory coverage softly, based on `strictTheoryPreference`. `"compact"` and
   * `"spread"` are ranking preferences rather than option filters.
   */
  preference: "none" | "morning" | "evening" | "compact" | "spread";
  /** Keep the morning/evening theory filter strict; false ranks both sides softly. */
  strictTheoryPreference?: boolean;
  /**
   * Narrow each course to the exact offering a friend already has.
   *
   * A filter, and independent of `maximizeFreeTimeFriends`: a student can
   * constrain the search to what their friends are taking, or merely prefer
   * timetables that suit them, or both. The two were briefly conflated here,
   * which meant a student with friends got a social score of zero unless they
   * had also asked for the filter.
   */
  syncFriendClasses: boolean;
  /**
   * The friends whose timetables to score against, by id.
   *
   * Empty means "do not score", which is different from "score against nobody" —
   * the caller decides who is in the running, because only it knows which
   * friends the student picked.
   */
  maximizeFreeTimeFriends: readonly string[];
  /** `"08:00"`, 24-hour. Empty or null means unbounded. */
  minStartTime?: string | null;
  maxEndTime?: string | null;
  /** Per-day latest class end (`"HH:mm"`). Missing days are unconstrained. */
  maxEndTimeByDay?: Partial<Record<DayId, string | null>>;
  uniqueFaculties: boolean;
  noLimit: boolean;
  /**
   * How many timetables the search keeps when it is not running unlimited.
   *
   * Optional and unset by default, which reads as {@link DEFAULT_RESULT_LIMIT} —
   * the same fifty the planner has always stopped at. It exists so the result
   * cap in settings is a real ceiling on the search rather than a display
   * number trimmed after the fact; `noLimit` still outranks it, because the
   * per-run switch is the more recent thing the student chose. Unlimited runs
   * retain {@link HARD_RESULT_LIMIT} unless Planner Settings explicitly opts
   * out via `removeHardResultLimit`.
   */
  resultCap?: number;
  /** Explicit Planner Settings opt-in to remove the unlimited run safety ceiling. */
  removeHardResultLimit?: boolean;
  minHalfDays: number;
  sortBy: SortBy;
  /**
   * Order by a weighted ranking profile instead of by `sortBy` alone.
   *
   * Optional, and **unset by default** — with no mode the pipeline is exactly
   * the one it has always been, in the same order, at the same cost. Setting it
   * is a preference the student picked, so it wins over `sortBy`, with `sortBy`
   * deciding ties (the sort is stable, so the second pass cannot scramble
   * anything the first one established).
   */
  rankingMode?: RankingMode;
  /** Vitfac scores prepared on the main thread for worker-safe ranking. */
  facultyRatings?: FacultyRatingLookup;
  /** Distinguishes a loaded catalog with unrated faculty from an unavailable integration. */
  facultyRatingsAvailable?: boolean;
  facultyMetricWeights?: FacultyMetricWeights;
  facultyScoreFilters?: FacultyScoreFilters;
  rankingPriorityOrder?: readonly RankingPriority[];
  /**
   * The generator's ranked factor list: position among the enabled factors is
   * the weight, `disabled` factors are excluded from the score entirely.
   *
   * Optional and **unset by default** — when present it supersedes the
   * `rankingMode` / `rankingPriorityOrder` blend above (which stays exactly as
   * it was for the guided selector, settings, and every existing caller). One
   * kind of ranking runs per call, never both stacked.
   */
  rankingFactors?: {
    order: readonly RankingFactor[];
    disabled?: readonly RankingFactor[];
  };
  /**
   * Keep every lab on its own day.
   *
   * A week that books two labs onto one day — even in adjacent periods, which
   * the overlap rule rightly allows — never reaches the result: with the
   * option on, the walk declines the partial week that puts the second lab on
   * the day, and the after-the-search check remains as the guard behind it.
   * One lab that runs several lab periods, even across two days, is still one
   * lab and never trips this. Optional and unset by default: with no value the
   * pipeline is exactly the one it has always been. When the whole search
   * space fails the rule, the run fails with `no_separate_labs`, an emptiness
   * worded for the toggle that caused it.
   */
  separateLabDays?: boolean;
  /** Reject two different lab classes that occupy consecutive lab periods on one day. */
  avoidConsecutiveLabs?: boolean;
  /** When enabled, a schema lunch marker separates otherwise consecutive lab periods. */
  lunchBreakSeparatesLabs?: boolean;
}

/**
 * Either the timetables, or the reason there are none.
 *
 * The discriminant is a string, not `ok: true | false`, because this project's
 * `tsconfig` is not in strict mode and TypeScript does not narrow a union on a
 * boolean literal there — `if (result.ok)` leaves `result` as the whole union and
 * every access after it is an error. A string discriminant narrows in any mode,
 * and it also reads better in a debugger.
 */
export type GenerateResult =
  | {
      kind: "ok";
      timetables: TimetableState[];
      /**
       * The search stopped before it had seen everything.
       *
       * Either it hit the result cap, or the caller cancelled it. Both mean the
       * same thing to a student: there are almost certainly more options than
       * the ones on screen, which is the difference between "these five are all
       * there is" and "these five are what I looked at first".
       */
      capped: boolean;
    }
  /**
   * The caller abandoned the search.
   *
   * Carries whatever had been accepted rather than nothing, because a cancel
   * that throws away ten seconds of results is worse than a cancel that shows
   * them labelled as incomplete. `kind` stays a string for the same
   * non-strict-mode reason `GenerateResult` has always used one.
   */
  | { kind: "cancelled"; timetables: TimetableState[] }
  | {
      kind: "error";
      code: GeneratorErrorCode;
      /** The course code, for `no_valid_slots`. */
      subjectCode?: string;
    };

/**
 * How far a streaming search has got.
 *
 * Reported rather than computed by the caller because only the solver knows
 * either number: the caller cannot see inside the backtrack, and guessing at
 * "combinations examined" from wall-clock time is how progress bars end up
 * lying.
 */
export interface GenerateProgress {
  /** Nodes visited in the search tree. Grows faster than `found`, by design. */
  nodes: number;
  /**
   * Combinations reached that no active rule had already ruled out, before
   * scoring and the remaining result filters.
   *
   * With the lab rules or a half-days floor on, that is fewer than the
   * conflict-free total — the walk never descends into a week they have
   * already disqualified — and with none of them on it is exactly the
   * conflict-free total, as it has always been.
   */
  found: number;
  /** Timetables that survived every filter — what a UI can actually show. */
  accepted: number;
}

/**
 * Progress and cancellation for a run the caller wants to watch.
 *
 * All three are optional, and omitting all of them is exactly what
 * `generateTimetables` does — which is why the non-streaming entry point is the
 * streaming one with no hooks, rather than a second implementation.
 */
export interface GenerateStreamHooks {
  /**
   * Each accepted timetable, in search order.
   *
   * Not sorted, not grouped, and not deduped: those are whole-result
   * operations, and running them per batch would either be quadratic or would
   * renumber options under the reader. A caller that wants the settled order
   * reads it from the `GenerateResult` when the run finishes.
   */
  onBatch?: (timetables: TimetableState[]) => void;
  /** Roughly every few thousand nodes. */
  onProgress?: (progress: GenerateProgress) => void;
  /**
   * Return true to abandon the search.
   *
   * Polled on the progress cadence rather than per node, so honouring it costs
   * a comparison every few thousand nodes instead of one per node in the
   * innermost loop of a search that can run to millions.
   */
  shouldStop?: () => boolean;
  /** How many accepted timetables to hold before flushing a batch. */
  batchSize?: number;
}

/** Colours cycled across the courses of one timetable. */
const COURSE_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-emerald-500",
  "bg-red-600",
  "bg-amber-500",
  "bg-pink-500",
  "bg-indigo-600",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-rose-600",
  "bg-violet-600",
  "bg-sky-500",
  "bg-yellow-500",
  "bg-green-600",
  "bg-magenta-500",
];

/**
 * "No limit" is not unlimited — it is this ceiling.
 *
 * The bound used to be 999999, which stopped nothing: a wide search found its
 * tens of thousands and streamed every one into the page, whose render could
 * not keep pace with a list growing past what a browser can paint — the
 * screen sat on "Searching for conflict-free weeks" and looked infinite even
 * though the solve itself ran on a background thread. A ceiling answers both
 * the paint problem and the posterion of no result ever arriving: the walk
 * halts here, the kept list still streams in batches as it was found, and the
 * run's answer says it was capped.
 *
 * Exported so the streaming test can pin the exact stop, and so it reads as a
 * product number next to the settings cap: 30,000 is tens of grips above the
 * 1,000 a student can set, so the switch still means "much wider", never
 * "nothing can stop this".
 */
export const HARD_RESULT_LIMIT = 30_000;
/** Exported because the settings sheet offers it as the cap to come back to. */
export const DEFAULT_RESULT_LIMIT = 50;
/**
 * Accepted timetables per streamed batch.
 *
 * Deliberately the same 50 as the default cap: the first thing a student asked
 * for is fifty choices, so the first flush is fifty choices. Searches that
 * finish below the threshold flush once at the end, which is indistinguishable
 * to the reader because the run is over either way.
 */
const DEFAULT_BATCH_SIZE = 50;

/* ── helpers ────────────────────────────────────────────────────────────── */

export { splitSlots };

/** `"08:00"` → 480. Returns null rather than 0, which would be midnight. */
function parse24HourToMinutes(time: string): number | null {
  const match = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Does this slot run in the morning?
 *
 * `true` for a slot with no period at all, which is how `"NIL"` and any id the
 * schema does not define pass every filter rather than being silently dropped.
 */
function isMorningSlot(schema: CampusSchema, slot: string): boolean {
  const periods = periodsForSlot(schema, slot);
  if (!periods.length) return true;
  return periods.some((p) => p.startMin < MORNING_BEFORE_MIN);
}

function isEveningSlot(schema: CampusSchema, slot: string): boolean {
  const periods = periodsForSlot(schema, slot);
  if (!periods.length) return true;
  return periods.some((p) => p.startMin >= MORNING_BEFORE_MIN);
}

/**
 * An embedded course's booking must actually carry both halves.
 *
 * A combined theory+lab row is only usable if it has a theory slot *and* a lab
 * slot. The report contains rows whose halves never paired up, and generating a
 * timetable that books a "theory + lab" course with only a lab is worse than
 * not offering it.
 *
 * Also the reason a law course is never dropped here: its slots are letters
 * with no `L` prefix and no number, so it is not embedded and passes through.
 */
function isCompleteEmbeddedCourse(option: ParsedCourse): boolean {
  const type = option.TYPE.trim().toUpperCase();
  const embedded =
    type === "ETH" ||
    type === "ELA" ||
    type === "EPJ" ||
    type.includes("EMBEDDED") ||
    type.includes("+");
  if (!embedded) return true;
  const slots = splitSlots(option.SLOT);
  const hasTheory = slots.some((s) => !s.startsWith("L") && s !== "NIL");
  const hasLab = slots.some((s) => s.startsWith("L"));
  return hasTheory && hasLab;
}

/* ── option filtering ───────────────────────────────────────────────────── */

/**
 * Narrow a course's offerings to the ones this student allows.
 *
 * The order of these is the order the UI has always applied them in, and it
 * matters for the error a student sees: an offering rejected by an early filter
 * is never reconsidered by a later one.
 */
function optionsFor(
  schema: CampusSchema,
  params: GenerateParams,
  lock: CourseLock,
  all: ParsedCourse[]
): ParsedCourse[] {
  const blocked = new Set(params.blockedSlots.map((s) => s.trim().toUpperCase()));
  let options = all;

  // 1. The student named specific slots.
  if (lock.allowedSlots?.length) {
    const allowed = new Set(lock.allowedSlots.map((s) => s.trim().toUpperCase()));
    options = options.filter(
      (opt) =>
        allowed.has(opt.SLOT.trim().toUpperCase()) ||
        splitSlots(opt.SLOT).some((s) => allowed.has(s))
    );
  }

  // 2. The student named specific faculty.
  if (lock.allowedFaculty?.length) {
    options = options.filter((opt) => lock.allowedFaculty!.includes(opt.FACULTY));
  }

  // 3. The student picked exact offerings — "FACULTY|SLOT|ROOM", plus the
  //    employee's ERP ID when the report has one. The id is what distinguishes
  //    two people with the same name, and the legacy form keeps a lock saved
  //    against the previous semester matching its equivalent row.
  if (lock.offerings?.length) {
    options = options.filter((opt) => offeringMatches(opt, lock.offerings!));
  }

  // 4. Embedded rows need both halves.
  options = options.filter(isCompleteEmbeddedCourse);

  // 5. Morning-only or evening-only.
  if (params.preference === "morning" && params.strictTheoryPreference !== false) {
    options = options.filter((opt) => {
      const theory = splitSlots(opt.SLOT).filter((s) => !s.startsWith("L") && s !== "NIL");
      return !theory.length || isMorningSlot(schema, theory[0]);
    });
  } else if (params.preference === "evening" && params.strictTheoryPreference !== false) {
    options = options.filter((opt) => {
      const theory = splitSlots(opt.SLOT).filter((s) => !s.startsWith("L") && s !== "NIL");
      return !theory.length || isEveningSlot(schema, theory[0]);
    });
  }

  // 6. Ruled-out slots. Checked through both spellings, so a law student who
  //    blocks "A" also loses the "A1" offering — which is the whole point, since
  //    the two name the same period and the report writes the numbered one.
  options = options.filter((opt) => {
    const slots = splitSlots(opt.SLOT);
    return !slots.some(
      (slot) => slotSpellings(slot).some((spelling) => blocked.has(spelling))
    );
  });

  // 7. Time bounds.
  const minAllowed = params.minStartTime ? parse24HourToMinutes(params.minStartTime) : 0;
  const maxAllowed = params.maxEndTime ? parse24HourToMinutes(params.maxEndTime) : 24 * 60;
  const maxAllowedByDay = Object.fromEntries(
    Object.entries(params.maxEndTimeByDay ?? {}).flatMap(([day, time]) => {
      const minutes = time ? parse24HourToMinutes(time) : null;
      return minutes === null ? [] : [[day, minutes]];
    })
  ) as Partial<Record<DayId, number>>;
  if (params.minStartTime || params.maxEndTime || Object.keys(maxAllowedByDay).length > 0) {
    const lower = minAllowed ?? 0;
    const upper = maxAllowed ?? 24 * 60;
    options = options.filter((opt) =>
      splitSlots(opt.SLOT).every((slot) => {
        // Slot ids can recur on several days; every occurrence must meet its
        // global bounds and the optional day-specific end time.
        return periodsForSlot(schema, slot).every((period) => {
          const dayLimit = maxAllowedByDay[period.day];
          return (
            period.startMin >= lower &&
            period.endMin <= upper &&
            (dayLimit === undefined || period.endMin <= dayLimit)
          );
        });
      })
    );
  }

  // 8. Match a friend's timetable exactly.
  if (params.syncFriendClasses) {
    const friendCourses = params.friends
      .flatMap((f) => f.timetables ?? [])
      .flatMap((t) => t.courses ?? [])
      .filter((c) => c.code === lock.code);
    // Only filters when the friend actually has this course. An absent course
    // means "no opinion", not "reject everything".
    if (friendCourses.length) {
      options = options.filter((opt) => {
        const optSlots = splitSlots(opt.SLOT).sort().join(",");
        return friendCourses.some((fc) => {
          const theirSlots = [...fc.slots].map((s) => s.trim().toUpperCase()).sort().join(",");
          return opt.FACULTY === fc.faculty && optSlots === theirSlots;
        });
      });
    }
  }

  return options;
}

/* ── the solve ──────────────────────────────────────────────────────────── */

/** Do two bookings collide anywhere? Shared canonical interval clash predicate. */
const clashes = periodListsClash;

/**
 * Does this week put two lab bookings on one day?
 *
 * One lab's own lab periods are a single booking, not two — a lab that runs
 * `L1+L2` in adjacent periods, or even reaches across two days, vacates the
 * rule. What trips it is two *different* courses' lab halves sharing a day:
 * two labs in adjacent periods are every overlap check's "disjoint" and still
 * swallow an afternoon. Offerings with no lab half contribute nothing, which
 * is also how a combination survives when only some of its courses have labs.
 */
function labsShareADay(
  combination: readonly ParsedCourse[],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>
): boolean {
  const taken = new Set<DayId>();
  for (const offering of combination) {
    const labPeriods = labPeriodsByOffering.get(offering);
    if (!labPeriods) continue;
    const offeringDays = new Set(labPeriods.map((period) => period.day));
    for (const day of offeringDays) {
      if (taken.has(day)) return true;
      taken.add(day);
    }
  }
  return false;
}

function labPeriodPairKey(day: DayId, firstIndex: number, secondIndex: number): string {
  return `${day}:${Math.min(firstIndex, secondIndex)}:${Math.max(firstIndex, secondIndex)}`;
}

/**
 * Every pair of lab periods on one day that count as consecutive.
 *
 * Keyed `day:min:max` by raw `schema.lab` index. Exported because the pruning
 * test builds its oracle from the same pair set the walk prunes on: a
 * bitmask implementation that disagreed with *this* would be a bug in one of
 * them, and the test is what says which.
 */
export function consecutiveLabPeriodPairs(
  schema: CampusSchema,
  lunchBreakSeparatesLabs: boolean
): Set<string> {
  const pairs = new Set<string>();
  for (const day of DAYS_OF_WEEK) {
    const dayPeriods = (schema.lab ?? [])
      .flatMap((period, index) => {
        if (period.lunch || !period.start || !period.end || !period.days?.[day]) return [];
        const startMin = timeToMinutes(period.start);
        return startMin === null ? [] : [{ index, startMin }];
      })
      .sort((a, b) => a.startMin - b.startMin || a.index - b.index);
    for (let index = 0; index < dayPeriods.length - 1; index++) {
      const first = dayPeriods[index];
      const second = dayPeriods[index + 1];
      if (
        lunchBreakSeparatesLabs &&
        (schema.lab ?? []).slice(first.index + 1, second.index).some((period) => period.lunch)
      ) {
        continue;
      }
      pairs.add(labPeriodPairKey(day, first.index, second.index));
    }
  }
  return pairs;
}

function labsAreConsecutive(
  combination: readonly ParsedCourse[],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>,
  consecutivePairs: ReadonlySet<string>
): boolean {
  for (let firstIndex = 0; firstIndex < combination.length; firstIndex++) {
    const firstPeriods = labPeriodsByOffering.get(combination[firstIndex]) ?? [];
    for (let secondIndex = firstIndex + 1; secondIndex < combination.length; secondIndex++) {
      const secondPeriods = labPeriodsByOffering.get(combination[secondIndex]) ?? [];
      if (
        firstPeriods.some((first) =>
          secondPeriods.some((second) =>
            first.day === second.day &&
            consecutivePairs.has(labPeriodPairKey(first.day, first.index, second.index))
          )
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/* ── pruning on the rules, inside the walk ─────────────────────────────── */

/**
 * The number of set bits in `value`.
 *
 * Kernighan's loop — one iteration per set bit — and the masks this runs on
 * hold at most ten, so a de Bruijn table would be longer than the function.
 */
function popcount(value: number): number {
  let bits = 0;
  for (let rest = value; rest !== 0; rest &= rest - 1) bits++;
  return bits;
}

/** Half-day cells in a week: one per day, split at `MORNING_BEFORE_MIN`. */
const HALF_DAY_CELLS = DAYS_OF_WEEK.length * 2;

/** One half-day cell, and the slot strings that would occupy it. */
interface HalfDayCell {
  /** The bit this cell owns in a half-day mask: `dayIndex * 2 + evening`. */
  bit: number;
  /** The cell counts as occupied when an offering's spellings hold any of these. */
  slots: string[];
}

/**
 * Every half-day cell of a schema, as `(bit, slot strings)` pairs.
 *
 * Cell identity is `dayOccupancy`'s, because the floor this bounds is that
 * function's count: a mask that disagreed with it would either prune weeks
 * the metrics liked (unsound — a student's good week never shown) or keep
 * weeks they would reject (weak, but safe). So: theory periods with lunch
 * markers removed, paired index-wise with the lab list filtered the same way,
 * a lab half judged on the paired *theory* period's clock rather than its own,
 * and the half chosen by `MORNING_BEFORE_MIN` — exactly what `dayOccupancy`
 * does. Two cells can share a bit (six of chennai's Monday periods are all
 * morning), which is the same collapse that function performs when it reports
 * a day as a whole.
 */
function halfDayCells(schema: CampusSchema): HalfDayCell[] {
  const theory = (schema.theory ?? []).filter((period) => !period?.lunch);
  const lab = (schema.lab ?? []).filter((period) => !period?.lunch);
  const cells: HalfDayCell[] = [];

  theory.forEach((period, index) => {
    // An unreadable period contributes nothing — not even its lab half — for
    // the same reason `dayOccupancy` skips it.
    if (!period?.start || !period?.end) return;
    const startMin = timeToMinutes(period.start);
    const endMin = timeToMinutes(period.end);
    if (startMin === null || endMin === null) return;
    const evening = startMin >= MORNING_BEFORE_MIN ? 1 : 0;

    for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
      const slots: string[] = [];
      const theorySlot = period.days?.[DAYS_OF_WEEK[dayIndex]];
      if (theorySlot) slots.push(theorySlot);
      const labSlot = lab[index]?.days?.[DAYS_OF_WEEK[dayIndex]];
      if (labSlot) slots.push(labSlot);
      if (slots.length) cells.push({ bit: dayIndex * 2 + evening, slots });
    }
  });

  return cells;
}

/** One lab period of one offering, reduced to the two bit questions. */
interface LabSite {
  /** `DAYS_OF_WEEK` index — the day a threat has to share to count. */
  day: number;
  /** This site's own raw `schema.lab` index, as a bit. */
  own: number;
  /** Raw lab indices consecutive to `own` *on the same day*, as bits. */
  threat: number;
}

/**
 * Per-offering bit facts the walk prunes on, precomputed once per run.
 *
 * Every array is parallel to `options` — `[courseIndex][offeringIndex]` — so
 * the walk's inner loop reads numbers instead of walking the schema, which is
 * the whole reason these rules can be a filter rather than an objection. A
 * rule the run did not ask for has no array, and `null` here means the walk is
 * byte-for-byte the one it was before pruning existed.
 *
 * ## Why rejecting at first break is safe
 *
 * All three rules are *monotone* over partial combinations: a shared lab day,
 * a consecutive pair and an occupied half-day cell can each be added by a
 * later offering and none can ever be removed, so a partial that already
 * breaks a rule has no legal completion. Pruning it drops exactly the subtrees
 * that hold no leaf the old post-search filter would have kept — and the
 * leaves that survive are visited in the order they had without pruning,
 * which is what lets `limit`, the batches and the sorted output mean what
 * they always meant, over a set that is rule-legal rather than merely
 * conflict-free. (The half-days bound is optimistic rather than exact on a
 * partial — cells still fill as offerings join — so it prunes when the bound
 * itself is already below the floor, never when a completion could clear it.)
 */
interface WalkRules {
  /** 5 bits per offering: the days this offering runs a lab on. */
  labDayMasks?: number[][];
  /** `[course][offering]` → that offering's lab periods, one site each. */
  labSites?: LabSite[][][];
  /** 10 bits per offering: the half-day cells this offering fills. */
  halfDayMasks?: number[][];
  /** Prune any partial whose optimistic free-half-day count falls below this. */
  minHalfDays: number;
}

/**
 * Precompute whatever rules this run asked for, or `null` if it asked for none.
 *
 * The consecutive rule falls back to the visit-time check when the schema has
 * more lab periods than fit in a positive 32-bit mask — index 31 would be the
 * sign bit. The shipped schemas have thirteen at most, so this guards a future
 * schema rather than a path anything here walks today.
 */
function buildWalkRules(
  params: GenerateParams,
  schema: CampusSchema,
  optionsPerCourse: ParsedCourse[][],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>,
  consecutiveLabPairs: ReadonlySet<string>
): WalkRules | null {
  const rules: WalkRules = { minHalfDays: params.minHalfDays > 0 ? params.minHalfDays : 0 };

  if (params.separateLabDays) {
    rules.labDayMasks = optionsPerCourse.map((options) =>
      options.map((offering) => {
        let mask = 0;
        for (const period of labPeriodsByOffering.get(offering) ?? []) {
          mask |= 1 << DAYS_OF_WEEK.indexOf(period.day);
        }
        return mask;
      })
    );
  }

  if (params.avoidConsecutiveLabs && (schema.lab ?? []).length <= 31) {
    // The pair set is keyed `day:min:max`; turn it into per-period neighbours
    // once, so an offering's threat is a lookup rather than a set scan per node.
    const neighbours = new Map<string, number[]>();
    for (const key of consecutiveLabPairs) {
      const [day, first, second] = key.split(":");
      for (const [self, other] of [
        [first, second],
        [second, first],
      ] as const) {
        const at = `${day}:${self}`;
        const list = neighbours.get(at);
        if (list) list.push(Number(other));
        else neighbours.set(at, [Number(other)]);
      }
    }

    rules.labSites = optionsPerCourse.map((options) =>
      options.map((offering) => {
        const sites: LabSite[] = [];
        for (const period of labPeriodsByOffering.get(offering) ?? []) {
          let threat = 0;
          for (const other of neighbours.get(`${period.day}:${period.index}`) ?? []) {
            threat |= 1 << other;
          }
          sites.push({ day: DAYS_OF_WEEK.indexOf(period.day), own: 1 << period.index, threat });
        }
        return sites;
      })
    );
  }

  if (rules.minHalfDays > 0) {
    const cells = halfDayCells(schema);
    rules.halfDayMasks = optionsPerCourse.map((options) =>
      options.map((offering) => {
        // The same spellings set `dayOccupancy` builds from the scored week's
        // split tokens: the mask has to answer `owned.has(cellSlot)` the same
        // way or the bound drifts from the metric it bounds.
        const owned = expandSlotSpellings(splitSlots(offering.SLOT));
        let mask = 0;
        for (const cell of cells) {
          for (const slot of cell.slots) {
            if (owned.has(slot)) {
              mask |= 1 << cell.bit;
              break;
            }
          }
        }
        return mask;
      })
    );
  }

  return rules.labDayMasks || rules.labSites || rules.halfDayMasks ? rules : null;
}

/**
 * How often the walk checks whether its caller wants to stop.
 *
 * Every node would be the honest number, and it is a function call in the
 * innermost loop of a search that can visit millions. A few thousand is finer
 * than a person can perceive a cancellation and costs nothing measurable —
 * the same trade `conflictAnalyzer` makes for its own budget.
 */
const TICK_INTERVAL = 4096;

interface WalkHooks {
  /** One complete, conflict-free combination, in the report's order. */
  visit: (combination: ParsedCourse[]) => void;
  /** Polled every `TICK_INTERVAL` nodes; return true to abandon the search. */
  tick?: (nodes: number, found: number) => boolean;
}

interface WalkOutcome {
  /**
   * Complete combinations reached, before scoring and the result filters —
   * and, when `rules` pruned, only ones no active rule had already ruled out.
   * That re-aim is what makes `limit` a ceiling on weeks worth showing rather
   * than on weeks the walk merely survived.
   */
  found: number;
  /** `tick` asked to stop, so the remaining tree was never walked. */
  cancelled: boolean;
  /**
   * Whether in-tree pruning stopped at least one partial week, per rule.
   *
   * The caller turns these into the same rejection flags the visit-time
   * filters raise on their own, so a search cut down by a rule is worded as
   * that rule's failure and not as `no_conflict_free`.
   */
  labDayPruned: boolean;
  consecutivePruned: boolean;
  halfDaysPruned: boolean;
}

/**
 * Every combination of one offering per course that does not collide — and,
 * when the run asked for it, that no rule has already disqualified.
 *
 * Depth-first, in the report's order, stopping once `limit` have been found.
 * `options` is pre-indexed by slot string so the conflict test is a lookup
 * rather than a schema walk on every node — which is the difference between this
 * running at all on a wide selection and not.
 *
 * ## What `rules` changes
 *
 * With `rules` present the walk is also a filter: each partial week carries
 * bitmask state for the three monotone rules (see `WalkRules` for why cutting
 * at first break is safe) and an offering that would break one is skipped
 * without descending. `found` then counts rule-legal weeks rather than every
 * conflict-free one, and the visit order of everything that survives is the
 * order it had without pruning. With `rules` null every check below is a no-op
 * and the walk is byte-for-byte the one it was before pruning existed.
 *
 * ## Why this is a visitor rather than a collector
 *
 * It used to build an array of combinations and return it, which meant nothing
 * could be shown until the whole search was over. Handing each combination to a
 * visitor as it is found is the same walk in the same order with the same
 * stopping rule — the caller decides what to do with them, which for a
 * progressive UI is "show them".
 */
function walkCombinations(
  options: ParsedCourse[][],
  windows: SlotPeriod[][][],
  limit: number,
  hooks: WalkHooks,
  rules: WalkRules | null = null
): WalkOutcome {
  const chosen: ParsedCourse[] = [];
  const chosenWindows: SlotPeriod[] = [];
  let found = 0;
  let nodes = 0;
  let cancelled = false;
  let halted = false;
  let labDayPruned = false;
  let consecutivePruned = false;
  let halfDaysPruned = false;
  // Bit state for the partial week at the cursor.
  //
  // The lab-day and lab-site claims clear with `&= ~` because pushes are
  // guarded: a lab-day bit is only taken when no chosen offering holds that
  // day, and a site's day only when no chosen offering holds that period (two
  // offerings in the same period on the same day would clash, which the check
  // above already refused) — so an offering's bits are its own alone and
  // clearing them leaves everyone else's standing.
  //
  // Half-day cells are *not* disjoint — two labs can both fill Monday
  // morning — so that mask is saved before each push and restored after,
  // never cleared by mask arithmetic.
  let claimedLabDays = 0;
  const claimedLabSites = new Int32Array(DAYS_OF_WEEK.length);
  let claimedHalfDays = 0;
  const halfDayHistory: number[] = [];
  const minHalfDays = rules?.minHalfDays ?? 0;

  const walk = (index: number): void => {
    if (halted) return;
    if (found >= limit) {
      halted = true;
      return;
    }
    if (index === options.length) {
      found++;
      // Copied, because `chosen` is the walker's scratch space and is popped as
      // soon as this returns. The old collector copied for the same reason.
      hooks.visit([...chosen]);
      return;
    }
    if (hooks.tick && ++nodes % TICK_INTERVAL === 0 && hooks.tick(nodes, found)) {
      cancelled = true;
      halted = true;
      return;
    }
    const offeringWindows = windows[index];
    const labDayMasks = rules?.labDayMasks?.[index];
    const labSites = rules?.labSites?.[index];
    const halfDayMasks = rules?.halfDayMasks?.[index];
    for (let i = 0; i < options[index].length; i++) {
      // Per offering, not per course. A course offered on two slots offers two
      // *choices*; only the one actually taken can clash with what is already
      // in the week. Collapsing them into one array used to test both against
      // both, so the moment one of them clashed the whole course was skipped —
      // silently dropping the alternatives that had never been tried.
      const periods = offeringWindows[i];
      if (clashes(periods, chosenWindows)) continue;
      // The rules, after the clash check — which the no-rules path has always
      // run here and still runs alone when `rules` is null.
      if (labDayMasks !== undefined && (claimedLabDays & labDayMasks[i]) !== 0) {
        labDayPruned = true;
        continue;
      }
      if (labSites !== undefined) {
        const sites = labSites[i];
        let consecutiveHit = false;
        for (let s = 0; s < sites.length; s++) {
          if ((claimedLabSites[sites[s].day] & sites[s].threat) !== 0) {
            consecutiveHit = true;
            break;
          }
        }
        if (consecutiveHit) {
          consecutivePruned = true;
          continue;
        }
      }
      if (
        halfDayMasks !== undefined &&
        HALF_DAY_CELLS - popcount(claimedHalfDays | halfDayMasks[i]) < minHalfDays
      ) {
        halfDaysPruned = true;
        continue;
      }
      chosen.push(options[index][i]);
      chosenWindows.push(...periods);
      if (labDayMasks !== undefined) claimedLabDays |= labDayMasks[i];
      if (labSites !== undefined) {
        for (const site of labSites[i]) claimedLabSites[site.day] |= site.own;
      }
      if (halfDayMasks !== undefined) {
        halfDayHistory.push(claimedHalfDays);
        claimedHalfDays |= halfDayMasks[i];
      }
      walk(index + 1);
      if (halfDayMasks !== undefined) claimedHalfDays = halfDayHistory.pop() ?? 0;
      if (labSites !== undefined) {
        for (const site of labSites[i]) claimedLabSites[site.day] &= ~site.own;
      }
      if (labDayMasks !== undefined) claimedLabDays &= ~labDayMasks[i];
      chosenWindows.length = chosenWindows.length - periods.length;
      chosen.pop();
      if (halted) return;
    }
  };

  walk(0);
  return { found, cancelled, labDayPruned, consecutivePruned, halfDaysPruned };
}

/* ── scoring ────────────────────────────────────────────────────────────── */

/**
 * A unique id for a course and for a timetable.
 *
 * `crypto.randomUUID` is preferred, and it is `[SecureContext]`-only — it is
 * `undefined` on a plain-HTTP origin. That is not hypothetical here: this app
 * runs as a PWA over HTTPS, but its own dev-origin list contains a bare LAN IP
 * (`192.168.1.101`), and a self-hosted copy on a campus LAN over HTTP would have
 * no `crypto.randomUUID` at all. The generator runs in a worker, where a missing
 * global throws rather than degrading, and the old inline code used
 * `Math.random`, which always exists.
 *
 * So: `randomUUID` when there is one, and a `Math.random` fallback that is
 * still unique enough for React keys and localStorage ids.
 */
const newId = (): string => {
  const uuid = typeof crypto !== "undefined" ? crypto.randomUUID : undefined;
  if (typeof uuid === "function") return uuid.call(crypto);
  // Not a real UUID. Adequate for a client-side id, and the timestamp prefix
  // keeps ids sortable, which the random ones are not.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

function toAddedCourse(course: ParsedCourse, index: number): AddedCourse {
  return {
    id: newId(),
    code: course.CODE,
    title: course.TITLE,
    faculty: course.FACULTY,
    employeeId: course.ERP_ID,
    classId: course.CLASS_ID,
    venue: course.ROOM,
    slots: splitSlots(course.SLOT),
    credits: course.CREDITS,
    type: course.TYPE,
    color: COURSE_COLORS[index % COURSE_COLORS.length],
    batch: course.BATCH,
  };
}

/**
 * Every faculty who teaches `code` at exactly the set of slot tokens `slots`.
 *
 * The generator discovers these people once per full timetable — `groupVariants`
 * picks them out when a whole week shares one physical layout — but the
 * preview's Selected Courses table wants them per course: tap a teacher's name,
 * and hand the same time to someone else. Matching uses the sorted *split*
 * tokens, stricter than overlap on purpose: a same-time swap must not move a
 * single period, or the clash-free guarantee behind the preview quietly stops
 * holding.
 *
 * The current teacher is excluded by identity — employee id when the report
 * carries one, the name otherwise — the same rule `dedupeByFaculty` applies.
 * Duplicate report rows (same person, same tokens, same room) collapse into
 * one option; the employee id stays in that key so two people who share a
 * name both appear. Sorted by faculty, then room.
 */
/**
 * If an `AddedCourse` is an embedded course combining both theory and lab slots,
 * expand it into two virtual halves (theory and lab) so that alternatives for each
 * half can be matched and swapped independently.
 *
 * If a course is already a single component (pure theory or pure lab), it is returned
 * as-is.
 */
export function expandCourseHalves(halves: readonly AddedCourse[]): AddedCourse[] {
  const result: AddedCourse[] = [];
  for (const h of halves) {
    const rawSlots = h.slots ?? [];
    const theorySlots = rawSlots.filter(
      (s) => !s.trim().toUpperCase().startsWith("L") && s.trim().toUpperCase() !== "NIL"
    );
    const labSlots = rawSlots.filter((s) => s.trim().toUpperCase().startsWith("L"));

    if (theorySlots.length > 0 && labSlots.length > 0) {
      const facs = (h.faculty || "").split(/\s*\/\s*/);
      const venues = (h.venue || "").split(/\s*\/\s*/);

      const theoryHalf: AddedCourse = {
        ...h,
        id: `${h.id}:theory`,
        type: "Embedded Theory",
        slots: theorySlots,
        faculty: facs[0]?.trim() || h.faculty,
        venue: venues[0]?.trim() || h.venue,
        employeeId: h.employeeId,
      };

      const labHalf: AddedCourse = {
        ...h,
        id: `${h.id}:lab`,
        type: "Embedded Lab",
        slots: labSlots,
        faculty: (facs[1] || facs[0])?.trim() || h.faculty,
        venue: (venues[1] || venues[0])?.trim() || h.venue,
        employeeId: facs.length > 1 ? undefined : h.employeeId,
      };

      result.push(theoryHalf, labHalf);
    } else {
      result.push(h);
    }
  }
  return result;
}

export function sameSlotFacultyAlternatives(
  code: string,
  slots: readonly string[],
  current: { faculty: string; employeeId?: string },
  masterCourses: readonly ParsedCourse[]
): ParsedCourse[] {
  const normalizedCode = code.trim().toUpperCase();
  const baseCode = (normalizedCode.endsWith('L') || normalizedCode.endsWith('P'))
    ? normalizedCode.slice(0, -1)
    : normalizedCode;

  const codeMatches = (c: ParsedCourse): boolean => {
    const cCode = c.CODE.trim().toUpperCase();
    const cOrig = (c as any).ORIGINAL_CODE?.trim()?.toUpperCase();
    const cBase = (cCode.endsWith('L') || cCode.endsWith('P')) ? cCode.slice(0, -1) : cCode;
    return (
      cCode === normalizedCode ||
      cOrig === normalizedCode ||
      cBase === baseCode ||
      cBase === normalizedCode
    );
  };

  const wantTokens = [...slots]
    .map((s) => s.trim().toUpperCase())
    .filter((s) => Boolean(s) && s !== "NIL");
  if (wantTokens.length === 0) return [];

  const wantExact = [...wantTokens].sort().join("+");
  const wantTheoryTokens = wantTokens.filter((s) => !s.startsWith("L")).sort().join("+");
  const wantLabTokens = wantTokens.filter((s) => s.startsWith("L")).sort().join("+");

  const hasTheory = wantTheoryTokens.length > 0;
  const hasLab = wantLabTokens.length > 0;
  const isPureTheory = hasTheory && !hasLab;
  const isPureLab = hasLab && !hasTheory;

  const currentFacultyNorm = (current.faculty || "").trim().toLowerCase();
  const currentFacultyHalfNorm = isPureTheory
    ? currentFacultyNorm.split(/\s*\/\s*/)[0].trim()
    : isPureLab
    ? (currentFacultyNorm.split(/\s*\/\s*/)[1] || currentFacultyNorm.split(/\s*\/\s*/)[0]).trim()
    : currentFacultyNorm;

  const dedupeKey = (c: ParsedCourse): string =>
    `${c.FACULTY.trim().toLowerCase()}|${splitSlots(c.SLOT).sort().join("+")}|${(c.ROOM ?? "").trim().toLowerCase()}|${c.ERP_ID ?? ""}`;

  const seen = new Set<string>();
  const results: ParsedCourse[] = [];

  for (const c of masterCourses) {
    if (!codeMatches(c)) continue;

    const cTokens = splitSlots(c.SLOT).map((s) => s.trim().toUpperCase()).filter((s) => Boolean(s) && s !== "NIL");
    const cExact = [...cTokens].sort().join("+");
    const cTheory = cTokens.filter((s) => !s.startsWith("L")).sort().join("+");
    const cLab = cTokens.filter((s) => s.startsWith("L")).sort().join("+");

    let isMatch = false;
    let effectiveOffering: ParsedCourse;

    if (isPureTheory && cTheory && cTheory === wantTheoryTokens) {
      isMatch = true;
      const facParts = (c.FACULTY || "").split(/\s*\/\s*/);
      const roomParts = (c.ROOM || "").split(/\s*\/\s*/);
      const typeParts = (c.TYPE || "").split(/\s*\+\s*/);
      effectiveOffering = {
        ...c,
        FACULTY: facParts[0]?.trim() || c.FACULTY,
        ROOM: roomParts[0]?.trim() || c.ROOM,
        SLOT: wantTheoryTokens,
        TYPE: typeParts[0]?.trim() || "ETH",
        ERP_ID: c.ERP_ID,
      };
    } else if (isPureLab && cLab && cLab === wantLabTokens) {
      isMatch = true;
      const facParts = (c.FACULTY || "").split(/\s*\/\s*/);
      const roomParts = (c.ROOM || "").split(/\s*\/\s*/);
      const typeParts = (c.TYPE || "").split(/\s*\+\s*/);
      effectiveOffering = {
        ...c,
        FACULTY: (facParts[1] || facParts[0])?.trim() || c.FACULTY,
        ROOM: (roomParts[1] || roomParts[0])?.trim() || c.ROOM,
        SLOT: wantLabTokens,
        TYPE: typeParts[1]?.trim() || "ELA",
        ERP_ID: facParts.length > 1 ? undefined : c.ERP_ID,
      };
    } else if (hasTheory && hasLab && cTheory === wantTheoryTokens && cLab === wantLabTokens) {
      // Both theory and lab slot together: require same faculty for both theory and lab
      const facParts = (c.FACULTY || "").split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
      const isSameFac =
        facParts.length <= 1 ||
        (facParts.length === 2 && facParts[0].toLowerCase() === facParts[1].toLowerCase());
      if (!isSameFac) continue;

      isMatch = true;
      effectiveOffering = {
        ...c,
        FACULTY: facParts[0] || c.FACULTY,
      };
    } else if (cExact === wantExact) {
      isMatch = true;
      effectiveOffering = { ...c };
    }

    if (!isMatch) continue;

    const altFacultyNorm = effectiveOffering!.FACULTY.trim().toLowerCase();

    // Check identity against current teacher
    const isSameFaculty =
      current.employeeId && effectiveOffering!.ERP_ID
        ? current.employeeId === effectiveOffering!.ERP_ID
        : currentFacultyHalfNorm === altFacultyNorm || currentFacultyNorm === altFacultyNorm;

    if (isSameFaculty) continue;

    const key = dedupeKey(effectiveOffering!);
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(effectiveOffering!);
  }

  return results.sort(
    (a, b) =>
      a.FACULTY.localeCompare(b.FACULTY) ||
      String(a.ROOM ?? "").localeCompare(String(b.ROOM ?? ""))
  );
}

/**
 * Return all distinct offerings for a subject code from the report,
 * preserving embedded theory+lab pairings.
 */
export function allCourseOfferings(
  code: string,
  masterCourses: readonly ParsedCourse[]
): ParsedCourse[] {
  const normalizedCode = code.trim().toUpperCase();
  const baseCode = (normalizedCode.endsWith('L') || normalizedCode.endsWith('P'))
    ? normalizedCode.slice(0, -1)
    : normalizedCode;

  const codeMatches = (c: ParsedCourse): boolean => {
    const cCode = c.CODE.trim().toUpperCase();
    const cOrig = (c as any).ORIGINAL_CODE?.trim()?.toUpperCase();
    const cBase = (cCode.endsWith('L') || cCode.endsWith('P')) ? cCode.slice(0, -1) : cCode;
    return (
      cCode === normalizedCode ||
      cOrig === normalizedCode ||
      cBase === baseCode ||
      cBase === normalizedCode
    );
  };

  const dedupeKey = (c: ParsedCourse): string =>
    `${c.FACULTY.trim().toLowerCase()}|${splitSlots(c.SLOT).sort().join("+")}|${(c.ROOM ?? "").trim().toLowerCase()}|${c.ERP_ID ?? ""}`;

  const seen = new Set<string>();
  const results: ParsedCourse[] = [];

  for (const c of masterCourses) {
    if (!codeMatches(c)) continue;
    const key = dedupeKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(c);
  }

  // Check if course has combined offerings (embedded theory + lab)
  const hasCombined = results.some((c) => {
    const tokens = splitSlots(c.SLOT);
    return (
      tokens.some((s) => !s.startsWith("L") && s !== "NIL") &&
      tokens.some((s) => s.startsWith("L"))
    );
  });

  let filtered = results;
  if (hasCombined) {
    // If embedded grouping exists, eliminate individual half-slots of faculties
    filtered = results.filter((c) => {
      const tokens = splitSlots(c.SLOT);
      const isComb =
        tokens.some((s) => !s.startsWith("L") && s !== "NIL") &&
        tokens.some((s) => s.startsWith("L"));
      if (isComb) return true;

      const facNorm = c.FACULTY.trim().toLowerCase();
      const isSubset = results.some((other) => {
        if (other === c) return false;
        const otherTokens = splitSlots(other.SLOT);
        const otherIsComb =
          otherTokens.some((s) => !s.startsWith("L") && s !== "NIL") &&
          otherTokens.some((s) => s.startsWith("L"));
        if (!otherIsComb) return false;
        const otherFacNorm = other.FACULTY.trim().toLowerCase();
        const facMatches = otherFacNorm.includes(facNorm) || facNorm.includes(otherFacNorm);
        return facMatches && tokens.every((s) => otherTokens.includes(s));
      });

      return !isSubset;
    });

    const combinedOnly = filtered.filter((c) => {
      const tokens = splitSlots(c.SLOT);
      return (
        tokens.some((s) => !s.startsWith("L") && s !== "NIL") &&
        tokens.some((s) => s.startsWith("L"))
      );
    });

    if (combinedOnly.length > 0) {
      filtered = combinedOnly;
    }
  }

  return filtered.sort(
    (a, b) =>
      a.FACULTY.localeCompare(b.FACULTY) ||
      splitSlots(a.SLOT).sort().join("+").localeCompare(splitSlots(b.SLOT).sort().join("+"))
  );
}

/**
 * The best percentage this timetable scores against any of the named friends.
 *
 * Taking the best per friend rather than the sum is the same rule the UI used: a
 * timetable is only as social as its closest match, and one friend with a
 * clashing schedule should not drag the score down for everyone else.
 */
function socialScoreAgainst(
  courses: readonly AddedCourse[],
  friends: readonly Friend[],
  schema: CampusSchema
): { socialScore: number; bestFriendMatches: string[] } {
  if (!friends.length) return { socialScore: 0, bestFriendMatches: [] };

  let total = 0;
  let bestOverall = -1;
  let closest: string[] = [];

  for (const friend of friends) {
    if (!friend.timetables?.length) continue;
    let best = 0;
    for (const tt of friend.timetables) {
      const { percentage } = pairwiseSocialScore(courses, tt.courses, schema);
      if (percentage > best) best = percentage;
    }
    total += best;
    if (best > bestOverall) {
      bestOverall = best;
      closest = [friend.name];
    } else if (best === bestOverall) {
      closest.push(friend.name);
    }
  }

  return {
    socialScore: friends.length ? Math.round(total / friends.length) : 0,
    bestFriendMatches: closest,
  };
}

/**
 * Keep the first option that pairs each course with a faculty member no other
 * kept option used, and drop the rest.
 *
 * Greedy and order-dependent, which is inherent: it is a dedupe, not a search.
 */
function dedupeByFaculty(timetables: TimetableState[]): TimetableState[] {
  // An employee id separates two people who share a name; a name alone still
  // separates people when the report has no id, which is every row of the
  // previous semester's report.
  const facultyIdentity = (course: AddedCourse): string =>
    course.employeeId ? `erp:${course.employeeId}` : course.faculty;

  const used = new Map<string, Set<string>>();
  return timetables.filter((tt) => {
    let unique = true;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen?.has(facultyIdentity(c))) {
        unique = false;
        break;
      }
    }
    if (!unique) return false;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen) seen.add(facultyIdentity(c));
      else used.set(c.code, new Set([facultyIdentity(c)]));
    }
    return true;
  });
}

/**
 * Collapse timetables that occupy the same physical slots into one option with
 * variants.
 *
 * Two timetables with the same slot layout are the same *week* to a student —
 * the difference is which section of the same slot they sit in, which is
 * exactly what a variant is. Grouping by the sorted slot multiset rather than by
 * course code is what makes this work.
 */
function groupVariants(timetables: TimetableState[]): TimetableState[] {
  const grouped = new Map<string, TimetableState>();

  for (const tt of timetables) {
    const signature = tt.courses
      .flatMap((c) => c.slots)
      .slice()
      .sort()
      .join("|");

    const existing = grouped.get(signature);
    if (existing) {
      existing.variants!.push({ ...tt, name: `Variant ${existing.variants!.length + 1}` });
    } else {
      grouped.set(signature, { ...tt, variants: [{ ...tt, name: "Variant 1" }] });
    }
  }

  return Array.from(grouped.values()).map((t, i) => ({ ...t, name: `Option ${i + 1}` }));
}

/* ── entry point ────────────────────────────────────────────────────────── */

function preferredTheoryScore(
  courses: AddedCourse[],
  schema: CampusSchema,
  preference: "morning" | "evening"
): number | null {
  const theoryPeriods = courses.flatMap((course) =>
    course.slots.flatMap((slot) =>
      periodsForSlot(schema, slot).filter((period) => period.type === "theory")
    )
  );
  if (!theoryPeriods.length) return null;
  const preferredCount = theoryPeriods.filter((period) =>
    preference === "morning"
      ? period.startMin < MORNING_BEFORE_MIN
      : period.startMin >= MORNING_BEFORE_MIN
  ).length;
  return (preferredCount / theoryPeriods.length) * 100;
}

/**
 * Score one combination. Split out because both the streaming path and the
 * progress reporting need to describe it, and because the half-days test is
 * the one filter that runs *after* the search rather than during it.
 */
function scoreCombination(
  params: GenerateParams,
  combination: ParsedCourse[],
  scoredFriends: readonly Friend[]
): TimetableState {
  const courses = combination.map(toAddedCourse);
  const base = timetableMetrics(courses, params.schema);
  const social = socialScoreAgainst(courses, scoredFriends, params.schema);
  const facultySummary = params.facultyRatingsAvailable && params.facultyRatings
    ? facultyRankingSummary(
        courses,
        params.facultyRatings,
        params.facultyMetricWeights ?? DEFAULT_FACULTY_METRIC_WEIGHTS
      )
    : undefined;
  const timetable: TimetableState = {
    id: newId(),
    name: "Generated Option",
    courses,
    metrics: { ...base, ...social },
    ...(facultySummary ? { facultySummary } : {}),
  };

  const hasProfile = Boolean(params.rankingMode);
  const hasFacultyData = (facultySummary?.ratedFacultyCount ?? 0) > 0;
  const hasSoftTheoryPreference =
    params.strictTheoryPreference === false &&
    (params.preference === "morning" || params.preference === "evening");
  const hasTimePreference =
    params.preference !== "none" ||
    Boolean(params.minStartTime || params.maxEndTime || Object.keys(params.maxEndTimeByDay ?? {}).length);

  // One read of the week's ranking inputs, shared by whichever ranking path runs.
  let cachedRankingInputs: RankingInputs | null = null;
  const getRankingInputs = (): RankingInputs =>
    (cachedRankingInputs ??= rankingInputs(courses, params.schema));

  // Preference fit, 0–100. Shared by both paths so the "time" factor and the
  // legacy `time` component measure the same thing.
  const timeScoreFrom = (timeInputs: RankingInputs | null): number | null => {
    if (!timeInputs) return null;
    const bounded = (value: number) => Math.max(0, Math.min(1, value));
    const earlyStart = 1 - bounded((timeInputs.averageDayStartMinutes - 8 * 60) / (6 * 60));
    const lateFinish = bounded((timeInputs.averageDayEndMinutes - 12 * 60) / (7 * 60));
    switch (params.preference) {
      case "morning":
        return hasSoftTheoryPreference
          ? preferredTheoryScore(courses, params.schema, "morning")
          : earlyStart * 100;
      case "evening":
        return hasSoftTheoryPreference
          ? preferredTheoryScore(courses, params.schema, "evening")
          : lateFinish * 100;
      case "compact":
        return timeInputs.activeDays
          ? (timeInputs.compactDays / timeInputs.activeDays) * 100
          : 0;
      case "spread":
        return (timeInputs.activeDays / 6) * 100;
      default:
        return ((earlyStart + (1 - lateFinish)) / 2) * 100;
    }
  };

  if (params.rankingFactors) {
    const inputs = getRankingInputs();
    const scores = rankingFactorScores({
      inputs,
      halfDays: timetable.metrics.halfDays,
      socialScore: timetable.metrics.socialScore,
      facultyQuality: facultySummary?.facultyScore ?? null,
      // No preference set → nothing to fit, so the factor is absent rather
      // than a made-up "balance" score (same rule the legacy path uses).
      timeScore: hasTimePreference ? timeScoreFrom(inputs) : null,
    });
    const off = new Set(params.rankingFactors.disabled ?? []);
    const active = params.rankingFactors.order.filter((factor) => !off.has(factor));
    const composite = combineFactorScores(scores, active);
    timetable.rankingScore = composite.score;
    timetable.rankingBreakdown = composite.breakdown;
  } else if (hasProfile || hasFacultyData || hasSoftTheoryPreference) {
    const ranked: RankingScore | null = params.rankingMode
      ? rankCourses(
          courses,
          params.schema,
          params.rankingMode,
          facultySummary?.facultyScore == null ? null : facultySummary.facultyScore / 100
        )
      : null;
    const metrics = timetable.metrics;
    const timeScore = timeScoreFrom(hasTimePreference ? getRankingInputs() : null);
    const sortScore = (() => {
      if (!metrics) return 0;
      switch (params.sortBy) {
        case "social":
          return Math.max(0, Math.min(100, metrics.socialScore));
        case "halfdays":
          return Math.max(0, Math.min(100, (metrics.halfDays / 12) * 100));
        case "compactness":
          return Math.max(0, Math.min(100, 100 - (metrics.gaps / 1200) * 100));
        case "faculty":
          return facultySummary?.facultyScore ?? 0;
        case "balanced":
        default:
          return Math.max(0, Math.min(100, balancedScore(metrics) / 3.2));
      }
    })();
    const components = {
      profile:
        ranked?.score ??
        (params.rankingMode === "Best Faculty" ? facultySummary?.facultyScore ?? null : null),
      faculty: facultySummary?.facultyScore ?? null,
      sort: sortScore,
      time: timeScore,
    };
    const composite = combineRankingScores(
      components,
      params.rankingPriorityOrder ?? ["profile", "faculty", "sort", "time"]
    );
    timetable.rankingScore = composite.score;
    timetable.rankingBreakdown = composite.breakdown;
    timetable.rankingComponents = components;
  }

  return timetable;
}

/**
 * Generate conflict-free timetables for a set of locked courses, optionally
 * reporting them as they are found.
 *
 * Pure: the same params always give the same result, and nothing here reads or
 * writes anything outside its arguments. That is what lets it run in a worker,
 * and what lets a test pin the output.
 *
 * ## Order of operations, and why it must not change
 *
 * The pipeline is filter options → backtrack → score → result filters → sort
 * → dedupe faculty → group variants. That order is the product's behaviour:
 * an earlier stage's contract is only meaningful relative to the ones around
 * it. Adding hooks does not reorder it — hooks only observe. What changed is
 * where the three monotone result filters run: when the run asks for separate
 * lab days, no consecutive labs, or a half-days floor, the backtrack declines
 * a partial week the moment it breaks one — the same rules, mid-search, as
 * bitmasks — so `found` and `limit` count weeks that could pass rather than
 * weeks that merely do not collide. The visit-time checks still run
 * unchanged: they are still the whole of each rule for a run without the
 * option, and the belt under the pruning's braces should a mask ever
 * disagree with the rule it mirrors. The batches a streaming caller sees are
 * the scored-and-filtered list mid-flight; the `GenerateResult` that ends the
 * run is the settled one.
 *
 * ## What `hooks` does not affect
 *
 * With no hooks the walk is byte-for-byte the walk `backtrack` used to do:
 * same visit order, same `limit`, same early exit. `generateTimetables` is this
 * function called with `{}`, which is the whole reason the two entry points
 * cannot drift apart.
 */
export function generateTimetablesStream(
  params: GenerateParams,
  hooks: GenerateStreamHooks = {}
): GenerateResult {
  const { schema } = params;

  if (!params.courseLocks.length) {
    return { kind: "error", code: "no_courses_selected" };
  }

  const byCode = new Map<string, ParsedCourse[]>();
  for (const course of params.masterCourses) {
    const bucket = byCode.get(course.CODE);
    if (bucket) bucket.push(course);
    else byCode.set(course.CODE, [course]);
  }

  const optionsPerCourse: ParsedCourse[][] = [];
  const windowsPerCourse: SlotPeriod[][][] = [];
  /** Each offering's actual lab periods, reused by both optional lab rules. */
  const labPeriodsByOffering = new Map<ParsedCourse, SlotPeriod[]>();
  const consecutiveLabPairs = consecutiveLabPeriodPairs(
    schema,
    params.lunchBreakSeparatesLabs ?? false
  );

  for (const lock of params.courseLocks) {
    const options = optionsFor(schema, params, lock, byCode.get(lock.code) ?? []);
    if (!options.length) {
      return { kind: "error", code: "no_valid_slots", subjectCode: lock.code };
    }
    optionsPerCourse.push(options);

    // The periods each offering occupies, resolved once here rather than at
    // every backtrack node — the whole point of precomputing. One entry per
    // *offering*, so the walk can test the one it is about to take rather than
    // the union of every alternative the course happens to offer.
    windowsPerCourse.push(
      options.map((opt) => {
        const periods: SlotPeriod[] = [];
        const labPeriods: SlotPeriod[] = [];
        for (const slot of splitSlots(opt.SLOT)) {
          for (const period of periodsForSlot(schema, slot)) {
            periods.push(period);
            if (period.type === "lab") labPeriods.push(period);
          }
        }
        labPeriodsByOffering.set(opt, labPeriods);
        return periods;
      })
    );
  }

  // The monotone rules, as bit facts, computed once — from here the walk
  // prunes on them instead of meeting them again at every leaf.
  const walkRules = buildWalkRules(
    params,
    schema,
    optionsPerCourse,
    labPeriodsByOffering,
    consecutiveLabPairs
  );

  const limit = params.noLimit
    ? params.removeHardResultLimit
      ? Number.POSITIVE_INFINITY
      : HARD_RESULT_LIMIT
    : params.resultCap ?? DEFAULT_RESULT_LIMIT;
  const batchSize = hooks.batchSize && hooks.batchSize > 0 ? hooks.batchSize : DEFAULT_BATCH_SIZE;

  const scoredFriends = params.maximizeFreeTimeFriends.length
    ? params.friends.filter((f) => params.maximizeFreeTimeFriends.includes(f.id))
    : [];

  const accepted: TimetableState[] = [];
  // Whether the lab rules and the half-days floor rejected a week — a
  // complete one at `visit`, or a partial one the walk declined because it
  // could never become legal. Only read when the run ends with nothing
  // accepted, to report which result filter ate the search.
  let labDayRejected = false;
  let consecutiveLabsRejected = false;
  let facultyScoreRejected = false;
  let halfDaysRejected = false;
  let emitted = 0;
  const flush = () => {
    if (accepted.length <= emitted) return;
    const batch = accepted.slice(emitted);
    emitted = accepted.length;
    hooks.onBatch?.(batch);
  };

  const walk = walkCombinations(optionsPerCourse, windowsPerCourse, limit, {
    visit: (combination) => {
      // The post-search form of the lab-day rule. With in-tree pruning on,
      // the walk has already guaranteed this week is legal, so this is a
      // no-op; without pruning it is the rule itself, exactly as it always
      // was. Either way it stays: it costs nothing at the limits a run
      // actually reaches, and it keeps a pruning bug from either shipping a
      // week the student asked to exclude or wording the failure
      // `no_conflict_free`.
      if (params.separateLabDays && labsShareADay(combination, labPeriodsByOffering)) {
        labDayRejected = true;
        return;
      }
      if (
        params.avoidConsecutiveLabs &&
        labsAreConsecutive(
          combination,
          labPeriodsByOffering,
          consecutiveLabPairs
        )
      ) {
        consecutiveLabsRejected = true;
        return;
      }
      const timetable = scoreCombination(params, combination, scoredFriends);
      const facultyFilters = params.facultyScoreFilters ?? DEFAULT_FACULTY_SCORE_FILTERS;
      const hasActiveFacultyFilter = Object.values(facultyFilters).some((minimum) => minimum > 0);
      if (
        hasActiveFacultyFilter &&
        params.facultyRatingsAvailable &&
        params.facultyRatings &&
        Object.keys(params.facultyRatings).length > 0 &&
        timetable.facultySummary &&
        !passesFacultyScoreFilters(timetable.facultySummary, facultyFilters)
      ) {
        facultyScoreRejected = true;
        return;
      }
      // The half-days floor, as a result filter. When the walk pruned on the
      // floor too, this is the exact re-check of its optimistic bound — a
      // backstop rather than the primary decision — and when no floor was
      // active in-tree it is the whole of the rule, exactly as it always
      // was. Either way the check runs *after* scoring, because the number
      // it compares is the metrics' own half-days count.
      if ((timetable.metrics?.halfDays ?? 0) < params.minHalfDays) {
        halfDaysRejected = true;
        return;
      }
      accepted.push(timetable);
      if (accepted.length - emitted >= batchSize) flush();
    },
    tick: (nodes, found) => {
      hooks.onProgress?.({ nodes, found, accepted: accepted.length });
      return hooks.shouldStop ? hooks.shouldStop() : false;
    },
  }, walkRules);

  // A partial the walk declined is one the old walk would have enumerated
  // and then rejected at `visit`, so it raises the same flags: where the rule
  // ran is invisible in the failure a student sees.
  if (walk.labDayPruned) labDayRejected = true;
  if (walk.consecutivePruned) consecutiveLabsRejected = true;
  if (walk.halfDaysPruned) halfDaysRejected = true;

  // Whatever the last partial batch was, plus everything a cancelled run had
  // not reached a batch boundary for. A UI that is watching must not be left
  // holding a subset because the arithmetic of the flush did not divide.
  flush();

  if (walk.cancelled) {
    return { kind: "cancelled", timetables: accepted };
  }

  // Deliberately in the original order: `found` is "the search never produced
  // a week that could have been shown at all", which is a different failure
  // from "it produced weeks, none of which met the floor", and a student can
  // act on the distinction. In-tree pruning blurs one edge of it — a tree
  // with no legal leaf may have been cut before its first leaf, and then the
  // rule that cut it is named rather than `no_conflict_free` — the same trade
  // the rule-aimed `limit` makes: the answer names the constraint that
  // actually shaped it.
  if (
    !walk.found &&
    !labDayRejected &&
    !consecutiveLabsRejected &&
    !halfDaysRejected
  ) {
    return { kind: "error", code: "no_conflict_free" };
  }
  if (!accepted.length) {
    // When both result filters contributed rejections, the lab rule wins the
    // wording: it is the newer and more specific constraint, and the
    // half-days floor was already in effect while the search ran.
    if (labDayRejected) {
      return { kind: "error", code: "no_separate_labs" };
    }
    if (consecutiveLabsRejected) {
      return { kind: "error", code: "no_consecutive_labs" };
    }
    if (facultyScoreRejected && !halfDaysRejected) {
      return { kind: "error", code: "below_min_faculty_scores" };
    }
    return { kind: "error", code: "below_min_half_days" };
  }

  let timetables = sortTimetables(accepted, params.sortBy);

  if (
    params.rankingMode ||
    timetables.some((timetable) => (timetable.facultySummary?.ratedFacultyCount ?? 0) > 0) ||
    (params.strictTheoryPreference === false &&
      (params.preference === "morning" || params.preference === "evening"))
  ) {
    timetables = [...timetables].sort(
      (a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1)
    );
  }

  if (params.uniqueFaculties) {
    timetables = dedupeByFaculty(timetables);
  }

  return {
    kind: "ok",
    timetables: groupVariants(timetables),
    capped: Number.isFinite(limit) && walk.found >= limit,
  };
}

/**
 * Generate conflict-free timetables for a set of locked courses.
 *
 * The one-shot form of `generateTimetablesStream`: no hooks, no streaming, no
 * cancellation. It exists because that is the shape every existing caller and
 * every existing test wants, and because a solve that must not be watched
 * should not pay for the ability to be.
 */
export function generateTimetables(params: GenerateParams): GenerateResult {
  return generateTimetablesStream(params);
}
