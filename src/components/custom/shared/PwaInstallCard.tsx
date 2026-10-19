"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { usePwaInstall } from "@/lib/pwaInstall";

const DISMISS_KEY = "pwaInstallCardDismissed";

const isIosDevice = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/**
 * "Install app" offer for the settings hub.
 *
 * Two surfaces, one dismissable card:
 *  - Browsers that fire `beforeinstallprompt` (Chrome/Edge Android+desktop,
 *    Samsung Internet) get a direct **Install app** button that triggers the
 *    native browser prompt. The prompt is captured once at the app root by
 *    `ServiceWorkerRegistrar`; availability arrives via `usePwaInstall()`.
 *  - iOS Safari never fires `beforeinstallprompt`, so there the card falls
 *    back to the manual "Share → Add to Home Screen" steps instead of
 *    disappearing entirely.
 *
 * The card never renders in an already-installed standalone window, and
 * dismissal persists — hiding the offer must be a choice, not a accident.
 * Styling mirrors the sibling cards in `ProfilePage`.
 */
export default function PwaInstallCard() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [accepted, setAccepted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [client, setClient] = useState(false);

  // Dismissal flag lives in localStorage; read it after mount to avoid an
  // SSR/first-paint mismatch, and only then decide what (if anything) to show.
  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    setClient(true);
  }, []);

  const showManualSteps = !canInstall && isIosDevice() && !isStandalone() && isTouchDevice();
  const visible = client && !accepted && !dismissed && (canInstall || showManualSteps);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — the flag just won't persist */
    }
    setDismissed(true);
  };

  return (
    <div className="relative bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-3 shadow-2xs">
      <button
        onClick={dismiss}
        aria-label="Dismiss install offer"
        className="absolute top-3.5 right-3.5 hit-expand flex items-center justify-center rounded-full p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>

      <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit pr-8">
        Install AmazeCC
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Add AmazeCC to your home screen for the full-screen app: offline support,
        push notifications, and no browser chrome around it.
      </p>

      {canInstall ? (
        <button
          onClick={async () => {
            const ok = await promptInstall();
            if (ok) setAccepted(true);
          }}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" /> Install app
        </button>
      ) : (
        <ol className="space-y-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <li className="flex items-start gap-2.5">
            <Share className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
            <span>
              Tap the <strong>Share</strong> button in Safari's toolbar.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Plus className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
            <span>
              Choose <strong>Add to Home Screen</strong>, then confirm.
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}
