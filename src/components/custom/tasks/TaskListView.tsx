"use client";

import React from "react";
import {
  AlertCircle,
  Calendar,
  Clock,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Plus,
} from "lucide-react";
import type { Task } from "@/types/tasks";
import { isTaskOverdue } from "@/types/tasks";
import TaskCard from "./TaskCard";

interface TaskListViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onStatusCycle: (id: string) => void;
  onDelete: (id: string) => void;
  onNewTask: () => void;
}

export default function TaskListView({
  tasks,
  onEdit,
  onStatusCycle,
  onDelete,
  onNewTask,
}: TaskListViewProps) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000;
  const endOfWeek = startOfToday + 7 * 86400000;

  // Grouping
  const overdue: Task[] = [];
  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const noDueDate: Task[] = [];
  const completed: Task[] = [];

  for (const t of tasks) {
    if (t.status === "done") {
      completed.push(t);
      continue;
    }
    if (!t.dueDate) {
      noDueDate.push(t);
      continue;
    }
    const dueTime = new Date(t.dueDate).getTime();
    if (isNaN(dueTime)) {
      noDueDate.push(t);
      continue;
    }

    if (dueTime < Date.now()) {
      overdue.push(t);
    } else if (dueTime >= startOfToday && dueTime < endOfToday) {
      today.push(t);
    } else if (dueTime >= endOfToday && dueTime < endOfWeek) {
      thisWeek.push(t);
    } else {
      later.push(t);
    }
  }

  const groups = [
    {
      id: "overdue",
      title: "Overdue",
      icon: AlertCircle,
      tasks: overdue,
      color: "text-red-500",
      hideIfEmpty: true,
    },
    {
      id: "today",
      title: "Due Today",
      icon: Clock,
      tasks: today,
      color: "text-amber-500",
      hideIfEmpty: false,
    },
    {
      id: "this_week",
      title: "This Week",
      icon: Calendar,
      tasks: thisWeek,
      color: "text-indigo-500",
      hideIfEmpty: false,
    },
    {
      id: "later",
      title: "Upcoming",
      icon: CalendarDays,
      tasks: later,
      color: "text-blue-500",
      hideIfEmpty: false,
    },
    {
      id: "no_date",
      title: "No Due Date",
      icon: CalendarCheck,
      tasks: noDueDate,
      color: "text-zinc-400",
      hideIfEmpty: false,
    },
    {
      id: "completed",
      title: "Completed",
      icon: CheckCircle2,
      tasks: completed,
      color: "text-emerald-500",
      hideIfEmpty: true,
    },
  ];

  return (
    <div className="space-y-6 text-left">
      {groups.map((grp) => {
        if (grp.hideIfEmpty && grp.tasks.length === 0) return null;
        const Icon = grp.icon;

        return (
          <div key={grp.id} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${grp.color}`} />
                <h3 className="font-outfit font-black text-sm text-zinc-900 dark:text-white">
                  {grp.title}
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                  {grp.tasks.length}
                </span>
              </div>
            </div>

            {grp.tasks.length === 0 ? (
              <div className="py-4 px-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-850 text-xs font-medium text-zinc-400 text-center">
                No tasks {grp.title.toLowerCase()}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {grp.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onStatusCycle={onStatusCycle}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
