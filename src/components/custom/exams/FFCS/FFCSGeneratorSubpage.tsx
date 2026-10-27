import React, { memo, useCallback, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { X, Wand2, Info, ChevronDown, ChevronUp, Check, Beaker, Play, Lock, Hash, ArrowRight, Search, AlertTriangle, ArrowLeft, Save, Users, Trash2, LayoutDashboard, Target, SlidersHorizontal, CalendarDays, Star, PanelsTopLeft } from 'lucide-react';
import { TimetableState, CourseLock, Friend, FriendGroup, ParsedCourse, AddedCourse } from './types';
import { getBatchColorClass } from '@/lib/utils';
import {
  dayOccupancy,
  sortTimetables,
  timetableMetrics,
  formatHours,
  type SortBy,
} from '@/lib/timetableMetrics';
import { periodsForSlot } from '@/lib/slots';
import { useOverlayBack } from '@/lib/overlayStack';
import { type GeneratorErrorCode } from './logic/generator';
import { useGenerationRun } from './hooks/useGenerationRun';
import { RANKING_MODES, type RankingMode } from '@/lib/ffcsRanking';
import { track } from '@/lib/analytics';
import type { FFCSSettings, RankingPriority } from '@/lib/ffcsSettings';
import SearchInput from "../../shared/SearchInput";
import { GLOBAL_CAMPUS, getTimetableSchema, calculatePairwiseSocialScore, safeStorage } from '../FFCSTimetableTab';
import { COLORS, DAYS } from './constants';
import { offeringId, offeringMatches } from './reports';
import { splitSlots, HARD_RESULT_LIMIT, sameSlotFacultyAlternatives, expandCourseHalves } from './logic/generate';
import { TimetableGrid, GapDetail } from './components/TimetableGrid';
import SlotFacultySwapSheet from './components/SlotFacultySwapSheet';
import {
  getFittingStatTileCount,
  STAT_TILE_MIN_WIDTH,
} from './components/FFCSDashboardHeader';
import { PageShell, RadioGroup, SelectField, SectionHeader, ListShell, ListRowText, StatTile, InsightCarousel, useCarousel, type InsightSlide } from "../../shared/primitives";
import { AnimatePresence } from 'framer-motion';
import BottomSheet from "../../shared/BottomSheet";
import { loadSessionPreferences, saveSessionPreferences } from "@/lib/ffcsGeneratorSessionPrefs";
import FacultyReviewSheet, { VitfacReviewPill, FacultyAvatar } from './components/FacultyReviewSheet';
import { TargetCourseLocker } from './components/TargetCourseLocker';
import FFCSGeneratorViewModeModal, {
  type GeneratorViewMode,
} from './components/modals/FFCSGeneratorViewModeModal';
import FFCSGeneratorRunSummaryModal from './components/modals/FFCSGeneratorRunSummaryModal';
import { loadVitfacRankingData } from "@/lib/vitfacService";
import type { FacultyRatingLookup } from "@/lib/ffcsFacultyRanking";
import { DAYS_OF_WEEK, timeToMinutes, type DayId } from "@/lib/slots";

const GENERATOR_SORT_OPTIONS = [
  {
    value: "balanced" as const,
    label: "Balanced (All Metrics)",
    description: "Best overall blend of gaps, free time, and friends.",
  },
  {
    value: "compactness" as const,
    label: "Max Compactness (Fewer Gaps)",
    description: "Minimizes dead waiting time between classes.",
  },
  {
    value: "halfdays" as const,
    label: "Max Free Half-Days",
    description: "Packs classes together to free whole mornings or afternoons.",
  },
  {
    value: "social" as const,
    label: "Max Social Score",
    description: "Maximizes overlapping class hours with friends.",
  },
  {
    value: "faculty" as const,
    label: "Highest Faculty Score",
    description: "Prioritizes reviewed faculty using their overall and metric scores.",
  },
] as const;

const GENERATOR_TIME_PREFERENCE_OPTIONS = [
  {
    value: "none" as const,
    label: "No Preference",
    description: "Accept any combination of morning or evening slots.",
  },
  {
    value: "morning" as const,
    label: "Morning Theory Preferred",
    description: "Use morning theory only by default; relax it below to allow evening offerings.",
  },
  {
    value: "evening" as const,
    label: "Evening Theory Preferred",
    description: "Use evening theory only by default; relax it below to allow morning offerings.",
  },
] as const;

const GENERATOR_RANKING_OPTIONS = [
  {
    value: "default" as const,
    label: "Sort Order Only (Off)",
    description: "No weighted profile — options are ordered purely by the sort order above.",
  },
  {
    value: "Best Faculty" as const,
    label: "Best Faculty",
    description: "Prioritizes the selected faculty's Vitfac review scores and ratings coverage.",
  },
  {
    value: "Balanced" as const,
    label: "Balanced",
    description: "Overall balance across gaps, early finishes, and daily workload.",
  },
  {
    value: "Half Days" as const,
    label: "Half Days",
    description: "Maximizes 4-hour compact days and whole mornings or afternoons off.",
  },
  {
    value: "Minimize Gaps" as const,
    label: "Minimize Gaps",
    description: "Minimizes dead waiting time between classes throughout the day.",
  },
  {
    value: "Early Finish" as const,
    label: "Early Finish",
    description: "Prioritizes classes that end earlier so your afternoons/evenings are free.",
  },
  {
    value: "Late Start" as const,
    label: "Late Start",
    description: "Prioritizes classes that start later in the morning.",
  },
] as const;

const RANKING_PRIORITY_LABELS: Record<RankingPriority, string> = {
  profile: "Ranking profile",
  faculty: "Faculty reviews",
  sort: "Selected sort order",
  time: "Time preference",
};

/**
 * How many option cards the review grid paints before it pauses for a
 * "Show more".
 *
 * The list state keeps every option the search found — the save bar and the
 * export read the whole thing — but the paint cannot: tens of thousands of
 * cards is what made an unlimited run freeze the page mid-search, and even a
 * settled one paints for seconds then drags. Sixty covers what a student
 * scans; `STAGED_RENDER_STEP` is what "Show more" adds per click, and the
 * stream's own batches are usually larger than one step, so an expanded view
 * does not grow a card per frame while the search is still running.
 */
const STAGED_RENDER_LIMIT = 60;
const STAGED_RENDER_STEP = 240;
type GeneratorSectionKey = "courses" | "ranking" | "schedule" | "constraints" | "social";

const DAY_LABELS: Record<DayId, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function buildSlotTimeOptions(
  boundaries: readonly { slot: string; time: string }[]
): { value: string; label: string }[] {
  const options = new Map<string, string>();
  boundaries.forEach(({ slot, time }) => {
    const minutes = timeToMinutes(time);
    if (minutes === null) return;
    const value = minutesToTimeValue(minutes);
    const existing = options.get(value);
    options.set(value, existing ? `${existing}, ${slot}` : `${time} · ${slot}`);
  });
  return [...options]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label }));
}

export interface FFCSGeneratorSubpageProps {
  onClose: () => void;
  /**
   * The planner's saved defaults. These seed this run's controls — the student
   * can still change any of them here; nothing is read back into settings.
   */
  settings: FFCSSettings;
  /**
   * The planner's locked Target Courses — read-only here. When any exist they
   * seed this run's picks, as copies; nothing on this screen writes back to
   * them. With none, the generator's picks are its own private state.
   */
  courseLocks: CourseLock[];
  friends: Friend[];
  socialScoreGroupMethod: 'cumulative' | 'intersection' | 'average' | 'min' | 'max' | string;
  friendGroups: FriendGroup[];
  masterCourses: ParsedCourse[];
  blockedSlots: Set<string>;
  timetables: TimetableState[];
  setTimetables: React.Dispatch<React.SetStateAction<TimetableState[]>>;
  setActiveTimetableId: (id: string) => void;
  error: string | null;
  setError: (msg: string | null) => void;
  successMsg: string | null;
  setSuccessMsg: (msg: string | null) => void;
  renderTypeChips: (types?: string | string[], size?: 'sm' | 'md' | 'default') => React.ReactNode;
  getGroupedCourses: (courseList: AddedCourse[]) => any[];
  generatorDisplayCourses: {code: string, title: string, types: string[]}[];
  theoryPeriods: any[];
  labPeriods: any[];
  toggleBlockSlot: (slot: string) => void;
}

