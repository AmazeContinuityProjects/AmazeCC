/**
 * The free-classroom model.
 *
 * The page this backs used to answer "which rooms are free?" by re-scanning all
 * 2,357 timetable rows on every day/period change, and it got three things
 * wrong along the way. All three were silent — the page rendered confidently
 * and was simply lying.
 *
 *  - **Lab occupancy was skipped for 8 of 12 periods.** Theory periods are
 *    `"8:00 AM - 8:50 AM"`; lab periods are `"08:00 AM - 08:50 AM"`. The lookup
 *    compared those strings, never matched, and so never added the lab slot to
 *    the set of slots being tested. Every lab in those periods was reported
 *    free while a class was sitting in it.
 *  - **Blocks split on trailing whitespace.** Six venues are recorded as
 *    `"AB3 "`, so `room.split("-")[0]` produced a block called `AB3 ` alongside
 *    a block called `AB3`. The filter offered both, and split the counts
 *    65 rooms / 2 rooms across a pair of entries for the same building.
 *  - **Half the lab periods were unreachable.** The selectable list was built
 *    from `schema.theory` alone, so the 8 lab periods that do not coincide
 *    with a theory period could not be picked at all.
 *  - **The law school was invisible.** Law courses book `A+TA+TAA` where
 *    everyone else books `A1+TA1+TAA1`, and the slot test compared the strings
 *    literally. None of the 99 law rows ever matched, so all 20 rooms in AB5
 *    were reported free for every morning period while a class was sitting in
 *    them. `src/lib/slots.ts` holds the two spellings.
 *
 * So the period list is now the union of theory and lab, keyed by a normalised
 * time (`08:00 AM` and `8:00 AM` are the same period), and a room's block is
 * derived from a trimmed venue.
 *
 * ## One index per day
 *
 * `buildDayIndex` is the whole point. It walks the courses once and produces
 * both a room→slot map and a room→period map, after which every question the
 * page asks — free now, free for the next three periods, the room's day
 * timeline — is a set lookup instead of a full scan. 239 rooms and 12 periods
 * is a few thousand operations, so the day index is cheap enough to rebuild
 * whenever the selected day changes and never has to be invalidated.
 */

import {
  periodKey,
  slotSpellings,
  timeToMinutes,
  type CampusSchema,
  type DayId,
  type SchemaPeriod,
} from "./slots";

/**
 * The schema shape and the clock live in `./slots` now, because six other
 * features ask the same questions about periods and were each carrying their own
 * answer. Re-exported so this module's own importers — `FreeClassroomsTab.tsx`
 * and `__tests__/freeClassrooms.test.ts` — keep working unchanged.
 */
export { periodKey, timeToMinutes };
export type { CampusSchema, DayId, SchemaPeriod };

/** A row of the FFCS report. Only the fields this model reads. */
export interface FreeRoomCourse {
  CODE?: string;
  TITLE?: string;
  TYPE?: string;
  SLOT?: string;
  FACULTY?: string;
  VENUE?: string;
}

export const DAY_LABELS: Record<DayId, { full: string; short: string }> = {
  mon: { full: "Monday", short: "Mon" },
  tue: { full: "Tuesday", short: "Tue" },
  wed: { full: "Wednesday", short: "Wed" },
  thu: { full: "Thursday", short: "Thu" },
  fri: { full: "Friday", short: "Fri" },
};

export type RoomKind = "theory" | "lab";

export interface RoomInfo {
  /** Trimmed venue, uppercased, e.g. `"AB5-208"`. */
  code: string;
  /** Trimmed block, e.g. `"AB5"`. */
  block: string;
  kind: RoomKind;
}

export interface RoomOccurrence {
  course: FreeRoomCourse;
  periodKey: string;
  slot: string;
}

/** Everything the page needs for one selected day. */
export interface DayIndex {
  rooms: Map<string, RoomInfo>;
  /** Room code → the period keys it is occupied in. */
  occupancy: Map<string, Set<string>>;
  /** Period key → the rooms occupied in it. */
  byPeriod: Map<string, Set<string>>;
  /** Block → its room codes, sorted. */
  blocks: Map<string, string[]>;
  /** Room code → every course due in it, for the inspector. */
  courses: Map<string, FreeRoomCourse[]>;
  /** Period keys in timetable order, restricted to this day. */
  periods: PeriodOption[];
}

