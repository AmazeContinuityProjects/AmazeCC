"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/sync-engine";
import { assessmentKeyFor, getFrozenKeys, remapCohortStats } from "@/lib/marksSync";
import { BackButton } from "../shared";
import {
  EmptyPanel,
  InsightCarousel,
  KeyValue,
  ListRowText,
  ListShell,
  ListSkeleton,
  MiniBar,
  SectionHeader,
  SegmentedControl,
  StatTile,
  TitleBlock,
  ToneBadge,
  ToneLegend,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";
import {
  LIST_ROW,
  TILE_CARD,
  TONE_BADGE,
  TONE_ICON_TILE,
  TONE_TEXT,
} from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";
import {
  XCircle, BookOpen, Target, Clock, Info, Activity,
  ChevronRight, FileText, Calendar, Calendar as CalendarIcon, MessageSquare,
  Grid3x3, CheckCircle2, Gauge,
  FileText as FileTextIcon, Sparkles, CheckSquare, Plus, ShieldCheck, StickyNote
} from "lucide-react";
import { useAtom } from "jotai";
import { tasksAtom, marksStatsAtom } from "@/store/dataAtoms";
import { createTask } from "@/lib/tasksStorage";
import TaskEditSheet from "../tasks/TaskEditSheet";
import { AnimatePresence, m } from "framer-motion";
import { useOverlayBack } from "@/lib/overlayStack";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { countRemainingClasses, UpcomingClassesList } from "../attendance/AttendanceSubpage";
import config from '../../../../config.json';
import HeatMap from "@uiw/react-heat-map";
import dynamic from "next/dynamic";
import CourseQBankTab from "./CourseQBankTab";


// Dedicated whitespace between the heatmap card and the log section.
// Nulls out the parent stack gap so the total separation is exactly its height.
const LogGap = () => (
  <div aria-hidden="true" className="h-3" style={{ marginBlockStart: 0 }} />
);
import {
  Creds,
  formatSemesterName,
  formatNumber,
  isJunkOrEmpty,
  sanitizeCourseCode,
  sanitizeCourseTitle,
  getAssessmentTotals,
  getCourseCredits,
  getCourseTotal,
  getCourseStats,
  normalisedPct,
  checkIsRelative,
  AssessmentRow,
} from "./courseHelpers";

import SelectField from "../shared/primitives/SelectField";

const AttendanceCalendarView = dynamic(
  () => import("../attendance/AttendanceCalendarView"),
  { ssr: false }
);

interface CourseDetailSubpageProps {
  marksData: any;
  attendanceData: any;
  allGradesData?: any;
  pastSemesterData?: any;
  loginToVTOP: () => Promise<Creds>;
  setActiveSubTab: (tab: string) => void;
  calendars?: any;
  decimalValues?: boolean;
  isDayscholarWithBus?: boolean;
  selectedCode: string;
  initialTab?: string;
  onBack: () => void;
}

/** Attendance status -> insight tone, so the tile colours itself. */
const ATT_TONE: Record<string, string> = {
  Safe: "emerald",
  Warning: "amber",
  "N/A": "zinc",
  Critical: "red",
};

/** Attendance status -> the row's filled dot. Written out because a
 *  `bg-${tone}-500` template would never be seen by Tailwind's scanner. */
const ATT_DOT: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  "on duty": "bg-amber-500",
};

/**
 * Theory/Lab -> tone. An embedded course publishes two halves under one code and
 * they stay blue and green everywhere in the app, so the pair is named once here
 * rather than re-decided at each call site.
 */
const SCOPE_TONE: Record<"Theory" | "Lab", string> = {
  Theory: "blue",
  Lab: "emerald",
};

/**
 * A bar's hue, keyed on the same grade tones the pills use. Shared with the
 * grade history so a given grade is the same colour on both screens.
 */
const GRADE_BAR: Record<string, string> = {
  S: "bg-amber-500",
  A: "bg-emerald-500",
  B: "bg-blue-500",
  C: "bg-cyan-500",
  D: "bg-violet-500",
  E: "bg-red-500",
  F: "bg-red-600",
  N: "bg-zinc-400",
  P: "bg-violet-500",
};

/**
 * A grade band's wash inside the ladder bar. At 15% these read as one
 * continuous scale rather than seven competing cards, which is the whole point
 * of replacing the old tiles — the grade letter carries the meaning and the
 * colour only says "this slice of the ladder".
 */
const GRADE_TINT: Record<string, string> = {
  S: "bg-amber-500/15",
  A: "bg-emerald-500/15",
  B: "bg-blue-500/15",
  C: "bg-cyan-500/15",
  D: "bg-violet-500/15",
  E: "bg-red-500/15",
  F: "bg-red-500/10",
  N: "bg-zinc-500/10",
  P: "bg-violet-500/15",
};

