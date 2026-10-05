"use client";

/**
 * The 7 × 12 common-free grid.
 *
 * Rebuilt on the server-derived model. The previous 635-line version took the
 * legacy `Friend[]` + `myAttendance` pair and re-derived occupancy by fanning
 * each `slotId` across every day it appeared on, which marked friends busy on
 * days they were not in class. Occupancy now arrives as explicit `DAY:SLOTID`
 * keys, so there is nothing left to re-derive and that whole class of bug is
 * gone rather than patched.
 *
 * It also drops three private copies of the time parser (see
 * docs/social-tt/09-schedule-math.md §4) and de-duplicates the ~40-line `<td>`
 * block, which is why this is shorter than what it replaces.
 *
 * ## The projection
 *
 * `config.json` has no notion of "column", so the 12 columns are re-derived from
 * Monday at render time: Monday's slots are split theory/lab by the `L` prefix,
 * sorted by start time, and paired index-wise. Every other day is projected by
 * matching **time strings**, which covers all 164 slots exactly once.
 *
 * The theory/lab pairing is a display concern. It never touches the data — a busy
 * map is a flat set of `DAY:SLOTID` keys regardless.
 */

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarRange, Info, Users } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { CHIP, EMPTY_STATE, TONE_TEXT } from "@/lib/libraries/ui";
import {
  DAYS,
  fmt,
  mondaySkeleton,
  parseSlotKey,
  slotMap,
  slotRange,
  type Day,
  type SlotMap,
} from "@/lib/social/schedule";
import type { BusyMap, SocialVisibility } from "@/lib/social/types";

export type GridPeer = {
  handle: string;
  name: string;
  busyMap: BusyMap;
  visibility: SocialVisibility;
  loaded: boolean;
};

type Column = {
  theory: { day: Day; slotId: string } | null;
  lab: { day: Day; slotId: string } | null;
};

type Cell = {
  day: Day;
  column: number;
  time: string;
  busy: number;
  free: number;
  total: number;
  /** Who is busy, with the day-explicit key that proves it. */
  who: { name: string; key: string; entry: BusyMap[string] }[];
  freeNames: string[];
};

