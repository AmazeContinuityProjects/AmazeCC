import { ParsedCourse } from "@/lib/ffcsTypes";
import {
  CampusSchema,
  DAYS_OF_WEEK,
  DayId,
  MORNING_BEFORE_MIN,
  expandSlotSpellings,
  periodListsClash,
  splitSlots,
  timeToMinutes,
  type SlotPeriod,
} from "@/lib/slots";

/**
 * The generator's search core: the lab-day and half-day pruning rules and the
 * backtracking walk that enumerates every timetable the offerings allow, one
 * course at a time, reporting through injected hooks so scoring stays outside.
 * Extracted verbatim from ffcsGenerate, which drives it (walkCombinations,
 * buildWalkRules and the lab-day predicates are its only callers).
 */

/* ── the solve ──────────────────────────────────────────────────────────── */

/** Do two bookings collide anywhere? Shared canonical interval clash predicate. */
const clashes = periodListsClash;

/**
 * Does this week put two lab bookings on one day?
 *
 * One lab's own lab periods are a single booking, not two — a lab that runs
 * `L1+L2` in adjacent periods, or even reaches across two days, vacates the
 * rule. What trips it is two *different* courses' lab halves sharing a day:
 * two labs in adjacent periods are every overlap check's "disjoint" and still
 * swallow an afternoon. Offerings with no lab half contribute nothing, which
 * is also how a combination survives when only some of its courses have labs.
 */
export function labsShareADay(
  combination: readonly ParsedCourse[],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>,
): boolean {
  const taken = new Set<DayId>();
  for (const offering of combination) {
    const labPeriods = labPeriodsByOffering.get(offering);
    if (!labPeriods) continue;
    const offeringDays = new Set(labPeriods.map((period) => period.day));
    for (const day of offeringDays) {
      if (taken.has(day)) return true;
      taken.add(day);
    }
  }
  return false;
}

function labPeriodPairKey(day: DayId, firstIndex: number, secondIndex: number): string {
  return `${day}:${Math.min(firstIndex, secondIndex)}:${Math.max(firstIndex, secondIndex)}`;
}

/**
 * Every pair of lab periods on one day that count as consecutive.
 *
 * Keyed `day:min:max` by raw `schema.lab` index. Exported because the pruning
 * test builds its oracle from the same pair set the walk prunes on: a
 * bitmask implementation that disagreed with *this* would be a bug in one of
 * them, and the test is what says which.
 */
export function consecutiveLabPeriodPairs(schema: CampusSchema, lunchBreakSeparatesLabs: boolean): Set<string> {
  const pairs = new Set<string>();
  for (const day of DAYS_OF_WEEK) {
    const dayPeriods = (schema.lab ?? [])
      .flatMap((period, index) => {
        if (period.lunch || !period.start || !period.end || !period.days?.[day]) return [];
        const startMin = timeToMinutes(period.start);
        return startMin === null ? [] : [{ index, startMin }];
      })
      .sort((a, b) => a.startMin - b.startMin || a.index - b.index);
    for (let index = 0; index < dayPeriods.length - 1; index++) {
      const first = dayPeriods[index];
      const second = dayPeriods[index + 1];
      if (
        lunchBreakSeparatesLabs &&
        (schema.lab ?? []).slice(first.index + 1, second.index).some((period) => period.lunch)
      ) {
        continue;
      }
      pairs.add(labPeriodPairKey(day, first.index, second.index));
    }
  }
  return pairs;
}

