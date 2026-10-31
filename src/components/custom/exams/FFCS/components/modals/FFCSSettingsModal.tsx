"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings2,
  Play,
  RotateCcw,
  Info,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Filter,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import SettingRow from "../../../../shared/primitives/SettingRow";
import Switch from "../../../../shared/primitives/Switch";
import { ChipTabs, SectionHeader, SegmentedControl, RadioGroup } from "../../../../shared/primitives";
import { isAnalyticsEnabled, setAnalyticsEnabled } from "@/lib/analytics";
import {
  FFCSSettingsDefaults,
  type DefaultRankingMode,
  type ExportFormat,
  type FFCSSettings,
} from "@/lib/ffcsSettings";
import type { SortBy } from "@/lib/timetableMetrics";
import type { RankingPriority } from "@/lib/ffcsSettings";
import { isTopOverlay, useOverlayBack } from "@/lib/overlayStack";
import { acquireBodyScrollLock } from "@/lib/bodyScrollLock";

/**
 * The planner's settings surface.
 *
 * ## One scroll, grouped, defaults in the open
 *
 * Every row lives in one of five labelled groups (Generation, Faculty filters,
 * Results & export, Courses & social, Help & privacy) instead of one
 * undifferentiated column of sixteen controls. Each settings-backed row also
 * states its default and, once the student has moved off it, offers a one-tap
 * way back — the old sheet made "what does this start as?" a guess and
 * "put it back" a trip through the global Reset, which throws away every other
 * change too. Two rows edit state the tab owns under its own storage keys
 * (batch grouping, social-score method); they carry their defaults the same
 * way. Analytics consent deliberately has none: it is a privacy choice with
 * its own key, and neither a reset nor a per-row restore may touch it.
 *
 * ## A pane on desktop, a sheet on phones
 *
 * On a ≥1024px viewport the settings dock to the right as a side pane — the
 * planner stays visible beside it, which is the point of changing a default
 * you are looking at. Phones keep the bottom sheet, which uses the whole
 * screen and drags away with a thumb. Only the chrome differs; the body is
 * shared, so the two cannot drift apart. jsdom reports no wide viewport, so
 * the test-visible surface is the sheet.
 *
 * ## Why it is rendered by the tab, not self-sufficient
 *
 * Two of its rows — batch grouping and the social-score method — edit state
 * the tab already owns under its own storage keys, because the tab's own
 * controls write those values live as well. Handing the surface the tab's
 * state and setter keeps one source of truth; a second copy in
 * `ffcs_settings` would drift the first time someone toggled the switch in
 * the grid instead of here. The rest of the rows come from `useFFCSSettings`,
 * also owned by the tab and passed down.
 *
 * ## Controls
 *
 * `ChipTabs`/`SegmentedControl` rather than `SelectField` everywhere: the
 * option picker's popup renders at z-70, below this surface's z-300 panel, so
 * a `<select>`-alike here would open *underneath* the sheet it belongs to.
 */

const RANKING_OPTIONS = [
  {
    value: "Best Faculty" as DefaultRankingMode,
    label: "Best Faculty",
    description: "Prioritizes Vitfac faculty review ratings and review coverage.",
  },
  {
    value: "none" as DefaultRankingMode,
    label: "None",
    description: "No profile — results are ordered purely by the sort order below.",
  },
  {
    value: "Balanced" as DefaultRankingMode,
    label: "Balanced",
    description: "Overall balance across gaps, early finishes, and daily workload.",
  },
  {
    value: "Half Days" as DefaultRankingMode,
    label: "Half Days",
    description: "Maximizes 4-hour compact days and whole mornings or afternoons off.",
  },
  {
    value: "Minimize Gaps" as DefaultRankingMode,
    label: "Minimize Gaps",
    description: "Minimizes dead waiting time between classes throughout the day.",
  },
  {
    value: "Early Finish" as DefaultRankingMode,
    label: "Early Finish",
    description: "Prioritizes classes that end earlier so your afternoons/evenings are free.",
  },
  {
    value: "Late Start" as DefaultRankingMode,
    label: "Late Start",
    description: "Prioritizes classes that start later in the morning.",
  },
];

