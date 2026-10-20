"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";
import { isChunkLoadError, recoverFromChunkLoad } from "@/lib/chunkRecovery";

type ErrorWithDigest = Error & { digest?: string };

export default function ErrorPage({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AmazeCC client route error]", error);
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
    <ErrorDiagnosticCard
      title="Something failed while loading this page"
      description="Share this report with the developer to diagnose user-specific crashes that are difficult to reproduce."
      error={error}
      onRetry={reset}
    />
  );
}
