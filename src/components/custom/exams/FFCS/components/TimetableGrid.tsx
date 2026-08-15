import React from 'react';
import { DAYS } from '../constants';
import { TimetableGrid as AmazeUITimetableGrid, type AddedCourse, type TimetablePeriod, type GapDetail } from "@amazecontinuityprojects/amazeui";

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

  return (
    <div className={`${customCourses && !fullSize ? 'scale-[0.85] origin-top-left -mb-10' : ''} ${fullSize ? '' : 'overflow-x-auto'}`}>
      <AmazeUITimetableGrid
        courses={displayCourses}
        theoryPeriods={theoryPeriods}
        labPeriods={labPeriods}
        days={DAYS}
        blockedSlots={blockedSlots}
        onToggleBlockSlot={customCourses ? undefined : toggleBlockSlot}
        selectedGapDetails={selectedGapDetails}
        title="Unified Schedule"
        showLegend={true}
      />
    </div>
  );
}
