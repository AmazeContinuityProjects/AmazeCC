"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, CalendarDays, ChevronRight, Search, Users, X, ExternalLink } from "lucide-react";

import { VerticalTimetableGrid } from "../../../../timetable";
import BottomSheet from "../../../../shared/BottomSheet";
import { DAYS } from "../../constants";
import {
  facultyGroupToAddedCourses,
  facultySchedulePeriods,
  findFirstMatchingGroup,
  type FacultyNameGroup,
  type FacultyOffering,
} from "../../logic/facultyGroups";
import { sameSlotFacultyAlternatives, splitSlots } from "../../logic/generate";
import type { ParsedCourse } from "../../types";
import { EmptyPanel, IconButton, ListSkeleton } from "../../../../shared/primitives";
import { VitfacReviewPill, FacultyAvatar } from "../FacultyAvatar";
import FacultyReviewSheetHost from "../FacultyReviewSheetHost";
import { ENABLE_VITFAC_INTEGRATION } from "@/lib/vitfacService";
import dynamic from "next/dynamic";
import { useFacultyReviewSheet } from "../../hooks/useFacultyReviewSheet";

/*
 * Both sheets are interaction-only, so their code stays out of this modal's
 * own chunk and downloads the moment the student actually opens one —
 * instead of riding along the moment the modal itself loads.
 */
const SlotFacultySwapSheet = dynamic(() => import("../SlotFacultySwapSheet"), { ssr: false });

/**
 * The faculty schedule browser.
 *
 * Two screens in one modal: a list of the faculty name groups the FFCS report
 * produced, and the full week one group teaches. The same component backs both
 * entry points — the planner opens it on the whole list, while the Faculty
 * Explorer opens it with `initialFaculty` and lands straight on the schedule of
 * the first group whose names match that directory entry.
 *
 * The modal speaks the planner's dialect (`bg-surface` / `border-border-strong` /
 * `text-text-heading`) because the timetable grid and the planner are that
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
  /** Master parsed courses list if available from caller */
  masterCourses?: ParsedCourse[];
}

