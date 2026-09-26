"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Clock, Calendar, Plus } from "lucide-react";
import { ATTENDANCE_DAYS, AttendanceDay } from "@/lib/attendanceTimetable";
import { detectChunkOverlaps } from "@/lib/taskMatch";
import type { Task, TaskKind, WeekChunk } from "@/types/tasks";
import { KIND_CONFIG } from "./TaskCard";

interface TaskWeekViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onNewTask: (day?: AttendanceDay) => void;
}

export default function TaskWeekView({
  tasks,
  onEdit,
  onNewTask,
}: TaskWeekViewProps) {
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const overlaps = useMemo(() => detectChunkOverlaps(tasks), [tasks]);

  // Map tasks by day
  const dayScheduleMap = useMemo(() => {
    const map: Record<AttendanceDay, { chunk: WeekChunk; task: Task }[]> = {
      MON: [],
      TUE: [],
      WED: [],
      THU: [],
      FRI: [],
      SAT: [],
      SUN: [],
    };

    activeTasks.forEach((task) => {
      (task.schedule || []).forEach((chunk) => {
        if (map[chunk.day]) {
          map[chunk.day].push({ chunk, task });
        }
      });
    });

    // Sort chunks within each day by start time
    Object.keys(map).forEach((d) => {
      map[d as AttendanceDay].sort((a, b) => a.chunk.start.localeCompare(b.chunk.start));
    });

    return map;
  }, [activeTasks]);

  return (
    <div className="space-y-4 text-left">
      {/* Overlap warnings banner */}
      {overlaps.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              {overlaps.length} schedule conflict{overlaps.length === 1 ? "" : "s"} detected across tasks.
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-md">
            Overlapping chunks
          </span>
        </div>
      )}

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {ATTENDANCE_DAYS.map((day) => {
          const items = dayScheduleMap[day];

          return (
            <div
              key={day}
              className="flex flex-col rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 p-3 min-h-[220px]"
            >
              {/* Day Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-outfit">
                  {day}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                  {items.length}
                </span>
              </div>

              {/* Day Chunks */}
              <div className="space-y-2 flex-1">
                {items.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-center">
                    <button
                      type="button"
                      onClick={() => onNewTask(day)}
                      className="text-[11px] font-bold text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      + Schedule
                    </button>
                  </div>
                ) : (
                  items.map(({ chunk, task }, idx) => {
                    const meta = KIND_CONFIG[task.kind] || KIND_CONFIG.homework;
                    const hasConflict = overlaps.some(
                      (o) =>
                        (o.taskA.id === task.id && o.chunkA === chunk) ||
                        (o.taskB.id === task.id && o.chunkB === chunk)
                    );

                    return (
                      <div
                        key={`${task.id}-${idx}`}
                        onClick={() => onEdit(task)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] bg-white dark:bg-zinc-850 shadow-2xs ${
                          hasConflict
                            ? "border-amber-500/50 ring-1 ring-amber-500/20"
                            : "border-zinc-200/80 dark:border-zinc-750"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                          <span className="flex items-center gap-1 font-semibold">
                            <Clock className="w-2.5 h-2.5 text-indigo-500" />
                            {chunk.start} – {chunk.end}
                          </span>
                          {hasConflict && (
                            <span className="text-amber-500 font-black">!</span>
                          )}
                        </div>

                        <h5 className="text-xs font-bold text-zinc-900 dark:text-white truncate font-outfit">
                          {task.title}
                        </h5>

                        <div className="flex items-center gap-1 mt-1.5">
                          <span
                            className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          {task.courseCode && (
                            <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded truncate">
                              {task.courseCode}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
