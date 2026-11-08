"use client";

import { useMemo } from "react";
import { courseColor } from "@amazecontinuityprojects/amazeui";
import { getAttendanceTimeRange } from "@/lib/attendanceTimetable";
import { cn } from "@/lib/utils";

interface Card {
  courseCode?: string;
  courseTitle?: string;
  slotName?: string;
  time?: string;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DAY_LABEL: Record<string, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function hh(min: number) {
  return String(Math.floor(min / 60)).padStart(2, "0");
}

/**
 * Calm Notebook week grid ("Her week" / "Slot map" on the canvas): one row per
 * teaching day, one column per period start, each period filled in its
 * course's colour. Labs cover two periods, so they read as a wider block. The
 * class running now is outlined, earlier classes today fade back, and
 * weekend rows only appear when something is scheduled on them.
 */
export default function WeekSlotMap({
  map,
  today,
  now,
  selectedDay,
  onSelectDay,
  className,
}: {
  map: Partial<Record<string, Card[]>>;
  today: string;
  now: Date;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  className?: string;
}) {
  const grid = useMemo(() => {
    const rows = DAYS.map((d) => ({
      day: d,
      blocks: (map[d] || [])
        .map((c) => ({ c, ...getAttendanceTimeRange(c.time || "") }))
        .filter((b) => b.end > b.start),
    })).filter((r) => r.blocks.length > 0 || !["SAT", "SUN"].includes(r.day));
    const starts = new Set<number>();
    for (const r of rows) for (const b of r.blocks) starts.add(b.start);
    // A lab's second period starts ~50 min in; make sure it gets its own column.
    for (const r of rows)
      for (const b of r.blocks) if (b.end - b.start > 70) starts.add(b.start + Math.round((b.end - b.start) / 2));
    const cols = [...starts].sort((a, b) => a - b).filter((m, i, arr) => i === 0 || m - arr[i - 1] >= 30);
    const totalMin = rows.reduce((acc, r) => acc + r.blocks.reduce((a, b) => a + (b.end - b.start), 0), 0);
    const count = rows.reduce((acc, r) => acc + r.blocks.length, 0);
    return { rows, cols, totalMin, count };
  }, [map]);

  if (grid.count === 0 || grid.cols.length === 0) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  // Hour labels under the grid: only where the hour changes, so they never crowd.
  let lastHour = "";

  return (
    <section aria-label="This week" className={cn("text-left", className)}>
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <h2 className="text-[13.5px] font-semibold text-ink">This week</h2>
        <span className="font-mono text-[12px] text-muted">
          {grid.count} classes · {Math.round(grid.totalMin / 60)} h
        </span>
      </div>
      <div className="rounded-md border border-line bg-surface p-3">
        <div
          className="grid items-center gap-x-1 gap-y-1.5"
          style={{ gridTemplateColumns: `2.25rem repeat(${grid.cols.length}, minmax(0, 1fr))` }}
        >
          {grid.rows.map((r) => {
            const isToday = r.day === today;
            const isWeekend = r.day === "SAT" || r.day === "SUN";
            const isSelected = selectedDay === r.day;
            return [
              <button
                key={`${r.day}-label`}
                type="button"
                onClick={() => onSelectDay?.(r.day)}
                className={cn(
                  "h-6 text-left font-mono text-[11px] transition-colors duration-[120ms]",
                  isSelected || isToday ? "font-semibold text-ink" : isWeekend ? "text-muted/70" : "text-muted",
                )}
              >
                {DAY_LABEL[r.day]}
              </button>,
              ...grid.cols.map((col) => {
                const b = r.blocks.find((x) => col >= x.start && col < x.end);
                if (!b) {
                  return (
                    <span
                      key={`${r.day}-${col}`}
                      aria-hidden="true"
                      className={cn("h-6 rounded-[4px] bg-surface-2", isWeekend && "opacity-60")}
                    />
                  );
                }
                const code = String(b.c.courseCode || b.c.slotName || "x");
                const live = isToday && mins >= b.start && mins < b.end;
                const past = isToday && mins >= b.end;
                return (
                  <button
                    key={`${r.day}-${col}`}
                    type="button"
                    onClick={() => onSelectDay?.(r.day)}
                    title={`${DAY_LABEL[r.day]} ${hh(b.start)}:${String(b.start % 60).padStart(2, "0")} · ${b.c.courseTitle || code}${b.c.slotName ? ` · ${b.c.slotName}` : ""}`}
                    aria-label={`${DAY_LABEL[r.day]}, ${b.c.courseTitle || code}`}
                    className={cn(
                      "h-6 rounded-[4px] transition-opacity duration-[120ms] hover:opacity-80",
                      past && "opacity-40",
                      live && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                    )}
                    style={{ background: courseColor(code) }}
                  />
                );
              }),
            ];
          })}
          <span />
          {grid.cols.map((col) => {
            const h = hh(col);
            const show = h !== lastHour;
            lastHour = h;
            return (
              <span key={`h-${col}`} className="pt-1 font-mono text-[10.5px] text-muted">
                {show ? h : ""}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
