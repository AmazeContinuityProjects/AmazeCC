import type { AttendanceDay } from "@/lib/attendanceTimetable";

export type TaskStatus = "pending" | "in_progress" | "done";

export type TaskKind =
  | "homework"
  | "reminder"
  | "digital-assignment"
  | "study"
  | "test";

export type TaskComponent = "theory" | "lab" | "both";

export interface WeekChunk {
  day: AttendanceDay;
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

export interface TaskPomodoro {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  courseCode: string; // sanitized baseCode
  component: TaskComponent;
  classNbr?: string;
  slotName?: string;
  courseTitleSnapshot?: string;
  dueDate?: string; // ISO datetime
  reminders: string[]; // ISO datetimes, sorted ascending
  schedule: WeekChunk[];
  pomodoro?: TaskPomodoro;
  moodleUrl?: string; // dedupe key for one-way import
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  focusMin: number;
  breakMin: number;
  roundsPlanned: number;
  roundsDone: number;
  done: boolean;
}

export const TASK_STATUSES: TaskStatus[] = ["pending", "in_progress", "done"];

export const TASK_KINDS: TaskKind[] = [
  "homework",
  "reminder",
  "digital-assignment",
  "study",
  "test",
];

/** Derived — never stored. */
export function isTaskOverdue(task: Pick<Task, "dueDate" | "status">, now = Date.now()): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < now;
}

/** Linear flow with reopen support. Returns the completedAt to store. */
export function nextTaskStatus(
  status: TaskStatus
): { status: TaskStatus; completedAt?: string } {
  if (status === "pending") return { status: "in_progress", completedAt: undefined };
  if (status === "in_progress")
    return { status: "done", completedAt: new Date().toISOString() };
  return { status: "in_progress", completedAt: undefined };
}
