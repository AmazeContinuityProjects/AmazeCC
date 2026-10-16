import { syncEngine } from "./index";
import {
  appendSyncLine,
  closeSyncSession,
  openOfflineSyncSession,
  openSyncSession,
  setSyncProgress,
} from "./sync-session";

export interface PageSyncStep {
  /** Registered engine op, e.g. `"grades"` or `"bulk"`. */
  op: string;
  args?: Record<string, unknown>;
  /** Mirror the result into local component state (atoms are already set). */
  apply?: (result: any) => void | Promise<void>;
}

export interface PageSyncOptions {
  /** Sheet title, e.g. `"Exam Schedule"`. */
  title: string;
  steps: PageSyncStep[];
  /** Closing line on success, e.g. `"Grades reloaded successfully"`. */
  doneLine?: string;
}

/**
 * One screen's reload, run exactly once through the engine with a guaranteed
 * session lifecycle: open → run → 100 → close (or 0 → close on error).
 *
 * Every screen-level refresh should go through here instead of re-deriving
 * the open/progress/close sequence. Per-op start/done lines come from
 * the engine feed itself, so callers only add their closing line.
 *
 * Returns the last step's result, or `null` when offline (the offline notice
 * is shown instead). Rethrows on failure after closing the session as an
 * error, so callers can still set local error/loading state.
 */
export async function runPageSync<T = any>(opts: PageSyncOptions): Promise<T | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    openOfflineSyncSession();
    return null;
  }
  openSyncSession(opts.title);
  try {
    let last: any = null;
    for (const step of opts.steps) {
      last = await syncEngine.sync(step.op, step.args ?? {});
      await step.apply?.(last);
    }
    if (opts.doneLine) appendSyncLine(opts.doneLine, "success");
    setSyncProgress(100);
    closeSyncSession();
    return last as T;
  } catch (err) {
    appendSyncLine(err instanceof Error ? err.message : "Sync failed, check console.", "error");
    setSyncProgress(0);
    closeSyncSession(4000, "error");
    throw err;
  }
}