export function labsAreConsecutive(
  combination: readonly ParsedCourse[],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>,
  consecutivePairs: ReadonlySet<string>,
): boolean {
  for (let firstIndex = 0; firstIndex < combination.length; firstIndex++) {
    const firstPeriods = labPeriodsByOffering.get(combination[firstIndex]) ?? [];
    for (let secondIndex = firstIndex + 1; secondIndex < combination.length; secondIndex++) {
      const secondPeriods = labPeriodsByOffering.get(combination[secondIndex]) ?? [];
      if (
        firstPeriods.some((first) =>
          secondPeriods.some(
            (second) =>
              first.day === second.day && consecutivePairs.has(labPeriodPairKey(first.day, first.index, second.index)),
          ),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/* ── pruning on the rules, inside the walk ─────────────────────────────── */

/**
 * The number of set bits in `value`.
 *
 * Kernighan's loop — one iteration per set bit — and the masks this runs on
 * hold at most ten, so a de Bruijn table would be longer than the function.
 */
function popcount(value: number): number {
  let bits = 0;
  for (let rest = value; rest !== 0; rest &= rest - 1) bits++;
  return bits;
}

/** Half-day cells in a week: one per day, split at `MORNING_BEFORE_MIN`. */
const HALF_DAY_CELLS = DAYS_OF_WEEK.length * 2;

/** One half-day cell, and the slot strings that would occupy it. */
interface HalfDayCell {
  /** The bit this cell owns in a half-day mask: `dayIndex * 2 + evening`. */
  bit: number;
  /** The cell counts as occupied when an offering's spellings hold any of these. */
  slots: string[];
}

/**
 * Every half-day cell of a schema, as `(bit, slot strings)` pairs.
 *
 * Cell identity is `dayOccupancy`'s, because the floor this bounds is that
 * function's count: a mask that disagreed with it would either prune weeks
 * the metrics liked (unsound — a student's good week never shown) or keep
 * weeks they would reject (weak, but safe). So: theory periods with lunch
 * markers removed, paired index-wise with the lab list filtered the same way,
 * a lab half judged on the paired *theory* period's clock rather than its own,
 * and the half chosen by `MORNING_BEFORE_MIN` — exactly what `dayOccupancy`
 * does. Two cells can share a bit (six of chennai's Monday periods are all
 * morning), which is the same collapse that function performs when it reports
 * a day as a whole.
 */
function halfDayCells(schema: CampusSchema): HalfDayCell[] {
  const theory = (schema.theory ?? []).filter((period) => !period?.lunch);
  const lab = (schema.lab ?? []).filter((period) => !period?.lunch);
  const cells: HalfDayCell[] = [];

  theory.forEach((period, index) => {
    // An unreadable period contributes nothing — not even its lab half — for
    // the same reason `dayOccupancy` skips it.
    if (!period?.start || !period?.end) return;
    const startMin = timeToMinutes(period.start);
    const endMin = timeToMinutes(period.end);
    if (startMin === null || endMin === null) return;
    const evening = startMin >= MORNING_BEFORE_MIN ? 1 : 0;

    for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
      const slots: string[] = [];
      const theorySlot = period.days?.[DAYS_OF_WEEK[dayIndex]];
      if (theorySlot) slots.push(theorySlot);
      const labSlot = lab[index]?.days?.[DAYS_OF_WEEK[dayIndex]];
      if (labSlot) slots.push(labSlot);
      if (slots.length) cells.push({ bit: dayIndex * 2 + evening, slots });
    }
  });

  return cells;
}

/** One lab period of one offering, reduced to the two bit questions. */
interface LabSite {
  /** `DAYS_OF_WEEK` index — the day a threat has to share to count. */
  day: number;
  /** This site's own raw `schema.lab` index, as a bit. */
  own: number;
  /** Raw lab indices consecutive to `own` *on the same day*, as bits. */
  threat: number;
}

/**
 * Per-offering bit facts the walk prunes on, precomputed once per run.
 *
 * Every array is parallel to `options` — `[courseIndex][offeringIndex]` — so
 * the walk's inner loop reads numbers instead of walking the schema, which is
 * the whole reason these rules can be a filter rather than an objection. A
 * rule the run did not ask for has no array, and `null` here means the walk is
 * byte-for-byte the one it was before pruning existed.
 *
 * ## Why rejecting at first break is safe
 *
 * All three rules are *monotone* over partial combinations: a shared lab day,
 * a consecutive pair and an occupied half-day cell can each be added by a
 * later offering and none can ever be removed, so a partial that already
 * breaks a rule has no legal completion. Pruning it drops exactly the subtrees
 * that hold no leaf the old post-search filter would have kept — and the
 * leaves that survive are visited in the order they had without pruning,
 * which is what lets `limit`, the batches and the sorted output mean what
 * they always meant, over a set that is rule-legal rather than merely
 * conflict-free. (The half-days bound is optimistic rather than exact on a
 * partial — cells still fill as offerings join — so it prunes when the bound
 * itself is already below the floor, never when a completion could clear it.)
 */
interface WalkRules {
  /** 5 bits per offering: the days this offering runs a lab on. */
  labDayMasks?: number[][];
  /** `[course][offering]` → that offering's lab periods, one site each. */
  labSites?: LabSite[][][];
  /** 10 bits per offering: the half-day cells this offering fills. */
  halfDayMasks?: number[][];
  /** Prune any partial whose optimistic free-half-day count falls below this. */
  minHalfDays: number;
}

/**
 * Precompute whatever rules this run asked for, or `null` if it asked for none.
 *
 * The consecutive rule falls back to the visit-time check when the schema has
 * more lab periods than fit in a positive 32-bit mask — index 31 would be the
 * sign bit. The shipped schemas have thirteen at most, so this guards a future
 * schema rather than a path anything here walks today.
 */
export function buildWalkRules(
  /**
   * The three run options the walk prunes on — the `GenerateParams` slice it
   * reads, spelled structurally so this module depends on neither ffcsGenerate
   * nor the rest of the params.
   */
  params: {
    minHalfDays: number;
    separateLabDays?: boolean;
    avoidConsecutiveLabs?: boolean;
  },
  schema: CampusSchema,
  optionsPerCourse: ParsedCourse[][],
  labPeriodsByOffering: ReadonlyMap<ParsedCourse, readonly SlotPeriod[]>,
  consecutiveLabPairs: ReadonlySet<string>,
): WalkRules | null {
  const rules: WalkRules = { minHalfDays: params.minHalfDays > 0 ? params.minHalfDays : 0 };

  if (params.separateLabDays) {
    rules.labDayMasks = optionsPerCourse.map((options) =>
      options.map((offering) => {
        let mask = 0;
        for (const period of labPeriodsByOffering.get(offering) ?? []) {
          mask |= 1 << DAYS_OF_WEEK.indexOf(period.day);
        }
        return mask;
      }),
    );
  }

  if (params.avoidConsecutiveLabs && (schema.lab ?? []).length <= 31) {
    // The pair set is keyed `day:min:max`; turn it into per-period neighbours
    // once, so an offering's threat is a lookup rather than a set scan per node.
    const neighbours = new Map<string, number[]>();
    for (const key of consecutiveLabPairs) {
      const [day, first, second] = key.split(":");
      for (const [self, other] of [
        [first, second],
        [second, first],
      ] as const) {
        const at = `${day}:${self}`;
        const list = neighbours.get(at);
        if (list) list.push(Number(other));
        else neighbours.set(at, [Number(other)]);
      }
    }

    rules.labSites = optionsPerCourse.map((options) =>
      options.map((offering) => {
        const sites: LabSite[] = [];
        for (const period of labPeriodsByOffering.get(offering) ?? []) {
          let threat = 0;
          for (const other of neighbours.get(`${period.day}:${period.index}`) ?? []) {
            threat |= 1 << other;
          }
          sites.push({ day: DAYS_OF_WEEK.indexOf(period.day), own: 1 << period.index, threat });
        }
        return sites;
      }),
    );
  }

  if (rules.minHalfDays > 0) {
    const cells = halfDayCells(schema);
    rules.halfDayMasks = optionsPerCourse.map((options) =>
      options.map((offering) => {
        // The same spellings set `dayOccupancy` builds from the scored week's
        // split tokens: the mask has to answer `owned.has(cellSlot)` the same
        // way or the bound drifts from the metric it bounds.
        const owned = expandSlotSpellings(splitSlots(offering.SLOT));
        let mask = 0;
        for (const cell of cells) {
          for (const slot of cell.slots) {
            if (owned.has(slot)) {
              mask |= 1 << cell.bit;
              break;
            }
          }
        }
        return mask;
      }),
    );
  }

  return rules.labDayMasks || rules.labSites || rules.halfDayMasks ? rules : null;
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
  /**
   * Complete combinations reached, before scoring and the result filters —
   * and, when `rules` pruned, only ones no active rule had already ruled out.
   * That re-aim is what makes `limit` a ceiling on weeks worth showing rather
   * than on weeks the walk merely survived.
   */
  found: number;
  /** `tick` asked to stop, so the remaining tree was never walked. */
  cancelled: boolean;
  /**
   * Whether in-tree pruning stopped at least one partial week, per rule.
   *
   * The caller turns these into the same rejection flags the visit-time
   * filters raise on their own, so a search cut down by a rule is worded as
   * that rule's failure and not as `no_conflict_free`.
   */
  labDayPruned: boolean;
  consecutivePruned: boolean;
  halfDaysPruned: boolean;
}

/**
 * Every combination of one offering per course that does not collide — and,
 * when the run asked for it, that no rule has already disqualified.
 *
 * Depth-first, in the report's order, stopping once `limit` have been found.
 * `options` is pre-indexed by slot string so the conflict test is a lookup
 * rather than a schema walk on every node — which is the difference between this
 * running at all on a wide selection and not.
 *
 * ## What `rules` changes
 *
 * With `rules` present the walk is also a filter: each partial week carries
 * bitmask state for the three monotone rules (see `WalkRules` for why cutting
 * at first break is safe) and an offering that would break one is skipped
 * without descending. `found` then counts rule-legal weeks rather than every
 * conflict-free one, and the visit order of everything that survives is the
 * order it had without pruning. With `rules` null every check below is a no-op
 * and the walk is byte-for-byte the one it was before pruning existed.
 *
 * ## Why this is a visitor rather than a collector
 *
 * It used to build an array of combinations and return it, which meant nothing
 * could be shown until the whole search was over. Handing each combination to a
 * visitor as it is found is the same walk in the same order with the same
 * stopping rule — the caller decides what to do with them, which for a
 * progressive UI is "show them".
 */
export function walkCombinations(
  options: ParsedCourse[][],
  windows: SlotPeriod[][][],
  limit: number,
  hooks: WalkHooks,
  rules: WalkRules | null = null,
): WalkOutcome {
  const chosen: ParsedCourse[] = [];
  const chosenWindows: SlotPeriod[] = [];
  let found = 0;
  let nodes = 0;
  let cancelled = false;
  let halted = false;
  let labDayPruned = false;
  let consecutivePruned = false;
  let halfDaysPruned = false;
  // Bit state for the partial week at the cursor.
  //
  // The lab-day and lab-site claims clear with `&= ~` because pushes are
  // guarded: a lab-day bit is only taken when no chosen offering holds that
  // day, and a site's day only when no chosen offering holds that period (two
  // offerings in the same period on the same day would clash, which the check
  // above already refused) — so an offering's bits are its own alone and
  // clearing them leaves everyone else's standing.
  //
  // Half-day cells are *not* disjoint — two labs can both fill Monday
  // morning — so that mask is saved before each push and restored after,
  // never cleared by mask arithmetic.
  let claimedLabDays = 0;
  const claimedLabSites = new Int32Array(DAYS_OF_WEEK.length);
  let claimedHalfDays = 0;
  const halfDayHistory: number[] = [];
  const minHalfDays = rules?.minHalfDays ?? 0;

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
    const labDayMasks = rules?.labDayMasks?.[index];
    const labSites = rules?.labSites?.[index];
    const halfDayMasks = rules?.halfDayMasks?.[index];
    for (let i = 0; i < options[index].length; i++) {
      // Per offering, not per course. A course offered on two slots offers two
      // *choices*; only the one actually taken can clash with what is already
      // in the week. Collapsing them into one array used to test both against
      // both, so the moment one of them clashed the whole course was skipped —
      // silently dropping the alternatives that had never been tried.
      const periods = offeringWindows[i];
      if (clashes(periods, chosenWindows)) continue;
      // The rules, after the clash check — which the no-rules path has always
      // run here and still runs alone when `rules` is null.
      if (labDayMasks !== undefined && (claimedLabDays & labDayMasks[i]) !== 0) {
        labDayPruned = true;
        continue;
      }
      if (labSites !== undefined) {
        const sites = labSites[i];
        let consecutiveHit = false;
        for (let s = 0; s < sites.length; s++) {
          if ((claimedLabSites[sites[s].day] & sites[s].threat) !== 0) {
            consecutiveHit = true;
            break;
          }
        }
        if (consecutiveHit) {
          consecutivePruned = true;
          continue;
        }
      }
      if (halfDayMasks !== undefined && HALF_DAY_CELLS - popcount(claimedHalfDays | halfDayMasks[i]) < minHalfDays) {
        halfDaysPruned = true;
        continue;
      }
      chosen.push(options[index][i]);
      chosenWindows.push(...periods);
      if (labDayMasks !== undefined) claimedLabDays |= labDayMasks[i];
      if (labSites !== undefined) {
        for (const site of labSites[i]) claimedLabSites[site.day] |= site.own;
      }
      if (halfDayMasks !== undefined) {
        halfDayHistory.push(claimedHalfDays);
        claimedHalfDays |= halfDayMasks[i];
      }
      walk(index + 1);
      if (halfDayMasks !== undefined) claimedHalfDays = halfDayHistory.pop() ?? 0;
      if (labSites !== undefined) {
        for (const site of labSites[i]) claimedLabSites[site.day] &= ~site.own;
      }
      if (labDayMasks !== undefined) claimedLabDays &= ~labDayMasks[i];
      chosenWindows.length = chosenWindows.length - periods.length;
      chosen.pop();
      if (halted) return;
    }
  };

  walk(0);
  return { found, cancelled, labDayPruned, consecutivePruned, halfDaysPruned };
}
