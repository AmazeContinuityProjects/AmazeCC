"use client";

import { useEffect, useState } from "react";

/**
 * Autoplay delay for `useCarousel`.
 *
 * The shared carousel's JS interval keeps ticking in a background tab and does
 * not consult `prefers-reduced-motion`. Both cases map to `autoplayMs = 0`,
 * which stops the interval at its source. Keeping this beside the in-scope
 * callers avoids changing `shared/**`, and the returned value can be passed to
 * `useCarousel` unchanged for every other case.
 */
export function useCarouselAutoplayPolicy(defaultMs = 5000): number {
  const [delay, setDelay] = useState(() => initialDelay(defaultMs));

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setDelay(document.hidden || motion?.matches ? 0 : defaultMs);
    update();
    document.addEventListener("visibilitychange", update);
    motion?.addEventListener?.("change", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      motion?.removeEventListener?.("change", update);
    };
  }, [defaultMs]);

  return delay;
}

function initialDelay(defaultMs: number): number {
  if (typeof window === "undefined" || typeof document === "undefined") return defaultMs;
  return document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : defaultMs;
}
