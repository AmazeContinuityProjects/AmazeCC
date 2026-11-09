"use client";

import type React from "react";
import type { CourseStrategy } from "@/components/custom/exams/FFCS/components/FFCSGuidedSelector";
import { Lock, Check, BookOpen, Compass } from "lucide-react";

/** Extracted from FFCSGuidedSelector's `renderSetupStrategyCard`; markup unchanged. */
export interface SetupStrategyCardProps {
  isLandscape?: boolean;
  setCourseStrategy: (value: React.SetStateAction<CourseStrategy>) => void;
  courseStrategy: "lock_advance" | "one_by_one";
  planMode: "auto" | "custom";
}

export default function SetupStrategyCard({
  isLandscape = false,
  setCourseStrategy,
  courseStrategy,
  planMode,
}: SetupStrategyCardProps) {
  return (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-center ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="space-y-3">
        {/* Option 1: Lock Target Courses */}
        <button
          type="button"
          onClick={() => setCourseStrategy("lock_advance")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            courseStrategy === "lock_advance"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              courseStrategy === "lock_advance"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Lock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                🔒 Mandatory Locks
              </span>
              {courseStrategy === "lock_advance" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Lock Target Courses in Advance</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {planMode === "auto"
                ? "Pre-lock mandatory core courses and optionally restrict allowed slot clusters (like A1, B1) or preferred faculty before generating combinations."
                : "Pick mandatory core courses and lock preferred faculty or slot groups in advance before scheduling the rest."}
            </p>
          </div>
        </button>

        {/* Option 2: Choose courses normally / manual adder */}
        <button
          type="button"
          onClick={() => setCourseStrategy("one_by_one")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            courseStrategy === "one_by_one"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              courseStrategy === "one_by_one"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            {planMode === "auto" ? <BookOpen className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                {planMode === "auto" ? "⚡ Unconstrained Catalog" : "🧭 Manual Course Selector"}
              </span>
              {courseStrategy === "one_by_one" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">
              {planMode === "auto" ? "Normally Add Courses in List" : "Choose Courses One by One"}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {planMode === "auto"
                ? "Select target courses normally from the course list without locking slot or faculty constraints, giving the solver full flexibility."
                : "Directly enter the manual course selector and pick slot offerings dynamically as you build."}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
