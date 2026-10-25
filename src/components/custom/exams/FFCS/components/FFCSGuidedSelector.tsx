"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Check,
  AlertTriangle,
  Users,
  Sparkles,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  PlusCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Minimize2,
  X,
  ClipboardPaste,
  Sliders,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Award,
  Flame,
  Star,
  MapPin,
  Clock,
  Wand2,
  Compass,
  Lock,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  Play,
  Eye,
  LayoutGrid,
  LayoutDashboard,
  Smartphone,
  Download,
} from "lucide-react";
import { Switch, SegmentedControl } from "../../../shared/primitives";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyReviewSheet";
import { ParsedCourse, AddedCourse, TimetableState, CourseLock, Friend, FriendGroup, TimetablePeriod } from "../types";
import { COLORS, DAYS } from "../constants";
import { splitSlots, sameSlotFacultyAlternatives } from "../logic/generate";
import { useVitfacReview, getFacultyReview } from "@/lib/vitfacService";
import { CourseImportPanel, type ImportMode } from "./CourseImportPanel";
import { useGenerationRun } from "../hooks/useGenerationRun";
import { getTimetableSchema } from "@/lib/campusSchema";
import { timetableMetrics, type SortBy } from "@/lib/timetableMetrics";
import type { RankingMode } from "@/lib/ffcsRanking";
import type { FFCSSettings } from "@/lib/ffcsSettings";
import { usePwaInstall } from "@/lib/pwaInstall";
import SlotFacultySwapSheet from "./SlotFacultySwapSheet";
import VerticalTimetableGrid from "@/components/custom/timetable/VerticalTimetableGrid";
import { toMinutes } from "@/lib/social/schedule";
import { ensureLunchPeriod } from "@/lib/slots";

export function requestNativeFullscreen(element?: HTMLElement): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const target = element || document.documentElement;
  if (!target) return Promise.resolve();

  try {
    if (typeof target.requestFullscreen === "function") {
      return target.requestFullscreen().catch(() => {});
    }
    const elWithWebkit = target as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      webkitRequestFullScreen?: () => Promise<void> | void;
    };
    if (typeof elWithWebkit.webkitRequestFullscreen === "function") {
      return Promise.resolve(elWithWebkit.webkitRequestFullscreen());
    }
    if (typeof elWithWebkit.webkitRequestFullScreen === "function") {
      return Promise.resolve(elWithWebkit.webkitRequestFullScreen());
    }
  } catch {
    // Ignore fullscreen request rejection
  }
  return Promise.resolve();
}

export function exitNativeFullscreen(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  try {
    const docWithWebkit = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitCancelFullScreen?: () => Promise<void> | void;
      fullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
    };

    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement || docWithWebkit.webkitFullscreenElement
    );

    if (!isCurrentlyFullscreen) return Promise.resolve();

    if (typeof document.exitFullscreen === "function") {
      return document.exitFullscreen().catch(() => {});
    }
    if (typeof docWithWebkit.webkitExitFullscreen === "function") {
      return Promise.resolve(docWithWebkit.webkitExitFullscreen());
    }
    if (typeof docWithWebkit.webkitCancelFullScreen === "function") {
      return Promise.resolve(docWithWebkit.webkitCancelFullScreen());
    }
  } catch {
    // Ignore exit fullscreen rejection
  }
  return Promise.resolve();
}

export type GuidedPhase =
  | "setup_mode"
  | "setup_timetable"
  | "setup_strategy"
  | "setup_locks"
  | "auto_courses"
  | "auto_slots_faculty"
  | "auto_timings"
  | "auto_blocking"
  | "auto_half_days"
  | "auto_social"
  | "auto_summary"
  | "auto_results"
  | "auto_timetable_view"
  | "manual_timetable_view"
  | "builder";

export type PlanMode = "auto" | "custom";
export type CourseStrategy = "lock_advance" | "one_by_one";

export interface FFCSGuidedSelectorProps {
  masterCourses: ParsedCourse[];
  uniqueCourses?: { code: string; title: string; types?: string[]; batches?: string[] }[];
  courses?: AddedCourse[];
  activeTimetable: TimetableState;
  onAddCourse: (newCourse: AddedCourse, isReplacing?: boolean) => void;
  checkClashes?: (slots: string[], excludeCourseCode?: string) => string | null;
  isGroupingEnabled?: boolean;
  setIsGroupingEnabled?: (enabled: boolean) => void;
  renderTypeChips?: (types: string[] | string, size?: "sm" | "md") => React.ReactNode;
  getBatchColorClass?: (batch: string) => string;
  courseAlternativesPool?: ParsedCourse[];
  onOpenFacultyReview?: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
  onOpenPasteRegistered?: () => void;
  onOpenManualLinker?: () => void;
  onViewTimetable?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: (isFullScreen: boolean) => void;
  onSwitchToSinglePageView?: () => void;
  // Wizard Setup & Timetable props
  timetables?: TimetableState[];
  allTimetables?: TimetableState[];
  onSelectTimetable?: (id: string) => void;
  onCreateNewTimetable?: () => void;
  onRenameTimetable?: (id: string, newName: string) => void;
  onDeleteTimetable?: (id: string) => void;
  onOpenGenerator?: () => void;
  onOpenCourseLocks?: () => void;
  initialGuidedPhase?: GuidedPhase;
  initialHasLaunchedHero?: boolean;
  initialStep?: GuidedStep;
  initialPlanMode?: PlanMode;
  onApplyTimetable?: (courses: AddedCourse[]) => void;
  // Course Locks props
  courseLocks?: CourseLock[];
  setCourseLocks?: React.Dispatch<React.SetStateAction<CourseLock[]>>;
  uniqueCourseCodes?: { code: string; title: string; types?: string[]; batches?: string[] }[];
  onImportCourses?: (courses: ParsedCourse[]) => void;
  onImportToTimetable?: (courses: AddedCourse[]) => void;
  // Faculty Schedule & Generator props
  onOpenFacultySchedule?: (facultyName: string) => void;
  friends?: Friend[];
  friendGroups?: FriendGroup[];
  socialScoreGroupMethod?: string;
  blockedSlots?: Set<string>;
  setBlockedSlots?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onToggleBlockSlot?: (slot: string) => void;
  settings?: FFCSSettings;
}

type GuidedStep = 1 | 2 | 3;

/**
 * Faculty Score Badge displayed alongside faculty in recommendations.
 */
function FacultyScoreBadge({
  employeeId,
  name,
  onOpenReview,
  className = "",
}: {
  employeeId?: string | null;
  name?: string | null;
  onOpenReview?: () => void;
  className?: string;
}) {
  const { review, loading } = useVitfacReview(employeeId, name);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 animate-pulse">
        <span>★</span>
        <span>Score...</span>
      </span>
    );
  }

  if (!review || review.reviews === 0) {
    return (
      <button
        type="button"
        onClick={onOpenReview}
        title={`Faculty: ${name || "Unknown"}\nNo community reviews logged yet on Vitfac`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-[10.5px] font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer shrink-0 ${className}`.trim()}
      >
        <span className="text-[10px] opacity-70">★</span>
        <span>Unrated</span>
      </button>
    );
  }

  const wPct = review.wPct ?? 0;
  const isHigh = wPct >= 75;
  const isMid = wPct >= 50 && wPct < 75;

  const toneClass = isHigh
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
    : isMid
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
    : "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25";

  const metricsTitle = review.metrics
    ? `\nTeaching: ${typeof review.metrics.lecture === "number" ? review.metrics.lecture.toFixed(1) : "-"}/5 • DA: ${typeof review.metrics.da === "number" ? review.metrics.da.toFixed(1) : "-"}/5 • Vibe: ${typeof review.metrics.vibe === "number" ? review.metrics.vibe.toFixed(1) : "-"}/5`
    : "";

  return (
    <button
      type="button"
      onClick={onOpenReview}
      title={`Faculty Rating: ${wPct}% Score based on ${review.reviews} reviews${metricsTitle}\nClick to view full review.`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0 ${toneClass} ${className}`.trim()}
    >
      <span className="text-[10px]">★</span>
      <span>{wPct}% Score</span>
      <span className="text-[9.5px] font-normal opacity-75 font-mono">({review.reviews})</span>
    </button>
  );
}

