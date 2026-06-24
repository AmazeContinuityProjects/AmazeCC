"use client";

import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCcw, ChevronDown, ChevronRight, BookOpen, Award, GraduationCap } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import SubpageLayout from "../shared/SubpageLayout";

// ── helpers ──────────────────────────────────────────────────────────
const normalizeDistributionType = (raw?: string) => {
  switch (raw?.toUpperCase()) {
    case "TH": return "Theory";
    case "LO": return "Lab Only";
    case "ETL": return "Embedded Theory & Lab";
    case "ELA": return "Embedded Lab";
    case "PJT": return "Project";
    case "SS": return "Soft Skill";
    case "OC": return "Online Course";
    default: return raw || "Other";
  }
};

const GRADE_COLORS: Record<string, string> = {
  S: "text-amber-500",
  A: "text-emerald-500",
  B: "text-blue-500",
  C: "text-cyan-500",
  D: "text-orange-500",
  E: "text-red-400",
  F: "text-red-600",
  P: "text-violet-500",
  N: "text-gray-400",
};

const GRADE_BG: Record<string, string> = {
  S: "bg-amber-500/10",
  A: "bg-emerald-500/10",
  B: "bg-blue-500/10",
  C: "bg-cyan-500/10",
  D: "bg-orange-500/10",
  E: "bg-red-400/10",
  F: "bg-red-600/10",
  P: "bg-violet-500/10",
  N: "bg-gray-400/10",
};

// ── types ────────────────────────────────────────────────────────────
interface CurriculumItem {
  basketTitle: string;
  creditsRequired: string;
  creditsEarned: string;
}

interface EffectiveGradeItem {
  basketTitle: string;
  distributionType: string;
  creditsEarned: string;
  grade: string;
}

