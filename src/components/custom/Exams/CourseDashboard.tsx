"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import CircularProgress from "../shared/CircularProgress";
import Badge from "../shared/Badge";
import ExpandableSection from "../shared/ExpandableSection";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  XCircle, BookOpen, User, Target, Clock, Info, Activity,
  ChevronLeft, FileText, Calendar, Calendar as CalendarIcon,
  Building2, AlertCircle, Star, Grid3x3, List, CheckCircle2,
  FileText as FileTextIcon
} from "lucide-react";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { countRemainingClasses } from "../attendance/AttendanceSubpage";
import config from '../../../../config.json';
import HeatMap from "@uiw/react-heat-map";
import dynamic from "next/dynamic";
import CourseQBankTab from "./CourseQBankTab";

const AttendanceCalendarView = dynamic(
  () => import("../attendance/AttendanceCalendarView"),
  { ssr: false }
);

const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}

const formatNumber = (num: any) => {
  const numericValue = Number(num);
  if (num == null || isNaN(numericValue)) return "-";
  return Number(numericValue.toFixed(2)).toString();
};

const getAssessmentTotals = (assessments: any[]) => {
  return assessments.reduce(
    (acc, asm) => {
      acc.max += getNumericValue(asm.maxMark);
      acc.scored += getNumericValue(asm.scoredMark);
      acc.weightPercent += getNumericValue(asm.weightagePercent);
      acc.weighted += getNumericValue(asm.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );
};

const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

const getCourseTotal = (course: any, labCourse: any) => {
  const theoryTotals = getAssessmentTotals(course?.assessments || []);
  if (!labCourse) {
    return Math.round(theoryTotals.weighted * 100) / 100 + "/" + formatNumber(theoryTotals.weightPercent);
  }
  const labTotals = getAssessmentTotals(labCourse?.assessments || []);
  const theoryCredits = getCourseCredits(course);
  const labCredits = getCourseCredits(labCourse);
  if (theoryCredits < 0 || labCredits < 0) return "Reload Required";
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  if (combinedWeightPercent <= 0) return theoryTotals.weighted;
  const res = Math.round(((theoryCredits * theoryTotals.weighted) + (labCredits * labTotals.weighted)) / creditsTotal * 100) / 100;
  return res + "/" + combinedWeightPercent;
};

const getCourseStats = (group: any) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  if (!group.lab) {
    const pointsLost = theoryTotals.weightPercent - theoryTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0 };
  }
  if (!group.theory) {
    const pointsLost = labTotals.weightPercent - labTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0 };
  }
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  if (theoryCredits < 0 || labCredits < 0) return { maxPossible: 0, projected: 0 };
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  const pointsLost = combinedWeightPercent - combinedWeighted;
  return { maxPossible: 100 - pointsLost, projected: combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0 };
};

const checkIsRelative = (courseSystem: string, courseType: string) => {
  const isACE = courseSystem === "ACE";
  if (isACE) return ["Embedded Theory", "Embedded Lab", "Embedded", "Theory Only"].includes(courseType);
  return courseType === "Theory Only";
};

const formatTitle = (title: string) => {
  if (!title) return "";
  let shortened = title;
  shortened = shortened.replace(/Continuous Assessment Test/gi, 'CAT');
  shortened = shortened.replace(/Final Assessment Test/gi, 'FAT');
  shortened = shortened.replace(/Digital Assignment/gi, 'DA');
  return shortened;
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

const TabButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? "bg-blue-600 text-white shadow-sm" : "text-gray-500  dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-800"}`}>
    {label}
  </button>
);

const TypeBadge = ({ label }: { label: string }) => {
  const colors: Record<string, string> = {
    "Embedded": "bg-indigo-100 text-indigo-700   dark:bg-indigo-900/30 dark:text-indigo-300",
    "Theory Only": "bg-blue-100 text-blue-700   dark:bg-blue-900/30 dark:text-blue-300",
    "Lab Only": "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-300",
    "Embedded Theory": "bg-purple-100 text-purple-700   dark:bg-purple-900/30 dark:text-purple-300",
    "Embedded Lab": "bg-teal-100 text-teal-700   dark:bg-teal-900/30 dark:text-teal-300",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${colors[label] || "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"}`}>
      {label}
    </span>
  );
};

interface Creds { cookies: string[]; authorizedID: string; csrf: string; }

