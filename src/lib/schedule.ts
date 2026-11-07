/**
 * The app's slot vocabulary and its one time parser: days, slots and times
 * from `config.json`, shared by the timetable, calendar, attendance and planner.
 *
 * (It began life as `lib/social/schedule.ts` for the friend-timetable feature;
 * that feature is gone, and the busy-map and overlap maths went with it.)
 *
 * Before this module there were **three** `toMinutes` copies that agreed only by
 * coincidence:
 *
 *   - the old `CommonFreeSlotsGrid.tsx` — `isPM = h === 12 || (h >= 1 && h <= 7)`
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
 * Background: docs/social-tt/09-schedule-math.md §4 (historical).
 */

import config from "../../config.json";

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

export const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

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
    const starts = [theory[i]?.start, lab[i]?.start].filter((v): v is number => typeof v === "number");
    if (!starts.length) continue;
    if (Math.min(...starts) >= LUNCH_START_MIN) return i;
  }
  return count;
}
