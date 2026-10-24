/**
 * The timetable generator.
 *
 * ## Why this is a pure function
 *
 * It used to exist three times: inline in `FFCSTimetableTab`, inline again in
 * `FFCSGeneratorSubpage` (then `AutoGeneratorModal`), and in a web worker. The
 * two inline copies were
 * byte-for-byte identical, and the worker was reachable only through a function
 * that the generator screen imported and never called — so it had never run.
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
import { rankCourses, type RankingMode, type RankingScore } from "@/lib/ffcsRanking";
import { offeringMatches } from "../reports";
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
  /**
   * How many timetables the search keeps when it is not running unlimited.
   *
   * Optional and unset by default, which reads as {@link DEFAULT_RESULT_LIMIT} —
   * the same fifty the planner has always stopped at. It exists so the result
   * cap in settings is a real ceiling on the search rather than a display
   * number trimmed after the fact; `noLimit` still outranks it, because the
   * per-run switch is the more recent thing the student chose.
   */
  resultCap?: number;
  minHalfDays: number;
  sortBy: SortBy;
  /**
   * Order by a weighted ranking profile instead of by `sortBy` alone.
   *
   * Optional, and **unset by default** — with no mode the pipeline is exactly
   * the one it has always been, in the same order, at the same cost. Setting it
   * is a preference the student picked, so it wins over `sortBy`, with `sortBy`
   * deciding ties (the sort is stable, so the second pass cannot scramble
   * anything the first one established).
   */
  rankingMode?: RankingMode;
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
  | {
      kind: "ok";
      timetables: TimetableState[];
      /**
       * The search stopped before it had seen everything.
       *
       * Either it hit the result cap, or the caller cancelled it. Both mean the
       * same thing to a student: there are almost certainly more options than
       * the ones on screen, which is the difference between "these five are all
       * there is" and "these five are what I looked at first".
       */
      capped: boolean;
    }
  /**
   * The caller abandoned the search.
   *
   * Carries whatever had been accepted rather than nothing, because a cancel
   * that throws away ten seconds of results is worse than a cancel that shows
   * them labelled as incomplete. `kind` stays a string for the same
   * non-strict-mode reason `GenerateResult` has always used one.
   */
  | { kind: "cancelled"; timetables: TimetableState[] }
  | {
      kind: "error";
      code: GeneratorErrorCode;
      /** The course code, for `no_valid_slots`. */
      subjectCode?: string;
    };

/**
 * How far a streaming search has got.
 *
 * Reported rather than computed by the caller because only the solver knows
 * either number: the caller cannot see inside the backtrack, and guessing at
 * "combinations examined" from wall-clock time is how progress bars end up
 * lying.
 */
export interface GenerateProgress {
  /** Nodes visited in the search tree. Grows faster than `found`, by design. */
  nodes: number;
  /** Conflict-free combinations reached, before any filtering. */
  found: number;
  /** Timetables that survived every filter — what a UI can actually show. */
  accepted: number;
}

/**
 * Progress and cancellation for a run the caller wants to watch.
 *
 * All three are optional, and omitting all of them is exactly what
 * `generateTimetables` does — which is why the non-streaming entry point is the
 * streaming one with no hooks, rather than a second implementation.
 */
export interface GenerateStreamHooks {
  /**
   * Each accepted timetable, in search order.
   *
   * Not sorted, not grouped, and not deduped: those are whole-result
   * operations, and running them per batch would either be quadratic or would
   * renumber options under the reader. A caller that wants the settled order
   * reads it from the `GenerateResult` when the run finishes.
   */
  onBatch?: (timetables: TimetableState[]) => void;
  /** Roughly every few thousand nodes. */
  onProgress?: (progress: GenerateProgress) => void;
  /**
   * Return true to abandon the search.
   *
   * Polled on the progress cadence rather than per node, so honouring it costs
   * a comparison every few thousand nodes instead of one per node in the
   * innermost loop of a search that can run to millions.
   */
  shouldStop?: () => boolean;
  /** How many accepted timetables to hold before flushing a batch. */
  batchSize?: number;
}

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
/** Exported because the settings sheet offers it as the cap to come back to. */
export const DEFAULT_RESULT_LIMIT = 50;
/**
 * Accepted timetables per streamed batch.
 *
 * Deliberately the same 50 as the default cap: the first thing a student asked
 * for is fifty choices, so the first flush is fifty choices. Searches that
 * finish below the threshold flush once at the end, which is indistinguishable
 * to the reader because the run is over either way.
 */
