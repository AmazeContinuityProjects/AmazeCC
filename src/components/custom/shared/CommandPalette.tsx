"use client";

import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";
import { 
  Search, X, Sparkles, User, Calendar, BookOpen, CreditCard, Car, Home, Bus, 
  Plus, BarChart3, FileText, GraduationCap, TrendingUp, 
  Volume2, Users, School, RotateCcw, ClipboardList, Settings, 
  Code, Star, Utensils, Shirt, Plane, Handshake, HelpCircle, 
  PartyPopper, Landmark, Clock, MessageSquare, 
  CheckCircle2, Sun, Moon, AlertTriangle
} from "lucide-react";

function renderCommandIcon(icon: React.ReactNode | string) {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon !== "string") return <Sparkles size={15} className="text-indigo-500" />;

  switch (icon.trim()) {
    case "👤": return <User size={15} className="text-indigo-500" />;
    case "📋": return <ClipboardList size={15} className="text-blue-500" />;
    case "📚": return <BookOpen size={15} className="text-emerald-500" />;
    case "💳": return <CreditCard size={15} className="text-amber-500" />;
    case "🚕": return <Car size={15} className="text-amber-500" />;
    case "📖": return <BookOpen size={15} className="text-indigo-500" />;
    case "🏠": return <Home size={15} className="text-violet-500" />;
    case "🚏":
    case "🚍":
    case "🚌": return <Bus size={15} className="text-sky-500" />;
    case "➕": return <Plus size={15} className="text-zinc-400" />;
    case "📊": return <BarChart3 size={15} className="text-emerald-500" />;
    case "📅":
    case "🗓️": return <Calendar size={15} className="text-blue-500" />;
    case "📜": return <FileText size={15} className="text-amber-500" />;
    case "🎓": return <GraduationCap size={15} className="text-purple-500" />;
    case "📈": return <TrendingUp size={15} className="text-emerald-500" />;
    case "📘": return <BookOpen size={15} className="text-blue-500" />;
    case "📢": return <Volume2 size={15} className="text-rose-500" />;
    case "👨‍🏫": return <Users size={15} className="text-teal-500" />;
    case "🏫": return <School size={15} className="text-indigo-500" />;
    case "🔄": return <RotateCcw size={15} className="text-blue-500" />;
    case "⚙️": return <Settings size={15} className="text-zinc-500" />;
    case "💻": return <Code size={15} className="text-violet-500" />;
    case "⭐": return <Star size={15} className="text-amber-400 fill-amber-400" />;
    case "🍽️": return <Utensils size={15} className="text-orange-500" />;
    case "👕": return <Shirt size={15} className="text-sky-500" />;
    case "✈️": return <Plane size={15} className="text-indigo-500" />;
    case "🤝": return <Handshake size={15} className="text-emerald-500" />;
    case "📄": return <FileText size={15} className="text-zinc-400" />;
    case "❓": return <HelpCircle size={15} className="text-amber-500" />;
    case "👥": return <Users size={15} className="text-blue-500" />;
    case "🎉": return <PartyPopper size={15} className="text-pink-500" />;
    case "🏛️": return <Landmark size={15} className="text-amber-600" />;
    case "⏰": return <Clock size={15} className="text-amber-500" />;
    case "🔮": return <Sparkles size={15} className="text-purple-500" />;
    case "💬": return <MessageSquare size={15} className="text-indigo-500" />;
    case "📝": return <FileText size={15} className="text-blue-500" />;
    case "🔢": return <BarChart3 size={15} className="text-emerald-500" />;
    case "🙈":
    case "🕵️": return <User size={15} className="text-zinc-400" />;
    case "☀️": return <Sun size={15} className="text-amber-500" />;
    case "🌙": return <Moon size={15} className="text-indigo-400" />;
    case "📏": return <BarChart3 size={15} className="text-blue-500" />;
    case "🚶": return <Users size={15} className="text-zinc-500" />;
    case "🟡": return <AlertTriangle size={15} className="text-amber-500" />;
    case "🔴":
    case "⚠️": return <AlertTriangle size={15} className="text-red-500" />;
    case "🎪": return <PartyPopper size={15} className="text-pink-500" />;
    case "✅": return <CheckCircle2 size={15} className="text-emerald-500" />;
    case "☐": return <CheckCircle2 size={15} className="text-zinc-400" />;
    default:
      if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(icon)) {
        return <Sparkles size={15} className="text-indigo-500" />;
      }
      return <span className="text-xs font-bold text-zinc-500">{icon}</span>;
  }
}

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode | string;
  category?: string;
  rightSlot?: React.ReactNode;
  detail?: React.ReactNode;
  subpage?: React.ReactNode;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  apiBase?: string;
  demoMode?: boolean;
}

