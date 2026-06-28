"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";

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
