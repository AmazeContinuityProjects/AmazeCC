"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";

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
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk")
    ) {
      const lastReload = sessionStorage.getItem("last_chunk_load_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("last_chunk_load_reload", now.toString());
        console.warn("ChunkLoadError detected. Reloading page to fetch latest bundle...");
        window.location.reload();
      }
    }
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
