"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, ArrowRight, Command } from "lucide-react";
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

export default function CommandPalette({ isOpen, onClose, commands, onQueryChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, commands]);

  useEffect(() => {
    onQueryChangeRef.current?.(query);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const len = results.length;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((prev) => (prev + 1) % len); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((prev) => (prev - 1 + len) % len); }
      else if (e.key === "Enter" && results[safeIndex]) {
        e.preventDefault();
        results[safeIndex].onSelect();
        onClose();
      } else if (e.key === "Escape") { onClose(); }
    },
    [results, safeIndex, onClose]
  );

  useEffect(() => {
    const el = listRef.current?.children[safeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const grouped = useMemo(() => results.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    const cat = cmd.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {}), [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 midnight:bg-gray-950 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search..."
            className="flex-1 bg-transparent text-base text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 rounded-md">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center py-8">No results found</p>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                {Object.keys(grouped).length > 1 && (
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider">{category}</p>
                )}
                {items.map((cmd) => {
                  const globalIdx = results.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => { cmd.onSelect(); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                        globalIdx === safeIndex
                          ? "bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20 text-blue-700 dark:text-blue-300 midnight:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 midnight:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 midnight:hover:bg-gray-800/50"
                      )}
                    >
                      {cmd.icon && (
                        <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 text-gray-500 dark:text-gray-400 midnight:text-gray-400">{cmd.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cmd.label}</p>
                        {cmd.description && !cmd.rightSlot && <p className="text-[11px] text-gray-400 truncate">{cmd.description}</p>}
                      </div>
                      {cmd.rightSlot ? (
                        <div className="shrink-0">{cmd.rightSlot}</div>
                      ) : cmd.description ? (
                        <p className="hidden md:block text-[11px] text-gray-400 truncate max-w-[200px] mr-2">{cmd.description}</p>
                      ) : null}
                      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 midnight:text-gray-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {hasDetail && (
          <div className="border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 p-3 max-h-48 overflow-y-auto">
            {results[safeIndex].detail}
          </div>
        )}
      </div>
    </div>
  );
}
