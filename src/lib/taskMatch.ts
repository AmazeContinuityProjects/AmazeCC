import { parseAttendanceTime, AttendanceDay } from "./attendanceTimetable";
import type { Task, WeekChunk } from "@/types/tasks";

/**
 * Base course code without the (T)/(L)/(P) component suffix.
 * Mirrors `sanitizeCourseCode` in components/custom/exams/courseHelpers.tsx
 */
export function sanitizeCourseCode(code: any): string {
  if (code == null) return "";
  const cleaned = String(code)
    .replace(/\s*\([LPT]\)$/i, "")
    .trim();
  return cleaned.toLowerCase() === "" ||
    ["nil", "null", "undefined", "n/a", "na", "-", "--", "none"].includes(
      cleaned.toLowerCase()
    )
    ? ""
    : cleaned;
}

export function toMinutes(t: string): number | null {
  const mins = parseAttendanceTime(t);
  return Number.isFinite(mins) ? mins : null;
}

export function getComponentType(course: {
  courseCode?: string;
  courseType?: string;
  slotName?: string;
  slot?: string;
}): "theory" | "lab" {
  const code = String(course.courseCode || "").toLowerCase();
  const type = String(course.courseType || "").toLowerCase();
  const slot = String(course.slotName || course.slot || "").toLowerCase();
  if (
    code.endsWith("(l)") ||
    code.endsWith("(p)") ||
    type.includes("lab") ||
    type.includes("practical") ||
    slot.startsWith("l")
  ) {
    return "lab";
  }
  return "theory";
}

export function taskMatchesClass(
  task: Pick<Task, "courseCode" | "component">,
  cls: { courseCode?: string; courseType?: string; slotName?: string; slot?: string }
): boolean {
  if (!task.courseCode) return false;
  if (sanitizeCourseCode(cls.courseCode || "") !== task.courseCode) return false;
  if (task.component === "both") return true;
  return getComponentType(cls) === task.component;
}

/**
 * Get all active tasks for a specific timetable class.
 * Filters by course & component, optional day & time range. Non-done first,
 * tests then digital assignments.
 */
export function tasksForClass(
  tasks: Task[],
  cls: { courseCode?: string; courseType?: string; slotName?: string; slot?: string },
  day?: string,
  timeRange?: { start: number; end: number }
): Task[] {
  return tasks
    .filter((t) => {
      if (t.status === "done" || !taskMatchesClass(t, cls)) return false;
      if (!day || !timeRange || t.schedule.length === 0) return true;
      return t.schedule.some((c) => {
        if (c.day !== day) return false;
        const s = toMinutes(c.start);
        const e = toMinutes(c.end);
        return s !== null && e !== null && s < timeRange.end && timeRange.start < e;
      });
    })
    .sort((a, b) => {
      if (a.kind === "test" && b.kind !== "test") return -1;
      if (b.kind === "test" && a.kind !== "test") return 1;
      if (a.kind === "digital-assignment" && b.kind !== "digital-assignment") return -1;
      if (b.kind === "digital-assignment" && a.kind !== "digital-assignment") return 1;
      return 0;
    });
}

export interface TodayBreakdown {
  /** Tasks that may claim a "…today" label on the viewed card */
  total: number;
  tests: number;
  das: number;
  /** Of those: chunked to this exact session (day + time overlap) */
  sessionTotal: number;
  /** Of those: only a due date on this day, no session chunk */
  dueTotal: number;
}

export interface ClassTaskSummary {
  total: number;
  tests: number;
  das: number;
  pending: number;
  /**
   * Today-scoped breakdown. All zeros unless the caller passes
   * `literalToday`, so a browsed day can never render a "…today" label.
   */
  today: TodayBreakdown;
}

/** Same calendar day, local time. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Same calendar day check, tolerant of ISO strings and Date inputs. */
export function isDueOnDay(due: string | Date | undefined, dayDate: Date): boolean {
  if (!due) return false;
  const d = due instanceof Date ? due : new Date(due);
  if (isNaN(d.getTime())) return false;
  return isSameCalendarDay(d, dayDate);
}

/**
 * Tasks chunked to a specific session: a week chunk on `day` whose interval
 * overlaps the class time range.
 */