const SORT_OPTIONS: readonly { value: SortBy; label: string; description: string }[] = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Best overall mix of free time, fewer gaps, and social score.",
  },
  {
    value: "social",
    label: "Social",
    description: "Maximizes shared course periods with friends in your group.",
  },
  {
    value: "halfdays",
    label: "Half-days",
    description: "Prioritizes schedules with the most full mornings or afternoons off.",
  },
  {
    value: "compactness",
    label: "Compact",
    description: "Minimizes idle gaps between classes throughout the day.",
  },
  {
    value: "faculty",
    label: "Faculty",
    description: "Prioritizes reviewed faculty scores and coverage.",
  },
];

const SOCIAL_METHOD_OPTIONS = [
  {
    value: "intersection" as const,
    label: "Intersection",
    description: "One combined week: the whole group's slots counted once together.",
  },
  {
    value: "cumulative" as const,
    label: "Cumulative",
    description: "Each friend scored on their own, then added together.",
  },
];

const HALF_DAY_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

const CAP_OPTIONS = [
  { value: "50", label: "50", title: "The planner's classic cap" },
  { value: "100", label: "100" },
  { value: "250", label: "250" },
  { value: "500", label: "500" },
];

const RANKING_PRIORITY_LABELS: Record<RankingPriority, string> = {
  profile: "Ranking profile",
  faculty: "Faculty reviews",
  sort: "Selected sort order",
  time: "Time preference",
};

/** Human-readable default per tab-owned row — outside `FFCSSettingsDefaults`. */
const TAB_ROW_DEFAULTS = {
  grouping: "On",
  socialMethod: "Intersection",
} as const;

function defaultLabel(key: keyof typeof FFCSSettingsDefaults): string {
  const value = FFCSSettingsDefaults[key];
  switch (key) {
    case "rankingMode":
      return RANKING_OPTIONS.find((o) => o.value === value)?.label ?? "None";
    case "defaultSortBy":
      return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Balanced";
    case "minHalfDays":
      return HALF_DAY_OPTIONS.find((o) => o.value === String(value))?.label ?? "Off";
    case "resultCap":
      return String(value);
    case "removeHardResultLimit":
    case "separateCourseListExport":
    case "showVerticalTimetableBesideWidgets":
      return "Off";
    case "showGeneratorOptionPane":
    case "showTour":
    case "allSubjectsMode":
      return "On";
    case "exportFormat":
      return value === "png" ? "PNG" : "JPG";
    case "rankingPriorityOrder":
      return "Profile, faculty, sort, time";
    case "facultyMetricWeights":
      return "W% 4 · Lecture 2 · DA 2 · Vibe 2";
    case "facultyScoreFilters":
      return "All off";
  }
}

/**
 * The "Default: …" line under a row, plus the way back once the value has
 * moved off it. The restore button is only rendered when there is something
 * to restore, so the sixteen-line default survey stays a line of text rather
 * than sixteen buttons. Its name says "Restore" rather than "Reset": the
 * footer's global Reset is the destructive one, and the two must not read as
 * the same action.
 */
function DefaultHint({
  label,
  changed,
  onRestore,
  restoreName,
}: {
  label: string;
  changed: boolean;
  onRestore: () => void;
  restoreName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-3 -mt-2">
      <span className="text-[11px] font-medium text-muted-foreground">Default: {label}</span>
      {changed ? (
        <button
          type="button"
          onClick={onRestore}
          aria-label={`Restore ${restoreName} default`}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 py-1 rounded cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" /> Restore
        </button>
      ) : null}
    </div>
  );
}

export interface FFCSSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FFCSSettings;
  update: <K extends keyof FFCSSettings>(key: K, value: FFCSSettings[K]) => void;
  reset: () => void;
  /** Tab-owned, same state the planner's own controls write. */
  isGroupingEnabled: boolean;
  setIsGroupingEnabled: (value: boolean) => void;
  socialScoreGroupMethod: "intersection" | "cumulative";
  setSocialScoreGroupMethod: (method: "intersection" | "cumulative") => void;
  /** Starts the tab's tour — the surface cannot reach the provider directly. */
  onReplayTour: () => void;
  /** Opens the layout mode selector popup (Guided vs Standard) */
  onOpenLayoutModal?: () => void;
}

