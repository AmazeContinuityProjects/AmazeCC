import React, { memo, useState, useMemo, useEffect } from 'react';
import { X, Wand2, Info, ChevronDown, Check, Beaker, Play, Lock, Hash, ArrowRight, Search, AlertTriangle, ArrowLeft, Save, Users } from 'lucide-react';
import { TimetableState, CourseLock, Friend, FriendGroup, ParsedCourse, AddedCourse } from './types';
import { getBatchColorClass } from '@/lib/utils';
import { sortTimetables, timetableMetrics, formatHours, type SortBy } from '@/lib/timetableMetrics';
import { periodsForSlot } from '@/lib/slots';
import { useOverlayBack } from '@/lib/overlayStack';
import { type GeneratorErrorCode } from './logic/generator';
import { useGenerationRun } from './hooks/useGenerationRun';
import { RANKING_MODES, type RankingMode } from '@/lib/ffcsRanking';
import { track } from '@/lib/analytics';
import type { FFCSSettings } from '@/lib/ffcsSettings';
import SearchInput from "../../shared/SearchInput";
import { GLOBAL_CAMPUS, getTimetableSchema, calculatePairwiseSocialScore, safeStorage } from '../FFCSTimetableTab';
import { COLORS, DAYS } from './constants';
import { offeringId, offeringMatches } from './reports';
import { splitSlots, HARD_RESULT_LIMIT, sameSlotFacultyAlternatives, expandCourseHalves } from './logic/generate';
import { TimetableGrid, GapDetail } from './components/TimetableGrid';
import SlotFacultySwapSheet from './components/SlotFacultySwapSheet';
import { PageShell, SegmentedControl, RadioGroup } from "../../shared/primitives";
import { AnimatePresence } from 'framer-motion';
import BottomSheet from "../../shared/BottomSheet";
import { loadSessionPreferences, saveSessionPreferences } from "@/lib/ffcsGeneratorSessionPrefs";
import FacultyReviewSheet, { VitfacReviewPill, FacultyAvatar } from './components/FacultyReviewSheet';

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
    description: "Prioritize theory lectures in the morning and labs in the afternoon.",
  },
  {
    value: "evening" as const,
    label: "Evening Theory Preferred",
    description: "Prioritize theory lectures in the afternoon/evening and labs in the morning.",
  },
] as const;

