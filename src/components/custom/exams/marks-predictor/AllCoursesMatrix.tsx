"use client";

import React, { useState } from "react";
import {
  LayoutGrid,
  TrendingDown,
  Sparkles,
  ArrowUpDown,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
} from "lucide-react";
import { CoursePredictionResult } from "@/lib/marksPredictor";
import Badge from "../../shared/Badge";

interface AllCoursesMatrixProps {
  predictions: CoursePredictionResult[];
  onSelectCourse: (courseCode: string) => void;
}

type SortField = "deficit" | "maxPossible" | "code" | "scored";

export default function AllCoursesMatrix({
  predictions,
  onSelectCourse,
}: AllCoursesMatrixProps) {
  const [sortField, setSortField] = useState<SortField>("deficit");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filtered = predictions.filter(
    (p) =>
      p.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.courseTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "deficit") return b.pointsLostScaled - a.pointsLostScaled;
    if (sortField === "maxPossible") return b.maxPossibleScaled - a.maxPossibleScaled;
    if (sortField === "scored") return b.currentScoredScaled - a.currentScoredScaled;
    return a.courseCode.localeCompare(b.courseCode);
  });

  const totalPointsLostAcrossAll = predictions.reduce((s, p) => s + p.pointsLostScaled, 0);
  const avgCeiling = predictions.length > 0
    ? predictions.reduce((s, p) => s + p.maxPossibleScaled, 0) / predictions.length
    : 100;

  return (
    <div className="space-y-6">
      {/* Overview Stat Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Total Courses Tracked
            </p>
            <p className="text-xl font-black text-zinc-900 dark:text-white font-outfit mt-1">
              {predictions.length} Courses
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
            📚
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Average Possible Ceiling
            </p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-outfit mt-1">
              {avgCeiling.toFixed(1)}% Max
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
            ✨
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Total Cumulative Deficit
            </p>
            <p className={`text-xl font-black font-outfit mt-1 ${totalPointsLostAcrossAll > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {totalPointsLostAcrossAll > 0 ? `-${totalPointsLostAcrossAll.toFixed(1)} pts` : "0.0 pts"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black">
            📉
          </div>
        </div>
      </div>

      {/* Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter courses..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-white"
          />
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-zinc-400 mr-1 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort:
          </span>
          {[
            { id: "deficit", label: "Highest Deficit" },
            { id: "maxPossible", label: "Max Possible" },
            { id: "scored", label: "Highest Scored" },
            { id: "code", label: "Course Code" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSortField(s.id as SortField)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                sortField === s.id
                  ? "bg-indigo-600 text-white shadow-3xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {sorted.map((p) => {
          const isHighDeficit = p.pointsLostScaled > 15;
          const isModerateDeficit = p.pointsLostScaled > 5;

          return (
            <div
              key={p.courseCode}
              onClick={() => onSelectCourse(p.courseCode)}
              className="group p-4 sm:p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-indigo-500/50 hover:shadow-xs transition-all duration-200 cursor-pointer text-left flex flex-col justify-between"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-black text-xs font-outfit border border-indigo-200/50 dark:border-indigo-800/50">
                      {p.courseCode}
                    </span>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white font-outfit mt-1.5 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {p.courseTitle}
                    </h4>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${p.estimatedGrade.bg} ${p.estimatedGrade.color} ${p.estimatedGrade.border}`}>
                    {p.estimatedGrade.letter}
                  </span>
                </div>

                {/* Meta details */}
                <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
                  {p.courseType} • {p.totalCredits} Credits {p.isEmbedded ? "(Embedded)" : ""}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-800/50">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                      Max Possible
                    </span>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-outfit mt-0.5">
                      {p.maxPossibleScaled.toFixed(1)}%
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-800/50">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                      Points Lost
                    </span>
                    <p className={`text-base font-black font-outfit mt-0.5 ${
                      isHighDeficit
                        ? "text-rose-600 dark:text-rose-400"
                        : isModerateDeficit
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}>
                      {p.pointsLostScaled > 0 ? `-${p.pointsLostScaled.toFixed(1)}` : "0.0"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <span className="text-[11px] font-bold text-zinc-400">
                  Locked: <strong className="text-zinc-700 dark:text-zinc-300">{p.currentScoredScaled.toFixed(1)} pts</strong>
                </span>
                <span className="flex items-center gap-1 font-black text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Simulate</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
