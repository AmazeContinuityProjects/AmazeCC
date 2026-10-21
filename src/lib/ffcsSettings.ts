"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import { asRankingMode, type RankingMode } from "./ffcsRanking";
import type { SortBy } from "./timetableMetrics";
import { DEFAULT_RESULT_LIMIT } from "@/components/custom/exams/FFCS/logic/generate";
import { track } from "./analytics";

/**
 * The planner's preferences, in their own namespace (`ffcs_settings`).
 *
 * ## What belongs here, and what does not
 *
 * Only *defaults* live in this record — the starting values for controls that
 * the student can override per run (the generator's sort order, its ranking
 * profile, the half-days floor, the result cap) plus two switches that have no
 * per-run moment (the image export format, whether to offer the tour).
 *
 * Deliberately **not** here: `isGroupingEnabled` and `socialScoreGroupMethod`.
 * Those already have tab state and their own storage keys, and the tab's
 * controls write them live. Mirroring them into this record would mean two
 * sources of truth for one toggle, so the settings sheet edits the tab's state
 * directly instead — the sheet is rendered by the tab, which makes that a prop
 * rather than a channel.
 *
 * Also absent: campus. The planner hardcodes one campus (`GLOBAL_CAMPUS`), and
 * the only course report shipped is that campus's. A campus picker would flip
 * the schema under a report that no longer matches it — a setting that lies.
 * When per-campus reports exist, this is where the key goes.
 *
 * Analytics consent is its own key (`ffcs_analytics_enabled`, owned by
 * `./analytics`), because it is a privacy choice that outlives any one feature
 * and a settings reset must not silently re-enable tracking.
 */

export type ExportFormat = "jpg" | "png";

/**
 * `"none"` rather than an omission so the sheet can show "No ranking profile"
 * as an explicit choice; the generator's `rankingMode` stays unset for it,
 * which is exactly the behaviour of planner versions without profiles.
 */
export type DefaultRankingMode = RankingMode | "none";

export interface FFCSSettings {
  /** Ranking profile the generator starts with. `"none"` = plain sort order. */
  rankingMode: DefaultRankingMode;
  /** Sort order the generator starts with. */
  defaultSortBy: SortBy;
  /** Format of the timetable image download. */
  exportFormat: ExportFormat;
  /** Half-days floor the generator starts with (0 = off). */
  minHalfDays: number;
  /** Search cap used when the run is not unlimited. */
  resultCap: number;
  /** Whether to offer the guided tour to a first-time visitor. */
  showTour: boolean;
}

export const FFCSSettingsDefaults: Readonly<FFCSSettings> = Object.freeze({
  rankingMode: "none" as DefaultRankingMode,
  defaultSortBy: "balanced" as SortBy,
  exportFormat: "jpg" as ExportFormat,
  minHalfDays: 0,
  resultCap: DEFAULT_RESULT_LIMIT,
  showTour: true,
});

const SORT_BY: readonly SortBy[] = ["social", "halfdays", "compactness", "balanced"];
const EXPORT_FORMATS: readonly ExportFormat[] = ["jpg", "png"];
/** Half a week of half-days (6 days × morning/evening); the real ceiling. */
const MAX_HALF_DAYS = 12;
const MIN_RESULT_CAP = 10;
const MAX_RESULT_CAP = 1000;

function asInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Coerce persisted-or-hand-edited data into a whole settings record.
 *
 * Everything unrecognised falls back per field, never per record: a schema
 * bump that adds a field must not throw away the student's existing sort
 * choice, and a typo in one value must not reset the other five. This is the
 * same posture `asRankingMode` takes — settings are data, and data gets
 * edited by hands and by older app versions.
 */
export function sanitizeFFCSSettings(raw: unknown): FFCSSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    rankingMode:
      r.rankingMode === "none"
        ? "none"
        : asRankingMode(r.rankingMode) ?? FFCSSettingsDefaults.rankingMode,
    defaultSortBy:
      SORT_BY.includes(r.defaultSortBy as SortBy)
        ? (r.defaultSortBy as SortBy)
        : FFCSSettingsDefaults.defaultSortBy,
    exportFormat: EXPORT_FORMATS.includes(r.exportFormat as ExportFormat)
      ? (r.exportFormat as ExportFormat)
      : FFCSSettingsDefaults.exportFormat,
    minHalfDays: asInt(r.minHalfDays, 0, MAX_HALF_DAYS, FFCSSettingsDefaults.minHalfDays),
    resultCap: asInt(r.resultCap, MIN_RESULT_CAP, MAX_RESULT_CAP, FFCSSettingsDefaults.resultCap),
    showTour: typeof r.showTour === "boolean" ? r.showTour : FFCSSettingsDefaults.showTour,
  };
}

/**
 * The settings record plus the two operations the sheet needs.
 *
 * One instance per feature surface (the tab), handed down — the sheet, the
 * generator's seed values and the export button all read the same state, so a
 * change is visible everywhere without a storage event or a remount.
 */
export function useFFCSSettings() {
  // Defaults during SSR and on first paint; storage is read after mount so a
  // static page and its hydration agree.
  const [settings, setSettings] = useState<FFCSSettings>(FFCSSettingsDefaults);

  useEffect(() => {
    setSettings(sanitizeFFCSSettings(storage.ffcsSettings.get()));
  }, []);

  const update = useCallback(<K extends keyof FFCSSettings>(key: K, value: FFCSSettings[K]) => {
    setSettings((prev) => {
      const next = sanitizeFFCSSettings({ ...prev, [key]: value });
      storage.ffcsSettings.set(next);
      return next;
    });
    track("settings_changed", { key: String(key) });
  }, []);

  const reset = useCallback(() => {
    storage.ffcsSettings.remove();
    setSettings(FFCSSettingsDefaults);
    track("settings_changed", { key: "reset" });
  }, []);

  return { settings, update, reset };
}
