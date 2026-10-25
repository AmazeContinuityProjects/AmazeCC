"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  Check,
  Download,
  Users,
  Save,
  Upload,
  Lock,
  Wand2,
  ClipboardPaste,
  CalendarDays,
  ExternalLink,
  Search,
  PlusCircle,
  FileText,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  X,
  FileDown,
  GraduationCap,
  PanelsTopLeft,
  ListFilter,
  Clock3,
  Sun,
  Moon,
  AlertTriangle,
  Star,
  BookOpen,
  Smile,
  Settings2,
  CircleHelp,
} from "lucide-react";
import {
  StatTile,
  InsightCarousel,
  useCarousel,
  ChipTabs,
  SegmentedControl,
  ListRowText,
  ListShell,
  type InsightSlide,
} from "../../../shared/primitives";
import Switch from "../../../shared/primitives/Switch";
import BottomSheet from "../../../shared/BottomSheet";
import type {
  AddedCourse,
  ParsedCourse,
  TimetableState,
  Friend,
  FriendGroup,
} from "../types";
import {
  periodsForSlot,
  findPeriodClash,
} from "@/lib/slots";
import { dayOccupancy, freeHalfDays, timetableMetrics } from "@/lib/timetableMetrics";
import { getTimetableSchema } from "@/lib/campusSchema";
import { sameSlotFacultyAlternatives } from "../logic/generate";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyReviewSheet";
import { getFacultyReview, loadVitfacCatalog, useVitfacReview } from "@/lib/vitfacService";
import type { TourStep } from "../features/tour/tourSteps";

export interface FFCSDashboardHeaderProps {
  // Timetables
  activeTimetable: TimetableState;
  timetables: TimetableState[];
  onCreateNewTimetable: () => void;
  onRenameTimetable: (id: string, newName: string) => void;
  onDuplicateTimetable: () => void;
  onDeleteTimetable: (id: string) => void;
  onOpenTimetableModal: () => void;
  onExportIcal: () => void;
  onExportTimetablesJson: () => void;
  onImportTimetablesJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLayoutPicker?: () => void;
  onOpenCourseListPicker?: () => void;
  onOpenPlannerSettings?: () => void;
  onOpenHelp?: () => void;
  currentCourseListLabel?: string;
  currentLayoutLabel?: string;

  // Stats & Schedule
  courses: AddedCourse[];
  onRemoveCourse: (id: string) => void;
  totalCredits?: number;
  blockedSlots?: Set<string>;

  // Primary Actions
  onOpenCourseSearch: () => void;
  onOpenCourseLocks: () => void;
  courseLocksCount: number;
  onOpenGenerator: () => void;
  onOpenPasteRegistered: () => void;
  onOpenManualLinker?: () => void;

  // Active Course Picker (when selectedCourseCode is set)
  selectedCourseCode?: string;
  onClearSelectedCourse?: () => void;
  selectedCourse?: {
    code: string;
    title: string;
    types: string[];
    batches: string[];
  } | null;
  isGroupingEnabled?: boolean;
  setIsGroupingEnabled?: (val: boolean) => void;
  slotFilter?: string;
  setSlotFilter?: (filter: string) => void;
  selectedSlotIndex?: string;
  setSelectedSlotIndex?: (idx: string) => void;
  availableSlots?: ParsedCourse[];
  hasTheory?: boolean;
  hasLab?: boolean;
  onOpenSlotSearch?: () => void;
  onAddCourse?: (e: React.FormEvent) => void;
  courseAlternativesPool?: any[];
  onOpenFacultyReview?: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
  renderTypeChips?: (types: string[] | string, size?: "sm" | "md") => React.ReactNode;
  getBatchColorClass?: (batch: string) => string;

  // Social & Friends
  friends?: Friend[];
  friendGroups?: FriendGroup[];
  socialTargetId?: string;
  setSocialTargetId?: (id: string) => void;
  socialScoreGroupMethod?: "intersection" | "cumulative";
  setSocialScoreGroupMethod?: (method: "intersection" | "cumulative") => void;
  isCalculatingSocialScore?: boolean;
  dynamicSocialScore?: number;
  onOpenSocialMatrix?: () => void;
  onOpenFriendsManager?: () => void;

  // Faculty Schedules & Reviews
  facultyGroupsCount?: number;
  onOpenFacultySchedule?: () => void;
  enableVitfacIntegration?: boolean;

  // Export Dossier
  isDownloading?: boolean;
  onDownloadHtmlDossier?: (theme?: "light" | "dark") => void;
  onDownloadImage?: (format: "jpg" | "png", orientation?: "horizontal" | "vertical") => void;
  onOpenPrintablePage?: () => void;
  onOpenDetachedPrintablePage?: () => void;

  /**
   * The tour's current step target (null when no run is active), announced by
   * the tab's TourProvider. The header enables the widget a spotlighted
   * step lives inside, so `ffcs-social` / `ffcs-export` always have a real,
   * visible anchor — see the effect below.
   */
  tourStepTarget?: string | null;
  /** Use a single widget column when the timetable occupies the wide-screen side column. */
  wideScreenSingleWidgetColumn?: boolean;
}

