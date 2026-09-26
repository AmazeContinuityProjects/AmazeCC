"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, m } from "framer-motion";
import {
  Columns,
  List,
  Calendar,
  Timer,
  Plus,
  Download,
  Clock,
  AlertCircle,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { tasksAtom } from "@/store/dataAtoms";
import { tasksQuickAddRequestAtom } from "@/store/uiAtoms";
import {
  getTasks,
  createTask,
  updateTask,
  cycleTaskStatus,
  deleteTask,
  migrateCustomHomework,
} from "@/lib/tasksStorage";
import { subscribeReminders } from "@/lib/taskReminders";
import { isDueOnDay } from "@/lib/taskMatch";
import { getTodayAttendanceDay } from "@/lib/attendanceTimetable";
import type { Task } from "@/types/tasks";
import { isTaskOverdue } from "@/types/tasks";
import BackButton from "../shared/BackButton";
import KanbanView from "./KanbanView";
import TaskListView from "./TaskListView";
import TaskWeekView from "./TaskWeekView";
import FocusPage from "./FocusPage";
import TaskEditSheet from "./TaskEditSheet";
import MoodleImportModal from "./MoodleImportModal";

export type TasksViewMode = "kanban" | "list" | "week" | "focus";

interface TasksTabProps {
  initialView?: TasksViewMode;
  initialCourseCode?: string;
  onBack?: () => void;
}

// Tone tokens mirror the course pages (CourseDetailSubpage STATUS_/TONE_ maps)
const TONE_TEXT: Record<string, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  zinc: "text-zinc-400 dark:text-zinc-500",
};

const TONE_BADGE: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  indigo:
    "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40",
  zinc: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
};

const CARD_BASE =
  "p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-36 sm:min-h-40 text-left relative overflow-hidden";

const SEG_ACTIVE =
  "bg-indigo-600 text-white shadow-xs";
const SEG_IDLE =
  "bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white";

const VIEW_META: Record<
  TasksViewMode,
  { label: string; icon: React.ElementType; section: string }
> = {
  kanban: { label: "Kanban", icon: Columns, section: "Board" },
  list: { label: "List", icon: List, section: "Timeline" },
  week: { label: "Week", icon: Calendar, section: "Week plan" },
  focus: { label: "Focus", icon: Timer, section: "Focus" },
};

