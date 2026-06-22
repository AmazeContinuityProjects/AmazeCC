"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { PlusCircle, Trash2, AlertTriangle, Info, UploadCloud, Map as MapIcon, Download, Plus, Edit2, Check, Maximize2, Minimize2, Copy, Save, Upload, Wand2, X, Settings2, Users, ArrowLeft, ArrowRight, Eye, HelpCircle, Share2, FileText, Search, Lock } from "lucide-react";
import * as XLSX from "xlsx";
import * as htmlToImage from "html-to-image";
import { useTheme } from "next-themes";
import FFCSGuideModal from "./FFCSGuideModal";

import chennaiSchema from "@/app/data/chennai.json";
import apSchema from "@/app/data/ap.json";
import bhopalSchema from "@/app/data/bhopal.json";

const CAMPUS_SCHEMAS: Record<string, any> = {
  chennai: chennaiSchema,
  ap: apSchema,
  bhopal: bhopalSchema
};

export let GLOBAL_CAMPUS = "chennai";
export const getTimetableSchema = () => CAMPUS_SCHEMAS[GLOBAL_CAMPUS];

import { GenCourseSelection, SlotMap, TimetablePeriod, ParsedCourse, AddedCourse, TimetableState, Friend, FriendGroup, CourseLock, ManualLink } from "./FFCS/types";
import { DAYS, COLORS, typeLabels, typeColors, defaultColor } from "./FFCS/constants";
import { isCourseFullyAdded } from "./FFCS/utils";
import { exportTimetableIcal } from "@/lib/exportIcal";





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
  const groups = new Map<string, AddedCourse & { ids: string[] }>();
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
      
      g.credits = String(parseFloat(g.credits || "0") + parseFloat(c.credits || "0"));
    } else {
      groups.set(c.code, { ...c, ids: [c.id], faculty: c.faculty, venue: c.venue, type: c.type, slots: [...c.slots] });
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

const calculatePairwiseSocialScore = (myCourses: AddedCourse[], friendCourses: AddedCourse[]): { percentage: number, actualScore: number, maxScore: number } => {
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
      const byFac = new Map<string, ParsedCourse[]>();
      coursesList.forEach(c => {
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
          
          // --- MANUAL LINKER OVERRIDE ---
          const manualMatches: { tIdx: number, lIdx: number }[] = [];
          const manualUsedLabs = new Set<number>();
          const manualUsedTheories = new Set<number>();

          for (let i = 0; i < theorySlots.length; i++) {
            const t = theorySlots[i];
            if (t.LINK_ID) {
              for (let j = 0; j < labSlots.length; j++) {
                if (manualUsedLabs.has(j)) continue;
                const l = labSlots[j];
                if (l.LINK_ID === t.LINK_ID) {
                  manualMatches.push({ tIdx: i, lIdx: j });
                  manualUsedLabs.add(j);
                  manualUsedTheories.add(i);
                  break; // Found the manual pair
                }
              }
            }
          }

          const backtrack = (tIdx: number, currentMatch: { tIdx: number, lIdx: number }[], usedLabs: Set<number>) => {
            if (currentMatch.length > bestMatch.length) {
              bestMatch = [...currentMatch];
            }
            if (tIdx >= theorySlots.length) return;

            // Skip manually paired theory
            if (manualUsedTheories.has(tIdx)) {
              backtrack(tIdx + 1, currentMatch, usedLabs);
              return;
            }

            const t = theorySlots[tIdx];

            for (let j = 0; j < labSlots.length; j++) {
              if (usedLabs.has(j) || manualUsedLabs.has(j)) continue;
              const l = labSlots[j];

              // Skip manually linked labs that weren't matched above
              if (l.LINK_ID) continue;

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

          bestMatch = [...manualMatches, ...bestMatch];

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
  const isMidnight = currentTheme === "midnight";
  const isDark = currentTheme === "dark" || isMidnight;
  const themeBgColor = isMidnight ? "#020617" : isDark ? "#0f172a" : "#ffffff";
  const themeTextColor = isDark ? "#ffffff" : "#000000";
  const themeHtmlClass = isMidnight ? "dark midnight" : isDark ? "dark" : "light";

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
  const [selectedFriendTimetablesData, setSelectedFriendTimetablesData] = useState<{name: string, timetables: TimetableState[], currentIndex: number} | null>(null);
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState(false);
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>([]);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
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
            FACULTY: String(cleanRow.FACULTY || "").trim()
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
    const map = new Map<string, { title: string; types: string[] }>();
    masterCourses.forEach(c => {
      const existing = map.get(c.CODE);
      const cTypes = c.TYPE.trim().toUpperCase().split("+").map(t => t.trim());
      if (existing) {
        cTypes.forEach(cType => {
          if (cType && !existing.types.includes(cType)) {
            existing.types.push(cType);
          }
        });
        if (c.TITLE.includes("[Theory + Lab]") || c.TITLE.includes("[Embedded")) {
          existing.title = c.TITLE;
        }
      } else {
        map.set(c.CODE, { title: c.TITLE, types: cTypes.filter(Boolean) });
      }
    });
    return Array.from(map.entries()).map(([code, { title, types }]) => ({ code, title, types })).sort((a, b) => a.code.localeCompare(b.code));
  }, [masterCourses]);

  const uniqueCourseCodes = useMemo(() => {
    return uniqueCourses;
  }, [uniqueCourses]);

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
          const dashDetails: { fromClass: string; toClass: string; fromTime: string; toTime: string; day: string }[] = [];
          const gapDetails: { day: string; startMin: number; endMin: number; durationMins: number }[] = [];

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
              
              if (gap > 0) {
                dayGaps += gap;
                gapDetails.push({
                  day: day.id,
                  startMin: prev.endMins,
                  endMin: curr.startMins,
                  durationMins: gap
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
                    day: day.name
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

  const downloadImage = async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    
    const targetElement = captureRef.current;
    const originalStyle = targetElement.style.cssText;
    
    // Temporarily remove constraints to allow full capture
    const tableContainers = targetElement.querySelectorAll('.overflow-x-auto');
    tableContainers.forEach(container => {
      container.classList.remove('overflow-x-auto');
    });

    // Force the container to expand to fit its largest child, and make it flex
    // so that its children naturally stretch to that maximum width (preventing right-side cutoffs on backgrounds/borders)
    targetElement.classList.add('flex', 'flex-col', 'w-max', 'min-w-full');

    try {
      // Yield to the browser to ensure layout paints the new widths before we measure
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const scrollWidth = targetElement.scrollWidth;
      const scrollHeight = targetElement.scrollHeight;
      
      // Calculate scale to fit within viewport to bypass browser's SVG foreignObject clipping bug
      const viewportWidth = window.innerWidth;
      const safeWidth = viewportWidth * 0.9; // 90% of viewport
      const scale = scrollWidth > safeWidth ? safeWidth / scrollWidth : 1;

      // Use html-to-image as html2canvas cannot parse modern oklch colors used by tailwind
      const dataUrl = await htmlToImage.toJpeg(targetElement, { 
        quality: 0.95,
        backgroundColor: themeBgColor,
        // Multiply by inverse of scale to restore original size, then double for Retina quality
        pixelRatio: (1 / scale) * 2,
        width: scrollWidth * scale,
        height: scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
          padding: '20px',
          margin: '0',
          maxWidth: 'none'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${activeTimetable.name.replace(/\\s+/g, '_')}_FFCS.jpg`;
      link.href = dataUrl;
      link.click();
      setSuccessMsg("Timetable downloaded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to download timetable image.");
    } finally {
      // Cleanup styles and classes
      targetElement.style.cssText = originalStyle;
      targetElement.classList.remove('flex', 'flex-col', 'w-max', 'min-w-full');
      tableContainers.forEach(container => {
        container.classList.add('overflow-x-auto');
      });
      setIsDownloading(false);
    }
  };

  const downloadPDF = async () => {
    if (!pdfCaptureRef.current) return;
    setIsDownloading(true);
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError("Please allow popups to export as PDF.");
        setIsDownloading(false);
        return;
      }

      // Get all styles from the current document so Tailwind works in the popup
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      const htmlContent = `
        <!DOCTYPE html>
        <html class="${themeHtmlClass}">
          <head>
            <title>${activeTimetable.name} - FFCS</title>
            ${styles}
            <style>
              body { 
                margin: 0; 
                background-color: ${themeBgColor}; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              @page {
                size: landscape;
                margin: 10mm;
              }
            </style>
          </head>
          <body>
            <div style="background-color: ${themeBgColor}; color: ${themeTextColor}; padding: 40px; width: 100%; box-sizing: border-box;">
              ${pdfCaptureRef.current.innerHTML}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setSuccessMsg("PDF print dialog opened!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

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
      color: COLORS[courses.length % COLORS.length]
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
      <div className={`mb-8 rounded-xl border border-border shadow-2xl bg-background backdrop-blur-md ${customCourses && !fullSize ? 'scale-[0.85] origin-top-left -mb-10' : ''} ${fullSize ? '' : 'overflow-x-auto'}`}>
        <div className="p-4 bg-muted/80 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            Unified Schedule
          </h3>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm"></div>Theory (Top)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm border-dashed"></div>Lab (Bottom)</div>
          </div>
        </div>
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
                  <td className="p-3 border-r border-border font-semibold text-slate-200 text-center bg-background/95 backdrop-blur-md sticky left-0 z-20">
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

  return (
    <div data-prevent-swipe="true" className={`w-full space-y-6 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-950 p-4 md:p-8 overflow-y-auto' : ''}`}>
      
      {/* Top Banner / Upload Area */}
      <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MapIcon className="text-blue-400 w-6 h-6" /> FFCS Planner
              <button 
                onClick={() => setIsGuideModalOpen(true)}
                className="ml-2 text-muted-foreground hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-500/10"
                title="How does this work?"
              >
                <HelpCircle className="w-5 h-5" />
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
          <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
            <h2 className="text-lg font-bold text-foreground mb-4">Timetable Manager</h2>
            <div className="space-y-3">
              {/* --- DESKTOP TOOLBAR (lg and up) --- */}
              <div className="hidden lg:flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <select 
                    value={activeTimetableId} 
                    onChange={e => setActiveTimetableId(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    {timetables.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.courses.length} courses)</option>
                    ))}
                  </select>

                  <div className="flex items-center justify-center bg-muted/30 rounded-xl border border-border p-1 shrink-0">
                    <button title="New Timetable" onClick={createNewTimetable} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                    <button title="Duplicate Timetable" onClick={duplicateTimetable} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Copy className="w-4 h-4" /></button>
                    <button title="Export to Calendar (iCal)" onClick={() => exportTimetableIcal(activeTimetable, getTimetableSchema(), new Date().toISOString().split('T')[0], new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0])} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                    <button title="Rename Timetable" onClick={() => { setEditNameValue(activeTimetable.name); setIsEditingName(true); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button title="Delete Timetable" onClick={() => deleteTimetable(activeTimetableId)} className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-muted/30 rounded-xl border border-border p-1 w-full justify-between">
                    <div className="flex items-center gap-1">
                      <button title="Export Config" onClick={exportTimetables} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Save className="w-3.5 h-3.5" /> <span>Export</span></button>
                      <label title="Import Config" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"><input type="file" accept=".json" onChange={importTimetables} className="hidden" /><Upload className="w-3.5 h-3.5" /> <span>Import</span></label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button title="Friends" onClick={() => setIsFriendsManagerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-pink-500 hover:bg-pink-500/10 rounded-lg transition-colors"><Users className="w-3.5 h-3.5" /> <span>Friends</span></button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setIsCourseLockOpen(true)}
                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-sm font-medium py-3 rounded-xl border border-purple-500/20 transition-colors flex items-center justify-center gap-2 relative"
                  >
                    <Lock className="w-4 h-4" /> Target Courses
                    {courseLocks.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-background">
                        {courseLocks.length}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => setIsGeneratorOpen(true)}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-sm font-medium py-3 rounded-xl border border-amber-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" /> Auto-Generate
                  </button>
                </div>
              </div>

              {/* --- MOBILE TOOLBAR (below lg) --- */}
              <div className="lg:hidden flex flex-col gap-3">
                <select 
                  value={activeTimetableId} 
                  onChange={e => setActiveTimetableId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  {timetables.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.courses.length} courses)</option>
                  ))}
                </select>
                
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={createNewTimetable} className="bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> New
                  </button>
                  <button onClick={duplicateTimetable} className="bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1">
                    <Copy className="w-3 h-3" /> Duplicate
                  </button>
                  <button onClick={() => { setEditNameValue(activeTimetable.name); setIsEditingName(true); }} className="bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1">
                    <Edit2 className="w-3 h-3" /> Rename
                  </button>
                  <button onClick={() => deleteTimetable(activeTimetableId)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-2 rounded-lg border border-red-500/20 transition-colors flex items-center justify-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportTimetables} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium py-2 rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-1">
                    <Save className="w-3 h-3" /> Export Config
                  </button>
                  <label className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium py-2 rounded-lg border border-indigo-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer relative overflow-hidden">
                    <input type="file" accept=".json" onChange={importTimetables} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="w-3 h-3" /> Import Config
                  </label>
                  <button onClick={() => setIsFriendsManagerOpen(true)} className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 text-xs font-medium py-2 rounded-lg border border-pink-500/20 transition-colors flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" /> Friends
                  </button>
                  <button onClick={() => setIsCourseLockOpen(true)} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-xs font-medium py-2 rounded-lg border border-purple-500/20 transition-colors flex items-center justify-center gap-1 relative">
                    <Lock className="w-3 h-3" /> Target Courses
                    {courseLocks.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {courseLocks.length}
                      </span>
                    )}
                  </button>
                </div>

                <button onClick={() => setIsGeneratorOpen(true)} className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-sm font-medium py-3 rounded-xl border border-amber-500/20 transition-colors flex items-center justify-center gap-2">
                  <Wand2 className="w-4 h-4" /> Auto-Generate
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
            </div>
          </div>

          {/* Course Selector */}
          <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <PlusCircle className="text-blue-400 w-5 h-5" /> Course Selector
            </h2>
            
            {!masterCourses.length ? (
              <div className="bg-background border border-border p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-sm">Please upload a master slots file first.</p>
              </div>
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
                        <option value="morning">Morning Theory</option>
                        <option value="evening">Evening Theory</option>
                        <option value="morning_lab">Morning Lab</option>
                        <option value="evening_lab">Evening Lab</option>
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
                onClick={downloadPDF}
                disabled={isDownloading || courses.length === 0}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
              >
                <Download className="w-4 h-4" /> 
                {isDownloading ? "Exporting..." : "Download PDF"}
              </button>
              <button 
                onClick={downloadImage}
                disabled={isDownloading || courses.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Download className="w-4 h-4" /> 
                {isDownloading ? "Capturing..." : "Download JPG"}
              </button>
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
              <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-x-auto">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 min-w-[600px]">
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
                
                <div className="min-w-[600px]">
                  <table className="w-full text-left">
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
                              <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                              <div>
                                <p className="text-foreground font-semibold text-sm">{c.code}</p>
                                <p className="text-muted-foreground text-xs max-w-xs">{c.title}</p>
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
                          <div className={`h-1/2 w-full border-b border-border/50 flex flex-col items-center justify-center p-0.5 ${tCourse ? 'bg-blue-500/20 text-blue-300' : 'bg-transparent text-muted-foreground'}`}>
                            {tCourse ? (
                              <>
                                <span className="font-bold text-[10px] leading-tight">{tCourse.code}</span>
                                <span className="text-[8px] opacity-75">{tSlot}</span>
                              </>
                            ) : (
                              <span className="text-[9px]">{tSlot || '-'}</span>
                            )}
                          </div>
                          
                          {/* Lab Half */}
                          <div className={`h-1/2 w-full flex flex-col items-center justify-center p-0.5 ${lCourse ? 'bg-purple-500/20 text-purple-300' : 'bg-transparent text-muted-foreground'}`}>
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
                    <td className="py-3 px-4 font-medium">{c.code}</td>
                    <td className="py-3 px-4">{c.title}</td>
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
      {isCourseLockOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Lock className="text-purple-500 w-6 h-6" /> Target Courses
              </h2>
              <button onClick={() => setIsCourseLockOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
            
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
              <p className="text-sm text-muted-foreground">
                Select the courses you intend to take. Both the manual planner and auto-generator will filter results based on your target courses.
              </p>

              {courseLocks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {courseLocks.map(lock => (
                    <div key={lock.code} className="bg-purple-500/10 border border-purple-500/30 text-purple-500 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium">
                      <span>{lock.code}</span>
                      <button 
                        onClick={() => setCourseLocks(prev => prev.filter(p => p.code !== lock.code))}
                        className="hover:bg-purple-500/20 p-0.5 rounded-full transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search master course list..."
                  value={generatorCourseSearchQuery}
                  onChange={e => setGeneratorCourseSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                {uniqueCourseCodes.filter(c => 
                  c.code.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase()) || 
                  c.title.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No courses found matching "{generatorCourseSearchQuery}"
                  </div>
                )}
                {uniqueCourseCodes.filter(c => 
                  c.code.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase()) || 
                  c.title.toLowerCase().includes(generatorCourseSearchQuery.toLowerCase())
                ).slice(0, 50).map(c => {
                  const sel = courseLocks.find(s => s.code === c.code);
                  const isSelected = !!sel;
                  
                  const courseOpts = masterCourses.filter(mc => mc.CODE === c.code);
                  const uniqueSlots = Array.from(new Set(courseOpts.map(opt => {
                    return opt.SLOT.split('+').map(s => s.trim());
                  }).flat())).sort();

                  return (
                    <div key={c.code} className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isSelected ? 'bg-muted/30 border-purple-500/50 shadow-sm' : 'bg-transparent border-transparent hover:border-border hover:bg-muted/50'}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="mt-1 rounded bg-background border-border text-purple-500 focus:ring-purple-500/30"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setCourseLocks(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [] }]);
                            else setCourseLocks(prev => prev.filter(s => s.code !== c.code));
                          }}
                        />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-foreground">{c.code}</span>
                             {renderTypeChips(c.types || [], 'sm')}
                          </div>
                          <span className="text-xs text-muted-foreground line-clamp-2">{c.title}</span>
                        </div>
                      </label>

                      {isSelected && uniqueSlots.length > 1 && (
                        <div className="pl-8 mt-2">
                          <div className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Filter Slots (Optional)</div>
                          <div className="flex flex-wrap gap-2 pr-1">
                            {uniqueSlots.map(slot => {
                              const isOffChecked = sel.allowedSlots.includes(slot);
                              return (
                                <label key={slot} className={`flex items-center gap-2 cursor-pointer border rounded-md p-1.5 px-3 transition-colors ${isOffChecked ? 'bg-purple-500/10 border-purple-500/30 text-purple-600' : 'hover:bg-muted/50 text-muted-foreground border-border/50'}`}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded w-3.5 h-3.5 border-border text-purple-500 focus:ring-purple-500/30"
                                    checked={isOffChecked}
                                    onChange={(e) => {
                                      setCourseLocks(prev => prev.map(p => {
                                        if (p.code !== c.code) return p;
                                        if (e.target.checked) return { ...p, allowedSlots: [...p.allowedSlots, slot] };
                                        return { ...p, allowedSlots: p.allowedSlots.filter(s => s !== slot) };
                                      }));
                                    }}
                                  />
                                  <span className="text-xs font-bold">{slot}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">
                <span className="text-purple-500 font-bold">{courseLocks.length}</span> courses selected
              </span>
              <button 
                onClick={() => setIsCourseLockOpen(false)}
                className="bg-foreground text-background px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-foreground/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isFriendsManagerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
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

      {isGeneratorOpen && (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 border-b border-border flex flex-wrap justify-between items-center gap-4 bg-muted/30 backdrop-blur-md sticky top-0 z-10">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-center lg:justify-start">
              <button 
                onClick={() => setIsGeneratorOpen(false)} 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 py-1.5 px-3 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
                <span className="font-medium text-sm">Back</span>
              </button>
              <div className="hidden sm:block w-px h-6 bg-border mx-2"></div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
                <Wand2 className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" /> Advanced Timetable Generator
              </h2>
            </div>
            <button 
              onClick={generateTimetables}
              disabled={isGenerating || courseLocks.length === 0}
              className="w-full lg:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {isGenerating ? "Processing Millions of Combinations..." : "Generate Timetables"}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border-b border-red-500/20 text-red-500 px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium z-10">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-10 flex justify-center bg-muted/5">
            {generatorPreviewTimetable ? (
              <>
              <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-background p-6 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setGeneratorPreviewTimetable(null)} 
                      className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Generator
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        Preview: {generatorPreviewTimetable.name}
                        {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 && (
                          <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
                            {generatorPreviewTimetable.variants.length} Faculty Variants
                          </span>
                        )}
                      </h2>
                      {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 ? (
                        <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1.5 max-w-xl">
                          <p>These variants share the <strong>exact same physical time layout</strong> (same free time, same schedule), but use different combinations of <strong>faculties</strong>.</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold text-foreground uppercase tracking-wider">Select Variant:</span>
                            <button 
                              onClick={() => setIsVariantSearchOpen(true)}
                              className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground font-medium cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 flex items-center gap-2 shadow-sm"
                            >
                              <Search className="w-4 h-4" /> Change Variant
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Review this timetable before saving.</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setTimetables(prev => [...prev, generatorPreviewTimetable]);
                      setActiveTimetableId(generatorPreviewTimetable.id);
                      setStagedTimetables([]);
                      setSelectedStagedIds(new Set());
                      setGeneratorPreviewTimetable(null);
                      setIsGeneratorOpen(false);
                      setSuccessMsg(`Successfully saved and switched to ${generatorPreviewTimetable.name}`);
                    }}
                    className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-lg"
                  >
                    <Save className="w-4 h-4" /> Save & Use This
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background rounded-2xl border border-border p-4 flex flex-col justify-center items-center text-center shadow-sm">
                    <span className="text-2xl font-black text-foreground">{generatorPreviewTimetable.metrics?.halfDays}</span>
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mt-1">Free Half-Days</span>
                  </div>
                  
                  <div 
                    className="bg-background rounded-2xl border border-border p-4 flex flex-col justify-center items-center text-center shadow-sm relative group cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedGapDetails(generatorPreviewTimetable.metrics?.gapDetails || null)}
                  >
                    <span className="text-2xl font-black text-foreground">{generatorPreviewTimetable.metrics?.gaps}h</span>
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mt-1">Total Gaps</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max min-w-[200px] bg-slate-900 text-white text-[10px] p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {Object.entries(generatorPreviewTimetable.metrics?.gapsPerDay || {}).map(([day, gap]) => (
                        <div key={day} className="flex justify-between gap-3">
                          <span className="font-bold text-slate-400 uppercase">{day}</span>
                          <span>{gap}h</span>
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
                    className="flex flex-col items-center justify-center p-3 bg-card border border-border/50 rounded-xl shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setIsSocialMatrixOpen(true)}
                  >
                    <span className="text-3xl font-black text-pink-500">{generatorPreviewTimetable.metrics?.socialScore}%</span>
                    <span className="text-xs uppercase font-bold text-pink-500/80 tracking-wider mt-1">Social Score</span>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-6 pb-20">
                  {renderUnifiedGrid()}

                  {courses.length > 0 && (
                    <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-x-auto">
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 min-w-[600px]">
                        <h2 className="text-xl font-bold text-foreground flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          Selected Courses
                          <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                            Total Credits: {getGroupedCourses(courses).reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}
                          </span>
                        </h2>
                      </div>
                      
                      <div className="min-w-[600px]">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
                              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {getGroupedCourses(courses).map(c => (
                              <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                                    <div>
                                      <p className="text-foreground font-semibold text-sm">{c.code}</p>
                                      <p className="text-muted-foreground text-xs max-w-xs">{c.title}</p>
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>



              {/* Dash Details Modal */}
              {selectedDashDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="text-xl">🏃</span> Block Dash Details
                      </h3>
                      <button 
                        onClick={() => setSelectedDashDetails(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto">
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
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">From</span>
                                  <span className="text-sm font-medium text-foreground truncate block" title={dash.fromClass}>{dash.fromClass}</span>
                                </div>
                                <div className="text-red-500/50">→</div>
                                <div className="flex-1 flex flex-col text-right overflow-hidden">
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">To</span>
                                  <span className="text-sm font-medium text-foreground truncate block" title={dash.toClass}>{dash.toClass}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Gap Details Modal */}
              {selectedGapDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="text-xl">⏳</span> Gap Hours Detail
                      </h3>
                      <button 
                        onClick={() => setSelectedGapDetails(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto">
                      <p className="text-sm text-muted-foreground mb-4">
                        We have highlighted the empty gap slots in <span className="text-yellow-500 font-bold">yellow</span> on the unified schedule grid behind this modal!
                      </p>
                      {selectedGapDetails.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No gaps in this timetable. Perfect!</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {selectedGapDetails.map((gap, i) => (
                            <div key={i} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex justify-between items-center">
                              <span className="font-bold text-yellow-500/80 uppercase">{gap.day}</span>
                              <span className="text-sm font-semibold text-foreground">Gap of <span className="text-yellow-500">{gap.durationMins}</span> mins</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </>
            ) : isCompareModalOpen ? (
              <div className="w-full flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 px-4 sm:px-6 pt-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Compare Options</h2>
                    <p className="text-xs text-muted-foreground mt-1">Comparing {selectedTimetablesToCompare.length} timetables side-by-side</p>
                  </div>
                  <button 
                    onClick={() => setIsCompareModalOpen(false)} 
                    className="p-2 bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors"
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
                        <div key={id} className="flex flex-col bg-background border border-border rounded-2xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-center">
                            <h3 className="font-bold text-lg text-foreground">{tt.name}</h3>
                            <div className="flex gap-2">
                              <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">{tt.metrics?.halfDays} Half Days</span>
                              <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">{tt.metrics?.gaps}h Gaps</span>
                            </div>
                          </div>
                          <div className="p-4 overflow-x-auto custom-scrollbar">
                            {renderUnifiedGrid(tt.courses)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : stagedTimetables.length > 0 ? (
              <div className="w-full max-w-6xl flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-background p-6 rounded-2xl border border-border shadow-sm">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Review Timetables</h2>
                    <p className="text-muted-foreground mt-1">Select the ones you like, or <b className="text-foreground">double-click</b> any card to instantly save and view it.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={() => setStagedTimetables([])}
                      className="px-4 py-2 text-sm font-bold bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl transition-colors"
                    >
                      Discard All
                    </button>
                    <button 
                      disabled={selectedStagedIds.size === 0}
                      onClick={() => {
                        const selected: TimetableState[] = [];
                        stagedTimetables.forEach(t => {
                          if (t.variants && t.variants.length > 1) {
                            t.variants.forEach(v => {
                              if (selectedStagedIds.has(v.id)) selected.push(v);
                            });
                          } else if (selectedStagedIds.has(t.id)) {
                            selected.push(t);
                          }
                        });
                        setTimetables(prev => [...prev, ...selected]);
                        if (selected.length > 0) setActiveTimetableId(selected[0].id);
                        setStagedTimetables([]);
                        setSelectedStagedIds(new Set());
                        setIsGeneratorOpen(false);
                      }}
                      className="px-6 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl shadow-lg transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Selected ({selectedStagedIds.size})
                    </button>
                  </div>
                </div>

                {/* Grid of Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {stagedTimetables.map(tt => (
                    <div 
                      key={tt.id} 
                      className={`relative flex flex-col bg-background rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${selectedStagedIds.has(tt.id) ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-border hover:border-amber-500/50 hover:shadow-lg'}`}
                      onClick={() => {
                        const newSet = new Set(selectedStagedIds);
                        if (newSet.has(tt.id)) {
                          newSet.delete(tt.id);
                          if (tt.variants) tt.variants.forEach(v => newSet.delete(v.id));
                        } else {
                          newSet.add(tt.id);
                          if (tt.variants) tt.variants.forEach(v => newSet.add(v.id));
                        }
                        setSelectedStagedIds(newSet);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        setGeneratorPreviewTimetable(tt);
                      }}
                    >
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg text-foreground">{tt.name}</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTimetablesToCompare(prev => {
                                  if (prev.includes(tt.id)) return prev.filter(id => id !== tt.id);
                                  if (prev.length >= 3) return prev; // max 3
                                  return [...prev, tt.id];
                                });
                              }}
                              className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-colors ${selectedTimetablesToCompare.includes(tt.id) ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent text-muted-foreground border-border hover:border-purple-500/50'}`}
                            >
                              Compare
                            </button>
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedStagedIds.has(tt.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/30'}`}>
                              {selectedStagedIds.has(tt.id) && <Check className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 flex-1 content-start">
                          <div className="bg-muted/30 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-foreground">{tt.metrics?.halfDays}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Free Half-Days</span>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3 flex flex-col items-center justify-center text-center group relative">
                            <span className="text-2xl font-black text-foreground">{tt.metrics?.gaps}h</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Gaps</span>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl grid grid-cols-2 gap-x-3 gap-y-1">
                              {Object.entries(tt.metrics?.gapsPerDay || {}).map(([day, gap]) => (
                                <div key={day} className="flex justify-between gap-3">
                                  <span className="font-bold text-slate-400 uppercase">{day}</span>
                                  <span>{gap}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {tt.metrics?.isLongWeekend && (
                          <div className="bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 flex items-center justify-center gap-1.5">
                            🎉 Long Weekend!
                          </div>
                        )}
                        {(tt.metrics?.buildingDashes ?? 0) > 0 && (
                          <div className="bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 flex items-center justify-center gap-1.5">
                            🏃 {tt.metrics?.buildingDashes} Block Dash{(tt.metrics?.buildingDashes ?? 0) > 1 ? 'es' : ''}
                          </div>
                        )}

                        {generatorMaximizeFreeTimeFriends.length > 0 && (
                          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-auto mb-3">
                            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate" title={tt.metrics?.bestFriendMatches.join(', ')}>
                              Matches best with: <span className="font-medium text-foreground">{tt.metrics?.bestFriendMatches.join(', ') || 'None'}</span>
                            </div>
                          </div>
                        )}

                        {tt.variants && tt.variants.length > 1 && (
                          <div className="mt-auto pt-4 border-t border-border/50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Faculty Variants</span>
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{tt.variants.length} available</span>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                              {tt.variants.map((v, vIdx) => {
                                const isSelected = selectedStagedIds.has(v.id);
                                return (
                                  <div 
                                    key={v.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newSet = new Set(selectedStagedIds);
                                      if (isSelected) newSet.delete(v.id);
                                      else newSet.add(v.id);
                                      
                                      if (isSelected && newSet.has(tt.id)) newSet.delete(tt.id);
                                      if (!isSelected && !newSet.has(tt.id)) newSet.add(tt.id);
                                      
                                      setSelectedStagedIds(newSet);
                                    }}
                                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${isSelected ? 'bg-amber-500/10 border-amber-500/50 text-foreground' : 'bg-background border-border text-muted-foreground hover:border-amber-500/30'}`}
                                  >
                                    <span className="font-medium">Variant {vIdx + 1}</span>
                                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/30'}`}>
                                      {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating Compare Bar */}
                {selectedTimetablesToCompare.length > 0 && (
                  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[250] bg-background border-2 border-purple-500 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <span className="text-sm font-semibold text-foreground">
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
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
            <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Left Column: Courses Selection */}
              <div className="flex flex-col gap-6">
                <div className="bg-background rounded-2xl border border-border p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-foreground flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span> 
                        Target Courses
                      </h3>
                      <p className="text-sm text-muted-foreground">Select the courses you want to take and optionally filter faculties/slots.</p>
                    </div>
                  </div>
                  
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text"
                      placeholder="Search by course code or title..."
                      value={generatorCourseSearchQuery}
                      onChange={e => setGeneratorCourseSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="border border-border rounded-xl max-h-[60vh] overflow-y-auto bg-muted/10 p-3 grid grid-cols-1 gap-2 custom-scrollbar">
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
                      const sel = courseLocks.find(s => s.code === c.code);
                          const isSelected = !!sel;
                          
                          const courseOpts = masterCourses.filter(mc => mc.CODE === c.code);
                          const uniqueOfferings = Array.from(new Map(courseOpts.map(opt => {
                            const id = `${opt.FACULTY}|${opt.SLOT}|${opt.ROOM}`;
                            return [id, { faculty: opt.FACULTY, slot: opt.SLOT, venue: opt.ROOM, id }];
                          })).values()).sort((a, b) => a.faculty.localeCompare(b.faculty));

                          const offeringsByFac = uniqueOfferings.reduce((acc, curr) => {
                            if (!acc[curr.faculty]) acc[curr.faculty] = [];
                            acc[curr.faculty].push(curr);
                            return acc;
                          }, {} as Record<string, typeof uniqueOfferings>);

                          const sortedFacs = Object.keys(offeringsByFac).sort();

                          return (
                            <div key={c.code} className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isSelected ? 'bg-muted/30 border-amber-500/50 shadow-sm' : 'bg-transparent border-transparent hover:border-border hover:bg-muted/50'}`}>
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="mt-1 rounded bg-background border-border text-amber-500 focus:ring-amber-500/30"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setCourseLocks(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [], offerings: [] }]);
                                    else setCourseLocks(prev => prev.filter(s => s.code !== c.code));
                                  }}
                                />
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-base text-foreground">{c.code}</span>
                                     {renderTypeChips(c.types || [], 'sm')}
                                  </div>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{c.title}</span>
                                </div>
                              </label>

                              {isSelected && uniqueOfferings.length > 1 && (
                                <div className="pl-8 mt-2">
                                  <div className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Filter Offerings (Optional)</div>
                                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 bg-background/50 border border-border/50 rounded-lg p-3">
                                    {sortedFacs.map(fac => (
                                      <div key={fac} className="flex flex-col gap-1.5">
                                        <div className="text-xs font-semibold text-foreground/90 pb-1 border-b border-border/50">{fac}</div>
                                        {offeringsByFac[fac].map(offering => {
                                          const isOffChecked = sel.offerings?.includes(offering.id) || false;
                                          return (
                                            <label key={offering.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                                              <input 
                                                type="checkbox" 
                                                className="mt-0.5 rounded w-3.5 h-3.5 border-border text-amber-500 focus:ring-amber-500/30"
                                                checked={isOffChecked}
                                                onChange={(e) => {
                                                  setCourseLocks(prev => prev.map(p => {
                                                    if (p.code !== c.code) return p;
                                                    if (e.target.checked) return { ...p, offerings: [...(p.offerings || []), offering.id] };
                                                    return { ...p, offerings: (p.offerings || []).filter(o => o !== offering.id) };
                                                  }));
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <span className={`text-[11px] font-medium ${isOffChecked ? 'text-amber-500' : 'text-foreground/80'}`}>{offering.slot}</span>
                                                <span className="text-[10px] text-muted-foreground">{offering.venue}</span>
                                              </div>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                  {sel.offerings && sel.offerings.length > 0 && (
                                    <div className="text-xs text-amber-500 mt-2 font-medium">
                                      ✓ Filtering by {sel.offerings.length} selected offering{sel.offerings.length === 1 ? '' : 's'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {uniqueCourseCodes.length === 0 && (
                          <div className="col-span-full p-10 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                            Please upload a master course list first.
                          </div>
                        )}
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground bg-amber-500/10 text-amber-500/90 py-2 px-4 rounded-xl w-max border border-amber-500/20 font-bold">
                    Selected: {courseLocks.length} target courses
                  </div>
                </div>
              </div>

              {/* Right Column: Preferences & Social */}
              <div className="flex flex-col gap-6">
                
                {/* General Preferences */}
                <div className="bg-background rounded-2xl border border-border p-6 shadow-sm">
                  <h3 className="font-semibold text-lg mb-4 text-foreground flex items-center gap-2">
                    <span className="bg-blue-500/10 text-blue-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span> 
                    Preferences
                  </h3>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5">Sort Timetables By</label>
                        <select 
                          value={generatorSortBy} 
                          onChange={e => setGeneratorSortBy(e.target.value as any)}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                        >
                          <option value="balanced">Balanced (All Metrics)</option>
                          <option value="compactness">Max Compactness (Fewer Gaps)</option>
                          <option value="halfdays">Max Free Half-Days</option>
                          <option value="social">Max Social Score</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-2">
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
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-2">
                          Min Start Time
                        </label>
                        <input 
                          type="time"
                          value={generatorMinStartTime}
                          onChange={(e) => setGeneratorMinStartTime(e.target.value)}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-2">
                          Max End Time
                        </label>
                        <input 
                          type="time"
                          value={generatorMaxEndTime}
                          onChange={(e) => setGeneratorMaxEndTime(e.target.value)}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Time Preference</label>
                      <select 
                        value={generatorPreference} 
                        onChange={e => setGeneratorPreference(e.target.value as any)}
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                      >
                        <option value="none">No Preference (Any combinations)</option>
                        <option value="morning">Morning Theory Preferred</option>
                        <option value="evening">Evening Theory Preferred</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3 cursor-pointer group bg-muted/20 p-3 rounded-xl border border-transparent hover:border-border transition-all">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={generatorUniqueFaculties}
                            onChange={e => setGeneratorUniqueFaculties(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">Master Timetables <span className="text-muted-foreground font-normal">(Unique Faculties)</span></span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group bg-muted/20 p-3 rounded-xl border border-transparent hover:border-border transition-all">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={generatorNoLimit}
                            onChange={e => setGeneratorNoLimit(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">Remove 50 Timetables Limit</span>
                      </label>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                        Blocked Slots Constraint
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </label>
                      <div className="bg-muted/10 border border-border p-4 rounded-xl">
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
                                    : 'bg-background text-foreground/70 border-border hover:bg-muted hover:text-foreground'
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
                <div className="bg-background rounded-2xl border border-border p-6 shadow-sm">
                  <h3 className="font-semibold text-lg mb-4 text-foreground flex items-center gap-2">
                    <span className="bg-pink-500/10 text-pink-500 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span> 
                    Social Preferences
                  </h3>
                  
                  {friends.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded-xl border border-dashed border-border text-center">
                      Add friends from the dashboard to unlock social generation features.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <label className="flex items-start gap-3 cursor-pointer group bg-muted/20 p-4 rounded-xl border border-transparent hover:border-pink-500/30 transition-all">
                        <div className="relative flex items-center mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={generatorSyncFriendsClasses}
                            onChange={e => setGeneratorSyncFriendsClasses(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">Auto-Sync Shared Classes</span>
                          <span className="text-xs text-muted-foreground mt-1">If your friends are taking a course you select, force the exact same slot and faculty.</span>
                        </div>
                      </label>

                      <div>
                        <label className="text-sm font-bold text-foreground block mb-2">Maximize Shared Free Time</label>
                        <p className="text-xs text-muted-foreground mb-3">Timetables will be sorted to show the ones where you and these friends have the most mutual free time.</p>
                        <div className="flex flex-col gap-2">
                          {friends.map(f => {
                            const isChecked = generatorMaximizeFreeTimeFriends.includes(f.id);
                            return (
                              <label key={f.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-pink-500/10 border-pink-500/30' : 'bg-muted/10 border-border hover:bg-muted/30'}`}>
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border text-pink-500 focus:ring-pink-500/30 bg-background"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) setGeneratorMaximizeFreeTimeFriends(prev => [...prev, f.id]);
                                    else setGeneratorMaximizeFreeTimeFriends(prev => prev.filter(id => id !== f.id));
                                  }}
                                />
                                <span className={`text-sm ${isChecked ? 'font-bold text-pink-500' : 'text-foreground'}`}>{f.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Friend Timetable View Modal */}
      {selectedFriendTimetablesData && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" /> {selectedFriendTimetablesData.name}'s Timetable {selectedFriendTimetablesData.timetables.length > 1 ? `(${selectedFriendTimetablesData.currentIndex + 1}/${selectedFriendTimetablesData.timetables.length})` : ''}
                </h3>
                {selectedFriendTimetablesData.timetables.length > 1 && (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedFriendTimetablesData(prev => prev ? {...prev, currentIndex: (prev.currentIndex - 1 + prev.timetables.length) % prev.timetables.length} : null)}
                      className="p-1 hover:bg-background rounded-md transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold px-2">Cycle Options</span>
                    <button
                      onClick={() => setSelectedFriendTimetablesData(prev => prev ? {...prev, currentIndex: (prev.currentIndex + 1) % prev.timetables.length} : null)}
                      className="p-1 hover:bg-background rounded-md transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedFriendTimetablesData(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto bg-muted/5 custom-scrollbar relative">
              <div className="flex flex-col gap-6 w-max min-w-full pb-4">
                {renderUnifiedGrid(selectedFriendTimetablesData.timetables[selectedFriendTimetablesData.currentIndex].courses as AddedCourse[], true)}

                <div className="bg-background border border-border rounded-xl shadow-sm flex flex-col">
                  <div className="p-4 border-b border-border bg-muted/30 rounded-t-xl">
                    <h3 className="font-bold text-foreground">Course List</h3>
                  </div>
                  <div>
                    <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {getGroupedCourses(selectedFriendTimetablesData.timetables[selectedFriendTimetablesData.currentIndex].courses as AddedCourse[]).map(c => (
                        <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                              <div>
                                <p className="text-foreground font-semibold text-sm">{c.code}</p>
                                <p className="text-muted-foreground text-xs max-w-xs">{c.title}</p>
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
                                <span key={s} className="bg-accent/50 border border-border text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80 max-w-xs">{c.venue}</td>
                          <td className="py-3 px-2 text-sm text-foreground/80">{c.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
      {/* Social Matrix Modal */}
      {isSocialMatrixOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-500" /> Social Score Breakdown
              </h3>
              <button 
                onClick={() => setIsSocialMatrixOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto custom-scrollbar flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">How it works</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
                    The Social Score is a percentage indicating how well your timetable aligns with your friends' timetables.
                    It awards points for <strong className="text-foreground">Shared Classes</strong> (+3 per slot), 
                    <strong className="text-foreground"> Shared Free Half-Days</strong> (+5), and 
                    <strong className="text-foreground"> Mutually Free Slots</strong> (+1), measured against the maximum possible score if you had the exact same timetable.
                  </p>
                </div>
                
                {friends.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">You have no friends imported.</p>
                    <p className="text-sm text-muted-foreground/80 mt-1">Add friends in the Social tab to see the comparison matrix!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border custom-scrollbar">
                    <table className="w-full text-sm text-center border-collapse">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold border-r border-border min-w-[200px] sticky left-0 bg-muted/95 z-20">My Options \ Friends</th>
                          {friends.map(f => (
                            f.timetables?.map((ft, fIdx) => (
                              <th key={`${f.id}-${ft.id}`} className="py-3 px-4 font-semibold whitespace-nowrap border-r border-border/50 last:border-r-0">
                                <div className="flex flex-col items-center gap-1">
                                  <span>{f.name}</span>
                                  <span className="text-xs text-muted-foreground font-normal">{ft.name || `Option ${fIdx + 1}`}</span>
                                </div>
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {Array.from(new Map([...(generatorPreviewTimetable ? [generatorPreviewTimetable] : []), ...timetables, ...stagedTimetables]
                          .filter(t => t && t.courses && t.courses.length > 0)
                          .map(t => [t.id, t])).values())
                          .map((mt, rIdx) => (
                          <tr key={mt.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-4 text-left font-medium border-r border-border whitespace-nowrap sticky left-0 bg-background/95 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              {mt.name || (mt.id === activeTimetableId ? 'Active Timetable' : `Option ${rIdx + 1}`)}
                              {mt.id === activeTimetableId && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Active</span>}
                            </td>
                            {friends.map(f => (
                              f.timetables?.map(ft => {
                                const score = calculatePairwiseSocialScore(mt.courses as AddedCourse[], ft.courses as AddedCourse[]);
                                const pct = score.percentage;
                                let colorClass = "text-muted-foreground";
                                let bgClass = "";
                                if (pct >= 80) { colorClass = "text-emerald-700 dark:text-emerald-400 font-bold"; bgClass = "bg-emerald-500/10"; }
                                else if (pct >= 60) { colorClass = "text-yellow-700 dark:text-yellow-400 font-bold"; bgClass = "bg-yellow-500/10"; }
                                else if (pct >= 40) { colorClass = "text-orange-700 dark:text-orange-400 font-medium"; bgClass = "bg-orange-500/10"; }
                                else if (pct > 0) { colorClass = "text-red-700 dark:text-red-400"; bgClass = "bg-red-500/10"; }
                                
                                return (
                                  <td key={`${mt.id}-${f.id}-${ft.id}`} className={`py-3 px-4 transition-colors group relative border-r border-border/50 last:border-r-0 ${bgClass}`}>
                                    <span className={colorClass}>{pct}%</span>
                                    {/* Tooltip for breakdown */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-foreground text-background text-xs p-3 rounded-lg shadow-xl pointer-events-none z-50">
                                      <div className="font-bold border-b border-background/20 pb-2 mb-2 text-center uppercase tracking-wider text-[10px]">Score Breakdown</div>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-background/80">Actual Score:</span> 
                                        <span className="font-bold">{score.actualScore} pts</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-background/80">Max Potential:</span> 
                                        <span className="font-bold">{score.maxScore} pts</span>
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground"></div>
                                    </div>
                                  </td>
                                );
                              })
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {isGuideModalOpen && <FFCSGuideModal onClose={() => setIsGuideModalOpen(false)} />}

      {/* Course Search Modal */}
      {isCourseSearchOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search by course code or title..."
                  value={courseSearchQuery}
                  onChange={e => setCourseSearchQuery(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${fullyAdded ? 'text-muted-foreground' : 'text-foreground'}`}>{c.code}</span>
                       {renderTypeChips(c.types || [], 'sm')}
                    </div>
                    {fullyAdded ? (
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">Fully Added</span>
                    ) : selectedCourseCode === c.code && (
                      <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">Selected</span>
                    )}
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
                <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl m-2">
                  <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <span className="text-muted-foreground font-medium">No courses found</span>
                  <span className="text-xs text-muted-foreground/70 mt-1">Try a different search term</span>
                </div>
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
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search by slot, faculty, or room..."
                  value={slotSearchQuery}
                  onChange={e => setSlotSearchQuery(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-muted/5">
              {availableSlots.map((row, idx) => ({ row, idx })).filter(({ row }) => {
                if (slotFilter === "all") return true;
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
                <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl m-2">
                  <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <span className="text-muted-foreground font-medium">No slots found</span>
                  <span className="text-xs text-muted-foreground/70 mt-1">Try a different search term or filter</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Variant Search Modal */}
      {isVariantSearchOpen && generatorPreviewTimetable?.variants && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search by faculty name..."
                  value={variantSearchQuery}
                  onChange={e => setVariantSearchQuery(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
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
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
