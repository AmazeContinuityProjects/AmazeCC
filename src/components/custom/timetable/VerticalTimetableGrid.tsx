"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  cn,
  type AddedCourse,
  type GapDetail,
  type TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import { dayKeyForDate } from "@/lib/social/schedule";
import {
  buildVerticalGrid,
  describeCell,
  weekDateForDayId,
  type Cell,
} from "./buildBands";
import SlotDetailSheet from "./SlotDetailSheet";
import type { AttendanceTone } from "./SlotDetailSheet";

/**
 * The mobile-first vertical timetable.
 *
 * Days run across the top, times down the left, one cell per (day, band) — the
 * transpose of the horizontal grid. `border-separate` + `border-spacing-1` plus
 * a 2px border on every tile is what gives the "spacious with clear borders"
 * read; `border-collapse` would collapse those into hairlines and the rowSpan
 * merges would fight the collapsed edges.
 *
 * ## Tap behaviour
 *
 * When `onToggleBlockSlot` is supplied the cell is a **block toggle**, exactly
 * as in the horizontal grid — that is the FFCS planner, where a tap has always
 * meant "rule this slot out". Where it is absent the cell is a **discovery**
 * affordance and opens `SlotDetailSheet`. One prop, two surfaces, no per-call
 * site branching.
 *
 * ## Compact density
 *
 * `compact` drops the course code, drops the end time from the gutter, shrinks
 * the tiles, and — the point of it — **`table-fixed` instead of a scroll
 * container**, so seven days fit the viewport rather than needing a sideways
 * swipe. At 360px that leaves roughly 36px per day column, which is why a
 * merged run **stacks its slots down the tile** (`L31` over `+L32`) rather than
 * printing `"L31+L32"` on one truncated line.
 *
 * A merged tile also fills its whole `rowSpan` — the `<td>` is a containing
 * block and the tile is `absolute inset-0` — so a two-slot lab is one
 * same-coloured block across both bands, not one block with a gap beneath it.
 *
 * Compact also leaves free, gap and blocked-with-no-course cells unlabelled.
 * There is no honest one-slot answer for a free band (it has two, `"L1 / A1"`),
 * and eighty-four faint slot ids is the noise the density exists to remove. The
 * colour carries those cells and the tap sheet still names everything, so
 * nothing becomes unreachable.
 */
