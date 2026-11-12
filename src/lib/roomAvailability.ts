/**
 * Room availability types shared by the free-classrooms page and the room
 * merge.
 *
 * `/api/rooms/free` no longer exists on the server, so the live fetch is gone
 * entirely and the page always falls back to the FFCS report it has always
 * had. The types stay because the merge code paths and their tests are
 * written against them.
 */

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

/** `"mon"` → `"MON"`, kept for the shared type signatures (unused now). */
export function dayToServerDay(day: DayId): string {
  return String(day).toUpperCase();
}

/** The server's answer for one period, or null when it does not know it. */
export function livePeriodFor(live: LiveDay | null, periodKey: string): LivePeriod | null {
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
export function toRunRooms(run: LiveRun, kinds: Map<string, "theory" | "lab">): FreeRooms {
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
export function occupantFor(live: LiveDay | null, roomCode: string, periodKey: string): LiveOccupant | null {
  const period = livePeriodFor(live, periodKey);
  if (!period) return null;
  return period.occupied?.find((o) => o.code === roomCode) ?? null;
}
