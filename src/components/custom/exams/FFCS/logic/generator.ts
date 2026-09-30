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
 */

import { generateTimetables, type GenerateParams, type GenerateResult } from "./generate";
import type { GeneratorErrorCode } from "./generate";
import type { TimetableState } from "../types";

export type { GenerateParams, GenerateResult, GeneratorErrorCode };

/**
 * What the worker posts back.
 *
 * The same two shapes as `GenerateResult`, minus the discriminant: the `type`
 * field *is* the discriminant here, and it has to be a string rather than a
 * boolean for the same non-strict-mode reason `GenerateResult` uses one.
 */
type WorkerReply =
  | { type: "success"; timetables: TimetableState[] }
  | { type: "error"; code: GeneratorErrorCode; subjectCode?: string };

/** Run it on this thread. Named so the fallback reads as a deliberate choice. */
function generateInline(params: GenerateParams): GenerateResult {
  return generateTimetables(params);
}

function generateInWorker(params: GenerateParams): Promise<GenerateResult> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/generator.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // No worker in this environment. Solve here rather than show nothing.
      resolve(generateInline(params));
      return;
    }

    let settled = false;
    const finish = (outcome: GenerateResult) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve(outcome);
    };

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === "success") {
        finish({ kind: "ok", timetables: reply.timetables });
      } else {
        finish({ kind: "error", code: reply.code, subjectCode: reply.subjectCode });
      }
    };

    worker.onerror = () => {
      // The worker threw before it could post anything — most likely a module
      // that would not load. Solve here rather than leave the spinner turning.
      finish(generateInline(params));
    };

    worker.postMessage(params);
  });
}

/**
 * Generate timetables without blocking the UI thread.
 *
 * Never rejects: a failure comes back as `{ kind: "error" }` with a code the
 * caller turns into its own message, so the four user-facing strings stay in the
 * UI where they belong.
 */
export function generateTimetablesAsync(params: GenerateParams): Promise<GenerateResult> {
  return generateInWorker(params).catch(() => generateInline(params));
}
