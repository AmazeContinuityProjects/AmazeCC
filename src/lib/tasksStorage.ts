import { storage } from "./storage";
import { parseAttendanceTime } from "./attendanceTimetable";
import {
  sanitizeCourseCode,
  toMinutes,
  getComponentType,
  taskMatchesClass,
  classTaskSummary,
  tasksForClass,
  tasksForDay,
  detectChunkOverlaps,
  suggestPomodoros,
  ClassTaskSummary,
  ChunkOverlap,
} from "./taskMatch";

export {
  sanitizeCourseCode,
  toMinutes,
  getComponentType,
  taskMatchesClass,
  classTaskSummary,
  tasksForClass,
  tasksForDay,
  detectChunkOverlaps,
  suggestPomodoros,
};
export type { ClassTaskSummary, ChunkOverlap };

import type {
  Task,
  TaskComponent,
  TaskKind,
  TaskStatus,
  WeekChunk,
  PomodoroSession,
} from "@/types/tasks";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}


/** Validate + normalize a task draft. Throws on invalid data. */

export function normalizeTask(input: Partial<Task> & { title: string }): Task {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");

  const reminders = Array.from(
    new Set(
      (input.reminders || [])
        .map((r) => new Date(r))
        .filter((d) => !isNaN(d.getTime()))
        .map((d) => d.toISOString())
    )
  ).sort();

  const schedule: WeekChunk[] = (input.schedule || []).map((c) => {
    if (!c.day || !c.start || !c.end) throw new Error("Schedule chunk needs day, start and end");
    const s = toMinutes(c.start);
    const e = toMinutes(c.end);
    if (s === null || e === null || s >= e) throw new Error(`Invalid chunk time: ${c.start}-${c.end}`);
    return { day: c.day, start: c.start, end: c.end };
  });

  let dueDate = input.dueDate;
  if (dueDate && isNaN(new Date(dueDate).getTime())) {
    throw new Error("Invalid due date");
  }

  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || uid(),
    title,
    kind: input.kind || "homework",
    status: input.status || "pending",
    courseCode: sanitizeCourseCode(input.courseCode || ""),
    component: input.component || "both",
    classNbr: input.classNbr,
    slotName: input.slotName,
    courseTitleSnapshot: input.courseTitleSnapshot,
    dueDate,
    reminders,
    schedule,
    pomodoro: input.pomodoro,
    moodleUrl: input.moodleUrl,
    notes: input.notes,
    createdAt,
    updatedAt: nowIso(),
    completedAt: input.completedAt,
  };
}

export function getTasks(): Task[] {
  try {
    return storage.tasks.get() || [];
  } catch {
    return [];
  }
}

function persistTasks(tasks: Task[]): Task[] {
  try {
    storage.tasks.set(tasks);
  } catch {}
  return tasks;
}

export function createTask(input: Partial<Task> & { title: string }): Task[] {
  const task = normalizeTask(input);
  return persistTasks([...getTasks(), task]);
}

export function updateTask(id: string, patch: Partial<Task>): Task[] {
  return persistTasks(
    getTasks().map((t) =>
      t.id === id ? normalizeTask({ ...t, ...patch, id, updatedAt: nowIso() } as Task) : t
    )
  );
}

export function cycleTaskStatus(id: string): Task[] {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return tasks;
  const order: TaskStatus[] = ["pending", "in_progress", "done"];
  const next = order[(order.indexOf(task.status) + 1) % order.length];
  return persistTasks(
    tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            status: next,
            completedAt: next === "done" ? nowIso() : undefined,
            updatedAt: nowIso(),
          }
        : t
    )
  );
}

export function deleteTask(id: string): Task[] {
  return persistTasks(getTasks().filter((t) => t.id !== id));
}

/** One-time migration of legacy CalendarView homework entries. */
export function migrateCustomHomework(): Task[] {
  const existing = getTasks();
  if (existing.length > 0) return existing;
  let raw: any = null;
  try {
    raw = storage.customHomework.get();
  } catch {
    return existing;
  }
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return existing;
  const migrated: Task[] = [];
  for (const hw of list) {
    try {
      migrated.push(
        normalizeTask({
          title: String(hw.text || hw.courseName || "Homework"),
          kind: "homework",
          courseCode: sanitizeCourseCode(hw.courseName || ""),
          dueDate: hw.dueDate ? new Date(hw.dueDate).toISOString() : undefined,
        })
      );
    } catch {}
  }
  return persistTasks(migrated);
}

// ---------------------------------------------------------------------------
// Pomodoro session logging
// ---------------------------------------------------------------------------


const MAX_SESSIONS = 200;

export function logPomodoroSession(
  session: Omit<PomodoroSession, "id">
): PomodoroSession[] {
  let list: PomodoroSession[] = [];
  try {
    list = storage.pomodoroSessions.get() || [];
  } catch {}
  const entry: PomodoroSession = { ...session, id: uid() };
  const next = [...list, entry].slice(-MAX_SESSIONS);
  try {
    storage.pomodoroSessions.set(next);
  } catch {}
  return next;
}

export type { Task, TaskComponent, TaskKind, TaskStatus, WeekChunk, PomodoroSession };