export default function VerticalTimetableGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days,
  blockedSlots,
  selectedGapDetails,
  onToggleBlockSlot,
  attendanceByCourse,
  compact = false,
  className,
}: {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  selectedGapDetails?: GapDetail[] | null;
  /** Supplied by the FFCS planner: a tap rules the slot out instead of opening a sheet. */
  onToggleBlockSlot?: (slot: string) => void;
  attendanceByCourse?: Record<string, AttendanceTone>;
  /** Slot only, no course code, sized to fit the viewport without scrolling. */
  compact?: boolean;
  className?: string;
}) {
  const [activeCell, setActiveCell] = useState<Cell | null>(null);
  const [today, setToday] = useState<string | null>(null);

  const grid = useMemo(
    () =>
      buildVerticalGrid({
        courses,
        theoryPeriods,
        labPeriods,
        days,
        blockedSlots,
        selectedGapDetails,
      }),
    // `days` is a fresh array literal at some call sites, so key the memo on its
    // contents rather than its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, theoryPeriods, labPeriods, days?.map((d) => d.id).join(","), blockedSlots, selectedGapDetails]
  );

  // The day key is a `new Date()` read, so it is resolved after mount rather
  // than during render — otherwise the static export would bake the build day's
  // Monday into the markup and every other day would be wrong.
  useEffect(() => {
    setToday(dayKeyForDate(new Date()).toLowerCase());
  }, []);

  if (grid.bands.length === 0 || grid.days.length === 0) return null;

  /**
   * A band swallowed by a `rowSpan` in *every* column is part of a class that
   * started higher up, so its own time label would read as if a separate period
   * began there. Blank the gutter in that case. With one day a three-hour lab
   * blanks two rows; with seven days, only a column everyone shares does.
   */
  const fullyCovered = new Set(
    grid.bands
      .filter(
        (band) =>
          !band.isLunch && grid.days.every((day) => grid.cells[day.id]?.[band.index] === null)
      )
      .map((band) => band.index)
  );

  const handleTap = (cell: Cell) => {
    const first = cell.slots[0];
    if (onToggleBlockSlot && first) onToggleBlockSlot(first);
    else setActiveCell(cell);
  };

  /**
   * In compact, a cell is labelled only when a course occupies it. Everything
   * else reads from colour alone — see the density note in the header comment.
   */
  const cellLabel = (cell: Cell) => {
    if (compact) return cell.course ? cell.shortLabel : "";
    return cell.label || "—";
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {/*
        Compact gets NO overflow class on purpose.

        `table-fixed` + `w-full` is the fit guarantee: under `table-fixed` the
        browser sizes columns from the declared widths and ignores content, so
        no slot id can push the table past its container and nothing scrolls.

        That is also what keeps the sticky day header working. Any `overflow`
        value here — including `overflow-hidden` — makes this div a scrollport,
        and `position: sticky` resolves against the nearest scrollport, so the
        `<th>`'s `sticky top-0` would bind to a box that cannot scroll and the
        header would stop following you down a twelve-row week. Full density
        does carry `overflow-x-auto`, because it genuinely does scroll, and that
        is the same trade with the opposite answer.
      */}
      <div className={cn("-mx-1 px-1 pb-1", !compact && "overflow-x-auto")}>
        <table
          className={cn(
            "w-full border-separate border-spacing-1 text-center",
            compact && "table-fixed"
          )}
        >
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  "sticky left-0 top-0 z-30 rounded-lg bg-white px-1 py-1 font-black uppercase tracking-wider text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500",
                  compact ? "w-12 min-w-12 text-[8px]" : "w-14 min-w-14 text-[9px]"
                )}
              >
                Time
              </th>
              {grid.days.map((day) => {
                const isToday = day.id.toLowerCase() === today;
                const date = isToday ? weekDateForDayId(day.id) : null;
                return (
                  <th
                    key={day.id}
                    scope="col"
                    className={cn(
                      "rounded-lg px-0.5 py-1 font-black uppercase tracking-wider",
                      compact ? "text-[9px]" : "text-[10px]",
                      isToday
                        ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-500/70"
                        : "bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
                    )}
                  >
                    <span className="block leading-none">
                      {day.name.substring(0, 3)}
                    </span>
                    {date && (
                      <span
                        className={cn(
                          "mt-0.5 block font-bold leading-none opacity-70",
                          compact ? "text-[8px]" : "text-[9px]"
                        )}
                      >
                        {date.getDate()}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {grid.bands.map((band) => {
              if (band.isLunch) {
                return (
                  <tr key={band.index}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 rounded-lg bg-white px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600"
                    >
                      {band.label}
                    </th>
                    <td colSpan={grid.days.length} className="p-0 align-middle">
                      <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={band.index}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 rounded-lg bg-white dark:bg-zinc-950",
                      compact ? "w-12 min-w-12 px-0.5 py-0.5" : "w-14 min-w-14 px-1 py-1"
                    )}
                  >
                    {fullyCovered.has(band.index) ? (
                      <span className="block text-[9px] leading-tight text-zinc-300 dark:text-zinc-700">
                        &middot;&middot;&middot;
                      </span>
                    ) : compact ? (
                      <span className="block text-[9px] font-bold leading-tight text-zinc-600 dark:text-zinc-300">
                        {band.shortLabel}
                      </span>
                    ) : (
                      <>
                        <span className="block text-[9px] font-bold leading-tight text-zinc-600 dark:text-zinc-300">
                          {band.startLabel || "—"}
                        </span>
                        <span className="block text-[8px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
                          {band.endLabel}
                        </span>
                      </>
                    )}
                  </th>

                  {grid.days.map((day) => {
                    const cell = grid.cells[day.id]?.[band.index];
                    // null means a rowSpan from an earlier band already covers
                    // this position. Rendering a td here would break the merge.
                    if (!cell) return null;

                    const isToday = day.id.toLowerCase() === today;
                    const described = describeCell(cell, day.name.substring(0, 3));
                    const spans = cell.bandCount > 1;
                    return (
                      <td
                        key={day.id}
                        // Left off entirely when 1, so the DOM says "no span"
                        // rather than a redundant rowspan="1" in a printout.
                        rowSpan={spans ? cell.bandCount : undefined}
                        // A spanning cell has to give its <td> a containing
                        // block, because the tile is absolutely positioned to
                        // fill the whole run. Without this the tile keeps its own
                        // min-height and sits at the top of the span, so a
                        // two-slot lab reads as one block with a dead gap under
                        // it rather than one block.
                        className={cn("p-0", spans ? "relative" : "align-top")}
                      >
                        <button
                          type="button"
                          onClick={() => handleTap(cell)}
                          title={described}
                          aria-label={described}
                          className={cn(
                            "flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 transition-all duration-200 active:scale-95",
                            spans
                              ? "absolute inset-0 h-full"
                              : "relative",
                            compact
                              ? "min-h-[38px] overflow-hidden px-0.5 py-1"
                              : "min-h-[52px] px-1 py-1.5",
                            cell.kind === "blocked" &&
                              "border-red-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(239,68,68,0.3)_2px,rgba(239,68,68,0.3)_4px)] bg-red-950/40 text-red-200 shadow-inner",
                            cell.kind === "course" &&
                              cell.course &&
                              cn(cell.course.color, "shadow-md text-gray-900 dark:text-gray-100"),
                            cell.kind === "gap" &&
                              "animate-pulse border-yellow-500/60 bg-yellow-500/20 text-yellow-600 dark:text-yellow-200",
                            cell.kind === "empty" &&
                              cn(
                                "border-dashed border-zinc-300/90 bg-zinc-100/50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-600",
                                isToday &&
                                  "border-amber-400/70 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10"
                              )
                          )}
                        >
                          {/*
                            A merged run in compact density stacks its real
                            slots down the tile instead of printing
                            `"L31 +1"` on one truncated line. The rowspan has
                            already bought the height, the two halves then carry
                            identical colour, and the eye reads "L31 / +L32" as
                            one sitting rather than a count of hidden slots.
                          */}
                          {compact && cell.kind === "course" && spans ? (
                            <span className="flex flex-col items-center leading-[1.15] px-0.5">
                              {cell.slots.map((slot, i) => (
                                <span
                                  key={`${slot}-${i}`}
                                  className={cn(
                                    "text-[10px] leading-[1.15]",
                                    i === 0 ? "font-black" : "font-bold opacity-75"
                                  )}
                                >
                                  {i === 0 ? slot : `+${slot}`}
                                </span>
                              ))}
                            </span>
                          ) : (
                            cellLabel(cell) && (
                              <span
                                className={cn(
                                  "leading-tight",
                                  compact
                                    ? "w-full truncate text-[10px]"
                                    : "break-all text-[11px]",
                                  cell.kind === "course" ? "font-black" : "font-bold",
                                  cell.kind === "empty" && "opacity-60"
                                )}
                              >
                                {cellLabel(cell)}
                              </span>
                            )
                          )}
                          {!compact && cell.kind === "course" && cell.course && (
                            <span className="w-full truncate text-center text-[9px] font-semibold leading-tight">
                              {cell.course.code}
                            </span>
                          )}
                          {!compact && cell.blocked && (
                            <span className="text-[8px] font-black uppercase leading-tight tracking-wider">
                              Blocked
                            </span>
                          )}
                          {!compact && !cell.blocked && cell.partiallyBlocked && (
                            <span className="text-[8px] font-bold uppercase leading-tight tracking-wider opacity-80">
                              Partly blocked
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-medium text-zinc-500 dark:text-zinc-400",
          compact ? "gap-x-2.5 text-[9px]" : "text-[10px]"
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-dashed border-zinc-300 dark:border-zinc-800" />
          free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-zinc-300 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
          class
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-red-500/40 bg-red-500/30" />
          blocked
        </span>
        {today && grid.days.some((d) => d.id.toLowerCase() === today) && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10" />
            today
          </span>
        )}
      </div>

      <AnimatePresence>
        {activeCell && (
          <SlotDetailSheet
            cell={activeCell}
            dayName={
              grid.days.find((d) => d.id === activeCell.dayId)?.name ?? activeCell.dayId
            }
            blockedSlots={blockedSlots}
            onToggleBlockSlot={onToggleBlockSlot}
            attendanceByCourse={attendanceByCourse}
            onClose={() => setActiveCell(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
