"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { useOverlayBack } from "@/lib/overlayStack";
import { TOUR_STEPS, TOUR_VERSION } from "./tourSteps";
import { TourContext, type TourContextValue } from "./tourContext";
import { TourSpotlight } from "./TourSpotlight";

// The context itself lives in `./tourContext` so the spotlight can consume it
// without importing this file — that edge closed a cycle
// (TourProvider → TourSpotlight → TourProvider). Re-exported for the page,
// which finds `usePredictorTour` here.
export { usePredictorTour, type TourContextValue } from "./tourContext";

/**
 * Tour state for the grade predictor subpage.
 *
 * The provider wraps `CoursePredictorPage` rather than nesting inside it: the
 * page's hook order — including its early return — stays untouched, and the
 * spotlight renders once above whatever the page shows.
 *
 * One run per {@link TOUR_VERSION}, remembered in `predictor_tour_seen` —
 * finishing and skipping both count as "seen". Unlike the FFCS tour there is
 * no settings switch and no phone suppression: this page is exactly where
 * first-time users get lost, and phones are where most of them read it. The
 * header's "?" control replays the run at any time.
 */

/** Delay before an auto-start, so the first layout pass has settled. */
const AUTO_START_MS = 600;

export function PredictorTourProvider({ children }: { children: React.ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const autoStartedRef = useRef(false);

  const markSeen = useCallback(() => {
    storage.predictorTourSeen.set(String(TOUR_VERSION));
  }, []);

  const stop = useCallback(() => {
    setStepIndex(null);
    markSeen();
  }, [markSeen]);

  const start = useCallback(() => {
    setStepIndex(0);
    track("tour_step", { step: 1, total: TOUR_STEPS.length, feature: "marks-predictor" });
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i === null) return null;
      if (i + 1 >= TOUR_STEPS.length) {
        markSeen();
        return null;
      }
      track("tour_step", { step: i + 2, total: TOUR_STEPS.length, feature: "marks-predictor" });
      return i + 1;
    });
  }, [markSeen]);

  const prev = useCallback(() => {
    setStepIndex((i) => (i === null ? null : Math.max(0, i - 1)));
  }, []);

  useEffect(() => {
    if (autoStartedRef.current) return;
    if (storage.predictorTourSeen.get() === String(TOUR_VERSION)) return;
    autoStartedRef.current = true;
    const timer = setTimeout(start, AUTO_START_MS);
    return () => clearTimeout(timer);
  }, [start]);

  // A system back gesture dismisses the tour, not the page behind it.
  useOverlayBack("predictor-tour", stepIndex !== null, stop);

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
    [stepIndex, start, stop, next, prev],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourSpotlight />
    </TourContext.Provider>
  );
}