type UtilityTab = "timetables" | "social" | "faculty" | "export";
type DashboardWidget = UtilityTab | "add-courses";
type MobileWidget = UtilityTab | "selected-course";
type CourseMenuAction = "manual-add" | "target-courses" | "auto-generate" | "paste-vtop" | "advanced-linker";
const UTILITY_TABS: Array<{
  value: UtilityTab;
  label: string;
  description: string;
  Icon: React.ElementType;
  iconClass: string;
}> = [
  {
    value: "timetables",
    label: "Timetable Actions",
    description: "Switch plans, rename, duplicate, or back up.",
    Icon: CalendarDays,
    iconClass: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  {
    value: "social",
    label: "Social & Friends",
    description: "Compare schedules and manage friend groups.",
    Icon: Users,
    iconClass: "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  {
    value: "faculty",
    label: "Faculty & Reviews",
    description: "Explore faculty schedules and reviews.",
    Icon: GraduationCap,
    iconClass: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    value: "export",
    label: "Export Dossier",
    description: "Download, print, or share your timetable.",
    Icon: FileDown,
    iconClass: "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
];
const COURSE_MENU_ACTIONS: Array<{
  value: CourseMenuAction;
  label: string;
  description: string;
  Icon: React.ElementType;
  iconClass: string;
  tourTarget?: string;
}> = [
  {
    value: "manual-add",
    label: "Manually Add Course",
    description: "Search the catalog, choose a slot, and add it to this plan.",
    Icon: Search,
    iconClass: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    value: "target-courses",
    label: "Target Courses",
    description: "Choose required courses and lock preferred slots.",
    Icon: Lock,
    iconClass: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20",
    tourTarget: "ffcs-add-course",
  },
  {
    value: "auto-generate",
    label: "Auto-Generate",
    description: "Build timetable combinations from your course targets.",
    Icon: Wand2,
    iconClass: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20",
    tourTarget: "ffcs-generate",
  },
  {
    value: "paste-vtop",
    label: "Paste VTOP",
    description: "Import courses from your VTOP registration page.",
    Icon: ClipboardPaste,
    iconClass: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    value: "advanced-linker",
    label: "Advanced Linker",
    description: "Manually pair theory and lab slots using a CSV.",
    Icon: SlidersHorizontal,
    iconClass: "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
];

function MobileWidgetSheet({
  isMobile,
  widget,
  onClose,
  children,
}: {
  isMobile: boolean;
  widget: MobileWidget | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isMobile) return <>{children}</>;
  if (!widget) return null;
  const widgetInfo = UTILITY_TABS.find((tab) => tab.value === widget);
  const title = widgetInfo?.label ?? "Configure Selected Course";
  const subtitle =
    widgetInfo?.description ?? "Choose a slot and faculty for the selected course.";
  const Icon = widgetInfo?.Icon ?? PlusCircle;

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-mobile-widget"
      maxWidth="max-w-2xl"
      title={title}
      subtitle={subtitle}
      icon={<Icon className="w-5 h-5" />}
      accent={widgetInfo?.iconClass ?? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400"}
    >
      {children}
    </BottomSheet>
  );
}
type DashboardStat = {
  id: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  badge: React.ReactNode;
  tone: string;
  className?: string;
};

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

type CourseClash = {
  courseA: AddedCourse;
  courseB: AddedCourse;
  periodA: ReturnType<typeof periodsForSlot>[number];
  periodB: ReturnType<typeof periodsForSlot>[number];
};

type BlockedSlotClash = {
  course: AddedCourse;
  slot: string;
};

function ClashDetails({
  courseClashes,
  blockedSlotClashes,
  onRemoveCourse,
  onClose,
}: {
  courseClashes: CourseClash[];
  blockedSlotClashes: BlockedSlotClash[];
  onRemoveCourse: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-clash-details"
      maxWidth="max-w-2xl"
      title="Clashing Courses"
      subtitle="Review conflicting course and faculty choices"
      icon={<AlertTriangle className="w-5 h-5" />}
      accent="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
    >
      {courseClashes.length === 0 && blockedSlotClashes.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          This timetable has no course or blocked-slot clashes.
        </div>
      ) : (
        <div className="space-y-3">
          {courseClashes.map(({ courseA, courseB, periodA, periodB }) => (
            <section
              key={`${courseA.id}-${courseB.id}`}
              className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3"
            >
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {DAY_LABELS[periodA.day] ?? periodA.day}: {periodA.start}–{periodA.end}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[courseA, courseB].map((course) => (
                  <div
                    key={course.id}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-border-strong bg-surface p-2"
                  >
                    <FacultyAvatar
                      employeeId={course.employeeId}
                      name={course.faculty}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-text-heading">{course.code}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {course.faculty || "Faculty not listed"}
                      </p>
                      <p className="truncate text-[10px] font-semibold text-muted-foreground">
                        {course.slots.join(" + ") || "No slot"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveCourse(course.id)}
                      aria-label={`Remove ${course.code} — ${course.faculty || "faculty not listed"}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                      title={`Remove ${course.code} and its faculty choice`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {periodA.start !== periodB.start || periodA.end !== periodB.end ? (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {courseB.code} period: {periodB.start}–{periodB.end}
                </p>
              ) : null}
            </section>
          ))}
          {blockedSlotClashes.map(({ course, slot }) => (
            <section
              key={`${course.id}-${slot}`}
              className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3"
            >
              <FacultyAvatar employeeId={course.employeeId} name={course.faculty} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-text-heading">
                  {course.code} · blocked slot {slot}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {course.faculty || "Faculty not listed"} · {course.slots.join(" + ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveCourse(course.id)}
                aria-label={`Remove ${course.code} — ${course.faculty || "faculty not listed"}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                title={`Remove ${course.code} and its faculty choice`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </section>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

function WeeklyRhythmDetails({
  courses,
  onClose,
}: {
  courses: AddedCourse[];
  onClose: () => void;
}) {
  const schema = getTimetableSchema();
  const metrics = useMemo(() => timetableMetrics(courses, schema), [courses, schema]);
  const free = useMemo(() => new Set(freeHalfDays(courses, schema)), [courses, schema]);
  const days = useMemo(
    () =>
      ["mon", "tue", "wed", "thu", "fri"].map((day) => ({
        id: day,
        label: DAY_LABELS[day],
        ...dayOccupancy(courses, schema, day as "mon" | "tue" | "wed" | "thu" | "fri"),
        gapMinutes: metrics.gapsPerDay[day] ?? 0,
      })),
    [courses, metrics, schema]
  );
  const totalClassHours = days.reduce(
    (total, day) =>
      total + day.classes.reduce((daily, item) => daily + item.endMin - item.startMin, 0),
    0
  ) / 60;
  const firstClass = days
    .flatMap((day) => day.classes.map((item) => ({ ...item, day: day.label })))
    .sort((a, b) => a.startMin - b.startMin)[0];
  const lastClass = days
    .flatMap((day) => day.classes.map((item) => ({ ...item, day: day.label })))
    .sort((a, b) => b.endMin - a.endMin)[0];
  const maxGapDay = [...days].sort((a, b) => b.gapMinutes - a.gapMinutes)[0];
  const theoryPeriods = courses.flatMap((course) =>
    course.slots.flatMap((slot) => periodsForSlot(schema, slot).filter((period) => period.type === "theory"))
  );
  const hasMorningTheory = theoryPeriods.some((period) => period.startMin < 840);
  const hasEveningTheory = theoryPeriods.some((period) => period.startMin >= 840);
  const freeLabels = [...free].map((halfDay) => {
    const [day, half] = halfDay.split("_");
    return `${DAY_LABELS[day] ?? day} ${half}`;
  });
  const faculty = useMemo(() => {
    const unique = new Map<string, AddedCourse>();
    courses.forEach((course) => {
      const key = course.employeeId || course.faculty.trim().toLowerCase();
      if (key && !unique.has(key)) unique.set(key, course);
    });
    return [...unique.values()];
  }, [courses]);
  const [facultyReviews, setFacultyReviews] = useState<ReturnType<typeof getFacultyReview>[]>([]);
  const [facultyLoading, setFacultyLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setFacultyLoading(true);
    void loadVitfacCatalog()
      .then(() => {
        if (!active) return;
        setFacultyReviews(
          faculty.map((course) =>
            getFacultyReview({ employeeId: course.employeeId, name: course.faculty })
          )
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load faculty metrics for weekly rhythm:", error);
      })
      .finally(() => {
        if (active) setFacultyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [faculty]);

  const reviewedFaculty = faculty
    .map((course, index) => ({ course, review: facultyReviews[index] }))
    .filter(
      (entry): entry is { course: AddedCourse; review: NonNullable<typeof entry.review> } =>
        !!entry.review && entry.review.reviews > 0
    );
  const averageWinRate = reviewedFaculty.length
    ? Math.round(reviewedFaculty.reduce((sum, entry) => sum + entry.review.wPct, 0) / reviewedFaculty.length)
    : null;
  const averageDaScore = reviewedFaculty.filter((entry) => typeof entry.review.metrics?.da === "number");
  const averageDa = averageDaScore.length
    ? averageDaScore.reduce((sum, entry) => sum + (entry.review.metrics?.da ?? 0), 0) / averageDaScore.length
    : null;
  const bestFaculty = [...reviewedFaculty].sort((a, b) => b.review.wPct - a.review.wPct)[0];
  const worstFaculty = [...reviewedFaculty].sort((a, b) => a.review.wPct - b.review.wPct)[0];
  const facultyQualitySummary = (entry: (typeof reviewedFaculty)[number] | undefined) => {
    if (!entry) return "No Vitfac reviews for this timetable";
    const { review } = entry;
    const qualities = [
      typeof review.metrics?.lecture === "number" ? `Lecture ${review.metrics.lecture.toFixed(1)}/5` : null,
      typeof review.metrics?.da === "number" ? `DA ${review.metrics.da.toFixed(1)}/5` : null,
      typeof review.metrics?.vibe === "number" ? `Vibe ${review.metrics.vibe.toFixed(1)}/5` : null,
    ].filter(Boolean);
    const lore = [
      ...(review.lore?.green?.slice(0, 2).map((item) => item.text) ?? []),
      ...(review.lore?.red?.slice(0, 2).map((item) => item.text) ?? []),
    ];
    return [
      qualities.length ? qualities.join(" · ") : "No quality breakdown",
      ...lore,
    ].join(" · ");
  };
  const stats = [
    { label: "Free half-days", value: `${free.size} / 10` },
    { label: "Class days", value: `${days.filter((day) => day.classes.length > 0).length} / 5` },
    { label: "Weekly class time", value: `${Number(totalClassHours.toFixed(1))} hours` },
    { label: "Gaps between classes", value: `${(metrics.gaps / 60).toFixed(1)} hours` },
    { label: "Building dashes", value: String(metrics.buildingDashes) },
    { label: "Long weekend", value: metrics.isLongWeekend ? "Yes" : "No" },
    { label: "Morning theory", value: hasMorningTheory ? "Yes" : "No" },
    { label: "Evening theory", value: hasEveningTheory ? "Yes" : "No" },
    { label: "Faculty average win rate", value: facultyLoading ? "Loading…" : averageWinRate === null ? "No reviews" : `${averageWinRate}%` },
    { label: "Faculty average DA marks", value: facultyLoading ? "Loading…" : averageDa === null ? "No reviews" : `${averageDa.toFixed(1)} / 5` },
    { label: "Best faculty", value: facultyLoading ? "Loading…" : bestFaculty ? `${bestFaculty.course.faculty} · ${bestFaculty.review.wPct}% W` : "No reviews" },
    { label: "Worst faculty", value: facultyLoading ? "Loading…" : worstFaculty ? `${worstFaculty.course.faculty} · ${worstFaculty.review.wPct}% W` : "No reviews" },
    { label: "Earliest class start", value: firstClass ? `${firstClass.start} · ${firstClass.day}` : "No classes" },
    { label: "Latest class end", value: lastClass ? `${lastClass.end} · ${lastClass.day}` : "No classes" },
    { label: "Most gap time", value: maxGapDay?.gapMinutes ? `${maxGapDay.label} · ${(maxGapDay.gapMinutes / 60).toFixed(1)} hours` : "No gaps" },
  ];

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-weekly-rhythm-details"
      maxWidth="max-w-2xl"
      title="Weekly Rhythm"
      subtitle="Schedule, gaps, half-days, and faculty signals"
      icon={<Clock3 className="w-5 h-5" />}
      accent="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
    >
      <div className="space-y-4">
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Faculty ratings in this timetable</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: "Best faculty", entry: bestFaculty, tone: "emerald" },
              { label: "Worst faculty", entry: worstFaculty, tone: "amber" },
            ].map(({ label, entry, tone }) => (
              <div key={label} className={`rounded-xl border p-3 ${tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                <p className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">{label}</p>
                {entry ? (
                  <>
                  <div className="mt-1 flex items-center gap-2">
                    <FacultyAvatar
                      employeeId={entry.course.employeeId}
                      name={entry.course.faculty}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-text-heading">
                        {entry.course.faculty}
                      </p>
                      <span className={`text-xs font-black ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {entry.review.wPct}% W
                      </span>
                    </div>
                  </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground mt-1">
                      {facultyQualitySummary(entry)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {entry.review.reviews} student review{entry.review.reviews === 1 ? "" : "s"}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {facultyLoading ? "Loading faculty reviews…" : "No reviewed faculty in this timetable."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Day-by-day schedule</h3>
          <div className="space-y-2">
            {days.map((day) => (
              <div key={day.id} className="rounded-xl border border-border-strong bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-text-heading">{day.label}</span>
                  <span className="text-[11px] text-muted-foreground">{(day.gapMinutes / 60).toFixed(1)}h gaps</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${day.morningOccupied ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                    <Sun className="w-3 h-3" /> {day.morningOccupied ? "Morning classes" : "Free morning"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${day.eveningOccupied ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                    <Moon className="w-3 h-3" /> {day.eveningOccupied ? "Evening classes" : "Free evening"}
                  </span>
                </div>
                {day.classes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {day.classes[0].start}–{day.classes[day.classes.length - 1].end} · {day.classes.length} class period{day.classes.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Free half-days</h3>
          {freeLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {freeLabels.map((label) => <span key={label} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{label}</span>)}
            </div>
          ) : <p className="text-xs text-muted-foreground">No free half-days this week.</p>}
        </section>
        {metrics.gapDetails.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Largest class gaps</h3>
            {[...metrics.gapDetails].sort((a, b) => b.durationMins - a.durationMins).slice(0, 5).map((gap, index) => (
              <div key={`${gap.day}-${gap.startMin}-${index}`} className="flex items-center justify-between gap-3 text-xs rounded-lg bg-surface-secondary/60 px-3 py-2">
                <span className="font-semibold text-text-heading">{DAY_LABELS[gap.day] ?? gap.day}: {gap.fromTime}–{gap.toTime}</span>
                <span className="text-muted-foreground shrink-0">{gap.durationMins} min</span>
              </div>
            ))}
          </section>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border-strong bg-surface p-3">
              <p className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-extrabold text-text-heading mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}

function CourseOptionQuality({
  courseCode,
  slots,
  faculty,
  employeeId,
  clashes,
}: {
  courseCode: string;
  slots: string;
  faculty: string;
  employeeId?: string;
  clashes: string[];
}) {
  const { review, loading } = useVitfacReview(employeeId, faculty);
  const lore = review?.lore?.green?.slice(0, 2) ?? [];
  const cautionLore = review?.lore?.red?.slice(0, 2) ?? [];
  return (
    <div className="rounded-xl border border-border-strong/70 bg-surface p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FacultyAvatar employeeId={employeeId} name={faculty} size="xs" />
          <span className="text-xs font-semibold text-text-heading truncate">{faculty || "Faculty not listed"}</span>
        </div>
        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{slots || "No slot"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {loading ? (
          <span className="text-[10px] text-muted-foreground">Loading Vitfac…</span>
        ) : review && review.reviews > 0 ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"><Star className="w-3 h-3" />{review.wPct}% W · {review.reviews} reviews</span>
            {review.metrics && (
              <>
                {typeof review.metrics.lecture === "number" && <span className="text-[10px] text-muted-foreground"><BookOpen className="w-3 h-3 inline" /> {review.metrics.lecture.toFixed(1)}/5</span>}
                {typeof review.metrics.da === "number" && <span className="text-[10px] text-muted-foreground"><FileText className="w-3 h-3 inline" /> DA {review.metrics.da.toFixed(1)}/5</span>}
                {typeof review.metrics.vibe === "number" && <span className="text-[10px] text-muted-foreground"><Smile className="w-3 h-3 inline" /> {review.metrics.vibe.toFixed(1)}/5</span>}
              </>
            )}
            {typeof review.metrics?.da === "number" && (
              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">DA marks {review.metrics.da.toFixed(1)}/5</span>
            )}
            {lore.map((item) => <span key={item.text} className="text-[10px] text-emerald-700 dark:text-emerald-400">{item.text}</span>)}
            {cautionLore.map((item) => <span key={item.text} className="text-[10px] text-amber-700 dark:text-amber-400">{item.text}</span>)}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">No Vitfac review data</span>
        )}
        {clashes.length ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400"><AlertTriangle className="w-3 h-3" /> Clash with {clashes.join(", ")}</span>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">No timetable clashes</span>
        )}
      </div>
      <span className="sr-only">{courseCode}</span>
    </div>
  );
}

const STAT_TILE_MIN_WIDTH = 280;
const STAT_TILE_GAP = 12;
const MAX_STAT_TILES = 4;

export function getFittingStatTileCount(width: number): number {
  if (width <= 0) return MAX_STAT_TILES;
  return Math.min(
    MAX_STAT_TILES,
    Math.max(1, Math.floor((width + STAT_TILE_GAP) / (STAT_TILE_MIN_WIDTH + STAT_TILE_GAP)))
  );
}

export default function FFCSDashboardHeader({
  activeTimetable,
  timetables,
  onCreateNewTimetable,
  onRenameTimetable,
  onDuplicateTimetable,
  onDeleteTimetable,
  onOpenTimetableModal,
  onExportIcal,
  onExportTimetablesJson,
  onImportTimetablesJson,
  onOpenLayoutPicker,
  onOpenCourseListPicker,
  onOpenPlannerSettings,
  onOpenHelp,
  currentCourseListLabel,
  currentLayoutLabel,
  courses,
  onRemoveCourse,
  totalCredits: customTotalCredits,
  blockedSlots,
  onOpenCourseSearch,
  onOpenCourseLocks,
  courseLocksCount,
  onOpenGenerator,
  onOpenPasteRegistered,
  onOpenManualLinker,
  selectedCourseCode,
  onClearSelectedCourse,
  selectedCourse,
  isGroupingEnabled = true,
  setIsGroupingEnabled,
  slotFilter = "all",
  setSlotFilter,
  selectedSlotIndex = "-1",
  setSelectedSlotIndex,
  availableSlots = [],
  hasTheory = true,
  hasLab = false,
  onOpenSlotSearch,
  onAddCourse,
  courseAlternativesPool = [],
  onOpenFacultyReview,
  renderTypeChips,
  getBatchColorClass,
  friends = [],
  friendGroups = [],
  socialTargetId = "",
  setSocialTargetId,
  socialScoreGroupMethod = "intersection",
  setSocialScoreGroupMethod,
  isCalculatingSocialScore = false,
  dynamicSocialScore = 0,
  onOpenSocialMatrix,
  onOpenFriendsManager,
  facultyGroupsCount = 0,
  onOpenFacultySchedule,
  enableVitfacIntegration = true,
  isDownloading = false,
  onDownloadHtmlDossier,
  onDownloadImage,
  onOpenPrintablePage,
  onOpenDetachedPrintablePage,
  tourStepTarget = null,
  wideScreenSingleWidgetColumn = false,
}: FFCSDashboardHeaderProps) {
  const isModernLayout = currentLayoutLabel?.toLowerCase().startsWith("modern") ?? false;
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidget[]>([
    "add-courses",
    "timetables",
  ]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileWidget, setMobileWidget] = useState<MobileWidget | null>(null);
  const [isWeeklyDetailsOpen, setIsWeeklyDetailsOpen] = useState(false);
  const [isClashDetailsOpen, setIsClashDetailsOpen] = useState(false);
  const widgetPreferencesReady = useRef(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [statTileCount, setStatTileCount] = useState(MAX_STAT_TILES);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
      updateViewport();
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
      if (!media.matches) setMobileWidget(null);
    };
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (selectedCourseCode) {
      setMobileWidget("selected-course");
    } else {
      setMobileWidget((current) =>
        current === "selected-course" ? null : current
      );
    }
  }, [isMobileViewport, selectedCourseCode]);

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState(activeTimetable?.name || "");

  /*
    The guided tour targets `ffcs-social` and `ffcs-export`, which live inside
    their chip-tab panels. When the tour reaches one of those steps, open the
    matching tab so the spotlight finds a real, visible anchor instead of
    degrading to a centred card — and scroll it into view, because the panel
    may have just appeared below the fold (the spotlight re-measures on
    scroll). The target arrives as a plain prop announced by the tab's
    TourProvider: the planner deliberately sits OUTSIDE that provider, so no
    context is consumed here.
  */
  useEffect(() => {
    if (tourStepTarget !== "ffcs-social" && tourStepTarget !== "ffcs-export") return;
    const tourWidget: DashboardWidget = tourStepTarget === "ffcs-social" ? "social" : "export";
    setEnabledWidgets((current) =>
      current.includes(tourWidget) ? current : [...current, tourWidget]
    );
    const raf = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-tour-id="${tourStepTarget}"]`)
        ?.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return () => cancelAnimationFrame(raf);
  }, [tourStepTarget]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ffcs_dashboard_widgets");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validWidgets = parsed.filter(
            (widget): widget is DashboardWidget =>
              widget === "add-courses" ||
              UTILITY_TABS.some((tab) => tab.value === widget)
          );
          setEnabledWidgets(validWidgets);
        } else {
          console.warn("Ignoring invalid FFCS dashboard widget preferences.");
        }
      }
    } catch (error) {
      console.error("Failed to load FFCS dashboard widget preferences:", error);
    } finally {
      widgetPreferencesReady.current = true;
    }
  }, []);

  useEffect(() => {
    if (!widgetPreferencesReady.current) return;
    try {
      window.localStorage.setItem("ffcs_dashboard_widgets", JSON.stringify(enabledWidgets));
    } catch (error) {
      console.error("Failed to save FFCS dashboard widget preferences:", error);
    }
  }, [enabledWidgets]);

  useEffect(() => {
    const container = statsContainerRef.current;
    if (!container) return;

    const updateCount = (width: number) => {
      if (width > 0) setStatTileCount(getFittingStatTileCount(width));
    };

    updateCount(container.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(([entry]) => updateCount(entry.contentRect.width));
      observer.observe(container);
      return () => observer.disconnect();
    }

    const handleResize = () => updateCount(container.getBoundingClientRect().width);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleStartRename = () => {
    setRenameInput(activeTimetable?.name || "");
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    const trimmed = renameInput.trim();
    if (trimmed && trimmed !== activeTimetable?.name) {
      onRenameTimetable(activeTimetable.id, trimmed);
    }
    setIsRenaming(false);
  };

  const { courseClashes, blockedSlotClashes } = useMemo(() => {
    const courseClashes: CourseClash[] = [];
    const blockedSlotClashes: BlockedSlotClash[] = [];
    const schema = getTimetableSchema();
    for (let i = 0; i < courses.length; i++) {
      const pA = courses[i].slots.flatMap((s) => periodsForSlot(schema, s));
      for (let j = i + 1; j < courses.length; j++) {
        const pB = courses[j].slots.flatMap((s) => periodsForSlot(schema, s));
        const clash = findPeriodClash(pA, pB);
        if (clash) {
          courseClashes.push({
            courseA: courses[i],
            courseB: courses[j],
            periodA: clash.periodA,
            periodB: clash.periodB,
          });
        }
      }
    }
    if (blockedSlots && blockedSlots.size > 0) {
      courses.forEach((c) => {
        c.slots.forEach((s) => {
          if (blockedSlots.has(s)) blockedSlotClashes.push({ course: c, slot: s });
        });
      });
    }
    return { courseClashes, blockedSlotClashes };
  }, [courses, blockedSlots]);
  const clashCount = courseClashes.length + blockedSlotClashes.length;

  // Total credits calculation
  const totalCredits = useMemo(() => {
    if (typeof customTotalCredits === "number") return customTotalCredits;
    return courses.reduce((sum, course) => {
      const credits = Number.parseFloat(course.credits || "0");
      return sum + (Number.isFinite(credits) ? credits : 0);
    }, 0);
  }, [courses, customTotalCredits]);

  // Schedule rhythm: Days with classes and free half-days
  const { daysWithClassesCount, freeHalfDaysCount } = useMemo(() => {
    const schema = getTimetableSchema();
    const days = new Set<string>();
    courses.forEach((c) => {
      c.slots.forEach((s) => {
        periodsForSlot(schema, s).forEach((p) => {
          days.add(p.day);
        });
      });
    });
    const fHalf = freeHalfDays(courses, schema);
    return {
      daysWithClassesCount: days.size,
      freeHalfDaysCount: fHalf.length,
    };
  }, [courses]);

  const statTiles = useMemo<DashboardStat[]>(() => [
    ...(courses.length > 0 ? [{
      id: "total-credits",
      label: "Total Credits",
      value: `${totalCredits} / 27`,
      badge:
        totalCredits > 27
          ? "Overload"
          : totalCredits >= 20
          ? "Optimal"
          : `${Math.max(0, 27 - totalCredits)} cr left`,
      sub: `${Math.max(0, 27 - totalCredits)} credits remaining`,
      tone:
        totalCredits > 27
          ? "red"
          : totalCredits >= 20
          ? "emerald"
          : "indigo",
    }] : []),
    ...(courses.length > 0 || timetables.length > 1 ? [{
      id: "active-timetable",
      label: "Active Timetable",
      value: activeTimetable?.name || "Timetable 1",
      sub: `${courses.length} course${courses.length === 1 ? "" : "s"} enrolled`,
      badge: `${timetables.length} plan${timetables.length === 1 ? "" : "s"}`,
      tone: "blue",
      className: "transition-all hover:border-blue-500/40",
    }] : []),
    ...(clashCount > 0
      ? [{
          id: "clash-status",
          label: "Clash Status",
          value: `${clashCount} Clash${clashCount > 1 ? "es" : ""}`,
          sub: "Slot collision detected",
          badge: "Alert",
          tone: "red",
        }]
      : []),
    ...(courses.length > 0 ? [{
      id: "weekly-rhythm",
      label: "Weekly Rhythm",
      value: `${freeHalfDaysCount} / 10`,
      sub: `${daysWithClassesCount} class days · free half-days`,
      badge: freeHalfDaysCount >= 4 ? "Light" : "Standard",
      tone: freeHalfDaysCount >= 4 ? "emerald" : "blue",
      className: "cursor-pointer hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
    }] : []),
  ], [
    activeTimetable?.name,
    courses.length,
    timetables.length,
    totalCredits,
    clashCount,
    daysWithClassesCount,
    freeHalfDaysCount,
  ]);
  const statSlides = useMemo<InsightSlide[]>(
    () =>
      statTiles.map((tile) => ({
        id: tile.id,
        label: tile.label,
        value: tile.value,
        sub: tile.sub,
        badge: tile.badge,
        tone: tile.tone,
        onClick:
          tile.id === "clash-status"
            ? () => setIsClashDetailsOpen(true)
            : tile.id === "active-timetable"
            ? onOpenTimetableModal
            : undefined,
        valueClassName: "text-xl sm:text-2xl leading-tight whitespace-normal break-words",
      })),
    [statTiles, onOpenTimetableModal]
  );
  const hasStatOverflow = statTiles.length > statTileCount;
  const directTileCount = hasStatOverflow
    ? Math.max(0, statTileCount - 1)
    : statTiles.length;
  const weeklyRhythmTile = statTiles.find((tile) => tile.id === "weekly-rhythm");
  const desktopDirectTiles = hasStatOverflow
    ? [
        ...(directTileCount > 0 && weeklyRhythmTile ? [weeklyRhythmTile] : []),
        ...statTiles
          .filter((tile) => tile.id !== "weekly-rhythm")
          .slice(
            0,
            directTileCount - (directTileCount > 0 && weeklyRhythmTile ? 1 : 0)
          ),
      ]
    : statTiles;
  const mobileDirectTiles = [
    ...(weeklyRhythmTile ? [weeklyRhythmTile] : []),
    ...statTiles.filter((tile) => tile.id !== "weekly-rhythm"),
  ].slice(0, 1);
  const directTiles = isMobileViewport ? mobileDirectTiles : desktopDirectTiles;
  const directStatIds = new Set(directTiles.map((tile) => tile.id));
  const overflowSlides = statSlides
    .filter((slide) => !directStatIds.has(slide.id))
    .sort((a, b) => {
      if (isMobileViewport) return 0;
      if (a.id === "active-timetable") return 1;
      if (b.id === "active-timetable") return -1;
      return 0;
    });
  const statCarousel = useCarousel(overflowSlides.length);
  const statColumnCount = isMobileViewport
    ? 2
    : Math.max(1, directTiles.length + (overflowSlides.length > 0 ? 1 : 0));
  const courseMenuActions: Record<CourseMenuAction, () => void> = {
    "manual-add": onOpenCourseSearch,
    "target-courses": onOpenCourseLocks,
    "auto-generate": onOpenGenerator,
    "paste-vtop": onOpenPasteRegistered,
    "advanced-linker": () => onOpenManualLinker?.(),
  };
  const toggleWidget = (widget: DashboardWidget) => {
    setEnabledWidgets((current) =>
      current.includes(widget)
        ? current.filter((item) => item !== widget)
        : [...current, widget]
    );
  };
  const openWidget = (widget: MobileWidget) => {
    if (isMobileViewport) {
      if (widget !== "selected-course") {
        setEnabledWidgets((current) =>
          current.includes(widget) ? current : [...current, widget]
        );
      }
      setMobileWidget(widget);
      return;
    }
    if (widget === "selected-course") {
      document
        .querySelector<HTMLElement>('[aria-label="Configure Selected Course widget"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    toggleWidget(widget);
  };

  return (
    <div className="w-full space-y-4">
      {/* ── ZONE 1: KPI STAT SUMMARY STRIP ── */}
      <div
        ref={statsContainerRef}
        data-testid={statTiles.length > 0 ? "ffcs-stat-strip" : undefined}
        className={`grid gap-3 ${statTiles.length === 0 ? "hidden" : ""}`}
        style={{
          gridTemplateColumns: isMobileViewport
            ? "repeat(2, minmax(0, 1fr))"
            : `repeat(${statColumnCount}, minmax(min(100%, ${STAT_TILE_MIN_WIDTH}px), ${STAT_TILE_MIN_WIDTH}px))`,
        }}
      >
        {directTiles.map((tile) => {
          const statTile = (
            <StatTile
              label={tile.label}
              value={tile.value}
              sub={tile.sub}
              badge={tile.badge}
              tone={tile.tone}
              height="h-28 sm:h-32"
              className={tile.id === "weekly-rhythm" ? "" : tile.className ?? ""}
            />
          );
          return tile.id === "weekly-rhythm" ? (
            <button
              key={tile.id}
              type="button"
              onClick={() => setIsWeeklyDetailsOpen(true)}
              aria-label={`Weekly Rhythm: ${freeHalfDaysCount} free half-days out of 10. View schedule details.`}
              className="min-w-0 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {statTile}
            </button>
          ) : tile.id === "active-timetable" ? (
            <button
              key={tile.id}
              type="button"
              onClick={onOpenTimetableModal}
              aria-label={`Active Timetable: ${activeTimetable?.name || "Timetable 1"}. ${courses.length} course${courses.length === 1 ? "" : "s"} enrolled. Switch timetable.`}
              className="min-w-0 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {statTile}
            </button>
          ) : tile.id === "clash-status" ? (
            <button
              key={tile.id}
              type="button"
              onClick={() => setIsClashDetailsOpen(true)}
              aria-label={`Clash Status: ${clashCount === 0 ? "Conflict-Free" : `${clashCount} ${clashCount === 1 ? "clash" : "clashes"}`}. View clashing courses.`}
              className="min-w-0 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {statTile}
            </button>
          ) : <React.Fragment key={tile.id}>{statTile}</React.Fragment>;
        })}
        {overflowSlides.length > 0 && (
          <InsightCarousel
            slides={overflowSlides}
            carousel={statCarousel}
            height="h-28 sm:h-32"
            ariaLabel="More timetable statistics"
            className="min-w-0"
          />
        )}
      </div>

      {/* ── ZONE 3: SELECTABLE DASHBOARD WIDGETS ── */}
      <div className="space-y-2 pt-1">
        <h3 id="ffcs-widgets-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Dashboard Widgets
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)] gap-3 items-start">
        <nav aria-label="Planner menu" className="space-y-3">
          {isMobileViewport ? (
            <section aria-labelledby="ffcs-add-course-heading" className="space-y-2">
              <h3 id="ffcs-add-course-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Add Courses
              </h3>
              <ListShell>
                {COURSE_MENU_ACTIONS.map(({ value, label, description, Icon, iconClass, tourTarget }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={courseMenuActions[value]}
                    data-tour-id={tourTarget}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <ListRowText title={label} titleTag="span" subtitle={description} />
                    {value === "target-courses" && courseLocksCount > 0 && (
                      <span className="min-w-5 h-5 px-1 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {courseLocksCount}
                      </span>
                    )}
                  </button>
                ))}
              </ListShell>
            </section>
          ) : (
            <ListShell>
              <button
                type="button"
                aria-pressed={enabledWidgets.includes("add-courses")}
                onClick={() => toggleWidget("add-courses")}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                  enabledWidgets.includes("add-courses")
                    ? "bg-blue-500/10"
                    : "hover:bg-surface-secondary/60"
                }`}
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  <PlusCircle className="w-4 h-4" />
                </span>
                <ListRowText
                  title="Add Courses"
                  titleTag="span"
                  subtitle="Show or hide the course-add widget."
                />
                {enabledWidgets.includes("add-courses") && (
                  <Check className="w-4 h-4 text-blue-500 shrink-0" />
                )}
              </button>
            </ListShell>
          )}

          <section aria-labelledby="ffcs-utility-heading" className="space-y-2">
            <h3 id="ffcs-utility-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Planner & Social
            </h3>
            <ListShell>
              {UTILITY_TABS.map(({ value, label, description, Icon, iconClass }) => {
                const isEnabled = enabledWidgets.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isMobileViewport ? mobileWidget === value : isEnabled}
                    onClick={() => openWidget(value)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                      isEnabled ? "bg-indigo-500/10" : "hover:bg-surface-secondary/60"
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <ListRowText title={label} titleTag="span" subtitle={description} />
                    {isMobileViewport ? (
                      <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${mobileWidget === value ? "rotate-180" : ""}`} />
                    ) : isEnabled ? (
                      <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </ListShell>
          </section>

          {selectedCourseCode && (
            <ListShell>
              <button
                type="button"
                aria-pressed={isMobileViewport && mobileWidget === "selected-course"}
                onClick={() => openWidget("selected-course")}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                  <PlusCircle className="w-4 h-4" />
                </span>
                <ListRowText
                  title="Configure Selected Course"
                  titleTag="span"
                  subtitle={selectedCourseCode}
                />
                {isMobileViewport && <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${mobileWidget === "selected-course" ? "rotate-180" : ""}`} />}
              </button>
            </ListShell>
          )}

          <section
            aria-labelledby="ffcs-view-course-heading"
            className={`space-y-2 ${isModernLayout ? "xl:hidden" : ""}`}
          >
            <h3 id="ffcs-view-course-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Views & Course Lists
            </h3>
            <ListShell>
              <button
                type="button"
                onClick={onOpenLayoutPicker}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                  <PanelsTopLeft className="w-4 h-4" />
                </span>
                <ListRowText title="Switch Planner View" titleTag="span" subtitle={currentLayoutLabel || "Choose Guided, Modern, or Classic."} />
              </button>
              <button
                type="button"
                onClick={onOpenCourseListPicker}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/20">
                  <ListFilter className="w-4 h-4" />
                </span>
                <ListRowText title="Switch Course List" titleTag="span" subtitle={currentCourseListLabel || "Choose the semester course report."} />
              </button>
            </ListShell>
          </section>
          {onOpenPlannerSettings && (
            <section
              aria-labelledby="ffcs-settings-heading"
              className={`space-y-2 ${isModernLayout ? "xl:hidden" : ""}`}
            >
              <h3 id="ffcs-settings-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Planner Settings
              </h3>
              <ListShell>
                <button
                  type="button"
                  onClick={onOpenPlannerSettings}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20">
                    <Settings2 className="w-4 h-4" />
                  </span>
                  <ListRowText
                    title="Planner Settings"
                    titleTag="span"
                    subtitle="Adjust ranking, defaults, and planner preferences."
                  />
                </button>
                {isMobileViewport && onOpenHelp && (
                  <button
                    type="button"
                    onClick={onOpenHelp}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                      <CircleHelp className="w-4 h-4" />
                    </span>
                    <ListRowText
                      title="How does this work?"
                      titleTag="span"
                      subtitle="Open the FFCS planner guide."
                    />
                  </button>
                )}
              </ListShell>
            </section>
          )}
        </nav>

        {/* Enabled widgets */}
        <MobileWidgetSheet
          isMobile={isMobileViewport}
          widget={mobileWidget}
          onClose={() => setMobileWidget(null)}
        >
        <div
          id="ffcs-utility-panel"
          aria-label="Enabled planner widgets"
          className={`min-w-0 columns-1 gap-3 ${
            wideScreenSingleWidgetColumn ? "xl:columns-1" : "xl:columns-2"
          } [&>*]:mb-3 [&>*]:break-inside-avoid`}
        >
          {selectedCourseCode &&
            (!isMobileViewport || mobileWidget === "selected-course") && (
            <section
              aria-label="Configure Selected Course widget"
              className="min-w-0 rounded-2xl border border-indigo-500/30 dark:border-indigo-500/40 card-surface p-4 sm:p-5 shadow-xs space-y-4 animate-fadeIn"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                    <PlusCircle className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                      Configure Selected Course
                    </p>
                    <h3 className="text-sm font-extrabold text-text-heading truncate">
                      {selectedCourseCode} · {selectedCourse?.title}
                    </h3>
                  </div>
                </div>
                {onClearSelectedCourse && (
                  <button
                    type="button"
                    onClick={onClearSelectedCourse}
                    className="p-2 rounded-xl border border-border-strong text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
                    title="Cancel course selection"
                    aria-label="Cancel course selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <form onSubmit={onAddCourse} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {setIsGroupingEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-heading">Group Embedded</span>
                      <Switch
                        checked={isGroupingEnabled}
                        onCheckedChange={setIsGroupingEnabled}
                        label="Group Embedded Courses"
                      />
                    </div>
                  )}
                  {setSlotFilter && (
                    <ChipTabs
                      size="sm"
                      value={slotFilter}
                      onChange={(value) => {
                        setSlotFilter(value);
                        setSelectedSlotIndex?.("-1");
                      }}
                      options={[
                        { value: "all", label: "All Slots" },
                        ...(isGroupingEnabled
                          ? [
                              { value: "morning_session", label: "Morning" },
                              { value: "evening_session", label: "Evening" },
                            ]
                          : [
                              ...((!hasLab || hasTheory)
                                ? [
                                    { value: "morning", label: "Morn Theory" },
                                    { value: "evening", label: "Eve Theory" },
                                  ]
                                : []),
                              ...((!hasTheory || hasLab)
                                ? [
                                    { value: "morning_lab", label: "Morn Lab" },
                                    { value: "evening_lab", label: "Eve Lab" },
                                  ]
                                : []),
                            ]),
                      ]}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Slot & Faculty Choice
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSlotSearch}
                    className="w-full min-h-[48px] bg-surface border border-border-strong hover:border-indigo-500/50 rounded-xl px-3 py-2.5 text-left text-text-heading hover:bg-surface-secondary/50 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <span className="truncate text-sm font-medium flex items-center gap-2 min-w-0">
                      {selectedSlotIndex !== "-1" && availableSlots[Number(selectedSlotIndex)] ? (
                        <>
                          <FacultyAvatar
                            employeeId={availableSlots[Number(selectedSlotIndex)].ERP_ID}
                            name={availableSlots[Number(selectedSlotIndex)].FACULTY}
                            size="xs"
                            tone="blue"
                          />
                          <span className="truncate font-semibold">
                            {availableSlots[Number(selectedSlotIndex)].SLOT} — {availableSlots[Number(selectedSlotIndex)].FACULTY}
                          </span>
                          {onOpenFacultyReview && (
                            <VitfacReviewPill
                              employeeId={availableSlots[Number(selectedSlotIndex)].ERP_ID}
                              name={availableSlots[Number(selectedSlotIndex)].FACULTY}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenFacultyReview({
                                  name: availableSlots[Number(selectedSlotIndex)].FACULTY,
                                  employeeId: availableSlots[Number(selectedSlotIndex)].ERP_ID,
                                  courseCode: selectedCourseCode,
                                });
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Click to choose slot & faculty option...
                        </span>
                      )}
                    </span>
                    <Search className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>
                </div>

                {availableSlots.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Faculty, slots & timetable conflicts
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {availableSlots.length} options
                      </span>
                    </div>
                    <div className="space-y-2">
                      {availableSlots.slice(0, 5).map((option, index) => {
                        const optionSlots = String(option.SLOT ?? "")
                          .split("+")
                          .map((slot: string) => slot.trim())
                          .filter(Boolean);
                        const optionPeriods = optionSlots.flatMap((slot: string) =>
                          periodsForSlot(getTimetableSchema(), slot)
                        );
                        const conflictingCourses = courses
                          .filter((course) => {
                            const coursePeriods = course.slots.flatMap((slot) =>
                              periodsForSlot(getTimetableSchema(), slot)
                            );
                            return findPeriodClash(optionPeriods, coursePeriods);
                          })
                          .map((course) => course.code);
                        return (
                          <CourseOptionQuality
                            key={`${option.ERP_ID ?? option.FACULTY}-${option.SLOT}-${index}`}
                            courseCode={selectedCourseCode}
                            slots={String(option.SLOT ?? "")}
                            faculty={String(option.FACULTY ?? "")}
                            employeeId={option.ERP_ID}
                            clashes={conflictingCourses}
                          />
                        );
                      })}
                    </div>
                    {availableSlots.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">
                        Open the slot picker to compare all {availableSlots.length} options.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                  className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Course to Timetable</span>
                </button>
              </form>
            </section>
          )}

          {!isMobileViewport && enabledWidgets.includes("add-courses") && (
            <section
              aria-label="Add Courses widget"
              className="min-w-0 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  <PlusCircle className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-text-heading">Add Courses</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose how to add courses to this timetable.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COURSE_MENU_ACTIONS.map(({ value, label, description, Icon, iconClass, tourTarget }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={courseMenuActions[value]}
                    data-tour-id={tourTarget}
                    title={description}
                    className="min-h-[68px] flex items-center gap-3 p-3 text-left rounded-xl border border-border-strong/70 bg-surface hover:bg-surface-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-text-heading">{label}</span>
                      <span className="block text-[10px] leading-snug text-muted-foreground mt-0.5">{description}</span>
                    </span>
                    {value === "target-courses" && courseLocksCount > 0 && (
                      <span className="min-w-5 h-5 px-1 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {courseLocksCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Timetable Actions */}
          {enabledWidgets.includes("timetables") &&
            (!isMobileViewport || mobileWidget === "timetables") && (
            <section aria-label="Timetable Actions widget" className="min-w-0 space-y-4 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Timetable Selector Modal Trigger */}
                <button
                  type="button"
                  onClick={onOpenTimetableModal}
                  className="flex-1 min-h-[44px] bg-surface border border-border-strong hover:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-text-heading hover:bg-surface-secondary transition-all flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
                  title="Switch or manage saved timetables"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate font-bold">
                      {activeTimetable?.name || "Select Timetable"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground bg-surface-secondary px-2 py-0.5 rounded-md font-semibold">
                      {courses.length} courses
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-text-heading transition-transform" />
                  </div>
                </button>

                {/* Create New Timetable Button */}
                <button
                  type="button"
                  onClick={onCreateNewTimetable}
                  className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
                  title="Create a new blank timetable"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Plan</span>
                </button>
              </div>

              {/* Active Plan Actions: Rename, Duplicate, Delete */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleStartRename}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-text-heading bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-xl transition-all font-semibold cursor-pointer shadow-2xs"
                  title="Rename current timetable"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  onClick={onDuplicateTimetable}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-text-heading bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-xl transition-all font-semibold cursor-pointer shadow-2xs"
                  title="Duplicate current timetable"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Duplicate</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteTimetable(activeTimetable.id)}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl transition-all font-semibold cursor-pointer shadow-2xs"
                  title="Delete current timetable"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {/* Inline Rename Form */}
              {isRenaming && (
                <div className="flex items-center gap-2 animate-fadeIn pt-1">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                    placeholder="Enter new timetable name..."
                    className="flex-1 min-h-[44px] bg-surface border border-indigo-500/50 rounded-xl px-3 text-sm text-text-heading focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleConfirmRename}
                    className="min-h-[44px] px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                    title="Confirm rename"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="min-h-[44px] px-3 bg-surface hover:bg-surface-secondary border border-border-strong text-muted-foreground rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Backup, Restore & iCal Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border-strong/40">
                <button
                  type="button"
                  onClick={onExportIcal}
                  className="min-h-[44px] flex items-center justify-center gap-2 p-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-xl text-xs font-semibold text-text-heading transition-all shadow-2xs cursor-pointer"
                  title="Export to Apple / Google Calendar"
                >
                  <Download className="w-4 h-4 text-blue-500" />
                  <span>iCal Export</span>
                </button>

                <button
                  type="button"
                  onClick={onExportTimetablesJson}
                  className="min-h-[44px] flex items-center justify-center gap-2 p-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-xl text-xs font-semibold text-text-heading transition-all shadow-2xs cursor-pointer"
                  title="Export complete backup as JSON"
                >
                  <Save className="w-4 h-4 text-indigo-500" />
                  <span>Backup JSON</span>
                </button>

                <label
                  className="min-h-[44px] flex items-center justify-center gap-2 p-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-xl text-xs font-semibold text-text-heading transition-all shadow-2xs cursor-pointer"
                  title="Restore timetables from backup JSON"
                >
                  <input
                    type="file"
                    accept=".json"
                    onChange={onImportTimetablesJson}
                    className="hidden"
                  />
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>Restore JSON</span>
                </label>
              </div>
            </section>
          )}

          {/* Friends & Social */}
          {enabledWidgets.includes("social") &&
            (!isMobileViewport || mobileWidget === "social") && (
            <section aria-label="Social & Friends widget" className="min-w-0 space-y-4 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-pink-500" />
                    <span>Social Overlap</span>
                  </label>
                  {isCalculatingSocialScore && (
                    <button
                      type="button"
                      onClick={onOpenSocialMatrix}
                      className="text-xs font-black text-pink-500 bg-pink-500/10 hover:bg-pink-500/20 px-2.5 py-0.5 rounded-full border border-pink-500/20 transition-colors cursor-pointer"
                    >
                      Score: {dynamicSocialScore}%
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {onOpenSocialMatrix && (
                    <button
                      type="button"
                      onClick={onOpenSocialMatrix}
                      data-tour-id="ffcs-social"
                      className="min-h-[38px] px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Social Matrix</span>
                    </button>
                  )}

                  {onOpenFriendsManager && (
                    <button
                      type="button"
                      onClick={onOpenFriendsManager}
                      className="min-h-[38px] px-3 py-1.5 bg-surface hover:bg-surface-secondary border border-border-strong text-text-heading rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Manage Friends</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Friend / Group Selector Strip */}
              {setSocialTargetId && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <div className="flex-1 min-w-0">
                    <ChipTabs
                      size="sm"
                      className="min-w-0"
                      value={socialTargetId}
                      onChange={setSocialTargetId}
                      options={[
                        {
                          value: "",
                          label: "Select Friend / Group…",
                          title: "No target selected",
                        },
                        ...friends.map((f) => ({
                          value: f.id,
                          label: f.name,
                          title: `Friend: ${f.name}`,
                        })),
                        ...friendGroups.map((g) => ({
                          value: g.id,
                          label: g.name,
                          title: `Group: ${g.name}`,
                        })),
                      ]}
                    />
                  </div>

                  {setSocialScoreGroupMethod &&
                    friendGroups.some((g) => g.id === socialTargetId) && (
                      <div className="shrink-0">
                        <SegmentedControl
                          value={socialScoreGroupMethod}
                          onChange={setSocialScoreGroupMethod}
                          options={[
                            { value: "intersection", label: "Intersection" },
                            { value: "cumulative", label: "Cumulative" },
                          ]}
                        />
                      </div>
                    )}
                </div>
              )}
            </section>
          )}

          {/* Faculty & Reviews */}
          {enabledWidgets.includes("faculty") &&
            (!isMobileViewport || mobileWidget === "faculty") && (
            <section aria-label="Faculty & Reviews widget" className="min-w-0 space-y-4 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-text-heading">
                    Faculty Schedule Insights
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Look up entire weekly schedules of faculty members across campus.
                  </p>
                </div>

                {onOpenFacultySchedule && (
                  <button
                    type="button"
                    onClick={onOpenFacultySchedule}
                    className="min-h-[44px] px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs shrink-0"
                    title="See the full week taught by any faculty member"
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>Faculty Schedules</span>
                    {facultyGroupsCount > 0 && (
                      <span className="text-[10px] font-black bg-cyan-500/20 px-1.5 py-0.5 rounded-md">
                        {facultyGroupsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Vitfac Community Review Banner */}
              {enableVitfacIntegration && (
                <div className="pt-2 border-t border-border-strong/40">
                  <a
                    href="https://vitfac.pages.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-2.5 px-3.5 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-between gap-2 shadow-2xs group"
                    title="Leave or view reviews on vitfac.pages.dev"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-black text-xs">
                        ★
                      </span>
                      <span className="truncate">
                        Reviewed your profs? Help others on vitfac.pages.dev
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <p className="text-[10.5px] text-muted-foreground/70 px-1 pt-1 leading-tight">
                    Disclaimer: Ratings are sourced from community platform vitfac.pages.dev.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Export Dossier */}
          {enabledWidgets.includes("export") &&
            (!isMobileViewport || mobileWidget === "export") && (
            <section aria-label="Export Dossier widget" className="min-w-0 space-y-4 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs" data-tour-id="ffcs-export">
              <div>
                <h4 className="text-sm font-bold text-text-heading mb-1">
                  Export Timetable Dossier
                </h4>
                <p className="text-xs text-muted-foreground">
                  Download a standalone HTML dossier with course breakdowns, or export high-resolution PNG/JPG graphics.
                </p>
              </div>

              {/* Dossier downloads */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => onDownloadHtmlDossier?.()}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
                  title="Download HTML dossier with current theme"
                >
                  <Download className="w-4 h-4" />
                  <span>Download HTML Dossier</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadHtmlDossier?.("light")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] bg-surface hover:bg-surface-secondary border border-border-strong disabled:opacity-50 text-text-heading px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                  title="Download light theme HTML dossier"
                >
                  <span>☀️ Light HTML</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadHtmlDossier?.("dark")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] bg-surface hover:bg-surface-secondary border border-border-strong disabled:opacity-50 text-text-heading px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                  title="Download dark theme HTML dossier"
                >
                  <span>🌙 Dark HTML</span>
                </button>
              </div>

              {/* Image & Web Preview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-strong/40">
                <button
                  type="button"
                  onClick={() => onDownloadImage?.("jpg")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] px-3 py-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 text-text-heading text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-500" />
                  <span>JPG (Active)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadImage?.("jpg", "horizontal")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] px-3 py-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 text-text-heading text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-500" />
                  <span>JPG (Grid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadImage?.("jpg", "vertical")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] px-3 py-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 text-text-heading text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-500" />
                  <span>JPG (Vertical)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadImage?.("png")}
                  disabled={isDownloading || courses.length === 0}
                  className="min-h-[44px] px-3 py-2 bg-surface hover:bg-surface-secondary border border-border-strong/70 text-text-heading text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-500" />
                  <span>PNG Image</span>
                </button>
              </div>

              {/* Web preview row: the in-app dossier is a view, not a
                  download, so it sits beside the standalone print tab rather
                  than in the format grid above. */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/40 flex-wrap">
                <button
                  type="button"
                  onClick={onOpenPrintablePage}
                  className="min-h-[44px] px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>In-App Dossier</span>
                </button>

                {onOpenDetachedPrintablePage && (
                  <button
                    type="button"
                    onClick={onOpenDetachedPrintablePage}
                    className="text-xs text-muted-foreground hover:text-text-heading flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Standalone Print Tab</span>
                  </button>
                )}
              </div>
            </section>
          )}
          {enabledWidgets.length === 0 && !isMobileViewport && (
            <div className="xl:col-span-2 min-h-40 rounded-2xl border border-dashed border-border-strong flex flex-col items-center justify-center text-center p-6">
              <PanelsTopLeft className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-text-heading">No widgets enabled</p>
              <p className="text-xs text-muted-foreground mt-1">Select a widget from the menu to add it here.</p>
            </div>
          )}
        </div>
        </MobileWidgetSheet>
      </div>
      <AnimatePresence>
        {isWeeklyDetailsOpen && (
          <WeeklyRhythmDetails
            courses={courses}
            onClose={() => setIsWeeklyDetailsOpen(false)}
          />
        )}
        {isClashDetailsOpen && (
          <ClashDetails
            courseClashes={courseClashes}
            blockedSlotClashes={blockedSlotClashes}
            onRemoveCourse={onRemoveCourse}
            onClose={() => setIsClashDetailsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
