"use client";

import React from "react";
import { Plus, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import type { Task, TaskStatus } from "@/types/tasks";
import TaskCard from "./TaskCard";

interface KanbanViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onStatusCycle: (id: string) => void;
  onDelete: (id: string) => void;
  onNewTask: (status?: TaskStatus) => void;
}

const COLUMNS: { id: TaskStatus; title: string; icon: React.ElementType; color: string }[] = [
  {
    id: "pending",
    title: "Pending",
    icon: Clock,
    color: "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
  },
  {
    id: "in_progress",
    title: "In Progress",
    icon: PlayCircle,
    color: "border-indigo-500 text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "done",
    title: "Done",
    icon: CheckCircle2,
    color: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  },
];

export default function KanbanView({
  tasks,
  onEdit,
  onStatusCycle,
  onDelete,
  onNewTask,
}: KanbanViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-[24px] bg-zinc-100/70 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 p-3 sm:p-4 min-h-[300px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 px-1">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${col.color}`} />
                <h3 className="font-outfit font-black text-sm text-zinc-900 dark:text-white">
                  {col.title}
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                  {colTasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNewTask(col.id)}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
                title={`Add ${col.title} task`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Task Cards Column */}
            <div className="space-y-2.5 flex-1">
              {colTasks.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center p-4">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                    No {col.title.toLowerCase()} tasks
                  </p>
                  <button
                    type="button"
                    onClick={() => onNewTask(col.id)}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Add Task
                  </button>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onStatusCycle={onStatusCycle}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
