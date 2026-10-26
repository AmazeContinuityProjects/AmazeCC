"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Trash2, AlertTriangle, Info, Map as MapIcon, Plus, Edit2, Check, Maximize2, Minimize2, Upload, X, Settings2, Users, Eye, HelpCircle, Share2, Search, Lock, Keyboard, Compass, LayoutDashboard, BookOpen, Sparkles, CalendarDays, ChevronDown, ClipboardPaste, Copy, Download, ExternalLink, FileText, PlusCircle, Printer, Save, Wand2, ListFilter, PanelsTopLeft, Image, Code2, Megaphone, LogIn } from "lucide-react";

import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import { useTheme } from "next-themes";
import ThemeToggle from "@/components/custom/ThemeToggle";
import { AnimatePresence } from "framer-motion";
import BottomSheet from "../shared/BottomSheet";
import FFCSGuideModal from "./FFCSGuideModal";
import FFCSLayoutModeModal from "./FFCS/components/modals/FFCSLayoutModeModal";
import FFCSDashboardHeader from "./FFCS/components/FFCSDashboardHeader";
import { downloadTimetableImage, downloadModernTimetableImage, downloadModernCourseListImage, openTimetablePrintablePage, openModernPrintableDossier, downloadModernDossierHtml } from "@/lib/exportTimetable";
import { GLOBAL_CAMPUS, getTimetableSchema } from "@/lib/campusSchema";

// Re-exported because the tab has always been where importers found these;
// the definitions moved to the lib so the share page can render a received
// plan without importing this component.
export { GLOBAL_CAMPUS, getTimetableSchema };

import { FFCSGeneratorSubpage } from './FFCS/FFCSGeneratorSubpage';
import { FriendTimetableViewModal, SelectedFriendTimetableData } from './FFCS/components/modals/FriendTimetableViewModal';
import { SocialMatrixModal } from './FFCS/components/modals/SocialMatrixModal';
import { TargetCoursesModal } from './FFCS/components/modals/TargetCoursesModal';
import PasteRegisteredCoursesModal from './FFCS/components/modals/PasteRegisteredCoursesModal';
import FacultyScheduleModal from './FFCS/components/modals/FacultyScheduleModal';
import SlotFacultySwapSheet from './FFCS/components/SlotFacultySwapSheet';
import FFCSDossierSubpage from './FFCS/components/FFCSDossierSubpage';
import PdfGenerationBadge from './FFCS/components/PdfGenerationBadge';
import { sameSlotFacultyAlternatives, expandCourseHalves } from './FFCS/logic/generate';
import FacultyReviewSheet, { VitfacReviewPill, FacultyAvatar } from './FFCS/components/FacultyReviewSheet';
import FFCSGuidedSelector, { type GuidedPhase } from './FFCS/components/FFCSGuidedSelector';
import { ENABLE_VITFAC_INTEGRATION } from '@/lib/vitfacService';
import { buildFacultyNameGroups } from './FFCS/logic/facultyGroups';
import { mergeCourses } from '@/features/import/importFile';
import { track } from "@/lib/analytics";
import { useFFCSSettings } from "@/lib/ffcsSettings";
import {
  encodeTimetableShare,
  encodeCompactTimetableShare,
  encodeTimetableShapeShare,
  attachReportClassIds,
  buildShareUrl,
  buildCompactShareUrl,
  buildTimetableShapeShareUrl,
  isOversizedShareLink,
} from "@/lib/ffcsShare";
import { FFCSSettingsModal, type FFCSSettingsModalProps } from "./FFCS/components/modals/FFCSSettingsModal";
import { TourProvider, useTour } from "./FFCS/features/tour/TourProvider";
import type { TourStep } from "./FFCS/features/tour/tourSteps";
import { useTips } from "./FFCS/features/tour/useTips";
import { Tip } from "./FFCS/features/tour/Tip";
import Switch from "../shared/primitives/Switch";
import { ChipTabs, SegmentedControl, IconButton, ListRowText, ListShell } from "../shared/primitives";

import { GenCourseSelection, SlotMap, TimetablePeriod, ParsedCourse, AddedCourse, TimetableState, Friend, FriendGroup, CourseLock, ManualLink } from "./FFCS/types";
import {
  DEFAULT_FFCS_SEMESTER,
  FFCS_SEMESTER_REPORTS,
  FFCS_SEMESTER_STORAGE_KEY,
  getFFCSSemester,
  isFFCSSemesterId,
  parseReportRows,
  type FFCSSemesterId,
} from "./FFCS/reports";
import { DAYS, COLORS, typeLabels, typeColors, defaultColor, getCourseBadgeProps } from "./FFCS/constants";
import { isCourseFullyAdded } from "./FFCS/utils";
import { freeHalfDays, pairwiseSocialScore } from "@/lib/timetableMetrics";
import {
  MORNING_BEFORE_MIN,
  courseInPeriod,
  periodsForSlot,
  slotsOverlap,
  splitSlots,
  findPeriodClash,
  type SlotPeriod,
} from "@/lib/slots";
import { exportTimetableIcal } from "@/lib/exportIcal";
import { getBatchColorClass, getAssetPath } from "@/lib/utils";
import { TimetableView, useTimetableViewMode } from "../timetable";

/**
 * localStorage with the SSR guard and the quota throw handled once. The
 * generator imports this too: its own course picks persist under their own
 * key, never under the planner's locks.
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
};






const renderTypeChips = (typesInput: string | string[], size: 'sm' | 'md' = 'md') => {
  if (!typesInput) return null;
  let types = Array.isArray(typesInput) 
    ? [...typesInput] 
    : typesInput.split("+").map(t => t.trim().toUpperCase());
  
  types = types.map(t => t.trim().toUpperCase()).filter(Boolean);

  if (types.includes("ETH") && types.includes("ELA")) {
    types = types.filter(t => t !== "ETH" && t !== "ELA");
    types.push("ETH+ELA");
  }
  if (types.includes("TH") && types.includes("LO")) {
    types = types.filter(t => t !== "TH" && t !== "LO");
    types.push("TH+LO");
  }

  const px = size === 'sm' ? 'px-1.5' : 'px-2';
  const py = size === 'sm' ? 'py-0.5' : 'py-0.5';
  const text = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span className="flex flex-wrap gap-1">
      {types.map(t => {
        const color = typeColors[t] || defaultColor;
        const displayName = typeLabels[t] || t;
        return (
          <span key={t} className={`inline-flex items-center font-bold rounded-md border ${px} ${py} ${text} ${color.bg} ${color.text} ${color.border}`} title={displayName}>
            {displayName}
          </span>
        );
      })}
    </span>
  );
};

/**
 * `timeToMinutes` and `parse24HourToMinutes` used to sit here as well.
 *
 * Both are now in `lib/slots.ts` — the first rejects an unreadable time rather
 * than reporting it as midnight, and the second came along with the generator's
 * time-bounds filter. Neither is referenced in this file any more.
 */

const getGroupedCourses = (courseList: AddedCourse[]) => {
  const groups = new Map<string, AddedCourse & { ids: string[]; batches: string[] }>();
  courseList.forEach(c => {
    if (groups.has(c.code)) {
      const g = groups.get(c.code)!;
      g.ids.push(c.id);
      
      if (!g.faculty.includes(c.faculty)) g.faculty += ` / ${c.faculty}`;
      if (!g.venue.includes(c.venue)) g.venue += ` / ${c.venue}`;
      if (!g.type.includes(c.type)) g.type += ` + ${c.type}`;
      
      c.slots.forEach(s => {
        if (!g.slots.includes(s)) g.slots.push(s);
      });
      
      if (c.batch) {
        c.batch.split(",").map(b => b.trim()).forEach(b => {
          if (b && !g.batches.includes(b)) g.batches.push(b);
        });
      }
      
      g.credits = String(parseFloat(g.credits || "0") + parseFloat(c.credits || "0"));
    } else {
      const batches = c.batch ? c.batch.split(",").map(b => b.trim()).filter(Boolean) : [];
      groups.set(c.code, { ...c, ids: [c.id], faculty: c.faculty, venue: c.venue, type: c.type, slots: [...c.slots], batches });
    }
  });
  return Array.from(groups.values());
};

/**
 * Free half-days for a set of slots.
 *
 * A thin shim over `lib/timetableMetrics`, kept because two callers in this file
 * hold a `Set<string>` of slots rather than a course list. `freeHalfDays` itself
 * needs courses, so the set is wrapped in the thinnest thing that satisfies it.
 *
 * Both spellings are resolved inside `freeHalfDays`: the schema hands out "A1"
 * and a law course says "A", and compared literally nothing a law student takes
 * ever registers — the answer is the maximum score, ten free half-days for a
 * timetable that is full every morning.
 */
const getFreeHalfDaysList = (slots: Set<string>): string[] =>
  freeHalfDays([{ slots: [...slots] }], getTimetableSchema());

export const calculatePairwiseSocialScore = (
  myCourses: AddedCourse[],
  friendCourses: AddedCourse[]
) => pairwiseSocialScore(myCourses, friendCourses, getTimetableSchema());

const getPeriodsForSlotOuter = (slotName: string) =>
  periodsForSlot(getTimetableSchema(), slotName);

const getPeriodsForSlotsOuter = (slotStr: string): SlotPeriod[] => {
  return splitSlots(slotStr)
    .filter((s) => s !== "NIL")
    .flatMap(getPeriodsForSlotOuter);
};

const isMorningSlot = (slot: string) => {
  const periods = getPeriodsForSlotsOuter(slot);
  if (periods.length === 0) return true; // e.g., NIL
  return periods.some(p => p.startMin < MORNING_BEFORE_MIN);
};

const isEveningSlot = (slot: string) => {
  const periods = getPeriodsForSlotsOuter(slot);
  if (periods.length === 0) return true;
  return periods.some(p => p.startMin >= MORNING_BEFORE_MIN);
};

function matchesOfferingTimeFilter(slotStr: string, filter: string): boolean {
  if (filter === "all") return true;
  const slots = splitSlots(slotStr).filter((slot) => slot !== "NIL");
  const theorySlots = slots.filter((slot) => !slot.startsWith("L"));
  const labSlots = slots.filter((slot) => slot.startsWith("L"));
  const sessionSlots = theorySlots.length > 0 ? theorySlots : labSlots;
  const allIn = (items: string[], morning: boolean) => items.length > 0 && items.every((slot) => {
    const periods = getPeriodsForSlotsOuter(slot);
    return periods.length > 0 && periods.every((period) =>
      morning ? period.startMin < MORNING_BEFORE_MIN : period.startMin >= MORNING_BEFORE_MIN
    );
  });

  switch (filter) {
    // Session filters describe the theory session for combined offerings;
    // labs are filtered independently in the slot search sheet.
    case "morning_session":
    case "morning":
    case "morning_theory":
      return allIn(filter === "morning_session" ? sessionSlots : theorySlots, true);
    case "evening_session":
    case "evening":
    case "evening_theory":
      return allIn(filter === "evening_session" ? sessionSlots : theorySlots, false);
    case "morning_lab":
      return allIn(labSlots, true);
    case "evening_lab":
      return allIn(labSlots, false);
    default:
      return true;
  }
}

function matchesSlotTokenFilter(slotStr: string, selectedToken: string, lab: boolean): boolean {
  if (!selectedToken) return true;
  return splitSlots(slotStr).some(
    (slot) => slot === selectedToken && slot.startsWith("L") === lab
  );
}

const isOverlap = (theorySlotStr: string, labSlotStr: string) =>
  slotsOverlap(theorySlotStr, labSlotStr, getTimetableSchema());

// Core morning lab slots (8:00 AM - 11:40 AM: periods 1 to 4)
const CORE_MORNING_LABS = new Set([
  "L1", "L2", "L3", "L4", "L7", "L8", "L9", "L10", "L13", "L14", "L15", "L16", "L19", "L20", "L21", "L22", "L25", "L26", "L27", "L28"
]);

// Core afternoon/evening lab slots (2:00 PM - 5:30 PM: periods 7 to 10)
const CORE_EVENING_LABS = new Set([
  "L31", "L32", "L33", "L34", "L37", "L38", "L39", "L40", "L43", "L44", "L45", "L46", "L49", "L50", "L51", "L52", "L55", "L56", "L57", "L58"
]);

// Late morning window lab slots (11:40 AM - 1:20 PM: periods 5 and 6)
const LATE_MORNING_LABS = new Set([
  "L5", "L6", "L11", "L12", "L17", "L18", "L23", "L24", "L29", "L30"
]);

// Late evening window lab slots (5:40 PM - 7:20 PM: periods 11 and 12)
const LATE_EVENING_LABS = new Set([
  "L35", "L36", "L41", "L42", "L47", "L48", "L53", "L54", "L59", "L60"
]);

const isCoreMorningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => CORE_MORNING_LABS.has(s));
};

const isCoreEveningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => CORE_EVENING_LABS.has(s));
};

const isLateMorningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => LATE_MORNING_LABS.has(s));
};

const isLateEveningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => LATE_EVENING_LABS.has(s));
};

const computePairScore = (t: ParsedCourse, l: ParsedCourse): number => {
  let score = 0;
  const tPeriods = getPeriodsForSlotsOuter(t.SLOT);
  const lPeriods = getPeriodsForSlotsOuter(l.SLOT);

  const tMorning = tPeriods.some(p => p.startMin < MORNING_BEFORE_MIN);
  const tEvening = tPeriods.some(p => p.startMin >= MORNING_BEFORE_MIN);

  // Analyze whether the lab tokens are below 30 (morning) or above 30 (evening)
  const labParts = String(l.SLOT ?? "")
    .split("+")
    .map(s => parseInt(s.replace(/[^0-9]/g, ""), 10))
    .filter(n => !isNaN(n));
  const hasBelow30 = labParts.some(n => n <= 30);
  const hasAbove30 = labParts.some(n => n > 30);
  const isBelow30Only = labParts.length > 0 && labParts.every(n => n <= 30);
  const isAbove30Only = labParts.length > 0 && labParts.every(n => n > 30);

  // Priority 1: 8:00-11:40 morning lab for evening theory, and 2:00-5:30 evening lab for morning theory
  if ((tEvening && isCoreMorningLab(l.SLOT)) || (tMorning && isCoreEveningLab(l.SLOT))) {
    score += 2000;
  }
  // Priority 2: 11:40-1:20 morning lab for morning theory, and 5:30-7:20 evening lab for evening theory
  else if ((tMorning && isLateMorningLab(l.SLOT)) || (tEvening && isLateEveningLab(l.SLOT))) {
    score += 1000;
  }
  // Priority 3 (Current Priority 1 fallback): general cross-shift / above-30 & below-30
  // (e.g. evening theory with late morning lab, morning theory with late evening lab / mixed)
  else if ((tEvening && isBelow30Only) || (tMorning && isAbove30Only)) {
    score += 500;
  } else if (hasBelow30 && hasAbove30) {
    score += 200;
  }
  // Priority 4: strongly penalize same-shift pairings outside the permitted late-window slots
  else {
    score -= 1000;
  }

  // Penalize clustering theory and lab on the same day in the same half-day
  for (const tp of tPeriods) {
    for (const lp of lPeriods) {
      if (tp.day === lp.day) {
        const tpMorning = tp.startMin < MORNING_BEFORE_MIN;
        const lpMorning = lp.startMin < MORNING_BEFORE_MIN;
        if (tpMorning === lpMorning) {
          score -= 30;
        }
      }
    }
  }

  // If class numbers / IDs are available, reward proximity (sections registered together)
  if (t.CLASS_ID && l.CLASS_ID) {
    const tNum = parseInt(t.CLASS_ID.replace(/[^0-9]/g, ""), 10);
    const lNum = parseInt(l.CLASS_ID.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(tNum) && !isNaN(lNum)) {
      const diff = Math.abs(tNum - lNum);
      if (diff <= 2) score += 20;
      else if (diff <= 10) score += 10;
    }
  }

  return score;
};

