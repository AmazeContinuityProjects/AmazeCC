"use client";

import { useState } from "react";
import { Copy, Check, Home } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Receives the payload from `share_target` and offers a copy affordance.
 * The payload is display-only: it is never persisted, authed, or routed by.
 */
export default function ShareTargetView() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const title = (searchParams.get("title") ?? "").trim();
  const url = (searchParams.get("url") ?? "").trim();
  const text = (searchParams.get("text") ?? "").trim();

  // Only http(s) URLs are echoed back — anything else is dropped rather than
  // handed to a link the user can't vet.
  const safeUrl = /^https?:\/\//i.test(url) ? url : undefined;

  const shared = [title, text, safeUrl].filter(Boolean).join("\n");
  const hasShared = shared.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shared);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center text-background shrink-0">
            <Copy size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink font-outfit tracking-tight">
              Shared with AmazeCC
            </h1>
            <p className="text-[11px] text-muted">
              Received from another app
            </p>
          </div>
        </div>

        {!hasShared ? (
          <p className="text-sm text-muted leading-relaxed">
            The share arrived empty — nothing was attached.
          </p>
        ) : (
          <div className="space-y-2.5">
            {title && (
              <div className="rounded-md bg-surface-2 border border-zinc-200/70 dark:border-zinc-800/70 p-3.5">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-1">Title</span>
                <p className="text-sm font-semibold text-ink">{title}</p>
              </div>
            )}
            {text && (
              <div className="rounded-md bg-surface-2 border border-zinc-200/70 dark:border-zinc-800/70 p-3.5">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-1">Text</span>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{text}</p>
              </div>
            )}
            {safeUrl && (
              <div className="rounded-md bg-surface-2 border border-zinc-200/70 dark:border-zinc-800/70 p-3.5">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-1">Link</span>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 break-all">{safeUrl}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={copy}
            disabled={!hasShared}
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-background text-sm font-medium px-4 py-2.5 rounded-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Check size={16} /> {copied ? "Copied" : "Copy to clipboard"}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-semibold px-4 py-2.5 rounded-md transition-colors"
          >
            <Home size={16} /> Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
