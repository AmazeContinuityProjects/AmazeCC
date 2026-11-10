"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useNow } from "@/lib/useNow";
import {
  formatSyncAge,
  getSyncFailures,
  getSyncTimes,
  lastSyncedAt,
  openFailure,
  STALE_AFTER_MS,
  subscribeSyncTimes,
} from "@/lib/syncTimes";
import { getOpMeta } from "@/lib/sync-engine/operation-registry";

const EMPTY = {};

/**
 * "Updated 5 min ago" for the sync ops behind a screen. Turns amber after a day
 * so old cached data never passes for live data, and when the last refresh of
 * one of these ops failed it says so and offers a retry of just that op
 * (replaying the failed call's own arguments). Renders nothing until the op
 * has synced or failed at least once (demo mode records neither).
 */
export default function LastSynced({ ops, className = "" }: { ops: readonly string[]; className?: string }) {
  const times = useSyncExternalStore(subscribeSyncTimes, getSyncTimes, () => EMPTY);
  const fails = useSyncExternalStore(subscribeSyncTimes, getSyncFailures, () => EMPTY);
  const now = useNow();
  const [retrying, setRetrying] = useState(false);

  const at = lastSyncedAt(ops, times);
  const failure = openFailure(ops, times, fails);
  if (at === null && !failure) return null;

  if (failure) {
    const label = getOpMeta(failure.op)?.label ?? failure.op;
    const retry = async () => {
      setRetrying(true);
      try {
        // Loaded on demand so every PageShell does not pull in the engine.
        const { runPageSync } = await import("@/lib/sync-engine/single-sync");
        await runPageSync({ title: label, steps: [{ op: failure.op, args: failure.args }], doneLine: `${label} updated` });
      } catch {
        /* the sync sheet already shows the error; the line stays until a success */
      } finally {
        setRetrying(false);
      }
    };
    return (
      <p
        className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 ${className}`.trim()}
        title={failure.message}
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          {label} didn&apos;t refresh{at !== null ? ` · showing data from ${formatSyncAge(at, now.getTime())}` : ""}
        </span>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-1.5 py-0.5 font-bold hover:bg-rose-500/10 disabled:opacity-60 cursor-pointer"
        >
          {retrying ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </p>
    );
  }

  const stale = now.getTime() - at! > STALE_AFTER_MS;
  return (
    <p
      className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium ${
        stale ? "text-amber-600 dark:text-amber-400" : "text-text-muted"
      } ${className}`.trim()}
      title={`Last synced ${new Date(at!).toLocaleString()}`}
    >
      <RefreshCw className="h-3 w-3" aria-hidden="true" />
      <span>
        Updated {formatSyncAge(at!, now.getTime())}
        {stale ? " · may be out of date" : ""}
      </span>
    </p>
  );
}
