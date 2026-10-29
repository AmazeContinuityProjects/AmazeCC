/**
 * Per-course manual faculty ordering — "I'd rather have Prof A than Prof B".
 *
 * Ported from FFCS-inator's per-course drag-and-drop `priorityList`
 * (`codechefvit/ffcs` → `src/components/cards/FacultySelector.tsx`): the student
 * ranks the faculties offering one course, and generation honours that order
 * two ways — preferred offerings are searched first (so they are the ones that
 * survive a result cap and a variant dedupe), and generated plans are ordered
 * by how well they match the ranking.
 *
 * Deliberately a map from course code to a list of *names* rather than offering
 * ids: the whole point is "this person, whatever slot they teach", and a name
 * list stays valid when the report reloads with different rooms. Identification
 * follows the report's own `FACULTY` spelling (split on `/` for combined
 * theory/lab rows), compared case-insensitively — the same strings the picker
 * UI shows, so what the student orders is what the generator matches.
 *
 * Stored in its own key (`ffcs_facultyPriority`) rather than in
 * `ffcs_settings`: that record is global preferences with per-field fallback,
 * while this is per-course data that can grow with the catalogue — mixing the
 * two would make a settings reset erase course-specific work and a course
 * change churn the settings record.
 */

/** Course code → faculties in the student's preferred order (best first). */
export type FacultyPriorityMap = Record<string, string[]>;

/**
 * Split a report cell into individual faculty names.
 *
 * Combined theory/lab rows write both teachers as `THEORY / LAB`; either half
 * naming a person counts as that person being offered, so both become
 * orderable entries.
 */
export function splitFacultyNames(faculty: string): string[] {
  return String(faculty ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Coerce persisted-or-hand-edited data into a usable map.
 *
 * Same posture as `sanitizeFFCSSettings`: entries fall back individually —
 * a malformed course entry is dropped, the others survive, and duplicates
 * within one list collapse to first occurrence. Unknown keys are kept as-is:
 * a course code is just a string, and refusing to store one we don't recognise
 * yet would lose ordering the moment a catalogue changes spelling.
 */
export function sanitizeFacultyPriority(raw: unknown): FacultyPriorityMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FacultyPriorityMap = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const trimmedCode = code.trim();
    if (!trimmedCode || !Array.isArray(value)) continue;
    const seen = new Set<string>();
    const names: string[] = [];
    for (const entry of value) {
      if (typeof entry !== "string") continue;
      const name = entry.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    if (names.length) out[trimmedCode] = names;
  }
  return out;
}

/**
 * Where this offering sits in the course's ranking, as a 0..1 score.
 *
 * `null` = the student has no ordering for this course, which is *not* zero:
 * an unranked course must contribute nothing to a plan comparison, so plans
 * differing only in it stay tied and the stable sort keeps their order.
 * A ranked course whose faculty is absent from the list scores 0 — "not
 * preferred" is a real answer, and it is what keeps an unlisted offering
 * behind every listed one.
 */
export function facultyPreferenceScore(priority: readonly string[] | undefined, faculty: string): number | null {
  if (!priority || priority.length === 0) return null;
  const wanted = splitFacultyNames(faculty).map((n) => n.toLowerCase());
  const index = priority.findIndex((name) => wanted.includes(name.trim().toLowerCase()));
  if (index === -1) return 0;
  // Best (index 0) → 1, last → just above 0; every rank stays distinguishable.
  return (priority.length - index) / priority.length;
}

/**
 * How well one generated plan honours the student's ordering, 0..1.
 *
 * Averaged over *the courses that have an ordering* only — a student who
 * ranked one course should not have every other plan tie-broken by courses
 * nobody expressed a preference about. `null` when nothing applies, meaning
 * "this factor does not participate", so callers can skip the sort entirely.
 */
export function timetablePreferenceScore(
  courses: readonly { code: string; faculty: string }[],
  map: FacultyPriorityMap | undefined,
): number | null {
  if (!map) return null;
  let total = 0;
  let counted = 0;
  for (const course of courses) {
    const score = facultyPreferenceScore(map[course.code], course.faculty);
    if (score === null) continue;
    total += score;
    counted += 1;
  }
  return counted ? total / counted : null;
}

/**
 * Order one course's offerings so the preferred faculties come first.
 *
 * A stable sort by rank: listed faculties keep the student's order, unlisted
 * ones sink behind them in their original (report) order. Runs inside
 * `optionsFor` before the walk, which is what makes preference survive the
 * result cap — the search walks options in this order, so at a cap the
 * offerings that reached it are the preferred ones.
 */
export function sortOptionsByFacultyPriority<T>(
  options: readonly T[],
  map: FacultyPriorityMap | undefined,
  code: string,
  getFaculty: (option: T) => string,
): T[] {
  const priority = map?.[code];
  if (!priority || priority.length === 0 || options.length < 2) return [...options];
  const rank = (option: T): number => {
    const score = facultyPreferenceScore(priority, getFaculty(option));
    // `score` is null only when the list is empty, which returned above.
    return score === null ? 0 : priority.length * (1 - score);
  };
  return options
    .map((option, index) => ({ option, index, rank: rank(option) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.option);
}

/** True when the map carries at least one usable ordering. */
export function hasFacultyPriority(map: FacultyPriorityMap | undefined): map is FacultyPriorityMap {
  return Boolean(map && Object.keys(map).length > 0);
}
