"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAtomValue } from "jotai";
import { CloudOff, Loader2, ServerCrash, X } from "lucide-react";
import { isOfflineAtom } from "@/store/uiAtoms";
import { checkVtopNow, getVtopState, subscribeVtopState, watchVtopState } from "@/lib/vtopStatus";

/**
 * One line at the top of the signed-in app when data cannot be refreshed:
 * the device is offline, or VTOP itself is not responding. Either way the app
 * keeps showing saved data, and the banner says so. Dismissible per problem.
 */
export default function ConnectionBanner({ enabled }: { enabled: boolean }) {
  const isOffline = useAtomValue(isOfflineAtom);
  const vtop = useSyncExternalStore(subscribeVtopState, getVtopState, () => "unknown" as const);
  const [dismissed, setDismissed] = useState<"offline" | "vtop" | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return watchVtopState();
  }, [enabled]);

  const problem = !enabled ? null : isOffline ? "offline" : vtop === "down" ? "vtop" : null;

  // A new or recurring problem shows again even if an earlier one was dismissed.
  useEffect(() => {
    if (problem === null) setDismissed(null);
  }, [problem]);

  if (!problem || dismissed === problem) return null;

  const offline = problem === "offline";
  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pointer-events-none`}
    >
      <div
        className={`pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur ${
          offline
            ? "border-amber-500/40 bg-amber-50/95 text-amber-900 dark:bg-amber-950/90 dark:text-amber-100"
            : "border-rose-500/40 bg-rose-50/95 text-rose-900 dark:bg-rose-950/90 dark:text-rose-100"
        }`}
      >
        {offline ? (
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ServerCrash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <p className="min-w-0 flex-1 leading-snug">
          {offline ? (
            <>
              <strong>You&apos;re offline.</strong> Showing your saved data. It refreshes when you&apos;re back online.
            </>
          ) : (
            <>
              <strong>VTOP isn&apos;t responding right now.</strong> This is on VIT&apos;s side, not your password.
              Showing your saved data; we&apos;ll check again in a few minutes.
            </>
          )}
        </p>
        {!offline && (
          <button
            type="button"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              await checkVtopNow();
              setChecking(false);
            }}
            className="shrink-0 rounded-md border border-current/30 px-2 py-0.5 font-bold hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60 cursor-pointer"
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Checking" /> : "Check now"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(problem)}
          aria-label="Dismiss"
          className="hit-expand relative shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
