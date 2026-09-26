"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Hash,
  Layers,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { api } from "@/lib/sync-engine";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import { DEMO_BOOKS, DEMO_DETAILS } from "@/lib/libraries/demo";
import {
  PAGE_SIZE,
  SEARCH_LABELS,
  dedupeBooks,
  formatIsbns,
  groupHoldings,
  holdingStatusTone,
  totalPages as calcTotalPages,
  type BookDetail,
  type BookResult,
  type SearchIndex,
} from "@/lib/libraries/koha";
import {
  CHIP,
  EMPTY_STATE,
  LIST_ROW,
  LIST_SHELL,
  SEG_ACTIVE,
  SEG_IDLE,
  TONE_BADGE,
  TONE_TEXT,
} from "@/lib/libraries/ui";

interface CatalogSearchProps {
  /**
   * `page` docks the search bar to the bottom and lifts it with the keyboard.
   * `palette` keeps the bar at the top, because the command palette host is a
   * fixed-height panel where a dock makes no sense.
   */
  variant: "page" | "palette";
  isDemo?: boolean;
  /** Fired when a search completes, so the page can show it in its stats */
  onSearched?: (total: number, query: string) => void;
  autoFocus?: boolean;
}

export default function CatalogSearch({
  variant,
  isDemo,
  onSearched,
  autoFocus,
}: CatalogSearchProps) {
  const docked = variant === "page";
  const keyboardInset = useKeyboardInset();

  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState<SearchIndex>("kw");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Held in a ref so an inline parent callback can never retrigger the search
  const searchedRef = useRef(onSearched);
  searchedRef.current = onSearched;

  const results = useMemo(() => dedupeBooks(books), [books]);
  const pages = calcTotalPages(total);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const runSearch = useCallback(
    async (q: string, index: SearchIndex, off: number) => {
      const term = q.trim();
      if (!term) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setSearched(true);
      setSelectedBook(null);
      setDetail(null);
      setDetailError(null);
      setSelectedIndex(0);

      try {
        if (isDemo) {
          await new Promise((r) => setTimeout(r, 300));
          if (controller.signal.aborted) return;
          const lower = term.toLowerCase();
          const matched = DEMO_BOOKS.filter(
            (b) =>
              b.title.toLowerCase().includes(lower) ||
              (b.author || "").toLowerCase().includes(lower)
          );
          setBooks(matched);
          setTotal(matched.length);
          setOffset(0);
          searchedRef.current?.(matched.length, term);
          return;
        }

        const data: any = await api("koha/search", {
          query: { q: term, idx: index, offset: off, count: PAGE_SIZE },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (data?.success === false) {
          setError(data.error || "Search failed");
          setBooks([]);
          setTotal(0);
          return;
        }
        setBooks(Array.isArray(data?.books) ? data.books : []);
        setTotal(Number(data?.total) || 0);
        setOffset(off);
        searchedRef.current?.(Number(data?.total) || 0, term);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setError(e?.message || "Could not reach the catalog");
        setBooks([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [isDemo]
  );

  // Debounced live search — the previous palette fired a request per keystroke.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setBooks([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    const t = setTimeout(() => void runSearch(term, idx, 0), 320);
    return () => clearTimeout(t);
  }, [query, idx, runSearch]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openDetail = useCallback(
    async (book: BookResult) => {
      setSelectedBook(book);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);

      try {
        if (isDemo) {
          await new Promise((r) => setTimeout(r, 180));
          setDetail(DEMO_DETAILS[String(book.biblionumber)] || (book as BookDetail));
          return;
        }
        const data: any = await api("koha/detail", {
          query: { biblionumber: book.biblionumber },
        });
        if (data?.success === false) {
          setDetailError(data.error || "Could not load details");
          return;
        }
        setDetail(data?.book || (book as BookDetail));
      } catch (e: any) {
        setDetailError(e?.message || "Could not load details");
      } finally {
        setDetailLoading(false);
      }
    },
    [isDemo]
  );

  const closeDetail = useCallback(() => {
    setSelectedBook(null);
    setDetail(null);
    setDetailError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Keep the keyboard selection inside the viewport without the old
  // offsetTop maths (which was off by the number of header rows).
  useEffect(() => {
    if (selectedBook) return;
    const el = listRef.current?.children[selectedIndex + 1] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, selectedBook, results.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (selectedBook) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDetail();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const book = results[selectedIndex];
      if (book) void openDetail(book);
    }
  };

  const isbns = formatIsbns(detail?.isbn);
  const groups = useMemo(() => groupHoldings(detail?.holdings || []), [detail]);

  // ── Search bar ────────────────────────────────────────────────────────
  const fieldChips = (
    <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs overflow-x-auto hide-scrollbar">
      {(Object.keys(SEARCH_LABELS) as SearchIndex[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setIdx(k)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            idx === k ? SEG_ACTIVE : SEG_IDLE
          }`}
        >
          {SEARCH_LABELS[k]}
        </button>
      ))}
    </div>
  );

  const inputRow = (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void runSearch(query, idx, 0);
          }
        }}
        placeholder="Title, author, subject or ISBN…"
        aria-label="Search the library catalog"
        className={`w-full pl-10 ${query ? "pr-9" : "pr-4"} py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs`}
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // ── Result rows ───────────────────────────────────────────────────────
  const resultList = (
    <div className={LIST_SHELL}>
      {results.map((book, i) => {
        const available = Number(book.available);
        const hasAvailability = book.available !== undefined && !isNaN(available);
        return (
          <button
            key={book.biblionumber || i}
            type="button"
            onClick={() => void openDetail(book)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`${LIST_ROW} cursor-pointer ${
              i === selectedIndex && !selectedBook
                ? "bg-indigo-50/60 dark:bg-indigo-950/25"
                : ""
            }`}
          >
            {book.coverUrl ? (
              <span className="w-9 h-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
              </span>
            ) : (
              <span className="w-9 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-zinc-400" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                {book.title}
              </p>
              {book.author && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                  {book.author}
                </p>
              )}
            </div>
            {hasAvailability && (
              <span
                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${
                  available > 0 ? TONE_BADGE.emerald : TONE_BADGE.red
                }`}
              >
                {available > 0 ? `${available} free` : "All out"}
              </span>
            )}
            {book.isbn && <span className={`${CHIP} shrink-0 hidden sm:inline-block`}>ISBN</span>}
          </button>
        );
      })}
    </div>
  );

  const resultMeta =
    results.length > 0 ? (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          {total > results.length
            ? `${results.length} of ${total} results`
            : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </span>
        {variant === "palette" && (
          <kbd className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
            ↑↓ navigate · ↵ view
          </kbd>
        )}
      </div>
    ) : null;

  const pager =
    pages > 1 ? (
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => void runSearch(query, idx, Math.max(0, offset - PAGE_SIZE))}
          disabled={offset <= 0}
          aria-label="Previous page"
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          Page {currentPage} of {pages}
        </span>
        <button
          type="button"
          onClick={() => void runSearch(query, idx, offset + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= total}
          aria-label="Next page"
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    ) : null;

  // ── Detail view ───────────────────────────────────────────────────────
  const detailView = selectedBook ? (
    <div className="space-y-4">
      <button
        type="button"
        onClick={closeDetail}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer px-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to results
      </button>

      <div className="flex gap-4">
        {selectedBook.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedBook.coverUrl}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="w-20 h-28 object-cover rounded-xl shadow-md shrink-0"
          />
        ) : (
          <div className="w-20 h-28 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-zinc-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit leading-tight">
            {detail?.title || selectedBook.title}
          </h3>
          {selectedBook.author && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium mt-1">
              {selectedBook.author}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {selectedBook.publisher && <span className={CHIP}>{selectedBook.publisher}</span>}
            {detail?.edition && <span className={CHIP}>{detail.edition}</span>}
            {selectedBook.itemtype && <span className={CHIP}>{selectedBook.itemtype}</span>}
          </div>
        </div>
      </div>

      {detailLoading && (
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          Loading details…
        </div>
      )}

      {detailError && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold">
          {detailError} — showing basic info
        </div>
      )}

      {(isbns.length > 0 || detail?.ddc) && (
        <div className="p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {isbns.map((i) => (
              <div key={i} className="flex items-center gap-1.5 min-w-0">
                <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                  ISBN
                </span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                  {i}
                </span>
              </div>
            ))}
            {detail?.ddc && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                  DDC
                </span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                  {detail.ddc}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {detail?.subjects && detail.subjects.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Subjects
          </p>
          <div className="flex flex-wrap gap-1.5">
            {detail.subjects.map((s) => (
              <span key={s} className={CHIP}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {detail?.summary && (
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Summary
          </p>
          <p className="text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed">
            {detail.summary}
          </p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
            Copies & locations ({detail?.holdings?.length || 0})
          </p>
          {groups.map((g) => (
            <div
              key={g.key}
              className="p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${TONE_BADGE.amber}`}>
                      Floor {g.parsed.floor}
                    </span>
                    {g.parsed.row !== "—" && (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${TONE_BADGE.emerald}`}>
                        Row {g.parsed.row}
                      </span>
                    )}
                    {g.parsed.column !== "—" && (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${TONE_BADGE.violet}`}>
                        Col {g.parsed.column}
                      </span>
                    )}
                    {g.parsed.zone && (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${TONE_BADGE.cyan}`}>
                        {g.parsed.zone}
                      </span>
                    )}
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${TONE_BADGE.zinc}`}>
                      {g.total} cop{g.total === 1 ? "y" : "ies"}
                    </span>
                  </div>

                  {g.callNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {g.callNumbers.map((c) => (
                        <span key={c} className={`${CHIP} font-mono`}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    {g.holdings.map((h, i) => {
                      const tone = holdingStatusTone(h.status);
                      return (
                        <div key={h.itemId || i} className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {h.barcode || "—"}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${TONE_BADGE[tone]}`}
                          >
                            {h.status || "Unknown"}
                          </span>
                          {h.dateDue && (
                            <span className="font-medium text-amber-600 dark:text-amber-300">
                              due {new Date(h.dateDue).toLocaleDateString()}
                            </span>
                          )}
                          {h.currentLibrary && (
                            <span className="text-zinc-400 dark:text-zinc-500 truncate">
                              {h.currentLibrary}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className={`text-lg font-black font-outfit leading-none ${
                      g.available === g.total
                        ? TONE_TEXT.emerald
                        : g.available > 0
                        ? TONE_TEXT.amber
                        : TONE_TEXT.red
                    }`}
                  >
                    {g.available}/{g.total}
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">
                    available
                  </p>
                </div>
              </div>

              {g.key !== "__noloc__" && (
                <p className="mt-2 text-[9px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                  {g.key}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {detail?.description && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{detail.description}</p>
      )}
    </div>
  ) : null;

  // ── Body ──────────────────────────────────────────────────────────────
  const body = selectedBook ? (
    detailView
  ) : loading && !results.length ? (
    <div className={LIST_SHELL}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${LIST_ROW} pointer-events-none`}>
          <div className="w-9 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-2.5 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  ) : error ? (
    <div className={EMPTY_STATE}>
      <X className="w-7 h-7 text-red-400 mx-auto" />
      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">{error}</p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
        Check your connection and try again.
      </p>
    </div>
  ) : results.length > 0 ? (
    <div className="space-y-3">
      {resultMeta}
      <div ref={listRef}>{resultList}</div>
      {pager}
    </div>
  ) : searched ? (
    <div className={EMPTY_STATE}>
      <BookOpen className="w-7 h-7 text-zinc-400 mx-auto" />
      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">
        No books found
      </p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
        Try a different {SEARCH_LABELS[idx].toLowerCase()} or spelling.
      </p>
    </div>
  ) : (
    <div className={EMPTY_STATE}>
      <BookOpen className="w-7 h-7 text-zinc-400 mx-auto" />
      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">
        Library catalog
      </p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
        Search across the whole collection by keyword, title, author, subject or ISBN.
      </p>
    </div>
  );

  if (!docked) {
    return (
      <div
        className="flex flex-col h-full min-h-[320px]"
        onKeyDown={onKeyDown}
        role="search"
      >
        <div className="shrink-0 space-y-2 border-b border-zinc-200/60 dark:border-zinc-800/40 px-4 py-3">
          {inputRow}
          {fieldChips}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3">{body}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70dvh] min-h-[420px]" onKeyDown={onKeyDown} role="search">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-3">{body}</div>

      {/* Docked search bar — lifts above the on-screen keyboard */}
      <div
        className="shrink-0 border-t border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl"
        style={{
          transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
          paddingBottom: keyboardInset
            ? 12
            : "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}
      >
        <div className="px-3 pt-3 space-y-2">
          {inputRow}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">{fieldChips}</div>
            <button
              type="button"
              onClick={() => void runSearch(query, idx, 0)}
              disabled={loading || !query.trim()}
              aria-label="Search"
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

