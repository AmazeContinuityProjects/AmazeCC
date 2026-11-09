/**
 * When each sync operation last succeeded, so screens can say "Updated 5 min
 * ago" instead of showing cached data as if it were live.
 *
 * Written by SyncEngine.sync() after every successful op (silent background
 * runs included, demo mode excluded). Stored as one small JSON map in
 * localStorage so it survives reloads; sign-out clears it with everything else.
 */
const KEY = "sync_times";
const EVENT = "amazecc:sync-times";

type SyncTimes = Record<string, number>;

function read(): SyncTimes {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as SyncTimes) : {};
  } catch {
    return {};
  }
}

let cache: SyncTimes | null = null;

export function getSyncTimes(): SyncTimes {
  if (typeof window === "undefined") return {};
  cache ??= read();
  return cache;
}

export function recordSyncTime(op: string, at = Date.now()): void {
  if (typeof window === "undefined") return;
  cache = { ...getSyncTimes(), [op]: at };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: the label is a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Most recent success among `ops`, or null if none has synced yet. */
export function lastSyncedAt(ops: readonly string[], times: SyncTimes = getSyncTimes()): number | null {
  let best: number | null = null;
  for (const op of ops) {
    const t = times[op];
    if (typeof t === "number" && (best === null || t > best)) best = t;
  }
  return best;
}

export function subscribeSyncTimes(cb: () => void): () => void {
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

// ---- Failures -------------------------------------------------------------
// Kept in memory only: retrying needs the exact args of the failed call, and
// some args (the bulk sweep's allGradesRes) are too large to persist. A reload
// starts clean, which is fine: the next sweep re-runs everything anyway.

export interface SyncFailure {
  op: string;
  at: number;
  message: string;
  args: Record<string, unknown>;
}

let failures: Record<string, SyncFailure> = {};

export function recordSyncFailure(op: string, message: string, args: Record<string, unknown>, at = Date.now()): void {
  failures = { ...failures, [op]: { op, at, message, args } };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function clearSyncFailure(op: string): void {
  if (!(op in failures)) return;
  const next = { ...failures };
  delete next[op];
  failures = next;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function getSyncFailures(): Record<string, SyncFailure> {
  return failures;
}

/**
 * The most recent failure among `ops` that is newer than that op's last
 * success, i.e. a refresh that failed and has not been fixed since.
 */
export function openFailure(
  ops: readonly string[],
  times: SyncTimes = getSyncTimes(),
  fails: Record<string, SyncFailure> = failures,
): SyncFailure | null {
  let worst: SyncFailure | null = null;
  for (const op of ops) {
    const f = fails[op];
    if (f && f.at > (times[op] ?? 0) && (!worst || f.at > worst.at)) worst = f;
  }
  return worst;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago". */
export function formatSyncAge(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** Older than this, the label switches to a warning tone. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
