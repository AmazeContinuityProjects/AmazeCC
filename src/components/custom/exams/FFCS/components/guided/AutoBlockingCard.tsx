"use client";

import type React from "react";
import { DAYS } from "@/lib/ffcsConstants";
import { getTimetableSchema } from "@/lib/campusSchema";
import { ensureLunchPeriod } from "@/lib/slots";
import { TimetablePeriod } from "@/lib/ffcsTypes";
import { RotateCcw } from "lucide-react";
import VerticalTimetableGrid from "@/components/custom/timetable/VerticalTimetableGrid";

/** Extracted from FFCSGuidedSelector's `renderAutoBlockingCard`; markup unchanged. */
export interface AutoBlockingCardProps {
  isLandscape?: boolean;
  getDaySlots: (dayId: string) => {
    morningTheory: string[];
    eveningTheory: string[];
    morningLab: string[];
    eveningLab: string[];
    morningAll: string[];
    eveningAll: string[];
    dayTheory: string[];
    dayLab: string[];
    morning: string[];
    evening: string[];
    all: string[];
  };
  blockingActiveDay: string;
  effectiveBlockedSlots: Set<string>;
  handleClearAllBlocks: () => void;
  setBlockingActiveDay: (value: React.SetStateAction<string>) => void;
  handleToggleDayBlock: (
    dayId: string,
    type:
      | "morning"
      | "evening"
      | "all"
      | "morning_theory"
      | "morning_lab"
      | "morning_all"
      | "evening_theory"
      | "evening_lab"
      | "evening_all"
      | "day_theory"
      | "day_lab",
  ) => void;
  handleClearDayBlocks: (dayId: string) => void;
  handleToggleBlockSlot: (slot: string) => void;
}

export default function AutoBlockingCard({
  isLandscape = false,
  getDaySlots,
  blockingActiveDay,
  effectiveBlockedSlots,
  handleClearAllBlocks,
  setBlockingActiveDay,
  handleToggleDayBlock,
  handleClearDayBlocks,
  handleToggleBlockSlot,
}: AutoBlockingCardProps) {
  const daysList = DAYS || [
    { id: "mon", name: "Monday" },
    { id: "tue", name: "Tuesday" },
    { id: "wed", name: "Wednesday" },
    { id: "thu", name: "Thursday" },
    { id: "fri", name: "Friday" },
  ];

  const currentDayData = getDaySlots(blockingActiveDay);
  const morningTheoryBlocked =
    currentDayData.morningTheory.length > 0 && currentDayData.morningTheory.every((s) => effectiveBlockedSlots.has(s));
  const morningLabBlocked =
    currentDayData.morningLab.length > 0 && currentDayData.morningLab.every((s) => effectiveBlockedSlots.has(s));
  const eveningTheoryBlocked =
    currentDayData.eveningTheory.length > 0 && currentDayData.eveningTheory.every((s) => effectiveBlockedSlots.has(s));
  const eveningLabBlocked =
    currentDayData.eveningLab.length > 0 && currentDayData.eveningLab.every((s) => effectiveBlockedSlots.has(s));
  const dayAllBlocked = currentDayData.all.length > 0 && currentDayData.all.every((s) => effectiveBlockedSlots.has(s));

  const schema = getTimetableSchema();
  const theoryPeriods = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
  const labPeriods = ensureLunchPeriod(schema.lab as TimetablePeriod[]);

  return (
    <div
      className={`p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left flex flex-col justify-between ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[480px] max-h-[700px]"
      }`}
    >
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">
              4. Slot &amp; Day Blocking
            </h3>
            <p className="text-xs text-zinc-400">
              Rule out whole days or specific periods. Tap any slot in the vertical timetable below to block theory or
              lab independently.
            </p>
          </div>
          {effectiveBlockedSlots.size > 0 && (
            <button
              type="button"
              onClick={handleClearAllBlocks}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All ({effectiveBlockedSlots.size})</span>
            </button>
          )}
        </div>

        {/* Day Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {daysList.map((d) => {
            const isSelected = blockingActiveDay === d.id;
            const dayData = getDaySlots(d.id);
            const blockedInDay = dayData.all.filter((s) => effectiveBlockedSlots.has(s)).length;

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setBlockingActiveDay(d.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400"
                    : "bg-zinc-950/60 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
                }`}
              >
                <span>{d.name}</span>
                {blockedInDay > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-rose-500/30 text-rose-300 text-[10px] font-mono">
                    {blockedInDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Per-Day Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleToggleDayBlock(blockingActiveDay, "morning_theory")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              morningTheoryBlocked
                ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {morningTheoryBlocked ? "Unblock Morning Theory ✓" : "Block Morning Theory (08:00 - 13:25)"}
          </button>

          <button
            type="button"
            onClick={() => handleToggleDayBlock(blockingActiveDay, "morning_lab")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              morningLabBlocked
                ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {morningLabBlocked ? "Unblock Morning Lab ✓" : "Block Morning Lab (08:00 - 13:20)"}
          </button>

          <button
            type="button"
            onClick={() => handleToggleDayBlock(blockingActiveDay, "evening_theory")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              eveningTheoryBlocked
                ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {eveningTheoryBlocked ? "Unblock Afternoon Theory ✓" : "Block Afternoon Theory (14:00 - 19:30)"}
          </button>

          <button
            type="button"
            onClick={() => handleToggleDayBlock(blockingActiveDay, "evening_lab")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              eveningLabBlocked
                ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {eveningLabBlocked ? "Unblock Afternoon Lab ✓" : "Block Afternoon Lab (14:00 - 19:30)"}
          </button>

          <button
            type="button"
            onClick={() => handleToggleDayBlock(blockingActiveDay, "all")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              dayAllBlocked
                ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {dayAllBlocked ? "Unblock Full Day ✓" : "Block Entire Day"}
          </button>

          <button
            type="button"
            onClick={() => handleClearDayBlocks(blockingActiveDay)}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            Reset Day
          </button>
        </div>
      </div>

      {/* Visual Interactive Vertical Timetable */}
      <div className="flex-1 min-h-[220px] max-h-[360px] overflow-auto rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-2 custom-scrollbar">
        <div className="text-[10px] text-zinc-500 font-bold mb-1.5 px-1 flex items-center justify-between">
          <span>INTERACTIVE VERTICAL TIMETABLE — TAP ANY CELL TO TOGGLE BLOCK</span>
          <span className="text-rose-400 font-mono">{effectiveBlockedSlots.size} slots blocked</span>
        </div>
        <VerticalTimetableGrid
          courses={[]}
          theoryPeriods={theoryPeriods}
          labPeriods={labPeriods}
          days={daysList}
          blockedSlots={effectiveBlockedSlots}
          onToggleBlockSlot={handleToggleBlockSlot}
          compact={true}
          showSlotNames={true}
        />
      </div>
    </div>
  );
}
