/**
 * The one way to run the generator.
 *
 * Wraps the worker so a caller gets a promise and the browser gets a thread.
 * Both the tab and the modal go through here, which is what makes it a single
 * path: the tab used to run the solve inline, blocking the UI thread for the
 * whole backtrack, and the modal did the same. Neither does now.
 *
 * The parameters cross a structured clone, so they are plain data — no `Set`, no
 * class instances, no functions. `GenerateParams` says so in its own types.
 *
 * If the worker cannot be created — an old browser, a blocked blob, a static
 * export that emitted no worker chunk — this falls back to running the same pure
 * function inline. That is slower and blocks, but it is correct, and a planner
 * that shows nothing is worse than one that pauses.
 *
 * ## Two entry points, one implementation
 *
 * `generateTimetablesAsync` is the one-shot form every existing caller wants:
 * send, wait, get the answer. `startGeneration` is the watched form for a caller
 * that needs options on screen before the search finishes or needs a Cancel
 * button that actually stops something. The first is the second called without
 * hooks, so there is still only one path through the worker.
 */

import {
  generateTimetablesStream,
  type GenerateParams,
  type GenerateProgress,
  type GenerateResult,
} from "./generate";
import type { GeneratorErrorCode } from "./generate";
import type { TimetableState } from "../types";
import { sortTimetables } from "@/lib/timetableMetrics";

export type {
  GenerateParams,
  GenerateProgress,
  GenerateResult,
  GeneratorErrorCode,
};

/**
 * What the worker posts back.
 *
 * The two terminal shapes are the two `GenerateResult` branches a caller can
 * get; the two interim ones only arrive when the run was asked for as a stream.
 * The `type` field *is* the discriminant, and it is a string rather than a
 * boolean for the same non-strict-mode reason `GenerateResult` uses one.
 */
type WorkerReply =
  | { type: "success"; timetables: TimetableState[]; capped?: boolean }
  | { type: "batch"; timetables: TimetableState[] }
  | { type: "progress"; nodes: number; found: number; accepted: number }
  | { type: "cancelled"; timetables: TimetableState[] }
  | { type: "error"; code: GeneratorErrorCode; subjectCode?: string };

/** Watching a run: what to call while it is going. */
export interface GenerationOptions {
  /**
   * Accepted timetables, in search order.
   *
   * Not the settled order — sorting, faculty dedupe and variant grouping are
   * whole-result operations that happen once, on the result. A caller rendering
   * these is showing a work in progress and should expect to replace them.
   */
  onBatch?: (timetables: TimetableState[]) => void;
  onProgress?: (progress: GenerateProgress) => void;
}

export interface GenerationHandle {
  /**
   * Never rejects.
   *
   * A failure comes back as `{ kind: "error" }` with a code the caller turns
   * into its own message, so the user-facing strings stay in the UI where they
   * belong. A cancel comes back as `{ kind: "cancelled" }`.
   */
  result: Promise<GenerateResult>;
  /**
   * Stop the run.
   *
   * Idempotent, and safe before the run has started and after it has finished —
   * a Cancel button's handler does not get to know which of those it is in.
   */
  cancel: () => void;
}

/* ── inline ────────────────────────────────────────────────────────────── */

/**
 * Run it on this thread. Named so the fallback reads as a deliberate choice.
 *
 * Cancellation here cannot use `terminate()` — there is nothing to terminate —
 * so it goes through the cooperative `shouldStop` the walk polls. That is the
 * whole reason the hook exists rather than cancellation being worker-only.
 *
 * The first tick is a `setTimeout`, not a synchronous call: without it a cancel
 * raised in the same tick as the request would be observed before the caller
 * could possibly have set it, and the promise would settle inside the click
 * handler that started the run.
 */
function generateInline(
  params: GenerateParams,
  options: GenerationOptions,
  isCancelled: () => boolean
): Promise<GenerateResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve(
          generateTimetablesStream(params, {
            onBatch: options.onBatch,
            onProgress: options.onProgress,
            shouldStop: isCancelled,
          })
        );
      } catch {
        resolve({ kind: "error", code: "error" });
      }
    }, 0);
  });
}

