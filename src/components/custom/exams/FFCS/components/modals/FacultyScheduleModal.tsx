"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, CalendarDays, ChevronRight, Search, X } from "lucide-react";

import { VerticalTimetableGrid } from "../../../../timetable";
import BottomSheet from "../../../../shared/BottomSheet";
import { DAYS } from "../../constants";
import {
  facultyGroupToAddedCourses,
  facultySchedulePeriods,
  findFirstMatchingGroup,
  type FacultyNameGroup,
} from "../../logic/facultyGroups";
import { EmptyPanel, IconButton, ListSkeleton } from "../../../../shared/primitives";

/**
 * The faculty schedule browser.
 *
 * Two screens in one modal: a list of the faculty name groups the FFCS report
 * produced, and the full week one group teaches. The same component backs both
 * entry points — the planner opens it on the whole list, while the Faculty
 * Explorer opens it with `initialFaculty` and lands straight on the schedule of
 * the first group whose names match that directory entry.
 *
 * The modal speaks the planner's dialect (`bg-background` / `border-border` /
 * `text-foreground`) because the timetable grid and the planner are that
 * dialect; it is an overlay, so the page behind it only supplies the backdrop.
 */
export interface FacultyScheduleModalProps {
  open: boolean;
  onClose: () => void;
  groups: FacultyNameGroup[];
  /**
   * A name to resolve against the groups — the Faculty Explorer passes the
   * directory entry's name. The first matching group is selected.
   */
  initialFaculty?: string;
  /** True while the report is still being read (Faculty Explorer fetches it). */
  loading?: boolean;
}

export function FacultyScheduleModal({
  open,
  onClose,
  groups,
  initialFaculty,
  loading = false,
}: FacultyScheduleModalProps) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  // Opening the modal is a fresh session: clear the search and, when a name was
  // supplied, resolve it to the first matching group. The ref keeps a later
  // group-list update (an async load landing after mount) from overriding a
  // selection the reader has already made.
  useEffect(() => {
    if (!open) {
      autoSelectedRef.current = false;
      setSelectedKey(null);
      setQuery("");
      return;
    }
    if (autoSelectedRef.current || !initialFaculty || selectedKey) return;
    const match = findFirstMatchingGroup(groups, initialFaculty);
    if (match) {
      setSelectedKey(match.key);
      autoSelectedRef.current = true;
    }
  }, [open, initialFaculty, groups, selectedKey]);

  const periods = useMemo(() => facultySchedulePeriods(), []);
  const selected = groups.find((group) => group.key === selectedKey) ?? null;
  const courses = useMemo(
    () => (selected ? facultyGroupToAddedCourses(selected) : []),
    [selected]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(
      (group) =>
        group.canonical.toLowerCase().includes(term) ||
        group.key.toLowerCase().includes(term) ||
        group.names.some((name) => name.toLowerCase().includes(term))
    );
  }, [groups, query]);

  return (
    <AnimatePresence>
      {open && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-faculty-schedule"
          maxWidth="max-w-6xl"
          panelZIndex={300}
          backdropZIndex={295}
          showClose={false}
        >
          {/*
            A header card, not a bare heading — the same one the Full Weekly
            Timetable sheet uses, because a bordered box holding the title, one
            line saying what you are looking at, and the X beside it reads
            faster than the sheet's own floating X. `showClose` is off so there
            is exactly one X and it lives next to the thing it closes. The
            z-index pair is still passed through rather than left at the sheet
            default because this modal opens from fullscreen mode, where the tab
            sits at z-100 and a z-60 sheet would land behind it.
          */}
          <div className="space-y-4">
            <div className="p-4 sm:p-5 border border-border rounded-2xl flex items-center justify-between gap-3 bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-foreground truncate">
                    {selected ? `${selected.canonical}'s Schedule` : "Faculty Schedule"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected
                      ? `${selected.offerings.length} class${selected.offerings.length === 1 ? "" : "es"} · tap a slot for day, time & venue`
                      : "Search every faculty, or pick one to see their week"}
                  </p>
                </div>
              </div>
              <IconButton onClick={onClose} title="Close schedule">
                <X className="w-4 h-4" />
              </IconButton>
            </div>

            {selected ? (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to faculty list
            </button>

            {selected.names.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Also listed as
                </span>
                {selected.names.map((name) => (
                  <span
                    key={name}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/*
              The vertical grid is deliberate: it is the only renderer whose tap
              opens the slot detail sheet (day, time, course, venue). The sheet
              portals to <body> at its own z-55/60, which would sit behind this
              modal's z-300, so the z-index pair is raised to 400.
            */}
            <VerticalTimetableGrid
              courses={courses}
              theoryPeriods={periods.theory}
              labPeriods={periods.lab}
              days={DAYS}
              blockedSlots={new Set()}
              selectedGapDetails={null}
              backdropZIndex={400}
              panelZIndex={400}
            />

            <div className="overflow-x-auto rounded-xl border border-border custom-scrollbar">
              <table className="w-full text-left text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Slot</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Venue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.offerings.map((offering, index) => (
                    <tr key={`${offering.CODE}-${offering.SLOT}-${index}`} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-xs text-foreground">{offering.CODE}</span>
                        <span className="block text-xs text-muted-foreground truncate max-w-[220px]">
                          {offering.TITLE}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-foreground/80">{offering.TYPE}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-foreground/80">{offering.SLOT}</td>
                      <td className="py-2.5 px-3 text-xs text-foreground/80">{offering.ROOM || offering.VENUE || "TBA"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search faculty by name…"
                aria-label="Search faculty"
                className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            {loading ? (
              <ListSkeleton rows={5} leading="dot" />
            ) : filtered.length === 0 ? (
              <EmptyPanel
                icon={<CalendarDays className="h-7 w-7" />}
                tone="indigo"
                title={query ? "No faculty found" : "No course report loaded"}
                description={
                  query
                    ? `Nothing in the report matches “${query}”.`
                    : "Open the FFCS Planner once to load the course report, then come back."
                }
                action={
                  query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700 cursor-pointer"
                    >
                      Clear search
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {filtered.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedKey(group.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold shrink-0">
                      {group.canonical.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-foreground truncate">
                        {group.canonical}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {group.offerings.length} class{group.offerings.length === 1 ? "" : "es"}
                        {group.names.length > 1
                          ? ` · ${group.names.length} spelling${group.names.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Schedules come from the FFCS course report. A faculty member appears here only if they teach a class in it.
            </p>
          </div>
            )}
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}

export default FacultyScheduleModal;
