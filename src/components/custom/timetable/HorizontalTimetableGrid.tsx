"use client";

/**
 * The horizontal grid, adapted for the two spellings of a slot id.
 *
 * `amazeui`'s `TimetableGrid` is the renderer and it lives in another repository
 * — there is no source here to change, and patching `node_modules` is not a fix
 * that survives an install. It makes three assumptions that the law school
 * breaks, and they are all the same assumption: that the id the schema prints is
 * the id the course carries.
 *
 *  1. It finds a course with `courses.find(c => c.slots.includes(period.days[day]))`,
 *     so a course booked `A` is never found at the `A1` period — and the cell
 *     renders as a free slot, which is how a law student's whole timetable came
 *     back empty.
 *  2. It *prints* `period.days[day]`, so even once matched, the cell would read
 *     `A1` for a course the student's own timetable calls `A`.
 *  3. It blocks by that same printed id, so tapping the cell records `A1` — and
 *     the generator filters its options by the slot on the *course*, so the
 *     block silently does nothing.
 *
 * One substitution fixes all three, because it leaves the grid seeing nothing
 * but the spelling the course actually uses: for every (day, period) that a
 * course occupies, the period is handed over carrying that course's own id.
 * Free cells keep the schema's id, which is the right thing to print for a
 * period nobody is in, and the time headers are untouched because they read
 * `period.start`/`end`.
 *
 * `blockedSlots` is expanded as well, so an id blocked under either spelling
 * hatches the cell — a student can have blocked `A1` on the horizontal grid and
 * `A` on the vertical one for the same period.
 *
 * The vertical renderer has the same three problems and *is* editable, which is
 * why it spells them out in `buildBands.ts` instead of coming through here.
 */

import {
  TimetableGrid as AmazeUITimetableGrid,
  type AddedCourse,
  type GapDetail,
  type TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import { expandSlotSpellings, hasSlot } from "@/lib/slots";

const DEFAULT_DAYS: { id: string; name: string }[] = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

/** The id the course itself uses for a period, or the schema's if it agrees. */
function ownSpelling(
  courses: readonly AddedCourse[],
  schemaSlot: string
): string {
  const course = courses.find((c) => hasSlot(c.slots, schemaSlot));
  if (!course) return schemaSlot;
  return course.slots.find((own) => hasSlot([own], schemaSlot)) ?? schemaSlot;
}

/**
 * Re-spell every slot a course occupies.
 *
 * Not memoised: `theoryPeriods`/`labPeriods` arrive as a fresh `.filter()` on
 * most call sites, so the array identities change every render and a memo keyed
 * on them would miss anyway. Twelve periods over five days against a timetable
 * of eight courses is a few hundred comparisons — cheaper than the dependency
 * walk it replaces.
 */
function respell(
  periods: readonly TimetablePeriod[],
  courses: readonly AddedCourse[],
  days: readonly { id: string; name: string }[]
): TimetablePeriod[] {
  return periods.map((period) => {
    if (!period?.days) return period;
    let changed = false;
    const next: Record<string, string> = { ...period.days };
    for (const day of days) {
      const slot = period.days[day.id];
      if (!slot) continue;
      const own = ownSpelling(courses, slot);
      if (own !== slot) {
        next[day.id] = own;
        changed = true;
      }
    }
    // Untouched periods are handed back by identity, so the common case — a
    // timetable with no law course on it at all — allocates nothing.
    return changed ? { ...period, days: next } : period;
  });
}

export default function HorizontalTimetableGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days = DEFAULT_DAYS,
  blockedSlots,
  onToggleBlockSlot,
  selectedGapDetails,
  title,
  showLegend,
  className,
}: {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  title?: string;
  showLegend?: boolean;
  className?: string;
}) {
  return (
    <AmazeUITimetableGrid
      courses={courses}
      theoryPeriods={respell(theoryPeriods, courses, days)}
      labPeriods={respell(labPeriods, courses, days)}
      days={days}
      blockedSlots={blockedSlots ? expandSlotSpellings(blockedSlots) : undefined}
      onToggleBlockSlot={onToggleBlockSlot}
      selectedGapDetails={selectedGapDetails}
      title={title}
      showLegend={showLegend}
      className={className}
    />
  );
}
