"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Autoplay state for a rotating tile.
 *
 * Six components had this exact timer — 5s, pause on hover/touch, reset when
 * the slide count changed. Note `count < 2`: a two-slide carousel *does*
 * autoplay here, which is what most of the app already did.
 */
export function useCarousel(count: number, autoplayMs = 5000) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on manual navigation so the autoplay window restarts. Without it the
  // interval is keyed only to `count`, and a swipe 200ms before a tick gets
  // undone by that tick — the card appears to snap back under your finger,
  // which reads as the gesture not registering at all.
  const [manual, setManual] = useState(0);

  // A narrowed filter (or fresh data) can leave the index past the end.
  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (paused || count < 2 || autoplayMs <= 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), autoplayMs);
    return () => clearInterval(timer);
  }, [paused, count, autoplayMs, manual]);

  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
      setManual((m) => m + 1);
    },
    [count]
  );

  // Callers use this when navigating away and back, to start at slide 0 again.
  const reset = useCallback(() => {
    setIndex(0);
    setManual((m) => m + 1);
  }, []);

  return {
    index: count === 0 ? 0 : Math.min(index, count - 1),
    setIndex,
    paused,
    setPaused,
    go,
    reset,
    next: () => go(index + 1),
    prev: () => go(index - 1),
  };
}

export type CarouselState = ReturnType<typeof useCarousel>;
