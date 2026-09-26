"use client";

import React, { useState, useMemo } from "react";
import { useAtom } from "jotai";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  ChevronDown,
  History,
  ArrowRight,
} from "lucide-react";
import { pomodoroSessionsAtom } from "@/store/dataAtoms";
import { getTodayAttendanceDay } from "@/lib/attendanceTimetable";
import type { Task } from "@/types/tasks";
import PomodoroTimer from "./PomodoroTimer";
import { KIND_CONFIG } from "./TaskCard";

interface FocusPageProps {
  tasks: Task[];
  onCycleStatus: (id: string) => void;
  onEditTask: (task: Task) => void;
}

export default function FocusPage({
  tasks,
  onCycleStatus,
  onEditTask,
}: FocusPageProps) {
  const [sessions] = useAtom(pomodoroSessionsAtom);
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    activeTasks[0]?.id || ""
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Today's scheduled chunks
  const today = getTodayAttendanceDay();
  const todayUpcomingChunks = useMemo(() => {
    const list: { task: Task; start: string; end: string }[] = [];
    activeTasks.forEach((t) => {
      (t.schedule || []).forEach((c) => {
        if (c.day === today) {
          list.push({ task: t, start: c.start, end: c.end });
        }
      });
    });
    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [activeTasks, today]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      {/* Task Selector & Hero Card */}
      <div className="rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-outfit">
              Distraction-Free Focus
            </span>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white font-outfit">
              {selectedTask ? selectedTask.title : "Standalone Focus Mode"}
            </h3>
          </div>

          {/* Quick task picker dropdown */}
          <div className="relative min-w-48">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full text-xs font-bold rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer pr-8"
            >
              <option value="">Standalone (No task bound)</option>
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.courseCode ? `(${t.courseCode})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Selected Task Details Pill */}
        {selectedTask && (
          <div className="mb-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {selectedTask.courseCode && (
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 shrink-0">
                  {selectedTask.courseCode}
                </span>
              )}
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {selectedTask.notes || "No notes"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onCycleStatus(selectedTask.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all cursor-pointer shrink-0 border border-emerald-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </button>
          </div>
        )}

        {/* Pomodoro Timer */}
        <PomodoroTimer
          task={selectedTask}
          onSessionComplete={() => {}}
        />
      </div>

      {/* Up Next From Today's Chunks */}
      {todayUpcomingChunks.length > 0 && (
        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Up Next Today ({today})
            </span>
            <span className="text-[10px] text-zinc-400">
              {todayUpcomingChunks.length} scheduled slots
            </span>
          </div>

          <div className="space-y-2">
            {todayUpcomingChunks.map(({ task, start, end }, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedTaskId(task.id)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer ${
                  selectedTaskId === task.id
                    ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/40 text-indigo-900 dark:text-indigo-200"
                    : "bg-white dark:bg-zinc-800 border-zinc-200/70 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-zinc-500 shrink-0">
                    {start} – {end}
                  </span>
                  <span className="font-bold truncate">{task.title}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800/70 p-4 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            Recent Focus Sessions
          </span>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {sessions.slice(-3).reverse().map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {s.roundsDone} rounds ({s.roundsDone * s.focusMin}m focus)
                  </span>
                  <p className="text-[10.5px] text-zinc-400">
                    {new Date(s.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
