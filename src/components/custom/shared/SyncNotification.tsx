"use client"

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl } from "@/lib/fetch-utils";
import { Loader2, RefreshCw, X, CheckCircle2, Globe, Terminal, Copy, Check } from "lucide-react";

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

  const handleCopy = () => {
    navigator.clipboard.writeText(BACKUP_API_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!active) return null;

  // Split lines of message to render a premium console logger
  const logLines = message.split("\n").filter(line => line.trim() !== "");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 dark:bg-black/70 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg border border-slate-200/80 dark:border-zinc-900/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 relative gap-5 font-sans"
        >
          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>

          {!hasSwitched ? (
            <>
              {/* Header section with live target status */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" />
                    <h3 className="font-black text-slate-900 dark:text-gray-100 text-base">VTOP Sync Engine</h3>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 text-slate-500 dark:text-gray-400 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {currentActiveApi.replace("https://", "").split("/")[0]}
                  </div>
                </div>
                <p className="text-[11px] text-gray-450 dark:text-gray-500 font-bold tracking-wide">
                  Establishing secure tunnel and pulling academic records
                </p>
              </div>

              {/* Custom styled progress indicator */}
              <div className="w-full space-y-2 bg-slate-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-slate-150/40 dark:border-zinc-900/40 shadow-xs">
                <div className="flex justify-between items-baseline text-[10px] font-black uppercase tracking-wider text-gray-450 dark:text-gray-500">
                  <span>Transfer Rate</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold">{Math.round(progress)}% Complete</span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-650 dark:from-blue-500 dark:to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>

              {/* Status Message Log Container */}
              <div className="bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-150/40 dark:border-zinc-900/60 rounded-2xl p-4 max-h-[140px] overflow-y-auto text-xs space-y-2.5 text-slate-700 dark:text-gray-300 font-medium scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
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
                      initial={{ opacity: 0, x: -3 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="flex items-start gap-2.5"
                    >
                      {isLast ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-650 dark:text-blue-400 animate-spin mt-0.5 shrink-0" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-450 mt-0.5 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700 mt-1.5 ml-1 shrink-0" />
                      )}
                      <span className={isLast ? "font-extrabold text-slate-900 dark:text-gray-150" : "text-slate-500 dark:text-gray-400"}>
                        {line}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Slow connection switch backup button */}
              <AnimatePresence>
                {showBackupBtn && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="pt-1"
                  >
                    <button
                      onClick={handleSwitchToBackup}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/25 dark:border-amber-500/15 font-black text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-xs"
                    >
                      <RefreshCw size={13} className="animate-spin text-amber-500 dark:text-amber-400" style={{ animationDuration: '3s' }} />
                      Connection slow? Switch to Backup API
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            /* Switched to backup server success screen */
            <div className="flex flex-col items-center text-center p-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30 shadow-xs">
                <CheckCircle2 size={24} className="animate-bounce" />
              </div>
              
              <div className="space-y-1">
                <h3 className="font-black text-slate-900 dark:text-gray-100 text-base">Switched to Backup Server</h3>
                <p className="text-xs text-gray-500 dark:text-gray-450 leading-relaxed font-semibold">
                  Active connection base updated to bypass local firewall filters.
                </p>
              </div>

              {/* Copyable URL box */}
              <div className="flex items-center gap-2 w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-3 pr-2 select-none">
                <Globe size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
                <span className="text-[10px] text-slate-650 dark:text-gray-400 font-mono truncate text-left flex-1 font-bold">
                  {BACKUP_API_URL}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg text-slate-450 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Copy backup API URL"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>

              <button
                onClick={onDismiss}
                className="w-full py-3.5 px-4 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-md shadow-blue-500/10"
              >
                Dismiss & Try Syncing Again
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}