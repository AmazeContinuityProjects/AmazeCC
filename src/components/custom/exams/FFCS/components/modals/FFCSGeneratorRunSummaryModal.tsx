"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  SlidersHorizontal,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import { ListRowText, ListShell } from "../../../../shared/primitives";

export interface RunSummaryCourse {
  code: string;
  title: string;
  /** Offerings the student explicitly picked; 0 means "any faculty/slot". */
  offeringCount: number;
}

export interface FFCSGeneratorRunSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Starts the search. The modal closes itself before calling this. */
  onConfirm: () => void;
  isGenerating: boolean;
  courses: RunSummaryCourse[];
  blockedSlotCount: number;
  noResultCap: boolean;
  resultCap: number;
  preference: string;
  rankingLabel: string;
  friendsSelected: number;
  syncFriendsClasses: boolean;
}

/**
 * The last look before the search runs.
 *
 * Generation is expensive and its inputs are spread across five sections of
 * the form, so this sheet gathers the whole run profile — courses, slots,
 * ranking, social picks — onto one page with the button that starts it. Both
 * "Generate" entry points open this instead of running blind.
 */
export default function FFCSGeneratorRunSummaryModal({
  isOpen,
  onClose,
  onConfirm,
  isGenerating,
  courses,
  blockedSlotCount,
  noResultCap,
  resultCap,
  preference,
  rankingLabel,
  friendsSelected,
  syncFriendsClasses,
}: FFCSGeneratorRunSummaryModalProps) {
  if (!isOpen) return null;

  const canRun = courses.length > 0 && !isGenerating;

  const handleConfirm = () => {
    if (!canRun) return;
    onClose();
    onConfirm();
  };

  const profileRows: Array<{ label: string; value: string }> = [
    { label: "Search cap", value: noResultCap ? "No cap" : resultCap.toLocaleString() },
    { label: "Time preference", value: preference },
    { label: "Ranking", value: rankingLabel },
    {
      label: "Social matching",
      value: `${friendsSelected} friend${friendsSelected === 1 ? "" : "s"}${
        syncFriendsClasses ? " · auto-sync on" : ""
      }`,
    },
    {
      label: "Blocked slots",
      value: `${blockedSlotCount} blocked`,
    },
  ];

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-generator-run-summary"
      maxWidth="max-w-2xl"
      panelZIndex={350}
      backdropZIndex={345}
      contentClassName="space-y-5"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border-strong/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
            <Wand2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-text-heading tracking-tight leading-tight">
              Ready to search?
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              One last look at what the generator will work with.
            </p>
          </div>
        </div>
      </div>

      {/* Readiness banner */}
      <div
        className={`rounded-xl border px-3.5 py-3 flex items-start gap-2.5 ${
          courses.length > 0
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}
      >
        {courses.length > 0 ? (
          <Check className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={3} />
        ) : (
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {courses.length > 0 ? "Ready to search" : "Choose courses first"}
          </p>
          <p className="text-xs mt-0.5 opacity-80">
            {courses.length > 0
              ? `${courses.length} target course${courses.length === 1 ? "" : "s"} · ${blockedSlotCount} blocked slot${blockedSlotCount === 1 ? "" : "s"}`
              : "Pick at least one target course to enable generation."}
          </p>
        </div>
      </div>

      {/* Selected courses */}
      <section aria-label="Selected courses" className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Selected courses
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground/70">({courses.length})</span>
        </div>
        {courses.length > 0 ? (
          <ListShell>
            {courses.map((course) => (
              <div key={course.code} className="w-full flex items-center gap-3 px-3 py-2.5">
                <span className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                  {course.code.slice(0, 2)}
                </span>
                <ListRowText
                  title={course.code}
                  titleTag="span"
                  subtitle={
                    course.offeringCount > 0
                      ? `${course.title} · ${course.offeringCount} offering${course.offeringCount === 1 ? "" : "s"} locked`
                      : `${course.title} · any faculty/slot`
                  }
                  wrapSubtitle
                />
              </div>
            ))}
          </ListShell>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            Your course choices will appear here.
          </p>
        )}
      </section>

      {/* Search profile */}
      <section aria-label="Search profile" className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Search profile
          </h3>
        </div>
        <ListShell>
          {profileRows.map((row) => (
            <div key={row.label} className="w-full flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className="text-xs font-semibold text-text-heading capitalize truncate">
                {row.value}
              </span>
            </div>
          ))}
        </ListShell>
      </section>

      {/* Footer actions */}
      <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 border-t border-border-strong/50">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="w-3 h-3 shrink-0" />
          You can adjust everything after the results too.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/80 border border-border-strong/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canRun}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black font-outfit text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {isGenerating ? "Searching…" : "Generate timetables"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
