"use client";

/**
 * The common-free grid, drawn as a timetable.
 *
 * This used to be a 7 × 12 table of `free/total` numbers: days down the left,
 * band columns across, one row per band. It is now the **full timetable view**
 * — days across the top, time bands down the left — the same shape the Full
 * Weekly Timetable sheet uses, so a week of shared availability reads as a
 * week rather than as a matrix.
 *
 * ## What changed and what did not
 *
 * The *data* is untouched. Occupancy still arrives as explicit `DAY:SLOTID`
 * keys, so there is nothing to re-derive, and the projection of `config.json`
 * onto the week's bands is the shared one in `timetable/periodSkeleton.ts` —
 * the same projection the attendance timetable draws on, which is why the two
 * views cannot drift apart.
 *
 * What changed is the **unit of the count**. The old grid asked "how many
 * (person, slot) pairs are occupied in this cell", so a person holding both
 * the theory and the lab half of a band was counted twice and the cell could
 * read `-2/4`. A timetable band is *one* period of a person's day, so the
 * question is now "how many people are busy in this band", and a person is
 * busy if they hold either half of it. That is the same rule the vertical
 * timetable uses to decide that a band holds a class.
 *
 * ## The shape
 *
 * Rows are the week's time bands, shared across days — the same row skeleton
 * the course timetable uses, so a slot lands in the same row in both. Columns
 * are days. Every cell is one band of one day, and a tap opens the sheet that
 * says who is busy in it and who is free.
 */

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarRange, Info, Users } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { CHIP, EMPTY_STATE, TONE_TEXT } from "@/lib/libraries/ui";
import { DAYS, fmt, parseSlotKey, slotMap, type Day } from "@/lib/social/schedule";
import type { BusyEntry, BusyMap, SocialVisibility } from "@/lib/social/types";
import TimetableGridShell, {
  useTodayKey,
  type ShellCell,
  type ShellDay,
} from "../timetable/TimetableGridShell";
import type { Band } from "../timetable/buildBands";
import { buildPeriodSkeleton } from "../timetable/periodSkeleton";
import { useTimetableViewMode } from "../timetable/useTimetableViewMode";

export type GridPeer = {
  handle: string;
  name: string;
  busyMap: BusyMap;
  visibility: SocialVisibility;
  loaded: boolean;
};

type Person = {
  name: string;
  /** `null` for us — we have no peer sheet to open. */
  handle: string | null;
  busyMap: BusyMap;
};

type Cell = {
  day: Day;
  bandIndex: number;
  /** The band's shared time label, e.g. `"8:00 AM – 8:50 AM"`. */
  label: string;
  /** The time of the slots this day actually puts in the band. */
  dayTime: string;
  /** The slot ids the band holds on this day. */
  slotIds: string[];
  busy: number;
  free: number;
  total: number;
  /** Who is busy, with the day-explicit key that proves it. */
  who: { name: string; handle: string | null; key: string; entry: BusyEntry }[];
  freeNames: { name: string; handle: string | null }[];
};

/** The `free/total` fraction, spoken for a screen reader and a tooltip. */
function describe(cell: Cell): string {
  return `${cell.day} ${cell.dayTime || cell.label} — ${cell.free} of ${cell.total} free`;
}

