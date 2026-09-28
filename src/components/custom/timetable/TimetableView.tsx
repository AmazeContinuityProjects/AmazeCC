"use client";

/**
 * The common timetable.
 *
 * One entry point for every course timetable in the app, and the reason there
 * are not three near-identical grids: `TimetableView` owns the view choice and
 * hands the same `courses` / `theoryPeriods` / `labPeriods` triple to either
 * renderer.
 *
 *   - **vertical** — the mobile heatmap: days across the top, times down the
 *     left, one cell per (day, band), tap a cell for a detail sheet.
 *   - **horizontal** — the long-standing amazeui grid, unchanged.
 *
 * ## Why this is a local component and not an amazeui one
 *
 * The real grid lives in `@amazecontinuityprojects/amazeui`, whose source is a
 * separate repository that is not part of this workspace. Putting the vertical
 * view there would be the only way to guarantee *one* copy for every consumer,
 * but it could not be built or tested from here — so the vertical renderer and
 * this switcher live locally and the horizontal half still delegates upstream.
 * The alternative was a fifth inline copy of the grid, which is what
 * `FFCSTimetableTab.tsx` already had.
 *
 * ## Auto-applied
 *
 * `timetableViewMode` defaults to `"auto"`, so a phone gets the vertical
 * heatmap and a desktop gets the horizontal grid with no per-surface wiring.
 * `forceView` opts a surface out — used by the FFCS compare previews, which
 * render three grids side by side at 85% and have no room for a switcher.
 */

import type { ReactNode } from "react";
import {
  TimetableGrid as AmazeUITimetableGrid,
  cn,
  type AddedCourse,
  type GapDetail,
  type TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import { SegmentedControl } from "../shared/primitives";
import VerticalTimetableGrid from "./VerticalTimetableGrid";
import {
  useTimetableViewMode,
  type CellDensity,
  type ResolvedView,
  type TimetableViewMode,
} from "./useTimetableViewMode";
import type { AttendanceTone } from "./SlotDetailSheet";

const MODE_OPTIONS: readonly {
  value: TimetableViewMode;
  label: string;
  title: string;
}[] = [
  { value: "auto", label: "Auto", title: "Vertical on phones, full grid on larger screens" },
  { value: "vertical", label: "Vertical", title: "Always the mobile heatmap" },
  { value: "horizontal", label: "Grid", title: "Always the full horizontal grid" },
];

/**
 * Text-only, deliberately. The house `SegmentedControl` hides an option's label
 * whenever an icon is passed (`hidden xs:inline`) and this project defines no
 * `xs` breakpoint, so an icon here would render three bare glyphs.
 */
const DENSITY_OPTIONS: readonly {
  value: CellDensity;
  label: string;
  title: string;
}[] = [
  { value: "full", label: "Full", title: "Show the course code in every cell" },
  { value: "compact", label: "Compact", title: "Slot only, sized to fit the screen" },
];

export interface TimetableViewProps {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  /** Present only where a tap has always meant "rule this slot out" (FFCS). */
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  title?: string;
  showLegend?: boolean;
  className?: string;
  /**
   * Pin the view and hide the switcher. For read-only previews — a friend's
   * timetable, the 3-up generator compare — where switching would be confusing
   * or physically impossible.
   */
  forceView?: ResolvedView;
  /**
   * Force a cell density. Left unset, it follows `timetableCellDensity` and the
   * in-grid toggle; set it to pin a surface regardless of the setting.
   */
  cellDensity?: CellDensity;
  /** Extra classes on the horizontal grid's scroll wrapper (compare mode shrink). */
  horizontalClassName?: string;
  /** Attendance figures, so the vertical sheet can show them. */
  attendanceByCourse?: Record<string, AttendanceTone>;
  /** Rendered under whichever view is active — e.g. the course reference table. */
  children?: ReactNode;
}

export default function TimetableView({
  courses,
  theoryPeriods,
  labPeriods,
  days,
  blockedSlots,
  onToggleBlockSlot,
  selectedGapDetails,
  title,
  showLegend = true,
  className,
  forceView,
  cellDensity,
  horizontalClassName,
  attendanceByCourse,
  children,
}: TimetableViewProps) {
  const { mode, setMode, density, setDensity, resolved, isMobile } =
    useTimetableViewMode();
  const view: ResolvedView | null = forceView ?? resolved;
  const activeDensity: CellDensity = cellDensity ?? density;
  // The horizontal grid has its own fixed cell shape; a density choice would be
  // meaningless there, so the control only appears where it does something.
  const showDensity = !forceView && (view === "vertical" || view === null);

  return (
    <div className={cn("space-y-4", className)}>
      {!forceView && (
        <div
          // Stripped by `downloadTimetableImage` / `exportableHtml` so the
          // switcher never lands in a shared PNG or printout.
          data-export-chrome
          className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            {title && (
              <h3 className="font-outfit text-base font-black text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            )}
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {mode === "auto"
                ? isMobile
                  ? "Auto · showing the vertical view on this phone"
                  : "Auto · showing the full grid on this screen"
                : mode === "vertical"
                  ? "Pinned to the vertical view"
                  : "Pinned to the full grid"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
            <SegmentedControl
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              grow
              scroll
            />
            {showDensity && (
              <SegmentedControl
                options={DENSITY_OPTIONS}
                value={activeDensity}
                onChange={setDensity}
                grow
                scroll
                className="max-w-[14rem]"
              />
            )}
          </div>
        </div>
      )}

      {view === null ? (
        // Both inputs to the auto decision land after mount, so hold a stable
        // box rather than painting the wrong grid and flipping.
        <div
          className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
          aria-hidden="true"
        />
      ) : view === "vertical" ? (
        <VerticalTimetableGrid
          courses={courses}
          theoryPeriods={theoryPeriods}
          labPeriods={labPeriods}
          days={days}
          blockedSlots={blockedSlots}
          selectedGapDetails={selectedGapDetails}
          onToggleBlockSlot={onToggleBlockSlot}
          attendanceByCourse={attendanceByCourse}
          compact={activeDensity === "compact"}
        />
      ) : (
        <div>
          {!forceView && isMobile && (
            <div className="mb-2 flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-center text-[10px] font-bold text-sky-600 dark:text-sky-400">
              <span>← Swipe horizontally to view the full grid →</span>
            </div>
          )}
          <div className={cn("overflow-x-auto", horizontalClassName)}>
            <AmazeUITimetableGrid
              courses={courses}
              theoryPeriods={theoryPeriods}
              labPeriods={labPeriods}
              days={days}
              blockedSlots={blockedSlots}
              onToggleBlockSlot={onToggleBlockSlot}
              selectedGapDetails={selectedGapDetails}
              title={forceView ? title : ""}
              showLegend={showLegend}
            />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
