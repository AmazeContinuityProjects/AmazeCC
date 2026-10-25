"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Settings2, Play, RotateCcw, Info, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import SettingRow from "../../../../shared/primitives/SettingRow";
import Switch from "../../../../shared/primitives/Switch";
import { ChipTabs, SegmentedControl, RadioGroup } from "../../../../shared/primitives";
import { isAnalyticsEnabled, setAnalyticsEnabled } from "@/lib/analytics";
import {
  FFCSSettingsDefaults,
  type DefaultRankingMode,
  type ExportFormat,
  type FFCSSettings,
} from "@/lib/ffcsSettings";
import { RANKING_MODES } from "@/lib/ffcsRanking";
import type { SortBy } from "@/lib/timetableMetrics";
import type { RankingPriority } from "@/lib/ffcsSettings";

/**
 * The planner's settings sheet.
 *
 * ## Why it is rendered by the tab, not self-sufficient
 *
 * Two of its rows — batch grouping and the social-score method — edit state
 * the tab already owns under its own storage keys, because the tab's own
 * controls write those values live as well. Handing the sheet the tab's
 * state and setter keeps one source of truth; a second copy in
 * `ffcs_settings` would drift the first time someone toggled the switch in
 * the grid instead of here. The rest of the rows come from `useFFCSSettings`,
 * also owned by the tab and passed down.
 *
 * ## Controls
 *
 * `ChipTabs`/`SegmentedControl` rather than `SelectField` everywhere: the
 * option picker's popup renders at z-70, below this sheet's z-300 panel, so
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
  /** Starts the tab's tour — the sheet cannot reach the provider directly. */
  onReplayTour: () => void;
  /** Opens the layout mode selector popup (Guided vs Standard) */
  onOpenLayoutModal?: () => void;
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

  const replayTour = () => {
    onClose();
    onReplayTour();
  };

  const handleReset = () => {
    if (
      confirm(
        "Reset planner settings to defaults?\n\nYour timetables, friends and courses are not affected. Analytics consent is kept."
      )
    ) {
      reset();
      setAnalyticsOn(isAnalyticsEnabled());
    }
  };

  const moveRankingPriority = (index: number, direction: -1 | 1) => {
    const next = [...settings.rankingPriorityOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("rankingPriorityOrder", next);
  };

  const updateFacultyWeight = (
    key: keyof FFCSSettings["facultyMetricWeights"],
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      update("facultyMetricWeights", {
        ...settings.facultyMetricWeights,
        [key]: Math.max(0, Math.min(5, parsed)),
      });
    }
  };

  const updateFacultyFilter = (
    key: keyof FFCSSettings["facultyScoreFilters"],
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const max = key === "minWPct" ? 100 : 5;
      update("facultyScoreFilters", {
        ...settings.facultyScoreFilters,
        [key]: Math.max(0, Math.min(max, parsed)),
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
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
          <p className="text-xs text-muted-foreground mb-3">
            Defaults for new runs — everything stays editable where you use it, and everything
            stays on this device.
          </p>

          <div className="divide-y divide-border/40 -mx-4 px-1">
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
            <SettingRow
              stacked
              title="Result cap"
              description={
                settings.resultCap === FFCSSettingsDefaults.resultCap
                  ? "How many weeks a search keeps — the planner's classic fifty."
                  : "How many weeks a search keeps before the \"unlimited\" switch."
              }
              control={
                <ChipTabs
                  options={CAP_OPTIONS}
                  value={String(settings.resultCap)}
                  onChange={(value) => update("resultCap", Number(value))}
                />
              }
            />
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
            <div className="hidden xl:block">
              <SettingRow
                title="Vertical timetable beside widgets"
                description="On extra-wide screens, use one widget column and place the vertical timetable on the right."
                control={
                  <Switch
                    checked={settings.showVerticalTimetableBesideWidgets}
                    onCheckedChange={(checked) =>
                      update("showVerticalTimetableBesideWidgets", checked)
                    }
                    label="Vertical timetable beside widgets"
                  />
                }
              />
            </div>
            <SettingRow
              title="Group by batch"
              description="Pair each theory course with its lab in the course report."
              control={
                <Switch checked={isGroupingEnabled} onCheckedChange={setIsGroupingEnabled} />
              }
            />
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
                    <Switch
                      checked={settings.showTour}
                      onCheckedChange={(checked) => update("showTour", checked)}
                    />
                  </div>
                }
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

          <div className="mt-4 flex items-center justify-between gap-3">
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
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
