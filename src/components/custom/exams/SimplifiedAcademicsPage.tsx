import React, { useState, useMemo, useCallback } from "react";
import PageHeader from "../shared/PageHeader";
import { loadFrozenPastSemesters } from "@/lib/pastDataSync";
import {
  BookOpen,
  Search,
  ChevronRight,
  ChevronLeft,
  Lock,
  History,
  GraduationCap,
  Sparkles,
} from "lucide-react";

interface SimplifiedAcademicsPageProps {
  marksData: any;
  allGradesData?: any;
  pastSemesterData?: any;
  attendanceData?: any;
  loginToVTOP?: any;
  setActiveSubTab?: (subTab: string) => void;
  decimalValues?: boolean;
  onSelectCourse?: (courseCode: string) => void;
}

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

const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const isJunkOrEmpty = (val: any) => {
  if (val == null) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === "" ||
    s === "nil" ||
    s === "null" ||
    s === "undefined" ||
    s === "n/a" ||
    s === "na" ||
    s === "-" ||
    s === "--" ||
    s === "none"
  );
};

const sanitizeCourseCode = (code: any) => {
  if (isJunkOrEmpty(code)) return "";
  const cleaned = String(code).replace(/\s*\([LPT]\)$/i, "").trim();
  return isJunkOrEmpty(cleaned) ? "" : cleaned;
};

const sanitizeCourseTitle = (title: any, fallbackCode: string) => {
  if (isJunkOrEmpty(title)) return fallbackCode;
  return String(title).trim();
};

