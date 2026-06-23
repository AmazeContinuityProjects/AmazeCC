import React, { useState, useMemo, useEffect } from 'react';
import { X, Wand2, Info, ChevronDown, Check, Beaker, Play, Lock, Hash, ArrowRight, Search, AlertTriangle, ArrowLeft, Save, Users } from 'lucide-react';
import { TimetableState, CourseLock, Friend, FriendGroup, ParsedCourse, AddedCourse } from '../../types';
import { generateTimetablesAsync } from '../../logic/generator';
import { GLOBAL_CAMPUS, getTimetableSchema, calculatePairwiseSocialScore } from '../../../FFCSTimetableTab';
import { COLORS, DAYS } from '../../constants';
import { TimetableGrid, GapDetail } from '../TimetableGrid';
import { TargetCoursesModal } from './TargetCoursesModal';
import { TimetablePeriod } from '../../types';


export interface AutoGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseLocks: CourseLock[];
  setCourseLocks: React.Dispatch<React.SetStateAction<CourseLock[]>>;
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

export function AutoGeneratorModal({
  isOpen, onClose, courseLocks, setCourseLocks, friends, socialScoreGroupMethod, friendGroups,
  masterCourses, blockedSlots, timetables, setTimetables, setActiveTimetableId,
  error, setError, successMsg, setSuccessMsg, renderTypeChips, getGroupedCourses, generatorDisplayCourses, theoryPeriods, labPeriods, toggleBlockSlot
}: AutoGeneratorModalProps) {
  const [generatorPreference, setGeneratorPreference] = useState<"compact" | "spread" | "morning" | "evening">("compact");
  const [generatorUniqueFaculties, setGeneratorUniqueFaculties] = useState(false);
  const [generatorNoLimit, setGeneratorNoLimit] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stagedTimetables, setStagedTimetables] = useState<TimetableState[]>([]);
  const [generatorMinHalfDays, setGeneratorMinHalfDays] = useState<number>(0);
  const [generatorMinStartTime, setGeneratorMinStartTime] = useState<string>("08:00");
  const [generatorMaxEndTime, setGeneratorMaxEndTime] = useState<string>("19:30");
  const [generatorSortBy, setGeneratorSortBy] = useState<"social" | "halfdays" | "compactness" | "balanced">("balanced");
  const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());
  const [selectedTimetablesToCompare, setSelectedTimetablesToCompare] = useState<string[]>([]);
  const [generatorPreviewTimetable, setGeneratorPreviewTimetable] = useState<TimetableState | null>(null);
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState(false);
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>([]);
  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");
  const [isVariantSearchOpen, setIsVariantSearchOpen] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedDashDetails, setSelectedDashDetails] = useState<NonNullable<TimetableState['metrics']>['dashDetails'] | null>(null);
  const [selectedGapDetails, setSelectedGapDetails] = useState<GapDetail[] | null>(null);
  const [isTargetCoursesModalOpen, setIsTargetCoursesModalOpen] = useState(false);
  const isGeneratorOpen = isOpen;
  const setIsGeneratorOpen = (v: boolean) => { if (!v) onClose(); };
  const courses: AddedCourse[] = []; // Fallback empty active courses for the Compare Modal grid, as it previews staged.

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const getPeriodsForSlot = (slot: string) => {
    const matched: { day: string; startMin: number; endMin: number }[] = [];
    theoryPeriods.forEach(p => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slot)) {
          matched.push({ day, startMin: timeToMinutes(p.start), endMin: timeToMinutes(p.end) });
        }
      });
    });
    labPeriods.forEach(p => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        const slotsInPeriod = (s as string).split('+').map(x => x.trim().toUpperCase());
        if (slotsInPeriod.includes(slot)) {
          matched.push({ day, startMin: timeToMinutes(p.start), endMin: timeToMinutes(p.end) });
        }
      });
    });
    return matched;
  };

  const isMorningSlot = (slot: string) => {
    const periods = getPeriodsForSlot(slot);
    if (periods.length === 0) return true;
    return periods.some(p => p.startMin < 840);
  };

  const isEveningSlot = (slot: string) => {
    const periods = getPeriodsForSlot(slot);
    if (periods.length === 0) return false;
    return periods.some(p => p.startMin >= 840);
  };

  const parse24HourToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

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

  return (
    <>
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
                    <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-x-auto">
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 min-w-[600px]">
                        <h2 className="text-xl font-bold text-foreground flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          Selected Courses
                          <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                            Total Credits: {getGroupedCourses(generatorPreviewTimetable.courses).reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}
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
                            {getGroupedCourses(generatorPreviewTimetable.courses).map((c: any) => (
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
                                    {c.slots.map((s: string) => (
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
                        <span className="text-xl"></span> Block Dash Details
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
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">From {dash.fromBlock}</span>
                                  <span className="text-sm font-medium text-foreground truncate block" title={dash.fromClass}>{dash.fromClass}</span>
                                </div>
                                <div className="text-red-500/50"></div>
                                <div className="flex-1 flex flex-col text-right overflow-hidden">
                                  <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">To {dash.toBlock}</span>
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
                  <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        Gap Hours Detail
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
                                      <div key={i} className="bg-background/50 rounded-lg p-3 border border-yellow-500/10">
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
                                            <span className="text-foreground font-medium" title={gap.fromClass}>{gap.fromClass}</span>
                                          </div>
                                          <div className="text-yellow-500 shrink-0">→</div>
                                          <div className="flex-1 truncate text-right">
                                            <span className="text-muted-foreground block text-[10px]">To</span>
                                            <span className="text-foreground font-medium" title={gap.toClass}>{gap.toClass}</span>
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
                             Long Weekend!
                          </div>
                        )}
                        {(tt.metrics?.buildingDashes ?? 0) > 0 && (
                          <div className="bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 flex items-center justify-center gap-1.5">
                             {tt.metrics?.buildingDashes} Block Dash{(tt.metrics?.buildingDashes ?? 0) > 1 ? 'es' : ''}
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
                              {tt.variants.slice(0, 50).map((v, vIdx) => {
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
                              {tt.variants.length > 50 && (
                                <div className="p-2 text-xs text-center text-muted-foreground bg-muted/20 rounded-lg">
                                  + {tt.variants.length - 50} more variations
                                </div>
                              )}
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
                                        <div className="text-[10px] font-bold text-foreground/70 mb-1.5 uppercase">Quick Select Series</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {availableSeries.map(series => {
                                            const seriesOfferings = uniqueOfferings.filter(o => {
                                              const firstSlot = o.slot.split('+')[0].trim().toUpperCase();
                                              const match = firstSlot.match(/^[T]?([A-G])/);
                                              return match && match[1] === series;
                                            }).map(o => o.id);
                                            const allSelected = seriesOfferings.every(id => sel.offerings?.includes(id));
                                            
                                            return (
                                              <button
                                                key={series}
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setCourseLocks(prev => prev.map(p => {
                                                    if (p.code !== c.code) return p;
                                                    let newOfferings = [...(p.offerings || [])];
                                                    if (allSelected) {
                                                      newOfferings = newOfferings.filter(id => !seriesOfferings.includes(id));
                                                    } else {
                                                      seriesOfferings.forEach(id => {
                                                        if (!newOfferings.includes(id)) newOfferings.push(id);
                                                      });
                                                    }
                                                    return { ...p, offerings: newOfferings };
                                                  }));
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                                  allSelected 
                                                    ? 'bg-amber-500 text-white shadow-sm' 
                                                    : 'bg-muted hover:bg-muted/80 text-foreground/70'
                                                }`}
                                              >
                                                {series} Series
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

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
                                       Filtering by {sel.offerings.length} selected offering{sel.offerings.length === 1 ? '' : 's'}
                                    </div>
                                  )}
                                  </div>
                                )})()}
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

      {/* Variant Search Modal inside AutoGeneratorModal */}
      {isVariantSearchOpen && generatorPreviewTimetable?.variants && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
    </>
  );
}