export default function TasksTab({
  initialView = "kanban",
  initialCourseCode,
  onBack,
}: TasksTabProps) {
  const [tasks, setTasks] = useAtom(tasksAtom);
  const quickAddRequest = useAtomValue(tasksQuickAddRequestAtom);
  const setQuickAddRequest = useSetAtom(tasksQuickAddRequestAtom);
  const [viewMode, setViewMode] = useState<TasksViewMode>(initialView);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Edit sheet state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [prefilledCourseCode, setPrefilledCourseCode] = useState<string | undefined>(
    initialCourseCode
  );
  const [prefilledTitle, setPrefilledTitle] = useState<string>("");

  // Moodle modal state
  const [isMoodleModalOpen, setIsMoodleModalOpen] = useState(false);

  // Filter state
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");

  // Carousel state
  const [slideIndex, setSlideIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Initial load & migrate (Main hydrates at boot; this is a safety net so the
  // hub is never empty after a fresh mount)
  useEffect(() => {
    if (tasks.length > 0) return;
    const migrated = migrateCustomHomework();
    const stored = getTasks();
    setTasks(stored.length > 0 ? stored : migrated);
  }, [tasks.length, setTasks]);

  // Reminder fires are owned by Main (see useTaskReminderScheduler); the hub
  // just surfaces them in a banner.
  useEffect(() => {
    return subscribeReminders((reminder) => {
      setActiveNotification(
        `Reminder: ${reminder.taskTitle}${
          reminder.kind === "due_lead" ? " — due soon" : ""
        }`
      );
    });
  }, []);

  // Command palette quick-add: open the create sheet, prefill, then consume
  useEffect(() => {
    if (!quickAddRequest) return;
    setEditingTask(null);
    setPrefilledTitle(quickAddRequest.title || "");
    setPrefilledCourseCode(undefined);
    setIsEditSheetOpen(true);
    setQuickAddRequest(null);
  }, [quickAddRequest, setQuickAddRequest]);

  // Handlers
  const handleCreateTask = (draft: Partial<Task> & { title: string }) => {
    const updated = createTask(draft);
    setTasks(updated);
  };

  const handleUpdateTask = (draft: Partial<Task> & { title: string }) => {
    if (!draft.id) return;
    const updated = updateTask(draft.id, draft);
    setTasks(updated);
  };

  const handleStatusCycle = (id: string) => {
    const updated = cycleTaskStatus(id);
    setTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = deleteTask(id);
    setTasks(updated);
  };

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setPrefilledTitle("");
    setPrefilledCourseCode(initialCourseCode);
    setIsEditSheetOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setIsEditSheetOpen(true);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedCourseFilter === "all") return true;
    return t.courseCode === selectedCourseFilter;
  });

  const uniqueCourseCodes = Array.from(
    new Set(tasks.map((t) => t.courseCode).filter(Boolean))
  );

  // ── Page-level stats (unfiltered, like the course page heroes) ──
  const now = new Date();
  const todayCode = getTodayAttendanceDay(now);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => isTaskOverdue(t, now.getTime()));
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const dueThisWeek = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    return due >= now.getTime() && due <= now.getTime() + 7 * 24 * 60 * 60 * 1000;
  }).length;
  const todayTasks = openTasks.filter(
    (t) =>
      (t.schedule || []).some((c) => c.day === todayCode) ||
      isDueOnDay(t.dueDate, now)
  ).length;
  const scheduledChunks = openTasks.reduce(
    (sum, t) => sum + (t.schedule || []).length,
    0
  );

  // ── Rotating insight carousel (mirrors the course-overview stat cards) ──
  const slides = useMemo(
    () => [
      {
        id: "today",
        title: "Today",
        headline: String(todayTasks),
        subline:
          todayTasks > 0
            ? "session or due today"
            : "nothing scheduled today",
        badge: "Today",
        tone: todayTasks > 0 ? "red" : "zinc",
        onClick: () => setViewMode("week"),
      },
      {
        id: "overdue",
        title: "Overdue",
        headline: String(overdueTasks.length),
        subline:
          overdueTasks.length > 0
            ? "past due, still open"
            : "nothing past due",
        badge: overdueTasks.length > 0 ? "Overdue" : "Clear",
        tone: overdueTasks.length > 0 ? "red" : "emerald",
        onClick: () => setViewMode("list"),
      },
      {
        id: "focus",
        title: "Focus",
        headline: String(scheduledChunks),
        subline:
          scheduledChunks > 0
            ? "weekly session chunks planned"
            : "no chunks scheduled yet",
        badge: "Focus",
        tone: "indigo",
        onClick: () => setViewMode("focus"),
      },
      {
        id: "done",
        title: "Completed",
        headline: String(doneCount),
        subline: doneCount > 0 ? "tasks finished" : "nothing finished yet",
        badge: "Done",
        tone: doneCount > 0 ? "emerald" : "zinc",
        onClick: () => setViewMode("kanban"),
      },
    ],
    [todayTasks, overdueTasks.length, scheduledChunks, doneCount]
  );

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (isCarouselPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isCarouselPaused, slides.length]);

  const slide = slides[slideIndex] || slides[0];
  const openTone = overdueTasks.length > 0 ? "red" : openTasks.length > 0 ? "indigo" : "zinc";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300 text-left select-none">
      {/* Active in-app notification banner */}
      {activeNotification && (
        <div className="p-4 rounded-[24px] bg-indigo-500 text-white shadow-md flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>{activeNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveNotification(null)}
            className="text-xs font-bold underline cursor-pointer hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── HEADER (course page arrangement) ── */}
      <div className="px-1">
        {onBack && (
          <div className="mb-5 flex">
            <BackButton onClick={onBack} className="self-start" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1.5">
            Tools · Tasks
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit">
            Tasks &amp; Schedule
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
            Timetable-linked study sessions, homework &amp; digital assignments
          </p>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setIsMoodleModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Import LMS</span>
        </button>
        <button
          type="button"
          onClick={handleOpenNewTask}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* ── STAT CARDS (static hero + rotating carousel) ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* CARD 1: OPEN TASKS */}
        <div className={CARD_BASE}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Open tasks
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${
                TONE_BADGE[overdueTasks.length > 0 ? "red" : "emerald"]
              }`}
            >
              {overdueTasks.length > 0 ? "Overdue" : "On track"}
            </span>
          </div>
          <div className="my-auto py-1">
            <span
              className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block ${TONE_TEXT[openTone]}`}
            >
              {openTasks.length}
            </span>
          </div>
          <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {dueThisWeek} due this week · {doneCount} done
          </p>
        </div>

        {/* CARD 2: ROTATING INSIGHT CAROUSEL */}
        <div
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onTouchStart={() => setIsCarouselPaused(true)}
          onTouchEnd={() => setIsCarouselPaused(false)}
          onClick={() => slide.onClick()}
          className={`${CARD_BASE} transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              {slide.title}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${TONE_BADGE[slide.tone]}`}
            >
              {slide.badge}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <m.div
              key={slide.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="my-auto py-1 min-w-0"
            >
              <span
                className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block ${TONE_TEXT[slide.tone]}`}
              >
                {slide.headline}
              </span>
            </m.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {slide.subline}
            </p>
            {slides.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideIndex(idx);
                    }}
                    aria-label={`Go to ${s.title}`}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      slideIndex === idx ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VIEW SEGMENTS + COURSE FILTER ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100/80 dark:bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 w-fit">
          {(Object.keys(VIEW_META) as TasksViewMode[]).map((mode) => {
            const Icon = VIEW_META[mode].icon;
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  isActive ? SEG_ACTIVE : SEG_IDLE
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{VIEW_META[mode].label}</span>
              </button>
            );
          })}
        </div>

        {uniqueCourseCodes.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {[{ id: "all", label: "All courses" }, ...uniqueCourseCodes.map((c) => ({ id: c, label: c }))].map(
              (f) => {
                const isActive = selectedCourseFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedCourseFilter(f.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                      isActive ? SEG_ACTIVE : SEG_IDLE
                    }`}
                  >
                    {f.label}
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ── SECTION HEADER + MAIN VIEW ROUTER ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {viewMode === "kanban" ? (
              <ListTodo className="w-4 h-4 text-indigo-500" />
            ) : viewMode === "list" ? (
              <List className="w-4 h-4 text-indigo-500" />
            ) : viewMode === "week" ? (
              <Calendar className="w-4 h-4 text-indigo-500" />
            ) : (
              <Timer className="w-4 h-4 text-indigo-500" />
            )}
            <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              {VIEW_META[viewMode].section}
            </h2>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
              {filteredTasks.length}
            </span>
          </div>

          {/* Slide shortcuts mirror the carousel headline colours */}
          <div className="flex items-center gap-2">
            {overdueTasks.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.red}`}
              >
                <AlertCircle className="w-3 h-3" />
                {overdueTasks.length} overdue
              </span>
            )}
            {todayTasks > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.indigo}`}
              >
                <Clock className="w-3 h-3" />
                {todayTasks} today
              </span>
            )}
            {doneCount > 0 && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.emerald}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {doneCount} done
              </span>
            )}
          </div>
        </div>

        {viewMode === "kanban" && (
          <KanbanView
            tasks={filteredTasks}
            onEdit={handleOpenEdit}
            onStatusCycle={handleStatusCycle}
            onDelete={handleDeleteTask}
            onNewTask={handleOpenNewTask}
          />
        )}

        {viewMode === "list" && (
          <TaskListView
            tasks={filteredTasks}
            onEdit={handleOpenEdit}
            onStatusCycle={handleStatusCycle}
            onDelete={handleDeleteTask}
            onNewTask={handleOpenNewTask}
          />
        )}

        {viewMode === "week" && (
          <TaskWeekView
            tasks={filteredTasks}
            onEdit={handleOpenEdit}
            onNewTask={handleOpenNewTask}
          />
        )}

        {viewMode === "focus" && (
          <FocusPage
            tasks={filteredTasks}
            onCycleStatus={handleStatusCycle}
            onEditTask={handleOpenEdit}
          />
        )}
      </div>

      {/* Task Edit Sheet */}
      <TaskEditSheet
        task={editingTask}
        initialTitle={prefilledTitle}
        initialCourseCode={prefilledCourseCode}
        isOpen={isEditSheetOpen}
        onClose={() => {
          setIsEditSheetOpen(false);
          setEditingTask(null);
          setPrefilledTitle("");
        }}
        onSave={(draft) => {
          if (editingTask) {
            handleUpdateTask(draft);
          } else {
            handleCreateTask(draft);
          }
        }}
        onDelete={handleDeleteTask}
      />

      {/* Moodle Import Modal */}
      <MoodleImportModal
        isOpen={isMoodleModalOpen}
        onClose={() => setIsMoodleModalOpen(false)}
        onImportComplete={() => {}}
      />
    </div>
  );
}
