"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { type AddedCourse, type GapDetail, type TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import type { NormalizedCourse } from "@/types/course";
import { cn } from "@/lib/utils";
import { COLOR_HEX_MAP } from "@/lib/ffcsConstants";
import { ensureLunchPeriod, expandSlotSpellings, hasSlot, ownSlotSpelling, timeToMinutes } from "@/lib/slots";
import { clickable } from "@/lib/a11y";
import { DAY_LABELS, DAY_ORDER } from "@/lib/generated/timetable";
import type { Cell } from "@/lib/buildBands";
import SlotDetailSheet, { type AttendanceTone } from "./SlotDetailSheet";

/** The teaching week's day scaffolding, from the generated unified timetable. */
const DEFAULT_DAYS: { id: string; name: string }[] = DAY_ORDER.slice(0, 5).map((id) => ({
  id: id.toLowerCase(),
  name: DAY_LABELS[id],
}));

export interface ModernHorizontalTimetableGridProps {
  courses: (AddedCourse | NormalizedCourse | any)[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  /** Attendance figures for the tapped cell's sheet; read-only surfaces pass them in. */
  attendanceByCourse?: Record<string, AttendanceTone>;
  title?: string;
  showLegend?: boolean;
  className?: string;
}

export default function ModernHorizontalTimetableGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days = DEFAULT_DAYS,
  blockedSlots,
  onToggleBlockSlot,
  selectedGapDetails,
  attendanceByCourse,
  title = "Unified Schedule",
  showLegend = true,
  className,
}: ModernHorizontalTimetableGridProps) {
  /**
   * A tapped course tile opens the same `SlotDetailSheet` the vertical grid
   * uses. The old cell carried a 220px hover-tooltip wall that a touch device
   * never saw; a native `title` is enough on desktop, and the tap is the real
   * drill-down. In the planner `onToggleBlockSlot` is supplied, so a tap keeps
   * its original "rule this slot out" meaning instead.
   */
  const [activeCell, setActiveCell] = useState<{ cell: Cell; dayName: string } | null>(null);

  const effectiveTheory = ensureLunchPeriod(theoryPeriods);
  const effectiveLab = ensureLunchPeriod(labPeriods);
  const numPeriods = Math.max(effectiveTheory.length, effectiveLab.length);
  const expandedBlocked = blockedSlots ? expandSlotSpellings(blockedSlots) : null;
  const lunchIdx = effectiveTheory.findIndex((p) => p?.lunch);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0c1222] shadow-2xs overflow-hidden mb-6 transition-colors",
        className,
      )}
    >
      {/* Header bar */}
      {(title || showLegend) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/90 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-white/10">
          {title ? (
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              {title}
            </h3>
          ) : (
            <div />
          )}

          {showLegend && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-blue-500/15 dark:bg-blue-500/20 border border-blue-500/40 dark:border-blue-500/50" />
                <span className="text-slate-700 dark:text-slate-300">Theory (Top)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-purple-500/15 dark:bg-purple-500/20 border border-purple-500/40 dark:border-purple-500/50 border-dashed" />
                <span className="text-slate-700 dark:text-slate-300">Lab (Bottom)</span>
              </div>
              {onToggleBlockSlot && (
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  • Click any slot to toggle block
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Type exception: the period matrix is a dense data grid — 38px-tall
          cells and a 36px lunch column — so slot ids, codes and venue labels
          stay at 7–10px instead of the 12px label step. Raising them would
          overflow the cells; helper text and tooltips use the named steps. */}
      <div className="overflow-x-auto momentum-scroll scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700/60 touch-pan-x">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-white/10">
              <th className="p-3 border-r border-slate-200/80 dark:border-white/10 text-xs font-black text-slate-700 dark:text-slate-300 w-20 text-center sticky left-0 z-30 bg-slate-100 dark:bg-slate-900 shadow-2xs">
                DAY
              </th>
              {Array.from({ length: numPeriods }).map((_, pIdx) => {
                const tp = effectiveTheory[pIdx];
                if (tp?.lunch) {
                  return (
                    <th
                      key={pIdx}
                      className="p-1 border-x border-amber-500/30 border-b border-amber-500/20 text-center bg-amber-500/10 dark:bg-amber-500/20 w-10 min-w-[36px] max-w-[42px] select-none align-middle"
                      title="Lunch Break: 1:20 PM - 2:00 PM"
                    >
                      <div className="flex flex-col items-center justify-center leading-tight py-1 select-none">
                        <span className="text-[9.5px] font-black text-amber-600 dark:text-amber-400 tracking-wider">
                          LUNCH
                        </span>
                        <span className="text-[9px] font-bold text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                          1:20-2:00
                        </span>
                      </div>
                    </th>
                  );
                }

                const pNum = lunchIdx !== -1 && pIdx > lunchIdx ? pIdx : pIdx + 1;

                return (
                  <th
                    key={pIdx}
                    className="p-2 border-r border-slate-200/80 dark:border-white/10 text-center text-xs font-bold text-sky-600 dark:text-sky-400 bg-slate-50/90 dark:bg-slate-900/80 min-w-[102px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="tracking-wide">P{pNum}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-normal mt-0.5">
                        {tp?.start || ""}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border-muted/80 dark:divide-border-muted/50">
            {days.map((day, dayIdx) => (
              <tr
                key={day.id}
                className="border-b border-border-muted/80 dark:border-border-muted/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors group"
              >
                {/* Sticky Day Column */}
                <td className="p-3 border-r border-slate-200/80 dark:border-white/10 text-center font-black text-xs text-slate-800 dark:text-white bg-slate-100/95 dark:bg-slate-900/95 sticky left-0 z-20 shadow-2xs uppercase tracking-wider select-none">
                  {day.name.slice(0, 3).toUpperCase()}
                </td>

                {/* Period Columns */}
                {Array.from({ length: numPeriods }).map((_, pIdx) => {
                  const tp = effectiveTheory[pIdx];
                  const lp = effectiveLab[pIdx];

                  if (tp?.lunch) {
                    if (dayIdx === 0) {
                      return (
                        <td
                          key={pIdx}
                          rowSpan={days.length}
                          className="border-x border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 text-center w-10 min-w-[36px] max-w-[42px] align-middle select-none p-1"
                        >
                          <div className="h-full w-full flex flex-col items-center justify-center py-6 select-none">
                            <span className="text-[12px] font-black text-amber-600 dark:text-amber-400 leading-tight tracking-widest drop-shadow-xs">
                              L
                            </span>
                            <span className="text-[12px] font-black text-amber-600 dark:text-amber-400 leading-tight tracking-widest drop-shadow-xs">
                              U
                            </span>
                            <span className="text-[12px] font-black text-amber-600 dark:text-amber-400 leading-tight tracking-widest drop-shadow-xs">
                              N
                            </span>
                            <span className="text-[12px] font-black text-amber-600 dark:text-amber-400 leading-tight tracking-widest drop-shadow-xs">
                              C
                            </span>
                            <span className="text-[12px] font-black text-amber-600 dark:text-amber-400 leading-tight tracking-widest drop-shadow-xs">
                              H
                            </span>
                            <div className="w-4 h-[1px] bg-amber-500/30 dark:bg-amber-500/40 my-2" />
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 leading-tight">
                              1:20
                            </span>
                            <span className="text-[7px] text-amber-600/70 dark:text-amber-400/70 leading-tight">-</span>
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 leading-tight">
                              2:00
                            </span>
                          </div>
                        </td>
                      );
                    }
                    return null;
                  }

                  const rawTheorySlot = tp?.days?.[day.id];
                  const rawLabSlot = lp?.days?.[day.id];

                  if (!rawTheorySlot && !rawLabSlot) {
                    return (
                      <td
                        key={pIdx}
                        className="border-r border-slate-200/80 dark:border-white/10 bg-slate-50/40 dark:bg-slate-950/40 p-1 min-w-[102px] h-[84px]"
                      />
                    );
                  }

                  // Respell for law school aliases if a course occupies it
                  const theorySlot = rawTheorySlot ? ownSlotSpelling(courses, rawTheorySlot) : undefined;
                  const labSlot = rawLabSlot ? ownSlotSpelling(courses, rawLabSlot) : undefined;

                  const tCourse = theorySlot ? courses.find((c) => hasSlot(c.slots, theorySlot)) : null;
                  const lCourse = labSlot ? courses.find((c) => hasSlot(c.slots, labSlot)) : null;

                  const isTBlocked = Boolean(
                    theorySlot &&
                    (expandedBlocked?.has(theorySlot) || (rawTheorySlot && expandedBlocked?.has(rawTheorySlot))),
                  );
                  const isLBlocked = Boolean(
                    labSlot && (expandedBlocked?.has(labSlot) || (rawLabSlot && expandedBlocked?.has(rawLabSlot))),
                  );

                  const theoryStartMin = timeToMinutes(tp?.start ?? "");
                  const labStartMin = timeToMinutes(lp?.start ?? "");
                  const isTInGap =
                    theoryStartMin !== null &&
                    Boolean(
                      selectedGapDetails?.some(
                        (g) => g.day === day.id && theoryStartMin >= g.startMin && theoryStartMin < g.endMin,
                      ),
                    );
                  const isLInGap =
                    labStartMin !== null &&
                    Boolean(
                      selectedGapDetails?.some(
                        (g) => g.day === day.id && labStartMin >= g.startMin && labStartMin < g.endMin,
                      ),
                    );

                  const renderSlotHalf = (
                    slotName?: string,
                    course?: (AddedCourse | NormalizedCourse | any) | null,
                    isBlocked?: boolean,
                    inGap?: boolean,
                    isLab?: boolean,
                  ) => {
                    if (!slotName) {
                      return <div className="h-[38px] rounded-md bg-transparent" />;
                    }

                    if (isBlocked) {
                      return (
                        <div
                          {...clickable(() => onToggleBlockSlot?.(slotName))}
                          title={`Blocked slot (${slotName}). Click to unblock.`}
                          className={cn(
                            "h-[38px] p-1 rounded-md flex flex-col items-center justify-center relative transition-all duration-200 border border-red-500/30 dark:border-red-500/40",
                            "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(239,68,68,0.12)_3px,rgba(239,68,68,0.12)_6px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(239,68,68,0.25)_3px,rgba(239,68,68,0.25)_6px)]",
                            "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-inner",
                            onToggleBlockSlot && "cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40",
                          )}
                        >
                          <span className="text-[10px] font-black tracking-wide">Blocked</span>
                          <span className="text-[9px] font-semibold opacity-75">{slotName}</span>
                        </div>
                      );
                    }

                    if (course) {
                      const colorHex =
                        COLOR_HEX_MAP[course.color] || (course.color?.startsWith("#") ? course.color : "#2563eb");

                      const handleTap = () => {
                        // The planner owns the tap: it has always meant "rule
                        // this slot out". Read-only surfaces use the same tap
                        // to open the full course detail sheet.
                        if (onToggleBlockSlot) {
                          onToggleBlockSlot(slotName);
                          return;
                        }
                        const period = isLab ? lp : tp;
                        const toMin = (value?: string) => timeToMinutes(value ?? "") ?? 0;
                        const detailCell: Cell = {
                          dayId: day.id,
                          bandIndex: pIdx,
                          bandCount: 1,
                          label: slotName,
                          shortLabel: slotName,
                          slots: [slotName],
                          course: course as Cell["course"],
                          half: isLab ? "lab" : "theory",
                          kind: "course",
                          blocked: false,
                          partiallyBlocked: false,
                          inGap: false,
                          shadowed: [],
                          startMin: toMin(period?.start),
                          endMin: toMin(period?.end),
                        };
                        setActiveCell({
                          cell: detailCell,
                          dayName: days.find((d) => d.id === day.id)?.name ?? day.id,
                        });
                      };

                      return (
                        <div
                          {...clickable(handleTap)}
                          // Native tooltips only appear on hover, so this is a
                          // desktop-only hint; touch users get the sheet.
                          title={`${course.code}${course.title ? ` · ${course.title}` : ""}`}
                          className="h-[38px] p-1.5 rounded-md flex flex-col justify-between relative transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                          style={{
                            backgroundColor: `${colorHex}25`,
                            border: `1px solid ${colorHex}77`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 leading-none">
                            <span className="text-[10px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none drop-shadow-xs">
                              {course.code}
                            </span>
                            <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-black/40 border border-slate-300/40 dark:border-white/5 px-1 py-0.5 rounded leading-none">
                              {slotName}
                            </span>
                          </div>

                          <div className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 truncate leading-none mt-0.5">
                            {course.venue || "TBA"}
                          </div>
                        </div>
                      );
                    }

                    if (inGap) {
                      return (
                        <div
                          {...clickable(() => onToggleBlockSlot?.(slotName))}
                          className={cn(
                            "h-[38px] p-1 rounded-md flex items-center justify-center border border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 animate-pulse text-[10px] font-bold",
                            onToggleBlockSlot && "cursor-pointer",
                          )}
                        >
                          {slotName}
                        </div>
                      );
                    }

                    return (
                      <div
                        {...clickable(() => onToggleBlockSlot?.(slotName))}
                        title={onToggleBlockSlot ? `Slot ${slotName}. Click to rule out.` : `Slot ${slotName}`}
                        className={cn(
                          "h-[38px] p-1 rounded-md flex items-center justify-center border border-dashed border-slate-300/80 dark:border-white/5 transition-all duration-200",
                          "text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5",
                          onToggleBlockSlot && "cursor-pointer",
                        )}
                      >
                        <span className="text-[10px] font-semibold tracking-wider">{slotName}</span>
                      </div>
                    );
                  };

                  return (
                    <td
                      key={pIdx}
                      className="border-r border-slate-200/80 dark:border-white/10 p-1 min-w-[102px] h-[84px] align-top bg-white/40 dark:bg-slate-950/20"
                    >
                      <div className="flex flex-col gap-1 h-full">
                        {renderSlotHalf(theorySlot, tCourse, isTBlocked, isTInGap, false)}
                        {renderSlotHalf(labSlot, lCourse, isLBlocked, isLInGap, true)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {activeCell && (
          <SlotDetailSheet
            cell={activeCell.cell}
            dayName={activeCell.dayName}
            blockedSlots={blockedSlots}
            onToggleBlockSlot={onToggleBlockSlot}
            attendanceByCourse={attendanceByCourse}
            onClose={() => setActiveCell(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
