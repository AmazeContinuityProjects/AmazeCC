/**
 * Merging the two sources of truth about a room.
 *
 * ## What there are
 *
 * | Source | What it knows | What it misses |
 * |---|---|---|
 * | The FFCS report | Every class booked during registration, and every room the campus has | Anything that changed after registration |
 * | The server | The classes students have contributed this term, with the rooms and faculty as they are now | Any class nobody has synced yet |
 *
 * Neither is complete, so neither is used alone.
 *
 * ## The rule
 *
 * **A room is free only when both sources say it is free.**
 *
 * That is the union of the two occupancy sets, and it is deliberately the
 * cautious direction. The report is stale in exactly the way that hides free
 * rooms — a class that was dropped, a room that was changed — so the report
 * alone would keep offering a room that is actually empty. The server alone
 * would offer every room nobody has contributed a class for, which is most of
 * them at the start of a term.
 *
 * So a room is offered only when the report has nothing booked in it *and*
 * nobody has contributed a class sitting in it. The report's inventory is kept
 * as well, so a room the server has never heard of is still offered.
 *
 * ## Where the fresher answer wins
 *
 * In the details, not in the occupancy. When both sources have something
 * booked in a room, the server's is shown — it carries the faculty, the class
 * number and the room as they are now. The report's row is used for a room the
 * server has nothing for.
 */

import {
  freeRoomsForRun,
  type BlockAvailability,
  type DayIndex,
  type FreeRooms,
} from "@/lib/freeClassrooms";
import {
  livePeriodFor,
  liveRunFor,
  type LiveDay,
} from "@/lib/roomAvailability";

export type MergedRoom = {
  code: string;
  block: string;
  kind: "theory" | "lab";
};

/** Something booked in a room, and where the fact came from. */
export type MergedOccupant = {
  code: string;
  courseCode: string;
  title: string;
  faculty: string;
  source: "live" | "report";
};

export type MergedPeriod = {
  free: FreeRooms;
  blocks: BlockAvailability[];
  /** Room code → what is in it. */
  occupants: Map<string, MergedOccupant[]>;
};

export type MergedRun = {
  rooms: string[];
  theory: string[];
  lab: string[];
  /** Room code → how many periods of the run it holds out for. */
  runLength: Map<string, number>;
  blocks: BlockAvailability[];
};

export type MergedDay = {
  /** Every room the campus is known to have, from either source. */
  rooms: MergedRoom[];
  /** Room code → whether it is a classroom or a laboratory. */
  kinds: Map<string, "theory" | "lab">;
  /** Period key → the answer for that period. */
  periods: Map<string, MergedPeriod>;
  /** Run start key → the answer for that run. */
  runs: Map<string, MergedRun>;
};

const compareCodes = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Merge the report and the server for one day.
 *
 * `live` is null when the server has nothing for the term, and the answer is
 * then exactly the report's — which is what makes the report the fallback
 * rather than a special case.
 */
export function mergeDay(input: {
  index: DayIndex;
  /** The day's period keys, in timetable order. */
  periodKeys: string[];
  live: LiveDay | null;
  /** How many consecutive periods a run covers. */
  runLength: number;
}): MergedDay {
  const universe = new Map<string, MergedRoom>();

  // The report's inventory first: it is the complete list of rooms.
  for (const [code, info] of input.index.rooms) {
    universe.set(code, { code, block: info.block, kind: info.kind });
  }
  // The server's inventory second: where both know a room, the server's block
  // and kind are the ones it has settled.
  for (const room of input.live?.rooms ?? []) {
    const existing = universe.get(room.code);
    if (existing) {
      existing.block = room.block;
      existing.kind = room.kind;
    } else {
      universe.set(room.code, {
        code: room.code,
        block: room.block,
        kind: room.kind,
      });
    }
  }

  const periods = new Map<string, MergedPeriod>();
  for (const key of input.periodKeys) {
    periods.set(key, mergePeriod(input.index, input.live, key, universe));
  }

  const runs = new Map<string, MergedRun>();
  for (let i = 0; i < input.periodKeys.length; i++) {
    const window = input.periodKeys.slice(i, i + input.runLength);
    if (window.length === 0) continue;
    runs.set(window[0], mergeRun(input, window, universe));
  }

  return {
    rooms: [...universe.values()].sort((a, b) => compareCodes(a.code, b.code)),
    kinds: new Map(
      [...universe.values()].map((room) => [room.code, room.kind] as const)
    ),
    periods,
    runs,
  };
}

