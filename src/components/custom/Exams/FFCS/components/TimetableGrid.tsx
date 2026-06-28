import React from 'react';
import { DAYS } from '../constants';
import { TimetablePeriod, AddedCourse, TimetableState } from '../types';

export type GapDetail = NonNullable<TimetableState['metrics']>['gapDetails'][0];

export interface TimetableGridProps {
  courses: AddedCourse[];
  customCourses?: AddedCourse[];
  fullSize?: boolean;
  blockedSlots: Set<string>;
  toggleBlockSlot: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
}

export function TimetableGrid({
  courses,
  customCourses,
  fullSize,
  blockedSlots,
  toggleBlockSlot,
  selectedGapDetails,
  theoryPeriods,
  labPeriods
}: TimetableGridProps) {
  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const renderCourses = customCourses || courses;
  const getCourse = (slotName: string) => renderCourses.find(c => c.slots.includes(slotName));

  return (
    <div className={`mb-8 rounded-xl border border-border shadow-2xl bg-background  ${customCourses && !fullSize ? 'scale-[0.85] origin-top-left -mb-10' : ''} ${fullSize ? '' : 'overflow-x-auto'}`}>
      <div className="p-4 bg-muted/80 border-b border-border flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          Unified Schedule
        </h3>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm"></div>Theory (Top)</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm border-dashed"></div>Lab (Bottom)</div>
        </div>
      </div>
      <div className="min-w-max">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-card">
              <th className="p-3 border-b border-r border-border font-semibold text-foreground/80 w-24 text-center sticky left-0 z-20 bg-card">Day</th>
              {theoryPeriods.map((period, idx) => (
                <th key={idx} className="p-2 border-b border-r border-border text-xs text-center text-muted-foreground font-medium">
                  <div className="flex flex-col">
                    <span>{period.start}</span>
                    <span className="text-[10px] text-muted-foreground">to</span>
                    <span>{period.end}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                <td className="p-3 border-r border-border font-semibold text-slate-200 text-center bg-background/95  sticky left-0 z-20">
                  {day.name.substring(0, 3).toUpperCase()}
                </td>
                {theoryPeriods.map((period, pIdx) => {
                  const theorySlotName = period.days?.[day.id];
                  const labSlotName = labPeriods[pIdx]?.days?.[day.id];
                  
                  if (!theorySlotName && !labSlotName) {
                    return <td key={pIdx} className="border-r border-border bg-black/20 h-[76px] min-h-[76px]"></td>;
                  }

                  const tCourse = theorySlotName ? getCourse(theorySlotName) : undefined;
                  const lCourse = labSlotName ? getCourse(labSlotName) : undefined;

                  const isTBlocked = theorySlotName ? blockedSlots.has(theorySlotName) : false;
                  const isLBlocked = labSlotName ? blockedSlots.has(labSlotName) : false;

                  return (
                    <td key={pIdx} className="border-r border-border text-center relative group min-w-[80px] align-top hover:z-50 h-[76px] min-h-[76px]">
                      <div className="w-full h-full flex flex-col items-stretch">
                        {/* Theory Half */}
                        {theorySlotName ? (
                          <div 
                            onClick={() => !customCourses && toggleBlockSlot(theorySlotName)}
                            className={`h-[38px] p-1 border-b border-border flex flex-col items-center justify-center transition-all duration-300 relative ${!customCourses ? 'cursor-pointer' : ''} ${
                              isTBlocked 
                                ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 border-red-500/30 text-red-200 shadow-inner'
                                : tCourse 
                                  ? tCourse.color + ' shadow-lg text-foreground z-10' 
                                  : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(period.start as string) >= g.startMin && timeToMinutes(period.start as string) < g.endMin) ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 animate-pulse' : 'bg-muted/20 text-muted-foreground hover:border-border/50 hover:bg-muted/30')
                            }`}
                          >
                            <span className={`text-[11px] font-bold ${tCourse || isTBlocked ? 'opacity-100' : 'opacity-60'}`}>
                              {isTBlocked ? 'Blocked' : theorySlotName}
                            </span>
                            {!isTBlocked && tCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{tCourse.code}</span>}
                            
                            {/* Theory Tooltip */}
                            {!isTBlocked && tCourse && (
                              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                <p className="font-bold">{tCourse.title}</p>
                                <p className="text-gray-300 mt-0.5">{tCourse.faculty}</p>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-border"></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[38px] border-b border-border bg-black/10"></div>
                        )}
                        
                        {/* Lab Half */}
                        {labSlotName ? (
                          <div 
                            onClick={() => !customCourses && toggleBlockSlot(labSlotName)}
                            className={`h-[38px] p-1 flex flex-col items-center justify-center transition-all duration-300 relative ${!customCourses ? 'cursor-pointer' : ''} ${
                              isLBlocked 
                                ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 text-red-200 shadow-inner'
                                : lCourse 
                                  ? lCourse.color + ' shadow-lg text-foreground z-10' 
                                  : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(period.start as string) >= g.startMin && timeToMinutes(period.start as string) < g.endMin) ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 animate-pulse' : 'bg-black/20 text-white/30 hover:bg-black/30')
                            }`}
                          >
                            <span className={`text-[11px] font-bold ${lCourse || isLBlocked ? 'opacity-100' : 'opacity-60'}`}>
                              {isLBlocked ? 'Blocked' : labSlotName}
                            </span>
                            {!isLBlocked && lCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{lCourse.code}</span>}
                            
                            {/* Lab Tooltip */}
                            {!isLBlocked && lCourse && (
                              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                <p className="font-bold">{lCourse.title}</p>
                                <p className="text-gray-300 mt-0.5">{lCourse.faculty}</p>
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-t border-l border-border"></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[38px] bg-black/10"></div>
                        )}
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
