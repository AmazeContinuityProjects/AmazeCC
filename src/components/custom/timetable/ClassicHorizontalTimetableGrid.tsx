"use client";

/**
 * The classic horizontal grid from amazeui.
 * Preserved for users who prefer the legacy grid view.
 */

import {
  TimetableGrid as AmazeUITimetableGrid,
  type AddedCourse,
  type GapDetail,
  type TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import type { NormalizedCourse } from "@/types/course";
import { expandSlotSpellings, ownSlotSpelling } from "@/lib/slots";
import { DAY_LABELS, DAY_ORDER } from "@/lib/generated/timetable";

/** The teaching week's day scaffolding, from the generated unified timetable. */
const DEFAULT_DAYS: { id: string; name: string }[] = DAY_ORDER.slice(0, 5).map((id) => ({
  id: id.toLowerCase(),
  name: DAY_LABELS[id],
}));

function respell(
  periods: readonly TimetablePeriod[],
  courses: readonly (AddedCourse | NormalizedCourse | any)[],
  days: readonly { id: string; name: string }[],
): TimetablePeriod[] {
  return periods.map((period) => {
    if (!period?.days) return period;
    let changed = false;
    const next: Record<string, string> = { ...period.days };
    for (const day of days) {
      const slot = period.days[day.id];
      if (!slot) continue;
      const own = ownSlotSpelling(courses, slot);
      if (own !== slot) {
        next[day.id] = own;
        changed = true;
      }
    }
    return changed ? { ...period, days: next } : period;
  });
}

export interface ClassicHorizontalTimetableGridProps {
  courses: (AddedCourse | NormalizedCourse | any)[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  title?: string;
  showLegend?: boolean;
  className?: string;
}

export default function ClassicHorizontalTimetableGrid({
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
}: ClassicHorizontalTimetableGridProps) {
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
