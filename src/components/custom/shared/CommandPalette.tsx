"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, ArrowRight, Command, Sparkles, ArrowLeft, X, Clock, SlidersHorizontal, Calculator, History, Trash2, Hash, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  onSelect: () => void;
  rightSlot?: React.ReactNode;
  detail?: React.ReactNode;
  subpage?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  onQueryChange?: (query: string) => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lower.length && qi < q.length; ti++) {
    if (lower[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreCommand(cmd: CommandItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const label = cmd.label.toLowerCase();
  const description = (cmd.description || "").toLowerCase();
  const category = (cmd.category || "").toLowerCase();
  const haystack = `${label} ${description} ${category}`;

  if (label === q) return 100;
  if (label.startsWith(q)) return 90;
  if (label.includes(q)) return 75;
  if (description.includes(q)) return 55;
  if (category.includes(q)) return 45;
  if (fuzzyMatch(haystack, q)) return 25;
  return 0;
}

const RECENT_COMMANDS_KEY = "amazecc_recent_commands";
const MAX_RECENT_COMMANDS = 6;

const categoryGradients: Record<string, string> = {
  Navigation: "from-blue-500 to-purple-500",
  Academics: "from-emerald-500 to-teal-500",
  Attendance: "from-amber-500 to-orange-500",
  Profile: "from-violet-500 to-purple-500",
  Hostel: "from-rose-500 to-pink-500",
  "Day Scholar": "from-sky-500 to-cyan-500",
  Settings: "from-gray-500 to-slate-500",
  Tools: "from-indigo-500 to-blue-500",
  Events: "from-fuchsia-500 to-pink-500",
  "Exam Schedule": "from-red-500 to-rose-500",
  "Academic Calendar": "from-teal-500 to-emerald-500",
};

export default function CommandPalette({ isOpen, onClose, commands, onQueryChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subpage, setSubpage] = useState<React.ReactNode | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [selectionSource, setSelectionSource] = useState<"keyboard" | "pointer">("keyboard");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onQueryChangeRef = useRef(onQueryChange);
  const ignoreMouse = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });
  onQueryChangeRef.current = onQueryChange;

  // ── Search History ──
  const SEARCH_HISTORY_KEY = "amazecc_search_history";
  const MAX_SEARCH_HISTORY = 8;
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const saveToHistory = useCallback((q: string) => {
    if (!q.trim() || q.startsWith("=") || q.startsWith("@")) return;
    setSearchHistory(prev => {
      const next = [q.trim(), ...prev.filter(item => item !== q.trim())].slice(0, MAX_SEARCH_HISTORY);
      try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch {}
  }, []);

  // ── Quick Calculator ──
  const calculatorResult = useMemo(() => {
    if (!query.startsWith("=")) return null;
    const expr = query.slice(1).trim();
    if (!expr) return null;
    try {
      const sanitized = expr.replace(/[^0-9+\-*/.()%\s]/g, "");
      if (!sanitized) return null;
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== "number" || !isFinite(result)) return null;
      return { expr, result };
    } catch { return null; }
  }, [query]);

  // ── Smart Tips ──
  const smartTips = useMemo(() => {
    if (query) return [];
    const tips = [
      { id: "tip-calc", icon: <Calculator className="w-3.5 h-3.5" />, text: "Type = to calculate (e.g. =2+2*3)", category: "Quick Actions" },
      { id: "tip-today", icon: <Hash className="w-3.5 h-3.5" />, text: "Type @today for today's overview", category: "Quick Actions" },
      { id: "tip-exams", icon: <Hash className="w-3.5 h-3.5" />, text: "Type @exams for upcoming exams", category: "Quick Actions" },
      { id: "tip-course", icon: <Hash className="w-3.5 h-3.5" />, text: "Type a course code (e.g. MAT101) for details", category: "Quick Actions" },
    ];
    return tips;
  }, [query]);

  const categories = useMemo(() => {
    const commandCategories = Array.from(new Set(commands.map(cmd => cmd.category || "General")));
    return ["All", "Recent", ...commandCategories].filter((category, index, all) => {
      if (category === "Recent") return recentCommandIds.length > 0;
      return all.indexOf(category) === index;
    });
  }, [commands, recentCommandIds.length]);

  const recentCommands = useMemo(() => {
    const byId = new Map(commands.map(cmd => [cmd.id, cmd]));
    return recentCommandIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(cmd => ({
        ...cmd!,
        id: `recent-${cmd!.id}`,
        category: "Recent",
      }));
  }, [commands, recentCommandIds]);

  const results = useMemo(() => {
    const q = query.trim();
    const baseCommands = !q && activeCategory === "All"
      ? [...recentCommands, ...commands.filter(cmd => !recentCommandIds.includes(cmd.id))]
      : activeCategory === "Recent"
        ? recentCommands
        : commands;

    const categoryFiltered = activeCategory === "All" || activeCategory === "Recent"
      ? baseCommands
      : baseCommands.filter(cmd => (cmd.category || "General") === activeCategory);

    if (!q) return categoryFiltered;

    return categoryFiltered
      .map(cmd => ({ cmd, score: scoreCommand(cmd, q) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.cmd.label.localeCompare(b.cmd.label))
      .map(item => item.cmd);
  }, [query, activeCategory, commands, recentCommands, recentCommandIds]);

  const safeIndex = Math.min(selectedIndex, results.length - 1);
  const hasDetail = results[safeIndex]?.detail;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSubpage(null);
      setActiveCategory("All");
      setSelectionSource("keyboard");
      try {
        const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
        setRecentCommandIds(stored ? JSON.parse(stored) : []);
      } catch {
        setRecentCommandIds([]);
      }
      try {
        const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
        setSearchHistory(stored ? JSON.parse(stored) : []);
      } catch {
        setSearchHistory([]);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
    setSelectionSource("keyboard");
  }, [query, activeCategory, commands]);

  useEffect(() => {
    onQueryChangeRef.current?.(query);
  }, [query]);

  const goBack = useCallback(() => {
    setSubpage(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const rememberCommand = useCallback((cmd: CommandItem) => {
    const id = cmd.id.startsWith("recent-") ? cmd.id.slice("recent-".length) : cmd.id;
    setRecentCommandIds(prev => {
      const next = [id, ...prev.filter(item => item !== id)].slice(0, MAX_RECENT_COMMANDS);
      try {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const executeCommand = useCallback((cmd: CommandItem) => {
    rememberCommand(cmd);
    saveToHistory(query);
    cmd.onSelect();
  }, [rememberCommand, saveToHistory, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (subpage) {
        if (e.key === "Escape") {
          e.preventDefault();
          goBack();
        }
        return;
      }
      const len = results.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (len === 0) return;
        setSelectionSource("keyboard");
        setSelectedIndex((prev) => (prev + 1) % len);
      }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (len === 0) return;
        setSelectionSource("keyboard");
        setSelectedIndex((prev) => (prev - 1 + len) % len);
      }
      else if (e.key === "Enter" && results[safeIndex]) {
        e.preventDefault();
        const cmd = results[safeIndex];
        if (cmd.subpage) {
          setSubpage(cmd.subpage);
        } else {
          executeCommand(cmd);
          onClose();
        }
      } else if (e.key === "Escape") { onClose(); }
    },
    [executeCommand, results, safeIndex, onClose, subpage, goBack]
  );

  useEffect(() => {
    if (selectionSource !== "keyboard" || safeIndex < 0) return;
    const cmd = results[safeIndex];
    const el = cmd ? itemRefs.current[cmd.id] : null;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, results, selectionSource]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !subpage) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onClose(); }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (Math.abs(e.clientX - mousePos.current.x) > 2 || Math.abs(e.clientY - mousePos.current.y) > 2) {
        ignoreMouse.current = false;
        mousePos.current = { x: e.clientX, y: e.clientY };
      }
    };
    
    window.addEventListener("keydown", handler);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isOpen, onClose, subpage]);

  const handleItemClick = useCallback((cmd: CommandItem) => {
    if (cmd.subpage) {
      rememberCommand(cmd);
      setSubpage(cmd.subpage);
    } else {
      executeCommand(cmd);
      onClose();
    }
  }, [executeCommand, onClose, rememberCommand]);

  const grouped = useMemo(() => results.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    const cat = cmd.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {}), [results]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 md:items-start md:px-4 md:pt-[10vh]"
      onClick={subpage ? undefined : onClose}
    >
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="relative flex h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full animate-scale-in overflow-hidden rounded-t-3xl border border-white/20 shadow-2xl shadow-black/20 md:h-auto md:max-h-[78vh] md:max-w-3xl md:rounded-2xl dark:border-white/5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Ambient glows */}
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-purple-500/20 blur-[100px] pointer-events-none" />

        {/* Glass container */}
        <div className="relative flex min-h-0 w-full flex-col bg-white/95 dark:bg-gray-950/95">
          {subpage ? (
            /* ── Subpage view ── */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-gray-200/60 px-4 py-3 dark:border-gray-800/30">
                <button
                  onClick={goBack}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-900 text-gray-500  dark:text-gray-400 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold text-gray-700  dark:text-gray-300">
                  {results.find(c => c.subpage === subpage)?.label || "Search"}
                </p>
                <div className="flex-1" />
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-900 text-gray-500  dark:text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {subpage}
              </div>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="shrink-0 border-b border-gray-200/60 px-4 py-4 dark:border-gray-800/30 md:px-5">
                <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <Search className="w-5 h-5 text-blue-600  dark:text-blue-400" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, courses, grades..."
                  className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder-gray-400 dark:text-gray-100 dark:placeholder-gray-500"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-500  dark:text-gray-400 bg-gray-100  dark:bg-gray-900 rounded-lg border border-gray-200  dark:border-gray-800">
                  <Command className="w-3 h-3" />K
                </kbd>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                  aria-label="Close search"
                  title="Close search"
                >
                  <X className="h-5 w-5" />
                </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                        activeCategory === category
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:text-gray-200"
                      )}
                    >
                      {category === "Recent" ? <Clock className="h-3.5 w-3.5" /> : category === "All" ? <SlidersHorizontal className="h-3.5 w-3.5" /> : null}
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scroll-smooth md:max-h-[22rem]">
                {/* ── Calculator result ── */}
                {calculatorResult && (
                  <div className="mx-1 mb-2 flex items-center gap-3 rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 px-4 py-3 dark:border-blue-800/30 dark:from-blue-950/30 dark:to-indigo-950/20">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-900">
                      <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{calculatorResult.expr} <span className="text-blue-600 dark:text-blue-400">=</span></p>
                    </div>
                    <span className="shrink-0 text-lg font-black tabular-nums text-blue-700 dark:text-blue-300">
                      {calculatorResult.result}
                    </span>
                  </div>
                )}

                {results.length === 0 && !query && searchHistory.length === 0 && smartTips.length > 0 ? (
                  /* ── Smart tips (empty state) ── */
                  <div className="space-y-1 px-3 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pro Tips</p>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 to-transparent dark:from-gray-800/30" />
                    </div>
                    {smartTips.map(tip => (
                      <div key={tip.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-default">
                        <span className="text-gray-400 dark:text-gray-500">{tip.icon}</span>
                        <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{tip.text}</span>
                      </div>
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  /* ── Empty state ── */
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="p-3 rounded-2xl bg-gray-100  dark:bg-gray-900 mb-3">
                      <Sparkles className="w-6 h-6 text-gray-400  dark:text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-500  dark:text-gray-400">No results found</p>
                    <p className="text-xs text-gray-400  dark:text-gray-500 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      {Object.keys(grouped).length > 1 && (
                        <div className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 px-3 pb-1.5 pt-3 backdrop-blur dark:bg-gray-950/95">
                          <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${categoryGradients[category] || "from-gray-400 to-gray-500"}`} />
                          <p className="text-[11px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-widest">{category}</p>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 to-transparent  dark:from-gray-800/30" />
                        </div>
                      )}
                      {items.map((cmd) => {
                        const globalIdx = results.indexOf(cmd);
                        return (
                          <button
                            key={cmd.id}
                            ref={(node) => {
                              itemRefs.current[cmd.id] = node;
                            }}
                            onClick={() => handleItemClick(cmd)}
                            onPointerEnter={(event) => {
                              if (event.pointerType === "touch") return;
                              setSelectionSource("pointer");
                              setSelectedIndex(globalIdx);
                            }}
                            className={cn(
                              "flex w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 md:py-2.5",
                              globalIdx === safeIndex
                                ? "bg-blue-50 text-gray-900 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-gray-100 dark:ring-blue-900/40"
                                : "text-gray-700 hover:bg-gray-50/80 dark:text-gray-300 dark:hover:bg-gray-800/40"
                            )}
                          >
                            {cmd.icon && (
                              <span className={cn(
                                "shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm transition-all",
                                globalIdx === safeIndex
                                  ? "bg-white  dark:bg-gray-900 shadow-sm ring-1 ring-black/5"
                                  : "bg-gray-100/80  dark:bg-gray-900/60 text-gray-500  dark:text-gray-400"
                              )}>
                                {cmd.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-semibold truncate leading-tight",
                                globalIdx === safeIndex ? "text-gray-900  dark:text-gray-100" : "text-gray-800  dark:text-gray-200"
                              )}>{cmd.label}</p>
                              {cmd.description && !cmd.rightSlot && (
                                <p className="text-[11px] text-gray-400  dark:text-gray-500 truncate mt-0.5">{cmd.description}</p>
                              )}
                            </div>
                            {cmd.rightSlot ? (
                              <div className="shrink-0">{cmd.rightSlot}</div>
                            ) : cmd.description ? (
                              <p className="hidden md:block text-[11px] text-gray-400  dark:text-gray-500 truncate max-w-[180px] mr-1">{cmd.description}</p>
                            ) : null}
                            {cmd.subpage ? (
                              <ArrowRight className={cn(
                                "w-4 h-4 shrink-0 transition-all",
                                globalIdx === safeIndex
                                  ? "text-blue-500  dark:text-blue-400 translate-x-0.5"
                                  : "text-gray-300  dark:text-gray-600"
                              )} />
                            ) : (
                              <ArrowRight className={cn(
                                "w-4 h-4 shrink-0 transition-all",
                                globalIdx === safeIndex
                                  ? "text-blue-500  dark:text-blue-400 translate-x-0.5"
                                  : "text-gray-300  dark:text-gray-600"
                              )} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}

                {/* ── Search history (when no query, at the bottom) ── */}
                {!query && searchHistory.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 dark:border-gray-800/30 pt-2 px-1">
                    <div className="flex items-center gap-2 mb-1.5 px-2">
                      <History className="w-3 h-3 text-gray-400" />
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex-1">Recent Searches</p>
                      <button
                        onClick={clearHistory}
                        className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200"
                        >
                          <Clock className="w-3 h-3" />
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {hasDetail && (
                <div className="relative hidden max-h-52 shrink-0 overflow-y-auto border-t border-gray-200/60 bg-gray-50/50 p-3 md:block dark:border-gray-800/30 dark:bg-gray-950/30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-transparent" />
                  {results[safeIndex].detail}
                </div>
              )}

              {/* Footer */}
              <div className="hidden shrink-0 items-center justify-between border-t border-gray-200/60 px-5 py-2.5 text-[11px] text-gray-400 md:flex dark:border-gray-800/30 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> <kbd className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900 font-semibold">Enter</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900 font-semibold">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900 font-semibold">Esc</kbd> close
                </span>
                <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400/80 hover:text-indigo-600 cursor-help font-medium" title="Alt+H: Home | Alt+A: Attendance | Alt+E: Events | Alt+L: Library | Alt+G: Grades | Alt+S: Settings | Alt+O: OD Tracker | Alt+B: Blur GPA | Alt+T: Switch Theme | =2+2: Calculator | @today: Overview | @exams: Exams">
                  💡 Smart Tips
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
