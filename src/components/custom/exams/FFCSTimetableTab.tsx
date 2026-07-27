"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PlusCircle, Trash2, AlertTriangle, Info, UploadCloud, Map as MapIcon, Download, Plus, Edit2, Check, Maximize2, Minimize2, Copy, Save, Upload, Wand2, X, Settings2, Users, ArrowLeft, ArrowRight, Eye, HelpCircle, Share2, FileText, Search, Lock, ChevronDown, Keyboard } from "lucide-react";
import * as XLSX from "xlsx";
import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import { useTheme } from "next-themes";
import FFCSGuideModal from "./FFCSGuideModal";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";

import chennaiSchema from "@/data/campus/chennai.json";
import apSchema from "@/data/campus/ap.json";
import bhopalSchema from "@/data/campus/bhopal.json";

const CAMPUS_SCHEMAS: Record<string, any> = {
  chennai: chennaiSchema,
  ap: apSchema,
  bhopal: bhopalSchema
};

import { AutoGeneratorModal } from './FFCS/components/modals/AutoGeneratorModal';
import { FriendTimetableViewModal, SelectedFriendTimetableData } from './FFCS/components/modals/FriendTimetableViewModal';
import { SocialMatrixModal } from './FFCS/components/modals/SocialMatrixModal';
import { TargetCoursesModal } from './FFCS/components/modals/TargetCoursesModal';

export let GLOBAL_CAMPUS = "chennai";
export const getTimetableSchema = () => CAMPUS_SCHEMAS[GLOBAL_CAMPUS];

import { GenCourseSelection, SlotMap, TimetablePeriod, ParsedCourse, AddedCourse, TimetableState, Friend, FriendGroup, CourseLock, ManualLink } from "./FFCS/types";
import { DAYS, COLORS, typeLabels, typeColors, defaultColor } from "./FFCS/constants";
import { isCourseFullyAdded } from "./FFCS/utils";
import { exportTimetableIcal } from "@/lib/exportIcal";
import { getBatchColorClass } from "@/lib/utils";





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

// Helper to convert time strings (e.g., "8:00 AM", "12:35 PM") to minutes from midnight
const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const parse24HourToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

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

const getFreeHalfDaysList = (slots: Set<string>): string[] => {
  const freeHalfDays: string[] = [];
  const theoryPeriods = (getTimetableSchema().theory as TimetablePeriod[]).filter(p => !p.lunch);
  const labPeriods = (getTimetableSchema().lab as TimetablePeriod[]).filter(p => !p.lunch);

  DAYS.forEach(day => {
    let morningOccupied = false;
    let eveningOccupied = false;

    theoryPeriods.forEach((p, pIdx) => {
      const tSlot = p.days?.[day.id];
      const lSlot = labPeriods[pIdx]?.days?.[day.id];
      const isMorning = timeToMinutes(p.start as string) < timeToMinutes("2:00 PM");

      let slotOccupied = false;
      if (tSlot && slots.has(tSlot)) slotOccupied = true;
      if (lSlot && slots.has(lSlot)) slotOccupied = true;

      if (slotOccupied) {
        if (isMorning) morningOccupied = true;
        else eveningOccupied = true;
      }
    });

    if (!morningOccupied) freeHalfDays.push(`${day.id}_morning`);
    if (!eveningOccupied) freeHalfDays.push(`${day.id}_evening`);
  });

  return freeHalfDays;
};

export const calculatePairwiseSocialScore = (myCourses: AddedCourse[], friendCourses: AddedCourse[]): { percentage: number, actualScore: number, maxScore: number } => {
  const mySlots = new Set(myCourses.flatMap(c => c.slots));
  const fSlots = new Set(friendCourses.flatMap(c => c.slots));

  // 1. Mutually Free Slots
  const unionSize = new Set([...mySlots, ...fSlots]).size;
  const mutuallyFreeSlots = 60 - unionSize;
  const maxMutuallyFreeSlots = 60 - fSlots.size;

  // 2. Shared Classes
  let sharedClasses = 0;
  const myCourseMap = new Map<string, string>();
  myCourses.forEach(c => c.slots.forEach(s => myCourseMap.set(s, c.code)));
  
  const fCourseMap = new Map<string, string>();
  friendCourses.forEach(c => c.slots.forEach(s => fCourseMap.set(s, c.code)));

  myCourseMap.forEach((code, slot) => {
    if (fCourseMap.get(slot) === code) {
      sharedClasses++;
    }
  });
  
  const maxSharedClasses = fSlots.size; // friend's total class slots

  // 3. Shared Free Half-Days
  const myFreeHalfDays = getFreeHalfDaysList(mySlots);
  const fFreeHalfDays = getFreeHalfDaysList(fSlots);
  
  let sharedHalfDays = 0;
  const fFreeSet = new Set(fFreeHalfDays);
  myFreeHalfDays.forEach(hd => {
    if (fFreeSet.has(hd)) sharedHalfDays++;
  });

  const maxSharedHalfDays = fFreeHalfDays.length;

  const actualScore = (sharedClasses * 3) + (mutuallyFreeSlots * 1) + (sharedHalfDays * 5);
  const maxScore = (maxSharedClasses * 3) + (maxMutuallyFreeSlots * 1) + (maxSharedHalfDays * 5);

  const percentage = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;

  return { percentage, actualScore, maxScore };
};

const getPeriodsForSlotOuter = (slotName: string) => {
  const matchedPeriods: { day: string, startMin: number, endMin: number }[] = [];
  const schema = getTimetableSchema();
  
  if (schema.theory) {
    (schema.theory as any[]).forEach((p) => {
      if (!p.days || !p.start || !p.end || p.lunch) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slotName)) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string) });
        }
      });
    });
  }

  if (schema.lab) {
    (schema.lab as any[]).forEach((p) => {
      if (!p.days || !p.start || !p.end || p.lunch) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slotName)) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string) });
        }
      });
    });
  }
  
  return matchedPeriods;
};

const isMorningSlot = (slot: string) => {
  const periods = getPeriodsForSlotOuter(slot);
  if (periods.length === 0) return true; // e.g., NIL
  return periods.some(p => p.startMin < 840); // Before 2:00 PM
};

const isEveningSlot = (slot: string) => {
  const periods = getPeriodsForSlotOuter(slot);
  if (periods.length === 0) return true;
  return periods.some(p => p.startMin >= 840); // 2:00 PM or later
};

const isOverlap = (theorySlotStr: string, labSlotStr: string) => {
  const tSlots = theorySlotStr.split('+').map(s => s.trim().toUpperCase());
  const lSlots = labSlotStr.split('+').map(s => s.trim().toUpperCase());
  
  const tPeriods = tSlots.flatMap(getPeriodsForSlotOuter);
  const lPeriods = lSlots.flatMap(getPeriodsForSlotOuter);

  for (const t of tPeriods) {
    for (const l of lPeriods) {
      if (t.day === l.day && Math.max(t.startMin, l.startMin) < Math.min(t.endMin, l.endMin)) {
        return true;
      }
    }
  }
  return false;
};