export function CommandPalette({ isOpen, onClose, commands, apiBase = "", demoMode = false }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSubpage, setActiveSubpage] = useState<React.ReactNode | null>(null);
  const [kohaBooks, setKohaBooks] = useState<any[]>([]);
  const [kohaLoading, setKohaLoading] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input & reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setActiveSubpage(null);
      setKohaBooks([]);
      setKohaLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Handle Koha search internally when "koha" is typed
  useEffect(() => {
    if (!isOpen || !deferredQuery) {
      setKohaBooks([]);
      setKohaLoading(false);
      return;
    }

    const lower = deferredQuery.toLowerCase();
    const kohaIdx = lower.indexOf("koha");
    if (kohaIdx === -1) {
      setKohaBooks([]);
      setKohaLoading(false);
      return;
    }

    const searchTerm = deferredQuery.slice(kohaIdx + 4).trim().replace(/^[:;,\-\s]+/, "");
    if (!searchTerm) {
      setKohaBooks([]);
      setKohaLoading(true);
      return;
    }

    setKohaLoading(true);
    if (demoMode) {
      const timer = setTimeout(() => {
        const mockResults = [
          { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", availability: "Available (4 copies)" },
          { title: "Computer Networking: A Top-Down Approach", author: "Kurose, Ross", availability: "Reference Only (1 copy)" },
          { title: "Design Patterns: Elements of Reusable Object-Oriented Software", author: "Gamma, Helm, Johnson, Vlissides", availability: "Checked Out (Due 2026-07-10)" }
        ].filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.author.toLowerCase().includes(searchTerm.toLowerCase()));
        setKohaBooks(mockResults);
        setKohaLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();
    fetch(`${apiBase}/api/koha/search?q=${encodeURIComponent(searchTerm)}&count=10`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setKohaBooks(data?.success && Array.isArray(data?.books) ? data.books : []);
        setKohaLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setKohaBooks([]);
          setKohaLoading(false);
        }
      });

    return () => controller.abort();
  }, [deferredQuery, isOpen, apiBase, demoMode]);

  // Dynamic Koha command items
  const dynamicKohaCommands = useMemo<CommandItem[]>(() => {
    return kohaBooks.map((b, i) => ({
      id: `koha-dynamic-${i}`,
      label: b.title || "Book Title",
      description: `${b.author || "Author"} · ${b.availability || "Status"}`,
      icon: "📖",
      category: "Koha Library Catalog",
      rightSlot: undefined,
      detail: undefined,
      subpage: undefined,
      onSelect: () => window.open("http://opac.vit.ac.in", "_blank"),
    }));
  }, [kohaBooks]);

  // Combined command list
  const allCommands = useMemo(() => {
    if (dynamicKohaCommands.length > 0) {
      return [...dynamicKohaCommands, ...commands];
    }
    return commands;
  }, [commands, dynamicKohaCommands]);

  // Filter commands efficiently using deferredQuery
  const filteredCommands = useMemo(() => {
    if (!deferredQuery.trim()) {
      return allCommands.slice(0, 30);
    }

    const q = deferredQuery.toLowerCase().trim();
    const queryWords = q.split(/\s+/);

    return allCommands
      .filter((cmd) => {
        const text = `${cmd.label} ${cmd.description || ""} ${cmd.category || ""}`.toLowerCase();
        return queryWords.every((word) => text.includes(word));
      })
      .slice(0, 40);
  }, [allCommands, deferredQuery]);

  // Reset selected index if filtered list length changes
  useEffect(() => {
    setSelectedIndex((prev) => (filteredCommands.length > 0 ? Math.min(prev, filteredCommands.length - 1) : 0));
  }, [filteredCommands.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (activeSubpage) {
          setActiveSubpage(null);
        } else {
          onClose();
        }
        return;
      }

      if (activeSubpage) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          if (selected.subpage) {
            setActiveSubpage(selected.subpage);
          } else {
            selected.onSelect();
            onClose();
          }
        }
      }
    },
    [filteredCommands, selectedIndex, activeSubpage, onClose]
  );

  if (!isOpen) return null;

  const selectedCommand = filteredCommands[selectedIndex];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 bg-black/60 backdrop-blur-md transition-opacity">
        {/* Backdrop Click */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Container */}
        <m.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
          onKeyDown={handleKeyDown}
        >
          {/* Subpage View */}
          {activeSubpage ? (
            <div className="p-4 relative">
              <button
                onClick={() => setActiveSubpage(null)}
                className="mb-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← Back to Spotlight Search
              </button>
              {activeSubpage}
            </div>
          ) : (
            <>
              {/* Top Search Input Bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0">
                <Search size={18} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a command or search (e.g. 'Attendance', 'Grades', 'Mess', 'Koha')..."
                  className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                {kohaLoading && (
                  <span className="text-[10px] font-bold text-amber-500 animate-pulse shrink-0">
                    Searching Koha...
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body: Left Command List + Right Detail Preview */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800/60">
                {/* Command List */}
                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[50vh] scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
                >
                  {filteredCommands.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                      No matching commands found.
                    </div>
                  ) : (
                    filteredCommands.map((cmd, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                        <div
                          key={cmd.id || idx}
                          onClick={() => {
                            if (cmd.subpage) {
                              setActiveSubpage(cmd.subpage);
                            } else {
                              cmd.onSelect();
                              onClose();
                            }
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {cmd.icon && (
                              <span className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
                                isSelected
                                  ? "bg-white/20 border-white/30 text-white"
                                  : "bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200/60 dark:border-zinc-700/60"
                              }`}>
                                {renderCommandIcon(cmd.icon)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-zinc-900 dark:text-white"}`}>
                                {cmd.label}
                              </p>
                              {cmd.description && (
                                <p className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-indigo-100" : "text-zinc-500 dark:text-zinc-400"}`}>
                                  {cmd.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {cmd.category && (
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                }`}
                              >
                                {cmd.category}
                              </span>
                            )}
                            {cmd.rightSlot}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right Detail Preview Pane */}
                {selectedCommand?.detail && (
                  <div className="hidden md:block w-72 p-4 bg-zinc-50/50 dark:bg-zinc-950/40 overflow-y-auto shrink-0 border-l border-zinc-100 dark:border-zinc-800/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                      Command Details
                    </p>
                    {selectedCommand.detail}
                  </div>
                )}
              </div>

              {/* Bottom Footer Shortcuts Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50/80 dark:bg-zinc-900/80 border-t border-zinc-200/60 dark:border-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 font-mono text-[9px]">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 font-mono text-[9px]">↵</kbd> Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 font-mono text-[9px]">ESC</kbd> Close
                  </span>
                </div>
                <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                  <Sparkles size={11} /> Spotlight Search
                </span>
              </div>
            </>
          )}
        </m.div>
      </div>
    </AnimatePresence>
  );
}