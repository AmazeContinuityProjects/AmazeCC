/**
 * VTOP slot ids, and the two spellings the same period answers to.
 *
 * A slot id names one period of one day. The engineering grid suffixes a `1` for
 * the morning and a `2` for the evening — `A1` is Monday 8:00, `A2` is Monday
 * 2:00 — and two of the 12:35 periods are spelled with an `S` id instead
 * (`S11` Monday, `S15` Friday).
 *
 * The law school books those same morning periods with the number left off
 * entirely: `A+TA+TAA` where everybody else writes `A1+TA1+TAA1`, `C+TC+TCC`
 * for `C1+TC1+TCC1`, and `E+TE+TEE` for `E1+TE1+TEE1`. The law school has no
 * evening timetable at all, so a law slot only ever names a morning period.
 *
 * Every feature that asks "which periods does this course run in?" has to answer
 * it for both spellings or it silently answers "none" for every `TLAW*` course.
 * That is not a rare corner: it is 99 rows of the FFCS report, it owns the whole
 * of AB5, and before this the free-classroom page reported every law room free
 * all morning while a class was sitting in it, and the generator scored every
 * law student's timetable as ten free half-days.
 */

/** One period from `src/data/campus/*.json`. */
export interface SchemaPeriod {
  start?: string;
  end?: string;
  lunch?: boolean;
  days?: Record<string, string>;
}

export interface CampusSchema {
  theory?: SchemaPeriod[];
  lab?: SchemaPeriod[];
}

export const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri"] as const;
export type DayId = (typeof DAYS_OF_WEEK)[number];

/**
 * `"8:00 AM"` → 480. Returns null for anything unreadable so a bad schema
 * entry drops out of a lookup instead of sorting to the front of it.
 *
 * Null rather than `0` is load-bearing: the old copy in `freeClassrooms` had a
 * `FFCS/utils.ts` twin that returned `0` for a missing time, which is midnight,
 * and a period that silently became midnight was a period that silently
 * disappeared from every day walk. The one implementation here rejects instead.
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

/**
 * The two law slots the Chennai grid spells with an `S` id rather than a letter.
 *
 * The law grid runs a third period after `TAA`/`TBB`/`TCC`/`TDD`, and the last
 * two of them do not fall on an 11:40 period — they are the two 12:35 periods
 * the schema gives an `S` id. Stated rather than derived because there is
 * nothing in the schema to derive it *from*: `S11` and `S15` are just two
 * strings, and the link to `TEE`/`TFF` is knowledge about the law timetable.
 */
const LAW_SLOT_BY_S_SLOT: Record<string, string> = {
  S11: "TEE",
  S15: "TFF",
};

/**
 * Ids that look like a law slot but are not, and so must not be treated as one.
 * `NIL` is VTOP's "this course has no slot" placeholder, and a bare `S`/`L` is
 * not a law slot in any reading.
 */
const NOT_A_LAW_SLOT = new Set(["NIL", "S", "L"]);

/** Upper-cased and trimmed, which is how every slot id is compared. */
function normalise(slot: string): string {
  return String(slot ?? "")
    .trim()
    .toUpperCase();
}

/**
 * The law school's spelling of a schema slot id, or null when there is none.
 *
 * `A1` → `A`, `TC1` → `TC`, `S11` → `TEE`. This is the direction a caller needs
 * when it already has a period and wants to know who might be in it.
 */
export function lawSlotFor(schemaSlot: string): string | null {
  const id = normalise(schemaSlot);
  if (!id) return null;
  if (LAW_SLOT_BY_S_SLOT[id]) return LAW_SLOT_BY_S_SLOT[id];
  // A lone trailing 1, and only a lone one. `A2` is the evening and must not be
  // aliased, or a law course would mark itself busy from 2pm on; `S11` carries
  // two digits and is handled by the table above; `L1` is a lab with no law
  // equivalent; and `S1` is a real 6:35pm theory slot that fits this shape but
  // is not one of the law family's.
  const stripped = id.match(/^([A-Z]+)1$/);
  if (!stripped || stripped[1] === "S" || stripped[1] === "L") return null;
  return stripped[1];
}

