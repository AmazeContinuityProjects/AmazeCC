"use client";

/**
 * The attendance timetable sheet.
 *
 * Derives a `theoryPeriods` / `labPeriods` skeleton out of `config.json` and
 * hands it to the common `TimetableView`, which decides between the vertical
 * mobile heatmap and the full horizontal grid. This file owns only the two
 * things that are genuinely attendance-specific: the VTOP-to-courses conversion
 * (with its stable per-course colours) and the export buttons.
 *
 * ## What was removed
 *
 * The previous version carried a second, never-called copy of the grid
 * (`renderTraditionalGrid`), a `grid[day][slot]` matrix that only that copy
 * read, six unused class-name constants, an unused `fmtRange`, an unused
 * `buildCell`, and a `beforeLunch` / `afterLunch` split computed and thrown
 * away. All of it is now the one shared component.
 *
 * The period projection itself is unchanged and is still the one place the
 * day-scoped `slotMap` is walked directly: Monday supplies the skeleton, every
 * other day is projected onto it by matching **time strings**, with a ±7 minute
 * start-time fallback.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Printer } from "lucide-react";
import type { AddedCourse } from "@amazecontinuityprojects/amazeui";
import config from "../../../../config.json";
import {
  downloadTimetableImage,
  exportableHtml,
  openTimetablePrintablePage,
} from "@/lib/exportTimetable";
import { useTheme } from "next-themes";
import { TimetableView, type AttendanceTone } from "../timetable";
import { buildPeriodSkeleton } from "../timetable/periodSkeleton";

/**
 * The planner's own course list, shared rather than copied.
 *
 * It already renders a card list under `md` and a table above it, so the
 * attendance sheet gets a usable phone layout for free — the hand-rolled
 * `min-w-[700px]` table this replaces could not be read without scrolling
 * sideways on a phone. Loaded lazily, exactly as the FFCS tab loads it, so
 * its vitfac dependency stays out of the home route's initial bundle.
 */
const SelectedCoursesList = dynamic(
  () => import("../exams/FFCS/components/SelectedCoursesList"),
  { ssr: false }
);

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * One colour per course code, assigned on first appearance and then memoised in
 * `colorMap` so every row of the same course shares a fill. The other two
 * timetables assign by array position, which reshuffles when a course is
 * removed.
 */
const ATT_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-500", "bg-red-600",
  "bg-amber-500", "bg-pink-500", "bg-indigo-600", "bg-teal-500",
  "bg-cyan-600", "bg-fuchsia-500", "bg-lime-500", "bg-rose-600",
];

function convertToAddedCourses(data: any[]): AddedCourse[] {
  const colorMap: Record<string, string> = {};
  let colorIdx = 0;
  return (data || []).map((c: any) => {
    const code = c.courseCode || "";
    if (!colorMap[code]) colorMap[code] = ATT_COLORS[colorIdx++ % ATT_COLORS.length];
    return {
      id: `att-${code}`,
      code,
      title: c.courseTitle || "",
      slots: String(c.slotName || "")
        .split("+")
        .map((s: string) => s.trim())
        .filter(Boolean),
      faculty: c.faculty || "",
      venue: c.slotVenue || "",
      credits: c.credits || "0",
      type: c.courseType || "",
      color: colorMap[code],
    };
  });
}

export default function TimetableVtop({ attendance }: { attendance?: any[] }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";
  const rootStyles =
    typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
  const themeTextColor =
    rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
  const themeHtmlClass =
    typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

  const slotMap = useMemo(() => config.slotMap || {}, []);

  const handlePrint = useCallback(() => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      const el = captureRef.current;
      const originalOverflow = el.style.overflowX;
      el.style.overflowX = "visible";
      el.classList.add("w-max", "min-w-full");

      openTimetablePrintablePage(
        exportableHtml(el),
        "Timetable",
        themeHtmlClass,
        themeBgColor,
        themeTextColor
      );

      el.style.overflowX = originalOverflow;
      el.classList.remove("w-max", "min-w-full");
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  }, [themeHtmlClass, themeBgColor, themeTextColor]);

  const handleDownloadImage = useCallback(async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      await downloadTimetableImage(captureRef.current, "Timetable", themeBgColor, "png");
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  }, [themeBgColor]);

  /* ---------------------------------------------------------------- *
   * Period skeleton
   * ---------------------------------------------------------------- */

  const { theoryPeriods, labPeriods } = useMemo(() => {
    // The one projection of `config.json` onto a period skeleton. The social
    // grid draws the same week through the same skeleton, so it lives in one
    // place — see `timetable/periodSkeleton.ts`.
    const skeleton = buildPeriodSkeleton(slotMap);
    return { theoryPeriods: skeleton.theoryPeriods, labPeriods: skeleton.labPeriods };
  }, [slotMap]);

  const addedCourses = useMemo(() => convertToAddedCourses(attendance || []), [attendance]);

  /**
   * One row per course code, for the shared course list.
   *
   * `SelectedCoursesList` merges the rows it is given per code and *sums*
   * their credits — correct for the planner, where a theory half and a lab
   * half each carry their own share, but attendance rows each carry the
   * course's full credit, so passing them straight in would double-count a
   * course that runs as both. The list's own grouper still does the merging;
   * this only guarantees it sees each course once.
   */
  const uniqueAddedCourses = useMemo(() => {
    const seen = new Set<string>();
    return addedCourses.filter((c) => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });
  }, [addedCourses]);

  /** Feeds the vertical cell sheet, which the planner has no equivalent of. */
  const attendanceByCourse = useMemo(() => {
    const map: Record<string, AttendanceTone> = {};
    (attendance || []).forEach((c: any) => {
      const pct = parseInt(c.attendancePercentage);
      if (!Number.isFinite(pct)) return;
      // Same thresholds as `lib/attendanceTimetable.ts`.
      map[c.courseCode] = {
        percentage: String(pct),
        cls: pct < 50 ? "low" : pct < 75 ? "medium" : "high",
      };
    });
    return map;
  }, [attendance]);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-gray-150 pb-3 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <h2 className="font-outfit text-lg font-black text-gray-900 dark:text-gray-100">
            Class Schedule
          </h2>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            View course slots, venues, and export the full grid.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="cursor-pointer rounded-lg bg-emerald-600 p-2 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            title="Download PNG"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={handlePrint}
            disabled={isDownloading}
            className="cursor-pointer rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            title="Print / PDF"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timetable Contents — captureRef spans the grid and the reference table,
          and the view switcher inside TimetableView is marked export chrome. */}
      <div ref={captureRef} className="w-full max-w-full space-y-6">
        <TimetableView
          courses={addedCourses}
          theoryPeriods={theoryPeriods}
          labPeriods={labPeriods}
          days={DAYS.map((d) => ({ id: d.toLowerCase(), name: d }))}
          attendanceByCourse={attendanceByCourse}
          className="w-full"
        />

        {/* Course Reference — the planner's own list, shared rather than a
            second copy of it. Its `md` breakpoint is the phone split: cards
            under it, the table above, so this reads on a phone without the
            sideways scroll the old fixed-width table forced. */}
        {uniqueAddedCourses.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/80 dark:bg-[#03070e]">
            <div className="p-4">
              <SelectedCoursesList
                courses={uniqueAddedCourses}
                title="Course Reference"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
