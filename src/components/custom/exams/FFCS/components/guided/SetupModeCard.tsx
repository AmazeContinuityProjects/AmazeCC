"use client";

import type React from "react";
import type { PlanMode } from "@/components/custom/exams/FFCS/components/FFCSGuidedSelector";
import { Wand2, Check, Compass } from "lucide-react";

/** Extracted from FFCSGuidedSelector's `renderSetupModeCard`; markup unchanged. */
export interface SetupModeCardProps {
  isLandscape?: boolean;
  setPlanMode: (value: React.SetStateAction<PlanMode>) => void;
  planMode: "auto" | "custom";
}

export default function SetupModeCard({ isLandscape = false, setPlanMode, planMode }: SetupModeCardProps) {
  return (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-center ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="space-y-3">
        {/* Option A: Auto-Generate */}
        <button
          type="button"
          onClick={() => setPlanMode("auto")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            planMode === "auto"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              planMode === "auto"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Wand2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                ✨ Algorithmic Engine
              </span>
              {planMode === "auto" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Auto-Generate Timetable</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Step-by-step guidance: pick target courses, set pacing rules, align with peers, and inspect recommended
              variants with direct faculty review & schedule views.
            </p>
          </div>
        </button>

        {/* Option B: Build My Own */}
        <button
          type="button"
          onClick={() => setPlanMode("custom")}
          className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group relative ${
            planMode === "custom"
              ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              planMode === "custom"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-zinc-900 border border-zinc-800 text-indigo-400"
            }`}
          >
            <Compass className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                🧭 Manual Builder
              </span>
              {planMode === "custom" && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-outfit">Build My Own Timetable</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Select courses and slot offerings one-by-one with real-time conflict checking, faculty ratings, and
              replacement support.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
