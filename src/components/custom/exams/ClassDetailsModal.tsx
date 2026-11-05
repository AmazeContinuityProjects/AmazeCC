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
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer"
            >
              {copiedKey === "all" ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          }
        >
          <div className="space-y-4 text-left">
            {/* Multiple occupants tabs if more than one class is in this slot */}
            {allOccupants.length > 1 && (
              <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl overflow-x-auto">
                {allOccupants.map((occ, idx) => (
                  <button
                    key={`${occ.courseCode}-${idx}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                      selectedIndex === idx
                        ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                    )}
                  >
                    {occ.courseCode || `Class ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* Course & Title Header Tile */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                  {active.courseCode || "COURSE"}
                </span>
                <div className="flex items-center gap-1.5">
                  {active.type && (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] uppercase tracking-wider">
                      {active.type}
                    </span>
                  )}
                  {active.classId && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px]">
                      #{active.classId}
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white leading-snug">
                {active.title || "Course"}
              </h3>
            </div>

            {/* Key Grid Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Room Tile */}
              <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Classroom Venue</p>
                    <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{venue}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{block}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(venue, "room")}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Copy room"
                >
                  {copiedKey === "room" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Faculty Tile */}
              <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Faculty / Teacher</p>
                    <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                      {active.faculty || "Not Specified"}
                    </p>
                    {active.erpId && (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
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
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Time & Period Tile */}
              <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Time & Schedule</p>
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                    {periodLabel || "Period"}
                  </p>
                  {dayLabel && <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{dayLabel}</p>}
                </div>
              </div>

              {/* Slot & Type Tile */}
              <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">VTOP Slot</p>
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                    {active.slot || "N/A"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
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
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>View Faculty Schedule</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => handleCopy(fullCopyText, "all")}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 font-bold text-xs text-zinc-700 dark:text-zinc-300 transition-all active:scale-[0.98] cursor-pointer"
              >
                {copiedKey === "all" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied Details</span>
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
