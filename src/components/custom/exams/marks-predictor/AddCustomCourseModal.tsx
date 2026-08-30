"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { CustomCourseMock } from "@/lib/marksPredictorStorage";

interface AddCustomCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCourse: (course: CustomCourseMock) => void;
}

export default function AddCustomCourseModal({
  isOpen,
  onClose,
  onAddCourse,
}: AddCustomCourseModalProps) {
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseType, setCourseType] = useState<CustomCourseMock["courseType"]>("Theory Only");
  const [theoryCredits, setTheoryCredits] = useState<number>(3);
  const [labCredits, setLabCredits] = useState<number>(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim()) return;

    const cleanedCode = courseCode.trim().toUpperCase();
    const cleanedTitle = courseTitle.trim() || `Course ${cleanedCode}`;

    onAddCourse({
      courseCode: cleanedCode,
      courseTitle: cleanedTitle,
      courseType,
      theoryCredits: courseType.includes("Lab") ? 0 : theoryCredits,
      labCredits: courseType.includes("Theory") && !courseType.includes("Embedded") ? 0 : labCredits,
      isCustom: true,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[22px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xl space-y-4 overscroll-contain">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white font-outfit">
              Add Custom Subject
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Course Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BCSE302L"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="mt-1 w-full px-3.5 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Course Title
            </label>
            <input
              type="text"
              placeholder="e.g. Database Systems"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              className="mt-1 w-full px-3.5 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Course Structure
            </label>
            <select
              value={courseType}
              onChange={(e) => setCourseType(e.target.value as any)}
              className="mt-1 w-full px-3.5 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Theory Only">Theory Only</option>
              <option value="Lab Only">Lab Only</option>
              <option value="Embedded Theory">Embedded Theory + Lab</option>
              <option value="Project">Project / J-Component</option>
              <option value="Soft Skill">Soft Skill / STS</option>
            </select>
          </div>

          {courseType === "Embedded Theory" && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
              <div>
                <label className="text-[11px] font-bold text-zinc-400">Theory Credits</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={theoryCredits}
                  onChange={(e) => setTheoryCredits(parseInt(e.target.value) || 3)}
                  className="mt-1 w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-center text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-400">Lab Credits</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={labCredits}
                  onChange={(e) => setLabCredits(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-center text-zinc-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-black transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
            >
              Add Subject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
