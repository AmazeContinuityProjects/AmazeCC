"use client";

/**
 * The table shell a band-per-row timetable is drawn in.
 *
 * Days run across the top, time bands down the left, one cell per (day, band)
 * — the transpose of the horizontal grid, and the shape the Full Weekly
 * Timetable sheet uses on a phone.
 *
 * ## Why this exists
 *
 * There are now two surfaces that draw a week in this shape and neither of
 * them owns the shape:
 *
 *   - the course timetable, whose cells carry a course and its colour;
 *   - the social grid, whose cells carry how many people are free.
 *
 * They agree on the parts that are not about the data — the sticky time
 * gutter, the sticky day header, the "today" ring, the lunch divider, the
 * `border-separate` + `border-spacing-1` spacing that gives the tiles their
 * clear borders. Those are the parts that are easy to get subtly wrong and
 * obvious when they are wrong, so they live here once.
 *
 * `border-collapse` would collapse those 2px borders into hairlines and the
 * `rowSpan` merges would fight the collapsed edges, which is why the table is
 * `border-separate`.
 *
 * ## The renderer contract
 *
 * `renderCell` returns the cell's content and its own styling, or `null` for
 * "this position is covered by a `rowSpan` from an earlier band" — in which
 * case **no `<td>` is emitted at all**. Emitting an empty `<td>` there would
 * push every later cell one column out of alignment.
 */

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@amazecontinuityprojects/amazeui";
import { dayKeyForDate } from "@/lib/social/schedule";
import { weekDateForDayId, type Band } from "./buildBands";

export type ShellDay = { id: string; name: string };

export type ShellCell = {
  /** What goes inside the tile. */
  content: ReactNode;
  /** Classes added to the tile button, after the shell's own. */
  tileClassName?: string;
  /** Classes added to the `<td>`. */
  className?: string;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
  /** The value for `rowSpan`. Omitted from the DOM when it is 1. */
  rowSpan?: number;
};

/**
 * The key of the day that is today, or `null` before it is known.
 *
 * A `new Date()` read, so it is resolved after mount rather than during
 * render — otherwise the static export would bake the build day's Monday into
 * the markup and every other day would be wrong.
 */
export function useTodayKey(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(dayKeyForDate(new Date()).toLowerCase());
  }, []);

  return today;
}

export default function TimetableGridShell({
  bands,
  days,
  renderCell,
  compact = false,
  today = null,
  className,
}: {
  bands: Band[];
  days: ShellDay[];
  renderCell: (band: Band, day: ShellDay) => ShellCell | null;
  /**
   * Slot only, sized to fit the viewport without scrolling.
   *
   * Compact gets NO overflow class on purpose. `table-fixed` + `w-full` is the
   * fit guarantee: under `table-fixed` the browser sizes columns from the
   * declared widths and ignores content, so no cell can push the table past
   * its container and nothing scrolls.
   *
   * That is also what keeps the sticky day header working. Any `overflow`
   * value on the wrapper — including `overflow-hidden` — makes it a scrollport,
   * and `position: sticky` resolves against the nearest scrollport, so the
   * `<th>`'s `sticky top-0` would bind to a box that cannot scroll and the
   * header would stop following you down a twelve-row week. Full density does
   * carry `overflow-x-auto`, because it genuinely does scroll, and that is the
   * same trade with the opposite answer.
   */
  compact?: boolean;
  /** Lower-cased day key of today, for the column highlight. */
  today?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
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
                  compact ? "w-12 min-w-12 text-[9px]" : "w-14 min-w-14 text-[9px]"
                )}
              >
                Time
              </th>
              {days.map((day) => {
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
                          compact ? "text-[9px]" : "text-[9px]"
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
            {bands.map((band) => {
              if (band.isLunch) {
                return (
                  <tr key={band.index}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 rounded-lg bg-white px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600"
                    >
                      {band.label}
                    </th>
                    <td colSpan={days.length} className="p-0 align-middle">
                      <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                  </tr>
                );
              }

              const cells = days.map((day) => renderCell(band, day));

              /**
               * A band swallowed by a `rowSpan` in *every* column is part of a
               * class that started higher up, so its own time label would read
               * as if a separate period began there. Blank the gutter in that
               * case. With one day a three-hour lab blanks two rows; with
               * seven days, only a column everyone shares does.
               */
              const fullyCovered = cells.every((cell) => cell === null);

              return (
                <tr key={band.index}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 rounded-lg bg-white dark:bg-zinc-950",
                      compact ? "w-12 min-w-12 px-0.5 py-0.5" : "w-14 min-w-14 px-1 py-1"
                    )}
                  >
                    {fullyCovered ? (
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
                        <span className="block text-[9px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
                          {band.endLabel}
                        </span>
                      </>
                    )}
                  </th>

                  {cells.map((cell, index) => {
                    // null means a rowSpan from an earlier band already covers
                    // this position. Rendering a td here would break the merge.
                    if (!cell) return null;

                    const day = days[index];
                    const spans = (cell.rowSpan ?? 1) > 1;
                    return (
                      <td
                        key={day.id}
                        // Left off entirely when 1, so the DOM says "no span"
                        // rather than a redundant rowspan="1" in a printout.
                        rowSpan={spans ? cell.rowSpan : undefined}
                        // A spanning cell has to give its <td> a containing
                        // block, because the tile is absolutely positioned to
                        // fill the whole run. Without this the tile keeps its own
                        // min-height and sits at the top of the span, so a
                        // two-slot lab reads as one block with a dead gap under
                        // it rather than one block.
                        className={cn("p-0", spans ? "relative" : "align-top", cell.className)}
                      >
                        <button
                          type="button"
                          onClick={cell.onClick}
                          title={cell.title}
                          aria-label={cell.ariaLabel}
                          className={cn(
                            "flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 transition-all duration-200 active:scale-95",
                            spans ? "absolute inset-0 h-full" : "relative",
                            compact
                              ? "min-h-[38px] overflow-hidden px-0.5 py-1"
                              : "min-h-[52px] px-1 py-1.5",
                            cell.tileClassName
                          )}
                        >
                          {cell.content}
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
    </div>
  );
}
