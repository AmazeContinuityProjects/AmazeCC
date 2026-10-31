"use client";

import React from "react";
import { Building2, Layers, Search, X } from "lucide-react";
import { ChipTabs } from "../../../shared/primitives";
import { DEFAULT_RESULT_FILTERS, filtersActive, type ResultFilters, type TheorySession } from "@/lib/ffcsResultFilters";

/**
 * The result-view filter bar — "N options" narrowed to the handful worth
 * looking at.
 *
 * Ported from FFCS-inator's result view (`codechefvit/ffcs` →
 * `ViewTimeTable.tsx`): session pills, Same Building, a faculty filter, and
 * group-by-slot, in that reading order — where the courses sit, when the day
 * starts, who teaches, and which layouts are distinct. Pure presentation:
 * the parent owns `ResultFilters` state and re-derives its list through
 * `applyResultFilters`, so this component never touches the results itself.
 *
 * Renders nothing when there is nothing to filter — a bar over zero options
 * is a row of controls that can only ever answer "none", and hiding it keeps
 * the empty state's single message the loudest thing on screen.
 */
export interface FFCSResultsFilterBarProps {
  filters: ResultFilters;
  onChange: (filters: ResultFilters) => void;
  /** How many plans the bar is working over (before its own cuts). */
  totalCount: number;
  /** How many survive the current filters. */
  visibleCount: number;
}

const SESSION_OPTIONS: readonly { value: TheorySession | "all"; label: string; title: string }[] = [
  { value: "all", label: "All", title: "Every generated plan" },
  { value: "morning", label: "Morning", title: "Theory before the lunch break" },
  { value: "evening", label: "Evening", title: "Theory after the lunch break" },
  { value: "mixed", label: "Mixed", title: "Theory on both sides of the lunch break" },
];

export default function FFCSResultsFilterBar({
  filters,
  onChange,
  totalCount,
  visibleCount,
}: FFCSResultsFilterBarProps) {
  if (totalCount === 0) return null;

  const active = filtersActive(filters);
  const cut = visibleCount < totalCount;

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-2xl border border-border-strong bg-surface-secondary/40 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <ChipTabs
          size="sm"
          options={SESSION_OPTIONS}
          value={filters.session}
          onChange={(session) => onChange({ ...filters, session })}
        />
        <button
          type="button"
          onClick={() => onChange({ ...filters, sameBuilding: !filters.sameBuilding })}
          aria-pressed={filters.sameBuilding}
          title="Only plans whose courses share one building"
          className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
            filters.sameBuilding
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
              : "bg-surface border-border-strong text-muted-foreground hover:text-text-heading"
          }`}
        >
          <Building2 className="w-3 h-3" /> Same Building
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...filters, groupBySlot: !filters.groupBySlot })}
          aria-pressed={filters.groupBySlot}
          title="One row per distinct slot layout"
          className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
            filters.groupBySlot
              ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
              : "bg-surface border-border-strong text-muted-foreground hover:text-text-heading"
          }`}
        >
          <Layers className="w-3 h-3" /> Group by slot
        </button>
        <label className="flex items-center gap-1.5 flex-1 min-w-[160px] max-w-xs ml-auto">
          <span className="sr-only">Filter by faculty or course code</span>
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={filters.facultyQuery}
            onChange={(event) => onChange({ ...filters, facultyQuery: event.target.value })}
            placeholder="Filter by faculty or code…"
            className="w-full min-w-0 h-8 pl-1 pr-2 rounded-lg bg-surface border border-border-strong text-xs text-text-heading placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {filters.facultyQuery && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, facultyQuery: "" })}
              aria-label="Clear faculty filter"
              className="p-1 rounded-md text-muted-foreground hover:text-text-heading transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className={cut ? "text-amber-500" : "text-muted-foreground"} aria-live="polite">
          {cut
            ? `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} plans match`
            : `${totalCount.toLocaleString()} plan${totalCount === 1 ? "" : "s"}`}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_RESULT_FILTERS })}
            className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
