"use client";

import { useEffect } from "react";
import { initPwaInstallListeners } from "@/lib/pwaInstall";

/**
 * Root-level PWA plumbing.
 *
 * The service worker used to be registered only from surfaces that care about
 * push notifications (ProfilePage, PushPromptModal, onboarding), so a plain
 * first visit — the most common one — never got the offline fallback. This
 * registers once at the app root. It is idempotent with those call sites:
 * repeated `register("/sw.js")` calls resolve to the same registration.
 *
 * It also owns the global `beforeinstallprompt` capture for the whole app;
 * components consume it via `usePwaInstall()` from `@/lib/pwaInstall`.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration error:", err);
      });
    }
    return initPwaInstallListeners();
  }, []);

  return null;
}
