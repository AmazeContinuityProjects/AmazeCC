/**
 * The one time parser and the one overlap implementation.
 *
 * Before this module there were **three** `toMinutes` copies that agreed only by
 * coincidence:
 *
 *   - `CommonFreeSlotsGrid.tsx:17` — `isPM = h === 12 || (h >= 1 && h <= 7)`
 *   - `attendance/TimetableGrid.tsx:64` — a byte-identical copy of the above
 *   - `lib/attendanceTimetable.ts:8` — `if (h < 8) h += 12`
 *
 * The two rules differ at exactly one input, `h = 0`, and `config.json` never
 * contains an hour below 1, so all three produced identical results on the real
 * vocabulary. That is not a reason to keep three of them: it is a reason the
 * next vocabulary edit could silently diverge them.
 *
 * ## Why the "1-7 are PM" rule is not a hack
 *
 * `config.json` writes slot times in a 12-hour-ish notation with **no AM/PM
 * marker** — `"1:20-1:50"`, not `"1:20 PM"`. So the hour alone is ambiguous and
 * something has to break the tie. The campus teaching day runs 08:00 to 19:25,
 * and 08:00 is the earliest slot in the file while 19:25 is the latest, so
 * "hours 1-7 are PM, 8-11 are AM, 12 is PM" is not a guess — it is the only rule
 * consistent with the file's own range. `toMinutesInvariant` re-checks that
 * against the vocabulary rather than trusting it.
 *
 * See docs/social-tt/09-schedule-math.md §4.
 */

import config from "../../../config.json";
import type { BusyEntry, BusyMap } from "./types";

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAYS)[number];

export type SlotEntry = { time: string };
export type SlotMap = Record<string, Record<string, SlotEntry>>;

/**
 * The shared vocabulary, imported from `config.json`.
 *
 * The server keeps its own copy in `AmazeCC-API/config.json` and validates every
 * key against it at ingest, so the two cannot drift without a version mismatch
 * showing up in `slotmapVersion`.
 */
export const slotMap = config.slotMap as unknown as SlotMap;

export const SEMESTER_IDS: string[] = config.semesterIDs as unknown as string[];

export const TOTAL_SLOTS = DAYS.reduce((n, day) => n + Object.keys(slotMap[day] ?? {}).length, 0);

/** Slots on one day. The per-day sum must equal `TOTAL_SLOTS`. */
export function totalSlotsAcrossDay(day: string, map: SlotMap = slotMap): number {
  return Object.keys(map[day] ?? {}).length;
}

/** `"DAY:SLOTID"`, e.g. `"MON:A1"`. A bare slot id is ambiguous — see §2. */
export type SlotKey = string;

export function slotKey(day: string, slotId: string): SlotKey {
  return `${day}:${slotId}`;
}

export function parseSlotKey(key: string): { day: string; slotId: string } | null {
  const i = key.indexOf(":");
  if (i <= 0 || i === key.length - 1) return null;
  return { day: key.slice(0, i), slotId: key.slice(i + 1) };
}

/** True when the key resolves against the vocabulary. */
export function isValidKey(key: string): boolean {
  const parsed = parseSlotKey(key);
  if (!parsed) return false;
  return Boolean(slotMap[parsed.day]?.[parsed.slotId]);
}

export function slotFor(key: string): SlotEntry | null {
  const parsed = parseSlotKey(key);
  if (!parsed) return null;
  return slotMap[parsed.day]?.[parsed.slotId] ?? null;
}

/* ------------------------------------------------------------------ *
 * The one time parser
 * ------------------------------------------------------------------ */

/**
 * `"8:00"` -> 480. See the module comment for why 1-7 means PM.
 *
 * Returns 0 for unusable input rather than throwing: a malformed time in one
 * cached record must not take down a grid.
 */
