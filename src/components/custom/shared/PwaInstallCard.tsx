"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { usePwaInstall } from "@/lib/pwaInstall";

/**
 * "Install app" card for the settings hub.
 *
 * Renders nothing until the browser signals an installable PWA
 * (`beforeinstallprompt`, captured once at the app root by
 * `ServiceWorkerRegistrar`), so on browsers without the prompt and inside
 * already-installed standalone windows the card simply never appears — no
 * dead button. Styling mirrors the sibling cards in `ProfilePage`.
 */
export default function PwaInstallCard() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [accepted, setAccepted] = useState(false);

  if (!canInstall || accepted) return null;

  return (
    <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-3 shadow-2xs">
      <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
        Install AmazeCC
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Add AmazeCC to your home screen for the full-screen app: offline support,
        push notifications, and no browser chrome around it.
      </p>
      <button
        onClick={async () => {
          const ok = await promptInstall();
          if (ok) setAccepted(true);
        }}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4" /> Install app
      </button>
    </div>
  );
}
