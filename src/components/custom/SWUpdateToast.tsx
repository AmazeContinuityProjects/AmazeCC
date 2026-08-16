"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";

interface UpdateState {
  worker: ServiceWorker;
}

export default function SWUpdateToast() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const trackWorker = (worker: ServiceWorker) => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        setUpdate({ worker });
        return;
      }
      worker.addEventListener("statechange", () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdate({ worker });
        }
      });
    };

    navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      if (registration.waiting) {
        trackWorker(registration.waiting);
        return;
      }
      if (registration.installing) {
        trackWorker(registration.installing);
        return;
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (worker) trackWorker(worker);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const applyUpdate = () => {
    if (!update || refreshing) return;
    setRefreshing(true);
    update.worker.postMessage({ type: "SKIP_WAITING" });
  };

  useEffect(() => {
    if (!refreshing) return;
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const fallback = setTimeout(() => window.location.reload(), 3000);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      clearTimeout(fallback);
    };
  }, [refreshing]);

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
          className="fixed bottom-24 right-4 z-[60] w-full max-w-[320px] bg-white dark:bg-[var(--surface)] border border-slate-200 dark:border-[var(--border-muted)] shadow-xl rounded-[16px] p-3.5 flex items-center gap-3 font-sans border-l-[4px] border-l-indigo-500 select-none"
          role="status"
        >
          <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-[10px] font-extrabold text-slate-800 dark:text-white leading-none font-outfit">
              New Version Available
            </h4>
            <p className="text-[8.5px] text-slate-400 dark:text-gray-500 font-bold mt-1 leading-tight">
              Refresh to get the latest features & improvements
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={applyUpdate}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-[10px] bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-bold transition-all cursor-pointer disabled:opacity-60"
            >
              {refreshing ? "Updating..." : "Update"}
            </button>
            <button
              onClick={() => setUpdate(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}