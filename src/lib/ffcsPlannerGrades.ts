import type { AllGradesRes } from "@/types/data/allgrades";
import { semesterRows } from "./gradeHistory";

/**
 * The planner's rules about subjects the student already has a grade in.
 *
 * Pure and React-free, same rule as `ffcsCatalogFilters.ts`: the catalogue
 * pickers all need one answer per course — "may I select this, and how should
 * it look?" — and three different hosts (Search Course sheet, Target Courses,
 * the generator's cards) must not each re-derive it and drift.
 *
 * The rules, as specified:
 *
 *  - `S` — the best grade there is, so the subject is DONE: selection is
 *    disallowed. Nothing to improve, nothing to retake.
 *  - `A`–`E` — passed, but a better grade exists: selection is allowed and the
 *    row carries a warning that re-registering counts as a grade improvement.
 *  - `F`, `N`, `NX`, `NX1`–`NX4` — not passed: selection is allowed and the
 *    subject is surfaced to the top of the list, because it is the one worth
 *    seeing first when choosing what to register for.
 *  - Anything else (`P`, blank, a letter nobody recognises) gets no rule at
 *    all: no block, no warning, no reordering.
 *
 * "Latest grade wins": a subject can appear in several terms (a retake, an
 * improvement), and it is the most recent record that says what the student's
 * options are now. `semesterRows` walks terms oldest first, so the last write
 * is the newest one.
 *
 * `N` deserves a note: VIT's own grade-history screen treats it as "not yet
 * graded" (see `GRADE_ORDER` in `gradeHistory.ts`), while these rules follow
 * the planner's specification and treat it as worth a retake. An ungraded
 * subject surfacing at the top is a harmless nudge; blocking it would not be,
 * and we do not block it.
 */

/** What the planner does with a subject the student already has a grade in. */
export type GradeDisposition =
  /** `S` — completed; selection is disallowed. */
  | "completed"
  /** `A`–`E` — selectable, with a grade-improvement warning. */
  | "improvement"
  /** `F`/`N`/`NX*` — selectable, surfaced to the top of the list. */
  | "retry"
  /** Recorded, but no rule applies (or no record at all). */
  | "clear";

export interface RecordedGrade {
  /** The recorded grade, trimmed and upper-cased (`"B"`, `"NX2"`). */
  grade: string;
  /** The term it was recorded in; the newest record wins. */
  semesterId: string;
  /** Derived once, at index build time, from `grade`. */
  disposition: GradeDisposition;
}

/** course code (normalised) → the student's latest record for it. */
export type GradeIndex = Map<string, RecordedGrade>;

/** Grades that passed but can still be improved. */
const IMPROVEMENT_GRADES = new Set(["A", "B", "C", "D", "E"]);
/**
 * Not passed: `F`, `N`, and `NX` with an optional 1–4 suffix — `N`, `NX`,
 * `NX1`…`NX4`, and nothing else (`N2`/`NX0` are not grades anyone issues).
 */
const RETAKE_GRADE = /^N(X[1-4]?)?$/;

const normaliseCode = (code: string): string =>
  String(code ?? "")
    .trim()
    .toUpperCase();

const normaliseGrade = (grade: string): string =>
  String(grade ?? "")
    .trim()
    .toUpperCase();

/**
 * Which rule a grade triggers — the whole rulebook in one function.
 *
 * Order matters only in that the sets are disjoint; `S` is checked first for
 * readability rather than necessity.
 */
export function dispositionForGrade(grade: string): GradeDisposition {
  const g = normaliseGrade(grade);
  if (g === "S") return "completed";
  if (IMPROVEMENT_GRADES.has(g)) return "improvement";
  if (g === "F" || RETAKE_GRADE.test(g)) return "retry";
  return "clear";
}

/**
 * The student's grade history as code → latest record, or null when there is
 * nothing recorded — never synced, a payload without grades, or a signed-out
 * student. Hosts branch on null alone, exactly like the curriculum index.
 */
export function buildGradeIndex(allGrades: AllGradesRes | null | undefined): GradeIndex | null {
  const map = allGrades?.grades;
  if (!map || typeof map !== "object") return null;

  const index: GradeIndex = new Map();
  // Oldest first, so the final write for a repeated code is its newest grade.
  for (const row of semesterRows(map)) {
    for (const item of row.courses ?? []) {
      const code = normaliseCode(item?.courseCode);
      const grade = normaliseGrade(item?.grade);
      if (!code || !grade) continue;
      index.set(code, {
        grade,
        semesterId: row.id,
        disposition: dispositionForGrade(grade),
      });
    }
  }
  return index.size ? index : null;
}

