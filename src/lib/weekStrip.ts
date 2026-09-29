/**
 * The home page's week strip.
 *
 * Seven circles, one per day, each carrying three facts: which day it is, what
 * the date is, and what kind of day it is. The first two are text. The third
 * used to be a pill that spelled it out — `Exam`, `Off`, `MON`, `3 cls`, `Free`
 * — and that is the reason this module exists.
 *
 * ## Why a tint and not a word
 *
 * The word was competing with the date for the same ~10px band of a cell that is
 * barely 46px wide, and it lost: at eight-and-a-half pixels a five-character
 * pill is a smudge. Worse, the five words were five unrelated visual weights —
 * `Exam` was solid red on white, `Off` was a pale amber ghost, `3 cls` was
 * unboxed grey — so the strip read as a set of arbitrary badges rather than as
 * one encoding. A fill makes all five states the same shape, so the eye
 * compares colours instead of strings.
 *
 * The colours are deliberately *not* the obvious ones. Exam is amber and
 * holiday is red, which reads backwards from "exams are the scary thing" — and
 * that is the point. In this app red is reserved for a genuine loss of a
 * teaching day (`MonthGrid` uses the identical red for `holiday`), and an exam
 * is a normal working day that happens to be graded. Amber is already the
 * shortened-day colour in the same grid, so the two tints mean the same thing
 * on the strip as they do on the month grid it links to.
 *
 * Nothing is lost in the swap. The word moves to `title` and `aria-label`, and
 * the sub-header under the strip already narrates the selected day in full
 * ("1 exam scheduled", "4 sessions scheduled"), so the tint is a way in and
 * never the only way to find out.
 */

/**
 * The subset of a `weekDays` entry the strip actually reads.
 *
 * Declared structurally rather than imported so this module stays a pure leaf
 * that can be tested without pulling in the home page's data graph.
 */
export interface WeekStripDay {
  /** `MON` … `SUN`. */
  dayCode: string;
  dayNumber: number;
  fullDate: Date;
  isToday: boolean;
  hasExam: boolean;
  holidayInfo: string | null;
  /** The day the academic calendar reorders classes onto, e.g. `MON`. */
  detectedDayOrder: string | null;
}

/**
 * The mutually exclusive day kinds a circle can be.
 *
 * "Free" and "N classes" are deliberately *not* kinds. They are the same kind
 * of day — a teaching day with nothing special about it — differing only in
 * how much is on it, and a seven-day strip that gives them separate colours
 * would spend a fifth of its palette saying nothing.
 */
export type WeekStripFlavour = "exam" | "holiday" | "reordered" | "teaching";

/**
 * Precedence, in one place, because it is the one thing that must not drift.
 *
 * A reordered day already clears `holidayInfo` upstream (reordering a working
 * day sets it instructional), so `reordered` is only reached on days that are
 * genuinely teaching. An exam on a holiday is an exam day: the exam is what
 * you have to act on, and the sub-header will say the holiday's name.
 */
export function weekStripFlavour(day: WeekStripDay): WeekStripFlavour {
  if (day.hasExam) return "exam";
  if (day.holidayInfo) return "holiday";
  if (day.detectedDayOrder) return "reordered";
  return "teaching";
}

export interface WeekStripTint {
  /** The circle's own background, at rest. */
  fill: string;
  /** The date number. Carries the tint so the day reads at a glance. */
  ink: string;
  /**
   * The hairline around the circle.
   *
   * This exists because the strip has no plate behind it any more. The circles
   * used to sit on a `bg-zinc-100` card, which gave every one of them an edge
   * for free; on the bare page an untinted circle is a white disc on a near
   * white background and simply is not there. Tinting the edge as well as the
   * fill keeps a circle reading as one object rather than a coloured blob with
   * a mismatched grey ring around it.
   */
  edge: string;
}

/**
 * One fill, one ink, one edge, per kind.
 *
 * The fills are `/10` — a wash, not a paint. The strip sits directly on the
 * page next to the exam card, and a fully saturated circle would out-shout the
 * thing the strip exists to warn you about. `MonthGrid` uses the same opacities
 * for the same reason.
 */
export const WEEK_STRIP_TINT: Record<WeekStripFlavour, WeekStripTint> = {
  exam: {
    fill: "bg-amber-500/10 dark:bg-amber-500/10",
    ink: "text-amber-600 dark:text-amber-400",
    edge: "border-amber-200 dark:border-amber-900/60",
  },
  holiday: {
    fill: "bg-red-500/10 dark:bg-red-500/10",
    ink: "text-red-600 dark:text-red-400",
    edge: "border-red-200 dark:border-red-900/60",
  },
  reordered: {
    fill: "bg-indigo-500/10 dark:bg-indigo-500/10",
    ink: "text-indigo-600 dark:text-indigo-300",
    edge: "border-indigo-200 dark:border-indigo-900/60",
  },
  // No hue. A teaching day is the default state and must recede — it is a
  // white disc with a hairline, and it is the one circle in a normal week that
  // you can look straight past.
  teaching: {
    fill: "bg-white dark:bg-zinc-900",
    ink: "text-zinc-800 dark:text-zinc-200",
    edge: "border-zinc-200 dark:border-zinc-800",
  },
};

export const WEEK_STRIP_LABEL: Record<Exclude<WeekStripFlavour, "teaching">, string> = {
  exam: "Exam day",
  holiday: "Academic holiday",
  reordered: "Reordered timetable",
};

/**
 * Today, not selected: a thin emerald ring plus green ink.
 *
 * Two signals, not one, because a ring is the same shape as the selection ring
 * and the two are frequently on the same circle — land on the page and today is
 * both.
 */
export const TODAY_RING = "ring-1 ring-inset ring-emerald-500 dark:ring-emerald-400";
export const TODAY_INK = "text-emerald-600 dark:text-emerald-400";
/** Selection outranks today: indigo two rings deep, and the circle grows. */
export const SELECTED_RING = "ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400";

/** `en-GB` because the month grid's tooltips already say "Sept", not "Sep". */
function formatWhen(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The circle's full description, for `title` and `aria-label`.
 *
 * This is where the pill's text went. The session count is threaded in rather
 * than read from the day so the caller keeps owning `timetableMap` — and so
 * that dropping the count off the face of the circle did not quietly drop it
 * out of the app.
 */
export function weekStripTitle(day: WeekStripDay, classCount = 0): string {
  const flavour = weekStripFlavour(day);
  const what =
    flavour === "reordered"
      ? `${WEEK_STRIP_LABEL.reordered} (${day.detectedDayOrder})`
      : flavour === "teaching"
        ? classCount > 0
          ? `${classCount} ${classCount === 1 ? "session" : "sessions"}`
          : "No classes"
        : WEEK_STRIP_LABEL[flavour];
  return `${formatWhen(day.fullDate)} · ${what}`;
}

/** The extra clause a circle needs on top of its title: how many exams. */
export function weekStripExamNote(examCount: number): string {
  if (examCount <= 0) return "";
  return `, ${examCount} ${examCount === 1 ? "exam" : "exams"}`;
}
