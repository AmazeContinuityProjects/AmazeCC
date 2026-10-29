"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import { asRankingMode, type RankingMode } from "./ffcsRanking";
import type { SortBy } from "./timetableMetrics";
import { DEFAULT_RESULT_LIMIT } from "@/components/custom/exams/FFCS/logic/generate";
import { track } from "./analytics";
import {
  DEFAULT_FACULTY_METRIC_WEIGHTS,
  DEFAULT_FACULTY_SCORE_FILTERS,
  type FacultyMetricWeights,
  type FacultyScoreFilters,
} from "./ffcsFacultyRanking";

export type RankingPriority = "profile" | "faculty" | "sort" | "time";
export const DEFAULT_RANKING_PRIORITY_ORDER: readonly RankingPriority[] = ["profile", "faculty", "sort", "time"];

/**
 * The planner's preferences, in their own namespace (`ffcs_settings`).
 *
 * ## What belongs here, and what does not
 *
 * Defaults and persistent presentation preferences live in this record — the
 * starting values for controls that the student can override per run (the
 * generator's sort order, its ranking profile, the half-days floor, the result
 * cap), plus image export, tour, and wide-screen layout preferences.
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
  /** Export the timetable and course list as separate images. */
  separateCourseListExport: boolean;
  /** Relative priority of the generator's profile, faculty, sort, and time scores. */
  rankingPriorityOrder: RankingPriority[];
  /** Relative weighting of Vitfac's overall and individual review scores. */
  facultyMetricWeights: FacultyMetricWeights;
  /** Minimum review scores required for a generated timetable; zero disables a filter. */
  facultyScoreFilters: FacultyScoreFilters;
  /** Half-days floor the generator starts with (0 = off). */
  minHalfDays: number;
  /** Search cap used when the run is not unlimited. */
  resultCap: number;
  /** Allow unlimited searches to exceed the default 30,000-result safety ceiling. */
  removeHardResultLimit: boolean;
  /**
   * Only timetables containing **every** selected course count.
   *
   * `true` (default) is the planner's original behaviour: the search either
   * finds a week with all the courses or reports why it could not. `false` is
   * FFCS-inator's "All Subjects Mode: OFF" — when the courses cannot all fit,
   * generation retries while leaving out the lowest-priority courses (see
   * `FFCS/logic/dropPolicy`) instead of returning nothing, and the result
   * says which courses were left out.
   */
  allSubjectsMode: boolean;
  /** Whether to offer the guided tour to a first-time visitor. */
  showTour: boolean;
  /** Show a vertical timetable beside the dashboard on extra-wide screens. */
  showVerticalTimetableBesideWidgets: boolean;
  /** Show the desktop option pane while reviewing generated timetables. */
  showGeneratorOptionPane: boolean;
}

export const FFCSSettingsDefaults: Readonly<FFCSSettings> = Object.freeze({
  rankingMode: "none" as DefaultRankingMode,
  defaultSortBy: "balanced" as SortBy,
  exportFormat: "jpg" as ExportFormat,
  separateCourseListExport: false,
  rankingPriorityOrder: [...DEFAULT_RANKING_PRIORITY_ORDER],
  facultyMetricWeights: { ...DEFAULT_FACULTY_METRIC_WEIGHTS },
  facultyScoreFilters: { ...DEFAULT_FACULTY_SCORE_FILTERS },
  minHalfDays: 0,
  resultCap: DEFAULT_RESULT_LIMIT,
  removeHardResultLimit: false,
  allSubjectsMode: true,
  showTour: true,
  showVerticalTimetableBesideWidgets: false,
  showGeneratorOptionPane: true,
});

const SORT_BY: readonly SortBy[] = ["social", "halfdays", "compactness", "balanced", "faculty"];
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

