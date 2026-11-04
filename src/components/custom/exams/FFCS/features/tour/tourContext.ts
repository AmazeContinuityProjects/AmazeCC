"use client";

import { createContext, useContext } from "react";
import type { TourStep } from "./tourSteps";

/**
 * The tour's context, split out of `TourProvider` so the spotlight can consume
 * it without importing the provider that renders the spotlight (that edge
 * closed a cycle: TourProvider → TourSpotlight → TourProvider).
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

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
