"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Receipt, RefreshCcw, TriangleAlert } from "lucide-react";
import { api } from "@/lib/sync-engine";
import { storage } from "@/lib/storage";
import { DEMO_DUES } from "@/lib/libraries/demo";
import { num, type LibraryDueResponse, type PatronTable } from "@/lib/libraries/koha";
import {
  CHIP,
  EMPTY_STATE,
  LIST_ROW,
  LIST_SHELL,
  SECTION_CHIP,
  TONE_BADGE,
  TONE_TEXT,
} from "@/lib/libraries/ui";

interface DuesViewProps {
  creds: { cookies: string[]; authorizedID: string; csrf: string } | null;
  isDemo?: boolean;
  refreshKey?: number;
  onTotals?: (outstanding: number, overdue: number) => void;
}

function renderTable(table: PatronTable, idx: number) {
  const headers = table.headers || [];
  return (
    <div key={idx} className="space-y-2">
      {table.caption && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
          {table.caption}
        </p>
      )}
      <div className={LIST_SHELL}>
        {(table.rows || []).map((row, ri) => (
          <div key={ri} className={LIST_ROW}>
            {(row || []).map((cell, ci) => (
              <div
                key={ci}
                className={`min-w-0 flex-1 ${ci === 0 ? "shrink-0 basis-1/4" : ""}`}
              >
                {ci === 0 ? (
                  <span className="text-xs font-bold text-zinc-900 dark:text-white font-outfit truncate block">
                    {String(cell ?? "—")}
                  </span>
                ) : (
                  <>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
                      {headers[ci] || ""}
                    </span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate block">
                      {String(cell ?? "—")}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DuesView({ creds, isDemo, refreshKey, onTotals }: DuesViewProps) {
  const [data, setData] = useState<LibraryDueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 250));
        setData(DEMO_DUES);
        return;
      }

      // The engine already prefetches this endpoint, so read its cache first.
      const cached = (() => {
        try {
          return storage.cache.get("library-due") as unknown as LibraryDueResponse | null;
        } catch {
          return null;
        }
      })();

      if (cached) {
        setData(cached);
        return;
      }

      if (!creds) return;
      const res: any = await api("library-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          cookies: creds.cookies,
          authorizedID: creds.authorizedID,
          csrf: creds.csrf,
        },
      });
      if (res?.success === false) {
        setError(res.error || "Could not load dues");
        return;
      }
      setData(res);
      try {
        storage.cache.set("library-due", res);
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Could not load dues");
    } finally {
      setLoading(false);
    }
  }, [creds, isDemo]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Headline figures for the landing cards
  const books = data?.books || [];
  const tables = data?.tables || [];
  const outstanding = books.length
    ? books.reduce((s, b) => s + num(b.dueAmount), 0)
    : 0;
  const overdue = books.filter((b) => num(b.daysOverdue) > 0).length;
  useEffect(() => {
    onTotals?.(outstanding, overdue);
  }, [outstanding, overdue, onTotals]);

  const warning = data?.messages?.warning;
  const errorMsg = data?.messages?.error || data?.error;

  if (loading && !data) {
    return (
      <div className={LIST_SHELL}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${LIST_ROW} pointer-events-none`}>
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={EMPTY_STATE}>
        <TriangleAlert className="w-7 h-7 text-red-400 mx-auto" />
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          <RefreshCcw className="w-3 h-3" />
          Try again
        </button>
      </div>
    );
  }

  const hasContent = books.length > 0 || tables.length > 0;

  if (!hasContent) {
    return (
      <div className={EMPTY_STATE}>
        <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">No dues</p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
          Nothing outstanding on your library account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(warning || errorMsg) && (
        <div
          className={`p-3 rounded-2xl border text-xs font-bold flex items-start gap-2 ${
            errorMsg
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>{errorMsg || warning}</span>
        </div>
      )}

      {/* Preferred shape: per-book dues with days overdue */}
      {books.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                Overdue books
              </h3>
              <span className={SECTION_CHIP}>{books.length}</span>
            </div>
            {overdue > 0 && (
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.red}`}
              >
                {overdue} overdue
              </span>
            )}
          </div>

          <div className={LIST_SHELL}>
            {books.map((b, i) => {
              const days = num(b.daysOverdue);
              return (
                <div key={`${b.isbn || b.title}-${i}`} className={LIST_ROW}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      days > 0 ? "bg-red-500" : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                      {b.title || "Untitled"}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                      {[b.author, b.isbn].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black font-outfit text-zinc-900 dark:text-white leading-tight">
                      ₹{num(b.dueAmount).toLocaleString("en-IN")}
                    </p>
                    {days > 0 && (
                      <p className="text-[10px] font-bold text-red-600 dark:text-red-400">
                        {days}d late
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback shape: generic caption/headers/rows tables */}
      {tables.map((t, i) => renderTable(t, i))}

      <button
        type="button"
        onClick={() => {
          try {
            storage.cache.remove("library-due");
          } catch {}
          void load();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
        Refresh dues
      </button>
    </div>
  );
}