export default function CourseDetailSubpage({
  marksData, attendanceData, allGradesData, pastSemesterData, loginToVTOP, setActiveSubTab,
  calendars, isDayscholarWithBus,
  selectedCode, initialTab, onBack
}: CourseDetailSubpageProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [marksStats] = useAtom(marksStatsAtom);
  const credsRef = useRef<Creds | null>(null);
  const [innerTab, setInnerTab] = useState(initialTab || "overview");
  const [coursePlan, setCoursePlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStats, setAllStats] = useState<Record<string, any>>({});

  const [qcmData, setQcmData] = useState<any>(null);
  const [qcmLoading, setQcmLoading] = useState(false);
  const [qcmError, setQcmError] = useState("");
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);

  // Attendance log filter (shared by the Theory / Lab log pages)

  const [attFilter, setAttFilter] = useState("All");
  const [notesTracker, setNotesTracker] = useState<Record<string, Record<string, boolean>>>({});
  const [targetGrade, setTargetGrade] = useState("A");

  useEffect(() => {
    loginToVTOP().then(c => { credsRef.current = c; setCreds(c); }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const savedTracker = localStorage.getItem("notesTracker");
      if (savedTracker) setNotesTracker(JSON.parse(savedTracker));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("uniCC_notes_tracker");
      if (saved) setNotesTracker(JSON.parse(saved));
    } catch {}
  }, []);

  // Overview hero carousels: reset on course/tab change (auto-advance wired after marks helpers)
  useEffect(() => {
    ovActiveCarousel.reset(); ovAttCarousel.reset();
    setInnerTab(initialTab || "overview");
    // `reset` is a stable useCallback, so it is intentionally not a dep here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, initialTab]);

  // System back (incl. Android predictive back) walks the in-course hierarchy —
  // subtab -> overview -> course list — instead of falling through to screen
  // history and landing on home. Mirrors the in-app BackButton order.
  useOverlayBack("course-subpage", innerTab === "overview", onBack);
  useOverlayBack("course-subpage-tab", innerTab !== "overview", () => {
    ovActiveCarousel.reset();
    ovAttCarousel.reset();
    setInnerTab("overview");
  });

  const uniqueCourses = useMemo(() => {
    const coursesBySemester = new Map<string, any[]>();
    
    // Process current semester
    const currentMap = new Map();
    if (marksData?.courses && Array.isArray(marksData.courses)) {
      marksData.courses.forEach((c: any) => {
        if (!c || typeof c !== "object") return;
        const key = sanitizeCourseCode(c.courseCode || c.code);
        const rawTitle = String(c.courseTitle || c.title || "").trim();
        const classNbr = String(c.classNumber || c.classNbr || c.crn || "").trim();
        if (!key && isJunkOrEmpty(rawTitle)) return;
        if (isJunkOrEmpty(key) && isJunkOrEmpty(classNbr)) return;

        const baseCode = key || sanitizeCourseCode(rawTitle) || sanitizeCourseCode(classNbr);
        if (!baseCode) return;

        const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
        const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
        if (!currentMap.has(baseCode)) {
          currentMap.set(baseCode, {
            courseCode: baseCode,
            courseTitle,
            semesterSubId: "Current",
            theory: !isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
            lab: isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
          });
        } else {
          const existing = currentMap.get(baseCode);
          if (isLab) existing.lab = { ...c, courseCode: baseCode, courseTitle };
          else existing.theory = { ...c, courseCode: baseCode, courseTitle };
        }
      });
    }

    if (attendanceData?.attendance && Array.isArray(attendanceData.attendance)) {
      attendanceData.attendance.forEach((c: any) => {
        if (!c || typeof c !== "object") return;
        let key = sanitizeCourseCode(c.courseCode || c.code);
        if (key && key.includes(" ")) key = key.split(" ")[0];
        const rawTitle = String(c.courseTitle || c.title || "").trim();
        const classNbr = String(c.classNumber || c.classNbr || c.crn || c.classId || "").trim();
        if (!key && isJunkOrEmpty(rawTitle)) return;
        if (isJunkOrEmpty(key) && isJunkOrEmpty(classNbr)) return;

        const baseCode = key || sanitizeCourseCode(rawTitle) || sanitizeCourseCode(classNbr);
        if (!baseCode) return;

        const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
        const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l") || c.slotName?.toLowerCase().startsWith("l");

        if (!currentMap.has(baseCode)) {
          currentMap.set(baseCode, {
            courseCode: baseCode,
            courseTitle,
            semesterSubId: "Current",
            theory: !isLab ? { ...c, classNbr: c.classId || c.classNbr, courseCode: baseCode, courseTitle } : null,
            lab: isLab ? { ...c, classNbr: c.classId || c.classNbr, courseCode: baseCode, courseTitle } : null,
          });
        } else {
          const existing = currentMap.get(baseCode);
          if (isLab) existing.lab = { ...(existing.lab || {}), ...c, classNbr: c.classId || existing.lab?.classNbr, courseCode: baseCode, courseTitle };
          else existing.theory = { ...(existing.theory || {}), ...c, classNbr: c.classId || existing.theory?.classNbr, courseCode: baseCode, courseTitle };
          if (existing.courseTitle === baseCode && !isJunkOrEmpty(rawTitle)) {
            existing.courseTitle = courseTitle;
          }
        }
      });
    }
    coursesBySemester.set("Current", Array.from(currentMap.values()));

    // Process past semesters
    if (pastSemesterData) {
      Object.keys(pastSemesterData).forEach(semId => {
        // Explicitly skip the current semester which is already loaded via marksData & attendanceData
        if (attendanceData?.semester && semId === attendanceData.semester) return;
        
        const data = pastSemesterData[semId];
        const semMap = new Map();
        
        if (data.marks?.courses && Array.isArray(data.marks.courses)) {
          data.marks.courses.forEach((c: any) => {
            if (!c || typeof c !== "object") return;
            const key = sanitizeCourseCode(c.courseCode || c.code);
            const rawTitle = String(c.courseTitle || c.title || "").trim();
            if (!key && isJunkOrEmpty(rawTitle)) return;
            const baseCode = key || sanitizeCourseCode(rawTitle);
            if (!baseCode) return;

            const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
            const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
            if (!semMap.has(baseCode)) semMap.set(baseCode, { courseCode: baseCode, courseTitle, semesterSubId: semId, theory: !isLab ? { ...c, courseCode: baseCode, courseTitle } : null, lab: isLab ? { ...c, courseCode: baseCode, courseTitle } : null });
            else {
              const existing = semMap.get(baseCode);
              if (isLab) existing.lab = { ...c, courseCode: baseCode, courseTitle };
              else existing.theory = { ...c, courseCode: baseCode, courseTitle };
            }
          });
        }

        if (data.attendance?.attendance && Array.isArray(data.attendance.attendance)) {
          data.attendance.attendance.forEach((c: any) => {
            if (!c || typeof c !== "object") return;
            let key = sanitizeCourseCode(c.courseCode || c.code);
            if (key && key.includes(" ")) key = key.split(" ")[0];
            const rawTitle = String(c.courseTitle || c.title || "").trim();
            if (!key && isJunkOrEmpty(rawTitle)) return;
            const baseCode = key || sanitizeCourseCode(rawTitle);
            if (!baseCode) return;

            const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
            const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
            if (!semMap.has(baseCode)) semMap.set(baseCode, { courseCode: baseCode, courseTitle, semesterSubId: semId, theory: !isLab ? { ...c, classNbr: c.classId, courseCode: baseCode, courseTitle } : null, lab: isLab ? { ...c, classNbr: c.classId, courseCode: baseCode, courseTitle } : null });
            else {
              const existing = semMap.get(baseCode);
              if (isLab) existing.lab = { ...(existing.lab || {}), ...c, classNbr: c.classId || existing.lab?.classNbr, courseCode: baseCode, courseTitle };
              else existing.theory = { ...(existing.theory || {}), ...c, classNbr: c.classId || existing.theory?.classNbr, courseCode: baseCode, courseTitle };
            }
          });
        }
        let isDuplicate = false;
        if (semMap.size > 0 && currentMap.size > 0) {
          const currentClassNbrs = new Set();
          currentMap.forEach(group => {
            if (group.theory?.classNbr) currentClassNbrs.add(group.theory.classNbr);
            if (group.lab?.classNbr) currentClassNbrs.add(group.lab.classNbr);
          });
          
          let matchCount = 0;
          for (const group of Array.from(semMap.values())) {
            const tNbr = group.theory?.classNbr;
            const lNbr = group.lab?.classNbr;
            if ((tNbr && currentClassNbrs.has(tNbr)) || (lNbr && currentClassNbrs.has(lNbr))) {
              matchCount++;
            }
          }
          if (matchCount > 0 && matchCount === semMap.size) {
            isDuplicate = true;
          }
        }
        if (semMap.size > 0 && !isDuplicate) coursesBySemester.set(semId, Array.from(semMap.values()));
      });
    }

    // Add any remaining courses from allGradesData that aren't in pastSemesterData
    if (allGradesData?.grades && !Array.isArray(allGradesData.grades)) {
      Object.keys(allGradesData.grades).forEach(semId => {
        if (semId === "Current" || semId === "curriculum" || semId === "effectiveGrades") return;
        
        // Explicitly skip the current semester which is already loaded via marksData & attendanceData
        if (attendanceData?.semester && semId === attendanceData.semester) return;
        
        const sem = allGradesData.grades[semId];
        const courseList = sem?.grades || sem?.courseGrades || sem?.courses || sem || [];
        const items = Array.isArray(courseList) ? courseList : Object.values(courseList);
        
        let semMap = coursesBySemester.has(semId) 
          ? new Map(coursesBySemester.get(semId).map((c: any) => [c.courseCode, c])) 
          : new Map();

        let addedNew = false;
        items.forEach((c: any) => {
          if (!c || typeof c !== "object") return;
          const code = sanitizeCourseCode(c.courseCode || c.code);
          const rawTitle = String(c.courseTitle || c.title || "").trim();
          if (!code && isJunkOrEmpty(rawTitle)) return;
          const cleanCode = code || sanitizeCourseCode(rawTitle);
          if (!cleanCode) return;

          const courseTitle = sanitizeCourseTitle(rawTitle, cleanCode);
          
          if (!semMap.has(cleanCode)) {
            semMap.set(cleanCode, {
              courseCode: cleanCode,
              courseTitle,
              semesterSubId: semId,
              theory: { courseType: c.courseType || "Theory", courseCode: cleanCode, courseTitle },
              lab: null
            });
            addedNew = true;
          }
        });

        // Deduplicate logic for grades-only semesters (same as above)
        if (addedNew && semMap.size > 0 && currentMap.size > 0) {
          const currentCodes = new Set();
          currentMap.forEach(group => currentCodes.add(group.courseCode));
          
          let matchCount = 0;
          for (const key of Array.from(semMap.keys())) {
            if (currentCodes.has(key)) matchCount++;
          }
          if (matchCount > 0 && matchCount === semMap.size) {
            return; // completely duplicate of current semester
          }
        }

        if (semMap.size > 0 && (addedNew || !coursesBySemester.has(semId))) {
          coursesBySemester.set(semId, Array.from(semMap.values()));
        }
      });
    }

    // Flatten into a single array but maintain order (Current first, then past semesters)
    let flatCourses: any[] = [];
    coursesBySemester.forEach(semCourses => {
      flatCourses = flatCourses.concat(semCourses);
    });

    return flatCourses.filter(c => 
      !isJunkOrEmpty(c.courseCode) && 
      !isJunkOrEmpty(c.courseTitle) &&
      Boolean(c.theory || c.lab)
    );
  }, [marksData, attendanceData, pastSemesterData]);

  const selectedGroup = useMemo(() => uniqueCourses.find(c => c.courseCode === selectedCode), [selectedCode, uniqueCourses]);
  const mainCourse = selectedGroup?.theory || selectedGroup?.lab;

  useEffect(() => {
    if (!marksData?.courses) return;
    let cancelled = false;

    // Cohort statistics arrive with the marks, per class.
    //
    // There is deliberately no second request here. The server had to scrape the marks
    // anyway, so it returns the matching cohort statistics in the same payload — no
    // semester to negotiate, no extra VTOP round trip, and nothing for this component to
    // authenticate. An earlier version called `/marks/stats` itself, which failed two
    // ways: it needed a semester id, and `credentialManager.vtop` is only populated by
    // an explicit login, so on a boot restored from localStorage the request went out
    // with no credentials and came back 400.
    const fetchStats = async () => {
      try {
        // Read from the atom the sync engine already populated, not from a parallel
        // storage read: the two can disagree, and when they did the statistics stayed
        // invisible while the marks rendered normally.
        if (!marksStats) return;
        const stored = marksStats as Record<string, any>;
        if (Object.keys(stored).length === 0) {
          console.warn(
            "[marks/stats] No cohort statistics in this sync's payload. If this " +
              "persists after a Reload, the API process predates the engine op."
          );
          return;
        }

        const remapped = await remapCohortStats(stored, uniqueCourses);

        if (!cancelled) setAllStats(remapped);
      } catch {}
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [marksData, marksStats, uniqueCourses]);

  const { theoryAttItem, labAttItem } = useMemo(() => {
    if (!selectedCode) return { theoryAttItem: null, labAttItem: null };

    let sourceAttendance = attendanceData?.attendance || [];
    if (selectedGroup?.semesterSubId && selectedGroup.semesterSubId !== "Current" && pastSemesterData?.[selectedGroup.semesterSubId]?.attendance?.attendance) {
      sourceAttendance = pastSemesterData[selectedGroup.semesterSubId].attendance.attendance;
    }

    const items = sourceAttendance.filter((a: any) =>
      a.courseCode?.replace(/\([LPT]\)$/i, "").trim() === selectedCode.trim()
    );
    const theoryItem = items.find((a: any) => !a.courseCode?.endsWith("(L)") && !a.courseCode?.endsWith("(P)")) || items[0];
    const labItem = items.find((a: any) => a.courseCode?.endsWith("(L)") || a.courseCode?.endsWith("(P)"));

    return {
      theoryAttItem: theoryItem,
      labAttItem: labItem
    };
  }, [attendanceData, selectedCode]);

  // Attendance sub-tabs resolve straight to a component — no shared scope.
  // Legacy "attendance" deep-links land on the default component's log.
  const defaultAttScope = labAttItem && !theoryAttItem ? "lab" : "theory";
  const effectiveTab = innerTab === "attendance" ? `${defaultAttScope}-log` : innerTab;

  // Derived attendance data for full Attendance tab replication
  const dayCardsMap = useMemo(() => {
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const map: Record<string, any[]> = {};
    days.forEach(day => map[day] = []);
    const slotMap = (config as any).slotMap;
    
    let arr = attendanceData?.attendance || [];
    if (selectedGroup?.semesterSubId && selectedGroup.semesterSubId !== "Current" && pastSemesterData?.[selectedGroup.semesterSubId]?.attendance?.attendance) {
      arr = pastSemesterData[selectedGroup.semesterSubId].attendance.attendance;
    }
    
    if (!arr.length) return map;

    arr.forEach((a: any) => {
      const slots = a.slotName.split("+");
      slots.forEach((slotName: string) => {
        const cleanSlot = slotName.trim();
        for (const day of days) {
          if (slotMap[day] && slotMap[day][cleanSlot]) {
            const info = slotMap[day][cleanSlot];
            const cleanCourseCode = a.courseCode;
            map[day].push({
              ...a,
              courseCode: cleanCourseCode,
              slotName: cleanSlot,
              time: info.time,
            });
          }
        }
      });
    });

    function parseTime(timeStr: string) {
      let [h, m] = timeStr.trim().split(":").map(Number);
      if (h < 8) h += 12;
      return h * 60 + m;
    }

    for (const day of days) {
      map[day].sort((a, b) => {
        const startA = parseTime(a.time.split("-")[0]);
        const startB = parseTime(b.time.split("-")[0]);
        return startA - startB;
      });
    }
    return map;
  }, [attendanceData]);

  const analyzeCalendars = useMemo(() => {
    if (!calendars) return [];
    const analyzed = analyzeAllCalendars(calendars);
    return analyzed.results || [];
  }, [calendars]);

  const importantEvents = useMemo(() => {
    if (!calendars) return new Map();
    const analyzed = analyzeAllCalendars(calendars);
    return analyzed.importantEvents || new Map();
  }, [calendars]);

  const impDates = useMemo(() => {
    const findEventDate = (eventName: string) => {
      const ev = [...importantEvents.values()].find(
        (e: any) => e.event?.toLowerCase() === eventName.toLowerCase()
      );
      if (!ev) return null;
      return (ev as any).formattedDate;
    };
    return {
      cat1Date: findEventDate("CAT I"),
      cat2Date: findEventDate("CAT II"),
      lidLabDate: findEventDate("lid for laboratory classes"),
      lidTheoryDate: findEventDate("LID FOR THEORY CLASSES"),
      midsemStart: findEventDate("Mid Term Test"),
    };
  }, [importantEvents]);

  const toggleNotes = (dateStr: string, courseKey?: string) => {
    const key = courseKey || "";
    setNotesTracker(prev => {
      const newState = {
        ...prev,
        [key]: { ...(prev[key] || {}), [dateStr]: !(prev[key]?.[dateStr]) },
      };
      localStorage.setItem("uniCC_notes_tracker", JSON.stringify(newState));
      return newState;
    });
  };

  const resolveFacultyForComp = async (comp: any) => {
    // If it already looks like a valid VTOP faculty ID string (e.g. "12345 - NAME" or "12345-NAME")
    if (comp.faculty && /^\w+\s*-/.test(comp.faculty.trim())) return comp.faculty;
    
    try {
      const d = await api("course-page", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: {
          cookies: creds?.cookies, authorizedID: creds?.authorizedID, csrf: creds?.csrf,
          formData: { 
            semesterSubId: selectedGroup?.semesterSubId === "Current" ? "" : (selectedGroup?.semesterSubId || ""), 
            courseCode: comp.classNbr, 
            slotId: comp.slot 
          }
        },
      }) as any;
      if (d.success !== false && d.results?.selectOptions?.faculty?.length > 1) {
        const options = d.results.selectOptions.faculty.slice(1);
        let selectedOpt = options[0];
        if (comp.faculty && comp.faculty.trim() !== "") {
          const match = options.find((opt: any) => opt.text.toLowerCase().includes(comp.faculty.toLowerCase()));
          if (match) selectedOpt = match;
        }
        comp.faculty = selectedOpt.value;
        return comp.faculty;
      }
    } catch (e) { console.error(e); }
    return "";
  };

  const fetchCoursePlan = async () => {
    if (!selectedGroup || !creds) return;
    setPlanLoading(true); setError(null);
    try {
      const components: Array<{ comp: any; scope: "theory" | "lab" }> = [];
      if (selectedGroup.theory) components.push({ comp: selectedGroup.theory, scope: "theory" });
      if (selectedGroup.lab) components.push({ comp: selectedGroup.lab, scope: "lab" });
      const planData: any[] = [];
      for (const { comp, scope } of components) {
        const resolvedFaculty = await resolveFacultyForComp(comp);
        const d = await api("course-page", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: {
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { semesterSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), courseCode: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          },
        }) as any;
        if (d.success !== false && d.results) planData.push({ scope, type: comp.courseType, data: d.results });
      }
      setCoursePlan(planData.length > 0 ? planData : null);
    } catch (err: any) { setError(err.message); }
    finally { setPlanLoading(false); }
  };

  const fetchViewDetail = async () => {
    if (!selectedGroup || !creds) return;
    setViewLoading(true); setError(null);
    try {
      const components: Array<{ comp: any; scope: "theory" | "lab" }> = [];
      if (selectedGroup.theory) components.push({ comp: selectedGroup.theory, scope: "theory" });
      if (selectedGroup.lab) components.push({ comp: selectedGroup.lab, scope: "lab" });
      const detailData: any[] = [];
      for (const { comp, scope } of components) {
        const resolvedFaculty = await resolveFacultyForComp(comp);
        const erpId = resolvedFaculty?.split("-")[0]?.trim() || "";
        const d = await api("course-page", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: {
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { viewDetail: "true", semSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), erpId, classId: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          },
        }) as any;
        if (d.success !== false && d.results) detailData.push({ scope, type: comp.courseType, data: d.results });
      }
      setViewDetail(detailData.length > 0 ? detailData : null);
    } catch (err: any) { setError(err.message); }
    finally { setViewLoading(false); }
  };

  useEffect(() => { 
    if (selectedCode) { 
      setCoursePlan(null); 
      setViewDetail(null); 
      setQcmError(""); 
      fetchCoursePlan(); 

      const cached = localStorage.getItem("qcmData");
      if (cached) {
         try {
           const d = JSON.parse(cached);
           let courseQcmTables: any[] = [];
           for (const [key, sem] of Object.entries(d)) {
              if ((sem as any).tables) {
                for (const table of (sem as any).tables) {
                   const matchingRows = table.rows.filter((row: any) => {
                     return Object.values(row).some((val: any) => typeof val === "string" && val.includes(selectedCode));
                   });
                   if (matchingRows.length > 0) {
                     courseQcmTables.push({
                       caption: table.caption,
                       headers: table.headers,
                       rows: matchingRows
                     });
                   }
                }
              }
           }
           setQcmData(courseQcmTables.length > 0 ? courseQcmTables : []);
         } catch (e) {
           setQcmData(null);
         }
      } else {
         setQcmData(null);
      }
    } 
  }, [selectedCode]);

  const fetchQcmForCourse = async () => {
    if (!selectedGroup || !creds) return;
    setQcmLoading(true); setQcmError("");
    try {
      const semId = selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || "");
      const d = await api("qcm-view", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: semId },
      }) as any;
      if (d.success && d.data) {
        let courseQcmTables = [];
        for (const [key, sem] of Object.entries(d.data)) {
           if ((sem as any).tables) {
             for (const table of (sem as any).tables) {
                const matchingRows = table.rows.filter((row: any) => {
                  return Object.values(row).some((val: any) => typeof val === "string" && val.includes(selectedCode));
                });
                if (matchingRows.length > 0) {
                  courseQcmTables.push({
                    caption: table.caption,
                    headers: table.headers,
                    rows: matchingRows
                  });
                }
             }
           }
        }
        setQcmData(courseQcmTables.length > 0 ? courseQcmTables : []);
      } else {
        setQcmError(d.error || "Failed to fetch QCM data");
      }
    } catch (e: any) {
      setQcmError(e.message);
    } finally {
      setQcmLoading(false);
    }
  };

  // Hierarchical back: subtab -> overview -> course list (never straight home)
  const handleBack = () => {
    if (innerTab !== "overview") {
      ovActiveCarousel.reset();
      ovAttCarousel.reset();
      setInnerTab("overview");
      return;
    }
    onBack();
  };

  const isEmbedded = selectedGroup?.theory && selectedGroup?.lab;

  let thresholdPct = 75;
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetAttendance) thresholdPct = Number(parsed.targetAttendance);
      }
    } catch (e) {}
  }
  const thresholdDec = thresholdPct / 100;

  // Per-component attendance data (log + predictor), OD-page style. Called
  // once per component, unconditionally, so hook order stays stable.
  // Reactive inputs arrive as arguments so memo deps stay lint-clean.
  const useScopeAttendance = (item: any, filter: string, tracker: Record<string, Record<string, boolean>>) => {
    const historyList = useMemo(() => (Array.isArray(item?.viewLink) ? item.viewLink : []), [item]);
    const filteredHistory = useMemo(() => historyList.filter((d: any) => {
      if (filter === "All") return true;
      return d.status.toLowerCase() === filter.toLowerCase();
    }), [historyList, filter]);
    const missingNotesCount = useMemo(() => historyList.filter((d: any) =>
      d.status.toLowerCase() !== "present" &&
      !tracker[item?.courseCode || ""]?.[d.date]
    ).length, [historyList, tracker, item]);
    const isLab = String(item?.courseCode || "").endsWith("(L)") || String(item?.courseCode || "").endsWith("(P)");
    const isTheory = String(item?.courseCode || "").endsWith("(T)");

    const countTillDate = (endDate: any) => {
      if (!endDate) return null;
      const endMid = new Date(endDate);
      endMid.setHours(23, 59, 59, 999);

      const filteredMonths = analyzeCalendars.map((monthObj: any) => ({
        ...monthObj,
        days: monthObj.days?.filter((d: any) => {
          if (!d.date || !d.weekday) return false;
          const monthStr = String(monthObj.month ?? "").toLowerCase();
          const mIndex = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
          ].findIndex((m) => monthStr.includes(m));
          const dFull = new Date(monthObj.year, mIndex, d.date);
          dFull.setHours(0, 0, 0, 0);
          return dFull <= endMid;
        }) || [],
      }));

      return countRemainingClasses(
        item?.courseCode || "",
        item?.time || "",
        dayCardsMap,
        filteredMonths,
        new Date()
      );
    };

    let classesTillCAT1: any[] | null = null;
    let classesTillCAT2: any[] | null = null;
    let classesTillMidSem: any[] | null = null;
    let classesTillLID: any[] | null = null;
    if (Array.isArray(analyzeCalendars) && analyzeCalendars.length > 0) {
        const allMonthsAreHolidays = analyzeCalendars.every((month: any) => month?.summary?.working === 0);
        if (!allMonthsAreHolidays) {
            if (isLab) {
                classesTillCAT1 = countTillDate(impDates.cat1Date);
                classesTillCAT2 = countTillDate(impDates.cat2Date);
                classesTillMidSem = countTillDate(impDates.midsemStart);
                classesTillLID = countTillDate(impDates.lidLabDate);
            } else if (isTheory) {
                classesTillCAT1 = countTillDate(impDates.cat1Date);
                classesTillCAT2 = countTillDate(impDates.cat2Date);
                classesTillMidSem = countTillDate(impDates.midsemStart);
                classesTillLID = countTillDate(impDates.lidTheoryDate);
            }
        }
    }

    const hasPredictor = [classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID]
      .some(data => Array.isArray(data) && data.length > 0);
    const upcomingTotal = [classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID]
      .reduce((n, d) => n + (Array.isArray(d) ? d.length : 0), 0);

    const heatmapData = useMemo(() => {
      const dateMap: Record<string, { present: number; absent: number; od: number }> = {};
      historyList.forEach((d: any) => {
        const dateObj = new Date(d.date);
        const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
        if (!dateMap[dateStr]) dateMap[dateStr] = { present: 0, absent: 0, od: 0 };
        const status = d.status.toLowerCase();
        if (status === "present") dateMap[dateStr].present++;
        else if (status === "absent") dateMap[dateStr].absent++;
        else if (status === "on duty") dateMap[dateStr].od++;
      });
      return Object.entries(dateMap).map(([dateStr, counts]) => {
        let val = 0, status = "";
        if (counts.absent > 0) { val = 2; status = "Absent"; }
        else if (counts.od > 0) { val = 3; status = "On Duty"; }
        else if (counts.present > 0) { val = 1; status = "Present"; }
        return { date: dateStr, count: val, status };
      });
    }, [historyList]);

    const attended = Number(item?.attendedClasses) || 0;
    const total = Number(item?.totalClasses) || 0;
    const pct = total > 0 ? (attended / total) * 100 : 0;
    const status = total === 0 ? "N/A" : pct >= thresholdPct + 5 ? "Safe" : pct >= thresholdPct ? "Warning" : "Critical";
    let marginHeadline = "—";
    let marginSubline = "No classes held yet";
    let marginTone: "emerald" | "amber" | "red" | "zinc" = "zinc";
    if (total > 0 && pct < thresholdPct) {
      const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
      const neededValue = isLab ? Math.ceil(needed / 2) : needed;
      marginHeadline = `Need ${neededValue}`;
      marginSubline = `more ${isLab ? "lab" : "class"}${neededValue > 1 ? (isLab ? "s" : "es") : ""} to reach ${thresholdPct}%`;
      marginTone = "red";
    } else if (total > 0) {
      const canMiss = Math.floor(attended / thresholdDec - total);
      const canMissValue = isLab ? Math.floor(canMiss / 2) : canMiss;
      if (canMissValue <= 0) {
        marginHeadline = "On edge";
        marginSubline = `No misses left · at ${thresholdPct}% margin`;
        marginTone = "amber";
      } else {
        marginHeadline = `${canMissValue} bunkable`;
        marginSubline = `safe above ${thresholdPct}%`;
        marginTone = "emerald";
      }
    }

    return {
      historyList, filteredHistory, missingNotesCount,
      classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID,
      hasPredictor, upcomingTotal, heatmapData,
      attended, total, pct, status, marginHeadline, marginSubline, marginTone, isLab,
    };
  };
  const theoryData = useScopeAttendance(theoryAttItem, attFilter, notesTracker);
  const labData = useScopeAttendance(labAttItem, attFilter, notesTracker);

  const heatmapStartDate = useMemo(() => {
    if (analyzeCalendars && analyzeCalendars.length > 0) {
      const firstMonth = analyzeCalendars[0];
      const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        .findIndex((m: string) => String(firstMonth.month ?? "").toLowerCase().includes(m));
      if (mIndex !== -1) return new Date(firstMonth.year, mIndex, 1);
    }
    const date = new Date();
    date.setMonth(date.getMonth() - 5);
    return date;
  }, [analyzeCalendars]);

  const heatmapEndDate = useMemo(() => {
    if (analyzeCalendars && analyzeCalendars.length > 0) {
      const lastMonth = analyzeCalendars[analyzeCalendars.length - 1];
      const mIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        .findIndex((m: string) => String(lastMonth.month ?? "").toLowerCase().includes(m));
      if (mIndex !== -1) return new Date(lastMonth.year, mIndex + 1, 0);
    }
    return new Date();
  }, [analyzeCalendars]);

  /* ---- MARKS TAB HELPERS ---- */
  const courseTypeLabel = isEmbedded ? "Embedded" : mainCourse?.courseType;
  const isRelative = checkIsRelative(mainCourse?.courseSystem, courseTypeLabel);
  const courseTotalString = getCourseTotal(selectedGroup?.theory || selectedGroup?.lab, selectedGroup?.theory ? selectedGroup?.lab : null);
  const courseStats = selectedGroup ? getCourseStats(selectedGroup) : { maxPossible: 0, projected: 0 };
  const stats = selectedGroup ? allStats[mainCourse?.classNbr]?.overall : null;
  const asmStats = selectedGroup ? (allStats[mainCourse?.classNbr]?.assessments || {}) : {};

  // Assessments the server holds that this device cannot update — no local previous
  // mark to state, so they stand as recorded. Counted per course for the badge below;
  // see `syncMarksDiff` for how the list is produced.
  const frozenCount = useMemo(() => {
    if (!selectedGroup) return 0;
    const ids = new Set(
      [selectedGroup.theory?.classNbr, selectedGroup.lab?.classNbr].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    );
    if (ids.size === 0) return 0;
    return getFrozenKeys().filter((k) => {
      const sep = k.indexOf("::");
      return sep > 0 && ids.has(k.slice(0, sep));
    }).length;
  }, [selectedGroup, allStats]);

  const isSelectedPastSemester = selectedGroup?.semesterSubId && selectedGroup.semesterSubId !== "Current";
  let selectedPastGrade = "";
  if (isSelectedPastSemester && allGradesData?.grades) {
    let gradeArray: any[] = [];
    if (allGradesData.grades[selectedGroup.semesterSubId]) {
      const sem = allGradesData.grades[selectedGroup.semesterSubId];
      gradeArray = sem?.grades || sem || [];
    } else if (Array.isArray(allGradesData.grades)) {
      gradeArray = allGradesData.grades;
    } else {
      gradeArray = Object.values(allGradesData.grades).flatMap((s: any) => s?.grades || s || []);
    }
    const items = Array.isArray(gradeArray) ? gradeArray : Object.values(gradeArray);
    const found = items.find((g: any) => (g.courseCode || g.code) === selectedGroup.courseCode);
    if (found) selectedPastGrade = found.grade || found.courseGrade;
  }

  // ---- OVERVIEW HERO DERIVED DATA (SimplifiedMobileHome + OD page pattern) ----
  const ovTheoryTotals = getAssessmentTotals(selectedGroup?.theory?.assessments || []);
  const ovLabTotals = getAssessmentTotals(selectedGroup?.lab?.assessments || []);
  const ovTheoryPct = ovTheoryTotals.weightPercent > 0 ? (ovTheoryTotals.weighted / ovTheoryTotals.weightPercent) * 100 : (ovTheoryTotals.max > 0 ? (ovTheoryTotals.scored / ovTheoryTotals.max) * 100 : null);
  const ovLabPct = ovLabTotals.weightPercent > 0 ? (ovLabTotals.weighted / ovLabTotals.weightPercent) * 100 : (ovLabTotals.max > 0 ? (ovLabTotals.scored / ovLabTotals.max) * 100 : null);
  const ovMarksSlides = useMemo(() => {
    if (!selectedGroup) return [];
    if (isSelectedPastSemester && selectedPastGrade) {
      return [{ id: "grade", title: "Grades", headline: `Grade ${selectedPastGrade}`, subline: "Published grade", badge: "Final", badgeColor: TONE_BADGE.emerald, headlineColor: TONE_TEXT.emerald }];
    }
    const slides: any[] = [];
    const hasTheory = (selectedGroup?.theory?.assessments?.length || 0) > 0;
    const hasLab = (selectedGroup?.lab?.assessments?.length || 0) > 0;
    if (selectedGroup?.theory && selectedGroup?.lab) {
      slides.push({ id: "combined", title: "Marks", headline: String(courseTotalString), subline: `Projected ${courseStats.projected}% · Max ${formatNumber(courseStats.maxPossible)}%`, badge: "Overall" });
      slides.push({ id: "theory", title: "Marks", headline: hasTheory ? `${formatNumber(ovTheoryTotals.weighted)} / ${formatNumber(ovTheoryTotals.weightPercent)}` : "—", subline: ovTheoryPct !== null ? `${formatNumber(ovTheoryPct)}% scored` : "No theory marks yet", badge: "Theory", badgeColor: TONE_BADGE.blue });
      slides.push({ id: "lab", title: "Marks", headline: hasLab ? `${formatNumber(ovLabTotals.weighted)} / ${formatNumber(ovLabTotals.weightPercent)}` : "—", subline: ovLabPct !== null ? `${formatNumber(ovLabPct)}% scored` : "No lab marks yet", badge: "Lab", badgeColor: TONE_BADGE.emerald });
    } else {
      const t = selectedGroup?.lab ? ovLabTotals : ovTheoryTotals;
      const pct = selectedGroup?.lab ? ovLabPct : ovTheoryPct;
      const has = hasTheory || hasLab;
      slides.push({ id: "total", title: "Marks", headline: has ? `${formatNumber(t.weighted)} / ${formatNumber(t.weightPercent)}` : "—", subline: pct !== null ? `${formatNumber(pct)}% scored · Max ${formatNumber(courseStats.maxPossible)}%` : "No marks yet", badge: selectedGroup?.lab ? "Lab" : "Theory", badgeColor: selectedGroup?.lab ? TONE_BADGE.emerald : TONE_BADGE.blue });
    }
    return slides;
  }, [selectedGroup, isSelectedPastSemester, selectedPastGrade, courseTotalString, courseStats, ovTheoryTotals, ovLabTotals, ovTheoryPct, ovLabPct]);
  const ovSlideCount = innerTab === "overview" && selectedCode ? ovMarksSlides.length : 0;
  // Attendance hero carousel slides (theory + lab rotate on their own, like the marks card)
  const ovAttSlides = useMemo(() => {
    const toSlide = (item: any, badge: string, badgeColor?: string) => {
      const pct = Number(item?.attendancePercentage) || 0;
      const attended = Number(item?.attendedClasses) || 0;
      const total = Number(item?.totalClasses) || 0;
      const status = total === 0 ? "N/A" : pct >= thresholdPct + 5 ? "Safe" : pct >= thresholdPct ? "Warning" : "Critical";
      return {
        id: badge.toLowerCase(), title: "Attendance",
        headline: total > 0 ? `${Number(pct.toFixed(1))}%` : "—",
        subline: total > 0 ? `${attended}/${total}${item?.slotVenue ? ` · ${item.slotVenue}` : ""}` : "No attendance data",
        badge, badgeColor, status, pct, attended, total,
      };
    };
    if (theoryAttItem && labAttItem) {
      return [
        toSlide(theoryAttItem, "Theory", TONE_BADGE.blue),
        toSlide(labAttItem, "Lab", TONE_BADGE.emerald),
      ];
    }
    const item = theoryAttItem || labAttItem;
    return [toSlide(item, item ? (String(item.courseCode || "").endsWith("(L)") || String(item.courseCode || "").endsWith("(P)") ? "Lab" : "Theory") : "Theory")];
  }, [theoryAttItem, labAttItem, thresholdPct]);
  const ovAttSlideCount = innerTab === "overview" && selectedCode ? ovAttSlides.length : 0;
  const ovAttCarousel = useCarousel(ovAttSlideCount);
  const ovActiveCarousel = useCarousel(ovSlideCount);
  // Attendance status -> tone, so the tile colours itself instead of the
  // caller hand-rolling a four-way class ternary.
  const ovAttInsightSlides = useMemo<InsightSlide[]>(
    () =>
      ovAttSlides.map((s: any) => ({
        id: s.id,
        label: s.title,
        value: s.headline,
        sub: s.subline,
        // The tile's pill showed the attendance status, not Theory/Lab.
        badge: s.status,
        dotLabel: `${s.badge} attendance`,
        valueClassName: TONE_TEXT[ATT_TONE[s.status] ?? "red"],
        tone: ATT_TONE[s.status],
        onClick: () => setInnerTab(`${defaultAttScope}-log`),
      })),
    [ovAttSlides, defaultAttScope]
  );
  const ovGo = useCallback(
    (id: string) => {
      ovActiveCarousel.reset();
      setInnerTab(id);
      if (id === "plan" && !coursePlan && !planLoading) fetchCoursePlan();
    },
    [ovActiveCarousel.reset, setInnerTab, coursePlan, planLoading]
  );
  const ovMarksInsightSlides = useMemo<InsightSlide[]>(
    () =>
      ovMarksSlides.map((s: any) => ({
        id: s.id,
        label: s.title,
        value: s.headline,
        sub: s.subline,
        badge: s.badge,
        dotLabel: typeof s.title === "string" ? s.title : s.id,
        badgeClassName: s.badgeColor,
        valueClassName: s.headlineColor,
        onClick: () => ovGo("marks"),
      })),
    [ovMarksSlides, ovGo]
  );
  // Review-tab scope helpers: theory/lab plan + schedule stay separated.
  const reviewScopes: Array<"theory" | "lab"> = isEmbedded
    ? ["theory", "lab"]
    : [selectedGroup?.lab && !selectedGroup?.theory ? "lab" : "theory"];
  const planEntriesByScope = (scope: "theory" | "lab") =>
    (coursePlan || []).filter((cp: any) => (cp.scope || "theory") === scope);
  const detailEntriesByScope = (scope: "theory" | "lab") =>
    (viewDetail || []).filter((vd: any) => (vd.scope || "theory") === scope);
  const renderScopeBadge = (scope: "theory" | "lab") => (
    <ToneBadge tone={SCOPE_TONE[scope === "theory" ? "Theory" : "Lab"]}>
      {scope === "theory" ? "Theory" : "Lab"}
    </ToneBadge>
  );
  const renderCourseDetailCard = (courseComp: any, attItem: any, badge: "Theory" | "Lab" | null) => {
    if (!courseComp && !attItem) return null;
    const tiles: Array<[string, string]> = [
      ["Type", isEmbedded ? "Embedded" : (courseComp?.courseType || "—")],
      ["Slot", courseComp?.slot || attItem?.slotName || "—"],
      ["System", courseComp?.courseSystem || "—"],
      ["Credits", attItem?.credits != null ? String(attItem.credits) : (courseComp?.credits != null ? String(courseComp.credits) : "—")],
    ];
    const faculty = courseComp?.faculty || attItem?.faculty || "";
    const venue = attItem?.slotVenue || "";
    return (
      <div className={`${TILE_CARD} space-y-3`}>
        {badge && renderScopeBadge(badge === "Theory" ? "theory" : "lab")}
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map(([label, value]) => (
            <KeyValue key={label} label={label} value={value} />
          ))}
        </div>
        {(faculty || venue) && (
          <div className="space-y-0.5">
            {faculty && (
              <p className="text-xs font-bold text-text-heading truncate">{faculty}</p>
            )}
            {venue && (
              <p className="text-[10px] text-text-muted font-medium">
                Venue: {venue}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };
  // Heatmap status colors, shared by the panel and the rectRender override.
  // (0 = no class, 1 = present, 2 = absent, 3 = on duty)
  const HEAT_STATUS_COLORS: Record<number, string> = {
    0: "rgba(156, 163, 175, 0.1)",
    1: "#10B981",
    2: "#EF4444",
    3: "#EAB308",
  };
  // Shared status tones for attendance heroes, rows and pages. The colour half
  // of these used to be four hand-rolled maps declared inside the component,
  // which is exactly what `TONE_TEXT` / `TONE_BADGE` in `@/lib/uiTokens` exist
  // to stop — `ATT_TONE` above is the only lookup this file owns now.
  const scopeAccent = (badge: "Theory" | "Lab") =>
    `w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE[SCOPE_TONE[badge]]}`;

  const renderLogRow = (item: any, d: any, badge: "Theory" | "Lab") => (
    <button onClick={() => setInnerTab(`${badge.toLowerCase()}-log`)} className={LIST_ROW}>
      <div className={scopeAccent(badge)}>
        <Clock className="w-5 h-5" />
      </div>
      <ListRowText
        title={`${badge} Log`}
        subtitle={
          d.total > 0
            ? `${d.attended}/${d.total}${item?.slotVenue ? ` · ${item.slotVenue}` : ""}`
            : "No attendance data"
        }
      />
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-base font-black font-outfit tracking-tight leading-none ${TONE_TEXT[ATT_TONE[d.status] ?? "zinc"]}`}>
          {d.total > 0 ? `${Number(d.pct.toFixed(1))}%` : "—"}
        </span>
        <ChevronRight className="w-4 h-4 text-zinc-400" />
      </div>
    </button>
  );

  const renderPredictorRow = (item: any, d: any, badge: "Theory" | "Lab") => (
    <button onClick={() => setInnerTab(`${badge.toLowerCase()}-predictor`)} className={LIST_ROW}>
      <div className={scopeAccent(badge)}>
        <Target className="w-5 h-5" />
      </div>
      <ListRowText title={`${badge} Predictor`} subtitle={d.marginSubline} />
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-base font-black font-outfit tracking-tight leading-none ${TONE_TEXT[d.marginTone]}`}>
          {d.upcomingTotal > 0 ? `${d.upcomingTotal}` : "—"}
        </span>
        <ChevronRight className="w-4 h-4 text-zinc-400" />
      </div>
    </button>
  );

  const renderAttHeroes = (d: any) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <StatTile
        label="Attendance"
        value={d.total > 0 ? `${Number(d.pct.toFixed(1))}%` : "—"}
        badge={d.status}
        tone={ATT_TONE[d.status] ?? "zinc"}
        sub={d.total > 0 ? `${d.attended}/${d.total} attended` : "No attendance data"}
      />
      <StatTile
        label="Margin"
        value={d.marginHeadline}
        badge={d.status}
        tone={d.marginTone}
        sub={d.marginSubline}
      />
    </div>
  );

  const milestoneBlocks = (d: any) => [
    { key: "CAT1", label: "Classes before CAT I", data: d.classesTillCAT1 },
    { key: "CAT2", label: "Classes before CAT II", data: d.classesTillCAT2 },
    { key: "MIDSEM", label: "Classes before Mid Term Test", data: d.classesTillMidSem },
    { key: "LID", label: "Classes before FAT", data: d.classesTillLID },
  ];

  const renderLogPage = (item: any, d: any, badge: "Theory" | "Lab") => {
    if (!item) {
      return <EmptyPanel variant="dashed" title="No attendance data available for this course." />;
    }
    return (
      <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {renderAttHeroes(d)}
        <div className="space-y-3">
          <SectionHeader icon={Calendar} title="Calendar" />
          <div className={TILE_CARD}>
            <AttendanceCalendarView
              analyzeCalendars={analyzeCalendars}
              historyList={d.historyList}
              notesTracker={notesTracker}
              toggleNotes={(dateStr: string) => toggleNotes(dateStr, item.courseCode)}
              courseCode={item.courseCode}
              isOverall={false}
              toggleIndividualNote={() => {}}
              compact
            />
          </div>
        </div>
        <div className="space-y-3">
          <SectionHeader icon={Grid3x3} title="Heatmap" />
          <div className={TILE_CARD}>
          <div className="flex justify-start w-full overflow-x-auto hide-scrollbar" style={{ direction: "rtl" }}>
            <div style={{ direction: "ltr", minWidth: "500px" }} className="flex flex-col items-center">
              <HeatMap
                value={d.heatmapData}
                startDate={heatmapStartDate}
                endDate={heatmapEndDate}
                width={550}
                rectSize={15}
                space={3}
                legendCellSize={0}
                rectProps={{ rx: 4, ry: 4 }}
                rectRender={(props: any, dayData: any) => {
                  const data = dayData as any;
                  const status = data.count === 1 ? "Present" : data.count === 2 ? "Absent" : data.count === 3 ? "On Duty" : "No Class";
                  // NB: the library resolves discrete count maps to the NEXT
                  // bucket's color (off-by-one), so set the fill explicitly.
                  const fill = typeof data?.count === "number" && HEAT_STATUS_COLORS[data.count]
                    ? HEAT_STATUS_COLORS[data.count]
                    : (props as any).fill;
                  return <rect {...props} fill={fill}><title>{`${data.date}: ${status}`}</title></rect>;
                }}
                panelColors={HEAT_STATUS_COLORS}
              />
              <div className="mt-4">
                <ToneLegend
                  items={[
                    { tone: "emerald", label: "Present" },
                    { tone: "red", label: "Absent" },
                    { tone: "amber", label: "On Duty" },
                  ]}
                />
              </div>
            </div>
          </div>
          </div>
        </div>
        <LogGap />
        <div className="space-y-3" style={{ marginBlockStart: 0 }}>
          <SectionHeader
            icon={Clock}
            title="Log"
            count={d.historyList.length}
            right={
              d.missingNotesCount > 0 ? (
                <ToneBadge tone="red">
                  <StickyNote className="h-3 w-3" />
                  {d.missingNotesCount} missing
                </ToneBadge>
              ) : null
            }
          />
          <div className="px-1">
            <SegmentedControl
              scroll
              value={attFilter}
              onChange={setAttFilter}
              options={[
                { value: "All", label: "All" },
                { value: "Present", label: "Present" },
                { value: "Absent", label: "Absent" },
                { value: "On Duty", label: "On Duty" },
              ]}
            />
          </div>
          {d.filteredHistory.length === 0 ? (
        <EmptyPanel variant="dashed" title="No records under this filter." />

          ) : (
            <ListShell>
              {d.filteredHistory.map((h: any, i: number) => {
                const st = h.status.toLowerCase();
                const isPresent = st === "present";
                const isAbsent = st === "absent";
                const tone = isPresent ? "emerald" : isAbsent ? "red" : "amber";
                const hasNotes = notesTracker[item?.courseCode || ""]?.[h.date] === true;
                return (
                  <div key={i} className={LIST_ROW}>
                    <span className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ATT_DOT[st] ?? "bg-amber-500"}`} />
                      <span className="min-w-0">
                        <span className="block font-bold text-sm text-text-heading truncate font-outfit leading-tight">{h.date}</span>
                        <span className={`block text-[11px] font-medium mt-0.5 ${TONE_TEXT[tone]}`}>{h.status}</span>
                      </span>
                    </span>
                    {!isPresent && (
                      <button
                        onClick={() => toggleNotes(h.date, item?.courseCode || "")}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                          hasNotes
                            ? TONE_BADGE.emerald
                            : "bg-surface-secondary text-text-secondary border-border-muted dark:border-border"
                        }`}
                      >
                        {hasNotes ? <CheckCircle2 size={14} /> : <FileTextIcon size={14} />}
                        <span className="hidden sm:inline">{hasNotes ? "Secured" : "Get Notes"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </ListShell>
          )}
        </div>
      </div>
    );
  };

  const renderPredictorPage = (item: any, d: any, badge: "Theory" | "Lab") => {
    if (!item) {
      return (
        <EmptyPanel variant="dashed" title="No attendance data available for this course." />
      );
    }
    const blocks = milestoneBlocks(d).filter((b) => Array.isArray(b.data) && b.data.length > 0);
    return (
      <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {renderAttHeroes(d)}
        <div className="space-y-4">
          <SectionHeader icon={Activity} title="Predictor" count={d.upcomingTotal} />
          {blocks.length === 0 ? (
      <EmptyPanel variant="dashed" title="No upcoming milestones to simulate." />

          ) : (
            <div className="space-y-2.5">
              {blocks.map(({ key, label, data }) => (
                <div key={key} className={TILE_CARD}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-heading flex items-center gap-2">
                      <CalendarIcon size={16} className="text-blue-500 dark:text-blue-400" />
                      <span>{label}</span>
                    </h3>
                    <ToneBadge tone="blue">{data.length} left</ToneBadge>
                  </div>
                  <UpcomingClassesList
                    classes={data}
                    attendedClasses={item.attendedClasses}
                    totalClasses={item.totalClasses}
                    isLab={item.courseCode?.endsWith("(L)") || false}
                    impDates={impDates}
                    isDayscholarWithBus={isDayscholarWithBus}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const courseGradeHistory = useMemo(() => {
    if (!selectedGroup || !allGradesData?.grades) return [];
    let history: any[] = [];
    const gradeObj = allGradesData.grades;
    
    if (Array.isArray(gradeObj)) {
      history = gradeObj.filter((g: any) => (g.courseCode || g.code) === selectedGroup.courseCode);
    } else {
      for (const [semName, semData] of Object.entries(gradeObj)) {
        const semGrades = (semData as any)?.grades || semData || [];
        const items = Array.isArray(semGrades) ? semGrades : Object.values(semGrades);
        const found = items.filter((g: any) => (g.courseCode || g.code) === selectedGroup.courseCode);
        found.forEach(f => {
          history.push({ ...f, semester: semName });
        });
      }
    }
    return history.filter((v, i, a) => a.findIndex(t => t.semester === v.semester) === i);
  }, [selectedGroup, allGradesData]);

  const renderAssessmentTable = (assessments: any[], typeLabel: string) => {
    if (!assessments || assessments.length === 0) return null;
    const totals = getAssessmentTotals(assessments);
    const tone = SCOPE_TONE[typeLabel as "Theory" | "Lab"] ?? "indigo";
    const remaining = 100 - (totals.weightPercent - totals.weighted);
    return (
      <div className="space-y-3">
        <SectionHeader
          icon={Activity}
          title={`${typeLabel} assessments`}
          count={assessments.length}
          right={
            <ToneBadge tone={tone}>
              {formatNumber(totals.weighted)} / {formatNumber(totals.weightPercent)}
            </ToneBadge>
          }
        />
        <p className="px-1 -mt-1 text-[11px] text-text-secondary dark:text-text-muted font-medium">
          {formatNumber(remaining)} weightage points still available across these {assessments.length}{" "}
          assessment{assessments.length === 1 ? "" : "s"}.
        </p>
        <ListShell>
          {assessments.map((detail: any, idx: number) => {
            const aStat = asmStats[detail.title];
            return (
              <AssessmentRow
                key={`${detail.title}-${idx}`}
                detail={detail}
                typeLabel={typeLabel}
                aStat={aStat}
                isRelative={isRelative}
              />
            );
          })}
        </ListShell>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 md:pb-8 animate-in fade-in duration-300">
      {/* ── HEADER (OD hours page arrangement) ── */}
      <div className="px-1">
        <div className="mb-5 flex">
          <BackButton onClick={handleBack} className="self-start" />
        </div>
        <TitleBlock
          eyebrow={
            <>
              Academics &middot;{" "}
              {selectedGroup?.semesterSubId && selectedGroup.semesterSubId !== "Current"
                ? formatSemesterName(selectedGroup.semesterSubId)
                : "Current Semester"}
            </>
          }
          title={selectedCode}
          subtitle={selectedGroup?.courseTitle || ""}
        />
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* OVERVIEW — SimplifiedMobileHome + OD page vibe */}
      {innerTab === "overview" && (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* ── HERO STATS ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* CARD 1: ATTENDANCE CAROUSEL (theory + lab rotate on their own) */}
          <InsightCarousel
            slides={ovAttInsightSlides}
            carousel={ovAttCarousel}
            height="min-h-36 sm:min-h-40"
            ariaLabel="Attendance insights"
          />
          
          {/* CARD 2: MARKS CAROUSEL (combined + theory + lab) */}
          <InsightCarousel
            slides={ovMarksInsightSlides}
            carousel={ovActiveCarousel}
            headlineSize="lg"
            height="min-h-36 sm:min-h-40"
            interactiveDots
            ariaLabel="Marks insights"
          />
          </div>

          {/* ── COURSE SECTIONS (joined grouped list) ── */}
          <div className="space-y-4">
            <SectionHeader
              icon={BookOpen}
              title="Course sections"
              count={isEmbedded && theoryAttItem && labAttItem ? 8 : 6}
            />
            {/* Joined grouped list: single shell, dividers, curves only on outer top/bottom */}
            <ListShell>
              {/* Log + Predictor — split per component when embedded */}
              {isEmbedded && theoryAttItem && labAttItem ? (
                <>
                  {renderLogRow(theoryAttItem, theoryData, "Theory")}
                  {renderLogRow(labAttItem, labData, "Lab")}
                  {renderPredictorRow(theoryAttItem, theoryData, "Theory")}
                  {renderPredictorRow(labAttItem, labData, "Lab")}
                </>
              ) : (
                <>
                  {renderLogRow(theoryAttItem || labAttItem, (theoryAttItem ? theoryData : labData), theoryAttItem ? "Theory" : "Lab")}
                  {renderPredictorRow(theoryAttItem || labAttItem, (theoryAttItem ? theoryData : labData), theoryAttItem ? "Theory" : "Lab")}
                </>
              )}
              {/* Marks */}
              <button onClick={() => ovGo("marks")} className={LIST_ROW}>
                <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.indigo}`}>
                  <Target className="w-5 h-5" />
                </span>
                <ListRowText
                  title="Marks"
                  subtitle={
                    isEmbedded
                      ? `Theory ${formatNumber(ovTheoryTotals.weighted)}/${formatNumber(ovTheoryTotals.weightPercent)} · Lab ${formatNumber(ovLabTotals.weighted)}/${formatNumber(ovLabTotals.weightPercent)}`
                      : String(courseTotalString)
                  }
                />
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-indigo-600 dark:text-indigo-400">
                    {isSelectedPastSemester && selectedPastGrade ? `Grade ${selectedPastGrade}` : `${courseStats.projected}%`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </span>
              </button>
              {/* Grade History */}
              <button onClick={() => ovGo("grades")} className={LIST_ROW}>
                <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.emerald}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <ListRowText
                  title="Grades"
                  subtitle={`${isRelative ? "Relative grading" : "Absolute grading"}${courseGradeHistory.length > 0 ? ` · ${courseGradeHistory.length} record${courseGradeHistory.length === 1 ? "" : "s"}` : ""}`}
                />
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-text-heading">
                    {selectedPastGrade ? `Grade ${selectedPastGrade}` : `${courseStats.projected}%`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </span>
              </button>
              {/* Course Plan */}
              <button onClick={() => ovGo("plan")} className={LIST_ROW}>
                <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.amber}`}>
                  <FileText className="w-5 h-5" />
                </span>
                <ListRowText
                  title="Review Course Details"
                  subtitle={`${mainCourse?.faculty || "Faculty N/A"}${mainCourse?.courseType ? ` · ${isEmbedded ? "Embedded" : mainCourse.courseType}` : ""}`}
                />
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black font-outfit tracking-tight leading-none text-text-heading truncate max-w-24">
                    {mainCourse?.slot || "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </span>
              </button>
              {/* QBank */}
              <button onClick={() => ovGo("qbank")} className={LIST_ROW}>
                <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.violet}`}>
                  <Sparkles className="w-5 h-5" />
                </span>
                <ListRowText title="QBank" subtitle="Papers & extracted questions" />
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-text-heading">
                    {(selectedGroup?.theory?.assessments?.length || 0) + (selectedGroup?.lab?.assessments?.length || 0)} tests
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </span>
              </button>
              {/* Tasks & Homework */}
              <div className={LIST_ROW}>
                <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.emerald}`}>
                  <CheckSquare className="w-5 h-5" />
                </span>
                <ListRowText
                  title="Tasks & Homework"
                  subtitle={`${tasks.filter((t) => t.courseCode === selectedCode && t.status !== "done").length} pending task(s)`}
                />
                <button
                  type="button"
                  onClick={() => setIsTaskSheetOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-tertiary dark:bg-surface-secondary text-text-secondary dark:text-text-muted border border-border-muted dark:border-border hover:bg-border-muted dark:hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            </ListShell>

          </div>
        </div>
      )}

      {/* MARKS */}
      {innerTab === "marks" && (
        <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* HERO STATS (overview format) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {isSelectedPastSemester && selectedPastGrade ? (
              <>
                <StatTile
                  label="Final Grade"
                  value={`Grade ${selectedPastGrade}`}
                  badge="Final"
                  tone="emerald"
                  sub="Published grade"
                />
                <StatTile
                  label="Grading"
                  value={isRelative ? "Relative" : "Absolute"}
                  badge="System"
                  tone="indigo"
                  sub={
                    courseGradeHistory.length > 0
                      ? `${courseGradeHistory.length} record${courseGradeHistory.length === 1 ? "" : "s"}`
                      : "Grade history"
                  }
                />
              </>
            ) : (
              <>
                <StatTile
                  label="Total Score"
                  value={String(courseTotalString)}
                  badge="Marks"
                  tone="neutral"
                  sub={courseTypeLabel}
                />
                <StatTile
                  label="Projected"
                  value={`${courseStats.projected}%`}
                  badge="Forecast"
                  tone="blue"
                  sub={`Max potential ${formatNumber(courseStats.maxPossible)}%`}
                />
              </>
            )}
          </div>

          {!isSelectedPastSemester && (
            <button
              type="button"
              onClick={() => setActiveSubTab?.("marks-predictor")}
              className={`${TILE_CARD} w-full flex items-center gap-3 text-left cursor-pointer hover:border-border-strong dark:hover:border-border transition-colors`}
            >
              <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.violet}`}>
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-heading font-outfit tracking-tight">
                  Simulate marks &amp; regimen
                </span>
                <span className="block text-[11px] text-text-secondary dark:text-text-muted font-medium mt-0.5 truncate">
                  What-if scores, points lost and the exact FAT target
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            </button>
          )}

          {renderAssessmentTable(selectedGroup?.theory?.assessments, "Theory")}
          {renderAssessmentTable(selectedGroup?.lab?.assessments, "Lab")}

          {(!selectedGroup?.theory?.assessments?.length && !selectedGroup?.lab?.assessments?.length) && (
            <EmptyPanel
              icon={<Activity className="w-7 h-7" />}
              tone="indigo"
              variant="dashed"
              title="No assessment data available"
              description="Pull fresh marks from VTOP and every assessment, its weightage and your score will collect here."
            />
          )}

          {/* Grade Insights */}
          <div className="space-y-3">
            <SectionHeader
              icon={Gauge}
              title="Grade insights"
              right={<ToneBadge tone="blue">Beta</ToneBadge>}
            />
            <details className="group text-[11px] leading-relaxed text-text-secondary dark:text-text-muted">
              <summary className="cursor-pointer list-none inline-flex items-center gap-1 font-semibold text-text-heading hover:underline">
                <Info className="h-3.5 w-3.5" /> How this works &amp; why it is safe
              </summary>
              <div className={`${TILE_CARD} mt-3 space-y-2 text-[11px] font-medium`}>
                <p>
                  <strong>Proof of concept:</strong> an accurate class curve needs the class
                  average and standard deviation, which means aggregating the marks of every
                  student. That cannot be done securely on your device alone — your device would
                  need the rest of the class&apos;s performance to work out your relative rank.
                </p>
                <p>
                  <strong>Privacy first:</strong> when you sync fresh marks, your client
                  transmits only the changes, wrapped in a scrambled anonymous hash of your ID
                  so the server can skip a duplicate. The server aggregates the numbers
                  in-memory with Welford&apos;s algorithm, updates the class-wide statistics and
                  then <strong>immediately discards</strong> them. Your individual marks are
                  never stored.
                </p>
              </div>
            </details>
            {isRelative && stats && stats.count > 0 && stats.count < 30 && (
              <div className="flex items-center gap-2 px-1">
                <ToneBadge tone="amber">{stats.count} samples</ToneBadge>
                <span className="text-[11px] text-text-muted font-medium">
                  Relative predictions stay rough until more peers sync.
                </span>
              </div>
            )}
            {frozenCount > 0 && (
              <div className="flex items-center gap-2 px-1">
                <ToneBadge tone="zinc">{frozenCount} pinned</ToneBadge>
                <span className="text-[11px] text-text-muted font-medium">
                  These assessments stand as recorded — this device has no earlier mark
                  to update them from. Syncing from a device with full history unpins them.
                </span>
              </div>
            )}
          </div>

            <div className="space-y-3">
            {isRelative ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <StatTile
                  label="Samples"
                  value={stats ? String(stats.count) : "—"}
                  badge="Class"
                  tone="neutral"
                  sub="peers synced"
                  height="h-28"
                />
                <StatTile
                  label="Mean"
                  value={stats ? formatNumber(stats.mean) : "—"}
                  badge="Class"
                  tone="neutral"
                  sub="average score"
                  height="h-28"
                />
                <StatTile
                  label="Std Dev"
                  value={stats ? formatNumber(stats.sd) : "—"}
                  badge="Spread"
                  tone="neutral"
                  sub="class deviation"
                  height="h-28"
                />
              </div>
            ) : (
              <div className={`${TILE_CARD} flex items-center gap-3.5`}>
                <span className={`h-11 w-11 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.emerald}`}>
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-text-heading font-outfit tracking-tight">
                    Absolute grading enforced
                  </h4>
                  <p className="text-[11px] text-text-secondary dark:text-text-muted font-medium mt-0.5">
                    Your grade comes from fixed percentage boundaries, not from how the class
                    performed.
                  </p>
                </div>
              </div>
            )}
            </div>

            <div className="space-y-4">
                {(() => {
                  const mean = isRelative ? (stats?.mean || 0) : 0;
                  const sd = isRelative ? (stats?.sd || 0) : 0;
                  let sBoundary: number, aLower: number, bLower: number, cLower: number, dLower: number, eLower: number;
                  if (isRelative && stats) {
                    sBoundary = Math.min(Math.max(Math.round(mean + 1.5 * sd), 80), 100);
                    aLower = Math.round(mean + 0.5 * sd);
                    bLower = Math.round(mean - 0.5 * sd);
                    cLower = Math.round(mean - 1.0 * sd);
                    dLower = Math.round(mean - 1.5 * sd);
                    eLower = Math.min(Math.round(mean - 2.0 * sd), 50);
                  } else {
                    sBoundary = 90; aLower = 80; bLower = 70; cLower = 60; dLower = 50; eLower = 40;
                  }

                  // `width` is how many percentage points the band spans, so the
                  // bar reads as "how much room is in this grade" rather than a
                  // second copy of the threshold.
                  const boundaries = [
                    { grade: "S", limit: sBoundary, width: 100 - sBoundary, range: `≥ ${sBoundary}` },
                    { grade: "A", limit: aLower, width: sBoundary - aLower, range: `≥ ${aLower}` },
                    { grade: "B", limit: bLower, width: aLower - bLower, range: `≥ ${bLower}` },
                    { grade: "C", limit: cLower, width: bLower - cLower, range: `≥ ${cLower}` },
                    { grade: "D", limit: dLower, width: cLower - dLower, range: `≥ ${dLower}` },
                    { grade: "E", limit: eLower, width: dLower - eLower, range: `≥ ${eLower}` },
                    { grade: "F", limit: 0, width: eLower, range: `< ${eLower}` },
                  ];

                  const targetBoundary = boundaries.find(b => b.grade === targetGrade)?.limit || 0;
                  let theoryScored = 0, theoryPercent = 0;
                  let labScored = 0, labPercent = 0;
                  if (selectedGroup?.theory) {
                    const t = getAssessmentTotals(selectedGroup.theory.assessments || []);
                    theoryScored = t.weighted; theoryPercent = t.weightPercent;
                  }
                  if (selectedGroup?.lab) {
                    const t = getAssessmentTotals(selectedGroup.lab.assessments || []);
                    labScored = t.weighted; labPercent = t.weightPercent;
                  }
                  const theoryCredits = selectedGroup?.theory ? getCourseCredits(selectedGroup.theory) : 0;
                  const labCredits = selectedGroup?.lab ? getCourseCredits(selectedGroup.lab) : 0;
                  const totalCredits = theoryCredits + labCredits;
                  const currentWeightedScore = totalCredits > 0 ? ((theoryCredits * theoryScored) + (labCredits * labScored)) / totalCredits : theoryScored;
                  const currentWeightPercent = totalCredits > 0 ? ((theoryCredits * theoryPercent) + (labCredits * labPercent)) / totalCredits : theoryPercent;

                  // The ladder is a 0-100 percentage scale; the two figures above are
                  // raw weightage-point totals, which mid-term are out of whatever has
                  // been released rather than out of 100. Comparing them directly put a
                  // student on a genuine 90% into band D. So normalise before comparing,
                  // and convert the target back onto the raw scale before subtracting.
                  const currentPct = normalisedPct(currentWeightedScore, currentWeightPercent);
                  const requiredPoints = currentWeightPercent > 0
                    ? (targetBoundary / 100) * currentWeightPercent
                    : 0;
                  const remainingWeightagePoints = requiredPoints - currentWeightedScore;

                  // The band the student is standing in right now. Drives the
                  // "You are here" marker and the target-grade emphasis.
                  const standing = boundaries.find(b => currentPct >= b.limit);
                  const statsMissing = isRelative && !stats;

                  return (
                    <>
                      <div className="space-y-3">
                        <SectionHeader
                          icon={Gauge}
                          title="Grade boundaries"
                          count={boundaries.length}
                          right={
                            statsMissing ? <ToneBadge tone="zinc">Awaiting class data</ToneBadge> : null
                          }
                        />
                        <p className="px-1 -mt-1 text-[11px] leading-relaxed text-text-secondary dark:text-text-muted font-medium">
                          {isRelative
                            ? "Bands are drawn from your class's mean and spread, so they move as more peers sync."
                            : "Fixed percentage boundaries. The widest band is where the most marks sit."}
                        </p>
                        {/* One proportional bar rather than seven stacked rows: on a
                            phone a row per grade is a wall of scrolling, and the
                            only thing each row said was a letter and a number. */}
                        <div className={`${TILE_CARD} ${statsMissing ? "opacity-60 grayscale" : ""}`}>
                          <div className="flex h-10 w-full gap-0.5 overflow-hidden">
                            {boundaries.map((b) => (
                              <div
                                key={b.grade}
                                title={`Grade ${b.grade} · ${b.range}`}
                                style={{ flexGrow: Math.max(b.width, 1.5), flexBasis: 0, flexShrink: 1 }}
                                className={`min-w-0 flex items-center justify-center rounded-lg ${
                                  GRADE_TINT[b.grade] ?? "bg-zinc-500/10"
                                } ${standing?.grade === b.grade && !statsMissing ? "ring-2 ring-inset ring-indigo-500" : ""}`}
                              >
                                <span className={`text-[11px] font-black font-outfit ${TONE_TEXT[toneForGrade(b.grade)]}`}>
                                  {b.grade}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
                            {boundaries.map((b) => (
                              <span key={b.grade} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${GRADE_BAR[b.grade] ?? "bg-zinc-400"}`} />
                                {b.grade} {b.range}
                              </span>
                            ))}
                          </div>

                          {standing && !statsMissing && (
                            <p className="mt-2.5 text-[11px] font-bold text-text-heading">
                              On {currentPct.toFixed(1)}% of released weightage — inside the{" "}
                              <span className={TONE_TEXT[toneForGrade(standing.grade)]}>{standing.grade}</span> band.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <SectionHeader icon={Target} title="Target grade" />
                        <ListShell>
                          <div className={LIST_ROW}>
                            <span className="w-32 shrink-0">
                              <SelectField
                                value={targetGrade}
                                onChange={(val) => setTargetGrade(val)}
                                options={["S", "A", "B", "C", "D", "E"].map((g) => ({
                                  value: g,
                                  label: `Grade ${g}`,
                                }))}
                                searchable={false}
                                size="md"
                                stacked
                                role="group"
                                aria-label="Target grade"
                              />
                            </span>
                            <span className="min-w-0 flex-1 space-y-1.5">
                              <ListRowText
                                title={
                                  remainingWeightagePoints <= 0
                                    ? "Target achieved"
                                    : remainingWeightagePoints > (100 - currentWeightPercent)
                                      ? "Out of reach"
                                      : "Points still needed"
                                }
                                subtitle={`Needs ${targetBoundary}% · you are on ${currentPct.toFixed(1)}% of the ${currentWeightPercent.toFixed(0)} points released`}
                              />
                              <MiniBar
                                pct={Math.max(0, Math.min(100, currentPct))}
                                tone={
                                  remainingWeightagePoints <= 0
                                    ? "bg-emerald-500"
                                    : remainingWeightagePoints > (100 - currentWeightPercent)
                                      ? "bg-red-500"
                                      : "bg-indigo-500"
                                }
                              />
                            </span>
                            <span className="shrink-0">
                              {remainingWeightagePoints <= 0 ? (
                                <ToneBadge tone="emerald" size="lg" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                  Achieved
                                </ToneBadge>
                              ) : remainingWeightagePoints > (100 - currentWeightPercent) ? (
                                <ToneBadge tone="red" size="lg">Impossible</ToneBadge>
                              ) : (
                                <ToneBadge tone="indigo" size="lg">
                                  +{remainingWeightagePoints.toFixed(1)} pts
                                </ToneBadge>
                              )}
                            </span>
                          </div>
                        </ListShell>
                      </div>
                    </>
                  );
                })()}
              </div>
        </div>
      )}

      {/* THEORY LOG — OD-hours style dedicated page */}
      {effectiveTab === "theory-log" && renderLogPage(theoryAttItem, theoryData, "Theory")}

      {/* LAB LOG */}
      {effectiveTab === "lab-log" && renderLogPage(labAttItem, labData, "Lab")}

      {/* THEORY PREDICTOR */}
      {effectiveTab === "theory-predictor" && renderPredictorPage(theoryAttItem, theoryData, "Theory")}

      {/* LAB PREDICTOR */}
      {effectiveTab === "lab-predictor" && renderPredictorPage(labAttItem, labData, "Lab")}

      {/* COURSE PLAN - Full tables without truncation */}
      {innerTab === "plan" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 mt-4">
          {/* 1 ── COURSE DETAILS */}
          <div className="space-y-4">
            <SectionHeader icon={BookOpen} title="Course details" />
            {isEmbedded ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renderCourseDetailCard(selectedGroup.theory, theoryAttItem, "Theory")}
                {renderCourseDetailCard(selectedGroup.lab, labAttItem, "Lab")}
              </div>
            ) : (
              renderCourseDetailCard(mainCourse, theoryAttItem || labAttItem, null)
            )}
          </div>

          {/* 2 ── COURSE PLAN TABLES (theory / lab separated) */}
          <div className="space-y-4">
            <SectionHeader icon={FileText} title="Course syllabus & plan" />

            {planLoading ? (
              <ListSkeleton rows={4} />
            ) : coursePlan && coursePlan.length > 0 ? (
              <div className="space-y-6">
                {reviewScopes.map((scope) => {
                  const entries = planEntriesByScope(scope);
                  if (entries.length === 0) return null;
                  const showBadge = reviewScopes.filter((s) => planEntriesByScope(s).length > 0).length > 1;
                  return (
                    <div key={scope} className="space-y-4">
                      {showBadge && (
                        <div className="px-1">{renderScopeBadge(scope)}</div>
                      )}
                      {entries.map((cp: any, ci: number) => (
                        <div key={ci} className="space-y-4">
                          {cp.data.tables?.map((t: any, ti: number) => (
                            <div key={ti} className={TILE_CARD}>
                              {t.caption && <h4 className="mb-4 text-[11px] font-black text-text-muted uppercase tracking-wider">{t.caption}</h4>}
                              <div className="overflow-x-auto hide-scrollbar">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border-muted dark:border-border">
                                      {t.headers?.map((h: string, hi: number) => (
                                        <th key={hi} className="text-left py-3 px-3 text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.rows?.map((row: any, ri: number) => (
                                      <tr key={ri} className="border-b border-border-muted/60 dark:border-border/60 last:border-0 hover:bg-surface-secondary dark:hover:bg-surface-hover/40 transition-colors">
                                        {t.headers.map((h: string, hi: number) => (
                                          <td key={hi} className="py-3 px-3 text-sm font-medium text-text-secondary dark:text-text-secondary">
                                            {row[h] || "—"}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel variant="dashed" title="Course plan is unavailable or loading." />
            )}
          </div>

          {/* Schedule toggle */}
          <div className="space-y-4">
            <SectionHeader
              icon={Calendar}
              title="Weekly schedule"
              right={
                <button
                  type="button"
                  onClick={() => { if (viewDetail) setViewDetail(null); else fetchViewDetail(); }}
                  disabled={viewLoading}
                  className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-surface-tertiary dark:bg-surface-secondary text-text-secondary dark:text-text-muted hover:bg-border-muted dark:hover:bg-surface-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {viewLoading ? "Loading..." : viewDetail ? "Hide schedule" : "Load schedule"}
                </button>
              }
            />
            {viewDetail && (
              <div className={TILE_CARD}>
                {reviewScopes.map((scope) => {
                  const entries = detailEntriesByScope(scope);
                  if (entries.length === 0) return null;
                  const showBadge = reviewScopes.filter((s) => detailEntriesByScope(s).length > 0).length > 1;
                  return (
                    <div key={scope} className="space-y-4">
                      {showBadge && renderScopeBadge(scope)}
                      {entries.map((vd: any, ci: number) => (
                        <div key={ci} className="space-y-4">
                          {vd.data.tables?.slice(1).map((t: any, ti: number) => (
                            <div key={ti} className="overflow-x-auto hide-scrollbar">
                              {t.caption && <h5 className="mb-3 text-[10px] font-black text-text-muted uppercase tracking-widest">{t.caption}</h5>}
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border-muted dark:border-border">
                                    {t.headers?.map((h: string, hi: number) => (
                                      <th key={hi} className="text-left py-2 px-2 text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.rows?.map((row: any, ri: number) => (
                                    <tr key={ri} className="border-b border-border-muted/60 dark:border-border/60 last:border-0 hover:bg-surface-secondary dark:hover:bg-surface-hover/40 transition-colors">
                                      {t.headers.map((h: string, ci: number) => (
                                        <td key={ci} className="py-2.5 px-2 text-sm font-medium text-text-secondary dark:text-text-secondary whitespace-nowrap">{row[h] || "—"}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4 ── QUALITY CIRCLE MEETING (QCM) */}
          <div className="space-y-4">
            <SectionHeader
              icon={MessageSquare}
              title="Quality Circle Meeting"
              count={qcmData?.length}
              right={
                !qcmData ? (
                  <button
                    type="button"
                    onClick={fetchQcmForCourse}
                    disabled={qcmLoading}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-surface-tertiary dark:bg-surface-secondary text-text-secondary dark:text-text-muted hover:bg-border-muted dark:hover:bg-surface-hover disabled:opacity-50 transition-colors cursor-pointer w-fit"
                  >
                    {qcmLoading ? "Loading..." : "Load QCM data"}
                  </button>
                ) : null
              }
            />

               {qcmError && <p className="px-1 text-sm text-red-500">{qcmError}</p>}

               {qcmData && qcmData.length === 0 && (
                 <EmptyPanel variant="dashed" title={`No QCM data for ${selectedCode} this semester.`} />
               )}

               {qcmData && qcmData.length > 0 && (
                 <div className="space-y-4">
                   {qcmData.map((table: any, ti: number) => (
                      <div key={ti} className="space-y-4">
                        {table.caption && <p className="px-1 text-sm font-semibold text-text-secondary dark:text-text-muted">{table.caption}</p>}
                        {table.rows.map((row: any, ri: number) => {
                          const findCol = (keywords: string[]) => {
                             const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                             return key ? row[key] : null;
                          };

                          const qcmNo = findCol(["qcm no", "qcm"]);
                          const action = findCol(["action"]);
                          const suggestions = findCol(["suggestion", "feedback", "remarks"]);
                          const facultyReply = findCol(["faculty reply", "faculty comment"]);
                          const hodComments = findCol(["hod comment", "hod reply", "hod"]);

                          return (
                            <div key={ri} className={TILE_CARD}>
                               <div className="mb-3 flex justify-between items-center gap-2">
                                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">QCM {qcmNo || ri + 1}</span>
                                  {action && <ToneBadge tone="blue">{action}</ToneBadge>}
                               </div>
                               <div className="space-y-3">
                                  {suggestions && (
                                     <div>
                                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Suggestions / Feedback</p>
                                        <p className="text-sm text-text-heading">{suggestions}</p>
                                     </div>
                                  )}
                                  {facultyReply && (
                                     <div className="border-l-2 border-emerald-200 pl-3 dark:border-emerald-900/50">
                                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Faculty Reply</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary">{facultyReply}</p>
                                     </div>
                                  )}
                                  {hodComments && (
                                     <div className="border-l-2 border-violet-200 pl-3 dark:border-violet-900/50">
                                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">HOD Comments</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary">{hodComments}</p>
                                     </div>
                                  )}
                               </div>
                            </div>
                          );
                        })}
                      </div>
                   ))}
                 </div>
               )}
               </div>
        </div>
      )}

      {/* QBANK */}
      {innerTab === "qbank" && selectedCode && (
        <CourseQBankTab courseCode={selectedCode} username={creds?.authorizedID || "unknown"} />
      )}

{/* GRADES HISTORY */}
      {innerTab === "grades" && (
        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader
            icon={BookOpen}
            title="Grade history"
            count={courseGradeHistory.length}
          />
          {courseGradeHistory.length === 0 ? (
            <EmptyPanel
              variant="dashed"
              title="No past grades for this course"
              description="Once VTOP publishes a result for this course, every term and its breakdown collects here."
            />
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border-muted dark:before:border-border before:from-transparent before:via-border-muted before:to-transparent">
              {courseGradeHistory.map((gh: any, idx: number) => {
                const isCurrent = gh.semester === "Current";
                const letter = gh.grade || gh.courseGrade || "N/A";
                return (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface dark:border-background bg-surface dark:bg-surface-secondary text-indigo-500 shadow-xs shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform duration-300 group-hover:scale-110">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    </div>

                    <div className={`${TILE_CARD} w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-xs transition-all duration-300`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 truncate">
                            {isCurrent ? "Current semester" : formatSemesterName(gh.semester || "") || "Unknown semester"}
                          </p>
                          <p className="text-sm font-bold text-text-heading font-outfit truncate">
                            {gh.courseTitle || selectedGroup?.courseTitle}
                          </p>
                        </div>
                        <ToneBadge tone={toneForGrade(letter)} size="lg">
                          {letter}
                        </ToneBadge>
                      </div>

                      {gh.details && gh.details.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border-muted dark:border-border">
                          <div className="space-y-4">
                            {(() => {
                               const types = Array.from(new Set(gh.details.map((d: any) => d.type || "Theory")));
                               const showLabels = types.length > 1;
                               return types.map((typeLabel: any) => {
                                 const typeDetails = gh.details.filter((d: any) => (d.type || "Theory") === typeLabel);
                                 return (
                                   <div key={typeLabel}>
                                     {showLabels && (
                                       <h5 className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                                         {typeLabel}
                                       </h5>
                                     )}
                                     <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                       {typeDetails.map((detail: any, dIdx: number) => (
                                         <KeyValue
                                           key={dIdx}
                                           label={detail.component}
                                           value={`${detail.scoredMark} / ${detail.maxMark}`}
                                         />
                                       ))}
                                     </div>
                                   </div>
                                 );
                               });
                            })()}
                          </div>
                        </div>
                      )}

                      {gh.range && (
                        <div className="mt-4 pt-4 border-t border-border-muted dark:border-border space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                            Grade ranges
                          </p>
                          <ListShell>
                            {Object.entries(gh.range).map(([grade, rangeStr]: any, rIdx: number) => (
                              <div key={rIdx} className={LIST_ROW}>
                                <span className="w-10 shrink-0">
                                  <ToneBadge tone={toneForGrade(grade)}>{grade}</ToneBadge>
                                </span>
                                <span className="min-w-0 flex-1" />
                                <span className="shrink-0 text-[11px] font-bold text-text-secondary dark:text-text-muted truncate">
                                  {rangeStr as string}
                                </span>
                              </div>
                            ))}
                          </ListShell>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Task Edit Sheet */}
      <TaskEditSheet
        isOpen={isTaskSheetOpen}
        initialCourseCode={selectedCode}
        initialComponent={isEmbedded ? "both" : "theory"}
        onClose={() => setIsTaskSheetOpen(false)}
        onSave={(draft) => {
          const updated = createTask(draft);
          setTasks(updated);
        }}
      />
    </div>
  );
}

