/**
 * Weighted ranking profiles — an *additional* way to order generated options.
 *
 * ## Why this sits next to `timetableMetrics` instead of inside it
 *
 * `timetableMetrics` measures a week: how many half-days are free, how many
 * minutes are dead, which blocks get dashed between. Those are facts, and
 * `sortTimetables` has a fixed opinion about them that this app has shipped with
 * for a long time.
 *
 * This module has a *preference*: "Half Days" says a free morning is worth
 * three times what a short gap is worth, "Late Start" says the opposite. Those
 * weights are choices, not measurements, and they are the reason this is a
 * separate file with its own score rather than a fifth `SortBy`. Turning a
 * preference into a metric field would make it look measured.
 *
 * ## `compactDays` is not `metrics.halfDays`
 *
 * The two are named almost identically and mean opposite things, which is
 * precisely the kind of collision this project has been bitten by before (the
 * `gaps` field that meant minutes in one copy and hours in another).
 *
 * - `metrics.halfDays` — how many of the week's ten half-days are **free**.
 *   Bigger is more free time. Range 0–10.
 * - `compactDays` here — how many of the **class** days fit inside a four-hour
 *   window. Bigger is a tighter week. Range 0–`activeDays`.
 *
 * Any caller mixing them up will rank backwards, so they are named differently
 * everywhere and never read from each other.
 *
 * ## Faculty reviews
 *
 * Vitfac scores are optional worker inputs. The Best Faculty profile can use
 * their coverage-adjusted aggregate, while the generator's composite rank also
 * combines faculty, sort, and time scores according to the user's priority.
 * With no catalog data, the faculty factor is omitted rather than treated as
 * zero.
 *
 * Everything here is **opt-in**. Nothing calls it unless a caller passes a
 * `rankingMode`, and with no mode the planner ranks exactly as it always has.
 */

import { DAYS_OF_WEEK, type CampusSchema } from "./slots";
import { dayOccupancy, type MetricCourse } from "./timetableMetrics";

/** Ranking profiles, from faculty-focused to schedule-focused. */
export const RANKING_MODES = [
  "Best Faculty",
  "Balanced",
  "Half Days",
  "Minimize Gaps",
  "Early Finish",
  "Late Start",
] as const;

export type RankingMode = (typeof RANKING_MODES)[number];

export const DEFAULT_RANKING_MODE: RankingMode = "Balanced";

/**
 * Accepts any string so a persisted or hand-edited value cannot crash a
 * settings sheet. Anything unknown reads as the default rather than throwing.
 */
export function asRankingMode(value: unknown): RankingMode | null {
  return (RANKING_MODES as readonly string[]).includes(String(value))
    ? (value as RankingMode)
    : null;
}

/** What each profile cares about, as multipliers on a 0–1 factor. */
interface Weights {
  compactDays: number;
  lowGaps: number;
  earlyFinish: number;
  lateStart: number;
  balancedLoad: number;
  facultyQuality?: number;
}

const PROFILES: Record<RankingMode, Weights> = {
  "Best Faculty": { compactDays: 2, lowGaps: 2, earlyFinish: 1, lateStart: 1, balancedLoad: 1, facultyQuality: 45 },
  Balanced: { compactDays: 10, lowGaps: 14, earlyFinish: 10, lateStart: 8, balancedLoad: 8 },
  "Half Days": { compactDays: 30, lowGaps: 10, earlyFinish: 8, lateStart: 4, balancedLoad: 3 },
  "Minimize Gaps": { compactDays: 6, lowGaps: 32, earlyFinish: 6, lateStart: 3, balancedLoad: 8 },
  "Early Finish": { compactDays: 8, lowGaps: 10, earlyFinish: 30, lateStart: 2, balancedLoad: 4 },
  "Late Start": { compactDays: 8, lowGaps: 8, earlyFinish: 4, lateStart: 30, balancedLoad: 4 },
};

/**
 * The profile a mode names. Unknown → Balanced, which is also what a settings
 * screen shows before the student has chosen anything.
 */
