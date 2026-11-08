"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BookOpen, DoorOpen, User, Clock, Copy, Check, Layers, Hash, ChevronRight } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import type { MergedOccupant } from "@/lib/roomMerge";
import { useAtom } from "jotai";
import { activeTabAtom } from "@/store/uiAtoms";
import { cn } from "@amazecontinuityprojects/amazeui";

export interface ClassDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  occupant: MergedOccupant | null;
  occupants?: MergedOccupant[];
  roomCode?: string;
  dayLabel?: string;
  periodLabel?: string;
  onViewFacultySchedule?: (facultyNameOrErp: string) => void;
}

export default function ClassDetailsModal({
  isOpen,
  onClose,
  occupant,
  occupants,
  roomCode,
  dayLabel,
  periodLabel,
  onViewFacultySchedule,
}: ClassDetailsModalProps) {
  const [, setActiveTab] = useAtom(activeTabAtom);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // If multiple occupants share the slot/room (e.g. joint batch), allow switching
  const allOccupants = occupants && occupants.length > 0 ? occupants : occupant ? [occupant] : [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  const active = allOccupants[selectedIndex] || occupant;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  const handleOpenFaculty = () => {
    if (!active) return;
    const target = active.erpId ? `erp:${active.erpId}` : active.faculty;
    if (active.erpId) {
      localStorage.setItem("faculty_schedule_target_erp", active.erpId);
    }
    if (active.faculty) {
      localStorage.setItem("faculty_schedule_target_name", active.faculty);
    }
    if (onViewFacultySchedule) {
      onViewFacultySchedule(target);
    } else {
      setActiveTab("faculty-schedule");
    }
    onClose();
  };

  if (!active) return null;

  const venue = active.code || roomCode || "Unknown Room";
  const block = venue.includes("-") ? `${venue.split("-")[0].trim()} Block` : "Campus Venue";

  const fullCopyText = [
    `Course: ${active.courseCode} - ${active.title || "Class"}`,
    active.type ? `Component: ${active.type}` : "",
    `Faculty: ${active.faculty}${active.erpId ? ` (ERP: ${active.erpId})` : ""}`,
    `Room: ${venue} (${block})`,
    dayLabel ? `Day: ${dayLabel}` : "",
    periodLabel ? `Time: ${periodLabel}` : "",
    active.slot ? `Slot: ${active.slot}` : "",
    active.classId ? `Class ID: ${active.classId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="class-details-inspector"
          maxWidth="max-w-lg"
          placement="bottom-center"
          panelZIndex={320}
          backdropZIndex={315}
          title={active.title || active.courseCode || "Class Details"}
          subtitle={`${active.courseCode}${active.type ? ` · ${active.type}` : ""} · ${venue}`}
          icon={<BookOpen className="w-5 h-5" />}
          accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          closeLabel="Close class details"
          trailing={
            <button
              type="button"
              onClick={() => handleCopy(fullCopyText, "all")}
              title="Copy class details"
              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-surface dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer"
            >
              {copiedKey === "all" ? (
                <Check className="w-3.5 h-3.5 text-ok" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          }
        >
          <div className="space-y-4 text-left">
            {/* Multiple occupants tabs if more than one class is in this slot */}
            {allOccupants.length > 1 && (
              <div className="flex gap-1.5 p-1 bg-surface-2 rounded-md overflow-x-auto">
                {allOccupants.map((occ, idx) => (
                  <button
                    key={`${occ.courseCode}-${idx}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                      selectedIndex === idx
                        ? "bg-surface dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                    )}
                  >
                    {occ.courseCode || `Class ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* Course & Title Header Tile */}
            <div className="p-3.5 rounded-md bg-surface-2 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-semibold text-xs">
                  {active.courseCode || "COURSE"}
                </span>
                <div className="flex items-center gap-1.5">
                  {active.type && (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]">
                      {active.type}
                    </span>
                  )}
                  {active.classId && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100/70 text-ok font-mono font-semibold text-[11px]">
                      #{active.classId}
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-base font-semibold text-ink leading-snug">
                {active.title || "Course"}
              </h3>
            </div>

            {/* Key Grid Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Room Tile */}
              <div className="p-3 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-surface flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md border border-line-2 text-ok flex items-center justify-center shrink-0 mt-0.5 bg-surface-2">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-400">Classroom Venue</p>
                    <p className="text-sm font-semibold text-ink truncate">{venue}</p>
                    <p className="text-xs text-muted font-medium">{block}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(venue, "room")}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Copy room"
                >
                  {copiedKey === "room" ? (
                    <Check className="w-3.5 h-3.5 text-ok" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Faculty Tile */}
              <div className="p-3 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-surface flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md border border-line-2 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 bg-surface-2">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-400">Faculty / Teacher</p>
                    <p className="text-sm font-semibold text-ink truncate">
                      {active.faculty || "Not Specified"}
                    </p>
                    {active.erpId && (
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-[11px] text-indigo-600 dark:text-indigo-400">
                        <Hash className="w-3 h-3" />
                        {active.erpId}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(active.faculty, "faculty")}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Copy faculty name"
                >
                  {copiedKey === "faculty" ? (
                    <Check className="w-3.5 h-3.5 text-ok" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Time & Period Tile */}
              <div className="p-3 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-surface flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-md border border-line-2 text-warn flex items-center justify-center shrink-0 mt-0.5 bg-surface-2">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-400">Time & Schedule</p>
                  <p className="text-sm font-semibold text-ink truncate">
                    {periodLabel || "Period"}
                  </p>
                  {dayLabel && <p className="text-xs text-muted font-medium">{dayLabel}</p>}
                </div>
              </div>

              {/* Slot & Type Tile */}
              <div className="p-3 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-surface flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-md border border-line-2 text-course-3 flex items-center justify-center shrink-0 mt-0.5 bg-surface-2">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-400">VTOP Slot</p>
                  <p className="text-sm font-semibold text-ink truncate">
                    {active.slot || "N/A"}
                  </p>
                  <p className="text-xs text-muted font-medium">
                    Source: {active.source === "live" ? "Live Contribution" : "FFCS Allocation"}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions: View Faculty Schedule & Copy Details */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleOpenFaculty}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-sm bg-accent hover:bg-accent/90 text-background font-medium text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <User className="w-4 h-4" />
                <span>View Faculty Schedule</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => handleCopy(fullCopyText, "all")}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-md border border-zinc-200 dark:border-zinc-700 bg-surface dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 font-semibold text-xs text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
              >
                {copiedKey === "all" ? (
                  <>
                    <Check className="w-4 h-4 text-ok" />
                    <span className="text-ok">Copied Details</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Info</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
