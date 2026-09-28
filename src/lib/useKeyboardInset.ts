"use client";

import { useEffect, useState } from "react";

/**
 * Height (px) the on-screen keyboard is covering, derived from
 * `window.visualViewport`.
 *
 * There is no viewport meta change behind this on purpose: `visualViewport`
 * is the only mechanism that works on both iOS Safari and Android Chrome
 * without touching app-wide layout, and the app has no other keyboard
 * avoidance. Falls back to 0 on desktop and on browsers without the API.
 *
 * `enabled` exists so shared primitives can call this unconditionally (hooks
 * must not be conditional) without attaching listeners on behalf of the many
 * call sites that do not care about the keyboard at all.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setInset(0);
      return;
    }
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;

    const measure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        // How much of the layout viewport the visual viewport no longer covers.
        const covered =
          window.innerHeight - vv.height - vv.offsetTop;
        // Ignore the small deltas caused by browser chrome collapsing on
        // scroll, and anything that looks like a desktop resize.
        setInset(covered > 120 ? Math.round(covered) : 0);
      });
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [enabled]);

  return inset;
}
