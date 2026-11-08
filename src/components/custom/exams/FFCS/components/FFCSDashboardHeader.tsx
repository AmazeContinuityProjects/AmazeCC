"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  Check,
  Users,
  Upload,
  Lock,
  Wand2,
  ClipboardPaste,
  CalendarDays,
  ExternalLink,
  Search,
  PlusCircle,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  X,
  PanelsTopLeft,
  ListFilter,
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
import type { AddedCourse, ParsedCourse, TimetableState, Friend, FriendGroup } from "@/lib/ffcsTypes";
import { periodsForSlot, findPeriodClash, splitSlots } from "@/lib/slots";
import { freeHalfDays } from "@/lib/timetableMetrics";
import { getTimetableSchema } from "@/lib/campusSchema";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyAvatar";
import ExportDossierWidget from "./ExportDossierWidget";
import { getFacultyReview, loadVitfacCatalog } from "@/lib/vitfacService";
import {
  BlockedSlotClash,
  ClashDetails,
  CourseClash,
  CourseOptionQuality,
  DashboardStat,
  MobileWidget,
  MobileWidgetSheet,
  UTILITY_TABS,
  WeeklyRhythmDetails,
  type UtilityTab,
} from "./FFCSDashboardDetails";

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
  /** Detailed text PDF with a per-course "Clashes With" column. */
  onDownloadClashReport?: () => void;
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

type DashboardWidget = UtilityTab | "add-courses";
type CourseMenuAction = "manual-add" | "target-courses" | "auto-generate" | "paste-vtop" | "advanced-linker";
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
    iconClass: "bg-accent-soft text-accent border-accent/20",
  },
  {
    value: "target-courses",
    label: "Target Courses",
    description: "Choose required courses and lock preferred slots.",
    Icon: Lock,
    iconClass: "bg-course-3/10 text-course-3 border-course-3/20",
    tourTarget: "ffcs-add-course",
  },
  {
    value: "auto-generate",
    label: "Auto-Generate",
    description: "Build timetable combinations from your course targets.",
    Icon: Wand2,
    iconClass: "bg-warn-soft text-warn border-warn/20",
    tourTarget: "ffcs-generate",
  },
  {
    value: "paste-vtop",
    label: "Paste VTOP",
    description: "Import courses from your VTOP registration page.",
    Icon: ClipboardPaste,
    iconClass: "bg-ok-soft text-ok border-ok/20",
  },
  {
    value: "advanced-linker",
    label: "Advanced Linker",
    description: "Manually pair theory and lab slots using a CSV.",
    Icon: SlidersHorizontal,
    iconClass: "bg-course-1/10 text-course-1 border-course-1/20",
  },
];

/** Shared with the Generator strip so both dashboards size tiles the same way. */
export const STAT_TILE_MIN_WIDTH = 280;
const STAT_TILE_GAP = 12;
const MAX_STAT_TILES = 4;