const DEFAULT_BATCH_SIZE = 50;

/* ── helpers ────────────────────────────────────────────────────────────── */

/** Split `"A1+TA1"` into its slots, upper-cased and trimmed. */
/**
 * "G1+L31+L32" → ["G1", "L31", "L32"].
 *
 * Shared with the generator screen, which needs the same tokenization when it
 * hands a preview course to a same-slot faculty alternative.
 */
export const splitSlots = (slot: string): string[] =>
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

  // 3. The student picked exact offerings — "FACULTY|SLOT|ROOM", plus the
  //    employee's ERP ID when the report has one. The id is what distinguishes
  //    two people with the same name, and the legacy form keeps a lock saved
  //    against the previous semester matching its equivalent row.
  if (lock.offerings?.length) {
    options = options.filter((opt) => offeringMatches(opt, lock.offerings!));
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
 * How often the walk checks whether its caller wants to stop.
 *
 * Every node would be the honest number, and it is a function call in the
 * innermost loop of a search that can visit millions. A few thousand is finer
 * than a person can perceive a cancellation and costs nothing measurable —
 * the same trade `conflictAnalyzer` makes for its own budget.
 */
const TICK_INTERVAL = 4096;

interface WalkHooks {
  /** One complete, conflict-free combination, in the report's order. */
  visit: (combination: ParsedCourse[]) => void;
  /** Polled every `TICK_INTERVAL` nodes; return true to abandon the search. */
  tick?: (nodes: number, found: number) => boolean;
}

interface WalkOutcome {
  /** Complete combinations reached, before any filtering. */
  found: number;
  /** `tick` asked to stop, so the remaining tree was never walked. */
  cancelled: boolean;
}

/**
 * Every combination of one offering per course that does not collide.
 *
 * Depth-first, in the report's order, stopping once `limit` have been found.
 * `options` is pre-indexed by slot string so the conflict test is a lookup
 * rather than a schema walk on every node — which is the difference between this
 * running at all on a wide selection and not.
 *
 * ## Why this is a visitor rather than a collector
 *
 * It used to build an array of combinations and return it, which meant nothing
 * could be shown until the whole search was over. Handing each combination to a
 * visitor as it is found is the same walk in the same order with the same
 * stopping rule — the caller decides what to do with them, which for a
 * progressive UI is "show them".
 */
function walkCombinations(
  options: ParsedCourse[][],
  windows: SlotPeriod[][][],
  limit: number,
  hooks: WalkHooks
): WalkOutcome {
  const chosen: ParsedCourse[] = [];
  const chosenWindows: SlotPeriod[] = [];
  let found = 0;
  let nodes = 0;
  let cancelled = false;
  let halted = false;

  const walk = (index: number): void => {
    if (halted) return;
    if (found >= limit) {
      halted = true;
      return;
    }
    if (index === options.length) {
      found++;
      // Copied, because `chosen` is the walker's scratch space and is popped as
      // soon as this returns. The old collector copied for the same reason.
      hooks.visit([...chosen]);
      return;
    }
    if (hooks.tick && ++nodes % TICK_INTERVAL === 0 && hooks.tick(nodes, found)) {
      cancelled = true;
      halted = true;
      return;
    }
    const offeringWindows = windows[index];
    for (let i = 0; i < options[index].length; i++) {
      // Per offering, not per course. A course offered on two slots offers two
      // *choices*; only the one actually taken can clash with what is already
      // in the week. Collapsing them into one array used to test both against
      // both, so the moment one of them clashed the whole course was skipped —
      // silently dropping the alternatives that had never been tried.
      const periods = offeringWindows[i];
      if (clashes(periods, chosenWindows)) continue;
      chosen.push(options[index][i]);
      chosenWindows.push(...periods);
      walk(index + 1);
      chosenWindows.length = chosenWindows.length - periods.length;
      chosen.pop();
      if (halted) return;
    }
  };

  walk(0);
  return { found, cancelled };
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
    employeeId: course.ERP_ID,
    venue: course.ROOM,
    slots: splitSlots(course.SLOT),
    credits: course.CREDITS,
    type: course.TYPE,
    color: COURSE_COLORS[index % COURSE_COLORS.length],
    batch: course.BATCH,
  };
}

