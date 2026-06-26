"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, ArrowRight, Command, Sparkles, ArrowLeft, X } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const subpageInputRef = useRef<HTMLInputElement>(null);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter(
      (cmd) =>
        fuzzyMatch(cmd.label, query) ||
        fuzzyMatch(cmd.description || "", query) ||
        fuzzyMatch(cmd.category || "", query)
    );
  }, [query, commands]);

  const safeIndex = Math.min(selectedIndex, results.length - 1);
  const hasDetail = results[safeIndex]?.detail;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSubpage(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (subpage) {
      setTimeout(() => subpageInputRef.current?.focus(), 50);
    }
  }, [subpage]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, commands]);

  useEffect(() => {
    onQueryChangeRef.current?.(query);
  }, [query]);

  const goBack = useCallback(() => {
    setSubpage(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

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
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((prev) => (prev + 1) % len); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((prev) => (prev - 1 + len) % len); }
      else if (e.key === "Enter" && results[safeIndex]) {
        e.preventDefault();
        const cmd = results[safeIndex];
        if (cmd.subpage) {
          setSubpage(cmd.subpage);
        } else {
          cmd.onSelect();
          onClose();
        }
      } else if (e.key === "Escape") { onClose(); }
    },
    [results, safeIndex, onClose, subpage, goBack]
  );

  useEffect(() => {
    const el = listRef.current?.children[safeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !subpage) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, subpage]);

  const handleItemClick = useCallback((cmd: CommandItem) => {
    if (cmd.subpage) {
      setSubpage(cmd.subpage);
    } else {
      cmd.onSelect();
      onClose();
    }
  }, [onClose]);

  const grouped = useMemo(() => results.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    const cat = cmd.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {}), [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] md:pt-[12vh]" onClick={subpage ? undefined : onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="relative w-[95vw] max-w-2xl animate-scale-in overflow-hidden rounded-2xl border border-white/20 dark:border-white/10 midnight:border-white/5 shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Ambient glows */}
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-purple-500/20 blur-[100px] pointer-events-none" />

        {/* Glass container */}
        <div className="relative bg-white/80 dark:bg-slate-900/90 midnight:bg-gray-950/90 backdrop-blur-2xl">
          {subpage ? (
            /* ── Subpage view ── */
            <div className="flex flex-col max-h-[70vh]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200/60 dark:border-gray-700/30 midnight:border-gray-800/30">
                <button
                  onClick={goBack}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-900 text-gray-500 dark:text-gray-400 midnight:text-gray-400 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                  {results.find(c => c.subpage === subpage)?.label || "Search"}
                </p>
                <div className="flex-1" />
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-900 text-gray-500 dark:text-gray-400 midnight:text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {subpage}
              </div>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/30 midnight:border-gray-800/30">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 midnight:text-blue-400" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, courses, grades..."
                  className="flex-1 bg-transparent text-base text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 midnight:placeholder-gray-500 outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 midnight:border-gray-800">
                  <Command className="w-3 h-3" />K
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-0.5 scroll-smooth">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 mb-3">
                      <Sparkles className="w-6 h-6 text-gray-400 dark:text-gray-500 midnight:text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400">No results found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 midnight:text-gray-500 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items], catIdx) => (
                    <div key={category}>
                      {Object.keys(grouped).length > 1 && (
                        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                          <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${categoryGradients[category] || "from-gray-400 to-gray-500"}`} />
                          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-widest">{category}</p>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 to-transparent dark:from-gray-700/30 midnight:from-gray-800/30" />
                        </div>
                      )}
                      {items.map((cmd) => {
                        const globalIdx = results.indexOf(cmd);
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => handleItemClick(cmd)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150",
                              globalIdx === safeIndex
                                ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/20 midnight:from-blue-900/20 midnight:to-purple-900/10 text-gray-900 dark:text-gray-100 midnight:text-gray-100 shadow-sm"
                                : "text-gray-700 dark:text-gray-300 midnight:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 midnight:hover:bg-gray-800/30"
                            )}
                          >
                            {cmd.icon && (
                              <span className={cn(
                                "shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm transition-all",
                                globalIdx === safeIndex
                                  ? "bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm ring-1 ring-black/5"
                                  : "bg-gray-100/80 dark:bg-gray-800/60 midnight:bg-gray-900/60 text-gray-500 dark:text-gray-400 midnight:text-gray-400"
                              )}>
                                {cmd.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-semibold truncate leading-tight",
                                globalIdx === safeIndex ? "text-gray-900 dark:text-gray-100 midnight:text-gray-100" : "text-gray-800 dark:text-gray-200 midnight:text-gray-200"
                              )}>{cmd.label}</p>
                              {cmd.description && !cmd.rightSlot && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 midnight:text-gray-500 truncate mt-0.5">{cmd.description}</p>
                              )}
                            </div>
                            {cmd.rightSlot ? (
                              <div className="shrink-0">{cmd.rightSlot}</div>
                            ) : cmd.description ? (
                              <p className="hidden md:block text-[11px] text-gray-400 dark:text-gray-500 midnight:text-gray-500 truncate max-w-[180px] mr-1">{cmd.description}</p>
                            ) : null}
                            {cmd.subpage ? (
                              <ArrowRight className={cn(
                                "w-4 h-4 shrink-0 transition-all",
                                globalIdx === safeIndex
                                  ? "text-blue-500 dark:text-blue-400 midnight:text-blue-400 translate-x-0.5"
                                  : "text-gray-300 dark:text-gray-600 midnight:text-gray-600"
                              )} />
                            ) : (
                              <ArrowRight className={cn(
                                "w-4 h-4 shrink-0 transition-all",
                                globalIdx === safeIndex
                                  ? "text-blue-500 dark:text-blue-400 midnight:text-blue-400 translate-x-0.5"
                                  : "text-gray-300 dark:text-gray-600 midnight:text-gray-600"
                              )} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Detail panel */}
              {hasDetail && (
                <div className="relative border-t border-gray-200/60 dark:border-gray-700/30 midnight:border-gray-800/30 p-3 max-h-52 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/30 midnight:bg-gray-950/30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-transparent" />
                  {results[safeIndex].detail}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200/60 dark:border-gray-700/30 midnight:border-gray-800/30 text-[11px] text-gray-400 dark:text-gray-500 midnight:text-gray-500">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 font-semibold">Enter</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 font-semibold">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 font-semibold">Esc</kbd> close
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