function AssessmentCard({ detail, typeLabel, aStat, isRelative }: {
  detail: any; typeLabel: string; aStat: any; isRelative: boolean;
}) {
  const shortenedTitle = formatTitle(detail.title);
  const asmPct = detail.maxMark > 0 ? (getNumericValue(detail.scoredMark) / getNumericValue(detail.maxMark)) * 100 : 0;

  let gradePlacement = "?";
  let gradeBounds: { grade: string; range: string; color: string }[] = [];

  const sBoundaryCalc = (boundPct: number, maxMark: number) => {
    const rawMark = (boundPct / 100) * maxMark;
    return rawMark.toFixed(1);
  };

  if (isRelative) {
    if (aStat && aStat.count > 0) {
      const sB = Math.min(Math.max(aStat.mean + 1.5 * aStat.sd, 80), 100);
      const aB = aStat.mean + 0.5 * aStat.sd;
      const bB = aStat.mean - 0.5 * aStat.sd;
      const cB = aStat.mean - 1.0 * aStat.sd;
      const dB = aStat.mean - 1.5 * aStat.sd;
      const eB = Math.min(aStat.mean - 2.0 * aStat.sd, 50);

      if (asmPct >= sB) gradePlacement = "S";
      else if (asmPct >= aB) gradePlacement = "A";
      else if (asmPct >= bB) gradePlacement = "B";
      else if (asmPct >= cB) gradePlacement = "C";
      else if (asmPct >= dB) gradePlacement = "D";
      else if (asmPct >= eB) gradePlacement = "E";
      else gradePlacement = "F";

      gradeBounds = [
        { grade: 'S', range: `>= ${sBoundaryCalc(sB, detail.maxMark)}`, color: 'text-emerald-600  dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/20' },
        { grade: 'A', range: `>= ${sBoundaryCalc(aB, detail.maxMark)}`, color: 'text-green-600  dark:text-green-400 bg-green-50  dark:bg-green-900/20' },
        { grade: 'B', range: `>= ${sBoundaryCalc(bB, detail.maxMark)}`, color: 'text-blue-600  dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20' },
        { grade: 'C', range: `>= ${sBoundaryCalc(cB, detail.maxMark)}`, color: 'text-indigo-600  dark:text-indigo-400 bg-indigo-50  dark:bg-indigo-900/20' },
      ];
    }
  } else {
    if (asmPct >= 90) gradePlacement = "S";
    else if (asmPct >= 80) gradePlacement = "A";
    else if (asmPct >= 70) gradePlacement = "B";
    else if (asmPct >= 60) gradePlacement = "C";
    else if (asmPct >= 50) gradePlacement = "D";
    else if (asmPct >= 40) gradePlacement = "E";
    else gradePlacement = "F";

    gradeBounds = [
      { grade: 'S', range: `>= ${sBoundaryCalc(90, detail.maxMark)}`, color: 'text-emerald-600  dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/20' },
      { grade: 'A', range: `>= ${sBoundaryCalc(80, detail.maxMark)}`, color: 'text-green-600  dark:text-green-400 bg-green-50  dark:bg-green-900/20' },
      { grade: 'B', range: `>= ${sBoundaryCalc(70, detail.maxMark)}`, color: 'text-blue-600  dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20' },
      { grade: 'C', range: `>= ${sBoundaryCalc(60, detail.maxMark)}`, color: 'text-indigo-600  dark:text-indigo-400 bg-indigo-50  dark:bg-indigo-900/20' },
    ];
  }

  return (
    <ExpandableSection
      title={shortenedTitle}
      badge={
        <div className="text-right">
          <p className="text-xl font-black text-gray-800  dark:text-gray-100">
            {formatNumber(detail.scoredMark)} <span className="text-sm text-gray-400  dark:text-gray-500 font-semibold">/ {formatNumber(detail.maxMark)}</span>
          </p>
          <p className={`text-xs mt-1 font-semibold ${typeLabel === 'Theory' ? 'text-blue-600  dark:text-blue-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
            Wtg: {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
          </p>
        </div>
      }
      className="bg-gray-50  dark:bg-slate-800/50 rounded-xl border border-gray-100  dark:border-gray-800 overflow-hidden"
      headerClassName="text-xs text-gray-500  dark:text-gray-400 font-bold uppercase tracking-wider"
      contentClassName="border-t border-gray-200  dark:border-gray-800 bg-white  dark:bg-black"
    >
      {(isRelative && (!aStat || aStat.count === 0)) ? (
        <p className="text-sm text-gray-500  dark:text-gray-400 italic text-center py-2">
          Not enough data to calculate class statistics for this assessment yet.
        </p>
      ) : (
        <div className="space-y-4">
          {isRelative && aStat && (
            <div className="flex justify-between items-center text-sm">
              <div>
                <p className="text-gray-500  dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Class Avg</p>
                <p className="font-bold text-gray-900  dark:text-gray-100">{sBoundaryCalc(aStat.mean, detail.maxMark)} <span className="text-xs font-normal text-gray-500">({formatNumber(aStat.mean)}%)</span></p>
              </div>
              <div className="text-right">
                <p className="text-gray-500  dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Std Dev</p>
                <p className="font-bold text-gray-900  dark:text-gray-100">±{sBoundaryCalc(aStat.sd, detail.maxMark)}</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-gray-500  dark:text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-2">
              {isRelative ? "Grade Placement Preview" : "Absolute Grade Range Preview"}
            </p>
            <div className="flex gap-2">
              {gradeBounds.map(b => (
                <div key={b.grade} className={`flex-1 rounded-md p-1.5 flex flex-col items-center justify-center border border-transparent ${b.grade === gradePlacement ? 'ring-2 ring-indigo-500' : ''} ${b.color}`}>
                  <span className="font-black text-sm">{b.grade}</span>
                  <span className="text-[10px] font-bold">{b.range}</span>
                </div>
              ))}
            </div>
            {gradePlacement !== "?" && (
              <p className="text-center text-xs mt-3 text-indigo-600  dark:text-indigo-400 font-bold">
                Hypothetical Placement: Grade {gradePlacement}
              </p>
            )}
          </div>
        </div>
      )}
    </ExpandableSection>
  );
}
export default function CourseDashboard({
  marksData, attendanceData, allGradesData, pastSemesterData, loginToVTOP, setActiveSubTab,
  calendars, decimalValues, isDayscholarWithBus
}: {
  marksData: any; attendanceData: any; allGradesData?: any;
  pastSemesterData?: any; loginToVTOP: () => Promise<Creds>; setActiveSubTab: (tab: string) => void;
  calendars?: any; decimalValues?: boolean; isDayscholarWithBus?: boolean;
}) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const credsRef = useRef<Creds | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState("overview");
  const [coursePlan, setCoursePlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStats, setAllStats] = useState<Record<string, any>>({});
  const [embeddedScope, setEmbeddedScope] = useState<"theory" | "lab">("theory");

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
      const saved = localStorage.getItem("uniCC_notes_tracker");
      if (saved) setNotesTracker(JSON.parse(saved));
    } catch {}
  }, []);

  const uniqueCourses = useMemo(() => {
    const coursesBySemester = new Map<string, any[]>();
    
    // Process current semester
    const currentMap = new Map();
    if (marksData?.courses) {
      marksData.courses.forEach((c: any) => {
        const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
        const key = c.courseCode?.replace(/\([LPT]\)$/i, "").trim();
        if (!currentMap.has(key)) {
          currentMap.set(key, {
            courseCode: key,
            courseTitle: c.courseTitle,
            semesterSubId: "Current",
            theory: !isLab ? { ...c } : null,
            lab: isLab ? { ...c } : null,
          });
        } else {
          const existing = currentMap.get(key);
          if (isLab) existing.lab = { ...c };
          else existing.theory = { ...c };
        }
      });
    }

    if (attendanceData?.attendance) {
      attendanceData.attendance.forEach((c: any) => {
        const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
        let key = c.courseCode?.replace(/\([LPT]\)$/i, "").trim();
        if (key && key.includes(" ")) key = key.split(" ")[0];

        if (!currentMap.has(key)) {
          currentMap.set(key, {
            courseCode: key,
            courseTitle: c.courseTitle,
            semesterSubId: "Current",
            theory: !isLab ? { ...c, classNbr: c.classId } : null,
            lab: isLab ? { ...c, classNbr: c.classId } : null,
          });
        } else {
          const existing = currentMap.get(key);
          if (isLab) existing.lab = { ...(existing.lab || {}), ...c, classNbr: c.classId || existing.lab?.classNbr };
          else existing.theory = { ...(existing.theory || {}), ...c, classNbr: c.classId || existing.theory?.classNbr };
          existing.courseTitle = c.courseTitle || existing.courseTitle;
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
        
        if (data.marks?.courses) {
          data.marks.courses.forEach((c: any) => {
            const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
            const key = c.courseCode?.replace(/\([LPT]\)$/i, "").trim();
            if (!semMap.has(key)) semMap.set(key, { courseCode: key, courseTitle: c.courseTitle, semesterSubId: semId, theory: !isLab ? { ...c } : null, lab: isLab ? { ...c } : null });
            else {
              const existing = semMap.get(key);
              if (isLab) existing.lab = { ...c };
              else existing.theory = { ...c };
            }
          });
        }

        if (data.attendance?.attendance) {
          data.attendance.attendance.forEach((c: any) => {
            const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
            let key = c.courseCode?.replace(/\([LPT]\)$/i, "").trim();
            if (key && key.includes(" ")) key = key.split(" ")[0];
            if (!semMap.has(key)) semMap.set(key, { courseCode: key, courseTitle: c.courseTitle, semesterSubId: semId, theory: !isLab ? { ...c, classNbr: c.classId } : null, lab: isLab ? { ...c, classNbr: c.classId } : null });
            else {
              const existing = semMap.get(key);
              if (isLab) existing.lab = { ...(existing.lab || {}), ...c, classNbr: c.classId || existing.lab?.classNbr };
              else existing.theory = { ...(existing.theory || {}), ...c, classNbr: c.classId || existing.theory?.classNbr };
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
          const code = (c.courseCode || c.code || "").trim();
          if (!code) return;
          const cleanCode = code.replace(/\([LPT]\)$/i, "").trim();
          
          if (!semMap.has(cleanCode)) {
            semMap.set(cleanCode, {
              courseCode: cleanCode,
              courseTitle: c.courseTitle || c.title || cleanCode,
              semesterSubId: semId,
              theory: { courseType: c.courseType || "Theory", courseCode: code, courseTitle: c.courseTitle || c.title },
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
      (c.courseCode && c.courseCode.trim() !== "") || 
      (c.courseTitle && c.courseTitle.trim() !== "")
    );
  }, [marksData, attendanceData, pastSemesterData]);

  useEffect(() => {
    if (!marksData?.courses) return;
    const fetchStats = async () => {
      try {
        const classIds = uniqueCourses.map(g => (g.theory || g.lab).classNbr).join(",");
        if (!classIds) return;
        const res = await fetch(`${API_BASE}/api/marks/stats?classes=${classIds}`);
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
    if (comp.faculty && comp.faculty.trim() !== "") return comp.faculty;
    try {
      const r = await fetch(`${API_BASE}/api/course-page`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies: creds?.cookies, authorizedID: creds?.authorizedID, csrf: creds?.csrf,
          formData: { 
            semesterSubId: selectedGroup?.semesterSubId === "Current" ? "" : (selectedGroup?.semesterSubId || ""), 
            courseCode: comp.classNbr, 
            slotId: comp.slot 
          }
        }),
      });
      const d = await r.json();
      if (d.success !== false && d.results?.selectOptions?.faculty?.length > 1) {
        comp.faculty = d.results.selectOptions.faculty[1].value;
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
        const r = await fetch(`${API_BASE}/api/course-page`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { semesterSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), courseCode: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          }),
        });
        const d = await r.json();
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
        const r = await fetch(`${API_BASE}/api/course-page`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf,
            formData: { viewDetail: "true", semSubId: selectedGroup.semesterSubId === "Current" ? "" : (selectedGroup.semesterSubId || ""), erpId, classId: comp.classNbr, slotId: comp.slot, faculty: resolvedFaculty }
          }),
        });
        const d = await r.json();
        if (d.success !== false && d.results) detailData.push({ type: comp.courseType, data: d.results });
      }
      setViewDetail(detailData.length > 0 ? detailData : null);
    } catch (err: any) { setError(err.message); }
    finally { setViewLoading(false); }
  };

  useEffect(() => { if (selectedCode) { setCoursePlan(null); setViewDetail(null); setInnerTab("overview"); fetchCoursePlan(); } }, [selectedCode]);

  const handleSelectCourse = (code: string) => setSelectedCode(code);
  const handleSelectCourseTab = (code: string, tab: string) => {
    setSelectedCode(code);
    setInnerTab(tab);
  };
  const handleBack = () => { setSelectedCode(null); setCoursePlan(null); setViewDetail(null); };

  const isEmbedded = selectedGroup?.theory && selectedGroup?.lab;

  /* ---- ATTENDANCE TAB HELPERS ---- */
  const thresholdPct = isDayscholarWithBus ? 85 : 75;
  const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;
  const historyList = attendanceItem?.viewLink || [];
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

  const countTillDate = useCallback((endDate: any) => {
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
  }, [attendanceItem, dayCardsMap, analyzeCalendars]);

  const classesTillCAT1 = useMemo(() => countTillDate(impDates.cat1Date), [countTillDate, impDates.cat1Date]);
  const classesTillCAT2 = useMemo(() => countTillDate(impDates.cat2Date), [countTillDate, impDates.cat2Date]);
  const classesTillMidSem = useMemo(() => countTillDate(impDates.midsemStart), [countTillDate, impDates.midsemStart]);
  const classesTillLID = useMemo(() =>
    countTillDate(isLabAtt ? impDates.lidLabDate : impDates.lidTheoryDate),
  [countTillDate, isLabAtt, impDates.lidLabDate, impDates.lidTheoryDate]);

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

  const renderAssessmentTable = (assessments: any[], typeLabel: string) => {
    if (!assessments || assessments.length === 0) return null;
    const totals = getAssessmentTotals(assessments);
    return (
      <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-5 shadow-sm mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5" /> {typeLabel} Assessments
          </h3>
          <div className="flex items-center gap-3">
            <Badge variant={typeLabel === 'Theory' ? 'info' : 'success'} className="font-bold border rounded-full">
              {formatNumber(totals.weighted)} / {formatNumber(totals.weightPercent)}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((detail: any, idx: number) => {
            const aStat = asmStats[detail.title];
            return <AssessmentCard key={idx} detail={detail} typeLabel={typeLabel} aStat={aStat} isRelative={isRelative} />;
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100  dark:border-gray-800 flex justify-end">
          <p className="text-sm font-semibold text-gray-700  dark:text-gray-300">
            Max Possible Score: <span className="font-bold text-gray-900  dark:text-gray-100">{formatNumber(100 - (totals.weightPercent - totals.weighted))}</span>
          </p>
        </div>
      </div>
    );
  };

  // ---- GRID VIEW ----
  if (!selectedCode) {
    return (
      <SubpageLayout title="Course Dashboard" onBack={() => setActiveSubTab("overview")}>
        {uniqueCourses.length === 0 ? (
          <Card><div className="p-10 text-center"><BookOpen className="w-10 h-10 text-gray-300  dark:text-gray-700 mx-auto mb-3" /><p className="text-sm text-gray-400  dark:text-gray-500">No course data available</p></div></Card>
        ) : (
          <div className="space-y-8">
            {Array.from(
              uniqueCourses.reduce((acc, group) => {
                const sem = group.semesterSubId || "Current";
                if (!acc.has(sem)) acc.set(sem, []);
                acc.get(sem)!.push(group);
                return acc;
              }, new Map<string, any[]>()).entries()
            ).map(([semester, courses], semIdx) => (
              <div key={semester}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full" />
                  {semester === "Current" ? "Current Semester" : `${formatSemesterName(semester)}`}
                  <span className="text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md ml-2">
                    {courses.length} Courses
                  </span>
                </h3>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {courses.map((group: any, idx: number) => {
              const main = group.theory || group.lab;
              const courseType = (group.theory && group.lab) ? "Embedded" : main.courseType;
              const isRelative = checkIsRelative(main.courseSystem, courseType);
              const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
              const courseStats = getCourseStats(group);
              const isPastSemester = group.semesterSubId && group.semesterSubId !== "Current";
              let sourceAttendance = attendanceData?.attendance || [];
              if (isPastSemester && pastSemesterData?.[group.semesterSubId]?.attendance?.attendance) {
                sourceAttendance = pastSemesterData[group.semesterSubId].attendance.attendance;
              }
              const attItems = sourceAttendance.filter((a: any) =>
                a.courseCode?.replace(/\s*\([LPT]\)$/i, "").trim() === group.courseCode.trim()
              );
              const theoryAttItem = attItems.find((a: any) => !a.courseCode?.endsWith("(L)") && !a.courseCode?.endsWith("(P)")) || attItems[0];
              const labAttItem = attItems.find((a: any) => a.courseCode?.endsWith("(L)") || a.courseCode?.endsWith("(P)"));
              const att = theoryAttItem || labAttItem;

              let percent = 0, text = "0/0";
              if (courseTotalString === "Reload Required") text = "N/A";
              else if (typeof courseTotalString === "string" && courseTotalString.includes("/")) {
                const [w, wp] = courseTotalString.split("/");
                if (Number(wp) > 0) percent = (Number(w) / Number(wp)) * 100;
                text = `${formatNumber(w)}/${formatNumber(wp)}`;
              } else text = String(courseTotalString);

              let predictedGrade = "?";
              if (isRelative) {
                const statInfo = allStats[main.classNbr]?.overall;
                if (statInfo && statInfo.count > 0 && courseStats.projected > 0) {
                  const { mean, sd } = statInfo;
                  const proj = courseStats.projected;
                  if (proj >= Math.min(Math.max(mean + 1.5 * sd, 80), 100)) predictedGrade = "S";
                  else if (proj >= mean + 0.5 * sd) predictedGrade = "A";
                  else if (proj >= mean - 0.5 * sd) predictedGrade = "B";
                  else if (proj >= mean - 1.0 * sd) predictedGrade = "C";
                  else if (proj >= mean - 1.5 * sd) predictedGrade = "D";
                  else if (proj >= Math.min(mean - 2.0 * sd, 50)) predictedGrade = "E";
                  else predictedGrade = "F";
                }
              } else {
                const proj = courseStats.projected;
                if (proj >= 90) predictedGrade = "S";
                else if (proj >= 80) predictedGrade = "A";
                else if (proj >= 70) predictedGrade = "B";
                else if (proj >= 60) predictedGrade = "C";
                else if (proj >= 50) predictedGrade = "D";
                else if (proj >= 40) predictedGrade = "E";
                else predictedGrade = "F";
              }

              const assessmentCount = (group.theory?.assessments?.length || 0) + (group.lab?.assessments?.length || 0);
              let pastGrade = "";
              if (isPastSemester && allGradesData?.grades) {
                let gradeArray: any[] = [];
                if (allGradesData.grades[group.semesterSubId]) {
                  const sem = allGradesData.grades[group.semesterSubId];
                  gradeArray = sem?.grades || sem || [];
                } else if (Array.isArray(allGradesData.grades)) {
                  gradeArray = allGradesData.grades;
                } else {
                  gradeArray = Object.values(allGradesData.grades).flatMap((s: any) => s?.grades || s || []);
                }
                const items = Array.isArray(gradeArray) ? gradeArray : Object.values(gradeArray);
                const found = items.find((g: any) => (g.courseCode || g.code) === group.courseCode);
                if (found) pastGrade = found.grade || found.courseGrade;
              }

              const faculty = main.faculty || att?.faculty || (isPastSemester ? "Past Faculty" : "Faculty not listed");
              const attendancePct = Number(att?.attendancePercentage) || (isPastSemester && pastGrade ? 100 : 0);
              const statusTone = isPastSemester 
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                : predictedGrade === "F" || attendancePct < 75
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                : percent >= 75 && attendancePct >= 75
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300";
              const statusLabel = isPastSemester ? `Completed: ${pastGrade}` : predictedGrade === "F" || attendancePct < 75 ? "Needs attention" : percent >= 75 ? "On track" : "Watchlist";

              return (
                <div key={group.courseCode} onClick={() => handleSelectCourse(group.courseCode)}
                  className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm cursor-pointer transition-colors duration-150 hover:bg-gray-50   dark:hover:bg-slate-800/70 dark:border-gray-800 dark:bg-black">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900  dark:text-gray-100">{group.courseCode}</p>
                          <h3 className="mt-0.5 line-clamp-2 text-base font-bold leading-tight text-gray-700  dark:text-gray-300">{group.courseTitle}</h3>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-1">
                          <div className="bg-gray-50 dark:bg-slate-800/50 dark:border-gray-800 border p-2.5 rounded-xl transition-colors group-hover:bg-gray-100 dark:group-hover:bg-gray-900/50 flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                              {isPastSemester ? "Final Grade" : "Attendance"}
                            </span>
                            <div className="flex items-center">
                              {isPastSemester ? (
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                  {pastGrade || "N/A"}
                                </span>
                              ) : attendancePct ? (
                                <CircularProgress value={attendancePct} size={34} strokeWidth={12} />
                              ) : (
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">N/A</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-slate-800/50 dark:border-gray-800 border p-2.5 rounded-xl transition-colors group-hover:bg-gray-100 dark:group-hover:bg-gray-900/50 flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                              {isPastSemester ? "Past Internal" : "Internal Marks"}
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{isPastSemester ? (courseTotalString !== "Reload Required" && String(courseTotalString).includes("/") ? String(courseTotalString).split("/")[0] : "N/A") : percent.toFixed(1)}</span>
                              {!isPastSemester && <span className="text-[10px] font-bold text-gray-400">/ 100</span>}
                            </div>
                          </div>
                        </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <TypeBadge label={courseType} />
                        {predictedGrade !== "?" && !isPastSemester && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveSubTab("predictor");
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100  dark:hover:bg-indigo-900/50 dark:bg-indigo-900/30 text-indigo-700  dark:text-indigo-300 uppercase tracking-wider transition-colors"
                            title="Open GPA Predictor"
                          >
                            Pred: {predictedGrade}
                          </button>
                        )}
                        {att && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectCourseTab(group.courseCode, "attendance");
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider transition-colors ${
                            Number(att.attendancePercentage) >= 85 ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-300" :
                            Number(att.attendancePercentage) >= 75 ? "bg-blue-100 text-blue-700   dark:bg-blue-900/30 dark:text-blue-300" :
                            "bg-red-100 text-red-700   dark:bg-red-900/30 dark:text-red-300"
                          }`}
                            title="Open course attendance"
                          >
                            {att.attendancePercentage}% att
                          </button>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Marks</p>
                          <p className="mt-1 text-sm font-black text-gray-900 dark:text-gray-100">{text}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            {isPastSemester ? "Final Grade" : "Prediction"}
                          </p>
                          <p className="mt-1 text-sm font-black text-indigo-600 dark:text-indigo-400">
                            {isPastSemester ? (pastGrade || "N/A") : predictedGrade}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Assessments</p>
                          <p className="mt-1 text-sm font-black text-gray-900 dark:text-gray-100">{assessmentCount}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveSubTab("faculty-info");
                            }}
                            className="truncate flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                            title="Open Faculty Info"
                          >
                            <User className="h-3.5 w-3.5 shrink-0" /> {faculty}
                          </button>
                          <span className="shrink-0">{Math.round(percent)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-blue-600 transition-all duration-150" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-center gap-3">
                      {(group.theory && group.lab) ? (
                        <>
                          {theoryAttItem && (
                            <div className="flex flex-col items-center gap-1">
                              <CircularProgress value={Number(theoryAttItem.attendancePercentage) || (isPastSemester && pastGrade ? 100 : 0)} text={`${theoryAttItem.attendancePercentage || (isPastSemester && pastGrade ? 100 : 0)}%`} size={52} threshold={isDayscholarWithBus ? 85 : 75} midThreshold={100} />
                              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mt-1">Theory</span>
                            </div>
                          )}
                          {labAttItem && (
                            <div className="hidden md:flex flex-col items-center gap-1">
                              <CircularProgress value={Number(labAttItem.attendancePercentage) || (isPastSemester && pastGrade ? 100 : 0)} text={`${labAttItem.attendancePercentage || (isPastSemester && pastGrade ? 100 : 0)}%`} size={52} threshold={isDayscholarWithBus ? 85 : 75} midThreshold={100} />
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Lab</span>
                            </div>
                          )}
                        </>
                      ) : (att || isPastSemester) && (
                        <div className="flex flex-col items-center gap-1">
                          <CircularProgress value={attendancePct} text={`${attendancePct}%`} size={64} threshold={isDayscholarWithBus ? 85 : 75} midThreshold={100} />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Attendance</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SubpageLayout>
    );
  }



  return (
    <SubpageLayout title={selectedCode || ""} subtitle={selectedGroup?.courseTitle || ""} onBack={handleBack}>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <TabButton active={innerTab === "overview"} label="Overview" onClick={() => setInnerTab("overview")} />
        <TabButton active={innerTab === "marks"} label="Marks" onClick={() => setInnerTab("marks")} />
        {attendanceItem && <TabButton active={innerTab === "attendance"} label="Attendance" onClick={() => setInnerTab("attendance")} />}
        <TabButton active={innerTab === "plan"} label="Course Plan" onClick={() => { setInnerTab("plan"); if (!coursePlan && !planLoading) fetchCoursePlan(); }} />
        <TabButton active={innerTab === "qbank"} label="QBank" onClick={() => setInnerTab("qbank")} />
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* OVERVIEW */}
      {innerTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <div className="p-5">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Attendance</h4>
              {isEmbedded ? (
                <div className="flex flex-col gap-6">
                  {theoryAttItem && (
                    <div className="flex items-center gap-5 border-b border-gray-100 dark:border-gray-800 pb-4">
                      <CircularProgress value={Number(theoryAttItem.attendancePercentage) || 0} size={70} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Theory</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200"><strong>{theoryAttItem.attendedClasses}</strong> / {theoryAttItem.totalClasses} classes</p>
                        {theoryAttItem.slotVenue && <p className="text-xs text-gray-400 dark:text-gray-500">Venue: {theoryAttItem.slotVenue}</p>}
                        {theoryAttItem.faculty && <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> {theoryAttItem.faculty}</p>}
                      </div>
                    </div>
                  )}
                  {labAttItem && (
                    <div className="flex items-center gap-5">
                      <CircularProgress value={Number(labAttItem.attendancePercentage) || 0} size={70} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Lab</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200"><strong>{labAttItem.attendedClasses}</strong> / {labAttItem.totalClasses} classes</p>
                        {labAttItem.slotVenue && <p className="text-xs text-gray-400 dark:text-gray-500">Venue: {labAttItem.slotVenue}</p>}
                        {labAttItem.faculty && <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> {labAttItem.faculty}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ) : attendanceItem ? (
                <div className="flex items-center gap-5">
                  <CircularProgress value={Number(attendanceItem.attendancePercentage) || 0} size={80} />
                  <div className="space-y-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200"><strong>{attendanceItem.attendedClasses}</strong> / {attendanceItem.totalClasses} classes</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{attendanceItem.attendancePercentage || "0"}% attendance</p>
                    {attendanceItem.slotVenue && <p className="text-xs text-gray-400 dark:text-gray-500">Venue: {attendanceItem.slotVenue}</p>}
                    {attendanceItem.faculty && <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> {attendanceItem.faculty}</p>}
                  </div>
                </div>
              ) : <p className="text-sm text-gray-400 dark:text-gray-500">No attendance data</p>}
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Course Info</h4>
              {mainCourse ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600  dark:text-gray-400">Course Type</span><span className="text-sm font-semibold text-gray-800  dark:text-gray-200">{isEmbedded ? "Embedded" : mainCourse.courseType}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600  dark:text-gray-400">Slot</span><span className="text-sm font-semibold text-gray-800  dark:text-gray-200">{mainCourse.slot}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600  dark:text-gray-400">Faculty</span><span className="text-sm font-semibold text-gray-800  dark:text-gray-200 truncate max-w-[200px]">{mainCourse.faculty}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600  dark:text-gray-400">System</span><span className="text-sm font-semibold text-gray-800  dark:text-gray-200">{mainCourse.courseSystem}</span></div>
                  {attendanceItem?.credits && <div className="flex items-center justify-between"><span className="text-sm text-gray-600  dark:text-gray-400">Credits</span><span className="text-sm font-semibold text-gray-800  dark:text-gray-200">{attendanceItem.credits}</span></div>}
                  {isEmbedded && (
                    <div className="mt-3 pt-3 border-t border-gray-100  dark:border-gray-800">
                      <p className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-2">Components</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600  dark:text-gray-400">{selectedGroup.theory?.courseType}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200 dark:text-gray-200">Class: {selectedGroup.theory?.classNbr?.slice(-4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600  dark:text-gray-400">{selectedGroup.lab?.courseType}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200 dark:text-gray-200">Class: {selectedGroup.lab?.classNbr?.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-gray-400  dark:text-gray-500">No marks data</p>}
            </div>
          </Card>
          <Card className="md:col-span-2">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Course Plan</h4>
                {coursePlan && <button onClick={() => { setInnerTab("plan"); }} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">View Details</button>}
              </div>
              {planLoading ? <Skeleton className="h-24 w-full rounded-xl" />
              : coursePlan ? coursePlan.map((cp: any, i: number) => (
                cp.data.tables?.map((t: any) => t.rows?.slice(0, 2).map((r: any, ri: number) => (
                  <div key={`${i}-${ri}`} className="p-3 rounded-xl bg-gray-50  dark:bg-slate-800/50 mb-2">
                    <p className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase mb-1">{cp.type}</p>
                    <p className="text-sm font-semibold text-gray-800  dark:text-gray-200">{r["Course Title"] || r["Course Code"] || "Course info"}</p>
                    <p className="text-xs text-gray-500  dark:text-gray-400">{r["Slot"] && `Slot: ${r["Slot"]}`}{r["Faculty"] ? ` | ${r["Faculty"]}` : ""}</p>
                  </div>
                )))
              )) : <p className="text-sm text-gray-400  dark:text-gray-500">Course plan loads automatically</p>}
            </div>
          </Card>
          {viewDetail && (
            <Card className="md:col-span-2">
              <div className="p-5">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Schedule Preview</h4>
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
                {(!viewDetail[0]?.data.tables || viewDetail[0].data.tables.length <= 1) && <p className="text-sm text-gray-400  dark:text-gray-500">No schedule data</p>}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MARKS - Full replication of MarksSubpage */}
      {innerTab === "marks" && (
        <div>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Course Type</p>
              <p className="text-sm font-semibold text-gray-900  dark:text-gray-100 line-clamp-1">{courseTypeLabel}</p>
            </div>
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Total Score</p>
              <p className="text-sm font-bold text-blue-600  dark:text-blue-400">{courseTotalString}</p>
            </div>
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Projected %</p>
              <p className="text-sm font-bold text-indigo-600  dark:text-indigo-400">{courseStats.projected}%</p>
            </div>
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Max Grade Achievable</p>
              <p className="text-sm font-bold text-orange-600  dark:text-orange-400">{formatNumber(courseStats.maxPossible)}%</p>
            </div>
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Grading Mode</p>
              <p className={`text-sm font-bold ${isRelative ? 'text-indigo-600  dark:text-indigo-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
                {isRelative ? "Relative" : "Absolute"}
              </p>
            </div>
            <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Slot</p>
              <p className="text-sm font-medium text-gray-900  dark:text-gray-100">{mainCourse?.slot}</p>
            </div>
          </div>

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
              <div className="xl:col-span-2">
                <div className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full">
                  <div className="p-5 border-b border-gray-100  dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100">Interactive Predictor</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tap on upcoming classes to see how skipping them affects your attendance before exams.</p>
                  </div>
                  <div className="divide-y divide-gray-100  dark:divide-gray-800">
                    {[
                      { key: "CAT1", label: "Classes before CAT I", data: classesTillCAT1 },
                      { key: "CAT2", label: "Classes before CAT II", data: classesTillCAT2 },
                      { key: "MIDSEM", label: "Classes before Mid Term Test", data: classesTillMidSem },
                      { key: "LID", label: "Classes before FAT", data: classesTillLID },
                    ].map(({ key, label, data }) => (
                      Array.isArray(data) && data.length > 0 ? (
                        <div key={key}>
                          <ExpandableSection
                            title={label}
                            icon={<CalendarIcon size={18} className="text-blue-500" />}
                            badge={<span className="text-sm font-medium bg-gray-100  dark:bg-gray-800 px-2 py-0.5 rounded-md">{data.length} Left</span>}
                          >
                            <div className="p-4 space-y-2">
                              {data.map((cls: any, ci: number) => {
                                const clsDate = new Date(cls.date);
                                const isSkipped = cls.status === "skipping";
                                const isAttending = cls.status === "attending" || cls.status === "default";
                                const isPast = clsDate < new Date(new Date().toDateString());
                                return (
                                  <div key={ci} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                    isPast ? 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/50 opacity-60' :
                                    isSkipped ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' :
                                    'bg-gray-50  dark:bg-slate-800/50 border-gray-100 dark:border-gray-700'
                                  }`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${
                                        isPast ? 'bg-gray-400' : isSkipped ? 'bg-red-500' : 'bg-emerald-500'
                                      }`} />
                                      <span className={`text-sm ${isPast ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                        {cls.date} {cls.day}
                                      </span>
                                    </div>
                                    <span className={`text-xs font-semibold ${isPast ? 'text-gray-400' : isSkipped ? 'text-red-500' : 'text-emerald-600'}`}>
                                      {isPast ? 'Past' : isSkipped ? 'Skipping' : 'Attending'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </ExpandableSection>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={`${hasPredictor ? "xl:col-span-1" : ""} min-w-0 w-full`}>
              <div className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                <div className="p-5 border-b border-gray-100  dark:border-gray-800 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
                        Attendance Log
                        {missingNotesCount > 0 && (
                          <Badge variant="danger" className="bg-red-100 text-red-600   dark:bg-red-900/30 dark:text-red-400 font-bold">
                            {missingNotesCount} Missing Notes
                          </Badge>
                        )}
                      </h2>
                      {!hasPredictor && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your past classes and secure notes for days you missed.</p>}
                    </div>
                    <div className="flex bg-gray-100  dark:bg-gray-900 p-1 rounded-lg">
                      {[
                        { key: "calendar" as const, icon: <CalendarIcon size={18} /> },
                        { key: "heatmap" as const, icon: <Grid3x3 size={18} /> },
                        { key: "list" as const, icon: <List size={18} /> },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setViewMode(opt.key)}
                          className={`p-1.5 rounded-md transition-colors ${viewMode === opt.key ? 'bg-white  dark:bg-black text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {viewMode === "list" && (
                    <div className="flex bg-gray-100  dark:bg-gray-900 p-1 rounded-lg overflow-x-auto hide-scrollbar w-max">
                      {["All", "Present", "Absent", "On Duty"].map(f => (
                        <button
                          key={f}
                          onClick={() => setAttFilter(f)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${attFilter === f ? "bg-white  dark:bg-black text-gray-900  dark:text-gray-100 shadow-sm" : "text-gray-500  dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:hover:text-gray-300"}`}
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
        <div>
          {planLoading ? (
            <div className="space-y-3"><Skeleton className="h-8 w-48 rounded-lg" /><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>
          ) : coursePlan ? (
            coursePlan.map((cp: any, ci: number) => (
              <div key={ci} className={ci > 0 ? "mt-8" : ""}>
                {coursePlan.length > 1 && (
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> {cp.type === "Embedded Theory" || cp.type === "Theory Only" ? "Theory" : "Lab"} Component
                  </h4>
                )}
                {cp.data.tables?.map((t: any, ti: number) => (
                  <Card key={ti}>
                    <div className="p-5">
                      {t.caption && <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t.caption}</h4>}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                            {t.headers?.map((h: string, hi: number) => (<th key={hi} className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}
                          </tr></thead>
                          <tbody>{t.rows?.map((row: any, ri: number) => (
                            <tr key={ri} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                              {t.headers.map((h: string, ci: number) => (<td key={ci} className="py-2.5 px-2 text-sm text-gray-800 dark:text-gray-200">{row[h] || "—"}</td>))}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ))
          ) : <Card><div className="p-5 text-sm text-gray-400">Loading course plan...</div></Card>}

          {/* Schedule toggle */}
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Weekly Schedule</h4>
                <button onClick={() => { if (viewDetail) setViewDetail(null); else fetchViewDetail(); }} disabled={viewLoading}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
                  {viewLoading ? "Loading..." : viewDetail ? "Hide" : "Load Schedule"}
                </button>
              </div>
              {viewDetail && viewDetail.map((vd: any, ci: number) => (
                <div key={ci} className="mt-4">
                  {viewDetail.length > 1 && <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{vd.type} Schedule</p>}
                  {vd.data.tables?.slice(1).map((t: any, ti: number) => (
                    <div key={ti} className="mb-4 last:mb-0 overflow-x-auto">
                      {t.caption && <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">{t.caption}</h5>}
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                          {t.headers?.map((h: string, hi: number) => (<th key={hi} className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}
                        </tr></thead>
                        <tbody>{t.rows?.map((row: any, ri: number) => (
                          <tr key={ri} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                            {t.headers.map((h: string, ci: number) => (<td key={ci} className="py-2 px-2 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* QBANK */}
      {innerTab === "qbank" && selectedCode && (
        <CourseQBankTab courseCode={selectedCode} username={creds?.authorizedID || "unknown"} />
      )}
    </SubpageLayout>
  );
}
