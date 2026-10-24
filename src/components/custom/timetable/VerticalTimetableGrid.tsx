"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  cn,
  type AddedCourse,
  type GapDetail,
  type TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import {
  buildVerticalGrid,
  describeCell,
  type Cell,
} from "./buildBands";
import { hasSlot, ensureLunchPeriod } from "@/lib/slots";
import SlotDetailSheet from "./SlotDetailSheet";
import type { AttendanceTone } from "./SlotDetailSheet";
import TimetableGridShell, {
  useTodayKey,
  type ShellCell,
  type ShellDay,
} from "./TimetableGridShell";

/**
 * The mobile-first vertical timetable.
 *
 * Days run across the top, times down the left, one cell per (day, band) — the
 * transpose of the horizontal grid. The table itself lives in
 * `TimetableGridShell`, which the social grid draws through as well; this file
 * owns only what is about *courses* — which course a cell holds, how a run is
 * merged, and what the tap sheet says.
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
  showSlotNames = false,
  className,
  backdropZIndex,
  panelZIndex,
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
  /** When true, renders slot names (e.g. A1 / L1) on all cells (empty, blocked, and course). */
  showSlotNames?: boolean;
  className?: string;
  /**
   * z-index for the slot detail sheet. Defaults to the sheet's own (55/60);
   * a surface rendered above that (a modal at z-300) passes a higher pair so
   * the sheet it summons is not hidden behind it.
   */
  backdropZIndex?: number;
  panelZIndex?: number;
}) {
  const [activeCell, setActiveCell] = useState<Cell | null>(null);
  const today = useTodayKey();

  const effectiveTheory = useMemo(() => ensureLunchPeriod(theoryPeriods), [theoryPeriods]);
  const effectiveLab = useMemo(() => ensureLunchPeriod(labPeriods), [labPeriods]);

  const grid = useMemo(
    () =>
      buildVerticalGrid({
        courses,
        theoryPeriods: effectiveTheory,
        labPeriods: effectiveLab,
        days,
        blockedSlots,
        selectedGapDetails,
      }),
    // `days` is a fresh array literal at some call sites, so key the memo on its
    // contents rather than its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, effectiveTheory, effectiveLab, days?.map((d) => d.id).join(","), blockedSlots, selectedGapDetails]
  );

  if (grid.bands.length === 0 || grid.days.length === 0) return null;

  const handleTap = (cell: Cell) => {
    if (onToggleBlockSlot) {
      if (cell.slots.length > 0) {
        const allBlocked = cell.slots.every((s) => hasSlot(Array.from(blockedSlots || []), s));
        cell.slots.forEach((s) => {
          const isB = hasSlot(Array.from(blockedSlots || []), s);
          if (allBlocked) {
            if (isB) onToggleBlockSlot(s);
          } else {
            if (!isB) onToggleBlockSlot(s);
          }
        });
      }
    } else {
      setActiveCell(cell);
    }
  };

  /**
   * In compact, a cell is labelled only when a course occupies it. Everything
   * else reads from colour alone — see the density note in the header comment.
   */
  const cellLabel = (cell: Cell) => {
    if (showSlotNames) {
      if (cell.course) return cell.shortLabel || cell.label;
      return cell.label || (cell.slots.length > 0 ? cell.slots.join(" / ") : "");
    }
    if (compact) return cell.course ? cell.shortLabel : "";
    return cell.label || "—";
  };

  /** The tile's contents. */
  const cellContent = (cell: Cell, spans: boolean) => {
    if (showSlotNames) {
      if (cell.kind === "course" && cell.course) {
        return (
          <div className="flex flex-col items-center justify-center w-full min-w-0 leading-none px-0.5">
            <span className="font-black text-[10px] leading-tight truncate w-full text-center">
              {cell.course.code}
            </span>
            <span className="font-mono text-[8.5px] opacity-90 font-bold leading-tight truncate">
              {cell.slots.join("+")}
            </span>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center w-full min-w-0 leading-tight px-0.5 select-none">
          {cell.slots.length > 0 ? (
            cell.slots.map((slot, i) => {
              const isTheory = !slot.startsWith("L") && slot !== "NIL";
              const isSlotBlocked = blockedSlots ? hasSlot(Array.from(blockedSlots), slot) : false;
              return (
                <span
                  key={`${slot}-${i}`}
                  role={onToggleBlockSlot ? "button" : undefined}
                  tabIndex={onToggleBlockSlot ? 0 : undefined}
                  onClick={(e) => {
                    if (onToggleBlockSlot) {
                      e.stopPropagation();
                      onToggleBlockSlot(slot);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (onToggleBlockSlot && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleBlockSlot(slot);
                    }
                  }}
                  className={cn(
                    "font-mono font-black tracking-tight rounded px-1 transition-all inline-block",
                    cell.slots.length === 1 ? "text-[10px]" : i === 0 ? "text-[9px]" : "text-[8px]",
                    onToggleBlockSlot && "cursor-pointer active:scale-90 hover:ring-1 hover:ring-zinc-400",
                    isSlotBlocked
                      ? "text-rose-300 line-through bg-rose-500/20 border border-rose-500/30"
                      : isTheory
                      ? "text-zinc-200 dark:text-zinc-100 hover:bg-zinc-800/60"
                      : "text-zinc-400 dark:text-zinc-400 hover:bg-zinc-800/60"
                  )}
                  title={`${slot} (${isTheory ? "Theory" : "Lab"})${isSlotBlocked ? " - Blocked" : " - Available"}${onToggleBlockSlot ? " (Tap to toggle)" : ""}`}
                >
                  {slot}
                </span>
              );
            })
          ) : (
            <span className="text-[8px] opacity-40 font-mono">—</span>
          )}
        </div>
      );
    }

    return (
      <>
        {/*
          A merged run in compact density stacks its real slots down the tile
          instead of printing `"L31 +1"` on one truncated line. The rowspan has
          already bought the height, the two halves then carry identical colour,
          and the eye reads "L31 / +L32" as one sitting rather than a count of
          hidden slots.
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
      </>
    );
  };

  const renderCell = (band: (typeof grid.bands)[number], day: ShellDay): ShellCell | null => {
    const cell = grid.cells[day.id]?.[band.index];
    // null means a rowSpan from an earlier band already covers this position.
    if (!cell) return null;

    const isToday = day.id.toLowerCase() === today;
    const described = describeCell(cell, day.name.substring(0, 3));
    const spans = cell.bandCount > 1;

    return {
      content: cellContent(cell, spans),
      rowSpan: spans ? cell.bandCount : undefined,
      title: described,
      ariaLabel: described,
      onClick: () => handleTap(cell),
      tileClassName: cn(
        cell.kind === "blocked" &&
          "border-red-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(239,68,68,0.3)_2px,rgba(239,68,68,0.3)_4px)] bg-red-950/40 text-red-200 shadow-inner",
        cell.kind !== "blocked" &&
          cell.partiallyBlocked &&
          "border-amber-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(245,158,11,0.15)_2px,rgba(245,158,11,0.15)_4px)] bg-amber-950/20 text-amber-200 shadow-inner",
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
      ),
    };
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      <TimetableGridShell
        bands={grid.bands}
        days={grid.days}
        renderCell={renderCell}
        compact={compact}
        today={today}
      />

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
            backdropZIndex={backdropZIndex}
            panelZIndex={panelZIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
