"use client";

import React, { useState, useEffect } from "react";
import { History, BookOpen, TrendingUp, Database, ChevronRight, Trophy, AlertTriangle, GraduationCap, FileCode, BookMarked, ScrollText, UserCheck, LayoutDashboard } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import GradesModal from "./GradesModal";

export default function AcademicsHub({ setActiveSubTab, data, marksData, gradesData, attendance, hideMobileHeader, handleFetchGrades }) {
  const cards = [
    {
      id: "course-dashboard",
      title: "Course Hub",
      description: "Your one-stop hub — courses, grades, arrears, projects and more.",
      icon: LayoutDashboard,
      color: "text-white",
      bg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      prominent: true,
    },
    {
      id: "grades",
      title: "Grade History",
      description: "Analyze your academic performance and past grades.",
      icon: History,
      color: "text-purple-600 dark:text-purple-400 midnight:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30 midnight:bg-purple-900/20",
    },
    {
      id: "curriculum",
      title: "Curriculum",
      description: "Track your completed courses and credit requirements.",
      icon: BookOpen,
      color: "text-green-600 dark:text-green-400 midnight:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30 midnight:bg-green-900/20",
    },
    {
      id: "predictor",
      title: "CGPA Predictor",
      description: "Estimate your future CGPA based on expected grades.",
      icon: TrendingUp,
      color: "text-orange-600 dark:text-orange-400 midnight:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30 midnight:bg-orange-900/20",
    },
    {
      id: "qbank",
      title: "Question Bank",
      description: "Access and search past year question papers.",
      icon: Database,
      color: "text-red-600 dark:text-red-400 midnight:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30 midnight:bg-red-900/20",
    },
    {
      id: "arrear",
      title: "Arrear Management",
      description: "View arrear schedule, details and grades.",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400 midnight:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30 midnight:bg-amber-900/20",
    },
    {
      id: "makeup-compre",
      title: "Makeup & Compre",
      description: "Makeup exam eligibility, schedule and compre info.",
      icon: GraduationCap,
      color: "text-cyan-600 dark:text-cyan-400 midnight:text-cyan-400",
      bg: "bg-cyan-100 dark:bg-cyan-900/30 midnight:bg-cyan-900/20",
    },
    {
      id: "course-mgmt",
      title: "Course Management",
      description: "Course options, extracurriculars, minor/honour courses.",
      icon: ScrollText,
      color: "text-indigo-600 dark:text-indigo-400 midnight:text-indigo-400",
      bg: "bg-indigo-100 dark:bg-indigo-900/30 midnight:bg-indigo-900/20",
    },
    {
      id: "projects",
      title: "Projects",
      description: "View your projects and project courses.",
      icon: FileCode,
      color: "text-rose-600 dark:text-rose-400 midnight:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-900/30 midnight:bg-rose-900/20",
    },
    {
      id: "wishlist",
      title: "Wishlist & Learning",
      description: "Wishlist, registration and additional learning courses.",
      icon: BookMarked,
      color: "text-teal-600 dark:text-teal-400 midnight:text-teal-400",
      bg: "bg-teal-100 dark:bg-teal-900/30 midnight:bg-teal-900/20",
    },
    {
      id: "faculty-info",
      title: "Faculty Info",
      description: "Search and view faculty contact details.",
      icon: UserCheck,
      color: "text-sky-600 dark:text-sky-400 midnight:text-sky-400",
      bg: "bg-sky-100 dark:bg-sky-900/30 midnight:bg-sky-900/20",
    },
    {
      id: "qcm-view",
      title: "QCM View",
      description: "Quality Circle Meeting records and feedback.",
      icon: ScrollText,
      color: "text-violet-600 dark:text-violet-400 midnight:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-900/30 midnight:bg-violet-900/20",
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

  return (
    <div className="py-4 animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">
          Academics Hub
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-1">
          Everything you need to manage your academic journey.
        </p>
      </div>

      {savedGoal && (
        <div className="mb-8">
            <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 border-none text-white shadow-sm">
            <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                <Trophy className="w-5 h-5 text-yellow-300" />
                </div>
                <div className="w-full">
                <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Active Goal</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <span className="text-2xl font-bold">{savedGoal.target.toFixed(2)} CGPA</span>
                    <span className="text-xs sm:text-sm text-blue-100 bg-white/20 px-2.5 py-1 rounded-md font-medium w-fit">
                    Requires {savedGoal.requiredSgpa.toFixed(2)} SGPA this semester
                    </span>
                </div>
                </div>
            </CardContent>
            </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => {
                setActiveSubTab(card.id);
                window.scrollTo(0, 0);
            }}
            className={`flex items-center p-4 glass-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300 cursor-pointer group ${card.prominent ? 'md:col-span-2 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10 midnight:from-blue-500/[0.08] midnight:to-indigo-500/[0.08] border-blue-200/50 dark:border-blue-800/50 midnight:border-blue-800/40 hover:border-blue-400 dark:hover:border-blue-500 midnight:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10' : ''}`}
          >
            <div className={`p-3 rounded-xl ${card.bg} ${card.color} mr-4 group-hover:scale-110 transition-transform ${card.prominent ? 'shadow-lg shadow-blue-500/25' : ''}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold transition-colors ${card.prominent ? 'text-blue-700 dark:text-blue-300 midnight:text-blue-300' : 'text-gray-900 dark:text-gray-100 midnight:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                {card.title}
              </h3>
              <p className={`text-sm mt-0.5 ${card.prominent ? 'text-blue-600/70 dark:text-blue-400/70 midnight:text-blue-400/70' : 'text-gray-500 dark:text-gray-400 midnight:text-gray-500'}`}>
                {card.description}
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 transition-colors ${card.prominent ? 'text-blue-400 group-hover:text-blue-600' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 midnight:group-hover:text-gray-400'}`} />
          </div>
        ))}
      </div>

      <div>
        {hideMobileHeader && (
            <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm mb-8">
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold uppercase text-gray-800 dark:text-gray-100 midnight:text-gray-100 tracking-wide">Overall<br/>Performance</h2>
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
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{degreeCompletePercent.toFixed(0)}%</span>
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
                    className="border-t border-gray-200 dark:border-gray-800 pt-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 midnight:hover:bg-gray-900/50 rounded-b-lg transition-colors p-2 -mx-2 -mb-2"
                    onClick={() => setIsModalOpen(true)}
                    >
                        <p className="text-xs text-gray-500 mb-1">Credits Earned</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{creditsEarned.toFixed(1)} / {requiredCredits.toFixed(1)}</p>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-3 p-2 -mx-2 -mb-2 flex justify-between">
                        <div>
                        <p className="text-xs text-gray-500 mb-1">Total Courses</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{totalCourses}</p>
                        </div>
                        <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Pass Rate</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{passRate}%</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card className="h-full">
            <CardContent className="p-5 h-full flex flex-col">
                <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 midnight:text-gray-100 mb-6">Grade Distribution</h3>
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
                <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 midnight:text-gray-100 mb-4 sticky top-0 bg-transparent pb-2 backdrop-blur-md">Semester Performance</h3>
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
                        <div key={sem} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 dark:border-gray-800 midnight:border-gray-800/60 bg-gray-50/50 dark:bg-slate-800/50 midnight:bg-gray-900/50">
                            <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm">{semName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{courseCount} courses · {semCredits > 0 ? `${semCredits.toFixed(1)} credits` : 'N/A credits'}</p>
                            </div>
                            <div className="flex flex-col items-center bg-indigo-500/10 dark:bg-indigo-900/30 midnight:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                            <span className="font-bold text-indigo-600 dark:text-indigo-300 midnight:text-indigo-300 text-sm">{gpa}</span>
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 midnight:text-indigo-400 font-medium">GPA</span>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </CardContent>
            </Card>
        </div>
      </div>

      {isModalOpen && (
        <GradesModal allGradesData={data} GradesData={gradesData} marksData={marksData} attendance={attendance} onClose={() => setIsModalOpen(false)} handleFetchGrades={handleFetchGrades} />
      )}
    </div>
  );
}
