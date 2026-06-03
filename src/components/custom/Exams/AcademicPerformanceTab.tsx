"use client";

import React, { useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCcw, Trophy } from "lucide-react";
import GradesModal from "./GradesModal";

export default function AcademicPerformanceTab({ data, marksData, attendance, handleFetchGrades }) {
  const currentCgpa = Number(marksData?.cgpa?.cgpa || 0);
  const creditsEarned = Number(marksData?.cgpa?.creditsEarned || 0);
  const creditsRegistered = Number(marksData?.cgpa?.creditsRegistered || 0);
  const totalRequiredCredits = 160; // Assuming 160 as standard if not provided
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedGoal, setSavedGoal] = useState<{ target: number, requiredSgpa: number } | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem("uni_cc_gpa_goal");
    if (saved) {
      try {
        setSavedGoal(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Try to find total credits from curriculum
  let rawCurriculum = [];
  if (Array.isArray(data?.curriculum) && data.curriculum.length > 0) rawCurriculum = data.curriculum;
  else if (Array.isArray(marksData?.curriculum) && marksData.curriculum.length > 0) rawCurriculum = marksData.curriculum;
  else if (Array.isArray(data?.cgpa?.curriculum) && data.cgpa.curriculum.length > 0) rawCurriculum = data.cgpa.curriculum;
  else if (Array.isArray(marksData?.cgpa?.curriculum) && marksData.cgpa.curriculum.length > 0) rawCurriculum = marksData.cgpa.curriculum;

  const curriculum = rawCurriculum;
  const totalCreditsObj = curriculum.find(c => (c?.basketTitle || "").toLowerCase().includes("total credits"));
  const requiredCredits = totalCreditsObj ? parseFloat(totalCreditsObj.creditsRequired) : totalRequiredCredits;
  const degreeCompletePercent = Math.min((creditsEarned / requiredCredits) * 100, 100);

  // Grade Distribution
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
    .filter(([grade]) => grade !== "N" && grade !== "F") // Adjust based on preference
    .map(([grade, count]) => ({
      name: grade,
      count: count
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, N: 8 };
      return (order[a.name] || 99) - (order[b.name] || 99);
    });

  // Calculate total courses and pass rate
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

  // Curriculum processing
  const specialBaskets = ["Extra curricular activities", "HSM Elective", "Foreign Language"];
  const CurriculumWithoutTotal = curriculum.filter(c => !(c?.basketTitle || "").toLowerCase().includes("total credits"));
  const normalCurriculum = CurriculumWithoutTotal.filter(c => !specialBaskets.some(b => (c?.basketTitle || "").toLowerCase().includes(b.toLowerCase())));
  const specialCurriculum = CurriculumWithoutTotal.filter(c => specialBaskets.some(b => (c?.basketTitle || "").toLowerCase().includes(b.toLowerCase())));

  // Current attendance to calculate in-progress
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const ongoingCreditsByCategory = safeAttendance.reduce<Record<string, number>>((acc, item) => {
    let category = item.category || "Uncategorized";
    const credits = parseFloat(item.credits) || 0;
    if (category === "Foundation Core - Humanities, Social Sciences and Management (LANGUAGE Basket)") {
      category = "Foreign Language";
    } else if (category === "Foundation Core - Humanities, Social Sciences and Management (GENERAL Basket)") {
      category = "HSM Elective";
    } else if (category === "Foundation Core - Humanities, Social Sciences and Management (EXTRA CURRICULAR Basket)") {
      category = "Extra curricular activities";
    }
    acc[category] = (acc[category] || 0) + credits;

    const hssm = "Foundation Core - Humanities, Social Sciences and Management";
    const ngcr = "Non-graded Core Requirement";

    if (category === "Foreign Language" || category === "HSM Elective") {
      acc[hssm] = (acc[hssm] || 0) + credits;
    }
    if (category === "Extra curricular activities") {
      acc[ngcr] = (acc[ngcr] || 0) + credits;
    }

    return acc;
  }, {});

  const renderProgressBar = (earnedRaw: number, inProgressRaw: number, requiredRaw: number) => {
    const earned = Number(earnedRaw) || 0;
    const inProgress = Number(inProgressRaw) || 0;
    const required = Number(requiredRaw) || 1; // prevent division by zero

    const isComplete = earned >= required;
    const effectiveTotal = isComplete ? earned : earned + inProgress;
    const progressEarned = Math.min((earned / required) * 100, 100);
    const progressWithOngoing = Math.min((effectiveTotal / required) * 100, 100);

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          <div className="flex flex-col items-start w-1/3">
             <span className="text-gray-500">Earned</span>
             <span className="text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm">{earned.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-center w-1/3">
             <span className="text-gray-500">In Progress</span>
             <span className="text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm">{inProgress.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-end w-1/3">
             <span className="text-gray-500">Required</span>
             <span className="text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm">{required.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="relative h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 midnight:bg-gray-800">
          {!isComplete && (
            <div className="absolute left-0 top-0 h-full bg-yellow-400/60" style={{ width: `${progressWithOngoing}%` }} />
          )}
          <div className={`absolute left-0 top-0 h-full ${isComplete ? "bg-green-500" : "bg-blue-600 dark:bg-blue-500 midnight:bg-blue-600"}`} style={{ width: `${progressEarned}%` }} />
        </div>
        <div className="flex justify-between items-center text-[11px] font-medium text-gray-500 mt-1">
          <span>{isComplete ? "Completed" : (inProgress > 0 ? "Ongoing" : "Not Started")}</span>
          <span>{progressWithOngoing.toFixed(0)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {savedGoal && (
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 border-none text-white shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">Active Goal</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{savedGoal.target.toFixed(2)} CGPA</span>
                <span className="text-sm text-blue-100 bg-white/10 px-2 py-0.5 rounded">
                  Requires {savedGoal.requiredSgpa.toFixed(2)} SGPA this semester
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Performance */}
      <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm">
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

      {/* Grade Distribution */}
      <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm">
        <CardContent className="p-5">
           <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 midnight:text-gray-100 mb-6">Grade Distribution</h3>
           <div className="w-full h-[200px]">
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

      {/* Semester Performance */}
      <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm">
        <CardContent className="p-5">
           <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 midnight:text-gray-100 mb-4">Semester Performance</h3>
           <div className="space-y-3">
             {Object.entries(data?.grades || {})
               .filter(([sem, details]: any) => details && details.gpa)
               .map(([sem, details]: any) => {
                 const gpa = Number(details.gpa).toFixed(2);
                 const courseCount = details.grades?.length || 0;
                 const semCredits = details.grades?.reduce((acc: number, curr: any) => acc + (parseFloat(curr.creditsEarned) || 0), 0) || 0;
                 
                 const semName = sem.endsWith("1") ? `Fall Semester 20${sem.slice(2,4)}-${sem.slice(4,6)}` : `Winter Semester 20${sem.slice(2,4)}-${sem.slice(4,6)}`;
                 
                 return (
                   <div key={sem} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 dark:border-gray-800 midnight:border-gray-800/60 bg-gray-50/50 dark:bg-slate-800/50 midnight:bg-gray-900/50">
                     <div>
                       <p className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{semName}</p>
                       <p className="text-xs text-gray-500 mt-1">{courseCount} courses · {semCredits > 0 ? `${semCredits.toFixed(1)} credits` : 'N/A credits'}</p>
                     </div>
                     <div className="flex flex-col items-center bg-indigo-500/10 dark:bg-indigo-900/30 midnight:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                       <span className="font-bold text-indigo-600 dark:text-indigo-300 midnight:text-indigo-300">{gpa}</span>
                       <span className="text-[10px] text-indigo-500 dark:text-indigo-400 midnight:text-indigo-400 font-medium">GPA</span>
                     </div>
                   </div>
                 );
               })}
           </div>
        </CardContent>
      </Card>




      {isModalOpen && (
        <GradesModal GradesData={data} CGPA={marksData?.cgpa} attendance={attendance} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
