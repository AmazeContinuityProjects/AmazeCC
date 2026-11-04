"use client";

import { createContext, useContext } from "react";
import type { TourStep } from "./tourSteps";

/**
 * The tour's context, split out of `PredictorTourProvider` so the spotlight
 * can consume it without importing the provider that renders the spotlight
 * (that edge closed a cycle: TourProvider → TourSpotlight → TourProvider).
 *
 * Named `usePredictorTour` rather than the FFCS tour's `useTour` so both can
 * be imported in one file without a rename dance.
 */

export interface TourContextValue {
  /** The current step, or null when no tour is running. */
  step: TourStep | null;
  stepIndex: number;
  total: number;
  isActive: boolean;
  start: () => void;
  /** Ends the run and remembers it as seen. */
  stop: () => void;
  next: () => void;
  prev: () => void;
}

export const TourContext = createContext<TourContextValue | null>(null);

export function usePredictorTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("usePredictorTour must be used inside <PredictorTourProvider>");
  return ctx;
}
