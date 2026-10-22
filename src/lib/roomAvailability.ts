/**
 * The server's answer about which rooms are free.
 *
 * ## Why the finding moved to the server
 *
 * The free-classroom page used to answer "which rooms are free?" by scanning
 * every row of a hand-maintained FFCS spreadsheet on every day and period
 * change. That file records what was booked during registration, so a
 * rescheduled lab, a room changed by the admin or a cancelled section never
 * reached it — and it was stale between registration cycles.
 *
 * The server holds the class details every student contributes during their
 * sync, so it can answer from what the campus actually looks like this term.
 * The union of a few thousand students' timetables is the campus timetable.
 *
 * ## What the client still owns
 *
 * The periods. The campus schema — which periods run on which day, and which
 * VTOP slot each one is — lives here, and the server asks for it rather than
 * keeping a second copy that could drift. So the client sends the slots
 * running in each period it is showing, and the server sends back the answer.
 *
 * ## The fallback
 *
 * The server has nothing for a term until students have synced, and it can be
 * unreachable. So this module never throws and never blocks the page: a
 * failure is a null, and the page falls back to the spreadsheet it has always
 * used. The page says which answer it is showing.
 */

import { api } from "@/lib/sync-engine";
import type { BlockAvailability, DayId, FreeRooms } from "@/lib/freeClassrooms";

export type LiveRoom = {
  code: string;
  block: string;
  kind: "theory" | "lab";
};

/** A class sitting in a room, as the inspector renders it. */
export type LiveOccupant = {
  code: string;
  classId: string;
  courseCode: string;
  title: string;
  faculty: string;
  component: string;
  slots: string[];
};

export type LivePeriod = {
  key: string;
  slots: string[];
  free: string[];
  theory: string[];
  lab: string[];
  occupied: LiveOccupant[];
  blocks: BlockAvailability[];
};

export type LiveRun = {
  startKey: string;
  length: number;
  rooms: string[];
  runLength: Record<string, number>;
};

export type LiveDay = {
  semesterId: string;
  day: string;
  rooms: LiveRoom[];
  periods: LivePeriod[];
  runs: LiveRun[];
};

type LivePayload = {
  success?: boolean;
  noData?: boolean;
  semesterId?: string;
  day?: string;
  rooms?: LiveRoom[];
  periods?: LivePeriod[];
  runs?: LiveRun[];
};

/** `"mon"` → `"MON"`, the spelling the slot vocabulary uses. */
export function dayToServerDay(day: DayId): string {
  return String(day).toUpperCase();
}

/**
 * Ask the server about one day.
 *
 * One request answers everything the page needs for that day: the free rooms
 * in every period, the classroom and laboratory split, the per-block counts,
 * the occupants of every taken room, and the runs starting at every period.
 * Changing the selected period is therefore a lookup rather than a request.
 *
 * Returns null for "no answer" — the server has nothing for this term, the
 * request failed, or the payload was not what it should be. The caller falls
 * back to its own timetable.
 */
export async function fetchLiveDay(input: {
  semesterId: string;
  day: DayId;
  periods: { key: string; slots: string[] }[];
  runLength: number;
}): Promise<LiveDay | null> {
  if (!input.semesterId || input.periods.length === 0) return null;

  try {
    const res = (await api("rooms/free", {
      method: "POST",
      body: {
        semesterId: input.semesterId,
        day: dayToServerDay(input.day),
        periods: input.periods,
        runLength: input.runLength,
      },
    })) as LivePayload | null;

    if (!res || res.success === false) return null;
    if (res.noData) return null;
    if (!Array.isArray(res.periods) || res.periods.length === 0) return null;

    return {
      semesterId: res.semesterId ?? input.semesterId,
      day: res.day ?? dayToServerDay(input.day),
      rooms: Array.isArray(res.rooms) ? res.rooms : [],
      periods: res.periods,
      runs: Array.isArray(res.runs) ? res.runs : [],
    };
  } catch {
    // A network failure is a missing answer, not a broken page.
    return null;
  }
}

/** The server's answer for one period, or null when it does not know it. */
export function livePeriodFor(
  live: LiveDay | null,
  periodKey: string
): LivePeriod | null {
  if (!live) return null;
  return live.periods.find((p) => p.key === periodKey) ?? null;
}

/** The run starting at a period, or null when the server did not answer it. */
export function liveRunFor(live: LiveDay | null, startKey: string): LiveRun | null {
  if (!live) return null;
  return live.runs.find((r) => r.startKey === startKey) ?? null;
}

/** The free rooms of a period, in the shape the page already uses. */
export function toFreeRooms(period: LivePeriod): FreeRooms {
  return {
    rooms: period.free ?? [],
    theory: period.theory ?? [],
    lab: period.lab ?? [],
    runLength: new Map((period.free ?? []).map((code) => [code, 1])),
  };
}

/**
 * The free rooms of a run, in the shape the page already uses.
 *
 * The run itself is the server's answer; the theory/lab split is taken from
 * the inventory, because a run is a set of rooms and the split is a property
 * of the room rather than of the run.
 */
export function toRunRooms(
  run: LiveRun,
  kinds: Map<string, "theory" | "lab">
): FreeRooms {
  const rooms = run.rooms ?? [];
  const runLength = new Map<string, number>();
  for (const code of Object.keys(run.runLength ?? {})) {
    runLength.set(code, Number(run.runLength[code]));
  }
  return {
    rooms,
    theory: rooms.filter((code) => kinds.get(code) !== "lab"),
    lab: rooms.filter((code) => kinds.get(code) === "lab"),
    runLength,
  };
}

/** Whether a room is a laboratory, as the server has it. */
export function liveRoomKinds(live: LiveDay | null): Map<string, "theory" | "lab"> {
  const map = new Map<string, "theory" | "lab">();
  for (const room of live?.rooms ?? []) {
    map.set(room.code, room.kind === "lab" ? "lab" : "theory");
  }
  return map;
}

/** What is sitting in a room in a period, or null when it is free. */
export function occupantFor(
  live: LiveDay | null,
  roomCode: string,
  periodKey: string
): LiveOccupant | null {
  const period = livePeriodFor(live, periodKey);
  if (!period) return null;
  return period.occupied?.find((o) => o.code === roomCode) ?? null;
}