const GENERATOR_RANKING_OPTIONS = [
  {
    value: "default" as const,
    label: "Sort Order Only (Off)",
    description: "No weighted profile — options are ordered purely by the sort order above.",
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

  const [generatorPreference, setGeneratorPreference] = useState<"compact" | "spread" | "morning" | "evening">(
    () => sessionPrefs.preference ?? "compact"
  );
  const [generatorUniqueFaculties, setGeneratorUniqueFaculties] = useState<boolean>(
    () => sessionPrefs.uniqueFaculties ?? false
  );
  const [generatorNoLimit, setGeneratorNoLimit] = useState<boolean>(
    () => sessionPrefs.noLimit ?? false
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
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState<boolean>(
    () => sessionPrefs.syncFriendsClasses ?? sessionPrefs.syncFriendClasses ?? false
  );
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>(
    () => sessionPrefs.maximizeFreeTimeFriends ?? []
  );

  useEffect(() => {
    saveSessionPreferences({
      preference: generatorPreference,
      uniqueFaculties: generatorUniqueFaculties,
      noLimit: generatorNoLimit,
      rankingMode,
      minHalfDays: generatorMinHalfDays,
      minStartTime: generatorMinStartTime,
      maxEndTime: generatorMaxEndTime,
      sortBy: generatorSortBy,
      syncFriendsClasses: generatorSyncFriendsClasses,
      syncFriendClasses: generatorSyncFriendsClasses,
      maximizeFreeTimeFriends: generatorMaximizeFreeTimeFriends,
      targets: generatorTargets,
      isReviewing,
    });
  }, [
    generatorPreference,
    generatorUniqueFaculties,
    generatorNoLimit,
    rankingMode,
    generatorMinHalfDays,
    generatorMinStartTime,
    generatorMaxEndTime,
    generatorSortBy,
    generatorSyncFriendsClasses,
    generatorMaximizeFreeTimeFriends,
    generatorTargets,
    isReviewing,
  ]);
  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");
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
  const getPeriodsForSlot = (slot: string) =>
    periodsForSlot({ theory: theoryPeriods, lab: labPeriods }, slot);

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
  const uniqueCourseCodes = Array.from(new Set(masterCourses.map(c => c.CODE)));


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
        syncFriendClasses: generatorSyncFriendsClasses,
        maximizeFreeTimeFriends: generatorMaximizeFreeTimeFriends,
        minStartTime: generatorMinStartTime,
        maxEndTime: generatorMaxEndTime,
        uniqueFaculties: generatorUniqueFaculties,
        noLimit: generatorNoLimit,
        // The settings cap only binds while the per-run switch leaves the
        // search bounded — the switch is the more recent thing chosen.
        resultCap: settings.resultCap,
        minHalfDays: generatorMinHalfDays,
        sortBy: generatorSortBy,
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-text-heading text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
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
        className="px-2.5 sm:px-3 py-2 text-xs font-bold text-muted-foreground hover:text-red-500 rounded-xl transition-colors cursor-pointer"
      >
        Discard All
      </button>
      <button
        type="button"
        disabled={selectedStagedIds.size === 0}
        onClick={saveSelectedTimetables}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" /> Save Selected ({selectedStagedIds.size})
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
        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold py-2 px-4 rounded-xl shadow-md hover:shadow-amber-500/25 transition-all cursor-pointer"
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
        className="!max-w-6xl px-4 sm:px-6"
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

          <div className="flex justify-center">
            {generatorPreviewTimetable ? (
              <>
              <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface rounded-2xl border border-border-strong p-4 flex flex-col justify-center items-center text-center shadow-sm">
                    <span className="text-2xl font-black text-text-heading">{generatorPreviewTimetable.metrics?.halfDays}</span>
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mt-1">Free Half-Days</span>
                  </div>
                  
                  <div 
                    className="bg-surface rounded-2xl border border-border-strong p-4 flex flex-col justify-center items-center text-center shadow-sm relative group cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                    onClick={() => setSelectedGapDetails(generatorPreviewTimetable.metrics?.gapDetails || null)}
                  >
                    <span className="text-2xl font-black text-text-heading">{formatHours(generatorPreviewTimetable.metrics?.gaps ?? 0)}h</span>
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mt-1">Total Gaps</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max min-w-[200px] bg-slate-900 text-white text-[10px] p-3 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {Object.entries(generatorPreviewTimetable.metrics?.gapsPerDay || {}).map(([day, gap]) => (
                        <div key={day} className="flex justify-between gap-3">
                          <span className="font-bold text-slate-400 uppercase">{day}</span>
                          <span>{formatHours(gap)}h</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(generatorPreviewTimetable.metrics?.buildingDashes ?? 0) > 0 ? (
                    <div 
                      className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-sm cursor-pointer hover:bg-red-500/20 transition-colors"
                      onClick={() => setSelectedDashDetails(generatorPreviewTimetable.metrics?.dashDetails || null)}
                    >
                      <span className="text-2xl font-black text-red-500">{generatorPreviewTimetable.metrics?.buildingDashes}</span>
                      <span className="text-xs uppercase font-bold text-red-500/80 tracking-wider mt-1">Block Dashes</span>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-sm">
                      <span className="text-2xl font-black text-green-500">0</span>
                      <span className="text-xs uppercase font-bold text-green-500/80 tracking-wider mt-1">Block Dashes</span>
                    </div>
                  )}

                  <div 
                    className="flex flex-col items-center justify-center p-3 bg-card border border-border-strong/50 rounded-xl shadow-sm cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                    onClick={() => alert("Social Matrix is available in the main tab")}
                  >
                    <span className="text-3xl font-black text-pink-500">{generatorPreviewTimetable.metrics?.socialScore}%</span>
                    <span className="text-xs uppercase font-bold text-pink-500/80 tracking-wider mt-1">Social Score</span>
                  </div>
                </div>

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
              <div className="w-full max-w-6xl flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border-strong shadow-sm">
                  <div>
                    <h2 className="text-2xl font-bold text-text-heading">Review Timetables</h2>
                    <p className="text-muted-foreground mt-1">Select the ones you like, or <b className="text-text-heading">double-click</b> any card to instantly save and view it.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsReviewing(false)}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-text-heading transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Options
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setStagedTimetables([]);
                        setSelectedStagedIds(new Set());
                        setIsReviewing(false);
                      }}
                      className="px-4 py-2 text-sm font-bold bg-surface-secondary hover:bg-surface-secondary/80 text-muted-foreground rounded-xl transition-colors cursor-pointer"
                    >
                      Discard All
                    </button>
                    <button 
                      type="button"
                      disabled={selectedStagedIds.size === 0}
                      onClick={saveSelectedTimetables}
                      className="px-6 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Save Selected ({selectedStagedIds.size})
                    </button>
                  </div>
                </div>

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
            <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Left Column: Courses Selection */}
              <div className="flex flex-col gap-6 min-w-0">
                <div className="bg-surface rounded-2xl border border-border-strong p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-text-heading flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span> 
                        Target Courses
                      </h3>
                      <p className="text-sm text-muted-foreground">Select the courses you want to take and optionally filter faculties/slots.</p>
                    </div>
                  </div>
                  
                  <SearchInput placeholder="Search by course code or title..." value={generatorCourseSearchQuery} onChange={e => setGeneratorCourseSearchQuery(e.target.value)} containerClassName="mb-3" />

                  <div className="border border-border-strong rounded-xl max-h-[60vh] overflow-y-auto bg-surface-secondary/10 p-3 grid grid-cols-1 gap-2 custom-scrollbar">
                    {generatorDisplayCourses.filter(c => 
                      c.code.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase()) || 
                      c.title.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No courses found matching "{generatorCourseSearchQuery}"
                      </div>
                    )}
                    {generatorDisplayCourses.filter(c => 
                      c.code.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase()) || 
                      c.title.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase())
                    ).map(c => {
                      const sel = generatorTargets.find(s => s.code === c.code);
                          const isSelected = !!sel;
                          
                          const courseOpts = masterCourses.filter(mc => mc.CODE === c.code);
                          const uniqueOfferings = Array.from(new Map(courseOpts.map(opt => {
                            const legacyId = `${opt.FACULTY}|${opt.SLOT}|${opt.ROOM}`;
                            const id = offeringId(opt);
                            return [id, {
                              faculty: opt.FACULTY,
                              slot: opt.SLOT,
                              venue: opt.ROOM,
                              employeeId: opt.ERP_ID || "",
                              classId: opt.CLASS_ID || "",
                              legacyId,
                              id,
                            }];
                          })).values()).sort((a, b) =>
                            a.faculty.localeCompare(b.faculty) ||
                            a.slot.localeCompare(b.slot) ||
                            a.employeeId.localeCompare(b.employeeId)
                          );

                          const offeringsByFac = uniqueOfferings.reduce((acc, curr) => {
                            if (!acc[curr.faculty]) acc[curr.faculty] = [];
                            acc[curr.faculty].push(curr);
                            return acc;
                          }, {} as Record<string, typeof uniqueOfferings>);

                          const sortedFacs = Object.keys(offeringsByFac).sort();

                          return (
                            <div key={c.code} className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isSelected ? 'bg-surface-secondary/30 border-amber-500/50 shadow-sm' : 'bg-transparent border-transparent hover:border-border-strong hover:bg-surface-secondary/50'}`}>
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="mt-1 rounded bg-surface border-border-strong text-amber-500 focus:ring-amber-500/30"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setGeneratorTargets(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [], offerings: [] }]);
                                    else setGeneratorTargets(prev => prev.filter(s => s.code !== c.code));
                                  }}
                                />
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-base text-text-heading">{c.code}</span>
                                     {renderTypeChips(c.types || [], 'sm')}
                                  </div>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{c.title}</span>
                                </div>
                              </label>

                              {isSelected && uniqueOfferings.length > 1 && (() => {
                                const availableSeries = Array.from(new Set(
                                  uniqueOfferings.map(o => {
                                    const firstSlot = o.slot.split('+')[0].trim().toUpperCase();
                                    const match = firstSlot.match(/^[T]?([A-G])/);
                                    return match ? match[1] : null;
                                  }).filter(Boolean) as string[]
                                )).sort();

                                return (
                                  <div className="pl-8 mt-2">
                                    <div className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Filter Offerings (Optional)</div>
                                    
                                    {availableSeries.length > 0 && (
                                      <div className="mb-3">
                                        <div className="text-[10px] font-bold text-text-heading/70 mb-1.5 uppercase">Quick Select Series</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {availableSeries.map(series => {
                                            const seriesOfferings = uniqueOfferings.filter(o => {
                                              const firstSlot = o.slot.split('+')[0].trim().toUpperCase();
                                              const match = firstSlot.match(/^[T]?([A-G])/);
                                              return match && match[1] === series;
                                            });
                                            const allSelected = seriesOfferings.every(o =>
                                              offeringMatches(
                                                { FACULTY: o.faculty, SLOT: o.slot, ROOM: o.venue, ERP_ID: o.employeeId },
                                                sel.offerings || []
                                              )
                                            );
                                            
                                            return (
                                              <button
                                                key={series}
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setGeneratorTargets(prev => prev.map(p => {
                                                    if (p.code !== c.code) return p;
                                                    let newOfferings = [...(p.offerings || [])];
                                                    if (allSelected) {
                                                      const removing = new Set(seriesOfferings.flatMap(o => [o.id, o.legacyId]));
                                                      newOfferings = newOfferings.filter(id => !removing.has(id));
                                                    } else {
                                                      seriesOfferings.forEach(o => {
                                                        if (!newOfferings.includes(o.id)) newOfferings.push(o.id);
                                                      });
                                                    }
                                                    return { ...p, offerings: newOfferings };
                                                  }));
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                                  allSelected 
                                                    ? 'bg-amber-500 text-white shadow-sm' 
                                                    : 'bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70'
                                                }`}
                                              >
                                                {series} Series
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 bg-surface/50 border border-border-strong/50 rounded-lg p-3">
                                    {sortedFacs.map(fac => (
                                      <div key={fac} className="flex flex-col gap-1.5">
                                        <div className="text-xs font-semibold text-text-heading/90 pb-1 border-b border-border-strong/50 flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <FacultyAvatar
                                              employeeId={offeringsByFac[fac][0]?.employeeId}
                                              name={fac}
                                              size="xs"
                                              tone="amber"
                                            />
                                            <span className="truncate">{fac}</span>
                                          </div>
                                          <VitfacReviewPill
                                            employeeId={offeringsByFac[fac][0]?.employeeId}
                                            name={fac}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReviewSheetTarget({
                                                name: fac,
                                                employeeId: offeringsByFac[fac][0]?.employeeId,
                                                courseCode: c.code,
                                              });
                                            }}
                                          />
                                        </div>
                                        {offeringsByFac[fac].map(offering => {
                                          const isOffChecked = offeringMatches(
                                            { FACULTY: offering.faculty, SLOT: offering.slot, ROOM: offering.venue, ERP_ID: offering.employeeId },
                                            sel.offerings || []
                                          );
                                          return (
                                            <label
                                              key={offering.id}
                                              className="flex items-start gap-2 cursor-pointer hover:bg-surface-secondary/50 p-1.5 rounded-md transition-colors"
                                              title={offering.classId ? `Class ${offering.classId}` : undefined}
                                            >
                                              <input 
                                                type="checkbox" 
                                                className="mt-0.5 rounded w-3.5 h-3.5 border-border-strong text-amber-500 focus:ring-amber-500/30"
                                                checked={isOffChecked}
                                                onChange={(e) => {
                                                  setGeneratorTargets(prev => prev.map(p => {
                                                    if (p.code !== c.code) return p;
                                                    if (e.target.checked) {
                                                      const next = (p.offerings || []).filter(id => id !== offering.id);
                                                      return { ...p, offerings: [...next, offering.id] };
                                                    }
                                                    return {
                                                      ...p,
                                                      offerings: (p.offerings || []).filter(
                                                        id => id !== offering.id && id !== offering.legacyId
                                                      ),
                                                    };
                                                  }));
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                  <span className={`text-[11px] font-medium ${isOffChecked ? 'text-amber-500' : 'text-text-heading/80'}`}>{offering.slot}</span>
                                                  {(() => {
                                                    const alts = sameSlotFacultyAlternatives(
                                                      c.code,
                                                      splitSlots(offering.slot),
                                                      { faculty: offering.faculty, employeeId: offering.employeeId },
                                                      masterCourses
                                                    );
                                                    const count = 1 + alts.length;
                                                    return (
                                                      <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1 py-0.2 rounded bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0"
                                                        title={`${count} ${count === 1 ? 'faculty' : 'faculties'} teaching this slot`}
                                                      >
                                                        <Users className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                                                        <span>{count}</span>
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                  {offering.venue || (offering.employeeId ? `ERP ${offering.employeeId}` : "TBA")}
                                                </span>
                                              </div>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                  {sel.offerings && sel.offerings.length > 0 && (
                                    <div className="text-xs text-amber-500 mt-2 font-medium">
                                       Filtering by {sel.offerings.length} selected offering{sel.offerings.length === 1 ? '' : 's'}
                                    </div>
                                  )}
                                  </div>
                                )})()}
                            </div>
                          );
                        })}
                        {uniqueCourseCodes.length === 0 && (
                          <div className="col-span-full p-10 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-xl border border-dashed border-border-strong">
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
              <div className="flex flex-col gap-6 min-w-0">
                
                {/* General Preferences */}
                <div className="bg-surface rounded-2xl border border-border-strong p-6 shadow-sm">
                  <h3 className="font-semibold text-lg mb-4 text-text-heading flex items-center gap-2">
                    <span className="bg-blue-500/10 text-blue-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span> 
                    Preferences
                  </h3>
                  
                  <div className="space-y-5">
                    <div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-text-heading block mb-1.5 flex items-center gap-2">
                          Min Start Time
                        </label>
                        <input 
                          type="time"
                          value={generatorMinStartTime}
                          onChange={(e) => setGeneratorMinStartTime(e.target.value)}
                          className="w-full bg-surface-secondary/30 border border-border-strong rounded-xl px-4 py-3 text-sm text-text-heading focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-text-heading block mb-1.5 flex items-center gap-2">
                          Max End Time
                        </label>
                        <input 
                          type="time"
                          value={generatorMaxEndTime}
                          onChange={(e) => setGeneratorMaxEndTime(e.target.value)}
                          className="w-full bg-surface-secondary/30 border border-border-strong rounded-xl px-4 py-3 text-sm text-text-heading focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-text-heading block mb-2">
                        Time Preference
                      </label>
                      <RadioGroup
                        name="generatorPreference"
                        options={GENERATOR_TIME_PREFERENCE_OPTIONS}
                        value={generatorPreference}
                        onChange={(val) => setGeneratorPreference(val as any)}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
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
                        <span className="text-sm font-medium text-text-heading">Remove 50 Timetables Limit</span>
                      </label>
                    </div>

                    <div>
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
                  </div>
                </div>

                {/* Social Preferences */}
                <div className="bg-surface rounded-2xl border border-border-strong p-6 shadow-sm">
                  <h3 className="font-semibold text-lg mb-4 text-text-heading flex items-center gap-2">
                    <span className="bg-pink-500/10 text-pink-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span> 
                    Social Preferences
                  </h3>
                  
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
                <div className="col-span-1 lg:col-span-2 pt-6 pb-12 flex justify-center">
                  <button
                    type="button"
                    onClick={generateTimetables}
                    disabled={isGenerating || generatorTargets.length === 0}
                    className="w-full sm:w-auto min-w-[260px] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold py-3.5 px-8 rounded-2xl shadow-lg hover:shadow-amber-500/25 transition-all cursor-pointer"
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
    </>
  );
}

/* ── one option card ───────────────────────────────────────────────────── */

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
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-lg text-text-heading">{tt.name}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCompareIds(prev => {
                  if (prev.includes(tt.id)) return prev.filter(id => id !== tt.id);
                  if (prev.length >= 3) return prev; // max 3
                  return [...prev, tt.id];
                });
              }}
              className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-colors ${compareIds.includes(tt.id) ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent text-muted-foreground border-border-strong hover:border-purple-500/50'}`}
            >
              Compare
            </button>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(tt.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/30'}`}>
              {selectedIds.has(tt.id) && <Check className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 flex-1 content-start">
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

        {tt.metrics?.isLongWeekend && (
          <div className="bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 flex items-center justify-center gap-1.5">
             Long Weekend!
          </div>
        )}
        {(tt.metrics?.buildingDashes ?? 0) > 0 && (
          <div className="bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 flex items-center justify-center gap-1.5">
             {tt.metrics?.buildingDashes} Block Dash{(tt.metrics?.buildingDashes ?? 0) > 1 ? 'es' : ''}
          </div>
        )}

        {socialOn && (
          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-auto mb-3">
            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
            </div>
            <div className="text-[10px] text-muted-foreground truncate" title={tt.metrics?.bestFriendMatches.join(', ')}>
              Matches best with: <span className="font-medium text-text-heading">{tt.metrics?.bestFriendMatches.join(', ') || 'None'}</span>
            </div>
          </div>
        )}

        {tt.variants && tt.variants.length > 1 && (
          <div className="mt-auto pt-4 border-t border-border-strong/50">
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
