"use client";

/**
 * The same-slot faculty picker, summoned from the preview's Selected Courses
 * table.
 *
 * Tapping a course's Faculty cell asks a question the variant sheet only
 * answers across a whole timetable: who else teaches *this course* at *this
 * exact time*? This sheet lists those people straight from the master report
 * and hands the tapped course to the one chosen — same slot tokens, same
 * periods, so every metric the preview displays stays true.
 *
 * It is the option-picker shape — a search field, one tap to commit,
 * swipe-down to back out — rendered as a sheet, because the plain
 * `OptionPicker` popover paints at z-70, beneath the generator's fullscreen
 * z-100 layer. The z pair (220/215) and the layout mirror the variant search
 * sheet it sits beside.
 */

import React, { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import SearchInput from "../../../shared/SearchInput";
import { sameSlotFacultyAlternatives } from "../logic/generate";
import { offeringId } from "../reports";
import type { AddedCourse, ParsedCourse } from "../types";

interface SlotFacultySwapSheetProps {
  /** The clicked row's course code. */
  code: string;
  /** The clicked row's title, for the subtitle. */
  courseTitle: string;
  /**
   * The unmerged courses behind the clicked row — usually one embedded
   * offering; two halves when a code's theory and lab run as separate rows.
   */
  halves: AddedCourse[];
  masterCourses: ParsedCourse[];
  /** Hand `courseId` to `offering`'s faculty at the same slots. */
  onSwap: (courseId: string, offering: ParsedCourse) => void;
  onClose: () => void;
}

export default function SlotFacultySwapSheet({
  code,
  courseTitle,
  halves,
  masterCourses,
  onSwap,
  onClose,
}: SlotFacultySwapSheetProps) {
  const [query, setQuery] = useState("");

  // One block per underlying course: its current teacher and slot chips, then
  // the same-slot alternatives from the report. Re-derived on every keystroke,
  // which is what the search needs — the master list is small.
  const blocks = useMemo(
    () =>
      halves.map((half) => ({
        half,
        matches: sameSlotFacultyAlternatives(
          half.code,
          half.slots,
          { faculty: half.faculty, employeeId: half.employeeId },
          masterCourses
        ).filter((o) =>
          query ? o.FACULTY.toLowerCase().includes(query.toLowerCase()) : true
        ),
      })),
    [halves, masterCourses, query]
  );

  const totalMatches = blocks.reduce((n, b) => n + b.matches.length, 0);

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-generator-slot-faculty"
      maxWidth="max-w-lg"
      panelZIndex={220}
      backdropZIndex={215}
      contentClassName="flex flex-col gap-3"
      title="Switch Faculty"
      subtitle={`${code} — ${courseTitle}`}
      icon={<Users className="w-5 h-5 text-blue-400" />}
    >
      <p className="text-xs text-muted-foreground">
        Everyone below teaches this course at the exact same time slot — a swap
        changes the teacher only.
      </p>

      <SearchInput
        placeholder="Search by faculty name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-3 focus:border-amber-500/50 placeholder:text-muted-foreground"
      />

      <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
        {blocks.map(({ half, matches }, i) => (
          <div
            key={half.id}
            className={`flex flex-col gap-1.5 px-2 py-2 ${
              i > 0 ? "border-t border-border-strong/40 mt-1" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Current:{" "}
                <span className="font-semibold text-text-heading">
                  {half.faculty}
                </span>
              </span>
              <span className="flex flex-wrap gap-1 justify-end">
                {half.slots.map((s) => (
                  <span
                    key={s}
                    className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md"
                  >
                    {s}
                  </span>
                ))}
              </span>
            </div>

            <div className="flex flex-col">
              {matches.map((off) => (
                <button
                  key={offeringId(off)}
                  type="button"
                  onClick={() => onSwap(half.id, off)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 my-0.5 rounded-xl transition-colors border border-transparent hover:bg-surface-secondary/80 text-left"
                >
                  <span className="font-bold text-sm text-text-heading truncate">
                    {off.FACULTY}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {off.ROOM || (off.ERP_ID ? `ERP ${off.ERP_ID}` : "TBA")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {totalMatches === 0 && (
          <div className="text-center py-8 flex flex-col items-center justify-center border border-dashed border-border-strong/50 rounded-xl m-2">
            {query ? (
              <>
                <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <span className="text-muted-foreground font-medium">
                  No faculty matches &ldquo;{query}&rdquo;
                </span>
                <span className="text-xs text-muted-foreground/70 mt-1">
                  Clear the search to see everyone.
                </span>
              </>
            ) : (
              <>
                <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <span className="text-muted-foreground font-medium">
                  No other faculty at this time slot
                </span>
                <span className="text-xs text-muted-foreground/70 mt-1">
                  The current teacher is the only choice here.
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
