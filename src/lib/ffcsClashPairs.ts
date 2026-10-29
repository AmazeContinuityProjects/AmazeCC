/**
 * Which of the picked courses sit on top of each other.
 *
 * The dashboard already flags clashes one pair at a time (see the header's
 * `ClashDetails`), but a *report* needs the whole picture at once: for every
 * course, the other courses it overlaps, with the day and the clock window so
 * a student can act on it without opening the grid. That is the "Clashes With"
 * column FFCS-inator prints in its downloadable report, and this module is the
 * pure half of it — no jsPDF, no React, just `Map<courseId, CourseClash[]>`.
 *
 * Two decisions worth stating, because both look like bugs until you know:
 *
 * - **Rows that share a code never clash with each other.** A theory row and a
 *   lab row of the same course are one logical course; reporting
 *   `CSE3001 clashes with CSE3001` would be noise. This holds whether the
 *   halves live on one merged row or two.
 * - **Clashes are attributed by code and deduped.** Two offerings of the same
 *   code that both overlap a third course produce one entry per
 *   (day, time) on the third course, not one per offering row — the student
 *   sees "clashes with CSE3001", not "clashes with CSE3001 twice".
 *
 * Times are printed as 24-hour ASCII (`"Mon 08:00-08:50"`, plain hyphen): the
 * consumers are jsPDF standard fonts, where an en dash is a coin toss and a
 * leading-zero hour keeps the column widths even.
 */
import { getTimetableSchema } from "@/lib/campusSchema";
import { findPeriodClash, periodsForSlot, periodsOverlap, type CampusSchema, type SlotPeriod } from "@/lib/slots";
import type { AddedCourse } from "@/components/custom/exams/FFCS/types";

/** One place on the clock where two courses overlap. */
export interface CourseClash {
  /** The other course's code — the stable identity across offering rows. */
  code: string;
  title: string;
  /** Weekday in display form, e.g. `"Mon"`. */
  day: string;
  /** The clashing window in 24-hour form, e.g. `"08:00-08:50"`. */
  timeRange: string;
}

/** `"Mon"` from the schema's lowercase day id. */
function dayLabel(day: string): string {
  return day ? day.charAt(0).toUpperCase() + day.slice(1) : "";
}

/**
 * `"08:05"` — minutes-since-midnight as a zero-padded 24-hour clock.
 *
 * Exported because the clash report's curriculum section prints the same
 * windows the clashes do, and two clocks disagreeing by a zero-pad is the
 * kind of thing a reader notices before they notice anything else.
 */
export function formatMinutesOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * `"Mon 08:00-08:50"` — the printable form of one schema period.
 *
 * Everything printable about a period ends up here eventually: the clash
 * entries are built from the *overlap window* of two periods, so this takes
 * day/start/end rather than a `SlotPeriod` when the caller only has the three
 * values.
 */
export function formatPeriodRange(period: SlotPeriod): string {
  return formatWindow(period.day, period.startMin, period.endMin);
}

function formatWindow(day: string, startMin: number, endMin: number): string {
  return `${dayLabel(day)} ${formatMinutesOfDay(startMin)}-${formatMinutesOfDay(endMin)}`;
}

function pushClash(
  byCourse: Map<string, CourseClash[]>,
  seen: Map<string, Set<string>>,
  courseId: string,
  clash: CourseClash,
): void {
  const key = `${clash.code}|${clash.day}|${clash.timeRange}`;
  let keys = seen.get(courseId);
  if (!keys) {
    keys = new Set();
    seen.set(courseId, keys);
  }
  if (keys.has(key)) return;
  keys.add(key);
  const list = byCourse.get(courseId);
  if (list) list.push(clash);
  else byCourse.set(courseId, [clash]);
}

/**
 * For every course, the other courses whose periods it overlaps.
 *
 * Only courses with at least one clash appear as a key — an absent key and an
 * empty list mean the same thing, and callers should read with `?? []`.
 *
 * Order is stable and first-seen: courses are paired in array order, and the
 * period pairs inside one course pair follow each course's own slot order, so
 * the same plan always yields the same report.
 *
 * `NIL`, empty and unknown slots expand to no periods at all (see
 * `periodsForSlot`) and simply drop out; lunch comes free from the schema,
 * which schedules no periods in it.
 */
export function courseClashPairs(
  courses: readonly AddedCourse[],
  schema: CampusSchema = getTimetableSchema(),
): Map<string, CourseClash[]> {
  const byCourse = new Map<string, CourseClash[]>();
  const seen = new Map<string, Set<string>>();
  const periods = courses.map((course) => (course.slots ?? []).flatMap((slot) => periodsForSlot(schema, slot)));

  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      // One logical course, whatever row layout it arrived on.
      if (a.code === b.code) continue;
      // One clash test for the pair; the loop below only runs when it pays off.
      if (!findPeriodClash(periods[i], periods[j])) continue;
      for (const periodA of periods[i]) {
        for (const periodB of periods[j]) {
          if (!periodsOverlap(periodA, periodB)) continue;
          const day = periodA.day;
          const startMin = Math.max(periodA.startMin, periodB.startMin);
          const endMin = Math.min(periodA.endMin, periodB.endMin);
          const timeRange = formatMinutesOfDay(startMin) + "-" + formatMinutesOfDay(endMin);
          const label = dayLabel(day);
          pushClash(byCourse, seen, a.id, { code: b.code, title: b.title, day: label, timeRange });
          pushClash(byCourse, seen, b.id, { code: a.code, title: a.title, day: label, timeRange });
        }
      }
    }
  }
  return byCourse;
}

/**
 * How many course pairs clash — the "N clashes detected" number.
 *
 * Counted from the pair walk rather than from `courseClashPairs`'s entries:
 * one clashing pair can put several day/time entries on each side, and the
 * headline number a student reads should be "three pairs clash", not "six
 * overlap windows exist". Counted per *code* pair for the same reason the map
 * attributes by code: two offerings of CSE3001 both overlapping MAT2005 is one
 * clash the way the report tells it, not two. Same-code rows never count —
 * theory and lab halves of one course cannot clash with each other.
 */
export function courseClashPairCount(
  courses: readonly AddedCourse[],
  schema: CampusSchema = getTimetableSchema(),
): number {
  const periods = courses.map((course) => (course.slots ?? []).flatMap((slot) => periodsForSlot(schema, slot)));
  const clashingPairs = new Set<string>();
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (courses[i].code === courses[j].code) continue;
      if (!findPeriodClash(periods[i], periods[j])) continue;
      const codes = [courses[i].code, courses[j].code].sort();
      clashingPairs.add(`${codes[0]}|${codes[1]}`);
    }
  }
  return clashingPairs.size;
}