export function toMinutes(t: string | number | null | undefined): number {
  if (t === null || t === undefined || t === "") return 0;
  if (typeof t === "number") return Number.isFinite(t) ? t : 0;
  const [hs = "0", ms = "0"] = String(t).trim().split(":");
  let h = parseInt(hs || "0", 10);
  const m = parseInt(ms || "0", 10);
  if (!Number.isFinite(h)) h = 0;
  if (h === 12 || (h >= 1 && h <= 7)) {
    if (h !== 12) h += 12;
  }
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** Minutes -> `"1:20 PM"`, for display. The inverse of `toMinutes`. */
export function minutesToTimeStr(mins: number): string {
  if (!Number.isFinite(mins)) return "";
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Display formatter for the vocabulary's native representation.
 *
 * `config.json` stores times as strings (`"8:00-8:50"`), while computed values
 * are minutes-since-midnight, and the grid call sites mix both. Accepting a
 * union here is what lets one function replace the two divergent private
 * `fmt` copies rather than forcing every call site to convert first.
 */
export function fmt(t: string | number | null | undefined): string {
  return minutesToTimeStr(typeof t === "number" ? t : toMinutes(t));
}

export function slotRange(time: string): { start: number; end: number } {
  const [a, b] = String(time ?? "").split("-");
  return { start: toMinutes(a), end: toMinutes(b) };
}

export function slotSpanMinutes(time: string): number {
  const { start, end } = slotRange(time);
  return Math.max(0, end - start);
}

/** Hours a slot occupies, for the "common free hours" figure. */
export function slotSpanHours(time: string): number {
  return slotSpanMinutes(time) / 60;
}

/**
 * Verify the "1-7 are PM" assumption against the vocabulary itself.
 *
 * Returns the distinct hours found, and whether every slot's end is after its
 * start. Called by the test suite, and safe to call in a diagnostic.
 */
export function toMinutesInvariant(): {
  hours: number[];
  allSpansPositive: boolean;
  earliest: number;
  latest: number;
} {
  const hours = new Set<number>();
  let allSpansPositive = true;
  let earliest = Infinity;
  let latest = -Infinity;

  for (const day of DAYS) {
    for (const entry of Object.values(slotMap[day] ?? {})) {
      const { start, end } = slotRange(entry.time);
      hours.add(Math.floor(start / 60));
      hours.add(Math.floor(end / 60));
      if (end <= start) allSpansPositive = false;
      earliest = Math.min(earliest, start);
      latest = Math.max(latest, end);
    }
  }

  return { hours: [...hours].sort((a, b) => a - b), allSpansPositive, earliest, latest };
}

/* ------------------------------------------------------------------ *
 * Which slot is it right now?
 * ------------------------------------------------------------------ */

export const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function dayKeyForDate(date: Date): Day {
  // JS getDay() is 0=Sunday; DAYS is MON-first.
  return (["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as Day[])[date.getDay()];
}

/**
 * The slot covering `date`, or null outside teaching hours.
 *
 * A dictionary lookup, so "Free Right Now" needs no precomputation. The weekend
 * and the 08:00-19:25 envelope are handled here rather than at each call site,
 * which is what the old inline version got subtly wrong.
 */
export function slotCoveringNow(date: Date = new Date()): SlotKey | null {
  const day = dayKeyForDate(date);
  if (day === "SUN" || day === "SAT") return null;

  const now = date.getHours() * 60 + date.getMinutes();
  for (const [slotId, entry] of Object.entries(slotMap[day] ?? {})) {
    const { start, end } = slotRange(entry.time);
    if (now >= start && now < end) return slotKey(day, slotId);
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Busy maps
 * ------------------------------------------------------------------ */

export type SlotVenueCourse = {
  code?: string;
  title?: string;
  /** VTOP's raw `"L31+L32+L37+L38 - AB1-607B"` cell. */
  slotVenue?: string;
  slotId?: string;
  day?: string;
};

/**
 * Build a busy map from VTOP's `Slot/ Venue` cell.
 *
 * The separator is `" - "`, **not** `"/"` — verified live. A bare `split("-")`
 * would break on slot ids like `S8B` and on venue names like `AB1-607B`.
 *
 * A slot id with no day fans out across every day it exists on, because that is
 * all the information VTOP gives. This is the ambiguity §2 is about; the
 * fan-out is the honest reading of a day-less input, and it is idempotent for
 * callers that already emit one entry per `(day, slotId)`.
 */
export function buildBusyMap(
  courses: SlotVenueCourse[],
  map: SlotMap = slotMap
): BusyMap {
  const out: BusyMap = {};

  for (const course of courses ?? []) {
    const raw = String(course.slotVenue ?? "").trim();
    if (!raw) continue;

    const [slotPart, venue] = raw.split(/\s+-\s+/);
    const ids = String(slotPart ?? "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) continue;

    // An explicit day on the record wins over fan-out, so a caller that already
    // resolved the day is not second-guessed.
    const day = course.day ? String(course.day).toUpperCase().slice(0, 3) : null;
    const days = day && map[day] ? [day] : [...DAYS];

    for (const id of ids) {
      for (const d of days) {
        if (!map[d]?.[id]) continue;
        out[slotKey(d, id)] = {
          c: course.code ?? "",
          t: course.title ?? "",
          v: (venue ?? "").trim(),
        } satisfies BusyEntry;
      }
    }
  }

  return out;
}

/** Total occupied hours in a busy map. */
export function busyHours(busyMap: BusyMap, map: SlotMap = slotMap): number {
  let mins = 0;
  for (const key of Object.keys(busyMap ?? {})) {
    const slot = lookupSlot(key, map);
    if (slot) mins += slotSpanMinutes(slot.time);
  }
  return Math.round((mins / 60) * 10) / 10;
}

function lookupSlot(key: string, map: SlotMap): SlotEntry | null {
  const parsed = parseSlotKey(key);
  if (!parsed) return null;
  return map[parsed.day]?.[parsed.slotId] ?? null;
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

export interface OverlapMetrics {
  /**
   * Slots where neither person is busy, out of the full 164-slot vocabulary.
   *
   * Large by construction — most of a week is free to everyone. The clash
   * figures below are the ones that discriminate between people.
   */
  commonFreeSlots: number;
  /** The same, in hours. */
  commonFreeHours: number;
  /**
   * Of the viewer's **class hours**, the percentage during which the peer is
   * also free — i.e. the share of the week that is not a clash. Higher is more
   * compatible. 100 means "we are never in class at the same time".
   *
   * This is measured against the viewer's own timetable, never against the 164
   * slots in a week. Scoring against the week would report ~80% for everyone,
   * since a student occupies perhaps 30 of those slots.
   */
  matchPct: number;
  /** Hours where both are busy. */
  sharedClassHours: number;
  /** Hours where the viewer is in class (the denominator for `matchPct`). */
  myClassHours: number;
  /** Chronologically first common free slot, for a "next free together" hint. */
  firstCommonFreeSlot: string | null;
  /** The peer is free in the slot covering the current time. */
  freeNow: boolean;
  /** The slot covering now, for the caller to label the answer. */
  currentSlot: string | null;
}

const EMPTY_METRICS: OverlapMetrics = {
  commonFreeSlots: 0,
  commonFreeHours: 0,
  matchPct: 0,
  sharedClassHours: 0,
  myClassHours: 0,
  firstCommonFreeSlot: null,
  freeNow: true,
  currentSlot: null,
};

/** Each day's slots in start-time order, so "first" means chronologically first. */
const orderedDayCache = new WeakMap<SlotMap, { day: Day; slotId: string; start: number }[][]>();

function orderedDays(map: SlotMap): { day: Day; slotId: string; start: number }[][] {
  const cached = orderedDayCache.get(map);
  if (cached) return cached;
  const built = DAYS.map((day) =>
    Object.entries(map[day] ?? {})
      .map(([slotId, entry]) => ({ day, slotId, start: slotRange(entry.time).start }))
      .sort((a, b) => a.start - b.start)
  );
  orderedDayCache.set(map, built);
  return built;
}

/**
 * Compare two busy maps.
 *
 * Iterates the **whole vocabulary**, not just the union of occupied keys. That is
 * the whole point: "common free" means a slot neither person is in, so walking
 * only the occupied slots would make the figure permanently zero. (The draft in
 * docs/social-tt/09-schedule-math.md §7 has that bug, and a `matchPct` that
 * divides a free-slot count by a busy-slot count and so can exceed 100%.)
 *
 * An unknown key is **skipped, not guessed**. If a `config.json` edit ever leaves
 * a stored key unresolvable, the honest outcome is that the slot is not counted;
 * the alternative is inventing a time.
 */
export function computeOverlap(
  mine: BusyMap,
  theirs: BusyMap,
  map: SlotMap = slotMap,
  now: Date = new Date()
): OverlapMetrics {
  const currentSlot = slotCoveringNow(now);
  const myKeys = new Set(Object.keys(mine ?? {}));

  let shared = 0;
  let sharedMins = 0;
  let free = 0;
  let freeMins = 0;
  let myMins = 0;
  let clashFreeMins = 0;
  let first: string | null = null;

  for (const daySlots of orderedDays(map)) {
    for (const { day, slotId, start } of daySlots) {
      const key = slotKey(day, slotId);
      const span = slotSpanMinutes(map[day]![slotId].time);
      const iAmBusy = myKeys.has(key);
      const theyAreBusy = Boolean(theirs?.[key]);

      if (iAmBusy) {
        myMins += span;
        if (!theyAreBusy) clashFreeMins += span;
      }

      if (iAmBusy && theyAreBusy) {
        shared++;
        sharedMins += span;
        continue;
      }
      if (!iAmBusy && !theyAreBusy) {
        free++;
        freeMins += span;
        if (!first) first = key;
      }
    }
  }

  return {
    commonFreeSlots: free,
    commonFreeHours: Math.round((freeMins / 60) * 10) / 10,
    matchPct: myMins > 0 ? Math.round((clashFreeMins / myMins) * 100) : 0,
    sharedClassHours: Math.round((sharedMins / 60) * 10) / 10,
    myClassHours: Math.round((myMins / 60) * 10) / 10,
    firstCommonFreeSlot: first,
    freeNow: currentSlot ? !theirs?.[currentSlot] : true,
    currentSlot,
  };
}

/* ------------------------------------------------------------------ *
 * Legacy interop
 * ------------------------------------------------------------------ */

const FULL_DAY_TO_KEY: Record<string, Day> = {
  sunday: "SUN",
  monday: "MON",
  tuesday: "TUE",
  wednesday: "WED",
  thursday: "THU",
  friday: "FRI",
  saturday: "SAT",
  sun: "SUN",
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
};

export function normaliseDay(day: string | undefined | null): Day | null {
  if (!day) return null;
  return FULL_DAY_TO_KEY[String(day).trim().toLowerCase()] ?? null;
}

export type LegacyClassSlot = {
  day: string;
  timeSlot: string;
  courseCode: string;
  courseTitle: string;
  venue: string;
  slotId: string;
};

/**
 * Convert a legacy `Friend.classSlots[]` into a busy map **respecting `day`**.
 *
 * This is the fix for the day-blind grid in §5.1 of the math doc. The old code
 * ignored `slot.day` and re-fanned `slotId` across all seven days, so a friend
 * with `{ day: "MON", slotId: "A1" }` was marked busy on Monday *and* Wednesday
 * — and because every theory block exists on two days, that fired for all of
 * them.
 *
 * When `day` is missing or unrecognised the slot still fans out, because then
 * there is genuinely nothing to go on.
 */
export function busyMapFromClassSlots(
  slots: LegacyClassSlot[] | undefined,
  map: SlotMap = slotMap
): BusyMap {
  const out: BusyMap = {};
  for (const slot of slots ?? []) {
    const id = String(slot?.slotId ?? "").trim();
    if (!id) continue;
    const day = normaliseDay(slot?.day);
    const days = day && map[day] ? [day] : [...DAYS];
    for (const d of days) {
      if (!map[d]?.[id]) continue;
      out[slotKey(d, id)] = {
        c: slot.courseCode ?? "",
        t: slot.courseTitle ?? "",
        v: slot.venue ?? "",
      };
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Grid columns
 * ------------------------------------------------------------------ */

/**
 * Lunch is a visual spacer, not a slot. It has no representation in a busy map.
 *
 * `LUNCH_START_MIN` is `toMinutes("1:20")` = 800, and the column split lands at
 * the first Monday pair whose earlier of {theory, lab} starts at or after 800.
 */
export const LUNCH_START_MIN = toMinutes("1:20");

/** Monday's slots, theory and lab split, sorted by start time. */
export function mondaySkeleton(map: SlotMap = slotMap): {
  theory: { slotId: string; start: number }[];
  lab: { slotId: string; start: number }[];
} {
  const theory: { slotId: string; start: number }[] = [];
  const lab: { slotId: string; start: number }[] = [];
  for (const [slotId, entry] of Object.entries(map.MON ?? {})) {
    const item = { slotId, start: slotRange(entry.time).start };
    // `L` is the only lab discriminator anywhere in the codebase. It is a
    // *display* concern: the theory/lab pairing never touches the data.
    if (slotId.startsWith("L")) lab.push(item);
    else theory.push(item);
  }
  theory.sort((a, b) => a.start - b.start);
  lab.sort((a, b) => a.start - b.start);
  return { theory, lab };
}

/** Index of the first column at or after lunch, for the visual split. */
export function lunchColumnIndex(map: SlotMap = slotMap): number {
  const { theory, lab } = mondaySkeleton(map);
  const count = Math.max(theory.length, lab.length);
  for (let i = 0; i < count; i++) {
    const starts = [theory[i]?.start, lab[i]?.start].filter(
      (v): v is number => typeof v === "number"
    );
    if (!starts.length) continue;
    if (Math.min(...starts) >= LUNCH_START_MIN) return i;
  }
  return count;
}
