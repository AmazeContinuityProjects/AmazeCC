"use client";

import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { ListSkeleton } from "./ListSkeleton";

/**
 * Loading placeholder shaped like a real page: the PageShell header (eyebrow,
 * title, subtitle), a row of stat tiles and a list. Shown while a feature's
 * code chunk loads, so the screen keeps its layout instead of flashing a grey
 * block and then jumping.
 */
export function PageSkeleton({
  label = "Loading",
  tiles = 2,
  rows = 4,
}: {
  /** Announced to screen readers, e.g. "Loading attendance". */
  label?: string;
  tiles?: 0 | 2 | 3 | 4;
  rows?: number;
}) {
  const cols = tiles === 4 ? "grid-cols-2 md:grid-cols-4" : tiles === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div
      className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 text-left"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="px-1 space-y-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-3 w-32 rounded" />
      </div>
      {tiles > 0 ? (
        <div className={`grid ${cols} gap-3`}>
          {Array.from({ length: tiles }).map((_, i) => (
            <div
              key={i}
              className="rounded-[24px] border border-slate-200/70 dark:border-white/[0.08] p-4 space-y-3 min-h-[112px]"
            >
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-2.5 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : null}
      <ListSkeleton rows={rows} leading="dot" trailing />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
