"use client";

import React from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertCircle,
  BookOpen,
  Edit2,
  Trash2,
  Timer,
  ChevronRight,
  Layers,
} from "lucide-react";
import type { Task, TaskKind } from "@/types/tasks";
import { isTaskOverdue } from "@/types/tasks";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onStatusCycle?: (id: string) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export const KIND_CONFIG: Record<
  TaskKind,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  test: {
    label: "Test",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: AlertCircle,
  },
  "digital-assignment": {
    label: "Digital Assignment",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: BookOpen,
  },
  homework: {
    label: "Homework",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    icon: Layers,
  },
  study: {
    label: "Study",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: BookOpen,
  },
  reminder: {
    label: "Reminder",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: Clock,
  },
};

export default function TaskCard({
  task,
  onEdit,
  onStatusCycle,
  onDelete,
  compact = false,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task);
  const kindMeta = KIND_CONFIG[task.kind] || KIND_CONFIG.homework;
  const KindIcon = kindMeta.icon;

  const formatDueDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      onClick={() => onEdit(task)}
      className="group relative rounded-2xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 p-3.5 shadow-2xs hover:shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer text-left"
    >
      <div className="flex items-start justify-between gap-2.5">
        {/* Cycle status checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusCycle?.(task.id);
          }}
          className="mt-0.5 shrink-0 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          title={`Status: ${task.status}. Click to advance.`}
        >
          {task.status === "done" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : task.status === "in_progress" ? (
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin-slow flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
          ) : (
            <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400" />
          )}
        </button>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {/* Kind badge */}
            <span
              className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${kindMeta.badgeClass}`}
            >
              <KindIcon className="w-2.5 h-2.5" />
              {kindMeta.label}
            </span>

            {/* Course Code chip */}
            {task.courseCode && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                {task.courseCode}
                {task.component !== "both" && (
                  <span className="opacity-70 ml-1 uppercase text-[8.5px]">
                    ({task.component})
                  </span>
                )}
              </span>
            )}

            {/* Overdue chip */}
            {overdue && (
              <span className="text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded bg-red-500 text-white shrink-0 animate-pulse">
                Overdue
              </span>
            )}
          </div>

          {/* Title */}
          <h4
            className={`text-sm font-bold leading-tight font-outfit text-zinc-900 dark:text-white break-words ${
              task.status === "done" ? "line-through opacity-60" : ""
            }`}
          >
            {task.title}
          </h4>

          {/* Notes summary if any */}
          {task.notes && !compact && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-1 font-medium">
              {task.notes}
            </p>
          )}

          {/* Metadata row: due date, chunks, pomodoro */}
          <div className="flex items-center gap-2.5 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  overdue ? "text-red-600 dark:text-red-400 font-bold" : ""
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDueDate(task.dueDate)}
              </span>
            )}

            {task.schedule && task.schedule.length > 0 && (
              <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                <Clock className="w-3 h-3" />
                {task.schedule.length} {task.schedule.length === 1 ? "chunk" : "chunks"}
              </span>
            )}

            {task.pomodoro && (
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Timer className="w-3 h-3" />
                {task.pomodoro.rounds}×{task.pomodoro.focusMin}m
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Edit task"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete task "${task.title}"?`)) {
                  onDelete(task.id);
                }
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
