"use client";

import { useState } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  EMPTY_STATE,
  FOCUS_RING,
  GHOST_BUTTON,
  ICON_WELL,
  SEARCH_ICON,
  TEXT_BLOCK,
  TEXT_CAPTION,
  TONE_ICON_TILE,
} from "@/lib/uiTokens";

interface ToolsHubProps {
  setActiveToolsSubTab: (subTab: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function ToolsHub({ setActiveToolsSubTab }: ToolsHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);

  // Category is a filter, not a hue: every tool reads the same neutral icon
  // well, and the Lucide glyph carries the meaning without a status colour.
  const tools = [
    {
      id: "tasks",
      title: "Tasks & Study Schedule",
      subtitle: "Homework, tests, week scheduling, pomodoro & LMS sync",
      category: "academic",
      icon: CheckSquare,
    },
    {
      id: "attendance-predictor",
      title: "Attendance Predictor",
      subtitle: "Simulate attendance percentages and safe bunk margins",
      category: "academic",
      icon: CalendarCheck,
    },
    {
      id: "qbank",
      title: "Question Bank",
      subtitle: "Previous years CAT & FAT question papers",
      category: "academic",
      icon: Database,
    },
    {
      id: "faculty-info",
      title: "Faculty Explorer",
      subtitle: "Directory, cabins & direct contact details",
      category: "academic",
      icon: UserCheck,
    },
    {
      id: "marks-predictor",
      title: "Marks Predictor",
      subtitle: "Simulate test marks, weightage lost & FAT targets",
      category: "academic",
      icon: Sparkles,
    },
    {
      id: "social",
      title: "Social Timetable",
      subtitle: "Share schedules & find common free slots",
      category: "social",
      icon: Users,
    },
    {
      id: "cabshare",
      title: "Cab Share",
      subtitle: "Find travel partners & split cab fares",
      category: "campus",
      icon: Car,
    },
    {
      id: "free-class",
      title: "Free Classrooms",
      subtitle: "Find empty classrooms & quiet study spots",
      category: "campus",
      icon: DoorOpen,
    },
    {
      id: "ffcs",
      title: "FFCS Planner",
      subtitle: "Draft schedule & resolve slot clashes",
      category: "academic",
      icon: Compass,
    },
  ];

  /** The four tools students reach for most; the rest sit behind a disclosure. */
  const frequentIds = ["tasks", "attendance-predictor", "qbank", "faculty-info"];

  /** At most three chips — the remaining categories stay reachable via search. */
  const categories = [
    { id: "all", label: "All Utilities" },
    { id: "academic", label: "Academic & Exam Tools" },
    { id: "campus", label: "Campus & Travel" },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term || tool.title.toLowerCase().includes(term) || tool.subtitle.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  const isBrowsing = categoryFilter === "all" && !searchTerm.trim();
  const visibleTools = isBrowsing && !showAll ? tools.filter((tool) => frequentIds.includes(tool.id)) : filteredTools;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 md:pb-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-balance text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              Tools & Utilities
            </h1>
            <p className={`${TEXT_CAPTION} font-medium`}>
              Essential campus utilities, exam archives, and academic tools
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className={SEARCH_ICON} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-surface dark:bg-surface-secondary border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Category Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {categories.map((cat) => {
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

      {/* Compact Tools Cards Grid. The default four are a clean 2x2 from `sm`;
          a third column is only worth it once the disclosure shows all nine. */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${showAll ? "lg:grid-cols-3" : ""}`}>
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => (tool.id === "ffcs" ? navigateToFFCSPlanner() : setActiveToolsSubTab(tool.id))}
              className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 card-surface shadow-2xs hover:bg-surface-secondary dark:hover:bg-surface-secondary/60 transition-colors duration-150 cursor-pointer text-left"
            >
              <div className={`flex items-center gap-3.5 ${TEXT_BLOCK} pr-2`}>
                <div className={`${ICON_WELL} ${TONE_ICON_TILE.zinc}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className={TEXT_BLOCK}>
                  <h3 className="text-balance text-xs sm:text-sm font-bold text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
                    {tool.title}
                  </h3>
                  <p className={`${TEXT_CAPTION} font-medium truncate mt-0.5`}>{tool.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>
          );
        })}
      </div>

      {visibleTools.length === 0 && (
        <div className={`${EMPTY_STATE} space-y-2`}>
          <Search className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm font-bold text-text-primary">No tools found matching &quot;{searchTerm}&quot;</p>
          <p className="text-xs text-text-muted">Try adjusting your search query or category filter.</p>
        </div>
      )}

      {/* Single disclosure for the remaining utilities. Search/filter always
          reveals the full result set, so every tool stays reachable. */}
      {isBrowsing && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className={`${GHOST_BUTTON} ${FOCUS_RING}`}
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? "Show fewer" : `All utilities (${tools.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