/* ── worker ────────────────────────────────────────────────────────────── */

function generateInWorker(
  params: GenerateParams,
  options: GenerationOptions,
  stream: boolean
): GenerationHandle {
  let settled = false;
  let cancelled = false;
  let worker: Worker | null = null;
  /** Batches delivered so far, so a cancel still shows what was found. */
  const partial: TimetableState[] = [];

  let resolveResult: (outcome: GenerateResult) => void = () => {};
  const result = new Promise<GenerateResult>((resolve) => {
    resolveResult = resolve;
  });

  const finish = (outcome: GenerateResult) => {
    if (settled) return;
    settled = true;
    try {
      worker?.terminate();
    } catch {
      // A worker that cannot be terminated has already gone; the outcome is
      // what matters, so this is not worth reporting.
    }
    resolveResult(outcome);
  };

  const partialNow = (): TimetableState[] => sortTimetables([...partial], params.sortBy);

  const stop = () => {
    if (settled || cancelled) return;
    cancelled = true;
    finish({ kind: "cancelled", timetables: partialNow() });
  };

  try {
    worker = new Worker(new URL("../workers/generator.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    // No worker in this environment. Solve here rather than show nothing — and
    // keep the handle honest by giving the caller a cancel that works.
    const flag = { cancelled: false };
    return {
      result: generateInline(params, options, () => flag.cancelled),
      cancel: () => {
        flag.cancelled = true;
      },
    };
  }

  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const reply = event.data;
    switch (reply?.type) {
      case "batch":
        partial.push(...reply.timetables);
        options.onBatch?.(reply.timetables);
        return;
      case "progress":
        options.onProgress?.({
          nodes: reply.nodes,
          found: reply.found,
          accepted: reply.accepted,
        });
        return;
      case "success":
        finish({ kind: "ok", timetables: reply.timetables, capped: reply.capped ?? false });
        return;
      case "cancelled":
        finish({ kind: "cancelled", timetables: reply.timetables });
        return;
      case "error":
        finish({ kind: "error", code: reply.code, subjectCode: reply.subjectCode });
        return;
      default:
        // A shape this side did not send. Treating it as a failure rather than
        // ignoring it keeps a protocol drift from hanging the spinner forever.
        finish({ kind: "error", code: "error" });
    }
  };

  worker.onerror = () => {
    if (cancelled) return; // already settled by `stop`
    if (stream) {
      // The worker died mid-run. Whatever it had flushed is still true, and
      // an incomplete list labelled cancelled beats an empty one.
      finish({ kind: "cancelled", timetables: partialNow() });
      return;
    }
    // The worker threw before it could post anything — most likely a module
    // that would not load. Solve here rather than leave the spinner turning.
    generateInline(params, options, () => cancelled).then(finish);
  };

  worker.postMessage(stream ? { type: "stream", params } : params);

  return { result, cancel: stop };
}

/* ── entry points ──────────────────────────────────────────────────────── */

/**
 * Generate timetables without blocking the UI thread, reporting nothing until
 * the answer is ready.
 *
 * This is the shape that existing callers already have, and it is the one the
 * built-artifact test exercises end to end: one message out, one message back.
 */
export function generateTimetablesAsync(params: GenerateParams): Promise<GenerateResult> {
  return startGeneration(params).result;
}

/**
 * Start a run the caller can watch and stop.
 *
 * Streaming is only turned on when there is something to watch *for* — a caller
 * that passes no hooks wants the answer, not a stream of interim messages, and
 * the worker's one-shot path is the one with the shortest round trip.
 */
export function startGeneration(
  params: GenerateParams,
  options: GenerationOptions = {}
): GenerationHandle {
  const stream = Boolean(options.onBatch || options.onProgress);
  return generateInWorker(params, options, stream);
}