const getAssessmentTotals = (assessments: any[] = []) => {
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

const formatUpToTwoDecimals = (num: number, padDecimals = false): string => {
  if (!Number.isFinite(num)) return "0";
  const rounded = Math.round(num * 100) / 100;
  if (padDecimals) {
    return rounded.toFixed(2);
  }
  return Number(rounded.toFixed(2)).toString();
};

interface GrandWeightageResult {
  scored: number;
  maxWeight: number;
  percentage: number | null;
  hasAssessments: boolean;
  isEmbedded: boolean;
  displayScore: string;
  displayMax: string;
}

const calculateGrandWeightage = (
  course: any,
  decimalValues = false
): GrandWeightageResult => {
  const isEmbedded = Boolean(course.theory && course.lab);
  const theoryAssessments = course.theory?.assessments || [];
  const labAssessments = course.lab?.assessments || [];
  const allAssessments = [...theoryAssessments, ...labAssessments];

  const theoryTotals = getAssessmentTotals(theoryAssessments);
  const labTotals = getAssessmentTotals(labAssessments);

  if (allAssessments.length === 0) {
    return {
      scored: 0,
      maxWeight: 0,
      percentage: null,
      hasAssessments: false,
      isEmbedded,
      displayScore: "0",
      displayMax: "0",
    };
  }

  if (isEmbedded) {
    let theoryCredits = getCourseCredits(course.theory);
    let labCredits = getCourseCredits(course.lab);

    if (theoryCredits <= 0 && labCredits <= 0) {
      theoryCredits = 3;
      labCredits = 1;
    } else if (theoryCredits <= 0) {
      theoryCredits = 3;
    } else if (labCredits <= 0) {
      labCredits = 1;
    }

    const creditsTotal = theoryCredits + labCredits;
    const scored =
      (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) /
      creditsTotal;
    const maxWeight =
      (theoryCredits * theoryTotals.weightPercent +
        labCredits * labTotals.weightPercent) /
      creditsTotal;

    const percentage =
      maxWeight > 0
        ? (scored / maxWeight) * 100
        : (theoryTotals.max + labTotals.max) > 0
        ? ((theoryTotals.scored + labTotals.scored) /
            (theoryTotals.max + labTotals.max)) *
          100
        : null;

    return {
      scored,
      maxWeight,
      percentage,
      hasAssessments: true,
      isEmbedded: true,
      displayScore: formatUpToTwoDecimals(scored, decimalValues),
      displayMax:
        maxWeight > 0
          ? formatUpToTwoDecimals(maxWeight, decimalValues)
          : "0",
    };
  }

  // Non-embedded: Theory only or Lab only
  const activeTotals = course.lab ? labTotals : theoryTotals;
  const scored = activeTotals.weighted;
  const maxWeight = activeTotals.weightPercent;
  const percentage =
    maxWeight > 0
      ? (scored / maxWeight) * 100
      : activeTotals.max > 0
      ? (activeTotals.scored / activeTotals.max) * 100
      : null;

  return {
    scored,
    maxWeight,
    percentage,
    hasAssessments: true,
    isEmbedded: false,
    displayScore: formatUpToTwoDecimals(scored, decimalValues),
    displayMax:
      maxWeight > 0
        ? formatUpToTwoDecimals(maxWeight, decimalValues)
        : "0",
  };
};

const safeObjectEntries = (obj: any): Array<[string, any]> => {
  if (!obj || typeof obj !== "object") return [];
  try {
    return Object.entries(obj);
  } catch {
    return [];
  }
};

const safeObjectKeys = (obj: any): string[] => {
  if (!obj || typeof obj !== "object") return [];
  try {
    return Object.keys(obj);
  } catch {
    return [];
  }
};

const safeObjectValues = (obj: any): any[] => {
  if (!obj || typeof obj !== "object") return [];
  try {
    return Object.values(obj);
  } catch {
    return [];
  }
};

export default function SimplifiedAcademicsPage({
  marksData,
  allGradesData,
  pastSemesterData,
  attendanceData,
  setActiveSubTab,
  decimalValues = false,
  onSelectCourse,
}: SimplifiedAcademicsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showPastSemestersView, setShowPastSemestersView] = useState(false);
  const [selectedPastSemId, setSelectedPastSemId] = useState<string>("all");

  // ── GROUP CURRENT SEMESTER COURSES WITH STRICT SANITIZATION ──
  const currentCourses = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Load from marksData
    if (marksData?.courses && Array.isArray(marksData.courses)) {
      marksData.courses.forEach((c: any) => {
        if (!c || typeof c !== "object") return;
        const rawCode = sanitizeCourseCode(c.courseCode || c.code);
        const rawTitle = String(c.courseTitle || c.title || "").trim();
        const classNbr = String(c.classNumber || c.classNbr || c.crn || "").trim();

        // Reject if both code and title are junk/empty
        if (!rawCode && isJunkOrEmpty(rawTitle)) return;
        if (isJunkOrEmpty(rawCode) && isJunkOrEmpty(classNbr)) return;

        const baseCode = rawCode || sanitizeCourseCode(rawTitle) || sanitizeCourseCode(classNbr);
        if (!baseCode) return;

        const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
        const isLab =
          c.courseType?.toLowerCase().includes("lab") ||
          c.slot?.toLowerCase().startsWith("l");

        if (!map.has(baseCode)) {
          map.set(baseCode, {
            courseCode: baseCode,
            courseTitle,
            credits: Number(c.credits) || 0,
            theory: !isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
            lab: isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
            isCurrent: true,
          });
        } else {
          const existing = map.get(baseCode);
          if (isLab) existing.lab = { ...c, courseCode: baseCode, courseTitle };
          else existing.theory = { ...c, courseCode: baseCode, courseTitle };
          if (c.credits) existing.credits = Number(c.credits) || existing.credits;
          if (existing.courseTitle === baseCode && !isJunkOrEmpty(rawTitle)) {
            existing.courseTitle = courseTitle;
          }
        }
      });
    }

    // 2. Supplement from attendanceData
    if (attendanceData?.attendance && Array.isArray(attendanceData.attendance)) {
      attendanceData.attendance.forEach((att: any) => {
        if (!att || typeof att !== "object") return;
        let rawCode = sanitizeCourseCode(att.courseCode || att.code);
        if (rawCode && rawCode.includes(" ")) rawCode = rawCode.split(" ")[0];
        const rawTitle = String(att.courseTitle || att.title || "").trim();
        const classNbr = String(att.classNumber || att.classNbr || att.crn || "").trim();

        if (!rawCode && isJunkOrEmpty(rawTitle)) return;
        if (isJunkOrEmpty(rawCode) && isJunkOrEmpty(classNbr)) return;

        const baseCode = rawCode || sanitizeCourseCode(rawTitle) || sanitizeCourseCode(classNbr);
        if (!baseCode) return;

        const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
        const isLab =
          att.courseType?.toLowerCase().includes("lab") ||
          att.slotName?.toLowerCase().startsWith("l");

        if (!map.has(baseCode)) {
          map.set(baseCode, {
            courseCode: baseCode,
            courseTitle,
            credits: Number(att.credits) || 0,
            theory: !isLab ? { ...att, courseCode: baseCode, courseTitle } : null,
            lab: isLab ? { ...att, courseCode: baseCode, courseTitle } : null,
            isCurrent: true,
          });
        } else {
          const existing = map.get(baseCode);
          if (isLab) existing.lab = { ...(existing.lab || {}), ...att, courseCode: baseCode, courseTitle };
          else existing.theory = { ...(existing.theory || {}), ...att, courseCode: baseCode, courseTitle };
          if (att.credits) existing.credits = Number(att.credits) || existing.credits;
          if (existing.courseTitle === baseCode && !isJunkOrEmpty(rawTitle)) {
            existing.courseTitle = courseTitle;
          }
        }
      });
    }

    return Array.from(map.values()).filter((c) => {
      return (
        !isJunkOrEmpty(c.courseCode) &&
        !isJunkOrEmpty(c.courseTitle) &&
        Boolean(c.theory || c.lab)
      );
    });
  }, [marksData, attendanceData]);

  // ── RESOLVE ALL-GRADES AND PAST SEMESTERS DATA (PROPS + LOCALSTORAGE FALLBACK) ──
  const resolvedAllGradesData = useMemo(() => {
    if (allGradesData && typeof allGradesData === "object" && allGradesData.grades) return allGradesData;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("allgradesdata") || localStorage.getItem("allGradesData");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object") return parsed;
        }
      } catch {}
    }
    return allGradesData && typeof allGradesData === "object" ? allGradesData : null;
  }, [allGradesData]);

  const resolvedPastSemesterData = useMemo(() => {
    if (pastSemesterData && typeof pastSemesterData === "object" && safeObjectKeys(pastSemesterData).length > 0) {
      return pastSemesterData;
    }
    if (typeof window !== "undefined") {
      try {
        const loaded = loadFrozenPastSemesters(resolvedAllGradesData);
        if (loaded && typeof loaded === "object" && safeObjectKeys(loaded).length > 0) return loaded;
      } catch {}
    }
    return pastSemesterData && typeof pastSemesterData === "object" ? pastSemesterData : {};
  }, [pastSemesterData, resolvedAllGradesData]);

  // ── GROUP PAST SEMESTERS WITH COMPREHENSIVE EXTRACTION & SANITIZATION ──
  const pastSemesters = useMemo(() => {
    const list: Array<{
      semesterId: string;
      semesterName: string;
      gpa?: string;
      courses: any[];
    }> = [];

    const currentSemId = attendanceData?.semester;

    // 1. From resolvedPastSemesterData
    if (resolvedPastSemesterData && typeof resolvedPastSemesterData === "object") {
      safeObjectKeys(resolvedPastSemesterData).forEach((semId) => {
        if (
          !semId ||
          semId === currentSemId ||
          semId === "Current" ||
          semId === "curriculum" ||
          semId === "effectiveGrades"
        )
          return;
        const semObj = resolvedPastSemesterData[semId];
        if (!semObj || typeof semObj !== "object") return;
        const semMap = new Map<string, any>();

        if (semObj?.marks?.courses && Array.isArray(semObj.marks.courses)) {
          semObj.marks.courses.forEach((c: any) => {
            if (!c || typeof c !== "object") return;
            const rawCode = sanitizeCourseCode(c.courseCode || c.code);
            const rawTitle = String(c.courseTitle || c.title || "").trim();
            if (!rawCode && isJunkOrEmpty(rawTitle)) return;
            const baseCode = rawCode || sanitizeCourseCode(rawTitle);
            if (!baseCode) return;

            const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
            const isLab =
              c.courseType?.toLowerCase().includes("lab") ||
              c.slot?.toLowerCase().startsWith("l");

            if (!semMap.has(baseCode)) {
              semMap.set(baseCode, {
                courseCode: baseCode,
                courseTitle,
                credits: Number(c.credits) || 0,
                theory: !isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
                lab: isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
                grade: c.grade || c.courseGrade,
                isCurrent: false,
              });
            } else {
              const existing = semMap.get(baseCode);
              if (isLab) existing.lab = { ...c, courseCode: baseCode, courseTitle };
              else existing.theory = { ...c, courseCode: baseCode, courseTitle };
              if (c.grade || c.courseGrade) existing.grade = c.grade || c.courseGrade;
            }
          });
        }

        if (semObj?.attendance?.attendance && Array.isArray(semObj.attendance.attendance)) {
          semObj.attendance.attendance.forEach((c: any) => {
            if (!c || typeof c !== "object") return;
            let rawCode = sanitizeCourseCode(c.courseCode || c.code);
            if (rawCode && rawCode.includes(" ")) rawCode = rawCode.split(" ")[0];
            const rawTitle = String(c.courseTitle || c.title || "").trim();
            if (!rawCode && isJunkOrEmpty(rawTitle)) return;
            const baseCode = rawCode || sanitizeCourseCode(rawTitle);
            if (!baseCode) return;

            const courseTitle = sanitizeCourseTitle(rawTitle, baseCode);
            const isLab =
              c.courseType?.toLowerCase().includes("lab") ||
              c.slot?.toLowerCase().startsWith("l") ||
              c.slotName?.toLowerCase().startsWith("l");

            if (!semMap.has(baseCode)) {
              semMap.set(baseCode, {
                courseCode: baseCode,
                courseTitle,
                credits: Number(c.credits) || 0,
                theory: !isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
                lab: isLab ? { ...c, courseCode: baseCode, courseTitle } : null,
                grade: c.grade || c.courseGrade,
                isCurrent: false,
              });
            } else {
              const existing = semMap.get(baseCode);
              if (isLab) existing.lab = { ...(existing.lab || {}), ...c, courseCode: baseCode, courseTitle };
              else existing.theory = { ...(existing.theory || {}), ...c, courseCode: baseCode, courseTitle };
              if (c.grade || c.courseGrade) existing.grade = c.grade || c.courseGrade;
            }
          });
        }

        const validCourses = Array.from(semMap.values()).filter(
          (c) =>
            !isJunkOrEmpty(c.courseCode) &&
            !isJunkOrEmpty(c.courseTitle) &&
            Boolean(c.theory || c.lab)
        );

        if (validCourses.length > 0) {
          list.push({
            semesterId: semId,
            semesterName: formatSemesterName(semId),
            gpa:
              resolvedAllGradesData?.gpaHistory?.[semId] ||
              resolvedAllGradesData?.grades?.[semId]?.gpa ||
              undefined,
            courses: validCourses,
          });
        }
      });
    }

    // 2. From resolvedAllGradesData if not already in resolvedPastSemesterData
    if (resolvedAllGradesData?.grades) {
      const gradesObj = resolvedAllGradesData.grades;
      const semEntries: Array<[string, any]> = Array.isArray(gradesObj)
        ? gradesObj.map((s: any, idx: number) => [
            s?.semesterSubId || s?.semesterId || s?.semSubId || `sem_${idx}`,
            s,
          ])
        : safeObjectEntries(gradesObj);

      semEntries.forEach(([semId, semVal]) => {
        if (
          !semId ||
          semId === currentSemId ||
          semId === "Current" ||
          semId === "curriculum" ||
          semId === "effectiveGrades" ||
          !semVal
        )
          return;
        if (list.some((s) => s.semesterId === semId)) return;

        let items: any[] = [];
        if (Array.isArray(semVal)) {
          items = semVal;
        } else if (semVal && typeof semVal === "object") {
          if (Array.isArray(semVal.grades)) items = semVal.grades;
          else if (Array.isArray(semVal.courseGrades)) items = semVal.courseGrades;
          else if (Array.isArray(semVal.courses)) items = semVal.courses;
          else {
            items = safeObjectValues(semVal).filter(
              (v) =>
                v &&
                typeof v === "object" &&
                (v.courseCode || v.code || v.courseTitle || v.title)
            );
          }
        }

        if (items.length > 0) {
          const semMap = new Map<string, any>();
          items.forEach((c: any) => {
            if (!c || typeof c !== "object") return;
            const code = sanitizeCourseCode(c.courseCode || c.code);
            const title = String(c.courseTitle || c.title || c.courseName || "").trim();
            if (!code && isJunkOrEmpty(title)) return;
            const cleanCode = code || sanitizeCourseCode(title);
            if (!cleanCode) return;

            const courseTitle = sanitizeCourseTitle(title, cleanCode);

            if (!semMap.has(cleanCode)) {
              semMap.set(cleanCode, {
                courseCode: cleanCode,
                courseTitle,
                credits: Number(c.creditsEarned || c.credits) || 0,
                grade: c.grade || c.courseGrade,
                theory: {
                  courseType: c.courseType || "Theory",
                  courseCode: cleanCode,
                  courseTitle,
                  grade: c.grade || c.courseGrade,
                },
                lab: null,
                isCurrent: false,
              });
            } else {
              const existing = semMap.get(cleanCode);
              if (c.grade || c.courseGrade) existing.grade = c.grade || c.courseGrade;
            }
          });

          const validCourses = Array.from(semMap.values()).filter(
            (c) =>
              !isJunkOrEmpty(c.courseCode) &&
              !isJunkOrEmpty(c.courseTitle) &&
              Boolean(c.theory || c.lab)
          );

          if (validCourses.length > 0) {
            list.push({
              semesterId: semId,
              semesterName: formatSemesterName(semId),
              gpa:
                semVal?.gpa ||
                resolvedAllGradesData?.gpaHistory?.[semId] ||
                undefined,
              courses: validCourses,
            });
          }
        }
      });
    }

    // Sort past semesters chronologically (most recent first)
    return list.sort((a, b) => b.semesterId.localeCompare(a.semesterId));
  }, [resolvedPastSemesterData, resolvedAllGradesData, attendanceData]);

  // ── FILTER COURSES ──
  const filterCourseList = useCallback(
    (courses: any[]) => {
      return courses.filter((c) => {
        const title = (c.courseTitle || "").toLowerCase();
        const code = (c.courseCode || "").toLowerCase();
        const term = searchTerm.toLowerCase().trim();

        if (term && !title.includes(term) && !code.includes(term)) {
          return false;
        }

        const isEmbedded = c.theory && c.lab;
        const isLabOnly = !c.theory && c.lab;
        const isTheoryOnly = c.theory && !c.lab;

        if (selectedType === "theory" && !isTheoryOnly) return false;
        if (selectedType === "lab" && !isLabOnly) return false;
        if (selectedType === "embedded" && !isEmbedded) return false;

        return true;
      });
    },
    [searchTerm, selectedType]
  );

  const filteredCurrentCourses = useMemo(
    () => filterCourseList(currentCourses),
    [filterCourseList, currentCourses]
  );

  const handleCourseClick = (courseCode: string) => {
    const cleanCode = courseCode.replace(/\([LPT]\)$/i, "").trim();
    if (onSelectCourse) {
      onSelectCourse(cleanCode);
    } else if (setActiveSubTab) {
      try {
        localStorage.setItem("course_dashboard_target", cleanCode);
        localStorage.setItem("course_dashboard_tab", "marks");
      } catch {}
      setActiveSubTab("course-dashboard");
    }
  };

  // ── RENDER INDIVIDUAL COURSE PILL ──
  const renderCoursePill = (course: any) => {
    const isEmbedded = Boolean(course.theory && course.lab);
    const main = course.theory || course.lab;
    const courseTypeLabel = isEmbedded
      ? "Embedded Theory + Lab"
      : course.lab
      ? "Lab Only"
      : "Theory Only";

    const grandWeightage = calculateGrandWeightage(course, decimalValues);

    // Stat styling based on performance percentage
    let statColor = "text-zinc-400";
    if (course.grade) {
      statColor = "text-indigo-500 dark:text-indigo-400";
    } else if (grandWeightage.percentage !== null) {
      if (grandWeightage.percentage >= 80)
        statColor = "text-emerald-600 dark:text-emerald-400";
      else if (grandWeightage.percentage >= 65)
        statColor = "text-amber-600 dark:text-amber-400";
      else statColor = "text-red-600 dark:text-red-400";
    }

    return (
      <div
        key={course.courseCode}
        onClick={() => handleCourseClick(course.courseCode)}
        className="rounded-[22px] sm:rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 shadow-xs hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-200 cursor-pointer overflow-hidden p-3.5 sm:p-4 flex items-center justify-between gap-3 group select-none text-left"
      >
        {/* Left Column: Clean Icon + Course Code, Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Clean minimal icon */}
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isEmbedded
                ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                : course.lab
                ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
            }`}
          >
            <BookOpen className="w-5 h-5" />
          </div>

          {/* Course Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                {course.courseCode}
              </span>
            </div>

            {/* Course Title */}
            <p className="text-xs text-zinc-700 dark:text-zinc-200 font-bold truncate mt-0.5 font-outfit">
              {course.courseTitle}
            </p>

            {/* Subtitle containing course type, credits and slot */}
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5">
              {courseTypeLabel}
              {course.credits > 0 ? ` • ${course.credits} Credits` : ""}
              {main?.slotName || main?.slot ? ` • ${main.slotName || main.slot}` : ""}
            </p>
          </div>
        </div>

        {/* Right Column: Overall Grand Weightage Points Scored & Forward Arrow */}
        <div className="flex items-center gap-2.5 shrink-0 text-right">
          <div>
            {course.grade ? (
              <div className="flex flex-col items-end">
                <span className="text-base sm:text-lg font-black text-indigo-500 dark:text-indigo-400 font-outfit">
                  Grade {course.grade}
                </span>
                <span className="text-[9px] text-zinc-400 font-medium">Final Grade</span>
              </div>
            ) : grandWeightage.hasAssessments ? (
              <div className="flex flex-col items-end">
                <span
                  className={`text-base sm:text-lg font-black font-outfit tracking-tight leading-none ${statColor}`}
                >
                  {grandWeightage.maxWeight > 0
                    ? `${grandWeightage.displayScore} / ${grandWeightage.displayMax}`
                    : `${grandWeightage.displayScore}`}
                </span>
                <span className="text-[9px] font-bold text-zinc-400 mt-0.5">
                  {grandWeightage.percentage !== null
                    ? `${formatUpToTwoDecimals(grandWeightage.percentage, decimalValues)}% Score`
                    : "Weightage"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">Pending</span>
                <span className="text-[9px] text-zinc-500">No marks yet</span>
              </div>
            )}
          </div>

          {/* Navigation indicator */}
          <div className="p-1 rounded-lg text-zinc-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  };

  // ── VIEW 2: DEDICATED PREVIOUS SEMESTERS SEPARATE PAGE ──
  if (showPastSemestersView) {
    const displayedPastSemesters =
      selectedPastSemId === "all"
        ? pastSemesters
        : pastSemesters.filter((s) => s.semesterId === selectedPastSemId);

    return (
      <div className="w-full max-w-3xl mx-auto space-y-4 pb-12 animate-in fade-in duration-200 text-left select-none">
        <PageHeader
          icon={<History className="w-5.5 h-5.5 text-blue-600 dark:text-blue-400" />}
          title="Previous Semester History"
          meta={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100/85 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60 font-mono">
              {pastSemesters.length} {pastSemesters.length === 1 ? "semester" : "semesters"}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              {pastSemesters.length > 1 && (
                <div className="relative">
                  <select
                    value={selectedPastSemId}
                    onChange={(e) => setSelectedPastSemId(e.target.value)}
                    className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Past Semesters</option>
                    {pastSemesters.map((s) => (
                      <option key={s.semesterId} value={s.semesterId}>
                        {s.semesterName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => setShowPastSemestersView(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Current Courses</span>
              </button>
            </div>
          }
        />

        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search past course code or name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        {/* Past Semesters Course Lists */}
        <div className="space-y-6 pt-2">
          {displayedPastSemesters.length > 0 ? (
            displayedPastSemesters.map((sem) => {
              const filteredSemCourses = filterCourseList(sem.courses);
              if (filteredSemCourses.length === 0) return null;

              return (
                <div key={sem.semesterId} className="space-y-2.5">
                  {/* Semester Header Strip */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-outfit">
                        {sem.semesterName}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                        ({filteredSemCourses.length} courses)
                      </span>
                    </div>
                    {sem.gpa && (
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-outfit">
                        GPA: {sem.gpa}
                      </span>
                    )}
                  </div>

                  {/* Course Pills */}
                  <div className="space-y-2">
                    {filteredSemCourses.map(renderCoursePill)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-3">
              <History className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                No archived course records found for earlier semesters.
              </p>
              {setActiveSubTab && (
                <button
                  onClick={() => setActiveSubTab("grades")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>View Grade History</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── VIEW 1: CURRENT SEMESTER COURSES + PREVIOUS SEMESTERS PILL AT BOTTOM ──
  return (
    <div className="w-full max-w-3xl mx-auto space-y-3.5 pb-12 animate-in fade-in duration-200 text-left select-none">
      <PageHeader
        icon={<GraduationCap className="w-5.5 h-5.5 text-blue-600 dark:text-blue-400" />}
        title="My Courses & Marks"
        meta={
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100/85 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60 font-mono">
            {filteredCurrentCourses.length} {filteredCurrentCourses.length === 1 ? "course" : "courses"}
          </span>
        }
      />

      {/* ── SEARCH & FILTER STRIP ── */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        {/* Search Input */}
        <div className="relative w-full flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search course code or name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "theory", label: "Theory" },
            { id: "lab", label: "Lab" },
            { id: "embedded", label: "Embedded" },
          ].map((f) => {
            const isActive = selectedType === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedType(f.id)}
                className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CURRENT SEMESTER COURSES PILLS LIST ── */}
      <div className="space-y-2">
        {filteredCurrentCourses.length > 0 ? (
          filteredCurrentCourses.map(renderCoursePill)
        ) : (
          <div className="p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              No courses found matching your search.
            </p>
          </div>
        )}
      </div>

      {/* ── ACADEMIC EXPLORER NAVIGATION CARDS (CURRICULUM & GRADE HISTORY) ── */}
      <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Degree Curriculum Card */}
          <button
            onClick={() => setActiveSubTab?.("curriculum")}
            className="w-full p-4 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/40 flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black font-outfit text-zinc-900 dark:text-white truncate">
                  Degree Curriculum
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  Program credits, baskets & distribution
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 font-outfit group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Curriculum</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Grade History Card */}
          <button
            onClick={() => setActiveSubTab?.("grades")}
            className="w-full p-4 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-purple-500/40 dark:hover:border-purple-500/40 flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black font-outfit text-zinc-900 dark:text-white truncate">
                  Grade History
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  Cumulative GPA & past semesters
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-purple-600 dark:text-purple-400 font-outfit group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Grades</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* ── PREVIOUS SEMESTERS SEPARATE PAGE PILL (ALWAYS VISIBLE & ACCESSIBLE) ── */}
        <button
          onClick={() => {
            if (pastSemesters.length > 0) {
              setShowPastSemestersView(true);
            } else if (setActiveSubTab) {
              setActiveSubTab("grades");
            } else {
              setShowPastSemestersView(true);
            }
          }}
          className="w-full p-3.5 sm:p-4 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black font-outfit text-zinc-900 dark:text-white truncate">
                Looking for previous semesters?
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                {pastSemesters.length > 0
                  ? `View archived courses and grades from ${pastSemesters.length} earlier semesters`
                  : "View archived courses, GPA & grades from previous semesters"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-black text-blue-600 dark:text-blue-400 font-outfit group-hover:translate-x-0.5 transition-transform shrink-0">
            <span>{pastSemesters.length > 0 ? "View History" : "Grade History"}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
