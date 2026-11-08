"use client";

import { useMemo } from "react";
import { CourseDot, SlotBadge, courseColor } from "@amazecontinuityprojects/amazeui";
import { getAttendanceTimeRange } from "@/lib/attendanceTimetable";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";

interface DayClass {
  courseCode?: string;
  courseTitle?: string;
  faculty?: string;
  slotName?: string;
  time?: string;
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function span(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/**
 * Calm Notebook "now / next" card. While a class runs it shows that class,
 * how long is left, and a thin progress line in the course hue; underneath it
 * names the next class. Between classes it shows the next one and when it
 * starts. After the last class it says the day is done.
 */
export function HomeNowNext({
  classes,
  now,
  onOpenCourse,
  className,
}: {
  classes: DayClass[];
  now: Date;
  onOpenCourse?: (code: string) => void;
  className?: string;
}) {
  const view = useMemo(() => {
    const mins = now.getHours() * 60 + now.getMinutes();
    const timed = classes
      .map((c) => ({ c, ...getAttendanceTimeRange(c.time || "") }))
      .filter((x) => x.end > x.start)
      .sort((a, b) => a.start - b.start);
    const live = timed.find((x) => mins >= x.start && mins < x.end) ?? null;
    const next = timed.find((x) => x.start > mins) ?? null;
    return { mins, live, next, total: timed.length };
  }, [classes, now]);

  if (view.total === 0) return null;
  const { mins, live, next } = view;
  const hero = live ?? next;

  if (!hero) {
    return (
      <section aria-label="Today" className={cn("rounded-md border border-line bg-surface px-4 py-3.5 text-left", className)}>
        <p className="text-[12.5px] text-muted">Today</p>
        <p className="mt-0.5 text-[15px] font-medium text-ink">
          Done for the day · {view.total} class{view.total === 1 ? "" : "es"}
        </p>
      </section>
    );
  }

  const code = String(hero.c.courseCode || "");
  const progress = live ? Math.round(((mins - live.start) / (live.end - live.start)) * 100) : 0;

  return (
    <section
      aria-label={live ? "Class in progress" : "Next class"}
      className={cn("relative overflow-hidden rounded-md border border-line bg-surface text-left", className)}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: courseColor(code || "x") }} />
      <button
        type="button"
        onClick={() => code && onOpenCourse?.(code)}
        className="grid w-full gap-2.5 px-4 py-3.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="flex items-center justify-between gap-3 text-[12.5px] text-muted">
          <span>{live ? `Now · ends ${fmt(live.end)}` : `Next · ${fmt(hero.start)}`}</span>
          <span className="font-mono tabular-nums">
            {live ? `${span(live.end - mins)} left` : `in ${span(hero.start - mins)}`}
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <CourseDot course={code} className="mt-[7px]" />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-snug text-ink">{hero.c.courseTitle || code}</p>
            <p className="mt-0.5 truncate font-mono text-[12.5px] text-ink-2">
              {[hero.c.slotName, hero.c.faculty ? titleCase(String(hero.c.faculty)) : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {live && (
          <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, progress))}%`, background: courseColor(code || "x") }} />
          </div>
        )}
      </button>
      {live && next && (
        <div className="flex items-center justify-between gap-3 border-t border-line-2 px-4 py-2.5 text-[13.5px]">
          <span className="min-w-0 truncate">
            <span className="text-muted">Next </span>
            <span className="font-mono text-ink-2">{fmt(next.start)}</span>{" "}
            <span className="text-ink">{next.c.courseTitle || next.c.courseCode}</span>
          </span>
          {next.c.slotName && <SlotBadge course={String(next.c.courseCode || "")}>{next.c.slotName}</SlotBadge>}
        </div>
      )}
    </section>
  );
}

/** Up to three open tasks due in the next seven days, soonest first. */
export function HomeDueSoon({
  tasks,
  now,
  onOpenTasks,
  className,
}: {
  tasks: Task[] | undefined;
  now: Date;
  onOpenTasks?: () => void;
  className?: string;
}) {
  const due = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    const start = now.getTime();
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return tasks
      .filter((t) => t.status !== "done" && t.dueDate)
      .map((t) => ({ t, at: new Date(t.dueDate as string).getTime() }))
      .filter((x) => !Number.isNaN(x.at) && x.at >= start - 12 * 3600 * 1000 && x.at <= end)
      .sort((a, b) => a.at - b.at)
      .slice(0, 3);
  }, [tasks, now]);

  if (due.length === 0) return null;
  const today = now.toDateString();

  return (
    <section aria-label="Due this week" className={cn("text-left", className)}>
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <h2 className="text-[13.5px] font-semibold text-ink">Due this week</h2>
        {onOpenTasks && (
          <button type="button" onClick={onOpenTasks} className="text-[13px] text-accent hover:underline">
            Tasks
          </button>
        )}
      </div>
      <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
        {due.map(({ t, at }) => {
          const d = new Date(at);
          const isToday = d.toDateString() === today;
          const soon = at - now.getTime() < 36 * 3600 * 1000;
          const day = isToday ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" });
          return (
            <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5">
              <CourseDot course={t.courseCode || t.title} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-ink">{t.title}</span>
                <span className="block truncate text-[12px] text-muted">
                  {t.courseTitleSnapshot || t.courseCode}
                </span>
              </span>
              <span className="text-right">
                <span className={cn("block text-[14px] font-semibold", soon ? "text-warn" : "text-ink")}>{day}</span>
                <span className="block font-mono text-[12px] text-muted">{fmt(d.getHours() * 60 + d.getMinutes())}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
