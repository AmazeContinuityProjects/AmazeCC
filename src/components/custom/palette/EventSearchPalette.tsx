"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search, CalendarDays, MapPin, DollarSign, X, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
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
  orderId?: string;
  eligibility?: string;
  receiptLink?: string;
  certificateLink?: string;
  payNowLink?: string;
  payLaterLink?: string;
  _source?: "registered" | "discover";
}

interface EventSearchPaletteProps {
  apiBase: string;
}

const badge = {
  violet: "bg-violet-100 text-violet-800 border-violet-300    dark:bg-violet-900/80 dark:text-violet-300 dark:border-violet-800/50",
  rose: "bg-rose-100 text-rose-800 border-rose-300    dark:bg-rose-900/80 dark:text-rose-300 dark:border-rose-800/50",
  amber: "bg-amber-100 text-amber-800 border-amber-300    dark:bg-amber-900/80 dark:text-amber-300 dark:border-amber-800/50",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300    dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-800/50",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300    dark:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-800/50",
  gray: "bg-gray-100 text-gray-700 border-gray-300    dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-700/50",
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[-–—/\\,.:;+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function mergeEvents(events: EventItem[]): EventItem[] {
  const byEid = new Map<string, EventItem>();
  const noEid: EventItem[] = [];

  for (const ev of events) {
    if (ev.eid) {
      if (!byEid.has(ev.eid)) {
        byEid.set(ev.eid, { ...ev });
      } else {
        const existing = byEid.get(ev.eid)!;
        byEid.set(ev.eid, { ...existing, ...ev, _source: existing._source === "registered" || ev._source === "registered" ? "registered" : "discover" });
      }
    } else {
      noEid.push(ev);
    }
  }

  const byName = new Map<string, EventItem>();
  for (const ev of noEid) {
    const name = (ev.name || ev.title || "").toLowerCase().trim();
    if (!name) continue;

    let matched = false;
    for (const [, eidEv] of byEid) {
      const eidName = (eidEv.name || eidEv.title || "").toLowerCase().trim();
      if (namesMatch(name, eidName)) {
        byEid.set(eidEv.eid!, { ...eidEv, ...ev, _source: eidEv._source === "registered" || ev._source === "registered" ? "registered" : "discover" });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const [, existing] of byName) {
      const prevName = (existing.name || existing.title || "").toLowerCase().trim();
      if (namesMatch(name, prevName)) {
        const merged = { ...existing, ...ev, _source: (existing._source === "registered" || ev._source === "registered" ? "registered" : "discover") as "registered" | "discover" };
        const key = existing.name || existing.title || name;
        byName.delete(key);
        byName.set(name, merged);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    byName.set(name, { ...ev });
  }

  const unnamed = noEid.filter(ev => !ev.name && !ev.title);
  return [...Array.from(byEid.values()), ...Array.from(byName.values()), ...unnamed];
}

export default function EventSearchPalette({ apiBase }: EventSearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "registered" | "discover">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [registeredEvents, setRegisteredEvents] = useState<EventItem[]>([]);
  const [eventHubEvents, setEventHubEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ imageSrc?: string; description?: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem("registeredEvents");
    let reg: EventItem[] = [];
    try { if (stored) reg = JSON.parse(stored); } catch {}
    setRegisteredEvents(reg);
    const isDemo = localStorage.getItem("demoMode") === "true";
    if (isDemo) {
      setEventHubEvents([
        {
          eid: "evt-001",
          title: "DevSprint '26 Hackathon",
          eligibility: "Open to all branches",
          type: "Coding Hackathon",
          date: "2026-07-15",
          location: "Netaji Auditorium",
          price: "Free",
        },
        {
          eid: "evt-002",
          title: "RoboSoccer Workshop",
          eligibility: "Open to all branches",
          type: "Robotics Workshop",
          date: "2026-07-22",
          location: "MG Block Lab 202",
          price: "Paid",
        }
      ]);
      setLoading(false);
      return;
    }
    fetch(`${apiBase}/api/events`).then(r => r.json()).then(data => {
      if (cancelled) return;
      setEventHubEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => { if (!cancelled) { setEventHubEvents([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [apiBase]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch preview data when event is selected
  useEffect(() => {
    if (!selectedEvent?.eid) { setPreviewData(null); setPreviewError(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewError(null);
    let username = localStorage.getItem("username") || "";
    let password = localStorage.getItem("password") || "";
    if (!username || !password) {
      try {
        const ids = JSON.parse(localStorage.getItem("IDs") || "{}");
        username = ids.VtopUsername || "";
        password = ids.VtopPassword || "";
      } catch {}
    }
    if (!username || !password) { setPreviewLoading(false); setPreviewError("VTOP credentials not found. Login to view posters."); return; }
    const isDemo = localStorage.getItem("demoMode") === "true";
    if (isDemo) {
      setTimeout(() => {
        if (cancelled) return;
        setPreviewData({
          description: selectedEvent.eid === "evt-001"
            ? "Build innovative products and compete for cash prizes at the annual flagship dev sprint event hosted by VIT Chennai's Coding Club."
            : "Hands-on calibration workshop for micro-controllers and servo engines to build autonomous soccer robots.",
        });
        setPreviewLoading(false);
      }, 100);
      return;
    }
    fetch(`${apiBase}/api/events/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, eid: selectedEvent.eid }),
    }).then(async r => {
      if (cancelled) return;
      if (!r.ok) { setPreviewError(`Preview fetch failed (${r.status})`); setPreviewLoading(false); return; }
      const data = await r.json();
      if (cancelled) return;
      if (data?.imageSrc || data?.description) setPreviewData({ imageSrc: data.imageSrc, description: data.description });
      else setPreviewError("No poster or description available");
      setPreviewLoading(false);
    }).catch(() => { if (!cancelled) { setPreviewError("Network error fetching poster"); setPreviewLoading(false); } });
    return () => { cancelled = true; };
  }, [selectedEvent?.eid, apiBase]);

  const totalCount = (registeredEvents?.length || 0) + (eventHubEvents?.length || 0);
  const tabs = [
    { id: "all" as const, label: "All Events", count: totalCount },
    { id: "registered" as const, label: "Registered", count: registeredEvents?.length || 0 },
    { id: "discover" as const, label: "Discover", count: eventHubEvents?.length || 0 },
  ];

  const allEvents = useMemo(() => {
    const registered = (registeredEvents || []).map(e => ({ ...e, _source: "registered" as const }));
    const discover = (eventHubEvents || []).map(e => ({ ...e, _source: "discover" as const }));
    return mergeEvents([...registered, ...discover]);
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
           (e.type || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.price || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.paymentStatus || "").toLowerCase().includes(query.toLowerCase()) ||
           (e.eligibility || "").toLowerCase().includes(query.toLowerCase())
    );
  }, [query, activeTab, allEvents]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  useEffect(() => { setSelectedIndex(0); }, [query, activeTab]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.children[selectedIndex] as HTMLElement | undefined;
    if (el) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      const cTop = container.scrollTop;
      const cBottom = cTop + container.clientHeight;
      if (top < cTop) {
        container.scrollTop = top - 10;
      } else if (bottom > cBottom) {
        container.scrollTop = bottom - container.clientHeight + 10;
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (selectedEvent) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSelectedEvent(null); setPreviewData(null); setPreviewError(null); setTimeout(() => inputRef.current?.focus(), 0); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, results.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); break;
      case "ArrowLeft": e.preventDefault(); if (!query) { const idx = tabs.findIndex(t => t.id === activeTab); if (idx > 0) { setActiveTab(tabs[idx - 1].id); setSelectedEvent(null); setPreviewData(null); setPreviewError(null); } } break;
      case "ArrowRight": e.preventDefault(); if (!query) { const idx = tabs.findIndex(t => t.id === activeTab); if (idx < tabs.length - 1) { setActiveTab(tabs[idx + 1].id); setSelectedEvent(null); setPreviewData(null); setPreviewError(null); } } break;
      case "Enter": e.preventDefault(); if (results[safeIndex]) { setSelectedEvent(results[safeIndex]); setPreviewData(null); setPreviewError(null); } break;
      case "Escape": break;
    }
  }, [results, safeIndex, selectedEvent, activeTab, query, tabs]);

  const getTitle = (e: EventItem) => e.title || e.name || "Untitled Event";
  const posterSrc = previewData?.imageSrc || selectedEvent?.posterUrl || "";
  const [posterFailed, setPosterFailed] = useState(false);
  const [showEnlarged, setShowEnlarged] = useState(false);
  useEffect(() => { setPosterFailed(false); }, [posterSrc]);

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-[320px] items-center justify-center">
        <Loader2 className="w-6 h-6 text-fuchsia-500 animate-spin" />
        <p className="text-sm text-gray-500  dark:text-gray-400 mt-3 animate-pulse">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[320px]" onKeyDown={handleKeyDown}>
      {/* Search header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200/60  dark:border-gray-800/30 bg-gradient-to-r from-fuchsia-500/[0.03] to-transparent">
        <div className="p-1.5 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-pink-500/15 shadow-sm">
          <Search className="w-4 h-4 text-fuchsia-600  dark:text-fuchsia-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events by name, venue, type..."
          className="flex-1 bg-transparent text-sm text-gray-900  dark:text-gray-100 placeholder-gray-400  dark:placeholder-gray-500 outline-none"
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700/40 dark:hover:bg-gray-800/40 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400  dark:text-gray-500 bg-gray-100  dark:bg-gray-900/60 rounded-lg border border-gray-200/60 dark:border-gray-700/30">
            {allEvents.length} events
          </kbd>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2.5 border-b border-gray-100/80  dark:border-gray-800/30 bg-gray-50/30 dark:bg-gray-900/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedEvent(null); setPreviewData(null); setPreviewError(null); inputRef.current?.focus(); }}
            className={cn(
              "relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab.id
                ? "bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 text-fuchsia-700  dark:text-fuchsia-300 shadow-sm"
                : "text-gray-500  dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 dark:hover:bg-gray-800/40"
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
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400  dark:text-gray-500">
            ← → tabs
          </kbd>
        )}
      </div>

      {/* Content area */}
      {selectedEvent ? (
        /* Detail view */
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <button
            onClick={() => { setSelectedEvent(null); setPreviewData(null); setPreviewError(null); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600  dark:text-fuchsia-400 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to results
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900 text-[10px] text-gray-400">esc</kbd>
          </button>

          {previewLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500  dark:text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading poster details...
            </div>
          )}
          {previewError && !previewLoading && (
            <div className="flex items-center gap-2 text-xs text-amber-600  dark:text-amber-300 bg-amber-50  dark:bg-amber-900/10 px-3 py-2 rounded-lg">
              {previewError}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex gap-4">
              {posterSrc && !posterFailed ? (
                <button onClick={() => setShowEnlarged(true)} className="shrink-0 w-28 h-36 rounded-xl overflow-hidden bg-gray-100  dark:bg-gray-900 shadow-md ring-1 ring-black/5 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
                  <img src={posterSrc} alt="" className="w-full h-full object-cover" onError={() => setPosterFailed(true)} />
                </button>
              ) : (
                <div className="shrink-0 w-28 h-36 rounded-xl bg-gray-100  dark:bg-gray-900/60 flex items-center justify-center shadow-sm ring-1 ring-black/5">
                  <CalendarDays className="w-8 h-8 text-gray-400  dark:text-gray-500/60" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  {!posterSrc && !selectedEvent.eid && (
                    <div className={cn(
                      "p-3 rounded-xl shrink-0 shadow-sm",
                      selectedEvent._source === "registered"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                        : "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600"
                    )}>
                      <CalendarDays className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{getTitle(selectedEvent)}</p>
                    <span className={cn(
                      "inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold",
                      selectedEvent._source === "registered"
                        ? "bg-emerald-100 text-emerald-800   dark:bg-emerald-900/80 dark:text-emerald-300"
                        : "bg-fuchsia-100 text-fuchsia-800   dark:bg-fuchsia-900/80 dark:text-fuchsia-300"
                    )}>
                      {selectedEvent._source === "registered" ? "Registered" : "Discover"}
                    </span>
                  </div>
                </div>
                {selectedEvent.eligibility && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">Eligibility: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedEvent.eligibility}</span></p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(selectedEvent.date || selectedEvent.time) && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.violet}`}>
                  <CalendarDays className="w-3 h-3" />
                  {selectedEvent.date}{selectedEvent.time ? ` · ${selectedEvent.time}` : ""}
                </span>
              )}
              {(selectedEvent.venue || selectedEvent.location) && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.rose}`}>
                  <MapPin className="w-3 h-3" />
                  {selectedEvent.venue || selectedEvent.location}
                </span>
              )}
              {(selectedEvent.price || selectedEvent.paymentStatus) && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border",
                  (selectedEvent.paymentStatus || "").toLowerCase().includes("paid")
                    ? badge.amber
                    : badge.emerald
                )}>
                  <DollarSign className="w-3 h-3" />
                  {selectedEvent.paymentStatus || selectedEvent.price}
                </span>
              )}
              {selectedEvent.type && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.indigo}`}>
                  {selectedEvent.type}
                </span>
              )}
              {selectedEvent.eligibility && !selectedEvent.type && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.gray}`}>
                  {selectedEvent.eligibility}
                </span>
              )}
            </div>

            {(previewData?.description || selectedEvent.description) && (
              <div className="px-4 py-3 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30">
                <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-1.5 uppercase tracking-wider">Description</p>
                <p className="text-xs font-medium text-gray-900  dark:text-white leading-relaxed">{previewData?.description || selectedEvent.description}</p>
              </div>
            )}

            {selectedEvent.eid && (
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.gray}`}>
                Event ID: {selectedEvent.eid}
              </div>
            )}
          </div>
        </div>
      ) : results.length > 0 ? (
        /* Results list */
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-smooth">
          {query && (
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-[11px] font-medium text-gray-400  dark:text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900/60 text-[10px] text-gray-400 dark:text-gray-500">↑↓ navigate · enter to view</kbd>
            </div>
          )}
          {results.map((ev, idx) => (
            <button
              key={`${ev.eid || ev._source}-${idx}`}
              onClick={() => { setSelectedEvent(ev); setPreviewData(null); }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                idx === safeIndex
                  ? "bg-gradient-to-r from-fuchsia-50 to-pink-50   dark:from-fuchsia-900/20 dark:to-pink-900/10 text-gray-900  dark:text-gray-100 shadow-sm ring-1 ring-fuchsia-500/10"
                  : "text-gray-700  dark:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 dark:hover:bg-gray-800/30"
              )}
            >
              {ev.posterUrl ? (
                <span className="shrink-0 w-9 h-12 rounded-lg overflow-hidden bg-gray-100  dark:bg-gray-900 shadow-sm ring-1 ring-black/5">
                  <img src={ev.posterUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </span>
              ) : (
                <span className={cn(
                  "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-sm transition-all",
                  idx === safeIndex
                    ? "bg-white  dark:bg-gray-900 shadow-sm ring-1 ring-black/5"
                    : "bg-gray-100/80  dark:bg-gray-900/60"
                )}>
                  {ev._source === "registered" ? (
                    <span className="text-sm">✅</span>
                  ) : (
                    <span className="text-sm">🎪</span>
                  )}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-semibold truncate leading-tight",
                  idx === safeIndex ? "text-gray-900  dark:text-gray-100" : "text-gray-800  dark:text-gray-200"
                )}>{getTitle(ev)}</p>
                <p className="text-[11px] text-gray-400  dark:text-gray-500 truncate mt-0.5">
                  {ev.date || ""}{ev.date && (ev.venue || ev.location) ? " · " : ""}{ev.venue || ev.location || ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ev._source && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold",
                    ev._source === "registered"
                      ? "bg-emerald-100 text-emerald-800   dark:bg-emerald-900/80 dark:text-emerald-300"
                      : "bg-fuchsia-100 text-fuchsia-800   dark:bg-fuchsia-900/80 dark:text-fuchsia-300"
                  )}>
                    {ev._source === "registered" ? "REG" : "DSC"}
                  </span>
                )}
                {ev.price && (
                  <span className={`inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-lg text-[10px] font-bold border ${badge.gray}`}>
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
              query ? "bg-gray-100  dark:bg-gray-900" : "bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 ring-1 ring-fuchsia-500/10"
            )}>
              {query ? (
                <CalendarDays className="w-10 h-10 text-gray-400  dark:text-gray-500" />
              ) : (
                <Sparkles className="w-10 h-10 text-fuchsia-500  dark:text-fuchsia-400" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-700  dark:text-gray-300 mt-2">
              {allEvents.length === 0 ? "No events available" : query ? "No events found" : "Event Search"}
            </p>
            <p className="text-xs text-gray-400  dark:text-gray-500 text-center max-w-[260px]">
              {allEvents.length === 0 ? "Check back later for new events" : query ? "Try a different name, venue, or category" : `Search through ${allEvents.length} available events`}
            </p>
          </div>
        </div>
      )}

      {showEnlarged && posterSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70  p-4"
          onClick={() => setShowEnlarged(false)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setShowEnlarged(false); } }}
          tabIndex={0}
          role="dialog"
        >
          <div className="relative max-w-[90vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl bg-black/10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowEnlarged(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/90 hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={posterSrc} alt="" className="w-auto h-auto max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
