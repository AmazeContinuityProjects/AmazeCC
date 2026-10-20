"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { useIsMobile } from "../shared";
import { settingsAtom } from "@/store/settingsAtoms";

export type TimetableViewMode = "auto" | "vertical" | "horizontal";
export type ResolvedView = "vertical" | "horizontal";
/** How much a vertical cell holds. "compact" is slot-only and fits the viewport. */
export type CellDensity = "full" | "compact";

/**
 * What the vertical grid renders at. Until the user has picked a density
 * (`timetableDensityTouched` in settings), a phone defaults to compact: the
 * full cells were designed for the scrollable desktop column and a phone and a
 * full-code cell in every band never fit the week on screen at once.
 *
 * The `touched` flag instead of a flipped `timetableCellDensity` default is
 * what makes this work on existing installs — their persisted settings already
 * carry `"full"`, so there is no stored value that distinguishes "pristine"
 * from "explicitly chose full". A phone with the flag absent shows compact no
 * matter what the stored key says; the first tap anywhere stamps the flag and
 * the stored choice takes over everywhere.
 */
export function effectiveCellDensity(
  stored: CellDensity | undefined,
  touched: boolean | undefined,
  isMobile: boolean,
): CellDensity {
  if (!touched && isMobile) return "compact";
  return stored ?? "full";
}

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
  const density: CellDensity = effectiveCellDensity(
    settings?.timetableCellDensity,
    settings?.timetableDensityTouched,
    isMobile,
  );

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

  /** Persists a density choice and marks it explicit, so it wins over the
   *  phone's compact default from then on. */
  const setDensity = useCallback(
    (next: CellDensity) =>
      persist({ timetableCellDensity: next, timetableDensityTouched: true }),
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