/** One period: the rooms free in it, the blocks, and what is in the rest. */
function mergePeriod(
  index: DayIndex,
  live: LiveDay | null,
  periodKey: string,
  universe: Map<string, MergedRoom>
): MergedPeriod {
  const reportBusy = index.byPeriod.get(periodKey) ?? new Set<string>();
  const serverPeriod = livePeriodFor(live, periodKey);
  const serverBusy = new Set((serverPeriod?.occupied ?? []).map((o) => o.code));

  // The union: a room is offered only when neither source has it booked.
  const busy = new Set<string>([...reportBusy, ...serverBusy]);

  const free = [...universe.keys()].filter((code) => !busy.has(code)).sort(compareCodes);
  const theory = free.filter((code) => universe.get(code)?.kind !== "lab");
  const lab = free.filter((code) => universe.get(code)?.kind === "lab");

  const occupants = new Map<string, MergedOccupant[]>();
  for (const code of busy) {
    const serverOccupants = (serverPeriod?.occupied ?? []).filter((o) => o.code === code);
    if (serverOccupants.length > 0) {
      occupants.set(
        code,
        serverOccupants.map((o) => ({
          code: o.code,
          courseCode: o.courseCode,
          title: o.title,
          faculty: o.faculty,
          source: "live" as const,
        }))
      );
      continue;
    }
    // The report's courses for *this* period. `index.courses` is the room's
    // whole day, so reading it here listed every class the room has that day
    // on every period it is busy — the room inspector then showed the same
    // wrong class all day. `coursesInPeriod` is the period-scoped answer.
    const reportCourses = index.coursesInPeriod.get(periodKey)?.get(code) ?? [];
    if (reportCourses.length > 0) {
      occupants.set(
        code,
        reportCourses.map((c) => ({
          code,
          courseCode: c.CODE ?? "",
          title: c.TITLE ?? "",
          faculty: c.FACULTY ?? "",
          source: "report" as const,
        }))
      );
    }
  }

  return {
    free: { rooms: free, theory, lab, runLength: new Map(free.map((c) => [c, 1])) },
    blocks: blocksFor(universe, free),
    occupants,
  };
}

/**
 * A run of consecutive periods.
 *
 * The two sources each say how long a room holds out for, and the answer is
 * the shorter of the two: a room that one source says is taken halfway
 * through the run is not free for the run, whichever source says otherwise.
 */
function mergeRun(
  input: { index: DayIndex; live: LiveDay | null },
  window: string[],
  universe: Map<string, MergedRoom>
): MergedRun {
  const reportRun = freeRoomsForRun(input.index, window);
  const serverRun = liveRunFor(input.live, window[0]);

  const runLength = new Map<string, number>();
  for (const code of universe.keys()) {
    const reportHeld = reportRun.runLength.get(code) ?? window.length;
    const serverHeld = serverRun
      ? Number(serverRun.runLength?.[code] ?? window.length)
      : window.length;
    runLength.set(code, Math.min(reportHeld, serverHeld));
  }

  const rooms = [...runLength.entries()]
    .filter(([, n]) => n === window.length)
    .map(([code]) => code)
    .sort(compareCodes);

  return {
    rooms,
    theory: rooms.filter((code) => universe.get(code)?.kind !== "lab"),
    lab: rooms.filter((code) => universe.get(code)?.kind === "lab"),
    runLength,
    blocks: blocksFor(universe, rooms),
  };
}

/**
 * Availability per block, sorted by how empty the block is.
 *
 * The same shape and the same ordering as the report-only answer, so the page
 * renders the same way whichever source is answering.
 */
function blocksFor(
  universe: Map<string, MergedRoom>,
  free: readonly string[]
): BlockAvailability[] {
  const blocks = new Map<string, { total: number; freeTheory: string[]; freeLab: string[] }>();
  for (const room of universe.values()) {
    const entry = blocks.get(room.block) ?? { total: 0, freeTheory: [], freeLab: [] };
    entry.total++;
    blocks.set(room.block, entry);
  }
  for (const code of free) {
    const room = universe.get(code);
    if (!room) continue;
    const entry = blocks.get(room.block);
    if (!entry) continue;
    (room.kind === "lab" ? entry.freeLab : entry.freeTheory).push(code);
  }

  const out: BlockAvailability[] = [];
  for (const [block, entry] of blocks) {
    const count = entry.freeTheory.length + entry.freeLab.length;
    if (count === 0) continue;
    out.push({
      block,
      freeTheory: entry.freeTheory,
      freeLab: entry.freeLab,
      total: entry.total,
      free: count,
    });
  }
  return out.sort((a, b) => b.free - a.free || a.block.localeCompare(b.block));
}
