"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { storage } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { useOverlayBack } from "@/lib/overlayStack";
import { TOUR_STEPS, TOUR_VERSION, type TourStep } from "./tourSteps";
import { TourSpotlight } from "./TourSpotlight";

/**
 * Tour state for the FFCS tab.
 *
 * The provider mounts *inside* the tab, so the tour cannot outlive the feature
 * it explains: opening the generator subpage unmounts the whole thing, which
 * ends any run in progress rather than leaving a spotlight chasing anchors
 * that no longer exist. The subpage is its own guided surface (its controls are
 * labelled where you touch them), so nothing is lost.
 *
 * One run per {@link TOUR_VERSION}, remembered in `ffcs_tour_seen` — finishing
 * and skipping both count as "seen"; the difference is only whether you made
 * it to the end. `offerTour={false}` (the settings switch) disables the
 * auto-start but keeps the explicit "Take the tour" entry points working.
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

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

/** Delay before an auto-start, so the first layout pass has settled. */
const AUTO_START_MS = 600;

export function TourProvider({
  offerTour,
  children,
}: {
  offerTour: boolean;
  children: React.ReactNode;
}) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const autoStartedRef = useRef(false);

  const markSeen = useCallback(() => {
    storage.ffcsTourSeen.set(String(TOUR_VERSION));
  }, []);

  const stop = useCallback(() => {
    setStepIndex(null);
    markSeen();
  }, [markSeen]);

  const start = useCallback(() => {
    setStepIndex(0);
    track("tour_step", { step: 1, total: TOUR_STEPS.length });
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i === null) return null;
      if (i + 1 >= TOUR_STEPS.length) {
        markSeen();
        return null;
      }
      track("tour_step", { step: i + 2, total: TOUR_STEPS.length });
      return i + 1;
    });
  }, [markSeen]);

  const prev = useCallback(() => {
    setStepIndex((i) => (i === null ? null : Math.max(0, i - 1)));
  }, []);

  useEffect(() => {
    if (!offerTour || autoStartedRef.current) return;
    if (storage.ffcsTourSeen.get() === String(TOUR_VERSION)) return;
    autoStartedRef.current = true;
    const timer = setTimeout(start, AUTO_START_MS);
    return () => clearTimeout(timer);
  }, [offerTour, start]);

  // A system back gesture dismisses the tour, not the planner behind it.
  useOverlayBack("ffcs-tour", stepIndex !== null, stop);

  const value = useMemo<TourContextValue>(
    () => ({
      step: stepIndex === null ? null : TOUR_STEPS[stepIndex],
      stepIndex: stepIndex ?? 0,
      total: TOUR_STEPS.length,
      isActive: stepIndex !== null,
      start,
      stop,
      next,
      prev,
    }),
    [stepIndex, start, stop, next, prev]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourSpotlight />
    </TourContext.Provider>
  );
}