export function profileFor(mode: RankingMode | null | undefined): Weights {
  return PROFILES[mode ?? DEFAULT_RANKING_MODE] ?? PROFILES[DEFAULT_RANKING_MODE];
}

/* ── inputs ────────────────────────────────────────────────────────────── */

/**
 * Everything a ranking factor reads.
 *
 * Derived rather than stored: these are not part of `TimetableMetrics` because
 * they are only wanted when somebody has picked a ranking mode, and the walk
 * that produces them is a second pass over the same week. Paying for it on
 * every generated timetable would tax the default path to serve an option it
 * does not take.
 */
export interface RankingInputs {
  /** Days of `DAYS_OF_WEEK` with at least one class. */
  activeDays: number;
  /** Class days whose span is four hours or less. **Not** free half-days. */
  compactDays: number;
  /** Weighted count of gaps long enough to be empty periods. */
  totalGapSlots: number;
  /** Average first class start across class days, in minutes. */
  averageDayStartMinutes: number;
  /** Average last class end across class days, in minutes. */
  averageDayEndMinutes: number;
  /** Variance of classes-per-day across class days. */
  dailyLoadVariance: number;
  /** Faculty review quality on a 0–1 scale, already penalized for unrated staff. */
  facultyQuality?: number | null;
}

/** Four hours — the longest day still counted as a half day. */
const COMPACT_DAY_MAX_MIN = 4 * 60;
/** A gap this short is a changeover, not an empty period. */
const GAP_NOT_COUNTED_MIN = 20;
/** One period is 55 minutes, so a gap is worth roughly that many periods. */
const PERIOD_MIN = 55;