/**
 * Exported for tests. The invariant the design rests on is that the projection
 * covers every slot in `config.json` exactly once per day — no gaps, no
 * double-counting. That is asserted in `social-grid.test.ts` rather than assumed,
 * because a `config.json` edit that broke it would silently shift the whole grid.
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

export default function CommonFreeSlotsGrid({
  ownBusyMap,
  peers,
  onOpenPeer,
}: {
  ownBusyMap: BusyMap;
  peers: GridPeer[];
  onOpenPeer?: (handle: string) => void;
}) {
  const [everyoneFreeOnly, setEveryoneFreeOnly] = useState(false);
  const [dayFilter, setDayFilter] = useState<"ALL" | Day>("ALL");
  const [activeCell, setActiveCell] = useState<Cell | null>(null);

  const columns = useMemo(() => projectColumns(), []);

  /** Everyone whose timetable we actually have, plus us. */
  const roster = useMemo(
    () => peers.filter((p) => p.loaded && Object.keys(p.busyMap ?? {}).length > 0),
    [peers]
  );

  const cells = useMemo(() => {
    const list: Cell[] = [];
    for (const day of DAYS) {
      const cols = columns[day] ?? [];
      cols.forEach((col, columnIndex) => {
        const theorySlot = col.theory ? slotMap[day]?.[col.theory.slotId] : null;
        const labSlot = col.lab ? slotMap[day]?.[col.lab.slotId] : null;
        const time = theorySlot?.time ?? labSlot?.time ?? "";
        if (!time) return;

        const who: Cell["who"] = [];
        const freeNames: string[] = [];
        let busy = 0;

        const check = (slotId: string | undefined) => {
          if (!slotId) return;
          const key = `${day}:${slotId}`;
          if (ownBusyMap?.[key]) {
            busy++;
            who.push({ name: "You", key, entry: ownBusyMap[key] });
          }
          for (const peer of roster) {
            const entry = peer.busyMap?.[key];
            if (entry) {
              busy++;
              who.push({ name: peer.name, key, entry });
            } else {
              freeNames.push(peer.name);
            }
          }
        };
        check(col.theory?.slotId);
        check(col.lab?.slotId);

        list.push({
          day,
          column: columnIndex,
          time,
          busy,
          free: roster.length + 1 - busy,
          total: roster.length + 1,
          who,
          freeNames,
        });
      });
    }
    return list;
  }, [columns, ownBusyMap, roster]);

  const visible = useMemo(
    () =>
      cells.filter((c) => {
        if (everyoneFreeOnly && c.busy !== 0) return false;
        if (dayFilter !== "ALL" && c.day !== dayFilter) return false;
        return true;
      }),
    [cells, everyoneFreeOnly, dayFilter]
  );

  const byDay = useMemo(() => {
    const out = {} as Record<Day, Cell[]>;
    for (const day of DAYS) out[day] = [];
    for (const c of visible) out[c.day].push(c);
    return out;
  }, [visible]);

  const totalColumns = useMemo(
    () => Math.max(...DAYS.map((d) => byDay[d].length), 0),
    [byDay]
  );

  if (!roster.length) {
    return (
      <div className={EMPTY_STATE}>
        <span className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
          <Users className="w-4.5 h-4.5 text-zinc-400" />
        </span>
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-3">
          No peer timetables loaded
        </p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-1.5 leading-relaxed max-w-[320px] mx-auto">
          The grid compares your week against everyone you are paired with, so it needs at least
          one peer to have published a timetable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Flat toolbar. The old version nested this inside a TILE, which put four
          rounded bordered surfaces around one data cell. */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 border border-zinc-200/60 dark:border-zinc-800/60 overflow-x-auto max-w-full">
          {(["ALL", ...DAYS] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDayFilter(d as "ALL" | Day)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                dayFilter === d
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {d === "ALL" ? "All" : d}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={everyoneFreeOnly}
            onChange={(e) => setEveryoneFreeOnly(e.target.checked)}
            className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
          />
          Only slots everyone is free
        </label>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium sm:ml-auto">
          {roster.length + 1} people · tap a slot for detail
        </p>
      </div>

      {visible.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            No slots match these filters
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr>
                <th className="border border-zinc-200 dark:border-zinc-800/80 px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 font-bold text-left sticky left-0 z-10">
                  Slot
                </th>
                {Array.from({ length: totalColumns }, (_, i) => (
                  <th
                    key={i}
                    className="border border-zinc-200 dark:border-zinc-800/80 px-1 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 font-bold"
                  >
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <th className="border border-zinc-200 dark:border-zinc-800/80 px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300 font-bold text-left sticky left-0 z-10">
                    {day}
                  </th>
                  {Array.from({ length: totalColumns }, (_, i) => {
                    const cell = byDay[day][i];
                    if (!cell) {
                      return (
                        <td
                          key={i}
                          className="border border-zinc-200/60 dark:border-zinc-800/60 px-1 py-1.5 text-center text-zinc-300 dark:text-zinc-700"
                        >
                          –
                        </td>
                      );
                    }
                    const free = cell.busy === 0;
                    return (
                      <td key={i} className="border border-zinc-200/60 dark:border-zinc-800/60 p-0">
                        <button
                          type="button"
                          onClick={() => setActiveCell(cell)}
                          title={`${day} ${cell.time} — ${cell.free} of ${cell.total} free`}
                          className={`w-full px-1 py-1.5 text-center font-bold transition-colors cursor-pointer ${
                            free
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                              : cell.free === 0
                                ? "bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                          }`}
                        >
                          {cell.free}/{cell.total}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
          everyone free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" />
          partial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" />
          everyone busy
        </span>
      </div>

      {/* The cell inspector was an always-dark inline box sitting in a light
          page. It is a sheet now. */}
      {/* Wrapped so the sheet animates out. Without `AnimatePresence` the exit
          variants never run and it vanishes instead of sliding down. */}
      <AnimatePresence>
      {activeCell && (
        <BottomSheet onClose={() => setActiveCell(null)} overlayId="social-cell-detail" maxWidth="max-w-sm">
          <div className="text-left space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <CalendarRange className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit leading-tight">
                  {activeCell.day} · {fmt(activeCell.time.split("-")[0])} – {fmt(activeCell.time.split("-")[1])}
                </h3>
                <p className={`text-[11px] font-bold ${activeCell.busy === 0 ? TONE_TEXT.emerald : TONE_TEXT.amber}`}>
                  {activeCell.free} of {activeCell.total} free
                </p>
              </div>
            </div>

            {activeCell.who.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Busy
                </p>
                {activeCell.who.map((w) => {
                  const parsed = parseSlotKey(w.key);
                  return (
                    <div
                      key={`${w.name}-${w.key}`}
                      className="p-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800"
                    >
                      <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-outfit truncate">
                        {w.name}
                        {w.name === "You" ? "" : ""}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                        {parsed ? `${parsed.day} · ${parsed.slotId}` : w.key}
                        {w.entry.c ? ` · ${w.entry.c}` : ""}
                        {w.entry.v ? ` · ${w.entry.v}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeCell.freeNames.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Free
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeCell.freeNames.map((n) => (
                    <span key={n} className={CHIP}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-px shrink-0" />
              Names show only what each pair&apos;s visibility allows. A peer on a coarse pair
              contributes occupancy without a course or venue.
            </p>
          </div>
        </BottomSheet>
      )}
      </AnimatePresence>
    </div>
  );
}
