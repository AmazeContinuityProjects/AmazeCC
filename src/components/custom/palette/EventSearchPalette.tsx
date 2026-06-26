"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search, CalendarDays, MapPin, DollarSign, X, Sparkles, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventItem {
  title?: string;
  name?: string;
  date?: string;
  time?: string;
  venue?: string;
  location?: string;
  price?: string;
  type?: string;
  description?: string;
  posterUrl?: string;
  paymentStatus?: string;
  eid?: string;
  _source?: "registered" | "discover";
}

interface EventSearchPaletteProps {
  registeredEvents: EventItem[];
  eventHubEvents: EventItem[];
}

export default function EventSearchPalette({ registeredEvents, eventHubEvents }: EventSearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "registered" | "discover">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "all" as const, label: "All Events", count: 0 },
    { id: "registered" as const, label: "Registered", count: registeredEvents?.length || 0 },
    { id: "discover" as const, label: "Discover", count: eventHubEvents?.length || 0 },
  ];

  const allEvents = useMemo(() => {
    const registered = (registeredEvents || []).map(e => ({ ...e, _source: "registered" as const }));
    const discover = (eventHubEvents || []).map(e => ({ ...e, _source: "discover" as const }));
    return [...registered, ...discover];
  }, [registeredEvents, eventHubEvents]);

  const results = useMemo(() => {
    let filtered = allEvents;
    if (activeTab === "registered") filtered = allEvents.filter(e => e._source === "registered");
    if (activeTab === "discover") filtered = allEvents.filter(e => e._source === "discover");
    if (!query.trim()) return filtered;
    return filtered.filter(
      e => (e.title || e.name || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.description || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.venue || e.location || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.type || "").toLowerCase().includes(query.toLowerCase())
    );
  }, [query, activeTab, allEvents]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  useEffect(() => { setSelectedIndex(0); }, [query, activeTab]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (selectedEvent) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSelectedEvent(null); setTimeout(() => inputRef.current?.focus(), 0); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, results.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); break;
      case "ArrowLeft": e.preventDefault(); if (!query) { const idx = tabs.findIndex(t => t.id === activeTab); if (idx > 0) { setActiveTab(tabs[idx - 1].id); setSelectedEvent(null); } } break;
      case "ArrowRight": e.preventDefault(); if (!query) { const idx = tabs.findIndex(t => t.id === activeTab); if (idx < tabs.length - 1) { setActiveTab(tabs[idx + 1].id); setSelectedEvent(null); } } break;
      case "Enter": e.preventDefault(); if (results[safeIndex]) { setSelectedEvent(results[safeIndex]); } break;
      case "Escape": break;
    }
  }, [results, safeIndex, selectedEvent, activeTab, query, tabs]);

  const getTitle = (e: EventItem) => e.title || e.name || "Untitled Event";

  return (
    <div className="flex flex-col h-full min-h-[320px]" onKeyDown={handleKeyDown}>
      {/* Search header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200/60 dark:border-gray-700/30 midnight:border-gray-800/30 bg-gradient-to-r from-fuchsia-500/[0.03] to-transparent">
        <div className="p-1.5 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-pink-500/15 shadow-sm">
          <Search className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 midnight:text-fuchsia-400" />
        </div>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events by name, venue, type..."
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 midnight:placeholder-gray-500 outline-none"
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700/40 midnight:hover:bg-gray-800/40 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 bg-gray-100 dark:bg-gray-800/60 midnight:bg-gray-900/60 rounded-lg border border-gray-200/60 dark:border-gray-700/30">
            {allEvents.length} events
          </kbd>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2.5 border-b border-gray-100/80 dark:border-gray-800/30 midnight:border-gray-800/30 bg-gray-50/30 dark:bg-gray-900/20">
        {tabs.map((tab, ti) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedEvent(null); inputRef.current?.focus(); }}
            className={cn(
              "relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab.id
                ? "bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 text-fuchsia-700 dark:text-fuchsia-400 midnight:text-fuchsia-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 midnight:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 midnight:hover:bg-gray-800/40"
            )}
          >
            {tab.label}
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold",
              activeTab === tab.id
                ? "bg-fuchsia-200/50 dark:bg-fuchsia-800/30 text-fuchsia-600 dark:text-fuchsia-300"
                : "bg-gray-200/50 dark:bg-gray-700/30 text-gray-500 dark:text-gray-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
        {!query && (
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 midnight:text-gray-500">
            ← → tabs
          </kbd>
        )}
      </div>

      {/* Content area */}
      {selectedEvent ? (
        /* Detail view */
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <button
            onClick={() => { setSelectedEvent(null); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 midnight:text-fuchsia-400 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to results
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 text-[10px] text-gray-400">esc</kbd>
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl shrink-0 shadow-sm",
                selectedEvent._source === "registered"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                  : "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600"
              )}>
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 midnight:text-white truncate">{getTitle(selectedEvent)}</p>
                <span className={cn(
                  "inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold",
                  selectedEvent._source === "registered"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400"
                )}>
                  {selectedEvent._source === "registered" ? "Registered" : "Discover"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(selectedEvent.date || selectedEvent.time) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-violet-50 dark:bg-violet-900/20 midnight:bg-violet-900/10 text-violet-700 dark:text-violet-400 midnight:text-violet-300 border border-violet-200/50 dark:border-violet-800/30">
                  <CalendarDays className="w-3 h-3" />
                  {selectedEvent.date}{selectedEvent.time ? ` · ${selectedEvent.time}` : ""}
                </span>
              )}
              {(selectedEvent.venue || selectedEvent.location) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-rose-50 dark:bg-rose-900/20 midnight:bg-rose-900/10 text-rose-700 dark:text-rose-400 midnight:text-rose-300 border border-rose-200/50 dark:border-rose-800/30">
                  <MapPin className="w-3 h-3" />
                  {selectedEvent.venue || selectedEvent.location}
                </span>
              )}
              {(selectedEvent.price || selectedEvent.paymentStatus) && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border",
                  (selectedEvent.paymentStatus || "").toLowerCase().includes("paid")
                    ? "bg-amber-50 dark:bg-amber-900/20 midnight:bg-amber-900/10 text-amber-700 dark:text-amber-400 midnight:text-amber-300 border-amber-200/50 dark:border-amber-800/30"
                    : "bg-emerald-50 dark:bg-emerald-900/20 midnight:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 midnight:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30"
                )}>
                  <DollarSign className="w-3 h-3" />
                  {selectedEvent.paymentStatus || selectedEvent.price}
                </span>
              )}
              {selectedEvent.type && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 midnight:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 midnight:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/30">
                  {selectedEvent.type}
                </span>
              )}
            </div>

            {selectedEvent.description && (
              <div className="px-4 py-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 midnight:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/30 midnight:border-gray-800/30">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-1.5 uppercase tracking-wider">Description</p>
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 midnight:text-white leading-relaxed">{selectedEvent.description}</p>
              </div>
            )}
          </div>
        </div>
      ) : results.length > 0 ? (
        /* Results list */
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-smooth">
          {query && (
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 midnight:text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 midnight:bg-gray-900/60 text-[10px] text-gray-400 dark:text-gray-500">↑↓ navigate · enter to view</kbd>
            </div>
          )}
          {results.map((ev, idx) => (
            <button
              key={`${ev._source}-${ev.eid || idx}`}
              onClick={() => setSelectedEvent(ev)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                idx === safeIndex
                  ? "bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/30 dark:to-pink-900/20 midnight:from-fuchsia-900/20 midnight:to-pink-900/10 text-gray-900 dark:text-gray-100 midnight:text-gray-100 shadow-sm ring-1 ring-fuchsia-500/10"
                  : "text-gray-700 dark:text-gray-300 midnight:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 midnight:hover:bg-gray-800/30"
              )}
            >
              <span className={cn(
                "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-sm transition-all",
                idx === safeIndex
                  ? "bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm ring-1 ring-black/5"
                  : "bg-gray-100/80 dark:bg-gray-800/60 midnight:bg-gray-900/60"
              )}>
                {ev._source === "registered" ? (
                  <span className="text-sm">✅</span>
                ) : (
                  <span className="text-sm">🎪</span>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-semibold truncate leading-tight",
                  idx === safeIndex ? "text-gray-900 dark:text-gray-100 midnight:text-gray-100" : "text-gray-800 dark:text-gray-200 midnight:text-gray-200"
                )}>{getTitle(ev)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 midnight:text-gray-500 truncate mt-0.5">
                  {ev.date || ""}{ev.date && (ev.venue || ev.location) ? " · " : ""}{ev.venue || ev.location || ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ev._source && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold",
                    ev._source === "registered"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400"
                  )}>
                    {ev._source === "registered" ? "REG" : "DSC"}
                  </span>
                )}
                {ev.price && (
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-lg text-[10px] font-bold text-purple-600 dark:text-purple-400 midnight:text-purple-300 bg-purple-50 dark:bg-purple-900/20 midnight:bg-purple-900/20">
                    {ev.price}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Empty / no results state */
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 py-16">
            <div className={cn(
              "p-4 rounded-2xl",
              query ? "bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900" : "bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 ring-1 ring-fuchsia-500/10"
            )}>
              {query ? (
                <CalendarDays className="w-10 h-10 text-gray-400 dark:text-gray-500 midnight:text-gray-500" />
              ) : (
                <Sparkles className="w-10 h-10 text-fuchsia-500 dark:text-fuchsia-400 midnight:text-fuchsia-400" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300 mt-2">
              {query ? "No events found" : "Event Search"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center max-w-[260px]">
              {query ? "Try a different name, venue, or category" : `Search through ${allEvents.length} available events`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
