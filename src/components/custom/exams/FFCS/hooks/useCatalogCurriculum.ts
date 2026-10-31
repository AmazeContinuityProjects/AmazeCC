"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { isLoggedInAtom } from "@/store";
import { storage } from "@/lib/storage";
import type { CategoryDetail } from "@/lib/curriculum";
import { buildCurriculumIndex, type CatalogCurriculum } from "@/lib/ffcsCatalogFilters";

/**
 * The logged-in student's curriculum index, or null when there is none.
 *
 * Null covers every "not available" case — logged out, never synced, a
 * payload without course items — so hosts hide the My Curriculum switch on
 * null alone. Re-derived when the login flag flips rather than per render:
 * the read is one localStorage lookup, and the sync that fills it runs
 * behind the same flag.
 */
export function useCatalogCurriculum(): CatalogCurriculum | null {
  const isLoggedIn = useAtomValue(isLoggedInAtom);

  return useMemo(() => {
    if (!isLoggedIn) return null;
    try {
      const cached = storage.curriculum.get() as { details?: CategoryDetail[] } | null;
      return buildCurriculumIndex(cached?.details ?? null);
    } catch {
      return null;
    }
  }, [isLoggedIn]);
}