/**
 * The schema's spelling of a law slot id, or null when there is none.
 *
 * `A` → `A1`, `TAA` → `TAA1`, `TEE` → `S11`. This is the direction a caller
 * needs when it has a course and wants to find its periods.
 */
export function schemaSlotFor(lawSlot: string): string | null {
  const id = normalise(lawSlot);
  if (!id || !/^[A-Z]+$/.test(id) || NOT_A_LAW_SLOT.has(id)) return null;
  for (const [schemaSlot, law] of Object.entries(LAW_SLOT_BY_S_SLOT)) {
    if (law === id) return schemaSlot;
  }
  return `${id}1`;
}

/**
 * Every id that names the same period as `slot`, `slot` itself included.
 *
 * Both spellings, because which way round the question arrives depends on the
 * caller: the free-classroom page holds a period and asks who is in it, while
 * the generator holds a course and asks when it runs. A period that answers to
 * two names has to answer to both in either direction.
 */
export function slotSpellings(slot: string): string[] {
  const id = normalise(slot);
  if (!id) return [];
  const spellings = new Set([id]);
  const law = lawSlotFor(id);
  if (law) spellings.add(law);
  const schema = schemaSlotFor(id);
  if (schema) spellings.add(schema);
  return [...spellings];
}

/**
 * A set holding every spelling of every id given, so one `has` answers for both.
 *
 * `Set.has` is how the half-day metrics test a student's slots against the
 * schema's, and it is the one call that cannot afford to know about spellings
 * at the point of use — there are a dozen of them, in loops.
 */
export function expandSlotSpellings(slots: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const slot of slots) {
    for (const spelling of slotSpellings(slot)) out.add(spelling);
  }
  return out;
}

/**
 * Does a course holding `slots` run in `slot`?
 *
 * The other direction from a plain `includes`, for the same reason: the schema
 * hands out `A1` and the course says `A`, and neither side knows to translate.
 */
export function hasSlot(slots: Iterable<string>, slot: string): boolean {
  const wanted = new Set(slotSpellings(slot));
  if (!wanted.size) return false;
  for (const candidate of slots) {
    if (wanted.has(normalise(candidate))) return true;
  }
  return false;
}

/** The minimum a course has to carry to be worth asking about a period. */
export interface SlottedCourse {
  slots: readonly string[];
}

/**
 * The course running in a period, or null.
 *
 * This is the inverse of `periodsForSlot` and it exists because the question
 * arrives both ways. `periodsForSlot` serves a caller that has a course and
 * wants to know when it runs; this serves the grid, which is holding a period
 * and needs to know what goes in the cell.
 *
 * The first match wins, which is what every grid did already. Two courses on the
 * same slot is a data situation the report allows and no view has ever
 * disambiguated.
 */
export function courseInPeriod<T extends SlottedCourse>(
  courses: readonly T[],
  schemaSlot: string
): T | null {
  for (const course of courses) {
    if (hasSlot(course.slots, schemaSlot)) return course;
  }
  return null;
}

/**
 * The spelling a course uses for a period, for a view that has to *print* it.
 *
 * Returns the schema's own id when the course agrees with it, which is every
 * course that is not a law one — so this is a no-op on a normal timetable and a
 * cell reads `A` rather than `A1` for a law course booked `A`.
 *
 * Printing matters for more than looks. The planner blocks a slot by tapping its
 * cell, and the generator filters its options by the slot on the *course*, so a
 * view that printed the schema's id recorded something that could never match.
 */
export function ownSlotSpelling<T extends SlottedCourse>(
  courses: readonly T[],
  schemaSlot: string
): string {
  const course = courseInPeriod(courses, schemaSlot);
  if (!course) return schemaSlot;
  return course.slots.find((own) => hasSlot([own], schemaSlot)) ?? schemaSlot;
}

/* ── looking periods up in the schema ───────────────────────────────────── */

