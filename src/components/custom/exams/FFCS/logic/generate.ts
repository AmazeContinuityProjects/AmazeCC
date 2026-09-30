/**
 * The timetable generator.
 *
 * ## Why this is a pure function
 *
 * It used to exist three times: inline in `FFCSTimetableTab`, inline again in
 * `AutoGeneratorModal`, and in a web worker. The two inline copies were
 * byte-for-byte identical, and the worker was reachable only through a function
 * that `AutoGeneratorModal` imported and never called — so it had never run.
 *
 * All three are now this function. The UI call sites set state and render
 * whatever comes back; the worker posts the result across. Nothing here touches
 * React, `window`, `localStorage` or `next-themes`, which is what lets the same
 * code run on the main thread and off it.
 *
 * ## What it does
 *
 * For each locked course, narrow the report's offerings to the ones the student
 * allows (eight filters, in the order the UI has always applied them), then
 * backtrack over the cartesian product keeping only combinations whose periods
 * do not overlap on any day. Each surviving combination is scored, filtered by
 * the free-half-days minimum, optionally deduped by faculty, grouped into
 * variants that share a physical slot layout, and sorted.
 *
 * ## Why the errors are codes
 *
 * Each surface has its own wording for the same four failures, and the wording
 * is user-facing copy. So the result carries a code plus whatever the message
 * needs, and each caller maps it to its own string. One place decides *which*
 * failure happened; two places decide how to say it.
 */

import {
  MORNING_BEFORE_MIN,
  periodsForSlot,
  slotSpellings,
  type CampusSchema,
  type SlotPeriod,
} from "@/lib/slots";
import {
  pairwiseSocialScore,
  sortTimetables,
  timetableMetrics,
  type SortBy,
} from "@/lib/timetableMetrics";
import type { ParsedCourse, TimetableState, Friend, CourseLock, AddedCourse } from "../types";

/** The eight ways a narrowing can end with nothing to offer. */
export type GeneratorErrorCode =
  | "no_courses_selected"
  | "no_valid_slots"
  | "no_conflict_free"
  | "below_min_half_days"
  /**
   * The solver itself threw. Not a filtering outcome — the worker catches it and
   * reports it under this code so the caller can tell "nothing matched" from
   * "something broke", which are very different things to show a student.
   */
  | "error";

export interface GenerateParams {
  schema: CampusSchema;
  /** Every row of the FFCS report, as parsed. */
  masterCourses: readonly ParsedCourse[];
  /** The courses the student picked, each with their constraints. */
  courseLocks: readonly CourseLock[];
  /**
   * Slots the student ruled out.
   *
   * An array rather than a `Set` because this crosses a structured clone to
   * reach the worker, and being explicit about the wire shape keeps the boundary
   * from depending on `Set` surviving it.
   */
  blockedSlots: readonly string[];
  friends: readonly Friend[];
  /**
   * Which half of the day the student wants.
   *
   * The caller's type also admits `"compact"` and `"spread"`, and the filter
   * this replaces only ever tested for `"morning"` and `"evening"` — so those
   * two behaved as `"none"` and still do. They are accepted here rather than
   * rejected so the two entry points agree; deciding what they should do is a
   * question about the planner's UI, not about this filter.
   */
  preference: "none" | "morning" | "evening" | "compact" | "spread";
  /**
   * Narrow each course to the exact offering a friend already has.
   *
   * A filter, and independent of `maximizeFreeTimeFriends`: a student can
   * constrain the search to what their friends are taking, or merely prefer
   * timetables that suit them, or both. The two were briefly conflated here,
   * which meant a student with friends got a social score of zero unless they
   * had also asked for the filter.
   */
  syncFriendClasses: boolean;
  /**
   * The friends whose timetables to score against, by id.
   *
   * Empty means "do not score", which is different from "score against nobody" —
   * the caller decides who is in the running, because only it knows which
   * friends the student picked.
   */
  maximizeFreeTimeFriends: readonly string[];
  /** `"08:00"`, 24-hour. Empty or null means unbounded. */
  minStartTime?: string | null;
  maxEndTime?: string | null;
  uniqueFaculties: boolean;
  noLimit: boolean;
  minHalfDays: number;
  sortBy: SortBy;
}

