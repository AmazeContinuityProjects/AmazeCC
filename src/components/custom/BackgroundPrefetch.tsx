"use client";

import { useEffect } from "react";
import { loadFacultyRoster } from "@/lib/vitfacService";

/**
 * Kicks off non-critical data fetches during browser idle time so the first
 * interaction feels instant without competing with first paint.
 */
export default function BackgroundPrefetch() {
  useEffect(() => {
    const run = () => {
      // Warm the faculty roster cache in the background.
      loadFacultyRoster().catch(() => {});
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 4000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
