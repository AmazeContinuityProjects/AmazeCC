"use client";

import { useState } from "react";
import { RefreshCcw, GraduationCap, Award, Calculator, Info } from "lucide-react";
import NoContentFound from "../NoContentFound";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import PageHeader from "../shared/PageHeader";
import Badge from "../shared/Badge";

const GRADE_BADGE_CLASSES: Record<string, string> = {
  S: 'bg-emerald-50 text-emerald-700 border-emerald-500/10 dark:bg-emerald-950/30 dark:text-emerald-450',
  A: 'bg-green-50 text-green-700 border-green-500/10 dark:bg-green-950/30 dark:text-green-400',
  B: 'bg-blue-50 text-blue-700 border-blue-500/10 dark:bg-blue-950/30 dark:text-blue-400',
  C: 'bg-indigo-50 text-indigo-700 border-indigo-500/10 dark:bg-indigo-950/30 dark:text-indigo-400',
  D: 'bg-purple-50 text-purple-700 border-purple-500/10 dark:bg-purple-950/30 dark:text-purple-400',
  E: 'bg-orange-50 text-orange-700 border-orange-500/10 dark:bg-orange-950/30 dark:text-orange-400',
  F: 'bg-red-50 text-red-700 border-red-500/10 dark:bg-red-950/30 dark:text-red-400',
  N: 'bg-zinc-50 text-zinc-650 border-zinc-200/50 dark:bg-zinc-900 dark:text-zinc-400'
};

const HOVER_BORDER_CLASSES: Record<string, string> = {
  S: 'hover:border-emerald-500/35 dark:hover:border-emerald-500/45',
  A: 'hover:border-green-500/35 dark:hover:border-green-500/45',
  B: 'hover:border-blue-500/35 dark:hover:border-blue-500/45',
  C: 'hover:border-indigo-500/35 dark:hover:border-indigo-500/45',
  D: 'hover:border-purple-500/35 dark:hover:border-purple-500/45',
  E: 'hover:border-orange-500/35 dark:hover:border-orange-500/45',
  F: 'hover:border-red-500/35 dark:hover:border-red-500/45'
};

