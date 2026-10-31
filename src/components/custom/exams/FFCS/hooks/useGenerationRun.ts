"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startGeneration,
  type GenerateParams,
  type GenerateProgress,
  type GenerateResult,
  type GenerationHandle,
} from "../logic/generator";
import { DEFAULT_MAX_DROPS, droppableTail, isRetryableFailure, nextDrop, type DropPolicy } from "../logic/dropPolicy";
import type { TimetableState } from "../types";

/**
 * Run the generator so a screen can watch it and stop it.
 *
 * Every generation in the planner used to be an awaited promise with a spinner
 * in front of it: nothing arrived until the whole search was finished, and
 * closing the modal mid-run left the work running with nobody to receive it.
 * This hook owns the handle instead, so a screen only has to say what to do
 * with each batch and how to render the progress.
 *
 * The handle is a ref rather than state on purpose — cancelling must not
 * re-render, and a stale handle from a previous render must not be reachable
 * through a captured closure.
 */

/**
 * What a caller hands the hook beyond the solver's own params.
 *
 * The drop ladder is orchestration, not a solver input: it is a *sequence of
 * runs* with different course sets, which only this hook can express. Keeping
 * it out of `GenerateParams` means the worker never sees a field it has no
 * meaning for, and the pure policy stays testable without one.
 */
export interface GenerationRunOptions {
  /** Present only when All Subjects Mode is OFF — see `../logic/dropPolicy`. */
  drop?: DropPolicy;
}

/**
 * A result plus the courses the hook left out to obtain it.
 *
 * Optional because most runs never drop anything, and because the worker has
 * no idea this field exists — only the retry loop sets it, only on a `ok`
 * answer that a retry produced, and an empty result never claims a drop.
 */
export type GenerationOutcome = GenerateResult & { droppedCourses?: readonly string[] };

export interface GenerationRun {
  /**
   * Start a run. Resolves with the settled result, never rejects.
   *
   * Calling it while a previous run is still going cancels that one first, so
   * two runs can never interleave their batches into one list.
   *
   * With `options.drop`, a failed attempt that streamed **nothing** to
   * `onBatch` is retried with the lowest-priority courses left out (the
   * "All Subjects Mode: OFF" ladder) until either an attempt produces results
   * or the drop budget runs out. Attempts that already streamed batches are
   * never retried — the caller's list would hold two attempts' worth of
   * options — and in that case the first result is returned as-is, exactly
   * what the screen would have shown without the feature.
   */
  run: (
    params: GenerateParams,
    onBatch?: (timetables: TimetableState[]) => void,
    options?: GenerationRunOptions,
  ) => Promise<GenerationOutcome>;
  /** Stop the current run, if there is one. No-op otherwise. */
  cancel: () => void;
  isGenerating: boolean;
  /** `null` before the first progress tick and after the run settles. */
  progress: GenerateProgress | null;
}

/** The solver params for one run with `dropped` courses removed. */
function withCoursesDropped(params: GenerateParams, dropped: readonly string[]): GenerateParams {
  const set = new Set(dropped);
  return {
    ...params,
    masterCourses: params.masterCourses.filter((course) => !set.has(course.CODE)),
    courseLocks: params.courseLocks.filter((lock) => !set.has(lock.code)),
  };
}

export function useGenerationRun(): GenerationRun {
  const handleRef = useRef<GenerationHandle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);
  // `performance.now()` of the last progress that made it to state. The walk
  // ticks every 4,096 nodes, so a wide search produces thousands of progress
  // updates a second — each one a set-state the page has to reply to, which
  // is how a watched run used to starve the very paint it existed to feed.
  // A display-rate ceiling keeps the re-render budget human.
  const lastProgressAtRef = useRef(0);

  // A screen that unmounts mid-run must not leave a worker churning: there is
  // nobody left to render the answer, so the work has no purpose.
  useEffect(
    () => () => {
      handleRef.current?.cancel();
      handleRef.current = null;
    },
    [],
  );

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
  }, []);

  const run = useCallback(
    async (
      params: GenerateParams,
      onBatch?: (timetables: TimetableState[]) => void,
      options?: GenerationRunOptions,
    ): Promise<GenerationOutcome> => {
      handleRef.current?.cancel();
      handleRef.current = null;
      setIsGenerating(true);
      setProgress(null);
      // Fresh run, fresh budget: a restart must not have to wait out the
      // previous run's remaining throttle window.
      lastProgressAtRef.current = 0;

      // Whether any attempt has handed the caller results already. The retry
      // ladder only exists for "found nothing", and "nothing" has to mean
      // nothing on screen too: a caller holding streamed options must not
      // receive a second attempt's options appended beside them.
      let batchesSeen = false;
      /** The failure that started it all — returned verbatim if no retry helps. */
      let firstResult: GenerationOutcome | null = null;
      const dropped: string[] = [];
      const tail = options?.drop ? droppableTail(options.drop) : [];
      const maxDrops = options?.drop?.maxDrops ?? DEFAULT_MAX_DROPS;

      try {
        for (;;) {
          const attemptParams = dropped.length ? withCoursesDropped(params, dropped) : params;
          const handle = startGeneration(attemptParams, {
            onBatch: onBatch
              ? (batch) => {
                  batchesSeen = true;
                  onBatch(batch);
                }
              : undefined,
            // Always watching, even when the caller only wants the final answer —
            // but at a display rate, not the walk's tick rate (see the ref above).
            onProgress: (tick) => {
              const now = performance.now();
              if (now - lastProgressAtRef.current < 100) return;
              lastProgressAtRef.current = now;
              setProgress(tick);
            },
          });
          handleRef.current = handle;
          const result: GenerationOutcome = await handle.result;

          if (result.kind === "ok" && result.timetables.length > 0) {
            return dropped.length ? { ...result, droppedCourses: dropped } : result;
          }
          if (!firstResult) firstResult = result;
          // A cancel is an answer, not a failure: the student stopped it, and
          // retrying would restart work they just ended. Same for a solver
          // crash (`code: "error"`) — a retry would hide a real bug.
          if (result.kind === "cancelled" || batchesSeen || !isRetryableFailure(result)) break;
          if (dropped.length >= maxDrops) break;
          const next = nextDrop(tail, dropped, result);
          if (!next) break;
          dropped.push(next);
          // Between attempts nobody is watching a tick: a progress bar frozen
          // on the failed attempt's numbers would read as a stall.
          setProgress(null);
        }
        // Nothing worked: the original failure, unqualified. `droppedCourses`
        // stays unset because no result exists to have been dropped from.
        return firstResult ?? { kind: "error", code: "error" };
      } finally {
        handleRef.current = null;
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [],
  );

  return { run, cancel, isGenerating, progress };
}