function asScore(value: unknown, max: number, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
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
    rankingMode: r.rankingMode === "none" ? "none" : (asRankingMode(r.rankingMode) ?? FFCSSettingsDefaults.rankingMode),
    defaultSortBy: SORT_BY.includes(r.defaultSortBy as SortBy)
      ? (r.defaultSortBy as SortBy)
      : FFCSSettingsDefaults.defaultSortBy,
    exportFormat: EXPORT_FORMATS.includes(r.exportFormat as ExportFormat)
      ? (r.exportFormat as ExportFormat)
      : FFCSSettingsDefaults.exportFormat,
    separateCourseListExport:
      typeof r.separateCourseListExport === "boolean"
        ? r.separateCourseListExport
        : FFCSSettingsDefaults.separateCourseListExport,
    rankingPriorityOrder: (() => {
      const allowed: readonly RankingPriority[] = ["profile", "faculty", "sort", "time"];
      const supplied = Array.isArray(r.rankingPriorityOrder) ? r.rankingPriorityOrder : [];
      const unique = supplied.filter(
        (value, index): value is RankingPriority =>
          allowed.includes(value as RankingPriority) && supplied.indexOf(value) === index,
      );
      return [...unique, ...allowed.filter((value) => !unique.includes(value))];
    })(),
    facultyMetricWeights: (() => {
      const rawWeights =
        r.facultyMetricWeights && typeof r.facultyMetricWeights === "object"
          ? (r.facultyMetricWeights as Record<string, unknown>)
          : {};
      return {
        wPct: asScore(rawWeights.wPct, 5, FFCSSettingsDefaults.facultyMetricWeights.wPct),
        lecture: asScore(rawWeights.lecture, 5, FFCSSettingsDefaults.facultyMetricWeights.lecture),
        da: asScore(rawWeights.da, 5, FFCSSettingsDefaults.facultyMetricWeights.da),
        vibe: asScore(rawWeights.vibe, 5, FFCSSettingsDefaults.facultyMetricWeights.vibe),
      };
    })(),
    facultyScoreFilters: (() => {
      const rawFilters =
        r.facultyScoreFilters && typeof r.facultyScoreFilters === "object"
          ? (r.facultyScoreFilters as Record<string, unknown>)
          : {};
      return {
        minWPct: asScore(rawFilters.minWPct, 100, FFCSSettingsDefaults.facultyScoreFilters.minWPct),
        minLecture: asScore(rawFilters.minLecture, 5, FFCSSettingsDefaults.facultyScoreFilters.minLecture),
        minDa: asScore(rawFilters.minDa, 5, FFCSSettingsDefaults.facultyScoreFilters.minDa),
        minVibe: asScore(rawFilters.minVibe, 5, FFCSSettingsDefaults.facultyScoreFilters.minVibe),
      };
    })(),
    minHalfDays: asInt(r.minHalfDays, 0, MAX_HALF_DAYS, FFCSSettingsDefaults.minHalfDays),
    resultCap: asInt(r.resultCap, MIN_RESULT_CAP, MAX_RESULT_CAP, FFCSSettingsDefaults.resultCap),
    removeHardResultLimit:
      typeof r.removeHardResultLimit === "boolean"
        ? r.removeHardResultLimit
        : FFCSSettingsDefaults.removeHardResultLimit,
    allSubjectsMode: typeof r.allSubjectsMode === "boolean" ? r.allSubjectsMode : FFCSSettingsDefaults.allSubjectsMode,
    showTour: typeof r.showTour === "boolean" ? r.showTour : FFCSSettingsDefaults.showTour,
    showVerticalTimetableBesideWidgets:
      typeof r.showVerticalTimetableBesideWidgets === "boolean"
        ? r.showVerticalTimetableBesideWidgets
        : FFCSSettingsDefaults.showVerticalTimetableBesideWidgets,
    showGeneratorOptionPane:
      typeof r.showGeneratorOptionPane === "boolean"
        ? r.showGeneratorOptionPane
        : FFCSSettingsDefaults.showGeneratorOptionPane,
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