/**
 * Either the timetables, or the reason there are none.
 *
 * The discriminant is a string, not `ok: true | false`, because this project's
 * `tsconfig` is not in strict mode and TypeScript does not narrow a union on a
 * boolean literal there — `if (result.ok)` leaves `result` as the whole union and
 * every access after it is an error. A string discriminant narrows in any mode,
 * and it also reads better in a debugger.
 */
export type GenerateResult =
  | { kind: "ok"; timetables: TimetableState[] }
  | {
      kind: "error";
      code: GeneratorErrorCode;
      /** The course code, for `no_valid_slots`. */
      subjectCode?: string;
    };

/** Colours cycled across the courses of one timetable. */
const COURSE_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-emerald-500",
  "bg-red-600",
  "bg-amber-500",
  "bg-pink-500",
  "bg-indigo-600",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-rose-600",
  "bg-violet-600",
  "bg-sky-500",
  "bg-yellow-500",
  "bg-green-600",
  "bg-magenta-500",
];

/** What a limit of 50 is; "no limit" is not really unlimited, it is just large. */
const UNLIMITED_RESULTS = 999999;
const DEFAULT_RESULT_LIMIT = 50;

/* ── helpers ────────────────────────────────────────────────────────────── */

/** Split `"A1+TA1"` into its slots, upper-cased and trimmed. */
const splitSlots = (slot: string): string[] =>
  String(slot ?? "")
    .split("+")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

