"use client";

/**
 * The horizontal timetable grid adapter.
 * Supports both the modern high-aesthetic grid (matching the JPG export)
 * and the classic amazeui grid.
 */

import type { AddedCourse, GapDetail, TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import type { NormalizedCourse } from "@/types/course";
import ModernHorizontalTimetableGrid from "./ModernHorizontalTimetableGrid";
import ClassicHorizontalTimetableGrid from "./ClassicHorizontalTimetableGrid";
import type { AttendanceTone } from "./SlotDetailSheet";

export interface HorizontalTimetableGridProps {
  courses: (AddedCourse | NormalizedCourse | any)[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  /** Attendance figures shown in the modern grid's tapped-cell sheet. */
  attendanceByCourse?: Record<string, AttendanceTone>;
  title?: string;
  showLegend?: boolean;
  className?: string;
  variant?: "modern" | "classic";
}

export default function HorizontalTimetableGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days,
  blockedSlots,
  onToggleBlockSlot,
  selectedGapDetails,
  attendanceByCourse,
  title,
  showLegend,
  className,
  variant = "modern",
}: HorizontalTimetableGridProps) {
  if (variant === "classic") {
    return (
      <ClassicHorizontalTimetableGrid
        courses={courses}
        theoryPeriods={theoryPeriods}
        labPeriods={labPeriods}
        days={days}
        blockedSlots={blockedSlots}
        onToggleBlockSlot={onToggleBlockSlot}
        selectedGapDetails={selectedGapDetails}
        title={title}
        showLegend={showLegend}
        className={className}
      />
    );
  }

  return (
    <ModernHorizontalTimetableGrid
      courses={courses}
      theoryPeriods={theoryPeriods}
      labPeriods={labPeriods}
      days={days}
      blockedSlots={blockedSlots}
      onToggleBlockSlot={onToggleBlockSlot}
      selectedGapDetails={selectedGapDetails}
      attendanceByCourse={attendanceByCourse}
      title={title}
      showLegend={showLegend}
      className={className}
    />
  );
}

export { ModernHorizontalTimetableGrid, ClassicHorizontalTimetableGrid };
