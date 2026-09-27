"use client";

import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { LIST_ROW } from "@/lib/uiTokens";
import { ListShell } from "./Surfaces";

/**
 * Loading placeholder for a list.
 *
 * The skeleton had drifted into three hand-rolled copies (a two-bar rhythm in
 * a `LIST_SHELL`, with an optional leading marker and trailing rail), so the
 * three knobs those copies actually varied are the props here.
 */
export function ListSkeleton({
  rows = 3,
  /** Small leading marker, like the status dot each real row starts with. */
  leading = "none",
  /** Trailing rail, for a row that ends in a chip or amount. */
  trailing = false,
  titleWidth = "w-1/2",
  subtitleWidth = "w-1/3",
}: {
  rows?: number;
  leading?: "none" | "dot" | "book";
  trailing?: boolean;
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <ListShell>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${LIST_ROW} pointer-events-none`}>
          {leading === "book" ? (
            <Skeleton className="w-9 h-12 rounded-lg shrink-0" />
          ) : leading === "dot" ? (
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
          ) : null}
          <div className="flex-1 space-y-2">
            <Skeleton className={`h-3 ${titleWidth} rounded`} />
            <Skeleton className={`h-2.5 ${subtitleWidth} rounded`} />
          </div>
          {trailing ? <Skeleton className="h-4 w-16 rounded shrink-0" /> : null}
        </div>
      ))}
    </ListShell>
  );
}