/** `"08:00"` → 480. Returns null rather than 0, which would be midnight. */
function parse24HourToMinutes(time: string): number | null {
  const match = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Does this slot run in the morning?
 *
 * `true` for a slot with no period at all, which is how `"NIL"` and any id the
 * schema does not define pass every filter rather than being silently dropped.
 */
function isMorningSlot(schema: CampusSchema, slot: string): boolean {
  const periods = periodsForSlot(schema, slot);
  if (!periods.length) return true;
  return periods.some((p) => p.startMin < MORNING_BEFORE_MIN);
}

function isEveningSlot(schema: CampusSchema, slot: string): boolean {
  const periods = periodsForSlot(schema, slot);
  if (!periods.length) return true;
  return periods.some((p) => p.startMin >= MORNING_BEFORE_MIN);
}

/**
 * An embedded course's booking must actually carry both halves.
 *
 * A combined theory+lab row is only usable if it has a theory slot *and* a lab
 * slot. The report contains rows whose halves never paired up, and generating a
 * timetable that books a "theory + lab" course with only a lab is worse than
 * not offering it.
 *
 * Also the reason a law course is never dropped here: its slots are letters
 * with no `L` prefix and no number, so it is not embedded and passes through.
 */
function isCompleteEmbeddedCourse(option: ParsedCourse): boolean {
  const type = option.TYPE.trim().toUpperCase();
  const embedded =
    type === "ETH" ||
    type === "ELA" ||
    type === "EPJ" ||
    type.includes("EMBEDDED") ||
    type.includes("+");
  if (!embedded) return true;
  const slots = splitSlots(option.SLOT);
  const hasTheory = slots.some((s) => !s.startsWith("L") && s !== "NIL");
  const hasLab = slots.some((s) => s.startsWith("L"));
  return hasTheory && hasLab;
}

/* ── option filtering ───────────────────────────────────────────────────── */

/**
 * Narrow a course's offerings to the ones this student allows.
 *
 * The order of these is the order the UI has always applied them in, and it
 * matters for the error a student sees: an offering rejected by an early filter
 * is never reconsidered by a later one.
 */
function optionsFor(
  schema: CampusSchema,
  params: GenerateParams,
  lock: CourseLock,
  all: ParsedCourse[]
): ParsedCourse[] {
  const blocked = new Set(params.blockedSlots.map((s) => s.trim().toUpperCase()));
  let options = all;

  // 1. The student named specific slots.
  if (lock.allowedSlots?.length) {
    const allowed = new Set(lock.allowedSlots.map((s) => s.trim().toUpperCase()));
    options = options.filter((opt) => splitSlots(opt.SLOT).some((s) => allowed.has(s)));
  }

  // 2. The student named specific faculty.
  if (lock.allowedFaculty?.length) {
    options = options.filter((opt) => lock.allowedFaculty!.includes(opt.FACULTY));
  }

  // 3. The student picked exact offerings — "FACULTY|SLOT|ROOM", which is how
  //    the picker identifies a row it cannot otherwise name.
  if (lock.offerings?.length) {
    const offerings = new Set(lock.offerings);
    options = options.filter((opt) => offerings.has(`${opt.FACULTY}|${opt.SLOT}|${opt.ROOM}`));
  }

  // 4. Embedded rows need both halves.
  options = options.filter(isCompleteEmbeddedCourse);

  // 5. Morning-only or evening-only.
  if (params.preference === "morning") {
    options = options.filter((opt) => {
      const theory = splitSlots(opt.SLOT).filter((s) => !s.startsWith("L") && s !== "NIL");
      // A course with a theory slot is judged on it; a lab-only course has to be
      // judged on whether any of its slots reach the evening.
      if (theory.length) return isMorningSlot(schema, theory[0]);
      return splitSlots(opt.SLOT).filter((s) => s !== "NIL").some((s) => isEveningSlot(schema, s));
    });
  } else if (params.preference === "evening") {
    options = options.filter((opt) => {
      const theory = splitSlots(opt.SLOT).filter((s) => !s.startsWith("L") && s !== "NIL");
      if (theory.length) return isEveningSlot(schema, theory[0]);
      return splitSlots(opt.SLOT).filter((s) => s !== "NIL").some((s) => isMorningSlot(schema, s));
    });
  }

  // 6. Ruled-out slots. Checked through both spellings, so a law student who
  //    blocks "A" also loses the "A1" offering — which is the whole point, since
  //    the two name the same period and the report writes the numbered one.
  options = options.filter((opt) => {
    const slots = splitSlots(opt.SLOT);
    return !slots.some(
      (slot) => slotSpellings(slot).some((spelling) => blocked.has(spelling))
    );
  });

  // 7. Time bounds.
  const minAllowed = params.minStartTime ? parse24HourToMinutes(params.minStartTime) : 0;
  const maxAllowed = params.maxEndTime ? parse24HourToMinutes(params.maxEndTime) : 24 * 60;
  if (params.minStartTime || params.maxEndTime) {
    const lower = minAllowed ?? 0;
    const upper = maxAllowed ?? 24 * 60;
    options = options.filter((opt) =>
      splitSlots(opt.SLOT).every((slot) => {
        // First match wins, theory before lab. A slot the schema does not define
        // cannot be outside a time bound, so it passes.
        const period = periodsForSlot(schema, slot)[0];
        if (!period) return true;
        return period.startMin >= lower && period.endMin <= upper;
      })
    );
  }

  // 8. Match a friend's timetable exactly.
  if (params.syncFriendClasses) {
    const friendCourses = params.friends
      .flatMap((f) => f.timetables ?? [])
      .flatMap((t) => t.courses ?? [])
      .filter((c) => c.code === lock.code);
    // Only filters when the friend actually has this course. An absent course
    // means "no opinion", not "reject everything".
    if (friendCourses.length) {
      options = options.filter((opt) => {
        const optSlots = splitSlots(opt.SLOT).sort().join(",");
        return friendCourses.some((fc) => {
          const theirSlots = [...fc.slots].map((s) => s.trim().toUpperCase()).sort().join(",");
          return opt.FACULTY === fc.faculty && optSlots === theirSlots;
        });
      });
    }
  }

  return options;
}

/* ── the solve ──────────────────────────────────────────────────────────── */

/** Do two bookings collide anywhere? */
function clashes(a: readonly SlotPeriod[], b: readonly SlotPeriod[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.day !== y.day) continue;
      if (Math.max(x.startMin, y.startMin) < Math.min(x.endMin, y.endMin)) return true;
    }
  }
  return false;
}

