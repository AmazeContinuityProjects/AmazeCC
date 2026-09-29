"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Eye,
  EyeOff,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { CHIP, LIST_ROW, SEARCH_FIELD } from "@/lib/uiTokens";
import {
  EmptyPanel,
  GhostButton,
  IconButton,
  ListRowText,
  ListShell,
  SectionHeader,
} from "../shared/primitives";

/**
 * Local Storage, as a subpage of Settings.
 *
 * This used to be a hand-rolled `fixed inset-0 z-50` overlay in the old
 * gray-and-blue dialect: its own `<h2>`, its own close button, a stack of
 * white cards each dumping up to 100 characters of JSON at you, no count, no
 * search, and no way to tell a 4-byte flag from a 40KB cache. It is now a
 * screen in the settings flow, so it inherits the page's header, its back
 * button, its system-back behaviour and its column width, and spends its own
 * budget on the two things an inspector actually needs: find a key, and see
 * how big it is.
 *
 * It reads `localStorage` itself rather than receiving a snapshot. The snapshot
 * was read once, on open, and went stale the moment any other part of the app
 * wrote a key — and a viewer of storage is exactly the page where "this is out
 * of date" is the worst possible answer.
 */

/** Substrings that make a value sensitive enough to hide until asked for. */
const SENSITIVE = ["password", "username", "ids", "token", "cookie", "secret"];

function isSensitive(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE.some((needle) => k.includes(needle));
}

/** `JSON.stringify(JSON.parse(v), null, 2)` when it is JSON, else `v`. */
function prettyPrint(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** 812 B / 4.2 KB / 1.3 MB. Bytes under 1 KB stay in bytes — "0.8 KB" is worse. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** One line, for the row subtitle. Newlines are the usual reason a JSON blob truncates. */
function singleLine(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

function readStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    // Private-mode Safari throws on `localStorage.length`. An empty page with an
    // explanation beats a blank page with a stack trace.
  }
  return out;
}

interface StorageRow {
  key: string;
  value: string;
  pretty: string;
  bytes: number;
  sensitive: boolean;
}

function StorageRowBlock({
  row,
  onDelete,
}: {
  row: StorageRow;
  onDelete: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(!row.sensitive);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(row.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className={LIST_ROW}>
        {/* Only the text is the expand target. Copy and delete are real
            sibling buttons, so a key row never nests a button in a button. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
        >
          <ListRowText
            title={row.key}
            titleTooltip={row.key}
            subtitle={singleLine(row.pretty)}
            className={row.sensitive && !revealed ? "blur-[3px] select-none" : ""}
          />
          {row.bytes > 90 && (
            <ChevronUp
              className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${
                open ? "" : "rotate-180"
              }`}
            />
          )}
        </button>

        <span className={`${CHIP} shrink-0 tabular-nums`}>{formatBytes(row.bytes)}</span>
        <IconButton
          onClick={copy}
          title={`Copy value of ${row.key}`}
          className="p-2 bg-transparent dark:bg-transparent border-transparent shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          )}
        </IconButton>
        <IconButton
          onClick={() => onDelete(row.key)}
          title={`Delete ${row.key}`}
          className="p-2 bg-transparent dark:bg-transparent border-transparent shadow-none hover:bg-red-500/10 dark:hover:bg-red-500/10"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
        </IconButton>
      </div>

      {open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 overflow-hidden">
            {row.sensitive && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Sensitive value
                </span>
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  {revealed ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Reveal
                    </>
                  )}
                </button>
              </div>
            )}
            <pre
              className={`max-h-72 overflow-auto whitespace-pre-wrap break-all p-3 text-[11px] font-mono leading-relaxed text-zinc-700 dark:text-zinc-300 ${
                row.sensitive && !revealed ? "blur-sm select-none" : ""
              }`}
            >
              {row.pretty}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocalStorageSubpage() {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  const load = useCallback(() => setEntries(readStorage()), []);

  // Read on mount. The old overlay read once, on open, from the parent's state.
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<StorageRow[]>(
    () =>
      Object.entries(entries)
        .map(([key, value]) => {
          const pretty = prettyPrint(value);
          return {
            key,
            value,
            pretty,
            // Measured on the raw string, which is what the browser is storing.
            bytes: value.length,
            sensitive: isSensitive(key),
          };
        })
        .sort((a, b) => a.key.localeCompare(b.key)),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.key.toLowerCase().includes(q) || r.pretty.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totalBytes = useMemo(() => rows.reduce((n, r) => n + r.bytes, 0), [rows]);
  const sensitiveCount = useMemo(() => rows.filter((r) => r.sensitive).length, [rows]);

  const handleDelete = useCallback(
    (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing useful to say; the reload below will show the truth anyway.
      }
      load();
    },
    [load]
  );

  const body = () => {
    if (rows.length === 0) {
      return (
        <EmptyPanel
          variant="dashed"
          icon={<Database className="w-6 h-6 text-zinc-400" />}
          title="Nothing stored yet"
          description="This browser has no local storage entries for the app. Sign in or sync once and they will appear here."
        />
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyPanel
          variant="dashed"
          icon={<Search className="w-6 h-6 text-zinc-400" />}
          title={`No key matches “${query.trim()}”`}
          description="Search looks at both the key and the value, so a fragment of stored JSON will find it too."
          action={
            <GhostButton onClick={() => setQuery("")}>
              <X className="w-3.5 h-3.5" />
              Clear search
            </GhostButton>
          }
        />
      );
    }
    return (
      <ListShell>
        {filtered.map((row) => (
          <StorageRowBlock key={row.key} row={row} onDelete={handleDelete} />
        ))}
      </ListShell>
    );
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Database}
        title="Stored keys"
        count={rows.length}
        right={
          rows.length > 0 ? (
            <button
              type="button"
              onClick={load}
              title="Re-read local storage"
              aria-label="Re-read local storage"
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          ) : null
        }
      />

      {/* A byte total and a sensitive-key count, because the question this page
          is asked is "how much is in here and is any of it a secret" — and
          neither is answerable by scrolling rows. */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Total size
            </p>
            <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 tabular-nums">
              {formatBytes(totalBytes)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Sensitive
            </p>
            <p
              className={`font-extrabold mt-0.5 tabular-nums ${
                sensitiveCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-white"
              }`}
            >
              {sensitiveCount} of {rows.length}
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="relative px-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keys and values"
            aria-label="Search stored keys"
            className={`${SEARCH_FIELD} pl-10 pr-9`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {sensitiveCount > 0 && rows.length > 0 && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
          {sensitiveCount} {sensitiveCount === 1 ? "key is" : "keys are"} hidden until
          revealed.
        </p>
      )}

      {body()}
    </div>
  );
}
