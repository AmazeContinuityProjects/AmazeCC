import type { CourseLock } from "@/components/custom/exams/FFCS/types";
import { loadSessionPreferences, saveSessionPreferences } from "./ffcsGeneratorSessionPrefs";

/**
 * The auto-generator's own target picks, remembered across opens in their
 * own localStorage key.
 *
 * Deliberately separate from the planner's `ffcs_courseLocks`: the
 * generator mirrors the locks while the plan has any and owns this store
 * when it doesn't (see the seed logic in `FFCSGeneratorSubpage`). The
 * planner prunes this store alongside the locks whenever the loaded course
 * list stops offering a code — `pruneGeneratorTargets` — because a pick
 * that no longer resolves doesn't sit idle: generation fails the whole run
 * with `no_valid_slots`.
 */
export const FFCS_GENERATOR_TARGETS_KEY = "ffcs_generator_targets";

/**
 * localStorage with the SSR guard and the quota throw handled — the same
 * contract as the tab's `safeStorage`, copied rather than imported so a
 * `lib` module never depends on a component file.
 */
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
};

/** The stored pick set, or `[]` when unset, corrupt, or not an array. */
export function loadGeneratorTargets(): CourseLock[] {
  try {
    const stored = safeLocalStorage.getItem(FFCS_GENERATOR_TARGETS_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as CourseLock[]) : [];
  } catch {
    return [];
  }
}

export function saveGeneratorTargets(targets: CourseLock[]): void {
  safeLocalStorage.setItem(FFCS_GENERATOR_TARGETS_KEY, JSON.stringify(targets));
}

/**
 * Unselect every remembered target whose course code the given catalogue no
 * longer offers — the course list changed under the student (they switched
 * reports, or the shipped list was updated), and one target without
 * offerings fails the entire generation run.
 *
 * Both pick stores are covered: this localStorage set, and the session
 * prefs' `targets` seed the generator reads first when the plan has no
 * locks. The other session preferences are carried over untouched, and
 * nothing at all is written when nothing is stale.
 */
export function pruneGeneratorTargets(offeredCodes: ReadonlySet<string>): void {
  const stored = loadGeneratorTargets();
  const kept = stored.filter((target) => !!target && offeredCodes.has(target.code));
  if (kept.length !== stored.length) saveGeneratorTargets(kept);

  const prefs = loadSessionPreferences();
  const prefTargets = prefs.targets ?? [];
  const keptPrefs = prefTargets.filter((target) => offeredCodes.has(target.code));
  if (keptPrefs.length !== prefTargets.length) {
    saveSessionPreferences({ ...prefs, targets: keptPrefs });
  }
}
