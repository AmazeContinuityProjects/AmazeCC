/**
 * FFCS's view of the unified timetable vocabulary.
 *
 * Everything here is *data* sourced from `lib/generated/timetable` (which is
 * generated from `data/timetable/campuses/chennai.json`, the single source of
 * truth). The algorithms that consume it — the generator, the walk, the
 * grouping pass, the filters — stay exactly as they were; only the place they
 * get their slots and periods from changes.
 *
 * Two generated projections are used:
 *
 * - `CAMPUS_SCHEMA` is the legacy `theory[] / lab[]` projection. FFCS's period
 *   walkers take a `CampusSchema`, so this is the shape they need. The projection
 *   carries the canonical lunch markers at the *end* of the theory list; FFCS's
 *   grids and `ensureLunchPeriod` expect a marker between the morning and the
 *   afternoon block, so {@link FFCS_SCHEMA} puts it back in that position. No
 *   slot, time or day is added or removed — only the spacer moves.
 * - `TIMETABLE` / `SLOTS_BY_PERIOD` / `EXTRAMURAL_SLOT_KEYS` are the canonical
 *   records. Hardcoded slot-token sets (lab windows, extramural hours, law
 *   aliases) are derived from them instead of being spelled out in the FFCS
 *   modules.
 */

import { CAMPUS_SCHEMA, EXTRAMURAL_SLOT_KEYS, SLOTS_BY_PERIOD, TIMETABLE } from "@/lib/generated/timetable";
import { periodsForSlot, timeToMinutes, type CampusSchema, type SchemaPeriod, type SlotPeriod } from "@/lib/slots";

/** A lunch spacer, in the shape the legacy schema uses. */
const LUNCH_SPACER: SchemaPeriod = { lunch: true };

/**
 * The legacy lab list padded morning hours (`"08:00 AM"`) but not afternoon
 * ones (`"1:20 PM"`); theory left every hour unpadded. The generated
 * projection uses the short form for both, so restore that one quirk to keep
 * printed lab windows byte-for-byte what they were.
 */
function padLabClock(time: string | undefined): string | undefined {
  if (!time) return time;
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;
  const hours24 = Math.floor(minutes / 60) % 24;
  const mm = minutes % 60;
  if (hours24 >= 12) return time;
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} AM`;
}

function normalisePeriod(period: SchemaPeriod, padHours: boolean): SchemaPeriod {
  if (period?.lunch) return { ...period };
  return {
    ...period,
    start: padHours ? padLabClock(period.start) : period.start,
    end: padHours ? padLabClock(period.end) : period.end,
  };
}

/**
 * Put the generated schema's lunch spacers where the FFCS walkers and grids
 * expect them. The generated projection appends both lunch periods to the end
 * of `theory` and leaves `lab` without one; the legacy shape has a single
 * marker in each list, immediately before the first afternoon period.
 */
function withLunchInPlace(periods: readonly SchemaPeriod[], padHours: boolean): SchemaPeriod[] {
  const real = periods.filter((period) => !period?.lunch).map((period) => normalisePeriod(period, padHours));
  const afternoon = real.findIndex((period) => {
    const minutes = period?.start ? timeToMinutes(period.start) : null;
    return minutes !== null && minutes >= 14 * 60;
  });
  if (afternoon <= 0) return [...real];
  return [...real.slice(0, afternoon), LUNCH_SPACER, ...real.slice(afternoon)];
}

/** The generated campus schema, in the shape FFCS has always consumed. */
export const FFCS_SCHEMA: CampusSchema = {
  theory: withLunchInPlace(CAMPUS_SCHEMA.theory as SchemaPeriod[], false),
  lab: withLunchInPlace(CAMPUS_SCHEMA.lab as SchemaPeriod[], true),
};

/** Every canonical slot record, in one flat list. */
const SLOT_RECORDS = Object.values(TIMETABLE.slots);

const normalise = (token: string): string =>
  String(token ?? "")
    .trim()
    .toUpperCase();

/**
 * Every spelling that names the same period as `token`, in either direction.
 *
 * This is the canonical version of the old `slotSpellings`: a law token (`A`)
 * and its numbered core spelling (`A1`), or `TEE` and `S11`, are the alias
 * pairs recorded on the core slot in the canonical data. Programme families
 * (`M1`, `U1`, …) are deliberately *not* folded in — the unified vocabulary
 * keeps those as distinct slots, and a block on `A1` must not silently block
 * an unrelated programme's offering.
 */
export function ffcsSlotSpellings(token: string): string[] {
  const id = normalise(token);
  if (!id || id === "NIL") return [];
  const spellings = new Set<string>([id]);
  for (const slot of SLOT_RECORDS) {
    if (slot.token === id) {
      for (const alias of slot.aliases) spellings.add(normalise(alias.token));
    } else if (slot.aliases.some((alias) => normalise(alias.token) === id)) {
      spellings.add(slot.token);
    }
  }
  return [...spellings];
}

/** Set form of {@link ffcsSlotSpellings}, for the half-day mask checks. */
export function ffcsExpandSlotSpellings(slots: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const slot of slots) {
    for (const spelling of ffcsSlotSpellings(slot)) out.add(spelling);
  }
  return out;
}

/** Does a course holding `slots` run in `slot`? Canonical, both spellings. */
export function ffcsHasSlot(slots: Iterable<string>, slot: string): boolean {
  const wanted = new Set(ffcsSlotSpellings(slot));
  if (!wanted.size) return false;
  for (const candidate of slots) {
    if (wanted.has(normalise(candidate))) return true;
  }
  return false;
}

/**
 * The single canonical id for a slot token: the numbered core spelling when a
 * law alias exists (`A` → `A1`, `TEE` → `S11`), otherwise the token itself.
 */
export function ffcsCanonicalSlot(token: string): string {
  const id = normalise(token);
  if (!id) return "";
  for (const slot of SLOT_RECORDS) {
    if (slot.aliases.some((alias) => normalise(alias.token) === id)) return slot.token;
  }
  return id;
}

/** The physical periods a slot token names, resolved from the generated schema. */
export function periodsForFfcsSlot(slot: string): SlotPeriod[] {
  return periodsForSlot(FFCS_SCHEMA, slot);
}

/** The extramural tokens, derived from the canonical slot keys. */
export const FFCS_EXTRAMURAL_SLOTS: string[] = EXTRAMURAL_SLOT_KEYS.map((key) => key.split(":")[1]);

/** The tokens of one canonical lab period id, e.g. `L01` → `L1`, `L7`, … */
function labTokensOf(periodId: string): string[] {
  return (SLOTS_BY_PERIOD[periodId] ?? []).map((key) => key.split(":")[1]).filter(Boolean);
}

/** Lab windows used by the embedded theory/lab pairing score, by canonical period. */
export const FFCS_CORE_MORNING_LAB_SLOTS = new Set(["L01", "L02", "L03", "L04"].flatMap(labTokensOf));
export const FFCS_CORE_EVENING_LAB_SLOTS = new Set(["L08", "L09", "L10", "L11"].flatMap(labTokensOf));
export const FFCS_LATE_MORNING_LAB_SLOTS = new Set(["L05", "L06"].flatMap(labTokensOf));
export const FFCS_LATE_EVENING_LAB_SLOTS = new Set(["L12", "L13"].flatMap(labTokensOf));