// ── main component ──────────────────────────────────────────────────
export default function CurriculumPage({ allGradesData, gradesData, marksData, attendance, handleFetchGrades, setActiveSubTab }: {
  allGradesData?: any;
  gradesData: any;
  marksData: any;
  attendance: any;
  handleFetchGrades: () => void;
  setActiveSubTab: (tab: string) => void;
}) {
  const findCurriculum = () => {
    const sources = [
      allGradesData?.curriculum, allGradesData?.cgpa?.curriculum, allGradesData?.grades?.curriculum, allGradesData?.data?.curriculum,
      gradesData?.curriculum, gradesData?.cgpa?.curriculum, gradesData?.grades?.curriculum, gradesData?.data?.curriculum,
      marksData?.curriculum, marksData?.cgpa?.curriculum, gradesData?.grades?.curriculum
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  const findEffectiveGrades = () => {
    const sources = [
      allGradesData?.effectiveGrades, allGradesData?.cgpa?.effectiveGrades, allGradesData?.grades?.effectiveGrades, allGradesData?.data?.effectiveGrades,
      gradesData?.effectiveGrades, gradesData?.cgpa?.effectiveGrades, gradesData?.grades?.effectiveGrades, gradesData?.data?.effectiveGrades,
      marksData?.effectiveGrades, marksData?.cgpa?.effectiveGrades, marksData?.grades?.effectiveGrades
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  // ─ resolve curriculum array ─
  let curriculum: CurriculumItem[] = findCurriculum();

  // ─ resolve effective grades ─
  let effectiveGrades: EffectiveGradeItem[] = findEffectiveGrades();
  // Filter out the header row that comes from VTOP
  effectiveGrades = effectiveGrades.filter(eg => !isNaN(parseFloat(eg.creditsEarned)));

  // ─ totals ─
  const totalRow = curriculum.find(c => (c.basketTitle || "").toLowerCase().includes("total credits"));
  let totalRequired = totalRow ? parseFloat(totalRow.creditsRequired) : 160;
  let totalEarned = totalRow ? parseFloat(totalRow.creditsEarned) : 0;

  if (totalEarned === 0 && marksData?.cgpa?.creditsEarned) {
    totalEarned = parseFloat(marksData.cgpa.creditsEarned) + parseFloat(marksData.cgpa.nonGradedRequirement || "0");
    totalRequired = parseFloat(marksData.cgpa.creditsRequired) || 160;
  }
  if (totalEarned === 0 && effectiveGrades.length > 0) {
    totalEarned = effectiveGrades.reduce((acc, curr) => acc + (parseFloat(curr.creditsEarned) || 0), 0);
  }

  // ─ category splits ─
  const specialBaskets = ["Extra curricular activities", "HSM Elective", "Foreign Language"];
  const withoutTotal = curriculum.filter(c => !(c.basketTitle || "").toLowerCase().includes("total credits"));
  const mainCategories = withoutTotal.filter(c => !specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));
  const subCategories = withoutTotal.filter(c => specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));

  // ─ in-progress credits from current attendance ─
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const ongoingCreditsByCategory = safeAttendance.reduce<Record<string, number>>((acc, item) => {
    let category = item.category || "Uncategorized";
    const credits = parseFloat(item.credits) || 0;
    if (category === "Foundation Core - Humanities, Social Sciences and Management (LANGUAGE Basket)") category = "Foreign Language";
    else if (category === "Foundation Core - Humanities, Social Sciences and Management (GENERAL Basket)") category = "HSM Elective";
    else if (category === "Foundation Core - Humanities, Social Sciences and Management (EXTRA CURRICULAR Basket)") category = "Extra curricular activities";
    acc[category] = (acc[category] || 0) + credits;

    const hssm = "Foundation Core - Humanities, Social Sciences and Management";
    const ngcr = "Non-graded Core Requirement";
    if (category === "Foreign Language" || category === "HSM Elective") acc[hssm] = (acc[hssm] || 0) + credits;
    if (category === "Extra curricular activities") acc[ngcr] = (acc[ngcr] || 0) + credits;
    return acc;
  }, {});

  const totalOngoing = Object.values(ongoingCreditsByCategory).reduce((s, v) => s + v, 0);

  // ─ group effective grades by distribution type ─
  const groupedCourses = effectiveGrades.reduce<Record<string, EffectiveGradeItem[]>>((acc, eg) => {
    const key = normalizeDistributionType(eg.distributionType);
    if (!acc[key]) acc[key] = [];
    acc[key].push(eg);
    return acc;
  }, {});

  // ─ empty state ─
  if (curriculum.length === 0 && effectiveGrades.length === 0) {
    return (
      <div className="py-12 text-center">
        <GraduationCap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-300 midnight:text-gray-400 mb-4">No curriculum data available.</p>
        <FetchButton onClick={handleFetchGrades} icon={<RefreshCcw className="w-4 h-4" />} className="px-5 py-2.5 rounded-xl">
          Load Grades Data
        </FetchButton>
      </div>
    );
  }

  // ─ donut chart data ─
  const earnedPct = Math.min((totalEarned / totalRequired) * 100, 100);
  const donutData = [
    { name: "Earned", value: totalEarned },
    { name: "In Progress", value: Math.min(totalOngoing, totalRequired - totalEarned) },
    { name: "Remaining", value: Math.max(totalRequired - totalEarned - totalOngoing, 0) },
  ];

  return (
    <SubpageLayout
      title="Curriculum Overview"
      subtitle="Track your degree progress across all credit baskets"
      onBack={() => setActiveSubTab("overview")}
      action={
        <FetchButton onClick={handleFetchGrades} icon={<RefreshCcw className="w-4 h-4" />} className="rounded-xl">
          <span className="text-sm">Reload</span>
        </FetchButton>
      }
    >

      {/* ── Total Credits Summary ── */}
      <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-indigo-950/30 midnight:from-black midnight:to-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 midnight:border-indigo-900/30 rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Donut */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                    <Cell fill="#6366f1" />
                    <Cell fill="#facc15" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">{earnedPct.toFixed(0)}%</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Complete</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 w-full">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white mb-4">Total Credits Progress</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 midnight:bg-gray-900/50 border border-indigo-100/50 dark:border-indigo-800/30 midnight:border-gray-800">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Earned</span>
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 midnight:text-indigo-400">{totalEarned.toFixed(1)}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 midnight:bg-gray-900/50 border border-yellow-100/50 dark:border-yellow-800/30 midnight:border-gray-800">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">In Progress</span>
                  <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400">{totalOngoing.toFixed(1)}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 midnight:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 midnight:border-gray-800">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Required</span>
                  <span className="text-xl font-bold text-gray-700 dark:text-gray-300 midnight:text-gray-300">{totalRequired.toFixed(1)}</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>Earned</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>In Progress</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block"></span>Remaining</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Category Progress Cards ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-500" /> Credit Baskets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mainCategories.map((c, idx) => {
            const earned = parseFloat(c.creditsEarned) || 0;
            const required = parseFloat(c.creditsRequired) || 1;
            const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
            return (
              <ProgressCard key={idx} title={c.basketTitle} earned={earned} inProgress={inProgress} required={required} />
            );
          })}
        </div>
      </div>

      {/* ── Sub-basket Section ── */}
      {subCategories.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-500" /> Basket Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {subCategories.map((c, idx) => {
              const earned = parseFloat(c.creditsEarned) || 0;
              const required = parseFloat(c.creditsRequired) || 1;
              const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
              return (
                <ProgressCard key={idx} title={c.basketTitle} earned={earned} inProgress={inProgress} required={required} compact />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Course Breakdown ── */}
      {Object.keys(groupedCourses).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-500" /> Courses Completed
          </h2>
          <div className="space-y-2">
            {Object.entries(groupedCourses).sort(([a], [b]) => a.localeCompare(b)).map(([type, courses]) => (
              <CourseAccordion key={type} type={type} courses={courses} />
            ))}
          </div>
        </div>
      )}
    </SubpageLayout>
  );
}

// ── ProgressCard component ──────────────────────────────────────────
function ProgressCard({ title, earned, inProgress, required, compact = false }: {
  title: string;
  earned: number;
  inProgress: number;
  required: number;
  compact?: boolean;
}) {
  const isComplete = earned >= required;
  const effectiveTotal = isComplete ? earned : earned + inProgress;
  const progressEarned = Math.min((earned / required) * 100, 100);
  const progressWithOngoing = Math.min((effectiveTotal / required) * 100, 100);

  return (
    <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex justify-between items-start mb-3">
          <h3 className={`${compact ? "text-sm" : "text-sm"} font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 leading-tight pr-2`}>
            {title}
          </h3>
          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
            isComplete
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 midnight:bg-green-900/30 midnight:text-green-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 midnight:bg-blue-900/30 midnight:text-blue-400"
          }`}>
            {progressEarned.toFixed(0)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 midnight:bg-gray-800">
          {!isComplete && (
            <div className="absolute left-0 top-0 h-full bg-yellow-400/60 transition-all duration-500" style={{ width: `${progressWithOngoing}%` }} />
          )}
          <div className={`absolute left-0 top-0 h-full transition-all duration-500 ${isComplete ? "bg-green-500" : "bg-blue-600 dark:bg-blue-500 midnight:bg-blue-500"}`} style={{ width: `${progressEarned}%` }} />
        </div>

        {/* Labels */}
        <div className="flex justify-between items-center mt-2 text-[11px] text-gray-500">
          <span><span className="font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">{earned.toFixed(1)}</span> earned</span>
          {inProgress > 0 && (
            <span><span className="font-semibold text-yellow-600 dark:text-yellow-400 midnight:text-yellow-400">{inProgress.toFixed(1)}</span> ongoing</span>
          )}
          <span><span className="font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">{required.toFixed(1)}</span> req.</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── CourseAccordion component ────────────────────────────────────────
function CourseAccordion({ type, courses }: { type: string; courses: EffectiveGradeItem[] }) {
  const [open, setOpen] = useState(false);

  const totalCredits = courses.reduce((s, c) => s + (parseFloat(c.creditsEarned) || 0), 0);

  return (
    <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800 midnight:hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200">{type}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 midnight:bg-gray-800 text-gray-600 dark:text-gray-400 midnight:text-gray-400 font-medium">
            {courses.length} {courses.length === 1 ? "course" : "courses"} · {totalCredits.toFixed(1)} cr.
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800">
          {courses.map((course, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-4 py-3 ${
                idx !== courses.length - 1 ? "border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 truncate">{course.basketTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">{course.creditsEarned} credits</p>
              </div>
              <div className={`flex-shrink-0 ml-3 px-2.5 py-1 rounded-lg text-sm font-bold ${GRADE_COLORS[course.grade] || "text-gray-500"} ${GRADE_BG[course.grade] || "bg-gray-100"}`}>
                {course.grade}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
