"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isLoggedInAtom } from "@/store";
import { storage } from "@/lib/storage";
import { syncEngine } from "@/lib/sync-engine";
import { buildGradeIndex, type GradeIndex } from "@/lib/ffcsPlannerGrades";

/**
 * The one-shot backfill guard, module-level so every hook instance shares it
 * — the Search Course sheet and the Target Courses modal both mount at load,
 * and two parallel VTOP fetches of the same payload would be pure waste.
 * Per *page* session by design: a reset per mount would re-fire on every
 * sheet teardown, so the only reset is `resetCatalogGradesBackfillForTests`.
 *
 * Same structure as `useCatalogCurriculum.ts` deliberately: the two payloads
 * travel together ("Curriculum & grade history"), and keeping the hooks
 * twins means one mental model for both.
 */
let fetchAttempted = false;
let inflight: Promise<void> | null = null;

/** Test seam for the module-level guard above (see its comment). */
export function resetCatalogGradesBackfillForTests(): void {
  fetchAttempted = false;
  inflight = null;
}

/**
 * Mounted instances, re-read on demand: the FFCS sync button, the planner's
 * "Curriculum & grade history" sheet and anything else that writes
 * `storage.allGrades` outside the backfill announces the change here, because
 * localStorage itself has no same-tab change events. Instances only subscribe
 * while logged in and enabled, so an announce can never leak a payload to a
 * signed-out or opted-out sheet.
 */
const refreshListeners = new Set<(next: GradeIndex | null) => void>();

/** Call after anything writes `storage.allGrades` (a page sync, the op). */
export function notifyCatalogGradesChanged(): void {
  const next = readGradeIndex();
  refreshListeners.forEach((listener) => listener(next));
}

/** The cached payload as a lookup — the single source every state uses. */
function readGradeIndex(): GradeIndex | null {
  try {
    return buildGradeIndex(storage.allGrades.get());
  } catch {
    return null;
  }
}

/**
 * The logged-in student's grade index (course code → latest grade record),
 * or null when there is none.
 *
 * Null covers every "not available" case — logged out, never synced, an
 * empty payload, or the integration switched off — so hosts apply no grade
 * rules on null alone, exactly like the curriculum index.
 *
 * `enabled` comes from the planner setting `integrateCurriculumAndGrades`:
 * when off the hook returns null and fires no backfill, so no grade data is
 * read into the pickers at all.
 *
 * The read is state + effect, not a memo on `isLoggedIn`, for the same
 * reason as `useCatalogCurriculum`: the sync that fills `storage.allGrades`
 * runs *after* the login flag flips on a first login, and `all-grades` is
 * only part of the academics sync mode — so when the cache is empty the
 * effect fires ONE background fetch of the missing payload per page session.
 *
 * A failed fetch just leaves the null: no rules fire, which is the same
 * honest "no grades yet" state as never having tried.
 */
export function useCatalogGrades(options?: { enabled?: boolean }): GradeIndex | null {
  const enabled = options?.enabled ?? true;
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const [grades, setGrades] = useState<GradeIndex | null>(() => (enabled ? readGradeIndex() : null));

  useEffect(() => {
    if (!isLoggedIn || !enabled) {
      setGrades(null);
      return;
    }

    const cached = readGradeIndex();
    setGrades(cached);
    if (!cached && !fetchAttempted) {
      fetchAttempted = true;
      const backfill = (inflight ??= syncEngine
        .syncBackground<void>("all-grades", {})
        .catch(() => {
          /* no payload ⇒ no rules; identical to never having tried */
        })
        .finally(() => {
          inflight = null;
        }));
      // Re-read whatever the backfill persisted (or the unchanged empty cache
      // when it failed) — the fetch lands after the first read by construction.
      void backfill.then(() => setGrades(readGradeIndex()));
    }

    // An explicit sync elsewhere (the FFCS sync button, the integration sheet)
    // announces itself; the backfill above needs no listener because its own
    // completion re-reads.
    const onChange = (next: GradeIndex | null) => setGrades(next);
    refreshListeners.add(onChange);
    return () => {
      refreshListeners.delete(onChange);
    };
  }, [isLoggedIn, enabled]);

  return grades;
}