/**
 * Every faculty who teaches `code` at exactly the set of slot tokens `slots`.
 *
 * The generator discovers these people once per full timetable — `groupVariants`
 * picks them out when a whole week shares one physical layout — but the
 * preview's Selected Courses table wants them per course: tap a teacher's name,
 * and hand the same time to someone else. Matching uses the sorted *split*
 * tokens, stricter than overlap on purpose: a same-time swap must not move a
 * single period, or the clash-free guarantee behind the preview quietly stops
 * holding.
 *
 * The current teacher is excluded by identity — employee id when the report
 * carries one, the name otherwise — the same rule `dedupeByFaculty` applies.
 * Duplicate report rows (same person, same tokens, same room) collapse into
 * one option; the employee id stays in that key so two people who share a
 * name both appear. Sorted by faculty, then room.
 */
export function sameSlotFacultyAlternatives(
  code: string,
  slots: readonly string[],
  current: { faculty: string; employeeId?: string },
  masterCourses: readonly ParsedCourse[]
): ParsedCourse[] {
  const want = [...slots]
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join("+");
  const currentIdentity = current.employeeId
    ? `erp:${current.employeeId}`
    : current.faculty;
  const identity = (c: ParsedCourse): string =>
    c.ERP_ID ? `erp:${c.ERP_ID}` : c.FACULTY;
  // Raw SLOT strings spell the same booking in different orders; the sorted
  // tokens are the stable half of this key. `offeringId` would keep both
  // spellings, which reads as two teachers in the picker.
  const dedupeKey = (c: ParsedCourse): string =>
    `${c.FACULTY}|${splitSlots(c.SLOT).sort().join("+")}|${c.ROOM}|${c.ERP_ID ?? ""}`;
  const seen = new Set<string>();
  return masterCourses
    .filter((c) => c.CODE === code)
    .filter((c) => splitSlots(c.SLOT).sort().join("+") === want)
    .filter((c) => identity(c) !== currentIdentity)
    .filter((c) => {
      const key = dedupeKey(c);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.FACULTY.localeCompare(b.FACULTY) ||
        String(a.ROOM ?? "").localeCompare(String(b.ROOM ?? ""))
    );
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
  // An employee id separates two people who share a name; a name alone still
  // separates people when the report has no id, which is every row of the
  // previous semester's report.
  const facultyIdentity = (course: AddedCourse): string =>
    course.employeeId ? `erp:${course.employeeId}` : course.faculty;

  const used = new Map<string, Set<string>>();
  return timetables.filter((tt) => {
    let unique = true;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen?.has(facultyIdentity(c))) {
        unique = false;
        break;
      }
    }
    if (!unique) return false;
    for (const c of tt.courses) {
      const seen = used.get(c.code);
      if (seen) seen.add(facultyIdentity(c));
      else used.set(c.code, new Set([facultyIdentity(c)]));
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
 * Score one combination. Split out because both the streaming path and the
 * progress reporting need to describe it, and because the half-days test is
 * the one filter that runs *after* the search rather than during it.
 */
function scoreCombination(
  params: GenerateParams,
  combination: ParsedCourse[],
  scoredFriends: readonly Friend[]
): TimetableState {
  const courses = combination.map(toAddedCourse);
  const base = timetableMetrics(courses, params.schema);
  const social = socialScoreAgainst(courses, scoredFriends, params.schema);
  const timetable: TimetableState = {
    id: newId(),
    name: "Generated Option",
    courses,
    metrics: { ...base, ...social },
  };

  // Only when a profile was asked for: the second day-walk `rankCourses` does
  // is real work, and the default path has no opinion to express with it.
  if (params.rankingMode) {
    const ranked: RankingScore = rankCourses(courses, params.schema, params.rankingMode);
    timetable.rankingScore = ranked.score;
    timetable.rankingBreakdown = ranked.breakdown;
  }

  return timetable;
}

/**
 * Generate conflict-free timetables for a set of locked courses, optionally
 * reporting them as they are found.
 *
 * Pure: the same params always give the same result, and nothing here reads or
 * writes anything outside its arguments. That is what lets it run in a worker,
 * and what lets a test pin the output.
 *
 * ## Order of operations, and why it must not change
 *
 * The pipeline is filter options → backtrack → score → drop under the
 * half-days minimum → sort → dedupe faculty → group variants. That order is the
 * product's behaviour: an earlier stage's contract is only meaningful relative
 * to the ones around it. Adding hooks does not reorder it — hooks only observe.
 * The batches a streaming caller sees are the scored-and-half-days-filtered
 * list mid-flight; the `GenerateResult` that ends the run is the settled one.
 *
 * ## What `hooks` does not affect
 *
 * With no hooks the walk is byte-for-byte the walk `backtrack` used to do:
 * same visit order, same `limit`, same early exit. `generateTimetables` is this
 * function called with `{}`, which is the whole reason the two entry points
 * cannot drift apart.
 */
export function generateTimetablesStream(
  params: GenerateParams,
  hooks: GenerateStreamHooks = {}
): GenerateResult {
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
  const windowsPerCourse: SlotPeriod[][][] = [];

  for (const lock of params.courseLocks) {
    const options = optionsFor(schema, params, lock, byCode.get(lock.code) ?? []);
    if (!options.length) {
      return { kind: "error", code: "no_valid_slots", subjectCode: lock.code };
    }
    optionsPerCourse.push(options);

    // The periods each offering occupies, resolved once here rather than at
    // every backtrack node — the whole point of precomputing. One entry per
    // *offering*, so the walk can test the one it is about to take rather than
    // the union of every alternative the course happens to offer.
    windowsPerCourse.push(
      options.map((opt) => {
        const periods: SlotPeriod[] = [];
        for (const slot of splitSlots(opt.SLOT)) {
          periods.push(...periodsForSlot(schema, slot));
        }
        return periods;
      })
    );
  }

  const limit = params.noLimit
    ? UNLIMITED_RESULTS
    : params.resultCap ?? DEFAULT_RESULT_LIMIT;
  const batchSize = hooks.batchSize && hooks.batchSize > 0 ? hooks.batchSize : DEFAULT_BATCH_SIZE;

  const scoredFriends = params.maximizeFreeTimeFriends.length
    ? params.friends.filter((f) => params.maximizeFreeTimeFriends.includes(f.id))
    : [];

  const accepted: TimetableState[] = [];
  let emitted = 0;
  const flush = () => {
    if (accepted.length <= emitted) return;
    const batch = accepted.slice(emitted);
    emitted = accepted.length;
    hooks.onBatch?.(batch);
  };

  const walk = walkCombinations(optionsPerCourse, windowsPerCourse, limit, {
    visit: (combination) => {
      const timetable = scoreCombination(params, combination, scoredFriends);
      // The half-days floor is a filter on the *result*, not on the search: a
      // combination can be perfectly conflict-free and still be a week the
      // student did not ask for.
      if ((timetable.metrics?.halfDays ?? 0) < params.minHalfDays) return;
      accepted.push(timetable);
      if (accepted.length - emitted >= batchSize) flush();
    },
    tick: (nodes, found) => {
      hooks.onProgress?.({ nodes, found, accepted: accepted.length });
      return hooks.shouldStop ? hooks.shouldStop() : false;
    },
  });

  // Whatever the last partial batch was, plus everything a cancelled run had
  // not reached a batch boundary for. A UI that is watching must not be left
  // holding a subset because the arithmetic of the flush did not divide.
  flush();

  if (walk.cancelled) {
    return { kind: "cancelled", timetables: accepted };
  }

  // Deliberately in the original order: `found` is "the search never produced
  // a conflict-free week at all", which is a different failure from "it
  // produced weeks, none of which met the floor", and a student can act on the
  // distinction.
  if (!walk.found) {
    return { kind: "error", code: "no_conflict_free" };
  }
  if (!accepted.length) {
    return { kind: "error", code: "below_min_half_days" };
  }

  let timetables = sortTimetables(accepted, params.sortBy);

  if (params.rankingMode) {
    // A second, stable pass: options of equal profile score keep the order the
    // student's `sortBy` gave them, so turning a profile on refines their
    // existing answer rather than throwing it away.
    timetables = [...timetables].sort(
      (a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1)
    );
  }

  if (params.uniqueFaculties) {
    timetables = dedupeByFaculty(timetables);
  }

  return {
    kind: "ok",
    timetables: groupVariants(timetables),
    capped: walk.found >= limit,
  };
}

/**
 * Generate conflict-free timetables for a set of locked courses.
 *
 * The one-shot form of `generateTimetablesStream`: no hooks, no streaming, no
 * cancellation. It exists because that is the shape every existing caller and
 * every existing test wants, and because a solve that must not be watched
 * should not pay for the ability to be.
 */
export function generateTimetables(params: GenerateParams): GenerateResult {
  return generateTimetablesStream(params);
}