export interface PeriodOption {
  /** Normalised `"8:00am-8:50am"` — the identity of a period. */
  key: string;
  start: string;
  end: string;
  /** `"8:00 AM – 8:50 AM"`, for display. */
  label: string;
  /** Minutes since midnight, for ordering. */
  startMinutes: number;
  endMinutes: number;
  /** The raw VTOP slot id this period maps to, per kind. */
  theorySlot?: string;
  labSlot?: string;
}

/* ── reading the report ────────────────────────────────────────────────── */

/**
 * Normalise one spreadsheet row into a course.
 *
 * The FFCS report is a hand-maintained CSV, so its header row is not something
 * to trust: it may carry a UTF-8 BOM on the first column, and the column names
 * vary between "COURSE CODE"/"CODE" and "VENUE"/"ROOM".
 *
 * The BOM is stripped with the `\uFEFF` **escape** rather than a literal
 * character on purpose. A literal survives copying badly — it can be
 * normalised away, typed as a zero-width space, or arrive as `?` — and when it
 * does, the strip silently matches nothing, the first key keeps its BOM, `CODE`
 * comes back empty, and every row is then dropped by the caller's
 * `CODE`-required filter. That is a silent total data loss, not a visible parse
 * error, so it is covered by a test rather than trusted to the editor.
 */
export function parseCourseRow(row: Record<string, unknown>): FreeRoomCourse {
  const clean: Record<string, unknown> = {};
  for (const key in row) {
    clean[key.replace(/^\uFEFF/, "").trim().toUpperCase()] = row[key];
  }
  const text = (a: unknown, b?: unknown) => String(a ?? b ?? "").trim();
  return {
    CODE: text(clean.CODE, clean["COURSE CODE"]),
    TITLE: text(clean.TITLE, clean["COURSE TITLE"]),
    TYPE: text(clean.TYPE),
    SLOT: text(clean.SLOT),
    FACULTY: text(clean.FACULTY),
    VENUE: text(clean.VENUE, clean.ROOM),
  };
}

/** Parse a report, dropping rows that name no course. */
export function parseCourseRows(rows: readonly Record<string, unknown>[]): FreeRoomCourse[] {
  return rows.map(parseCourseRow).filter((c) => c.CODE);
}

/* ── time ──────────────────────────────────────────────────────────────── */

/**
 * `"8:00 AM"` → 480. Returns null for anything unreadable so a bad schema
 * entry drops out of the period list instead of sorting to the front of it.
 */
