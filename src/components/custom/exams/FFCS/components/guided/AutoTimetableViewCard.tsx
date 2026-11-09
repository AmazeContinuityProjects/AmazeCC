"use client";

import type React from "react";
import type { TimetableState } from "@/lib/ffcsTypes";
import type { GuidedPhase } from "@/components/custom/exams/FFCS/components/FFCSGuidedSelector";
import { getTimetableSchema } from "@/lib/campusSchema";
import { timetableMetrics } from "@/lib/timetableMetrics";
import { DAYS } from "@/lib/ffcsConstants";
import { ensureLunchPeriod } from "@/lib/slots";
import { TimetablePeriod } from "@/lib/ffcsTypes";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Calendar } from "lucide-react";
import VerticalTimetableGrid from "@/components/custom/timetable/VerticalTimetableGrid";

/** Extracted from FFCSGuidedSelector's `renderAutoTimetableViewCard`; markup unchanged. */
export interface AutoTimetableViewCardProps {
  isLandscape?: boolean;
  autoResultsList: TimetableState[];
  selectedVariantIndex: number;
  setSelectedVariantIndex: (value: React.SetStateAction<number>) => void;
  setGuidedPhase: (value: React.SetStateAction<GuidedPhase>) => void;
  effectiveTimetables: TimetableState[];
  effectiveBlockedSlots: Set<string>;
}

export default function AutoTimetableViewCard({
  isLandscape = false,
  autoResultsList,
  selectedVariantIndex,
  setSelectedVariantIndex,
  setGuidedPhase,
  effectiveTimetables,
  effectiveBlockedSlots,
}: AutoTimetableViewCardProps) {
  const currentVariant = autoResultsList[selectedVariantIndex];
  if (!currentVariant) return null;

  const schema = getTimetableSchema();
  const metrics = timetableMetrics(currentVariant.courses, schema);
  const totalCredits = currentVariant.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const daysList = DAYS || [
    { id: "mon", name: "Monday" },
    { id: "tue", name: "Tuesday" },
    { id: "wed", name: "Wednesday" },
    { id: "thu", name: "Thursday" },
    { id: "fri", name: "Friday" },
  ];
  const theoryPeriods = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
  const labPeriods = ensureLunchPeriod(schema.lab as TimetablePeriod[]);

  return (
    <div
      className={`p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left flex flex-col justify-between ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[62vh] sm:h-[68vh] min-h-[480px] max-h-[720px]"
      }`}
    >
      {/* Header Strip with Variant Navigator & Switch back to List */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selectedVariantIndex <= 0}
            onClick={() => setSelectedVariantIndex((prev) => Math.max(0, prev - 1))}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-left">
            <span className="font-extrabold text-xs sm:text-sm text-white font-outfit block">
              Timetable {selectedVariantIndex + 1} of {autoResultsList.length}
            </span>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
              {selectedVariantIndex === 0 ? "★ Top Recommended" : "Generated Variant"}
            </span>
          </div>
          <button
            type="button"
            disabled={selectedVariantIndex >= autoResultsList.length - 1}
            onClick={() => setSelectedVariantIndex((prev) => Math.min(autoResultsList.length - 1, prev + 1))}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Metric Chips */}
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold">
            {metrics.halfDays} Free Half-Days
          </span>
          <span className="px-2 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] font-bold">
            {totalCredits} Credits
          </span>
          <button
            type="button"
            onClick={() => setGuidedPhase("auto_results")}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
            <span>List &amp; Faculty View</span>
          </button>
          <button
            type="button"
            onClick={() => setGuidedPhase("manual_timetable_view")}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>My Timetables ({effectiveTimetables.length})</span>
          </button>
        </div>
      </div>

      {/* Embedded Interactive Vertical Timetable Grid */}
      <div className="flex-1 min-h-[260px] overflow-auto rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-2 custom-scrollbar">
        <VerticalTimetableGrid
          courses={currentVariant.courses}
          theoryPeriods={theoryPeriods}
          labPeriods={labPeriods}
          days={daysList}
          blockedSlots={effectiveBlockedSlots}
          compact={true}
          showSlotNames={true}
        />
      </div>
    </div>
  );
}