// Only exported for the tests; callers inside the app go through masterCourses.
export const processParsedCourses = (parsed: ParsedCourse[], manualLinks: ManualLink[] = []): ParsedCourse[] => {
  // 1. Find all codes that end with L or P
  const hasL = new Set<string>();
  const hasP = new Set<string>();
  parsed.forEach(c => {
    const code = c.CODE.trim().toUpperCase();
    if (code.endsWith('L')) {
      hasL.add(code.slice(0, -1));
    } else if (code.endsWith('P')) {
      hasP.add(code.slice(0, -1));
    }
  });

  // 2. Identify mergeable base codes (must have both L and P)
  const mergeableBases = new Set<string>();
  hasL.forEach(base => {
    if (hasP.has(base)) {
      mergeableBases.add(base);
    }
  });

  const mappedParsed = parsed.map(c => {
    let resultCourse = { ...c };
    const code = c.CODE.trim().toUpperCase();
    const base = (code.endsWith('L') || code.endsWith('P')) ? code.slice(0, -1) : code;
    if (mergeableBases.has(base)) {
      resultCourse = {
        ...resultCourse,
        ORIGINAL_CODE: c.CODE, // Keep reference to original code ending in L or P
        CODE: base
      };
    }

    // Attach LINK_ID if matching manual rule
    const linkMatch = manualLinks.find(
      l => l.CODE === c.CODE && l.TYPE === c.TYPE && l.SLOT === c.SLOT && l.FACULTY === c.FACULTY
    );
    if (linkMatch) {
      resultCourse.LINK_ID = linkMatch.LINK_ID;
    }

    return resultCourse;
  });

  // Combine embedded theory and lab
  const combined: ParsedCourse[] = [];
  const byCode = new Map<string, ParsedCourse[]>();
  mappedParsed.forEach(c => {
    if (!byCode.has(c.CODE)) byCode.set(c.CODE, []);
    byCode.get(c.CODE)!.push(c);
  });

  byCode.forEach((coursesList, codeKey) => {
    const isMergedLPBase = mergeableBases.has(codeKey);
    // A blank type is embedded too: the winter report carries no TYPE column at
    // all, so its rows are unlabeled halves, and the pairing below is what
    // infers which theory belongs to which lab.
    const hasEmbedded = isMergedLPBase || coursesList.some(c => {
      const t = c.TYPE.trim().toUpperCase();
      return !t || t === "ETH" || t === "ELA" || t === "EPJ" || t.includes("EMBEDDED");
    });

    if (hasEmbedded) {
      // 1. Cross-faculty manual pairing
      const remainingCourses = [...coursesList];
      
      const manualTheories = remainingCourses.filter(c => {
        const t = c.TYPE.trim().toUpperCase();
        const origCode = (c as any).ORIGINAL_CODE || c.CODE;
        return c.LINK_ID && (t === "ETH" || t === "TH" || origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL'));
      });
      const manualLabs = remainingCourses.filter(c => {
        const t = c.TYPE.trim().toUpperCase();
        const origCode = (c as any).ORIGINAL_CODE || c.CODE;
        return c.LINK_ID && (t === "ELA" || t === "LO" || origCode.endsWith('P') || c.SLOT.startsWith('L'));
      });

      const linkIds = new Set<string>();
      manualTheories.forEach(t => linkIds.add(t.LINK_ID!));
      manualLabs.forEach(l => linkIds.add(l.LINK_ID!));

      linkIds.forEach(id => {
        const tMatches = manualTheories.filter(t => t.LINK_ID === id);
        const lMatches = manualLabs.filter(l => l.LINK_ID === id);

        if (tMatches.length > 0 && lMatches.length > 0) {
          tMatches.forEach(t => {
            lMatches.forEach(l => {
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = tType && lType ? `${tType}+${lType}` : "ETH+ELA";

              let combinedTitle = t.TITLE;
              if ((t as any).ORIGINAL_CODE?.endsWith('L') && (l as any).ORIGINAL_CODE?.endsWith('P')) {
                const typeLabel = (tType === "ETH" || tType.includes("EMBEDDED") || lType === "ELA" || lType.includes("EMBEDDED")) 
                  ? "Embedded Theory and Lab" 
                  : "Theory + Lab";
                combinedTitle = `${t.TITLE} [${typeLabel}]`;
              } else {
                combinedTitle = `${t.TITLE} [Embedded Theory and Lab]`;
              }

              let combinedFac = t.FACULTY;
              if (t.FACULTY !== l.FACULTY) {
                combinedFac = `${t.FACULTY} / ${l.FACULTY}`;
              }

              combined.push({
                ...t,
                TYPE: combinedType,
                TITLE: combinedTitle,
                CREDITS: String((tType.includes("EMBEDDED") && lType.includes("EMBEDDED")) ? 
                                Math.max(parseFloat(t.CREDITS || "0"), parseFloat(l.CREDITS || "0")) : 
                                parseFloat(t.CREDITS || "0") + parseFloat(l.CREDITS || "0")),
                SLOT: `${t.SLOT}+${l.SLOT}`,
                CLASS_IDS: Array.from(new Set([t.CLASS_ID, l.CLASS_ID].filter((id): id is string => Boolean(id)))),
                ROOM: t.ROOM && l.ROOM ? `${t.ROOM} / ${l.ROOM}` : (t.ROOM || l.ROOM),
                ORIGINAL_CODE: (t as any).ORIGINAL_CODE || t.CODE,
                FACULTY: combinedFac
              } as any);
            });
          });

          // Remove all matched theories and labs from remainingCourses
          tMatches.forEach(t => {
            const idx = remainingCourses.indexOf(t);
            if (idx > -1) remainingCourses.splice(idx, 1);
          });
          lMatches.forEach(l => {
            const idx = remainingCourses.indexOf(l);
            if (idx > -1) remainingCourses.splice(idx, 1);
          });
        }
      });

      // 2. Normal processing for the rest
      const byFac = new Map<string, ParsedCourse[]>();
      remainingCourses.forEach(c => {
        // The employee id decides who "the same faculty" is wherever the report
        // has one; without it a name keys the grouping, as it always has.
        const facKey = c.ERP_ID || c.FACULTY;
        if (!byFac.has(facKey)) byFac.set(facKey, []);
        byFac.get(facKey)!.push(c);
      });

      byFac.forEach((facCourses) => {
        // The code-suffix branches describe the L/P lab variant, and only
        // carry meaning where the report labels rows the old way (a typed
        // row, any report before winter) or where the merge above rewrote
        // the code (ORIGINAL_CODE). A lone `P` code with a blank type — the
        // winter report's pooled thesis lists, no `L` sibling anywhere — is
        // otherwise a theory half by slot shape and a lab half by suffix on
        // every row at once, which blows the matching below up into an
        // unbounded search; unlabeled rows stand on their slot shape alone.
        const theorySlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ETH" || t === "TH" || ((c as any).ORIGINAL_CODE || t) && origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL');
        });
        const labSlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ELA" || t === "LO" || ((c as any).ORIGINAL_CODE || t) && origCode.endsWith('P') || c.SLOT.startsWith('L');
        });

        if (theorySlots.length > 0 && labSlots.length > 0) {
          let bestMatch: { tIdx: number; lIdx: number }[] = [];
          let bestScore = -Infinity;
          const maxPossible = Math.min(theorySlots.length, labSlots.length);
          let steps = 0;

          const backtrack = (
            tIdx: number,
            currentMatch: { tIdx: number; lIdx: number }[],
            usedLabs: Set<number>,
            currentScore: number
          ) => {
            if (
              currentMatch.length > bestMatch.length ||
              (currentMatch.length === bestMatch.length && currentScore > bestScore)
            ) {
              bestMatch = [...currentMatch];
              bestScore = currentScore;
            }
            if (tIdx >= theorySlots.length) return;
            if (currentMatch.length + (theorySlots.length - tIdx) < bestMatch.length) return;
            const maxRemaining = (maxPossible - currentMatch.length) * 2100;
            if (bestMatch.length === maxPossible && currentScore + maxRemaining <= bestScore) return;
            if (++steps > 20000) return;

            const t = theorySlots[tIdx];

            const candidates = labSlots
              .map((l, j) => ({ l, j, score: computePairScore(t, l) }))
              .filter(({ l, j }) => !usedLabs.has(j) && !isOverlap(t.SLOT, l.SLOT))
              .sort((a, b) => b.score - a.score);

            for (const { j, score } of candidates) {
              usedLabs.add(j);
              currentMatch.push({ tIdx, lIdx: j });
              backtrack(tIdx + 1, currentMatch, usedLabs, currentScore + score);
              currentMatch.pop();
              usedLabs.delete(j);
            }
            
            backtrack(tIdx + 1, currentMatch, usedLabs, currentScore);
          };

          backtrack(0, [], new Set<number>(), 0);

          if (bestMatch.length > 0) {
            const matchedT = new Set(bestMatch.map(m => m.tIdx));
            const matchedL = new Set(bestMatch.map(m => m.lIdx));
            
            bestMatch.forEach(m => {
              const t = theorySlots[m.tIdx];
              const l = labSlots[m.lIdx];
              
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = tType && lType ? `${tType}+${lType}` : "ETH+ELA";

              let combinedTitle = t.TITLE;
              if ((t as any).ORIGINAL_CODE?.endsWith('L') && (l as any).ORIGINAL_CODE?.endsWith('P')) {
                const typeLabel = (tType === "ETH" || tType.includes("EMBEDDED") || lType === "ELA" || lType.includes("EMBEDDED")) 
                  ? "Embedded Theory and Lab" 
                  : "Theory + Lab";
                combinedTitle = `${t.TITLE} [${typeLabel}]`;
              } else {
                combinedTitle = `${t.TITLE} [Embedded Theory and Lab]`;
              }

              combined.push({
                ...t,
                TYPE: combinedType,
                TITLE: combinedTitle,
                CREDITS: String((tType.includes("EMBEDDED") && lType.includes("EMBEDDED")) ? 
                                Math.max(parseFloat(t.CREDITS || "0"), parseFloat(l.CREDITS || "0")) : 
                                parseFloat(t.CREDITS || "0") + parseFloat(l.CREDITS || "0")),
                SLOT: `${t.SLOT}+${l.SLOT}`,
                CLASS_IDS: Array.from(new Set([t.CLASS_ID, l.CLASS_ID].filter((id): id is string => Boolean(id)))),
                ROOM: t.ROOM && l.ROOM ? `${t.ROOM} / ${l.ROOM}` : (t.ROOM || l.ROOM),
                ORIGINAL_CODE: (t as any).ORIGINAL_CODE || t.CODE
              } as any);
            });

            theorySlots.forEach((t, i) => { if (!matchedT.has(i)) combined.push(t); });
            labSlots.forEach((l, i) => { if (!matchedL.has(i)) combined.push(l); });
          } else {
            combined.push(...facCourses);
          }
        } else {
          combined.push(...facCourses);
        }
      });
    } else {
      combined.push(...coursesList);
    }
  });

  return combined;
};

