"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, Calculator, Save, AlertCircle, ArrowRight, Trophy, Trash2 } from "lucide-react";
import SubpageLayout from "../shared/SubpageLayout";

const GRADE_POINTS: Record<string, number> = {
  "S": 10, "A": 9, "B": 8, "C": 7, "D": 6, "E": 5, "F": 0, "N": 0
};

export default function GPAPredictorTab({ marksData, attendance, setActiveSubTab }) {
  const currentCgpa = Number(marksData?.cgpa?.cgpa || 0);
  const creditsEarned = Number(marksData?.cgpa?.creditsEarned || 0);
  
  // Parse and group current courses
  const [currentCourses, setCurrentCourses] = useState<any[]>([]);
  const [courseGrades, setCourseGrades] = useState<Record<string, string>>({});
  
  // Target GPA State
  const [targetCgpa, setTargetCgpa] = useState<string>("");
  const [savedGoal, setSavedGoal] = useState<{ target: number, requiredSgpa: number } | null>(null);

  useEffect(() => {
    if (Array.isArray(attendance)) {
      const grouped: Record<string, any> = {};
      
      attendance.forEach(course => {
        // Remove (T) or (L) from embedded courses to group them
        const baseCode = course.courseCode.replace(/\(T\)|\(L\)/g, "").trim();
        const credits = parseFloat(course.credits) || 0;
        
        if (credits === 0) return;

        if (grouped[baseCode]) {
          grouped[baseCode].credits += credits;
          grouped[baseCode].originalCodes.push(course.courseCode);
        } else {
          grouped[baseCode] = {
            baseCode,
            courseTitle: course.courseTitle,
            credits,
            originalCodes: [course.courseCode]
          };
        }
      });
      
      const coursesArr = Object.values(grouped).sort((a, b) => a.baseCode.localeCompare(b.baseCode));
      setCurrentCourses(coursesArr);
      
      // Initialize grades to 'A' as a default optimistic prediction
      const initialGrades: Record<string, string> = {};
      coursesArr.forEach(c => initialGrades[c.baseCode] = "A");
      setCourseGrades(initialGrades);
    }
    
    // Load saved goal
    const saved = localStorage.getItem("uni_cc_gpa_goal");
    if (saved) {
      try {
        setSavedGoal(JSON.parse(saved));
      } catch (e) {}
    }
  }, [attendance]);

  const currentSemesterCredits = currentCourses.reduce((sum, c) => sum + c.credits, 0);

  // Calculate Predicted GPA
  const predictedSgpa = currentCourses.length > 0 
    ? currentCourses.reduce((sum, c) => sum + (GRADE_POINTS[courseGrades[c.baseCode]] || 0) * c.credits, 0) / currentSemesterCredits
    : 0;

  const currentTotalPoints = currentCgpa * creditsEarned;
  const predictedTotalPoints = currentTotalPoints + (predictedSgpa * currentSemesterCredits);
  const predictedCgpa = (creditsEarned + currentSemesterCredits) > 0 
    ? predictedTotalPoints / (creditsEarned + currentSemesterCredits) 
    : currentCgpa;

  // Calculate Required SGPA for Target
  const targetCgpaNum = parseFloat(targetCgpa) || 0;
  let requiredSgpa = 0;
  let isTargetPossible = true;

  if (targetCgpaNum > 0 && currentSemesterCredits > 0) {
    const requiredTotalPoints = targetCgpaNum * (creditsEarned + currentSemesterCredits);
    const pointsNeeded = requiredTotalPoints - currentTotalPoints;
    requiredSgpa = pointsNeeded / currentSemesterCredits;
    
    if (requiredSgpa > 10) isTargetPossible = false;
  }

  const saveGoal = () => {
    if (targetCgpaNum > 0 && targetCgpaNum <= 10) {
      const goal = { target: targetCgpaNum, requiredSgpa };
      localStorage.setItem("uni_cc_gpa_goal", JSON.stringify(goal));
      setSavedGoal(goal);
    }
  };

  const clearGoal = () => {
    localStorage.removeItem("uni_cc_gpa_goal");
    setSavedGoal(null);
  };

  return (
    <SubpageLayout title="GPA Predictor" onBack={() => setActiveSubTab("overview")}>
      
      {savedGoal && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 border-none text-white shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Trophy className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Current Goal</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold">{savedGoal.target.toFixed(2)} CGPA</h3>
                </div>
                <p className="text-indigo-100 text-sm mt-1">
                  Requires <span className="font-bold text-white">{savedGoal.requiredSgpa.toFixed(2)} SGPA</span> this semester
                </p>
              </div>
            </div>
            <button 
              onClick={clearGoal}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear Goal"
            >
              <Trash2 className="w-5 h-5 text-indigo-200 hover:text-white" />
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6 min-w-0 w-full">
        
        {/* Left Col: Target Calculator */}
        <Card className="bg-white dark:bg-slate-900 midnight:bg-black shadow-sm min-w-0">
          <CardHeader className="pb-3 border-b dark:border-slate-800 midnight:border-gray-800 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg min-w-0">
              <Target className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="truncate">Target CGPA Calculator</span>
            </CardTitle>
            <CardDescription className="truncate">Find out what SGPA you need to hit your goal.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-6 min-w-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Current CGPA</p>
                <p className="text-xl font-bold">{currentCgpa.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Current Credits</p>
                <p className="text-xl font-bold">{creditsEarned}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target CGPA
              </label>
              <div className="flex gap-3 min-w-0 w-full">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={targetCgpa}
                  onChange={(e) => setTargetCgpa(e.target.value)}
                  placeholder="e.g. 9.00"
                  className="flex-1 min-w-0 px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 midnight:bg-black dark:border-slate-700 midnight:border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <button
                  onClick={saveGoal}
                  disabled={!targetCgpa || !isTargetPossible}
                  className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                  <Save className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Save</span>
                </button>
              </div>
            </div>

            {targetCgpaNum > 0 && (
              <div className={`p-4 rounded-xl border min-w-0 ${
                isTargetPossible 
                  ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" 
                  : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
              }`}>
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">Required SGPA</p>
                    <p className={`text-2xl font-bold truncate ${
                      isTargetPossible ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {isTargetPossible ? requiredSgpa.toFixed(2) : "Impossible"}
                    </p>
                  </div>
                  {!isTargetPossible && (
                    <span className="text-xs shrink-0 bg-red-100 text-red-800 px-2 py-1 rounded-md font-semibold">
                      &gt; 10.0
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Col: Current Courses Predictor */}
        <Card className="bg-white dark:bg-slate-900 midnight:bg-black shadow-sm min-w-0">
          <CardHeader className="pb-3 border-b dark:border-slate-800 midnight:border-gray-800 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg min-w-0">
              <Calculator className="w-5 h-5 text-purple-500 shrink-0" />
              <span className="truncate">GPA Predictor</span>
            </CardTitle>
            <CardDescription className="truncate">Estimate your GPA based on expected grades.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 min-w-0">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 midnight:bg-gray-900 rounded-xl mb-6 min-w-0 gap-2">
              <div className="text-center min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1 truncate">Predicted SGPA</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{predictedSgpa.toFixed(2)}</p>
              </div>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 shrink-0" />
              <div className="text-center min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1 truncate">New CGPA</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{predictedCgpa.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {currentCourses.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">No current courses found.</p>
              ) : (
                currentCourses.map(course => (
                  <div key={course.baseCode} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 midnight:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex-1 pr-4 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{course.baseCode}</p>
                      <p className="text-xs text-gray-500 truncate" title={course.courseTitle}>{course.courseTitle}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{course.credits} Credits</p>
                    </div>
                    <select
                      value={courseGrades[course.baseCode] || "A"}
                      onChange={(e) => setCourseGrades(prev => ({ ...prev, [course.baseCode]: e.target.value }))}
                      className="px-3 py-2 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 midnight:bg-black font-semibold text-center focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      {Object.keys(GRADE_POINTS).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </SubpageLayout>
  );
}