export function timeToMinutes(time: string): number | null {
  const match = String(time ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = (match[3] || "").toUpperCase();
  if (hours > 23 || minutes > 59) return null;

  if (period === "PM" && hours !== 12) hours += 12;
  else if (period === "AM" && hours === 12) hours = 0;
  else if (!period) return null; // A 24h time is not in this schema.

  return hours * 60 + minutes;
}

/**
 * `"08:00 AM"` → `"8:00am"`, `"8:00 AM"` → `"8:00am"`. The normalisation that
 * makes lab and theory agree.
 *
 * The minutes have to survive: the two 8 o'clock periods in the Chennai schema
 * are `8:00–8:50` and `8:55–9:45`, and dropping them would collapse both into
 * one key.
 */
function normaliseTime(time: string): string {
  const total = timeToMinutes(time);
  if (total === null) return String(time ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const hours24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const suffix = hours24 < 12 ? "am" : "pm";
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")}${suffix}`;
}

/** The identity of a period, independent of zero-padding. */
export function periodKey(start: string, end: string): string {
  return `${normaliseTime(start)}-${normaliseTime(end)}`;
}

/** `480` → `"8:00 AM"`, for building a display label from a slot. */
function formatClock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mm = minutes % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/* ── periods ───────────────────────────────────────────────────────────── */

/**
 * Every period the timetable actually runs on a given day.
 *
 * The union of `schema.theory` and `schema.lab`, because neither is complete on
 * its own: labs run at times no lecture does, and lectures run at times no lab
 * does. A period present in both is one period with two slot ids, not two
 * periods — which is why the *lookup* is keyed and the theory/lab slots live on
 * the same entry.
 *
 * ## Then overlapping periods are merged
 *
 * The two lists interleave. On a Monday, theory runs 8:00–8:50 and 8:55–9:45
 * while labs run 8:00–8:50 and 8:50–9:40 — so the lab block at 8:50–9:40 sits
 * *across* the boundary and overlaps the 8:55 lecture for 45 of its 50 minutes.
 *
 * Left as separate periods, picking the lab block would test only the lab slot
 * and cheerfully report every lecture room as free, right up until the lecture
 * starts. So overlapping entries are collapsed into one window carrying the
 * union of their slots, which turns Monday's 18 raw entries into 12 blocks a
 * person would actually describe as "periods". Non-overlapping entries — the
 * five-minute changeover, the lunch gap — stay separate, because there is a
 * real gap there and merging across it would invent occupancy that never
 * happens.
 */
export function resolvePeriods(schema: CampusSchema, day: DayId): PeriodOption[] {
  const byKey = new Map<string, PeriodOption>();

  const add = (periods: SchemaPeriod[] | undefined, kind: RoomKind) => {
    periods?.forEach((p) => {
      if (p.lunch || !p.start || !p.end) return;
      const slot = p.days?.[day];
      if (!slot) return;

      const key = periodKey(p.start, p.end);
      const startMinutes = timeToMinutes(p.start);
      const endMinutes = timeToMinutes(p.end);
      if (startMinutes === null || endMinutes === null) return;

      const existing = byKey.get(key);
      if (existing) {
        if (kind === "theory") existing.theorySlot = slot;
        else existing.labSlot = slot;
        return;
      }
      byKey.set(key, {
        key,
        // The display strings are rebuilt from the clock rather than copied from
        // the schema, because the two lists disagree on padding: theory says
        // "8:55 AM" where lab says "08:50 AM". Copying whichever won would put a
        // zero-padded start in front of an unpadded end inside one label.
        start: formatClock(startMinutes),
        end: formatClock(endMinutes),
        label: `${formatClock(startMinutes)} – ${formatClock(endMinutes)}`,
        startMinutes,
        endMinutes,
        ...(kind === "theory" ? { theorySlot: slot } : { labSlot: slot }),
      });
    });
  };

  add(schema.theory, "theory");
  add(schema.lab, "lab");

  const sorted = [...byKey.values()].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  );

  const merged: PeriodOption[] = [];
  for (const period of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev || period.startMinutes >= prev.endMinutes) {
      merged.push({ ...period });
      continue;
    }
    // Overlapping: widen the window and take every slot either half uses.
    if (period.theorySlot && !prev.theorySlot) prev.theorySlot = period.theorySlot;
    if (period.labSlot && !prev.labSlot) prev.labSlot = period.labSlot;
    if (period.endMinutes > prev.endMinutes) {
      prev.end = formatClock(period.endMinutes);
      prev.endMinutes = period.endMinutes;
    }
    prev.key = periodKey(prev.start, prev.end);
    prev.label = `${prev.start} – ${prev.end}`;
  }

  return merged;
}

/* ── rooms ─────────────────────────────────────────────────────────────── */

/** Venues that are not a room on campus. */
const NOT_A_ROOM = new Set(["NIL", "N/A", "UNK-UNK", "-", ""]);

/** True when a VENUE cell names an actual room. */
export function isRealVenue(venue?: string): boolean {
  const value = String(venue ?? "").trim().toUpperCase();
  if (!value || NOT_A_ROOM.has(value)) return false;
  return !value.includes("ONLINE");
}

/**
 * The block a room belongs to.
 *
 * `trim()` is load-bearing. Six venues in the FFCS report carry a trailing
 * space, and without it `"AB3 "` and `"AB3"` become two blocks — which split
 * the counts and gave the filter two entries for one building.
 */
export function blockOf(code: string): string {
  const trimmed = String(code ?? "").trim();
  const dash = trimmed.indexOf("-");
  if (dash <= 0) return "Other";
  return trimmed.slice(0, dash).trim() || "Other";
}

/** A room is a lab if most of what happens in it is a lab. */
function kindOf(course: FreeRoomCourse): RoomKind {
  const type = String(course.TYPE ?? "").toUpperCase();
  if (type.includes("LA") || type === "LO") return "lab";
  if (String(course.SLOT ?? "").toUpperCase().includes("L")) return "lab";
  return "theory";
}

const compareCodes = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/* ── the index ─────────────────────────────────────────────────────────── */

/**
 * Index every room and its occupancy for one day.
 *
 * `periodSlots` maps a period key to the set of VTOP slot ids active in it,
 * so a course only has to be asked "are you in any of these" once.
 */
