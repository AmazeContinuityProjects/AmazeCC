import { Suspense } from "react";
import type { Metadata } from "next";
import FFCSShareView from "./FFCSShareView";

export const metadata: Metadata = {
  title: "Shared FFCS Timetable",
  description: "A timetable plan shared from the AmazeCC FFCS Planner.",
};

/**
 * A received plan, rendered read-only.
 *
 * The payload lives entirely in the `d` query parameter (`lib/ffcsShare`), so
 * like the share-target page this is a prerendered shell that reads its input
 * client-side — the only pattern that survives `output: "export"`, where
 * there is no server to read search params at request time.
 */
export default function FFCSSharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface text-text-heading flex items-center justify-center text-sm text-muted-foreground">
          Opening plan…
        </div>
      }
    >
      <FFCSShareView />
    </Suspense>
  );
}
