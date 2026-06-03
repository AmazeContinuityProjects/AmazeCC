"use client";

import React, { useState } from "react";
import AcademicPerformanceTab from "./AcademicPerformanceTab";
import CurriculumPage from "./CurriculumPage";
import GPAPredictorTab from "./GPAPredictorTab";
import MarksHistoryTab from "./MarksHistoryTab";
import { RefreshCcw } from "lucide-react";

export default function TestGradesContainer({ data, marksData, gradesData, attendance, handleFetchGrades }) {
  const [view, setView] = useState("performance"); // 'performance' | 'history' | 'curriculum'

  if (!data || !marksData?.cgpa) {
    return (
      <div className="py-8">
        <p className="text-center text-gray-600 dark:text-gray-300 midnight:text-gray-400">
          No Grades Data Available.{" "}
        </p>
        <div className="flex justify-center mt-4">
          <button onClick={handleFetchGrades} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
            <RefreshCcw className="w-4 h-4" /> Load Grades Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        {/* Mobile View: Inline Center */}
        <h1 className="md:hidden text-xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Academic Overview <button onClick={handleFetchGrades} className="inline-flex ml-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors align-middle">
            <RefreshCcw className={`w-4 h-4`} />
          </button>
        </h1>
        
        {/* Desktop View: Left Aligned Heading + Right Aligned Button */}
        <div className="hidden md:flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Academic Overview
          </h1>
          <button onClick={handleFetchGrades} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
            <RefreshCcw className={`w-4 h-4`} /> <span className="text-sm">Reload</span>
          </button>
        </div>
        {/* View Toggle */}
        <div className="flex bg-gray-100 dark:bg-slate-800 midnight:bg-black rounded-lg p-1 w-full md:w-max">
          <button
            onClick={() => setView("performance")}
            className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              view === "performance"
                ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              view === "history"
                ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
            }`}
          >
            History
          </button>
          <button
            onClick={() => setView("curriculum")}
            className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              view === "curriculum"
                ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
            }`}
          >
            Curriculum
          </button>
          <button
            onClick={() => setView("predictor")}
            className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              view === "predictor"
                ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
            }`}
          >
            Predictor
          </button>
        </div>
      </div>

      <div className="mt-4">
        {view === "performance" ? (
          <AcademicPerformanceTab 
             data={data} 
             marksData={marksData} 
             attendance={attendance} 
             handleFetchGrades={handleFetchGrades} 
          />
        ) : view === "curriculum" ? (
          <CurriculumPage
            gradesData={gradesData}
            marksData={marksData}
            attendance={attendance}
            handleFetchGrades={handleFetchGrades}
          />
        ) : view === "predictor" ? (
          <GPAPredictorTab
            marksData={marksData}
            attendance={attendance}
          />
        ) : (
          <MarksHistoryTab data={data} />
        )}
      </div>
    </div>
  );
}
