"use client";

import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sparkles } from "lucide-react";

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
  onQueryChange?: (query: string) => void;
}

export function CommandPalette({ isOpen, onClose, commands, onQueryChange }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSubpage, setActiveSubpage] = useState<React.ReactNode | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setActiveSubpage(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Notify parent of query changes for external dynamic searches (like Koha)
  useEffect(() => {
    onQueryChange?.(deferredQuery);
  }, [deferredQuery, onQueryChange]);

  // Filter commands efficiently using deferredQuery
  const filteredCommands = useMemo(() => {
    if (!deferredQuery.trim()) {
      return commands.slice(0, 30);
    }

    const q = deferredQuery.toLowerCase().trim();
    const queryWords = q.split(/\s+/);

    return commands
      .filter((cmd) => {
        const text = `${cmd.label} ${cmd.description || ""} ${cmd.category || ""}`.toLowerCase();
        return queryWords.every((word) => text.includes(word));
      })
      .slice(0, 40); // Cap at top 40 for max performance
  }, [commands, deferredQuery]);

  // Reset selected index if filtered list length shrinks
  useEffect(() => {
    setSelectedIndex((prev) => (filteredCommands.length > 0 ? Math.min(prev, filteredCommands.length - 1) : 0));
  }, [filteredCommands.length]);

  // Ensure active item is scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation & shortcuts
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
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md transition-opacity">
        {/* Backdrop Click */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
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
                              <span className="text-base shrink-0 flex items-center justify-center">
                                {cmd.icon}
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

                {/* Right Detail Preview Pane (if selected command has detail) */}
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}