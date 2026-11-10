import type { Task } from "@/types/tasks";
import { sanitizeCourseCode } from "./taskMatch";

/**
 * Moving to a new semester.
 *
 * Changing the semester in settings already re-syncs, but it leaves the old
 * term's tasks around and relies on the past-semester backfill to keep last
 * term's attendance and marks. The new-semester wizard does the changeover in
 * one go; these are its pure parts.
 */

export const DISMISS_KEY = "semester_wizard_dismissed";
export const OPEN_EVENT = "amazecc:open-semester-wizard";

/**
 * The semester the app treats as current: the second-to-last entry of
 * config.json's semesterIDs. The last entry is the upcoming term, added early
 * for FFCS registration; settings defaults and fresh sign-ins use this same
 * rule (settingsAtoms.ts, useAppDataActions.ts).
 */
export function currentTermOf(known: readonly string[]): string | null {
  if (known.length === 0) return null;
  return known.length >= 2 ? known[known.length - 2] : known[0];
}

/**
 * The semester to move a student to, or null when they are already on it (or
 * later). Unknown or empty current semesters return null: without a baseline
 * we would only be guessing.
 */
export function newerSemester(current: string | null | undefined, known: readonly string[]): string | null {
  const target = currentTermOf(known);
  if (!current || !target) return null;
  const i = known.indexOf(current);
  if (i === -1) return null;
  return i < known.indexOf(target) ? target : null;
}

export function isDismissed(latest: string, store: Pick<Storage, "getItem"> = localStorage): boolean {
  try {
    return store.getItem(DISMISS_KEY) === latest;
  } catch {
    return false;
  }
}

export function dismiss(latest: string, store: Pick<Storage, "setItem"> = localStorage): void {
  try {
    store.setItem(DISMISS_KEY, latest);
  } catch {
    /* storage blocked: the prompt comes back next visit */
  }
}

/**
 * Keep the outgoing term's attendance and marks in the same `frozen_*` keys
 * the past-semester backfill writes, so grade history and the student report
 * have them without another VTOP round trip. Never overwrites an existing
 * snapshot.
 */
export function archiveSemester(
  semesterId: string,
  store: Pick<Storage, "getItem" | "setItem"> = localStorage,
): { attendance: boolean; marks: boolean } {
  const out = { attendance: false, marks: false };
  const copy = (from: string, to: string, hasRows: (v: any) => boolean) => {
    if (store.getItem(to) !== null) return false;
    const raw = store.getItem(from);
    if (!raw) return false;
    try {
      if (!hasRows(JSON.parse(raw))) return false;
    } catch {
      return false;
    }
    store.setItem(to, raw);
    return true;
  };
  out.attendance = copy(
    "attendance",
    `frozen_att_${semesterId}`,
    (v) => Array.isArray(v?.attendance) && v.attendance.length > 0,
  );
  out.marks = copy("marks", `frozen_marks_${semesterId}`, (v) => Array.isArray(v?.courses) && v.courses.length > 0);
  return out;
}

/** Course codes of the outgoing term, from its attendance, in task form. */
export function courseCodesFrom(
  attendance: { attendance?: { courseCode?: string }[] } | null | undefined,
): Set<string> {
  const codes = new Set<string>();
  for (const c of attendance?.attendance ?? []) {
    const code = sanitizeCourseCode(c?.courseCode ?? "");
    if (code) codes.add(code);
  }
  return codes;
}

export interface TaskCleanup {
  done: Task[];
  oldCourse: Task[];
}

/** Which tasks the wizard offers to clear: finished ones, and open ones for last term's courses. */
export function planTaskCleanup(tasks: readonly Task[], oldCourses: ReadonlySet<string>): TaskCleanup {
  const done = tasks.filter((t) => t.status === "done");
  const oldCourse = tasks.filter((t) => t.status !== "done" && t.courseCode && oldCourses.has(t.courseCode));
  return { done, oldCourse };
}

export function applyTaskCleanup(
  tasks: readonly Task[],
  plan: TaskCleanup,
  opts: { removeDone: boolean; removeOldCourse: boolean },
): Task[] {
  const drop = new Set<string>([
    ...(opts.removeDone ? plan.done.map((t) => t.id) : []),
    ...(opts.removeOldCourse ? plan.oldCourse.map((t) => t.id) : []),
  ]);
  return tasks.filter((t) => !drop.has(t.id));
}
