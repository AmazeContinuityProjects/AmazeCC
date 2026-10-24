"use client";

/**
 * The horizontal timetable grid adapter.
 * Supports both the modern high-aesthetic grid (matching the JPG export)
 * and the classic amazeui grid.
 */

import React from "react";
import type {
  AddedCourse,
  GapDetail,
  TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import ModernHorizontalTimetableGrid from "./ModernHorizontalTimetableGrid";
import ClassicHorizontalTimetableGrid from "./ClassicHorizontalTimetableGrid";

export interface HorizontalTimetableGridProps {
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
      title={title}
      showLegend={showLegend}
      className={className}
    />
  );
}

export { ModernHorizontalTimetableGrid, ClassicHorizontalTimetableGrid };
