"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";
import { isChunkLoadError, recoverFromChunkLoad } from "@/lib/chunkRecovery";

type ErrorWithDigest = Error & { digest?: string };

export default function GlobalError({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AmazeCC global app error]", error);
    if (!isChunkLoadError(error)) return;

    // Throttle: a burst of chunk failures must not produce a reload storm.
    const lastReload = sessionStorage.getItem("last_chunk_load_reload");
    const now = Date.now();
    if (lastReload && now - Number(lastReload) < 10000) return;
    sessionStorage.setItem("last_chunk_load_reload", now.toString());

    console.warn("ChunkLoadError detected. Purging the stale bundle and reloading…");
    void recoverFromChunkLoad();
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-100 text-foreground transition-colors duration-300  dark:bg-black">
        <ErrorDiagnosticCard
          title="A critical app error occurred"
          description="The app shell failed to render. Copy the full report and send it to support for root-cause analysis."
          error={error}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