export default function FFCSTimetableTab({
  onLayoutModeChange,
}: {
  onLayoutModeChange?: (mode: "guided" | "modern" | "classic") => void;
} = {}) {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";
  const rootStyles = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
  const themeTextColor = rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
  const themeHtmlClass = typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

  const [masterCourses, setMasterCourses] = useState<ParsedCourse[]>([]);
  const [rawParsedCourses, setRawParsedCourses] = useState<ParsedCourse[]>([]);
  const [semesterReportCourses, setSemesterReportCourses] = useState<ParsedCourse[]>([]);
  const [semesterReportCoursesId, setSemesterReportCoursesId] = useState<FFCSSemesterId | null>(null);
  const courseAlternativesPool = useMemo(() => {
    if (!rawParsedCourses || rawParsedCourses.length === 0) return masterCourses;
    const combinedFaculties = new Set(
      masterCourses
        .filter(c => {
          const parts = splitSlots(c.SLOT);
          return parts.some(s => !s.startsWith("L") && s !== "NIL") && parts.some(s => s.startsWith("L"));
        })
        .map(c => `${c.CODE.trim().toUpperCase()}|${(c.FACULTY || "").trim().toLowerCase()}`)
    );

    const filteredRaw = rawParsedCourses.filter(c => {
      const code = c.CODE.trim().toUpperCase();
      const base = (code.endsWith('L') || code.endsWith('P')) ? code.slice(0, -1) : code;
      const fac = (c.FACULTY || "").trim().toLowerCase();
      return !combinedFaculties.has(`${code}|${fac}`) && !combinedFaculties.has(`${base}|${fac}`);
    });

    return [...masterCourses, ...filteredRaw];
  }, [masterCourses, rawParsedCourses]);
  const [semesterId, setSemesterId] = useState<FFCSSemesterId>(DEFAULT_FFCS_SEMESTER);
  const activeSemester = useMemo(() => getFFCSSemester(semesterId), [semesterId]);
  const reportCodesRef = useRef<Set<string>>(new Set());
  const reportRequestRef = useRef(0);
  const loadedSemesterRef = useRef<FFCSSemesterId>(DEFAULT_FFCS_SEMESTER);
  const semesterSwitchRef = useRef(0);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  
  // Timetables State
  const [timetables, setTimetables] = useState<TimetableState[]>([
    { id: "default", name: "Timetable 1", courses: [] }
  ]);
  const [activeTimetableId, setActiveTimetableId] = useState<string>("default");
  const [courseLocks, setCourseLocks] = useState<import('./FFCS/types').CourseLock[]>([]);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  // Row-scoped rename for the Select Timetable sheet and Classic dashboard.
  // The modern dashboard header keeps its own active-timetable rename state.
  const [sheetEditingId, setSheetEditingId] = useState<string | null>(null);
  const [sheetEditValue, setSheetEditValue] = useState("");

  const [generatorPreviewTimetable, setGeneratorPreviewTimetable] = useState<TimetableState | null>(null);

  const activeTimetable = timetables.find(t => t.id === activeTimetableId) || timetables[0];
  const courses = generatorPreviewTimetable ? generatorPreviewTimetable.courses : activeTimetable.courses;
  const reportCoursesForSharing = semesterReportCoursesId === semesterId ? semesterReportCourses : [];
  const compactSharePlan = useMemo(
    () => attachReportClassIds(activeTimetable, reportCoursesForSharing),
    [activeTimetable, reportCoursesForSharing]
  );
  const compactShareData = useMemo(
    () => encodeCompactTimetableShare(compactSharePlan, semesterId),
    [compactSharePlan, semesterId]
  );
  const canShareCompactLink = Boolean(compactShareData);
  const shapeShareData = useMemo(
    () => encodeTimetableShapeShare(compactSharePlan, semesterId),
    [compactSharePlan, semesterId]
  );
  const canShareShapeLink = Boolean(shapeShareData);
  
  // Selection states
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("-1");
  const [slotFilter, setSlotFilter] = useState("all");
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isShareLinkOptionsOpen, setIsShareLinkOptionsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [layoutMode, setLayoutMode] = useState<"guided" | "modern" | "classic">("modern");
  const [isGuidedFullScreen, setIsGuidedFullScreen] = useState(true);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isCourseListModalOpen, setIsCourseListModalOpen] = useState(false);

  useEffect(() => {
    onLayoutModeChange?.(layoutMode);
  }, [layoutMode, onLayoutModeChange]);

  const handleSelectLayoutMode = (mode: "guided" | "modern" | "classic", remember: boolean) => {
    setLayoutMode(mode);
    if (remember) {
      safeStorage.setItem("ffcs_layout_mode", mode);
    }
    safeStorage.setItem("ffcs_layout_mode_prompt_seen", "true");
    if (mode === "guided") {
      setGuidedInitialPhase("setup_mode");
      setIsGuidedFullScreen(true);
    }
  };

  const handleCloseLayoutModal = () => {
    setIsLayoutModalOpen(false);
    safeStorage.setItem("ffcs_layout_mode_prompt_seen", "true");
  };

  const [guidedInitialPhase, setGuidedInitialPhase] = useState<GuidedPhase>("setup_mode");

  // Preferences live one level above the UI that consumes them: the tab owns
  // the single instance and hands it to the settings sheet, the generator's
  // seed values and the export button, so a change is visible everywhere
  // without a storage event or a remount.
  const { settings, update: updateSetting, reset: resetSettings } = useFFCSSettings();
  const { visible: hints, dismiss: dismissHint } = useTips();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { resolved: resolvedView, isMobile } = useTimetableViewMode();
  const [isExtraLargeViewport, setIsExtraLargeViewport] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(min-width: 1280px)");
    const updateViewport = () =>
      setIsExtraLargeViewport(mediaQuery?.matches ?? window.innerWidth >= 1280);
    updateViewport();
    if (mediaQuery) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  const showVerticalTimetableBesideWidgets =
    layoutMode === "modern" &&
    settings.showVerticalTimetableBesideWidgets &&
    isExtraLargeViewport;

  // Generator State
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfGenerationTheme, setPdfGenerationTheme] = useState<"light" | "dark">("dark");
  const [pdfBadgeMsg, setPdfBadgeMsg] = useState<string | null>(null);
  const [isCourseLockOpen, setIsCourseLockOpen] = useState(false);
  const [isPasteRegisteredModalOpen, setIsPasteRegisteredModalOpen] = useState(false);
  const [isFacultyScheduleOpen, setIsFacultyScheduleOpen] = useState(false);
  const [facultyScheduleInitial, setFacultyScheduleInitial] = useState<string | undefined>(undefined);

  const handleOpenFacultySchedule = useCallback((facultyName?: string) => {
    setFacultyScheduleInitial(facultyName);
    setIsFacultyScheduleOpen(true);
  }, []);

  // Tour step bridge: the dashboard header sits inside the provider, but it
  // deliberately takes the current step as a plain prop rather than consuming
  // the context — it stays a provider-free, reusable UI component, and the
  // tour contract lives in one place (the tab). The provider announces each
  // step through `onStepChange` (`tourStepTarget`); the header opens the
  // utility chip-tab the spotlighted anchor lives in.
  const [tourStepTarget, setTourStepTarget] = useState<string | null>(null);
  const handleTourStepChange = useCallback((step: TourStep | null) => {
    setTourStepTarget(step?.target ?? null);
  }, []);
  const [slotSwapRow, setSlotSwapRow] = useState<{ code: string; title: string; ids: string[] } | null>(null);

  const swapSlotFaculty = useCallback((courseId: string, offering: ParsedCourse) => {
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

    if (generatorPreviewTimetable) {
      setGeneratorPreviewTimetable((prev) =>
        prev
          ? {
              ...prev,
              courses: prev.courses.map(updateCourse),
            }
          : null
      );
    } else {
      setTimetables((prev) =>
        prev.map((t) =>
          t.id === activeTimetableId
            ? {
                ...t,
                courses: t.courses.map(updateCourse),
              }
            : t
        )
      );
    }
    setSlotSwapRow(null);
  }, [activeTimetableId, generatorPreviewTimetable, slotSwapRow]);

  // Staged results the Social Matrix can score alongside saved timetables. The
  // generator subpage saves into `timetables` directly now, so nothing fills
  // this today — the prop survives because the matrix distinguishes the two
  // pools, and a revived staged-review flow writes here.
  const [stagedTimetables] = useState<TimetableState[]>([]);

  // Social State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [socialScoreGroupMethod, setSocialScoreGroupMethod] = useState<"intersection" | "cumulative">("intersection");
  const [isFriendsManagerOpen, setIsFriendsManagerOpen] = useState(false);
  const [friendsManagerTab, setFriendsManagerTab] = useState<"friends" | "groups">("friends");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFriends, setNewGroupFriends] = useState<string[]>([]);
  const [socialTargetId, setSocialTargetId] = useState<string>("");
  const [pendingFriendTimetables, setPendingFriendTimetables] = useState<TimetableState[] | null>(null);
  const [pendingFriendName, setPendingFriendName] = useState("");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedDashDetails, setSelectedDashDetails] = useState<NonNullable<TimetableState['metrics']>['dashDetails'] | null>(null);
  const [selectedGapDetails, setSelectedGapDetails] = useState<NonNullable<TimetableState['metrics']>['gapDetails'] | null>(null);
  const [isSocialMatrixOpen, setIsSocialMatrixOpen] = useState(false);
  const [selectedFriendTimetablesData, setSelectedFriendTimetablesData] = useState<SelectedFriendTimetableData | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [searchLockedOnly, setSearchLockedOnly] = useState<boolean>(true);

  useEffect(() => {
    if (courseLocks.length > 0) {
      setSearchLockedOnly(true);
    }
  }, [courseLocks.length]);
  const [isSlotSearchOpen, setIsSlotSearchOpen] = useState(false);
  const [slotSearchQuery, setSlotSearchQuery] = useState("");
  const [slotSearchTimeFilter, setSlotSearchTimeFilter] = useState("all");
  const [slotSearchTheoryFilter, setSlotSearchTheoryFilter] = useState("");
  const [slotSearchLabFilter, setSlotSearchLabFilter] = useState("");
  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");
  const [isVariantSearchOpen, setIsVariantSearchOpen] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [manualLinks, setManualLinks] = useState<ManualLink[]>([]);
  const [isManualLinkerOpen, setIsManualLinkerOpen] = useState(false);
  const [manualLinkCsvText, setManualLinkCsvText] = useState("");
  const [facultyReviewTarget, setFacultyReviewTarget] = useState<{ name: string; employeeId?: string; courseCode?: string } | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch one semester's report and replace the rows from the report that was
   * loaded before it.
   *
   * Replacing only the previous report's codes is deliberate: a course the
   * student imported by hand is not part of either shipped report, so a switch
   * must not throw it away. A report row still wins over an imported row with
   * the same code, because the report has every offering of that course.
   */
  const loadSemesterReport = useCallback(async (nextSemesterId: FFCSSemesterId): Promise<boolean> => {
    const semester = getFFCSSemester(nextSemesterId);
    const requestId = ++reportRequestRef.current;
    setIsLoadingCourses(true);
    setError(null);

    try {
      const XLSX = await import("xlsx");
      const assetPath = getAssetPath(semester.path);
      const response = await fetch(assetPath);
      if (!response.ok) throw new Error(`Failed to fetch ${assetPath}`);

      const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (requestId !== reportRequestRef.current) return false;
      if (jsonData.length === 0) {
        setError(`The ${semester.name} is empty.`);
        return false;
      }

      const parsed = parseReportRows(jsonData);
      if (parsed.length === 0) {
        setError(`No courses could be read from the ${semester.name}.`);
        return false;
      }

      setSemesterReportCourses(parsed);
      setSemesterReportCoursesId(nextSemesterId);

      const previousReportCodes = reportCodesRef.current;
      setRawParsedCourses((current) =>
        mergeCourses(current.filter((course) => !previousReportCodes.has(course.CODE)), parsed)
      );
      reportCodesRef.current = new Set(parsed.map((course) => course.CODE));
      loadedSemesterRef.current = nextSemesterId;

      setSelectedCourseCode("");
      setSelectedSlotIndex("-1");
      return true;
    } catch (err) {
      console.error(err);
      if (requestId === reportRequestRef.current) {
        setError(
          `Error loading the ${semester.name}. Please ensure public${semester.path} exists and is valid.`
        );
      }
      return false;
    } finally {
      if (requestId === reportRequestRef.current) setIsLoadingCourses(false);
    }
  }, []);

  const handleSemesterChange = useCallback(
    async (nextSemesterId: FFCSSemesterId) => {
      if (nextSemesterId === semesterId) return;

      // Two quick clicks race each other: the older request may fail after the
      // newer one has already started, and it must not drag the label back to a
      // semester whose data the newer request is still replacing.
      const switchId = ++semesterSwitchRef.current;
      setSemesterId(nextSemesterId);
      const loaded = await loadSemesterReport(nextSemesterId);
      if (switchId !== semesterSwitchRef.current) return;
      if (!loaded) {
        setSemesterId(loadedSemesterRef.current);
        return;
      }

      safeStorage.setItem(FFCS_SEMESTER_STORAGE_KEY, nextSemesterId);
    },
    [semesterId, loadSemesterReport]
  );

  // Load from local storage on mount and fetch the selected semester's report.
  useEffect(() => {
    let initialSemester: FFCSSemesterId = DEFAULT_FFCS_SEMESTER;
    const savedSemester = safeStorage.getItem(FFCS_SEMESTER_STORAGE_KEY);
    if (isFFCSSemesterId(savedSemester)) initialSemester = savedSemester;

    setSemesterId(initialSemester);
    void loadSemesterReport(initialSemester);

    const savedTimetables = safeStorage.getItem("ffcs_timetables");
    if (savedTimetables) {
      try {
        const parsed = JSON.parse(savedTimetables);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setTimetables(parsed);
          setActiveTimetableId(parsed[0].id);
        }
      } catch {}
    }
    const savedFriends = safeStorage.getItem("ffcs_friends");
    if (savedFriends) {
      try { setFriends(JSON.parse(savedFriends)); } catch {}
    }
    const savedFriendGroups = safeStorage.getItem("ffcs_friendGroups");
    if (savedFriendGroups) {
      try { setFriendGroups(JSON.parse(savedFriendGroups)); } catch {}
    }
    const savedMethod = safeStorage.getItem("ffcs_socialScoreGroupMethod");
    if (savedMethod) setSocialScoreGroupMethod(savedMethod as "intersection" | "cumulative");
    const savedCourseLocks = safeStorage.getItem("ffcs_courseLocks");
    if (savedCourseLocks) {
      try { setCourseLocks(JSON.parse(savedCourseLocks)); } catch {}
    }
    const savedManualLinks = safeStorage.getItem("ffcs_manual_links");
    if (savedManualLinks) {
      try {
        const parsed = JSON.parse(savedManualLinks);
        setManualLinks(parsed);
        setManualLinkCsvText(parsed.map((l: ManualLink) => `${l.CODE},${l.TYPE},${l.SLOT},${l.ROOM},${l.FACULTY},${l.LINK_ID}`).join('\n'));
      } catch {}
    }

    setIsLoaded(true);
  }, [loadSemesterReport]);

  // Compute masterCourses whenever rawParsedCourses or isGroupingEnabled changes
  useEffect(() => {
    if (rawParsedCourses.length > 0) {
      if (isGroupingEnabled) {
        setMasterCourses(processParsedCourses(rawParsedCourses, manualLinks));
      } else {
        // No grouping, just use the raw courses
        const copy = JSON.parse(JSON.stringify(rawParsedCourses)) as ParsedCourse[];
        setMasterCourses(copy);
      }
    } else {
      setMasterCourses([]);
    }
  }, [rawParsedCourses, isGroupingEnabled, isLoaded, manualLinks]);

  /**
   * Faculty groups from the registration list.
   *
   * Derived, not stored: the report is the only source of truth, so a re-upload
   * or a grouping toggle changes the groups without a second cache to invalidate.
   * First-seen order is preserved because the Faculty Explorer resolves a
   * directory name against the first group that matches.
   */
  const facultyGroups = useMemo(
    () => buildFacultyNameGroups(rawParsedCourses),
    [rawParsedCourses]
  );

  // Save to local storage on change.
  //
  // `ffcs_raw_courses` is shared with the Free Classrooms surfaces, which read
  // the previous report's VENUE/TYPE columns. The winter registration list has
  // neither, so publishing it there would make every winter class look roomless
  // outside this tab. Only the previous dataset is published, leaving those
  // consumers exactly as they were before this switch existed.
  useEffect(() => {
    if (isLoaded && semesterId === "previous") {
      safeStorage.setItem("ffcs_raw_courses", JSON.stringify(rawParsedCourses));
    }
  }, [rawParsedCourses, isLoaded, semesterId]);

  /**
   * Add rows brought in from a paste or an uploaded sheet.
   *
   * Merged by course code rather than appended: a re-upload of a corrected
   * sheet should take over the codes it fixes instead of sitting beside the
   * version it corrects, and courses it does not mention are left alone — which
   * is what makes importing a partial list safe. Everything downstream is
   * derived from `rawParsedCourses`, so the catalogue, the faculty groups and
   * the persisted copy all follow from this one update.
   */
  const handleImportCourses = React.useCallback((incoming: ParsedCourse[]) => {
    if (incoming.length === 0) return;
    setRawParsedCourses(prev => mergeCourses(prev, incoming));
  }, []);

  const updateActiveTimetableCourses = useCallback((newCourses: AddedCourse[]) => {
    setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, courses: newCourses } : t));
  }, [activeTimetableId, setTimetables]);

  const handleLoadRegisteredCourses = useCallback((
    addedCourses: AddedCourse[],
    parsedCourses: ParsedCourse[],
    replaceExisting: boolean
  ) => {
    if (addedCourses.length === 0) return;

    const reportMatchedCourses = attachReportClassIds(
      { name: activeTimetable.name, courses: addedCourses },
      reportCoursesForSharing,
      true
    ).courses;

    if (replaceExisting) {
      updateActiveTimetableCourses(reportMatchedCourses);
    } else {
      const existing = activeTimetable?.courses || [];
      const toAdd = reportMatchedCourses.filter(
        (ac) => !existing.some((ec) => ec.code === ac.code && ec.slots.join("+") === ac.slots.join("+"))
      );
      updateActiveTimetableCourses([...existing, ...toAdd]);
    }

    if (parsedCourses.length > 0) {
      setRawParsedCourses((prev) => mergeCourses(prev, parsedCourses));
    }

    setSuccessMsg(
      `Loaded ${addedCourses.length} course offering${addedCourses.length === 1 ? "" : "s"} into ${activeTimetable.name}.`
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  }, [activeTimetable, reportCoursesForSharing, updateActiveTimetableCourses]);

  useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem("ffcs_timetables", JSON.stringify(timetables));
    }
  }, [timetables, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem("ffcs_friends", JSON.stringify(friends));
      safeStorage.setItem("ffcs_friendGroups", JSON.stringify(friendGroups));
      safeStorage.setItem("ffcs_socialScoreGroupMethod", socialScoreGroupMethod);
    }
  }, [friends, friendGroups, socialScoreGroupMethod, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem("ffcs_courseLocks", JSON.stringify(courseLocks));
    }
  }, [courseLocks, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem("ffcs_manual_links", JSON.stringify(manualLinks));
    }
  }, [manualLinks, isLoaded]);

  useEffect(() => {
    if (isLoaded) safeStorage.setItem("ffcs_layout_mode", layoutMode);
  }, [layoutMode, isLoaded]);

  useEffect(() => {
    setSlotFilter("all");
    setSelectedSlotIndex("-1");
    setSlotSearchTimeFilter("all");
    setSlotSearchTheoryFilter("");
    setSlotSearchLabFilter("");
  }, [selectedCourseCode, isGroupingEnabled]);

  const theoryPeriods = (getTimetableSchema().theory as TimetablePeriod[]).filter(p => !p.lunch);
  const labPeriods = (getTimetableSchema().lab as TimetablePeriod[]).filter(p => !p.lunch);
  const allPeriods = [...theoryPeriods, ...labPeriods];

  const allAvailableSlots = useMemo(() => {
    const slots = new Set<string>();
    theoryPeriods.forEach(p => {
      if (p.days) Object.values(p.days).forEach(s => slots.add(s));
    });
    labPeriods.forEach(p => {
      if (p.days) Object.values(p.days).forEach(s => slots.add(s));
    });
    return Array.from(slots).sort((a, b) => {
      const isALab = a.startsWith('L');
      const isBLab = b.startsWith('L');
      if (isALab && !isBLab) return 1;
      if (!isALab && isBLab) return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [theoryPeriods, labPeriods]);

  // The one lookup, shared with the module-level copy above and the modal's.
  // The old local version also returned a `pIdx`, which nothing ever read.
  const getPeriodsForSlot = (slotName: string) =>
    periodsForSlot({ theory: theoryPeriods, lab: labPeriods }, slotName);

  const checkClashes = (newSlots: string[], excludeCourseCode?: string) => {
    for (const slot of newSlots) {
      if (blockedSlots.has(slot)) {
        return `Slot ${slot} is blocked.`;
      }
    }

    const newPeriods = newSlots.flatMap(getPeriodsForSlot);

    for (const existingCourse of courses) {
      if (excludeCourseCode && existingCourse.code === excludeCourseCode) {
        continue;
      }
      const existingPeriods = existingCourse.slots.flatMap(getPeriodsForSlot);
      const clash = findPeriodClash(newPeriods, existingPeriods);
      if (clash) {
        return `Time clash on ${clash.periodA.day.toUpperCase()} between new slot and ${existingCourse.code} (${existingCourse.slots.join("+")})`;
      }
    }
    return null;
  };

  const getCourseForSlot = (slotName: string) => courseInPeriod(courses, slotName);

  // Unique Courses with their associated types
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, { title: string; types: string[]; batches: string[] }>();
    masterCourses.forEach(c => {
      const existing = map.get(c.CODE);
      const cTypes = c.TYPE.trim().toUpperCase().split("+").map(t => t.trim());
      const cBatches = c.BATCH ? c.BATCH.trim().split(",").map(b => b.trim()).filter(Boolean) : [];
      if (existing) {
        cTypes.forEach(cType => {
          if (cType && !existing.types.includes(cType)) {
            existing.types.push(cType);
          }
        });
        cBatches.forEach(cBatch => {
          if (cBatch && !existing.batches.includes(cBatch)) {
            existing.batches.push(cBatch);
          }
        });
        if (c.TITLE.includes("[Theory + Lab]") || c.TITLE.includes("[Embedded")) {
          existing.title = c.TITLE;
        }
      } else {
        map.set(c.CODE, { title: c.TITLE, types: cTypes.filter(Boolean), batches: cBatches });
      }
    });
    return Array.from(map.entries()).map(([code, { title, types, batches }]) => ({ code, title, types, batches })).sort((a, b) => a.code.localeCompare(b.code));
  }, [masterCourses]);

  const uniqueCourseCodes = useMemo(() => {
    return uniqueCourses;
  }, [uniqueCourses]);

  const selectedCourse = useMemo(() => {
    if (!selectedCourseCode) return null;
    return uniqueCourses.find(c => c.code === selectedCourseCode) || null;
  }, [selectedCourseCode, uniqueCourses]);

  const courseTypes = selectedCourse?.types || [];
  const hasTheory = courseTypes.some(t => ["TH", "ETH", "SS"].includes(t));
  const hasLab = courseTypes.some(t => ["LO", "ELA"].includes(t));

  const generatorDisplayCourses = courseLocks.length > 0 
    ? uniqueCourseCodes.filter(c => courseLocks.some(l => l.code === c.code))
    : uniqueCourseCodes;

  // File upload and clear master handlers removed as database is preloaded.

  const handleClearTimetable = () => {
    if (confirm(`Are you sure you want to clear ${activeTimetable.name}?`)) {
      updateActiveTimetableCourses([]);
    }
  };

  const createNewTimetable = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newName = `Timetable ${timetables.length + 1}`;
    setTimetables([...timetables, { id: newId, name: newName, courses: [] }]);
    setActiveTimetableId(newId);
  };

  const duplicateTimetable = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newName = `${activeTimetable.name} (Copy)`;
    setTimetables([...timetables, { id: newId, name: newName, courses: [...activeTimetable.courses] }]);
    setActiveTimetableId(newId);
  };

  const deleteTimetable = (id: string) => {
    if (timetables.length <= 1) {
      setError("You must have at least one timetable.");
      return;
    }
    if (confirm("Are you sure you want to delete this timetable?")) {
      const newTimetables = timetables.filter(t => t.id !== id);
      setTimetables(newTimetables);
      if (activeTimetableId === id) {
        setActiveTimetableId(newTimetables[0].id);
      }
    }
  };

  const clearAllTimetables = () => {
    if (!confirm(`Delete all ${timetables.length} timetables and their courses? A blank timetable will be kept.`)) {
      return;
    }

    setTimetables([{ id: "default", name: "Timetable 1", courses: [] }]);
    setActiveTimetableId("default");
    setSheetEditingId(null);
  };

  /**
   * Confirm a row's rename in the Select Timetable sheet — the same
   * trim-and-drop-empty rule the header's rename follows, applied to the id
   * the row owns instead of the active one. Esc and the X both cancel.
   */
  const submitSheetRename = (id: string) => {
    const name = sheetEditValue.trim();
    if (name) {
      setTimetables(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
    }
    setSheetEditingId(null);
  };

  const exportTimetables = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(timetables));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "amazecc_timetables.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setSuccessMsg("Timetable configs exported successfully!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const importTimetables = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && Array.isArray(parsed[0].courses)) {
          setTimetables(parsed);
          setActiveTimetableId(parsed[0].id);
          setSuccessMsg("Timetable configs imported successfully!");
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setError("Invalid config format.");
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        setError("Failed to parse config file.");
        setTimeout(() => setError(null), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const importFriendTimetable = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && Array.isArray(parsed[0].courses)) {
          setPendingFriendTimetables(parsed);
          setPendingFriendName("");
        } else {
          setError("Invalid config format.");
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        setError("Failed to parse config file.");
        setTimeout(() => setError(null), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSaveFriend = () => {
    if (!pendingFriendTimetables) return;
    const friendName = pendingFriendName.trim() || "Friend";
    const newFriend: Friend = {
      id: Date.now().toString(),
      name: friendName,
      timetables: pendingFriendTimetables
    };
    setFriends(prev => [...prev, newFriend]);
    setSuccessMsg(`${friendName}'s timetable imported successfully!`);
    setTimeout(() => setSuccessMsg(null), 3000);
    setPendingFriendTimetables(null);
    setPendingFriendName("");
  };

  // downloadSampleCSV removed as database is preloaded.

  const downloadImage = useCallback(
    async (format: 'jpg' | 'png' = 'jpg', forcedView?: 'vertical' | 'horizontal') => {
      if (courses.length === 0) {
        setError("Please add at least one course before downloading the timetable.");
        return;
      }
      setIsDownloading(true);
      const activeView = forcedView ?? (resolvedView ?? (isMobile ? 'vertical' : 'horizontal'));
      try {
        let timetableExported = false;
        try {
          await downloadModernTimetableImage({
            timetableName: activeTimetable.name,
            courses,
            theoryPeriods,
            labPeriods,
            days: DAYS,
            viewMode: activeView === "vertical" ? "vertical" : "horizontal",
            format,
            themeBgColor: "#090d16",
            includeCourseList: !settings.separateCourseListExport,
          });
          track("export_image", { format, viewMode: activeView });
          timetableExported = true;
        } catch (err) {
          console.warn("Modern offscreen image export failed, trying live capture fallback:", err);
          if (captureRef.current) {
            const captureElement = captureRef.current;
            const originalClassName = captureElement.className;
            try {
              if (showVerticalTimetableBesideWidgets) {
                captureElement.classList.remove("xl:contents");
                captureElement.classList.add("xl:col-span-full");
              }
              await downloadTimetableImage(captureElement, activeTimetable.name, themeBgColor, format);
              track("export_image", { format, fallback: true });
              timetableExported = true;
            } catch {
              // The error below reports that neither export path succeeded.
            } finally {
              captureElement.className = originalClassName;
            }
          }
          if (!timetableExported) setError("Failed to download timetable image.");
        }

        if (!timetableExported) return;
        if (settings.separateCourseListExport) {
          try {
            await downloadModernCourseListImage({
              timetableName: activeTimetable.name,
              courses,
              format,
              themeBgColor: "#090d16",
            });
            track("export_image", { format, viewMode: "course_list" });
          } catch (err) {
            console.error("Failed to download the separate course-list image:", err);
            setError("Timetable downloaded, but the course-list image failed to download.");
            return;
          }
        }

        setSuccessMsg(
          settings.separateCourseListExport
            ? "Timetable and course-list images downloaded successfully!"
            : `Timetable (${activeView === "vertical" ? "Vertical Heatmap" : "Horizontal Grid"}) downloaded successfully!`
        );
        setTimeout(() => setSuccessMsg(null), 3500);
      } finally {
        setIsDownloading(false);
      }
    },
    [
      courses,
      activeTimetable.name,
      theoryPeriods,
      labPeriods,
      resolvedView,
      isMobile,
      themeBgColor,
      showVerticalTimetableBesideWidgets,
      settings.separateCourseListExport,
    ]
  );

  /**
   * Share the active plan as a link that carries the plan itself.
   *
   * The native share sheet where the browser has one (phones, and desktop
   * Chrome/Edge), the clipboard where it does not — and a cancelled sheet is
   * treated as a decision, not a failure, so it does not fall through to a
   * copy the student did not ask for.
   */
  const handleSharePlan = useCallback(async (compact = false, shapeOnly = false) => {
    const plan = activeTimetable;
    if (!plan || plan.courses.length === 0) {
      setError("Add at least one course to the timetable before sharing it.");
      return;
    }

    let url: string;
    if (shapeOnly) {
      const shapeData = encodeTimetableShapeShare(
        attachReportClassIds(plan, reportCoursesForSharing),
        semesterId
      );
      if (!shapeData) {
        setError(
          "Share TT shape is unavailable because the timetable does not have unique class IDs in the selected semester's registration report."
        );
        return;
      }
      url = buildTimetableShapeShareUrl(shapeData, window.location.origin);
    } else if (compact) {
      const compactData = encodeCompactTimetableShare(
        attachReportClassIds(plan, reportCoursesForSharing),
        semesterId
      );
      if (!compactData) {
        setError(
          "A short link is unavailable because one or more classes could not be matched uniquely in the selected semester's registration list."
        );
        return;
      }
      url = buildCompactShareUrl(compactData, window.location.origin);
    } else {
      url = buildShareUrl(encodeTimetableShare(plan), window.location.origin);
    }
    track("share_created", { courses: plan.courses.length, bytes: url.length });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shapeOnly ? "FFCS timetable shape" : `${plan.name} — AmazeCC FFCS`,
          text: shapeOnly ? "Open this shared timetable shape." : "My FFCS plan:",
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else (no handler registered, permission refused) falls
        // through to the clipboard rather than dying quietly.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setSuccessMsg(
        shapeOnly
          ? "TT shape link copied to clipboard!"
          : compact
          ? "Short class-ID link copied to clipboard!"
          : isOversizedShareLink(url)
            ? "Share link copied — it is very long, so some apps may cut it short."
            : "Share link copied to clipboard!"
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError("Could not copy the share link. Try again over https.");
    }
  }, [activeTimetable, reportCoursesForSharing, semesterId]);

  const handleSharePlanJson = useCallback(async () => {
    if (!activeTimetable || activeTimetable.courses.length === 0) {
      setError("Add at least one course to the timetable before sharing it.");
      return;
    }
    const json = JSON.stringify(activeTimetable, null, 2);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${activeTimetable.name} — AmazeCC FFCS`,
          text: json,
        });
      } else {
        await navigator.clipboard.writeText(json);
        setSuccessMsg("Timetable JSON copied to clipboard.");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Could not share the timetable JSON.");
    }
  }, [activeTimetable]);

  const handleShareAmazeCC = useCallback(async () => {
    const url = new URL("/ffcs", window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "AmazeCC FFCS",
          text: "Plan your semester with AmazeCC FFCS.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setSuccessMsg("AmazeCC FFCS link copied to clipboard.");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Could not share AmazeCC FFCS.");
    }
  }, [setError, setSuccessMsg]);

  const downloadDossierHtml = useCallback(
    async (forcedTheme?: "light" | "dark") => {
      if (courses.length === 0) {
        setError("Please add at least one course before downloading the HTML dossier.");
        return;
      }
      setIsDownloading(true);
      setIsGeneratingPdf(true);
      setPdfBadgeMsg(null);
      const chosenTheme =
        forcedTheme ??
        (currentTheme === "light" || (themeHtmlClass && themeHtmlClass.includes("light")) ? "light" : "dark");
      setPdfGenerationTheme(chosenTheme);
      try {
        await downloadModernDossierHtml({
          timetableName: activeTimetable.name,
          courses,
          theoryPeriods,
          labPeriods,
          days: DAYS,
          viewMode: "horizontal",
          masterCourses,
          theme: chosenTheme,
          themeHtmlClass,
        });
        track("export_html", { theme: chosenTheme, viewMode: "horizontal" });
        const success = "HTML dossier downloaded successfully.";
        setSuccessMsg(success);
        setPdfBadgeMsg(success);
        setTimeout(() => {
          setSuccessMsg(null);
          setPdfBadgeMsg(null);
        }, 3500);
      } catch (err) {
        console.error("HTML dossier download failed:", err);
        const errMsg = "Failed to download the HTML dossier.";
        setError(errMsg);
        setPdfBadgeMsg(errMsg);
        setTimeout(() => setPdfBadgeMsg(null), 3500);
      } finally {
        setIsDownloading(false);
        setIsGeneratingPdf(false);
      }
    },
    [
      courses,
      activeTimetable.name,
      theoryPeriods,
      labPeriods,
      masterCourses,
      currentTheme,
      themeHtmlClass,
    ]
  );

  const openPrintablePage = useCallback(() => {
    setIsDossierOpen(true);
    track("export_printable");
  }, []);

  const openDetachedPrintablePage = useCallback(() => {
    try {
      const viewToUse: "vertical" | "horizontal" = resolvedView === "vertical" ? "vertical" : "horizontal";
      const printWindow = openModernPrintableDossier({
        timetableName: activeTimetable.name,
        courses: activeTimetable.courses,
        theoryPeriods,
        labPeriods,
        days: DAYS,
        viewMode: viewToUse,
        masterCourses,
        themeHtmlClass,
        themeBgColor,
        themeTextColor,
        autoPrint: false,
      });

      if (!printWindow) {
        setError("Please allow popups to open the standalone printable view.");
        return;
      }

      setSuccessMsg("Standalone printable view opened in new tab!");
      track("export_image", { format: "png" });
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to open standalone printable view.");
    }
  }, [
    activeTimetable.name,
    activeTimetable.courses,
    theoryPeriods,
    labPeriods,
    resolvedView,
    isMobile,
    masterCourses,
    themeHtmlClass,
    themeBgColor,
    themeTextColor,
  ]);

  // uniqueCourses moved above.

  // Available Slot Rows for Selected Course
  const availableSlots = useMemo(() => {
    if (!selectedCourseCode) return [];
    let slots = masterCourses.filter(c => c.CODE === selectedCourseCode);
    
    if (isGroupingEnabled) {
      const hasCombined = slots.some(c => {
        const parts = splitSlots(c.SLOT);
        return parts.some(s => !s.startsWith("L") && s !== "NIL") && parts.some(s => s.startsWith("L"));
      });
      if (hasCombined) {
        // Individual slots of faculties who already have a combined offering must not occupy the slot list
        slots = slots.filter(c => {
          const parts = splitSlots(c.SLOT);
          const isCombined = parts.some(s => !s.startsWith("L") && s !== "NIL") && parts.some(s => s.startsWith("L"));
          if (isCombined) return true;

          const facNorm = (c.FACULTY || "").trim().toLowerCase();
          const isSubset = slots.some(other => {
            if (other === c) return false;
            const otherParts = splitSlots(other.SLOT);
            const otherIsCombined = otherParts.some(s => !s.startsWith("L") && s !== "NIL") && otherParts.some(s => s.startsWith("L"));
            if (!otherIsCombined) return false;
            const otherFacNorm = (other.FACULTY || "").trim().toLowerCase();
            const facMatches = otherFacNorm.includes(facNorm) || facNorm.includes(otherFacNorm);
            return facMatches && parts.every(s => otherParts.includes(s));
          });

          return !isSubset;
        });

        const combinedOnly = slots.filter(c => {
          const parts = splitSlots(c.SLOT);
          return parts.some(s => !s.startsWith("L") && s !== "NIL") && parts.some(s => s.startsWith("L"));
        });
        if (combinedOnly.length > 0) {
          slots = combinedOnly;
        }
      }
    }

    if (courseLocks.length > 0) {
      const lock = courseLocks.find(l => l.code === selectedCourseCode);
      if (lock) {
        if (lock.allowedSlots && lock.allowedSlots.length > 0) {
          slots = slots.filter(s => {
            const individualSlots = s.SLOT.split('+').map(sl => sl.trim());
            return individualSlots.some(sl => lock.allowedSlots.includes(sl));
          });
        }
        if (lock.allowedFaculty && lock.allowedFaculty.length > 0) {
          slots = slots.filter(s => lock.allowedFaculty.includes(s.FACULTY));
        }
      }
    }
    return slots;
  }, [masterCourses, selectedCourseCode, courseLocks, isGroupingEnabled]);

  const slotSearchTheoryChoices = useMemo(
    () => Array.from(new Set(availableSlots.flatMap((row) =>
      splitSlots(row.SLOT).filter((slot) => slot !== "NIL" && !slot.startsWith("L"))
    ))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [availableSlots]
  );
  const slotSearchLabChoices = useMemo(
    () => Array.from(new Set(availableSlots.flatMap((row) =>
      splitSlots(row.SLOT).filter((slot) => slot.startsWith("L"))
    ))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [availableSlots]
  );
  const filteredSlotSearchRows = useMemo(() => {
    const query = slotSearchQuery.trim().toLocaleLowerCase();
    return availableSlots
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => matchesOfferingTimeFilter(row.SLOT, slotFilter))
      .filter(({ row }) => matchesOfferingTimeFilter(row.SLOT, slotSearchTimeFilter))
      .filter(({ row }) => matchesSlotTokenFilter(row.SLOT, slotSearchTheoryFilter, false))
      .filter(({ row }) => matchesSlotTokenFilter(row.SLOT, slotSearchLabFilter, true))
      .filter(({ row }) =>
        !query || [row.SLOT, row.FACULTY, row.ROOM].some((value) =>
          String(value ?? "").toLocaleLowerCase().includes(query)
        )
      );
  }, [availableSlots, slotFilter, slotSearchLabFilter, slotSearchQuery, slotSearchTheoryFilter, slotSearchTimeFilter]);

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseCode || selectedSlotIndex === "-1") {
      setError("Please select both a course and a specific slot.");
      return;
    }

    const selectedRow = availableSlots[parseInt(selectedSlotIndex, 10)];
    if (!selectedRow) return;

    const slotsArray = selectedRow.SLOT.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL");
    
    const clashError = checkClashes(slotsArray);
    if (clashError) {
      setError(clashError);
      return;
    }

    // Check if exactly this course & slot is already added
    const duplicate = courses.find(c => c.code === selectedRow.CODE && c.slots.join("+") === slotsArray.join("+"));
    if (duplicate) {
      setError("This exact slot is already in your timetable.");
      return;
    }

    const newCourse: AddedCourse = {
      id: Math.random().toString(36).substr(2, 9),
      code: selectedRow.CODE,
      title: selectedRow.TITLE,
      slots: slotsArray,
      faculty: selectedRow.FACULTY,
      venue: selectedRow.ROOM || "TBA",
      classId: selectedRow.CLASS_ID,
      classIds: selectedRow.CLASS_IDS?.length ? selectedRow.CLASS_IDS : selectedRow.CLASS_ID ? [selectedRow.CLASS_ID] : undefined,
      credits: selectedRow.CREDITS || "0",
      type: selectedRow.TYPE || "Theory",
      color: COLORS[courses.length % COLORS.length],
      batch: selectedRow.BATCH
    };

    updateActiveTimetableCourses([...courses, newCourse]);
    setSelectedCourseCode("");
    setSelectedSlotIndex("-1");
    setError(null);
    setSuccessMsg(`Successfully added ${newCourse.code} (${newCourse.type}) to ${activeTimetable.name}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddGuidedCourse = useCallback((newCourse: AddedCourse) => {
    const isReplacing = courses.some(c => c.code === newCourse.code);
    if (isReplacing) {
      const remaining = courses.filter(c => c.code !== newCourse.code);
      updateActiveTimetableCourses([...remaining, newCourse]);
      setError(null);
      setSuccessMsg(`Successfully replaced slot for ${newCourse.code} in ${activeTimetable.name}.`);
    } else {
      updateActiveTimetableCourses([...courses, newCourse]);
      setError(null);
      setSuccessMsg(`Successfully added ${newCourse.code} (${newCourse.type}) to ${activeTimetable.name}.`);
    }
    setTimeout(() => setSuccessMsg(null), 3000);
  }, [courses, updateActiveTimetableCourses, activeTimetable.name]);

  const handleRemoveCourse = (id: string) => {
    updateActiveTimetableCourses(courses.filter(c => c.id !== id));
  };

  const toggleBlockSlot = (slotName: string) => {
    if (!slotName) return;
    const newBlocked = new Set(blockedSlots);
    if (newBlocked.has(slotName)) {
      newBlocked.delete(slotName);
    } else {
      newBlocked.add(slotName);
    }
    setBlockedSlots(newBlocked);
  };

  // Dynamic Social Score Calculation
  let dynamicSocialScore = 0;
  let isCalculatingSocialScore = false;
  if (socialTargetId) {
    isCalculatingSocialScore = true;
    const activeCourses = timetables.find(t => t.id === activeTimetableId)?.courses || [];
    const mySlots = new Set(activeCourses.flatMap(c => c.slots));
    
    const targetFriend = friends.find(f => f.id === socialTargetId);
    const targetGroup = friendGroups.find(g => g.id === socialTargetId);

    if (targetFriend) {
      let maxFriendScore = 0;
      (targetFriend.timetables || []).forEach(ft => {
        const fSlots = new Set(ft.courses.flatMap(c => c.slots));
        const unionSize = new Set([...mySlots, ...fSlots]).size;
        const score = 60 - unionSize;
        if (score > maxFriendScore) maxFriendScore = score;
      });
      dynamicSocialScore = maxFriendScore;
    } else if (targetGroup) {
      if (socialScoreGroupMethod === "cumulative") {
        let total = 0;
        targetGroup.friendIds.forEach(fid => {
          const f = friends.find(fr => fr.id === fid);
          if (f) {
            let maxScore = 0;
            (f.timetables || []).forEach(ft => {
              const fSlots = new Set(ft.courses.flatMap(c => c.slots));
              const unionSize = new Set([...mySlots, ...fSlots]).size;
              const score = 60 - unionSize;
              if (score > maxScore) maxScore = score;
            });
            total += maxScore;
          }
        });
        dynamicSocialScore = total;
      } else {
        let groupUnionSlots = new Set([...mySlots]);
        targetGroup.friendIds.forEach(fid => {
          const f = friends.find(fr => fr.id === fid);
          if (f && f.timetables && f.timetables.length > 0) {
            let bestFt = f.timetables[0];
            let minUnionSize = 999;
            f.timetables.forEach(ft => {
              const fSlots = new Set(ft.courses.flatMap(c => c.slots));
              const unionSize = new Set([...mySlots, ...fSlots]).size;
              if (unionSize < minUnionSize) {
                minUnionSize = unionSize;
                bestFt = ft;
              }
            });
            const bestFSlots = new Set(bestFt.courses.flatMap(c => c.slots));
            bestFSlots.forEach(s => groupUnionSlots.add(s));
          }
        });
        dynamicSocialScore = 60 - groupUnionSlots.size;
      }
    }
  }

  /**
   * Leave the generator for the planner.
   *
   * The notices earned on that screen — run counts, "no conflict-free weeks" —
   * describe results which only exist there, so they leave with it: without
   * this the planner inherits a banner about a screen it is no longer showing.
   * A save that announces itself sets its own message after calling this, in
   * the same tick, so the last write is the one that sticks.
   */
  const closeGenerator = useCallback(() => {
    setError(null);
    setSuccessMsg(null);
    setIsGeneratorOpen(false);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      const key = e.key.toLowerCase();

      if (isDossierOpen) {
        if (key === "Escape" || key === "p") {
          e.preventDefault();
          setIsDossierOpen(false);
        }
        return;
      }

      // The generator subpage owns the screen while it is open. Every other
      // shortcut here would only set state that nothing renders until you go
      // back — and `1`-`9` and Backspace would silently act on the planner
      // behind it, which is worse than a dead key.
      if (isGeneratorOpen) {
        if (key === "g") {
          e.preventDefault();
          closeGenerator();
        }
        return;
      }

      if (key === "s" || key === "/") {
        e.preventDefault();
        setIsCourseSearchOpen(true);
      } else if (key === "t") {
        e.preventDefault();
        if (layoutMode === "guided") {
          setGuidedInitialPhase("setup_locks");
          setIsGuidedFullScreen(true);
        } else {
          setIsCourseLockOpen(true);
        }
      } else if (key === "g") {
        e.preventDefault();
        setIsGeneratorOpen(true);
      } else if (key === "f") {
        e.preventDefault();
        setIsFriendsManagerOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        createNewTimetable();
      } else if (key === "p") {
        e.preventDefault();
        openPrintablePage();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (confirm("Are you sure you want to clear all courses from this timetable?")) {
          handleClearTimetable();
        }
      } else if (key >= "1" && key <= "9") {
        const index = parseInt(key) - 1;
        if (index < timetables.length) {
          e.preventDefault();
          setActiveTimetableId(timetables[index].id);
          setSuccessMsg(`Switched to ${timetables[index].name}`);
          setTimeout(() => setSuccessMsg(null), 1500);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [timetables, createNewTimetable, openPrintablePage, handleClearTimetable, isGeneratorOpen, closeGenerator, isDossierOpen]);

  /**
   * The generator is a subpage of this tab rather than a sheet over it: it
   * takes the screen, keeps every piece of state passed down from here, and
   * back (button, `g`, system back via the overlay stack) returns to the
   * planner with nothing lost — including a generation still running, which
   * the subpage's own unmount cancels. Rendered by an early return so the
   * planner's own layout and its modals are not mounted behind it.
   */
  if (isDossierOpen) {
    return (
      <FFCSDossierSubpage
        timetable={activeTimetable}
        courses={courses}
        theoryPeriods={theoryPeriods}
        labPeriods={labPeriods}
        days={DAYS}
        masterCourses={masterCourses}
        initialViewMode={resolvedView === "vertical" ? "vertical" : "horizontal"}
        onClose={() => setIsDossierOpen(false)}
      />
    );
  }

  if (isGeneratorOpen) {
    return (
      <div data-prevent-swipe="true" className={`w-full space-y-6 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-950 p-4 md:p-8 overflow-y-auto' : ''}`}>
        <FFCSGeneratorSubpage
          onClose={closeGenerator}
          settings={settings}
          courseLocks={courseLocks}
          friends={friends}
          socialScoreGroupMethod={socialScoreGroupMethod}
          friendGroups={friendGroups}
          masterCourses={masterCourses}
          blockedSlots={blockedSlots}
          timetables={timetables}
          setTimetables={setTimetables}
          setActiveTimetableId={setActiveTimetableId}
          error={error}
          setError={setError}
          successMsg={successMsg}
          setSuccessMsg={setSuccessMsg}
          renderTypeChips={renderTypeChips}
          getGroupedCourses={getGroupedCourses}
          generatorDisplayCourses={generatorDisplayCourses}
          theoryPeriods={theoryPeriods}
          labPeriods={labPeriods}
          toggleBlockSlot={toggleBlockSlot}
        />
      </div>
    );
  }

  return (
    // The provider wraps the whole standard view so one tour instance serves
    // both sides of the bridge: the spotlight for the planner's `data-tour-id`
    // anchors, and the settings sheet for Replay. The dashboard header
    // deliberately does NOT consume the context — it takes the announced step
    // as a plain prop, keeping it a provider-free, reusable UI component. The
    // generator subpage is an early return *above* this tree, so opening it
    // still unmounts the provider and ends any run in progress.
    <TourProvider offerTour={settings.showTour} onStepChange={handleTourStepChange}>
    <div data-prevent-swipe="true" className={`w-full ${layoutMode === "modern" ? "space-y-4" : "space-y-6"} transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-950 p-4 md:p-8 overflow-y-auto' : ''}`}>
      
      {/* ── TOP HEADER BLOCK: EYEBROW, TITLE, ACTIONS & CONTROLS (AmazeCC pattern) ── */}
      {!(layoutMode === "guided" && isGuidedFullScreen) && (
        <div
          className={`space-y-3 ${layoutMode === "modern" ? "px-2 pt-4 sm:px-1 sm:pt-0" : "px-1"}`}
          data-tour-id="ffcs-banner"
        >
        <div className="flex items-start justify-between gap-3">
          <div className={`flex items-start min-w-0 text-left ${layoutMode === "modern" ? "flex-col" : ""}`}>
            {layoutMode === "modern" && (
              <Link
                href="/"
                aria-label="AmazeCC home"
                className="mb-2 shrink-0 transition-transform active:scale-95"
              >
                <img
                  src={getAssetPath("/favicon/favicon.svg")}
                  alt=""
                  className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
                />
              </Link>
            )}
            <div className="flex flex-col items-start min-w-0">
              <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
                {layoutMode === "modern" ? (
                  <span className="font-black tracking-tight text-zinc-700 dark:text-zinc-200">
                    Amaze<span className="text-indigo-600 dark:text-indigo-400">CC</span>
                  </span>
                ) : (
                  "Academics · Registration"
                )}
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate flex items-center gap-2">
                {layoutMode !== "modern" && (
                  <MapIcon className="text-indigo-600 dark:text-indigo-400 w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                )}
                <span>FFCS Planner</span>
              </h1>
              {layoutMode === "modern" ? (
                isLoadingCourses ? (
                  <span className="mt-1 text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs font-semibold flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                    Loading {activeSemester.shortLabel}...
                  </span>
                ) : masterCourses.length > 0 ? (
                  <span className="mt-1 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {activeSemester.shortLabel} loaded ({masterCourses.length} slots)
                  </span>
                ) : (
                  <span className="mt-1 text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs font-semibold flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    No course report loaded
                  </span>
                )
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                  Plan your semester from the {activeSemester.label.toLowerCase()} slot timetable.
                </p>
              )}
            </div>
          </div>

          {/* Action cluster on top-right */}
          <div className="flex items-center gap-1.5 sm:gap-2 pt-0.5 shrink-0">
            {layoutMode === "modern" ? (
              <>
                <div className="hidden xl:flex items-center gap-1.5">
                  <IconButton
                    onClick={() => setIsLayoutModalOpen(true)}
                    title="Switch Planner View"
                    aria-label="Switch Planner View"
                  >
                    <PanelsTopLeft className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => setIsCourseListModalOpen(true)}
                    title="Switch Course List"
                    aria-label="Switch Course List"
                  >
                    <ListFilter className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => setIsSettingsOpen(true)}
                    title="Planner Settings"
                    aria-label="Planner Settings"
                  >
                    <Settings2 className="w-4 h-4" />
                  </IconButton>
                </div>
                <ThemeToggle className="h-9 w-9 rounded-xl border-border-strong shadow-2xs" />
              </>
            ) : (
              <IconButton
                onClick={() => setIsGuideModalOpen(true)}
                title="How does this work?"
              >
                <HelpCircle className="w-4 h-4" />
              </IconButton>
            )}
            {/* Pointless on touch: the shortcuts are all single desktop keys. */}
            <IconButton
              onClick={() => setIsShortcutsModalOpen(true)}
              title="Keyboard Shortcuts"
              className="hidden sm:inline-flex"
            >
              <Keyboard className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => setIsSettingsOpen(true)}
              title="Planner Settings"
              className={layoutMode === "guided" ? "" : "hidden"}
            >
              <Settings2 className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => setIsShareSheetOpen(true)}
              title="Share this plan"
            >
              <Share2 className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
              className="hidden sm:inline-flex"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </IconButton>
          </div>
        </div>

        {/* Secondary controls row: Segmented control + report status badge */}
        {layoutMode !== "modern" && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <SegmentedControl
                value={semesterId}
                onChange={(value) => { void handleSemesterChange(value); }}
                options={FFCS_SEMESTER_REPORTS.map((report) => ({
                  value: report.id,
                  label: report.shortLabel,
                  title: `Load the ${report.label} slot timetable`,
                }))}
              />

              <div className="flex items-center gap-1.5">
                <SegmentedControl
                  value={layoutMode}
                  onChange={(value) => {
                    setLayoutMode(value as "guided" | "modern" | "classic");
                    if (value === "guided") {
                      setGuidedInitialPhase("setup_mode");
                      setIsGuidedFullScreen(true);
                    }
                  }}
                  options={[
                    { value: "guided", label: "Guided", icon: <Compass className="w-3.5 h-3.5" />, title: "Step-by-step mobile-first course selector" },
                    { value: "modern", label: "Modern", icon: <LayoutDashboard className="w-3.5 h-3.5" />, title: "Modernized all-in-one planner dashboard" },
                    { value: "classic", label: "Classic", icon: <BookOpen className="w-3.5 h-3.5" />, title: "Original two-panel planner dashboard" },
                  ]}
                />

                <button
                  type="button"
                  onClick={() => setIsLayoutModalOpen(true)}
                  title="Choose planner layout experience (Guided Hero vs Standard View)"
                  aria-label="Choose layout mode"
                  className="h-8 w-8 rounded-xl border border-border-strong/70 bg-surface hover:bg-surface-secondary text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLoadingCourses ? (
                <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  Loading {activeSemester.shortLabel}...
                </span>
              ) : masterCourses.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {activeSemester.shortLabel} loaded ({masterCourses.length} slots)
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No course report loaded
                </span>
              )}
            </div>
          </div>
        )}

        {(error || successMsg) && (
          <div className={`p-3 rounded-xl flex items-start gap-2 text-xs font-medium border shadow-2xs ${error ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
            {error ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{error || successMsg}</span>
          </div>
        )}
      </div>
      )}

      {/* Evergreen hints, each dismissed for good. Above the fold so they are
          read where they apply rather than scrolled past inside a card. */}
      {hints.length > 0 && !(layoutMode === "guided" && isGuidedFullScreen) && (
        <div className="space-y-2">
          {hints.map((hint) => (
            <Tip key={hint.id} hint={hint} onDismiss={() => dismissHint(hint.id)} />
          ))}
        </div>
      )}

      <div
        className={
          showVerticalTimetableBesideWidgets
            ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] xl:items-start"
            : "flex flex-col gap-6"
        }
      >
        
        {layoutMode === "guided" ? (
          <FFCSGuidedSelector
            masterCourses={masterCourses}
            uniqueCourses={uniqueCourses}
            courses={courses}
            activeTimetable={activeTimetable}
            onAddCourse={handleAddGuidedCourse}
            checkClashes={checkClashes}
            isGroupingEnabled={isGroupingEnabled}
            setIsGroupingEnabled={setIsGroupingEnabled}
            renderTypeChips={renderTypeChips}
            getBatchColorClass={getBatchColorClass}
            courseAlternativesPool={courseAlternativesPool}
            onOpenFacultyReview={(target) => setFacultyReviewTarget(target)}
            onOpenPasteRegistered={() => setIsPasteRegisteredModalOpen(true)}
            onOpenManualLinker={() => setIsManualLinkerOpen(true)}
            onViewTimetable={() => handleSelectLayoutMode("modern", true)}
            isFullScreen={isGuidedFullScreen}
            onToggleFullScreen={setIsGuidedFullScreen}
            onSwitchToSinglePageView={() => handleSelectLayoutMode("modern", true)}
            timetables={timetables}
            onSelectTimetable={setActiveTimetableId}
            onCreateNewTimetable={createNewTimetable}
            onRenameTimetable={(id, newName) => {
              const trimmed = newName.trim();
              if (trimmed) {
                setTimetables((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
              }
            }}
            onDeleteTimetable={deleteTimetable}
            onOpenGenerator={() => setIsGeneratorOpen(true)}
            onOpenCourseLocks={() => {
              setGuidedInitialPhase("setup_locks");
              setIsGuidedFullScreen(true);
            }}
            initialGuidedPhase={guidedInitialPhase}
            courseLocks={courseLocks}
            setCourseLocks={setCourseLocks}
            uniqueCourseCodes={uniqueCourseCodes}
            onImportCourses={handleImportCourses}
            onImportToTimetable={(added) => handleLoadRegisteredCourses(added, [], false)}
            onOpenFacultySchedule={handleOpenFacultySchedule}
            friends={friends}
            friendGroups={friendGroups}
            socialScoreGroupMethod={socialScoreGroupMethod}
            blockedSlots={blockedSlots}
            setBlockedSlots={setBlockedSlots}
            onToggleBlockSlot={toggleBlockSlot}
            settings={settings}
          />
        ) : layoutMode === "classic" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Classic Timetable Manager */}
            <div className="card-surface border border-border-strong rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden text-text-primary backdrop-blur-xs flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-blue-500" />
                    <span>Timetable Manager</span>
                  </h2>
                  <span className="text-xs text-muted-foreground bg-surface-secondary/70 border border-border-strong px-2.5 py-1 rounded-full font-medium">
                    {activeTimetable?.courses.length || 0} courses
                  </span>
                </div>

                {/* Timetable Selector as Modal Trigger */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSheetEditingId(null); setIsTimetableModalOpen(true); }}
                    className="flex-1 bg-surface border border-border-strong hover:border-blue-500/40 rounded-2xl pl-4 pr-3.5 py-2.5 text-sm text-text-heading hover:bg-surface-secondary/50 transition-all flex items-center justify-between gap-2 shadow-xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate font-semibold">{activeTimetable?.name || 'Select Timetable'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground bg-surface-secondary px-2 py-0.5 rounded-md font-medium">{activeTimetable?.courses.length || 0} courses</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-text-heading transition-transform" />
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={createNewTimetable} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-2xl transition-all duration-200 flex items-center gap-1.5 shadow-md shadow-blue-600/10 shrink-0 cursor-pointer active:scale-95"
                    title="Create New Timetable"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-semibold">New</span>
                  </button>
                </div>

                {/* Active Timetable Actions: Rename, Duplicate, Delete */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-secondary/40 border border-border-strong/60 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => { setSheetEditValue(activeTimetable.name); setSheetEditingId(activeTimetableId); }}
                    className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-text-heading hover:bg-surface rounded-lg transition-all font-medium cursor-pointer"
                    title="Rename Current Timetable"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={duplicateTimetable}
                    className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-text-heading hover:bg-surface rounded-lg transition-all font-medium cursor-pointer"
                    title="Duplicate Current Timetable"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => deleteTimetable(activeTimetableId)}
                    className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all font-medium cursor-pointer"
                    title="Delete Current Timetable"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                {sheetEditingId === activeTimetableId && (
                  <div className="flex gap-2 mt-2 animate-fadeIn">
                    <input 
                      type="text" 
                      value={sheetEditValue}
                      onChange={e => setSheetEditValue(e.target.value)}
                      className="flex-1 bg-surface border border-border-strong rounded-xl px-3 py-1.5 text-base sm:text-sm text-text-heading focus:outline-none focus:border-blue-500/50"
                      placeholder="New name..."
                    />
                    <button 
                      onClick={() => submitSheetRename(activeTimetableId)}
                      className="bg-green-500/20 text-green-400 p-2 rounded-xl border border-green-500/20 hover:bg-green-500/30 relative hit-expand touch-press active:scale-[0.95]"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Utility Row: Export Calendar, Friends, Backup/Restore */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-tour-id="ffcs-export">
                  <button 
                    type="button"
                    onClick={() => exportTimetableIcal(activeTimetable, getTimetableSchema(), new Date().toISOString().split('T')[0], new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0])}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 bg-surface border border-border-strong hover:border-blue-500/30 rounded-xl hover:bg-surface-secondary/40 transition-all text-[11px] text-text-heading font-medium shadow-2xs group cursor-pointer"
                    title="Export to Apple/Google Calendar"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate w-full text-center">iCal Export</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => setIsFriendsManagerOpen(true)}
                    data-tour-id="ffcs-social"
                    className="flex flex-col items-center justify-center gap-1.5 p-2 bg-surface border border-border-strong hover:border-pink-500/30 rounded-xl hover:bg-surface-secondary/40 transition-all text-[11px] text-text-heading font-medium shadow-2xs group cursor-pointer"
                    title="Manage friends and compare schedules"
                  >
                    <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-500 group-hover:scale-110 transition-transform">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate w-full text-center">Friends</span>
                  </button>

                  <button 
                    type="button"
                    onClick={exportTimetables}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 bg-surface border border-border-strong hover:border-indigo-500/30 rounded-xl hover:bg-surface-secondary/40 transition-all text-[11px] text-text-heading font-medium shadow-2xs group cursor-pointer"
                    title="Export backup data (JSON)"
                  >
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                      <Save className="w-3.5 h-3.5" />
                    </div>
                    <span>Backup</span>
                  </button>

                  <label 
                    className="flex flex-col items-center justify-center gap-1.5 p-2 bg-surface border border-border-strong hover:border-emerald-500/30 rounded-xl hover:bg-surface-secondary/40 transition-all text-[11px] text-text-heading font-medium cursor-pointer shadow-2xs group"
                    title="Import backup data (JSON)"
                  >
                    <input type="file" accept=".json" onChange={importTimetables} className="hidden" />
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                    <span>Restore</span>
                  </label>
                </div>

                {/* Core Planners: Target Courses, Auto-Generate */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-strong/40">
                  <button 
                    type="button"
                    onClick={() => setIsCourseLockOpen(true)}
                    data-tour-id="ffcs-add-course"
                    className="bg-purple-500/10 hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 text-sm font-semibold py-2.5 rounded-xl border border-purple-500/25 transition-all flex items-center justify-center gap-2 relative shadow-2xs group cursor-pointer"
                  >
                    <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
                    <span>Target Courses</span>
                    {courseLocks.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-background shadow-xs">
                        {courseLocks.length}
                      </span>
                    )}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => setIsGeneratorOpen(true)}
                    data-tour-id="ffcs-generate"
                    className="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm font-semibold py-2.5 rounded-xl border border-amber-500/25 transition-all flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
                  >
                    <Wand2 className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
                    <span>Auto-Generate</span>
                  </button>
                </div>

                {/* Paste Registered Courses from VTOP */}
                <button
                  type="button"
                  onClick={() => setIsPasteRegisteredModalOpen(true)}
                  className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold py-2.5 rounded-xl border border-purple-500/20 transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                  title="Paste registered courses from VTOP View/Modify page to display on your timetable"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Paste Registered Courses from VTOP</span>
                </button>

                {/* Faculty Schedule */}
                <button
                  type="button"
                  onClick={() => setIsFacultyScheduleOpen(true)}
                  className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm font-semibold py-2.5 rounded-xl border border-cyan-500/20 transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                  title="See the full week taught by any faculty in the course report"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Faculty Schedule</span>
                  {facultyGroups.length > 0 && (
                    <span className="text-xs font-bold bg-cyan-500/20 px-1.5 py-0.5 rounded-md">
                      {facultyGroups.length}
                    </span>
                  )}
                </button>

                {/* Vitfac Community Review Link */}
                {ENABLE_VITFAC_INTEGRATION && (
                  <div className="flex flex-col gap-1">
                    <a
                      href="https://vitfac.pages.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-2 px-3 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-between gap-2 shadow-2xs group"
                      title="Leave faculty reviews on vitfac.pages.dev to help other students"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-bold text-[11px]">
                          ★
                        </span>
                        <span className="truncate">Reviewed your profs? Leave a review on vitfac!</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <p className="text-[10px] text-muted-foreground/60 px-1 leading-tight">
                      Disclaimer: Ratings are sourced from third-party platform <a href="https://vitfac.pages.dev" target="_blank" rel="noopener noreferrer" className="hover:underline text-muted-foreground">vitfac.pages.dev</a>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Classic Course Selector */}
            <div className="card-surface border border-border-strong rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden text-text-primary backdrop-blur-xs flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
                    <PlusCircle className="text-blue-500 w-5 h-5" /> Course Selector
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPasteRegisteredModalOpen(true)}
                      className="text-xs px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold rounded-lg transition-colors border border-purple-500/20 flex items-center gap-1.5"
                      title="Paste courses directly from VTOP"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Paste VTOP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManualLinkerOpen(true)}
                      className="text-xs px-2 py-1 bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading font-medium rounded-lg transition-colors border border-border-strong"
                    >
                      Advanced Linker
                    </button>
                  </div>
                </div>
                
                {!masterCourses.length ? (
                  <EmptyState
                    title="Please upload a master slots file first."
                    className="bg-surface border border-border-strong rounded-xl"
                  />
                ) : (
                  <form onSubmit={handleAddCourse} className="space-y-4">
                    <div className="flex items-center justify-between bg-surface-secondary/30 p-3 rounded-2xl border border-border-strong">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-heading flex items-center gap-2">
                          Group Embedded Courses
                        </span>
                        <Switch
                          checked={isGroupingEnabled}
                          onCheckedChange={setIsGroupingEnabled}
                          label="Group Embedded Courses"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">1. Select Course</label>
                      <button 
                        type="button"
                        onClick={() => setIsCourseSearchOpen(true)}
                        className="w-full bg-surface border border-border-strong hover:border-blue-500/40 rounded-2xl px-4 py-3 text-left text-text-heading hover:bg-surface-secondary/50 transition-colors flex justify-between items-center group shadow-xs cursor-pointer"
                      >
                        <span className="truncate text-sm font-medium">
                          {selectedCourseCode 
                            ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-text-heading">{selectedCourseCode} - {uniqueCourses.find(c => c.code === selectedCourseCode)?.title}</span>
                                 {renderTypeChips(uniqueCourses.find(c => c.code === selectedCourseCode)?.types || [], 'sm')}
                                 {(uniqueCourses.find(c => c.code === selectedCourseCode)?.batches || []).map(b => (
                                   <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                                     {b}
                                   </span>
                                 ))}
                              </div>
                            )
                            : <span className="text-muted-foreground">-- Search & Choose Course --</span>}
                        </span>
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                      </button>
                    </div>
                    
                    {selectedCourseCode && (
                      <div className="animate-fadeIn space-y-2">
                        <label className="block text-xs font-semibold text-muted-foreground ml-1">2. Select Slot & Faculty</label>
                        <div className="flex gap-2">
                          <div className="w-1/3 min-w-0 flex items-center">
                            <ChipTabs
                              size="sm"
                              className="min-w-0"
                              value={slotFilter}
                              onChange={(v) => {
                                setSlotFilter(v);
                                setSelectedSlotIndex("-1");
                              }}
                              options={[
                                { value: "all", label: "All" },
                                ...((!hasLab || hasTheory)
                                  ? [
                                      { value: "morning_theory", label: "Morning Theory" },
                                      { value: "evening_theory", label: "Evening Theory" },
                                    ]
                                  : []),
                                ...((!hasTheory || hasLab)
                                  ? [
                                      { value: "morning_lab", label: "Morning Lab" },
                                      { value: "evening_lab", label: "Evening Lab" },
                                    ]
                                  : []),
                              ]}
                            />
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setIsSlotSearchOpen(true)}
                            className="w-2/3 bg-surface border border-border-strong hover:border-blue-500/40 rounded-2xl px-4 py-2.5 text-left text-text-heading hover:bg-surface-secondary/50 transition-colors flex justify-between items-center group shadow-xs cursor-pointer"
                          >
                            <span className="truncate text-sm font-medium flex items-center gap-1.5 min-w-0">
                              {selectedSlotIndex !== "-1" && availableSlots[parseInt(selectedSlotIndex)]
                                ? (() => {
                                    const row = availableSlots[parseInt(selectedSlotIndex)];
                                    const rowSlots = row?.SLOT?.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL") || [];
                                    const theorySlots = rowSlots.filter(s => !s.startsWith("L"));
                                    const labSlots = rowSlots.filter(s => s.startsWith("L"));
                                    let facultyCountDisplay = "1";
                                    let facultyCountTitle = "1 faculty teaching this slot";

                                    if (theorySlots.length > 0 && labSlots.length > 0) {
                                      const facParts = (row?.FACULTY || "").split(/\s*\/\s*/);
                                      const tAlts = sameSlotFacultyAlternatives(
                                        selectedCourseCode,
                                        theorySlots,
                                        { faculty: facParts[0] || row?.FACULTY, employeeId: row?.ERP_ID },
                                        courseAlternativesPool
                                      );
                                      const lAlts = sameSlotFacultyAlternatives(
                                        selectedCourseCode,
                                        labSlots,
                                        { faculty: facParts[1] || facParts[0] || row?.FACULTY },
                                        courseAlternativesPool
                                      );
                                      const tCount = 1 + tAlts.length;
                                      const lCount = 1 + lAlts.length;
                                      facultyCountDisplay = tCount === lCount ? `${tCount}` : `${tCount} / ${lCount}`;
                                      facultyCountTitle = `${tCount} theory / ${lCount} lab faculties teaching this slot`;
                                    } else {
                                      const facultyAlts = sameSlotFacultyAlternatives(
                                        selectedCourseCode,
                                        rowSlots,
                                        { faculty: row?.FACULTY, employeeId: row?.ERP_ID },
                                        courseAlternativesPool
                                      );
                                      const facultyCount = 1 + facultyAlts.length;
                                      facultyCountDisplay = `${facultyCount}`;
                                      facultyCountTitle =
                                        facultyCount === 1
                                          ? "1 faculty teaching this slot"
                                          : `${facultyCount} faculties teaching this slot`;
                                    }

                                    return (
                                      <>
                                        <FacultyAvatar
                                          employeeId={row.ERP_ID}
                                          name={row.FACULTY}
                                          size="xs"
                                          tone="blue"
                                        />
                                        <span className="truncate">{row.SLOT} - {row.FACULTY}</span>
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0"
                                          title={facultyCountTitle}
                                        >
                                          <Users className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                          <span>{facultyCountDisplay}</span>
                                        </span>
                                        <VitfacReviewPill
                                          employeeId={row.ERP_ID}
                                          name={row.FACULTY}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setFacultyReviewTarget({
                                              name: row.FACULTY,
                                              employeeId: row.ERP_ID,
                                              courseCode: selectedCourseCode || undefined,
                                            });
                                          }}
                                        />
                                      </>
                                    );
                                  })()
                                : <span className="text-muted-foreground">-- Search & Choose Slot --</span>}
                            </span>
                            <Search className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 ml-1 leading-tight">
                          * For embedded courses, theory and lab slots taught by the same faculty are automatically linked.
                        </p>
                      </div>
                    )}
                    
                    <button 
                      type="submit" 
                      disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl shadow-md transition-all duration-300 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Add to Timetable
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <FFCSDashboardHeader
            activeTimetable={activeTimetable}
            timetables={timetables}
            onCreateNewTimetable={createNewTimetable}
            onRenameTimetable={(id, newName) => {
              const trimmed = newName.trim();
              if (trimmed) {
                setTimetables((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
              }
            }}
            onDuplicateTimetable={duplicateTimetable}
            onDeleteTimetable={deleteTimetable}
            onOpenTimetableModal={() => { setSheetEditingId(null); setIsTimetableModalOpen(true); }}
            onExportIcal={() => exportTimetableIcal(activeTimetable, getTimetableSchema(), new Date().toISOString().split('T')[0], new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0])}
            onExportTimetablesJson={exportTimetables}
            onImportTimetablesJson={importTimetables}
            onOpenLayoutPicker={() => setIsLayoutModalOpen(true)}
            onOpenCourseListPicker={() => setIsCourseListModalOpen(true)}
            onOpenPlannerSettings={() => setIsSettingsOpen(true)}
            wideScreenSingleWidgetColumn={showVerticalTimetableBesideWidgets}
            onOpenHelp={layoutMode === "modern" ? () => setIsGuideModalOpen(true) : undefined}
            currentCourseListLabel={activeSemester.label}
            currentLayoutLabel={`${layoutMode[0].toUpperCase()}${layoutMode.slice(1)} planner`}
            courses={courses}
            onRemoveCourse={handleRemoveCourse}
            blockedSlots={blockedSlots}
            onOpenCourseSearch={() => setIsCourseSearchOpen(true)}
            onOpenCourseLocks={() => setIsCourseLockOpen(true)}
            courseLocksCount={courseLocks.length}
            onOpenGenerator={() => setIsGeneratorOpen(true)}
            onOpenPasteRegistered={() => setIsPasteRegisteredModalOpen(true)}
            onOpenManualLinker={() => setIsManualLinkerOpen(true)}
            selectedCourseCode={selectedCourseCode}
            onClearSelectedCourse={() => { setSelectedCourseCode(""); setSelectedSlotIndex("-1"); }}
            selectedCourse={selectedCourse}
            isGroupingEnabled={isGroupingEnabled}
            setIsGroupingEnabled={setIsGroupingEnabled}
            slotFilter={slotFilter}
            setSlotFilter={setSlotFilter}
            selectedSlotIndex={selectedSlotIndex}
            setSelectedSlotIndex={setSelectedSlotIndex}
            availableSlots={availableSlots}
            hasTheory={hasTheory}
            hasLab={hasLab}
            onOpenSlotSearch={() => setIsSlotSearchOpen(true)}
            onAddCourse={handleAddCourse}
            courseAlternativesPool={courseAlternativesPool}
            onOpenFacultyReview={(target) => setFacultyReviewTarget(target)}
            renderTypeChips={renderTypeChips}
            getBatchColorClass={getBatchColorClass}
            friends={friends}
            friendGroups={friendGroups}
            socialTargetId={socialTargetId}
            setSocialTargetId={setSocialTargetId}
            socialScoreGroupMethod={socialScoreGroupMethod}
            setSocialScoreGroupMethod={setSocialScoreGroupMethod}
            isCalculatingSocialScore={isCalculatingSocialScore}
            dynamicSocialScore={dynamicSocialScore}
            onOpenSocialMatrix={() => setIsSocialMatrixOpen(true)}
            onOpenFriendsManager={() => setIsFriendsManagerOpen(true)}
            facultyGroupsCount={facultyGroups.length}
            onOpenFacultySchedule={handleOpenFacultySchedule}
            enableVitfacIntegration={ENABLE_VITFAC_INTEGRATION}
            isDownloading={isDownloading}
            onDownloadHtmlDossier={downloadDossierHtml}
            onDownloadImage={downloadImage}
            onOpenPrintablePage={openPrintablePage}
            onOpenDetachedPrintablePage={openDetachedPrintablePage}
            tourStepTarget={tourStepTarget}
          />
        )}

        {/* Right Panel: The Grid and Export */}
        {layoutMode !== "guided" && (
          <div
            id="ffcs-timetable-grid"
            className={`w-full space-y-6 ${showVerticalTimetableBesideWidgets ? "xl:contents" : ""}`}
          >
          {layoutMode === "classic" && (
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            {/* Social Score Widget */}
            <div className="flex items-center gap-3 bg-surface-secondary/20 border border-border-strong p-2 rounded-xl w-full md:w-auto flex-1 max-w-md print:hidden">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3 text-pink-500" /> Social Score</label>
                  {isCalculatingSocialScore && (
                    <button 
                      onClick={() => setIsSocialMatrixOpen(true)}
                      className="text-xs font-bold text-pink-500 bg-pink-500/10 hover:bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/20 transition-colors cursor-pointer"
                    >
                      Score: {dynamicSocialScore}%
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Popup-free on purpose — same z-70-portal trap as the
                      slot filter above. Group membership rides on `title`
                      since a single scrolling strip has no optgroup headers. */}
                  <ChipTabs
                    className="flex-1 min-w-0"
                    value={socialTargetId}
                    onChange={setSocialTargetId}
                    options={[
                      { value: "", label: "Select Friend/Group…", title: "No target selected" },
                      ...friends.map((f) => ({ value: f.id, label: f.name, title: `Friend: ${f.name}` })),
                      ...friendGroups.map((g) => ({ value: g.id, label: g.name, title: `Group: ${g.name}` })),
                    ]}
                  />
                  
                  {friendGroups.find(g => g.id === socialTargetId) && (
                    <span title="Calculation Method" className="shrink-0">
                      <SegmentedControl
                        value={socialScoreGroupMethod}
                        onChange={setSocialScoreGroupMethod}
                        options={[
                          { value: "intersection", label: "Intersection" },
                          { value: "cumulative", label: "Cumulative" },
                        ]}
                      />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0 ml-auto">
              <button 
                onClick={() => downloadDossierHtml()}
                disabled={isDownloading || courses.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
                title="Download a standalone HTML dossier"
              >
                <Printer className="w-4 h-4" />
                <span>{isGeneratingPdf ? "Preparing HTML dossier..." : "Download HTML Dossier"}</span>
              </button>
              <div className="relative group flex items-center gap-2">
                <button
                  onClick={() => downloadImage(settings.exportFormat)}
                  disabled={isDownloading || courses.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-text-heading px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading
                    ? "Generating..."
                    : `Download ${settings.exportFormat.toUpperCase()} (${(resolvedView ?? (isMobile ? "vertical" : "horizontal")) === "vertical" ? "Vertical" : "Horizontal"})`}
                </button>
                {/* Touch devices never hover the trigger above, so the
                    hover-only format menu is unreachable there. Surface the
                    other format as a direct sibling action; the hover menu
                    stays for pointer devices. */}
                <button
                  onClick={() => downloadImage(settings.exportFormat === 'jpg' ? 'png' : 'jpg')}
                  disabled={isDownloading || courses.length === 0}
                  className="hidden items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-text-heading px-3 py-2 rounded-xl text-sm font-medium transition-colors [@media(any-hover:none)]:flex shadow-lg shadow-blue-500/20"
                >
                  {settings.exportFormat === 'jpg' ? 'PNG' : 'JPG'}
                </button>
                <div className="absolute right-0 top-full mt-1 w-68 bg-surface border border-border-strong rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden text-xs">
                  <button 
                    onClick={() => downloadDossierHtml()}
                    className="w-full text-left px-4 py-2.5 text-text-heading hover:bg-surface-secondary transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5 text-indigo-400" />
                      Download HTML (Current Theme)
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-1.5 py-0.5 rounded">HTML</span>
                  </button>
                  <button 
                    onClick={() => downloadDossierHtml('light')}
                    className="w-full text-left px-4 py-2 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong/50"
                  >
                    ☀️ Download HTML (Ink-Saver Light)
                  </button>
                  <button 
                    onClick={() => downloadDossierHtml('dark')}
                    className="w-full text-left px-4 py-2 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong/50"
                  >
                    🌙 Download HTML (Dark Mode)
                  </button>
                  <button 
                    onClick={() => downloadImage('jpg')}
                    className="w-full text-left px-4 py-2.5 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong"
                  >
                    Download JPG (Current: {(resolvedView ?? (isMobile ? 'vertical' : 'horizontal')).toUpperCase()})
                  </button>
                  <button 
                    onClick={() => downloadImage('jpg', 'vertical')}
                    className="w-full text-left px-4 py-2 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong/50"
                  >
                    Download JPG (Vertical Heatmap)
                  </button>
                  <button 
                    onClick={() => downloadImage('jpg', 'horizontal')}
                    className="w-full text-left px-4 py-2 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong/50"
                  >
                    Download JPG (Horizontal Grid)
                  </button>
                  <button 
                    onClick={() => downloadImage('png')}
                    className="w-full text-left px-4 py-2 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong"
                  >
                    Download PNG (Current View)
                  </button>
                  <button 
                    onClick={() => openPrintablePage()}
                    className="w-full text-left px-4 py-2.5 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Preview Dossier (In-App)
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-1.5 py-0.5 rounded">VIEW</span>
                  </button>
                  <button 
                    onClick={() => openDetachedPrintablePage()}
                    className="w-full text-left px-4 py-2.5 text-text-heading hover:bg-surface-secondary transition-colors border-t border-border-strong/50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      Standalone Print Tab
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
          <div
            ref={captureRef}
            className={`space-y-6 rounded-xl ${showVerticalTimetableBesideWidgets ? "xl:contents" : ""}`}
            data-tour-id="ffcs-grid"
          >
            {/* Header for the exported image */}
            <div className="hidden print:block p-4 mb-4 bg-surface-secondary rounded-xl border border-border-strong text-center">
              <h1 className="text-2xl font-bold text-text-heading">{activeTimetable.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">Generated by AmazeCC FFCS Planner</p>
            </div>
            
            <TimetableView
              courses={courses}
              theoryPeriods={theoryPeriods}
              labPeriods={labPeriods}
              days={DAYS}
              blockedSlots={blockedSlots}
              onToggleBlockSlot={toggleBlockSlot}
              selectedGapDetails={selectedGapDetails}
              title="Unified Schedule"
              showLegend
              forceView={showVerticalTimetableBesideWidgets ? "vertical" : undefined}
              className={showVerticalTimetableBesideWidgets ? "xl:col-start-2 xl:row-start-1" : undefined}
            />
            
            {/* Bottom Panel: Selected Courses Table inside capture ref to include in image */}
            {courses.length > 0 ? (
              <div
                data-testid="ffcs-selected-courses"
                className={`bg-transparent md:card-surface border-0 md:border md:border-border-strong rounded-none md:rounded-2xl shadow-none md:shadow-xs text-text-primary p-0 md:p-6 ${
                  showVerticalTimetableBesideWidgets ? "xl:col-span-full" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-bold text-text-heading flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    Selected Courses
                    <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                      Total Credits: {getGroupedCourses(courses).reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}
                    </span>
                  </h2>
                  <button 
                    onClick={handleClearTimetable}
                    className="text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 print:hidden whitespace-nowrap ml-auto"
                  >
                    <Trash2 className="w-4 h-4" /> Clear All
                  </button>
                </div>
                
                {/* Mobile Cards (on small screens) */}
                <div className="block md:hidden space-y-3 print:hidden">
                    {getGroupedCourses(courses).map(c => {
                      const rawHalves: AddedCourse[] = courses.filter((course) =>
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
                            courseAlternativesPool
                          )
                        : [];

                      const expandedHalves = expandCourseHalves(rawHalves);
                      const counts = expandedHalves.map((half) => {
                        const alts = sameSlotFacultyAlternatives(
                          half.code,
                          half.slots,
                          { faculty: half.faculty, employeeId: half.employeeId },
                          courseAlternativesPool
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

                      const badgeProps = getCourseBadgeProps(c.color, resolvedView !== "classic");

                      return (
                        <div key={c.id} className="p-3.5 rounded-2xl bg-surface border border-border-strong shadow-2xs space-y-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={badgeProps.className} style={badgeProps.style}>{c.code}</div>
                                {renderTypeChips(c.type, "sm")}
                                <span className="text-[10px] text-muted-foreground font-semibold bg-surface-secondary/70 px-1.5 py-0.5 rounded border border-border-strong/50">
                                  {c.credits} cr
                                </span>
                                {c.batches && c.batches.length > 0 && c.batches.map(b => (
                                  <span key={b} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBatchColorClass(b)}`}>
                                    {b}
                                  </span>
                                ))}
                              </div>
                              <h3 className="text-xs sm:text-sm font-bold text-text-heading leading-snug line-clamp-2">
                                {c.title}
                              </h3>
                            </div>
                            <button 
                              onClick={() => {
                                c.ids.forEach(id => handleRemoveCourse(id));
                              }}
                              className="text-muted-foreground hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 relative hit-expand touch-press active:scale-[0.95]"
                              title="Remove Course"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/40">
                            <div className="flex items-center gap-2 min-w-0">
                              <FacultyAvatar
                                employeeId={rawHalves[0]?.employeeId || (c as any).employeeId}
                                name={c.faculty}
                                size="xs"
                                tone="blue"
                              />
                              <button
                                type="button"
                                onClick={() => setSlotSwapRow({ code: c.code, title: c.title, ids: c.ids ?? [c.id] })}
                                title={facultyCountTitle}
                                className="flex items-center gap-1.5 text-xs text-text-heading/90 hover:text-blue-500 transition-colors cursor-pointer min-w-0 touch-press active:scale-[0.98]"
                              >
                                <span className="truncate max-w-[130px] font-medium">{c.faculty}</span>
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground hover:text-blue-500 shrink-0"
                                  title={facultyCountTitle}
                                >
                                  <Users className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                  <span>{facultyCountDisplay}</span>
                                </span>
                              </button>
                            </div>
                            <VitfacReviewPill
                              employeeId={rawHalves[0]?.employeeId || (c as any).employeeId}
                              name={c.faculty}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFacultyReviewTarget({
                                  name: c.faculty,
                                  employeeId: rawHalves[0]?.employeeId || (c as any).employeeId,
                                  courseCode: c.code,
                                });
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap gap-1 items-center">
                              {c.slots.map(s => (
                                <span key={s} className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-medium truncate shrink-0 max-w-[140px]">
                              📍 {c.venue}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                <div className="hidden md:block overflow-x-auto scrollbar-none">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border-strong">
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {getGroupedCourses(courses).map(c => {
                        const rawHalves: AddedCourse[] = courses.filter((course) =>
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
                              courseAlternativesPool
                            )
                          : [];

                        const expandedHalves = expandCourseHalves(rawHalves);
                        const counts = expandedHalves.map((half) => {
                          const alts = sameSlotFacultyAlternatives(
                            half.code,
                            half.slots,
                            { faculty: half.faculty, employeeId: half.employeeId },
                            courseAlternativesPool
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

                        const badgeProps = getCourseBadgeProps(c.color, resolvedView !== "classic");

                        return (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className={badgeProps.className} style={badgeProps.style}>{c.code}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-muted-foreground text-xs max-w-xs">{c.title}</p>
                                {c.batches && c.batches.length > 0 && c.batches.map(b => (
                                  <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-text-heading/80">
                            {renderTypeChips(c.type)}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FacultyAvatar
                                employeeId={rawHalves[0]?.employeeId || (c as any).employeeId}
                                name={c.faculty}
                                size="xs"
                                tone="blue"
                              />
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setSlotSwapRow({ code: c.code, title: c.title, ids: c.ids ?? [c.id] })}
                                  title={facultyCountTitle}
                                  className="flex items-center gap-1.5 text-sm text-text-heading/80 hover:text-blue-500 transition-colors cursor-pointer max-w-full"
                                >
                                  <span className="truncate">{c.faculty}</span>
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground group-hover:text-blue-500 group-hover:border-blue-500/40 transition-colors shrink-0"
                                    title={facultyCountTitle}
                                  >
                                    <Users className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-blue-500 shrink-0" />
                                    <span>{facultyCountDisplay}</span>
                                  </span>
                                </button>
                                <VitfacReviewPill
                                  employeeId={rawHalves[0]?.employeeId || (c as any).employeeId}
                                  name={c.faculty}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFacultyReviewTarget({
                                      name: c.faculty,
                                      employeeId: rawHalves[0]?.employeeId || (c as any).employeeId,
                                      courseCode: c.code,
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {c.slots.map(s => (
                                <span key={s} className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-text-heading/80 max-w-xs">{c.venue}</td>
                          <td className="py-3 px-2 text-sm text-text-heading/80">{c.credits}</td>
                          <td className="py-3 px-2 text-right print:hidden">
                            <button 
                              onClick={() => {
                                c.ids.forEach(id => handleRemoveCourse(id));
                              }}
                              className="text-muted-foreground hover:text-red-400 transition-colors p-2"
                              title="Remove Course"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div
                data-testid="ffcs-selected-courses"
                className={`card-surface border border-border-strong rounded-2xl p-8 text-center text-text-primary space-y-3 shadow-xs ${
                  showVerticalTimetableBesideWidgets ? "xl:col-span-full" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-text-heading">No Courses Added to {activeTimetable.name}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Your timetable grid is currently empty. Use the course adder to search courses, verify conflicts, and schedule your semester.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>



      {/* Auto-Generator Modal */}
      {/* Target Courses Modal (shown as bottom sheet modal outside of guided mode) */}
      <TargetCoursesModal
        isOpen={isCourseLockOpen && layoutMode !== "guided"}
        onClose={() => setIsCourseLockOpen(false)}
        courseLocks={courseLocks}
        setCourseLocks={setCourseLocks}
        masterCourses={masterCourses}
        uniqueCourseCodes={uniqueCourseCodes}
        renderTypeChips={renderTypeChips}
        onImportCourses={handleImportCourses}
        onImportToTimetable={(added) => handleLoadRegisteredCourses(added, [], false)}
      />

      <PasteRegisteredCoursesModal
        isOpen={isPasteRegisteredModalOpen}
        onClose={() => setIsPasteRegisteredModalOpen(false)}
        onLoadCourses={handleLoadRegisteredCourses}
      />

      <FacultyScheduleModal
        open={isFacultyScheduleOpen}
        onClose={() => {
          setIsFacultyScheduleOpen(false);
          setFacultyScheduleInitial(undefined);
        }}
        groups={facultyGroups}
        initialFaculty={facultyScheduleInitial}
        masterCourses={masterCourses}
      />

      <FacultyReviewSheet
        open={!!facultyReviewTarget}
        onClose={() => setFacultyReviewTarget(null)}
        facultyName={facultyReviewTarget?.name || ""}
        employeeId={facultyReviewTarget?.employeeId}
        courseCode={facultyReviewTarget?.courseCode}
      />

      <AnimatePresence>
        {slotSwapRow && (
          <SlotFacultySwapSheet
            code={slotSwapRow.code}
            courseTitle={slotSwapRow.title}
            halves={courses.filter((c) => slotSwapRow.ids.includes(c.id))}
            masterCourses={masterCourses}
            allTimetableCourses={courses}
            blockedSlots={blockedSlots}
            onSwap={swapSlotFaculty}
            onClose={() => setSlotSwapRow(null)}
            backdropZIndex={450}
            panelZIndex={455}
          />
        )}
      </AnimatePresence>

      {/* Friends Manager — a sheet, so it carries its own z rather than the
          sheet default: the tab can be in fullscreen (z-100) behind it. */}
      <AnimatePresence>
        {isFriendsManagerOpen && (
          <BottomSheet
            onClose={() => setIsFriendsManagerOpen(false)}
            overlayId="ffcs-friends-manager"
            maxWidth="max-w-xl"
            panelZIndex={200}
            backdropZIndex={195}
          >
            <h2 className="text-xl font-bold flex items-center gap-2 text-text-heading">
              <Users className="text-pink-500 w-6 h-6" /> Friends Manager
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex bg-surface-secondary/50 p-1 rounded-xl gap-1 shrink-0">
                <button 
                  onClick={() => setFriendsManagerTab("friends")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${friendsManagerTab === "friends" ? "bg-surface text-text-heading shadow-sm" : "text-muted-foreground hover:text-text-heading"}`}
                >
                  Friends
                </button>
                <button 
                  onClick={() => setFriendsManagerTab("groups")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${friendsManagerTab === "groups" ? "bg-surface text-text-heading shadow-sm" : "text-muted-foreground hover:text-text-heading"}`}
                >
                  Groups
                </button>
              </div>

              {friendsManagerTab === "friends" && (
                <>
                  <label className="flex items-center justify-center gap-2 w-full bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 font-bold py-3 rounded-xl border border-pink-500/20 transition-colors cursor-pointer relative overflow-hidden shrink-0">
                    <input type="file" accept=".json" onChange={importFriendTimetable} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="w-5 h-5" /> Import Friend's Timetable JSON
                  </label>
                  
                  <div className="mt-2 flex flex-col gap-3">
                    <h3 className="font-semibold text-sm text-text-heading">Your Friends ({friends.length})</h3>
                    {friends.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-lg border border-dashed border-border-strong">
                        No friends added yet. Ask your friend to click "Export Config" and send you the file!
                      </div>
                    ) : (
                      friends.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border-strong bg-surface-secondary/10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-bold">
                              {f.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-heading">{f.name}</p>
                              <p className="text-xs text-muted-foreground">Considering {f.timetables?.length || 0} timetables</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (f.timetables && f.timetables.length > 0) {
                                  setSelectedFriendTimetablesData({
                                    name: f.name,
                                    timetables: f.timetables,
                                    currentIndex: 0
                                  });
                                }
                              }}
                              title="View Timetable"
                              className="p-2 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setFriends(prev => prev.filter(fr => fr.id !== f.id));
                                setFriendGroups(prev => prev.map(g => ({ ...g, friendIds: g.friendIds.filter(fid => fid !== f.id) })));
                              }}
                              title="Remove Friend"
                              className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {friendsManagerTab === "groups" && (
                <>
                  <div className="bg-surface-secondary/10 border border-border-strong rounded-xl p-4 flex flex-col gap-3 shrink-0">
                    <h3 className="text-sm font-bold text-text-heading flex items-center gap-2">
                      <Plus className="w-4 h-4 text-pink-500" /> Create New Group
                    </h3>
                    <input 
                      type="text" 
                      placeholder="Group Name (e.g., Gaming Squad)" 
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-full bg-surface border border-border-strong rounded-lg px-3 py-2 text-base sm:text-sm text-text-heading focus:outline-none focus:border-pink-500/50"
                    />
                    <div className="max-h-32 overflow-y-auto custom-scrollbar border border-border-strong rounded-lg bg-surface p-2">
                      {friends.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 text-center">Add friends first</div>
                      ) : (
                        friends.map(f => (
                          <label key={f.id} className="flex items-center gap-2 p-1.5 hover:bg-surface-secondary/50 rounded-md cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={newGroupFriends.includes(f.id)}
                              onChange={(e) => {
                                if (e.target.checked) setNewGroupFriends(prev => [...prev, f.id]);
                                else setNewGroupFriends(prev => prev.filter(id => id !== f.id));
                              }}
                              className="rounded border-border-strong text-pink-500 focus:ring-pink-500/30"
                            />
                            <span className="text-sm text-text-heading">{f.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <button 
                      disabled={!newGroupName.trim() || newGroupFriends.length === 0}
                      onClick={() => {
                        const newGroup: FriendGroup = { id: Date.now().toString(), name: newGroupName.trim(), friendIds: newGroupFriends };
                        setFriendGroups(prev => [...prev, newGroup]);
                        setNewGroupName("");
                        setNewGroupFriends([]);
                      }}
                      className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors text-sm"
                    >
                      Create Group
                    </button>
                  </div>

                  <div className="mt-2 flex flex-col gap-3">
                    <h3 className="font-semibold text-sm text-text-heading">Your Groups ({friendGroups.length})</h3>
                    {friendGroups.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-lg border border-dashed border-border-strong">
                        No groups created yet.
                      </div>
                    ) : (
                      friendGroups.map(g => (
                        <div key={g.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border-strong bg-surface-secondary/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-pink-500" />
                              <p className="text-sm font-bold text-text-heading">{g.name}</p>
                            </div>
                            <button 
                              onClick={() => setFriendGroups(prev => prev.filter(gr => gr.id !== g.id))}
                              className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {g.friendIds.map(fid => {
                              const f = friends.find(fr => fr.id === fid);
                              if (!f) return null;
                              return <span key={fid} className="text-[10px] bg-surface border border-border-strong px-1.5 py-0.5 rounded-full text-muted-foreground">{f.name}</span>;
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingFriendTimetables && (
          <BottomSheet
            onClose={() => {
              setPendingFriendTimetables(null);
              setPendingFriendName("");
            }}
            overlayId="ffcs-name-friend"
            maxWidth="max-w-sm"
            panelZIndex={250}
            backdropZIndex={245}
            contentClassName="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-text-heading">Name Your Friend</h2>
            </div>
            <p className="text-sm text-muted-foreground">They're considering {pendingFriendTimetables.length} timetables. Give them a name so you can identify them in the generator.</p>
            <input 
              type="text" 
              value={pendingFriendName}
              onChange={(e) => setPendingFriendName(e.target.value)}
              placeholder="E.g., Rahul"
              className="w-full bg-surface-secondary/30 border border-border-strong rounded-xl px-4 py-3 text-base sm:text-sm text-text-heading focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveFriend();
              }}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button 
                onClick={() => {
                  setPendingFriendTimetables(null);
                  setPendingFriendName("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveFriend}
                className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-pink-500/20"
              >
                Save Friend
              </button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Friend Timetable View Modal */}
      <FriendTimetableViewModal
        data={selectedFriendTimetablesData}
        setData={setSelectedFriendTimetablesData}
        theoryPeriods={theoryPeriods}
        labPeriods={labPeriods}
        renderTypeChips={renderTypeChips}
      />
      {/* Social Matrix Modal */}
      {/* Social Matrix Modal */}
      <SocialMatrixModal
        isOpen={isSocialMatrixOpen}
        onClose={() => setIsSocialMatrixOpen(false)}
        timetables={timetables}
        friends={friends}
        friendGroups={friendGroups}
        socialScoreGroupMethod={socialScoreGroupMethod}
        generatorPreviewTimetable={generatorPreviewTimetable}
        stagedTimetables={stagedTimetables}
        activeTimetableId={activeTimetableId}
      />

      {/* Both stay mounted and are toggled, so their sheets can animate out */}
      <FFCSGuideModal isOpen={isGuideModalOpen} onClose={() => setIsGuideModalOpen(false)} />

      {/* Shortcuts Modal */}
      <FFCSShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />

      {/* Course Search Modal */}
      <AnimatePresence>
        {isCourseSearchOpen && (
          <BottomSheet
            onClose={() => setIsCourseSearchOpen(false)}
            overlayId="ffcs-course-search"
            maxWidth="max-w-lg"
            panelZIndex={400}
            backdropZIndex={395}
            contentClassName="flex flex-col gap-3"
          >
            <h3 className="font-bold text-lg text-text-heading flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" /> Search Course
            </h3>
            <SearchInput placeholder="Search by course code or title..." value={courseSearchQuery} onChange={e => setCourseSearchQuery(e.target.value)} className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-3 focus:border-blue-500/50 placeholder:text-muted-foreground" autoFocus />
            {courseLocks.length > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                <span className="flex items-center gap-1.5 text-text-heading font-medium">
                  <Lock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>{searchLockedOnly ? `Locked Courses Only (${courseLocks.length})` : "Any Courses (All)"}</span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {searchLockedOnly ? "Locked Only" : "All Courses"}
                  </span>
                  <Switch
                    checked={searchLockedOnly}
                    onCheckedChange={setSearchLockedOnly}
                    size="md"
                    label="Toggle locked courses only in search"
                  />
                </label>
              </div>
            )}
            {/*
              The results keep their own scroll box rather than inheriting the
              sheet's: this used to be `flex-1` inside an `max-h-[85vh]` column,
              and a capped list is what keeps the search field on screen while
              you arrow through results.
            */}
            <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
              {uniqueCourses.filter(c => 
                (!searchLockedOnly || courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
                c.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || 
                c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
                )
              ).slice(0, 100).map(c => {
                const fullyAdded = isCourseFullyAdded(c.code, c.types, activeTimetable.courses);
                return (
                <button
                  key={c.code}
                  disabled={fullyAdded}
                  onClick={() => {
                    if (fullyAdded) return;
                    setSelectedCourseCode(c.code);
                    setSelectedSlotIndex("-1");
                    setIsCourseSearchOpen(false);
                    setCourseSearchQuery("");
                  }}
                  className={`w-full text-left px-4 py-3 my-0.5 rounded-xl transition-colors flex flex-col gap-1 ${fullyAdded ? 'opacity-50 cursor-not-allowed bg-surface-secondary/30 border border-border-strong/50' : selectedCourseCode === c.code ? 'bg-blue-500/10 border border-blue-500/20 shadow-sm' : 'border border-transparent hover:bg-surface-secondary/80'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className={`font-bold text-sm ${fullyAdded ? 'text-muted-foreground' : 'text-text-heading'}`}>{c.code}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {renderTypeChips(c.types || [], 'sm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap sm:shrink-0">
                      {c.batches && c.batches.length > 0 && c.batches.map(b => (
                        <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                          {b}
                        </span>
                      ))}
                      {fullyAdded ? (
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">Fully Added</span>
                      ) : selectedCourseCode === c.code && (
                        <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">Selected</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">{c.title}</span>
                </button>
              )})}
              {uniqueCourses.filter(c => 
                (!searchLockedOnly || courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
                c.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || 
                c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
                )
              ).length === 0 && (
                <div className="py-6 text-center flex flex-col items-center">
                  <EmptyState
                    icon={<Search className="w-8 h-8" />}
                    title="No courses found"
                    description={
                      searchLockedOnly && courseLocks.length > 0
                        ? "No locked courses matched your search."
                        : "Try a different search term"
                    }
                    className="py-8 border border-dashed border-border-strong/50 rounded-xl m-2 w-full"
                  />
                  {searchLockedOnly && courseLocks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchLockedOnly(false)}
                      className="mt-2 text-xs font-semibold text-indigo-500 hover:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Show all catalogue courses instead
                    </button>
                  )}
                </div>
              )}
              {uniqueCourses.filter(c => 
                (!searchLockedOnly || courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
                c.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || 
                c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
                )
              ).length > 100 && (
                <div className="text-center py-4 text-xs text-muted-foreground font-medium flex items-center justify-center gap-2 border-t border-border-strong/30 mt-2">
                  <Info className="w-3 h-3" /> Showing first 100 results. Refine search.
                </div>
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Slot Search Modal */}
      <AnimatePresence>
        {isSlotSearchOpen && (
          <BottomSheet
            onClose={() => setIsSlotSearchOpen(false)}
            overlayId="ffcs-slot-search"
            maxWidth="max-w-lg"
            panelZIndex={400}
            backdropZIndex={395}
            contentClassName="flex flex-col gap-3"
          >
            <h3 className="font-bold text-lg text-text-heading flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" /> Search Slot & Faculty
            </h3>
            <p className="text-xs text-muted-foreground">
              Search every faculty offering. Conflicting options stay visible but cannot be selected.
            </p>
            <SearchInput placeholder="Search by slot, faculty, or room..." value={slotSearchQuery} onChange={e => setSlotSearchQuery(e.target.value)} className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-3 focus:border-blue-500/50 placeholder:text-muted-foreground" autoFocus />
            <ChipTabs
              size="sm"
              value={slotSearchTimeFilter}
              onChange={(value) => {
                setSlotSearchTimeFilter(value);
                setSelectedSlotIndex("-1");
              }}
              options={[
                { value: "all", label: "All" },
                { value: "morning_theory", label: "Morning Theory" },
                { value: "evening_theory", label: "Evening Theory" },
                { value: "morning_lab", label: "Morning Lab" },
                { value: "evening_lab", label: "Evening Lab" },
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Theory slot
                <select
                  aria-label="Filter by theory slot"
                  value={slotSearchTheoryFilter}
                  onChange={(event) => {
                    setSlotSearchTheoryFilter(event.target.value);
                    setSelectedSlotIndex("-1");
                  }}
                  className="mt-1 block w-full rounded-lg border border-border-strong bg-surface px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-text-heading"
                >
                  <option value="">All theory slots</option>
                  {slotSearchTheoryChoices.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Lab slot
                <select
                  aria-label="Filter by lab slot"
                  value={slotSearchLabFilter}
                  onChange={(event) => {
                    setSlotSearchLabFilter(event.target.value);
                    setSelectedSlotIndex("-1");
                  }}
                  className="mt-1 block w-full rounded-lg border border-border-strong bg-surface px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-text-heading"
                >
                  <option value="">All lab slots</option>
                  {slotSearchLabChoices.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </label>
              {(slotFilter !== "all" || slotSearchTimeFilter !== "all" || slotSearchTheoryFilter || slotSearchLabFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSlotFilter("all");
                    setSlotSearchTimeFilter("all");
                    setSlotSearchTheoryFilter("");
                    setSlotSearchLabFilter("");
                    setSelectedSlotIndex("-1");
                  }}
                  className="col-span-2 justify-self-start text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Show all slots and faculties
                </button>
              )}
            </div>
            {/* Capped, like the course search, so the field stays put while the
                result list scrolls. */}
            <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
              {filteredSlotSearchRows.map(({ row, idx }) => {
                const slotsArray = row?.SLOT?.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL") || [];
                const clashError = checkClashes(slotsArray);
                const isBlocked = !!clashError;
                const theorySlots = slotsArray.filter(s => !s.startsWith("L"));
                const labSlots = slotsArray.filter(s => s.startsWith("L"));
                let facultyCountDisplay = "1";
                let facultyCountTitle = "1 faculty teaching this slot";

                if (theorySlots.length > 0 && labSlots.length > 0) {
                  const facParts = (row?.FACULTY || "").split(/\s*\/\s*/);
                  const tAlts = sameSlotFacultyAlternatives(
                    selectedCourseCode,
                    theorySlots,
                    { faculty: facParts[0] || row?.FACULTY, employeeId: row?.ERP_ID },
                    courseAlternativesPool
                  );
                  const lAlts = sameSlotFacultyAlternatives(
                    selectedCourseCode,
                    labSlots,
                    { faculty: facParts[1] || facParts[0] || row?.FACULTY },
                    courseAlternativesPool
                  );
                  const tCount = 1 + tAlts.length;
                  const lCount = 1 + lAlts.length;
                  facultyCountDisplay = tCount === lCount ? `${tCount}` : `${tCount} / ${lCount}`;
                  facultyCountTitle = `${tCount} theory / ${lCount} lab faculties teaching this slot`;
                } else {
                  const facultyAlts = sameSlotFacultyAlternatives(
                    selectedCourseCode,
                    slotsArray,
                    { faculty: row?.FACULTY, employeeId: row?.ERP_ID },
                    courseAlternativesPool
                  );
                  const facultyCount = 1 + facultyAlts.length;
                  facultyCountDisplay = `${facultyCount}`;
                  facultyCountTitle =
                    facultyCount === 1
                      ? "1 faculty teaching this slot"
                      : `${facultyCount} faculties teaching this slot`;
                }
                
                return (
                  <button
                    key={idx}
                    disabled={isBlocked}
                    onClick={() => {
                      if (!isBlocked) {
                        setSelectedSlotIndex(idx.toString());
                        setIsSlotSearchOpen(false);
                        setSlotSearchQuery("");
                      }
                    }}
                    className={`w-full text-left px-4 py-3 my-0.5 rounded-xl transition-colors flex flex-col gap-1.5 
                      ${selectedSlotIndex === idx.toString() ? 'bg-blue-500/10 border border-blue-500/20 shadow-sm' : 'border border-transparent'} 
                      ${isBlocked ? 'opacity-50 cursor-not-allowed bg-red-500/5 border-red-500/10' : 'hover:bg-surface-secondary/80'}`}
                  >
                    <div className="flex flex-col w-full gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-text-heading text-sm">
                          {row?.SLOT}
                        </span>
                        {selectedSlotIndex === idx.toString() && <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">Selected</span>}
                      </div>
                      {isBlocked && (
                        <div className="w-full">
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase block w-full whitespace-normal break-words leading-tight">
                            Clash: {clashError}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex justify-between items-center w-full mt-1 border-t border-border-strong/30 pt-1.5">
                      <span className="flex items-center gap-1.5 min-w-0 pr-2">
                        <FacultyAvatar
                          employeeId={row?.ERP_ID}
                          name={row?.FACULTY}
                          size="xs"
                          tone="blue"
                        />
                        <span className="truncate">{row?.FACULTY}</span>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0"
                          title={facultyCountTitle}
                        >
                          <Users className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span>{facultyCountDisplay}</span>
                        </span>
                        <VitfacReviewPill
                          employeeId={row?.ERP_ID}
                          name={row?.FACULTY}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFacultyReviewTarget({
                              name: row?.FACULTY || "",
                              employeeId: row?.ERP_ID,
                              courseCode: selectedCourseCode || undefined,
                            });
                          }}
                        />
                      </span>
                      <span className="font-medium text-text-heading/70 shrink-0">{row?.ROOM}</span>
                    </span>
                  </button>
                );
              })}
              {filteredSlotSearchRows.length === 0 && (
                <EmptyState
                  icon={<Search className="w-8 h-8" />}
                  title="No slots found"
                  description="Try a different search term or filter"
                  className="py-12 border border-dashed border-border-strong/50 rounded-xl m-2"
                />
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
      {/* Timetable Selection Modal */}
      <AnimatePresence>
        {isTimetableModalOpen && (
          <BottomSheet
            onClose={() => setIsTimetableModalOpen(false)}
            overlayId="ffcs-timetable-select"
            maxWidth="max-w-lg"
            panelZIndex={400}
            backdropZIndex={395}
            contentClassName="flex flex-col gap-3"
          >
            <h3 className="font-bold text-lg text-text-heading flex items-center gap-2">
              Select Timetable
            </h3>
            <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
              {timetables.map(t => {
                const isActive = t.id === activeTimetableId;
                const isEditingThis = sheetEditingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`w-full px-4 py-3 my-0.5 rounded-xl transition-colors flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-blue-500/10 border border-blue-500/20 shadow-sm'
                        : 'border border-transparent hover:bg-surface-secondary/80'
                    }`}
                  >
                    {isEditingThis ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={sheetEditValue}
                          onChange={e => setSheetEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitSheetRename(t.id);
                            if (e.key === 'Escape') setSheetEditingId(null);
                          }}
                          className="flex-1 min-w-0 bg-surface border border-border-strong rounded-lg px-3 py-1.5 text-base sm:text-sm text-text-heading focus:outline-none focus:border-blue-500/50"
                          placeholder="New name..."
                          aria-label="Timetable name"
                        />
                        <button
                          type="button"
                          onClick={() => submitSheetRename(t.id)}
                          className="shrink-0 bg-green-500/20 text-green-400 p-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/30 relative hit-expand touch-press active:scale-[0.95]"
                          title="Save name"
                          aria-label="Save name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetEditingId(null)}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors relative hit-expand touch-press active:scale-[0.95]"
                          title="Cancel rename"
                          aria-label="Cancel rename"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTimetableId(t.id);
                            setIsTimetableModalOpen(false);
                          }}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                          <div className="min-w-0">
                            <span className={`font-bold text-sm block truncate ${isActive ? 'text-text-heading' : 'text-text-heading/80'}`}>
                              {t.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{t.courses.length} course{t.courses.length !== 1 ? 's' : ''}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">Active</span>
                          )}
                          <button
                            type="button"
                            onClick={() => { setSheetEditValue(t.name); setSheetEditingId(t.id); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
                            title={`Rename ${t.name}`}
                            aria-label={`Rename ${t.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTimetable(t.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title={`Delete ${t.name}`}
                            aria-label={`Delete ${t.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {timetables.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No timetables yet. Create one!
                </div>
              )}
            </div>
            <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-5 mt-1 px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border-strong bg-white/95 dark:bg-zinc-950/95 backdrop-blur flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">{timetables.length} timetable{timetables.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAllTimetables}
                  className="text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  title="Delete all saved timetables and keep one blank timetable"
                >
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
                <button
                  type="button"
                  onClick={() => { createNewTimetable(); setIsTimetableModalOpen(false); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
      {/* Variant Search Modal */}
      <AnimatePresence>
        {isVariantSearchOpen && generatorPreviewTimetable?.variants && (
          <BottomSheet
            onClose={() => setIsVariantSearchOpen(false)}
            overlayId="ffcs-variant-search"
            maxWidth="max-w-lg"
            panelZIndex={500}
            backdropZIndex={495}
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
                                  <span className="text-text-heading">{c.faculty}</span>
                                  <VitfacReviewPill
                                    employeeId={c.employeeId}
                                    name={c.faculty}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFacultyReviewTarget({
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
        )}
      </AnimatePresence>

      {/* Manual Linker Modal */}
      <AnimatePresence>
        {isManualLinkerOpen && (
          <BottomSheet
            onClose={() => setIsManualLinkerOpen(false)}
            overlayId="ffcs-manual-linker"
            maxWidth="max-w-2xl"
            panelZIndex={600}
            backdropZIndex={595}
          >
            <h3 className="font-bold text-lg text-text-heading flex items-center gap-2">
              Advanced Course Linker
            </h3>
            
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Use this tool to forcefully pair specific theory and lab slots together. 
                Paste a CSV with columns: <strong>CODE, TYPE, SLOT, ROOM, FACULTY, LINK_ID</strong>. 
                Rows with the same LINK_ID will be combined into a single embedded course.
              </p>
              
              <textarea
                value={manualLinkCsvText}
                onChange={(e) => {
                  setManualLinkCsvText(e.target.value);
                  try {
                    const lines = e.target.value.split('\n').filter(l => l.trim() !== '');
                    const newLinks: ManualLink[] = lines.map(line => {
                      const [code, type, slot, room, faculty, linkId] = line.split(',');
                      return {
                        CODE: (code || "").trim(),
                        TYPE: (type || "").trim(),
                        SLOT: (slot || "").trim(),
                        ROOM: (room || "").trim(),
                        FACULTY: (faculty || "").trim(),
                        LINK_ID: (linkId || "").trim(),
                      };
                    });
                    setManualLinks(newLinks);
                  } catch (err) {
                    console.error("Failed to parse manual links CSV", err);
                  }
                }}
                className="w-full h-64 bg-surface-secondary/30 border border-border-strong rounded-xl p-3 text-sm font-mono text-text-heading focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="CODE,TYPE,SLOT,ROOM,FACULTY,LINK_ID&#10;BAMEE201,ETH,D1+TD1,AB2-301,SREEKANTH DONDAPATI,SREEKANTH_LAB_A&#10;BAMEE201,ELA,L5+L6,AB1-006,SREEKANTH DONDAPATI,SREEKANTH_LAB_A"
              />
              
              {manualLinks.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2">Parsed Links Preview ({manualLinks.length})</h4>
                  <div className="bg-surface-secondary/30 border border-border-strong rounded-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-secondary/50 border-b border-border-strong sticky top-0">
                        <tr>
                          <th className="p-2 font-medium">CODE</th>
                          <th className="p-2 font-medium">TYPE</th>
                          <th className="p-2 font-medium">SLOT</th>
                          <th className="p-2 font-medium">FACULTY</th>
                          <th className="p-2 font-medium text-amber-500">LINK_ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {manualLinks.map((link, idx) => (
                          <tr key={idx} className="hover:bg-surface-secondary/50 transition-colors">
                            <td className="p-2">{link.CODE}</td>
                            <td className="p-2">{link.TYPE}</td>
                            <td className="p-2">{link.SLOT}</td>
                            <td className="p-2 truncate max-w-[120px]" title={link.FACULTY}>{link.FACULTY}</td>
                            <td className="p-2 font-mono text-amber-500/90">{link.LINK_ID}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-3 border-t border-border-strong flex justify-end gap-3">
              <button
                onClick={() => setIsManualLinkerOpen(false)}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* The tour layer sits at the end of the tree, after the anchors it
          spotlights. The spotlight reaches them by `data-tour-id` wherever
          they live; only the settings sheet needs the tour context (its
          "Replay" button). */}
      <SettingsModalHost
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        update={updateSetting}
        reset={resetSettings}
        isGroupingEnabled={isGroupingEnabled}
        setIsGroupingEnabled={setIsGroupingEnabled}
        socialScoreGroupMethod={socialScoreGroupMethod}
        setSocialScoreGroupMethod={setSocialScoreGroupMethod}
        onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
      />
      <PdfGenerationBadge
        isGenerating={isGeneratingPdf}
        successMessage={pdfBadgeMsg && !pdfBadgeMsg.startsWith("Failed") ? pdfBadgeMsg : undefined}
        errorMessage={pdfBadgeMsg && pdfBadgeMsg.startsWith("Failed") ? pdfBadgeMsg : undefined}
        timetableName={activeTimetable.name}
        theme={pdfGenerationTheme}
        onDismiss={() => setPdfBadgeMsg(null)}
      />

      {isShareSheetOpen && (
        <BottomSheet
          onClose={() => setIsShareSheetOpen(false)}
          overlayId="ffcs-share-options"
          title="Share AmazeCC FFCS"
          subtitle="Share your timetable or tell a friend about the planner."
          icon={<Share2 className="w-5 h-5" />}
          accent="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400"
          maxWidth="max-w-lg"
        >
          <div className="space-y-3">
            <ListShell>
              <button
                type="button"
                disabled={courses.length === 0}
                onClick={() => {
                  setIsShareSheetOpen(false);
                  setIsShareLinkOptionsOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400">
                  <ExternalLink className="w-4 h-4" />
                </span>
                <ListRowText title="Share as link" titleTag="span" subtitle="Choose a full link or a shorter class-ID link." />
              </button>
              <button
                type="button"
                disabled={courses.length === 0}
                onClick={() => {
                  setIsShareSheetOpen(false);
                  void handleSharePlanJson();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400">
                  <Code2 className="w-4 h-4" />
                </span>
                <ListRowText title="Share as JSON" titleTag="span" subtitle="Share the selected timetable data." />
              </button>
              <button
                type="button"
                disabled={courses.length === 0 || isDownloading}
                onClick={() => {
                  setIsShareSheetOpen(false);
                  void downloadImage("jpg");
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
                  <Image className="w-4 h-4" />
                </span>
                <ListRowText title="Share as JPG" titleTag="span" subtitle="Download a timetable image to send." />
              </button>
              <button
                type="button"
                disabled={courses.length === 0 || isDownloading}
                onClick={() => {
                  setIsShareSheetOpen(false);
                  void downloadImage("png");
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                  <Image className="w-4 h-4" />
                </span>
                <ListRowText title="Share as PNG" titleTag="span" subtitle="Download a high-quality transparent image." />
              </button>
              <button
                type="button"
                disabled={courses.length === 0 || isDownloading}
                onClick={() => {
                  setIsShareSheetOpen(false);
                  void downloadDossierHtml();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400">
                  <FileText className="w-4 h-4" />
                </span>
                <ListRowText title="Share as HTML" titleTag="span" subtitle="Download a standalone timetable dossier." />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsShareSheetOpen(false);
                  void handleShareAmazeCC();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60"
              >
                <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400">
                  <Megaphone className="w-4 h-4" />
                </span>
                <ListRowText title="Share AmazeCC FFCS" titleTag="span" subtitle="Share the FFCS planner link with your friends." />
              </button>
            </ListShell>

            {layoutMode === "modern" && (
              <Link
                href="/"
                onClick={() => setIsShareSheetOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 p-4 transition-colors hover:from-indigo-500/15 hover:to-fuchsia-500/15"
              >
                <span className="w-10 h-10 rounded-2xl border border-indigo-500/20 bg-surface flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <LogIn className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text-heading">Sign in to AmazeCC</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Save your plans and unlock more features.</span>
                </span>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            )}
          </div>
        </BottomSheet>
      )}

      {isShareLinkOptionsOpen && (
        <BottomSheet
          onClose={() => setIsShareLinkOptionsOpen(false)}
          overlayId="ffcs-share-link-format"
          title="Share timetable link"
          subtitle="Choose how much timetable data to include in the link."
          icon={<ExternalLink className="w-5 h-5" />}
          accent="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400"
          maxWidth="max-w-lg"
        >
          <ListShell>
            <button
              type="button"
              disabled={activeTimetable.courses.length === 0}
              onClick={() => {
                setIsShareLinkOptionsOpen(false);
                void handleSharePlan(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50"
            >
              <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400">
                <Code2 className="w-4 h-4" />
              </span>
              <ListRowText
                title="Full timetable link"
                titleTag="span"
                subtitle="Includes course names, slots, and faculty details in the link."
              />
            </button>
            <button
              type="button"
              disabled={!canShareCompactLink}
              onClick={() => {
                setIsShareLinkOptionsOpen(false);
                void handleSharePlan(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                <Share2 className="w-4 h-4" />
              </span>
              <ListRowText
                title="Shorter class-ID link"
                titleTag="span"
                subtitle={
                  canShareCompactLink
                    ? `Creates a shorter URL using the ${activeSemester.shortLabel} class IDs; the receiver looks up course details in that report.`
                    : "Creates a shorter URL when every course matches a class ID in the selected semester's registration list."
                }
              />
            </button>
            <button
              type="button"
              disabled={!canShareShapeLink}
              onClick={() => {
                setIsShareLinkOptionsOpen(false);
                void handleSharePlan(false, true);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-secondary/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400">
                <Share2 className="w-4 h-4" />
              </span>
              <ListRowText
                title="Share TT shape"
                titleTag="span"
                subtitle={
                  canShareShapeLink
                    ? "Shortest URL: shares only class IDs; the semester is inferred from their prefix."
                    : "Available when every course has a unique class ID from a known semester report."
                }
              />
            </button>
          </ListShell>
        </BottomSheet>
      )}

      {/* Layout Mode Selection Modal */}
      <AnimatePresence>
        {isCourseListModalOpen && (
          <BottomSheet
            onClose={() => setIsCourseListModalOpen(false)}
            overlayId="ffcs-course-list-picker"
            title="Switch Course List"
            subtitle={`Currently using ${activeSemester.label}`}
            icon={<ListFilter className="w-5 h-5" />}
            accent="bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400"
            maxWidth="max-w-lg"
          >
            <ListShell>
              {FFCS_SEMESTER_REPORTS.map((report) => {
                const isActive = semesterId === report.id;
                return (
                  <button
                    key={report.id}
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => {
                      setIsCourseListModalOpen(false);
                      void handleSemesterChange(report.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                      isActive ? "bg-teal-500/10" : "hover:bg-surface-secondary/60"
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                        : "bg-surface-secondary text-muted-foreground border-border-strong"
                    }`}>
                      <ListFilter className="w-4 h-4" />
                    </span>
                    <ListRowText title={report.label} titleTag="span" subtitle={`Load the ${report.shortLabel} course report.`} />
                    {isActive && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
                  </button>
                );
              })}
            </ListShell>
          </BottomSheet>
        )}
      </AnimatePresence>
      <FFCSLayoutModeModal
        isOpen={isLayoutModalOpen}
        onClose={handleCloseLayoutModal}
        currentMode={layoutMode}
        onSelectMode={handleSelectLayoutMode}
      />
    </div>
    </TourProvider>
  );
}

/**
 * The settings sheet, bridged to the tour context. Only descendants of the
 * provider can call `useTour`, and the sheet needs it for exactly one thing:
 * "Replay", which restarts a tour the auto-offer has already forgotten about.
 */
type SettingsModalHostProps = Omit<FFCSSettingsModalProps, "onReplayTour">;

function SettingsModalHost(props: SettingsModalHostProps) {
  const tour = useTour();
  return <FFCSSettingsModal {...props} onReplayTour={tour.start} />;
}

function FFCSShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const shortcuts = [
    { keys: ["S", "/"], desc: "Open Course Search Palette" },
    { keys: ["T"], desc: "Open Target Courses Modal" },
    { keys: ["G"], desc: "Open Auto-Generator Modal" },
    { keys: ["F"], desc: "Open Friends Manager" },
    { keys: ["N"], desc: "Create a New Timetable" },
    { keys: ["P"], desc: "Open Printable View / Print" },
    { keys: ["1", "-", "9"], desc: "Switch to Timetable 1 to 9" },
    { keys: ["Backspace", "Delete"], desc: "Clear Current Timetable" },
    { keys: ["Esc"], desc: "Close Active Modals" },
  ];

  /*
    A sheet like every other FFCS popup, and mounted unconditionally by the tab
    so the exit animation can run. The z pair matches what the modal used, both
    for parity with the surrounding FFCS surfaces and because the tab can be in
    fullscreen (z-100) behind it.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-shortcuts"
          maxWidth="max-w-md"
          panelZIndex={400}
          backdropZIndex={395}
          contentClassName="flex flex-col gap-3"
        >
          <h3 className="font-bold text-base text-text-heading flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" /> Keyboard Shortcuts
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Boost your timetable drafting speed with these global hotkeys:
          </p>
          <div className="divide-y divide-border/40">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 text-xs">
                <span className="text-muted-foreground">{shortcut.desc}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((k, kidx) => (
                    <kbd key={kidx} className="px-2 py-1 bg-surface-secondary border border-border-strong rounded-md font-mono text-[10px] font-bold text-text-heading shadow-xs">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-border-strong text-right">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Got it, thanks!
            </button>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