export function buildDayIndex(
  courses: readonly FreeRoomCourse[],
  periods: readonly PeriodOption[],
  periodSlots: ReadonlyMap<string, Set<string>>
): DayIndex {
  const rooms = new Map<string, RoomInfo>();
  const occupancy = new Map<string, Set<string>>();
  const byPeriod = new Map<string, Set<string>>();
  const blocks = new Map<string, string[]>();
  const coursesByRoom = new Map<string, FreeRoomCourse[]>();

  for (const period of periods) {
    const slots = periodSlots.get(period.key);
    if (slots) byPeriod.set(period.key, new Set());
  }

  const addTo = (map: Map<string, Set<string>>, key: string, value: string) => {
    const existing = map.get(key);
    if (existing) existing.add(value);
    else map.set(key, new Set([value]));
  };

  for (const course of courses) {
    if (!isRealVenue(course.VENUE)) continue;
    const code = course.VENUE!.trim().toUpperCase();
    const block = blockOf(code);

    // A room can host both lectures and labs; the majority wins, and the first
    // sighting breaks a tie so the answer is at least stable.
    const info = rooms.get(code);
    if (!info) {
      rooms.set(code, { code, block, kind: kindOf(course) });
    } else if (info.kind !== kindOf(course)) {
      const inRoom = coursesByRoom.get(code) ?? [];
      const labs = inRoom.filter((c) => kindOf(c) === "lab").length;
      info.kind = labs * 2 > inRoom.length + 1 ? "lab" : info.kind;
    }

    const inRoom = coursesByRoom.get(code);
    if (inRoom) inRoom.push(course);
    else coursesByRoom.set(code, [course]);

    const courseSlots = String(course.SLOT ?? "")
      .split("+")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    for (const period of periods) {
      const active = periodSlots.get(period.key);
      if (!active || !active.size) continue;
      if (!courseSlots.some((s) => active.has(s))) continue;
      addTo(occupancy, code, period.key);
      byPeriod.get(period.key)?.add(code);
    }
  }

  rooms.forEach((info) => {
    const existing = blocks.get(info.block);
    if (existing) existing.push(info.code);
    else blocks.set(info.block, [info.code]);
  });
  blocks.forEach((codes) => codes.sort(compareCodes));

  return {
    rooms,
    occupancy,
    byPeriod,
    blocks,
    courses: coursesByRoom,
    periods: [...periods],
  };
}

/**
 * Map every period key to the VTOP slot ids running in it on this day.
 *
 * A period can carry two slot ids — one theory, one lab — because
 * `resolvePeriods` merged the two lists. A course matches if it is in *either*,
 * which is what makes a lab course in a lecture period (and vice versa) count
 * as an occupancy rather than being invisible.
 *
 * A theory period also carries the law school's spelling of itself, so one set
 * serves both and the room timeline in the inspector picks the law courses up
 * along with the rest. See `slotSpellings` for why there are two.
 */