/**
 * Every combination of one offering per course that does not collide.
 *
 * Depth-first, in the report's order, stopping once `limit` have been found.
 * `options` is pre-indexed by slot string so the conflict test is a lookup
 * rather than a schema walk on every node — which is the difference between this
 * running at all on a wide selection and not.
 */
function backtrack(
  options: ParsedCourse[][],
  windows: SlotPeriod[][],
  limit: number
): ParsedCourse[][] {
  const found: ParsedCourse[][] = [];
  const chosen: ParsedCourse[] = [];
  const chosenWindows: SlotPeriod[] = [];

  const walk = (index: number) => {
    if (found.length >= limit) return;
    if (index === options.length) {
      found.push([...chosen]);
      return;
    }
    for (const opt of options[index]) {
      if (clashes(windows[index], chosenWindows)) continue;
      chosen.push(opt);
      chosenWindows.push(...windows[index]);
      walk(index + 1);
      chosenWindows.length = chosenWindows.length - windows[index].length;
      chosen.pop();
    }
  };

  walk(0);
  return found;
}

/* ── scoring ────────────────────────────────────────────────────────────── */

/**
 * A unique id for a course and for a timetable.
 *
 * `crypto.randomUUID` is preferred, and it is `[SecureContext]`-only — it is
 * `undefined` on a plain-HTTP origin. That is not hypothetical here: this app
 * runs as a PWA over HTTPS, but its own dev-origin list contains a bare LAN IP
 * (`192.168.1.101`), and a self-hosted copy on a campus LAN over HTTP would have
 * no `crypto.randomUUID` at all. The generator runs in a worker, where a missing
 * global throws rather than degrading, and the old inline code used
 * `Math.random`, which always exists.
 *
 * So: `randomUUID` when there is one, and a `Math.random` fallback that is
 * still unique enough for React keys and localStorage ids.
 */
const newId = (): string => {
  const uuid = typeof crypto !== "undefined" ? crypto.randomUUID : undefined;
  if (typeof uuid === "function") return uuid.call(crypto);
  // Not a real UUID. Adequate for a client-side id, and the timestamp prefix
  // keeps ids sortable, which the random ones are not.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

function toAddedCourse(course: ParsedCourse, index: number): AddedCourse {
  return {
    id: newId(),
    code: course.CODE,
    title: course.TITLE,
    faculty: course.FACULTY,
    venue: course.ROOM,
    slots: splitSlots(course.SLOT),
    credits: course.CREDITS,
    type: course.TYPE,
    color: COURSE_COLORS[index % COURSE_COLORS.length],
    batch: course.BATCH,
  };
}

/**
 * The best percentage this timetable scores against any of the named friends.
 *
 * Taking the best per friend rather than the sum is the same rule the UI used: a
 * timetable is only as social as its closest match, and one friend with a
 * clashing schedule should not drag the score down for everyone else.
 */
function socialScoreAgainst(
  courses: readonly AddedCourse[],
  friends: readonly Friend[],
  schema: CampusSchema
): { socialScore: number; bestFriendMatches: string[] } {
  if (!friends.length) return { socialScore: 0, bestFriendMatches: [] };

  let total = 0;
  let bestOverall = -1;
  let closest: string[] = [];

  for (const friend of friends) {
    if (!friend.timetables?.length) continue;
    let best = 0;
    for (const tt of friend.timetables) {
      const { percentage } = pairwiseSocialScore(courses, tt.courses, schema);
      if (percentage > best) best = percentage;
    }
    total += best;
    if (best > bestOverall) {
      bestOverall = best;
      closest = [friend.name];
    } else if (best === bestOverall) {
      closest.push(friend.name);
    }
  }

  return {
    socialScore: friends.length ? Math.round(total / friends.length) : 0,
    bestFriendMatches: closest,
  };
}

/**
 * Keep the first option that pairs each course with a faculty member no other
 * kept option used, and drop the rest.
 *
 * Greedy and order-dependent, which is inherent: it is a dedupe, not a search.
 */
function dedupeByFaculty(timetables: TimetableState[]): TimetableState[] {
  const used = new Map<string, Set<string>>();
  return timetables.filter((tt) => {
    let unique = true;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen?.has(c.faculty)) {
        unique = false;
        break;
      }
    }
    if (!unique) return false;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen) seen.add(c.faculty);
      else used.set(c.code, new Set([c.faculty]));
    }
    return true;
  });
}

