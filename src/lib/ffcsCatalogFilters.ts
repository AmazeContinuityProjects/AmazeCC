/**
 * Catalog-wide filters for the FFCS course pickers: slot-token chips and the
 * logged-in student's curriculum match.
 *
 * Two hosts share this — the Search Course sheet and the Target Courses modal
 * — so the matching lives here as pure functions: a chip list built from the
 * loaded catalogue, an index built from VTOP's `/curriculum` payload (see
 * `sync-engine`'s `curriculum` op) that labels a listed code with its
 * curriculum category and a mere shared-start code as an open-elective
 * candidate, and one predicate both sheets call while filtering their lists.
 */
import type { CategoryDetail } from "@/lib/curriculum";
import { hasSlot, schemaSlotFor, splitSlots } from "@/lib/slots";

/** course code → every slot token its offerings run in (`NIL` dropped). */
export type CatalogSlotIndex = Map<string, Set<string>>;

/**
 * The label a course that is NOT listed in the curriculum answers with when
 * it shares a code start with one — a family member, so a candidate open
 * elective rather than a curriculum course. Exact listings keep their own
 * category instead; that split is how the pickers "tell it is curriculum".
 */
export const OPEN_ELECTIVE_CATEGORY = "Open Elective";

/** The student's curriculum as a lookup, for matching catalogue codes. */
export interface CatalogCurriculum {
  /** Category names in curriculum order — "University Core Courses", … */
  categories: string[];
  /** Exact course code (upper-cased) → the category it counts toward. */
  categoryByCode: Map<string, string>;
  /**
   * Every start any curriculum code has, from the full code down to a single
   * character (`BCSE1`, `BC`, `B`). Membership here means "shares a code
   * start" — the criterion for counting as an open-elective candidate:
   * `BASTS102` through `BASTS1`, an embedded/lab variant through its base
   * code, or a bare `B`/`I`/`IA` family.
   */
  prefixes: Set<string>;
}

export interface CatalogFilterState {
  /** Selected slot chips; a course survives when ANY of its slots is one. */
  slots: string[];
  /**
   * Only courses related to the student's curriculum: listed codes under
   * their own category, shared-start codes as open-elective candidates.
   */
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
 * "Programme Core Courses", "Concentration", …), split two ways by how a
 * catalogue code relates to it:
 *
 * - an EXACT listing is in the curriculum and answers with its own category,
 * - a code that merely shares a start with a listed one is NOT in the
 *   curriculum — it answers with `OPEN_ELECTIVE_CATEGORY`, a candidate from
 *   the same family,
 * - a code sharing no start answers with nothing and stays hidden.
 *
 * `prefixes` holds every start (full code → first letter) so the second
 * question is one membership test. Null when there is nothing to match —
 * logged out, never synced, or a payload without course items — so hosts
 * branch on null alone. A course appearing in two categories keeps the
 * first; VTOP should not do that and there is no second answer worth
 * hiding the first one for.
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

  // Every start of every listed code, full length down to one character —
  // exactly the set of strings that are a prefix of both some catalogue code
  // and some curriculum code, i.e. "shares a start" made testable in O(len).
  const prefixes = new Set<string>();
  for (const code of categoryByCode.keys()) {
    for (let len = code.length; len >= 1; len--) prefixes.add(code.slice(0, len));
  }

  const categories = order.filter((name) => (counts.get(name) ?? 0) > 0);
  // Family matches answer with OPEN_ELECTIVE_CATEGORY, so the chip that
  // selects them must exist even when the payload's own Open Elective basket
  // is empty or absent. Unlike a purely empty category this chip can never
  // be a dead one — prefix matches land in it.
  if (!categories.some((name) => name.toLowerCase() === OPEN_ELECTIVE_CATEGORY.toLowerCase())) {
    categories.push(OPEN_ELECTIVE_CATEGORY);
  }

  return { categories, categoryByCode, prefixes };
}

/**
 * The label a code answers with, or null when it shares no start at all:
 * its own curriculum category when it is listed verbatim (it IS curriculum),
 * `OPEN_ELECTIVE_CATEGORY` when it only shares a start (it is not, just a
 * candidate), null otherwise. The filter and the badges both call this, so a
 * course can never be visible under a label the badge does not show.
 */
export function courseCategory(code: string, curriculum: CatalogCurriculum | null | undefined): string | null {
  if (!curriculum) return null;
  const normalised = normaliseCode(code);
  const exact = curriculum.categoryByCode.get(normalised);
  if (exact) return exact;
  for (let len = normalised.length; len >= 1; len--) {
    if (curriculum.prefixes.has(normalised.slice(0, len))) return OPEN_ELECTIVE_CATEGORY;
  }
  return null;
}

/**
 * Is the code listed verbatim in the curriculum, as opposed to merely sharing
 * a start with a listed code? Hosts call it beside `courseCategory` to word
 * the badge honestly: "counts toward your curriculum" for a listing, an
 * open-elective candidate for a shared start.
 */
export function isListedInCurriculum(code: string, curriculum: CatalogCurriculum | null | undefined): boolean {
  return !!curriculum?.categoryByCode.has(normaliseCode(code));
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
 * course when `courseCategory` does — an exact listing (kept under its own
 * category) or any shared code start (kept as an open-elective candidate),
 * so lab/embedded variants and the rest of a curriculum code's family come
 * along too. Narrow the category chips to real curriculum categories and the
 * candidates drop out, leaving exactly the courses VTOP listed: the split is
 * in the label, not in a second switch. A curriculum-only state with no
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
