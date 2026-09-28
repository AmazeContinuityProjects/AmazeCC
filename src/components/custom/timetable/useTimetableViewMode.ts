"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { useIsMobile } from "../shared";
import { settingsAtom } from "@/store/settingsAtoms";

export type TimetableViewMode = "auto" | "vertical" | "horizontal";
export type ResolvedView = "vertical" | "horizontal";
/** How much a vertical cell holds. "compact" is slot-only and fits the viewport. */
export type CellDensity = "full" | "compact";

/** Below this the vertical heatmap is the better default. Matches `useIsMobile`. */
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * Read and write the timetable display preferences: which grid, and how dense.
 *
 * `resolved` is `null` until the component has mounted, and that is the whole
 * point of this hook. Both inputs land *after* the first render:
 *
 *   - `settingsAtom` starts at `defaultSettings` and is replaced with the
 *     persisted object in an effect in `Main.tsx`
 *   - `useIsMobile` starts at `false` and only measures in its own effect
 *
 * So a caller that trusted either one during the first render would paint the
 * horizontal grid and then snap to the vertical one a frame later. Returning
 * `null` lets the caller hold a stable placeholder instead of a visible flip.
 */
export function useTimetableViewMode() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode: TimetableViewMode = settings?.timetableViewMode ?? "auto";
  const density: CellDensity = settings?.timetableCellDensity ?? "full";

  /**
   * Persists a preference patch. Every other write path in the app saves to
   * `localStorage` by hand inside the updater, so the atom and storage never
   * disagree; this does the same for the two keys owned here.
   */
  const persist = useCallback(
    (patch: Partial<typeof settings>) => {
      setSettings((prev) => {
        const merged = { ...prev, ...patch };
        try {
          localStorage.setItem("settings", JSON.stringify(merged));
        } catch {
          // A private-mode / quota failure must not break the toggle itself.
        }
        return merged;
      });
    },
    [setSettings]
  );

  const setMode = useCallback(
    (next: TimetableViewMode) => persist({ timetableViewMode: next }),
    [persist]
  );

  const setDensity = useCallback(
    (next: CellDensity) => persist({ timetableCellDensity: next }),
    [persist]
  );

  const resolved: ResolvedView | null = !mounted
    ? null
    : mode === "auto"
      ? isMobile
        ? "vertical"
        : "horizontal"
      : mode;

  return { mode, setMode, density, setDensity, resolved, mounted, isMobile };
}
