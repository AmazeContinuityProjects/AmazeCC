"use client"

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl } from "@/lib/fetch-utils";
import { Loader2, RefreshCw, X, CheckCircle2 } from "lucide-react";

interface SyncNotificationProps {
  message: string;
  progress: number;
  active: boolean;
  onDismiss: () => void;
}

export default function SyncNotification({
  message,
  progress,
  active,
  onDismiss
}: SyncNotificationProps) {
  const [showBackupBtn, setShowBackupBtn] = useState(false);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [currentActiveApi, setCurrentActiveApi] = useState(getActiveApiUrl());

  useEffect(() => {
    let timer: any;
    if (active) {
      setShowBackupBtn(false);
      setHasSwitched(false);
      setCurrentActiveApi(getActiveApiUrl());
      
      // Show the backup API switch button if loading takes more than 6 seconds
      timer = setTimeout(() => {
        // Only show if the active API is currently the primary one (otherwise we are already on backup!)
        if (getActiveApiUrl() === PRIMARY_API_URL) {
          setShowBackupBtn(true);
        }
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [active, message]); // Reset timer if message updates (progress is being made)

  const handleSwitchToBackup = () => {
    setActiveApiUrl(BACKUP_API_URL);
    setCurrentActiveApi(BACKUP_API_URL);
    setShowBackupBtn(false);
    setHasSwitched(true);
  };

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white dark:bg-zinc-950 border border-gray-200 dark:border-gray-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col p-6 relative gap-4"
        >
          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-150 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {!hasSwitched ? (
            <>
              <div className="flex items-center gap-3 mt-2">
                <Loader2 className="w-6 h-6 text-blue-650 dark:text-blue-400 animate-spin shrink-0" />
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-gray-100">Syncing VTOP Data</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                    Target: {currentActiveApi}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-1.5">
                <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Status Message Log */}
              <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-gray-900/80 rounded-xl p-3.5 max-h-[140px] overflow-y-auto text-xs space-y-1.5 text-gray-700 dark:text-gray-300 font-medium">
                {message.split("\n").map((line, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>

              {/* Slow connection switch backup button */}
              <AnimatePresence>
                {showBackupBtn && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="pt-2"
                  >
                    <button
                      onClick={handleSwitchToBackup}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 dark:border-amber-500/20 font-extrabold text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    >
                      <RefreshCw size={14} className="animate-spin-slow" />
                      Connection slow? Switch to Backup API
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex flex-col items-center text-center p-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-gray-900 dark:text-gray-100">Switched to Backup API</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                  Successfully switched active API base to Deno Proxy server.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-gray-900/80 rounded-xl p-3 w-full text-[10px] text-gray-500 dark:text-gray-400 font-mono break-all select-all">
                {BACKUP_API_URL}
              </div>
              <button
                onClick={onDismiss}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                Dismiss & Try Login/Sync Again
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}