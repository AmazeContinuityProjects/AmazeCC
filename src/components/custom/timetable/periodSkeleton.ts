/**
 * The period skeleton every timetable in the app is drawn on.
 *
 * `config.json` has no notion of a "column" or a "row" — it is a flat map of
 * day → slot id → time. Both the attendance timetable and the social grid
 * need a *grid* out of it, and they were each deriving one privately:
 *
 *   - `attendance/TimetableGrid.tsx` built a `theoryPeriods` / `labPeriods`
 *     skeleton by pairing Monday's theory and lab slots index-wise and then
 *     projecting every other day onto it by matching **time strings**.
 *   - `social/CommonFreeSlotsGrid.tsx` built a `projectColumns()` that does
 *     the same pairing and the same projection, returning the slot ids
 *     instead of a period list.
 *
 * They agreed because they were derived from the same idea, not because they
 * were derived from the same code — which is exactly the arrangement that lets
 * a `config.json` edit move one grid and leave the other behind.
 *
 * ## The projection
 *
 * Monday supplies the skeleton: its slots are split theory/lab by the `L`
 * prefix, sorted by start time, and paired index-wise. Every other day is
 * projected by matching **time strings**, with a ±7 minute start-time
 * fallback. A theory slot and its paired lab run at the *same* time on the
 * same day (Monday has both `A1` and `L1` at 08:00-08:50), so the two halves
 * are indexed separately — keying on time alone would resolve both halves of a
 * pair to one slot, duplicating it and dropping the other from the grid.
 *
 * The theory/lab pairing is a display concern. It never touches the data — a
 * busy map is a flat set of `DAY:SLOTID` keys regardless.
 */

import type { TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import {
  DAYS,
  mondaySkeleton,
  slotMap,
  slotRange,
  type Day,
  type SlotMap,
} from "@/lib/social/schedule";
import { buildBandRows, type Band } from "./buildBands";

/** The theory/lab slot pair inside one band, on one day. */
export type Column = {
  theory: { day: Day; slotId: string } | null;
  lab: { day: Day; slotId: string } | null;
};

/**
 * The 12 bands of a week, per day.
 *
 * Exported for tests. The invariant the design rests on is that the projection
 * covers every slot in `config.json` exactly once per day — no gaps, no
 * double-counting. That is asserted in `social-grid.test.ts` rather than
 * assumed, because a `config.json` edit that broke it would silently shift
 * the whole grid.
 */
export function projectColumns(map: SlotMap = slotMap): Record<Day, Column[]> {
  const { theory, lab } = mondaySkeleton(map);
  const count = Math.max(theory.length, lab.length);
  const out = {} as Record<Day, Column[]>;

  for (const day of DAYS) {
    const daySlots = Object.entries(map[day] ?? {});
    // Indexed by time string AND half, because a theory slot and its paired lab
    // run at the SAME time on the same day - Monday has both `A1` and `L1` at
    // 08:00-08:50, and Tuesday has `B1` and `L7` there. Keying on time alone
    // silently resolves both halves of a pair to the same slot, which is a
    // duplicate and drops the other slot from the grid entirely.
    //
    // The `L` prefix is the only lab discriminator anywhere in the codebase, so
    // it is what separates the two indexes.
    const byTimeTheory = new Map<string, string>();
    const byTimeLab = new Map<string, string>();
    const byStartTheory = new Map<number, string>();
    const byStartLab = new Map<number, string>();
    for (const [slotId, entry] of daySlots) {
      const t = String(entry.time).replace(/\s+/g, "");
      const start = slotRange(entry.time).start;
      if (slotId.startsWith("L")) {
        if (!byTimeLab.has(t)) byTimeLab.set(t, slotId);
        if (!byStartLab.has(start)) byStartLab.set(start, slotId);
      } else {
        if (!byTimeTheory.has(t)) byTimeTheory.set(t, slotId);
        if (!byStartTheory.has(start)) byStartTheory.set(start, slotId);
      }
    }

    const resolve = (
      src: { slotId: string; start: number } | null | undefined,
      isLab: boolean
    ) => {
      if (!src) return null;
      const time = String(map.MON[src.slotId].time).replace(/\s+/g, "");
      const byTime = isLab ? byTimeLab : byTimeTheory;
      const byStart = isLab ? byStartLab : byStartTheory;
      const exact = byTime.get(time);
      if (exact) return { day, slotId: exact };
      // A safety net for a rounding difference in a future config edit, never
      // used on the current vocabulary.
      for (const [start, slotId] of byStart) {
        if (Math.abs(start - src.start) <= 7) return { day, slotId };
      }
      return null;
    };

    out[day] = Array.from({ length: count }, (_, i) => {
      const t = theory[i];
      const l = lab[i];
      return {
        theory: resolve(t, false),
        lab: resolve(l, true),
      };
    });
  }
  return out;
}

export type PeriodSkeleton = {
  /** The row skeleton, as the shared `TimetableView` wants it. */
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  /** `columns[day][bandIndex]` — the slot pair in that band on that day. */
  columns: Record<Day, Column[]>;
  /** The band rows, ready for the grid shell. */
  bands: Band[];
};

/**
 * Build the skeleton: the periods, the per-day slot pairs, and the band rows.
 *
 * The three are produced together on purpose. `theoryPeriods` and `columns`
 * are two views of the same pairing, and a consumer that used one while
 * indexing the other would put a slot in a different row than the timetable
 * it is drawn next to.
 */
export function buildPeriodSkeleton(map: SlotMap = slotMap): PeriodSkeleton {
  const columns = projectColumns(map);
  const count = columns.MON?.length ?? 0;

  const periodsFor = (half: "theory" | "lab"): TimetablePeriod[] =>
    Array.from({ length: count }, (_, index) => {
      const anchor = columns.MON?.[index]?.[half];
      if (!anchor) return { start: "", end: "", days: {} };

      const time = map.MON[anchor.slotId].time;
      const [start, end] = time.split("-");
      const days: Record<string, string> = {};
      for (const day of DAYS) {
        const match = columns[day]?.[index]?.[half];
        if (match) days[day.toLowerCase()] = match.slotId;
      }
      return { start, end, days };
    });

  const theoryPeriods = periodsFor("theory");
  const labPeriods = periodsFor("lab");

  return {
    theoryPeriods,
    labPeriods,
    columns,
    bands: buildBandRows(theoryPeriods),
  };
}