const processParsedCourses = (parsed: ParsedCourse[], manualLinks: ManualLink[] = []): ParsedCourse[] => {
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
    const hasEmbedded = isMergedLPBase || coursesList.some(c => {
      const t = c.TYPE.trim().toUpperCase();
      return t === "ETH" || t === "ELA" || t === "EPJ" || t.includes("EMBEDDED");
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
              const combinedType = `${tType}+${lType}`;

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
                ROOM: `${t.ROOM} / ${l.ROOM}`,
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
        if (!byFac.has(c.FACULTY)) byFac.set(c.FACULTY, []);
        byFac.get(c.FACULTY)!.push(c);
      });

      byFac.forEach((facCourses) => {
        const theorySlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ETH" || t === "TH" || origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL');
        });
        const labSlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ELA" || t === "LO" || origCode.endsWith('P') || c.SLOT.startsWith('L');
        });

        if (theorySlots.length > 0 && labSlots.length > 0) {
          let bestMatch: { tIdx: number, lIdx: number }[] = [];

          const backtrack = (tIdx: number, currentMatch: { tIdx: number, lIdx: number }[], usedLabs: Set<number>) => {
            if (currentMatch.length > bestMatch.length) {
              bestMatch = [...currentMatch];
            }
            if (tIdx >= theorySlots.length) return;

            const t = theorySlots[tIdx];

            for (let j = 0; j < labSlots.length; j++) {
              if (usedLabs.has(j)) continue;
              const l = labSlots[j];

              if (!isOverlap(t.SLOT, l.SLOT)) {
                usedLabs.add(j);
                currentMatch.push({ tIdx, lIdx: j });
                backtrack(tIdx + 1, currentMatch, usedLabs);
                currentMatch.pop();
                usedLabs.delete(j);
              }
            }
            
            backtrack(tIdx + 1, currentMatch, usedLabs);
          };

          backtrack(0, [], new Set<number>());

          if (bestMatch.length > 0) {
            const matchedT = new Set(bestMatch.map(m => m.tIdx));
            const matchedL = new Set(bestMatch.map(m => m.lIdx));
            
            bestMatch.forEach(m => {
              const t = theorySlots[m.tIdx];
              const l = labSlots[m.lIdx];
              
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = `${tType}+${lType}`;

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
                ROOM: `${t.ROOM} / ${l.ROOM}`,
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

export default function FFCSTimetableTab() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";
  const rootStyles = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
  const themeTextColor = rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
  const themeHtmlClass = typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

  const [masterCourses, setMasterCourses] = useState<ParsedCourse[]>([]);
  const [rawParsedCourses, setRawParsedCourses] = useState<ParsedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  
  // Timetables State
  const [timetables, setTimetables] = useState<TimetableState[]>([
    { id: "default", name: "Timetable 1", courses: [] }
  ]);
  const [activeTimetableId, setActiveTimetableId] = useState<string>("default");
  const [courseLocks, setCourseLocks] = useState<import('./FFCS/types').CourseLock[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);

  const [generatorPreviewTimetable, setGeneratorPreviewTimetable] = useState<TimetableState | null>(null);

  const activeTimetable = timetables.find(t => t.id === activeTimetableId) || timetables[0];
  const courses = generatorPreviewTimetable ? generatorPreviewTimetable.courses : activeTimetable.courses;
  
  // Selection states
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("-1");
  const [slotFilter, setSlotFilter] = useState("all");
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generator State
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isCourseLockOpen, setIsCourseLockOpen] = useState(false);

  const [generatorPreference, setGeneratorPreference] = useState<'none' | 'morning' | 'evening'>('none');
  const [generatorUniqueFaculties, setGeneratorUniqueFaculties] = useState(false);
  const [generatorNoLimit, setGeneratorNoLimit] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stagedTimetables, setStagedTimetables] = useState<TimetableState[]>([]);
  const [generatorMinHalfDays, setGeneratorMinHalfDays] = useState<number>(0);
  const [generatorMinStartTime, setGeneratorMinStartTime] = useState<string>("08:00");
  const [generatorMaxEndTime, setGeneratorMaxEndTime] = useState<string>("19:30");
  const [generatorSortBy, setGeneratorSortBy] = useState<"social" | "halfdays" | "compactness" | "balanced">("balanced");
  const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());

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
  const [selectedTimetablesToCompare, setSelectedTimetablesToCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedDashDetails, setSelectedDashDetails] = useState<NonNullable<TimetableState['metrics']>['dashDetails'] | null>(null);
  const [selectedGapDetails, setSelectedGapDetails] = useState<NonNullable<TimetableState['metrics']>['gapDetails'] | null>(null);
  const [isSocialMatrixOpen, setIsSocialMatrixOpen] = useState(false);
  const [selectedFriendTimetablesData, setSelectedFriendTimetablesData] = useState<SelectedFriendTimetableData | null>(null);
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState(false);
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>([]);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [isSlotSearchOpen, setIsSlotSearchOpen] = useState(false);
  const [slotSearchQuery, setSlotSearchQuery] = useState("");
  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");
  const [isVariantSearchOpen, setIsVariantSearchOpen] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [manualLinks, setManualLinks] = useState<ManualLink[]>([]);
  const [isManualLinkerOpen, setIsManualLinkerOpen] = useState(false);
  const [manualLinkCsvText, setManualLinkCsvText] = useState("");

  const captureRef = useRef<HTMLDivElement>(null);
  const pdfCaptureRef = useRef<HTMLDivElement>(null);

  // Load from local storage on mount and fetch course list
  useEffect(() => {
    const loadHardcodedCSV = async () => {
      setIsLoadingCourses(true);
      setError(null);
      try {
        const response = await fetch("/ffcs/ffcsReport.csv");
        if (!response.ok) throw new Error("Failed to fetch /ffcs/ffcsReport.csv");
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
        
        if (jsonData.length === 0) {
          setError("The course report file is empty.");
          return;
        }

        const parsed: ParsedCourse[] = jsonData.map((row: any) => {
          const cleanRow: any = {};
          for (const k in row) {
            const cleanKey = k.replace(/^\uFEFF/, '').trim().toUpperCase();
            cleanRow[cleanKey] = row[k];
          }
          return {
            CODE: String(cleanRow.CODE || cleanRow["COURSE CODE"] || cleanRow.COURSE_CODE || "").trim(),
            TITLE: String(cleanRow.TITLE || cleanRow["COURSE TITLE"] || cleanRow.COURSE_TITLE || "").trim(),
            TYPE: String(cleanRow.TYPE || "").trim(),
            CREDITS: String(cleanRow.CREDITS || "0").trim(),
            ROOM: String(cleanRow.VENUE || cleanRow.ROOM || "").trim(),
            SLOT: String(cleanRow.SLOT || "").trim(),
            FACULTY: String(cleanRow.FACULTY || "").trim(),
            BATCH: String(cleanRow.BATCH || "").trim()
          };
        }).filter(c => c.CODE);

        setRawParsedCourses(parsed);
      } catch (err) {
        console.error(err);
        setError("Error loading course report. Please ensure public/ffcs/ffcsReport.csv exists and is valid.");
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadHardcodedCSV();

    const savedTimetables = localStorage.getItem("ffcs_timetables");
    if (savedTimetables) {
      const parsed = JSON.parse(savedTimetables);
      if (parsed && parsed.length > 0) {
        setTimetables(parsed);
        setActiveTimetableId(parsed[0].id);
      }
    }
    const savedFriends = localStorage.getItem("ffcs_friends");
    if (savedFriends) setFriends(JSON.parse(savedFriends));
    const savedFriendGroups = localStorage.getItem("ffcs_friendGroups");
    if (savedFriendGroups) setFriendGroups(JSON.parse(savedFriendGroups));
    const savedMethod = localStorage.getItem("ffcs_socialScoreGroupMethod");
    if (savedMethod) setSocialScoreGroupMethod(savedMethod as "intersection" | "cumulative");
    const savedCourseLocks = localStorage.getItem("ffcs_courseLocks");
    if (savedCourseLocks) setCourseLocks(JSON.parse(savedCourseLocks));
    const savedManualLinks = localStorage.getItem("ffcs_manual_links");
    if (savedManualLinks) {
      try {
        const parsed = JSON.parse(savedManualLinks);
        setManualLinks(parsed);
        setManualLinkCsvText(parsed.map((l: ManualLink) => `${l.CODE},${l.TYPE},${l.SLOT},${l.ROOM},${l.FACULTY},${l.LINK_ID}`).join('\n'));
      } catch(e) {}
    }

    setIsLoaded(true);
  }, []);

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

  // Save to local storage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_raw_courses", JSON.stringify(rawParsedCourses));
    }
  }, [rawParsedCourses, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_timetables", JSON.stringify(timetables));
    }
  }, [timetables, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_friends", JSON.stringify(friends));
      localStorage.setItem("ffcs_friendGroups", JSON.stringify(friendGroups));
      localStorage.setItem("ffcs_socialScoreGroupMethod", socialScoreGroupMethod);
    }
  }, [friends, friendGroups, socialScoreGroupMethod, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_courseLocks", JSON.stringify(courseLocks));
    }
  }, [courseLocks, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_manual_links", JSON.stringify(manualLinks));
    }
  }, [manualLinks, isLoaded]);

  useEffect(() => {
    setSlotFilter("all");
    setSelectedSlotIndex("-1");
  }, [selectedCourseCode, isGroupingEnabled]);

  const updateActiveTimetableCourses = (newCourses: AddedCourse[]) => {
    setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, courses: newCourses } : t));
  };

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

  const getPeriodsForSlot = (slotName: string) => {
    const matchedPeriods: { day: string, startMin: number, endMin: number, type: 'theory' | 'lab', pIdx: number }[] = [];
    
    theoryPeriods.forEach((p, pIdx) => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slotName)) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string), type: 'theory', pIdx });
        }
      });
    });

    labPeriods.forEach((p, pIdx) => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slotName)) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string), type: 'lab', pIdx });
        }
      });
    });
    
    return matchedPeriods;
  };

  const checkClashes = (newSlots: string[]) => {
    for (const slot of newSlots) {
      if (blockedSlots.has(slot)) {
        return `Slot ${slot} is blocked.`;
      }
    }

    const newPeriods = newSlots.flatMap(getPeriodsForSlot);

    for (const existingCourse of courses) {
      const existingPeriods = existingCourse.slots.flatMap(getPeriodsForSlot);
      
      for (const np of newPeriods) {
        for (const ep of existingPeriods) {
          if (np.day === ep.day) {
            if (Math.max(np.startMin, ep.startMin) < Math.min(np.endMin, ep.endMin)) {
              return `Time clash on ${np.day.toUpperCase()} between new slot and ${existingCourse.code} (${existingCourse.slots.join("+")})`;
            }
          }
        }
      }
    }
    return null;
  };

  const getCourseForSlot = (slotName: string) => {
    return courses.find(c => c.slots.includes(slotName));
  };

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

  const generateTimetables = async () => {
    setIsGenerating(true);
    setStagedTimetables([]);
    setSelectedStagedIds(new Set());
    setSelectedTimetablesToCompare([]);
    // Yield to let UI update
    await new Promise(r => setTimeout(r, 50));
    
    try {
      const coursesByCode = new Map<string, ParsedCourse[]>();
      masterCourses.forEach(c => {
        if (!coursesByCode.has(c.CODE)) coursesByCode.set(c.CODE, []);
        coursesByCode.get(c.CODE)!.push(c);
      });

      const targetCodes = courseLocks.map(c => c.code);
      
      if (targetCodes.length === 0) {
        setError("Please select at least one course.");
        setIsGenerating(false);
        return;
      }

      const optionsPerCourse: ParsedCourse[][] = [];
      for (const sel of courseLocks) {
        let options = coursesByCode.get(sel.code) || [];
        
        // Handle slot constraints
        if (sel.allowedSlots && sel.allowedSlots.length > 0) {
          options = options.filter(opt => {
            const individualSlots = opt.SLOT.split('+').map(sl => sl.trim());
            return individualSlots.some(sl => sel.allowedSlots.includes(sl));
          });
        }
        
        // Handle faculty constraints
        if (sel.allowedFaculty && sel.allowedFaculty.length > 0) {
          options = options.filter(opt => sel.allowedFaculty.includes(opt.FACULTY));
        }
        
        // Handle offering constraints (from auto-generator UI)
        if (sel.offerings && sel.offerings.length > 0) {
          options = options.filter(opt => sel.offerings!.includes(`${opt.FACULTY}|${opt.SLOT}|${opt.ROOM}`));
        }

        // Ensure embedded courses are properly combined
        options = options.filter(opt => {
          const t = opt.TYPE.trim().toUpperCase();
          const isEmbedded = t === "ETH" || t === "ELA" || t === "EPJ" || t.includes("EMBEDDED") || t.includes("+");
          if (isEmbedded) {
            const parsedSlots = opt.SLOT.split('+').map(s => s.trim());
            const hasTheory = parsedSlots.some(s => !s.startsWith('L') && s !== 'NIL');
            const hasLab = parsedSlots.some(s => s.startsWith('L'));
            return hasTheory && hasLab;
          }
          return true;
        });
        if (generatorPreference === 'morning') {
          options = options.filter(opt => {
            const theorySlots = opt.SLOT.split('+').map(s => s.trim()).filter(s => !s.startsWith('L') && s !== 'NIL');
            if (theorySlots.length > 0) return isMorningSlot(theorySlots[0]);
            return opt.SLOT.split('+').map(s => s.trim()).filter(s => s !== 'NIL').some(s => isEveningSlot(s));
          });
        } else if (generatorPreference === 'evening') {
          options = options.filter(opt => {
            const theorySlots = opt.SLOT.split('+').map(s => s.trim()).filter(s => !s.startsWith('L') && s !== 'NIL');
            if (theorySlots.length > 0) return isEveningSlot(theorySlots[0]);
            return opt.SLOT.split('+').map(s => s.trim()).filter(s => s !== 'NIL').some(s => isMorningSlot(s));
          });
        }

        options = options.filter(opt => {
          const slots = opt.SLOT.split('+').map(s => s.trim());
          return !slots.some(s => blockedSlots.has(s));
        });

        // Time Bounds Filtering
        if (generatorMinStartTime || generatorMaxEndTime) {
          const minAllowedMins = generatorMinStartTime ? parse24HourToMinutes(generatorMinStartTime) : 0;
          const maxAllowedMins = generatorMaxEndTime ? parse24HourToMinutes(generatorMaxEndTime) : 24 * 60;
          
          options = options.filter(opt => {
            const slots = opt.SLOT.split('+').map(s => s.trim().toUpperCase());
            return slots.every(slot => {
              const theoryPeriods = (getTimetableSchema().theory as TimetablePeriod[]).filter(p => !p.lunch);
              const labPeriods = (getTimetableSchema().lab as TimetablePeriod[]).filter(p => !p.lunch);
              
              const tPeriod = theoryPeriods.find(p => Object.values(p.days || {}).includes(slot));
              const lPeriod = labPeriods.find(p => Object.values(p.days || {}).includes(slot));
              const p = tPeriod || lPeriod;
              
              if (!p || !p.start || !p.end) return true; // ignore slots without specific times
              
              const startMins = timeToMinutes(p.start);
              const endMins = timeToMinutes(p.end);
              return startMins >= minAllowedMins && endMins <= maxAllowedMins;
            });
          });
        }

        // Sync with friends
        if (generatorSyncFriendsClasses) {
          const validFriendCourses = friends.flatMap(f => (f.timetables || []).flatMap(t => t.courses)).filter(c => c.code === sel.code);
          if (validFriendCourses.length > 0) {
            options = options.filter(opt => {
              const optSlots = opt.SLOT.split('+').map(s => s.trim().toUpperCase()).sort().join(',');
              return validFriendCourses.some(fc => {
                const fSlots = [...fc.slots].sort().join(',');
                return opt.FACULTY === fc.faculty && optSlots === fSlots;
              });
            });
          }
        }

        if (options.length === 0) {
          setError(`No valid slots found for ${sel.code} with current preferences and blocked slots.`);
          setIsGenerating(false);
          return;
        }
        optionsPerCourse.push(options);
      }

      const results: ParsedCourse[][] = [];
      const MAX_RESULTS = generatorNoLimit ? 999999 : 50;

      const usedFacultiesPerCourse = new Map<string, Set<string>>();
      targetCodes.forEach(code => usedFacultiesPerCourse.set(code, new Set()));

      type ParsedCourseWithPeriods = ParsedCourse & { periods: {day: string, startMin: number, endMin: number}[] };
      const optionsPerCourseWithPeriods: ParsedCourseWithPeriods[][] = optionsPerCourse.map(options => 
        options.map(opt => {
          const slots = opt.SLOT.split('+').map(s => s.trim().toUpperCase());
          return { ...opt, periods: slots.flatMap(getPeriodsForSlot) };
        })
      );

      const backtrack = (courseIndex: number, currentCombo: ParsedCourse[], currentPeriods: {day: string, startMin: number, endMin: number}[]) => {
        if (results.length >= MAX_RESULTS) return;
        if (courseIndex === targetCodes.length) {
          results.push([...currentCombo]);
          return;
        }

        const options = optionsPerCourseWithPeriods[courseIndex];
        for (const opt of options) {

          let hasConflict = false;
          for (const np of opt.periods) {
            for (const ep of currentPeriods) {
              if (np.day === ep.day && Math.max(np.startMin, ep.startMin) < Math.min(np.endMin, ep.endMin)) {
                hasConflict = true;
                break;
              }
            }
            if (hasConflict) break;
          }

          if (!hasConflict) {
            currentCombo.push(opt);
            backtrack(courseIndex + 1, currentCombo, currentPeriods.concat(opt.periods));
            currentCombo.pop();
          }
        }
      };

      backtrack(0, [], []);

      if (results.length === 0) {
        setError("Could not generate any conflict-free timetables from the selected options.");
      } else {
        const newTts = results.map((combo, idx) => {
          const tId = Math.random().toString(36).substr(2, 9);
          const mappedCourses: AddedCourse[] = combo.map((c, i) => ({
            id: Math.random().toString(36).substr(2, 9),
            code: c.CODE,
            title: c.TITLE,
            faculty: c.FACULTY,
            venue: c.ROOM,
            slots: c.SLOT.split('+').map(s => s.trim().toUpperCase()),
            credits: c.CREDITS,
            type: c.TYPE,
            color: COLORS[i % COLORS.length]
          }));
          
          let freeHalfDays = 0;
          let totalGapMinutes = 0;
          let isFridayFree = true;
          let isMondayFree = true;
          let buildingDashes = 0;
          const gapsPerDay: Record<string, number> = {};
          const dashDetails: { fromClass: string; toClass: string; fromTime: string; toTime: string; day: string; fromBlock: string; toBlock: string }[] = [];
          const gapDetails: { day: string; startMin: number; endMin: number; durationMins: number; fromClass?: string; toClass?: string; fromTime?: string; toTime?: string }[] = [];

          const mySlots = new Set(mappedCourses.flatMap(c => c.slots));

          DAYS.forEach(day => {
            let morningOccupied = false;
            let eveningOccupied = false;
            
            type DailyClass = { startMins: number, endMins: number, venue: string, title: string, code: string, startTime: string, endTime: string };
            const dailyClasses: DailyClass[] = [];

            theoryPeriods.forEach((p, pIdx) => {
              const tSlot = p.days?.[day.id];
              const lSlot = labPeriods[pIdx]?.days?.[day.id];
              const isMorning = timeToMinutes(p.start as string) < timeToMinutes("2:00 PM");
              
              let slotOccupied = false;
              let venue = '';
              let courseTitle = '';
              let courseCode = '';
              
              if (tSlot && mySlots.has(tSlot)) {
                slotOccupied = true;
                const c = mappedCourses.find(mc => mc.slots.includes(tSlot));
                if (c) {
                  venue = c.venue;
                  courseTitle = c.title;
                  courseCode = c.code;
                  if (c.type?.toLowerCase().includes('embedded') && venue.includes('/')) {
                    venue = venue.split('/')[0].trim();
                  }
                }
              } else if (lSlot && mySlots.has(lSlot)) {
                slotOccupied = true;
                const c = mappedCourses.find(mc => mc.slots.includes(lSlot));
                if (c) {
                  venue = c.venue;
                  courseTitle = c.title;
                  courseCode = c.code;
                  if (c.type?.toLowerCase().includes('embedded') && venue.includes('/')) {
                    const parts = venue.split('/');
                    venue = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                  }
                }
              }

              if (slotOccupied) {
                if (day.id === 'mon') isMondayFree = false;
                if (day.id === 'fri') isFridayFree = false;

                if (isMorning) morningOccupied = true;
                else eveningOccupied = true;

                dailyClasses.push({
                  startMins: timeToMinutes(p.start as string),
                  endMins: timeToMinutes(p.end as string),
                  venue,
                  title: courseTitle,
                  code: courseCode,
                  startTime: p.start as string,
                  endTime: p.end as string
                });
              }
            });

            if (!morningOccupied) freeHalfDays++;
            if (!eveningOccupied) freeHalfDays++;

            // Sort classes by start time
            dailyClasses.sort((a, b) => a.startMins - b.startMins);

            let dayGaps = 0;
            for (let i = 1; i < dailyClasses.length; i++) {
              const prev = dailyClasses[i - 1];
              const curr = dailyClasses[i];
              const gap = curr.startMins - prev.endMins;
              
              if (gap > 5) {
                dayGaps += gap;
                gapDetails.push({
                  day: day.id,
                  startMin: prev.endMins,
                  endMin: curr.startMins,
                  durationMins: gap,
                  fromClass: `${prev.code} (${prev.title})`,
                  toClass: `${curr.code} (${curr.title})`,
                  fromTime: prev.endTime,
                  toTime: curr.startTime
                });
              }
              
              if (gap >= 0 && gap <= 15) {
                const getBlock = (v: string) => v.split('-')[0].trim();
                const prevBlock = getBlock(prev.venue);
                const currBlock = getBlock(curr.venue);
                // NIL or unassigned venues shouldn't trigger dashes
                if (prevBlock && currBlock && prevBlock !== 'NIL' && currBlock !== 'NIL' && prevBlock !== currBlock) {
                  buildingDashes++;
                  dashDetails.push({
                    fromClass: `${prev.code} (${prev.title})`,
                    toClass: `${curr.code} (${curr.title})`,
                    fromTime: prev.endTime,
                    toTime: curr.startTime,
                    day: day.name,
                    fromBlock: prevBlock,
                    toBlock: currBlock
                  });
                }
              }
            }

            gapsPerDay[day.id] = parseFloat((dayGaps / 60).toFixed(1));
            totalGapMinutes += dayGaps;
          });

          const isLongWeekend = isFridayFree || isMondayFree;
          const halfDaysCount = freeHalfDays;
          const gapsHours = parseFloat((totalGapMinutes / 60).toFixed(1));

          let socialScore = 0;
          let bestFriendMatches: string[] = [];

          if (generatorMaximizeFreeTimeFriends.length > 0) {
            let maxOverlap = -1;
            let closestFriends: string[] = [];

            generatorMaximizeFreeTimeFriends.forEach(fid => {
              const f = friends.find(fr => fr.id === fid);
              if (f && f.timetables && f.timetables.length > 0) {
                let maxFriendScore = 0;
                f.timetables.forEach(ft => {
                  const { percentage } = calculatePairwiseSocialScore(mappedCourses, ft.courses as AddedCourse[]);
                  if (percentage > maxFriendScore) maxFriendScore = percentage;
                });
                socialScore += maxFriendScore;

                if (maxFriendScore > maxOverlap) {
                  maxOverlap = maxFriendScore;
                  closestFriends = [f.name];
                } else if (maxFriendScore === maxOverlap) {
                  closestFriends.push(f.name);
                }
              }
            });
            if (generatorMaximizeFreeTimeFriends.length > 0) {
              socialScore = Math.round(socialScore / generatorMaximizeFreeTimeFriends.length);
            }
            bestFriendMatches = closestFriends;
          }

          if (halfDaysCount < generatorMinHalfDays) return null;

          return { 
            id: tId, 
            name: `Generated Option`, 
            courses: mappedCourses, 
            metrics: {
              halfDays: halfDaysCount,
              gaps: gapsHours,
              gapsPerDay: gapsPerDay,
              gapDetails: gapDetails,
              buildingDashes: buildingDashes,
              dashDetails: dashDetails,
              socialScore: socialScore,
              bestFriendMatches: bestFriendMatches,
              isLongWeekend: isLongWeekend
            }
          };
        }).filter(Boolean) as TimetableState[];

        if (newTts.length === 0) {
          setError(`No timetables met the minimum half-days requirement (${generatorMinHalfDays}). Try lowering it.`);
          setIsGenerating(false);
          return;
        }

        newTts.sort((a, b) => {
          const am = a.metrics!;
          const bm = b.metrics!;
          if (generatorSortBy === 'social') return bm.socialScore - am.socialScore;
          if (generatorSortBy === 'halfdays') return bm.halfDays - am.halfDays;
          if (generatorSortBy === 'compactness') return am.gaps - bm.gaps; // lower gaps is better
          
          const aBalanced = (am.halfDays * 10) + ((20 - am.gaps) * 5) + (am.socialScore);
          const bBalanced = (bm.halfDays * 10) + ((20 - bm.gaps) * 5) + (bm.socialScore);
          return bBalanced - aBalanced;
        });

        let filteredTts = newTts;

        if (generatorUniqueFaculties) {
          const usedFaculties = new Map<string, Set<string>>();
          targetCodes.forEach(c => usedFaculties.set(c, new Set()));
          
          filteredTts = filteredTts.filter(tt => {
            let isUnique = true;
            for (const c of tt.courses) {
              if (usedFaculties.get(c.code)!.has(c.faculty)) {
                isUnique = false;
                break;
              }
            }
            if (isUnique) {
              tt.courses.forEach(c => usedFaculties.get(c.code)!.add(c.faculty));
              return true;
            }
            return false;
          });
        }

        // Group by identical physical slot layouts
        const grouped = new Map<string, TimetableState>();
        
        filteredTts.forEach(combo => {
          const signature = [...combo.courses.flatMap(c => c.slots)].sort().join('|');
          
          if (!grouped.has(signature)) {
            grouped.set(signature, { ...combo, variants: [{ ...combo, name: `Variant 1` }] });
          } else {
            const existing = grouped.get(signature)!;
            existing.variants!.push({ ...combo, name: `Variant ${existing.variants!.length + 1}` });
          }
        });

        const groupedTts = Array.from(grouped.values());
        groupedTts.forEach((t, i) => { t.name = `Option ${i + 1}`; });

        setStagedTimetables(groupedTts);
        setSuccessMsg(`Found ${groupedTts.length} unique timetables (${newTts.length} total variants). Review them below!`);
        // We do NOT close generator immediately so they can review.
      }
    } catch (e) {
      setError("An error occurred while generating timetables.");
    }
    setIsGenerating(false);
  };

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

  const handleRenameSubmit = () => {
    if (editNameValue.trim()) {
      setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, name: editNameValue.trim() } : t));
    }
    setIsEditingName(false);
  };

  // downloadSampleCSV removed as database is preloaded.

  const downloadImage = useCallback(async (format: 'jpg' | 'png' = 'jpg') => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      await downloadTimetableImage(captureRef.current, activeTimetable.name, themeBgColor, format);
      setSuccessMsg("Timetable downloaded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to download timetable image.");
    } finally {
      setIsDownloading(false);
    }
  }, [activeTimetable.name, themeBgColor]);

  const openPrintablePage = useCallback(() => {
    if (!pdfCaptureRef.current) return;
    setIsDownloading(true);

    try {
      const printWindow = openTimetablePrintablePage(
        pdfCaptureRef.current.innerHTML,
        activeTimetable.name,
        themeHtmlClass,
        themeBgColor,
        themeTextColor
      );

      if (!printWindow) {
        setError("Please allow popups to open the printable view.");
        setIsDownloading(false);
        return;
      }

      setSuccessMsg("Printable view opened in new tab!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to open printable view.");
    } finally {
      setIsDownloading(false);
    }
  }, [activeTimetable.name, themeHtmlClass, themeBgColor, themeTextColor]);

  // uniqueCourses moved above.

  // Available Slot Rows for Selected Course
  const availableSlots = useMemo(() => {
    if (!selectedCourseCode) return [];
    let slots = masterCourses.filter(c => c.CODE === selectedCourseCode);
    
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
  }, [masterCourses, selectedCourseCode, courseLocks]);

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

  const renderUnifiedGrid = (customCourses?: AddedCourse[], fullSize?: boolean) => {
    const renderCourses = customCourses || courses;
    const getCourse = (slotName: string) => renderCourses.find(c => c.slots.includes(slotName));

    return (
      <div className={`mb-8 rounded-xl border border-border shadow-2xl bg-background  ${customCourses && !fullSize ? 'scale-[0.85] origin-top-left -mb-10' : ''} ${fullSize ? '' : 'overflow-x-auto'}`}>
        <div className="p-4 bg-muted/80 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            Unified Schedule
          </h3>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm"></div>Theory (Top)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm border-dashed"></div>Lab (Bottom)</div>
          </div>
        </div>
        {!fullSize && (
          <div className="flex md:hidden items-center justify-center gap-1.5 py-2 px-3 bg-blue-500/10 border-b border-border text-[10px] font-bold text-blue-500 animate-pulse text-center">
            <span>← Swipe horizontally to view full timetable grid →</span>
          </div>
        )}
        <div className="min-w-max">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-card">
                <th className="p-3 border-b border-r border-border font-semibold text-foreground/80 w-24 text-center sticky left-0 z-20 bg-card">Day</th>
                {theoryPeriods.map((period, idx) => (
                  <th key={idx} className="p-2 border-b border-r border-border text-xs text-center text-muted-foreground font-medium">
                    <div className="flex flex-col">
                      <span>{period.start}</span>
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <span>{period.end}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 border-r border-border font-semibold text-slate-200 text-center bg-background/95  sticky left-0 z-20">
                    {day.name.substring(0, 3).toUpperCase()}
                  </td>
                  {theoryPeriods.map((period, pIdx) => {
                    const theorySlotName = period.days?.[day.id];
                    const labSlotName = labPeriods[pIdx]?.days?.[day.id];
                    
                    if (!theorySlotName && !labSlotName) {
                      return <td key={pIdx} className="border-r border-border bg-black/20 h-[76px] min-h-[76px]"></td>;
                    }

                    const tCourse = theorySlotName ? getCourse(theorySlotName) : undefined;
                    const lCourse = labSlotName ? getCourse(labSlotName) : undefined;

                    const isTBlocked = theorySlotName ? blockedSlots.has(theorySlotName) : false;
                    const isLBlocked = labSlotName ? blockedSlots.has(labSlotName) : false;

                    return (
                      <td key={pIdx} className="border-r border-border text-center relative group min-w-[80px] align-top hover:z-50 h-[76px] min-h-[76px]">
                        <div className="w-full h-full flex flex-col items-stretch">
                          {/* Theory Half */}
                          {theorySlotName ? (
                            <div 
                              onClick={() => !customCourses && toggleBlockSlot(theorySlotName)}
                              className={`h-[38px] p-1 border-b border-border flex flex-col items-center justify-center transition-all duration-300 relative ${!customCourses ? 'cursor-pointer' : ''} ${
                                isTBlocked 
                                  ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 border-red-500/30 text-red-200 shadow-inner'
                                  : tCourse 
                                    ? tCourse.color + ' shadow-lg text-foreground z-10' 
                                    : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(period.start as string) >= g.startMin && timeToMinutes(period.start as string) < g.endMin) ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 animate-pulse' : 'bg-muted/20 text-muted-foreground hover:border-border/50 hover:bg-muted/30')
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${tCourse || isTBlocked ? 'opacity-100' : 'opacity-60'}`}>
                                {isTBlocked ? 'Blocked' : theorySlotName}
                              </span>
                              {!isTBlocked && tCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{tCourse.code}</span>}
                              
                              {/* Theory Tooltip */}
                              {!isTBlocked && tCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                  <p className="font-bold">{tCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{tCourse.faculty}</p>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-border"></div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-[38px] border-b border-border bg-black/10"></div>
                          )}
                          
                          {/* Lab Half */}
                          {labSlotName ? (
                            <div 
                              onClick={() => !customCourses && toggleBlockSlot(labSlotName)}
                              className={`h-[38px] p-1 flex flex-col items-center justify-center transition-all duration-300 relative ${!customCourses ? 'cursor-pointer' : ''} ${
                                isLBlocked 
                                  ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 text-red-200 shadow-inner'
                                  : lCourse 
                                    ? lCourse.color + ' shadow-lg text-foreground z-10' 
                                    : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(period.start as string) >= g.startMin && timeToMinutes(period.start as string) < g.endMin) ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 animate-pulse' : 'bg-black/20 text-white/30 hover:bg-black/30')
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${lCourse || isLBlocked ? 'opacity-100' : 'opacity-60'}`}>
                                {isLBlocked ? 'Blocked' : labSlotName}
                              </span>
                              {!isLBlocked && lCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{lCourse.code}</span>}
                              
                              {/* Lab Tooltip */}
                              {!isLBlocked && lCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                  <p className="font-bold">{lCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{lCourse.faculty}</p>
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-t border-l border-border"></div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-[38px] bg-black/10"></div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
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

      if (key === "s" || key === "/") {
        e.preventDefault();
        setIsCourseSearchOpen(true);
      } else if (key === "t") {
        e.preventDefault();
        setIsCourseLockOpen(true);
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
  }, [timetables, createNewTimetable, openPrintablePage, handleClearTimetable]);

  return (
    <div data-prevent-swipe="true" className={`w-full space-y-6 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-950 p-4 md:p-8 overflow-y-auto' : ''}`}>
      
      {/* Top Banner / Upload Area */}
      <div className="solid-card p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MapIcon className="text-blue-400 w-6 h-6" /> FFCS Planner
              <button 
                onClick={() => setIsGuideModalOpen(true)}
                className="ml-2 text-muted-foreground hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-500/10 cursor-pointer"
                title="How does this work?"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsShortcutsModalOpen(true)}
                className="text-muted-foreground hover:text-indigo-500 transition-colors p-1 rounded-full hover:bg-indigo-500/10 cursor-pointer"
                title="Keyboard Shortcuts"
              >
                <Keyboard className="w-5 h-5" />
              </button>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Upload the master spreadsheet and plan your perfect semester.</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden md:flex items-center gap-2 bg-muted hover:border-border text-foreground px-4 py-2.5 rounded-xl border border-border transition-colors shadow-lg"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 bg-background px-4 py-2 rounded-xl border border-border">
              {isLoadingCourses ? (
                <span className="text-amber-400 text-sm font-medium flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  Loading course database...
                </span>
              ) : masterCourses.length > 0 ? (
                <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Course report loaded ({masterCourses.length} slots)
                </span>
              ) : (
                <span className="text-red-400 text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  No course report loaded
                </span>
              )}
            </div>
          </div>
        </div>

        {(error || successMsg) && (
          <div className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${error ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-green-500/10 border-green-500/50 text-green-400'}`}>
            {error ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{error || successMsg}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Top Panel: Course Manager */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Timetable Manager */}
          <div className="solid-card p-5">
            <h2 className="text-lg font-bold text-foreground mb-4">Timetable Manager</h2>
            <div className="space-y-4">
              {/* Timetable Selector as Modal Trigger */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTimetableModalOpen(true)}
                  className="flex-1 bg-background border border-border rounded-xl pl-4 pr-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-all flex items-center justify-between gap-2 shadow-sm"
                >
                  <span className="truncate font-medium">{activeTimetable?.name || 'Select Timetable'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{activeTimetable?.courses.length || 0} courses</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={createNewTimetable} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-md shadow-blue-600/10 shrink-0"
                  title="Create New Timetable"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-semibold">New</span>
                </button>
              </div>

              {/* Active Timetable Actions: Rename, Duplicate, Delete */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/30 border border-border/50 rounded-xl">
                <button 
                  type="button"
                  onClick={() => { setEditNameValue(activeTimetable.name); setIsEditingName(true); }}
                  className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-all"
                  title="Rename Current Timetable"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                
                <button 
                  type="button"
                  onClick={duplicateTimetable}
                  className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-all"
                  title="Duplicate Current Timetable"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>

                <button 
                  type="button"
                  onClick={() => deleteTimetable(activeTimetableId)}
                  className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all font-medium"
                  title="Delete Current Timetable"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {isEditingName && (
                <div className="flex gap-2 mt-2 animate-fadeIn">
                  <input 
                    type="text" 
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50"
                    placeholder="New name..."
                  />
                  <button 
                    onClick={handleRenameSubmit}
                    className="bg-green-500/20 text-green-400 p-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/30"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Utility Row: Export Calendar, Friends, Backup/Restore */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button 
                  type="button"
                  onClick={() => exportTimetableIcal(activeTimetable, getTimetableSchema(), new Date().toISOString().split('T')[0], new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0])}
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-background border border-border rounded-xl hover:bg-muted/30 transition-all text-[11px] text-foreground font-medium shadow-sm group"
                  title="Export to Apple/Google Calendar"
                >
                  <Download className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="truncate w-full text-center">iCal Export</span>
                </button>
                
                <button 
                  type="button"
                  onClick={() => setIsFriendsManagerOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-background border border-border rounded-xl hover:bg-muted/30 transition-all text-[11px] text-foreground font-medium shadow-sm group"
                  title="Manage friends and compare schedules"
                >
                  <Users className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                  <span className="truncate w-full text-center">Friends</span>
                </button>

                <button 
                  type="button"
                  onClick={exportTimetables}
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-background border border-border rounded-xl hover:bg-muted/30 transition-all text-[11px] text-foreground font-medium shadow-sm group"
                  title="Export backup data (JSON)"
                >
                  <Save className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                  <span>Backup</span>
                </button>

                <label 
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-background border border-border rounded-xl hover:bg-muted/30 transition-all text-[11px] text-foreground font-medium cursor-pointer shadow-sm group"
                  title="Import backup data (JSON)"
                >
                  <input type="file" accept=".json" onChange={importTimetables} className="hidden" />
                  <Upload className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Restore</span>
                </label>
              </div>

              {/* Core Planners: Target Courses, Auto-Generate */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                <button 
                  type="button"
                  onClick={() => setIsCourseLockOpen(true)}
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 hover:text-purple-400 text-sm font-semibold py-3 rounded-xl border border-purple-500/20 transition-all flex items-center justify-center gap-2 relative shadow-sm"
                >
                  <Lock className="w-4 h-4" /> 
                  <span>Target Courses</span>
                  {courseLocks.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-background">
                      {courseLocks.length}
                    </span>
                  )}
                </button>
                
                <button 
                  type="button"
                  onClick={() => setIsGeneratorOpen(true)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 text-sm font-semibold py-3 rounded-xl border border-amber-500/20 transition-all flex items-all justify-center gap-2 shadow-sm"
                >
                  <Wand2 className="w-4 h-4" /> 
                  <span>Auto-Generate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Course Selector */}
          <div className="solid-card p-5">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <PlusCircle className="text-blue-400 w-5 h-5" /> Course Selector
            </h2>
            
            {!masterCourses.length ? (
              <EmptyState
                title="Please upload a master slots file first."
                className="bg-background border border-border rounded-xl"
              />
            ) : (
              <form onSubmit={handleAddCourse} className="space-y-4">
                <div className="flex items-center justify-between mb-4 bg-muted/30 p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      Group Embedded Courses
                    </span>
                    <button 
                      type="button"
                      onClick={() => setIsGroupingEnabled(!isGroupingEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${isGroupingEnabled ? 'bg-blue-500' : 'bg-muted-foreground'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isGroupingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManualLinkerOpen(true)}
                    className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-md transition-colors border border-border"
                  >
                    Advanced Linker
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">1. Select Course</label>
                  <button 
                    onClick={() => setIsCourseSearchOpen(true)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-left text-foreground hover:bg-muted/50 transition-colors flex justify-between items-center group shadow-sm"
                  >
                    <span className="truncate text-sm font-medium">
                      {selectedCourseCode 
                        ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{selectedCourseCode} - {uniqueCourses.find(c => c.code === selectedCourseCode)?.title}</span>
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
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">2. Select Slot & Faculty</label>
                    <div className="flex gap-2">
                      <select 
                        value={slotFilter}
                        onChange={e => {
                          setSlotFilter(e.target.value);
                          setSelectedSlotIndex("-1");
                        }}
                        className="w-1/3 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="all">All</option>
                        {isGroupingEnabled ? (
                          <>
                            <option value="morning_session">Morning Session</option>
                            <option value="evening_session">Evening Session</option>
                          </>
                        ) : (
                          <>
                            {(!hasLab || hasTheory) && (
                              <>
                                <option value="morning">Morning Theory</option>
                                <option value="evening">Evening Theory</option>
                              </>
                            )}
                            {(!hasTheory || hasLab) && (
                              <>
                                <option value="morning_lab">Morning Lab</option>
                                <option value="evening_lab">Evening Lab</option>
                              </>
                            )}
                          </>
                        )}
                      </select>
                      
                      <button
                        type="button"
                        onClick={() => setIsSlotSearchOpen(true)}
                        className="w-2/3 bg-background border border-border rounded-xl px-4 py-2.5 text-left text-foreground hover:bg-muted/50 transition-colors flex justify-between items-center group shadow-sm"
                      >
                        <span className="truncate text-sm font-medium">
                          {selectedSlotIndex !== "-1" && availableSlots[parseInt(selectedSlotIndex)]
                            ? (() => {
                                const row = availableSlots[parseInt(selectedSlotIndex)];
                                return `${row.SLOT} - ${row.FACULTY}`;
                              })()
                            : <span className="text-muted-foreground">-- Search & Choose Slot --</span>}
                        </span>
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 ml-1">
                      * For embedded courses, theory and lab slots taught by the same faculty are automatically linked (if grouping is enabled). Click cells in the timetable grid to block time slots and narrow down valid options.
                    </p>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium py-2.5 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add to Timetable
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Panel: The Grid and Export */}
        <div className="w-full space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            {/* Social Score Widget */}
            <div className="flex items-center gap-3 bg-muted/20 border border-border p-2 rounded-xl w-full md:w-auto flex-1 max-w-md print:hidden">
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
                  <select 
                    value={socialTargetId}
                    onChange={(e) => setSocialTargetId(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg text-sm text-foreground p-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
                  >
                    <option value="">Select Friend/Group...</option>
                    {friends.length > 0 && <optgroup label="Friends">
                      {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </optgroup>}
                    {friendGroups.length > 0 && <optgroup label="Groups">
                      {friendGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </optgroup>}
                  </select>
                  
                  {friendGroups.find(g => g.id === socialTargetId) && (
                    <select
                      value={socialScoreGroupMethod}
                      onChange={(e) => setSocialScoreGroupMethod(e.target.value as any)}
                      className="w-24 bg-background border border-border rounded-lg text-[10px] text-foreground p-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
                      title="Calculation Method"
                    >
                      <option value="intersection">Intersection</option>
                      <option value="cumulative">Cumulative</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0 ml-auto">
              <button 
                onClick={openPrintablePage}
                disabled={isDownloading || courses.length === 0}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
              >
                <Download className="w-4 h-4" /> 
                {isDownloading ? "Opening..." : "Printable View"}
              </button>
              <div className="relative group">
                <button 
                  onClick={() => downloadImage('jpg')}
                  disabled={isDownloading || courses.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" /> 
                  {isDownloading ? "Capturing..." : "Download JPG"}
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 bg-background border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                  <button 
                    onClick={() => downloadImage('jpg')}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    Download as JPG
                  </button>
                  <button 
                    onClick={() => downloadImage('png')}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                  >
                    Download as PNG
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div ref={captureRef} className="space-y-6 rounded-xl">
            {/* Header for the exported image */}
            <div className="hidden print:block p-4 mb-4 bg-muted rounded-xl border border-border text-center">
              <h1 className="text-2xl font-bold text-foreground">{activeTimetable.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">Generated by AmazeCC FFCS Planner</p>
            </div>
            
            {renderUnifiedGrid()}
            
            {/* Bottom Panel: Selected Courses Table inside capture ref to include in image */}
            {courses.length > 0 && (
              <div className="solid-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-bold text-foreground flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
                
                <div className="overflow-x-auto scrollbar-none">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border">
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
                      {getGroupedCourses(courses).map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`px-2.5 py-1 rounded-lg ${c.color} text-white text-xs font-bold shadow-sm shrink-0`}>{c.code}</div>
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
                          <td className="py-3 px-2 text-sm text-foreground/80">
                            {renderTypeChips(c.type)}
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80">{c.faculty}</td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {c.slots.map(s => (
                                <span key={s} className="bg-accent/50 border border-border text-foreground/80 text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80 max-w-xs">{c.venue}</td>
                          <td className="py-3 px-2 text-sm text-foreground/80">{c.credits}</td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden PDF Capture Container */}
      <div 
        ref={pdfCaptureRef} 
        style={{ 
          display: 'none', 
          position: 'absolute', 
          left: '-9999px', 
          top: '-9999px', 
          width: '1200px', 
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '40px'
        }}
      >
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{activeTimetable.name}</h1>

          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-blue-400">AmazeCC FFCS</h2>
            <p className="text-muted-foreground text-sm">VIT Chennai</p>
          </div>
        </div>

        {/* Timetable Grid Preview */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">Schedule</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs text-center border-collapse table-fixed">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 w-20 text-muted-foreground">Day</th>
                  {theoryPeriods.map(p => (
                    <th key={p.start} className="border border-border p-2 text-foreground/80">
                      <div>{p.start}</div>
                      <div className="text-muted-foreground font-normal">to {p.end}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day.id} className="border border-border">
                    <td className="border border-border font-bold bg-muted/50 uppercase">
                      {day.id}
                    </td>
                    {theoryPeriods.map((tp, idx) => {
                      const tSlot = tp.days?.[day.id];
                      const lp = labPeriods[idx];
                      const lSlot = lp?.days?.[day.id];
                      
                      const tCourse = tSlot ? getCourseForSlot(tSlot) : null;
                      const lCourse = lSlot ? getCourseForSlot(lSlot) : null;
                      
                      return (
                        <td key={idx} className="border border-border p-0 relative h-16 align-top">
                          {/* Theory Half */}
                          <div className={`h-1/2 w-full border-b border-border/50 flex flex-col items-center justify-center p-0.5 ${tCourse ? (tCourse.color + ' text-white') : 'bg-transparent text-muted-foreground'}`}>
                            {tCourse ? (
                              <>
                                <span className="font-bold text-[10px] leading-tight">{tCourse.code}</span>
                                <span className="text-[8px] text-white/80">{tSlot}</span>
                              </>
                            ) : (
                              <span className="text-[9px]">{tSlot || '-'}</span>
                            )}
                          </div>
                          
                          {/* Lab Half */}
                          <div className={`h-1/2 w-full flex flex-col items-center justify-center p-0.5 ${lCourse ? (lCourse.color + ' text-white') : 'bg-transparent text-muted-foreground'}`}>
                            {lCourse ? (
                              <>
                                <span className="font-bold text-[10px] leading-tight">{lCourse.code}</span>
                                <span className="text-[8px] opacity-75">{lSlot}</span>
                              </>
                            ) : (
                              <span className="text-[9px]">{lSlot || '-'}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Courses Table */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Course List</h2>
            <p className="text-muted-foreground font-medium">Total Credits: {getGroupedCourses(courses).reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}</p>
          </div>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border text-foreground/80">
                <th className="py-3 px-4 font-semibold">Course Code</th>
                <th className="py-3 px-4 font-semibold">Title</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Faculty</th>
                <th className="py-3 px-4 font-semibold">Slots</th>
                <th className="py-3 px-4 font-semibold text-center">Credits</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">No courses selected</td>
                </tr>
              ) : (
                getGroupedCourses(courses).map((c, i) => (
                  <tr key={i} className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium">
                      <div className={`inline-block px-2.5 py-1 rounded-lg ${c.color || 'bg-blue-600'} text-white text-xs font-bold shadow-sm`}>{c.code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{c.title}</span>
                        {c.batches && c.batches.length > 0 && c.batches.map(b => (
                          <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {renderTypeChips(c.type)}
                    </td>
                    <td className="py-3 px-4 text-foreground/80">{c.faculty}</td>
                    <td className="py-3 px-4 font-mono text-xs">{c.slots.join(" + ")}</td>
                    <td className="py-3 px-4 text-center font-medium">{c.credits}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-12 pt-4 border-t border-border">
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            Generated by AmazeCC <MapIcon className="w-4 h-4 text-blue-500" />
          </p>
        </div>
      </div>

      {/* Auto-Generator Modal */}
      {/* Target Courses Modal */}
      {/* Target Courses Modal */}
      <TargetCoursesModal
        isOpen={isCourseLockOpen}
        onClose={() => setIsCourseLockOpen(false)}
        courseLocks={courseLocks}
        setCourseLocks={setCourseLocks}
        masterCourses={masterCourses}
        uniqueCourseCodes={uniqueCourseCodes}
        renderTypeChips={renderTypeChips}
      />

      {isFriendsManagerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50  p-4">
          <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Users className="text-pink-500 w-6 h-6" /> Friends Manager
              </h2>
              <button onClick={() => setIsFriendsManagerOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
              <div className="flex bg-muted/50 p-1 rounded-xl gap-1 shrink-0">
                <button 
                  onClick={() => setFriendsManagerTab("friends")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${friendsManagerTab === "friends" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Friends
                </button>
                <button 
                  onClick={() => setFriendsManagerTab("groups")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${friendsManagerTab === "groups" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
                    <h3 className="font-semibold text-sm text-foreground">Your Friends ({friends.length})</h3>
                    {friends.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                        No friends added yet. Ask your friend to click "Export Config" and send you the file!
                      </div>
                    ) : (
                      friends.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-bold">
                              {f.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{f.name}</p>
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
                  <div className="bg-muted/10 border border-border rounded-xl p-4 flex flex-col gap-3 shrink-0">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Plus className="w-4 h-4 text-pink-500" /> Create New Group
                    </h3>
                    <input 
                      type="text" 
                      placeholder="Group Name (e.g., Gaming Squad)" 
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-pink-500/50"
                    />
                    <div className="max-h-32 overflow-y-auto custom-scrollbar border border-border rounded-lg bg-background p-2">
                      {friends.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 text-center">Add friends first</div>
                      ) : (
                        friends.map(f => (
                          <label key={f.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={newGroupFriends.includes(f.id)}
                              onChange={(e) => {
                                if (e.target.checked) setNewGroupFriends(prev => [...prev, f.id]);
                                else setNewGroupFriends(prev => prev.filter(id => id !== f.id));
                              }}
                              className="rounded border-border text-pink-500 focus:ring-pink-500/30"
                            />
                            <span className="text-sm text-foreground">{f.name}</span>
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
                    <h3 className="font-semibold text-sm text-foreground">Your Groups ({friendGroups.length})</h3>
                    {friendGroups.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                        No groups created yet.
                      </div>
                    ) : (
                      friendGroups.map(g => (
                        <div key={g.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-pink-500" />
                              <p className="text-sm font-bold text-foreground">{g.name}</p>
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
                              return <span key={fid} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">{f.name}</span>;
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingFriendTimetables && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60  p-4 animate-in fade-in">
          <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Name Your Friend</h2>
            </div>
            <p className="text-sm text-muted-foreground">They're considering {pendingFriendTimetables.length} timetables. Give them a name so you can identify them in the generator.</p>
            <input 
              type="text" 
              value={pendingFriendName}
              onChange={(e) => setPendingFriendName(e.target.value)}
              placeholder="E.g., Rahul"
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all"
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
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
          </div>
        </div>
      )}

      {/* Auto-Generator Modal */}
      <AutoGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          courseLocks={courseLocks}
          setCourseLocks={setCourseLocks}
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

      {/* Friend Timetable View Modal */}
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

      {isGuideModalOpen && <FFCSGuideModal onClose={() => setIsGuideModalOpen(false)} />}

      {/* Shortcuts Modal */}
      {isShortcutsModalOpen && <FFCSShortcutsModal onClose={() => setIsShortcutsModalOpen(false)} />}

      {/* Course Search Modal */}
      {isCourseSearchOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" /> Search Course
              </h3>
              <button 
                onClick={() => setIsCourseSearchOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-border bg-background">
              <SearchInput placeholder="Search by course code or title..." value={courseSearchQuery} onChange={e => setCourseSearchQuery(e.target.value)} className="bg-muted/50 border-border pl-10 pr-4 py-3 focus:border-blue-500/50 placeholder:text-muted-foreground" autoFocus />
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-muted/5">
              {uniqueCourses.filter(c => 
                (courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
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
                  className={`w-full text-left px-4 py-3 my-0.5 rounded-xl transition-colors flex flex-col gap-1 ${fullyAdded ? 'opacity-50 cursor-not-allowed bg-muted/30 border border-border/50' : selectedCourseCode === c.code ? 'bg-blue-500/10 border border-blue-500/20 shadow-sm' : 'border border-transparent hover:bg-muted/80'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${fullyAdded ? 'text-muted-foreground' : 'text-foreground'}`}>{c.code}</span>
                       {renderTypeChips(c.types || [], 'sm')}
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
                (courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
                c.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || 
                c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
                )
              ).length === 0 && (
                <EmptyState
                  icon={<Search className="w-8 h-8" />}
                  title="No courses found"
                  description="Try a different search term"
                  className="py-12 border border-dashed border-border/50 rounded-xl m-2"
                />
              )}
              {uniqueCourses.filter(c => 
                (courseLocks.length === 0 || courseLocks.some(lock => lock.code === c.code)) && (
                c.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || 
                c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
                )
              ).length > 100 && (
                <div className="text-center py-4 text-xs text-muted-foreground font-medium flex items-center justify-center gap-2 border-t border-border/30 mt-2">
                  <Info className="w-3 h-3" /> Showing first 100 results. Refine search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slot Search Modal */}
      {isSlotSearchOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" /> Search Slot & Faculty
              </h3>
              <button 
                onClick={() => setIsSlotSearchOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-border bg-background">
              <SearchInput placeholder="Search by slot, faculty, or room..." value={slotSearchQuery} onChange={e => setSlotSearchQuery(e.target.value)} className="bg-muted/50 border-border pl-10 pr-4 py-3 focus:border-blue-500/50 placeholder:text-muted-foreground" autoFocus />
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-muted/5">
              {availableSlots.map((row, idx) => ({ row, idx })).filter(({ row }) => {
                if (slotFilter === "all") return true;
                if (slotFilter === "morning_session") {
                  const parts = (row?.SLOT || "").split('+').map(s => s.trim()).filter(s => s && s !== 'NIL');
                  return parts.length > 0 && parts.every(s => isMorningSlot(s));
                }
                if (slotFilter === "evening_session") {
                  const parts = (row?.SLOT || "").split('+').map(s => s.trim()).filter(s => s && s !== 'NIL');
                  return parts.length > 0 && parts.every(s => isEveningSlot(s));
                }
                if (slotFilter === "morning") return isMorningSlot(row?.SLOT || "") && !(row?.SLOT || "").split('+').some(s => s.trim().startsWith('L'));
                if (slotFilter === "evening") return isEveningSlot(row?.SLOT || "") && !(row?.SLOT || "").split('+').some(s => s.trim().startsWith('L'));
                if (slotFilter === "morning_lab") return isMorningSlot(row?.SLOT || "") && (row?.SLOT || "").split('+').some(s => s.trim().startsWith('L'));
                if (slotFilter === "evening_lab") return isEveningSlot(row?.SLOT || "") && (row?.SLOT || "").split('+').some(s => s.trim().startsWith('L'));
                return true;
              }).filter(({ row }) => {
                const query = slotSearchQuery.toLowerCase();
                return row?.SLOT?.toLowerCase().includes(query) || 
                       row?.FACULTY?.toLowerCase().includes(query) || 
                       row?.ROOM?.toLowerCase().includes(query);
              }).map(({ row, idx }) => {
                const slotsArray = row?.SLOT?.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL") || [];
                const clashError = checkClashes(slotsArray);
                const isBlocked = !!clashError;
                
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
                      ${isBlocked ? 'opacity-50 cursor-not-allowed bg-red-500/5 border-red-500/10' : 'hover:bg-muted/80'}`}
                  >
                    <div className="flex flex-col w-full gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-foreground text-sm">
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
                    <span className="text-xs text-muted-foreground flex justify-between w-full mt-1 border-t border-border/30 pt-1.5">
                      <span className="truncate pr-2">{row?.FACULTY}</span>
                      <span className="font-medium text-foreground/70 shrink-0">{row?.ROOM}</span>
                    </span>
                  </button>
                );
              })}
              {availableSlots.filter((row) => {
                const query = slotSearchQuery.toLowerCase();
                return row?.SLOT?.toLowerCase().includes(query) || 
                       row?.FACULTY?.toLowerCase().includes(query) || 
                       row?.ROOM?.toLowerCase().includes(query);
              }).length === 0 && (
                <EmptyState
                  icon={<Search className="w-8 h-8" />}
                  title="No slots found"
                  description="Try a different search term or filter"
                  className="py-12 border border-dashed border-border/50 rounded-xl m-2"
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Timetable Selection Modal */}
      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 rounded-t-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                Select Timetable
              </h3>
              <button 
                onClick={() => setIsTimetableModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-muted/5">
              {timetables.map(t => {
                const isActive = t.id === activeTimetableId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTimetableId(t.id);
                      setIsTimetableModalOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 my-0.5 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                      isActive 
                        ? 'bg-blue-500/10 border border-blue-500/20 shadow-sm' 
                        : 'border border-transparent hover:bg-muted/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                      <div className="min-w-0">
                        <span className={`font-bold text-sm block truncate ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>
                          {t.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.courses.length} course{t.courses.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">Active</span>
                    )}
                  </button>
                );
              })}
              {timetables.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No timetables yet. Create one!
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border bg-muted/10 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{timetables.length} timetable{timetables.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { createNewTimetable(); setIsTimetableModalOpen(false); }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Variant Search Modal */}
      {isVariantSearchOpen && generatorPreviewTimetable?.variants && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 rounded-t-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-500" /> Select Variant
              </h3>
              <button 
                onClick={() => setIsVariantSearchOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-border bg-background">
              <SearchInput placeholder="Search by faculty name..." value={variantSearchQuery} onChange={e => setVariantSearchQuery(e.target.value)} className="bg-muted/50 border-border pl-10 pr-4 py-3 focus:border-amber-500/50 placeholder:text-muted-foreground" autoFocus />
            </div>
            
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-muted/5">
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
                    <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl m-2">
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
                        ${isSelected ? 'bg-amber-500/10 border border-amber-500/20 shadow-sm' : 'border border-transparent hover:bg-muted/80'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">
                          Variant {generatorPreviewTimetable.variants!.findIndex(x => x.id === v.id) + 1}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">Selected</span>
                        )}
                      </div>
                      
                      {differingCourseCodes.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1 border-t border-border/30 pt-2">
                          {differingCourseCodes.map(code => {
                            const c = v.courses.find(x => x.code === code);
                            return c ? (
                              <div key={code} className="flex justify-between items-center text-xs">
                                <span className="font-medium text-muted-foreground">{code}</span>
                                <span className="text-foreground">{c.faculty}</span>
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
          </div>
        </div>
      )}

      {/* Manual Linker Modal */}
      {isManualLinkerOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 rounded-t-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                Advanced Course Linker
              </h3>
              <button 
                onClick={() => setIsManualLinkerOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
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
                className="w-full h-64 bg-muted/30 border border-border rounded-xl p-3 text-sm font-mono text-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="CODE,TYPE,SLOT,ROOM,FACULTY,LINK_ID&#10;BAMEE201,ETH,D1+TD1,AB2-301,SREEKANTH DONDAPATI,SREEKANTH_LAB_A&#10;BAMEE201,ELA,L5+L6,AB1-006,SREEKANTH DONDAPATI,SREEKANTH_LAB_A"
              />
              
              {manualLinks.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2">Parsed Links Preview ({manualLinks.length})</h4>
                  <div className="bg-muted/30 border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border sticky top-0">
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
                          <tr key={idx} className="hover:bg-muted/50 transition-colors">
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
            
            <div className="p-4 border-t border-border bg-muted/10 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setIsManualLinkerOpen(false)}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FFCSShortcutsModal({ onClose }: { onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" /> Keyboard Shortcuts
          </h3>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            Boost your timetable drafting speed with these global hotkeys:
          </p>
          <div className="divide-y divide-border/40">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 text-xs">
                <span className="text-muted-foreground">{shortcut.desc}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((k, kidx) => (
                    <kbd key={kidx} className="px-2 py-1 bg-muted border border-border rounded-md font-mono text-[10px] font-bold text-foreground shadow-xs">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-border bg-muted/20 text-right">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
