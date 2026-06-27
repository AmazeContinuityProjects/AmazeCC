"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, BookOpen, Loader2, ExternalLink, X, ArrowLeft, MapPin, Hash, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Holding {
  itemId: string;
  barcode: string;
  shelvingLocation: string;
  callNumber: string;
  status: string;
  currentLibrary: string;
  homeLibrary: string;
  dateDue: string | null;
}

interface BookDetail {
  title: string;
  author: string;
  publisher: string;
  edition: string;
  isbn: string;
  description: string;
  subjects: string[];
  ddc: string;
  summary: string;
  holdings: Holding[];
}

interface BookResult {
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  biblionumber?: string;
  coverUrl?: string;
}

interface LibrarySearchPaletteProps {
  apiBase: string;
}

const ROMAN_MAP: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6" };
const FLOOR_INDICATORS = new Set(["FLOOR", "FLR", "F", "LEVEL", "LVL", "L"]);
const ZONE_KEYWORDS = new Set(["STACK", "STACKS", "REF", "REFERENCE", "RESERVE", "OVERSIZE", "PERIODICAL", "THESIS", "CD", "DVD", "MEDIA"]);

function parseLocation(loc: string): { floor: string; row: string; column: string; zone: string } {
  const parts = (loc || "").split(/[_/\s-]+/).filter(Boolean);
  let floor = "", row = "", column = "", zone = "";
  let floorIdx = -1;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const upper = p.toUpperCase();

    if (/^R\d+$/i.test(p)) { row = upper; continue; }
    if (/^C\d+$/i.test(p)) { column = upper; continue; }
    if (ZONE_KEYWORDS.has(upper)) { zone = upper.charAt(0) + upper.slice(1).toLowerCase(); continue; }

    if (FLOOR_INDICATORS.has(upper)) { floorIdx = i; continue; }

    if (!floor) {
      if (/^\d+$/.test(p)) { floor = p; continue; }
      const roman = ROMAN_MAP[upper];
      if (roman) { floor = roman; continue; }
      if (FLOOR_INDICATORS.has(upper)) { floorIdx = i; continue; }
    }
  }

  const nextAfterFloor = floorIdx >= 0 && floorIdx + 1 < parts.length ? parts[floorIdx + 1].toUpperCase() : "";
  if (!floor && nextAfterFloor) {
    if (/^\d+$/.test(nextAfterFloor)) floor = nextAfterFloor;
    else floor = ROMAN_MAP[nextAfterFloor] || "";
  }

  return { floor: floor || "—", row: row || "—", column: column || "—", zone: zone || "" };
}

// Solid color badge classes that work across supported themes
const badge = {
  floor: "bg-amber-100 text-amber-800 border-amber-300    dark:bg-amber-900/80 dark:text-amber-300 dark:border-amber-800/50",
  row: "bg-emerald-100 text-emerald-800 border-emerald-300    dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-800/50",
  col: "bg-violet-100 text-violet-800 border-violet-300    dark:bg-violet-900/80 dark:text-violet-300 dark:border-violet-800/50",
  zone: "bg-cyan-100 text-cyan-800 border-cyan-300    dark:bg-cyan-900/80 dark:text-cyan-300 dark:border-cyan-800/50",
  gray: "bg-gray-100 text-gray-700 border-gray-300    dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-700/50",
  blue: "bg-blue-100 text-blue-800 border-blue-300    dark:bg-blue-900/80 dark:text-blue-300 dark:border-blue-800/50",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300    dark:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-800/50",
  purple: "bg-purple-100 text-purple-800 border-purple-300    dark:bg-purple-900/80 dark:text-purple-300 dark:border-purple-800/50",
};

