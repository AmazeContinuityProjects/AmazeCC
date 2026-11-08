"use client";

import React, { useState } from "react";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";
import {
  Database,
  UserCheck,
  Users,
  Car,
  DoorOpen,
  Compass,
  ChevronRight,
  Search,
  CalendarCheck,
  Layers,
  Sparkles,
  CheckSquare,
} from "lucide-react";

interface ToolsHubProps {
  setActiveToolsSubTab: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function ToolsHub({ setActiveToolsSubTab }: ToolsHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const tools = [
    {
      id: "tasks",
      title: "Tasks & Study Schedule",
      subtitle: "Homework, tests, week scheduling, pomodoro & LMS sync",
      category: "academic",
      icon: CheckSquare,
      iconColor:
        "text-ok bg-ok-soft border-ok/20",
    },
    {
      id: "attendance-predictor",
      title: "Attendance Predictor",

      subtitle: "Simulate attendance percentages and safe bunk margins",
      category: "academic",
      icon: CalendarCheck,
      iconColor: "text-accent bg-accent-soft border-accent/20",
    },
    {
      id: "qbank",
      title: "Question Bank",
      subtitle: "Previous years CAT & FAT question papers",
      category: "academic",
      icon: Database,
      iconColor: "text-danger bg-danger-soft border-danger/20",
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
      id: "marks-predictor",
      title: "Marks Predictor",
      subtitle: "Simulate test marks, weightage lost & FAT targets",
      category: "academic",
      icon: Sparkles,
      iconColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20",
    },
    {
      id: "social",
      title: "Share Timetable",
      subtitle: "Send your timetable as a link; plan with friends",
      category: "social",
      icon: Users,
      iconColor: "text-course-3 bg-course-3/10 border-course-3/20",
    },
    {
      id: "cabshare",
      title: "Cab Share",
      subtitle: "Find travel partners & split cab fares",
      category: "campus",
      icon: Car,
      iconColor:
        "text-ok bg-ok-soft border-ok/20",
    },
    {
      id: "free-class",
      title: "Free Classrooms",
      subtitle: "Find empty classrooms & quiet study spots",
      category: "campus",
      icon: DoorOpen,
      iconColor: "text-course-1 bg-course-1/10 border-course-1/20",
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
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term || tool.title.toLowerCase().includes(term) || tool.subtitle.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 md:pb-8 animate-fadeIn text-left select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md border border-line-2 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 bg-surface-2">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-ink font-outfit tracking-tight">
              Tools & Utilities
            </h1>
            <p className="text-xs text-muted font-medium">
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
            className="w-full pl-9 pr-4 py-2 rounded-md bg-surface dark:bg-surface-secondary border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-ink placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Category Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: "all", label: "All Utilities" },
          { id: "academic", label: "Academic & Exam Tools" },
          { id: "social", label: "Friends & Sharing" },
          { id: "campus", label: "Campus & Travel" },
        ].map((cat) => {
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-accent text-background"
                  : "bg-surface border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
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
              onClick={() => (tool.id === "ffcs" ? navigateToFFCSPlanner() : setActiveToolsSubTab(tool.id))}
              className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-md border border-zinc-200/80 dark:border-zinc-800 card-surface hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-sm text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 border ${tool.iconColor} transition-transform duration-150`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-ink font-outfit tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted font-medium truncate mt-0.5">
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
        <div className="p-12 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
          <Search className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            No tools found matching &quot;{searchTerm}&quot;
          </p>
          <p className="text-xs text-zinc-400">Try adjusting your search query or category filter.</p>
        </div>
      )}
    </div>
  );
}