/** One period of one day, as the schema writes it and as the clock reads it. */
export interface SlotPeriod {
  day: DayId;
  /** The schema's own clock string, e.g. `"08:00 AM"`. The iCal export needs this. */
  start: string;
  end: string;
  /** Minutes since midnight. Null only when the schema string is unreadable. */
  startMin: number;
  endMin: number;
  type: "theory" | "lab";
  /** Index within its own list, which is how theory and lab stay paired. */
  index: number;
}

/**
 * Where the morning ends.
 *
 * Everything in a day before this is a morning half-day, everything from it on is
 * an evening one. Written down as one constant because it was a magic `2:00 PM`
 * in three separate copies of the day walk, and the copy that got it subtly wrong
 * would have changed which half-days a timetable was credited with.
 */
export const MORNING_BEFORE_MIN = 840;

/**
 * Every period a slot id names, under either spelling.
 *
 * This is the one lookup. It replaced five: two in `FFCSTimetableTab`, one in
 * `AutoGeneratorModal`, one in `exportIcal`, and a sixth in a `courseProcessor`
 * that nothing imported and which read a `schema.timetable[].periods[].slots`
 * shape that exists nowhere in this repository.
 *
 * The return carries the raw clock strings *and* the minutes because the callers
 * genuinely disagree: the calendar export needs `"08:00 AM"` to write a DTSTART,
 * and the generator needs `480` to test two periods for overlap.
 *
 * A slot id can name more than one period — `A1` is Monday 8:00 *and* Wednesday
 * 8:55 — so this returns an array and callers that assume one result per day are
 * the ones that were wrong.
 */
export function periodsForSlot(schema: CampusSchema, slot: string): SlotPeriod[] {
  const wanted = new Set(slotSpellings(slot));
  if (!wanted.size) return [];

  const found: SlotPeriod[] = [];

  const collect = (periods: SchemaPeriod[] | undefined, type: "theory" | "lab") => {
    periods?.forEach((period, index) => {
      // A lunch marker is a spacer with no times, not a period.
      if (period?.lunch || !period.start || !period.end || !period.days) return;
      // A schema entry can list several slots for one day, joined by "/" — the
      // iCal export assumed as much. So can a day hold more than one match.
      for (const [day, slotStr] of Object.entries(period.days)) {
        if (!slotStr) continue;
        const ids = String(slotStr)
          .split(/[/+]/)
          .map((s) => normalise(s))
          .filter(Boolean);
        if (!ids.some((id) => wanted.has(id))) continue;
        if (!isDayId(day)) continue;
        const startMin = timeToMinutes(period.start);
        const endMin = timeToMinutes(period.end);
        // An unreadable time makes the period unusable rather than midnight.
        if (startMin === null || endMin === null) continue;
        found.push({ day, start: period.start, end: period.end, startMin, endMin, type, index });
      }
    });
  };

  collect(schema.theory, "theory");
  collect(schema.lab, "lab");
  return found;
}

function isDayId(day: string): day is DayId {
  return (DAYS_OF_WEEK as readonly string[]).includes(day);
}

/**
 * Do a theory booking and a lab booking land on the clock at the same time?
 *
 * Used when combining a course's theory and lab rows into one booking, where a
 * pair that overlaps in the timetable is a data error rather than a coincidence.
 * Takes the slot strings as written (`"A1+TA1"`) because that is the shape they
 * arrive in from the report.
 */
export function slotsOverlap(
  theorySlotStr: string,
  labSlotStr: string,
  schema: CampusSchema
): boolean {
  const split = (s: string) =>
    String(s ?? "")
      .split("+")
      .map((x) => normalise(x))
      .filter(Boolean);

  const theoryPeriods = split(theorySlotStr).flatMap((s) => periodsForSlot(schema, s));
  const labPeriods = split(labSlotStr).flatMap((s) => periodsForSlot(schema, s));

  for (const t of theoryPeriods) {
    for (const l of labPeriods) {
      if (t.day === l.day && Math.max(t.startMin, l.startMin) < Math.min(t.endMin, l.endMin)) {
        return true;
      }
    }
  }
  return false;
}