export default function CommonFreeTimetableGrid({
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

  const today = useTodayKey();
  // The same density the user's own timetable uses, so the two read alike.
  const { density } = useTimetableViewMode();
  const compact = density === "compact";

  const skeleton = useMemo(() => buildPeriodSkeleton(), []);

  /** Everyone whose timetable we actually have, plus us. */
  const roster = useMemo(
    () => peers.filter((p) => p.loaded && Object.keys(p.busyMap ?? {}).length > 0),
    [peers]
  );

  const cells = useMemo(() => {
    const people: Person[] = [
      { name: "You", handle: null, busyMap: ownBusyMap ?? {} },
      ...roster.map((p) => ({
        name: p.name,
        handle: p.handle,
        busyMap: p.busyMap ?? {},
      })),
    ];

    const out = {} as Record<Day, Cell[]>;
    for (const day of DAYS) {
      const cols = skeleton.columns[day] ?? [];
      out[day] = cols.map((col, bandIndex) => {
        const slotIds = [col.theory?.slotId, col.lab?.slotId].filter(
          (s): s is string => Boolean(s)
        );

        const who: Cell["who"] = [];
        const freeNames: Cell["freeNames"] = [];

        for (const person of people) {
          // Busy means holding *either* half of the band: a band is one period
          // of a person's day, so a theory class and a lab class at the same
          // time are one commitment, not two.
          let key: string | null = null;
          let entry: BusyEntry | undefined;
          for (const id of slotIds) {
            const candidate = `${day}:${id}`;
            const hit = person.busyMap?.[candidate];
            if (hit) {
              key = candidate;
              entry = hit;
              break;
            }
          }
          if (key) who.push({ name: person.name, handle: person.handle, key, entry: entry! });
          else freeNames.push({ name: person.name, handle: person.handle });
        }

        const theoryTime = col.theory ? slotMap[day]?.[col.theory.slotId]?.time : undefined;
        const labTime = col.lab ? slotMap[day]?.[col.lab.slotId]?.time : undefined;
        const dayTime = theoryTime ?? labTime ?? "";

        return {
          day,
          bandIndex,
          label: skeleton.bands[bandIndex]?.label ?? "",
          dayTime,
          slotIds,
          busy: who.length,
          free: people.length - who.length,
          total: people.length,
          who,
          freeNames,
        };
      });
    }
    return out;
  }, [ownBusyMap, roster, skeleton]);

  const days = useMemo<ShellDay[]>(
    () =>
      (dayFilter === "ALL" ? DAYS : [dayFilter]).map((d) => ({
        id: d,
        name: d,
      })),
    [dayFilter]
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

  const renderCell = (band: Band, day: ShellDay): ShellCell | null => {
    const cell = cells[day.id as Day]?.[band.index];
    if (!cell) return null;

    const allFree = cell.free === cell.total;
    const noneFree = cell.free === 0;
    const muted = everyoneFreeOnly && !allFree;
    const description = describe(cell);

    return {
      content: (
        <>
          <span
            className={
              compact
                ? "text-[13px] font-black leading-none"
                : "text-[15px] font-black leading-none"
            }
          >
            {cell.free}
          </span>
          <span className="text-[9px] font-bold leading-none opacity-70">/{cell.total}</span>
        </>
      ),
      title: description,
      ariaLabel: description,
      onClick: () => setActiveCell(cell),
      tileClassName: [
        allFree
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : noneFree
            ? "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300"
            : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
        muted ? "opacity-25 saturate-50" : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  };

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
          Highlight slots everyone is free
        </label>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium sm:ml-auto">
          {roster.length + 1} people · tap a slot for detail
        </p>
      </div>

      <div className="space-y-2.5">
        <TimetableGridShell
          bands={skeleton.bands}
          days={days}
          renderCell={renderCell}
          compact={compact}
          today={today}
        />

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
            everyone free
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40" />
            partial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/40" />
            everyone busy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-zinc-300 dark:border-zinc-800" />
            number free / people
          </span>
        </div>
      </div>

      {/* The cell inspector was an always-dark inline box sitting in a light
          page. It is a sheet now. */}
      {/* Wrapped so the sheet animates out. Without `AnimatePresence` the exit
          variants never run and it vanishes instead of sliding down. */}
      <AnimatePresence>
        {activeCell && (
          <BottomSheet
            onClose={() => setActiveCell(null)}
            overlayId="social-cell-detail"
            maxWidth="max-w-sm"
            title={`${activeCell.day} · ${fmt(activeCell.dayTime.split("-")[0])} – ${fmt(activeCell.dayTime.split("-")[1])}`}
            subtitle={
              <span
                className={`font-bold ${
                  activeCell.busy === 0
                    ? TONE_TEXT.emerald
                    : activeCell.free === 0
                      ? TONE_TEXT.red
                      : TONE_TEXT.amber
                }`}
              >
                {activeCell.free} of {activeCell.total} free
              </span>
            }
            icon={<CalendarRange className="w-4.5 h-4.5" />}
            accent="border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            closeLabel="Close cell detail"
          >
            <div className="text-left space-y-4">
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
                        {w.handle && onOpenPeer ? (
                          <button
                            type="button"
                            onClick={() => onOpenPeer(w.handle!)}
                            className="w-full text-left cursor-pointer"
                          >
                            <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-outfit truncate underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-2">
                              {w.name}
                            </p>
                          </button>
                        ) : (
                          <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-outfit truncate">
                            {w.name}
                          </p>
                        )}
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
                    {activeCell.freeNames.map((n) =>
                      n.handle && onOpenPeer ? (
                        <button
                          key={n.name}
                          type="button"
                          onClick={() => onOpenPeer(n.handle!)}
                          className={`${CHIP} cursor-pointer transition-opacity hover:opacity-70`}
                        >
                          {n.name}
                        </button>
                      ) : (
                        <span key={n.name} className={CHIP}>
                          {n.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed flex items-start gap-1.5">
                <Info className="w-3 h-3 mt-px shrink-0" />
                Names and course detail come from each pair&apos;s timetable. An older free/busy-only
                grant contributes occupancy without a course or venue.
              </p>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