function FacultyScoresForCourse({
  facultyString,
  employeeId,
  courseCode,
  onOpenFacultyReview,
}: {
  facultyString: string;
  employeeId?: string;
  courseCode?: string;
  onOpenFacultyReview?: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
}) {
  const parts = facultyString.includes("/")
    ? facultyString.split("/").map((f) => f.trim())
    : [facultyString];

  if (parts.length === 1) {
    return (
      <FacultyScoreBadge
        name={parts[0]}
        employeeId={employeeId}
        onOpenReview={
          onOpenFacultyReview
            ? () => onOpenFacultyReview({ name: parts[0], employeeId, courseCode })
            : undefined
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {parts.map((name, idx) => (
        <FacultyScoreBadge
          key={`${name}-${idx}`}
          name={name}
          employeeId={idx === 0 ? employeeId : undefined}
          onOpenReview={
            onOpenFacultyReview
              ? () =>
                  onOpenFacultyReview({
                    name,
                    employeeId: idx === 0 ? employeeId : undefined,
                    courseCode,
                  })
              : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * Individual faculty vitfac metrics card displaying rating, reviews,
 * lecture/da/vibe scores, and highlights directly inside the Review & Place step.
 */
function FacultySingleReviewStat({
  name,
  employeeId,
  role,
  onOpenReviewModal,
}: {
  name: string;
  employeeId?: string;
  role?: string;
  onOpenReviewModal: () => void;
}) {
  const { review, loading } = useVitfacReview(employeeId, name);

  if (loading) {
    return (
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-3 w-20 bg-zinc-800/60 rounded" />
        </div>
        <div className="h-8 w-16 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (!review || review.reviews === 0) {
    return (
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs shrink-0 font-bold text-zinc-400">
            ★
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {role && <span className="text-zinc-400 mr-1.5 font-normal">[{role}]</span>}
              {name}
            </p>
            <p className="text-[10px] text-zinc-500">No community reviews logged yet on Vitfac</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenReviewModal}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
        >
          Check Directory →
        </button>
      </div>
    );
  }

  const winPct = review.wPct ?? 0;
  const isHighRating = winPct >= 80;
  const isMidRating = winPct >= 60 && winPct < 80;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FacultyAvatar employeeId={employeeId} name={name} size="md" tone={isHighRating ? "indigo" : "zinc"} />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-white truncate font-outfit">
              {role && <span className="text-zinc-400 mr-1.5 font-normal text-xs">[{role}]</span>}
              {name}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Based on <strong className="text-zinc-200">{review.reviews}</strong> verified student reviews
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-xs font-black shadow-xs ${
              isHighRating
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : isMidRating
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            <span>★</span>
            <span>{winPct}%</span>
            <span className="text-[9px] font-normal opacity-70">W</span>
          </div>
          {isHighRating && (
            <span className="text-[9px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <Award className="w-2.5 h-2.5" /> High Recommended
            </span>
          )}
        </div>
      </div>

      {review.metrics && (
        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-zinc-800/60">
          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Teaching</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.lecture === "number" ? review.metrics.lecture.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Award className="w-3 h-3 text-indigo-400" />
              <span>DA / Assign</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.da === "number" ? review.metrics.da.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Class Vibe</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.vibe === "number" ? review.metrics.vibe.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Top Lore:</span>
          {review.lore?.green && review.lore.green.length > 0 ? (
            review.lore.green.slice(0, 3).map((item, idx) => (
              <span
                key={idx}
                className="text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20 truncate max-w-[170px]"
              >
                ✓ {item.text}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-zinc-500">No tags recorded</span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenReviewModal}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0 ml-auto cursor-pointer"
        >
          <span>Full Lore</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function GuidedFacultyReviewStats({
  facultyString,
  employeeId,
  courseCode,
  onOpenFacultyReview,
}: {
  facultyString: string;
  employeeId?: string;
  courseCode?: string;
  onOpenFacultyReview: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
}) {
  const parts = facultyString.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return (
      <FacultySingleReviewStat
        name={parts[0] || facultyString}
        employeeId={employeeId}
        onOpenReviewModal={() => onOpenFacultyReview({ name: parts[0] || facultyString, employeeId, courseCode })}
      />
    );
  }

  return (
    <div className="space-y-3">
      {parts.map((name, idx) => (
        <FacultySingleReviewStat
          key={name}
          name={name}
          employeeId={idx === 0 ? employeeId : undefined}
          role={idx === 0 ? "Theory" : "Lab"}
          onOpenReviewModal={() => onOpenFacultyReview({ name, employeeId: idx === 0 ? employeeId : undefined, courseCode })}
        />
      ))}
    </div>
  );
}

export default function FFCSGuidedSelector({
  masterCourses,
  uniqueCourses: propUniqueCourses,
  courses: propCourses,
  activeTimetable,
  onAddCourse,
  checkClashes = () => null,
  isGroupingEnabled = true,
  setIsGroupingEnabled,
  renderTypeChips = () => null,
  getBatchColorClass = () => "bg-zinc-800 text-zinc-300",
  courseAlternativesPool,
  onOpenFacultyReview,
  onOpenPasteRegistered,
  onOpenManualLinker,
  onViewTimetable,
  isFullScreen = true,
  onToggleFullScreen,
  onSwitchToSinglePageView,
  timetables = [],
  allTimetables,
  onSelectTimetable,
  onCreateNewTimetable,
  onRenameTimetable,
  onDeleteTimetable,
  onOpenGenerator,
  onOpenCourseLocks,
  initialGuidedPhase,
  initialHasLaunchedHero,
  initialStep = 1,
  initialPlanMode = "custom",
  onApplyTimetable,
  courseLocks = [],
  setCourseLocks,
  uniqueCourseCodes,
  onImportCourses,
  onImportToTimetable,
  onOpenFacultySchedule,
  friends = [],
  friendGroups = [],
  socialScoreGroupMethod = "cumulative",
  blockedSlots = new Set(),
  setBlockedSlots,
  onToggleBlockSlot,
  settings,
}: FFCSGuidedSelectorProps) {
  const effectiveTimetables = useMemo(
    () =>
      (allTimetables && allTimetables.length > 0
        ? allTimetables
        : timetables && timetables.length > 0
        ? timetables
        : activeTimetable
        ? [activeTimetable]
        : []
      ).filter(Boolean),
    [allTimetables, timetables, activeTimetable]
  );
  const courses = propCourses || activeTimetable?.courses || [];

  const uniqueCourses = useMemo(() => {
    if (propUniqueCourses && propUniqueCourses.length > 0) return propUniqueCourses;
    const map = new Map<string, { code: string; title: string; types?: string[]; batches?: string[] }>();
    (masterCourses || []).forEach((c) => {
      if (!c.CODE) return;
      if (!map.has(c.CODE)) {
        map.set(c.CODE, { code: c.CODE, title: c.TITLE || "", types: [], batches: [] });
      }
      const entry = map.get(c.CODE)!;
      if (c.TYPE && !entry.types?.includes(c.TYPE)) {
        entry.types = [...(entry.types || []), c.TYPE];
      }
    });
    return Array.from(map.values());
  }, [propUniqueCourses, masterCourses]);

  // Wizard Flow States: 'setup_mode' -> 'setup_timetable' -> ('setup_strategy' / 'auto_courses') -> ...
  const [guidedPhase, setGuidedPhase] = useState<GuidedPhase>(() => initialGuidedPhase || "setup_mode");
  const [planMode, setPlanMode] = useState<PlanMode>(() => initialPlanMode || "custom");
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>(activeTimetable?.id || "");
  const [courseStrategy, setCourseStrategy] = useState<CourseStrategy>("one_by_one");
  const [editingTtId, setEditingTtId] = useState<string | null>(null);
  const [editingTtName, setEditingTtName] = useState("");

  const [internalCourseLocks, setInternalCourseLocks] = useState<CourseLock[]>(() =>
    courseLocks && courseLocks.length > 0 ? courseLocks : []
  );
  const effectiveCourseLocks = setCourseLocks ? courseLocks : internalCourseLocks;
  const updateCourseLocks: React.Dispatch<React.SetStateAction<CourseLock[]>> = (updater) => {
    if (setCourseLocks) {
      setCourseLocks(updater);
    } else {
      setInternalCourseLocks(updater);
    }
  };
  const [locksSearchQuery, setLocksSearchQuery] = useState("");
  const [locksMode, setLocksMode] = useState<ImportMode | "search">("search");

  // Multi-timetable browser in Guided Hero
  const [browsingTimetableIndex, setBrowsingTimetableIndex] = useState<number>(() => {
    if (activeTimetable?.id && effectiveTimetables.length > 0) {
      const idx = effectiveTimetables.findIndex((t) => t.id === activeTimetable.id);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });
  const [browserTransitionDirection, setBrowserTransitionDirection] = useState<"forward" | "backward">("forward");

  // Only re-sync browsing index if activeTimetable ID genuinely changed externally
  const prevActiveTtIdRef = useRef<string | undefined>(activeTimetable?.id);
  useEffect(() => {
    if (activeTimetable?.id && activeTimetable.id !== prevActiveTtIdRef.current) {
      prevActiveTtIdRef.current = activeTimetable.id;
      const idx = effectiveTimetables.findIndex((t) => t.id === activeTimetable.id);
      if (idx !== -1) {
        setBrowsingTimetableIndex(idx);
      }
    }
  }, [activeTimetable?.id, effectiveTimetables]);

  const navigateBrowsingTimetable = (newIndex: number, direction: "forward" | "backward") => {
    if (newIndex < 0 || newIndex >= effectiveTimetables.length) return;
    const targetTt = effectiveTimetables[newIndex];
    setBrowserTransitionDirection(direction);

    const updateDOM = () => {
      setBrowsingTimetableIndex(newIndex);
      if (targetTt && onSelectTimetable) {
        onSelectTimetable(targetTt.id);
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      typeof (document as any).startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      try {
        (document as any).startViewTransition({
          update: updateDOM,
          types: [direction === "forward" ? "slide-left" : "slide-right"],
        });
        return;
      } catch {
        try {
          (document as any).startViewTransition(updateDOM);
          return;
        } catch {
          // Fallback
        }
      }
    }
    updateDOM();
  };

  // Keyboard navigation for timetable cycling in manual_timetable_view
  useEffect(() => {
    if (guidedPhase !== "manual_timetable_view") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateBrowsingTimetable(browsingTimetableIndex - 1, "backward");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateBrowsingTimetable(browsingTimetableIndex + 1, "forward");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guidedPhase, browsingTimetableIndex, effectiveTimetables.length]);

  // Auto-Generator States inside Guided Hero
  const generation = useGenerationRun();
  const [autoPreference, setAutoPreference] = useState<"compact" | "spread" | "morning" | "evening">("compact");
  const [autoRankingMode, setAutoRankingMode] = useState<RankingMode | null>("Balanced");
  const [autoMinHalfDays, setAutoMinHalfDays] = useState<number>(0);
  const [autoMinStartTime, setAutoMinStartTime] = useState<string>("08:00");
  const [autoMaxEndTime, setAutoMaxEndTime] = useState<string>("19:30");
  const [autoSortBy, setAutoSortBy] = useState<SortBy>("balanced");
  const [autoUniqueFaculties, setAutoUniqueFaculties] = useState<boolean>(false);
  const [autoSyncFriends, setAutoSyncFriends] = useState<boolean>(true);
  const [autoMaximizeFreeTime, setAutoMaximizeFreeTime] = useState<boolean>(true);
  const [stagedTimetables, setStagedTimetables] = useState<TimetableState[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [swapCourseRow, setSwapCourseRow] = useState<{ course: AddedCourse } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeConfigCourseCode, setActiveConfigCourseCode] = useState<string>("");
  const [expandedCourseForAuto, setExpandedCourseForAuto] = useState<string | null>(null);
  const [facultySearchQuery, setFacultySearchQuery] = useState<string>("");
  const [internalBlockedSlots, setInternalBlockedSlots] = useState<Set<string>>(() => new Set(blockedSlots || []));
  const effectiveBlockedSlots = setBlockedSlots && blockedSlots ? blockedSlots : internalBlockedSlots;
  const [timeBlockedSlots, setTimeBlockedSlots] = useState<Set<string>>(new Set());
  const [blockingActiveDay, setBlockingActiveDay] = useState<string>("mon");
  const [autoResultCap, setAutoResultCap] = useState<number>(50);
  const [autoNoLimit, setAutoNoLimit] = useState<boolean>(false);

  const updateBlockedSlots = (updater: React.SetStateAction<Set<string>>) => {
    if (setBlockedSlots) {
      setBlockedSlots(updater);
    }
    setInternalBlockedSlots(updater);
  };

  const getSlotsOutsideTimeWindow = (minStart: string, maxEnd: string): string[] => {
    const schema = getTimetableSchema();
    const minM = toMinutes(minStart);
    const maxM = toMinutes(maxEnd);
    const outsideSlots = new Set<string>();

    const effectiveTheory = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
    const effectiveLab = ensureLunchPeriod(schema.lab as TimetablePeriod[]);
    const numPeriods = Math.max(effectiveTheory.length, effectiveLab.length);

    for (let i = 0; i < numPeriods; i++) {
      const tp = effectiveTheory[i];
      const lp = effectiveLab[i];

      if ((tp && tp.lunch) || (lp && lp.lunch)) continue;

      const tpStart = tp?.start ? toMinutes(tp.start) : null;
      const tpEnd = tp?.end ? toMinutes(tp.end) : null;
      const lpStart = lp?.start ? toMinutes(lp.start) : null;
      const lpEnd = lp?.end ? toMinutes(lp.end) : null;

      const starts = [tpStart, lpStart].filter((v): v is number => v !== null);
      const ends = [tpEnd, lpEnd].filter((v): v is number => v !== null);

      if (starts.length === 0 || ends.length === 0) continue;

      const bandStartMin = Math.min(...starts);
      const bandEndMin = Math.max(...ends);

      // If either theory or lab falls outside the timing constraints:
      const isOutside =
        (tpStart !== null && (tpStart < minM || tpEnd! > maxM)) ||
        (lpStart !== null && (lpStart < minM || lpEnd! > maxM)) ||
        bandStartMin < minM ||
        bandEndMin > maxM;

      if (isOutside) {
        // Block BOTH the theory and lab slots of this timeslot for all days!
        if (tp?.days) {
          Object.values(tp.days).forEach((s: any) => {
            if (s && typeof s === "string" && s !== "NIL") {
              outsideSlots.add(s.trim());
            }
          });
        }
        if (lp?.days) {
          Object.values(lp.days).forEach((s: any) => {
            if (s && typeof s === "string" && s !== "NIL") {
              outsideSlots.add(s.trim());
            }
          });
        }
      }
    }

    return Array.from(outsideSlots);
  };

  const autoBlockOutsideSlots = (start: string, end: string) => {
    const newOutside = new Set(getSlotsOutsideTimeWindow(start, end));
    updateBlockedSlots((prev) => {
      const next = new Set(prev);
      timeBlockedSlots.forEach((s) => {
        if (!newOutside.has(s)) {
          next.delete(s);
        }
      });
      newOutside.forEach((s) => next.add(s));
      return next;
    });
    setTimeBlockedSlots(newOutside);
  };

  const handleToggleBlockSlot = (slot: string) => {
    updateBlockedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
    if (onToggleBlockSlot) onToggleBlockSlot(slot);
  };

  useEffect(() => {
    if (effectiveCourseLocks.length > 0) {
      if (!effectiveCourseLocks.some((l) => l.code === activeConfigCourseCode)) {
        setActiveConfigCourseCode(effectiveCourseLocks[0].code);
      }
    } else {
      setActiveConfigCourseCode("");
    }
  }, [effectiveCourseLocks, activeConfigCourseCode]);

  const handleSaveRename = (id: string) => {
    const trimmed = editingTtName.trim();
    if (trimmed && onRenameTimetable) {
      onRenameTimetable(id, trimmed);
    }
    setEditingTtId(null);
  };

  useEffect(() => {
    if (initialGuidedPhase) {
      setGuidedPhase(initialGuidedPhase);
    }
  }, [initialGuidedPhase]);

  useEffect(() => {
    if (activeTimetable?.id) {
      setSelectedTimetableId(activeTimetable.id);
    }
  }, [activeTimetable?.id]);

  const [currentStep, setCurrentStep] = useState<GuidedStep>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<string>("-1");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [addedJustNow, setAddedJustNow] = useState<{ code: string; isReplacement: boolean } | null>(null);
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(isFullScreen);
  const [hasLaunchedHero, setHasLaunchedHero] = useState<boolean>(() => {
    if (initialHasLaunchedHero !== undefined) {
      return initialHasLaunchedHero;
    }
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    return true;
  });

  const { canInstall, promptInstall } = usePwaInstall();
  const isPwaStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as unknown as { standalone?: boolean })?.standalone
    );
  }, []);

  useEffect(() => {
    if (isFullScreen !== undefined) {
      setFullScreenMode(isFullScreen);
    }
  }, [isFullScreen]);

  const handleToggleFullScreen = async () => {
    const next = !fullScreenMode;
    setFullScreenMode(next);
    onToggleFullScreen?.(next);

    if (next) {
      await requestNativeFullscreen();
    } else {
      await exitNativeFullscreen();
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      const isNativeFullscreen = Boolean(
        document.fullscreenElement || docWithWebkit.webkitFullscreenElement
      );
      if (!isNativeFullscreen && fullScreenMode) {
        setFullScreenMode(false);
        onToggleFullScreen?.(false);
      } else if (isNativeFullscreen && !fullScreenMode) {
        setFullScreenMode(true);
        onToggleFullScreen?.(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [fullScreenMode, onToggleFullScreen]);

  useEffect(() => {
    if (fullScreenMode && typeof document !== "undefined") {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [fullScreenMode]);

  const [lockedOnlyFilter, setLockedOnlyFilter] = useState<boolean>(() => effectiveCourseLocks.length > 0);

  useEffect(() => {
    if (effectiveCourseLocks.length > 0) {
      setLockedOnlyFilter(true);
    }
  }, [effectiveCourseLocks.length]);

  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    let rafId: number | null = null;
    const updateDimensions = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setViewportDimensions((prev) => {
          if (prev.width === window.innerWidth && prev.height === window.innerHeight) {
            return prev;
          }
          return {
            width: window.innerWidth,
            height: window.innerHeight,
          };
        });
      });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isHorizontal = viewportDimensions.width >= 1024 && viewportDimensions.width > viewportDimensions.height;

  const availableOfferings = useMemo(() => {
    if (!selectedCourseCode) return [];
    let slots = masterCourses.filter((c) => c.CODE === selectedCourseCode);

    if (isGroupingEnabled) {
      const hasCombined = slots.some((c) => {
        const parts = splitSlots(c.SLOT);
        return parts.some((s) => !s.startsWith("L") && s !== "NIL") && parts.some((s) => s.startsWith("L"));
      });
      if (hasCombined) {
        slots = slots.filter((c) => {
          const parts = splitSlots(c.SLOT);
          const isCombined = parts.some((s) => !s.startsWith("L") && s !== "NIL") && parts.some((s) => s.startsWith("L"));
          if (isCombined) return true;

          const facNorm = (c.FACULTY || "").trim().toLowerCase();
          const isSubset = slots.some((other) => {
            if (other === c) return false;
            const otherParts = splitSlots(other.SLOT);
            const otherIsCombined = otherParts.some((s) => !s.startsWith("L") && s !== "NIL") && otherParts.some((s) => s.startsWith("L"));
            if (!otherIsCombined) return false;
            const otherFacNorm = (other.FACULTY || "").trim().toLowerCase();
            const facMatches = otherFacNorm.includes(facNorm) || facNorm.includes(otherFacNorm);
            return facMatches && parts.every((s) => otherParts.includes(s));
          });

          return !isSubset;
        });
      }
    }

    if (effectiveCourseLocks.length > 0) {
      const lock = effectiveCourseLocks.find((l) => l.code === selectedCourseCode);
      if (lock) {
        if (lock.allowedSlots && lock.allowedSlots.length > 0) {
          slots = slots.filter((s) => {
            const individualSlots = splitSlots(s.SLOT);
            return individualSlots.some((sl) => lock.allowedSlots.includes(sl));
          });
        }
        if (lock.allowedFaculty && lock.allowedFaculty.length > 0) {
          slots = slots.filter((s) => lock.allowedFaculty.includes(s.FACULTY));
        }
      }
    }

    return slots;
  }, [masterCourses, selectedCourseCode, effectiveCourseLocks, isGroupingEnabled]);

  const filteredOfferings = useMemo(() => {
    return availableOfferings.filter((offering) => {
      if (slotFilter === "all") return true;
      const parts = splitSlots(offering.SLOT);
      const isMorning = parts.some((s) => s.endsWith("1") || (s.startsWith("L") && parseInt(s.slice(1), 10) <= 30));
      const isEvening = parts.some((s) => s.endsWith("2") || (s.startsWith("L") && parseInt(s.slice(1), 10) > 30));

      if (slotFilter === "morning_session") return isMorning;
      if (slotFilter === "evening_session") return isEvening;
      if (slotFilter === "morning_theory") return parts.some((s) => !s.startsWith("L") && s.endsWith("1"));
      if (slotFilter === "evening_theory") return parts.some((s) => !s.startsWith("L") && s.endsWith("2"));
      if (slotFilter === "morning_lab") return parts.some((s) => s.startsWith("L") && parseInt(s.slice(1), 10) <= 30);
      if (slotFilter === "evening_lab") return parts.some((s) => s.startsWith("L") && parseInt(s.slice(1), 10) > 30);
      return true;
    });
  }, [availableOfferings, slotFilter]);

  const selectedCourseMeta = useMemo(() => {
    return uniqueCourses.find((c) => c.code === selectedCourseCode);
  }, [uniqueCourses, selectedCourseCode]);

  const selectedOffering = useMemo(() => {
    const idx = parseInt(selectedSlotIndex, 10);
    return idx >= 0 && idx < availableOfferings.length ? availableOfferings[idx] : null;
  }, [availableOfferings, selectedSlotIndex]);

  const filteredCourses = useMemo(() => {
    return uniqueCourses.filter((c) => {
      if (lockedOnlyFilter && effectiveCourseLocks.length > 0) {
        const isLocked = effectiveCourseLocks.some((l) => l.code === c.code);
        if (!isLocked) return false;
      }

      if (typeFilter !== "all") {
        const types = (c.types || []).map((t) => t.toLowerCase());
        if (!types.includes(typeFilter)) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.batches && c.batches.some((b) => b.toLowerCase().includes(q)))
      );
    });
  }, [uniqueCourses, searchQuery, typeFilter, lockedOnlyFilter, effectiveCourseLocks]);

  const filteredAutoCourses = useMemo(() => {
    return uniqueCourses.filter((c) => {
      if (typeFilter !== "all") {
        const types = (c.types || []).map((t) => t.toLowerCase());
        if (!types.includes(typeFilter)) return false;
      }

      if (!locksSearchQuery.trim()) return true;
      const q = locksSearchQuery.toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.batches && c.batches.some((b) => b.toLowerCase().includes(q)))
      );
    });
  }, [uniqueCourses, locksSearchQuery, typeFilter]);

  const handleSelectCourse = (code: string) => {
    setSelectedCourseCode(code);
    setSelectedSlotIndex("-1");
    setSlotFilter("all");
    setCurrentStep(2);
  };

  const handleSelectOffering = (originalIndex: number) => {
    setSelectedSlotIndex(String(originalIndex));
    setCurrentStep(3);
  };

  const isCourseInTimetable = (code: string) => {
    return courses.some((c) => c.code === code);
  };

  const isCourseEmbedded = (code: string) => {
    const offerings = masterCourses.filter((mc) => mc.CODE === code);
    const hasTheory = offerings.some((mc) => {
      const t = (mc.TYPE || "").toLowerCase();
      return t.includes("th") || t.includes("theory") || (!splitSlots(mc.SLOT).every((s) => s.startsWith("L")));
    });
    const hasLab = offerings.some((mc) => {
      const t = (mc.TYPE || "").toLowerCase();
      return t.includes("la") || t.includes("lab") || splitSlots(mc.SLOT).some((s) => s.startsWith("L"));
    });
    return (hasTheory && hasLab) || offerings.some((mc) => (mc.TYPE || "").toLowerCase().includes("embedded"));
  };

  const existingCourseInTimetable = useMemo(() => {
    return courses.find((c) => c.code === selectedCourseCode) || null;
  }, [courses, selectedCourseCode]);

  const isReplacingSlot = !!existingCourseInTimetable;

  const handleConfirmAdd = () => {
    if (!selectedOffering || !selectedCourseMeta) return;

    const slotsArray = splitSlots(selectedOffering.SLOT);
    const isReplacing = isCourseInTimetable(selectedOffering.CODE);
    const existingCourse = courses.find((c) => c.code === selectedOffering.CODE);

    const newCourse: AddedCourse = {
      id: Math.random().toString(36).substr(2, 9),
      code: selectedOffering.CODE,
      title: selectedOffering.TITLE,
      slots: slotsArray,
      faculty: selectedOffering.FACULTY,
      employeeId: selectedOffering.ERP_ID,
      venue: selectedOffering.ROOM || "TBA",
      credits: selectedOffering.CREDITS || "0",
      type: selectedOffering.TYPE || "Theory",
      color: existingCourse?.color || COLORS[courses.length % COLORS.length],
      batch: selectedOffering.BATCH,
    };

    onAddCourse(newCourse, isReplacing);
    setAddedJustNow({ code: newCourse.code, isReplacement: isReplacing });
    setTimeout(() => setAddedJustNow(null), 4000);
    setGuidedPhase("manual_timetable_view");
  };

  const handleAddAnother = () => {
    if (!selectedOffering || !selectedCourseMeta) return;

    const slotsArray = splitSlots(selectedOffering.SLOT);
    const isReplacing = isCourseInTimetable(selectedOffering.CODE);
    const existingCourse = courses.find((c) => c.code === selectedOffering.CODE);

    const newCourse: AddedCourse = {
      id: Math.random().toString(36).substr(2, 9),
      code: selectedOffering.CODE,
      title: selectedOffering.TITLE,
      slots: slotsArray,
      faculty: selectedOffering.FACULTY,
      employeeId: selectedOffering.ERP_ID,
      venue: selectedOffering.ROOM || "TBA",
      credits: selectedOffering.CREDITS || "0",
      type: selectedOffering.TYPE || "Theory",
      color: existingCourse?.color || COLORS[courses.length % COLORS.length],
      batch: selectedOffering.BATCH,
    };

    onAddCourse(newCourse, isReplacing);
    setAddedJustNow({ code: newCourse.code, isReplacement: isReplacing });
    setTimeout(() => setAddedJustNow(null), 4000);

    setSelectedCourseCode("");
    setSelectedSlotIndex("-1");
    setGuidedPhase("builder");
    setCurrentStep(1);
  };

  const handleRunAutoGeneration = async () => {
    setGenerationError(null);
    setStagedTimetables([]);
    setSelectedVariantIndex(0);

    const outcome = await generation.run(
      {
        schema: getTimetableSchema(),
        masterCourses,
        courseLocks: effectiveCourseLocks,
        blockedSlots: Array.from(effectiveBlockedSlots),
        friends: friends || [],
        preference: autoPreference,
        syncFriendClasses: autoSyncFriends,
        maximizeFreeTimeFriends: autoMaximizeFreeTime ? (friends || []).map((f) => f.id) : [],
        minStartTime: autoMinStartTime,
        maxEndTime: autoMaxEndTime,
        uniqueFaculties: autoUniqueFaculties,
        noLimit: autoNoLimit,
        resultCap: autoNoLimit ? undefined : autoResultCap,
        minHalfDays: autoMinHalfDays,
        sortBy: autoSortBy,
        ...(autoRankingMode ? { rankingMode: autoRankingMode } : {}),
      },
      (batch) => {
        setStagedTimetables((prev) => [...prev, ...batch]);
      }
    );

    if (outcome.kind === "error") {
      setGenerationError(
        outcome.code === "no_conflict_free" || outcome.code === "no_valid_slots"
          ? "No clash-free timetable found for these courses. Try relaxing time preferences or unlocking specific slots."
          : "An error occurred while generating timetables."
      );
      return;
    }

    if (outcome.timetables.length > 0) {
      setStagedTimetables(outcome.timetables);
      setSelectedVariantIndex(0);
      setGuidedPhase("auto_results");
    } else {
      setGenerationError("No valid combinations found. Try adjusting course constraints or preferences.");
    }
  };

  const handleApplyVariant = (variant: TimetableState) => {
    if (onApplyTimetable) {
      onApplyTimetable(variant.courses);
    } else if (onImportToTimetable) {
      onImportToTimetable(variant.courses);
    } else {
      variant.courses.forEach((c) => onAddCourse(c));
    }
    setAddedJustNow({ code: `${variant.courses.length} Courses`, isReplacement: false });
    setTimeout(() => setAddedJustNow(null), 5000);
    // Transition to Hero Multi-Timetable Browser
    setGuidedPhase("manual_timetable_view");
  };

  const handleSwapVariantFaculty = (courseId: string, offering: ParsedCourse) => {
    setStagedTimetables((prev) => {
      const copy = [...prev];
      const cur = copy[selectedVariantIndex];
      if (!cur) return prev;
      const updatedCourses = cur.courses.map((c) => {
        if (c.id !== courseId && c.code !== offering.CODE) return c;
        return {
          ...c,
          slots: splitSlots(offering.SLOT),
          faculty: offering.FACULTY,
          employeeId: offering.ERP_ID,
          venue: offering.ROOM || c.venue,
        };
      });
      copy[selectedVariantIndex] = { ...cur, courses: updatedCourses };
      return copy;
    });
  };

  const handlePrevStep = () => {
    if (guidedPhase === "setup_locks") {
      setGuidedPhase("setup_strategy");
    } else if (guidedPhase === "setup_strategy") {
      setGuidedPhase("setup_timetable");
    } else if (guidedPhase === "setup_timetable") {
      setGuidedPhase("setup_mode");
    } else if (guidedPhase === "setup_mode") {
      if (onViewTimetable) onViewTimetable();
    } else if (guidedPhase === "auto_courses") {
      setGuidedPhase("setup_strategy");
    } else if (guidedPhase === "auto_slots_faculty") {
      if (courseStrategy === "lock_advance") {
        setGuidedPhase("setup_locks");
      } else {
        setGuidedPhase("auto_courses");
      }
    } else if (guidedPhase === "auto_timings") {
      setGuidedPhase("auto_slots_faculty");
    } else if (guidedPhase === "auto_blocking") {
      setGuidedPhase("auto_timings");
    } else if (guidedPhase === "auto_half_days") {
      setGuidedPhase("auto_blocking");
    } else if (guidedPhase === "auto_social") {
      setGuidedPhase("auto_half_days");
    } else if (guidedPhase === "auto_summary") {
      if (friends && friends.length > 0) setGuidedPhase("auto_social");
      else setGuidedPhase("auto_half_days");
    } else if (guidedPhase === "auto_results") {
      setGuidedPhase("auto_summary");
    } else if (guidedPhase === "auto_timetable_view") {
      setGuidedPhase("auto_results");
    } else if (guidedPhase === "manual_timetable_view") {
      setGuidedPhase("builder");
      setCurrentStep(1);
    } else if (guidedPhase === "builder") {
      if (currentStep === 3) setCurrentStep(2);
      else if (currentStep === 2) setCurrentStep(1);
      else if (currentStep === 1) {
        if (courseStrategy === "lock_advance") {
          setGuidedPhase("setup_locks");
        } else {
          setGuidedPhase("setup_strategy");
        }
      }
    }
  };

  const handleNextStep = () => {
    if (guidedPhase === "builder") {
      if (currentStep === 1 && selectedCourseCode) setCurrentStep(2);
      else if (currentStep === 2 && selectedOffering) setCurrentStep(3);
      else if (currentStep === 3) setGuidedPhase("manual_timetable_view");
    }
  };

  // ── SLOT & FACULTY HELPERS ──
  const getSlotClusterKey = (slot: string): { cluster: string; letter: string } => {
    const s = slot.trim().toUpperCase();
    const theoryMatch = s.match(/^[T]*([A-G])([1-2])$/);
    if (theoryMatch) {
      return { cluster: `${theoryMatch[1]}${theoryMatch[2]}`, letter: theoryMatch[1] };
    }
    const labMatch = s.match(/^L([0-9]+)$/);
    if (labMatch) {
      const num = parseInt(labMatch[1], 10);
      const cluster = num <= 30 ? "Lab (Morning)" : "Lab (Evening)";
      return { cluster, letter: "Lab" };
    }
    const generalMatch = s.match(/^[T]*([A-Z])([0-9]+)?$/);
    if (generalMatch) {
      const letter = generalMatch[1];
      const num = generalMatch[2] || "";
      return { cluster: num ? `${letter}${num}` : letter, letter };
    }
    return { cluster: s, letter: s };
  };

  const getCourseOfferingsData = (courseCode: string) => {
    const offerings = masterCourses.filter((m) => m.CODE === courseCode);
    const uniqueSlots = Array.from(
      new Set(offerings.flatMap((opt) => splitSlots(opt.SLOT)))
    ).sort();

    const clusterMap = new Map<string, { clusterKey: string; clusterLabel: string; letter: string; slots: string[] }>();
    const letterMap = new Map<string, string[]>();

    uniqueSlots.forEach((slot) => {
      const { cluster, letter } = getSlotClusterKey(slot);
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, {
          clusterKey: cluster,
          clusterLabel: cluster.endsWith("1") || cluster.endsWith("2") ? `${cluster} Slots` : `${cluster} Series`,
          letter,
          slots: [],
        });
      }
      clusterMap.get(cluster)!.slots.push(slot);

      if (!letterMap.has(letter)) {
        letterMap.set(letter, []);
      }
      letterMap.get(letter)!.push(slot);
    });

    const availableClusters = Array.from(clusterMap.keys()).sort();
    const availableBroadLetters = Array.from(letterMap.keys()).sort();

    // Distinct faculty
    const facultyMap = new Map<
      string,
      {
        name: string;
        employeeId?: string;
        slots: string[];
        venues: string[];
      }
    >();

    offerings.forEach((opt) => {
      const trimmed = opt.FACULTY.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!facultyMap.has(key)) {
        facultyMap.set(key, {
          name: trimmed,
          employeeId: opt.ERP_ID,
          slots: [],
          venues: [],
        });
      }
      const entry = facultyMap.get(key)!;
      if (opt.SLOT && !entry.slots.includes(opt.SLOT)) {
        entry.slots.push(opt.SLOT);
      }
      if (opt.ROOM && !entry.venues.includes(opt.ROOM)) {
        entry.venues.push(opt.ROOM);
      }
    });

    const faculties = Array.from(facultyMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      offerings,
      uniqueSlots,
      clusterMap,
      letterMap,
      availableClusters,
      availableBroadLetters,
      faculties,
    };
  };

  const handleToggleLockSlot = (courseCode: string, slot: string) => {
    updateCourseLocks((prev) =>
      prev.map((p) => {
        if (p.code !== courseCode) return p;
        const cur = p.allowedSlots || [];
        const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot];
        return { ...p, allowedSlots: next };
      })
    );
  };

  const handleToggleLockBundle = (courseCode: string, clusterSlots: string[]) => {
    updateCourseLocks((prev) =>
      prev.map((p) => {
        if (p.code !== courseCode) return p;
        const cur = p.allowedSlots || [];
        const allSelected = clusterSlots.every((s) => cur.includes(s));
        let next = [...cur];
        if (allSelected) {
          next = next.filter((s) => !clusterSlots.includes(s));
        } else {
          clusterSlots.forEach((s) => {
            if (!next.includes(s)) next.push(s);
          });
        }
        return { ...p, allowedSlots: next };
      })
    );
  };

  const handleToggleLockFaculty = (courseCode: string, facultyName: string) => {
    updateCourseLocks((prev) =>
      prev.map((p) => {
        if (p.code !== courseCode) return p;
        const cur = p.allowedFaculty || [];
        const next = cur.includes(facultyName)
          ? cur.filter((f) => f !== facultyName)
          : [...cur, facultyName];
        return { ...p, allowedFaculty: next };
      })
    );
  };

  const handleResetCourseLocks = (courseCode: string) => {
    updateCourseLocks((prev) =>
      prev.map((p) => (p.code === courseCode ? { ...p, allowedSlots: [], allowedFaculty: [] } : p))
    );
  };

  const getDaySlots = (dayId: string) => {
    const schema = getTimetableSchema();
    const lowerDay = dayId.toLowerCase().slice(0, 3);
    const morningTheory = new Set<string>();
    const eveningTheory = new Set<string>();
    const morningLab = new Set<string>();
    const eveningLab = new Set<string>();

    (schema.theory || []).forEach((p: any) => {
      if (p && !p.lunch && p.days && p.days[lowerDay]) {
        const slot = p.days[lowerDay];
        if (slot && typeof slot === "string" && slot !== "NIL") {
          const sMin = p.start ? toMinutes(p.start) : 0;
          if (sMin < 13 * 60 + 30) morningTheory.add(slot.trim());
          else eveningTheory.add(slot.trim());
        }
      }
    });

    (schema.lab || []).forEach((p: any) => {
      if (p && p.days && p.days[lowerDay]) {
        const slot = p.days[lowerDay];
        if (slot && typeof slot === "string" && slot !== "NIL") {
          const sMin = p.start ? toMinutes(p.start) : 0;
          if (sMin < 13 * 60 + 30) morningLab.add(slot.trim());
          else eveningLab.add(slot.trim());
        }
      }
    });

    const mTheory = Array.from(morningTheory);
    const eTheory = Array.from(eveningTheory);
    const mLab = Array.from(morningLab);
    const eLab = Array.from(eveningLab);

    return {
      morningTheory: mTheory,
      eveningTheory: eTheory,
      morningLab: mLab,
      eveningLab: eLab,
      morningAll: Array.from(new Set([...mTheory, ...mLab])),
      eveningAll: Array.from(new Set([...eTheory, ...eLab])),
      dayTheory: Array.from(new Set([...mTheory, ...eTheory])),
      dayLab: Array.from(new Set([...mLab, ...eLab])),
      morning: mTheory,
      evening: eTheory,
      all: Array.from(new Set([...mTheory, ...eTheory, ...mLab, ...eLab])),
    };
  };

  const handleToggleDayBlock = (
    dayId: string,
    type:
      | "morning"
      | "morning_theory"
      | "morning_lab"
      | "morning_all"
      | "evening"
      | "evening_theory"
      | "evening_lab"
      | "evening_all"
      | "day_theory"
      | "day_lab"
      | "all"
  ) => {
    const dayData = getDaySlots(dayId);
    let slotsToToggle: string[] = [];

    switch (type) {
      case "morning":
      case "morning_theory":
        slotsToToggle = dayData.morningTheory;
        break;
      case "morning_lab":
        slotsToToggle = dayData.morningLab;
        break;
      case "morning_all":
        slotsToToggle = dayData.morningAll;
        break;
      case "evening":
      case "evening_theory":
        slotsToToggle = dayData.eveningTheory;
        break;
      case "evening_lab":
        slotsToToggle = dayData.eveningLab;
        break;
      case "evening_all":
        slotsToToggle = dayData.eveningAll;
        break;
      case "day_theory":
        slotsToToggle = dayData.dayTheory;
        break;
      case "day_lab":
        slotsToToggle = dayData.dayLab;
        break;
      case "all":
        slotsToToggle = dayData.all;
        break;
      default:
        slotsToToggle = dayData.morningTheory;
    }

    updateBlockedSlots((prev) => {
      const next = new Set(prev);
      const allBlocked = slotsToToggle.length > 0 && slotsToToggle.every((s) => next.has(s));
      if (allBlocked) {
        slotsToToggle.forEach((s) => next.delete(s));
      } else {
        slotsToToggle.forEach((s) => next.add(s));
      }
      return next;
    });
  };

  const handleClearDayBlocks = (dayId: string) => {
    const dayData = getDaySlots(dayId);
    updateBlockedSlots((prev) => {
      const next = new Set(prev);
      dayData.all.forEach((s) => next.delete(s));
      return next;
    });
  };

  const handleClearAllBlocks = () => {
    updateBlockedSlots(() => new Set());
    setTimeBlockedSlots(new Set());
  };

  // ── RENDER HELPERS FOR SETUP SCREENS ──
  const renderSetupModeCard = (isLandscape = false) => (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-center ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="space-y-3">
        {/* Option A: Auto-Generate */}
        <button
          type="button"
          onClick={() => setPlanMode("auto")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            planMode === "auto"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              planMode === "auto" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Wand2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                ✨ Algorithmic Engine
              </span>
              {planMode === "auto" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Auto-Generate Timetable</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Step-by-step guidance: pick target courses, set pacing rules, align with peers, and inspect recommended variants with direct faculty review & schedule views.
            </p>
          </div>
        </button>

        {/* Option B: Build My Own */}
        <button
          type="button"
          onClick={() => setPlanMode("custom")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            planMode === "custom"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              planMode === "custom" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Compass className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                🧭 Manual Builder
              </span>
              {planMode === "custom" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Build My Own Timetable</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Select courses and slot offerings one-by-one with real-time conflict checking, faculty ratings, and replacement support.
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderSetupTimetableCard = (isLandscape = false) => (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 shrink-0">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">Select Target Timetable</h3>
          <p className="text-xs text-zinc-400">Choose which timetable you want to edit and save courses into.</p>
        </div>
        {onCreateNewTimetable && (
          <button
            type="button"
            onClick={onCreateNewTimetable}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 py-1.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Timetable</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {effectiveTimetables.map((tt) => {
          const isSelected = (selectedTimetableId || activeTimetable?.id) === tt.id;
          const isEditing = editingTtId === tt.id;

          return (
            <div
              key={tt.id}
              onClick={() => {
                setSelectedTimetableId(tt.id);
                if (onSelectTimetable) onSelectTimetable(tt.id);
              }}
              className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                isSelected
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40"
                  : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-indigo-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                  }`}
                >
                  <CalendarDays className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingTtName}
                        onChange={(e) => setEditingTtName(e.target.value)}
                        className="bg-zinc-900 border border-indigo-500 rounded-lg px-2.5 py-1 text-base sm:text-sm font-bold text-white focus:outline-none w-full max-w-xs"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(tt.id)}
                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer relative hit-expand touch-press"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base text-white truncate font-outfit">{tt.name}</h4>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTtId(tt.id);
                          setEditingTtName(tt.name);
                        }}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer relative hit-expand touch-press"
                        title="Rename Timetable"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tt.courses.length} course{tt.courses.length === 1 ? "" : "s"} scheduled
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onDeleteTimetable && effectiveTimetables.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTimetable(tt.id);
                    }}
                    className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer relative hit-expand touch-press"
                    title="Delete Timetable"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <span
                  className={`text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border ${
                    isSelected ? "bg-indigo-600 text-white border-indigo-500" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  {isSelected ? "Selected ✓" : "Choose"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSetupStrategyCard = (isLandscape = false) => (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-center ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="space-y-3">
        {/* Option 1: Lock Target Courses */}
        <button
          type="button"
          onClick={() => setCourseStrategy("lock_advance")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            courseStrategy === "lock_advance"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              courseStrategy === "lock_advance" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Lock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                🔒 Mandatory Locks
              </span>
              {courseStrategy === "lock_advance" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Lock Target Courses in Advance</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {planMode === "auto"
                ? "Pre-lock mandatory core courses and optionally restrict allowed slot clusters (like A1, B1) or preferred faculty before generating combinations."
                : "Pick mandatory core courses and lock preferred faculty or slot groups in advance before scheduling the rest."}
            </p>
          </div>
        </button>

        {/* Option 2: Choose courses normally / manual adder */}
        <button
          type="button"
          onClick={() => setCourseStrategy("one_by_one")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            courseStrategy === "one_by_one"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              courseStrategy === "one_by_one" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            {planMode === "auto" ? <BookOpen className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                {planMode === "auto" ? "⚡ Unconstrained Catalog" : "🧭 Manual Course Selector"}
              </span>
              {courseStrategy === "one_by_one" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">
              {planMode === "auto" ? "Normally Add Courses in List" : "Choose Courses One by One"}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {planMode === "auto"
                ? "Select target courses normally from the course list without locking slot or faculty constraints, giving the solver full flexibility."
                : "Directly enter the manual course selector and pick slot offerings dynamically as you build."}
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderSetupLocksCard = (isLandscape = false) => {
    const rawQuery = locksSearchQuery.trim().toLowerCase();
    const filteredLockCourses = uniqueCourses.filter((c) => {
      if (!rawQuery) return true;
      return (
        c.code.toLowerCase().includes(rawQuery) ||
        c.title.toLowerCase().includes(rawQuery) ||
        (c.batches && c.batches.some((b) => b.toLowerCase().includes(rawQuery)))
      );
    });

    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 sm:space-y-4 text-left flex flex-col ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[56vh] sm:h-[62vh] min-h-[420px] max-h-[640px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <SegmentedControl<ImportMode | "search">
            grow
            value={locksMode}
            onChange={setLocksMode}
            className="w-full sm:w-auto"
            options={[
              { value: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
              { value: "paste", label: "Paste VTOP", icon: <ClipboardPaste className="w-3.5 h-3.5" /> },
              { value: "file", label: "Excel/CSV", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
            ]}
          />
          <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20">
            {effectiveCourseLocks.length} Locked
          </span>
        </div>

        {planMode === "auto" && (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 shrink-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-zinc-300 font-medium truncate">
                Don't want to constrain slots or professors?
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCourseStrategy("one_by_one");
                setGuidedPhase("auto_courses");
              }}
              className="font-bold text-purple-400 hover:text-purple-300 hover:underline shrink-0 text-xs cursor-pointer"
            >
              Pick Normally from Catalog →
            </button>
          </div>
        )}

        {locksMode === "search" && (
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={locksSearchQuery}
              onChange={(e) => setLocksSearchQuery(e.target.value)}
              placeholder="Search mandatory course code or title..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-base sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-zinc-600"
            />
          </div>
        )}

        {locksMode !== "search" ? (
          <div className="flex-1 overflow-y-auto momentum-scroll">
            <CourseImportPanel
              mode={locksMode}
              onImport={(courses) => {
                const newLocks: CourseLock[] = courses.map((p) => ({
                  code: p.CODE,
                  title: p.TITLE,
                  allowedSlots: [],
                  allowedFaculty: [],
                }));
                updateCourseLocks((prev) => {
                  const existingCodes = new Set(prev.map((l) => l.code));
                  return [...prev, ...newLocks.filter((l) => !existingCodes.has(l.code))];
                });
                setLocksMode("search");
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredLockCourses.slice(0, 80).map((c) => {
              const sel = effectiveCourseLocks.find((s) => s.code === c.code);
              const isSelected = !!sel;
              const courseOpts = masterCourses.filter((mc) => mc.CODE === c.code);

              return (
                <div
                  key={c.code}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? "bg-purple-950/25 border-purple-500/50 text-white shadow-sm"
                      : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 bg-zinc-900 w-4 h-4"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateCourseLocks((prev) => [
                            ...prev,
                            { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [] },
                          ]);
                        } else {
                          updateCourseLocks((prev) => prev.filter((s) => s.code !== c.code));
                        }
                      }}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-black text-sm sm:text-base text-white font-outfit">{c.code}</span>
                          <div className="flex items-center gap-1 flex-wrap">{renderTypeChips(c.types || [], "sm")}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap sm:shrink-0">
                          {c.batches &&
                            c.batches.map((b) => (
                              <span key={b} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                                {b}
                              </span>
                            ))}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{c.title}</span>
                    </div>
                  </label>

                  {/* Slot Bundles and Granular Constraints */}
                  {isSelected && sel && courseOpts.length > 0 && (
                    <div className="pl-7 mt-2 pt-2 border-t border-purple-500/20 space-y-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Slot Bundles (Optional Constraints)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {["A1 Slots", "A2 Slots", "B1 Slots", "B2 Slots", "C1 Slots", "C2 Slots"].map((bundle) => {
                          const prefix = bundle.slice(0, 2);
                          const bundleSlots = Array.from(
                            new Set(
                              courseOpts.flatMap((co) =>
                                splitSlots(co.SLOT).filter((s) => s.startsWith(prefix) || s.includes(prefix))
                              )
                            )
                          );
                          if (bundleSlots.length === 0) return null;
                          const allChecked = bundleSlots.every((s) => sel.allowedSlots.includes(s));

                          return (
                            <button
                              key={bundle}
                              type="button"
                              onClick={() => {
                                updateCourseLocks((prev) =>
                                  prev.map((p) => {
                                    if (p.code !== c.code) return p;
                                    let newSlots = [...p.allowedSlots];
                                    if (allChecked) {
                                      newSlots = newSlots.filter((s) => !bundleSlots.includes(s));
                                    } else {
                                      bundleSlots.forEach((bs) => {
                                        if (!newSlots.includes(bs)) newSlots.push(bs);
                                      });
                                    }
                                    return { ...p, allowedSlots: newSlots };
                                  })
                                );
                              }}
                              className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                allChecked
                                  ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                              }`}
                            >
                              {bundle}
                            </button>
                          );
                        })}
                      </div>

                      {/* Preferred Faculty Selection */}
                      {courseOpts.length > 0 && (() => {
                        const courseFaculties = Array.from(
                          new Map(
                            courseOpts
                              .filter((co) => co.FACULTY && co.FACULTY.trim())
                              .map((co) => [co.FACULTY.trim().toLowerCase(), co.FACULTY.trim()])
                          ).values()
                        ).sort();

                        return (
                          <div className="space-y-1 pt-1 border-t border-purple-500/10">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              Preferred Faculty (Optional)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {courseFaculties.map((facName) => {
                                const isFacSelected = sel.allowedFaculty?.includes(facName);
                                return (
                                  <button
                                    key={facName}
                                    type="button"
                                    onClick={() => handleToggleLockFaculty(c.code, facName)}
                                    className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                      isFacSelected
                                        ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                    }`}
                                  >
                                    <span>{facName}</span>
                                    {isFacSelected && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── AUTO-GENERATOR FLOW SCREENS ──
  const renderAutoCoursesCard = (isLandscape = false) => {
    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 sm:space-y-4 text-left flex flex-col ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[56vh] sm:h-[62vh] min-h-[420px] max-h-[640px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">1. Select Target Courses</h3>
            <p className="text-xs text-zinc-400">Choose all courses you want the solver to build into your schedule.</p>
          </div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 shrink-0">
            {effectiveCourseLocks.length} Selected
          </span>
        </div>

        {/* Integration Switcher: Jump between Auto Generator and Manual Builder */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 shrink-0 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-zinc-300 font-medium truncate">
              Prefer manual timetable creation?
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlanMode("custom");
              setGuidedPhase("builder");
              setCurrentStep(1);
            }}
            className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline shrink-0 text-xs cursor-pointer"
          >
            Manual Course Selector →
          </button>
        </div>

        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={locksSearchQuery}
            onChange={(e) => setLocksSearchQuery(e.target.value)}
            placeholder="Search course code or title..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-base sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
          />
        </div>

        {/* Category Filter Chips & Paste VTOP */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-0.5 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: "all", label: "All" },
              { id: "th", label: "Theory" },
              { id: "lab", label: "Lab" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press active:scale-[0.97] ${
                  typeFilter === opt.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-zinc-950/40 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {onOpenPasteRegistered && (
            <button
              type="button"
              onClick={onOpenPasteRegistered}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 touch-press active:scale-[0.97]"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste VTOP</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto momentum-scroll space-y-2 pr-1 custom-scrollbar">
          {filteredAutoCourses.slice(0, 100).map((c) => {
            const sel = effectiveCourseLocks.find((l) => l.code === c.code);
            const isSelected = !!sel;
            const isExpanded = isSelected && expandedCourseForAuto === c.code;
            const hasCustomSlots = sel && sel.allowedSlots && sel.allowedSlots.length > 0;
            const hasCustomFac = sel && sel.allowedFaculty && sel.allowedFaculty.length > 0;

            return (
              <div
                key={c.code}
                onClick={() => {
                  if (isSelected) {
                    updateCourseLocks((prev) => prev.filter((l) => l.code !== c.code));
                    if (expandedCourseForAuto === c.code) setExpandedCourseForAuto(null);
                  } else {
                    updateCourseLocks((prev) => [
                      ...prev,
                      { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [] },
                    ]);
                  }
                }}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 group ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40"
                    : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-indigo-400 transition-colors font-outfit">
                        {c.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 my-1 flex-wrap">
                      {isCourseEmbedded(c.code) && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          Theory + Lab
                        </span>
                      )}
                      {renderTypeChips(c.types || [], "sm")}
                    </div>
                    <p className="text-xs text-zinc-400 font-medium truncate">{c.title}</p>

                    {isSelected && sel && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            hasCustomSlots
                              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400"
                          }`}
                        >
                          {hasCustomSlots ? `${sel.allowedSlots.length} slots locked` : "Any Slot"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            hasCustomFac
                              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400"
                          }`}
                        >
                          {hasCustomFac ? `${sel.allowedFaculty.length} faculty locked` : "Any Faculty"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCourseForAuto(isExpanded ? null : c.code);
                        }}
                        className={`p-1.5 px-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 flex items-center gap-1 text-xs font-bold ${
                          isExpanded
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                            : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white"
                        }`}
                        title={`Customize slots & faculty for ${c.code}`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Slots &amp; Faculty</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCourse(c.code);
                        setPlanMode("custom");
                        setGuidedPhase("builder");
                        setCurrentStep(2);
                      }}
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title={`Explore slots & faculty for ${c.code} in manual course selector`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                        isSelected ? "bg-indigo-600 text-white border-indigo-500 shadow-xs" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {isSelected ? "Included ✓" : "Add +"}
                    </span>
                  </div>
                </div>

                {/* Inline Quick Slot & Faculty customization */}
                {isExpanded && sel && (() => {
                  const { uniqueSlots, clusterMap, availableClusters, faculties } =
                    getCourseOfferingsData(c.code);

                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 pt-2.5 border-t border-indigo-500/25 space-y-2.5 cursor-default text-left"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-white text-[11px] font-outfit uppercase tracking-wider">
                          Options for {c.code}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetCourseLocks(c.code)}
                            className="text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            Reset to Any
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveConfigCourseCode(c.code);
                              setGuidedPhase("auto_slots_faculty");
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <span>Dedicated Screen ↗</span>
                          </button>
                        </div>
                      </div>

                      {/* Quick Slot Bundles */}
                      {availableClusters.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Slot Bundles
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {availableClusters.map((clusterKey) => {
                              const clusterSlots = clusterMap.get(clusterKey)?.slots || [];
                              const allSelected =
                                clusterSlots.length > 0 && clusterSlots.every((s) => sel.allowedSlots.includes(s));
                              return (
                                <button
                                  key={clusterKey}
                                  type="button"
                                  onClick={() => handleToggleLockBundle(c.code, clusterSlots)}
                                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                    allSelected
                                      ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                  }`}
                                >
                                  {clusterKey.endsWith("1") || clusterKey.endsWith("2") ? `${clusterKey} Slots` : clusterKey}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Individual Slots */}
                      {uniqueSlots.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Individual Slots
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {uniqueSlots.map((slot) => {
                              const checked = sel.allowedSlots.includes(slot);
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => handleToggleLockSlot(c.code, slot)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                                    checked
                                      ? "bg-indigo-600/30 border-indigo-500 text-white"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  <span>{slot}</span>
                                  {checked && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Preferred Faculty */}
                      {faculties.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Preferred Faculty
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {faculties.map((fac) => {
                              const isFacSelected = sel.allowedFaculty?.includes(fac.name);
                              return (
                                <button
                                  key={fac.name}
                                  type="button"
                                  onClick={() => handleToggleLockFaculty(c.code, fac.name)}
                                  className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                    isFacSelected
                                      ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                  }`}
                                >
                                  <span>{fac.name}</span>
                                  {isFacSelected && <Check className="w-3 h-3 text-white" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAutoSlotsFacultyCard = (isLandscape = false) => {
    if (effectiveCourseLocks.length === 0) {
      return (
        <div
          className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-center flex flex-col justify-center items-center ${
            isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
          }`}
        >
          <BookOpen className="w-10 h-10 text-zinc-600 mb-2" />
          <h3 className="text-base font-bold text-white">No Courses Selected</h3>
          <p className="text-xs text-zinc-400 max-w-xs">
            Please choose courses to include in your timetable first before setting slot and faculty preferences.
          </p>
          <button
            type="button"
            onClick={() => setGuidedPhase(courseStrategy === "lock_advance" ? "setup_locks" : "auto_courses")}
            className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Go to Course Selection
          </button>
        </div>
      );
    }

    const currentCode =
      activeConfigCourseCode && effectiveCourseLocks.some((l) => l.code === activeConfigCourseCode)
        ? activeConfigCourseCode
        : effectiveCourseLocks[0].code;

    const currentLock = effectiveCourseLocks.find((l) => l.code === currentCode) || effectiveCourseLocks[0];
    const { uniqueSlots, clusterMap, availableClusters, availableBroadLetters, faculties } =
      getCourseOfferingsData(currentCode);

    const filteredFaculties = faculties.filter((f) =>
      facultySearchQuery ? f.name.toLowerCase().includes(facultySearchQuery.toLowerCase()) : true
    );

    const isSlotChecked = (slot: string) => currentLock.allowedSlots?.includes(slot) ?? false;
    const isFacultyChecked = (name: string) => currentLock.allowedFaculty?.includes(name) ?? false;

    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[460px] max-h-[680px]"
        }`}
      >
        {/* Course Tabs Strip */}
        <div className="shrink-0 space-y-2 pb-2 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Select Course to Configure:
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleResetCourseLocks(currentCode)}
              className="text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset this course to allow all slots and all faculty"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Allow All Options</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {effectiveCourseLocks.map((lock) => {
              const isCurrent = lock.code === currentCode;
              const hasSlots = lock.allowedSlots && lock.allowedSlots.length > 0;
              const hasFac = lock.allowedFaculty && lock.allowedFaculty.length > 0;

              return (
                <button
                  key={lock.code}
                  type="button"
                  onClick={() => {
                    setActiveConfigCourseCode(lock.code);
                    setFacultySearchQuery("");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isCurrent
                      ? "bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400"
                      : "bg-zinc-950/60 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
                  }`}
                >
                  <span className="font-black">{lock.code}</span>
                  {(hasSlots || hasFac) && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      title="Custom constraints configured"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Main Area for Selected Course */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
          {/* Course Details Header Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white font-outfit">{currentCode}</span>
                {isCourseEmbedded(currentCode) && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                    Theory + Lab
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">{currentLock.title}</p>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 flex-wrap">
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {currentLock.allowedSlots && currentLock.allowedSlots.length > 0
                  ? `${currentLock.allowedSlots.length} Slots Selected`
                  : "Any Slot (All Allowed)"}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {currentLock.allowedFaculty && currentLock.allowedFaculty.length > 0
                  ? `${currentLock.allowedFaculty.length} Faculty Selected`
                  : "Any Faculty (All Allowed)"}
              </span>
            </div>
          </div>

          {/* Section 1: Slots Configuration */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider font-outfit">
                  1. Allowed Slots
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Select specific slot bundles or individual slots. Leave empty to allow any slot.
                </p>
              </div>
              {currentLock.allowedSlots && currentLock.allowedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    updateCourseLocks((prev) =>
                      prev.map((p) => (p.code === currentCode ? { ...p, allowedSlots: [] } : p))
                    )
                  }
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Clear Slots (Allow Any)
                </button>
              )}
            </div>

            {/* Slot Bundles */}
            {availableClusters.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Quick Select Bundles
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableClusters.map((clusterKey) => {
                    const clusterSlots = clusterMap.get(clusterKey)?.slots || [];
                    const allSelected =
                      clusterSlots.length > 0 && clusterSlots.every((s) => isSlotChecked(s));

                    return (
                      <button
                        key={clusterKey}
                        type="button"
                        onClick={() => handleToggleLockBundle(currentCode, clusterSlots)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                          allSelected
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                            : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                        }`}
                        title={`Toggle ${clusterKey} bundle (${clusterSlots.join(", ")})`}
                      >
                        <span>
                          {clusterKey.endsWith("1") || clusterKey.endsWith("2")
                            ? `${clusterKey} Slots`
                            : clusterKey}
                        </span>
                        <span className="text-[10px] opacity-75 font-normal">
                          ({clusterSlots.join(", ")})
                        </span>
                      </button>
                    );
                  })}

                  {/* Broad Series buttons */}
                  {availableBroadLetters
                    .filter(
                      (letter) =>
                        (clusterMap.get(`${letter}1`)?.slots.length || 0) +
                          (clusterMap.get(`${letter}2`)?.slots.length || 0) >
                        1
                    )
                    .map((letter) => {
                      const seriesSlots = uniqueSlots.filter((s) => s.includes(letter));
                      const allSelected =
                        seriesSlots.length > 0 && seriesSlots.every((s) => isSlotChecked(s));

                      return (
                        <button
                          key={`broad-${letter}`}
                          type="button"
                          onClick={() => handleToggleLockBundle(currentCode, seriesSlots)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                            allSelected
                              ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                          }`}
                          title={`Toggle all ${letter} series slots (${seriesSlots.join(", ")})`}
                        >
                          All {letter} Series
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Individual Slot Chips */}
            {uniqueSlots.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Individual Slots
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueSlots.map((slot) => {
                    const checked = isSlotChecked(slot);
                    const facultyCount = new Set(
                      masterCourses
                        .filter((m) => m.CODE === currentCode && splitSlots(m.SLOT).includes(slot))
                        .map((m) => m.FACULTY.trim().toLowerCase())
                    ).size;

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleToggleLockSlot(currentCode, slot)}
                        className={`text-xs font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          checked
                            ? "bg-indigo-600/25 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/30"
                            : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <span className="font-mono">{slot}</span>
                        {facultyCount > 0 && (
                          <span className="text-[10px] font-normal text-zinc-400">
                            {facultyCount} prof{facultyCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {checked && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Preferred Faculty Configuration */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider font-outfit">
                  2. Preferred Faculty
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Select preferred professors. If none are selected, all faculty will be considered.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {currentLock.allowedFaculty && currentLock.allowedFaculty.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateCourseLocks((prev) =>
                        prev.map((p) => (p.code === currentCode ? { ...p, allowedFaculty: [] } : p))
                      )
                    }
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    Clear Faculty (Allow Any)
                  </button>
                )}
              </div>
            </div>

            {/* Faculty Search Input */}
            {faculties.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={facultySearchQuery}
                  onChange={(e) => setFacultySearchQuery(e.target.value)}
                  placeholder="Search faculty name..."
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-base sm:text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            {/* Faculty List */}
            <div className="space-y-1.5">
              {filteredFaculties.length === 0 ? (
                <div className="p-3 rounded-xl bg-zinc-950/40 text-center text-xs text-zinc-500">
                  No faculties matching &quot;{facultySearchQuery}&quot;
                </div>
              ) : (
                filteredFaculties.map((fac) => {
                  const checked = isFacultyChecked(fac.name);

                  return (
                    <div
                      key={fac.name}
                      onClick={() => handleToggleLockFaculty(currentCode, fac.name)}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        checked
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/30"
                          : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            checked ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-700 bg-zinc-900"
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-white truncate font-outfit">
                              {fac.name}
                            </span>
                            {fac.employeeId && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                #{fac.employeeId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 mt-0.5 flex-wrap">
                            <span>Slots: {fac.slots.join(", ")}</span>
                            {fac.venues.length > 0 && (
                              <span>• Venue: {fac.venues.join(", ")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenFacultySchedule && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFacultySchedule(fac.name);
                            }}
                            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title={`View ${fac.name}'s semester schedule`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenFacultyReview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFacultyReview({
                                name: fac.name,
                                employeeId: fac.employeeId,
                                courseCode: currentCode,
                              });
                            }}
                            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title={`View ratings and reviews for ${fac.name}`}
                          >
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAutoTimingsCard = (isLandscape = false) => {
    const startEdgePresets = [
      { time: "08:00", label: "08:00 AM", desc: "Period 1 (A1 / L1)" },
      { time: "08:55", label: "08:55 AM", desc: "Period 2 (F1 / L3)" },
      { time: "09:50", label: "09:50 AM", desc: "Period 3 (D1 / L5)" },
      { time: "10:45", label: "10:45 AM", desc: "Period 4 (TB1 / L7)" },
      { time: "11:40", label: "11:40 AM", desc: "Period 5 (TG1 / L9)" },
      { time: "14:00", label: "02:00 PM", desc: "Afternoon Start (A2 / L31)" },
    ];

    const endEdgePresets = [
      { time: "12:30", label: "12:30 PM", desc: "Period 5 End" },
      { time: "13:25", label: "01:25 PM", desc: "Lunch Break (Morning End)" },
      { time: "16:40", label: "04:40 PM", desc: "Period 9 End (D2 / L35)" },
      { time: "17:35", label: "05:35 PM", desc: "Period 10 End (TB2 / L37)" },
      { time: "18:30", label: "06:30 PM", desc: "Period 11 End (TG2 / L39)" },
      { time: "19:30", label: "07:30 PM", desc: "Day Wrap (Full Day End)" },
    ];

    const quickDaySchedules = [
      { start: "08:00", end: "19:30", title: "Full Campus Day", badge: "08:00 - 19:30" },
      { start: "08:00", end: "13:25", title: "Morning Only", badge: "08:00 - 13:25" },
      { start: "14:00", end: "19:30", title: "Afternoon Only", badge: "14:00 - 19:30" },
      { start: "08:55", end: "17:35", title: "Balanced Hours", badge: "08:55 - 17:35" },
    ];

    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[460px] max-h-[680px]"
        } overflow-y-auto custom-scrollbar`}
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">
              3. Day Start &amp; End Timings
            </h3>
            <p className="text-xs text-zinc-400">
              Set earliest permitted class starts and latest wrap times. Slot-based edge chips align with VIT periods.
            </p>
          </div>

          {/* Quick Schedule Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Quick Timing Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickDaySchedules.map((sched) => {
                const isActive = autoMinStartTime === sched.start && autoMaxEndTime === sched.end;
                return (
                  <button
                    key={sched.title}
                    type="button"
                    onClick={() => {
                      setAutoMinStartTime(sched.start);
                      setAutoMaxEndTime(sched.end);
                      autoBlockOutsideSlots(sched.start, sched.end);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-sm ring-1 ring-indigo-400"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="font-extrabold text-xs font-outfit truncate">{sched.title}</div>
                    <div className="text-[10px] opacity-80 font-mono mt-0.5">{sched.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-blocking Status Feedback */}
          {timeBlockedSlots.size > 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <Clock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>{timeBlockedSlots.size} slots</strong> outside {autoMinStartTime} – {autoMaxEndTime} are automatically blocked for generation.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800 text-zinc-400 text-xs">
              <Clock className="w-4 h-4 shrink-0 text-zinc-500" />
              <span>Full campus schedule open (08:00 – 19:30). No slots are automatically ruled out by time.</span>
            </div>
          )}

          {/* Start Time Section */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider font-outfit block">
                  Earliest Start Time (No classes before)
                </span>
                <span className="text-[11px] text-zinc-400">
                  Classes starting earlier than this time will be excluded.
                </span>
              </div>
              <input
                type="time"
                value={autoMinStartTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setAutoMinStartTime(val);
                  if (val) autoBlockOutsideSlots(val, autoMaxEndTime);
                }}
                className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono font-bold"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {startEdgePresets.map((preset) => {
                const isSelected = autoMinStartTime === preset.time;
                return (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => {
                      setAutoMinStartTime(preset.time);
                      autoBlockOutsideSlots(preset.time, autoMaxEndTime);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col text-left ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="text-[9.5px] opacity-75 font-normal">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* End Time Section */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider font-outfit block">
                  Latest Wrap Time (No classes after)
                </span>
                <span className="text-[11px] text-zinc-400">
                  Classes ending later than this time will be excluded.
                </span>
              </div>
              <input
                type="time"
                value={autoMaxEndTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setAutoMaxEndTime(val);
                  if (val) autoBlockOutsideSlots(autoMinStartTime, val);
                }}
                className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono font-bold"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {endEdgePresets.map((preset) => {
                const isSelected = autoMaxEndTime === preset.time;
                return (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => {
                      setAutoMaxEndTime(preset.time);
                      autoBlockOutsideSlots(autoMinStartTime, preset.time);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col text-left ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="text-[9.5px] opacity-75 font-normal">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAutoBlockingCard = (isLandscape = false) => {
    const daysList = DAYS || [
      { id: "mon", name: "Monday" },
      { id: "tue", name: "Tuesday" },
      { id: "wed", name: "Wednesday" },
      { id: "thu", name: "Thursday" },
      { id: "fri", name: "Friday" },
    ];

    const currentDayData = getDaySlots(blockingActiveDay);
    const morningTheoryBlocked =
      currentDayData.morningTheory.length > 0 &&
      currentDayData.morningTheory.every((s) => effectiveBlockedSlots.has(s));
    const morningLabBlocked =
      currentDayData.morningLab.length > 0 &&
      currentDayData.morningLab.every((s) => effectiveBlockedSlots.has(s));
    const eveningTheoryBlocked =
      currentDayData.eveningTheory.length > 0 &&
      currentDayData.eveningTheory.every((s) => effectiveBlockedSlots.has(s));
    const eveningLabBlocked =
      currentDayData.eveningLab.length > 0 &&
      currentDayData.eveningLab.every((s) => effectiveBlockedSlots.has(s));
    const dayAllBlocked =
      currentDayData.all.length > 0 &&
      currentDayData.all.every((s) => effectiveBlockedSlots.has(s));

    const schema = getTimetableSchema();
    const theoryPeriods = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
    const labPeriods = ensureLunchPeriod(schema.lab as TimetablePeriod[]);

    return (
      <div
        className={`p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[480px] max-h-[700px]"
        }`}
      >
        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">
                4. Slot &amp; Day Blocking
              </h3>
              <p className="text-xs text-zinc-400">
                Rule out whole days or specific periods. Tap any slot in the vertical timetable below to block theory or lab independently.
              </p>
            </div>
            {effectiveBlockedSlots.size > 0 && (
              <button
                type="button"
                onClick={handleClearAllBlocks}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear All ({effectiveBlockedSlots.size})</span>
              </button>
            )}
          </div>

          {/* Day Selector Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {daysList.map((d) => {
              const isSelected = blockingActiveDay === d.id;
              const dayData = getDaySlots(d.id);
              const blockedInDay = dayData.all.filter((s) => effectiveBlockedSlots.has(s)).length;

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setBlockingActiveDay(d.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400"
                      : "bg-zinc-950/60 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
                  }`}
                >
                  <span>{d.name}</span>
                  {blockedInDay > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-500/30 text-rose-300 text-[10px] font-mono">
                      {blockedInDay}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Per-Day Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleToggleDayBlock(blockingActiveDay, "morning_theory")}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                morningTheoryBlocked
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {morningTheoryBlocked ? "Unblock Morning Theory ✓" : "Block Morning Theory (08:00 - 13:25)"}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDayBlock(blockingActiveDay, "morning_lab")}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                morningLabBlocked
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {morningLabBlocked ? "Unblock Morning Lab ✓" : "Block Morning Lab (08:00 - 13:20)"}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDayBlock(blockingActiveDay, "evening_theory")}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                eveningTheoryBlocked
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {eveningTheoryBlocked ? "Unblock Afternoon Theory ✓" : "Block Afternoon Theory (14:00 - 19:30)"}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDayBlock(blockingActiveDay, "evening_lab")}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                eveningLabBlocked
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {eveningLabBlocked ? "Unblock Afternoon Lab ✓" : "Block Afternoon Lab (14:00 - 19:30)"}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDayBlock(blockingActiveDay, "all")}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                dayAllBlocked
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {dayAllBlocked ? "Unblock Full Day ✓" : "Block Entire Day"}
            </button>

            <button
              type="button"
              onClick={() => handleClearDayBlocks(blockingActiveDay)}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              Reset Day
            </button>
          </div>
        </div>

        {/* Visual Interactive Vertical Timetable */}
        <div className="flex-1 min-h-[220px] max-h-[360px] overflow-auto rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-2 custom-scrollbar">
          <div className="text-[10px] text-zinc-500 font-bold mb-1.5 px-1 flex items-center justify-between">
            <span>INTERACTIVE VERTICAL TIMETABLE — TAP ANY CELL TO TOGGLE BLOCK</span>
            <span className="text-rose-400 font-mono">{effectiveBlockedSlots.size} slots blocked</span>
          </div>
          <VerticalTimetableGrid
            courses={[]}
            theoryPeriods={theoryPeriods}
            labPeriods={labPeriods}
            days={daysList}
            blockedSlots={effectiveBlockedSlots}
            onToggleBlockSlot={handleToggleBlockSlot}
            compact={true}
            showSlotNames={true}
          />
        </div>
      </div>
    );
  };

  const renderAutoHalfDaysCard = (isLandscape = false) => {
    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[460px] max-h-[680px]"
        } overflow-y-auto custom-scrollbar`}
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">
              5. Free Half-Days &amp; Limits
            </h3>
            <p className="text-xs text-zinc-400">
              Set target free mornings/afternoons, daily pacing rules, and the maximum timetables to generate.
            </p>
          </div>

          {/* Section 1: Target Free Half-Days */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider font-outfit block">
                  Minimum Free Half-Days
                </span>
                <span className="text-[11px] text-zinc-400">
                  Mornings or afternoons with 0 scheduled classes.
                </span>
              </div>
              <span className="text-sm font-black text-emerald-400 font-outfit">
                {autoMinHalfDays === 0 ? "Flexible (0)" : `${autoMinHalfDays}+ Half-Days`}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[0, 1, 2, 3, 4].map((num) => {
                const isSelected = autoMinHalfDays === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setAutoMinHalfDays(num)}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    {num === 0 ? "0" : `${num}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Generation Limit (Result Cap) */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider font-outfit block">
                  Maximum Timetables to Generate
                </span>
                <span className="text-[11px] text-zinc-400">
                  Caps search depth to balance solve speed with variety.
                </span>
              </div>
              <span className="text-xs font-black text-indigo-400 font-mono">
                {autoNoLimit ? "Unlimited (30k max)" : `${autoResultCap} Timetables`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[10, 25, 50, 100, 250].map((cap) => {
                const isSelected = !autoNoLimit && autoResultCap === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      setAutoNoLimit(false);
                      setAutoResultCap(cap);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {cap}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setAutoNoLimit(!autoNoLimit)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  autoNoLimit
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                }`}
              >
                Unlimited ✨
              </button>
            </div>
          </div>

          {/* Section 3: Pacing Style */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Daily Class Pacing Style
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "compact", label: "Compact & Packed", desc: "Minimizes idle gaps between classes" },
                { id: "morning", label: "Morning Theory", desc: "Theory in morning, lab in afternoon" },
                { id: "evening", label: "Evening Theory", desc: "Theory in evening, lab in morning" },
                { id: "spread", label: "Spread & Relaxed", desc: "Paced evenly throughout the week" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAutoPreference(opt.id as any)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    autoPreference === opt.id
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40"
                      : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-extrabold text-xs text-white font-outfit">{opt.label}</span>
                    {autoPreference === opt.id && <Check className="w-3 h-3 text-indigo-400" />}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAutoSocialCard = (isLandscape = false) => {
    return (
      <div
        className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
        }`}
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">3. Friends &amp; Peer Sync</h3>
            <p className="text-xs text-zinc-400">Align your generated timetable with peer schedules.</p>
          </div>

          {friends.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center space-y-2">
              <Users className="w-8 h-8 text-zinc-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">Solo Generation Mode</h4>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                No friend timetables added yet. The solver will optimize purely for your personal preferences.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">Sync Shared Class Slots</p>
                  <p className="text-[11px] text-zinc-400">Prioritize sections where your friends are enrolled</p>
                </div>
                <Switch checked={autoSyncFriends} onCheckedChange={setAutoSyncFriends} size="md" label="Sync Classes" />
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">Maximize Shared Break Times</p>
                  <p className="text-[11px] text-zinc-400">Align lunch and free slots with friends</p>
                </div>
                <Switch checked={autoMaximizeFreeTime} onCheckedChange={setAutoMaximizeFreeTime} size="md" label="Maximize Breaks" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAutoSummaryCard = (isLandscape = false) => {
    if (generation.isGenerating) {
      return (
        <div
          className={`p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-indigo-500/30 backdrop-blur-xl shadow-2xl space-y-6 text-center flex flex-col items-center justify-center ${
            isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[440px] max-h-[660px]"
          }`}
        >
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-xl">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-indigo-400" />
            </div>
            <div className="absolute -inset-1 rounded-3xl bg-indigo-500/10 blur-xl -z-10 animate-pulse" />
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-lg sm:text-xl font-black text-white font-outfit tracking-tight">
              Generating Timetables...
            </h3>
            <p className="text-xs text-zinc-400">
              Exploring conflict-free combinations, applying blocked slots, and ranking by your pacing profile.
            </p>
          </div>

          {/* Live Metrics Dashboard */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
            <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Nodes Explored</span>
              <span className="text-base sm:text-lg font-black text-white font-mono">
                {generation.progress?.nodes?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950/70 border border-indigo-500/20 bg-indigo-950/20">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Found</span>
              <span className="text-base sm:text-lg font-black text-indigo-300 font-mono">
                {generation.progress?.found?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950/70 border border-emerald-500/20 bg-emerald-950/20">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Accepted</span>
              <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">
                {generation.progress?.accepted?.toLocaleString() ?? 0}
              </span>
            </div>
          </div>

          {/* Cancel solver button */}
          <button
            type="button"
            onClick={() => generation.cancel()}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-400 hover:text-rose-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            Cancel Generation
          </button>
        </div>
      );
    }

    return (
      <div
        className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[440px] max-h-[660px]"
        } overflow-y-auto custom-scrollbar`}
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">6. Generation Blueprint</h3>
            <p className="text-xs text-zinc-400">Review your parameters before launching the solver.</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Target Timetable</span>
              <span className="text-xs font-extrabold text-white">{activeTimetable.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Courses to Solve</span>
              <span className="text-xs font-extrabold text-indigo-400">{effectiveCourseLocks.length} Courses</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Class Hours</span>
              <span className="text-xs font-mono font-bold text-white">{autoMinStartTime} – {autoMaxEndTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Blocked Slots</span>
              <span className="text-xs font-mono font-bold text-rose-400">{effectiveBlockedSlots.size} Slots Blocked</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Min Half-Days</span>
              <span className="text-xs font-extrabold text-emerald-400">{autoMinHalfDays === 0 ? "Flexible (0)" : `${autoMinHalfDays}+`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Max Timetables</span>
              <span className="text-xs font-extrabold text-indigo-300">{autoNoLimit ? "Unlimited" : `${autoResultCap}`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">Pacing Style</span>
              <span className="text-xs font-extrabold text-white capitalize">{autoPreference}</span>
            </div>
          </div>

          {effectiveCourseLocks.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Courses:</span>
              <div className="flex flex-wrap gap-1.5">
                {effectiveCourseLocks.map((l) => (
                  <span
                    key={l.code}
                    className="text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-outfit"
                  >
                    {l.code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {generationError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{generationError}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAutoResultsCard = (isLandscape = false) => {
    const currentVariant = stagedTimetables[selectedVariantIndex];
    if (!currentVariant) return null;

    const schema = getTimetableSchema();
    const metrics = timetableMetrics(currentVariant.courses, schema);
    const totalCredits = currentVariant.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const gapHours = (metrics.gaps || 0) / 60;

    const ratedScores = currentVariant.courses
      .map((c) => {
        const rev = getFacultyReview({ employeeId: c.employeeId, name: c.faculty });
        return rev && rev.reviews > 0 ? rev.wPct : null;
      })
      .filter((s): s is number => s !== null);

    const avgFacultyScore =
      ratedScores.length > 0
        ? ratedScores.reduce((sum, s) => sum + s, 0) / ratedScores.length
        : null;

    return (
      <div
        className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3.5 text-left flex flex-col ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[60vh] sm:h-[66vh] min-h-[460px] max-h-[680px]"
        } overflow-y-auto custom-scrollbar`}
      >
        {/* Top: Variant Carousel Navigator & Grid View Shortcut */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 shrink-0 gap-2">
          <button
            type="button"
            disabled={selectedVariantIndex <= 0}
            onClick={() => setSelectedVariantIndex((prev) => Math.max(0, prev - 1))}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0">
            <span className="font-extrabold text-xs sm:text-sm text-white font-outfit truncate block">
              Recommendation {selectedVariantIndex + 1} of {stagedTimetables.length}
            </span>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
              {selectedVariantIndex === 0 ? "★ Top Recommended" : "Alternative Option"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGuidedPhase("auto_timetable_view")}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="View Vertical Timetable Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Grid View</span>
            </button>

            <button
              type="button"
              onClick={() => setGuidedPhase("manual_timetable_view")}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="Browse My Timetables"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">My Timetables ({effectiveTimetables.length})</span>
            </button>

            <button
              type="button"
              disabled={selectedVariantIndex >= stagedTimetables.length - 1}
              onClick={() => setSelectedVariantIndex((prev) => Math.min(stagedTimetables.length - 1, prev + 1))}
              className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs shrink-0">
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 block">Free Half-Days</span>
            <span className="font-black text-emerald-400 text-sm font-outfit">{metrics.halfDays}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 block">Total Gaps</span>
            <span className="font-black text-white text-sm font-outfit">{gapHours.toFixed(1)}h</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 block">Avg Faculty Score</span>
            <span className="font-black text-amber-400 text-sm font-outfit">
              {avgFacultyScore !== null ? `★ ${avgFacultyScore.toFixed(0)}%` : "—"}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 block">Total Credits</span>
            <span className="font-black text-indigo-400 text-sm font-outfit">{totalCredits}</span>
          </div>
        </div>

        {/* Course Roster with Faculty Review, Schedule & Replacement */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Scheduled Courses &amp; Faculties:
          </span>
          {currentVariant.courses.map((course) => (
            <div
              key={course.id || course.code}
              className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white font-outfit">{course.code}</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200">
                      {course.slots.join("+")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 my-1 flex-wrap">
                    {renderTypeChips(course.type, "sm")}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{course.title}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-zinc-500 block">{course.venue}</span>
                  <span className="text-xs font-black text-indigo-400">{course.credits} Cr</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <FacultyAvatar employeeId={course.employeeId} name={course.faculty} size="sm" tone="indigo" />
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-extrabold text-white truncate max-w-[140px] sm:max-w-[180px]">
                      {course.faculty}
                    </span>
                    <FacultyScoresForCourse
                      facultyString={course.faculty}
                      employeeId={course.employeeId}
                      courseCode={course.code}
                      onOpenFacultyReview={onOpenFacultyReview}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenFacultySchedule && (
                    <button
                      type="button"
                      onClick={() => onOpenFacultySchedule(course.faculty)}
                      className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10.5px] font-bold border border-cyan-500/20 flex items-center gap-1 cursor-pointer"
                      title="View Faculty Schedule for Semester"
                    >
                      <CalendarDays className="w-3 h-3 text-cyan-400" />
                      <span>Schedule</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenFacultyReview && onOpenFacultyReview({ name: course.faculty, employeeId: course.employeeId, courseCode: course.code })}
                    className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10.5px] font-bold border border-amber-500/20 flex items-center gap-1 cursor-pointer"
                    title="View Vitfac Review"
                  >
                    <Star className="w-3 h-3 text-amber-400" />
                    <span>Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSwapCourseRow({ course })}
                    className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10.5px] font-bold border border-indigo-500/20 flex items-center gap-1 cursor-pointer"
                    title="Swap Faculty for this Slot"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-400" />
                    <span>Swap</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAutoTimetableViewCard = (isLandscape = false) => {
    const currentVariant = stagedTimetables[selectedVariantIndex];
    if (!currentVariant) return null;

    const schema = getTimetableSchema();
    const metrics = timetableMetrics(currentVariant.courses, schema);
    const totalCredits = currentVariant.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const daysList = DAYS || [
      { id: "mon", name: "Monday" },
      { id: "tue", name: "Tuesday" },
      { id: "wed", name: "Wednesday" },
      { id: "thu", name: "Thursday" },
      { id: "fri", name: "Friday" },
    ];
    const theoryPeriods = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
    const labPeriods = ensureLunchPeriod(schema.lab as TimetablePeriod[]);

    return (
      <div
        className={`p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[62vh] sm:h-[68vh] min-h-[480px] max-h-[720px]"
        }`}
      >
        {/* Header Strip with Variant Navigator & Switch back to List */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedVariantIndex <= 0}
              onClick={() => setSelectedVariantIndex((prev) => Math.max(0, prev - 1))}
              className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-left">
              <span className="font-extrabold text-xs sm:text-sm text-white font-outfit block">
                Timetable {selectedVariantIndex + 1} of {stagedTimetables.length}
              </span>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                {selectedVariantIndex === 0 ? "★ Top Recommended" : "Generated Variant"}
              </span>
            </div>
            <button
              type="button"
              disabled={selectedVariantIndex >= stagedTimetables.length - 1}
              onClick={() => setSelectedVariantIndex((prev) => Math.min(stagedTimetables.length - 1, prev + 1))}
              className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Metric Chips */}
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold">
              {metrics.halfDays} Free Half-Days
            </span>
            <span className="px-2 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] font-bold">
              {totalCredits} Credits
            </span>
            <button
              type="button"
              onClick={() => setGuidedPhase("auto_results")}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
              <span>List &amp; Faculty View</span>
            </button>
            <button
              type="button"
              onClick={() => setGuidedPhase("manual_timetable_view")}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>My Timetables ({effectiveTimetables.length})</span>
            </button>
          </div>
        </div>

        {/* Embedded Interactive Vertical Timetable Grid */}
        <div className="flex-1 min-h-[260px] overflow-auto rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-2 custom-scrollbar">
          <VerticalTimetableGrid
            courses={currentVariant.courses}
            theoryPeriods={theoryPeriods}
            labPeriods={labPeriods}
            days={daysList}
            blockedSlots={effectiveBlockedSlots}
            compact={true}
            showSlotNames={true}
          />
        </div>
      </div>
    );
  };

  const renderManualTimetableViewCard = (isLandscape = false) => {
    const currentTt = effectiveTimetables[browsingTimetableIndex] || activeTimetable;
    const browsingCourses = currentTt?.courses || [];
    const schema = getTimetableSchema();
    const totalCredits = browsingCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const metrics = timetableMetrics(browsingCourses, schema);
    const isCurrentActive = (currentTt?.id || "") === (activeTimetable?.id || "");
    const daysList = DAYS || [
      { id: "mon", name: "Monday" },
      { id: "tue", name: "Tuesday" },
      { id: "wed", name: "Wednesday" },
      { id: "thu", name: "Thursday" },
      { id: "fri", name: "Friday" },
    ];
    const theoryPeriods = ensureLunchPeriod(schema.theory as TimetablePeriod[]);
    const labPeriods = ensureLunchPeriod(schema.lab as TimetablePeriod[]);

    return (
      <div
        className={`p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left flex flex-col justify-between ${
          isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[62vh] sm:h-[68vh] min-h-[480px] max-h-[720px]"
        }`}
      >
        {/* Header Strip with Multi-Timetable Navigation & Metrics */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous Timetable"
              disabled={browsingTimetableIndex <= 0}
              onClick={() => navigateBrowsingTimetable(browsingTimetableIndex - 1, "backward")}
              className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
              title="Previous Timetable"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-left min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-white font-outfit truncate max-w-[140px] sm:max-w-[200px]">
                  {currentTt.name}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({browsingTimetableIndex + 1}/{effectiveTimetables.length})
                </span>
              </div>
              {isCurrentActive ? (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  ● Mounted Active Timetable
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectTimetable && onSelectTimetable(currentTt.id)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider block cursor-pointer underline"
                >
                  Set as Active Schedule
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="Next Timetable"
              disabled={browsingTimetableIndex >= effectiveTimetables.length - 1}
              onClick={() => navigateBrowsingTimetable(browsingTimetableIndex + 1, "forward")}
              className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
              title="Next Timetable"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold">
              {metrics.halfDays} Half-Days
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold">
              {browsingCourses.length} Course{browsingCourses.length === 1 ? "" : "s"}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] font-bold">
              {totalCredits} Credits
            </span>
            <button
              type="button"
              onClick={() => {
                if (currentTt && onSelectTimetable && currentTt.id !== activeTimetable?.id) {
                  onSelectTimetable(currentTt.id);
                }
                setSelectedCourseCode("");
                setSelectedSlotIndex("-1");
                setGuidedPhase("builder");
                setCurrentStep(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Add Course</span>
            </button>
          </div>
        </div>

        {/* Scroll-snapped Timetable Pill Tabs */}
        {effectiveTimetables.length > 1 && (
          <div
            role="tablist"
            aria-label="Select saved timetable"
            className="flex items-center gap-1.5 overflow-x-auto snap-x snap-mandatory py-1 px-1 custom-scrollbar shrink-0 border-b border-zinc-800/50 pb-2"
          >
            {effectiveTimetables.map((tt, idx) => {
              const isSelected = idx === browsingTimetableIndex;
              const isMountedActive = tt.id === activeTimetable?.id;
              return (
                <button
                  key={tt.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() =>
                    navigateBrowsingTimetable(
                      idx,
                      idx >= browsingTimetableIndex ? "forward" : "backward"
                    )
                  }
                  className={`snap-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                    isSelected
                      ? "bg-indigo-600/25 border-indigo-500/50 text-white shadow-sm ring-1 ring-indigo-500/30"
                      : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <span className="truncate max-w-[120px]">{tt.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                      isSelected
                        ? "bg-indigo-500/30 text-indigo-200"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {tt.courses?.length || 0}
                  </span>
                  {isMountedActive && (
                    <span
                      title="Currently Active Schedule"
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Embedded Interactive Vertical Timetable Grid with View Transition Class */}
        <div
          key={currentTt.id}
          className={`flex-1 min-h-[260px] overflow-auto rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-2 custom-scrollbar transition-all duration-300 animate-in fade-in ${
            browserTransitionDirection === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
          }`}
        >
          <VerticalTimetableGrid
            courses={browsingCourses}
            theoryPeriods={theoryPeriods}
            labPeriods={labPeriods}
            days={daysList}
            blockedSlots={effectiveBlockedSlots}
            compact={true}
            showSlotNames={true}
          />
        </div>

        {/* Course chips row / Empty Notice */}
        {browsingCourses.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 custom-scrollbar shrink-0">
            {browsingCourses.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] shrink-0"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color || "#6366f1" }}
                />
                <span className="font-black text-white">{c.code}</span>
                <span className="text-zinc-400 font-medium truncate max-w-[100px]">
                  {c.slots.join("+")}
                </span>
                <span className="text-zinc-500 text-[10px]">({c.faculty})</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2 px-3 rounded-xl bg-zinc-950/50 border border-dashed border-zinc-800/80 text-center shrink-0">
            <span className="text-xs text-zinc-400 font-medium">
              No courses placed in <strong className="text-white">{currentTt.name}</strong> yet. Click{" "}
              <strong className="text-indigo-400">+ Add Course</strong> to begin.
            </span>
          </div>
        )}
      </div>
    );
  };

  // ── BUILDER SCREENS (MANUAL COURSE SELECTOR) ──
  const renderCourseListCard = (isLandscape = false) => (
    <div
      className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 sm:space-y-4 text-left flex flex-col ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[52vh] sm:h-[58vh] min-h-[380px] max-h-[620px]"
      }`}
    >
      {/* Integration Switcher: Jump between Manual Builder and Auto Generator */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 shrink-0 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-zinc-300 font-medium truncate">
            Want algorithm to solve combinations for you?
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setPlanMode("auto");
            setGuidedPhase("auto_courses");
          }}
          className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline shrink-0 text-xs cursor-pointer"
        >
          Auto-Generate Timetable ✨
        </button>
      </div>

      <div className="relative shrink-0">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search code (e.g. BCSE101), title, or batch..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-base sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
        />
      </div>

      {effectiveCourseLocks.length > 0 && (
        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <span>{lockedOnlyFilter ? "Locked Courses Only" : "Any Courses (All)"}</span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-purple-500/25 text-purple-300 shrink-0">
                  {effectiveCourseLocks.length} locked
                </span>
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                {lockedOnlyFilter ? "Filtered to target courses selected earlier" : "Showing full university catalogue"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-zinc-400 hidden sm:inline">
              {lockedOnlyFilter ? "Locked" : "Any"}
            </span>
            <Switch
              checked={lockedOnlyFilter}
              onCheckedChange={setLockedOnlyFilter}
              size="md"
              label="Toggle locked courses only"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {[
            { id: "all", label: "All Types" },
            { id: "th", label: "Theory" },
            { id: "eth", label: "Embedded" },
            { id: "la", label: "Lab" },
            { id: "ss", label: "Soft Skills" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press active:scale-[0.97] ${
                typeFilter === opt.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-zinc-950/40 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenPasteRegistered}
          className="text-[11px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 touch-press active:scale-[0.97]"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>Paste VTOP</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto momentum-scroll space-y-2 pr-1 custom-scrollbar">
        {filteredCourses.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-950/40 border border-zinc-800 text-center space-y-2">
            <Search className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-400">No courses match your filter</p>
            {lockedOnlyFilter && effectiveCourseLocks.length > 0 && (
              <button
                type="button"
                onClick={() => setLockedOnlyFilter(false)}
                className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Show all catalogue courses instead
              </button>
            )}
          </div>
        ) : (
          filteredCourses.slice(0, 100).map((c) => {
            const inTimetable = isCourseInTimetable(c.code);
            const isSelected = selectedCourseCode === c.code;

            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelectCourse(c.code)}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500 text-white ring-1 ring-indigo-500/30"
                    : inTimetable
                    ? "bg-zinc-950/40 border-emerald-500/30 text-zinc-300 hover:border-emerald-500/50"
                    : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-indigo-400 transition-colors font-outfit">
                      {c.code}
                    </span>
                    {inTimetable && (
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Added
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    {isCourseEmbedded(c.code) && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                        Theory + Lab
                      </span>
                    )}
                    {renderTypeChips(c.types || [], "sm")}
                  </div>
                  <p className="text-xs text-zinc-400 font-medium truncate">{c.title}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderSlotOfferingsCard = (isLandscape = false) => (
    <div
      className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 sm:space-y-4 text-left flex flex-col ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "h-[52vh] sm:h-[58vh] min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm text-white font-outfit">{selectedCourseCode}</span>
              {isReplacingSlot && (
                <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RotateCcw className="w-2.5 h-2.5" /> In TT: {existingCourseInTimetable?.slots.join("+")}
                </span>
              )}
            </div>
            {selectedCourseMeta && (
              <div className="flex items-center gap-1 flex-wrap">
                {renderTypeChips(selectedCourseMeta.types || [], "sm")}
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-400 truncate mt-1">{selectedCourseMeta?.title}</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300 shrink-0">
          <span className="hidden sm:inline">Group Embedded</span>
          <Switch
            checked={isGroupingEnabled}
            onCheckedChange={setIsGroupingEnabled}
            size="md"
            label="Group Embedded Courses"
          />
        </label>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 shrink-0">
        {[
          { id: "all", label: "All Sessions" },
          { id: "morning_session", label: "Morning Session" },
          { id: "evening_session", label: "Evening Session" },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSlotFilter(opt.id)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              slotFilter === opt.id
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-zinc-950/40 text-zinc-400 border border-zinc-800 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredOfferings.map((offering) => {
          const originalIndex = availableOfferings.indexOf(offering);
          const slotsArray = splitSlots(offering.SLOT);
          const clash = checkClashes(slotsArray, isReplacingSlot ? selectedCourseCode : undefined);
          const isSelected = selectedSlotIndex === String(originalIndex);
          const isCurrentSlot = isReplacingSlot && existingCourseInTimetable?.slots.join("+") === slotsArray.join("+");

          return (
            <button
              key={`${offering.SLOT}-${offering.FACULTY}-${originalIndex}`}
              type="button"
              onClick={() => handleSelectOffering(originalIndex)}
              className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative ${
                isSelected
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/30"
                  : clash
                  ? "bg-zinc-950/40 border-rose-500/30 text-zinc-300 hover:border-rose-500/50"
                  : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
                    {offering.SLOT}
                  </span>
                  {isCurrentSlot ? (
                    <span className="text-[10px] font-black text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      Current Slot
                    </span>
                  ) : clash ? (
                    <span
                      className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                      title={clash}
                    >
                      <AlertTriangle className="w-2.5 h-2.5" /> Clashes
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> {isReplacingSlot ? "Replaceable" : "Conflict-free"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <FacultyAvatar employeeId={offering.ERP_ID} name={offering.FACULTY} size="sm" tone="indigo" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-white group-hover:text-indigo-400 transition-colors truncate">
                      {offering.FACULTY}
                    </p>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span>{offering.ROOM || "TBA"}</span>
                      {offering.ERP_ID && (
                        <>
                          <span className="text-zinc-600">·</span>
                          <span>ERP {offering.ERP_ID}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderReviewCard = (isLandscape = false) => (
    <div
      className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[460px] max-h-[72vh] sm:max-h-[640px]"
      } overflow-y-auto custom-scrollbar`}
    >
      <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              Target: {activeTimetable.name}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-white font-outfit truncate">
            {selectedCourseMeta?.code} · {selectedCourseMeta?.title}
          </h2>
          {selectedCourseMeta && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {renderTypeChips(selectedCourseMeta.types || [], "sm")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
            {selectedOffering?.CREDITS || "0"} Credits
          </span>
        </div>
      </div>

      {selectedOffering && (() => {
        const clash = checkClashes(splitSlots(selectedOffering.SLOT), isReplacingSlot ? selectedCourseCode : undefined);
        if (clash) {
          return (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span><strong>Warning:</strong> {clash}</span>
            </div>
          );
        }
        if (isReplacingSlot && existingCourseInTimetable) {
          return (
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <RotateCcw className="w-4 h-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <span className="block text-white font-extrabold truncate">Replacing Active Slot</span>
                  <span className="text-[11px] text-amber-200/80 font-normal">
                    Replaces current slot {existingCourseInTimetable.slots.join("+")} ({existingCourseInTimetable.faculty}) with {selectedOffering.SLOT}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 shrink-0">
                Replacement
              </span>
            </div>
          );
        }
        return (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5 shadow-xs">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span><strong>Conflict-free:</strong> Fits cleanly into your schedule without any slot overlap!</span>
          </div>
        );
      })()}

      {selectedOffering && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <Users className="w-3 h-3 text-zinc-400" />
              <span>Instructor &amp; Venue</span>
            </div>
            <div className="flex items-center gap-2.5">
              <FacultyAvatar employeeId={selectedOffering.ERP_ID} name={selectedOffering.FACULTY} size="sm" tone="indigo" />
              <div className="min-w-0">
                <p className="font-extrabold text-white text-xs sm:text-sm truncate font-outfit">
                  {selectedOffering.FACULTY}
                </p>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span>{selectedOffering.ROOM || "TBA"}</span>
                  {selectedOffering.ERP_ID && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span>ERP {selectedOffering.ERP_ID}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {onOpenFacultySchedule && selectedOffering.FACULTY && (
              <button
                type="button"
                onClick={() => onOpenFacultySchedule(selectedOffering.FACULTY)}
                className="w-full mt-2.5 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                title={`View ${selectedOffering.FACULTY}'s full semester timetable schedule`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>View Faculty Schedule for Semester</span>
                <ExternalLink className="w-3 h-3 text-cyan-400/70 ml-0.5 shrink-0" />
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>Allocated Slots</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {splitSlots(selectedOffering.SLOT).map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700/80 font-mono font-bold text-white text-xs shadow-2xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedOffering && selectedCourseMeta && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-400" />
              <span>Faculty Reputation &amp; Vitfac Lore</span>
            </span>
          </div>
          <GuidedFacultyReviewStats
            facultyString={selectedOffering.FACULTY}
            employeeId={selectedOffering.ERP_ID}
            courseCode={selectedCourseMeta.code}
            onOpenFacultyReview={onOpenFacultyReview}
          />
        </div>
      )}
    </div>
  );

  const renderBottomActions = () => {
    if (guidedPhase === "setup_mode") {
      return (
        <button
          type="button"
          onClick={() => setGuidedPhase("setup_timetable")}
          className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
        >
          <span>Continue to Timetable Selection</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      );
    }

    if (guidedPhase === "setup_timetable") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setGuidedPhase("setup_strategy")}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Continue to Course Strategy</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "setup_strategy") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (courseStrategy === "lock_advance") {
                setGuidedPhase("setup_locks");
              } else {
                if (planMode === "auto") {
                  setGuidedPhase("auto_courses");
                } else {
                  setGuidedPhase("builder");
                  setCurrentStep(1);
                }
              }
            }}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>
              {courseStrategy === "lock_advance"
                ? "Continue to Lock Courses"
                : planMode === "auto"
                ? "Continue to Course Selection"
                : "Start Adding Courses"}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "setup_locks") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (planMode === "auto") {
                if (effectiveCourseLocks.length > 0) {
                  if (!effectiveCourseLocks.some((l) => l.code === activeConfigCourseCode)) {
                    setActiveConfigCourseCode(effectiveCourseLocks[0].code);
                  }
                  setGuidedPhase("auto_slots_faculty");
                } else {
                  setGuidedPhase("auto_timings");
                }
              } else {
                setGuidedPhase("builder");
                setCurrentStep(1);
              }
            }}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>
              {planMode === "auto"
                ? `Configure Slots & Faculty (${effectiveCourseLocks.length})`
                : effectiveCourseLocks.length > 0
                ? `Continue to Course Adder (${effectiveCourseLocks.length})`
                : "Continue to Course Adder"}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    // Auto phases bottom actions
    if (guidedPhase === "auto_courses") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={effectiveCourseLocks.length === 0}
            onClick={() => {
              if (effectiveCourseLocks.length > 0) {
                if (!effectiveCourseLocks.some((l) => l.code === activeConfigCourseCode)) {
                  setActiveConfigCourseCode(effectiveCourseLocks[0].code);
                }
                setGuidedPhase("auto_slots_faculty");
              }
            }}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Configure Slots &amp; Faculty ({effectiveCourseLocks.length})</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_slots_faculty") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setGuidedPhase("auto_timings")}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Continue to Class Timings</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_timings") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              autoBlockOutsideSlots(autoMinStartTime, autoMaxEndTime);
              setGuidedPhase("auto_blocking");
            }}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Continue to Day &amp; Slot Blocking</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_blocking") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setGuidedPhase("auto_half_days")}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Continue to Half-Days &amp; Limits</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_half_days") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (friends && friends.length > 0) setGuidedPhase("auto_social");
              else setGuidedPhase("auto_summary");
            }}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>{friends && friends.length > 0 ? "Continue to Friends Sync" : "Review Generation Blueprint"}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_social") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setGuidedPhase("auto_summary")}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            <span>Review Generation Blueprint</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_summary") {
      return (
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            disabled={generation.isGenerating}
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0 disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={generation.isGenerating || effectiveCourseLocks.length === 0}
            onClick={handleRunAutoGeneration}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
          >
            {generation.isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Solving Best Combinations...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 shrink-0" />
                <span>Generate Timetable Recommendations ✨</span>
              </>
            )}
          </button>
        </div>
      );
    }

    if (guidedPhase === "auto_results" || guidedPhase === "auto_timetable_view") {
      const currentVariant = stagedTimetables[selectedVariantIndex];
      return (
        <div className="flex flex-wrap items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setGuidedPhase("auto_half_days")}
            className="whitespace-nowrap py-3 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-indigo-400 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer font-outfit flex items-center justify-center gap-1.5 shrink-0"
            title="Adjust Generation Settings"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Settings</span>
          </button>

          {guidedPhase === "auto_results" ? (
            <button
              type="button"
              onClick={() => setGuidedPhase("auto_timetable_view")}
              className="whitespace-nowrap py-3 sm:py-3.5 px-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer font-outfit flex items-center justify-center gap-1.5 shrink-0"
              title="Switch to Timetable Grid View"
            >
              <LayoutGrid className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="whitespace-nowrap">Grid View</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGuidedPhase("auto_results")}
              className="whitespace-nowrap py-3 sm:py-3.5 px-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer font-outfit flex items-center justify-center gap-1.5 shrink-0"
              title="Switch to Faculty List View"
            >
              <FileSpreadsheet className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="whitespace-nowrap">List View</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setGuidedPhase("manual_timetable_view")}
            className="whitespace-nowrap py-3 sm:py-3.5 px-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer font-outfit flex items-center justify-center gap-1.5 shrink-0"
            title="Browse My Timetables"
          >
            <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="whitespace-nowrap">My Timetables</span>
          </button>

          <button
            type="button"
            disabled={!currentVariant}
            onClick={() => currentVariant && handleApplyVariant(currentVariant)}
            className="flex-1 min-w-[260px] whitespace-nowrap py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 shrink-0"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Apply This Recommendation to {activeTimetable.name} 🚀</span>
          </button>
        </div>
      );
    }

    if (guidedPhase === "manual_timetable_view") {
      const currentTt = effectiveTimetables[browsingTimetableIndex] || activeTimetable;
      return (
        <div className="flex flex-wrap items-center gap-2 w-full">
          <button
            type="button"
            onClick={handlePrevStep}
            aria-label="Previous Step"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
            title="Back to Review"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </button>

          {effectiveTimetables.length > 1 && (
            <div className="flex items-center gap-1 bg-zinc-950/60 border border-zinc-800 rounded-2xl p-1 shrink-0">
              <button
                type="button"
                disabled={browsingTimetableIndex <= 0}
                onClick={() => navigateBrowsingTimetable(browsingTimetableIndex - 1, "backward")}
                aria-label="Previous Timetable"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center"
                title="Previous Timetable"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
              <span className="text-[11px] font-mono font-bold text-zinc-300 px-1.5 whitespace-nowrap">
                {browsingTimetableIndex + 1}/{effectiveTimetables.length}
              </span>
              <button
                type="button"
                disabled={browsingTimetableIndex >= effectiveTimetables.length - 1}
                onClick={() => navigateBrowsingTimetable(browsingTimetableIndex + 1, "forward")}
                aria-label="Next Timetable"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center"
                title="Next Timetable"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (currentTt && onSelectTimetable && currentTt.id !== activeTimetable?.id) {
                onSelectTimetable(currentTt.id);
              }
              setSelectedCourseCode("");
              setSelectedSlotIndex("-1");
              setGuidedPhase("builder");
              setCurrentStep(1);
            }}
            className="flex-1 min-w-[170px] whitespace-nowrap py-3 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-indigo-400 hover:text-indigo-300 font-black text-xs sm:text-sm shadow-xl transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Add Another Course</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onViewTimetable) onViewTimetable();
            }}
            className="flex-1 min-w-[160px] whitespace-nowrap py-3 sm:py-3.5 px-4 sm:px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 shrink-0"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Done / View Grid</span>
          </button>
        </div>
      );
    }

    // Builder Phase Bottom Actions
    return (
      <>
        {currentStep === 1 && (
          <button
            type="button"
            onClick={() => selectedCourseCode && setCurrentStep(2)}
            disabled={!selectedCourseCode}
            className={`flex-1 py-3.5 px-5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate ${
              selectedCourseCode
                ? isReplacingSlot
                  ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                : "bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-800"
            }`}
          >
            <span className="truncate">
              {selectedCourseCode
                ? isReplacingSlot
                  ? `Change / Replace Slot for ${selectedCourseCode}`
                  : `Pick Offering for ${selectedCourseCode}`
                : "Select a Course to Proceed"}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}

        {currentStep === 2 && (
          <button
            type="button"
            onClick={() => selectedOffering && setCurrentStep(3)}
            disabled={!selectedOffering}
            className={`flex-1 py-3.5 px-5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate ${
              selectedOffering
                ? isReplacingSlot
                  ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                : "bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-800"
            }`}
          >
            <span className="truncate">
              {selectedOffering
                ? isReplacingSlot
                  ? "Review & Replace Slot"
                  : "Review & Place Offering"
                : "Pick an Offering to Proceed"}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}

        {currentStep === 3 && (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleAddAnother}
              className="whitespace-nowrap py-3 sm:py-3.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-indigo-400 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer font-outfit flex items-center justify-center gap-1.5 shrink-0"
              title={isReplacingSlot ? "Replace slot and pick another course" : "Add to timetable and pick another course"}
            >
              {isReplacingSlot ? <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" /> : <PlusCircle className="w-4 h-4 shrink-0" />}
              <span className="whitespace-nowrap">{isReplacingSlot ? "Replace & Another" : "Add & Another"}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmAdd}
              className={`flex-1 min-w-[200px] whitespace-nowrap py-3.5 px-4 sm:px-5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 shrink-0 ${
                isReplacingSlot
                  ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
              }`}
            >
              {isReplacingSlot ? <RotateCcw className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              <span className="whitespace-nowrap">{isReplacingSlot ? `Replace Slot in ${activeTimetable.name}` : `Add to ${activeTimetable.name}`}</span>
            </button>
          </div>
        )}
      </>
    );
  };

  const getCurrentStepPill = (): string => {
    if (guidedPhase === "builder") {
      if (currentStep === 1) return "builder_course";
      if (currentStep === 2) return "builder_slot";
      return "builder_review";
    }
    return guidedPhase;
  };

  const handlePillClick = (p: string) => {
    if (p === "builder_course") {
      setGuidedPhase("builder");
      setCurrentStep(1);
    } else if (p === "builder_slot") {
      if (selectedCourseCode) {
        setGuidedPhase("builder");
        setCurrentStep(2);
      }
    } else if (p === "builder_review") {
      if (selectedOffering) {
        setGuidedPhase("builder");
        setCurrentStep(3);
      }
    } else {
      setGuidedPhase(p as GuidedPhase);
    }
  };

  const getPillsList = (): (GuidedPhase | "builder_course" | "builder_slot" | "builder_review")[] => {
    if (planMode === "auto") {
      const phases: (GuidedPhase | "builder_course" | "builder_slot" | "builder_review")[] = [
        "setup_mode",
        "setup_timetable",
        "setup_strategy",
      ];
      if (guidedPhase === "setup_locks" || courseStrategy === "lock_advance") {
        phases.push("setup_locks");
      } else {
        phases.push("auto_courses");
      }
      phases.push("auto_slots_faculty");
      phases.push("auto_timings");
      phases.push("auto_blocking");
      phases.push("auto_half_days");
      if (friends && friends.length > 0) phases.push("auto_social");
      phases.push("auto_summary", "auto_results");
      return phases;
    }

    // Manual flow: completely integrated for whichever timetable is mounted
    const manualPhases: (GuidedPhase | "builder_course" | "builder_slot" | "builder_review")[] = [
      "setup_mode",
      "setup_timetable",
      "setup_strategy",
    ];
    if (courseStrategy === "lock_advance" || guidedPhase === "setup_locks") {
      manualPhases.push("setup_locks");
    }
    manualPhases.push("builder_course", "builder_slot", "builder_review", "manual_timetable_view");
    return manualPhases;
  };

  const isMobileViewport = viewportDimensions.width > 0 && viewportDimensions.width < 768;

  if (isMobileViewport && !hasLaunchedHero) {
    return (
      <div
        data-testid="mobile-preflight-screen"
        className={
          fullScreenMode
            ? "fixed inset-0 z-50 h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-y-auto select-none p-5 sm:p-8 animate-in fade-in duration-300"
            : "relative w-full rounded-[32px] bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none p-5 sm:p-8 shadow-2xl border border-zinc-800 min-h-[580px]"
        }
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 right-0 w-64 h-64 rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -bottom-32 left-0 w-64 h-64 rounded-full bg-violet-600/20 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col justify-center gap-5 my-auto">
          {/* Top badge & Status */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>FFCS Mobile Generator</span>
            </span>

            {isPwaStandalone ? (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>App Installed</span>
              </span>
            ) : canInstall ? (
              <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>PWA Ready</span>
              </span>
            ) : null}
          </div>

          {/* Title and subtitle */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-outfit">
              Mobile-First Timetable Builder
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Step-by-step mobile timetable designer with live clash checking, faculty ratings, and fast multi-timetable switching.
            </p>
          </div>

          {/* Feature Highlight Pills */}
          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Wand2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-200">Clash-Free Timetable Generator</p>
                <p className="text-[11px] text-zinc-400 truncate">Automatic ranking with preferred slots and timings</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-200">Faculty Ratings & Swapping</p>
                <p className="text-[11px] text-zinc-400 truncate">Compare faculty scores and swap slots seamlessly</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-200">Multi-Timetable Browser</p>
                <p className="text-[11px] text-zinc-400 truncate">Switch, create, and manage schedules side-by-side</p>
              </div>
            </div>
          </div>

          {/* PWA Install Button */}
          {canInstall && !isPwaStandalone && (
            <button
              type="button"
              data-testid="pwa-install-btn"
              onClick={promptInstall}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              data-testid="enter-fullscreen-start-btn"
              onClick={async () => {
                try {
                  await requestNativeFullscreen();
                } catch {}
                setFullScreenMode(true);
                onToggleFullScreen?.(true);
                setHasLaunchedHero(true);
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer font-outfit tracking-wide"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Enter Full Screen & Start</span>
            </button>

            <button
              type="button"
              data-testid="start-in-window-btn"
              onClick={() => {
                setHasLaunchedHero(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Continue in Window</span>
            </button>

            {onSwitchToSinglePageView && (
              <button
                type="button"
                data-testid="switch-to-single-page-btn"
                onClick={onSwitchToSinglePageView}
                className="w-full py-2 px-3 text-xs text-zinc-400 hover:text-zinc-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Single Page View</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="guided-hero-container"
      style={{ zoom: 0.85 }}
      className={
        fullScreenMode
          ? "fixed inset-0 z-50 h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-y-auto sm:overflow-hidden select-none px-4 sm:px-8 py-4 sm:py-6 animate-in fade-in duration-300 [zoom:0.85]"
          : "relative w-full rounded-[32px] bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none px-4 sm:px-6 py-5 shadow-2xl border border-zinc-800 min-h-[580px] [zoom:0.85]"
      }
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-violet-600/10 blur-[150px]" />
      </div>

      {addedJustNow && (
        <div className="relative z-30 w-full max-w-md sm:max-w-2xl mx-auto mb-2">
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xl backdrop-blur-xl animate-in fade-in duration-200 ${
              addedJustNow.isReplacement
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <span className="flex items-center gap-2">
              {addedJustNow.isReplacement ? (
                <RotateCcw className="w-4 h-4 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              )}
              <span>
                {addedJustNow.isReplacement ? (
                  <>Replaced slot for <strong>{addedJustNow.code}</strong> in <strong>{activeTimetable.name}</strong>!</>
                ) : (
                  <>Added <strong>{addedJustNow.code}</strong> to <strong>{activeTimetable.name}</strong>!</>
                )}
              </span>
            </span>
            {onViewTimetable && (
              <button
                type="button"
                onClick={onViewTimetable}
                className={`underline font-bold ml-2 cursor-pointer ${
                  addedJustNow.isReplacement ? "hover:text-amber-200" : "hover:text-emerald-300"
                }`}
              >
                View Grid →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Responsive Horizontal vs Vertical Layout */}
      {isHorizontal ? (
        <div className="relative z-20 w-full max-w-6xl mx-auto flex-1 flex flex-row items-center justify-between gap-8 lg:gap-14 h-full min-h-0 py-2">
          {/* Left Pane (~42%) */}
          <div className="w-[42%] max-w-md shrink-0 flex flex-col justify-between h-full max-h-[660px] py-1 select-none">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{guidedPhase === "setup_mode" ? "Timetable" : "Back"}</span>
              </button>

              <div className="flex items-center gap-2">
                {getPillsList().map((p, idx, arr) => {
                  const stepNum = idx + 1;
                  const currentPill = getCurrentStepPill();
                  const currentIdx = arr.indexOf(currentPill as any);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePillClick(p)}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        currentPill === p
                          ? "w-7 bg-indigo-500 shadow-xs shadow-indigo-500/50"
                          : currentIdx > idx
                          ? "w-2.5 bg-indigo-400/50 hover:bg-indigo-400"
                          : "w-2 bg-zinc-800"
                      }`}
                      title={`Step ${stepNum}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {onSwitchToSinglePageView && (
                  <button
                    type="button"
                    onClick={onSwitchToSinglePageView}
                    className="h-8 px-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    title="Switch to Single Page View"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                    <span>Single Page View (Plan)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleFullScreen}
                  className="w-8 h-8 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title={fullScreenMode ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {fullScreenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Left Pane Content Body */}
            <div className="flex-1 flex flex-col justify-center space-y-4 my-auto py-4">
              {guidedPhase === "setup_mode" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Phase 1 · Mode
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Choose Creation Mode
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Choose between automated algorithmic generation or building your timetable step-by-step with real-time clash checking.
                  </p>
                </>
              )}

              {guidedPhase === "setup_timetable" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Phase 2 · Timetable
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Select Target Timetable
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Choose which timetable to edit, create a new variant, or rename your existing schedules.
                  </p>
                </>
              )}

              {guidedPhase === "setup_strategy" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-outfit">
                      Phase 3 · Strategy
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Course Strategy
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Decide whether to lock mandatory target courses in advance or explore offerings one by one.
                  </p>
                </>
              )}

              {guidedPhase === "setup_locks" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-outfit">
                      Phase 4 · Lock Target Courses
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Lock Courses &amp; Slots
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Select mandatory courses and optionally lock specific slot clusters (like A1 or B1 slots) or faculties.
                  </p>
                </>
              )}

              {guidedPhase === "auto_courses" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-outfit">
                      Auto Step 1 · Courses
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Choose Courses
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Select all courses you want the generator to find combinations for.
                  </p>
                </>
              )}

              {guidedPhase === "auto_slots_faculty" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Auto Step 2 · Slots &amp; Faculty
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Slots &amp; Faculty
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Optionally pick preferred slot bundles (like A1 or B1 slots) or specific professors for your selected courses.
                  </p>
                </>
              )}

              {guidedPhase === "auto_timings" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Auto Step 3 · Day Timings
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Class Timings
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Set earliest start times and latest wrap-up hours using period-aligned chips.
                  </p>
                </>
              )}

              {guidedPhase === "auto_blocking" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 font-outfit">
                      Auto Step 4 · Day &amp; Slot Blocking
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Block Slots
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Rule out whole days, mornings, or tap individual periods directly on the vertical grid.
                  </p>
                </>
              )}

              {guidedPhase === "auto_half_days" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-outfit">
                      Auto Step 5 · Half-Days &amp; Limits
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Half-Days &amp; Limits
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Set target free half-days, search depth limits, and class distribution pacing style.
                  </p>
                </>
              )}

              {guidedPhase === "auto_social" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-outfit">
                      Auto Step 6 · Friends
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Peer Alignment
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Coordinate class timings and shared break slots with your friends.
                  </p>
                </>
              )}

              {guidedPhase === "auto_summary" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Wand2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Auto Step 7 · Summary
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Ready to Solve
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Review your constraints and launch the algorithmic backtracking generator.
                  </p>
                </>
              )}

              {guidedPhase === "auto_results" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-outfit">
                      Auto Step 8 · Results
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Recommendations
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Explore top-ranked conflict-free timetables, view semester faculty schedules, swap instructors, and apply to your schedule.
                  </p>
                </>
              )}

              {guidedPhase === "auto_timetable_view" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Auto Step 8 · Grid Counterpart
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Timetable Grid View
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Inspect this generated variant in full vertical timetable format and cycle through variants.
                  </p>
                </>
              )}

              {guidedPhase === "manual_timetable_view" && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Phase {getPillsList().indexOf("manual_timetable_view") + 1} of {getPillsList().length} · Timetable Browser
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      {(effectiveTimetables[browsingTimetableIndex] || activeTimetable)?.name || "Timetable"}
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Browse and cycle through all your saved timetables, review slot allocations, and inspect metrics directly inside the hero.
                  </p>
                </>
              )}

              {guidedPhase === "builder" && currentStep === 1 && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Phase {getPillsList().indexOf("builder_course") + 1} of {getPillsList().length} · Choose Course
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Choose Course for {activeTimetable.name}
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Browse the university catalogue or filter by your pre-locked courses for <strong className="text-white">{activeTimetable.name}</strong>.
                  </p>
                </>
              )}

              {guidedPhase === "builder" && currentStep === 2 && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                      Phase {getPillsList().indexOf("builder_slot") + 1} of {getPillsList().length} · Timings &amp; Profs
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      Pick Faculty &amp; Slot
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Choose your preferred instructor and slot timing for <strong className="text-white">{selectedCourseCode}</strong> into <strong className="text-white">{activeTimetable.name}</strong>.
                  </p>
                </>
              )}

              {guidedPhase === "builder" && currentStep === 3 && (
                <>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                    isReplacingSlot ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  }`}>
                    {isReplacingSlot ? <RotateCcw className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-wider font-outfit ${isReplacingSlot ? "text-amber-400" : "text-emerald-400"}`}>
                      Phase {getPillsList().indexOf("builder_review") + 1} of {getPillsList().length} · {isReplacingSlot ? "Replace Slot" : "Review & Place"}
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
                      {isReplacingSlot ? "Replace Slot" : "Review & Place"}
                    </h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    {isReplacingSlot ? (
                      <>This course is currently in <strong className="text-white">{activeTimetable.name}</strong>. Confirm to replace the existing slot.</>
                    ) : (
                      <>Confirm placement into <strong className="text-white">{activeTimetable.name}</strong> with community ratings and clash detection.</>
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 w-full">
              {renderBottomActions()}
            </div>
          </div>

          {/* Right Pane (~58%) */}
          <div className="w-[58%] flex-1 flex items-center justify-center h-full min-h-0 pl-2 lg:pl-6 overflow-hidden">
            {guidedPhase === "setup_mode" && renderSetupModeCard(true)}
            {guidedPhase === "setup_timetable" && renderSetupTimetableCard(true)}
            {guidedPhase === "setup_strategy" && renderSetupStrategyCard(true)}
            {guidedPhase === "setup_locks" && renderSetupLocksCard(true)}
            {guidedPhase === "auto_courses" && renderAutoCoursesCard(true)}
            {guidedPhase === "auto_slots_faculty" && renderAutoSlotsFacultyCard(true)}
            {guidedPhase === "auto_timings" && renderAutoTimingsCard(true)}
            {guidedPhase === "auto_blocking" && renderAutoBlockingCard(true)}
            {guidedPhase === "auto_half_days" && renderAutoHalfDaysCard(true)}
            {guidedPhase === "auto_social" && renderAutoSocialCard(true)}
            {guidedPhase === "auto_summary" && renderAutoSummaryCard(true)}
            {guidedPhase === "auto_results" && renderAutoResultsCard(true)}
            {guidedPhase === "auto_timetable_view" && renderAutoTimetableViewCard(true)}
            {guidedPhase === "manual_timetable_view" && renderManualTimetableViewCard(true)}
            {guidedPhase === "builder" && currentStep === 1 && renderCourseListCard(true)}
            {guidedPhase === "builder" && currentStep === 2 && renderSlotOfferingsCard(true)}
            {guidedPhase === "builder" && currentStep === 3 && renderReviewCard(true)}
          </div>
        </div>
      ) : (
        /* Vertical Portrait Layout */
        <>
          <header className="relative z-20 w-full max-w-md sm:max-w-2xl mx-auto flex items-center justify-between shrink-0 pt-1">
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{guidedPhase === "setup_mode" ? "Timetable" : "Back"}</span>
            </button>

            <div className="flex items-center gap-2">
              {getPillsList().map((p, idx, arr) => {
                const stepNum = idx + 1;
                const currentPill = getCurrentStepPill();
                const currentIdx = arr.indexOf(currentPill as any);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePillClick(p)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      currentPill === p
                        ? "w-7 bg-indigo-500 shadow-xs shadow-indigo-500/50"
                        : currentIdx > idx
                        ? "w-2.5 bg-indigo-400/50 hover:bg-indigo-400"
                        : "w-2 bg-zinc-800"
                    }`}
                    title={`Step ${stepNum}`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {onSwitchToSinglePageView && (
                <button
                  type="button"
                  onClick={onSwitchToSinglePageView}
                  className="h-8 px-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
                  title="Switch to Single Page View"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                  <span>Single Page View (Plan)</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleFullScreen}
                className="w-8 h-8 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title={fullScreenMode ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {fullScreenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </header>

          <main className="relative z-20 w-full max-w-md sm:max-w-2xl mx-auto flex-1 flex flex-col justify-center min-h-0 my-auto py-2 sm:py-3">
            {guidedPhase === "setup_mode" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Choose Creation Mode</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Choose between automated algorithmic generation or building your timetable step-by-step.
                  </p>
                </div>
                {renderSetupModeCard(false)}
              </div>
            )}

            {guidedPhase === "setup_timetable" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Select Target Timetable</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Pick which timetable you want to edit and save courses into.
                  </p>
                </div>
                {renderSetupTimetableCard(false)}
              </div>
            )}

            {guidedPhase === "setup_strategy" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Course Strategy</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Choose whether to lock mandatory target courses in advance or pick courses dynamically.
                  </p>
                </div>
                {renderSetupStrategyCard(false)}
              </div>
            )}

            {guidedPhase === "setup_locks" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Lock Target Courses</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Pre-select mandatory courses and slot filters directly in this view.
                  </p>
                </div>
                {renderSetupLocksCard(false)}
              </div>
            )}

            {guidedPhase === "auto_courses" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Select Target Courses</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Pick the courses you want to take this semester.
                  </p>
                </div>
                {renderAutoCoursesCard(false)}
              </div>
            )}

            {guidedPhase === "auto_slots_faculty" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Slots &amp; Faculty Options</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Customize slot timings and faculty preferences for your selected courses.
                  </p>
                </div>
                {renderAutoSlotsFacultyCard(false)}
              </div>
            )}

            {guidedPhase === "auto_timings" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Day Timings</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Set earliest class starts and latest wrap-up hours.
                  </p>
                </div>
                {renderAutoTimingsCard(false)}
              </div>
            )}

            {guidedPhase === "auto_blocking" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Day &amp; Slot Blocking</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Rule out days or tap slots in the vertical timetable to block them.
                  </p>
                </div>
                {renderAutoBlockingCard(false)}
              </div>
            )}

            {guidedPhase === "auto_half_days" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Half-Days &amp; Limits</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Set free half-days goals, generation limits, and pacing rules.
                  </p>
                </div>
                {renderAutoHalfDaysCard(false)}
              </div>
            )}

            {guidedPhase === "auto_social" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Users className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Friends &amp; Peer Sync</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Sync class hours and shared break slots with your peers.
                  </p>
                </div>
                {renderAutoSocialCard(false)}
              </div>
            )}

            {guidedPhase === "auto_summary" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Wand2 className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Generation Blueprint</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Review your parameters and launch the timetable solver.
                  </p>
                </div>
                {renderAutoSummaryCard(false)}
              </div>
            )}

            {guidedPhase === "auto_results" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Award className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Recommended Timetables</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Inspect recommended variants, view faculty schedules, and apply to your schedule.
                  </p>
                </div>
                {renderAutoResultsCard(false)}
              </div>
            )}

            {guidedPhase === "auto_timetable_view" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Timetable Grid View</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Inspect this generated timetable variant in full vertical timetable layout.
                  </p>
                </div>
                {renderAutoTimetableViewCard(false)}
              </div>
            )}

            {guidedPhase === "builder" && currentStep === 1 && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Choose a Course</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Search the master course catalogue or browse by discipline.
                  </p>
                </div>
                {renderCourseListCard(false)}
              </div>
            )}

            {guidedPhase === "builder" && currentStep === 2 && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Users className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">Pick Faculty &amp; Slot</h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Choose your preferred instructor and timing for {selectedCourseCode}.
                  </p>
                </div>
                {renderSlotOfferingsCard(false)}
              </div>
            )}

            {guidedPhase === "builder" && currentStep === 3 && selectedOffering && selectedCourseMeta && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                    isReplacingSlot ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                  }`}>
                    {isReplacingSlot ? <RotateCcw className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                    {isReplacingSlot ? "Replace Course Slot" : "Review & Place"}
                  </h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    {isReplacingSlot ? (
                      <>This course is currently in <strong className="text-white">{activeTimetable.name}</strong>. Confirm to replace the existing slot.</>
                    ) : (
                      <>Confirm placement into <strong className="text-white">{activeTimetable.name}</strong>.</>
                    )}
                  </p>
                </div>
                {renderReviewCard(false)}
              </div>
            )}

            {guidedPhase === "manual_timetable_view" && (
              <div className="w-full flex-1 flex flex-col justify-center space-y-3 sm:space-y-4 text-center min-h-0 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
                    Phase {getPillsList().indexOf("manual_timetable_view") + 1} of {getPillsList().length} · Timetable Browser
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                    {(effectiveTimetables[browsingTimetableIndex] || activeTimetable)?.name || "Timetable"}
                  </h1>
                  <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">
                    Browse and cycle through all your saved timetables, review slot allocations, and inspect metrics directly inside the hero.
                  </p>
                </div>
                {renderManualTimetableViewCard(false)}
              </div>
            )}
          </main>

          <footer className="relative z-20 w-full max-w-md sm:max-w-xl mx-auto flex flex-wrap items-center justify-center gap-2 shrink-0 pb-1 sm:pb-3">
            {renderBottomActions()}
          </footer>
        </>
      )}

      {/* Faculty Swap Sheet for Generated Variants */}
      {swapCourseRow && (
        <SlotFacultySwapSheet
          code={swapCourseRow.course.code}
          courseTitle={swapCourseRow.course.title}
          halves={[swapCourseRow.course]}
          masterCourses={masterCourses}
          allTimetableCourses={stagedTimetables[selectedVariantIndex]?.courses || []}
          blockedSlots={blockedSlots}
          onSwap={(courseId, offering) => {
            handleSwapVariantFaculty(swapCourseRow.course.id, offering);
            setSwapCourseRow(null);
          }}
          onClose={() => setSwapCourseRow(null)}
          backdropZIndex={490}
          panelZIndex={500}
        />
      )}
    </div>
  );
}
