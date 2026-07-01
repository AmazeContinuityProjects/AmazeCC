"use client";

import React, { useState, useEffect } from "react";
import { History, BookOpen, TrendingUp, Database, ChevronRight, Trophy, AlertTriangle, GraduationCap, FileCode, BookMarked, ScrollText, UserCheck, LayoutDashboard, Award, Percent } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
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
      bg: "bg-info",
      prominent: true,
    },
    {
      id: "grades",
      title: "Grade History",
      description: "Analyze your academic performance and past grades.",
      icon: History,
      color: "text-purple-600  dark:text-purple-400",
      bg: "bg-purple-100  dark:bg-purple-900/20",
    },
    {
      id: "curriculum",
      title: "Curriculum",
      description: "Track your completed courses and credit requirements.",
      icon: BookOpen,
      color: "text-green-600  dark:text-green-400",
      bg: "bg-green-100  dark:bg-green-900/20",
    },
    {
      id: "predictor",
      title: "CGPA Predictor",
      description: "Estimate your future CGPA based on expected grades.",
      icon: TrendingUp,
      color: "text-orange-600  dark:text-orange-400",
      bg: "bg-orange-100  dark:bg-orange-900/20",
    },
    {
      id: "qbank",
      title: "Question Bank",
      description: "Access and search past year question papers.",
      icon: Database,
      color: "text-red-600  dark:text-red-400",
      bg: "bg-red-100  dark:bg-red-900/20",
    },
    {
      id: "arrear",
      title: "Arrear Management",
      description: "View arrear schedule, details and grades.",
      icon: AlertTriangle,
      color: "text-amber-600  dark:text-amber-400",
      bg: "bg-amber-100  dark:bg-amber-900/20",
    },
    {
      id: "makeup-compre",
      title: "Makeup & Compre",
      description: "Makeup exam eligibility, schedule and compre info.",
      icon: GraduationCap,
      color: "text-cyan-600  dark:text-cyan-400",
      bg: "bg-cyan-100  dark:bg-cyan-900/20",
    },
    {
      id: "course-mgmt",
      title: "Course Management",
      description: "Course options, extracurriculars, minor/honour courses.",
      icon: ScrollText,
      color: "text-info",
      bg: "bg-info-surface",
    },
    {
      id: "projects",
      title: "Projects",
      description: "View your projects and project courses.",
      icon: FileCode,
      color: "text-rose-600  dark:text-rose-400",
      bg: "bg-rose-100  dark:bg-rose-900/20",
    },
    {
      id: "wishlist",
      title: "Wishlist & Learning",
      description: "Wishlist, registration and additional learning courses.",
      icon: BookMarked,
      color: "text-teal-600  dark:text-teal-400",
      bg: "bg-teal-100  dark:bg-teal-900/20",
    },
    {
      id: "faculty-info",
      title: "Faculty Info",
      description: "Search and view faculty contact details.",
      icon: UserCheck,
      color: "text-info",
      bg: "bg-info-surface",
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-20 animate-fadeIn">
      <PageHeader
        icon={<GraduationCap className="w-5 h-5 text-info" />}
        title="Academics Hub"
        meta={<Badge variant="default" className="rounded-xl border border-gray-200 font-semibold  dark:border-gray-800">Student OS</Badge>}
        actions={
          <button
            onClick={() => setActiveSubTab("course-dashboard")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info hover:bg-info text-white font-extrabold transition-colors shadow-sm text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <LayoutDashboard size={16} /> Courses
          </button>
        }
      />

      {savedGoal && (
        <div className="rounded-2xl border border-info/20 bg-info-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-info dark:bg-black/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-info">Active Goal</p>
              <p className="truncate text-lg font-black text-gray-900 dark:text-gray-100">{savedGoal.target.toFixed(2)} CGPA <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">requires {savedGoal.requiredSgpa.toFixed(2)} SGPA</span></p>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <button
          onClick={() => { setActiveSubTab("course-dashboard"); window.scrollTo(0, 0); }}
          className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50   dark:hover:bg-gray-800/70 dark:border-gray-800 dark:bg-black"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-info">Current Semester</p>
              <h2 className="mt-2 font-[family-name:var(--font-outfit)] text-3xl font-black text-gray-950 dark:text-gray-50">Course Dashboard</h2>
              <p className="mt-2 max-w-xl text-sm font-medium text-gray-500 dark:text-gray-400">Marks, attendance, predictions and assessment progress in one place.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-info" />
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {toolSummaries["course-dashboard"].map((item) => (
              <div key={item} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-2.5 sm:p-3 dark:border-gray-800 dark:bg-gray-950/30 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-gray-950 dark:text-gray-100 truncate" title={item}>{item}</p>
              </div>
            ))}
          </div>
        </button>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ["CGPA", currentCgpa.toFixed(2), Award, "text-emerald-600 dark:text-emerald-400"],
            ["Attendance", avgAttendance ? `${avgAttendance}%` : "-", Percent, "text-info"],
            ["Credits", `${creditsEarned.toFixed(0)}/${requiredCredits.toFixed(0)}`, GraduationCap, "text-purple-600 dark:text-purple-400"],
          ].map(([label, value, Icon, color]: any) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-2.5 sm:p-4 shadow-sm dark:border-gray-800 dark:bg-black flex flex-col justify-between min-w-0">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <p className={`mt-2 text-sm sm:text-2xl font-black truncate leading-none ${color}`} title={value}>{value}</p>
              <p className="mt-1.5 text-[9px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">{label}</p>
            </div>
          ))}
          <div className="col-span-3 rounded-2xl border border-info/20 bg-info-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-info">Academic Flow</p>
            <div className="mt-4 space-y-3">
              {[
                ["Current", `${uniqueCurrentCourses.size || currentCourses.length} active courses`, "bg-info"],
                ["Progress", `${degreeCompletePercent.toFixed(0)}% degree complete`, "bg-emerald-500"],
                ["Next", savedGoal ? `${savedGoal.target.toFixed(2)} CGPA goal` : "Set CGPA target", "bg-purple-500"],
              ].map(([label, value, dot]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-outfit)] text-xl font-black text-gray-900 dark:text-gray-100">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cards.slice(1, 5).map((card) => {
            const summaries = toolSummaries[card.id] || ["Open tool", "View details"];
            return (
              <button
                key={card.id}
                onClick={() => { setActiveSubTab(card.id); window.scrollTo(0, 0); }}
                className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50  dark:hover:bg-gray-800/70 dark:bg-black ${
                  card.id === "qbank"
                    ? "border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20"
                    : card.id === "predictor"
                      ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
                      : "border-gray-200  dark:border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.bg} ${card.color}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-info" />
                </div>
                <h3 className="mt-4 text-sm font-black text-gray-900 dark:text-gray-100">{card.title}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {summaries.map((item) => (
                    <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">{item}</span>
                  ))}
                </div>
                <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-info">Open <ChevronRight className="h-3 w-3" /></p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-outfit)] text-xl font-black text-gray-900 dark:text-gray-100">Academic Tools</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cards.slice(5).map((card) => (
            <button
              key={card.id}
              onClick={() => { setActiveSubTab(card.id); window.scrollTo(0, 0); }}
              className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50   dark:hover:bg-gray-800/70 dark:border-gray-800 dark:bg-black"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${card.bg} ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{card.title}</p>
                <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{card.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        {hideMobileHeader && (
            <Card className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm mb-8">
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold uppercase text-gray-800  dark:text-gray-100 tracking-wide">Overall<br/>Performance</h2>
                <div className="relative w-16 h-16 flex items-center justify-center">
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
                            <Cell fill="#4ade80" />
                            <Cell fill="#334155" />
                        </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-gray-900  dark:text-gray-100">{degreeCompletePercent.toFixed(0)}%</span>
                        <span className="text-[8px] text-gray-500 uppercase leading-none">Complete</span>
                    </div>
                </div>
                </div>
                
                <div>
                    <div className="flex items-end gap-2">
                    <span className="text-5xl font-black text-green-500">{currentCgpa.toFixed(2)}</span>
                    <span className="text-lg font-medium text-gray-500 mb-1">/ 10.00</span>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Cumulative GPA</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div 
                    className="border-t border-gray-200 dark:border-gray-800 pt-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 dark:hover:bg-gray-900/50 rounded-b-lg transition-colors p-2 -mx-2 -mb-2"
                    onClick={() => setIsModalOpen(true)}
                    >
                        <p className="text-xs text-gray-500 mb-1">Credits Earned</p>
                        <p className="text-sm font-bold text-gray-900  dark:text-gray-100">{creditsEarned.toFixed(1)} / {requiredCredits.toFixed(1)}</p>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-3 p-2 -mx-2 -mb-2 flex justify-between">
                        <div>
                        <p className="text-xs text-gray-500 mb-1">Total Courses</p>
                        <p className="text-sm font-bold text-gray-900  dark:text-gray-100">{totalCourses}</p>
                        </div>
                        <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Pass Rate</p>
                        <p className="text-sm font-bold text-gray-900  dark:text-gray-100">{passRate}%</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card className="h-full">
            <CardContent className="p-5 h-full flex flex-col">
                <h3 className="text-md font-medium text-gray-800  dark:text-gray-100 mb-6">Grade Distribution</h3>
                <div className="w-full flex-1 min-h-[200px]">
                    {gradeDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gradeDistributionData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem', color: '#f3f4f6' }}
                            itemStyle={{ color: '#60a5fa' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {gradeDistributionData.map((entry, index) => {
                            const colors: Record<string, string> = {
                                S: '#22c55e', A: '#3b82f6', B: '#8b5cf6', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#991b1b', N: '#4b5563'
                            };
                            return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#888888'} />
                            })}
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    ) : (
                    <div className="flex items-center justify-center w-full h-full text-sm text-gray-500">No grades data</div>
                    )}
                </div>
            </CardContent>
            </Card>

            <Card className="h-full">
            <CardContent className="p-5 h-full overflow-y-auto max-h-[265px] hide-scrollbar">
                <h3 className="text-md font-medium text-gray-800  dark:text-gray-100 mb-4 sticky top-0 bg-transparent pb-2 ">Semester Performance</h3>
                <div className="space-y-3">
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
                            semName = `${term} Semester ${startYear}-${endYear}`;
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
                            semName = `${term} Semester ${startYear}-${endYear}`;
                        }
                        }
                        
                        return (
                        <div key={sem} className="flex justify-between items-center p-3 rounded-xl border border-gray-100  dark:border-gray-800/60 bg-gray-50/50  dark:bg-gray-900/50">
                            <div>
                            <p className="font-semibold text-gray-900  dark:text-gray-100 text-sm">{semName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{courseCount} courses · {semCredits > 0 ? `${semCredits.toFixed(1)} credits` : 'N/A credits'}</p>
                            </div>
                            <div className="flex flex-col items-center bg-info-surface px-3 py-1.5 rounded-lg border border-info/20">
                            <span className="font-bold text-info text-sm">{gpa}</span>
                            <span className="text-[10px] text-info font-medium">GPA</span>
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