export function FacultyScheduleModal({
  open,
  onClose,
  groups,
  initialFaculty,
  loading = false,
  masterCourses,
}: FacultyScheduleModalProps) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const {
    target: reviewTarget,
    open: openFacultyReview,
    close: closeFacultyReview,
  } = useFacultyReviewSheet();
  const [selectedSwapOffering, setSelectedSwapOffering] = useState<FacultyOffering | null>(null);
  const autoSelectedRef = useRef(false);

  const allMasterCourses: ParsedCourse[] = useMemo(() => {
    if (masterCourses && masterCourses.length > 0) return masterCourses;
    return groups.flatMap((group) =>
      group.offerings.map((off) => ({
        CODE: off.CODE,
        TITLE: off.TITLE,
        TYPE: off.TYPE,
        CREDITS: off.CREDITS,
        SLOT: off.SLOT,
        VENUE: off.VENUE || off.ROOM || "TBA",
        ROOM: off.ROOM || off.VENUE || "TBA",
        FACULTY: off.FACULTY,
        ERP_ID: off.ERP_ID,
      }))
    );
  }, [groups, masterCourses]);

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
            <div className="p-4 sm:p-5 border border-border-strong rounded-2xl flex items-center justify-between gap-3 bg-surface-secondary/40">
              <div className="flex items-center gap-3 min-w-0">
                {selected ? (
                  <FacultyAvatar
                    employeeId={selected.offerings.find((o) => o.ERP_ID)?.ERP_ID}
                    name={selected.canonical}
                    size="md"
                    tone="blue"
                  />
                ) : (
                  <div className="p-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-text-heading truncate">
                      {selected ? `${selected.canonical}'s Schedule` : "Faculty Schedule"}
                    </h2>
                    {selected && (
                      <VitfacReviewPill
                        employeeId={selected.offerings.find((o) => o.ERP_ID)?.ERP_ID}
                        name={selected.canonical}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFacultyReview({
                            name: selected.canonical,
                            employeeId: selected.offerings.find((o) => o.ERP_ID)?.ERP_ID,
                          });
                        }}
                      />
                    )}
                  </div>
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
              className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-text-heading transition-colors cursor-pointer"
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
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-secondary text-text-heading border border-border-strong"
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

            <div className="overflow-x-auto rounded-xl border border-border-strong custom-scrollbar">
              <table className="w-full text-left text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-border-strong bg-surface-secondary/40">
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Slot</th>
                    <th className="py-2.5 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Venue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.offerings.map((offering, index) => {
                    const slotTokens = splitSlots(offering.SLOT);
                    const alts = sameSlotFacultyAlternatives(
                      offering.CODE,
                      slotTokens,
                      { faculty: offering.FACULTY, employeeId: offering.ERP_ID },
                      allMasterCourses
                    );
                    const count = 1 + alts.length;
                    const countTitle =
                      count === 1
                        ? "1 faculty teaching this slot"
                        : `${count} faculties teaching this slot · Click to view`;

                    return (
                      <tr key={`${offering.CODE}-${offering.SLOT}-${index}`} className="hover:bg-surface-secondary/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-xs text-text-heading">{offering.CODE}</span>
                          <span className="block text-xs text-muted-foreground truncate max-w-[220px]">
                            {offering.TITLE}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-text-heading/80">{offering.TYPE}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-text-heading/80">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{offering.SLOT}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedSwapOffering(offering)}
                              title={countTitle}
                              className="relative hit-expand inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground hover:text-amber-500 hover:border-amber-500/40 transition-colors shrink-0 cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-amber-500 shrink-0" />
                              <span>{count}</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-text-heading/80">{offering.ROOM || offering.VENUE || "TBA"}</td>
                      </tr>
                    );
                  })}
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
                className="w-full bg-surface border border-border-strong rounded-xl pl-11 pr-4 py-2.5 text-sm text-text-heading focus:outline-none focus:border-blue-500/50 transition-colors"
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
              <div className="rounded-xl border border-border-strong overflow-hidden divide-y divide-border">
                {filtered.map((group) => {
                  const empId = group.offerings.find((o) => o.ERP_ID)?.ERP_ID;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedKey(group.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary/30 transition-colors cursor-pointer"
                    >
                      <FacultyAvatar
                        employeeId={empId}
                        name={group.canonical}
                        size="sm"
                        tone="blue"
                      />
                      <span className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-text-heading truncate">
                            {group.canonical}
                          </span>
                          <VitfacReviewPill
                            employeeId={empId}
                            name={group.canonical}
                            onClick={(e) => {
                              e.stopPropagation();
                              openFacultyReview({
                                name: group.canonical,
                                employeeId: empId,
                              });
                            }}
                          />
                        </div>
                        <span className="block text-xs text-muted-foreground truncate">
                          {group.offerings.length} class{group.offerings.length === 1 ? "" : "es"}
                          {group.names.length > 1
                            ? ` · ${group.names.length} spelling${group.names.length === 1 ? "" : "s"}`
                            : ""}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
              <span>Schedules come from the FFCS course report. A faculty member appears here only if they teach a class in it.</span>
              {ENABLE_VITFAC_INTEGRATION && (
                <a
                  href="https://vitfac.pages.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  <span>Leave a review on vitfac</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
            )}
          </div>

          <FacultyReviewSheetHost
            target={reviewTarget}
            onClose={closeFacultyReview}
          />

          <AnimatePresence>
            {selectedSwapOffering && (
              <SlotFacultySwapSheet
                code={selectedSwapOffering.CODE}
                courseTitle={selectedSwapOffering.TITLE}
                halves={[
                  {
                    id: `fac-sched-${selectedSwapOffering.CODE}-${selectedSwapOffering.SLOT}`,
                    code: selectedSwapOffering.CODE,
                    title: selectedSwapOffering.TITLE,
                    type: selectedSwapOffering.TYPE,
                    credits: selectedSwapOffering.CREDITS,
                    slots: splitSlots(selectedSwapOffering.SLOT),
                    venue: selectedSwapOffering.ROOM || selectedSwapOffering.VENUE || "TBA",
                    faculty: selectedSwapOffering.FACULTY,
                    employeeId: selectedSwapOffering.ERP_ID,
                    color: "bg-blue-500",
                  },
                ]}
                masterCourses={allMasterCourses}
                onClose={() => setSelectedSwapOffering(null)}
                backdropZIndex={450}
                panelZIndex={455}
              />
            )}
          </AnimatePresence>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}

export default FacultyScheduleModal;
