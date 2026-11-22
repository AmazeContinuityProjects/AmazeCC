/**
 * The period skeleton every timetable in the app is drawn on.
 *
 * The grid both the attendance timetable and the social grid share is built
 * from the **generated unified timetable** (`src/lib/generated/timetable.ts`,
 * derived from `src/data/timetable/campuses/chennai.json`). Each day's physical
 * periods are already listed in chronological order in `PERIODS_BY_DAY`, and
 * the tokens naming them — including the law and programme aliases that used to
 * be separate `config.json` keys — are grouped on `period.slots[day]`.
 *
 * That replaces the old projection: Monday used to supply the skeleton, and
 * every other day was projected onto it by matching `config.json` time strings
 * with a ±7 minute fallback. Two copies of that projection (one in the
 * attendance grid, one in the social grid) could drift apart on a data edit;
 * the generated scaffolding is one source of truth for both.
 *
 * ## The pairing
 *
 * A band is a *display* pair: the theory period and the lab period that share
 * a wall-clock slot. `PERIODS_BY_DAY` lists them in chronological order,
 * so the i-th theory period of a day pairs with the i-th lab token of that day
 * (`A1` with `L1` on Monday, `B1` with `L7` on Tuesday). Weekend lab tokens
 * that live inside a theory period (`X04` -> `X11` + `L71`) are split out by
 * the `L` prefix, the discriminator every grid has always used.
 *
 * The theory/lab pairing is a display concern. It never touches the data — a
 * busy map is a flat set of `DAY:SLOTID` keys regardless.
 */

import type { TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import type { Day, SlotMap } from "@/lib/social/schedule";
import { DAYS, PERIODS_BY_DAY, SLOT_MAP, TIMETABLE } from "@/lib/generated/timetable";
import { buildBandRows, type Band } from "@/lib/buildBands";

/** The generated flat slot map, in the legacy `SlotMap` shape the callers pass. */
const GENERATED_SLOT_MAP = SLOT_MAP as unknown as SlotMap;

/** The generated flat map is the default data source; the parameter remains for callers that pass one explicitly. */
const PERIOD_BY_ID = new Map(TIMETABLE.periods.map((period) => [period.id, period]));

/**
 * The theory slot ids and lab slot ids of one day, in band (chronological)
 * order, straight from the generated period scaffolding.
 *
 * No time strings and no tolerance: `PERIODS_BY_DAY` already encodes the order,
 * and `period.slots[day]` already groups every programme token under the one
 * physical period it belongs to.
 */
function dayBands(day: Day): { theory: string[]; lab: string[] } {
  const theory: string[] = [];
  const lab: string[] = [];
  for (const periodId of PERIODS_BY_DAY[day] ?? []) {
    const period = PERIOD_BY_ID.get(periodId);
    if (!period || period.lunch) continue;
    const tokens = period.slots[day] ?? [];
    // The lab half is whichever tokens carry the `L` prefix — including the
    // weekend ones embedded in a theory period such as `X04 -> L71`.
    for (const token of tokens) {
      if (token.startsWith("L")) lab.push(token);
    }
    // One theory token per period: the first (canonical/core) one, which is
    // the id the old time-string projection resolved to on every day.
    const theoryToken = tokens.find((token) => !token.startsWith("L"));
    if (theoryToken) theory.push(theoryToken);
  }
  return { theory, lab };
}

/** The theory/lab slot pair inside one band, on one day. */
export type Column = {
  theory: { day: Day; slotId: string } | null;
  lab: { day: Day; slotId: string } | null;
};

/**
 * The 12 bands of a week, per day.
 *
 * Exported for tests. The invariant the design rests on is that the projection
 * covers every physical period exactly once per day — no gaps, no
 * double-counting. That is asserted in `social-grid.test.ts` rather than
 * assumed, because a data edit that broke it would silently shift the grid.
 */
export function projectColumns(map: SlotMap = GENERATED_SLOT_MAP): Record<Day, Column[]> {
  const out = {} as Record<Day, Column[]>;

  for (const day of DAYS as readonly Day[]) {
    const { theory, lab } = dayBands(day);
    const count = Math.max(theory.length, lab.length);
    out[day] = Array.from({ length: count }, (_, i) => ({
      theory: theory[i] ? { day, slotId: theory[i] } : null,
      lab: lab[i] ? { day, slotId: lab[i] } : null,
    }));
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
export function buildPeriodSkeleton(map: SlotMap = GENERATED_SLOT_MAP): PeriodSkeleton {
  const columns = projectColumns(map);
  const count = columns.MON?.length ?? 0;

  const periodsFor = (half: "theory" | "lab"): TimetablePeriod[] =>
    Array.from({ length: count }, (_, index) => {
      const anchor = columns.MON?.[index]?.[half];
      if (!anchor) return { start: "", end: "", days: {} };

      // The clock strings are indices into the generated flat slot map, not a
      // second source of truth. Monday supplies the band's time, as before.
      const time = map.MON?.[anchor.slotId]?.time ?? SLOT_MAP.MON?.[anchor.slotId]?.time ?? "";
      const [start, end] = String(time).split("-");
      const days: Record<string, string> = {};
      for (const day of DAYS as readonly Day[]) {
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