/** The latest record for a code, or null when nothing is recorded. */
export function courseGrade(code: string, index: GradeIndex | null | undefined): RecordedGrade | null {
  if (!index) return null;
  return index.get(normaliseCode(code)) ?? null;
}

/**
 * A badge for the course row, or null when no rule applies.
 *
 * The three hosts render badges differently but must say the same words:
 * this is the wording (and the tone family) in one place. `blocked` is what
 * a host turns into `disabled` on its row/checkbox.
 */
export interface GradeBadge {
  text: string;
  title: string;
  tone: "red" | "amber" | "blue";
  blocked: boolean;
}

/**
 * Tailwind classes per tone, in one place: the two hosts that render badges
 * (Search Course rows, Target Course cards) must not drift in colour, and a
 * badge means the same thing in both. Mirrors the curriculum badge styling.
 */
export const GRADE_BADGE_TONE_CLASSES: Record<GradeBadge["tone"], string> = {
  red: "text-[11px] font-semibold px-1.5 py-0.5 rounded-md border border-danger/30 bg-danger-soft text-danger",
  amber:
    "text-[11px] font-semibold px-1.5 py-0.5 rounded-md border border-warn/30 bg-warn-soft text-warn",
  blue: "text-[11px] font-semibold px-1.5 py-0.5 rounded-md border border-accent/30 bg-accent-soft text-accent",
};

/**
 * The recorded grade set big at a row's right edge.
 *
 * The badge on the left says what the RULE is ("Completed · S"); this says
 * what the student actually HAS, at a glance. Coloured by disposition so
 * the tone matches the badge beside it, and a grade no rule applies to
 * (`P`, …) still shows — in neutral — because "I have a grade here" is
 * itself worth seeing.
 */
export interface GradeLetter {
  /** The recorded grade itself (`"B"`, `"NX2"`). */
  text: string;
  /** Big, heavy, tone-coloured — single letters larger than `NX*` runs. */
  className: string;
  title: string;
}

const LETTER_TONE: Record<GradeDisposition, string> = {
  completed: "text-danger",
  improvement: "text-warn",
  retry: "text-accent",
  clear: "text-zinc-400 dark:text-zinc-500",
};

export function gradeLetter(code: string, index: GradeIndex | null | undefined): GradeLetter | null {
  const record = courseGrade(code, index);
  if (!record) return null;
  // `NX2` at the size a single letter wears would crowd the row; the weight
  // keeps it prominent either way.
  const size = record.grade.length === 1 ? "text-2xl" : "text-base";
  return {
    text: record.grade,
    className: `${size} font-semibold leading-none tracking-tight select-none ${LETTER_TONE[record.disposition]}`,
    title: `Recorded grade: ${record.grade}`,
  };
}

export function gradeBadge(code: string, index: GradeIndex | null | undefined): GradeBadge | null {
  const record = courseGrade(code, index);
  if (!record || record.disposition === "clear") return null;
  switch (record.disposition) {
    case "completed":
      return {
        text: `Completed · ${record.grade}`,
        title: `You already have an ${record.grade} in this subject — it cannot be selected again.`,
        tone: "red",
        blocked: true,
      };
    case "improvement":
      return {
        text: "Grade improvement",
        title: `You already have a ${record.grade} in this subject — re-registering counts as a grade improvement.`,
        tone: "amber",
        blocked: false,
      };
    case "retry":
      return {
        text: `Retake · ${record.grade}`,
        title: `Your recorded grade is ${record.grade} — listed at the top of the list for a retake.`,
        tone: "blue",
        blocked: false,
      };
  }
}

/**
 * Reorder a result list so retake subjects come first; everything else keeps
 * the order it had (the sort is stable, so filtering still decides what a
 * student sees first among their own results).
 *
 * Returns the SAME array when there is nothing to reorder, so callers' memo
 * dependencies stay honest.
 */
export function retriesFirst<T>(
  items: readonly T[],
  codeOf: (item: T) => string,
  index: GradeIndex | null | undefined,
): T[] {
  if (!index?.size || items.length < 2) return items as T[];
  // Identity only when there is genuinely nothing to reorder: no retake in
  // the list means the sort would produce the same order, so hand back the
  // caller's own array instead of an equal copy.
  const anyRetake = items.some((item) => courseGrade(codeOf(item), index)?.disposition === "retry");
  if (!anyRetake) return items as T[];
  return items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => {
      const rank = (entry: { item: T; order: number }) =>
        courseGrade(codeOf(entry.item), index)?.disposition === "retry" ? 0 : 1;
      const ra = rank(a);
      const rb = rank(b);
      return ra !== rb ? ra - rb : a.order - b.order;
    })
    .map((entry) => entry.item);
}
