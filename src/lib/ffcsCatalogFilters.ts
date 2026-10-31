/**
 * Catalog-wide filters for the FFCS course pickers: slot-token chips and the
 * logged-in student's curriculum match.
 *
 * Two hosts share this — the Search Course sheet and the Target Courses modal
 * — so the matching lives here as pure functions: a chip list built from the
 * loaded catalogue, a course-code → curriculum-category index built from
 * VTOP's `/curriculum` payload (see `sync-engine`'s `curriculum` op) that
 * matches on shared code prefixes as well as exact codes, and one predicate
 * both sheets call while filtering their lists.
 */
import type { CategoryDetail } from "@/lib/curriculum";
import { hasSlot, schemaSlotFor, splitSlots } from "@/lib/slots";

/** course code → every slot token its offerings run in (`NIL` dropped). */
export type CatalogSlotIndex = Map<string, Set<string>>;

/** The student's curriculum as a lookup, for matching catalogue codes. */
export interface CatalogCurriculum {
  /** Category names in curriculum order — "University Core Courses", … */
  categories: string[];
  /** Exact course code (upper-cased) → the category it counts toward. */
  categoryByCode: Map<string, string>;
  /**
   * Every prefix of every curriculum code, down to a single character, → the
   * category it counts toward. The catalogue matches on a shared start of any
   * length — `BASTS101` claims `BASTS102` through `BASTS1`, an embedded or lab
   * variant claims its base code, and a bare `B`/`I`/`MA` still claims the
   * rest of that family. `courseCategory` walks a code from its full length
   * down, so the longest shared start always wins the category.
   */
  categoryByPrefix: Map<string, string>;
}

export interface CatalogFilterState {
  /** Selected slot chips; a course survives when ANY of its slots is one. */
  slots: string[];
  /** Only courses the student's own curriculum lists. */
  curriculumOnly: boolean;
  /** Selected categories; empty means every category. */
  categories: string[];
}

export const EMPTY_CATALOG_FILTERS: CatalogFilterState = {
  slots: [],
  curriculumOnly: false,
  categories: [],
};

const normaliseCode = (code: string): string =>
  String(code ?? "")
    .trim()
    .toUpperCase();

/** Row shape the slot index needs — the report's parsed course rows. */
export interface SlotIndexRow {
  CODE: string;
  SLOT: string;
}

/**
 * code → its slot tokens, across every offering row of that code.
 *
 * Codes are upper-cased so the index answers to `matchesCatalogFilters` no
 * matter how the host spelled the code it looked up.
 */
export function buildSlotIndex(rows: readonly SlotIndexRow[]): CatalogSlotIndex {
  const index: CatalogSlotIndex = new Map();
  for (const row of rows) {
    const code = normaliseCode(row.CODE);
    if (!code) continue;
    let slots = index.get(code);
    if (!slots) {
      slots = new Set();
      index.set(code, slots);
    }
    for (const token of splitSlots(row.SLOT)) {
      if (token !== "NIL") slots.add(token);
    }
  }
  return index;
}

/**
 * The chip id for one slot token: the schema's spelling when the two differ
 * (`A` → `A1`, `TEE` → `S11`).
 *
 * The law school books the same period with the digit left off, so without
 * this one canonical id the chip list would offer `A` and `A1` as two chips
 * that mean exactly the same slot. Matching itself still goes through
 * `hasSlot`, which understands both spellings in either direction.
 */
export function canonicalSlot(token: string): string {
  return schemaSlotFor(token) ?? normaliseCode(token);
}

/**
 * Every slot chip the catalogue offers, theory and lab apart, sorted the way
 * a person reads them (`L2` before `L10`).
 */
export function catalogSlotChips(index: CatalogSlotIndex): { theory: string[]; lab: string[] } {
  const theory = new Set<string>();
  const lab = new Set<string>();
  for (const slots of index.values()) {
    for (const token of slots) {
      const chip = canonicalSlot(token);
      (chip.startsWith("L") ? lab : theory).add(chip);
    }
  }
  const byReadingOrder = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  return {
    theory: [...theory].sort(byReadingOrder),
    lab: [...lab].sort(byReadingOrder),
  };
}

