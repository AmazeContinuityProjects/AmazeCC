"use client"

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl } from "@/lib/fetch-utils";
import { Loader2, RefreshCw, X, CheckCircle2, Globe, Terminal, Copy, Check, Minimize2, Maximize2 } from "lucide-react";

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
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    let timer: any;
    if (active) {
      setShowBackupBtn(false);
      setHasSwitched(false);
      setCurrentActiveApi(getActiveApiUrl());
      
      // Show the backup API switch button if loading takes more than 6 seconds
      timer = setTimeout(() => {
        if (getActiveApiUrl() === PRIMARY_API_URL) {
          setShowBackupBtn(true);
        }
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [active, message]);

  // Reset minimized state when starting a new sync session
  useEffect(() => {
    if (active) {
      setIsMinimized(false);
    }
  }, [active]);

  const handleSwitchToBackup = () => {
    setActiveApiUrl(BACKUP_API_URL);
    setCurrentActiveApi(BACKUP_API_URL);
    setShowBackupBtn(false);
    setHasSwitched(true);
    setIsMinimized(false); // Maximize to show success state
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(BACKUP_API_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!active) return null;

  // Split lines of message to render a premium console logger
  const logLines = message.split("\n").filter(line => line.trim() !== "");

  return (
    <AnimatePresence mode="wait">
      {!isMinimized ? (
        /* Full Modal Overlay View (Centered on desktop, bottom-sheet on mobile) */
        <motion.div
          key="expanded-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/40 dark:bg-black/75 backdrop-blur-[3px]"
        >
          <motion.div
            layoutId="sync-notification-card"
            className="w-full max-w-[340px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-900/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 relative gap-4 font-sans select-none"
          >
            {/* Header controls */}
            <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
              {!hasSwitched && (
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  title="Minimize to background"
                >
                  <Minimize2 size={13} />
                </button>
              )}
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {!hasSwitched ? (
              <>
                {/* Header section with live target status */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 pr-14">
                      <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <h3 className="font-extrabold text-slate-900 dark:text-gray-100 text-sm">VTOP Sync</h3>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 text-slate-500 dark:text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {currentActiveApi.replace("https://", "").split("/")[0]}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold tracking-wide">
                    Securing credentials and pulling records
                  </p>
                </div>

                {/* Custom styled progress indicator */}
                <div className="w-full space-y-1.5 bg-slate-50/50 dark:bg-zinc-900/30 p-3.5 rounded-xl border border-slate-200/50 dark:border-zinc-900/40 shadow-2xs">
                  <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <span>Transfer Rate</span>
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200/60 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden relative">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.25)]"
                      animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      transition={{ type: "spring", damping: 20, stiffness: 120 }}
                    />
                  </div>
                </div>

                {/* Status Message Log Container */}
                <div className="bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-900/60 rounded-xl p-3 max-h-[105px] overflow-y-auto text-[10.5px] space-y-2 text-slate-700 dark:text-gray-300 font-medium scrollbar-none">
                  <AnimatePresence initial={false}>
                    {logLines.map((line, idx) => {
                      const isLast = idx === logLines.length - 1;
                      const isSuccess = line.toLowerCase().includes("done") || 
                                      line.toLowerCase().includes("success") || 
                                      line.toLowerCase().includes("fetched") || 
                                      line.toLowerCase().includes("complete") || 
                                      line.toLowerCase().includes("initializing");
                      return (
                        <motion.div 
                          key={idx} 
                          initial={{ opacity: 0, y: 4 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ duration: 0.15 }}
                          className="flex items-start gap-2"
                        >
                          {isLast ? (
                            <Loader2 className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 shrink-0" />
                          ) : isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 mt-1.5 ml-1 shrink-0" />
                          )}
                          <span className={isLast ? "font-extrabold text-slate-900 dark:text-gray-150" : "text-slate-500 dark:text-gray-400"}>
                            {line}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Slow connection switch backup button */}
                <AnimatePresence>
                  {showBackupBtn && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: "spring", damping: 20, stiffness: 200 }}
                      className="pt-0.5"
                    >
                      <button
                        onClick={handleSwitchToBackup}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/15 font-black text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer"
                      >
                        <RefreshCw size={11} className="animate-spin text-amber-500" style={{ animationDuration: '3s' }} />
                        Slow network? Use Backup API
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              /* Switched to backup server success screen */
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center text-center p-1 gap-3.5"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30">
                  <CheckCircle2 size={20} className="animate-bounce" style={{ animationDuration: '2s' }} />
                </div>
                
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-slate-900 dark:text-gray-100 text-sm">Backup Server Active</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                    API connection updated to bypass local hostel firewall filters.
                  </p>
                </div>

                {/* Copyable URL box */}
                <div className="flex items-center gap-1.5 w-full bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/80 rounded-xl p-2.5 pr-1.5 select-none">
                  <Globe size={12} className="text-slate-400 dark:text-gray-500 shrink-0" />
                  <span className="text-[9px] text-slate-600 dark:text-gray-400 font-mono truncate text-left flex-1 font-bold">
                    {BACKUP_API_URL}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                  </button>
                </div>

                <button
                  onClick={onDismiss}
                  className="w-full py-2.5 px-4 mt-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-md shadow-blue-500/10"
                >
                  Dismiss & Try Again
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      ) : (
        /* Floating Compact Side Badge View (Shifted up on mobile to not overlap bottom nav tabs) */
        <motion.div
          key="minimized-badge"
          layoutId="sync-notification-card"
          className="fixed bottom-20 right-4 sm:bottom-4 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-900/80 shadow-xl rounded-2xl p-3 pr-2 flex items-center gap-3 cursor-pointer select-none max-w-[285px] font-sans border-l-[3.5px] border-l-blue-600 dark:border-l-blue-500 animate-in slide-in-from-bottom-5 duration-200"
          onClick={() => setIsMinimized(false)}
          whileHover={{ y: -2 }}
        >
          {/* Circular Loader with active percentage progress */}
          <div className="relative flex items-center justify-center shrink-0 w-8 h-8">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin shrink-0 absolute" />
            <span className="text-[9px] font-black text-blue-700 dark:text-blue-300 relative">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Pinned Info Labels */}
          <div className="min-w-0 flex-1">
            <h4 className="text-[10px] font-extrabold text-slate-800 dark:text-gray-150 leading-none">Syncing VTOP...</h4>
            <p className="text-[8.5px] text-slate-400 dark:text-gray-500 font-bold truncate mt-1 leading-tight max-w-[130px]">
              {logLines[logLines.length - 1] || "Syncing records..."}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Expand window"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Cancel sync"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}