export function buildPeriodSlots(
  periods: readonly PeriodOption[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  periods.forEach((period) => {
    const slots = new Set<string>();
    // Only the theory slot has a law spelling, so only it is worth asking:
    // labs have no law equivalent, and a period merged from both lists keeps its
    // theory slot for exactly this reason.
    if (period.theorySlot) slotSpellings(period.theorySlot).forEach((s) => slots.add(s));
    if (period.labSlot) slots.add(period.labSlot.toUpperCase());
    map.set(period.key, slots);
  });
  return map;
}

/* ── questions ─────────────────────────────────────────────────────────── */

export interface FreeRooms {
  /** Room codes free in every one of `keys`. */
  rooms: string[];
  theory: string[];
  lab: string[];
  /** Room code → how many of `keys` it is free for. */
  runLength: Map<string, number>;
}

/**
 * Rooms free across a run of consecutive periods.
 *
 * The intersection is what makes "free for the next three periods" a real
 * answer rather than three separate ones: a room is only useful for a long
 * session if it is free for all of it. `runLength` records how far each room
 * actually holds out, so a partial match can still say "this one is good for
 * two".
 */
export function freeRoomsForRun(
  index: DayIndex,
  keys: readonly string[]
): FreeRooms {
  const runLength = new Map<string, number>();
  if (keys.length === 0) return { rooms: [], theory: [], lab: [], runLength };

  for (const room of index.rooms.keys()) {
    const busy = index.occupancy.get(room);
    let free = 0;
    for (const key of keys) {
      if (busy?.has(key)) break;
      free++;
    }
    // Recorded even when it is 0, so a caller can ask about any room without
    // having to know that a missing key means "busy in the very first period".
    runLength.set(room, free);
  }

  const rooms = [...runLength.entries()]
    .filter(([, n]) => n === keys.length)
    .map(([code]) => code)
    .sort(compareCodes);

  return { ...splitByKind(index, rooms), runLength };
}

/** Rooms free in one period. */
export function freeRoomsForPeriod(index: DayIndex, key: string): FreeRooms {
  const busy = index.byPeriod.get(key) ?? new Set<string>();
  const rooms = [...index.rooms.keys()].filter((code) => !busy.has(code)).sort(compareCodes);
  return { ...splitByKind(index, rooms), runLength: new Map(rooms.map((r) => [r, 1])) };
}

function splitByKind(index: DayIndex, rooms: readonly string[]) {
  const theory: string[] = [];
  const lab: string[] = [];
  for (const code of rooms) {
    if (index.rooms.get(code)?.kind === "lab") lab.push(code);
    else theory.push(code);
  }
  return { rooms: [...rooms], theory, lab };
}

export interface BlockAvailability {
  block: string;
  freeTheory: string[];
  freeLab: string[];
  total: number;
  free: number;
}

/**
 * Availability per block, sorted by how empty the block is.
 *
 * Sorted by `free` descending because that is the question being asked: not
 * "which blocks exist" but "where should I walk to". Every block's *total* is
 * carried too, so the occupancy bar can say 12 of 65 rather than just 12.
 */
export function blockAvailability(index: DayIndex, free: FreeRooms): BlockAvailability[] {
  const freeByBlock = new Map<string, { theory: string[]; lab: string[] }>();
  for (const code of free.rooms) {
    const block = index.rooms.get(code)?.block ?? "Other";
    const entry = freeByBlock.get(block) ?? { theory: [], lab: [] };
    (index.rooms.get(code)?.kind === "lab" ? entry.lab : entry.theory).push(code);
    freeByBlock.set(block, entry);
  }

  return [...index.blocks.entries()]
    .map(([block, codes]) => {
      const entry = freeByBlock.get(block) ?? { theory: [], lab: [] };
      return {
        block,
        freeTheory: entry.theory,
        freeLab: entry.lab,
        total: codes.length,
        free: entry.theory.length + entry.lab.length,
      };
    })
    .filter((b) => b.free > 0)
    .sort((a, b) => b.free - a.free || a.block.localeCompare(b.block));
}

/** The period with the most free rooms. Null when the day has no periods. */
export function bestPeriod(
  index: DayIndex
): { period: PeriodOption; free: number } | null {
  let best: { period: PeriodOption; free: number } | null = null;
  for (const period of index.periods) {
    const free = freeRoomsForPeriod(index, period.key).rooms.length;
    if (!best || free > best.free) best = { period, free };
  }
  return best && best.free > 0 ? best : null;
}

/* ── clock ─────────────────────────────────────────────────────────────── */

export interface NowInfo {
  /** Today, clamped to a teaching day — Saturday lands on Monday. */
  day: DayId;
  /** The period running right now, or null outside teaching hours. */
  period: PeriodOption | null;
  /** True only when it is both a teaching day and inside a period. */
  isLive: boolean;
}

/**
 * Where "now" sits in the timetable.
 *
 * `isLive` is deliberately strict. A free-room finder that claims to be live at
 * 9pm on a Saturday is worse than one that admits it is not, so anything
 * outside Mon–Fri, or outside a period, reports `isLive: false` and the page
 * falls back to offering a jump rather than pretending.
 */
export function resolveNow(
  periods: readonly PeriodOption[],
  now: Date = new Date()
): NowInfo {
  const dayIndex = now.getDay(); // 0 = Sun … 6 = Sat
  const isWeekday = dayIndex >= 1 && dayIndex <= 5;
  // Saturday has no timetable, so "now" lands on Monday rather than pretending.
  const day: DayId = isWeekday ? DAYS_OF_WEEK[dayIndex - 1] : "mon";

  const minutes = now.getHours() * 60 + now.getMinutes();
  // Five minutes of grace at the start, so a period is still "now" while you
  // are walking into it. The end is taken from the period rather than assumed,
  // because lunch and the evening block are not the same length.
  const period =
    periods.find(
      (p) => minutes >= p.startMinutes - 5 && minutes <= p.endMinutes
    ) ?? null;

  return { day, period, isLive: isWeekday && !!period };
}

/** `3` → `"3 of 12"`. */
export function positionLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}