export default function AllGradesDisplay({ data, handleAllGradesFetch, CGPA, attendance }) {
  
  if (!data || !data.grades) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
          title="Grade History"
          meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Grades OS</Badge>}
          actions={
            <FetchButton onClick={handleAllGradesFetch} icon={<RefreshCcw className="w-4 h-4" />} className="rounded-xl">
              <span className="text-xs">Reload Grades</span>
            </FetchButton>
          }
        />
        <NoContentFound />
      </div>
    );
  }

  const semesterKeys = Object.keys(data.grades).filter((sem) => data.grades[sem]);
  if (semesterKeys.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
          title="Grade History"
          meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Grades OS</Badge>}
          actions={
            <FetchButton onClick={handleAllGradesFetch} icon={<RefreshCcw className="w-4 h-4" />} className="rounded-xl">
              <span className="text-xs">Reload Grades</span>
            </FetchButton>
          }
        />
        <NoContentFound />
      </div>
    );
  }

  const [activeSem, setActiveSem] = useState(semesterKeys[semesterKeys.length - 1]);
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  const semesterData = data.grades[activeSem];
  const gpa = semesterData?.gpa || null;
  const gradeList = semesterData?.grades || [];

  const formatNumber = (num) => {
    const numericValue = Number(num);
    if (num == null || isNaN(numericValue)) return "-";
    return Number(numericValue.toFixed(2)).toString();
  };

  const normalizeCourseCode = (courseCode) => courseCode?.slice(0, 8) ?? "";

  const allSemesterGrades = Object.values(data.grades) as Array<{ grades?: Array<{ courseCode?: string; grade?: string }> }>;

  const gradePool = allSemesterGrades.flatMap((semester) => semester?.grades || []).reduce((pool, course) => {
    const normalizedCode = normalizeCourseCode(course?.courseCode);
    if (normalizedCode) {
      pool[normalizedCode] = course?.grade;
    }
    return pool;
  }, {});

  const curr = attendance.filter((a) => (a.category !== "Non-graded Core Requirement" && a.courseTitle !== "")).map(a => ({
    courseCode: normalizeCourseCode(a.courseCode),
    courseTitle: a.courseTitle,
    credits: parseFloat(a.credits)
  }));

  const [predictedGrades, setPredictedGrades] = useState<Record<string, string>>({});

  const gradePointMap = {
    S: 10,
    A: 9,
    B: 8,
    C: 7,
    D: 6,
    E: 5,
    F: 0,
    N: 0
  };

  const getGradePoint = (grade) => gradePointMap[grade] ?? 9;

  const currentCgpa = Number(CGPA?.cgpa) || 0;
  const currentCredits = Number(CGPA?.creditsEarned) || 0;

  const predictedSemesterCreditPoints = curr.reduce((sum, course, idx) => {
    const key = `${course.courseCode}-${idx}`;
    const matchedGrade = gradePool[normalizeCourseCode(course.courseCode)];
    const selectedGrade = predictedGrades[key] || matchedGrade || "A";
    const gradePoint = getGradePoint(selectedGrade);
    return sum + (course.credits || 0) * gradePoint;
  }, 0);

  const predictedCreditPoints = curr.reduce((sum, course, idx) => {
    const key = `${course.courseCode}-${idx}`;
    const matchedGrade = gradePool[normalizeCourseCode(course.courseCode)];
    const selectedGrade = predictedGrades[key] || matchedGrade || "A";
    const selectedGradePoint = getGradePoint(selectedGrade);

    if (matchedGrade) {
      const matchedGradePoint = getGradePoint(matchedGrade);
      return sum + (course.credits || 0) * (selectedGradePoint - matchedGradePoint);
    }

    return sum + (course.credits || 0) * selectedGradePoint;
  }, 0);

  const predictedAddedCredits = curr.reduce((sum, course) => {
    const matchedGrade = gradePool[normalizeCourseCode(course.courseCode)];
    if (matchedGrade) {
      return sum;
    }
    return sum + (course.credits || 0);
  }, 0);

  const predictedSemesterCredits = curr.reduce((sum, course) => sum + (course.credits || 0), 0);
  const predictedTotalCredits = currentCredits + predictedAddedCredits;
  const predictedCgpa = predictedTotalCredits > 0
    ? ((currentCgpa * currentCredits) + predictedCreditPoints) / predictedTotalCredits
    : 0;
  const predictedGpa = predictedSemesterCredits > 0
    ? predictedSemesterCreditPoints / predictedSemesterCredits
    : 0;

  // Pretty semester name helper
  const getSemDisplayName = (sem: string) => {
    if (sem === "predict") return "CGPA Predictor";
    if (sem.length >= 8 && sem.includes("20")) {
      const yearMatch = sem.match(/20\d{4}/);
      if (yearMatch) {
        const startYear = yearMatch[0].slice(0, 4);
        const endYear = "20" + yearMatch[0].slice(4, 6);
        let term = "Semester";
        if (sem.endsWith("1") || sem.endsWith("01")) term = "Fall";
        else if (sem.endsWith("5") || sem.endsWith("05")) term = "Winter";
        else if (sem.endsWith("9") || sem.endsWith("09")) term = "Summer";
        return `${term} Sem ${startYear}-${endYear}`;
      }
    } else if (sem.length >= 5) {
      const match = sem.match(/(\d{2})(\d{2})(\d)/);
      if (match) {
        const startYear = "20" + match[1];
        const endYear = "20" + match[2];
        let term = "Semester";
        if (match[3] === "1") term = "Fall";
        else if (match[3] === "5") term = "Winter";
        else if (match[3] === "9") term = "Summer";
        return `${term} Sem ${startYear}-${endYear}`;
      }
    }
    return sem.endsWith("1") ? `Fall Sem ${sem.substring(0, 4)}` : `Winter Sem ${sem.substring(0, 4)}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
        title="Grade History"
        meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Grades OS</Badge>}
        actions={
          <FetchButton onClick={handleAllGradesFetch} icon={<RefreshCcw className="w-4 h-4" />} className="rounded-xl">
            <span className="text-xs">Reload Grades</span>
          </FetchButton>
        }
      />

      {/* Styled Horizontal Tab Switcher */}
      <div className="flex w-full gap-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 p-1 mb-6 overflow-x-auto hide-scrollbar scroll-smooth">
        {semesterKeys.map((sem) => (
          <button
            key={sem}
            onClick={() => {
              setActiveSem(sem);
              setOpenCourse(null);
            }}
            className={`flex-shrink-0 flex-1 min-w-[140px] text-center rounded-xl py-2 px-3.5 text-xs font-black transition-all cursor-pointer border border-transparent ${
              activeSem === sem
                ? "bg-white text-indigo-600 border-zinc-200/50 shadow-3xs dark:bg-zinc-900 dark:border-zinc-800/80 dark:text-indigo-400"
                : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
            }`}
          >
            {getSemDisplayName(sem)}
          </button>
        ))}
        <button
          onClick={() => {
            setActiveSem("predict");
            setOpenCourse(null);
          }}
          className={`flex-shrink-0 flex-1 min-w-[140px] text-center rounded-xl py-2 px-3.5 text-xs font-black transition-all cursor-pointer border border-transparent ${
            activeSem === "predict"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-3xs dark:bg-zinc-900 dark:border-zinc-800/80 dark:text-indigo-400"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          Predict CGPA
        </button>
      </div>

      {gpa && activeSem !== "predict" && (
        <div className="rounded-2xl border border-indigo-500/10 bg-indigo-50/20 dark:bg-indigo-950/10 p-4 shadow-3xs w-fit mx-auto sm:mx-0 flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">
            Semester GPA: <span className="text-sm font-black text-zinc-800 dark:text-zinc-100">{gpa}</span>
          </span>
        </div>
      )}

      {/* Main Grid View */}
      {activeSem !== "predict" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {gradeList.map((course, idx) => {
            const displayGrade = course.grade || "N";
            return (
              <div
                key={course.courseId || course.courseCode || idx}
                className={`p-5 rounded-3xl shadow-2xs border border-zinc-200/60 bg-gradient-to-br from-white to-zinc-55/20 dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 cursor-pointer transition-all duration-300 hover:shadow-xs active:scale-[0.99] group flex flex-col justify-between ${HOVER_BORDER_CLASSES[displayGrade] || 'hover:border-zinc-350 dark:hover:border-zinc-700'}`}
                onClick={() => setOpenCourse(course.courseId)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-zinc-850 dark:text-zinc-150 text-xs sm:text-sm tracking-wide leading-tight group-hover:text-indigo-500 transition-colors block">
                      {course.courseCode}
                    </span>
                    <span className="font-bold text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-550 mt-1 line-clamp-2 leading-normal">
                      {course.courseTitle}
                    </span>

                    <Badge variant="default" className="rounded-lg uppercase font-bold tracking-wider text-[9px] bg-zinc-100 text-zinc-700 dark:bg-zinc-850 dark:text-zinc-300 border-zinc-200/30 mt-4.5">
                      {course.courseType}
                    </Badge>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0 gap-2">
                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${GRADE_BADGE_CLASSES[displayGrade] || 'bg-zinc-50 border-zinc-200/40 text-zinc-600'}`}>
                      Grade: {displayGrade}
                    </span>
                    {course.grandTotal && (
                      <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-indigo-50/80 text-indigo-600 border border-indigo-500/10 dark:bg-indigo-950/20 dark:text-indigo-400 whitespace-nowrap">
                        Total: {course.grandTotal}
                      </span>
                    )}
                  </div>
                </div>

                {openCourse === course.courseId && (
                  <Modal onClose={() => setOpenCourse(null)} maxWidth="max-w-2xl" className="max-h-[90vh] overflow-y-auto">
                    <h2 className="text-sm font-black text-zinc-850 dark:text-zinc-100 font-outfit mb-2">
                      {course.courseCode}
                    </h2>
                    <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 mb-5 leading-normal">
                      {course.courseTitle}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6 bg-zinc-55/20 dark:bg-zinc-950/20 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80">
                      <div>
                        <p className="text-[9px] font-black text-zinc-450 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Course Type</p>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-none">{course.courseType}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-zinc-450 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Assigned Grade</p>
                        <p className={`text-xs font-black leading-none inline-block rounded-md px-1.5 py-0.5 border ${GRADE_BADGE_CLASSES[displayGrade] || 'bg-zinc-100'}`}>{displayGrade}</p>
                      </div>
                    </div>

                    {course.range && (
                      <div className="mt-4 border-t border-zinc-150 dark:border-zinc-850 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-450 dark:text-zinc-550 mb-3 leading-none">Grade Boundaries Map</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
                          {Object.entries(course.range as Record<string, string | number>).map(([grade, range]) => (
                            <div key={grade} className={`bg-white/60 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-850 text-center ${grade === displayGrade ? 'ring-2 ring-indigo-500' : ''}`}>
                              <span className={`text-xs font-black block ${GRADE_BADGE_CLASSES[grade] ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-600'}`}>{grade}</span>
                              <span className="text-[9px] text-zinc-400 font-bold block mt-1">{range}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {course.details && course.details.length > 0 ? (
                      <div className="mt-6 border-t border-zinc-150 dark:border-zinc-850 pt-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-450 dark:text-zinc-550 mb-3 leading-none">Assessment Components</p>
                        <div className="space-y-2.5">
                          {course.details.map((d, idx) => (
                            <div key={idx} className="bg-zinc-55/20 dark:bg-zinc-950/20 p-3.5 rounded-2xl border border-zinc-200/40 dark:border-zinc-850 flex justify-between items-center">
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">{d.component}</p>
                                <p className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold mt-1 uppercase tracking-wider">Weightage Points: {formatNumber(d.weightageMark)}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-xs font-black text-zinc-850 dark:text-zinc-100">{formatNumber(d.scoredMark)}</span>
                                <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">/ {formatNumber(d.maxMark)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 flex justify-between items-center font-black mt-4">
                            <span className="text-xs text-zinc-650 dark:text-zinc-350">Aggregate Class Score</span>
                            <span className="text-xs text-indigo-500 dark:text-indigo-450">
                              {formatNumber(course.details.reduce((sum, d) => sum + (Number(d.scoredMark) || 0), 0))} / {formatNumber(course.details.reduce((sum, d) => sum + (Number(d.maxMark) || 0), 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-550 italic text-center py-2 border-t border-zinc-150 dark:border-zinc-850 pt-5">
                        No detailed component breakdown data available for this class record.
                      </p>
                    )}
                  </Modal>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* CGPA Predictor Dashboard View */
        <div className="p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-850 bg-gradient-to-br from-white to-zinc-55/20 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 shadow-2xs">
          <div className="mb-6 flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-850 pb-4">
            <Calculator className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-150">CGPA Projection Calculator</h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ["Current CGPA", currentCgpa.toFixed(2), "border-indigo-500/10 bg-indigo-50/20 text-indigo-600 dark:bg-indigo-950/10 dark:text-indigo-450"],
              ["Current Credits", currentCredits.toFixed(1), "border-zinc-200/50 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"],
              ["Predicted GPA", predictedGpa.toFixed(2), "border-zinc-200/50 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"],
              ["Projected CGPA", predictedCgpa.toFixed(2), "border-emerald-500/10 bg-emerald-50/20 text-emerald-600 dark:bg-emerald-950/10 dark:text-emerald-450"],
            ].map(([label, val, cardClass]: any) => (
              <div key={label} className={`rounded-2xl border p-4 shadow-3xs ${cardClass}`}>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80 leading-none mb-2">{label}</p>
                <p className="text-lg font-black leading-none">{val}</p>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1">
              <Info size={13} className="text-indigo-500" /> Live Simulation
            </h4>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-550 leading-relaxed">
              Tweak expected grades below to simulate your future GPA and track changes compared to current grades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {curr.map((course, idx) => {
              const key = `${course.courseCode}-${idx}`;
              const matchedGrade = gradePool[normalizeCourseCode(course.courseCode)];
              const selectedGrade = predictedGrades[key] || matchedGrade || "A";
              return (
                <div
                  key={key}
                  className={`h-full rounded-2xl border p-4.5 flex flex-col justify-between gap-4 ${
                    matchedGrade
                      ? "border-zinc-200/30 bg-zinc-55/30 text-zinc-400 dark:border-zinc-900/60 dark:bg-zinc-950/30"
                      : "border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-black/20"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-black text-xs sm:text-sm tracking-wide ${matchedGrade ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-150"}`}>
                      {course.courseCode}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
                      {course.courseTitle}
                    </p>
                    <p className="text-[9px] font-black text-indigo-500/90 dark:text-indigo-400/80 uppercase tracking-widest mt-2 leading-none">
                      Credits: {course.credits}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-850 pt-3 mt-auto">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Simulate Grade
                    </span>
                    <select
                      id={`grade-${key}`}
                      value={selectedGrade}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPredictedGrades((prev) => ({
                          ...prev,
                          [key]: value
                        }));
                      }}
                      className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold text-xs px-3 py-1.5 cursor-pointer shadow-3xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="S">S (10)</option>
                      <option value="A">A (9)</option>
                      <option value="B">B (8)</option>
                      <option value="C">C (7)</option>
                      <option value="D">D (6)</option>
                      <option value="E">E (5)</option>
                      <option value="F">F (0)</option>
                      <option value="N">N (0)</option>
                    </select>
                  </div>

                  {matchedGrade && !predictedGrades[key] && (
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none">
                      Already captured from grade: <span className="font-extrabold">{matchedGrade}</span>
                    </p>
                  )}
                  {matchedGrade && predictedGrades[key] && predictedGrades[key] !== matchedGrade && (
                    <p className="text-[9px] text-indigo-500 font-extrabold leading-none animate-pulse">
                      Overridden from {matchedGrade} to {predictedGrades[key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
