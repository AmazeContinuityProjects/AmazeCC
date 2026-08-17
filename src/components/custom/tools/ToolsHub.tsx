"use client";

import React, { useState } from "react";
import {
  Database,
  UserCheck,
  TrendingUp,
  Users,
  Car,
  DoorOpen,
  Compass,
  ChevronRight,
  Search,
  CalendarCheck,
  Layers,
} from "lucide-react";

interface ToolsHubProps {
  setActiveToolsSubTab: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function ToolsHub({
  setActiveToolsSubTab,
}: ToolsHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const tools = [
    {
      id: "attendance-predictor",
      title: "Attendance Predictor",
      subtitle: "Simulate attendance percentages and safe bunk margins",
      category: "academic",
      icon: CalendarCheck,
      iconColor: "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20",
    },
    {
      id: "qbank",
      title: "Question Bank",
      subtitle: "Previous years CAT & FAT question papers",
      category: "academic",
      icon: Database,
      iconColor: "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/20",
    },
    {
      id: "faculty-info",
      title: "Faculty Explorer",
      subtitle: "Directory, cabins & direct contact details",
      category: "academic",
      icon: UserCheck,
      iconColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20",
    },
    {
      id: "predictor",
      title: "CGPA Predictor",
      subtitle: "Calculate target SGPA & cumulative CGPA",
      category: "academic",
      icon: TrendingUp,
      iconColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20",
    },
    {
      id: "social",
      title: "Social Timetable",
      subtitle: "Share schedules & find common free slots",
      category: "social",
      icon: Users,
      iconColor: "text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20",
    },
    {
      id: "cabshare",
      title: "Cab Share",
      subtitle: "Find travel partners & split cab fares",
      category: "campus",
      icon: Car,
      iconColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20",
    },
    {
      id: "free-class",
      title: "Free Classrooms",
      subtitle: "Find empty classrooms & quiet study spots",
      category: "campus",
      icon: DoorOpen,
      iconColor: "text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/20 border-teal-500/20",
    },
    {
      id: "ffcs",
      title: "FFCS Planner",
      subtitle: "Draft schedule & resolve slot clashes",
      category: "academic",
      icon: Compass,
      iconColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20",
    },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesCategory =
      categoryFilter === "all" || tool.category === categoryFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      tool.title.toLowerCase().includes(term) ||
      tool.subtitle.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-24 md:pb-8 animate-fadeIn text-left select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              Tools & Utilities
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Essential campus utilities, exam archives, and academic tools
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Category Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: "all", label: "All Utilities" },
          { id: "academic", label: "Academic & Exam Tools" },
          { id: "social", label: "Social & Friends" },
          { id: "campus", label: "Campus & Travel" },
        ].map((cat) => {
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Compact Tools Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveToolsSubTab(tool.id)}
              className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${tool.iconColor} group-hover:scale-105 transition-transform duration-150`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white font-outfit tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                    {tool.subtitle}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-12 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
          <Search className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            No tools found matching &quot;{searchTerm}&quot;
          </p>
          <p className="text-xs text-zinc-400">
            Try adjusting your search query or category filter.
          </p>
        </div>
      )}
    </div>
  );
}