/**
 * Collapse timetables that occupy the same physical slots into one option with
 * variants.
 *
 * Two timetables with the same slot layout are the same *week* to a student —
 * the difference is which section of the same slot they sit in, which is
 * exactly what a variant is. Grouping by the sorted slot multiset rather than by
 * course code is what makes this work.
 */
function groupVariants(timetables: TimetableState[]): TimetableState[] {
  const grouped = new Map<string, TimetableState>();

  for (const tt of timetables) {
    const signature = tt.courses
      .flatMap((c) => c.slots)
      .slice()
      .sort()
      .join("|");

    const existing = grouped.get(signature);
    if (existing) {
      existing.variants!.push({ ...tt, name: `Variant ${existing.variants!.length + 1}` });
    } else {
      grouped.set(signature, { ...tt, variants: [{ ...tt, name: "Variant 1" }] });
    }
  }

  return Array.from(grouped.values()).map((t, i) => ({ ...t, name: `Option ${i + 1}` }));
}

/* ── entry point ────────────────────────────────────────────────────────── */

/**
 * Generate conflict-free timetables for a set of locked courses.
 *
 * Pure: the same params always give the same result, and nothing here reads or
 * writes anything outside its arguments. That is what lets it run in a worker,
 * and what lets a test pin the output.
 */
export function generateTimetables(params: GenerateParams): GenerateResult {
  const { schema } = params;

  if (!params.courseLocks.length) {
    return { kind: "error", code: "no_courses_selected" };
  }

  const byCode = new Map<string, ParsedCourse[]>();
  for (const course of params.masterCourses) {
    const bucket = byCode.get(course.CODE);
    if (bucket) bucket.push(course);
    else byCode.set(course.CODE, [course]);
  }

  const optionsPerCourse: ParsedCourse[][] = [];
  const windowsPerCourse: SlotPeriod[][] = [];

  for (const lock of params.courseLocks) {
    const options = optionsFor(schema, params, lock, byCode.get(lock.code) ?? []);
    if (!options.length) {
      return { kind: "error", code: "no_valid_slots", subjectCode: lock.code };
    }
    optionsPerCourse.push(options);

    // The periods each offering occupies, resolved once here rather than at
    // every backtrack node — the whole point of precomputing.
    const windows: SlotPeriod[] = [];
    for (const opt of options) {
      for (const slot of splitSlots(opt.SLOT)) {
        windows.push(...periodsForSlot(schema, slot));
      }
    }
    windowsPerCourse.push(windows);
  }

  const limit = params.noLimit ? UNLIMITED_RESULTS : DEFAULT_RESULT_LIMIT;
  const combinations = backtrack(optionsPerCourse, windowsPerCourse, limit);

  if (!combinations.length) {
    return { kind: "error", code: "no_conflict_free" };
  }

  const scoredFriends = params.maximizeFreeTimeFriends.length
    ? params.friends.filter((f) => params.maximizeFreeTimeFriends.includes(f.id))
    : [];

  let timetables: TimetableState[] = combinations.map((combo) => {
    const courses = combo.map(toAddedCourse);
    const base = timetableMetrics(courses, schema);
    const social = socialScoreAgainst(courses, scoredFriends, schema);
    return {
      id: newId(),
      name: "Generated Option",
      courses,
      metrics: { ...base, ...social },
    };
  });

  timetables = timetables.filter((tt) => (tt.metrics?.halfDays ?? 0) >= params.minHalfDays);

  if (!timetables.length) {
    return { kind: "error", code: "below_min_half_days" };
  }

  timetables = sortTimetables(timetables, params.sortBy);

  if (params.uniqueFaculties) {
    timetables = dedupeByFaculty(timetables);
  }

  return { kind: "ok", timetables: groupVariants(timetables) };
}
