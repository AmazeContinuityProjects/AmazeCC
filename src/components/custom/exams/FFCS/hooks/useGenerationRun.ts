"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startGeneration,
  type GenerateParams,
  type GenerateProgress,
  type GenerateResult,
  type GenerationHandle,
} from "../logic/generator";
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
export interface GenerationRun {
  /**
   * Start a run. Resolves with the settled result, never rejects.
   *
   * Calling it while a previous run is still going cancels that one first, so
   * two runs can never interleave their batches into one list.
   */
  run: (params: GenerateParams, onBatch?: (timetables: TimetableState[]) => void) => Promise<GenerateResult>;
  /** Stop the current run, if there is one. No-op otherwise. */
  cancel: () => void;
  isGenerating: boolean;
  /** `null` before the first progress tick and after the run settles. */
  progress: GenerateProgress | null;
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
    []
  );

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
  }, []);

  const run = useCallback(
    async (
      params: GenerateParams,
      onBatch?: (timetables: TimetableState[]) => void
    ): Promise<GenerateResult> => {
      handleRef.current?.cancel();
      handleRef.current = null;
      setIsGenerating(true);
      setProgress(null);
      // Fresh run, fresh budget: a restart must not have to wait out the
      // previous run's remaining throttle window.
      lastProgressAtRef.current = 0;

      try {
        const handle = startGeneration(params, {
          onBatch,
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
        return await handle.result;
      } finally {
        handleRef.current = null;
        setIsGenerating(false);
        setProgress(null);
      }
    },
    []
  );

  return { run, cancel, isGenerating, progress };
}
