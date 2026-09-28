import React from 'react';
import { DAYS } from '../constants';
import type { AddedCourse, GapDetail, TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import { TimetableView } from "../../../timetable";

export type { GapDetail };

export interface TimetableGridProps {
  courses: AddedCourse[];
  customCourses?: AddedCourse[];
  fullSize?: boolean;
  blockedSlots: Set<string>;
  toggleBlockSlot: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
}

/**
 * The FFCS planner's grid, routed through the common `TimetableView`.
 *
 * Two behaviours here are load-bearing:
 *
 *  - **`customCourses && !fullSize` is a compare preview.** `AutoGeneratorModal`
 *    renders up to three of these side by side at 85% scale, and a friend
 *    preview is read-only. Both are pinned horizontal — there is no room for a
 *    switcher in a third of a column, and offering one in a read-only preview
 *    would be a lie.
 *  - **`toggleBlockSlot` is what makes a tap mean "block".** In the vertical
 *    view, supplying it turns each cell into a block toggle; omitting it turns
 *    each cell into a detail sheet. The planner has always blocked on tap, so
 *    the prop decides and the cell does not branch.
 */
export function TimetableGrid({
  courses,
  customCourses,
  fullSize,
  blockedSlots,
  toggleBlockSlot,
  selectedGapDetails,
  theoryPeriods,
  labPeriods
}: TimetableGridProps) {
  const displayCourses = customCourses || courses;
  const isComparePreview = Boolean(customCourses) && !fullSize;

  return (
    <TimetableView
      courses={displayCourses}
      theoryPeriods={theoryPeriods}
      labPeriods={labPeriods}
      days={DAYS}
      blockedSlots={blockedSlots}
      onToggleBlockSlot={customCourses ? undefined : toggleBlockSlot}
      selectedGapDetails={selectedGapDetails}
      title="Unified Schedule"
      showLegend
      forceView={isComparePreview ? "horizontal" : undefined}
      horizontalClassName={isComparePreview ? 'scale-[0.85] origin-top-left -mb-10' : undefined}
    />
  );
}
