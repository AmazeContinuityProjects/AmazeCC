"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, GraduationCap, Layers, RefreshCw } from "lucide-react";
import Switch from "../../../shared/primitives/Switch";
import { catalogSlotChips, type CatalogCurriculum, type CatalogSlotIndex } from "@/lib/ffcsCatalogFilters";

/**
 * The shared filter row above both course pickers: the Search Course sheet
 * and the Target Courses modal.
 *
 * Two filters, one row each. Slot chips are collapsed by default — the chip
 * wall is ~80 tokens tall and the common case is no slot filter at all — but
 * the toggle carries the active count so a collapsed filter stays visible.
 * The My Curriculum switch only exists when a curriculum index exists (the
 * hook hands null to logged-out students), and turning it on reveals the
 * category chips: empty selection means every category, so "All" is a real
 * chip rather than the absence of one. While the index is still null the
 * row's right side is instead a sync button — the payload comes from VTOP,
 * and a student who never opened Academics → Curriculum has to be able to
 * fetch it from right here.
 *
 * Pure presentation — selection state lives in the host, which is also what
 * filters the list beside this component.
 */
export interface CourseCatalogFiltersProps {
  slotIndex: CatalogSlotIndex;
  slots: string[];
  onSlotsChange: (next: string[]) => void;
  curriculum: CatalogCurriculum | null;
  curriculumOnly: boolean;
  onCurriculumOnlyChange: (next: boolean) => void;
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
  /**
   * Fetch the student's missing curriculum. Hosts pass it only when logged
   * in; the button itself renders only while `curriculum` is null — once the
   * payload exists the switch it would sit beside says more than it can.
   */
  onSyncCurriculum?: () => void;
  /** That explicit sync is running: the button spins and stays disabled. */
  curriculumSyncing?: boolean;
}

const CHIP_BASE = "text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer";

const chipClass = (active: boolean, activeClass: string): string =>
  active
    ? `${CHIP_BASE} ${activeClass}`
    : `${CHIP_BASE} bg-surface border-border-strong text-muted-foreground hover:text-text-heading`;

export function CourseCatalogFilters({
  slotIndex,
  slots,
  onSlotsChange,
  curriculum,
  curriculumOnly,
  onCurriculumOnlyChange,
  categories,
  onCategoriesChange,
  onSyncCurriculum,
  curriculumSyncing = false,
}: CourseCatalogFiltersProps) {
  const [slotsOpen, setSlotsOpen] = useState(false);
  const chips = useMemo(() => catalogSlotChips(slotIndex), [slotIndex]);
  const hasSlotChips = chips.theory.length + chips.lab.length > 0;

  const toggleSlot = (token: string) =>
    onSlotsChange(slots.includes(token) ? slots.filter((slot) => slot !== token) : [...slots, token]);

  const toggleCategory = (name: string) =>
    onCategoriesChange(categories.includes(name) ? categories.filter((c) => c !== name) : [...categories, name]);

  const slotChip = (token: string) => (
    <button
      key={token}
      type="button"
      aria-pressed={slots.includes(token)}
      onClick={() => toggleSlot(token)}
      title={`Courses running in ${token}`}
      className={chipClass(slots.includes(token), "bg-indigo-500/15 border-indigo-500/40 text-indigo-500")}
    >
      {token}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={slotsOpen}
          onClick={() => setSlotsOpen((open) => !open)}
          className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
            slots.length > 0
              ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-500"
              : "bg-surface border-border-strong text-muted-foreground hover:text-text-heading"
          }`}
        >
          <Layers className="w-3 h-3" />
          {slots.length > 0 ? `Slots · ${slots.length}` : "Filter by slot"}
          <ChevronDown className={`w-3 h-3 transition-transform ${slotsOpen ? "rotate-180" : ""}`} />
        </button>
        {slots.length > 0 && (
          <button
            type="button"
            onClick={() => onSlotsChange([])}
            className="text-[10px] font-bold text-indigo-500 hover:underline cursor-pointer"
          >
            Clear slots
          </button>
        )}

        {!curriculum && onSyncCurriculum && (
          <button
            type="button"
            onClick={onSyncCurriculum}
            disabled={curriculumSyncing}
            className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 disabled:opacity-60 cursor-pointer disabled:cursor-wait"
          >
            <RefreshCw className={`w-3 h-3 ${curriculumSyncing ? "animate-spin" : ""}`} />
            {curriculumSyncing ? "Syncing…" : "Sync curriculum"}
          </button>
        )}

        {curriculum && (
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground">My Curriculum</span>
            <Switch
              checked={curriculumOnly}
              onCheckedChange={onCurriculumOnlyChange}
              size="md"
              label="Only show courses from my curriculum"
            />
          </label>
        )}
      </div>

      {slotsOpen && (
        <div className="max-h-40 overflow-y-auto custom-scrollbar rounded-xl border border-border-strong bg-surface-secondary/40 p-2.5 flex flex-col gap-2">
          {hasSlotChips ? (
            <>
              {chips.theory.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Theory</span>
                  <div className="flex flex-wrap gap-1.5">{chips.theory.map(slotChip)}</div>
                </div>
              )}
              {chips.lab.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lab</span>
                  <div className="flex flex-wrap gap-1.5">{chips.lab.map(slotChip)}</div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No slots in the loaded course list yet.</p>
          )}
        </div>
      )}

      {curriculum && curriculumOnly && curriculum.categories.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mr-1">
            Category
          </span>
          <button
            type="button"
            aria-pressed={categories.length === 0}
            onClick={() => onCategoriesChange([])}
            className={chipClass(
              categories.length === 0,
              "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
            )}
          >
            All
          </button>
          {curriculum.categories.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={categories.includes(name)}
              onClick={() => toggleCategory(name)}
              title={`Only ${name} courses`}
              className={chipClass(
                categories.includes(name),
                "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
