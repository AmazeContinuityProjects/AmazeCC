"use client";

import React from "react";
import { type AddedCourse, type GapDetail, type TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import { cn } from "@/lib/utils";
import { COLOR_HEX_MAP } from "@/lib/ffcsConstants";
import { ensureLunchPeriod, expandSlotSpellings, hasSlot, ownSlotSpelling, timeToMinutes } from "@/lib/slots";

const DEFAULT_DAYS: { id: string; name: string }[] = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

export interface ModernHorizontalTimetableGridProps {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
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
  title = "Unified Schedule",
  showLegend = true,
  className,
}: ModernHorizontalTimetableGridProps) {
  const effectiveTheory = ensureLunchPeriod(theoryPeriods);
  const effectiveLab = ensureLunchPeriod(labPeriods);
  const numPeriods = Math.max(effectiveTheory.length, effectiveLab.length);
  const expandedBlocked = blockedSlots ? expandSlotSpellings(blockedSlots) : null;
  const lunchIdx = effectiveTheory.findIndex((p) => p?.lunch);

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200/80 dark:border-white/10 bg-surface shadow-xl dark:shadow-lg overflow-hidden mb-6 transition-colors",
        className,
      )}
    >
      {/* Header bar */}
      {(title || showLegend) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-2 border-b border-slate-200/80 dark:border-white/10">
          {title ? (
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              {title}
            </h3>
          ) : (
            <div />
          )}

          {showLegend && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-accent-soft border border-accent/40" />
                <span className="text-slate-700 dark:text-slate-300">Theory (Top)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-course-3/10 border border-course-3/40 border-dashed" />
                <span className="text-slate-700 dark:text-slate-300">Lab (Bottom)</span>
              </div>
              {onToggleBlockSlot && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  • Click any slot to toggle block
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Responsive scrollable table container */}
      <div className="overflow-x-auto momentum-scroll scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700/60 touch-pan-x">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-surface-2 border-b border-slate-200/80 dark:border-white/10">
              <th className="p-3 border-r border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 w-20 text-center sticky left-0 z-30 bg-surface-2 shadow-[2px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_10px_rgba(0,0,0,0.5)]">
                DAY
              </th>
              {Array.from({ length: numPeriods }).map((_, pIdx) => {
                const tp = effectiveTheory[pIdx];
                if (tp?.lunch) {
                  return (
                    <th
                      key={pIdx}
                      className="p-1 border-x border-warn/30 border-b border-warn/20 text-center bg-warn-soft w-10 min-w-[36px] max-w-[42px] select-none align-middle"
                      title="Lunch Break: 1:20 PM - 2:00 PM"
                    >
                      <div className="flex flex-col items-center justify-center leading-tight py-1 select-none">
                        <span className="text-[9.5px] font-semibold text-warn">
                          LUNCH
                        </span>
                        <span className="text-[11px] font-semibold text-warn/80 mt-0.5">
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
                    className="p-2 border-r border-slate-200/80 dark:border-white/10 text-center text-xs font-semibold text-accent bg-surface-2 min-w-[102px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="tracking-wide">P{pNum}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-normal mt-0.5">
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
                <td className="p-3 border-r border-slate-200/80 dark:border-white/10 text-center font-semibold text-xs text-slate-800 dark:text-white bg-surface-2 sticky left-0 z-20 shadow-[2px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_10px_rgba(0,0,0,0.5)] select-none">
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
                          className="border-x border-warn/30 bg-warn-soft text-center w-10 min-w-[36px] max-w-[42px] align-middle select-none p-1"
                        >
                          <div className="h-full w-full flex flex-col items-center justify-center py-6 select-none">
                            <span className="text-[12px] font-semibold text-warn leading-tight drop-shadow-xs">
                              L
                            </span>
                            <span className="text-[12px] font-semibold text-warn leading-tight drop-shadow-xs">
                              U
                            </span>
                            <span className="text-[12px] font-semibold text-warn leading-tight drop-shadow-xs">
                              N
                            </span>
                            <span className="text-[12px] font-semibold text-warn leading-tight drop-shadow-xs">
                              C
                            </span>
                            <span className="text-[12px] font-semibold text-warn leading-tight drop-shadow-xs">
                              H
                            </span>
                            <div className="w-4 h-[1px] bg-warn/30 my-2" />
                            <span className="text-[11px] font-semibold text-warn leading-tight">
                              1:20
                            </span>
                            <span className="text-[7px] text-warn/70 leading-tight">-</span>
                            <span className="text-[11px] font-semibold text-warn leading-tight">
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
                        className="border-r border-slate-200/80 dark:border-white/10 bg-surface-2 p-1 min-w-[102px] h-[84px]"
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
                    course?: AddedCourse | null,
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
                          onClick={() => onToggleBlockSlot?.(slotName)}
                          title={`Blocked slot (${slotName}). Click to unblock.`}
                          className={cn(
                            "h-[38px] p-1 rounded-md flex flex-col items-center justify-center relative transition-all duration-200 border border-danger/30",
                            "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(239,68,68,0.12)_3px,rgba(239,68,68,0.12)_6px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(239,68,68,0.25)_3px,rgba(239,68,68,0.25)_6px)]",
                            "bg-danger-soft text-danger shadow-inner",
                            onToggleBlockSlot && "cursor-pointer hover:bg-danger-soft",
                          )}
                        >
                          <span className="text-[11px] font-semibold tracking-wide">Blocked</span>
                          <span className="text-[11px] font-semibold opacity-75">{slotName}</span>
                        </div>
                      );
                    }

                    if (course) {
                      const colorHex =
                        COLOR_HEX_MAP[course.color] || (course.color?.startsWith("#") ? course.color : "#2563eb");
                      return (
                        <div
                          onClick={() => onToggleBlockSlot?.(slotName)}
                          className={cn(
                            "h-[38px] p-1.5 rounded-md flex flex-col justify-between relative transition-all duration-200 group/tile",
                            onToggleBlockSlot && "cursor-pointer",
                          )}
                          style={{
                            backgroundColor: `${colorHex}25`,
                            border: `1px solid ${colorHex}77`,
                            boxShadow: `0 1px 4px ${colorHex}15`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 leading-none">
                            <span className="text-[11px] font-semibold text-slate-900 dark:text-white tracking-tight leading-none drop-shadow-xs">
                              {course.code}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-black/40 border border-slate-300/40 dark:border-white/5 px-1 py-0.5 rounded leading-none">
                              {slotName}
                            </span>
                          </div>

                          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate leading-none mt-0.5">
                            {course.venue || "TBA"}
                          </div>

                          {/* Hover tooltip */}
                          <div className="absolute opacity-0 group-hover/tile:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] bg-slate-900 dark:bg-slate-950 text-white text-xs rounded-md p-2.5 shadow-lg z-50 pointer-events-none border border-slate-700 dark:border-white/20 text-center">
                            <p className="font-semibold text-slate-100">{course.title}</p>
                            <p className="text-slate-400 text-[11px] mt-0.5">{course.faculty}</p>
                            <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-accent font-semibold">
                              <span>Slot: {slotName}</span>
                              <span>•</span>
                              <span>Venue: {course.venue || "TBA"}</span>
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-950 rotate-45 border-r border-b border-slate-700 dark:border-white/20" />
                          </div>
                        </div>
                      );
                    }

                    if (inGap) {
                      return (
                        <div
                          onClick={() => onToggleBlockSlot?.(slotName)}
                          className={cn(
                            "h-[38px] p-1 rounded-md flex items-center justify-center border border-warn/40 bg-warn-soft text-warn animate-pulse text-[11px] font-semibold",
                            onToggleBlockSlot && "cursor-pointer",
                          )}
                        >
                          {slotName}
                        </div>
                      );
                    }

                    return (
                      <div
                        onClick={() => onToggleBlockSlot?.(slotName)}
                        title={onToggleBlockSlot ? `Slot ${slotName}. Click to rule out.` : `Slot ${slotName}`}
                        className={cn(
                          "h-[38px] p-1 rounded-md flex items-center justify-center border border-dashed border-slate-300/80 dark:border-white/5 transition-all duration-200",
                          "text-slate-400 dark:text-slate-500 hover:text-accent hover:border-accent/40 hover:bg-accent-soft",
                          onToggleBlockSlot && "cursor-pointer",
                        )}
                      >
                        <span className="text-[11px] font-semibold">{slotName}</span>
                      </div>
                    );
                  };

                  return (
                    <td
                      key={pIdx}
                      className="border-r border-slate-200/80 dark:border-white/10 p-1 min-w-[102px] h-[84px] align-top bg-surface"
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
    </div>
  );
}
