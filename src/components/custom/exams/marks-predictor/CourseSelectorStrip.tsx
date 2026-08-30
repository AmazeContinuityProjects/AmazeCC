"use client";

import React from "react";
import { Plus, LayoutGrid } from "lucide-react";

export interface EnrolledCourseItem {
  courseCode: string;
  courseTitle: string;
  courseType: string;
  credits: number;
  theoryCourse?: any;
  labCourse?: any;
  isCustom?: boolean;
  maxPossible?: number;
  pointsLost?: number;
}

interface CourseSelectorStripProps {
  courses: EnrolledCourseItem[];
  activeCourseCode: string;
  onSelectCourse: (courseCode: string) => void;
  viewMode: "individual" | "matrix";
  onToggleViewMode: (mode: "individual" | "matrix") => void;
  onOpenAddCustomCourse: () => void;
}

export default function CourseSelectorStrip({
  courses,
  activeCourseCode,
  onSelectCourse,
  viewMode,
  onToggleViewMode,
  onOpenAddCustomCourse,
}: CourseSelectorStripProps) {
  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col gap-2.5 bg-white/80 dark:bg-zinc-900/70 p-2.5 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
      {/* Pills row — horizontally scrollable, never forces viewport overflow */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1 min-w-0">
        <button
          onClick={() => onToggleViewMode("matrix")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer whitespace-nowrap ${
            viewMode === "matrix"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/80"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          <span>All</span>
          <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-extrabold">{courses.length}</span>
        </button>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {courses.map((c) => {
          const isSelected = viewMode === "individual" && activeCourseCode === c.courseCode;
          const pointsLost = c.pointsLost ?? 0;

          return (
            <button
              key={c.courseCode}
              onClick={() => {
                onToggleViewMode("individual");
                onSelectCourse(c.courseCode);
              }}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border whitespace-nowrap ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-zinc-800"
              }`}
            >
              <span className="font-outfit font-black tracking-tight">{c.courseCode}</span>
              {pointsLost > 0 ? (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                    isSelected
                      ? "bg-rose-500/30 text-rose-100"
                      : pointsLost > 15
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  -{pointsLost.toFixed(1)}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                    isSelected ? "bg-emerald-500/30 text-emerald-100" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  100%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenAddCustomCourse}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-black transition-all cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span>Add Subject</span>
      </button>
    </div>
  );
}
