"use client";

import React from "react";
import { Plus, LayoutGrid, Sparkles, BookOpen, AlertTriangle } from "lucide-react";
import Badge from "../../shared/Badge";

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-zinc-900/60 p-2.5 sm:p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs backdrop-blur-md">
      {/* Scrollable Course Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
        <button
          onClick={() => onToggleViewMode("matrix")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
            viewMode === "matrix"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/80"
          }`}
          title="View all courses summary matrix"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>All Courses</span>
          <span className="ml-0.5 px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-extrabold">
            {courses.length}
          </span>
        </button>

        <div className="h-5 w-px bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0" />

        {courses.map((c) => {
          const isSelected = viewMode === "individual" && activeCourseCode === c.courseCode;
          const pointsLost = c.pointsLost ?? 0;
          const maxPossible = c.maxPossible ?? 100;

          return (
            <button
              key={c.courseCode}
              onClick={() => {
                onToggleViewMode("individual");
                onSelectCourse(c.courseCode);
              }}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-zinc-800"
              }`}
            >
              <div className="text-left min-w-0">
                <p className="font-outfit font-black tracking-tight">{c.courseCode}</p>
                <p
                  className={`text-[9px] truncate max-w-[110px] ${
                    isSelected ? "text-indigo-100 font-medium" : "text-zinc-400 dark:text-zinc-500 font-medium"
                  }`}
                >
                  {c.courseTitle}
                </p>
              </div>

              {pointsLost > 0 ? (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                    isSelected
                      ? "bg-rose-500/30 text-rose-100"
                      : pointsLost > 15
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                  title={`Points Lost: -${pointsLost.toFixed(1)}`}
                >
                  -{pointsLost.toFixed(1)}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                    isSelected ? "bg-emerald-500/30 text-emerald-100" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                  title="100% max possible"
                >
                  100%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Custom / Mock Subject */}
      <button
        onClick={onOpenAddCustomCourse}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-black shrink-0 transition-all cursor-pointer"
        title="Add a hypothetical or custom subject to predict"
      >
        <Plus className="w-3.5 h-3.5 text-indigo-500" />
        <span>Add Subject</span>
      </button>
    </div>
  );
}
