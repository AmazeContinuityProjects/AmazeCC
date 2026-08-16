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
  Sparkles,
  ChevronRight,
  Search,
  BookOpen,
  Calendar,
  CalendarCheck,
  Layers,
  ArrowRight,
} from "lucide-react";
import PageHeader from "../shared/PageHeader";
import Badge from "../shared/Badge";

interface ToolsHubProps {
  setActiveToolsSubTab: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function ToolsHub({
  setActiveToolsSubTab,
  setActiveTab,
}: ToolsHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const tools = [
    {
      id: "attendance-predictor",
      title: "Attendance Predictor",
      description: "Simulate attendance percentages, future leaves, and safe bunk margins till CAT-1, CAT-2, or LID.",
      category: "academic",
      badge: "Simulator",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: CalendarCheck,
      iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
      featured: true,
    },
    {
      id: "qbank",
      title: "Question Bank",
      description: "Search and download previous years CAT-1, CAT-2, and FAT question papers & model answers.",
      category: "academic",
      badge: "Exam Prep",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      icon: Database,
      iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
      featured: true,
    },
    {
      id: "faculty-info",
      title: "Faculty Explorer",
      description: "Search VIT faculty directory, cabin numbers, designations, school departments, and direct email contacts.",
      category: "academic",
      badge: "Directory",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: UserCheck,
      iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
      featured: true,
    },
    {
      id: "predictor",
      title: "CGPA Predictor",
      description: "Forecast your semester SGPA and cumulative CGPA by simulating anticipated course grades and credit goals.",
      category: "academic",
      badge: "Calculator",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: TrendingUp,
      iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
      featured: true,
    },
    {
      id: "social",
      title: "Social Timetable Sharing",
      description: "Connect with friends, compare class timetables side-by-side, and find common free slots between schedules.",
      category: "social",
      badge: "Friends & Schedules",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      icon: Users,
      iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
      featured: true,
    },
    {
      id: "cabshare",
      title: "Cab Share",
      description: "Find travel partners and split cab fares for trips to Chennai Airport, Central Station, or Bangalore.",
      category: "campus",
      badge: "Travel & Rides",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: Car,
      iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      featured: true,
    },
    {
      id: "free-class",
      title: "Free Classrooms",
      description: "Locate unoccupied lecture halls and classrooms across academic blocks for study sessions and discussions.",
      category: "campus",
      badge: "Study Spaces",
      badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      icon: DoorOpen,
      iconBg: "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400",
    },
    {
      id: "ffcs",
      title: "FFCS Planner",
      description: "Draft your semester schedule visually, resolve slot collisions, and align your plan with your friends before registration.",
      category: "academic",
      badge: "Course Registration",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      icon: Compass,
      iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesCategory =
      categoryFilter === "all" || tool.category === categoryFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      tool.title.toLowerCase().includes(term) ||
      tool.description.toLowerCase().includes(term) ||
      tool.badge.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 md:pb-8 animate-fadeIn text-left select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                Tools & Utilities
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Essential campus utilities, exam archives, faculty directory, and social tools
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tools & utilities..."
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
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

      {/* Tools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => setActiveToolsSubTab(tool.id)}
              className="group rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 p-5 shadow-xs hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Top Strip: Icon & Badge */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${tool.iconBg} group-hover:scale-105 transition-transform duration-200`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${tool.badgeColor}`}
                  >
                    {tool.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1.5 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              {/* Bottom Action Strip */}
              <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400 font-outfit">
                <span>Launch Tool</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-12 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
          <Search className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            No tools found matching "{searchTerm}"
          </p>
          <p className="text-xs text-zinc-400">
            Try adjusting your search query or category filter.
          </p>
        </div>
      )}
    </div>
  );
}
