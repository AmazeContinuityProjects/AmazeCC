/**
 * "All Subjects Mode: OFF" — the drop ladder.
 *
 * Ported from FFCS-inator's toggle (`codechefvit/ffcs` →
 * `src/components/cards/CourseCard.tsx`): ON means only timetables containing
 * *every* selected course count; OFF means that when the courses cannot all
 * fit, the planner retries while leaving out the lowest-priority ones instead
 * of showing zero results.
 *
 * The retry itself lives in `hooks/useGenerationRun` (it has to drive the
 * worker); this module is the policy — pure, so the ladder's shape is pinned
 * by tests rather than by a worker round trip.
 *
 * Priority order is the **selected-course order**: courses enter the plan in
 * the order the student added them, which is the order the selected list
 * shows, and the same order the guided picker builds. The tail of that order is
 * what gets dropped first — "added last, needed least" matches how the source
 * feature's drag order reads, without inventing a second ordering UI.
 */

export interface DropPolicy {
  /** Selected course codes, highest priority first. */
  courseOrder: readonly string[];
  /**
   * Codes that must never be dropped.
   *
   * A course the student explicitly targeted — restricted slots, faculty, or
   * exact offerings in the Target Course Locker — means "I thought about this
   * one"; silently dropping it would break a stated intent. Unconstrained
   * selections are droppable.
   */
  protectedCodes?: readonly string[];
  /** How many courses may be left out in one retry ladder. Default {@link DEFAULT_MAX_DROPS}. */
  maxDrops?: number;
}

/**
 * Three, mirroring the source: enough to rescue a five- or six-course week
 * that is one unlucky slot apart, small enough that a "result" without four
 * courses would be a different plan rather than a fix.
 */
export const DEFAULT_MAX_DROPS = 3;

/** Retry only for "nothing matched" outcomes — never for a solver crash. */
export function isRetryableFailure(result: { kind: string; code?: string } | null | undefined): boolean {
  if (!result || result.kind !== "error") return false;
  return result.code !== "error" && result.code !== "no_courses_selected";
}

/**
 * The droppable codes, lowest priority first.
 *
 * Reversed once here so every consumer can speak in "next to drop" order.
 */
export function droppableTail(policy: DropPolicy): string[] {
  const protectedSet = new Set(policy.protectedCodes ?? []);
  const seen = new Set<string>();
  const droppable: string[] = [];
  for (const code of policy.courseOrder) {
    if (protectedSet.has(code) || seen.has(code)) continue;
    seen.add(code);
    droppable.push(code);
  }
  return droppable.reverse();
}

/**
 * The next course to drop after an attempt failed.
 *
 * Normally the lowest-priority course not yet dropped — the ladder drops the
 * tail cumulatively: `{last}`, `{last-1, last}`, `{last-2, last-1, last}`…
 * One exception: `no_valid_slots` names a course that has *no* valid offering
 * under the current filters, and no amount of shuffling other courses will fix
 * that. It jumps the queue, because it is the only failure that already told
 * us which course is the problem.
 */
export function nextDrop(
  droppableTailOrder: readonly string[],
  dropped: readonly string[],
  failure?: { kind: string; code?: string; subjectCode?: string } | null,
): string | null {
  const remaining = droppableTailOrder.filter((code) => !dropped.includes(code));
  if (!remaining.length) return null;
  if (failure && failure.kind === "error" && failure.code === "no_valid_slots" && failure.subjectCode) {
    const named = remaining.find((code) => code === failure.subjectCode);
    if (named) return named;
  }
  // `droppableTailOrder` is lowest-priority-first; `remaining` preserves that.
  return remaining[0];
}