export function FFCSGeneratorSubpage({
  onClose, settings, courseLocks, friends, socialScoreGroupMethod, friendGroups,
  masterCourses, blockedSlots, timetables, setTimetables, setActiveTimetableId,
  error, setError, successMsg, setSuccessMsg, renderTypeChips, getGroupedCourses, generatorDisplayCourses, theoryPeriods, labPeriods, toggleBlockSlot
}: FFCSGeneratorSubpageProps) {
  const sessionPrefs = useMemo(() => loadSessionPreferences(), []);
  const [generatorViewMode, setGeneratorViewMode] = useState<GeneratorViewMode>(() =>
    safeStorage.getItem("ffcs_generator_view_mode") === "classic" ? "classic" : "modern"
  );
  const [isViewModeModalOpen, setIsViewModeModalOpen] = useState(false);
  // Both "Generate" buttons open this confirmation sheet rather than starting
  // the search blind — it gathers the whole run profile onto one page.
  const [isRunSummaryOpen, setIsRunSummaryOpen] = useState(false);
  const [activeGeneratorSection, setActiveGeneratorSection] = useState<GeneratorSectionKey>("courses");

  const selectGeneratorViewMode = (mode: GeneratorViewMode, remember: boolean) => {
    setGeneratorViewMode(mode);
    if (remember) safeStorage.setItem("ffcs_generator_view_mode", mode);
  };

  const generatorViewLabel =
    generatorViewMode === "modern" ? "Modern dashboard" : "Classic full form";

  const [generatorPreference, setGeneratorPreference] = useState<"compact" | "spread" | "morning" | "evening">(
    () => sessionPrefs.preference ?? "compact"
  );
  const [strictTheoryPreference, setStrictTheoryPreference] = useState<boolean>(
    () => sessionPrefs.strictTheoryPreference ?? true
  );
  const [separateLabDays, setSeparateLabDays] = useState<boolean>(
    () => sessionPrefs.separateLabDays ?? false
  );
  const [avoidConsecutiveLabs, setAvoidConsecutiveLabs] = useState<boolean>(
    () => sessionPrefs.avoidConsecutiveLabs ?? false
  );
  const [lunchBreakSeparatesLabs, setLunchBreakSeparatesLabs] = useState<boolean>(
    () => sessionPrefs.lunchBreakSeparatesLabs ?? false
  );
  const [generatorUniqueFaculties, setGeneratorUniqueFaculties] = useState<boolean>(
    () => sessionPrefs.uniqueFaculties ?? false
  );
  const [generatorNoLimit, setGeneratorNoLimit] = useState<boolean>(
    () => sessionPrefs.noLimit ?? false
  );
  const [generatorResultCap, setGeneratorResultCap] = useState<number>(
    () => sessionPrefs.resultCap ?? settings.resultCap
  );
  // The generator now streams: `run` hands back batches while the search is
  // still going, and `cancel` stops a worker the old awaited promise could not
  // have interrupted.
  const generation = useGenerationRun();
  const { isGenerating } = generation;
  // Seeded from the planner's defaults on mount (the subpage remounts each
  // open, so "on mount" is "each time the student opens the generator"), and
  // edited here only — this run's controls never write back to settings.
  const [rankingMode, setRankingMode] = useState<RankingMode | null>(
    () => sessionPrefs.rankingMode !== undefined
      ? sessionPrefs.rankingMode
      : (settings.rankingMode === "none" ? null : settings.rankingMode)
  );
  const [rankingPriorityOrder, setRankingPriorityOrder] = useState<RankingPriority[]>(() => [
    ...(sessionPrefs.rankingPriorityOrder ?? settings.rankingPriorityOrder),
  ]);
  const [facultyMetricWeights, setFacultyMetricWeights] = useState<FFCSSettings["facultyMetricWeights"]>(
    () => ({ ...(sessionPrefs.facultyMetricWeights ?? settings.facultyMetricWeights) })
  );
  const [facultyScoreFilters, setFacultyScoreFilters] = useState<FFCSSettings["facultyScoreFilters"]>(
    () => ({ ...(sessionPrefs.facultyScoreFilters ?? settings.facultyScoreFilters) })
  );
  const [stagedTimetables, setStagedTimetables] = useState<TimetableState[]>([]);
  // The render window over `stagedTimetables`. State, not a derived slice
  // length: the student expands it ("Show more") and a fresh run folds it
  // back to the default, so the paint stays bounded without ever deciding
  // anything about the list itself — every option the search kept is still
  // in `stagedTimetables` for the save bar to scan.
  const [stagedVisibleCount, setStagedVisibleCount] = useState<number>(STAGED_RENDER_LIMIT);
  const [generatorMinHalfDays, setGeneratorMinHalfDays] = useState<number>(
    () => sessionPrefs.minHalfDays ?? settings.minHalfDays
  );
  const [generatorMinStartTime, setGeneratorMinStartTime] = useState<string>(
    () => sessionPrefs.minStartTime ?? "08:00"
  );
  const [generatorMaxEndTime, setGeneratorMaxEndTime] = useState<string>(
    () => sessionPrefs.maxEndTime ?? "19:30"
  );
  const [generatorMaxEndTimeByDay, setGeneratorMaxEndTimeByDay] = useState<
    Partial<Record<DayId, string>>
  >(() => ({ ...(sessionPrefs.maxEndTimeByDay ?? {}) }));
  const [generatorSortBy, setGeneratorSortBy] = useState<SortBy>(
    () => sessionPrefs.sortBy ?? settings.defaultSortBy
  );
  const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());
  const [selectedTimetablesToCompare, setSelectedTimetablesToCompare] = useState<string[]>([]);
  const [generatorPreviewTimetable, setGeneratorPreviewTimetable] = useState<TimetableState | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  // The Selected-Courses row whose Faculty cell was tapped — drives the
  // same-slot faculty swap sheet below.
  const [slotSwapRow, setSlotSwapRow] = useState<{ code: string; title: string; ids: string[] } | null>(null);
  const [reviewSheetTarget, setReviewSheetTarget] = useState<{ name: string; employeeId?: string; courseCode?: string } | null>(null);
  /*
    The generator's picks are its own, not the planner's course locks.

    They used to share one state: the step-1 checkbox wrote a CourseLock the
    moment it flipped, so a student who picked a few codes to generate with —
    having never locked a target in the planner — found the Target Courses
    button outside counting those codes and the modal listing them: locks
    they never made, persisted to storage all the same.

    The seed decides the relationship. When the plan already has locked
    targets, this run starts from copies of them and is read-only — no tick
    or tweak here writes back, which is what the Target Courses modal
    promises ("the auto-generator will filter results based on your target
    courses"). When there are none, the picks belong to the generator alone,
    remembered across opens under their own key so the selection memory the
    lock storage used to provide incidentally carries over without the leak.
  */
  const TARGETS_STORAGE_KEY = "ffcs_generator_targets";
  const seededFromLocks = courseLocks.length > 0;
  const [generatorTargets, setGeneratorTargets] = useState<CourseLock[]>(() => {
    if (seededFromLocks) return courseLocks.map((lock) => ({ ...lock }));
    if (sessionPrefs.targets && sessionPrefs.targets.length > 0) {
      return sessionPrefs.targets;
    }
    try {
      const stored = safeStorage.getItem(TARGETS_STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as CourseLock[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (seededFromLocks) return;
    safeStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(generatorTargets));
  }, [generatorTargets, seededFromLocks]);
  const [activeLockerCode, setActiveLockerCode] = useState<string | null>(null);
  // The desktop locker renders inline in the main column; the sheet is the
  // mobile-only fallback. BottomSheet portals to <body>, so a `lg:hidden`
  // wrapper cannot hide it — it must not be mounted on desktop at all.
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const updateViewport = () => setIsDesktopViewport(window.innerWidth >= 1024);
      updateViewport();
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }
    const media = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktopViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState<boolean>(
    () => sessionPrefs.syncFriendsClasses ?? sessionPrefs.syncFriendClasses ?? false
  );
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>(
    () => sessionPrefs.maximizeFreeTimeFriends ?? []
  );

  useEffect(() => {
    saveSessionPreferences({
      preference: generatorPreference,
      strictTheoryPreference,
      separateLabDays,
      avoidConsecutiveLabs,
      lunchBreakSeparatesLabs,
      uniqueFaculties: generatorUniqueFaculties,
      noLimit: generatorNoLimit,
      resultCap: generatorResultCap,
      rankingMode,
      rankingPriorityOrder,
      facultyMetricWeights,
      facultyScoreFilters,
      minHalfDays: generatorMinHalfDays,
      minStartTime: generatorMinStartTime,
      maxEndTime: generatorMaxEndTime,
      maxEndTimeByDay: generatorMaxEndTimeByDay,
      sortBy: generatorSortBy,
      syncFriendsClasses: generatorSyncFriendsClasses,
      syncFriendClasses: generatorSyncFriendsClasses,
      maximizeFreeTimeFriends: generatorMaximizeFreeTimeFriends,
      targets: generatorTargets,
      isReviewing,
    });
  }, [
    generatorPreference,
    strictTheoryPreference,
    separateLabDays,
    avoidConsecutiveLabs,
    lunchBreakSeparatesLabs,
    generatorUniqueFaculties,
    generatorNoLimit,
    generatorResultCap,
    rankingMode,
    rankingPriorityOrder,
    facultyMetricWeights,
    facultyScoreFilters,
    generatorMinHalfDays,
    generatorMinStartTime,
    generatorMaxEndTime,
    generatorMaxEndTimeByDay,
    generatorSortBy,
    generatorSyncFriendsClasses,
    generatorMaximizeFreeTimeFriends,
    generatorTargets,
    isReviewing,
  ]);

  const moveRankingPriority = (index: number, direction: -1 | 1) => {
    const next = [...rankingPriorityOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRankingPriorityOrder(next);
  };

  const updateFacultyWeight = (
    key: keyof FFCSSettings["facultyMetricWeights"],
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      setFacultyMetricWeights((previous) => ({
        ...previous,
        [key]: Math.max(0, Math.min(5, parsed)),
      }));
    }
  };

  const updateFacultyFilter = (
    key: keyof FFCSSettings["facultyScoreFilters"],
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const max = key === "minWPct" ? 100 : 5;
      setFacultyScoreFilters((previous) => ({
        ...previous,
        [key]: Math.max(0, Math.min(max, parsed)),
      }));
    }
  };

  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");
  // How the target-course list buckets its rows: flat, by how many faculties
  // offer the course (rank of choice), or by slot series split morning/evening.
  const [generatorCourseGroupBy, setGeneratorCourseGroupBy] = useState<"none" | "facultyRank" | "slot">("none");
  // Sort order applied to the (possibly grouped) target-course list.
  const [generatorCourseSortBy, setGeneratorCourseSortBy] = useState<"code" | "title" | "faculty" | "offerings">("code");
  const [isVariantSearchOpen, setIsVariantSearchOpen] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedDashDetails, setSelectedDashDetails] = useState<NonNullable<TimetableState['metrics']>['dashDetails'] | null>(null);
  const [selectedGapDetails, setSelectedGapDetails] = useState<GapDetail[] | null>(null);
  const courses: AddedCourse[] = []; // Fallback empty active courses for the Compare Modal grid, as it previews staged.

  // System back pops this screen instead of leaving it behind, the same job the
  // overlay stack did while this was a bottom sheet. `open` is unconditionally
  // true: the component only mounts while the subpage is on show, and the
  // nested sheets (dash, gap, variant) push their own entries on top, so a back
  // gesture still dismisses them first.
  const handleBack = () => {
    if (reviewSheetTarget) {
      setReviewSheetTarget(null);
      return;
    }
    if (slotSwapRow) {
      setSlotSwapRow(null);
      return;
    }
    if (generatorPreviewTimetable) {
      setGeneratorPreviewTimetable(null);
      return;
    }
    if (isCompareModalOpen) {
      setIsCompareModalOpen(false);
      return;
    }
    if (isReviewing && stagedTimetables.length > 0) {
      setIsReviewing(false);
      return;
    }
    onClose();
  };

  useOverlayBack("ffcs-auto-generator", true, handleBack);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // The one lookup, shared with the tab. The old local version was a fifth copy
  // of the same walk over the schema, and `isMorningSlot`, `isEveningSlot` and
  // `parse24HourToMinutes` were copies of copies of things — all three moved
  // into `logic/generate.ts` with the solve that needed them, and are no longer
  // referenced here.
  const getPeriodsForSlot = useCallback(
    (slot: string) => periodsForSlot({ theory: theoryPeriods, lab: labPeriods }, slot),
    [theoryPeriods, labPeriods]
  );

  const allAvailableSlots = React.useMemo(() => {
    const slots = new Set<string>();
    theoryPeriods.forEach(p => {
      Object.values(p.days || {}).forEach(s => {
        if (s) slots.add(s as string);
      });
    });
    labPeriods.forEach(p => {
      Object.values(p.days || {}).forEach(s => {
        if (s) slots.add(s as string);
      });
    });
    return Array.from(slots).sort((a, b) => {
      const isALab = a.startsWith('L');
      const isBLab = b.startsWith('L');
      if (isALab && !isBLab) return 1;
      if (!isALab && isBLab) return -1;
      const aMatch = a.match(/^([A-Z]+)(\d+)?/);
      const bMatch = b.match(/^([A-Z]+)(\d+)?/);
      if (aMatch && bMatch) {
        if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1]);
        if (aMatch[2] && bMatch[2]) return parseInt(aMatch[2]) - parseInt(bMatch[2]);
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [theoryPeriods, labPeriods]);
  const slotStartOptions = React.useMemo(
    () =>
      buildSlotTimeOptions(
        allAvailableSlots.flatMap((slot) =>
          getPeriodsForSlot(slot).map((period) => ({ slot, time: period.start }))
        )
      ),
    [allAvailableSlots, getPeriodsForSlot]
  );
  const slotEndOptions = React.useMemo(
    () =>
      buildSlotTimeOptions(
        allAvailableSlots.flatMap((slot) =>
          getPeriodsForSlot(slot).map((period) => ({ slot, time: period.end }))
        )
      ),
    [allAvailableSlots, getPeriodsForSlot]
  );
  const slotEndOptionsByDay = React.useMemo(() => {
    const boundaries: Record<DayId, { slot: string; time: string }[]> = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
    };
    allAvailableSlots.forEach((slot) => {
      getPeriodsForSlot(slot).forEach((period) => {
        boundaries[period.day].push({ slot, time: period.end });
      });
    });
    return Object.fromEntries(
      DAYS_OF_WEEK.map((day) => [day, buildSlotTimeOptions(boundaries[day])])
    ) as Record<DayId, { value: string; label: string }[]>;
  }, [allAvailableSlots, getPeriodsForSlot]);
  const uniqueCourseCodes = Array.from(new Set(masterCourses.map(c => c.CODE)));

  /**
   * The target-course list, bucketed by the chosen grouping.
   *
   * - `none` — one flat bucket, the original list.
   * - `facultyRank` — one bucket per number of distinct faculties offering the
   *   course ("3 faculties", "1 faculty"), richest choice first; within a
   *   bucket courses sort by their earliest slot, then by code.
   * - `slot` — buckets per (half-day, series): a course lands in every group
   *   one of its offerings touches, since it can span both a morning A and an
   *   evening C. Morning groups come first, then series A→G. A trailing `1`
   *   on the first slot is a morning period and a `2` an evening one (law
   *   slots carry no digit and count as morning).
   */
  const generatorCourseGroups = useMemo(() => {
    const query = generatorCourseSearchQuery.trim().toLowerCase();
    const filtered = generatorDisplayCourses.filter(
      c =>
        c.code.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query)
    );

    const offeringsFor = (code: string) => masterCourses.filter(mc => mc.CODE === code);
    const facultyCountFor = (code: string) =>
      new Set(offeringsFor(code).map(o => o.FACULTY)).size;

    // Sort order shared by every grouping; falls back to code for ties.
    const compareCourses = (
      a: (typeof filtered)[number],
      b: (typeof filtered)[number]
    ): number => {
      switch (generatorCourseSortBy) {
        case "title":
          return a.title.localeCompare(b.title) || a.code.localeCompare(b.code);
        case "faculty":
          return facultyCountFor(b.code) - facultyCountFor(a.code) ||
            a.code.localeCompare(b.code);
        case "offerings":
          return offeringsFor(b.code).length - offeringsFor(a.code).length ||
            a.code.localeCompare(b.code);
        default:
          return a.code.localeCompare(b.code);
      }
    };
    const sorted = [...filtered].sort(compareCourses);

    if (generatorCourseGroupBy === "none") {
      return [{ label: null, courses: sorted }];
    }

    if (generatorCourseGroupBy === "facultyRank") {
      const tiers = new Map<number, typeof filtered>();
      for (const c of sorted) {
        const facultyCount = facultyCountFor(c.code);
        const tier = tiers.get(facultyCount) ?? [];
        tier.push(c);
        tiers.set(facultyCount, tier);
      }
      return Array.from(tiers.entries())
        .sort(([a], [b]) => b - a)
        .map(([count, courses]) => ({
          label: `${count} ${count === 1 ? "faculty" : "faculties"}`,
          courses: [...courses].sort(compareCourses),
        }));
    }

    // Group by slot: (half, series) per distinct first-slot of each offering.
    const buckets = new Map<string, { half: 0 | 1; series: string; courses: typeof filtered }>();
    const ungrouped: typeof filtered = [];
    for (const c of sorted) {
      const groupsSeen = new Set<string>();
      const offerings = offeringsFor(c.code);
      for (const o of offerings) {
        const first = (o.SLOT || "").split("+")[0].trim().toUpperCase();
        const seriesMatch = first.match(/^[T]?([A-G])/);
        if (!seriesMatch) continue;
        const series = seriesMatch[1];
        const half: 0 | 1 = first.endsWith("2") ? 1 : 0;
        const key = `${half}-${series}`;
        groupsSeen.add(key);
        const bucket = buckets.get(key) ?? { half, series, courses: [] };
        bucket.courses.push(c);
        buckets.set(key, bucket);
      }
      if (groupsSeen.size === 0) ungrouped.push(c);
    }

    const grouped = Array.from(buckets.values())
      .sort((a, b) => a.half - b.half || a.series.localeCompare(b.series))
      .map(b => ({
        label: `${b.half === 0 ? "Morning" : "Evening"} · ${b.series} series`,
        courses: [...b.courses].sort(compareCourses),
      }));
    if (ungrouped.length > 0) grouped.push({ label: "Other slots", courses: ungrouped });
    return grouped;
  }, [
    generatorCourseSearchQuery,
    generatorCourseGroupBy,
    generatorCourseSortBy,
    generatorDisplayCourses,
    masterCourses,
  ]);


  /**
   * The four ways the generator can come back empty-handed, in the words of
   * the screen that shows them.
   *
   * The solver returns a code and not a message, so the wording stays here
   * with the UI that owns it.
   */
  const errorFor = (code: GeneratorErrorCode, subjectCode?: string): string => {
    switch (code) {
      case "no_courses_selected":
        return "Please select at least one course.";
      case "no_valid_slots":
        return `No valid slots found for ${subjectCode} with current preferences and blocked slots.`;
      case "no_conflict_free":
        return "Could not generate any conflict-free timetables from the selected options.";
      case "below_min_half_days":
        return `No timetables met the minimum half-days requirement (${generatorMinHalfDays}). Try lowering it.`;
      case "below_min_faculty_scores":
        return "No timetables met the minimum faculty review scores. Lower the score filters here or in Planner Settings.";
      case "no_separate_labs":
        return "No timetables met the one-lab-class-per-day rule. Try turning it off or relaxing other constraints.";
      case "no_consecutive_labs":
        return "No timetables met the consecutive-lab rule. Try allowing consecutive slots or treating lunch as a break.";
      default:
        return "An error occurred while generating timetables.";
    }
  };

  const generateTimetables = async () => {
    setStagedTimetables([]);
    setSelectedStagedIds(new Set());
    setSelectedTimetablesToCompare([]);
    // A new run paints from the default window again: yesterday's "show be
    // everything" click has no claim on a run whose options have not been
    // found yet, and the bounded paint is the point of the feature.
    setStagedVisibleCount(STAGED_RENDER_LIMIT);
    track("generation_started", { courses: generatorTargets.length, ranking: rankingMode ?? "none" });
    const startedAt = performance.now();
    let facultyRatings: FacultyRatingLookup = {};
    let facultyRatingsAvailable = false;
    try {
      const facultyData = await loadVitfacRankingData(masterCourses);
      facultyRatings = facultyData.ratings;
      facultyRatingsAvailable = facultyData.available;
    } catch (err) {
      console.warn("Faculty reviews could not be loaded for timetable ranking:", err);
    }

    // Off the main thread where the browser will let us, and reported back as
    // it goes. Each batch gets a number as it lands so the list reads as a
    // ranking while it is still being discovered; the settled result renumbers
    // them once variants have been grouped, which is the answer that counts.
    let shown = 0;
    const outcome = await generation.run(
      {
        schema: getTimetableSchema(),
        masterCourses,
        courseLocks: generatorTargets,
        blockedSlots: [...blockedSlots],
        friends,
        preference: generatorPreference,
        strictTheoryPreference,
        separateLabDays,
        avoidConsecutiveLabs,
        lunchBreakSeparatesLabs,
        syncFriendClasses: generatorSyncFriendsClasses,
        maximizeFreeTimeFriends: generatorMaximizeFreeTimeFriends,
        minStartTime: generatorMinStartTime,
        maxEndTime: generatorMaxEndTime,
        maxEndTimeByDay: generatorMaxEndTimeByDay,
        uniqueFaculties: generatorUniqueFaculties,
        noLimit: generatorNoLimit,
        removeHardResultLimit: settings.removeHardResultLimit,
        // The settings cap only binds while the per-run switch leaves the
        // search bounded — the switch is the more recent thing chosen.
        resultCap: generatorResultCap,
        minHalfDays: generatorMinHalfDays,
        sortBy: generatorSortBy,
        facultyRatings,
        facultyRatingsAvailable,
        facultyMetricWeights,
        facultyScoreFilters,
        rankingPriorityOrder,
        // Only sent when one is picked: with no profile the solver does no
        // extra work and ranks exactly as it did before the profiles existed.
        ...(rankingMode ? { rankingMode } : {}),
      },
      (batch) => {
        const labelled = batch.map((tt, i) => ({ ...tt, name: `Option ${shown + i + 1}` }));
        shown += batch.length;
        setStagedTimetables((prev) => [...prev, ...labelled]);
        setIsReviewing(true);
      }
    );

    const settle = (found: number, capped: boolean) =>
      track("generation_done", {
        found,
        capped,
        ms: Math.round(performance.now() - startedAt),
      });

    if (outcome.kind === "error") {
      settle(0, false);
      setIsReviewing(false);
      setError(errorFor(outcome.code, outcome.subjectCode));
      return;
    }

    if (outcome.kind === "cancelled") {
      settle(outcome.timetables.length, true);
      // Partial results are kept rather than thrown away — a stop that shows
      // nothing is worse than a stop that shows what it managed to find.
      const partial = outcome.timetables.map((tt, i) => ({ ...tt, name: `Option ${i + 1}` }));
      setStagedTimetables(partial);
      if (partial.length) {
        setIsReviewing(true);
        setSuccessMsg(
          `Stopped early. ${partial.length} option${partial.length === 1 ? "" : "s"} had been found before the search ended.`
        );
      } else {
        setSuccessMsg("Generation stopped before anything was found.");
      }
      return;
    }

    const timetables = outcome.timetables;
    settle(timetables.length, outcome.capped);
    setStagedTimetables(timetables);
    setIsReviewing(true);
    const variantCount = timetables.reduce(
      (n, t) => n + (t.variants?.length ?? 1),
      0
    );
    setSuccessMsg(
      `Found ${timetables.length} unique timetables (${variantCount} total variants). Review them below!` +
        // Worth saying out loud: the cap is a real limit, and a student who
        // reads "50 found" as "there are 50" would be wrong. The two caps get
        // different words: the settings one can truly be widened by the
        // switch, while the switch's own ceiling cannot be widened by itself.
        (outcome.capped
          ? generatorNoLimit
            ? ` The "unlimited" search stopped at its ${HARD_RESULT_LIMIT.toLocaleString()}-result ceiling — filters like the time window or a half-days floor will narrow what exists.`
            : " More may exist — try allowing unlimited results."
          : "")
    );
    // We do NOT close generator immediately so they can review.
  };

  /**
   * Hand one preview course to a different faculty at the exact same slots.
   *
   * Same tokens means same periods, so the week's layout — and with it every
   * metric on the preview, gaps through social scores — is untouched; only the
   * teacher changes. Colors and ids stay put: the id keeps the row and the
   * grid keys stable, the color keeps the swap invisible to everything that
   * keyed off the original assignment. The swap is written back into the
   * staged option the preview came from, too, so returning to the list shows
   * the same teacher. A preview built from a variant is copied, so the staged
   * update no-ops there by id.
   */
  const swapSlotFaculty = (courseId: string, offering: ParsedCourse) => {
    if (!generatorPreviewTimetable) return;
    const isTheory = courseId.endsWith(":theory");
    const isLab = courseId.endsWith(":lab");
    const baseId = isTheory
      ? courseId.slice(0, -":theory".length)
      : isLab
      ? courseId.slice(0, -":lab".length)
      : courseId;

    const targetIds = (isTheory || isLab)
      ? [baseId]
      : (slotSwapRow?.ids ?? [baseId]);

    const offSlots = splitSlots(offering.SLOT);
    const theorySlots = offSlots.filter((s) => !s.startsWith("L"));
    const labSlots = offSlots.filter((s) => s.startsWith("L"));
    const roomParts = (offering.ROOM || "").split(/\s*\/\s*/);
    const facParts = (offering.FACULTY || "").split(/\s*\/\s*/);

    const updateCourse = (c: AddedCourse): AddedCourse => {
      if (!targetIds.includes(c.id)) return c;

      if (isTheory) {
        const facs = (c.faculty || "").split(/\s*\/\s*/);
        const venues = (c.venue || "").split(/\s*\/\s*/);
        const labFaculty = facs[1] || facs[0] || "";
        const labVenue = venues[1] || venues[0] || "";
        const newFaculty = labFaculty && labFaculty !== offering.FACULTY
          ? `${offering.FACULTY} / ${labFaculty}`
          : offering.FACULTY;
        const newVenue = labVenue && labVenue !== offering.ROOM
          ? `${offering.ROOM} / ${labVenue}`
          : offering.ROOM || c.venue;

        return {
          ...c,
          faculty: newFaculty,
          employeeId: offering.ERP_ID,
          classId: offering.CLASS_ID,
          venue: newVenue,
        };
      }

      if (isLab) {
        const facs = (c.faculty || "").split(/\s*\/\s*/);
        const venues = (c.venue || "").split(/\s*\/\s*/);
        const theoryFaculty = facs[0] || "";
        const theoryVenue = venues[0] || "";
        const newFaculty = theoryFaculty && theoryFaculty !== offering.FACULTY
          ? `${theoryFaculty} / ${offering.FACULTY}`
          : offering.FACULTY;
        const newVenue = theoryVenue && theoryVenue !== offering.ROOM
          ? `${theoryVenue} / ${offering.ROOM}`
          : offering.ROOM || c.venue;

        return {
          ...c,
          faculty: newFaculty,
          venue: newVenue,
        };
      }

      // Swapping whole course (drop-in or full alternative offering)
      const isPureTheoryHalf = c.slots.every((s) => !s.startsWith("L"));
      const isPureLabHalf = c.slots.every((s) => s.startsWith("L"));

      if (isPureTheoryHalf && theorySlots.length > 0) {
        return {
          ...c,
          title: offering.TITLE || c.title,
          faculty: facParts[0]?.trim() || offering.FACULTY,
          employeeId: offering.ERP_ID,
          classId: offering.CLASS_ID,
          venue: roomParts[0]?.trim() || offering.ROOM || c.venue,
          slots: theorySlots,
        };
      }

      if (isPureLabHalf && labSlots.length > 0) {
        return {
          ...c,
          title: offering.TITLE || c.title,
          faculty: (facParts[1] || facParts[0])?.trim() || offering.FACULTY,
          employeeId: facParts.length > 1 ? undefined : offering.ERP_ID,
          venue: (roomParts[1] || roomParts[0])?.trim() || offering.ROOM || c.venue,
          slots: labSlots,
        };
      }

      return {
        ...c,
        title: offering.TITLE || c.title,
        faculty: offering.FACULTY,
        employeeId: offering.ERP_ID,
        classId: offering.CLASS_ID,
        venue: offering.ROOM || (offering as any).VENUE || c.venue,
        slots: offSlots.length > 0 ? offSlots : c.slots,
      };
    };

    const swapped: TimetableState = {
      ...generatorPreviewTimetable,
      courses: generatorPreviewTimetable.courses.map(updateCourse),
    };
    setGeneratorPreviewTimetable(swapped);
    setStagedTimetables((prev) =>
      prev.some((t) => t.id === swapped.id)
        ? prev.map((t) => (t.id === swapped.id ? swapped : t))
        : prev
    );

    const sameSlots = offSlots.length > 0 && slotSwapRow?.ids && offSlots.every((s) => {
      const origSlots = generatorPreviewTimetable.courses
        .filter((c) => slotSwapRow.ids.includes(c.id))
        .flatMap((c) => c.slots);
      return origSlots.includes(s);
    });
    setSuccessMsg(
      sameSlots
        ? `${offering.CODE}: ${offering.FACULTY} now takes this slot — the week's times did not change.`
        : `${offering.CODE}: Swapped to ${offering.FACULTY} (${offering.SLOT}).`
    );
    setSlotSwapRow(null);
    track("slot_faculty_swap");
  };

  const saveSelectedTimetables = () => {
    const selected: TimetableState[] = [];
    stagedTimetables.forEach((t) => {
      if (t.variants && t.variants.length > 1) {
        t.variants.forEach((v) => {
          if (selectedStagedIds.has(v.id)) selected.push(v);
        });
      } else if (selectedStagedIds.has(t.id)) {
        selected.push(t);
      }
    });
    setTimetables((prev) => [...prev, ...selected]);
    track("timetable_saved", { source: "generator" });
    if (selected.length > 0) setActiveTimetableId(selected[0].id);
    setStagedTimetables([]);
    setSelectedStagedIds(new Set());
    setIsReviewing(false);
    onClose();
    setSuccessMsg(
      `Saved ${selected.length} timetable${selected.length === 1 ? "" : "s"} to the planner.`
    );
  };

  const generatorSections = [
    { id: "courses" as const, label: "Target courses", icon: Target, detail: `${generatorTargets.length} selected`, tone: "indigo" },
    { id: "ranking" as const, label: "Ranking & reviews", icon: Star, detail: rankingMode ? "Profile active" : "Sort and faculty", tone: "violet" },
    { id: "schedule" as const, label: "Schedule", icon: CalendarDays, detail: `${generatorPreference} · ${blockedSlots.size} blocked`, tone: "cyan" },
    { id: "constraints" as const, label: "Search limits", icon: SlidersHorizontal, detail: `${generatorNoLimit ? "No result cap" : generatorResultCap + " max"}`, tone: "amber" },
    { id: "social" as const, label: "Social matching", icon: Users, detail: `${generatorMaximizeFreeTimeFriends.length} friends selected`, tone: "pink" },
  ];
  const selectGeneratorSection = (section: GeneratorSectionKey) => setActiveGeneratorSection(section);
  const showGeneratorSection = (section: GeneratorSectionKey) =>
    generatorViewMode === "classic" || activeGeneratorSection === section;
  const activeSectionInfo = generatorSections.find((section) => section.id === activeGeneratorSection) ?? generatorSections[0];

  const setupStatTiles = useMemo<GeneratorStatTile[]>(
    () => [
      {
        id: "target-courses",
        label: "Target courses",
        value: generatorTargets.length,
        sub: generatorTargets.length === 1 ? "course selected" : "courses selected",
        tone: "indigo",
        icon: <Target className="h-4 w-4 text-indigo-500" />,
        onClick: () => setActiveGeneratorSection("courses"),
        ariaLabel: `Target courses: ${generatorTargets.length}. Edit target courses.`,
        focusRingClass: "focus-visible:ring-indigo-500",
      },
      {
        id: "blocked-slots",
        label: "Blocked slots",
        value: blockedSlots.size,
        sub: "Excluded from results",
        tone: "amber",
        icon: <X className="h-4 w-4 text-amber-500" />,
        onClick: () => setActiveGeneratorSection("schedule"),
        ariaLabel: `Blocked slots: ${blockedSlots.size}. Edit schedule.`,
        focusRingClass: "focus-visible:ring-amber-500",
      },
      {
        id: "friend-matches",
        label: "Friend matches",
        value: generatorMaximizeFreeTimeFriends.length,
        sub: `${friends.length} friends available`,
        tone: "pink",
        icon: <Users className="h-4 w-4 text-pink-500" />,
        onClick: () => setActiveGeneratorSection("social"),
        ariaLabel: `Friend matches: ${generatorMaximizeFreeTimeFriends.length}. Edit social matching.`,
        focusRingClass: "focus-visible:ring-pink-500",
      },
      {
        id: "options-found",
        label: "Options found",
        value: stagedTimetables.length.toLocaleString(),
        sub: isGenerating ? "Search in progress" : "Conflict-free schedules",
        badge: isGenerating ? "Live" : undefined,
        tone: "cyan",
        icon: isGenerating ? undefined : <CalendarDays className="h-4 w-4 text-cyan-500" />,
        onClick:
          stagedTimetables.length > 0
            ? () => {
                setIsReviewing(true);
                setGeneratorPreviewTimetable(null);
              }
            : undefined,
        ariaLabel: `Options found: ${stagedTimetables.length}. ${
          stagedTimetables.length > 0 ? "View results." : "Conflict-free schedules."
        }`,
        focusRingClass: "focus-visible:ring-cyan-500",
      },
    ],
    [
      blockedSlots.size,
      friends.length,
      generatorMaximizeFreeTimeFriends.length,
      generatorTargets.length,
      isGenerating,
      stagedTimetables.length,
    ]
  );

  const previewStatTiles = useMemo<GeneratorStatTile[]>(() => {
    if (!generatorPreviewTimetable) return [];
    const dashes = generatorPreviewTimetable.metrics?.buildingDashes ?? 0;
    return [
      {
        id: "free-half-days",
        label: "Free Half-Days",
        value: generatorPreviewTimetable.metrics?.halfDays ?? 0,
        sub: "Weekly free mornings / afternoons",
        tone: (generatorPreviewTimetable.metrics?.halfDays ?? 0) >= 4 ? "emerald" : "blue",
      },
      {
        id: "total-gaps",
        label: "Total Gaps",
        value: `${formatHours(generatorPreviewTimetable.metrics?.gaps ?? 0)}h`,
        sub: "Dead time between classes",
        tone: "amber",
        onClick: () => setSelectedGapDetails(generatorPreviewTimetable.metrics?.gapDetails || null),
        ariaLabel: `Total Gaps: ${formatHours(generatorPreviewTimetable.metrics?.gaps ?? 0)} hours. View gap details.`,
        focusRingClass: "focus-visible:ring-amber-500",
        className: "cursor-pointer hover:border-amber-500/40",
      },
      {
        id: "block-dashes",
        label: "Block Dashes",
        value: dashes,
        sub: dashes > 0 ? "Building hops detected" : "No building hops",
        badge: dashes > 0 ? "Alert" : "Clear",
        tone: dashes > 0 ? "red" : "emerald",
        onClick:
          dashes > 0
            ? () => setSelectedDashDetails(generatorPreviewTimetable.metrics?.dashDetails || null)
            : undefined,
        ariaLabel: `Block Dashes: ${dashes}. ${dashes > 0 ? "View dash details." : "No building hops."}`,
        focusRingClass: "focus-visible:ring-red-500",
      },
      {
        id: "social-score",
        label: "Social Score",
        value: `${generatorPreviewTimetable.metrics?.socialScore ?? 0}%`,
        sub: "Overlap with selected friends",
        tone: "pink",
        onClick: () => alert("Social Matrix is available in the main tab"),
        ariaLabel: `Social Score: ${generatorPreviewTimetable.metrics?.socialScore ?? 0} percent.`,
        focusRingClass: "focus-visible:ring-pink-500",
        className: "cursor-pointer hover:border-pink-500/40",
      },
    ];
  }, [generatorPreviewTimetable]);

  const shellEyebrow = "FFCS · Auto-Generator";
  const shellTitle = generatorPreviewTimetable ? (
    <span className="inline-flex items-center gap-2.5 flex-wrap">
      <span>Preview: {generatorPreviewTimetable.name}</span>
      {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 && (
        <span className="text-xs bg-amber-500/10 text-amber-500 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-medium tracking-normal align-middle">
          {generatorPreviewTimetable.variants.length} Faculty Variants
        </span>
      )}
    </span>
  ) : isCompareModalOpen ? (
    "Compare Timetables"
  ) : isReviewing && stagedTimetables.length > 0 ? (
    "Review Timetables"
  ) : (
    "Advanced Timetable Generator"
  );

  const shellSubtitle = generatorPreviewTimetable
    ? generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1
      ? "These variants share the exact same physical time layout (same free time, same schedule), but use different combinations of faculties."
      : "Review this schedule before saving."
    : isCompareModalOpen
    ? "Side-by-side comparison of selected schedules"
    : isReviewing && stagedTimetables.length > 0
    ? `${stagedTimetables.length} conflict-free timetable${stagedTimetables.length === 1 ? "" : "s"} found`
    : "Rank, compare and save conflict-free weeks";

  const shellActions = generatorPreviewTimetable ? (
    <div className="flex items-center gap-2">
      {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 && (
        <button
          type="button"
          onClick={() => setIsVariantSearchOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-secondary hover:bg-surface-secondary/80 border border-border-strong text-text-heading font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-xs"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Change Variant</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setTimetables((prev) => [...prev, generatorPreviewTimetable]);
          track("timetable_saved", { source: "generator" });
          setActiveTimetableId(generatorPreviewTimetable.id);
          setStagedTimetables([]);
          setSelectedStagedIds(new Set());
          setGeneratorPreviewTimetable(null);
          setIsReviewing(false);
          onClose();
          setSuccessMsg(`Successfully saved and switched to ${generatorPreviewTimetable.name}`);
        }}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" /> Save & Use This
      </button>
    </div>
  ) : isCompareModalOpen ? (
    <button
      type="button"
      onClick={() => setIsCompareModalOpen(false)}
      className="flex items-center gap-1.5 px-3 py-2 bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> Back to Review
    </button>
  ) : isReviewing && stagedTimetables.length > 0 ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsReviewing(false)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-text-heading text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Options
      </button>
      <button
        type="button"
        onClick={() => {
          setStagedTimetables([]);
          setSelectedStagedIds(new Set());
          setIsReviewing(false);
        }}
        aria-label="Discard all generated timetables"
        title="Discard all"
        className="min-h-10 min-w-10 sm:min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold text-muted-foreground hover:text-red-500 rounded-xl transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        <span className="hidden sm:inline">Discard All</span>
      </button>
      <button
        type="button"
        disabled={selectedStagedIds.size === 0}
        onClick={saveSelectedTimetables}
        aria-label={`Save ${selectedStagedIds.size} selected timetables`}
        title={`Save selected (${selectedStagedIds.size})`}
        className="min-h-10 min-w-10 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span className="hidden sm:inline">Save Selected ({selectedStagedIds.size})</span>
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {stagedTimetables.length > 0 && (
        <button
          type="button"
          onClick={() => setIsReviewing(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-bold transition-all cursor-pointer"
        >
          Results ({stagedTimetables.length})
        </button>
      )}
      {isGenerating && (
        <button
          type="button"
          onClick={generation.cancel}
          className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs sm:text-sm font-bold py-2 px-3 rounded-xl border border-red-500/20 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Stop
        </button>
      )}
      <button
        type="button"
        onClick={generateTimetables}
        disabled={isGenerating || generatorTargets.length === 0}
        className={`flex min-h-11 items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold py-2 px-4 rounded-xl transition-all cursor-pointer ${generatorViewMode === "modern" ? "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-95 font-outfit" : "bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-amber-500/25"}`}
      >
        {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
        <span>{isGenerating ? "Generating…" : "Generate Timetables"}</span>
      </button>
    </div>
  );

  return (
    <>
      <PageShell
        selectable
        wrap
        layout="actions-above"
        eyebrow={shellEyebrow}
        title={shellTitle}
        subtitle={shellSubtitle}
        actions={shellActions}
        onBack={handleBack}
        className="!max-w-none px-4 sm:px-6"
      >
        <div className="space-y-4">
          {isGenerating && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium" aria-live="polite">
              <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
              <span>
                {generation.progress
                  ? `${generation.progress.found} conflict-free weeks found, ${generation.progress.accepted} usable…`
                  : "Searching for conflict-free weeks…"}
              </span>
            </div>
          )}

          {(error || successMsg) && (
            <div className={`z-10 flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-red-500/20 bg-red-500/10 text-red-500" : "border-green-500/20 bg-green-500/10 text-green-500"}`}>
              <div className="flex items-center gap-2">
                {error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
                <span>{error || successMsg}</span>
              </div>
              {error && (
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {!error && successMsg && (
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="text-green-500 hover:text-green-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {generatorViewMode === "modern" && !generatorPreviewTimetable && (
            <ResponsiveStatStrip
              tiles={setupStatTiles}
              preferredId="options-found"
              ariaLabel="Generator statistics"
              carouselAriaLabel="More generator statistics"
              testId="ffcs-generator-stat-strip"
            />
          )}

          <div className="flex justify-center">
            {generatorPreviewTimetable ? (
              <>
              <div
                className={`relative w-full max-w-none flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
                  isReviewing && settings.showGeneratorOptionPane ? "lg:pl-[320px]" : ""
                }`}
              >
                {isReviewing && settings.showGeneratorOptionPane && (
                  <aside className="hidden lg:block absolute left-0 top-0 w-[296px]">
                    <div className="sticky top-4 overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-sm">
                      <div className="border-b border-border-strong px-4 py-3">
                        <h2 className="text-sm font-bold text-text-heading">Timetable options</h2>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Choose a shape to compare its weekly rhythm.
                        </p>
                      </div>
                      <div className="max-h-[calc(100vh-210px)] space-y-2 overflow-y-auto p-2 custom-scrollbar">
                        {stagedTimetables.slice(0, stagedVisibleCount).map((option) => {
                          const optionSchema = getTimetableSchema();
                          const optionMetrics = timetableMetrics(option.courses, optionSchema);
                          const occupancyByDay = DAYS_OF_WEEK.map((day) =>
                            dayOccupancy(option.courses, optionSchema, day)
                          );
                          const occupiedDays = occupancyByDay.flatMap((occupancy) => occupancy.classes);
                          const latestEnd = occupiedDays
                            .slice()
                            .sort((a, b) => b.endMin - a.endMin)[0]?.end;
                          const isCurrent = option.id === generatorPreviewTimetable.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-label={`${option.name}: ${optionMetrics.halfDays} free half-days, ${formatHours(optionMetrics.gaps)} hours of gaps${option.rankingScore === undefined ? "" : `, rank ${option.rankingScore.toFixed(1)}`}`}
                              aria-pressed={isCurrent}
                              onClick={() => {
                                setSelectedGapDetails(null);
                                setSelectedDashDetails(null);
                                setGeneratorPreviewTimetable(option);
                              }}
                              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                                isCurrent
                                  ? "border-indigo-500/60 bg-indigo-500/10"
                                  : "border-border-strong/60 bg-surface-secondary/20 hover:border-indigo-500/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-text-heading">{option.name}</span>
                                {option.rankingScore !== undefined && (
                                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                                    {option.rankingScore.toFixed(0)} pts
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                <span className="rounded-md bg-surface px-1.5 py-1 text-text-secondary">
                                  {optionMetrics.halfDays} free half-days
                                </span>
                                <span className="rounded-md bg-surface px-1.5 py-1 text-text-secondary">
                                  {formatHours(optionMetrics.gaps)}h gaps
                                </span>
                                <span className="rounded-md bg-surface px-1.5 py-1 text-text-secondary">
                                  {occupancyByDay.filter((occupancy) => occupancy.classes.length > 0).length}{" "}
                                  class days
                                </span>
                                {latestEnd && (
                                  <span className="rounded-md bg-surface px-1.5 py-1 text-text-secondary">
                                    ends {latestEnd}
                                  </span>
                                )}
                                {option.facultySummary?.averageWPct != null && (
                                  <span className="rounded-md bg-indigo-500/10 px-1.5 py-1 text-indigo-700 dark:text-indigo-300">
                                    {option.facultySummary.averageWPct.toFixed(0)}% W ·{" "}
                                    {option.facultySummary.ratedFacultyCount}/
                                    {option.facultySummary.totalFacultyCount} rated
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        {stagedTimetables.length > stagedVisibleCount && (
                          <button
                            type="button"
                            onClick={() =>
                              setStagedVisibleCount((count) => count + STAGED_RENDER_STEP)
                            }
                            className="w-full rounded-lg border border-border-strong/60 bg-surface-secondary/30 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-heading"
                          >
                            Show {Math.min(
                              STAGED_RENDER_STEP,
                              stagedTimetables.length - stagedVisibleCount
                            ).toLocaleString()} more options
                          </button>
                        )}
                      </div>
                    </div>
                  </aside>
                )}
                <ResponsiveStatStrip
                  tiles={previewStatTiles}
                  preferredId="free-half-days"
                  ariaLabel="Preview timetable statistics"
                  carouselAriaLabel="More preview timetable statistics"
                  testId="ffcs-generator-preview-stat-strip"
                />

                {generatorPreviewTimetable.rankingScore !== undefined && (
                  <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-text-heading">Why this timetable ranks here</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Combined score {generatorPreviewTimetable.rankingScore.toFixed(1)}/100.
                          Higher-priority criteria carry more weight; missing faculty reviews are
                          excluded from averages and reduce review coverage.
                        </p>
                      </div>
                      <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                        {generatorPreviewTimetable.facultySummary?.averageWPct == null
                          ? "No faculty reviews"
                          : `Avg ${generatorPreviewTimetable.facultySummary.averageWPct.toFixed(1)}% W`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(generatorPreviewTimetable.rankingBreakdown ?? {}).map(
                        ([key, points]) => (
                          <div
                            key={key}
                            className="rounded-xl bg-surface/80 border border-border-strong/60 px-3 py-2"
                          >
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                              {key === "profile"
                                ? rankingMode ?? "Profile"
                                : key === "sort"
                                  ? "Sort order"
                                  : key === "time"
                                    ? "Time preference"
                                    : "Faculty reviews"}
                            </span>
                            <span className="font-bold text-text-heading">{points.toFixed(1)} pts</span>
                          </div>
                        )
                      )}
                    </div>
                    {generatorPreviewTimetable.facultySummary && (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Faculty score:{" "}
                            <strong className="text-text-heading">
                              {generatorPreviewTimetable.facultySummary.facultyScore == null
                                ? "—"
                                : `${generatorPreviewTimetable.facultySummary.facultyScore.toFixed(1)}/100`}
                            </strong>
                          </span>
                          <span>
                            Reviewed:{" "}
                            <strong className="text-text-heading">
                              {generatorPreviewTimetable.facultySummary.ratedFacultyCount}/
                              {generatorPreviewTimetable.facultySummary.totalFacultyCount}
                            </strong>
                          </span>
                          <span>
                            Unrated:{" "}
                            <strong className="text-text-heading">
                              {generatorPreviewTimetable.facultySummary.unratedFacultyCount}
                            </strong>
                          </span>
                          {(
                            [
                              ["Lecture", generatorPreviewTimetable.facultySummary.averageLecture],
                              ["DA", generatorPreviewTimetable.facultySummary.averageDa],
                              ["Vibe", generatorPreviewTimetable.facultySummary.averageVibe],
                            ] as const
                          ).map(([label, score]) => (
                            <span key={label}>
                              {label}:{" "}
                              <strong className="text-text-heading">
                                {score == null ? "—" : `${score.toFixed(1)}/5`}
                              </strong>
                            </span>
                          ))}
                        </div>
                        <div className="divide-y divide-border-strong/40 rounded-xl border border-border-strong/50 bg-surface/50 px-3">
                          {generatorPreviewTimetable.facultySummary.courses.map((entry, index) => (
                            <div
                              key={`${entry.code}-${entry.faculty}-${index}`}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                            >
                              <span className="font-medium text-text-heading">
                                {entry.code} · {entry.faculty || "Faculty unstated"}
                              </span>
                              {entry.rating ? (
                                <span className="text-muted-foreground">
                                  {entry.rating.wPct == null ? "W —" : `${entry.rating.wPct}% W`}
                                  {" · "}L {entry.rating.lecture?.toFixed(1) ?? "—"}
                                  {" · "}DA {entry.rating.da?.toFixed(1) ?? "—"}
                                  {" · "}Vibe {entry.rating.vibe?.toFixed(1) ?? "—"}
                                  {" · "}{entry.rating.reviews} reviews
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">
                                  Unrated · no faculty score applied
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Priority: {rankingPriorityOrder.map((priority, index) => (
                        <React.Fragment key={priority}>
                          {index > 0 ? " → " : ""}
                          {priority === "profile"
                            ? "profile"
                            : priority === "faculty"
                              ? "faculty reviews"
                              : priority === "sort"
                                ? "sort order"
                                : "time"}
                        </React.Fragment>
                      ))}
                    </p>
                  </section>
                )}

                <div className="w-full flex flex-col gap-6 pb-20">
                  <TimetableGrid 
                    courses={courses} 
                    customCourses={generatorPreviewTimetable?.courses as AddedCourse[]}
                    fullSize={true}
                    blockedSlots={blockedSlots} 
                    toggleBlockSlot={toggleBlockSlot} 
                    selectedGapDetails={generatorPreviewTimetable?.metrics?.gapDetails || null} 
                    theoryPeriods={theoryPeriods}
                    labPeriods={labPeriods}
                  />

                  {generatorPreviewTimetable?.courses && generatorPreviewTimetable.courses.length > 0 && (
                    <div className="bg-transparent md:card-surface border-0 md:border md:border-border-strong rounded-none md:rounded-2xl shadow-none md:shadow-xs text-text-primary p-0 md:p-6 overflow-x-auto">
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 min-w-[600px]">
                        <h2 className="text-xl font-bold text-text-heading flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          Selected Courses
                          <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20 whitespace-nowrap font-normal">
                            Total Credits: {getGroupedCourses(generatorPreviewTimetable.courses).reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}
                          </span>
                        </h2>
                        {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsVariantSearchOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading border border-border-strong rounded-xl transition-colors cursor-pointer shadow-xs"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Change Variant ({generatorPreviewTimetable.variants.length})</span>
                          </button>
                        )}
                      </div>
                      
                      <div className="min-w-[600px]">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border-strong">
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {getGroupedCourses(generatorPreviewTimetable.courses).map((c: any) => {
                              const rawHalves: AddedCourse[] = generatorPreviewTimetable.courses.filter((course) =>
                                (c.ids ?? [c.id]).includes(course.id)
                              );
                              const allSlots = Array.from(new Set(rawHalves.flatMap((h) => h.slots)));
                              const theorySlots = allSlots.filter((s) => !s.startsWith("L") && s !== "NIL");
                              const labSlots = allSlots.filter((s) => s.startsWith("L"));
                              const isEmbedded = theorySlots.length > 0 && labSlots.length > 0;

                              const dropIns = isEmbedded
                                ? sameSlotFacultyAlternatives(
                                    c.code,
                                    allSlots,
                                    { faculty: c.faculty, employeeId: rawHalves[0]?.employeeId || (c as any).employeeId },
                                    masterCourses
                                  )
                                : [];

                              const halves = expandCourseHalves(rawHalves);
                              const counts = halves.map((half) => {
                                const alts = sameSlotFacultyAlternatives(
                                  half.code,
                                  half.slots,
                                  { faculty: half.faculty, employeeId: half.employeeId },
                                  masterCourses
                                );
                                return 1 + alts.length;
                              });

                              const dropInCount = dropIns.length;
                              const facultyCountDisplay =
                                dropInCount > 0
                                  ? `${1 + dropInCount} drop-in`
                                  : isEmbedded
                                  ? "1"
                                  : counts.length > 1 && counts.some((cnt) => cnt !== counts[0])
                                  ? counts.join(" / ")
                                  : String(counts[0] ?? 1);

                              const facultyCountTitle =
                                dropInCount > 0
                                  ? `${1 + dropInCount} drop-in replacements · Click to switch`
                                  : isEmbedded
                                  ? "1 faculty teaching this slot · Click to switch to other slots"
                                  : counts.length === 1 && counts[0] === 1
                                  ? "1 faculty teaching this slot · Click to switch"
                                  : `${facultyCountDisplay} faculties teaching this slot · Click to switch`;

                              return (
                              <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                                    <div>
                                      <p className="text-text-heading font-semibold text-sm flex items-center gap-2 flex-wrap">
                                        {c.code}
                                        {c.batch && c.batch.split(",").map(b => b.trim()).filter(Boolean).map(b => (
                                          <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                                            {b}
                                          </span>
                                        ))}
                                      </p>
                                      <p className="text-muted-foreground text-xs max-w-xs">{c.title}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-sm text-text-heading/80">
                                  {renderTypeChips(c.type)}
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FacultyAvatar
                                      employeeId={halves[0]?.employeeId || (c as any).employeeId}
                                      name={c.faculty}
                                      size="xs"
                                      tone="amber"
                                    />
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => setSlotSwapRow({ code: c.code, title: c.title, ids: c.ids ?? [c.id] })}
                                        title={facultyCountTitle}
                                        className="flex items-center gap-1.5 text-sm text-text-heading/80 hover:text-amber-500 transition-colors cursor-pointer max-w-full"
                                      >
                                        <span className="truncate">{c.faculty}</span>
                                        <span
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground group-hover:text-amber-500 group-hover:border-amber-500/40 transition-colors shrink-0"
                                          title={facultyCountTitle}
                                        >
                                          <Users className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-amber-500 shrink-0" />
                                          <span>{facultyCountDisplay}</span>
                                        </span>
                                      </button>
                                      <VitfacReviewPill
                                        employeeId={halves[0]?.employeeId || (c as any).employeeId}
                                        name={c.faculty}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReviewSheetTarget({
                                            name: c.faculty,
                                            employeeId: halves[0]?.employeeId || (c as any).employeeId,
                                            courseCode: c.code,
                                          });
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex flex-wrap gap-1">
                                    {c.slots.map((s: string) => (
                                      <span key={s} className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md">
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-sm text-text-heading/80 max-w-xs">{c.venue}</td>
                                <td className="py-3 px-2 text-sm text-text-heading/80">{c.credits}</td>
                              </tr>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>



              {/* Dash Details Modal */}
              <AnimatePresence>{selectedDashDetails && (
                <BottomSheet
                  onClose={() => setSelectedDashDetails(null)}
                  overlayId="ffcs-dash-details"
                  maxWidth="max-w-md"
                  panelZIndex={210}
                  backdropZIndex={205}
                >
                  <h3 className="font-bold text-text-heading flex items-center gap-2">
                    <span className="text-xl"></span> Block Dash Details
                  </h3>
                  <div>
                      {selectedDashDetails.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No block dashes in this timetable. Great!</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {selectedDashDetails.map((dash, i) => (
                            <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col gap-2">
                              <div className="flex justify-between items-center border-b border-red-500/10 pb-2 mb-1">
                                <span className="font-bold text-red-400 text-sm">{dash.day}</span>
                                <span className="text-xs font-semibold bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{dash.fromTime} - {dash.toTime}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 flex flex-col overflow-hidden">
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">From {dash.fromBlock}</span>
                                  <span className="text-sm font-medium text-text-heading truncate block" title={dash.fromClass}>{dash.fromClass}</span>
                                </div>
                                <div className="text-red-500/50"></div>
                                <div className="flex-1 flex flex-col text-right overflow-hidden">
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">To {dash.toBlock}</span>
                                  <span className="text-sm font-medium text-text-heading truncate block" title={dash.toClass}>{dash.toClass}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </BottomSheet>
              )}</AnimatePresence>

              {/* Gap Details Modal */}
              <AnimatePresence>{selectedGapDetails && (
                <BottomSheet
                  onClose={() => setSelectedGapDetails(null)}
                  overlayId="ffcs-gap-details"
                  maxWidth="max-w-lg"
                  panelZIndex={210}
                  backdropZIndex={205}
                >
                  <h3 className="font-bold text-text-heading flex items-center gap-2">
                    Gap Hours Detail
                  </h3>
                  <div>
                      <p className="text-sm text-muted-foreground mb-4">
                        We have highlighted the empty gap slots in <span className="text-yellow-500 font-bold">yellow</span> on the unified schedule grid behind this modal!
                      </p>
                      {selectedGapDetails.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No gaps in this timetable. Perfect!</p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {(() => {
                            const grouped = new Map<string, typeof selectedGapDetails>();
                            selectedGapDetails.forEach(g => {
                              const day = g.day;
                              if (!grouped.has(day)) grouped.set(day, []);
                              grouped.get(day)!.push(g);
                            });
                            return Array.from(grouped.entries()).map(([day, gaps]) => {
                              const dayTotalMins = gaps.reduce((sum, g) => sum + g.durationMins, 0);
                              const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                              return (
                                <div key={day} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl overflow-hidden">
                                  <div className="px-4 py-2.5 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center justify-between">
                                    <span className="font-bold text-yellow-500 uppercase">{dayName}</span>
                                    <span className="text-xs font-bold bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
                                      {gaps.length} gap{gaps.length > 1 ? 's' : ''} · {dayTotalMins} min total
                                    </span>
                                  </div>
                                  <div className="p-3 flex flex-col gap-2">
                                    {gaps.map((gap, i) => (
                                      <div key={i} className="bg-surface/50 rounded-lg p-3 border border-yellow-500/10">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-bold text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                            {gap.durationMins} min gap
                                          </span>
                                          <span className="text-[10px] text-muted-foreground font-medium">
                                            {gap.fromTime} – {gap.toTime}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="flex-1 truncate">
                                            <span className="text-muted-foreground block text-[10px]">From</span>
                                            <span className="text-text-heading font-medium" title={gap.fromClass}>{gap.fromClass}</span>
                                          </div>
                                          <div className="text-yellow-500 shrink-0">→</div>
                                          <div className="flex-1 truncate text-right">
                                            <span className="text-muted-foreground block text-[10px]">To</span>
                                            <span className="text-text-heading font-medium" title={gap.toClass}>{gap.toClass}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                  </div>
                </BottomSheet>
              )}</AnimatePresence>
              </>
            ) : isCompareModalOpen ? (
              <div className="w-full flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 px-4 sm:px-6 pt-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-heading">Compare Options</h2>
                    <p className="text-xs text-muted-foreground mt-1">Comparing {selectedTimetablesToCompare.length} timetables side-by-side</p>
                  </div>
                  <button 
                    onClick={() => setIsCompareModalOpen(false)} 
                    className="p-2 bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 custom-scrollbar">
                  <div className={`grid grid-cols-1 ${selectedTimetablesToCompare.length === 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-3'} gap-6`}>
                    {selectedTimetablesToCompare.map(id => {
                      const tt = stagedTimetables.find(t => t.id === id);
                      if (!tt) return null;
                      return (
                        <div key={id} className="flex flex-col bg-surface border border-border-strong rounded-2xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-surface-secondary/30 border-b border-border-strong flex justify-between items-center">
                            <h3 className="font-bold text-lg text-text-heading">{tt.name}</h3>
                            <div className="flex gap-2">
                              <span className="text-xs font-bold text-muted-foreground bg-surface px-2 py-1 rounded-md border border-border-strong">{tt.metrics?.halfDays} Half Days</span>
                              <span className="text-xs font-bold text-muted-foreground bg-surface px-2 py-1 rounded-md border border-border-strong">{formatHours(tt.metrics?.gaps ?? 0)}h Gaps</span>
                            </div>
                          </div>
                          <div className="p-4 overflow-x-auto custom-scrollbar">
                            <TimetableGrid 
                              courses={courses} 
                              customCourses={tt.courses as AddedCourse[]}
                              fullSize={false}
                              blockedSlots={blockedSlots} 
                              toggleBlockSlot={toggleBlockSlot} 
                              selectedGapDetails={null} 
                              theoryPeriods={theoryPeriods}
                              labPeriods={labPeriods}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : isReviewing && stagedTimetables.length > 0 ? (
              <div className="w-full max-w-none flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-300">
                {/* Grid of Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {stagedTimetables.slice(0, stagedVisibleCount).map(tt => (
                    <StagedCard
                      key={tt.id}
                      tt={tt}
                      selectedIds={selectedStagedIds}
                      setSelectedIds={setSelectedStagedIds}
                      compareIds={selectedTimetablesToCompare}
                      setCompareIds={setSelectedTimetablesToCompare}
                      socialOn={generatorMaximizeFreeTimeFriends.length > 0}
                      onPreview={setGeneratorPreviewTimetable}
                    />
                  ))}
                </div>

                {/* Render-window footer. The state keeps every option the
                    search kept; only the paint is bounded. The grid's own
                    bottom padding is the visual gap above, so this block's
                    bottom padding stays the Saved bar's scroll clearance. */}
                {stagedTimetables.length > stagedVisibleCount && (
                  <div className="flex flex-col items-center gap-3 pb-20 -mt-14">
                    <p className="text-xs text-muted-foreground text-center max-w-md">
                      Showing the first {stagedVisibleCount.toLocaleString()} of {stagedTimetables.length.toLocaleString()} options.
                      Everything is kept — &ldquo;Save Selected&rdquo; scans the whole list, and the ranked order keeps the best ones here.
                    </p>
                    <button
                      onClick={() => setStagedVisibleCount(count => count + STAGED_RENDER_STEP)}
                      className="px-5 py-2 text-sm font-bold bg-surface hover:bg-surface-secondary text-text-heading rounded-xl border border-border-strong transition-colors"
                    >
                      Show {Math.min(STAGED_RENDER_STEP, stagedTimetables.length - stagedVisibleCount).toLocaleString()} more
                    </button>
                  </div>
                )}

                {/* Floating Compare Bar */}
                {selectedTimetablesToCompare.length > 0 && (
                  <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] left-1/2 -translate-x-1/2 z-[250] bg-surface border-2 border-purple-500 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <span className="text-sm font-semibold text-text-heading">
                      {selectedTimetablesToCompare.length} selected to compare (Max 3)
                    </span>
                    <button
                      onClick={() => setIsCompareModalOpen(true)}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-2"
                    >
                      Compare Options
                    </button>
                    <button
                      onClick={() => setSelectedTimetablesToCompare([])}
                      className="relative hit-expand w-8 h-8 flex items-center justify-center rounded-full bg-surface-secondary hover:bg-surface-secondary/80 text-muted-foreground transition-colors ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
            <div className={`max-w-none w-full grid ${generatorViewMode === "modern" ? "grid-cols-1 gap-3 lg:gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]" : "grid-cols-1 lg:grid-cols-2 gap-10"}`}>

              {generatorViewMode === "modern" && (
                <nav aria-label="Generator sections" className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-1 lg:self-start">
                  <div>
                    <SectionHeader icon={LayoutDashboard} title="Generator sections" className="mb-2" />
                    <div role="tablist" aria-label="Auto-generator sections" className="min-w-0">
                      <ListShell>
                        {generatorSections.map(({ id, label, icon: Icon, detail, tone }) => {
                          const isActive = activeGeneratorSection === id;
                          // Per-tone tile + active tint, same recipe as the
                          // target-course menu entries below.
                          const tileClass = {
                            indigo: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                            violet: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20",
                            cyan: "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
                            amber: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            pink: "bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/20",
                          }[tone];
                          const activeClass = {
                            indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
                            violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
                            cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
                            amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            pink: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
                          }[tone];
                          const activeTickClass = {
                            indigo: "bg-indigo-500",
                            violet: "bg-violet-500",
                            cyan: "bg-cyan-500",
                            amber: "bg-amber-500",
                            pink: "bg-pink-500",
                          }[tone];
                          return (
                          <button
                            key={id}
                            id={`generator-tab-${id}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="generator-active-panel"
                            onClick={() => selectGeneratorSection(id)}
                            onKeyDown={(event) => {
                              const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
                                ? 1
                                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                                  ? -1
                                  : 0;
                              if (!direction) return;
                              event.preventDefault();
                              const currentIndex = generatorSections.findIndex((section) => section.id === id);
                              const next = generatorSections[(currentIndex + direction + generatorSections.length) % generatorSections.length];
                              selectGeneratorSection(next.id);
                              document.getElementById(`generator-tab-${next.id}`)?.focus();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? `${activeClass} text-text-heading` : "text-text-secondary hover:bg-surface-secondary/60 hover:text-text-heading"}`}
                          >
                            <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${tileClass}`}>
                              <Icon className="w-4 h-4" />
                            </span>
                            <ListRowText
                              title={label}
                              titleTag="span"
                              subtitle={detail}
                              wrapSubtitle
                            />
                            {isActive && (
                              <span className={`w-5 h-5 rounded text-white flex items-center justify-center shrink-0 ${activeTickClass}`}>
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                          );
                        })}
                      </ListShell>
                    </div>
                  </div>
                  <section aria-labelledby="generator-views-heading" className="space-y-2">
                    <h3 id="generator-views-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Views
                    </h3>
                    <ListShell>
                      <button
                        type="button"
                        onClick={() => setIsViewModeModalOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                      >
                        <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                          <PanelsTopLeft className="w-4 h-4" />
                        </span>
                        <ListRowText
                          title="Switch Generator View"
                          titleTag="span"
                          subtitle={generatorViewLabel}
                        />
                      </button>
                    </ListShell>
                  </section>

                  {generatorTargets.length > 0 && (
                    <section aria-labelledby="generator-locked-courses-heading" className="space-y-2">
                      <h3 id="generator-locked-courses-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Target courses
                      </h3>
                      <ListShell>
                        {generatorTargets.map((t) => (
                          <button
                            key={t.code}
                            type="button"
                            onClick={() => { setActiveGeneratorSection("courses"); setActiveLockerCode(t.code); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${activeLockerCode === t.code ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-secondary hover:text-text-heading"}`}
                          >
                            <span className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                              {t.code.slice(0, 2)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold">{t.code}</span>
                              <span className="block truncate text-[10px] text-muted-foreground" title={t.title}>{t.title}</span>
                              <span className="hidden truncate text-[10px] text-muted-foreground/70 lg:block">
                                {t.offerings?.length ? `${t.offerings.length} offering${t.offerings.length === 1 ? "" : "s"}` : "any faculty/slot"}
                              </span>
                            </span>
                          </button>
                        ))}
                      </ListShell>
                    </section>
                  )}
                </nav>
              )}

              {generatorViewMode === "classic" && (
                <section aria-labelledby="generator-classic-views-heading" className="col-span-full space-y-2">
                  <h3 id="generator-classic-views-heading" className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Views
                  </h3>
                  <ListShell>
                    <button
                      type="button"
                      onClick={() => setIsViewModeModalOpen(true)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        <PanelsTopLeft className="w-4 h-4" />
                      </span>
                      <ListRowText
                        title="Switch Generator View"
                        titleTag="span"
                        subtitle={generatorViewLabel}
                      />
                    </button>
                  </ListShell>
                </section>
              )}
              
              {/* Locker view: on desktop, opening a target course swaps the main
                  column to its faculty/slot picker. Mobile still uses the sheet. */}
              {activeLockerCode && (() => {
                const lkCourse = generatorDisplayCourses.find(c => c.code === activeLockerCode) || generatorTargets.find(t => t.code === activeLockerCode);
                const lkSelection = generatorTargets.find(t => t.code === activeLockerCode);
                if (!lkCourse || !lkSelection) return null;
                return (
                  <div className={`hidden lg:flex min-w-0 flex-col gap-4 bg-surface rounded-2xl border border-indigo-500/30 dark:border-indigo-500/40 shadow-sm p-4 sm:p-6 ${generatorViewMode === "modern" ? "row-start-3 lg:row-start-1 lg:col-start-2" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-lg text-text-heading">{lkCourse.code}</span>
                          <span className="text-sm text-muted-foreground truncate">{lkCourse.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pick the slots and faculties the generator should focus on for this course.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveLockerCode(null)}
                        className="shrink-0 min-h-11 px-3 text-xs font-semibold rounded-xl border border-border-strong text-text-secondary hover:text-text-heading hover:bg-surface-secondary/60 transition-colors"
                      >
                        Back to courses
                      </button>
                    </div>
                    <TargetCourseLocker
                      course={{ code: lkCourse.code, title: lkCourse.title }}
                      masterCourses={masterCourses}
                      selection={lkSelection}
                      onChange={(next) => setGeneratorTargets(prev => prev.map(p => (p.code === lkCourse.code ? next : p)))}
                    />
                  </div>
                );
              })()}

              {/* Left Column: Courses Selection */}
              <div id={generatorViewMode === "modern" && activeGeneratorSection === "courses" ? "generator-active-panel" : undefined} role={generatorViewMode === "modern" ? "tabpanel" : undefined} aria-labelledby={generatorViewMode === "modern" ? `generator-tab-${activeGeneratorSection}` : undefined} className={`flex min-w-0 flex-col gap-6 ${generatorViewMode === "modern" ? `row-start-3 lg:row-start-1 lg:col-start-2 ${showGeneratorSection("courses") ? "" : "hidden"}` : ""} ${activeLockerCode ? "lg:hidden" : ""}`}>
                <div id="generator-target-courses" className={`scroll-mt-24 bg-surface rounded-2xl border shadow-sm ${generatorViewMode === "modern" ? "border-indigo-500/30 dark:border-indigo-500/40 p-4 sm:p-6" : "border-border-strong p-6"}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      {generatorViewMode === "modern" ? (
                        <SectionHeader icon={Target} title="Target courses" count={generatorTargets.length} className="mb-2" />
                      ) : <h3 className="font-semibold text-lg mb-2 text-text-heading flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span> 
                        Target Courses
                      </h3>}
                      <p className="text-sm text-muted-foreground">Select the courses you want to take and optionally filter faculties/slots.</p>
                    </div>
                  </div>
                  
                  {generatorTargets.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Locked target courses</div>
                      <div className="flex flex-col gap-2">
                        {generatorTargets.map((t) => (
                          <div key={t.code} className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-text-heading truncate">{t.code}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{t.title}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                {t.offerings?.length ? `${t.offerings.length} offering${t.offerings.length === 1 ? "" : "s"}` : "any"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveLockerCode(t.code)}
                                className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setGeneratorTargets(prev => prev.filter(p => p.code !== t.code))}
                                className="text-xs text-muted-foreground hover:text-red-500"
                                aria-label={`Remove ${t.code}`}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <SearchInput placeholder="Search by course code or title..." value={generatorCourseSearchQuery} onChange={e => setGeneratorCourseSearchQuery(e.target.value)} containerClassName="mb-3" />

                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Group by</span>
                    {([
                      { id: "none", label: "None" },
                      { id: "facultyRank", label: "Faculty rank" },
                      { id: "slot", label: "Slot" },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={generatorCourseGroupBy === opt.id}
                        onClick={() => setGeneratorCourseGroupBy(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${generatorCourseGroupBy === opt.id ? "bg-amber-500 text-white shadow-sm" : "bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-2 mr-1">Sort</span>
                    {([
                      { id: "code", label: "Code" },
                      { id: "title", label: "Title" },
                      { id: "faculty", label: "Most faculties" },
                      { id: "offerings", label: "Most offerings" },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={generatorCourseSortBy === opt.id}
                        onClick={() => setGeneratorCourseSortBy(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${generatorCourseSortBy === opt.id ? "bg-indigo-500 text-white shadow-sm" : "bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="border border-border-strong rounded-xl max-h-[60vh] overflow-y-auto bg-surface-secondary/10 p-3 flex flex-col gap-3 custom-scrollbar">
                    {generatorCourseGroups.reduce((n, g) => n + g.courses.length, 0) === 0 && uniqueCourseCodes.length > 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No courses found matching "{generatorCourseSearchQuery}"
                      </div>
                    )}
                    {generatorCourseGroups.map(group => (
                      <div key={group.label ?? "all"} className="flex flex-col gap-2">
                        {group.label && (
                          <div className="sticky top-0 z-10 bg-surface-secondary/95 backdrop-blur px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </div>
                        )}
                        {group.courses.map(c => {
                          const sel = generatorTargets.find(s => s.code === c.code);
                          const isSelected = !!sel;

                          return (
                            <div key={c.code} className={`rounded-xl border transition-colors ${isSelected ? "bg-amber-500/5 border-amber-500/50 shadow-sm" : "bg-surface border-border-strong hover:border-amber-500/30 hover:bg-surface-secondary/40"}`}>
                              <label
                                className="flex items-center gap-3 p-3 cursor-pointer"
                                onClick={(e) => {
                                  // A selected course's card is the entry to its
                                  // pane; a click on it opens the pane rather
                                  // than unchecking (prevent the label's own
                                  // activation of the checkbox).
                                  if (isSelected && activeLockerCode !== c.code && (e.target as HTMLElement).tagName !== "INPUT") {
                                    e.preventDefault();
                                    setActiveLockerCode(c.code);
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setGeneratorTargets(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [], offerings: [] }]);
                                      // Ticking a course is a request to pick its
                                      // faculty/slots — open its pane right away.
                                      setActiveLockerCode(c.code);
                                    } else {
                                      setGeneratorTargets(prev => prev.filter(s => s.code !== c.code));
                                      setActiveLockerCode(prev => (prev === c.code ? null : prev));
                                    }
                                  }}
                                />
                                <span className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/40 ${isSelected ? "bg-amber-500 border-amber-500 text-white" : "bg-surface border-border-strong text-transparent"}`}>
                                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                </span>
                                <span className="flex flex-col flex-1 min-w-0">
                                  <span className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-base text-text-heading">{c.code}</span>
                                    {renderTypeChips(c.types || [], 'sm')}
                                  </span>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{c.title}</span>
                                </span>
                                {isSelected && (
                                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0 hidden sm:inline">
                                    {activeLockerCode === c.code ? "Editing…" : "Open ›"}
                                  </span>
                                )}
                              </label>

                              {isSelected && (
                                <div className="px-3 pb-3 pl-11 flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setActiveLockerCode(c.code)}
                                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline"
                                  >
                                    Edit faculty &amp; slots
                                  </button>
                                  {sel.offerings && sel.offerings.length > 0 && (
                                    <span className="text-xs text-amber-500 font-medium">
                                      Filtering by {sel.offerings.length} offering{sel.offerings.length === 1 ? "" : "s"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {uniqueCourseCodes.length === 0 && (
                      <div className="p-10 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-xl border border-dashed border-border-strong">
                        Please upload a master course list first.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2.5 px-4 rounded-xl w-fit max-w-full min-w-0 border border-amber-500/20 leading-relaxed">
                    <span className="font-bold whitespace-nowrap shrink-0">Selected: {generatorTargets.length} target courses</span>
                    {seededFromLocks && (
                      <span className="text-amber-600/80 dark:text-amber-400/80 font-normal min-w-0 break-words">
                        {" — from your locked Target Courses; changes here don't write back"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Preferences & Social */}
              <div id={generatorViewMode === "modern" && activeGeneratorSection !== "courses" ? "generator-active-panel" : undefined} role={generatorViewMode === "modern" && activeGeneratorSection !== "courses" ? "tabpanel" : undefined} aria-labelledby={generatorViewMode === "modern" && activeGeneratorSection !== "courses" ? `generator-tab-${activeGeneratorSection}` : undefined} className={`flex min-w-0 flex-col gap-6 ${generatorViewMode === "modern" ? `row-start-3 lg:row-start-1 lg:col-start-2 ${activeGeneratorSection === "courses" ? "hidden" : ""}` : ""}`}>
                
                {/* General Preferences */}
                <div id="generator-preferences" className={`scroll-mt-24 rounded-2xl border shadow-sm ${generatorViewMode === "modern" ? `${activeGeneratorSection === "ranking" ? "border-violet-500/30 dark:border-violet-500/40" : activeGeneratorSection === "schedule" ? "border-cyan-500/30 dark:border-cyan-500/40" : "border-amber-500/30 dark:border-amber-500/40"} bg-surface p-4 sm:p-6 ${activeGeneratorSection === "social" || activeGeneratorSection === "courses" ? "hidden" : ""}` : "border-border-strong bg-surface p-6"}`}>
                  {generatorViewMode === "modern" ? (
                    <>
                      <SectionHeader icon={activeSectionInfo.icon} title={activeSectionInfo.label} className="mb-1" />
                      <p className="mb-5 px-1 text-xs leading-relaxed text-text-secondary dark:text-text-muted">
                        {activeGeneratorSection === "ranking"
                          ? "Choose how options are ordered and how faculty review data affects scores."
                          : activeGeneratorSection === "schedule"
                            ? "Set acceptable class times, daily end limits, and lab spacing rules."
                            : "Control search size, unique-faculty results, and unavailable slots."}
                      </p>
                    </>
                  ) : <h3 className="font-semibold text-lg mb-4 text-text-heading flex items-center gap-2">
                    <span className="bg-blue-500/10 text-blue-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span> 
                    Preferences
                  </h3>}
                  
                  <div className="space-y-5">
                    <div id="generator-sort-order" className={`scroll-mt-24 ${showGeneratorSection("ranking") ? "" : "hidden"}`}>
                      <label className="text-sm font-medium text-text-heading block mb-2">
                        Sort Timetables By
                      </label>
                      <RadioGroup
                        name="generatorSortBy"
                        options={GENERATOR_SORT_OPTIONS}
                        value={generatorSortBy}
                        onChange={setGeneratorSortBy}
                      />
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${showGeneratorSection("ranking") ? "" : "hidden"}`}>
                      <div>
                        <label className="text-sm font-medium text-text-heading block mb-1.5 flex items-center gap-2">
                          Min Free Half-Days
                        </label>
                        <input 
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={generatorMinHalfDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setGeneratorMinHalfDays(isNaN(val) ? 0 : Math.max(0, Math.min(10, val)));
                          }}
                          className="w-full bg-surface-secondary/30 border border-border-strong rounded-xl px-4 py-3 text-sm text-text-heading focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className={`${showGeneratorSection("constraints") ? "" : "hidden"}`}>
                      <label className="text-sm font-medium text-text-heading block mb-2">
                        Maximum Timetables to Keep
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set([50, 100, 250, 500, generatorResultCap])]
                          .sort((a, b) => a - b)
                          .map((cap) => (
                            <button
                              key={cap}
                              type="button"
                              aria-pressed={generatorResultCap === cap}
                              onClick={() => setGeneratorResultCap(cap)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                generatorResultCap === cap
                                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                                  : "border-border-strong bg-surface text-text-secondary hover:text-text-heading"
                              }`}
                            >
                              {cap}
                            </button>
                          ))}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {generatorNoLimit
                          ? "The cap is ignored while Remove Result Cap is enabled."
                          : "Search stops after this many timetable options."}
                      </p>
                    </div>

                    <div id="generator-ranking" className={`scroll-mt-24 ${showGeneratorSection("ranking") ? "" : "hidden"}`}>
                      <label className="text-sm font-medium text-text-heading block mb-2 flex items-center gap-2">
                        Ranking Profile
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                          Optional
                        </span>
                      </label>
                      <RadioGroup
                        name="generatorRankingProfile"
                        options={GENERATOR_RANKING_OPTIONS}
                        value={rankingMode ?? "default"}
                        onChange={(val) =>
                          setRankingMode(val === "default" ? null : (val as RankingMode))
                        }
                      />
                    </div>

                    <section id="generator-faculty-reviews" className={`scroll-mt-24 space-y-4 rounded-xl border p-4 ${generatorViewMode === "modern" ? "border-violet-500/20 bg-violet-500/[0.04]" : "border-border-strong/70 bg-surface-secondary/20"} ${showGeneratorSection("ranking") ? "" : "hidden"}`}>
                      <div>
                        <h4 className="text-sm font-semibold text-text-heading">Ranking &amp; Faculty Reviews</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tune this run independently from your saved Planner Settings.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-text-heading block">
                          Combined Ranking Priority
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Move the factor that matters most to the top.
                        </p>
                        <div className="space-y-1.5">
                          {rankingPriorityOrder.map((priority, index) => (
                            <div
                              key={priority}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border-strong/50 bg-surface px-3 py-1.5 text-xs"
                            >
                              <span className="font-medium text-text-heading">
                                {index + 1}. {RANKING_PRIORITY_LABELS[priority]}
                              </span>
                              <span className="flex">
                                <button
                                  type="button"
                                  aria-label={`Move ${RANKING_PRIORITY_LABELS[priority]} up`}
                                  disabled={index === 0}
                                  onClick={() => moveRankingPriority(index, -1)}
                                  className="rounded p-1 text-muted-foreground hover:text-text-heading disabled:opacity-30"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${RANKING_PRIORITY_LABELS[priority]} down`}
                                  disabled={index === rankingPriorityOrder.length - 1}
                                  onClick={() => moveRankingPriority(index, 1)}
                                  className="rounded p-1 text-muted-foreground hover:text-text-heading disabled:opacity-30"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium text-text-heading block">
                              Faculty Score Priorities
                            </label>
                            <p className="text-[11px] text-muted-foreground">
                              0 ignores a metric; maximum importance is 5.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                ["wPct", "Overall W %"],
                                ["lecture", "Lecture"],
                                ["da", "DA"],
                                ["vibe", "Vibe"],
                              ] as const
                            ).map(([key, label]) => (
                              <label
                                key={key}
                                className="flex items-center justify-between gap-2 text-xs text-text-primary"
                              >
                                <span>{label}</span>
                                <input
                                  aria-label={`${label} importance`}
                                  type="number"
                                  min={0}
                                  max={5}
                                  step={1}
                                  value={facultyMetricWeights[key]}
                                  onChange={(event) => updateFacultyWeight(key, event.target.value)}
                                  className="w-16 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-text-heading"
                                />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium text-text-heading block">
                              Minimum Faculty Review Scores
                            </label>
                            <p className="text-[11px] text-muted-foreground">
                              0 disables a filter; unrated faculty are not rejected.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                ["minWPct", "Overall W %", 100, 5],
                                ["minLecture", "Lecture / 5", 5, 0.5],
                                ["minDa", "DA / 5", 5, 0.5],
                                ["minVibe", "Vibe / 5", 5, 0.5],
                              ] as const
                            ).map(([key, label, max, step]) => (
                              <label
                                key={key}
                                className="flex items-center justify-between gap-2 text-xs text-text-primary"
                              >
                                <span>{label}</span>
                                <input
                                  aria-label={`Minimum ${label}`}
                                  type="number"
                                  min={0}
                                  max={max}
                                  step={step}
                                  value={facultyScoreFilters[key]}
                                  onChange={(event) => updateFacultyFilter(key, event.target.value)}
                                  className="w-16 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-text-heading"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${showGeneratorSection("schedule") ? "" : "hidden"}`}>
                      <SelectField
                        stacked
                        title="Earliest Slot Start"
                        description="Only allow classes starting at or after this slot time."
                        value={generatorMinStartTime}
                        options={[
                          { value: "", label: "Any start time" },
                          ...slotStartOptions,
                          ...(!slotStartOptions.some((option) => option.value === generatorMinStartTime)
                            ? [{ value: generatorMinStartTime, label: `${generatorMinStartTime} · saved setting` }]
                            : []),
                        ]}
                        onChange={setGeneratorMinStartTime}
                        searchable={false}
                      />
                      <SelectField
                        stacked
                        title="Latest Slot End"
                        description="Global end limit; day-specific limits below can be stricter."
                        value={generatorMaxEndTime}
                        options={[
                          { value: "", label: "Any end time" },
                          ...slotEndOptions,
                          ...(!slotEndOptions.some((option) => option.value === generatorMaxEndTime)
                            ? [{ value: generatorMaxEndTime, label: `${generatorMaxEndTime} · saved setting` }]
                            : []),
                        ]}
                        onChange={setGeneratorMaxEndTime}
                        searchable={false}
                      />
                    </div>

                    <div className={`space-y-3 rounded-xl border p-4 ${generatorViewMode === "modern" ? "border-cyan-500/20 bg-cyan-500/[0.04]" : "border-border-strong/70 bg-surface-secondary/20"} ${showGeneratorSection("schedule") ? "" : "hidden"}`}>
                      <div>
                        <h4 className="text-sm font-semibold text-text-heading">Day-specific class end times</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Turn on a day to set its own latest slot end. Off days have no extra end limit.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map((day) => {
                          const dayLimit = generatorMaxEndTimeByDay[day];
                          const options = slotEndOptionsByDay[day];
                          const toggleDayLimit = () => {
                            setGeneratorMaxEndTimeByDay((previous) => {
                              if (previous[day] !== undefined) {
                                const next = { ...previous };
                                delete next[day];
                                return next;
                              }
                              const defaultLimit =
                                options.find((option) => option.value === generatorMaxEndTime)?.value ??
                                options[options.length - 1]?.value ??
                                generatorMaxEndTime;
                              return { ...previous, [day]: defaultLimit };
                            });
                          };
                          return (
                            <div
                              key={day}
                              className="flex items-center gap-3 rounded-lg border border-border-strong/50 bg-surface px-3 py-2"
                            >
                              <button
                                type="button"
                                role="switch"
                                aria-checked={dayLimit !== undefined}
                                aria-label={`${DAY_LABELS[day]} end-time limit`}
                                onClick={toggleDayLimit}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                                  dayLimit !== undefined ? "bg-indigo-500" : "bg-surface-secondary"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                    dayLimit !== undefined ? "translate-x-4" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                              <span className="w-20 shrink-0 text-xs font-medium text-text-heading">
                                {DAY_LABELS[day]}
                              </span>
                              {dayLimit !== undefined && (
                                <SelectField
                                  value={dayLimit}
                                  options={[
                                    ...options,
                                    ...(!options.some((option) => option.value === dayLimit)
                                      ? [{ value: dayLimit, label: `${dayLimit} · saved setting` }]
                                      : []),
                                  ]}
                                  onChange={(value) =>
                                    setGeneratorMaxEndTimeByDay((previous) => ({
                                      ...previous,
                                      [day]: value,
                                    }))
                                  }
                                  searchable={false}
                                  size="sm"
                                  aria-label={`${DAY_LABELS[day]} latest class end`}
                                />
                              )}
                              {dayLimit === undefined && (
                                <span className="text-[11px] text-muted-foreground">No day limit</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div id="generator-schedule" className={`scroll-mt-24 ${showGeneratorSection("schedule") ? "" : "hidden"}`}>
                      <label className="text-sm font-medium text-text-heading block mb-2">
                        Time Preference
                      </label>
                      <RadioGroup
                        name="generatorPreference"
                        options={GENERATOR_TIME_PREFERENCE_OPTIONS}
                        value={generatorPreference}
                        onChange={(val) => setGeneratorPreference(val as any)}
                      />
                      {(generatorPreference === "morning" || generatorPreference === "evening") && (
                        <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-border-strong bg-surface-secondary/20 p-3 text-sm text-text-heading">
                          <input
                            type="checkbox"
                            checked={strictTheoryPreference}
                            onChange={(event) => setStrictTheoryPreference(event.target.checked)}
                            className="mt-0.5 accent-indigo-500"
                          />
                          <span>
                            <span className="block font-medium">
                              Strictly {generatorPreference} theory only
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Turn this off to allow some {generatorPreference === "morning" ? "evening" : "morning"} theory classes and rank schedules with more preferred-time theory higher. Labs are not restricted.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>

                    <fieldset id="generator-lab-rules" className={`scroll-mt-24 space-y-2 rounded-xl border p-3 ${generatorViewMode === "modern" ? "border-cyan-500/25 bg-cyan-500/[0.04]" : "border-border-strong bg-surface-secondary/10"} ${showGeneratorSection("schedule") ? "" : "hidden"}`}>
                      <legend className="px-1 text-sm font-medium text-text-heading">
                        Lab Scheduling
                      </legend>
                      <label className="flex items-start gap-2 text-sm text-text-heading">
                        <input
                          type="checkbox"
                          checked={separateLabDays}
                          onChange={(event) => setSeparateLabDays(event.target.checked)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <span>
                          <span className="block font-medium">At most one lab class per day</span>
                          <span className="block text-xs text-muted-foreground">
                            Multiple slots within one lab class still count as one class.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-text-heading">
                        <input
                          type="checkbox"
                          checked={avoidConsecutiveLabs}
                          onChange={(event) => setAvoidConsecutiveLabs(event.target.checked)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <span>
                          <span className="block font-medium">Avoid consecutive lab slots</span>
                          <span className="block text-xs text-muted-foreground">
                            Uses actual timed lab periods; consecutive slots across lunch are included by default.
                          </span>
                        </span>
                      </label>
                      {avoidConsecutiveLabs && (
                        <label className="ml-6 flex items-start gap-2 text-sm text-text-heading">
                          <input
                            type="checkbox"
                            checked={lunchBreakSeparatesLabs}
                            onChange={(event) => setLunchBreakSeparatesLabs(event.target.checked)}
                            className="mt-0.5 accent-indigo-500"
                          />
                          <span>
                            <span className="block font-medium">Treat lunch as a break</span>
                            <span className="block text-xs text-muted-foreground">
                              Lab slots immediately before and after a schema-defined lunch break will not count as consecutive.
                            </span>
                          </span>
                        </label>
                      )}
                    </fieldset>

                    <div id="generator-blocked-slots" className={`scroll-mt-24 ${showGeneratorSection("schedule") ? "" : "hidden"}`}>
                      <label className="text-sm font-medium text-text-heading flex items-center gap-1.5 mb-2">
                        Blocked Slots Constraint
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </label>
                      <div className="bg-surface-secondary/10 border border-border-strong p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                          Click slots below to block them.
                          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-md font-bold ml-auto">{blockedSlots.size} Blocked</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {allAvailableSlots.map(slot => {
                            const isBlocked = blockedSlots.has(slot);
                            return (
                              <button
                                key={slot}
                                onClick={() => toggleBlockSlot(slot)}
                                className={`px-2 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                                  isBlocked 
                                    ? 'bg-red-500 text-white border-red-600 shadow-sm' 
                                    : 'bg-surface text-text-heading/70 border-border-strong hover:bg-surface-secondary hover:text-text-heading'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={`flex flex-col gap-3 ${showGeneratorSection("constraints") ? "" : "hidden"}`}>
                      <label className="flex items-center gap-3 cursor-pointer group bg-surface-secondary/20 p-3 rounded-xl border border-transparent hover:border-border-strong transition-all">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={generatorUniqueFaculties}
                            onChange={e => setGeneratorUniqueFaculties(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-surface-secondary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                        <span className="text-sm font-medium text-text-heading">Master Timetables <span className="text-muted-foreground font-normal">(Unique Faculties)</span></span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group bg-surface-secondary/20 p-3 rounded-xl border border-transparent hover:border-border-strong transition-all">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={generatorNoLimit}
                            onChange={e => setGeneratorNoLimit(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-surface-secondary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                        <span className="text-sm font-medium text-text-heading">
                          {generatorNoLimit
                            ? settings.removeHardResultLimit
                              ? "Unlimited Search"
                              : "Unlimited Search (30,000 max)"
                            : `Limit to ${generatorResultCap} results`}
                        </span>
                      </label>
                    </div>

                  </div>
                </div>

                {/* Social Preferences */}
                <div id="generator-social" className={`scroll-mt-24 bg-surface rounded-2xl border shadow-sm ${generatorViewMode === "modern" ? `border-pink-500/30 dark:border-pink-500/40 p-4 sm:p-6 ${activeGeneratorSection === "social" ? "" : "hidden"}` : "border-border-strong p-6"}`}>
                  {generatorViewMode === "modern" ? (
                    <SectionHeader icon={Users} title="Social matching" count={friends.length} className="mb-4" />
                  ) : <h3 className="font-semibold text-lg mb-4 text-text-heading flex items-center gap-2">
                    <span className="bg-pink-500/10 text-pink-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span> 
                    Social Preferences
                  </h3>}
                  
                  {friends.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 bg-surface-secondary/20 rounded-xl border border-dashed border-border-strong text-center">
                      Add friends from the dashboard to unlock social generation features.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <label className="flex items-start gap-3 cursor-pointer group bg-surface-secondary/20 p-4 rounded-xl border border-transparent hover:border-pink-500/30 transition-all">
                        <div className="relative flex items-center mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={generatorSyncFriendsClasses}
                            onChange={e => setGeneratorSyncFriendsClasses(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-surface-secondary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-text-heading">Auto-Sync Shared Classes</span>
                          <span className="text-xs text-muted-foreground mt-1">If your friends are taking a course you select, force the exact same slot and faculty.</span>
                        </div>
                      </label>

                      <div>
                        <label className="text-sm font-bold text-text-heading block mb-2">Maximize Shared Free Time</label>
                        <p className="text-xs text-muted-foreground mb-3">Timetables will be sorted to show the ones where you and these friends have the most mutual free time.</p>
                        <div className="flex flex-col gap-2">
                          {friends.map(f => {
                            const isChecked = generatorMaximizeFreeTimeFriends.includes(f.id);
                            return (
                              <label key={f.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-pink-500/10 border-pink-500/30' : 'bg-surface-secondary/10 border-border-strong hover:bg-surface-secondary/30'}`}>
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border-strong text-pink-500 focus:ring-pink-500/30 bg-surface"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) setGeneratorMaximizeFreeTimeFriends(prev => [...prev, f.id]);
                                    else setGeneratorMaximizeFreeTimeFriends(prev => prev.filter(id => id !== f.id));
                                  }}
                                />
                                <span className={`text-sm ${isChecked ? 'font-bold text-pink-500' : 'text-text-heading'}`}>{f.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom CTA to run generator */}
                <div className={`pt-6 pb-12 flex justify-center ${generatorViewMode === "modern" ? "row-start-4 lg:row-start-2 lg:col-span-2" : "col-span-1 lg:col-span-2"}`}>
                  <button
                    type="button"
                    onClick={() => setIsRunSummaryOpen(true)}
                    disabled={isGenerating || generatorTargets.length === 0}
                    className={`w-full sm:w-auto min-w-[260px] min-h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 px-6 sm:px-8 rounded-2xl transition-all cursor-pointer ${generatorViewMode === "modern" ? "bg-indigo-600 hover:bg-indigo-700 text-sm sm:text-base font-black font-outfit tracking-wide shadow-xl shadow-indigo-600/20 active:scale-[0.98]" : "bg-amber-500 hover:bg-amber-600 text-base font-bold shadow-lg hover:shadow-amber-500/25"}`}
                  >
                    {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    <span>{isGenerating ? "Generating Timetables…" : "Run Timetable Generator"}</span>
                  </button>
                </div>

              </div>
            </div>
            )}
          </div>
        </div>
      </PageShell>

      {activeLockerCode && !isDesktopViewport && (() => {
        const lkCourse = generatorDisplayCourses.find(c => c.code === activeLockerCode) || generatorTargets.find(t => t.code === activeLockerCode);
        const lkSelection = generatorTargets.find(t => t.code === activeLockerCode);
        if (!lkCourse || !lkSelection) return null;
        return (
          <BottomSheet
            onClose={() => setActiveLockerCode(null)}
            overlayId="generator-target-locker"
            maxWidth="max-w-2xl"
            panelZIndex={300}
            backdropZIndex={295}
            title={`Faculty & slots - ${lkCourse.code}`}
          >
            <TargetCourseLocker
              course={{ code: lkCourse.code, title: lkCourse.title }}
              masterCourses={masterCourses}
              selection={lkSelection}
              onChange={(next) => setGeneratorTargets(prev => prev.map(p => (p.code === lkCourse.code ? next : p)))}
            />
          </BottomSheet>
        );
      })()}

      {/* Variant picker: a sheet inside the subpage, one level deeper in the
          overlay stack than the generator's own back entry. */}
      <AnimatePresence>{isVariantSearchOpen && generatorPreviewTimetable?.variants && (
        <BottomSheet
          onClose={() => setIsVariantSearchOpen(false)}
          overlayId="ffcs-generator-variant-search"
          maxWidth="max-w-lg"
          panelZIndex={220}
          backdropZIndex={215}
          contentClassName="flex flex-col gap-3"
        >
          <h3 className="font-bold text-lg text-text-heading flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-500" /> Select Variant
          </h3>
          
          <div>
            <SearchInput placeholder="Search by faculty name..." value={variantSearchQuery} onChange={e => setVariantSearchQuery(e.target.value)} className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-3 focus:border-amber-500/50 placeholder:text-muted-foreground" autoFocus />
          </div>
          
          <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
              {(() => {
                const differingCourseCodes: string[] = [];
                const firstV = generatorPreviewTimetable.variants![0];
                firstV.courses.forEach(baseCourse => {
                  const hasDifference = generatorPreviewTimetable.variants!.some(v => {
                    const vCourse = v.courses.find(c => c.code === baseCourse.code);
                    return vCourse && vCourse.faculty !== baseCourse.faculty;
                  });
                  if (hasDifference) differingCourseCodes.push(baseCourse.code);
                });

                const filteredVariants = generatorPreviewTimetable.variants!.filter(v => {
                  if (!variantSearchQuery) return true;
                  const query = variantSearchQuery.toLowerCase();
                  return v.courses.some(c => c.faculty.toLowerCase().includes(query));
                });

                if (filteredVariants.length === 0) {
                  return (
                    <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-border-strong/50 rounded-xl m-2">
                      <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <span className="text-muted-foreground font-medium">No variants found</span>
                      <span className="text-xs text-muted-foreground/70 mt-1">Try a different search term</span>
                    </div>
                  );
                }

                return filteredVariants.map((v) => {
                  const isSelected = generatorPreviewTimetable.id === v.id;
                  
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setGeneratorPreviewTimetable({ ...v, variants: generatorPreviewTimetable.variants });
                        setIsVariantSearchOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 my-0.5 rounded-xl transition-colors flex flex-col gap-2 
                        ${isSelected ? 'bg-amber-500/10 border border-amber-500/20 shadow-sm' : 'border border-transparent hover:bg-surface-secondary/80'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-text-heading">
                          Variant {generatorPreviewTimetable.variants!.findIndex(x => x.id === v.id) + 1}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">Selected</span>
                        )}
                      </div>
                      
                      {differingCourseCodes.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1 border-t border-border-strong/30 pt-2">
                          {differingCourseCodes.map(code => {
                            const c = v.courses.find(x => x.code === code);
                            return c ? (
                              <div key={code} className="flex justify-between items-center text-xs">
                                <span className="font-medium text-muted-foreground">{code}</span>
                                <div className="flex items-center gap-1.5">
                                  <FacultyAvatar
                                    employeeId={c.employeeId}
                                    name={c.faculty}
                                    size="xs"
                                    tone="amber"
                                  />
                                  <span className="text-text-heading">{c.faculty}</span>
                                  <VitfacReviewPill
                                    employeeId={c.employeeId}
                                    name={c.faculty}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReviewSheetTarget({
                                        name: c.faculty,
                                        employeeId: c.employeeId,
                                        courseCode: code,
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </BottomSheet>
      )}</AnimatePresence>

      {/* Same-slot faculty swap: tapped from a Faculty cell in the Selected
          Courses table — one sheet level deeper in the overlay stack, the same
          z pair as the variant search above. */}
      <AnimatePresence>{slotSwapRow && generatorPreviewTimetable && (
        <SlotFacultySwapSheet
          code={slotSwapRow.code}
          courseTitle={slotSwapRow.title}
          halves={generatorPreviewTimetable.courses.filter((c) => slotSwapRow.ids.includes(c.id))}
          masterCourses={masterCourses}
          allTimetableCourses={generatorPreviewTimetable.courses}
          blockedSlots={blockedSlots}
          onSwap={swapSlotFaculty}
          onClose={() => setSlotSwapRow(null)}
        />
      )}</AnimatePresence>

      <FacultyReviewSheet
        open={!!reviewSheetTarget}
        onClose={() => setReviewSheetTarget(null)}
        facultyName={reviewSheetTarget?.name || ""}
        employeeId={reviewSheetTarget?.employeeId}
        courseCode={reviewSheetTarget?.courseCode}
      />

      <FFCSGeneratorViewModeModal
        isOpen={isViewModeModalOpen}
        onClose={() => setIsViewModeModalOpen(false)}
        currentMode={generatorViewMode}
        onSelectMode={selectGeneratorViewMode}
      />

      <FFCSGeneratorRunSummaryModal
        isOpen={isRunSummaryOpen}
        onClose={() => setIsRunSummaryOpen(false)}
        onConfirm={generateTimetables}
        isGenerating={isGenerating}
        courses={generatorTargets.map(t => ({
          code: t.code,
          title: t.title,
          offeringCount: t.offerings?.length ?? 0,
        }))}
        blockedSlotCount={blockedSlots.size}
        noResultCap={generatorNoLimit}
        resultCap={generatorResultCap}
        preference={generatorPreference}
        rankingLabel={rankingMode ?? generatorSortBy}
        friendsSelected={generatorMaximizeFreeTimeFriends.length}
        syncFriendsClasses={generatorSyncFriendsClasses}
      />
    </>
  );
}

/* ── responsive KPI strip (planner-aligned) ────────────────────────────── */

type GeneratorStatTile = {
  id: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  tone: string;
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  focusRingClass?: string;
};

/**
 * Same fit → overflow → InsightCarousel behaviour as the planner dashboard
 * strip: measure the row, keep as many 280px tiles as fit, and rotate the rest.
 */
function ResponsiveStatStrip({
  tiles,
  preferredId,
  ariaLabel,
  carouselAriaLabel,
  testId,
}: {
  tiles: GeneratorStatTile[];
  preferredId: string;
  ariaLabel: string;
  carouselAriaLabel: string;
  testId?: string;
}) {
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [statTileCount, setStatTileCount] = useState(4);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
      updateViewport();
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

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

  const statSlides = useMemo<InsightSlide[]>(
    () =>
      tiles.map((tile) => ({
        id: tile.id,
        label: tile.label,
        value: tile.value,
        sub: tile.sub,
        badge: tile.badge,
        tone: tile.tone,
        onClick: tile.onClick,
        valueClassName: "text-xl sm:text-2xl leading-tight whitespace-normal break-words",
      })),
    [tiles]
  );

  const hasStatOverflow = tiles.length > statTileCount;
  const directTileCount = hasStatOverflow
    ? Math.max(0, statTileCount - 1)
    : tiles.length;
  const preferredTile = tiles.find((tile) => tile.id === preferredId);
  const desktopDirectTiles = hasStatOverflow
    ? [
        ...(directTileCount > 0 && preferredTile ? [preferredTile] : []),
        ...tiles
          .filter((tile) => tile.id !== preferredId)
          .slice(0, directTileCount - (directTileCount > 0 && preferredTile ? 1 : 0)),
      ]
    : tiles;
  const mobileDirectTiles = [
    ...(preferredTile ? [preferredTile] : []),
    ...tiles.filter((tile) => tile.id !== preferredId),
  ].slice(0, 1);
  const directTiles = isMobileViewport ? mobileDirectTiles : desktopDirectTiles;
  const directStatIds = new Set(directTiles.map((tile) => tile.id));
  const overflowSlides = statSlides.filter((slide) => !directStatIds.has(slide.id));
  const statCarousel = useCarousel(overflowSlides.length);
  const statColumnCount = isMobileViewport
    ? 2
    : Math.max(1, directTiles.length + (overflowSlides.length > 0 ? 1 : 0));

  if (tiles.length === 0) return null;

  return (
    <div
      ref={statsContainerRef}
      data-testid={testId}
      aria-label={ariaLabel}
      className="grid gap-3"
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
            icon={tile.icon}
            tone={tile.tone}
            height="h-28 sm:h-32"
            className={tile.onClick ? "" : tile.className ?? ""}
          />
        );
        if (!tile.onClick) {
          return <React.Fragment key={tile.id}>{statTile}</React.Fragment>;
        }
        return (
          <button
            key={tile.id}
            type="button"
            onClick={tile.onClick}
            aria-label={tile.ariaLabel ?? tile.label}
            className={`min-w-0 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 ${
              tile.focusRingClass ?? "focus-visible:ring-indigo-500"
            }`}
          >
            {statTile}
          </button>
        );
      })}
      {overflowSlides.length > 0 && (
        <InsightCarousel
          slides={overflowSlides}
          carousel={statCarousel}
          height="h-28 sm:h-32"
          ariaLabel={carouselAriaLabel}
          className="min-w-0"
        />
      )}
    </div>
  );
}

/**
 * A single staged option card.
 *
 * Extracted from the grid's inline map as the render-side half of the
 * streaming freeze fix, alongside the render window: a watched run moved the
 * progress line and the option list many times a second, and the inline map
 * re-diffed every card on every tick — reading thousands of subtrees for
 * content that had not changed.
 *
 * Its props are chosen so that streaming re-renders cannot reach here at all:
 * the timetable object is replaced only when a run settles or a faculty swap
 * writes back into it, the selection set and compare set are replaced only
 * when the student clicks, and the state setters are stable — so a batch or
 * progress tick re-renders nothing, while a click still lands on exactly the
 * cards whose selection it changed.
 */
interface StagedCardProps {
  tt: TimetableState;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  compareIds: string[];
  setCompareIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** `generatorMaximizeFreeTimeFriends.length > 0`, flattened to a boolean so
   * the array's identity cannot mark the card dirty. */
  socialOn: boolean;
  onPreview: (tt: TimetableState) => void;
}

const StagedCard = memo(function StagedCard({
  tt, selectedIds, setSelectedIds, compareIds, setCompareIds, socialOn, onPreview,
}: StagedCardProps) {
  const optionSchema = getTimetableSchema();
  const occupancyByDay = DAYS_OF_WEEK.map((day) => dayOccupancy(tt.courses, optionSchema, day));
  const occupiedClasses = occupancyByDay.flatMap((occupancy) => occupancy.classes);
  const latestEnd = occupiedClasses.slice().sort((a, b) => b.endMin - a.endMin)[0]?.end;
  const wPct = tt.facultySummary?.averageWPct;
  const wRatingTone =
    wPct == null
      ? "text-muted-foreground"
      : wPct >= 70
        ? "text-green-600 dark:text-green-400"
        : wPct >= 50
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400";
  return (
    <div
      className={`relative flex flex-col bg-surface rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${selectedIds.has(tt.id) ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-border-strong hover:border-amber-500/50 hover:shadow-lg'}`}
      onClick={() => {
        const newSet = new Set(selectedIds);
        if (newSet.has(tt.id)) {
          newSet.delete(tt.id);
          if (tt.variants) tt.variants.forEach(v => newSet.delete(v.id));
        } else {
          newSet.add(tt.id);
          if (tt.variants) tt.variants.forEach(v => newSet.add(v.id));
        }
        setSelectedIds(newSet);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onPreview(tt);
      }}
    >
      <div className="p-3 sm:p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-center gap-2 mb-2 sm:mb-4">
          <h3 className="font-bold text-sm sm:text-lg text-text-heading">{tt.name}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCompareIds(prev => {
                  if (prev.includes(tt.id)) return prev.filter(id => id !== tt.id);
                  if (prev.length >= 3) return prev; // max 3
                  return [...prev, tt.id];
                });
              }}
              className={`hidden sm:inline-flex min-h-10 sm:min-h-0 text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-colors ${compareIds.includes(tt.id) ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent text-muted-foreground border-border-strong hover:border-purple-500/50'}`}
            >
              Compare
            </button>
            <div className="flex items-center gap-2 text-right">
              {tt.rankingScore !== undefined && (
                <span className="font-mono text-xs font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {tt.rankingScore.toFixed(0)} pts
                </span>
              )}
              {tt.facultySummary && (
                <span className={`font-mono text-xs font-bold tabular-nums ${wRatingTone}`}>
                  W {wPct == null ? "—" : `${wPct.toFixed(0)}%`}
                </span>
              )}
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(tt.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/30'}`}>
              {selectedIds.has(tt.id) && <Check className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <div className="sm:hidden mb-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {tt.metrics?.halfDays ?? 0} free half-days
          </span>
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {formatHours(tt.metrics?.gaps ?? 0)}h gaps
          </span>
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {occupancyByDay.filter((occupancy) => occupancy.classes.length > 0).length} class days
          </span>
          {latestEnd && (
            <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
              ends {latestEnd}
            </span>
          )}
          {socialOn && (
            <span className="rounded-md bg-pink-500/10 px-2 py-1 text-[10px] font-semibold text-pink-600 dark:text-pink-400">
              Social {tt.metrics?.socialScore ?? 0}
            </span>
          )}
          {tt.metrics?.isLongWeekend && (
            <span className="rounded-md bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
              Long weekend
            </span>
          )}
        </div>

        <div className="hidden sm:grid grid-cols-2 gap-3 mb-4 flex-1 content-start">
          <div className="bg-surface-secondary/30 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-text-heading">{tt.metrics?.halfDays}</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Free Half-Days</span>
          </div>
          <div className="bg-surface-secondary/30 rounded-xl p-3 flex flex-col items-center justify-center text-center group relative">
            <span className="text-2xl font-black text-text-heading">{formatHours(tt.metrics?.gaps ?? 0)}h</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Gaps</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(tt.metrics?.gapsPerDay || {}).map(([day, gap]) => (
                <div key={day} className="flex justify-between gap-3">
                  <span className="font-bold text-slate-400 uppercase">{day}</span>
                  <span>{formatHours(gap)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {tt.facultySummary && (
          <div className="hidden sm:block mb-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-300">Faculty reviews</span>
              <span className="font-semibold text-text-heading">
                {tt.facultySummary.averageWPct == null
                  ? "No ratings"
                  : `${tt.facultySummary.averageWPct.toFixed(1)}% W`}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {tt.facultySummary.ratedFacultyCount} reviewed · {tt.facultySummary.unratedFacultyCount} unrated
            </p>
          </div>
        )}

        {tt.metrics?.isLongWeekend && (
          <div className="hidden sm:flex bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 items-center justify-center gap-1.5">
             Long Weekend!
          </div>
        )}
        {(tt.metrics?.buildingDashes ?? 0) > 0 && (
          <div className="hidden sm:flex bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 items-center justify-center gap-1.5">
             {tt.metrics?.buildingDashes} Block Dash{(tt.metrics?.buildingDashes ?? 0) > 1 ? 'es' : ''}
          </div>
        )}

        {socialOn && (
          <div className="hidden sm:block bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-auto mb-3">
            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
            </div>
            <div className="text-[10px] text-muted-foreground truncate" title={tt.metrics?.bestFriendMatches.join(', ')}>
              Matches best with: <span className="font-medium text-text-heading">{tt.metrics?.bestFriendMatches.join(', ') || 'None'}</span>
            </div>
          </div>
        )}

        <div className="sm:hidden mt-auto flex gap-2 border-t border-border-strong/50 pt-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPreview(tt);
            }}
            aria-label={`Preview ${tt.name}`}
            className="min-h-10 flex-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 text-xs font-bold text-indigo-700 dark:text-indigo-300"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCompareIds((prev) => {
                if (prev.includes(tt.id)) return prev.filter((id) => id !== tt.id);
                if (prev.length >= 3) return prev;
                return [...prev, tt.id];
              });
            }}
            aria-pressed={compareIds.includes(tt.id)}
            className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold ${
              compareIds.includes(tt.id)
                ? "border-purple-500 bg-purple-500 text-white"
                : "border-border-strong bg-surface text-muted-foreground"
            }`}
          >
            {compareIds.includes(tt.id) ? "Comparing" : "Compare"}
          </button>
        </div>

        {tt.variants && tt.variants.length > 1 && (
          <div className="hidden sm:block mt-auto pt-4 border-t border-border-strong/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Faculty Variants</span>
              <span className="text-[10px] bg-surface-secondary px-2 py-0.5 rounded-full">{tt.variants.length} available</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
              {tt.variants.slice(0, 50).map((v, vIdx) => {
                const isSelected = selectedIds.has(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSet = new Set(selectedIds);
                      if (isSelected) newSet.delete(v.id);
                      else newSet.add(v.id);

                      if (isSelected && newSet.has(tt.id)) newSet.delete(tt.id);
                      if (!isSelected && !newSet.has(tt.id)) newSet.add(tt.id);

                      setSelectedIds(newSet);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${isSelected ? 'bg-amber-500/10 border-amber-500/50 text-text-heading' : 'bg-surface border-border-strong text-muted-foreground hover:border-amber-500/30'}`}
                  >
                    <span className="font-medium">Variant {vIdx + 1}</span>
                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/30'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
              {tt.variants.length > 50 && (
                <div className="p-2 text-xs text-center text-muted-foreground bg-surface-secondary/20 rounded-lg">
                  + {tt.variants.length - 50} more variations
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