export function getFittingStatTileCount(width: number): number {
  if (width <= 0) return MAX_STAT_TILES;
  return Math.min(
    MAX_STAT_TILES,
    Math.max(1, Math.floor((width + STAT_TILE_GAP) / (STAT_TILE_MIN_WIDTH + STAT_TILE_GAP))),
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
  onDownloadClashReport,
  onOpenPrintablePage,
  onOpenDetachedPrintablePage,
  tourStepTarget = null,
  wideScreenSingleWidgetColumn = false,
}: FFCSDashboardHeaderProps) {
  const isModernLayout = currentLayoutLabel?.toLowerCase().startsWith("modern") ?? false;
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidget[]>(["add-courses", "timetables"]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileWidget, setMobileWidget] = useState<MobileWidget | null>(null);
  const [isWeeklyDetailsOpen, setIsWeeklyDetailsOpen] = useState(false);
  const [isClashDetailsOpen, setIsClashDetailsOpen] = useState(false);
  const [widgetPreferencesReady, setWidgetPreferencesReady] = useState(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [statTileCount, setStatTileCount] = useState(MAX_STAT_TILES);
  const [vitfacCatalogRevision, setVitfacCatalogRevision] = useState(0);

  useEffect(() => {
    if (!enableVitfacIntegration || !selectedCourseCode || availableSlots.length === 0) return;
    let active = true;
    void loadVitfacCatalog().finally(() => {
      if (active) setVitfacCatalogRevision((revision) => revision + 1);
    });
    return () => {
      active = false;
    };
  }, [availableSlots, enableVitfacIntegration, selectedCourseCode]);

  const recommendedSlotOptions = useMemo(() => {
    const schema = getTimetableSchema();
    return availableSlots
      .map((option, index) => {
        const optionSlots = splitSlots(option.SLOT).filter((slot) => slot !== "NIL");
        const optionPeriods = optionSlots.flatMap((slot) => periodsForSlot(schema, slot));
        const clashes = courses
          .filter((course) => {
            const coursePeriods = course.slots.flatMap((slot) => periodsForSlot(schema, slot));
            return findPeriodClash(optionPeriods, coursePeriods);
          })
          .map((course) => course.code);
        const blocked = optionSlots.some((slot) => blockedSlots?.has(slot)) ? ["Blocked slot"] : [];
        const review = enableVitfacIntegration
          ? getFacultyReview({ employeeId: option.ERP_ID, name: option.FACULTY })
          : null;
        return {
          option,
          index,
          clashes: [...new Set([...blocked, ...clashes])],
          rating: review && review.reviews > 0 ? review.wPct : null,
          reviews: review?.reviews ?? 0,
        };
      })
      .sort((a, b) => {
        const aConflictFree = a.clashes.length === 0;
        const bConflictFree = b.clashes.length === 0;
        if (aConflictFree !== bConflictFree) return aConflictFree ? -1 : 1;
        if ((a.rating !== null) !== (b.rating !== null)) return a.rating !== null ? -1 : 1;
        if (a.rating !== null && b.rating !== null && a.rating !== b.rating) return b.rating - a.rating;
        if (a.reviews !== b.reviews) return b.reviews - a.reviews;
        return a.option.FACULTY.localeCompare(b.option.FACULTY);
      });
  }, [availableSlots, blockedSlots, courses, enableVitfacIntegration, selectedCourseCode, vitfacCatalogRevision]);

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
      setMobileWidget((current) => (current === "selected-course" ? null : current));
    }
  }, [isMobileViewport, selectedCourseCode]);

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState(activeTimetable?.name || "");
  const restoreTimetablesInputRef = useRef<HTMLInputElement>(null);

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
    setEnabledWidgets((current) => (current.includes(tourWidget) ? current : [...current, tourWidget]));
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
              widget === "add-courses" || UTILITY_TABS.some((tab) => tab.value === widget),
          );
          setEnabledWidgets(validWidgets);
        } else {
          console.warn("Ignoring invalid FFCS dashboard widget preferences.");
        }
      }
    } catch (error) {
      console.error("Failed to load FFCS dashboard widget preferences:", error);
    } finally {
      setWidgetPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!widgetPreferencesReady) return;
    try {
      window.localStorage.setItem("ffcs_dashboard_widgets", JSON.stringify(enabledWidgets));
    } catch (error) {
      console.error("Failed to save FFCS dashboard widget preferences:", error);
    }
  }, [enabledWidgets, widgetPreferencesReady]);

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

  const statTiles = useMemo<DashboardStat[]>(
    () => [
      ...(courses.length > 0
        ? [
            {
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
              tone: totalCredits > 27 ? "red" : totalCredits >= 20 ? "emerald" : "indigo",
            },
          ]
        : []),
      ...(courses.length > 0 || timetables.length > 1
        ? [
            {
              id: "active-timetable",
              label: "Active Timetable",
              value: activeTimetable?.name || "Timetable 1",
              sub: `${courses.length} course${courses.length === 1 ? "" : "s"} enrolled`,
              badge: `${timetables.length} plan${timetables.length === 1 ? "" : "s"}`,
              tone: "blue",
              className: "transition-all hover:border-accent/40",
            },
          ]
        : []),
      ...(clashCount > 0
        ? [
            {
              id: "clash-status",
              label: "Clash Status",
              value: `${clashCount} Clash${clashCount > 1 ? "es" : ""}`,
              sub: "Slot collision detected",
              badge: "Alert",
              tone: "red",
            },
          ]
        : []),
      ...(courses.length > 0
        ? [
            {
              id: "weekly-rhythm",
              label: "Weekly Rhythm",
              value: `${freeHalfDaysCount} / 10`,
              sub: `${daysWithClassesCount} class days · free half-days`,
              tone: freeHalfDaysCount >= 4 ? "emerald" : "blue",
              className:
                "cursor-pointer hover:border-ok/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok/40",
            },
          ]
        : []),
    ],
    [
      activeTimetable?.name,
      courses.length,
      timetables.length,
      totalCredits,
      clashCount,
      daysWithClassesCount,
      freeHalfDaysCount,
    ],
  );
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
    [statTiles, onOpenTimetableModal],
  );
  const hasStatOverflow = statTiles.length > statTileCount;
  const directTileCount = hasStatOverflow ? Math.max(0, statTileCount - 1) : statTiles.length;
  const weeklyRhythmTile = statTiles.find((tile) => tile.id === "weekly-rhythm");
  const desktopDirectTiles = hasStatOverflow
    ? [
        ...(directTileCount > 0 && weeklyRhythmTile ? [weeklyRhythmTile] : []),
        ...statTiles
          .filter((tile) => tile.id !== "weekly-rhythm")
          .slice(0, directTileCount - (directTileCount > 0 && weeklyRhythmTile ? 1 : 0)),
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
  const statColumnCount = isMobileViewport ? 2 : Math.max(1, directTiles.length + (overflowSlides.length > 0 ? 1 : 0));
  const courseMenuActions: Record<CourseMenuAction, () => void> = {
    "manual-add": onOpenCourseSearch,
    "target-courses": onOpenCourseLocks,
    "auto-generate": onOpenGenerator,
    "paste-vtop": onOpenPasteRegistered,
    "advanced-linker": () => onOpenManualLinker?.(),
  };
  const toggleWidget = (widget: DashboardWidget) => {
    setEnabledWidgets((current) =>
      current.includes(widget) ? current.filter((item) => item !== widget) : [...current, widget],
    );
  };
  const openWidget = (widget: MobileWidget) => {
    if (isMobileViewport) {
      if (widget !== "selected-course") {
        setEnabledWidgets((current) => (current.includes(widget) ? current : [...current, widget]));
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
              className={tile.id === "weekly-rhythm" ? "" : (tile.className ?? "")}
            />
          );
          return tile.id === "weekly-rhythm" ? (
            <button
              key={tile.id}
              type="button"
              onClick={() => setIsWeeklyDetailsOpen(true)}
              aria-label={`Weekly Rhythm: ${freeHalfDaysCount} free half-days out of 10. View schedule details.`}
              className="min-w-0 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok/40"
            >
              {statTile}
            </button>
          ) : tile.id === "active-timetable" ? (
            <button
              key={tile.id}
              type="button"
              onClick={onOpenTimetableModal}
              aria-label={`Active Timetable: ${activeTimetable?.name || "Timetable 1"}. ${courses.length} course${courses.length === 1 ? "" : "s"} enrolled. Switch timetable.`}
              className="min-w-0 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {statTile}
            </button>
          ) : tile.id === "clash-status" ? (
            <button
              key={tile.id}
              type="button"
              onClick={() => setIsClashDetailsOpen(true)}
              aria-label={`Clash Status: ${clashCount === 0 ? "Conflict-Free" : `${clashCount} ${clashCount === 1 ? "clash" : "clashes"}`}. View clashing courses.`}
              className="min-w-0 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              {statTile}
            </button>
          ) : (
            <React.Fragment key={tile.id}>{statTile}</React.Fragment>
          );
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
        <h3
          id="ffcs-widgets-heading"
          className="px-1 text-[11px] font-semibold text-muted-foreground"
        >
          Dashboard Widgets
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)] gap-3 items-start">
          <nav aria-label="Planner menu" className="space-y-3">
            {isMobileViewport ? (
              <section aria-labelledby="ffcs-add-course-heading" className="space-y-2">
                <h3
                  id="ffcs-add-course-heading"
                  className="px-1 text-[11px] font-semibold text-muted-foreground"
                >
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
                      <span
                        className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${iconClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <ListRowText title={label} titleTag="span" subtitle={description} />
                      {value === "target-courses" && courseLocksCount > 0 && (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-course-3 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
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
                    enabledWidgets.includes("add-courses") ? "bg-accent-soft" : "hover:bg-surface-secondary/60"
                  }`}
                >
                  <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-accent border-line-2 bg-surface-2">
                    <PlusCircle className="w-4 h-4" />
                  </span>
                  <ListRowText title="Add Courses" titleTag="span" subtitle="Show or hide the course-add widget." />
                  {enabledWidgets.includes("add-courses") && <Check className="w-4 h-4 text-accent shrink-0" />}
                </button>
              </ListShell>
            )}

            <section aria-labelledby="ffcs-utility-heading" className="space-y-2">
              <h3
                id="ffcs-utility-heading"
                className="px-1 text-[11px] font-semibold text-muted-foreground"
              >
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
                      <span
                        className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${iconClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <ListRowText title={label} titleTag="span" subtitle={description} />
                      {isMobileViewport ? (
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${mobileWidget === value ? "rotate-180" : ""}`}
                        />
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
                  <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border-line-2 bg-surface-2">
                    <PlusCircle className="w-4 h-4" />
                  </span>
                  <ListRowText title="Configure Selected Course" titleTag="span" subtitle={selectedCourseCode} />
                  {isMobileViewport && (
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${mobileWidget === "selected-course" ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
              </ListShell>
            )}

            <section
              aria-labelledby="ffcs-view-course-heading"
              className={`space-y-2 ${isModernLayout ? "xl:hidden" : ""}`}
            >
              <h3
                id="ffcs-view-course-heading"
                className="px-1 text-[11px] font-semibold text-muted-foreground"
              >
                Views & Course Lists
              </h3>
              <ListShell>
                <button
                  type="button"
                  onClick={onOpenLayoutPicker}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border-line-2 bg-surface-2">
                    <PanelsTopLeft className="w-4 h-4" />
                  </span>
                  <ListRowText
                    title="Switch Planner View"
                    titleTag="span"
                    subtitle={currentLayoutLabel || "Choose Guided, Modern, or Classic."}
                  />
                </button>
                <button
                  type="button"
                  onClick={onOpenCourseListPicker}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-course-1 border-line-2 bg-surface-2">
                    <ListFilter className="w-4 h-4" />
                  </span>
                  <ListRowText
                    title="Switch Course List"
                    titleTag="span"
                    subtitle={currentCourseListLabel || "Choose the semester course report."}
                  />
                </button>
              </ListShell>
            </section>
            {onOpenPlannerSettings && (
              <section
                aria-labelledby="ffcs-settings-heading"
                className={`space-y-2 ${isModernLayout ? "xl:hidden" : ""}`}
              >
                <h3
                  id="ffcs-settings-heading"
                  className="px-1 text-[11px] font-semibold text-muted-foreground"
                >
                  Planner Settings
                </h3>
                <ListShell>
                  <button
                    type="button"
                    onClick={onOpenPlannerSettings}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-warn border-line-2 bg-surface-2">
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
                      <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border-line-2 bg-surface-2">
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
          <MobileWidgetSheet isMobile={isMobileViewport} widget={mobileWidget} onClose={() => setMobileWidget(null)}>
            <div
              id="ffcs-utility-panel"
              aria-label="Enabled planner widgets"
              className={`min-w-0 columns-1 gap-3 ${
                wideScreenSingleWidgetColumn ? "xl:columns-1" : "xl:columns-2"
              } [&>*]:mb-3 [&>*]:break-inside-avoid`}
            >
              {selectedCourseCode && (!isMobileViewport || mobileWidget === "selected-course") && (
                <section
                  aria-label="Configure Selected Course widget"
                  className="min-w-0 rounded-md border border-indigo-500/30 dark:border-indigo-500/40 card-surface p-4 sm:p-5 shadow-xs space-y-4 animate-fadeIn"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border-line-2 bg-surface-2">
                        <PlusCircle className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">
                          Configure Selected Course
                        </p>
                        <h3 className="text-sm font-semibold text-text-heading truncate">
                          {selectedCourseCode} · {selectedCourse?.title}
                        </h3>
                      </div>
                    </div>
                    {onClearSelectedCourse && (
                      <button
                        type="button"
                        onClick={onClearSelectedCourse}
                        className="p-2 rounded-md border border-border-strong text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
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
                            ...(!hasLab || hasTheory
                              ? [
                                  { value: "morning_theory", label: "Morn Theory" },
                                  { value: "evening_theory", label: "Eve Theory" },
                                ]
                              : []),
                            ...(!hasTheory || hasLab
                              ? [
                                  { value: "morning_lab", label: "Morn Lab" },
                                  { value: "evening_lab", label: "Eve Lab" },
                                ]
                              : []),
                          ]}
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold text-muted-foreground">
                        Slot & Faculty Choice
                      </span>
                      <button
                        type="button"
                        onClick={onOpenSlotSearch}
                        className="w-full min-h-[48px] bg-surface border border-border-strong hover:border-indigo-500/50 rounded-md px-3 py-2.5 text-left text-text-heading hover:bg-surface-secondary/50 transition-colors flex items-center justify-between gap-2 group"
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
                                {availableSlots[Number(selectedSlotIndex)].SLOT} —{" "}
                                {availableSlots[Number(selectedSlotIndex)].FACULTY}
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
                            <span className="text-muted-foreground">Click to choose slot & faculty option...</span>
                          )}
                        </span>
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 transition-colors shrink-0" />
                      </button>
                    </div>

                    {availableSlots.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Recommended faculty, slots & timetable fit
                          </span>
                          <span className="text-[11px] text-muted-foreground">{availableSlots.length} offerings</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Conflict-free options come first, with higher-rated faculty ranked ahead. Search to browse
                          every offering.
                        </p>
                        <div className="space-y-2">
                          {recommendedSlotOptions.slice(0, 5).map(({ option, index, clashes }) => {
                            return (
                              <CourseOptionQuality
                                key={`${option.ERP_ID ?? option.FACULTY}-${option.SLOT}-${index}`}
                                courseCode={selectedCourseCode}
                                slots={String(option.SLOT ?? "")}
                                faculty={String(option.FACULTY ?? "")}
                                employeeId={option.ERP_ID}
                                clashes={clashes}
                                selected={selectedSlotIndex === String(index)}
                                onSelect={() => setSelectedSlotIndex?.(String(index))}
                              />
                            );
                          })}
                        </div>
                        {availableSlots.length > 5 && (
                          <p className="text-[11px] text-muted-foreground">
                            Open the slot picker to compare all {availableSlots.length} options.
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                      className="w-full min-h-[44px] bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-medium py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  className="min-w-0 rounded-md border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-md border flex items-center justify-center shrink-0 text-accent border-line-2 bg-surface-2">
                      <PlusCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-text-heading">Add Courses</h3>
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
                        className="min-h-[68px] flex items-center gap-3 p-3 text-left rounded-md border border-border-strong/70 bg-surface hover:bg-surface-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <span
                          className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${iconClass}`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-text-heading">{label}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground mt-0.5">
                            {description}
                          </span>
                        </span>
                        {value === "target-courses" && courseLocksCount > 0 && (
                          <span className="min-w-5 h-5 px-1 rounded-full bg-course-3 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                            {courseLocksCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Timetable Actions */}
              {enabledWidgets.includes("timetables") && (!isMobileViewport || mobileWidget === "timetables") && (
                <section
                  aria-label="Timetable Actions widget"
                  className="min-w-0 space-y-4 rounded-md border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    {/* Timetable Selector Modal Trigger */}
                    <button
                      type="button"
                      onClick={onOpenTimetableModal}
                      className="flex-1 min-h-[44px] bg-surface border border-border-strong hover:border-indigo-500/50 rounded-md px-4 py-2.5 text-sm text-text-heading hover:bg-surface-secondary transition-all flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
                      title="Switch or manage saved timetables"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                        <span className="truncate font-semibold">{activeTimetable?.name || "Select Timetable"}</span>
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
                      className="min-h-[44px] bg-accent hover:bg-accent/90 text-background font-medium px-4 py-2 rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      title="Create a new blank timetable"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Plan</span>
                    </button>
                  </div>

                  {/* Active Plan Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
                    <button
                      type="button"
                      onClick={handleStartRename}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-text-heading bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-md transition-all font-semibold cursor-pointer shadow-2xs"
                      title="Rename current timetable"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Rename</span>
                    </button>

                    <button
                      type="button"
                      onClick={onDuplicateTimetable}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-text-heading bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-md transition-all font-semibold cursor-pointer shadow-2xs"
                      title="Duplicate current timetable"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTimetable(activeTimetable.id)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-danger hover:text-danger bg-danger-soft hover:bg-danger-soft border border-danger/20 rounded-md transition-all font-semibold cursor-pointer shadow-2xs"
                      title="Delete current timetable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>

                    <input
                      ref={restoreTimetablesInputRef}
                      type="file"
                      accept=".json"
                      onChange={onImportTimetablesJson}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => restoreTimetablesInputRef.current?.click()}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-text-heading bg-surface hover:bg-surface-secondary border border-border-strong/70 rounded-md transition-all font-semibold cursor-pointer shadow-2xs"
                      title="Restore timetables from backup JSON"
                    >
                      <Upload className="w-3.5 h-3.5 text-ok" />
                      <span>Restore JSON</span>
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
                        className="flex-1 min-h-[44px] bg-surface border border-indigo-500/50 rounded-md px-3 text-sm text-text-heading focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleConfirmRename}
                        className="min-h-[44px] px-3 bg-ok-soft hover:bg-ok-soft border border-ok/30 text-ok rounded-md flex items-center justify-center cursor-pointer transition-colors"
                        title="Confirm rename"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenaming(false)}
                        className="min-h-[44px] px-3 bg-surface hover:bg-surface-secondary border border-border-strong text-muted-foreground rounded-md flex items-center justify-center cursor-pointer transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Friends & Social */}
              {enabledWidgets.includes("social") && (!isMobileViewport || mobileWidget === "social") && (
                <section
                  aria-label="Social & Friends widget"
                  className="min-w-0 space-y-4 rounded-md border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-text-heading flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-course-7" />
                        <span>Social Overlap</span>
                      </label>
                      {isCalculatingSocialScore && (
                        <button
                          type="button"
                          onClick={onOpenSocialMatrix}
                          className="text-xs font-semibold text-course-7 bg-course-7/10 hover:bg-course-7/10 px-2.5 py-0.5 rounded-full border border-course-7/20 transition-colors cursor-pointer"
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
                          className="min-h-[38px] px-3 py-1.5 bg-course-7/10 hover:bg-course-7/10 text-course-7 border border-course-7/25 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Social Matrix</span>
                        </button>
                      )}

                      {onOpenFriendsManager && (
                        <button
                          type="button"
                          onClick={onOpenFriendsManager}
                          className="min-h-[38px] px-3 py-1.5 bg-surface hover:bg-surface-secondary border border-border-strong text-text-heading rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
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

                      {setSocialScoreGroupMethod && friendGroups.some((g) => g.id === socialTargetId) && (
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
              {enabledWidgets.includes("faculty") && (!isMobileViewport || mobileWidget === "faculty") && (
                <section
                  aria-label="Faculty & Reviews widget"
                  className="min-w-0 space-y-4 rounded-md border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-text-heading">Faculty Schedule Insights</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Look up entire weekly schedules of faculty members across campus.
                      </p>
                    </div>

                    {onOpenFacultySchedule && (
                      <button
                        type="button"
                        onClick={onOpenFacultySchedule}
                        className="min-h-[44px] px-4 py-2 bg-course-1/10 hover:bg-course-1/10 text-course-1 border border-course-1/25 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs shrink-0"
                        title="See the full week taught by any faculty member"
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>Faculty Schedules</span>
                        {facultyGroupsCount > 0 && (
                          <span className="text-[11px] font-semibold bg-course-1/10 px-1.5 py-0.5 rounded-md">
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
                        className="w-full bg-ok-soft hover:bg-ok-soft text-ok text-xs font-semibold py-2.5 px-3.5 rounded-md border border-ok/20 transition-all flex items-center justify-between gap-2 shadow-2xs group"
                        title="Leave or view reviews on vitfac.pages.dev"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-ok-soft text-ok flex items-center justify-center shrink-0 font-semibold text-xs">
                            ★
                          </span>
                          <span className="truncate">Reviewed your profs? Help others on vitfac.pages.dev</span>
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
              {enabledWidgets.includes("export") && (!isMobileViewport || mobileWidget === "export") && (
                <ExportDossierWidget
                  courseCount={courses.length}
                  isDownloading={isDownloading}
                  onDownloadHtmlDossier={onDownloadHtmlDossier}
                  onDownloadImage={onDownloadImage}
                  onDownloadClashReport={onDownloadClashReport}
                  onExportIcal={onExportIcal}
                  onExportTimetablesJson={onExportTimetablesJson}
                  onOpenPrintablePage={onOpenPrintablePage}
                  onOpenDetachedPrintablePage={onOpenDetachedPrintablePage}
                />
              )}
              {enabledWidgets.length === 0 && !isMobileViewport && (
                <div className="xl:col-span-2 min-h-40 rounded-md border border-dashed border-border-strong flex flex-col items-center justify-center text-center p-6">
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
            <WeeklyRhythmDetails courses={courses} onClose={() => setIsWeeklyDetailsOpen(false)} />
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
