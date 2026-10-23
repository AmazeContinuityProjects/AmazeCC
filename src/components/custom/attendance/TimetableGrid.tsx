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

  const uniqueCourses = useMemo(
    () => (attendance || []).filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.courseCode === c.courseCode) === i),
    [attendance]
  );

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

        {/* Course Reference Section */}
        {uniqueCourses.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/80 dark:bg-[#03070e]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800/80 dark:bg-zinc-900">
              <h3 className="font-outfit text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Course Reference
              </h3>
            </div>
            <div className="scrollbar-thin w-full overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-150 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:bg-zinc-950 dark:text-gray-500">
                      Course
                    </th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Faculty
                    </th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Slots
                    </th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Venue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                  {uniqueCourses.map((c: any, i: number) => (
                    <tr
                      key={`${c.courseCode}-${i}`}
                      className="bg-white transition-colors hover:bg-gray-55 dark:bg-[#030507] dark:hover:bg-[#0a1825]"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5 dark:bg-[#030507]">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-blue-800">
                            {c.courseCode}
                          </span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                            {c.courseTitle}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {c.courseType ||
                            (String(c.slotName || "").startsWith("L") ? "Lab" : "Theory")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                        {c.faculty}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {String(c.slotName || "")
                            .split("+")
                            .map((s: string, si: number) => (
                              <span
                                key={si}
                                className="rounded border border-gray-250/60 bg-gray-100 px-1 py-0.5 text-[9px] font-semibold dark:border-gray-800 dark:bg-[#0d1f2e]"
                              >
                                {s.trim()}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                        {c.slotVenue || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
