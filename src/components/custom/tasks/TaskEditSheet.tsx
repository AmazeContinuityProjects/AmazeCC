"use client";

import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Bell,
  Sparkles,
  BookOpen,
  Timer,
  AlertCircle,
  Layers,
  ChevronDown,
} from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { attendanceDataAtom } from "@/store/dataAtoms";
import { settingsAtom } from "@/store/settingsAtoms";
import { ATTENDANCE_DAYS, AttendanceDay } from "@/lib/attendanceTimetable";
import { sanitizeCourseCode, suggestPomodoros } from "@/lib/taskMatch";
import type { Task, TaskComponent, TaskKind, TaskStatus, WeekChunk } from "@/types/tasks";
import { TASK_KINDS } from "@/types/tasks";
import { KIND_CONFIG } from "./TaskCard";

interface TaskEditSheetProps {
  task?: Task | null;
  initialCourseCode?: string;
  initialComponent?: TaskComponent;
  initialTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: Partial<Task> & { title: string }) => void;
  onDelete?: (id: string) => void;
}

export default function TaskEditSheet({
  task,
  initialCourseCode = "",
  initialComponent = "both",
  initialTitle = "",
  isOpen,
  onClose,
  onSave,
  onDelete,
}: TaskEditSheetProps) {
  const [attendanceData] = useAtom(attendanceDataAtom);
  const [settings] = useAtom(settingsAtom);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("homework");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [courseCode, setCourseCode] = useState("");
  const [component, setComponent] = useState<TaskComponent>("both");
  const [dueDate, setDueDate] = useState<string>("");
  const [reminders, setReminders] = useState<string[]>([]);
  const [customReminder, setCustomReminder] = useState<string>("");
  const [schedule, setSchedule] = useState<WeekChunk[]>([]);
  const [pomodoro, setPomodoro] = useState<{
    focusMin: number;
    breakMin: number;
    rounds: number;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Derive unique courses from attendance
  const enrolledCourses = React.useMemo(() => {
    const list = attendanceData?.attendance || [];
    const map = new Map<string, { code: string; title: string; slot?: string }>();
    for (const c of list) {
      const code = sanitizeCourseCode(c.courseCode || (c as any).code);
      if (!code) continue;
      if (!map.has(code)) {
        map.set(code, {
          code,
          title: c.courseTitle || (c as any).title || code,
          slot: c.slotName || (c as any).slot,
        });
      }
    }

    return Array.from(map.values());
  }, [attendanceData]);

  // Populate form on open or task change
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setKind(task.kind || "homework");
      setStatus(task.status || "pending");
      setCourseCode(task.courseCode || "");
      setComponent(task.component || "both");
      setDueDate(task.dueDate ? toLocalDatetime(task.dueDate) : "");
      setReminders(task.reminders || []);
      setSchedule(task.schedule || []);
      setPomodoro(task.pomodoro || null);
      setNotes(task.notes || "");
    } else {
      setTitle(initialTitle || "");
      setKind("homework");
      setStatus("pending");
      setCourseCode(initialCourseCode || (enrolledCourses[0]?.code || ""));
      setComponent(initialComponent || "both");
      setDueDate("");
      setReminders([]);
      setSchedule([]);
      setPomodoro(null);
      setNotes("");
    }
    setError(null);
  }, [task, initialCourseCode, initialComponent, initialTitle, isOpen, enrolledCourses]);

  function toLocalDatetime(iso: string): string {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }

  function toIsoDatetime(localStr: string): string | undefined {
    if (!localStr) return undefined;
    try {
      const d = new Date(localStr);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }

  // Quick reminder offsets
  const addLeadReminder = (minutesBefore: number) => {
    if (!dueDate) return;
    const dueTime = new Date(dueDate).getTime();
    if (isNaN(dueTime)) return;
    const remTime = new Date(dueTime - minutesBefore * 60 * 1000).toISOString();
    if (!reminders.includes(remTime)) {
      setReminders([...reminders, remTime].sort());
    }
  };

  const handleAddCustomReminder = () => {
    if (!customReminder) return;
    const iso = toIsoDatetime(customReminder);
    if (iso && !reminders.includes(iso)) {
      setReminders([...reminders, iso].sort());
      setCustomReminder("");
    }
  };

  const removeReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  // Schedule chunk operations
  const addChunk = () => {
    setSchedule([
      ...schedule,
      { day: "MON", start: "17:00", end: "18:00" },
    ]);
  };

  const updateChunk = (index: number, patch: Partial<WeekChunk>) => {
    setSchedule(
      schedule.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const removeChunk = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const handleAutoSuggestPomodoro = () => {
    if (schedule.length > 0) {
      // Calculate minutes of first chunk
      const [sh, sm] = schedule[0].start.split(":").map(Number);
      const [eh, em] = schedule[0].end.split(":").map(Number);
      const mins = Math.max(15, (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0)));
      const suggested = suggestPomodoros(
        mins,
        settings?.taskPomodoroFocus || 25,
        settings?.taskPomodoroBreak || 5
      );
      setPomodoro(suggested);
    } else {
      setPomodoro({
        focusMin: settings?.taskPomodoroFocus || 25,
        breakMin: settings?.taskPomodoroBreak || 5,
        rounds: settings?.taskPomodoroRounds || 4,
      });
    }
  };

  const handleSave = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a task title");
      return;
    }

    try {
      const payload: Partial<Task> & { title: string } = {
        title: cleanTitle,
        kind,
        status,
        courseCode: sanitizeCourseCode(courseCode),
        component,
        dueDate: toIsoDatetime(dueDate),
        reminders,
        schedule,
        pomodoro: pomodoro || undefined,
        notes: notes.trim() || undefined,
      };

      if (task?.id) {
        payload.id = task.id;
      }

      onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save task");
    }
  };

  if (!isOpen) return null;

  return (
    <BottomSheet onClose={onClose} overlayId="task-edit-sheet" maxWidth="max-w-xl">
      <div className="flex flex-col max-h-[85vh] text-left">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                {task ? "Edit Task" : "New Task"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Course-linked homework, tests & study items
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete DA 2, Study for CAT 1"
              className="w-full text-sm font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Kind Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Type / Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TASK_KINDS.map((k) => {
                const isSelected = kind === k;
                const meta = KIND_CONFIG[k];
                const Icon = meta.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20 shadow-2xs"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status (if editing) */}
          {task && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Status
              </label>
              <div className="flex gap-2">
                {(["pending", "in_progress", "done"] as TaskStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                      status === s
                        ? s === "done"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Course Linking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Course Link
              </label>
              <div className="relative">
                <select
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">No Course (General)</option>
                  {enrolledCourses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Component
              </label>
              <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 border border-zinc-200 dark:border-zinc-800">
                {(["theory", "lab", "both"] as TaskComponent[]).map((comp) => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setComponent(comp)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      component === comp
                        ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Due Date & Time
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Reminders section */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-500" />
                In-App Reminders
              </span>
              <span className="text-[10px] text-zinc-400">
                {reminders.length} armed
              </span>
            </div>

            {dueDate && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-zinc-500">Quick:</span>
                <button
                  type="button"
                  onClick={() => addLeadReminder(15)}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 cursor-pointer"
                >
                  15m before
                </button>
                <button
                  type="button"
                  onClick={() => addLeadReminder(60)}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 cursor-pointer"
                >
                  1h before
                </button>
                <button
                  type="button"
                  onClick={() => addLeadReminder(1440)}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 cursor-pointer"
                >
                  1 day before
                </button>
              </div>
            )}

            {/* Armed reminders list */}
            {reminders.length > 0 && (
              <div className="space-y-1.5">
                {reminders.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80"
                  >
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {new Date(r).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeReminder(i)}
                      className="text-zinc-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom reminder input */}
            <div className="flex gap-2 pt-1">
              <input
                type="datetime-local"
                value={customReminder}
                onChange={(e) => setCustomReminder(e.target.value)}
                className="flex-1 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddCustomReminder}
                disabled={!customReminder}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Weekly Schedule Chunks */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Weekly Time Slots
                </span>
                <p className="text-[10.5px] text-zinc-400">
                  Allocates dedicated study chunks on the timetable
                </p>
              </div>
              <button
                type="button"
                onClick={addChunk}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Slot
              </button>
            </div>

            {schedule.map((chunk, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80"
              >
                <select
                  value={chunk.day}
                  onChange={(e) =>
                    updateChunk(idx, { day: e.target.value as AttendanceDay })
                  }
                  className="text-xs font-bold uppercase rounded-lg bg-zinc-100 dark:bg-zinc-700 px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  {ATTENDANCE_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  value={chunk.start}
                  onChange={(e) => updateChunk(idx, { start: e.target.value })}
                  className="text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                />
                <span className="text-xs text-zinc-400">–</span>
                <input
                  type="time"
                  value={chunk.end}
                  onChange={(e) => updateChunk(idx, { end: e.target.value })}
                  className="text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                />

                <button
                  type="button"
                  onClick={() => removeChunk(idx)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pomodoro Settings */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-500" />
                Pomodoro Focus Plan
              </span>
              <button
                type="button"
                onClick={handleAutoSuggestPomodoro}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                {pomodoro ? "Recalculate" : "Plan with Pomodoro"}
              </button>
            </div>

            {pomodoro && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                    Focus (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={pomodoro.focusMin}
                    onChange={(e) =>
                      setPomodoro({ ...pomodoro, focusMin: Number(e.target.value) })
                    }
                    className="w-full text-xs font-bold rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                    Break (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={pomodoro.breakMin}
                    onChange={(e) =>
                      setPomodoro({ ...pomodoro, breakMin: Number(e.target.value) })
                    }
                    className="w-full text-xs font-bold rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                    Rounds
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={pomodoro.rounds}
                    onChange={(e) =>
                      setPomodoro({ ...pomodoro, rounds: Number(e.target.value) })
                    }
                    className="w-full text-xs font-bold rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Notes / Instructions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details, submission portals, formulas..."
              className="w-full text-xs font-medium rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/30">
          {task && onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete task "${task.title}"?`)) {
                  onDelete(task.id);
                  onClose();
                }
              }}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline px-2 py-1 cursor-pointer"
            >
              Delete Task
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              {task ? "Update Task" : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
