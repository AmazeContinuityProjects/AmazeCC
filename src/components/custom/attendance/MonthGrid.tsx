"use client";

import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "@amazecontinuityprojects/amazeui";
import { ChipTabs, ToneDot, ToneLegend } from "../shared/primitives";
import {
  dayMarkers,
  leadingBlanks,
  LEGEND_ITEMS,
  todayKey,
  WEEKDAY_SHORT,
  type CalendarDayModel,
  type CalendarMonthModel,
} from "@/lib/calendarDay";

/** The squircle the Theory and Lab log grids already use. */
const CELL =
  "relative aspect-square rounded-[12px] flex flex-col items-center justify-center gap-1 transition-colors duration-150 cursor-pointer";

/**
 * Day-type tint.
 *
 * Only two day types are tinted. `nonInstructional` is a *working* day at an
 * open college — there just is no teaching — so tinting it like a holiday
 * would paint a normal day red. It gets no fill and reads through its dot row
 * and the legend instead. `holiday` is the only genuinely-red day, and
 * `semiholiday` amber because a shortened list is still a list.
 */
const TINT: Record<CalendarDayModel["dayType"], string> = {
  instructional: "",
  semiholiday: "bg-amber-500/10 dark:bg-amber-500/10",
  nonInstructional: "",
  holiday: "bg-red-500/10 dark:bg-red-500/10",
  other: "",
};

const DAY_TYPE_TEXT: Record<CalendarDayModel["dayType"], string> = {
  instructional: "Instructional day",
  semiholiday: "Shortened day",
  nonInstructional: "No classes, college open",
  holiday: "Holiday",
  other: "Not in the calendar",
};

const RING = "ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400";

/**
 * The month grid.
 *
 * Built on the same squircle the Theory and Lab log pages already draw
 * (`AttendanceCalendarView`, compact mode): `aspect-square` cells, a neon dot
 * under the number, mild tint instead of a heavy fill. Those pages show
 * attendance status, which is one bit; this grid has to show up to five
 * concurrent things, so it spends the cell's second line on tone dots instead
 * of a status word.
 *
 * The old page's grid was the opposite trade: a `min-h-20` cell with a pill, a
 * hidden "+N more" line, and a 256px hover tooltip on every cell. A tooltip
 * that has to be hovered to be read is a tooltip that a phone never shows, so
 * the day sheet is the drill-down now and the cell only has to say "there is
 * something here".
 */
export default function MonthGrid({
  months,
  activeIndex,
  onMonthChange,
  onSelectDay,
  selectedDateKey = null,
  className = "",
}: {
  months: CalendarMonthModel[];
  activeIndex: number;
  onMonthChange: (index: number) => void;
  onSelectDay: (day: CalendarDayModel, month: CalendarMonthModel) => void;
  /** Ring on the day the sheet is open for. */
  selectedDateKey?: string | null;
  className?: string;
}) {
  const today = todayKey();
  const month = months[activeIndex];
  const blanks = useMemo(
    () => (month ? leadingBlanks(month.year, month.monthIndex) : 0),
    [month]
  );

  if (!month) {
    return (
      <div className={cn("p-8 text-center text-xs font-bold text-zinc-400", className)}>
        No calendar loaded.
      </div>
    );
  }

  const monthOptions = months.map((m) => ({ value: m.id, label: m.shortLabel, title: m.label }));

  return (
    <div className={cn("w-full min-w-0 flex flex-col gap-3", className)}>
      <ChipTabs
        options={monthOptions}
        value={month.id}
        onChange={(id) => onMonthChange(months.findIndex((m) => m.id === id))}
      />

      <AnimatePresence mode="wait">
        <m.div
          key={month.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full grid grid-cols-7 gap-1 text-center"
        >
          {WEEKDAY_SHORT.map((day) => (
            <div
              key={day}
              className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 py-1"
            >
              {day.slice(0, 2)}
            </div>
          ))}

          {Array.from({ length: blanks }, (_, i) => (
            <div key={`blank-${i}`} className="aspect-square" aria-hidden="true" />
          ))}

          {month.days.map((day) => {
            const isToday = day.dateKey === today;
            const isSelected = day.dateKey === selectedDateKey;
            const markers = dayMarkers(day);
            const eventCount = day.events.filter(
              (e) => e.kind !== "class" && e.kind !== "working"
            ).length;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => onSelectDay(day, month)}
                title={`${formatDayLabel(day)} · ${DAY_TYPE_TEXT[day.dayType]}`}
                aria-label={`${formatDayLabel(day)}, ${DAY_TYPE_TEXT[day.dayType]}${
                  eventCount ? `, ${eventCount} events` : ""
                }${day.taskCount ? `, ${day.taskCount} tasks due` : ""}`}
                // A day cell navigates, it does not toggle: `aria-current="date"`
                // is the honest annotation, and the selected ring is visual only.
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  CELL,
                  TINT[day.dayType],
                  isSelected && RING,
                  isToday && !isSelected && "ring-1 ring-inset ring-zinc-400 dark:ring-zinc-600",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 active:scale-95"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-black font-outfit leading-none",
                    day.dayType === "holiday"
                      ? "text-red-600 dark:text-red-400"
                      : day.dayType === "semiholiday"
                        ? "text-amber-600 dark:text-amber-400"
                        : day.dayType === "nonInstructional"
                          ? "text-sky-600 dark:text-sky-400"
                          : "text-zinc-900 dark:text-white"
                  )}
                >
                  {day.date}
                </span>

                {/* Dots are the cell's second line. With one dot it sits in the
                    same optical position as the theory/lab grids; with three it
                    wraps to a cluster, which is the signal that the day is
                    worth opening. */}
                <span className="flex items-center gap-0.5 h-1.5">
                  {markers.length > 0 ? (
                    markers.map((tone, i) => <ToneDot key={`${tone}-${i}`} tone={tone} />)
                  ) : (
                    // No events: one hollow slot, so every cell is the same
                    // height and the grid does not breathe when you switch
                    // months.
                    <span className="w-1.5 h-1.5" />
                  )}
                </span>
              </button>
            );
          })}
        </m.div>
      </AnimatePresence>

      <ToneLegend items={LEGEND_ITEMS} />
    </div>
  );
}

function formatDayLabel(day: CalendarDayModel): string {
  return day.fullDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