function variance(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

/**
 * Read a week's ranking inputs.
 *
 * Uses `dayOccupancy` — the one place in the app that walks a day — so the
 * periods counted here are the same periods every other feature reports, law
 * spellings included.
 */
export function rankingInputs(
  courses: readonly MetricCourse[],
  schema: CampusSchema
): RankingInputs {
  let compactDays = 0;
  let startSum = 0;
  let endSum = 0;
  const classCounts: number[] = [];
  const gapSlots: number[] = [];

  for (const day of DAYS_OF_WEEK) {
    const { classes } = dayOccupancy(courses, schema, day);
    if (!classes.length) continue;

    classCounts.push(classes.length);
    const first = classes[0];
    const last = classes[classes.length - 1];
    startSum += first.startMin;
    endSum += last.endMin;
    if (last.endMin - first.startMin <= COMPACT_DAY_MAX_MIN) compactDays++;

    for (let i = 1; i < classes.length; i++) {
      const gap = classes[i].startMin - classes[i - 1].endMin;
      if (gap <= GAP_NOT_COUNTED_MIN) continue;
      gapSlots.push(Math.max(1, Math.round(gap / PERIOD_MIN)));
    }
  }

  const activeDays = classCounts.length;
  return {
    activeDays,
    compactDays,
    totalGapSlots: gapSlots.reduce((sum, n) => sum + n, 0),
    averageDayStartMinutes: activeDays ? startSum / activeDays : 0,
    averageDayEndMinutes: activeDays ? endSum / activeDays : 0,
    dailyLoadVariance: variance(classCounts),
  };
}

/* ── scoring ───────────────────────────────────────────────────────────── */

const normalize = (value: number, max: number): number => {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
};

const inverted = (value: number, max: number): number => 1 - normalize(value, max);

/** The score, plus where the points came from — both out of 100. */
export interface RankingScore {
  score: number;
  /**
   * Points contributed by each factor, rounded to one decimal.
   *
   * Shown to students rather than kept private because "why is this Option 1?"
   * is otherwise unanswerable, and a ranking a student cannot audit is a
   * ranking they will not trust.
   */
  breakdown: Record<string, number>;
}

/**
 * Score a week 0–100: each factor is a 0–1 value, weighted by the profile and
 * divided by the weight in play, so 100 means "best possible on everything this
 * profile cares about".
 *
 * Start/finish are **averages across class days**, not the single earliest start
 * or latest end of the week. One 8am class on Monday would otherwise give every
 * week the same Late Start value and the profile would rank nothing.
 */
export function scoreRanking(inputs: RankingInputs, mode: RankingMode): RankingScore {
  const weights = profileFor(mode);
  const perDay = inputs.activeDays > 0 ? inputs.totalGapSlots / inputs.activeDays : 0;

  const factors: Record<string, [value: number, weight: number]> = {
    // Share of class days that fit inside a four-hour window.
    compactDays: [inputs.activeDays > 0 ? inputs.compactDays / inputs.activeDays : 0, weights.compactDays],
    // Empty periods per class day; 6+ a day is the worst case. A flat cap on the
    // weekly total would zero this out for almost every real week.
    lowGaps: [inverted(perDay, 6), weights.lowGaps],
    // Average day ending by 12:00 scores 1, by 19:00 scores 0.
    earlyFinish: [inverted(inputs.averageDayEndMinutes - 12 * 60, 7 * 60), weights.earlyFinish],
    // Average day starting at 8:00 scores 0, at 14:00 scores 1.
    lateStart: [normalize(inputs.averageDayStartMinutes - 8 * 60, 6 * 60), weights.lateStart],
    balancedLoad: [inverted(inputs.dailyLoadVariance, 4), weights.balancedLoad],
  };
  if (inputs.facultyQuality !== null && inputs.facultyQuality !== undefined && weights.facultyQuality) {
    factors.facultyQuality = [normalize(inputs.facultyQuality, 1), weights.facultyQuality];
  }

  const totalWeight = Object.values(factors).reduce((sum, [, weight]) => sum + weight, 0);
  const breakdown: Record<string, number> = {};
  let raw = 0;

  for (const [key, [value, weight]] of Object.entries(factors)) {
    const points = totalWeight > 0 ? (100 * value * weight) / totalWeight : 0;
    const rounded = Number(points.toFixed(1));
    breakdown[key] = rounded;
    raw += rounded;
  }

  return { score: Number(Math.max(0, Math.min(100, raw)).toFixed(1)), breakdown };
}

/** One call: read the week, then score it under a profile. */
export function rankCourses(
  courses: readonly MetricCourse[],
  schema: CampusSchema,
  mode: RankingMode,
  facultyQuality?: number | null
): RankingScore {
  return scoreRanking({ ...rankingInputs(courses, schema), facultyQuality }, mode);
}

export type RankingPriority = "profile" | "faculty" | "sort" | "time";

export interface CompositeRankingComponents {
  profile?: number | null;
  faculty?: number | null;
  sort?: number | null;
  time?: number | null;
}

export interface CompositeRankingResult {
  score: number;
  breakdown: Record<string, number>;
}

/** Combines the selected ranking profile and live preferences into one score. */
export function combineRankingScores(
  components: CompositeRankingComponents,
  priorityOrder: readonly RankingPriority[]
): CompositeRankingResult {
  const order: RankingPriority[] = ["profile", "faculty", "sort", "time"];
  const unique = priorityOrder.filter((key, index) => order.includes(key) && priorityOrder.indexOf(key) === index);
  const priorities = [...unique, ...order.filter((key) => !unique.includes(key))];
  const breakdown: Record<string, number> = {};
  let totalWeight = 0;

  priorities.forEach((key, index) => {
    const value = components[key];
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    const weight = priorities.length - index;
    totalWeight += weight;
  });
  if (!totalWeight) return { score: 0, breakdown };

  let score = 0;
  priorities.forEach((key, index) => {
    const value = components[key];
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    const weight = priorities.length - index;
    const points = (Math.max(0, Math.min(100, value)) * weight) / totalWeight;
    breakdown[key] = Number(points.toFixed(1));
    score += points;
  });

  return {
    score: Number(score.toFixed(1)),
    breakdown,
  };
}