/**
 * The student's curriculum as code → category ("University Core Courses",
 * "Programme Core Courses", "Concentration", "Open Elective", …).
 *
 * Matching is prefix-based, not exact-only: a catalogue course counts when it
 * shares a common start with a curriculum code — anything from the full code
 * down to its first letter. The index therefore stores every prefix of every
 * curriculum code; the exact `categoryByCode` map stays for callers that want
 * the literal listing, but filtering and chips go through `courseCategory`,
 * which answers with the longest shared start's category.
 *
 * Null when there is nothing to match — logged out, never synced, or a
 * payload without course items — so hosts branch on null alone. A course
 * appearing in two categories keeps the first; VTOP should not do that and
 * there is no second answer worth hiding the first one for.
 */
export function buildCurriculumIndex(details: readonly CategoryDetail[] | null | undefined): CatalogCurriculum | null {
  if (!details?.length) return null;

  const order: string[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const categoryByCode = new Map<string, string>();

  for (const detail of details) {
    const name = String(detail?.name ?? "").trim();
    if (!name) continue;
    if (!seen.has(name)) {
      seen.add(name);
      order.push(name);
      counts.set(name, 0);
    }
    for (const basket of detail.baskets ?? []) {
      for (const item of basket?.items ?? []) {
        const code = normaliseCode(item?.code);
        if (!code) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
        if (!categoryByCode.has(code)) categoryByCode.set(code, name);
      }
    }
  }

  if (!categoryByCode.size) return null;

  // Every prefix of every code, longest first per code, first claimant wins
  // each key. The KEY set is what matters: it is exactly the set of strings
  // that are a prefix of both some catalogue code and some curriculum code,
  // so walking a code's own prefixes longest-first lands on the longest
  // shared start — the shortest keys (a bare first letter) only ever decide
  // the category of a course nothing more specific claims.
  const categoryByPrefix = new Map<string, string>();
  for (const [code, name] of categoryByCode) {
    for (let len = code.length; len >= 1; len--) {
      const prefix = code.slice(0, len);
      if (!categoryByPrefix.has(prefix)) categoryByPrefix.set(prefix, name);
    }
  }

  // A category with no course codes of its own would render a chip that can
  // only ever empty the list.
  return {
    categories: order.filter((name) => (counts.get(name) ?? 0) > 0),
    categoryByCode,
    categoryByPrefix,
  };
}

/**
 * Which curriculum category a code counts toward, or null.
 *
 * Prefix match: the answer comes from the longest start the code shares with
 * a curriculum code, so a listed course still answers with its own category
 * while `BCSE101E`-style variants and same-family codes inherit the closest
 * relative's. The filter and the category chip both call this, so a course
 * can never be visible under a category the chip does not show.
 */
export function courseCategory(code: string, curriculum: CatalogCurriculum | null | undefined): string | null {
  if (!curriculum) return null;
  const normalised = normaliseCode(code);
  for (let len = normalised.length; len >= 1; len--) {
    const hit = curriculum.categoryByPrefix.get(normalised.slice(0, len));
    if (hit) return hit;
  }
  return null;
}

/** Do the active filters narrow anything? For empty-state copy. */
export function catalogFiltersActive(state: CatalogFilterState): boolean {
  return state.slots.length > 0 || state.curriculumOnly;
}

/**
 * The one predicate both sheets filter their lists through.
 *
 * `slotsOfCourse` comes from the caller's own slot index (or is skipped when
 * the caller has no index for that code) because the index is built per host
 * from whatever catalogue is loaded. Slot chips match with `hasSlot` so a
 * law-spelled course answers to its engineering chip. Curriculum-only keeps a
 * course when `courseCategory` does — exact listing OR any shared code start,
 * so lab/embedded variants and the rest of a curriculum code's family come
 * along with the courses themselves. A curriculum-only state with no
 * curriculum to check is a no-op rather than an empty list — the switch
 * cannot be on without curriculum, so a stale true means the data left, not
 * that the student asked for nothing.
 */
export function matchesCatalogFilters(
  code: string,
  slotsOfCourse: ReadonlySet<string> | undefined,
  state: CatalogFilterState,
  curriculum: CatalogCurriculum | null,
): boolean {
  if (state.slots.length > 0) {
    const courseSlots = slotsOfCourse ? [...slotsOfCourse] : [];
    if (courseSlots.length === 0 || !state.slots.some((chip) => hasSlot(courseSlots, chip))) {
      return false;
    }
  }

  if (state.curriculumOnly && curriculum) {
    const category = courseCategory(code, curriculum);
    if (!category) return false;
    if (state.categories.length > 0 && !state.categories.includes(category)) return false;
  }

  return true;
}
