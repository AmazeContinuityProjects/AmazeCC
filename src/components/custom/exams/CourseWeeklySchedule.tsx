"use client";

import React, { useState, useMemo } from "react";
import { Clock, Calendar } from "lucide-react";
import { LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";
import { SectionHeader, ToneBadge, EmptyPanel, ListShell, ListRowText } from "../shared/primitives";
import {
  ATTENDANCE_DAYS,
  AttendanceDayCardsMap,
  getAttendanceTimeRange,
  getTodayAttendanceDay,
} from "@/lib/attendanceTimetable";
import config from "../../../../config.json";

export interface CourseWeeklyScheduleProps {
  courseCode: string;
  dayCardsMap?: AttendanceDayCardsMap;
  theorySlot?: string;
  labSlot?: string;
  theoryVenue?: string;
  labVenue?: string;
  theoryFaculty?: string;
  labFaculty?: string;
  viewDetail?: any;
  viewLoading?: boolean;
  onFetchViewDetail?: () => void;
  reviewScopes?: Array<"theory" | "lab">;
  detailEntriesByScope?: (scope: "theory" | "lab") => any[];
  renderScopeBadge?: (scope: "theory" | "lab") => React.ReactNode;
}

const DAY_NAMES: Record<string, { label: string; full: string }> = {
  MON: { label: "Mon", full: "Monday" },
  TUE: { label: "Tue", full: "Tuesday" },
  WED: { label: "Wed", full: "Wednesday" },
  THU: { label: "Thu", full: "Thursday" },
  FRI: { label: "Fri", full: "Friday" },
  SAT: { label: "Sat", full: "Saturday" },
  SUN: { label: "Sun", full: "Sunday" },
};

export default function CourseWeeklySchedule({
  courseCode,
  dayCardsMap,
  theorySlot,
  labSlot,
  theoryVenue,
  labVenue,
  theoryFaculty,
  labFaculty,
  viewDetail,
  viewLoading,
  onFetchViewDetail,
  reviewScopes,
  detailEntriesByScope,
  renderScopeBadge,
}: CourseWeeklyScheduleProps) {
  const cleanSelected = courseCode
    .replace(/\([LPT]\)$/i, "")
    .trim()
    .toUpperCase();
  const todayKey = getTodayAttendanceDay();

  // 1. Primary Source: Live timetable day cards
  const scheduledDays = useMemo(() => {
    if (!dayCardsMap) return [];

    const result = (ATTENDANCE_DAYS as readonly string[])
      .map((dayKey) => {
        const classes = (dayCardsMap[dayKey] || []).filter((cls: any) => {
          const cCode = String(cls.courseCode || "")
            .replace(/\([LPT]\)$/i, "")
            .trim()
            .toUpperCase();
          return cCode === cleanSelected;
        });

        return {
          dayKey,
          ...(DAY_NAMES[dayKey] || { label: dayKey, full: dayKey }),
          classes,
        };
      })
      .filter((d) => d.classes.length > 0);

    return result;
  }, [dayCardsMap, cleanSelected]);

  // 2. Fallback: Parse from config.slotMap if dayCardsMap is empty
  const effectiveDays = useMemo(() => {
    if (scheduledDays.length > 0) return scheduledDays;

    const slotMap = (config as any).slotMap;
    if (!slotMap) return [];

    const theorySlots = (theorySlot || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
    const labSlots = (labSlot || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    if (theorySlots.length === 0 && labSlots.length === 0) return [];

    return (ATTENDANCE_DAYS as readonly string[])
      .map((dayKey) => {
        const daySlots = slotMap[dayKey] || {};
        const classes: any[] = [];

        theorySlots.forEach((slotName) => {
          if (daySlots[slotName]) {
            classes.push({
              slotName,
              time: daySlots[slotName].time,
              courseCode: cleanSelected,
              courseType: "Theory",
              slotVenue: theoryVenue,
              faculty: theoryFaculty,
            });
          }
        });

        labSlots.forEach((slotName) => {
          if (daySlots[slotName]) {
            classes.push({
              slotName,
              time: daySlots[slotName].time,
              courseCode: `${cleanSelected}(L)`,
              courseType: "Lab",
              slotVenue: labVenue,
              faculty: labFaculty,
            });
          }
        });

        // Sort classes by start time
        classes.sort((a, b) => {
          const tA = getAttendanceTimeRange(a.time);
          const tB = getAttendanceTimeRange(b.time);
          return tA.start - tB.start;
        });

        return {
          dayKey,
          ...(DAY_NAMES[dayKey] || { label: dayKey, full: dayKey }),
          classes,
        };
      })
      .filter((d) => d.classes.length > 0);
  }, [scheduledDays, cleanSelected, theorySlot, labSlot, theoryVenue, labVenue, theoryFaculty, labFaculty]);

  // Total classes per week count
  const totalClassesCount = useMemo(() => {
    return effectiveDays.reduce((acc, d) => acc + d.classes.length, 0);
  }, [effectiveDays]);

  const todayClassesCount = useMemo(() => {
    const today = effectiveDays.find((d) => d.dayKey === todayKey);
    return today ? today.classes.length : 0;
  }, [effectiveDays, todayKey]);

  // Real-time live session checking
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Calendar}
        title="Weekly Timetable Schedule"
        count={totalClassesCount || undefined}
        right={
          todayClassesCount > 0 ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-ok-soft text-ok border-ok/20">
              {todayClassesCount} today
            </span>
          ) : undefined
        }
      />

      {effectiveDays.length === 0 ? (
        <EmptyPanel
          icon={<Calendar className="w-7 h-7" />}
          title="No scheduled timetable sessions"
          description="No classes for this course were found in the current weekly timetable."
        />
      ) : (
        <div className="space-y-4">
          {effectiveDays.map(({ dayKey, full, label, classes }) => {
            const isToday = dayKey === todayKey;

            return (
              <div key={dayKey} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-muted font-outfit">
                      {full}
                    </span>
                    {isToday && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-ok-soft text-ok border border-ok/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-muted font-medium">
                    {classes.length} {classes.length === 1 ? "class" : "classes"}
                  </span>
                </div>

                <ListShell>
                  {classes.map((cls: any, idx: number) => {
                    const isLab =
                      cls.courseType?.toLowerCase().includes("lab") ||
                      String(cls.courseCode || "").endsWith("(L)") ||
                      String(cls.courseCode || "").endsWith("(P)") ||
                      String(cls.slotName || "")
                        .toLowerCase()
                        .startsWith("l");

                    const timeRange = getAttendanceTimeRange(cls.time);
                    const isLive =
                      isToday &&
                      timeRange.start > 0 &&
                      currentMinutes >= timeRange.start &&
                      currentMinutes <= timeRange.end;

                    return (
                      <div key={`${dayKey}-${cls.slotName}-${idx}`} className={`${LIST_ROW} py-3`}>
                        {/* Leading Icon Tile */}
                        <span
                          className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${
                            isLive
                              ? TONE_ICON_TILE.emerald
                              : isToday
                                ? TONE_ICON_TILE.indigo
                                : "border-border-muted bg-surface-secondary text-text-muted"
                          }`}
                        >
                          <Clock className="w-4.5 h-4.5" />
                        </span>

                        {/* Title & Subtitle */}
                        <ListRowText
                          titleTag="span"
                          title={
                            <span className="flex items-center gap-2">
                              <span className="font-outfit font-semibold text-text-heading">{cls.time}</span>
                              <ToneBadge tone={isLab ? "emerald" : "blue"}>
                                {cls.courseType || (isLab ? "Lab" : "Theory")}
                              </ToneBadge>
                            </span>
                          }
                          subtitle={
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span>Slot {cls.slotName}</span>
                              <span>&middot;</span>
                              <span>
                                Venue: <span className="font-semibold text-text-heading">{cls.slotVenue || "—"}</span>
                              </span>
                              {cls.faculty ? <span>&middot; {cls.faculty}</span> : null}
                            </span>
                          }
                        />

                        {/* Right Side Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-ok-soft text-ok border border-ok/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                              Live
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </ListShell>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
