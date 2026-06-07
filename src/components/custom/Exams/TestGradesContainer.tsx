"use client";

import React from "react";
import MarksHistoryTab from "./MarksHistoryTab";
import { RefreshCcw, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TestGradesContainer({ data, marksData, gradesData, attendance, handleFetchGrades, setActiveSubTab }) {
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
    <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        {/* Mobile View: Inline Center */}
        <div className="md:hidden flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setActiveSubTab("overview")} className="rounded-full bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-100">
                    <ChevronLeft size={20} />
                </Button>
                <h1 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                    Grade History
                </h1>
            </div>
            <button onClick={handleFetchGrades} className="inline-flex px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors align-middle">
                <RefreshCcw className={`w-4 h-4`} />
            </button>
        </div>
        
        {/* Desktop View: Left Aligned Heading + Right Aligned Button */}
        <div className="hidden md:flex items-center gap-4 w-full justify-between">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setActiveSubTab("overview")} className="rounded-full bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-100">
                    <ChevronLeft size={20} />
                </Button>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                    Grade History
                </h1>
            </div>
            <button onClick={handleFetchGrades} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
                <RefreshCcw className={`w-4 h-4`} /> <span className="text-sm">Reload</span>
            </button>
        </div>
      </div>

      <div className="mt-4">
        <MarksHistoryTab data={data} />
      </div>
    </div>
  );
}
