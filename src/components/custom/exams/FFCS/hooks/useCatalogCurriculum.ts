"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isLoggedInAtom } from "@/store";
import { storage } from "@/lib/storage";
import type { CategoryDetail } from "@/lib/curriculum";
import { syncEngine } from "@/lib/sync-engine";
import { buildCurriculumIndex, type CatalogCurriculum } from "@/lib/ffcsCatalogFilters";

/**
 * The one-shot backfill guard, module-level so every hook instance shares it
 * — the Search Course sheet and the Target Courses modal both mount at load,
 * and two parallel VTOP fetches of the same payload would be pure waste.
 * Per *page* session by design: a reset per mount would re-fire on every
 * sheet teardown, so the only reset is `resetCatalogCurriculumBackfillForTests`.
 */
let fetchAttempted = false;
let inflight: Promise<void> | null = null;

/** Test seam for the module-level guard above (see its comment). */
export function resetCatalogCurriculumBackfillForTests(): void {
  fetchAttempted = false;
  inflight = null;
}

/**
 * Mounted instances, re-read on demand: the FFCS sync button (and anything
 * else that writes `storage.curriculum` outside the backfill) announces the
 * change here, because localStorage itself has no same-tab change events.
 * Instances only subscribe while logged in, so an announce can never leak a
 * payload to a signed-out sheet.
 */
const refreshListeners = new Set<(next: CatalogCurriculum | null) => void>();

/** Call after anything writes `storage.curriculum` (a page sync, the op). */
export function notifyCatalogCurriculumChanged(): void {
  const next = readCurriculum();
  refreshListeners.forEach((listener) => listener(next));
}

/** The cached payload as a lookup — the single source every state uses. */
function readCurriculum(): CatalogCurriculum | null {
  try {
    const cached = storage.curriculum.get() as { details?: CategoryDetail[] } | null;
    return buildCurriculumIndex(cached?.details ?? null);
  } catch {
    return null;
  }
}

/**
 * The logged-in student's curriculum index, or null when there is none.
 *
 * Null covers every "not available" case — logged out, never synced, a
 * payload without course items — so hosts hide the My Curriculum switch on
 * null alone.
 *
 * The read is state + effect, not a memo on `isLoggedIn`, for a reason: the
 * sync that fills `storage.curriculum` runs *after* the login flag flips on a
 * first login, so a memo keyed on the flag alone holds the pre-sync null
 * forever (which is exactly how the switch ended up dead for logged-in
 * users). The effect re-reads on every login flip, and when the cache is
 * still empty it fires ONE background fetch of the missing payload per page
 * session — `curriculum` is not part of any sync mode, so before this the
 * only way to ever have the data was visiting Academics → Curriculum.
 *
 * A failed fetch just leaves the null: the switch stays hidden, which is the
 * same honest "no curriculum yet" state as never having tried.
 */
export function useCatalogCurriculum(): CatalogCurriculum | null {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const [curriculum, setCurriculum] = useState<CatalogCurriculum | null>(() => readCurriculum());

  useEffect(() => {
    if (!isLoggedIn) {
      setCurriculum(null);
      return;
    }

    const cached = readCurriculum();
    setCurriculum(cached);
    if (!cached && !fetchAttempted) {
      fetchAttempted = true;
      const backfill = (inflight ??= syncEngine
        .syncBackground<void>("curriculum", {})
        .catch(() => {
          /* no payload ⇒ no switch; identical to never having tried */
        })
        .finally(() => {
          inflight = null;
        }));
      // Re-read whatever the backfill persisted (or the unchanged empty cache
      // when it failed) — the fetch lands after the first read by construction.
      void backfill.then(() => setCurriculum(readCurriculum()));
    }

    // An explicit sync elsewhere (the FFCS sync button) announces itself; the
    // backfill above needs no listener because its own completion re-reads.
    const onChange = (next: CatalogCurriculum | null) => setCurriculum(next);
    refreshListeners.add(onChange);
    return () => {
      refreshListeners.delete(onChange);
    };
  }, [isLoggedIn]);

  return curriculum;
}
