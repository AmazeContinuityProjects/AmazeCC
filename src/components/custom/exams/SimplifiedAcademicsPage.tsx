import React, { useState, useMemo, useCallback } from "react";
import { ChipTabs, EmptyPanel, PageShell, SelectField } from "../shared/primitives";
import { SEARCH_FIELD } from "@/lib/uiTokens";
import { formatSemesterName } from "@/lib/formatSemesterName";
import { loadFrozenPastSemesters } from "@/lib/pastDataSync";
import { CourseDot } from "@amazecontinuityprojects/amazeui";
import { BookOpen, Search, ChevronRight, GraduationCap, History, Lock, Sparkles } from "lucide-react";

/** The four course-type pills above the list. Ordered, so `ChipTabs` scrolls rather than wraps. */
type CourseTypeFilter = "all" | "theory" | "lab" | "embedded";

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
  const cleaned = String(code)
    .replace(/\s*\([LPT]\)$/i, "")
    .trim();
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
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 },
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

const calculateGrandWeightage = (course: any, decimalValues = false): GrandWeightageResult => {
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
    const scored = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
    const maxWeight =
      (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;

    const percentage =
      maxWeight > 0
        ? (scored / maxWeight) * 100
        : theoryTotals.max + labTotals.max > 0
          ? ((theoryTotals.scored + labTotals.scored) / (theoryTotals.max + labTotals.max)) * 100
          : null;

    return {
      scored,
      maxWeight,
      percentage,
      hasAssessments: true,
      isEmbedded: true,
      displayScore: formatUpToTwoDecimals(scored, decimalValues),
      displayMax: maxWeight > 0 ? formatUpToTwoDecimals(maxWeight, decimalValues) : "0",
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
    displayMax: maxWeight > 0 ? formatUpToTwoDecimals(maxWeight, decimalValues) : "0",
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
        const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");

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
        const isLab = att.courseType?.toLowerCase().includes("lab") || att.slotName?.toLowerCase().startsWith("l");

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
      return !isJunkOrEmpty(c.courseCode) && !isJunkOrEmpty(c.courseTitle) && Boolean(c.theory || c.lab);
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
            const isLab = c.courseType?.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");

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
          (c) => !isJunkOrEmpty(c.courseCode) && !isJunkOrEmpty(c.courseTitle) && Boolean(c.theory || c.lab),
        );

        if (validCourses.length > 0) {
          list.push({
            semesterId: semId,
            semesterName: formatSemesterName(semId),
            gpa: resolvedAllGradesData?.gpaHistory?.[semId] || resolvedAllGradesData?.grades?.[semId]?.gpa || undefined,
            courses: validCourses,
          });
        }
      });
    }

    // 2. From resolvedAllGradesData if not already in resolvedPastSemesterData
    if (resolvedAllGradesData?.grades) {
      const gradesObj = resolvedAllGradesData.grades;
      const semEntries: Array<[string, any]> = Array.isArray(gradesObj)
        ? gradesObj.map((s: any, idx: number) => [s?.semesterSubId || s?.semesterId || s?.semSubId || `sem_${idx}`, s])
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
              (v) => v && typeof v === "object" && (v.courseCode || v.code || v.courseTitle || v.title),
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
            (c) => !isJunkOrEmpty(c.courseCode) && !isJunkOrEmpty(c.courseTitle) && Boolean(c.theory || c.lab),
          );

          if (validCourses.length > 0) {
            list.push({
              semesterId: semId,
              semesterName: formatSemesterName(semId),
              gpa: semVal?.gpa || resolvedAllGradesData?.gpaHistory?.[semId] || undefined,
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
    [searchTerm, selectedType],
  );

  const filteredCurrentCourses = useMemo(() => filterCourseList(currentCourses), [filterCourseList, currentCourses]);

  const academicSummary = useMemo(() => {
    const c = marksData?.cgpa || allGradesData?.cgpa || {};
    const semCredits = currentCourses.reduce((acc: number, course: any) => acc + Math.max(0, Number(course.credits) || 0), 0);
    return {
      cgpa: Number(c?.cgpa) || 0,
      earned: Number(c?.creditsEarned) || 0,
      required: Number(c?.creditsRequired) || 0,
      semCredits,
    };
  }, [marksData, allGradesData, currentCourses]);

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
    const courseTypeLabel = isEmbedded ? "Embedded Theory + Lab" : course.lab ? "Lab Only" : "Theory Only";

    const grandWeightage = calculateGrandWeightage(course, decimalValues);

    const pct = grandWeightage.percentage;
    const scoreTone = pct === null ? "text-ink" : pct >= 80 ? "text-ok" : pct >= 65 ? "text-ink" : "text-danger";
    const slot = main?.slotName || main?.slot || "";

    return (
      <button
        type="button"
        key={course.courseCode}
        onClick={() => handleCourseClick(course.courseCode)}
        className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent select-none"
      >
        <CourseDot course={course.courseCode} />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-medium text-ink">{course.courseTitle}</span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            <span className="font-mono">{course.courseCode}</span>
            {` · ${courseTypeLabel}`}
            {course.credits > 0 ? ` · ${course.credits} cr` : ""}
            {slot ? <span className="font-mono">{` · ${slot}`}</span> : null}
          </span>
        </span>
        <span className="text-right">
          {course.grade ? (
            <>
              <span className="block font-mono text-[15px] font-semibold text-ink">{course.grade}</span>
              <span className="block text-[11.5px] text-muted">Grade</span>
            </>
          ) : grandWeightage.hasAssessments ? (
            <>
              <span className={`block font-mono text-[15px] font-semibold tabular-nums ${scoreTone}`}>
                {grandWeightage.maxWeight > 0
                  ? `${grandWeightage.displayScore}/${grandWeightage.displayMax}`
                  : grandWeightage.displayScore}
              </span>
              <span className="block text-[11.5px] text-muted">
                {pct !== null ? `${formatUpToTwoDecimals(pct, decimalValues)}% Score` : "Weightage"}
              </span>
            </>
          ) : (
            <>
              <span className="block text-[13px] text-muted">Pending</span>
              <span className="block text-[11.5px] text-muted">No marks yet</span>
            </>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
      </button>
    );
  };

  // ── VIEW 2: DEDICATED PREVIOUS SEMESTERS SEPARATE PAGE ──
  if (showPastSemestersView) {
    const displayedPastSemesters =
      selectedPastSemId === "all" ? pastSemesters : pastSemesters.filter((s) => s.semesterId === selectedPastSemId);

    return (
      <PageShell
        eyebrow="Academics · History"
        title="Previous Semester History"
        subtitle={`${pastSemesters.length} ${pastSemesters.length === 1 ? "semester" : "semesters"}`}
        onBack={() => setShowPastSemestersView(false)}
        actions={
          pastSemesters.length > 1 ? (
            <SelectField
              value={selectedPastSemId}
              onChange={setSelectedPastSemId}
              options={[
                { value: "all", label: "All Past Semesters" },
                ...pastSemesters.map((s) => ({ value: s.semesterId, label: s.semesterName })),
              ]}
              className="w-44"
            />
          ) : undefined
        }
      >
        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search past course code or name..."
            className={`${SEARCH_FIELD} pl-9 pr-4 text-xs sm:text-sm shadow-2xs focus:ring-2 focus:ring-indigo-500`}
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
                      <span className="text-xs sm:text-sm font-semibold text-ink font-outfit">
                        {sem.semesterName}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                        ({filteredSemCourses.length} courses)
                      </span>
                    </div>
                    {sem.gpa && (
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-outfit">
                        GPA: {sem.gpa}
                      </span>
                    )}
                  </div>

                  {/* Course Pills */}
                  <div className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">{filteredSemCourses.map(renderCoursePill)}</div>
                </div>
              );
            })
          ) : (
            <EmptyPanel
              variant="dashed"
              icon={<History className="w-8 h-8 text-zinc-400 mx-auto" />}
              title="No archived course records found for earlier semesters."
              action={
                setActiveSubTab ? (
                  <button
                    onClick={() => setActiveSubTab("grades")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-course-3 hover:bg-course-3 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>View Grade History</span>
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </PageShell>
    );
  }

  // ── VIEW 1: CURRENT SEMESTER COURSES + PREVIOUS SEMESTERS PILL AT BOTTOM ──
  return (
    <PageShell
      eyebrow="Academics"
      title="My Courses & Marks"
      subtitle={`${filteredCurrentCourses.length} ${filteredCurrentCourses.length === 1 ? "course" : "courses"}`}
    >
      {/* ── SEARCH & FILTER STRIP ── */}
      {/* A vertical stack, not a row: the house pattern (ClubHubTab, EventHubTab).
          `ChipTabs` is `w-full` + `overflow-x-auto` by design, so it wants its own
          line and to scroll horizontally. In a `sm:flex-row` it claims 100% width
          and squeezes the search field instead. */}
      <div className="space-y-3">
        {/* ── Canvas "Academics": section switch + CGPA summary ── */}
        <div role="tablist" aria-label="Academics sections" className="grid grid-cols-3 gap-1 rounded-sm bg-surface-2 p-1">
          {[
            { id: "marks", label: "Marks" },
            { id: "grades", label: "Grades" },
            { id: "curriculum", label: "Curriculum" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === "marks"}
              onClick={() => t.id !== "marks" && setActiveSubTab?.(t.id)}
              className={`min-h-9 rounded-[5px] text-[13.5px] transition-colors duration-[120ms] ${
                t.id === "marks" ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {academicSummary.cgpa > 0 && (
          <div className="overflow-hidden rounded-md border border-line bg-surface text-left">
            <div className="px-4 pb-3 pt-3.5">
              <p className="text-[12.5px] text-muted">CGPA</p>
              <p className="font-mono text-[36px] font-semibold leading-tight tracking-tight tabular-nums text-ink">
                {academicSummary.cgpa.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line-2 border-t border-line-2">
              {[
                {
                  label: "Credits",
                  value:
                    academicSummary.earned > 0
                      ? `${academicSummary.earned} / ${academicSummary.required || "–"}`
                      : "–",
                },
                { label: "Courses", value: String(currentCourses.length) },
                { label: "This sem", value: academicSummary.semCredits > 0 ? `${academicSummary.semCredits} cr` : "–" },
              ].map((c) => (
                <div key={c.label} className="px-4 py-2.5">
                  <p className="text-[11.5px] text-muted">{c.label}</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-ink">{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search course code or name..."
            className={`${SEARCH_FIELD} pl-9 pr-4 text-xs sm:text-sm shadow-2xs focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* Type Filter Pills */}
        <ChipTabs
          options={[
            { value: "all" as CourseTypeFilter, label: "All" },
            { value: "theory", label: "Theory" },
            { value: "lab", label: "Lab" },
            { value: "embedded", label: "Embedded" },
          ]}
          value={selectedType}
          onChange={setSelectedType}
        />
      </div>

      {/* ── CURRENT SEMESTER COURSES PILLS LIST ── */}
      <div className="space-y-2">
        {filteredCurrentCourses.length > 0 ? (
          <div className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
            {filteredCurrentCourses.map(renderCoursePill)}
          </div>
        ) : (
          <EmptyPanel
            variant="dashed"
            icon={<BookOpen className="w-8 h-8 text-zinc-400 mx-auto" />}
            title="No courses found matching your search."
          />
        )}
      </div>

      {/* ── More in Academics: one hairline nav list ── */}
      <div role="region" aria-label="More in Academics" className="space-y-0 text-left">
        <h2 className="px-0.5 pb-2 text-[13.5px] font-semibold text-ink">More in Academics</h2>
        <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
          {[
            {
              icon: Sparkles,
              title: "Marks predictor",
              sub: "What-if scores and the FAT mark you need",
              onClick: () => setActiveSubTab?.("marks-predictor"),
            },
            {
              icon: BookOpen,
              title: "Degree curriculum",
              sub: "Credits, baskets and distribution",
              onClick: () => setActiveSubTab?.("curriculum"),
            },
            {
              icon: GraduationCap,
              title: "Grade history",
              sub: "CGPA and grades by semester",
              onClick: () => setActiveSubTab?.("grades"),
            },
            {
              icon: History,
              title: "Previous semesters",
              sub:
                pastSemesters.length > 0
                  ? `Courses and grades from ${pastSemesters.length} earlier semester${pastSemesters.length === 1 ? "" : "s"}`
                  : "Archived courses and grades",
              onClick: () => {
                if (pastSemesters.length > 0) setShowPastSemestersView(true);
                else if (setActiveSubTab) setActiveSubTab("grades");
                else setShowPastSemestersView(true);
              },
            },
          ].map(({ icon: Icon, title, sub, onClick }) => (
            <li key={title}>
              <button
                type="button"
                onClick={onClick}
                className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] text-ink">{title}</span>
                  <span className="block truncate text-[12px] text-muted">{sub}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