export function tasksForClassSession(
  tasks: Task[],
  cls: { courseCode?: string; courseType?: string; slotName?: string; slot?: string },
  day: string,
  timeRange: { start: number; end: number }
): Task[] {
  return tasks.filter((t) => {
    if (t.status === "done" || !taskMatchesClass(t, cls)) return false;
    return (t.schedule || []).some((c) => {
      if (c.day !== day) return false;
      const s = toMinutes(c.start);
      const e = toMinutes(c.end);
      return s !== null && e !== null && s < timeRange.end && timeRange.start < e;
    });
  });
}

export interface ClassTaskSummaryOptions {
  /** Calendar date of the day shown on the card (for the due-today rule) */
  dayDate?: Date;
  /** True only when the card is showing the real current date */
  literalToday?: boolean;
}

export function classTaskSummary(
  tasks: Task[],
  cls: { courseCode?: string; courseType?: string; slotName?: string; slot?: string },
  day?: string,
  timeRange?: { start: number; end: number },
  opts?: ClassTaskSummaryOptions
): ClassTaskSummary {
  const matched = tasksForClass(tasks, cls, day, timeRange);
  const summary: ClassTaskSummary = {
    total: matched.length,
    tests: matched.filter((t) => t.kind === "test").length,
    das: matched.filter((t) => t.kind === "digital-assignment").length,
    pending: matched.filter((t) => t.status === "pending").length,
    today: { total: 0, tests: 0, das: 0, sessionTotal: 0, dueTotal: 0 },
  };

  // Session-today / due-today labels are only ever claimed for the real
  // current date, so browsing to another weekday stays generic.
  if (!opts?.literalToday) return summary;

  const sessionIds = new Set<string>();
  if (day && timeRange) {
    for (const t of tasksForClassSession(tasks, cls, day, timeRange)) {
      sessionIds.add(t.id);
    }
  }

  const dayDate = opts.dayDate || new Date();
  for (const t of matched) {
    const inSession = sessionIds.has(t.id);
    const dueToday = !inSession && isDueOnDay(t.dueDate, dayDate);
    if (!inSession && !dueToday) continue;

    if (t.kind === "test") summary.today.tests += 1;
    else if (t.kind === "digital-assignment") summary.today.das += 1;
    summary.today.total += 1;
    if (inSession) summary.today.sessionTotal += 1;
    else summary.today.dueTotal += 1;
  }

  return summary;
}

/** Returns tasks that have chunks scheduled on `day`. */
export function tasksForDay(day: AttendanceDay, tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => t.status !== "done" && t.schedule?.some((c) => c.day === day)
  );
}

export interface ChunkOverlap {
  chunkA: WeekChunk;
  taskA: Task;
  chunkB: WeekChunk;
  taskB: Task;
}

/** Detects chunk overlaps between different tasks */
export function detectChunkOverlaps(tasks: Task[]): ChunkOverlap[] {
  const overlaps: ChunkOverlap[] = [];
  const activeTasks = tasks.filter((t) => t.status !== "done");

  for (let i = 0; i < activeTasks.length; i++) {
    const tA = activeTasks[i];
    for (const cA of tA.schedule || []) {
      const sA = toMinutes(cA.start);
      const eA = toMinutes(cA.end);
      if (sA === null || eA === null) continue;

      for (let j = i + 1; j < activeTasks.length; j++) {
        const tB = activeTasks[j];
        for (const cB of tB.schedule || []) {
          if (cA.day !== cB.day) continue;
          const sB = toMinutes(cB.start);
          const eB = toMinutes(cB.end);
          if (sB === null || eB === null) continue;

          // Check interval overlap: sA < eB and sB < eA
          if (sA < eB && sB < eA) {
            overlaps.push({
              chunkA: cA,
              taskA: tA,
              chunkB: cB,
              taskB: tB,
            });
          }
        }
      }
    }
  }

  return overlaps;
}

export function suggestPomodoros(
  chunkMinutes: number,
  focusMin = 25,
  breakMin = 5
): { rounds: number; focusMin: number; breakMin: number } {
  const safeFocus = Math.max(5, focusMin);
  const rounds = Math.max(1, Math.floor(chunkMinutes / (safeFocus + breakMin)));
  return { rounds, focusMin: safeFocus, breakMin };
}