export default function LibrarySearchPalette({ apiBase }: LibrarySearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [bookDetail, setBookDetail] = useState<BookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setBooks([]); setLoading(false); return; }
    setLoading(true);
    const controller = new AbortController();
    fetch(`${apiBase}/api/koha/search?q=${encodeURIComponent(query)}&count=20`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setBooks(data?.success && Array.isArray(data?.books) ? data.books : []);
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) { setBooks([]); setLoading(false); } });
    return () => controller.abort();
  }, [query, apiBase]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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

  useEffect(() => {
    if (!selectedBook?.biblionumber) { setBookDetail(null); setDetailError(null); return; }
    setDetailLoading(true);
    setDetailError(null);
    const controller = new AbortController();
    fetch(`${apiBase}/api/koha/detail?biblionumber=${selectedBook.biblionumber}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data?.success && data?.book) { setBookDetail(data.book); setDetailLoading(false); }
        else { setDetailError("Could not load book details"); setDetailLoading(false); }
      })
      .catch(() => { if (!controller.signal.aborted) { setDetailError("Failed to load details"); setDetailLoading(false); } });
    return () => controller.abort();
  }, [selectedBook?.biblionumber, apiBase]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const seen = new Set<string>();
    const deduped: BookResult[] = [];
    for (const b of books) {
      if (!(b.title || "").toLowerCase().includes(query.toLowerCase()) &&
          !(b.author || "").toLowerCase().includes(query.toLowerCase())) continue;
      const key = b.isbn || `${(b.title || "").toLowerCase()}|${(b.author || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(b);
    }
    return deduped;
  }, [query, books]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (selectedBook) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSelectedBook(null); setBookDetail(null); setDetailError(null); setTimeout(() => inputRef.current?.focus(), 0); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, results.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); break;
      case "Enter": e.preventDefault(); if (results[safeIndex]) { setSelectedBook(results[safeIndex]); } break;
      case "Escape": break;
    }
  }, [results, safeIndex, selectedBook]);

  return (
    <div className="flex flex-col h-full min-h-[320px]" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200/60  dark:border-gray-800/30 bg-gradient-to-r from-blue-500/[0.03] to-transparent">
        <div className="p-1.5 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 shadow-sm">
          <Search className="w-4 h-4 text-blue-600  dark:text-blue-400" />
        </div>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or keyword..."
          className="flex-1 bg-transparent text-sm text-gray-900  dark:text-gray-100 placeholder-gray-400  dark:placeholder-gray-500 outline-none"
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700/40 dark:hover:bg-gray-800/40 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400  dark:text-gray-500 bg-gray-100  dark:bg-gray-900/60 rounded-lg border border-gray-200/60 dark:border-gray-700/30">
            Type to search
          </kbd>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500  dark:text-gray-400 animate-pulse">Searching library catalog...</p>
          </div>
        </div>
      ) : selectedBook ? (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <button
            onClick={() => { setSelectedBook(null); setBookDetail(null); setDetailError(null); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600  dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to results
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900 text-[10px] text-gray-400">esc</kbd>
          </button>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500  dark:text-gray-400">Loading details...</span>
            </div>
          ) : detailError ? (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-sm font-medium text-red-500">{detailError}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Showing basic info</p>
            </div>
          ) : null}

          {bookDetail ? (
            <div className="space-y-5">
              <div className="flex gap-4">
                {selectedBook?.coverUrl ? (
                  <div className="shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-gray-100  dark:bg-gray-900 shadow-md ring-1 ring-black/5">
                    <img src={selectedBook.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-32 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100   dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center border border-gray-300 dark:border-gray-700/50">
                    <BookOpen className="w-8 h-8 text-blue-400  dark:text-blue-500/60" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-bold text-gray-900  dark:text-white leading-snug">{bookDetail.title || selectedBook?.title}</p>
                  {bookDetail.author && <p className="text-xs text-gray-600  dark:text-gray-400">by <span className="font-medium text-gray-800  dark:text-gray-300">{bookDetail.author}</span></p>}
                  {bookDetail.publisher && <p className="text-xs text-gray-600  dark:text-gray-400">{bookDetail.publisher}</p>}
                  {bookDetail.edition && <p className="text-xs text-gray-500  dark:text-gray-400 italic">{bookDetail.edition}</p>}
                </div>
              </div>

              {/* ISBNs */}
              {bookDetail.isbn && (
                <div className="flex flex-wrap gap-1.5">
                  {bookDetail.isbn.split(/[,;]+/).filter(Boolean).map((isbn, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.gray}`}>
                      <Hash className="w-3 h-3" />
                      ISBN: {isbn.trim()}
                    </span>
                  ))}
                  {bookDetail.ddc && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.indigo}`}>
                      <Layers className="w-3 h-3" />
                      DDC: {bookDetail.ddc}
                    </span>
                  )}
                </div>
              )}

              {/* Subjects */}
              {bookDetail.subjects?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-1.5 uppercase tracking-wider">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {bookDetail.subjects.map((s, i) => (
                      <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.blue}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {bookDetail.summary && (
                <div className="px-4 py-3 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30">
                  <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-1.5 uppercase tracking-wider">Summary</p>
                  <p className="text-xs font-medium text-gray-900  dark:text-white leading-relaxed">{bookDetail.summary}</p>
                </div>
              )}

              {/* Holdings / Location — grouped by shelving location */}
              {bookDetail.holdings?.length > 0 && (() => {
                const groups = new Map<string, { holdings: Holding[]; parsed: ReturnType<typeof parseLocation>; callNumbers: Set<string>; available: number; total: number }>();
                for (const h of bookDetail.holdings) {
                  const key = h.shelvingLocation || "__noloc__";
                  if (!groups.has(key)) groups.set(key, { holdings: [], parsed: parseLocation(key), callNumbers: new Set(), available: 0, total: 0 });
                  const g = groups.get(key)!;
                  g.holdings.push(h);
                  g.total++;
                  if (h.callNumber) g.callNumbers.add(h.callNumber);
                  if (h.status === "Available") g.available++;
                }
                return (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-2 uppercase tracking-wider">Copies & Locations ({bookDetail.holdings.length})</p>
                    <div className="space-y-2">
                      {Array.from(groups.entries()).map(([key, g]) => (
                        <div key={key} className="px-4 py-3 rounded-xl bg-white  dark:bg-gray-900/50 border border-gray-200/50  dark:border-gray-800/30 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <div className="p-1 rounded-lg bg-blue-100  dark:bg-blue-900/80 shrink-0">
                                  <MapPin className="w-3.5 h-3.5 text-blue-600  dark:text-blue-400" />
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.floor}`}>
                                  Floor {g.parsed.floor}
                                </span>
                                {g.parsed.row !== "—" && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.row}`}>
                                    Row {g.parsed.row}
                                  </span>
                                )}
                                {g.parsed.column !== "—" && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.col}`}>
                                    Col {g.parsed.column}
                                  </span>
                                )}
                                {g.parsed.zone && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.zone}`}>
                                    {g.parsed.zone}
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold border ${badge.gray}`}>
                                  {g.total} copy{g.total !== 1 ? "ies" : "y"}
                                </span>
                              </div>

                              {/* Call numbers */}
                              {g.callNumbers.size > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {Array.from(g.callNumbers).map((cn, ci) => (
                                    <span key={ci} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium border ${badge.purple} font-mono`}>
                                      {cn}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Compact barcode list */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-500  dark:text-gray-400">
                                {g.holdings.map((h, hi) => (
                                  <span key={h.itemId || hi} className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "inline-block w-1.5 h-1.5 rounded-full",
                                      h.status === "Available" ? "bg-emerald-500" : h.status === "Checked out" ? "bg-amber-500" : "bg-red-500"
                                    )} />
                                    <span className="font-mono text-[10px] text-gray-700  dark:text-gray-300">{h.barcode || "—"}</span>
                                    <span className={cn(
                                      "text-[9px] font-bold px-1 py-0.5 rounded",
                                      h.status === "Available" ? "bg-emerald-100 text-emerald-800   dark:bg-emerald-900/80 dark:text-emerald-300" : h.status === "Checked out" ? "bg-amber-100 text-amber-800   dark:bg-amber-900/80 dark:text-amber-300" : "bg-red-100 text-red-800   dark:bg-red-900/80 dark:text-red-300"
                                    )}>{h.status}</span>
                                    {h.dateDue && <span className="text-[9px] font-medium text-amber-600  dark:text-amber-300">due {new Date(h.dateDue).toLocaleDateString()}</span>}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Availability summary */}
                            <div className="shrink-0 text-right">
                              <div className={cn(
                                "text-lg font-black",
                                g.available === g.total ? "text-emerald-600 dark:text-emerald-400" : g.available > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {g.available}/{g.total}
                              </div>
                              <p className="text-[9px] text-gray-400  dark:text-gray-500 mt-0.5">available</p>
                            </div>
                          </div>

                          {key !== "__noloc__" && (
                            <p className="mt-2 text-[9px] text-gray-400  dark:text-gray-500 font-mono">{key}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Description (MARC 300) */}
              {bookDetail.description && (
                <div className="px-4 py-3 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30">
                  <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-1 uppercase tracking-wider">Physical Details</p>
                  <p className="text-xs text-gray-700  dark:text-gray-300">{bookDetail.description}</p>
                </div>
              )}
            </div>
          ) : (
            !detailLoading && (
              <div className="flex gap-4">
                {selectedBook?.coverUrl ? (
                  <div className="shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-gray-100  dark:bg-gray-900 shadow-md ring-1 ring-black/5">
                    <img src={selectedBook.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-32 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100   dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center border border-gray-300 dark:border-gray-700/50">
                    <BookOpen className="w-8 h-8 text-blue-400  dark:text-blue-500/60" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2.5">
                  <p className="text-sm font-bold text-gray-900  dark:text-white leading-snug">{selectedBook?.title}</p>
                  {selectedBook?.author && <p className="text-xs text-gray-600  dark:text-gray-400">by <span className="font-medium text-gray-800  dark:text-gray-300">{selectedBook.author}</span></p>}
                  {selectedBook?.publisher && <p className="text-xs text-gray-600  dark:text-gray-400">{selectedBook.publisher}</p>}
                  {selectedBook?.isbn && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.gray}`}>
                      <Hash className="w-3 h-3" />
                      ISBN: {selectedBook.isbn}
                    </span>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ) : results.length > 0 ? (
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-smooth">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[11px] font-medium text-gray-400  dark:text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100  dark:bg-gray-900/60 text-[10px] text-gray-400 dark:text-gray-500">↑↓ navigate · enter to view</kbd>
          </div>
          {results.map((book, idx) => (
            <button
              key={book.biblionumber || idx}
              onClick={() => setSelectedBook(book)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                idx === safeIndex
                  ? "bg-gradient-to-r from-blue-50 to-purple-50   dark:from-blue-900/20 dark:to-purple-900/10 text-gray-900  dark:text-gray-100 shadow-sm ring-1 ring-blue-500/10"
                  : "text-gray-700  dark:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 dark:hover:bg-gray-800/30"
              )}
            >
              {book.coverUrl ? (
                <span className="shrink-0 w-9 h-12 rounded-lg overflow-hidden bg-gray-100  dark:bg-gray-900 shadow-sm ring-1 ring-black/5">
                  <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                </span>
              ) : (
                <span className={cn(
                  "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-sm transition-all",
                  idx === safeIndex
                    ? "bg-white  dark:bg-gray-900 shadow-sm ring-1 ring-black/5"
                    : "bg-gray-100/80  dark:bg-gray-900/60"
                )}>
                  <BookOpen className="w-4 h-4 text-gray-400  dark:text-gray-500" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-semibold truncate leading-tight",
                  idx === safeIndex ? "text-gray-900  dark:text-gray-100" : "text-gray-800  dark:text-gray-200"
                )}>{book.title}</p>
                {book.author && (
                  <p className="text-[11px] text-gray-500  dark:text-gray-500 truncate mt-0.5">{book.author}</p>
                )}
              </div>
              {book.isbn && (
                <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-8 rounded-lg text-[10px] font-bold shrink-0 transition-all ${badge.gray}`}>
                  ISBN
                </span>
              )}
            </button>
          ))}
        </div>
      ) : query ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 py-12">
            <div className="p-3 rounded-2xl bg-gray-100  dark:bg-gray-900">
              <BookOpen className="w-6 h-6 text-gray-400  dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-500  dark:text-gray-400">No books found</p>
            <p className="text-xs text-gray-400  dark:text-gray-500">Try a different title, author, or keyword</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 py-16">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 ring-1 ring-blue-500/10">
              <BookOpen className="w-10 h-10 text-blue-500  dark:text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700  dark:text-gray-300 mt-2">Library Catalog</p>
            <p className="text-xs text-gray-400  dark:text-gray-500 text-center max-w-[260px]">Search for books by title, author, or ISBN across the library collection</p>
          </div>
        </div>
      )}
    </div>
  );
}
