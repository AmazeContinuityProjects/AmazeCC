"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/sync-engine";
import { BackButton } from "../shared";
import CircularProgress from "../shared/CircularProgress";
import Badge from "../shared/Badge";
import { Skeleton, SubTabStrip } from "@amazecontinuityprojects/amazeui";
import {
  XCircle, BookOpen, User, Target, Clock, Info, Activity,
  ChevronLeft, ChevronRight, FileText, Calendar, Calendar as CalendarIcon, MessageSquare,
  Building2, AlertCircle, Star, Grid3x3, List, CheckCircle2,
  FileText as FileTextIcon, Search, ChevronDown, Sparkles
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { useOverlayBack } from "@/lib/overlayStack";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { countRemainingClasses, UpcomingClassesList } from "../attendance/AttendanceSubpage";
import config from '../../../../config.json';
import HeatMap from "@uiw/react-heat-map";
import dynamic from "next/dynamic";
import CourseQBankTab from "./CourseQBankTab";
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
  checkIsRelative,
  Card,
  AssessmentCard,
} from "./courseHelpers";

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
  initialEmbeddedScope?: "theory" | "lab";
  onBack: () => void;
}

export default function CourseDetailSubpage({
  marksData, attendanceData, allGradesData, pastSemesterData, loginToVTOP, setActiveSubTab,
  calendars, decimalValues, isDayscholarWithBus,
  selectedCode, initialTab, initialEmbeddedScope, onBack
}: CourseDetailSubpageProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const credsRef = useRef<Creds | null>(null);
  const [innerTab, setInnerTab] = useState(initialTab || "overview");
  const [coursePlan, setCoursePlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStats, setAllStats] = useState<Record<string, any>>({});
  const [embeddedScope, setEmbeddedScope] = useState<"theory" | "lab">(initialEmbeddedScope || "theory");

  const [qcmData, setQcmData] = useState<any>(null);
  const [qcmLoading, setQcmLoading] = useState(false);
  const [qcmError, setQcmError] = useState("");
  const [ovActiveSlide, setOvActiveSlide] = useState(0);
  const [ovCarouselPaused, setOvCarouselPaused] = useState(false);
  const [ovAttSlide, setOvAttSlide] = useState(0);
  const [ovAttPaused, setOvAttPaused] = useState(false);

  // Attendance tab state
  const [attFilter, setAttFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "heatmap" | "calendar">("list");
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
    setOvActiveSlide(0); setOvAttSlide(0);
    setInnerTab(initialTab || "overview");
    setEmbeddedScope(initialEmbeddedScope || "theory");
  }, [selectedCode, initialTab, initialEmbeddedScope]);

  // System back (incl. Android predictive back) walks the in-course hierarchy —
  // subtab -> overview -> course list — instead of falling through to screen
  // history and landing on home. Mirrors the in-app BackButton order.
  useOverlayBack("course-subpage", innerTab === "overview", onBack);
  useOverlayBack("course-subpage-tab", innerTab !== "overview", () => {
    setOvActiveSlide(0);
    setOvAttSlide(0);
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

  useEffect(() => {
    if (!marksData?.courses) return;
    const fetchStats = async () => {
      try {
        const classIds = uniqueCourses.map(g => (g.theory || g.lab).classNbr).join(",");
        if (!classIds) return;
        const res = await api("marks/stats", { query: { classes: classIds }, parse: "raw" }) as Response;
        if (res.ok) { const d = await res.json(); setAllStats(d); }
      } catch {}
    };
    fetchStats();
  }, [marksData]);

  const selectedGroup = useMemo(() => uniqueCourses.find(c => c.courseCode === selectedCode), [selectedCode, uniqueCourses]);
  const mainCourse = selectedGroup?.theory || selectedGroup?.lab;

  const { theoryAttItem, labAttItem, attendanceItem } = useMemo(() => {
    if (!selectedCode) return { theoryAttItem: null, labAttItem: null, attendanceItem: null };
    
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
      labAttItem: labItem,
      attendanceItem: embeddedScope === "lab" && labItem ? labItem : theoryItem
    };
  }, [attendanceData, selectedCode, embeddedScope]);

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

  const toggleNotes = (dateStr: string) => {
    const key = attendanceItem?.courseCode || "";
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
      const components = [];
      if (selectedGroup.theory) components.push(selectedGroup.theory);
      if (selectedGroup.lab) components.push(selectedGroup.lab);
      const planData: any[] = [];
      for (const comp of components) {
        const resolvedFaculty = await resolveFacultyForComp(comp);
        const d = await api("course-page", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: {
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { semesterSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), courseCode: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          },
        }) as any;
        if (d.success !== false && d.results) planData.push({ type: comp.courseType, data: d.results });
      }
      setCoursePlan(planData.length > 0 ? planData : null);
    } catch (err: any) { setError(err.message); }
    finally { setPlanLoading(false); }
  };

  const fetchViewDetail = async () => {
    if (!selectedGroup || !creds) return;
    setViewLoading(true); setError(null);
    try {
      const components = [];
      if (selectedGroup.theory) components.push(selectedGroup.theory);
      if (selectedGroup.lab) components.push(selectedGroup.lab);
      const detailData: any[] = [];
      for (const comp of components) {
        const resolvedFaculty = await resolveFacultyForComp(comp);
        const erpId = resolvedFaculty?.split("-")[0]?.trim() || "";
        const d = await api("course-page", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: {
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { viewDetail: "true", semSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), erpId, classId: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          },
        }) as any;
        if (d.success !== false && d.results) detailData.push({ type: comp.courseType, data: d.results });
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
      setOvActiveSlide(0);
      setOvAttSlide(0);
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
  const historyList = Array.isArray(attendanceItem?.viewLink) ? attendanceItem.viewLink : [];
  const filteredHistory = historyList.filter((d: any) => {
    if (attFilter === "All") return true;
    return d.status.toLowerCase() === attFilter.toLowerCase();
  });
  const missingNotesCount = historyList.filter((d: any) =>
    d.status.toLowerCase() !== "present" &&
    !notesTracker[attendanceItem?.courseCode || ""]?.[d.date]
  ).length;

  const isLabAtt = attendanceItem?.courseCode?.endsWith("(L)");
  const isTheoryAtt = attendanceItem?.courseCode?.endsWith("(T)");

  let classesTillCAT1: any[] | null = null;
  let classesTillCAT2: any[] | null = null;
  let classesTillMidSem: any[] | null = null;
  let classesTillLID: any[] | null = null;

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
      attendanceItem?.courseCode || "",
      attendanceItem?.time || "",
      dayCardsMap,
      filteredMonths,
      new Date()
    );
  };

  if (Array.isArray(analyzeCalendars) && analyzeCalendars.length > 0) {
      const allMonthsAreHolidays = analyzeCalendars.every((month: any) => month?.summary?.working === 0);
      if (!allMonthsAreHolidays) {
          if (isLabAtt) {
              classesTillCAT1 = countTillDate(impDates.cat1Date);
              classesTillCAT2 = countTillDate(impDates.cat2Date);
              classesTillMidSem = countTillDate(impDates.midsemStart);
              classesTillLID = countTillDate(impDates.lidLabDate);
          } else if (isTheoryAtt) {
              classesTillCAT1 = countTillDate(impDates.cat1Date);
              classesTillCAT2 = countTillDate(impDates.cat2Date);
              classesTillMidSem = countTillDate(impDates.midsemStart);
              classesTillLID = countTillDate(impDates.lidTheoryDate);
          }
      }
  }

  const hasPredictor = [classesTillCAT1, classesTillCAT2, classesTillMidSem, classesTillLID]
    .some(data => Array.isArray(data) && data.length > 0);

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
      return [{ id: "grade", title: "Grades", headline: `Grade ${selectedPastGrade}`, subline: "Published grade", badge: "Final", badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", headlineColor: "text-emerald-600 dark:text-emerald-400" }];
    }
    const slides: any[] = [];
    const hasTheory = (selectedGroup?.theory?.assessments?.length || 0) > 0;
    const hasLab = (selectedGroup?.lab?.assessments?.length || 0) > 0;
    if (selectedGroup?.theory && selectedGroup?.lab) {
      slides.push({ id: "combined", title: "Marks", headline: String(courseTotalString), subline: `Projected ${courseStats.projected}% · Max ${formatNumber(courseStats.maxPossible)}%`, badge: "Overall" });
      slides.push({ id: "theory", title: "Marks", headline: hasTheory ? `${formatNumber(ovTheoryTotals.weighted)} / ${formatNumber(ovTheoryTotals.weightPercent)}` : "—", subline: ovTheoryPct !== null ? `${formatNumber(ovTheoryPct)}% scored` : "No theory marks yet", badge: "Theory", badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" });
      slides.push({ id: "lab", title: "Marks", headline: hasLab ? `${formatNumber(ovLabTotals.weighted)} / ${formatNumber(ovLabTotals.weightPercent)}` : "—", subline: ovLabPct !== null ? `${formatNumber(ovLabPct)}% scored` : "No lab marks yet", badge: "Lab", badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" });
    } else {
      const t = selectedGroup?.lab ? ovLabTotals : ovTheoryTotals;
      const pct = selectedGroup?.lab ? ovLabPct : ovTheoryPct;
      const has = hasTheory || hasLab;
      slides.push({ id: "total", title: "Marks", headline: has ? `${formatNumber(t.weighted)} / ${formatNumber(t.weightPercent)}` : "—", subline: pct !== null ? `${formatNumber(pct)}% scored · Max ${formatNumber(courseStats.maxPossible)}%` : "No marks yet", badge: selectedGroup?.lab ? "Lab" : "Theory", badgeColor: selectedGroup?.lab ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" });
    }
    return slides;
  }, [selectedGroup, isSelectedPastSemester, selectedPastGrade, courseTotalString, courseStats, ovTheoryTotals, ovLabTotals, ovTheoryPct, ovLabPct]);
  const ovSlideCount = innerTab === "overview" && selectedCode ? ovMarksSlides.length : 0;
  useEffect(() => {
    if (ovCarouselPaused || ovSlideCount <= 1) return;
    const t = setInterval(() => setOvActiveSlide((p) => (p + 1) % ovSlideCount), 5000);
    return () => clearInterval(t);
  }, [ovCarouselPaused, ovSlideCount]);
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
        toSlide(theoryAttItem, "Theory", "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"),
        toSlide(labAttItem, "Lab", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"),
      ];
    }
    const item = attendanceItem || theoryAttItem || labAttItem;
    return [toSlide(item, item ? (String(item.courseCode || "").endsWith("(L)") || String(item.courseCode || "").endsWith("(P)") ? "Lab" : "Theory") : "Theory")];
  }, [theoryAttItem, labAttItem, attendanceItem, thresholdPct]);
  const ovAttSlideCount = innerTab === "overview" && selectedCode ? ovAttSlides.length : 0;
  useEffect(() => {
    if (ovAttPaused || ovAttSlideCount <= 1) return;
    const t = setInterval(() => setOvAttSlide((p) => (p + 1) % ovAttSlideCount), 5000);
    return () => clearInterval(t);
  }, [ovAttPaused, ovAttSlideCount]);
  const ovAttPct = Number(attendanceItem?.attendancePercentage) || 0;
  const ovAttended = Number(attendanceItem?.attendedClasses) || 0;
  const ovTotal = Number(attendanceItem?.totalClasses) || 0;
  const ovAttStatus = ovTotal === 0 ? "N/A" : ovAttPct >= thresholdPct + 5 ? "Safe" : ovAttPct >= thresholdPct ? "Warning" : "Critical";
  const ovBunkText = (() => {
    if (ovTotal === 0) return "No classes held yet";
    if (ovAttPct < thresholdPct) {
      const needed = Math.ceil((thresholdDec * ovTotal - ovAttended) / (1 - thresholdDec));
      return `Need ${Math.max(1, needed)} more to reach ${thresholdPct}%`;
    }
    const canMiss = Math.floor(ovAttended / thresholdDec - ovTotal);
    if (canMiss <= 0) return "On safety margin";
    return `${canMiss} bunkable · safe above ${thresholdPct}%`;
  })();
  const ovGo = (id: string) => {
    setOvActiveSlide(0);
    setInnerTab(id);
    if (id === "plan" && !coursePlan && !planLoading) fetchCoursePlan();
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
    return (
      <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 shadow-sm mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
          <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${typeLabel === 'Theory' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            <Activity className="w-4 h-4" /> {typeLabel} Assessments
          </h3>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${typeLabel === 'Theory' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
              Total: {formatNumber(totals.weighted)} / {formatNumber(totals.weightPercent)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((detail: any, idx: number) => {
            const aStat = asmStats[detail.title];
            return <AssessmentCard key={idx} detail={detail} typeLabel={typeLabel} aStat={aStat} isRelative={isRelative} />;
          })}
        </div>
        <div className="mt-5 pt-4 border-t border-gray-200/50 dark:border-gray-800/50 flex justify-end">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Max Score Left: <span className="font-black text-gray-900 dark:text-white">{formatNumber(100 - (totals.weightPercent - totals.weighted))}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300">
      {/* ── HEADER (OD hours page arrangement) ── */}
      <div className="px-1">
        <div className="mb-5 flex">
          <BackButton onClick={handleBack} className="self-start" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1.5">
            Academics · {selectedGroup?.semesterSubId && selectedGroup.semesterSubId !== "Current" ? formatSemesterName(selectedGroup.semesterSubId) : "Current Semester"}
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit">
            {selectedCode}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
            {selectedGroup?.courseTitle || ""}
          </p>
        </div>
      </div>

      {innerTab !== "overview" && (
        <SubTabStrip
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "grades", label: "Grade History" },
            { id: "marks", label: "Marks" },
            { id: "attendance", label: "Attendance" },
            { id: "plan", label: "Course Plan" },
            { id: "qbank", label: "QBank" },
          ]}
          activeTab={innerTab}
          onChange={(id) => {
            setInnerTab(id);
            if (id === "plan" && !coursePlan && !planLoading) fetchCoursePlan();
          }}
        />
      )}

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
          <div
            onMouseEnter={() => setOvAttPaused(true)}
            onMouseLeave={() => setOvAttPaused(false)}
            onTouchStart={() => setOvAttPaused(true)}
            onTouchEnd={() => setOvAttPaused(false)}
            onClick={() => ovGo("attendance")}
            className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-36 sm:min-h-40 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer relative overflow-hidden"
          >
            {(() => {
              const slide = ovAttSlides[ovAttSlide] || ovAttSlides[0];
              if (!slide) return null;
              return (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                      {slide.title}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${
                        slide.status === "Safe"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : slide.status === "Warning"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : slide.status === "N/A"
                          ? "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      }`}
                    >
                      {slide.status}
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    <m.div
                      key={slide.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="my-auto py-1 min-w-0"
                    >
                      <span
                        className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block ${
                          slide.status === "Safe"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : slide.status === "Warning"
                            ? "text-amber-500 dark:text-amber-400"
                            : slide.status === "N/A"
                            ? "text-zinc-400 dark:text-zinc-500"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {slide.headline}
                      </span>
                    </m.div>
                  </AnimatePresence>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                      {slide.subline}
                    </p>
                    {ovAttSlides.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {ovAttSlides.map((s: any, idx: number) => (
                          <button
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setOvAttSlide(idx); }}
                            aria-label={`Go to ${s.badge} attendance`}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                              ovAttSlide === idx ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* CARD 2: MARKS CAROUSEL (combined + theory + lab) */}
          <div
            onMouseEnter={() => setOvCarouselPaused(true)}
            onMouseLeave={() => setOvCarouselPaused(false)}
            onTouchStart={() => setOvCarouselPaused(true)}
            onTouchEnd={() => setOvCarouselPaused(false)}
            onClick={() => ovGo("marks")}
            className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-36 sm:min-h-40 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer relative overflow-hidden"
          >
            {(() => {
              const slide = ovMarksSlides[ovActiveSlide] || ovMarksSlides[0];
              if (!slide) return null;
              return (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                      {slide.title}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                        slide.badgeColor || "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40"
                      }`}
                    >
                      {slide.badge}
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    <m.div
                      key={`${slide.id}-${embeddedScope}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="my-auto py-1 min-w-0"
                    >
                      <span className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${slide.headlineColor || "text-zinc-900 dark:text-white"}`}>
                        {slide.headline}
                      </span>
                    </m.div>
                  </AnimatePresence>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                      {slide.subline}
                    </p>
                    {ovMarksSlides.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {ovMarksSlides.map((s: any, idx: number) => (
                          <button
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setOvActiveSlide(idx); }}
                            aria-label={`Go to ${s.title}`}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                              ovActiveSlide === idx ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          </div>

          {/* ── COURSE SECTIONS (joined grouped list) ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                  Course sections
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                  5
                </span>
              </div>
            </div>
            {/* Joined grouped list: single shell, dividers, curves only on outer top/bottom */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              {/* Attendance */}
              <button
                onClick={() => ovGo("attendance")}
                className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">Attendance</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {ovTotal > 0 ? `${ovAttended}/${ovTotal}${attendanceItem?.slotVenue ? ` · ${attendanceItem.slotVenue}` : ""} · ${ovBunkText}` : "No attendance data"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-base font-black font-outfit tracking-tight leading-none ${ovAttStatus === "Safe" ? "text-emerald-600 dark:text-emerald-400" : ovAttStatus === "Warning" ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {ovTotal > 0 ? `${Number(ovAttPct.toFixed(1))}%` : "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
              {/* Marks */}
              <button
                onClick={() => ovGo("marks")}
                className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <Target className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">Marks</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {isEmbedded
                      ? `Theory ${formatNumber(ovTheoryTotals.weighted)}/${formatNumber(ovTheoryTotals.weightPercent)} · Lab ${formatNumber(ovLabTotals.weighted)}/${formatNumber(ovLabTotals.weightPercent)}`
                      : String(courseTotalString)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-indigo-600 dark:text-indigo-400">
                    {isSelectedPastSemester && selectedPastGrade ? `Grade ${selectedPastGrade}` : `${courseStats.projected}%`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
              {/* Grade History */}
              <button
                onClick={() => ovGo("grades")}
                className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">Grades</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {isRelative ? "Relative grading" : "Absolute grading"}{courseGradeHistory.length > 0 ? ` · ${courseGradeHistory.length} record${courseGradeHistory.length === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-zinc-900 dark:text-white">
                    {selectedPastGrade ? `Grade ${selectedPastGrade}` : `${courseStats.projected}%`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
              {/* Course Plan */}
              <button
                onClick={() => ovGo("plan")}
                className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">Course Plan</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {mainCourse?.faculty || "Faculty N/A"}{mainCourse?.courseType ? ` · ${isEmbedded ? "Embedded" : mainCourse.courseType}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black font-outfit tracking-tight leading-none text-zinc-700 dark:text-zinc-200 truncate max-w-24">
                    {mainCourse?.slot || "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
              {/* QBank */}
              <button
                onClick={() => ovGo("qbank")}
                className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">QBank</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    Papers & extracted questions
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-black font-outfit tracking-tight leading-none text-zinc-700 dark:text-zinc-200">
                    {(selectedGroup?.theory?.assessments?.length || 0) + (selectedGroup?.lab?.assessments?.length || 0)} tests
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs p-4 sm:p-5 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">Quality Circle Meeting</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">QCM</span>
              </div>
              {!qcmData && (
                <button onClick={fetchQcmForCourse} disabled={qcmLoading} className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 disabled:opacity-50 text-emerald-600 dark:text-emerald-400 transition-all border border-emerald-500/20 shadow-xs active:scale-95 cursor-pointer w-fit">
                  {qcmLoading ? "Loading..." : "Load QCM Data"}
                </button>
              )}
            </div>
               
               {qcmError && <p className="text-sm text-red-500">{qcmError}</p>}
               
               {qcmData && qcmData.length === 0 && (
                 <p className="text-sm text-gray-500">No QCM data found for {selectedCode} in this semester.</p>
               )}

               {qcmData && qcmData.length > 0 && (
                 <div className="space-y-4">
                   {qcmData.map((table: any, ti: number) => (
                      <div key={ti} className="space-y-4">
                        {table.caption && <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">{table.caption}</p>}
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
                            <div key={ri} className="rounded-2xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs p-4">
                               <div className="flex justify-between items-center mb-3">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">QCM {qcmNo || ri + 1}</span>
                                  {action && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 uppercase">{action}</span>}
                               </div>
                               <div className="space-y-3">
                                  {suggestions && (
                                     <div>
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Suggestions / Feedback</p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200">{suggestions}</p>
                                     </div>
                                  )}
                                  {facultyReply && (
                                     <div className="pl-3 border-l-2 border-emerald-200 dark:border-emerald-900/50">
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Faculty Reply</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{facultyReply}</p>
                                     </div>
                                  )}
                                  {hodComments && (
                                     <div className="pl-3 border-l-2 border-purple-200 dark:border-purple-900/50">
                                        <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-0.5">HOD Comments</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{hodComments}</p>
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
          <div className="rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">Course Plan</h2>
                </div>
                {coursePlan && <button onClick={() => { ovGo("plan"); }} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer active:scale-95">View Details</button>}
              </div>
              {planLoading ? <Skeleton className="h-24 w-full rounded-xl" />
              : coursePlan ? coursePlan.map((cp: any, i: number) => (
                cp.data.tables?.map((t: any) => t.rows?.slice(0, 2).map((r: any, ri: number) => (
                  <div key={`${i}-${ri}`} className="py-2.5 px-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 mb-2">
                    <p className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{cp.type}</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{r["Course Title"] || r["Course Code"] || "Course info"}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{r["Slot"] && `Slot: ${r["Slot"]}`}{r["Faculty"] ? ` | ${r["Faculty"]}` : ""}</p>
                  </div>
                )))
              )) : <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium px-1">Course plan loads automatically</p>}
          </div>
          {viewDetail && (
            <div className="rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs p-4 sm:p-5">
              <div className="px-1 mb-4">
                <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">Schedule Preview</h2>
              </div>
                {viewDetail.map((vd: any, ci: number) => (
                  <div key={ci} className="mb-4 last:mb-0">
                    {viewDetail.length > 1 && <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{vd.type}</p>}
                    {vd.data.tables?.slice(1).map((t: any) => (
                      <div key={0} className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                            {t.headers?.map((h: string) => (<th key={h} className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}
                          </tr></thead>
                          <tbody>{t.rows?.map((row: any, ri: number) => (
                            <tr key={ri} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                              {t.headers.map((h: string) => (<td key={h} className="py-2 px-2 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>))}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
                {(!viewDetail[0]?.data.tables || viewDetail[0].data.tables.length <= 1) && <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium px-1">No schedule data</p>}
            </div>
          )}
        </div>
      )}

      {/* MARKS - Full replication of MarksSubpage */}
      {innerTab === "marks" && (
        <div>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Course Type</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{courseTypeLabel}</p>
            </div>
            
            {isSelectedPastSemester && selectedPastGrade ? (
              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-800/50 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-400/10 blur-xl rounded-full" />
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-widest mb-1 relative z-10">Final Grade</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 relative z-10">{selectedPastGrade}</p>
              </div>
            ) : (
              <>
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-500/5 blur-xl rounded-full" />
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1 relative z-10">Total Score</p>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 relative z-10">{courseTotalString}</p>
                </div>
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Projected %</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{courseStats.projected}%</p>
                </div>
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Max Potential</p>
                  <p className="text-xl font-black text-orange-600 dark:text-orange-400">{formatNumber(courseStats.maxPossible)}%</p>
                </div>
              </>
            )}
          </div>

          {!isSelectedPastSemester && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-outfit">
                    Simulate Marks & Regimen for {selectedCode}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Test what-if scores, points lost, and calculate exact FAT target marks
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (setActiveSubTab) {
                    setActiveSubTab("marks-predictor");
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <span>Launch Marks Predictor</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {renderAssessmentTable(selectedGroup?.theory?.assessments, "Theory")}
          {renderAssessmentTable(selectedGroup?.lab?.assessments, "Lab")}

          {(!selectedGroup?.theory?.assessments?.length && !selectedGroup?.lab?.assessments?.length) && (
            <Card><div className="p-5 text-sm text-gray-400  dark:text-gray-500">No assessment data available</div></Card>
          )}

          {/* Grade Insights - Full replication from MarksSubpage */}
          <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm mt-6">
            <div className="p-5 border-b border-gray-100  dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
                Grade Insights <Badge variant="info" className="bg-blue-100 text-blue-700   dark:bg-blue-900/30 dark:text-blue-400 font-bold">BETA</Badge>
              </h3>
              <details className="text-xs text-gray-500  dark:text-gray-400 mt-2 leading-relaxed cursor-pointer group">
                <summary className="font-semibold text-indigo-600  dark:text-indigo-400 hover:underline list-none inline-flex items-center gap-1">
                  <Info size={14} /> How this works & why it is safe
                </summary>
                <div className="mt-3 p-4 bg-gray-50  dark:bg-slate-800 rounded-lg border border-gray-200  dark:border-gray-700 space-y-2">
                  <p>
                    <strong>Proof of Concept:</strong> To calculate an accurate class curve, we need to know the class average and standard deviation.
                    This requires aggregating the marks of all students in the class. It is mathematically impossible to do this securely strictly on your local device,
                    because your device needs access to the rest of the class's performance to determine your relative rank.
                  </p>
                  <p>
                    <strong>Privacy First:</strong> When you download fresh marks from VTOP, your client securely transmits only the changes (using a scrambled, anonymous hash of your ID to prevent duplicate updates). The server strictly processes the numbers in-memory using Welford's Algorithm, updates the class-wide statistics, and then
                    <strong> immediately discards</strong> your individual marks. We do not store your exact marks in any database.
                  </p>
                </div>
              </details>
              {(isRelative && stats && stats.count > 0 && stats.count < 30) && (
                <p className="text-xs text-red-500 font-medium mt-2">
                  Warning: Low data samples ({stats.count}). Relative predictions may not be fully accurate until more peers sync their marks.
                </p>
              )}
            </div>

            <div className="p-5 bg-gray-50/50  dark:bg-black/50">
              {isRelative ? (
                <div className="flex flex-wrap gap-4 mb-6 text-sm">
                  <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Samples</p>
                    <p className="font-bold text-gray-900  dark:text-gray-100">{stats ? stats.count : "N/A"}</p>
                  </div>
                  <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Mean</p>
                    <p className="font-bold text-gray-900  dark:text-gray-100">{stats ? formatNumber(stats.mean) : "N/A"}</p>
                  </div>
                  <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Std Dev</p>
                    <p className="font-bold text-gray-900  dark:text-gray-100">{stats ? formatNumber(stats.sd) : "N/A"}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50  dark:bg-emerald-900/20 border border-emerald-200  dark:border-emerald-800/50 flex flex-col md:flex-row items-center gap-4 text-emerald-800  dark:text-emerald-400">
                  <div className="p-3 bg-white  dark:bg-emerald-950 rounded-full shadow-sm">
                    <Activity size={24} className="text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold">Absolute Grading Enforced</h4>
                    <p className="text-sm mt-1 opacity-90">This course uses an absolute grading system. Your grade is based purely on predefined percentage boundaries, irrespective of class performance.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
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

                  const boundaries = [
                    { grade: 'S', limit: sBoundary, color: 'bg-emerald-50 text-emerald-700 border-emerald-200    dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50', range: `>= ${sBoundary.toFixed(0)}` },
                    { grade: 'A', limit: aLower, color: 'bg-green-50 text-green-700 border-green-200    dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50', range: `>= ${aLower.toFixed(0)}` },
                    { grade: 'B', limit: bLower, color: 'bg-blue-50 text-blue-700 border-blue-200    dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50', range: `>= ${bLower.toFixed(0)}` },
                    { grade: 'C', limit: cLower, color: 'bg-indigo-50 text-indigo-700 border-indigo-200    dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50', range: `>= ${cLower.toFixed(0)}` },
                    { grade: 'D', limit: dLower, color: 'bg-purple-50 text-purple-700 border-purple-200    dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50', range: `>= ${dLower.toFixed(0)}` },
                    { grade: 'E', limit: eLower, color: 'bg-orange-50 text-orange-700 border-orange-200    dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50', range: `>= ${eLower.toFixed(0)}` },
                    { grade: 'F', limit: 0, color: 'bg-red-50 text-red-700 border-red-200    dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50', range: `< ${eLower.toFixed(0)}` },
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
                  const remainingWeightagePoints = targetBoundary - currentWeightedScore;

                  return (
                    <>
                      {boundaries.map((b, i) => (
                        <div key={i} className={`rounded-xl border p-3 flex flex-col items-center justify-center ${b.color} ${(isRelative && !stats) ? 'opacity-50 grayscale' : ''}`}>
                          <span className="text-xl font-black mb-1">{b.grade}</span>
                          <span className="text-[10px] font-bold tracking-wider">{b.range}</span>
                        </div>
                      ))}
                      <div className="col-span-full mt-4 bg-white  dark:bg-slate-800 border border-gray-200  dark:border-gray-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900  dark:text-gray-100">Target Grade Calculator</h4>
                          <p className="text-xs text-gray-500  dark:text-gray-400 mt-1">See how many weightage points you need for your goal.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={targetGrade}
                            onChange={(e) => setTargetGrade(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300  dark:border-gray-600 bg-gray-50  dark:bg-black text-gray-900  dark:text-gray-100 font-bold"
                          >
                            {['S', 'A', 'B', 'C', 'D', 'E'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                          </select>
                          {remainingWeightagePoints <= 0 ? (
                            <div className="px-4 py-2 bg-emerald-100 text-emerald-800   dark:bg-emerald-900/50 dark:text-emerald-300 font-bold rounded-lg text-sm">
                              Target Achieved!
                            </div>
                          ) : remainingWeightagePoints > (100 - currentWeightPercent) ? (
                            <div className="px-4 py-2 bg-red-100 text-red-800   dark:bg-red-900/50 dark:text-red-300 font-bold rounded-lg text-sm">
                              Impossible to achieve
                            </div>
                          ) : (
                            <div className="px-4 py-2 bg-indigo-100 text-indigo-800   dark:bg-indigo-900/50 dark:text-indigo-300 font-bold rounded-lg text-sm">
                              Need <span className="text-lg">{remainingWeightagePoints.toFixed(1)}</span> more weightage pts
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE - Full replication of AttendanceSubpage */}
      {innerTab === "attendance" && attendanceItem && (
        <div>
          {isEmbedded && (
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl mb-6 w-fit mx-auto border border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setEmbeddedScope("theory")}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  embeddedScope === "theory" 
                    ? "bg-white dark:bg-black text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Theory
              </button>
              <button
                onClick={() => setEmbeddedScope("lab")}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  embeddedScope === "lab" 
                    ? "bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Lab
              </button>
            </div>
          )}
          {/* Badges Row */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Badge variant="info" className="rounded-lg border border-blue-100  dark:border-blue-900/40 gap-1.5">
              <CalendarIcon className="w-4 h-4 text-blue-500  dark:text-blue-400" /> {attendanceItem.slotName}
            </Badge>
            <Badge variant="purple" className="rounded-lg border border-purple-100  dark:border-purple-900/40 gap-1.5">
              <Building2 className="w-4 h-4 text-purple-500  dark:text-purple-400" /> {attendanceItem.slotVenue}
            </Badge>
            <Badge variant="warning" className="rounded-lg border border-amber-100  dark:border-amber-900/40 gap-1.5">
              <Clock className="w-4 h-4 text-orange-500  dark:text-amber-400" /> {attendanceItem.time}
            </Badge>
            <Badge variant="success" className="rounded-lg border border-emerald-100  dark:border-emerald-900/40 gap-1.5">
              <User className="w-4 h-4 text-green-500  dark:text-emerald-400" /> {attendanceItem.faculty}
            </Badge>
          </div>

          {/* Metrics Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white  dark:bg-gray-900 rounded-2xl p-6 border border-gray-200  dark:border-gray-800 flex items-center justify-between shadow-sm md:col-span-1">
              <div>
                <h3 className="text-gray-500  dark:text-gray-400 font-semibold uppercase tracking-wider text-xs mb-1">Attendance</h3>
                <p className="text-3xl font-black text-gray-900  dark:text-gray-100">{attendanceItem.attendancePercentage}%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">{attendanceItem.attendedClasses} / {attendanceItem.totalClasses} Classes</p>
              </div>
              <div className="w-24 h-24">
                <CircularProgress
                  value={attendanceItem.attendancePercentage}
                  text={`${!decimalValues ? attendanceItem.attendancePercentage : (attendanceItem.attendedClasses / attendanceItem.totalClasses * 100).toFixed(1)}%`}
                  size={96}
                  threshold={thresholdPct}
                  midThreshold={thresholdPct + 10}
                />
              </div>
            </div>

            <div className="bg-white  dark:bg-gray-900 rounded-2xl p-6 border border-gray-200  dark:border-gray-800 shadow-sm md:col-span-2 flex flex-col justify-center">
              <h3 className="text-gray-500  dark:text-gray-400 font-semibold uppercase tracking-wider text-xs mb-3">Status Insight</h3>
              {attendanceItem.totalClasses > 0 && (() => {
                const attended = attendanceItem.attendedClasses;
                const total = attendanceItem.totalClasses;
                const percentage = (attended / total) * 100;
                if (percentage < thresholdPct) {
                  const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
                  const neededValue = isLabAtt ? Math.ceil(needed / 2) : needed;
                  return (
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-100  dark:bg-red-900/30 text-red-600  dark:text-red-400 rounded-xl">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900  dark:text-gray-100">Critical Status</p>
                        <p className="text-gray-600  dark:text-gray-400 mt-1">You need to attend <strong>{neededValue}</strong> more {isLabAtt ? "lab" : "class"}{neededValue > 1 && (isLabAtt ? "s" : "es")} consecutively to reach the safe {thresholdPct}% threshold.</p>
                      </div>
                    </div>
                  );
                } else {
                  const canMiss = Math.floor(attended / thresholdDec - total);
                  const canMissValue = isLabAtt ? Math.floor(canMiss / 2) : canMiss;
                  if (canMissValue === 0) {
                    return (
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-yellow-100  dark:bg-yellow-900/30 text-yellow-600  dark:text-yellow-400 rounded-xl">
                          <AlertCircle size={24} />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900  dark:text-gray-100">On the Edge</p>
                          <p className="text-gray-600  dark:text-gray-400 mt-1">You cannot afford to miss the next {isLabAtt ? "lab" : "class"}. Attend to build a safety buffer.</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-100  dark:bg-emerald-900/30 text-emerald-600  dark:text-emerald-400 rounded-xl">
                        <Star size={24} />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900  dark:text-gray-100">Safe Margin</p>
                        <p className="text-gray-600  dark:text-gray-400 mt-1">You can safely miss <strong>{canMissValue}</strong> {isLabAtt ? "lab" : "class"}{canMissValue !== 1 && (isLabAtt ? "s" : "es")} and still stay above the {thresholdPct}% threshold.</p>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          {/* Layout Split */}
          <div className={`grid grid-cols-1 gap-6 ${hasPredictor ? 'xl:grid-cols-3' : ''}`}>
            {hasPredictor && (
              <div className="xl:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl overflow-hidden shadow-sm h-full relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
                  <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4" /> Interactive Predictor
                      </h2>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tap on upcoming classes to see how skipping them affects your attendance before exams.</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-6 divide-y divide-gray-200/50 dark:divide-gray-800/50 relative z-10">
                    {[
                      { key: "CAT1", label: "Classes before CAT I", data: classesTillCAT1 },
                      { key: "CAT2", label: "Classes before CAT II", data: classesTillCAT2 },
                      { key: "MIDSEM", label: "Classes before Mid Term Test", data: classesTillMidSem },
                      { key: "LID", label: "Classes before FAT", data: classesTillLID },
                    ].map(({ key, label, data }, idx) => (
                      Array.isArray(data) && data.length > 0 ? (
                        <div key={key} className={`space-y-4 ${idx > 0 ? 'pt-6' : ''}`}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 dark:text-gray-200 flex items-center gap-2">
                              <CalendarIcon size={16} className="text-blue-500 dark:text-blue-400" />
                              <span>{label}</span>
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full shadow-inner">
                              {data.length} Left
                            </span>
                          </div>
                          <UpcomingClassesList
                            classes={data}
                            attendedClasses={attendanceItem.attendedClasses}
                            totalClasses={attendanceItem.totalClasses}
                            isLab={attendanceItem.courseCode?.endsWith("(L)") || false}
                            impDates={impDates}
                            isDayscholarWithBus={isDayscholarWithBus}
                          />
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={`${hasPredictor ? "xl:col-span-1" : ""} min-w-0 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200`}>
              <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl overflow-hidden shadow-sm h-full flex flex-col relative">
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 flex flex-col gap-5 relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        Attendance Log
                        {missingNotesCount > 0 && (
                          <Badge variant="danger" className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-black shadow-inner border border-red-100 dark:border-red-900/50">
                            {missingNotesCount} Missing Notes
                          </Badge>
                        )}
                      </h2>
                      {!hasPredictor && <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1">Track past classes and secure notes.</p>}
                    </div>
                    <div className="flex bg-white/50 dark:bg-black/50 p-1 rounded-xl shadow-inner border border-gray-200/50 dark:border-gray-800/50">
                      {[
                        { key: "calendar" as const, icon: <CalendarIcon size={16} /> },
                        { key: "heatmap" as const, icon: <Grid3x3 size={16} /> },
                        { key: "list" as const, icon: <List size={16} /> },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setViewMode(opt.key)}
                          className={`p-2 rounded-lg transition-all duration-200 ${viewMode === opt.key ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {viewMode === "list" && (
                    <div className="flex bg-white/50 dark:bg-black/50 p-1 rounded-xl shadow-inner border border-gray-200/50 dark:border-gray-800/50 overflow-x-auto hide-scrollbar w-max mx-auto sm:mx-0">
                      {["All", "Present", "Absent", "On Duty"].map(f => (
                        <button
                          key={f}
                          onClick={() => setAttFilter(f)}
                          className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${attFilter === f ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-gray-200 dark:ring-gray-700" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[450px] xl:max-h-[500px]">
                  {viewMode === "calendar" ? (
                    <div className="p-0 sm:p-4 w-full overflow-x-auto hide-scrollbar">
                      <div className="min-w-[600px]">
                        <AttendanceCalendarView
                          analyzeCalendars={analyzeCalendars}
                          historyList={historyList}
                          notesTracker={notesTracker}
                          toggleNotes={toggleNotes}
                          courseCode={attendanceItem.courseCode}
                          isOverall={false}
                          toggleIndividualNote={() => {}}
                        />
                      </div>
                    </div>
                  ) : viewMode === "heatmap" ? (
                    <div className="p-6 flex justify-center w-full overflow-x-auto hide-scrollbar" style={{ direction: "rtl" }}>
                      <div style={{ direction: "ltr", minWidth: "500px" }}>
                        <HeatMap
                          value={heatmapData}
                          startDate={heatmapStartDate}
                          endDate={heatmapEndDate}
                          width={550}
                          rectProps={{ rx: 4, ry: 4 }}
                          rectRender={(props: any, dayData: any) => {
                            const data = dayData as any;
                            const status = data.count === 1 ? "Present" : data.count === 2 ? "Absent" : data.count === 3 ? "On Duty" : "No Class";
                            return <rect {...props}><title>{`${data.date}: ${status}`}</title></rect>;
                          }}
                          panelColors={{
                            0: "rgba(156, 163, 175, 0.1)",
                            1: "#10B981",
                            2: "#EF4444",
                            3: "#EAB308",
                          }}
                        />
                      </div>
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="p-8 text-center text-gray-500  dark:text-gray-400">
                      No records found for "{attFilter}".
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100  dark:divide-gray-800">
                      {filteredHistory.map((d: any, i: number) => {
                        const status = d.status.toLowerCase();
                        const isPresent = status === "present";
                        const isAbsent = status === "absent";
                        const hasNotes = notesTracker[attendanceItem?.courseCode || ""]?.[d.date] === true;
                        return (
                          <div key={i} className="flex sm:items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-900/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-2 h-10 rounded-full ${isPresent ? "bg-emerald-500" : isAbsent ? "bg-red-500" : "bg-yellow-500"}`} />
                              <div>
                                <p className="font-bold text-gray-900  dark:text-gray-100">{d.date}</p>
                                <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isPresent ? "text-emerald-600  dark:text-emerald-400" : isAbsent ? "text-red-600  dark:text-red-400" : "text-yellow-600  dark:text-yellow-400"}`}>
                                  {d.status}
                                </p>
                              </div>
                            </div>
                            {!isPresent && (
                              <button
                                onClick={() => toggleNotes(d.date)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                                  hasNotes
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700    dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50    dark:hover:bg-slate-700 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                                }`}
                              >
                                {hasNotes ? <CheckCircle2 size={14} /> : <FileTextIcon size={14} />}
                                <span className="hidden sm:inline">{hasNotes ? "Secured" : "Get Notes"}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {innerTab === "attendance" && !attendanceItem && (
        <Card><div className="p-5 text-sm text-gray-400">No attendance data available for this course.</div></Card>
      )}

      {/* COURSE PLAN - Full tables without truncation */}
      {innerTab === "plan" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 mt-4">
          <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" /> Course Syllabus & Plan
          </h4>
          
          {planLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-1/3 rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-3xl" />
              <Skeleton className="h-48 w-full rounded-3xl" />
            </div>
          ) : coursePlan && coursePlan.length > 0 ? (
            <div className="space-y-8">
              {coursePlan.map((cp: any, ci: number) => (
                <div key={ci} className="space-y-4">
                  {coursePlan.length > 1 && (
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 px-2">
                      <FileText className="w-4 h-4" /> {cp.type === "Embedded Theory" || cp.type === "Theory Only" ? "Theory" : "Lab"} Component
                    </h4>
                  )}
                  {cp.data.tables?.map((t: any, ti: number) => (
                    <div key={ti} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl overflow-hidden shadow-sm relative">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
                      <div className="p-6 relative z-10">
                        {t.caption && <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t.caption}</h4>}
                        <div className="overflow-x-auto hide-scrollbar">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200/50 dark:border-gray-800/50">
                                {t.headers?.map((h: string, hi: number) => (
                                  <th key={hi} className="text-left py-3 px-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.rows?.map((row: any, ri: number) => (
                                <tr key={ri} className="border-b border-gray-100/50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                  {t.headers.map((h: string, hi: number) => (
                                    <td key={hi} className="py-3 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {row[h] || "—"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl border border-gray-200/50 dark:border-gray-800/50 p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">Course plan is unavailable or loading.</p>
            </div>
          )}

          {/* Schedule toggle */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl overflow-hidden shadow-sm relative mt-8">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-gray-200/50 dark:border-gray-800/50">
              <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" /> Weekly Schedule
              </h4>
              <button 
                onClick={() => { if (viewDetail) setViewDetail(null); else fetchViewDetail(); }} 
                disabled={viewLoading}
                className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors shadow-inner"
              >
                {viewLoading ? "Loading..." : viewDetail ? "Hide Schedule" : "Load Schedule"}
              </button>
            </div>
            
            {viewDetail && (
              <div className="p-6 relative z-10 space-y-6">
                {viewDetail.map((vd: any, ci: number) => (
                  <div key={ci} className="space-y-4">
                    {viewDetail.length > 1 && <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{vd.type} Schedule</p>}
                    {vd.data.tables?.slice(1).map((t: any, ti: number) => (
                      <div key={ti} className="overflow-x-auto hide-scrollbar">
                        {t.caption && <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t.caption}</h5>}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200/50 dark:border-gray-800/50">
                              {t.headers?.map((h: string, hi: number) => (
                                <th key={hi} className="text-left py-2 px-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {t.rows?.map((row: any, ri: number) => (
                              <tr key={ri} className="border-b border-gray-100/50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                {t.headers.map((h: string, ci: number) => (
                                  <td key={ci} className="py-2.5 px-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{row[h] || "—"}</td>
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
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" /> Grade History Timeline
          </h4>
          {courseGradeHistory.length === 0 ? (
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">No past grade history found for this course.</p>
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-800 before:to-transparent">
              {courseGradeHistory.map((gh: any, idx: number) => {
                const isCurrent = gh.semester === "Current";
                return (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-gray-50 dark:border-black bg-white dark:bg-gray-900 text-blue-500 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform duration-300 group-hover:scale-110">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                    
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 dark:border-gray-800/50 shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                            {isCurrent ? "Current Semester" : formatSemesterName(gh.semester || "") || "Unknown Semester"}
                          </p>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{gh.courseTitle || selectedGroup?.courseTitle}</p>
                        </div>
                        <div className="text-right">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-black text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            {gh.grade || gh.courseGrade || "N/A"}
                          </div>
                        </div>
                      </div>

                      {gh.details && gh.details.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-gray-800/50">
                          <div className="space-y-4">
                            {(() => {
                               const types = Array.from(new Set(gh.details.map((d: any) => d.type || 'Theory')));
                               const showLabels = types.length > 1;
                               return types.map((typeLabel: any) => {
                                 const typeDetails = gh.details.filter((d: any) => (d.type || 'Theory') === typeLabel);
                                 return (
                                   <div key={typeLabel}>
                                     {showLabels && <h5 className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-500/80">{typeLabel}</h5>}
                                     <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                       {typeDetails.map((detail: any, dIdx: number) => (
                                         <div key={dIdx} className="rounded-xl border border-gray-100/80 bg-gray-50/50 p-3 text-center shadow-sm dark:border-gray-800/80 dark:bg-gray-900/30 transition-colors hover:bg-white dark:hover:bg-gray-800">
                                           <p className="mb-1 line-clamp-1 text-[9px] font-black uppercase tracking-widest text-gray-400" title={detail.component}>{detail.component}</p>
                                           <p className="text-base font-black text-gray-900 dark:text-white">{detail.scoredMark} <span className="text-[10px] font-bold text-gray-300">/ {detail.maxMark}</span></p>
                                         </div>
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
                        <div className="mt-4 border-t border-gray-100/50 pt-4 dark:border-gray-800/50">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Grade Ranges</p>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
                            {Object.entries(gh.range).map(([grade, rangeStr]: any, idx) => {
                              let colorClass = 'bg-gray-50 text-gray-700 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400';
                              if (grade === 'S') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400';
                              else if (grade === 'A') colorClass = 'bg-green-50 text-green-700 border-green-200 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-400';
                              else if (grade === 'B') colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-400';
                              else if (grade === 'C') colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:text-indigo-400';
                              else if (grade === 'D') colorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:border-purple-800/50 dark:bg-purple-900/20 dark:text-purple-400';
                              else if (grade === 'E') colorClass = 'bg-orange-50 text-orange-700 border-orange-200 dark:border-orange-800/50 dark:bg-orange-900/20 dark:text-orange-400';
                              else if (grade === 'F' || grade === 'N') colorClass = 'bg-red-50 text-red-700 border-red-200 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400';

                              return (
                                <div key={idx} className={`flex flex-col items-center justify-center rounded-xl border p-2 ${colorClass}`}>
                                  <span className="mb-1 text-lg font-black">{grade}</span>
                                  <span className="text-center text-[10px] font-bold tracking-wider">{rangeStr as string}</span>
                                </div>
                              );
                            })}
                          </div>
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
    </div>
  );
}
