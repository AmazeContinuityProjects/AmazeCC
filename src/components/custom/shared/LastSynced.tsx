"use client";

import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { useNow } from "@/lib/useNow";
import { formatSyncAge, getSyncTimes, lastSyncedAt, STALE_AFTER_MS, subscribeSyncTimes } from "@/lib/syncTimes";

const EMPTY = {};

/**
 * "Updated 5 min ago" for the sync ops behind a screen. Turns amber after a day
 * so old cached data never passes for live data. Renders nothing until the op
 * has synced at least once (demo mode never records a time).
 */
export default function LastSynced({ ops, className = "" }: { ops: readonly string[]; className?: string }) {
  const times = useSyncExternalStore(subscribeSyncTimes, getSyncTimes, () => EMPTY);
  const now = useNow();
  const at = lastSyncedAt(ops, times);
  if (at === null) return null;
  const stale = now.getTime() - at > STALE_AFTER_MS;
  return (
    <p
      className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium ${
        stale ? "text-amber-600 dark:text-amber-400" : "text-text-muted"
      } ${className}`.trim()}
      title={`Last synced ${new Date(at).toLocaleString()}`}
    >
      <RefreshCw className="h-3 w-3" aria-hidden="true" />
      <span>
        Updated {formatSyncAge(at, now.getTime())}
        {stale ? " · may be out of date" : ""}
      </span>
    </p>
  );
}
