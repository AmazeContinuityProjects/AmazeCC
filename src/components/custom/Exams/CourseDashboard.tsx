"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import CircularProgress from "../shared/CircularProgress";
import Badge from "../shared/Badge";
import ExpandableSection from "../shared/ExpandableSection";
import { Skeleton, SubTabStrip } from "@amazecontinuityprojects/amazeui";
import {
  XCircle, BookOpen, User, Target, Clock, Info, Activity,
  ChevronLeft, FileText, Calendar, Calendar as CalendarIcon, MessageSquare,
  Building2, AlertCircle, Star, Grid3x3, List, CheckCircle2,
  FileText as FileTextIcon, Search, ChevronDown
} from "lucide-react";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { countRemainingClasses, UpcomingClassesList } from "../attendance/AttendanceSubpage";
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

// TabButton replaced with SubTabStrip from AmazeUI

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
    <div className="relative overflow-hidden rounded-2xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all hover:shadow-md">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${typeLabel === 'Theory' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
      <ExpandableSection
        title={shortenedTitle}
        badge={
          <div className="text-right">
            <p className="text-xl font-black text-gray-900 dark:text-gray-100">
              {formatNumber(detail.scoredMark)} <span className="text-xs text-gray-400 dark:text-gray-500 font-bold">/ {formatNumber(detail.maxMark)}</span>
            </p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${typeLabel === 'Theory' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, asmPct))}%` }} />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${typeLabel === 'Theory' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
              </p>
            </div>
          </div>
        }
        className="bg-transparent border-none overflow-hidden"
        headerClassName="text-[11px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest pl-3"
        contentClassName="border-t border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-black/20 backdrop-blur-md p-4"
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
    </div>
  );
}

const getCourseHealth = (attendancePct: number, internalPct: number, predictedGrade: string, isPastSemester: boolean) => {
  if (isPastSemester) return { label: "Completed", color: "bg-slate-50 text-slate-650 border-slate-200/50 dark:bg-neutral-800/40 dark:text-gray-300 dark:border-neutral-700/50" };
  
  if (attendancePct < 75 || predictedGrade === "F") {
    return { label: "Critical", color: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30" };
  }
  if (attendancePct < 80 || predictedGrade === "D" || predictedGrade === "E") {
    return { label: "Watch", color: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30" };
  }
  return { label: "Healthy", color: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30" };
};

const getGradeBadgeStyle = (grade: string) => {
  const g = grade.toUpperCase();
  if (["S", "A"].includes(g)) return "bg-emerald-50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30";
  if (["B", "C"].includes(g)) return "bg-blue-50 text-blue-700 border-blue-100/50 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30";
  if (["D", "E"].includes(g)) return "bg-amber-50 text-amber-700 border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30";
  if (g === "F") return "bg-rose-50 text-rose-700 border-rose-100/50 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30";
  return "bg-slate-50 text-slate-650 border-slate-100/50 dark:bg-neutral-800/40 dark:text-gray-300 dark:border-neutral-700/50";
};

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

  const [qcmData, setQcmData] = useState<any>(null);
  const [qcmLoading, setQcmLoading] = useState(false);
  const [qcmError, setQcmError] = useState("");
  const [arrearsCourses, setArrearsCourses] = useState<Set<string>>(new Set());

  // Attendance tab state
  const [attFilter, setAttFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "heatmap" | "calendar">("list");
  const [notesTracker, setNotesTracker] = useState<Record<string, Record<string, boolean>>>({});
  const [targetGrade, setTargetGrade] = useState("A");

  // Redesigned dashboard state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [selectedSemester, setSelectedSemester] = useState("All");

  useEffect(() => {
    loginToVTOP().then(c => { credsRef.current = c; setCreds(c); }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const savedTracker = localStorage.getItem("notesTracker");
      if (savedTracker) setNotesTracker(JSON.parse(savedTracker));
    } catch {}

    try {
      const raw = localStorage.getItem("cache_arrear-details");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.tables) {
          const codes = new Set<string>();
          parsed.tables.forEach((table: any) => {
            const hIdx = table.headers?.findIndex((h: string) => h.toLowerCase().includes("course code"));
            if (hIdx !== -1 && table.rows) {
              table.rows.forEach((r: any[]) => {
                if (r[hIdx]) codes.add(r[hIdx].replace(/\s*\([LPT]\)$/i, "").trim());
              });
            }
          });
          setArrearsCourses(codes);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("uniCC_notes_tracker");
      if (saved) setNotesTracker(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const targetCode = localStorage.getItem("course_dashboard_target");
    const targetTab = localStorage.getItem("course_dashboard_tab");
    if (targetCode) {
      const isLab = targetCode.endsWith("(L)") || targetCode.endsWith("(P)");
      const cleanCode = targetCode.replace(/\([LPT]\)$/i, "").trim();
      setSelectedCode(cleanCode);
      setEmbeddedScope(isLab ? "lab" : "theory");
      if (targetTab) {
        setInnerTab(targetTab);
      }
      localStorage.removeItem("course_dashboard_target");
      localStorage.removeItem("course_dashboard_tab");
    }
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

  const semestersList = useMemo(() => {
    const sems = new Set<string>();
    uniqueCourses.forEach(c => {
      const sem = c.semesterSubId || "Current";
      if (sem !== "Current") sems.add(sem);
    });
    return ["Current", ...Array.from(sems)];
  }, [uniqueCourses]);

  const filteredAndSortedCourses = useMemo(() => {
    let result = [...uniqueCourses];

    // 1. Filter by Semester
    if (selectedSemester !== "All") {
      result = result.filter(group => (group.semesterSubId || "Current") === selectedSemester);
    }

    // 2. Filter by Search Term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(group => 
        group.courseCode?.toLowerCase().includes(term) || 
        group.courseTitle?.toLowerCase().includes(term)
      );
    }

    // 3. Filter by Status/Type
    if (filterStatus !== "all") {
      result = result.filter(group => {
        const main = group.theory || group.lab;
        const courseType = (group.theory && group.lab) ? "Embedded" : main.courseType;
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
        const attendancePct = Number(theoryAttItem?.attendancePercentage || labAttItem?.attendancePercentage) || (isPastSemester ? 100 : 0);

        const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
        let percent = 0;
        if (typeof courseTotalString === "string" && courseTotalString.includes("/")) {
          const [w, wp] = courseTotalString.split("/");
          if (Number(wp) > 0) percent = (Number(w) / Number(wp)) * 100;
        }

        const courseStats = getCourseStats(group);
        const isRelative = checkIsRelative(main.courseSystem, courseType);
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

        const healthLabel = isPastSemester ? "Completed" : (attendancePct < 75 || predictedGrade === "F") ? "Critical" : (attendancePct < 80 || predictedGrade === "D" || predictedGrade === "E") ? "Watch" : "Healthy";

        if (filterStatus === "healthy") return healthLabel === "Healthy";
        if (filterStatus === "watch") return healthLabel === "Watch";
        if (filterStatus === "critical") return healthLabel === "Critical";
        if (filterStatus === "theory") return courseType?.toLowerCase().includes("theory") && !courseType?.toLowerCase().includes("lab");
        if (filterStatus === "lab") return courseType?.toLowerCase().includes("lab") && !courseType?.toLowerCase().includes("theory");
        if (filterStatus === "embedded") return courseType?.toLowerCase().includes("embedded") || (group.theory && group.lab);
        return true;
      });
    }

    // 4. Sort courses
    if (sortBy !== "default") {
      result.sort((a, b) => {
        if (sortBy === "name") {
          return (a.courseTitle || "").localeCompare(b.courseTitle || "");
        }
        if (sortBy === "code") {
          return (a.courseCode || "").localeCompare(b.courseCode || "");
        }
        if (sortBy === "attendance") {
          const getAtt = (group: any) => {
            const isPast = group.semesterSubId && group.semesterSubId !== "Current";
            let sourceAttendance = attendanceData?.attendance || [];
            if (isPast && pastSemesterData?.[group.semesterSubId]?.attendance?.attendance) {
              sourceAttendance = pastSemesterData[group.semesterSubId].attendance.attendance;
            }
            const attItems = sourceAttendance.filter((a: any) =>
              a.courseCode?.replace(/\s*\([LPT]\)$/i, "").trim() === group.courseCode.trim()
            );
            const tAtt = attItems.find((a: any) => !a.courseCode?.endsWith("(L)") && !a.courseCode?.endsWith("(P)")) || attItems[0];
            const lAtt = attItems.find((a: any) => a.courseCode?.endsWith("(L)") || a.courseCode?.endsWith("(P)"));
            return Number(tAtt?.attendancePercentage || lAtt?.attendancePercentage) || (isPast ? 100 : 0);
          };
          return getAtt(b) - getAtt(a); // descending
        }
        if (sortBy === "marks") {
          const getMarks = (group: any) => {
            const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
            if (typeof courseTotalString === "string" && courseTotalString.includes("/")) {
              const [w, wp] = courseTotalString.split("/");
              return Number(wp) > 0 ? (Number(w) / Number(wp)) * 100 : 0;
            }
            return 0;
          };
          return getMarks(b) - getMarks(a); // descending
        }
        return 0;
      });
    }

    return result;
  }, [uniqueCourses, selectedSemester, searchTerm, filterStatus, sortBy, attendanceData, pastSemesterData, allStats]);

  const currentSemesterStats = useMemo(() => {
    const targetCourses = filteredAndSortedCourses;
    
    let totalAttendance = 0;
    let attendanceCount = 0;
    let totalInternalPct = 0;
    let internalCount = 0;
    let totalCredits = 0;
    let atRiskCount = 0;
    let totalAssessments = 0;

    targetCourses.forEach(group => {
      const main = group.theory || group.lab;
      const isPast = group.semesterSubId && group.semesterSubId !== "Current";
      
      // Attendance
      let sourceAttendance = attendanceData?.attendance || [];
      if (isPast && pastSemesterData?.[group.semesterSubId]?.attendance?.attendance) {
        sourceAttendance = pastSemesterData[group.semesterSubId].attendance.attendance;
      }
      const attItems = sourceAttendance.filter((a: any) =>
        a.courseCode?.replace(/\s*\([LPT]\)$/i, "").trim() === group.courseCode.trim()
      );
      const theoryAtt = attItems.find((a: any) => !a.courseCode?.endsWith("(L)") && !a.courseCode?.endsWith("(P)")) || attItems[0];
      const labAtt = attItems.find((a: any) => a.courseCode?.endsWith("(L)") || a.courseCode?.endsWith("(P)"));
      
      if (theoryAtt && theoryAtt.attendancePercentage) {
        totalAttendance += Number(theoryAtt.attendancePercentage);
        attendanceCount++;
      }
      if (labAtt && labAtt.attendancePercentage) {
        totalAttendance += Number(labAtt.attendancePercentage);
        attendanceCount++;
      }

      const attendancePct = Number(theoryAtt?.attendancePercentage || labAtt?.attendancePercentage) || (isPast ? 100 : 0);

      // Credits
      const cCredits = (group.theory ? getCourseCredits(group.theory) : 0) + (group.lab ? getCourseCredits(group.lab) : 0);
      totalCredits += cCredits;

      // Internal Marks
      const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
      let percent = 0;
      if (typeof courseTotalString === "string" && courseTotalString.includes("/")) {
        const [w, wp] = courseTotalString.split("/");
        if (Number(wp) > 0) {
          percent = (Number(w) / Number(wp)) * 100;
          totalInternalPct += percent;
          internalCount++;
        }
      }

      // Assessments
      const assessmentCount = (group.theory?.assessments?.length || 0) + (group.lab?.assessments?.length || 0);
      totalAssessments += assessmentCount;

      // Predicted grade
      const courseStats = getCourseStats(group);
      const courseType = (group.theory && group.lab) ? "Embedded" : main.courseType;
      const isRelative = checkIsRelative(main.courseSystem, courseType);
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

      if (!isPast) {
        if (attendancePct < 75 || predictedGrade === "F") {
          atRiskCount++;
        }
      }
    });

    return {
      avgAttendance: attendanceCount > 0 ? (totalAttendance / attendanceCount).toFixed(1) : "0.0",
      avgInternalMarks: internalCount > 0 ? (totalInternalPct / internalCount).toFixed(1) : "0.0",
      totalCredits,
      atRiskCount,
      totalAssessments,
    };
  }, [filteredAndSortedCourses, attendanceData, pastSemesterData, allStats]);

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
    // If it already looks like a valid VTOP faculty ID string (e.g. "12345 - NAME" or "12345-NAME")
    if (comp.faculty && /^\w+\s*-/.test(comp.faculty.trim())) return comp.faculty;
    
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
      const res = await fetch(`${API_BASE}/api/qcm-view`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: semId }),
      });
      const d = await res.json();
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

  const handleSelectCourse = (code: string) => {
    setSelectedCode(code);
    setInnerTab("overview");
  };
  const handleSelectCourseTab = (code: string, tab: string) => {
    setSelectedCode(code);
    setInnerTab(tab);
  };
  const handleBack = () => { setSelectedCode(null); setCoursePlan(null); setViewDetail(null); };

  const isEmbedded = selectedGroup?.theory && selectedGroup?.lab;

  /* ---- ATTENDANCE TAB HELPERS ---- */
  const thresholdPct = isDayscholarWithBus ? 85 : 75;
  const thresholdDec = isDayscholarWithBus ? 0.85 : 0.75;
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

  // ---- GRID VIEW ----
  if (!selectedCode) {
    return (
      <SubpageLayout title="Course Dashboard" onBack={() => setActiveSubTab("overview")}>
        {uniqueCourses.length === 0 ? (
          <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <BookOpen className="w-10 h-10 text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400 dark:text-neutral-500">No course data available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {/* Card 1: Average Attendance */}
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <p className="text-[10px] font-bold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">Avg Attendance</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">{currentSemesterStats.avgAttendance}%</p>
              </div>
              {/* Card 2: Average Internal Marks */}
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <p className="text-[10px] font-bold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">Avg Internals</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">{currentSemesterStats.avgInternalMarks}%</p>
              </div>
              {/* Card 3: Courses at Risk */}
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <p className="text-[10px] font-bold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">At Risk</p>
                <p className={`mt-1 text-2xl font-black font-[family-name:var(--font-outfit)] ${Number(currentSemesterStats.atRiskCount) > 0 ? "text-rose-500" : "text-emerald-500"}`}>{currentSemesterStats.atRiskCount}</p>
              </div>
              {/* Card 4: Total Credits */}
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <p className="text-[10px] font-bold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">Total Credits</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">{currentSemesterStats.totalCredits}</p>
              </div>
              {/* Card 5: Assessments */}
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-4 col-span-2 md:col-span-1 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <p className="text-[10px] font-bold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">Assessments</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">{currentSemesterStats.totalAssessments}</p>
              </div>
            </div>

            {/* Utility Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 bg-slate-50/50 dark:bg-neutral-900/30 p-3 rounded-2xl border border-slate-100/80 dark:border-neutral-900/60">
              {/* Left controls: Semester, Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                {/* Semester selector */}
                <div className="relative">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-850 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="All">All Semesters</option>
                    {semestersList.map(sem => (
                      <option key={sem} value={sem}>
                        {sem === "Current" ? "Current Semester" : formatSemesterName(sem)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-850 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              {/* Right controls: Filter, Sort, View Toggle */}
              <div className="flex items-center gap-2">
                {/* Filter status */}
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-850 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="all">All Health</option>
                    <option value="healthy">Healthy</option>
                    <option value="watch">Watch</option>
                    <option value="critical">Critical</option>
                    <option value="theory">Theory Only</option>
                    <option value="lab">Lab Only</option>
                    <option value="embedded">Embedded</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Sort by */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-850 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="default">Sort: Default</option>
                    <option value="name">Name</option>
                    <option value="code">Code</option>
                    <option value="attendance">Attendance</option>
                    <option value="marks">Internal Marks</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Grid / List Toggle */}
                <div className="flex items-center border border-indigo-500/25 dark:border-indigo-500/30 rounded-xl bg-white dark:bg-neutral-950 p-1 shadow-2xs">
                  <button
                    onClick={() => setViewType("grid")}
                    className={`p-1.5 rounded-lg transition-all duration-205 ${viewType === "grid" ? "bg-indigo-600 text-white dark:bg-indigo-500 shadow-xs scale-105" : "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"}`}
                    title="Grid View"
                  >
                    <Grid3x3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewType("list")}
                    className={`p-1.5 rounded-lg transition-all duration-205 ${viewType === "list" ? "bg-indigo-600 text-white dark:bg-indigo-500 shadow-xs scale-105" : "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"}`}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {filteredAndSortedCourses.length === 0 ? (
              <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <Search className="w-10 h-10 text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400 dark:text-neutral-500">No courses match the current search or filters</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Array.from(
                  filteredAndSortedCourses.reduce((acc, group) => {
                    const sem = group.semesterSubId || "Current";
                    if (!acc.has(sem)) acc.set(sem, []);
                    acc.get(sem)!.push(group);
                    return acc;
                  }, new Map<string, any[]>()).entries()
                ).map(([semester, courses]) => (
                  <div key={semester} className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 dark:text-neutral-100 flex items-center gap-2 font-[family-name:var(--font-outfit)]">
                      <div className="w-1.5 h-5 bg-indigo-650 dark:bg-indigo-500 rounded-full" />
                      {semester === "Current" ? "Current Semester" : `${formatSemesterName(semester)}`}
                      <span className="text-xs font-bold bg-slate-105 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 px-2 py-0.5 rounded-lg ml-2">
                        {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
                      </span>
                    </h3>

                    {viewType === "grid" ? (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {courses.map((group: any) => {
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
                          const health = getCourseHealth(attendancePct, percent, predictedGrade, isPastSemester);

                          const credits = (group.theory ? getCourseCredits(group.theory) : 0) + (group.lab ? getCourseCredits(group.lab) : 0);
                          const metadataParts = [
                            group.courseCode,
                            courseType,
                            credits > 0 ? `${credits} Credits` : null
                          ].filter(Boolean);
                          const metadataString = metadataParts.join(" • ");

                          return (
                            <div 
                              key={group.courseCode} 
                              onClick={() => handleSelectCourse(group.courseCode)}
                              className="group relative flex flex-col justify-between rounded-3xl border border-gray-200/60 bg-white/60 backdrop-blur-xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-white/90 hover:-translate-y-1 hover:border-blue-500/30 dark:border-gray-800/50 dark:bg-black/40 dark:hover:bg-gray-900/80 cursor-pointer overflow-hidden"
                            >
                              <div>
                                {/* Course Code */}
                                <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">
                                  {group.courseCode}
                                </span>

                                {/* Level 1: Title */}
                                <h3 className="text-base font-black leading-tight text-slate-900 dark:text-neutral-50 tracking-tight transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-[family-name:var(--font-outfit)]">
                                  {group.courseTitle}
                                </h3>

                                {/* Level 2: Metadata */}
                                <p className="mt-1 text-[11px] font-semibold text-slate-450 dark:text-neutral-500 uppercase tracking-wider truncate">
                                  {courseType}{credits > 0 ? ` • ${credits} Credits` : ""}
                                </p>

                                {/* Level 3: Status / Chips */}
                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${health.color}`}>
                                    {health.label}
                                  </span>
                                  {predictedGrade !== "?" && !isPastSemester && (
                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${getGradeBadgeStyle(predictedGrade)}`}>
                                      Pred: {predictedGrade}
                                    </span>
                                  )}
                                  {isPastSemester && pastGrade && (
                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${getGradeBadgeStyle(pastGrade)}`}>
                                      Grade: {pastGrade}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Level 4: Primary Metrics */}
                              <div className="mt-5 grid grid-cols-4 gap-4 pt-4 border-t border-slate-100/80 dark:border-neutral-900/60">
                                {/* Metric 1: Attendance */}
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Attendance</span>
                                  <div className="mt-1 flex items-center min-h-[28px]">
                                    {isPastSemester ? (
                                      <span className="text-sm font-bold text-slate-800 dark:text-neutral-200">100%</span>
                                    ) : (group.theory && group.lab) ? (
                                      <div className="flex flex-col justify-center">
                                        {theoryAttItem && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500">T:</span>
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-neutral-200">{theoryAttItem.attendancePercentage || 0}%</span>
                                            <CircularProgress value={Number(theoryAttItem.attendancePercentage) || 0} size={10} strokeWidth={16} text="" />
                                          </div>
                                        )}
                                        {labAttItem && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500">L:</span>
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-neutral-200">{labAttItem.attendancePercentage || 0}%</span>
                                            <CircularProgress value={Number(labAttItem.attendancePercentage) || 0} size={10} strokeWidth={16} text="" />
                                          </div>
                                        )}
                                      </div>
                                    ) : attendancePct ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-850 dark:text-neutral-200">{attendancePct}%</span>
                                        <CircularProgress value={attendancePct} size={14} strokeWidth={14} text="" />
                                      </div>
                                    ) : (
                                      <span className="text-xs font-semibold text-slate-400 dark:text-neutral-600">N/A</span>
                                    )}
                                  </div>
                                </div>

                                {/* Metric 2: Internal Marks */}
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Internals</span>
                                  <div className="mt-1 flex items-baseline gap-0.5 min-h-[28px] align-middle pt-0.5">
                                    <span className="text-sm font-bold text-slate-850 dark:text-neutral-200">
                                      {isPastSemester ? (courseTotalString !== "Reload Required" && String(courseTotalString).includes("/") ? String(courseTotalString).split("/")[0] : "N/A") : percent.toFixed(1)}
                                    </span>
                                    {!isPastSemester && <span className="text-[9px] text-slate-400 dark:text-neutral-605 font-bold">/100</span>}
                                  </div>
                                </div>

                                {/* Metric 3: Marks (Raw) */}
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Marks (Raw)</span>
                                  <span className="mt-1 text-sm font-bold text-slate-850 dark:text-neutral-200 min-h-[28px] pt-0.5">{text}</span>
                                </div>

                                {/* Metric 4: Assessments */}
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Assessments</span>
                                  <span className="mt-1 text-sm font-bold text-slate-850 dark:text-neutral-200 min-h-[28px] pt-0.5">{assessmentCount}</span>
                                </div>
                              </div>

                              {/* Level 5: Secondary Metadata */}
                              <div className="mt-5 border-t border-slate-100/80 dark:border-neutral-900/60 pt-3">
                                <div className="h-1 overflow-hidden rounded-full bg-slate-105 dark:bg-neutral-900">
                                  <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-350" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
                                </div>
                                <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-neutral-450">
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActiveSubTab("faculty-info");
                                    }}
                                    className="truncate flex items-center gap-1.5 rounded-lg py-0.5 transition-colors hover:text-indigo-650 dark:hover:text-indigo-400 font-semibold"
                                    title="Open Faculty Info"
                                  >
                                    <User className="h-3.5 w-3.5 shrink-0 text-slate-450 dark:text-neutral-500" />
                                    <span className="truncate">{faculty}</span>
                                  </button>
                                  <span className="shrink-0 font-bold text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Progress: {Math.round(percent)}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {courses.map((group: any) => {
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
                          const health = getCourseHealth(attendancePct, percent, predictedGrade, isPastSemester);

                          const credits = (group.theory ? getCourseCredits(group.theory) : 0) + (group.lab ? getCourseCredits(group.lab) : 0);
                          const metadataParts = [
                            group.courseCode,
                            courseType,
                            credits > 0 ? `${credits} Credits` : null
                          ].filter(Boolean);
                          const metadataString = metadataParts.join(" • ");

                          return (
                            <div 
                              key={group.courseCode} 
                              onClick={() => handleSelectCourse(group.courseCode)}
                              className="group relative grid grid-cols-1 sm:grid-cols-12 gap-4 items-start sm:items-center rounded-2xl border border-gray-200/60 bg-white/60 backdrop-blur-xl px-5 py-4 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-md hover:bg-white/90 hover:border-blue-500/30 dark:border-gray-800/50 dark:bg-black/40 dark:hover:bg-gray-900/80 cursor-pointer"
                            >
                              {/* Title & Metadata & Badges */}
                              <div className="min-w-0 flex-1 sm:col-span-6">
                                {/* Course Code */}
                                <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest block mb-0.5">
                                  {group.courseCode}
                                </span>
                                <h3 className="text-base font-black text-slate-900 dark:text-neutral-50 truncate font-[family-name:var(--font-outfit)] group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                                  {group.courseTitle}
                                </h3>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-[11px] font-semibold text-slate-450 dark:text-neutral-500 uppercase tracking-wider">
                                    {courseType}{credits > 0 ? ` • ${credits} Credits` : ""}
                                  </span>
                                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider border ${health.color}`}>
                                    {health.label}
                                  </span>
                                  {predictedGrade !== "?" && !isPastSemester && (
                                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider border ${getGradeBadgeStyle(predictedGrade)}`}>
                                      Pred: {predictedGrade}
                                    </span>
                                  )}
                                  {isPastSemester && pastGrade && (
                                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider border ${getGradeBadgeStyle(pastGrade)}`}>
                                      Grade: {pastGrade}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Attendance */}
                              <div className="flex flex-col min-w-[80px] sm:col-span-2">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Attendance</span>
                                <div className="mt-0.5 flex items-center gap-1">
                                  {isPastSemester ? (
                                    <span className="font-semibold text-slate-800 dark:text-neutral-200">100%</span>
                                  ) : (group.theory && group.lab) ? (
                                    <span className="font-semibold text-slate-800 dark:text-neutral-200 text-[11px]">
                                      T: {theoryAttItem?.attendancePercentage || 0}% • L: {labAttItem?.attendancePercentage || 0}%
                                    </span>
                                  ) : attendancePct ? (
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-slate-800 dark:text-neutral-200">{attendancePct}%</span>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        attendancePct >= 85 ? "bg-emerald-500" :
                                        attendancePct >= 75 ? "bg-blue-500" :
                                        "bg-rose-500"
                                      }`} />
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 dark:text-neutral-600 font-semibold">N/A</span>
                                  )}
                                </div>
                              </div>

                              {/* Internals */}
                              <div className="flex flex-col min-w-[70px] sm:col-span-2">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Internals</span>
                                <span className="mt-0.5 font-semibold text-slate-850 dark:text-neutral-200">
                                  {isPastSemester ? (courseTotalString !== "Reload Required" && String(courseTotalString).includes("/") ? String(courseTotalString).split("/")[0] : "N/A") : percent.toFixed(1)}
                                </span>
                              </div>

                              {/* Faculty */}
                              <div className="flex flex-col max-w-[140px] truncate sm:col-span-2">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Faculty</span>
                                <span className="mt-0.5 font-semibold text-slate-650 dark:text-neutral-350 truncate" title={faculty}>{faculty}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SubpageLayout>
    );
  }



  return (
    <SubpageLayout title={selectedCode || ""} subtitle={selectedGroup?.courseTitle || ""} onBack={handleBack}>
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

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* OVERVIEW */}
      {innerTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full -mr-24 -mt-24 pointer-events-none" />
            <div className="relative z-10">
              <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Attendance Overview</h4>
              {isEmbedded ? (
                <div className="flex flex-col gap-6">
                  {theoryAttItem && (
                    <div className="flex items-center gap-5 border-b border-gray-100/50 dark:border-gray-800/50 pb-5">
                      <div className="relative">
                        <CircularProgress value={Number(theoryAttItem.attendancePercentage) || 0} size={70} />
                        <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 blur-xl rounded-full -z-10 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full w-fit">Theory</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200"><strong>{theoryAttItem.attendedClasses}</strong> / {theoryAttItem.totalClasses} classes</p>
                        {theoryAttItem.slotVenue && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Venue: {theoryAttItem.slotVenue}</p>}
                      </div>
                    </div>
                  )}
                  {labAttItem && (
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <CircularProgress value={Number(labAttItem.attendancePercentage) || 0} size={70} />
                        <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 blur-xl rounded-full -z-10 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full w-fit">Lab</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200"><strong>{labAttItem.attendedClasses}</strong> / {labAttItem.totalClasses} classes</p>
                        {labAttItem.slotVenue && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Venue: {labAttItem.slotVenue}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ) : attendanceItem ? (
                <div className="flex flex-col items-center justify-center text-center py-4">
                  <div className="relative mb-4">
                    <CircularProgress value={Number(attendanceItem.attendancePercentage) || 0} size={120} />
                    <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base text-gray-800 dark:text-gray-200"><strong>{attendanceItem.attendedClasses}</strong> / {attendanceItem.totalClasses} classes attended</p>
                    {attendanceItem.slotVenue && <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Venue: {attendanceItem.slotVenue}</p>}
                    {attendanceItem.faculty && <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-2 flex items-center justify-center gap-1.5"><User className="w-3.5 h-3.5" /> {attendanceItem.faculty}</p>}
                  </div>
                </div>
              ) : <p className="text-sm font-medium text-gray-400 dark:text-gray-500 text-center py-10">No attendance data</p>}
            </div>
          </div>
          
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full -ml-24 -mt-24 pointer-events-none" />
            <div className="relative z-10 flex-1">
              <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Target className="w-4 h-4 text-purple-500" /> Course Details</h4>
              {mainCourse ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Type</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{isEmbedded ? "Embedded" : mainCourse.courseType}</span>
                  </div>
                  <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Slot</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{mainCourse.slot}</span>
                  </div>
                  <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-center col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Faculty</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{mainCourse.faculty}</span>
                  </div>
                  <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">System</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{mainCourse.courseSystem}</span>
                  </div>
                  {attendanceItem?.credits && (
                    <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Credits</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{attendanceItem.credits}</span>
                    </div>
                  )}
                  {isEmbedded && (
                    <div className="col-span-2 mt-2 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/20 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">Components</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{selectedGroup.theory?.courseType}</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 bg-white/60 dark:bg-black/40 px-2 py-0.5 rounded shadow-sm">Class: {selectedGroup.theory?.classNbr?.slice(-4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{selectedGroup.lab?.courseType}</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 bg-white/60 dark:bg-black/40 px-2 py-0.5 rounded shadow-sm">Class: {selectedGroup.lab?.classNbr?.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : <p className="text-sm font-medium text-gray-400 dark:text-gray-500 text-center py-10">No course data</p>}
            </div>
          </div>
          <div className="md:col-span-2 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h4 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-500" /> Quality Circle Meeting (QCM)</h4>
              {!qcmData && (
                <button onClick={fetchQcmForCourse} disabled={qcmLoading} className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-600 dark:text-emerald-400 transition-colors border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm active:scale-95">
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
                            <div key={ri} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
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
    </SubpageLayout>
  );
}