/**
 * The docked desktop pane. Registers with the overlay stack and locks body
 * scroll exactly as the sheet does, so Escape and system back dismiss the top
 * surface and the planner behind cannot scroll — the two presentations are
 * interchangeable to everything except the eye.
 */
function SettingsPane({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useOverlayBack("ffcs-settings", true, onClose);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!isTopOverlay("ffcs-settings")) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => acquireBodyScrollLock(), []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-black/30 dark:bg-black/50"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Planner Settings"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        className="absolute inset-y-0 right-0 w-full max-w-[440px] bg-surface border-l border-border-strong shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Settings2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <h3 className="font-bold text-base text-text-heading truncate">Planner Settings</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </motion.aside>
    </div>,
    document.body,
  );
}

export function FFCSSettingsModal({
  isOpen,
  onClose,
  settings,
  update,
  reset,
  isGroupingEnabled,
  setIsGroupingEnabled,
  socialScoreGroupMethod,
  setSocialScoreGroupMethod,
  onReplayTour,
  onOpenLayoutModal,
}: FFCSSettingsModalProps) {
  // Consent is read live rather than held in `ffcs_settings`: it is a privacy
  // choice with its own key, and a settings reset must not flip it silently.
  const [analyticsOn, setAnalyticsOn] = useState(true);
  useEffect(() => {
    if (isOpen) setAnalyticsOn(isAnalyticsEnabled());
  }, [isOpen]);

  // Pane vs sheet. Read once, lazily, so the first paint is already the right
  // surface (no sheet flash on a wide screen), then kept current across the
  // breakpoint while the pane is open.
  const [isWideViewport, setIsWideViewport] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches === true,
  );
  useEffect(() => {
    if (!isOpen || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => setIsWideViewport(event.matches);
    setIsWideViewport(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [isOpen]);

  const replayTour = () => {
    onClose();
    onReplayTour();
  };

  const handleReset = () => {
    if (
      confirm(
        "Reset planner settings to defaults?\n\nYour timetables, friends and courses are not affected. Analytics consent is kept.",
      )
    ) {
      reset();
      setAnalyticsOn(isAnalyticsEnabled());
    }
  };

  /** Put one settings key back. Objects and arrays are copied: the defaults
      record is frozen, and a setter that stored it directly would hand the
      tab a shared mutable value. */
  const restoreSetting = <K extends keyof FFCSSettings>(key: K) => {
    const fallback = FFCSSettingsDefaults[key];
    const value = Array.isArray(fallback)
      ? ([...fallback] as FFCSSettings[K])
      : fallback && typeof fallback === "object"
        ? ({ ...fallback } as FFCSSettings[K])
        : fallback;
    update(key, value);
  };

  const isDefault = (key: keyof FFCSSettings) =>
    JSON.stringify(settings[key]) === JSON.stringify(FFCSSettingsDefaults[key]);

  const moveRankingPriority = (index: number, direction: -1 | 1) => {
    const next = [...settings.rankingPriorityOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("rankingPriorityOrder", next);
  };

  const updateFacultyWeight = (key: keyof FFCSSettings["facultyMetricWeights"], value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      update("facultyMetricWeights", {
        ...settings.facultyMetricWeights,
        [key]: Math.max(0, Math.min(5, parsed)),
      });
    }
  };

  const updateFacultyFilter = (key: keyof FFCSSettings["facultyScoreFilters"], value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const max = key === "minWPct" ? 100 : 5;
      update("facultyScoreFilters", {
        ...settings.facultyScoreFilters,
        [key]: Math.max(0, Math.min(max, parsed)),
      });
    }
  };

  const body = (
    <>
      <p className="text-xs text-muted-foreground mb-4">
        Defaults for new runs — everything stays editable where you use it, and everything stays on this device.
      </p>

      <div className="space-y-6">
        <section className="space-y-1">
          <SectionHeader icon={Wand2} title="Generation" className="mb-2" />
          <div className="divide-y divide-border/40 -mx-4 px-1">
            <div>
              <SettingRow
                stacked
                title="Ranking profile"
                description="New generator runs start ranked by this weighted profile."
                control={
                  <RadioGroup
                    name="rankingMode"
                    options={RANKING_OPTIONS}
                    value={settings.rankingMode}
                    onChange={(value) => update("rankingMode", value)}
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("rankingMode")}
                changed={!isDefault("rankingMode")}
                onRestore={() => restoreSetting("rankingMode")}
                restoreName="ranking profile"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Default sort order"
                description="How the generator orders results; it also breaks ties between ranked ones."
                control={
                  <RadioGroup
                    name="defaultSortBy"
                    options={SORT_OPTIONS}
                    value={settings.defaultSortBy}
                    onChange={(value) => update("defaultSortBy", value)}
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("defaultSortBy")}
                changed={!isDefault("defaultSortBy")}
                onRestore={() => restoreSetting("defaultSortBy")}
                restoreName="sort order"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Half-days floor"
                description="New runs start requiring at least this many half-days off."
                control={
                  <ChipTabs
                    options={HALF_DAY_OPTIONS}
                    value={String(settings.minHalfDays)}
                    onChange={(value) => update("minHalfDays", Number(value))}
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("minHalfDays")}
                changed={!isDefault("minHalfDays")}
                onRestore={() => restoreSetting("minHalfDays")}
                restoreName="half-days floor"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Result cap"
                description={
                  settings.resultCap === FFCSSettingsDefaults.resultCap
                    ? "How many weeks a search keeps — the planner's classic fifty."
                    : 'How many weeks a search keeps before the "unlimited" switch.'
                }
                control={
                  <ChipTabs
                    options={CAP_OPTIONS}
                    value={String(settings.resultCap)}
                    onChange={(value) => update("resultCap", Number(value))}
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("resultCap")}
                changed={!isDefault("resultCap")}
                onRestore={() => restoreSetting("resultCap")}
                restoreName="result cap"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="All Subjects Mode"
                description="On: only timetables containing every selected course count. Off: if the courses cannot all fit, the solver retries with the lowest-priority courses left out instead of finding nothing — the result says which ones were dropped."
                control={
                  <Switch
                    checked={settings.allSubjectsMode}
                    onCheckedChange={(checked) => update("allSubjectsMode", checked)}
                    label="All Subjects Mode"
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("allSubjectsMode")}
                changed={!isDefault("allSubjectsMode")}
                onRestore={() => restoreSetting("allSubjectsMode")}
                restoreName="all subjects mode"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Remove 30,000-result safety ceiling"
                description="When a generator run uses Unlimited, allow it to search beyond 30,000 results. This can consume substantial memory, freeze the page, or make the browser unstable. Keep this off unless you understand the risk."
                control={
                  <Switch
                    checked={settings.removeHardResultLimit}
                    onCheckedChange={(checked) => update("removeHardResultLimit", checked)}
                    label="Remove 30,000-result safety ceiling"
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("removeHardResultLimit")}
                changed={!isDefault("removeHardResultLimit")}
                onRestore={() => restoreSetting("removeHardResultLimit")}
                restoreName="safety ceiling"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Combined ranking priority"
                description="Higher items carry more weight in the final generated timetable list."
                control={
                  <div className="space-y-1.5">
                    {settings.rankingPriorityOrder.map((priority, index) => (
                      <div
                        key={priority}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface-secondary/40 px-3 py-1.5 text-xs"
                      >
                        <span className="font-medium text-text-heading">
                          {index + 1}. {RANKING_PRIORITY_LABELS[priority]}
                        </span>
                        <span className="flex">
                          <button
                            type="button"
                            aria-label={`Move ${RANKING_PRIORITY_LABELS[priority]} up`}
                            disabled={index === 0}
                            onClick={() => moveRankingPriority(index, -1)}
                            className="rounded p-1 text-muted-foreground hover:text-text-heading disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${RANKING_PRIORITY_LABELS[priority]} down`}
                            disabled={index === settings.rankingPriorityOrder.length - 1}
                            onClick={() => moveRankingPriority(index, 1)}
                            className="rounded p-1 text-muted-foreground hover:text-text-heading disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                }
              />
              <DefaultHint
                label={defaultLabel("rankingPriorityOrder")}
                changed={!isDefault("rankingPriorityOrder")}
                onRestore={() => restoreSetting("rankingPriorityOrder")}
                restoreName="ranking priority"
              />
            </div>
          </div>
        </section>

        <section className="space-y-1">
          <SectionHeader icon={Filter} title="Faculty filters" className="mb-2" />
          <div className="divide-y divide-border/40 -mx-4 px-1">
            <div>
              <SettingRow
                stacked
                title="Faculty score priorities"
                description="Relative weight for the overall Vitfac score and its individual review metrics; 0 ignores a score."
                control={
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["wPct", "Overall W %", 5],
                        ["lecture", "Lecture", 5],
                        ["da", "DA", 5],
                        ["vibe", "Vibe", 5],
                      ] as const
                    ).map(([key, label, max]) => (
                      <label key={key} className="flex items-center justify-between gap-2 text-xs">
                        <span>{label}</span>
                        <input
                          aria-label={`${label} importance`}
                          type="number"
                          min={0}
                          max={max}
                          step={1}
                          value={settings.facultyMetricWeights[key]}
                          onChange={(event) => updateFacultyWeight(key, event.target.value)}
                          className="w-16 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-text-heading"
                        />
                      </label>
                    ))}
                  </div>
                }
              />
              <DefaultHint
                label={defaultLabel("facultyMetricWeights")}
                changed={!isDefault("facultyMetricWeights")}
                onRestore={() => restoreSetting("facultyMetricWeights")}
                restoreName="faculty score priorities"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Minimum faculty review scores"
                description="Exclude reviewed faculty below these thresholds. Set a value to 0 to disable that filter."
                control={
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["minWPct", "Overall W %", 100, 5],
                        ["minLecture", "Lecture / 5", 5, 0.5],
                        ["minDa", "DA / 5", 5, 0.5],
                        ["minVibe", "Vibe / 5", 5, 0.5],
                      ] as const
                    ).map(([key, label, max, step]) => (
                      <label key={key} className="flex items-center justify-between gap-2 text-xs">
                        <span>{label}</span>
                        <input
                          aria-label={`Minimum ${label}`}
                          type="number"
                          min={0}
                          max={max}
                          step={step}
                          value={settings.facultyScoreFilters[key]}
                          onChange={(event) => updateFacultyFilter(key, event.target.value)}
                          className="w-16 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-text-heading"
                        />
                      </label>
                    ))}
                  </div>
                }
              />
              <DefaultHint
                label={defaultLabel("facultyScoreFilters")}
                changed={!isDefault("facultyScoreFilters")}
                onRestore={() => restoreSetting("facultyScoreFilters")}
                restoreName="minimum review scores"
              />
            </div>
          </div>
        </section>

        <section className="space-y-1">
          <SectionHeader icon={ImageIcon} title="Results & export" className="mb-2" />
          <div className="divide-y divide-border/40 -mx-4 px-1">
            <div>
              <SettingRow
                title="Image format"
                description="Format of the timetable image download."
                control={
                  <SegmentedControl
                    options={[
                      { value: "jpg" as ExportFormat, label: "JPG" },
                      { value: "png" as ExportFormat, label: "PNG" },
                    ]}
                    value={settings.exportFormat}
                    onChange={(value) => update("exportFormat", value)}
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("exportFormat")}
                changed={!isDefault("exportFormat")}
                onRestore={() => restoreSetting("exportFormat")}
                restoreName="image format"
              />
            </div>
            <div>
              <SettingRow
                title="Separate course-list image"
                description="Download the timetable and selected courses as two separate images."
                control={
                  <Switch
                    checked={settings.separateCourseListExport}
                    onCheckedChange={(checked) => update("separateCourseListExport", checked)}
                    label="Separate course-list image"
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("separateCourseListExport")}
                changed={!isDefault("separateCourseListExport")}
                onRestore={() => restoreSetting("separateCourseListExport")}
                restoreName="separate course-list image"
              />
            </div>
            <div className="hidden xl:block">
              <SettingRow
                title="Vertical timetable beside widgets"
                description="On extra-wide screens, use one widget column and place the vertical timetable on the right."
                control={
                  <Switch
                    checked={settings.showVerticalTimetableBesideWidgets}
                    onCheckedChange={(checked) => update("showVerticalTimetableBesideWidgets", checked)}
                    label="Vertical timetable beside widgets"
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("showVerticalTimetableBesideWidgets")}
                changed={!isDefault("showVerticalTimetableBesideWidgets")}
                onRestore={() => restoreSetting("showVerticalTimetableBesideWidgets")}
                restoreName="vertical timetable layout"
              />
            </div>
            <div>
              <SettingRow
                title="Generator timetable options pane"
                description="Show the desktop side pane for switching between generated timetable options while reviewing."
                control={
                  <Switch
                    checked={settings.showGeneratorOptionPane}
                    onCheckedChange={(checked) => update("showGeneratorOptionPane", checked)}
                    label="Generator timetable options pane"
                  />
                }
              />
              <DefaultHint
                label={defaultLabel("showGeneratorOptionPane")}
                changed={!isDefault("showGeneratorOptionPane")}
                onRestore={() => restoreSetting("showGeneratorOptionPane")}
                restoreName="generator options pane"
              />
            </div>
          </div>
        </section>

        <section className="space-y-1">
          <SectionHeader icon={Users} title="Courses & social" className="mb-2" />
          <div className="divide-y divide-border/40 -mx-4 px-1">
            <div>
              <SettingRow
                title="Group by batch"
                description="Pair each theory course with its lab in the course report."
                control={<Switch checked={isGroupingEnabled} onCheckedChange={setIsGroupingEnabled} />}
              />
              <DefaultHint
                label={TAB_ROW_DEFAULTS.grouping}
                changed={isGroupingEnabled !== true}
                onRestore={() => setIsGroupingEnabled(true)}
                restoreName="group by batch"
              />
            </div>
            <div>
              <SettingRow
                stacked
                title="Group social score"
                description="How a friend group's score is combined across friends."
                control={
                  <RadioGroup
                    name="socialScoreGroupMethod"
                    options={SOCIAL_METHOD_OPTIONS}
                    value={socialScoreGroupMethod}
                    onChange={setSocialScoreGroupMethod}
                  />
                }
              />
              <DefaultHint
                label={TAB_ROW_DEFAULTS.socialMethod}
                changed={socialScoreGroupMethod !== "intersection"}
                onRestore={() => setSocialScoreGroupMethod("intersection")}
                restoreName="group social score"
              />
            </div>
          </div>
        </section>

        <section className="space-y-1">
          <SectionHeader icon={ShieldCheck} title="Help & privacy" className="mb-2" />
          <div className="divide-y divide-border/40 -mx-4 px-1">
            {/* Desktop-only: the tour never runs on phones, so neither the
                replay nor the offer switch has anything to act on. */}
            <div className="hidden sm:block">
              <SettingRow
                title="Guided tour"
                description="Offer the tour when you open the planner."
                control={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={replayTour}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Replay
                    </button>
                    <Switch checked={settings.showTour} onCheckedChange={(checked) => update("showTour", checked)} />
                  </div>
                }
              />
              <DefaultHint
                label={defaultLabel("showTour")}
                changed={!isDefault("showTour")}
                onRestore={() => restoreSetting("showTour")}
                restoreName="guided tour"
              />
            </div>
            {onOpenLayoutModal && (
              <SettingRow
                title="Planner layout experience"
                description="Choose between Guided Hero Mode and Standard Single Page View."
                control={
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLayoutModal();
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Choose mode</span>
                  </button>
                }
              />
            )}
            {/* No default hint on analytics on purpose: consent is the
                student's standing choice, not a preference with a factory
                value, and nothing here may reset it. */}
            <SettingRow
              title="Usage analytics"
              description="Share anonymous counts — which features run, never your courses or timetable."
              control={
                <Switch
                  checked={analyticsOn}
                  onCheckedChange={(checked) => {
                    setAnalyticsEnabled(checked);
                    setAnalyticsOn(checked);
                  }}
                />
              }
            />
          </div>
        </section>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed flex-1">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Timetables, friends and settings never leave this browser.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {isOpen &&
        (isWideViewport ? (
          <SettingsPane key="pane" onClose={onClose}>
            {body}
          </SettingsPane>
        ) : (
          <BottomSheet
            key="sheet"
            onClose={onClose}
            overlayId="ffcs-settings"
            maxWidth="max-w-lg"
            panelZIndex={300}
            backdropZIndex={295}
            contentClassName="flex flex-col"
          >
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-base text-text-heading">Planner Settings</h3>
            </div>
            {body}
          </BottomSheet>
        ))}
    </AnimatePresence>
  );
}
