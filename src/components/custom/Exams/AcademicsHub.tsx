"use client";

import React, { useState, useEffect } from "react";
import { History, BookOpen, TrendingUp, Database, ChevronRight, Trophy, AlertTriangle, GraduationCap, FileCode, BookMarked, ScrollText, UserCheck, LayoutDashboard, Award, Percent, BookOpenCheck } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@amazecontinuityprojects/amazeui";
import GradesModal from "./GradesModal";
import PageHeader from "../shared/PageHeader";
import Badge from "../shared/Badge";

export default function AcademicsHub({ setActiveSubTab, data, marksData, gradesData, attendance, hideMobileHeader, handleFetchGrades }) {
  const cards = [
    {
      id: "course-dashboard",
      title: "Course Hub",
      description: "Your one-stop hub — courses, grades, arrears, projects and more.",
      icon: LayoutDashboard,
      color: "text-white",
      bg: "bg-gradient-to-br from-indigo-500 to-purple-650 dark:from-indigo-600 dark:to-purple-750",
      prominent: true,
    },
    {
      id: "grades",
      title: "Grade History",
      description: "Analyze your academic performance and past grades.",
      icon: History,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:from-purple-950/10 dark:to-indigo-950/5 border-purple-100/50 dark:border-purple-900/30",
    },
    {
      id: "curriculum",
      title: "Curriculum",
      description: "Track your completed courses and credit requirements.",
      icon: BookOpen,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/10 dark:to-teal-950/5 border-emerald-100/50 dark:border-emerald-900/30",
    },
    {
      id: "predictor",
      title: "CGPA Predictor",
      description: "Estimate your future CGPA based on expected grades.",
      icon: TrendingUp,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-gradient-to-br from-orange-50/50 to-amber-50/30 dark:from-orange-950/10 dark:to-amber-950/5 border-orange-100/50 dark:border-orange-900/30",
    },
    {
      id: "qbank",
      title: "Question Bank",
      description: "Access and search past year question papers.",
      icon: Database,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-gradient-to-br from-rose-50/50 to-pink-50/30 dark:from-rose-950/10 dark:to-pink-950/5 border-rose-100/50 dark:border-rose-900/30",
    },
    {
      id: "arrear",
      title: "Arrear Management",
      description: "View arrear schedule, details and grades.",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/10 dark:to-yellow-950/5 border-amber-100/50 dark:border-amber-900/30",
    },
    {
      id: "makeup-compre",
      title: "Makeup & Compre",
      description: "Makeup exam eligibility, schedule and compre info.",
      icon: GraduationCap,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-gradient-to-br from-cyan-50/50 to-blue-50/30 dark:from-cyan-950/10 dark:to-blue-950/5 border-cyan-100/50 dark:border-cyan-900/30",
    },
    {
      id: "course-mgmt",
      title: "Course Management",
      description: "Course options, extracurriculars, minor/honour courses.",
      icon: ScrollText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-gradient-to-br from-blue-50/50 to-sky-50/30 dark:from-blue-950/10 dark:to-sky-950/5 border-blue-100/50 dark:border-blue-900/30",
    },
    {
      id: "projects",
      title: "Projects",
      description: "View your projects and project courses.",
      icon: FileCode,
      color: "text-pink-600 dark:text-pink-400",
      bg: "bg-gradient-to-br from-pink-50/50 to-rose-50/30 dark:from-pink-950/10 dark:to-rose-950/5 border-pink-100/50 dark:border-pink-900/30",
    },
    {
      id: "wishlist",
      title: "Wishlist & Learning",
      description: "Wishlist, registration and additional learning courses.",
      icon: BookMarked,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-gradient-to-br from-teal-50/50 to-emerald-50/30 dark:from-teal-950/10 dark:to-emerald-950/5 border-teal-100/50 dark:border-teal-900/30",
    },
    {
      id: "faculty-info",
      title: "Faculty Info",
      description: "Search and view faculty contact details.",
      icon: UserCheck,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-gradient-to-br from-indigo-50/50 to-purple-50/30 dark:from-indigo-950/10 dark:to-purple-950/5 border-indigo-100/50 dark:border-indigo-900/30",
    },
  ];

  // Performance Logic
  const currentCgpa = Number(marksData?.cgpa?.cgpa || 0);
  const creditsEarned = Number(marksData?.cgpa?.creditsEarned || 0);
  const totalRequiredCredits = 160;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedGoal, setSavedGoal] = useState<{ target: number, requiredSgpa: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("uni_cc_gpa_goal");
    if (saved) {
      try {
        setSavedGoal(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  let rawCurriculum = [];
  if (Array.isArray(data?.curriculum) && data.curriculum.length > 0) rawCurriculum = data.curriculum;
  else if (Array.isArray(marksData?.curriculum) && marksData.curriculum.length > 0) rawCurriculum = marksData.curriculum;
  else if (Array.isArray(data?.cgpa?.curriculum) && data.cgpa.curriculum.length > 0) rawCurriculum = data.cgpa.curriculum;
  else if (Array.isArray(marksData?.cgpa?.curriculum) && marksData.cgpa.curriculum.length > 0) rawCurriculum = marksData.cgpa.curriculum;

  const curriculum = rawCurriculum;
  const totalCreditsObj = curriculum.find(c => (c?.basketTitle || "").toLowerCase().includes("total credits"));
  const requiredCredits = totalCreditsObj ? parseFloat(totalCreditsObj.creditsRequired) : totalRequiredCredits;
  const degreeCompletePercent = Math.min((creditsEarned / requiredCredits) * 100, 100);

  let rawGradeCounts = (data?.cgpa?.grades || marksData?.cgpa?.grades || {}) as Record<string, number>;
  
  if (Object.keys(rawGradeCounts).length === 0) {
    const computedGradeCounts: Record<string, number> = {};
    const allSemesters = Object.values(data?.grades || {}) as Array<{ grades?: Array<{ grade?: string }> } | null>;
    allSemesters.forEach(sem => {
      if (!sem) return;
      (sem.grades || []).forEach(course => {
        if (course.grade) {
          computedGradeCounts[course.grade] = (computedGradeCounts[course.grade] || 0) + 1;
        }
      });
    });
    rawGradeCounts = computedGradeCounts;
  }

  const gradeCounts = rawGradeCounts;
  const gradeDistributionData = Object.entries(gradeCounts)
    .filter(([grade]) => grade !== "N" && grade !== "F")
    .map(([grade, count]) => ({
      name: grade,
      count: count
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, N: 8 };
      return (order[a.name] || 99) - (order[b.name] || 99);
    });

  let totalCourses = 0;
  let passedCourses = 0;
  const allSemesters = Object.values(data?.grades || {}) as Array<{ grades?: Array<{ grade?: string }> } | null>;
  allSemesters.forEach(sem => {
    if (!sem) return;
    (sem.grades || []).forEach(course => {
      totalCourses++;
      if (course.grade !== "F" && course.grade !== "N") {
        passedCourses++;
      }
    });
  });
  const passRate = totalCourses > 0 ? ((passedCourses / totalCourses) * 100).toFixed(0) : 100;
  const currentCourses = Array.isArray(marksData?.courses) ? marksData.courses : [];
  const uniqueCurrentCourses = new Set(currentCourses.map((course: any) => course.courseCode || course.code).filter(Boolean));
  const attendanceRows = Array.isArray(attendance) ? attendance : (attendance?.attendance || []);
  const avgAttendance = attendanceRows.length > 0
    ? Math.round(attendanceRows.reduce((sum: number, row: any) => sum + (Number(row.attendancePercentage) || 0), 0) / attendanceRows.length)
    : 0;
  const belowTargetCount = attendanceRows.filter((row: any) => Number(row.attendancePercentage) < 75).length;
  const recentSemester = Object.entries(data?.grades || {}).filter(([, details]: any) => details?.gpa).at(-1) as any;
  const recentGpa = recentSemester?.[1]?.gpa || currentCgpa;

  const toolSummaries: Record<string, string[]> = {
    "course-dashboard": [`${uniqueCurrentCourses.size || currentCourses.length} Courses`, `Avg attendance ${avgAttendance || "-"}%`, `${belowTargetCount} below target`],
    grades: [`${totalCourses} Courses`, `${passRate}% pass rate`, `Latest GPA ${Number(recentGpa || 0).toFixed(2)}`],
    curriculum: [`${creditsEarned.toFixed(1)} Credits`, `${degreeCompletePercent.toFixed(0)}% complete`, `${Math.max(requiredCredits - creditsEarned, 0).toFixed(1)} remaining`],
    predictor: [savedGoal ? `${savedGoal.target.toFixed(2)} target` : "No saved target", `${currentCgpa.toFixed(2)} current`, "Live calculator"],
    qbank: [`${uniqueCurrentCourses.size || currentCourses.length} course paths`, "Papers + extracted questions", "Upload & browse"],
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-20 px-4 sm:px-6 animate-fadeIn">
      <PageHeader
        icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
        title="Academics Hub"
        meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Student OS</Badge>}
        actions={
          <button
            onClick={() => setActiveSubTab("course-dashboard")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition-all shadow-sm text-xs cursor-pointer active:scale-[0.98]"
          >
            <BookOpenCheck size={15} />
            <span>Courses</span>
          </button>
        }
      />

      {savedGoal && (
        <div className="rounded-2xl border border-indigo-500/10 bg-indigo-50/20 dark:bg-indigo-950/10 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-3xs dark:bg-zinc-900/80">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Active Goal</p>
              <p className="truncate text-base font-black text-zinc-800 dark:text-zinc-100">
                {savedGoal.target.toFixed(2)} Target CGPA <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">· requires {savedGoal.requiredSgpa.toFixed(2)} SGPA</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Dashboard Command Center */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <button
          onClick={() => { setActiveSubTab("course-dashboard"); window.scrollTo(0, 0); }}
          className="group rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-white to-zinc-55/20 p-6 text-left shadow-2xs hover:shadow-xs transition-all duration-300 active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 relative overflow-hidden"
        >
          {/* Subtle glowing ring background */}
          <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/8 transition-all duration-300" />
          
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Current Semester</p>
              <h2 className="mt-2 font-outfit text-3xl font-black text-zinc-900 dark:text-zinc-100">Course Hub</h2>
              <p className="mt-2.5 max-w-md text-xs font-medium text-zinc-400 dark:text-zinc-500 leading-relaxed">
                Analyze course grades, track class attendance, predicted marks, and view projects in a single streamlined dashboard.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/30 transition-transform group-hover:translate-x-0.5">
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
            {toolSummaries["course-dashboard"].map((item) => (
              <div key={item} className="rounded-xl border border-zinc-200/50 bg-white/70 p-3 dark:border-zinc-800/50 dark:bg-zinc-950/40 min-w-0">
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate" title={item}>{item}</p>
              </div>
            ))}
          </div>
        </button>

        {/* Dashboard Right-side Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ["CGPA", currentCgpa.toFixed(2), Award, "text-emerald-500 dark:text-emerald-400"],
            ["Attendance", avgAttendance ? `${avgAttendance}%` : "-", Percent, "text-indigo-500"],
            ["Credits", `${creditsEarned.toFixed(0)}/${requiredCredits.toFixed(0)}`, GraduationCap, "text-purple-500"],
          ].map(([label, value, Icon, color]: any) => (
            <div key={label} className="rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-white to-zinc-55/20 p-4.5 shadow-2xs dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 flex flex-col justify-between min-w-0">
              <div className="flex justify-between items-center">
                <Icon className={`h-4.5 w-4.5 shrink-0 ${color}`} />
              </div>
              <div className="mt-4">
                <p className="text-lg xs:text-xl sm:text-2xl font-black truncate leading-none text-zinc-900 dark:text-zinc-100" title={value}>{value}</p>
                <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-550 truncate">{label}</p>
              </div>
            </div>
          ))}

          {/* Academic progress bar summary */}
          <div className="col-span-3 rounded-3xl border border-indigo-500/10 bg-indigo-50/10 dark:bg-indigo-950/5 p-5 shadow-3xs flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Degree Progress</p>
            <div className="mt-3.5 space-y-3">
              {[
                ["Active Courses", `${uniqueCurrentCourses.size || currentCourses.length} active classes`, "bg-indigo-500"],
                ["Completed", `${degreeCompletePercent.toFixed(0)}% credits requirement completed`, "bg-emerald-500"],
                ["CGPA Goal", savedGoal ? `${savedGoal.target.toFixed(2)} target value set` : "Set CGPA prediction goal", "bg-purple-500"],
              ].map(([label, value, dot]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 leading-none mb-0.5">{label}</p>
                    <p className="truncate text-xs font-bold text-zinc-700 dark:text-zinc-200 leading-none">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Tools Section (Grids are perfectly balanced sm:2, lg:4 to avoid orphaned cards) */}
      <section className="mt-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-outfit text-xl font-black text-zinc-900 dark:text-zinc-100">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.slice(1, 5).map((card) => {
            const summaries = toolSummaries[card.id] || ["Open tool", "View details"];
            return (
              <button
                key={card.id}
                onClick={() => { setActiveSubTab(card.id); window.scrollTo(0, 0); }}
                className={`group rounded-3xl border p-5 text-left shadow-2xs hover:shadow-xs transition-all duration-300 active:scale-[0.99] cursor-pointer flex flex-col justify-between h-full bg-white dark:bg-black/40 ${card.bg}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-3xs dark:bg-zinc-900 ${card.color}`}>
                      <card.icon className="h-5 w-5 stroke-[2]" />
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 opacity-60 group-hover:opacity-100 transition-transform group-hover:translate-x-0.5">
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-sm font-black text-zinc-800 dark:text-zinc-100">{card.title}</h3>
                  <p className="mt-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 leading-relaxed">{card.description}</p>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap gap-1">
                    {summaries.map((item) => (
                      <span key={item} className="rounded-lg border border-zinc-200/50 bg-white/80 px-2 py-0.5 text-[9px] font-bold text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-400">{item}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Supporting Tools Section (Grids are perfectly balanced sm:2, lg:3 for symmetric grid rows) */}
      <section className="mt-2">
        <h2 className="mb-4 font-outfit text-xl font-black text-zinc-900 dark:text-zinc-100">Academic Utilities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.slice(5).map((card) => (
            <button
              key={card.id}
              onClick={() => { setActiveSubTab(card.id); window.scrollTo(0, 0); }}
              className={`group flex items-center gap-3.5 rounded-2xl border border-zinc-200/50 bg-white/70 p-4 text-left shadow-2xs hover:shadow-xs transition-all duration-300 active:scale-[0.99] dark:border-zinc-850 dark:bg-zinc-950/20 ${card.bg}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-3xs dark:bg-zinc-900 ${card.color}`}>
                <card.icon className="h-4.5 w-4.5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-zinc-800 dark:text-zinc-100 group-hover:text-indigo-500 transition-colors">{card.title}</p>
                <p className="truncate text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">{card.description}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-350 opacity-40 group-hover:opacity-100 transition-transform group-hover:translate-x-0.5 shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Chart Section */}
      <section className="mt-2">
        {hideMobileHeader && (
          <Card className="bg-white dark:bg-black border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl shadow-2xs mb-6">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-black uppercase text-zinc-800 dark:text-zinc-100 tracking-wider">Overall<br/>Performance</h2>
                <div className="relative w-16 h-16 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Complete", value: degreeCompletePercent },
                          { name: "Incomplete", value: 100 - degreeCompletePercent }
                        ]}
                        innerRadius="75%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#334155" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">{degreeCompletePercent.toFixed(0)}%</span>
                    <span className="text-[8px] text-zinc-400 dark:text-zinc-550 font-black uppercase leading-none mt-0.5">Earned</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-black text-emerald-500 tracking-tight">{currentCgpa.toFixed(2)}</span>
                  <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 mb-1">/ 10.00</span>
                </div>
                <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Cumulative GPA</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div 
                  className="border-t border-zinc-200/50 dark:border-zinc-800/80 pt-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 rounded-b-xl transition-colors p-2 -mx-2 -mb-2"
                  onClick={() => setIsModalOpen(true)}
                >
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Credits Earned</p>
                  <p className="text-xs font-black text-zinc-700 dark:text-zinc-200">{creditsEarned.toFixed(1)} / {requiredCredits.toFixed(1)}</p>
                </div>
                <div className="border-t border-zinc-200/50 dark:border-zinc-800/80 pt-3 p-2 -mx-2 -mb-2 flex justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Total Classes</p>
                    <p className="text-xs font-black text-zinc-700 dark:text-zinc-200">{totalCourses}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Pass Rate</p>
                    <p className="text-xs font-black text-emerald-500">{passRate}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <Card className="h-full rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80">
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-4 font-outfit">Grade Distribution</h3>
              <div className="w-full h-[230px]">
                {gradeDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeDistributionData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '0.75rem', color: '#f4f4f5' }}
                        itemStyle={{ color: '#6366f1' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {gradeDistributionData.map((entry, index) => {
                          const colors: Record<string, string> = {
                            S: '#10b981', A: '#6366f1', B: '#8b5cf6', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#991b1b', N: '#4b5563'
                          };
                          return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#888888'} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xs text-zinc-400 dark:text-zinc-550">No past grade records available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-full rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80">
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-4 font-outfit">Semester Performance</h3>
              <div className="space-y-2.5 max-h-[230px] overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
                {Object.entries(data?.grades || {})
                  .filter(([sem, details]: any) => details && details.gpa)
                  .map(([sem, details]: any) => {
                    const gpa = Number(details.gpa).toFixed(2);
                    const courseCount = details.grades?.length || 0;
                    const effectiveGrades = Array.isArray(gradesData?.effectiveGrades) ? gradesData.effectiveGrades : [];
                    const semCredits = details.grades?.reduce((acc: number, curr: any) => {
                      let credits = parseFloat(curr.creditsEarned) || parseFloat(curr.credits);
                      if (!credits) {
                        const matched = effectiveGrades.find(eg => (eg.basketTitle || "").toLowerCase() === (curr.courseTitle || "").toLowerCase() || eg.courseCode === curr.courseCode);
                        credits = matched ? parseFloat(matched.creditsEarned) : 0;
                      }
                      return acc + (credits || 0);
                    }, 0) || 0;
                    
                    let semName = sem;
                    if (sem.length >= 8 && sem.includes("20")) {
                      const yearMatch = sem.match(/20\d{4}/);
                      if (yearMatch) {
                        const startYear = yearMatch[0].slice(0, 4);
                        const endYear = "20" + yearMatch[0].slice(4, 6);
                        let term = "Semester";
                        if (sem.endsWith("1") || sem.endsWith("01")) term = "Fall";
                        else if (sem.endsWith("5") || sem.endsWith("05")) term = "Winter";
                        else if (sem.endsWith("9") || sem.endsWith("09")) term = "Summer";
                        semName = `${term} Sem ${startYear}-${endYear}`;
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
                        semName = `${term} Sem ${startYear}-${endYear}`;
                      }
                    }
                    
                    return (
                      <div key={sem} className="flex justify-between items-center p-3 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-950/20">
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">{semName}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
                            {courseCount} courses · {semCredits > 0 ? `${semCredits.toFixed(1)} credits` : 'N/A credits'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-500/10 dark:bg-indigo-950/20">
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">{gpa}</span>
                          <span className="text-[8px] text-indigo-400 font-black uppercase tracking-wider">GPA</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {isModalOpen && (
        <GradesModal allGradesData={data} GradesData={gradesData} marksData={marksData} attendance={attendance} onClose={() => setIsModalOpen(false)} handleFetchGrades={handleFetchGrades} />
      )}
    </div>
  );
}
