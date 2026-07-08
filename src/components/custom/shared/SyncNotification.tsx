"use client"

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl } from "@/lib/fetch-utils";
import { 
  Loader2, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Globe, 
  Terminal, 
  Copy, 
  Check, 
  Minimize2, 
  Maximize2,
  AlertCircle,
  Clock,
  Info
} from "lucide-react";

interface SyncNotificationProps {
  message: string;
  progress: number;
  active: boolean;
  onDismiss: () => void;
}

// Helper to clean emojis and determine status
const parseLogLine = (line: string, isLast: boolean) => {
  let cleanText = line.trim();
  let status: "success" | "error" | "pending" | "info" | "loading" = "info";

  // Check emojis and determine status, then strip them
  if (cleanText.includes("✅")) {
    status = "success";
    cleanText = cleanText.replace(/✅/g, "").trim();
  } else if (cleanText.includes("❌")) {
    status = "error";
    cleanText = cleanText.replace(/❌/g, "").trim();
  } else if (cleanText.includes("⏳")) {
    status = "pending";
    cleanText = cleanText.replace(/⏳/g, "").trim();
  } else if (cleanText.includes("📝")) {
    status = "info";
    cleanText = cleanText.replace(/📝/g, "").trim();
  } else if (isLast) {
    status = "loading";
  }

  // Formatting cleanup
  cleanText = cleanText
    .replace(/^[-•*]\s*/, "") // Remove bullet prefixes
    .trim();

  return { text: cleanText, status };
};

const getStatusIcon = (status: "success" | "error" | "pending" | "info" | "loading") => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 animate-pill-pop" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />;
    case "pending":
      return <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />;
    case "loading":
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 animate-spin shrink-0 mt-0.5" />;
    case "info":
    default:
      return <Info className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />;
  }
};

const cleanLogLine = (line: string) => {
  return line
    .replace(/[✅✔️❌⏳📝☐]/g, "")
    .replace(/^[-•*]\s*/, "") // Remove bullet points if any
    .trim();
};

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

  // Split lines of message to render logs
  const logLines = message.split("\n").filter(line => line.trim() !== "");

  // circular SVG progress configurations
  const strokeRadius = 13;
  const strokeCircumference = 2 * Math.PI * strokeRadius;
  const strokeOffset = strokeCircumference - (Math.min(progress, 100) / 100) * strokeCircumference;

  return (
    <>
      {/* Full screen backdrop overlay for expanded state */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-[4px]"
            onClick={() => setIsMinimized(true)}
          />
        )}
      </AnimatePresence>

      {/* Unified animated card */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className={
          isMinimized
            ? "fixed bottom-24 right-4 z-50 w-full max-w-[300px] bg-white dark:bg-[var(--surface)] border border-slate-200 dark:border-[var(--border-muted)] shadow-xl rounded-[16px] p-3 pr-2 flex items-center gap-3 cursor-pointer select-none font-sans border-l-[4px] border-l-blue-500"
            : "fixed bottom-4 left-4 right-4 sm:bottom-auto sm:right-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-[calc(100%-32px)] sm:w-[380px] bg-white dark:bg-[var(--surface)] border border-slate-200 dark:border-[var(--border-muted)] rounded-[24px] shadow-2xl overflow-hidden flex flex-col p-6 gap-4 font-sans select-none"
        }
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}
      >
        <AnimatePresence mode="wait">
          {isMinimized ? (
            /* Collapsed view content */
            <motion.div
              key="minimized-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 w-full"
            >
              {/* Circular progress SVG */}
              <div className="relative flex items-center justify-center shrink-0 w-8 h-8">
                <svg className="w-8 h-8 -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r={strokeRadius}
                    className="stroke-slate-200/80 dark:stroke-zinc-800/80"
                    strokeWidth="2.5"
                    fill="transparent"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r={strokeRadius}
                    className="stroke-blue-500 dark:stroke-blue-400 transition-all duration-300 ease-out"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={strokeCircumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                  />
                </svg>
                {progress >= 100 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 absolute" strokeWidth={3} />
                ) : (
                  <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 absolute">
                    {Math.round(progress)}%
                  </span>
                )}
              </div>

              {/* Pinned Info Labels */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[10px] font-extrabold text-slate-800 dark:text-white leading-none font-outfit">Syncing VTOP</h4>
                <p className="text-[8.5px] text-slate-400 dark:text-gray-500 font-bold truncate mt-1 leading-tight max-w-[130px]">
                  {cleanLogLine(logLines[logLines.length - 1] || "Syncing records...")}
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
          ) : (
            /* Extended view content */
            <motion.div
              key="expanded-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-4 w-full relative"
            >
              {/* Header controls */}
              <div className="absolute -top-1 -right-1 flex items-center gap-2 z-10">
                {!hasSwitched && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    title="Minimize to background"
                  >
                    <Minimize2 size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X size={15} />
                </button>
              </div>

              {!hasSwitched ? (
                <>
                  {/* Header section with live target status */}
                  <div className="flex flex-col gap-1 pr-12">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-outfit">VTOP Sync</h3>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold tracking-wide leading-relaxed">
                      Securing credentials and pulling academic records
                    </p>
                  </div>

                  {/* Target server indicator */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-[var(--surface-secondary)] border border-slate-200/60 dark:border-[var(--border-muted)] p-3 rounded-[12px] gap-2">
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">Target Server:</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-white dark:bg-[var(--surface)] border border-slate-200/60 dark:border-zinc-800 text-slate-600 dark:text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>{currentActiveApi.replace("https://", "").split("/")[0]}</span>
                    </div>
                  </div>

                  {/* Custom styled progress indicator */}
                  <div className="w-full space-y-2 bg-slate-50 dark:bg-[var(--surface-secondary)] p-4 rounded-[16px] border border-slate-200/50 dark:border-[var(--border-muted)] shadow-sm">
                    <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-gray-500">
                      <span>Transfer Rate</span>
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        transition={{ type: "spring", damping: 20, stiffness: 120 }}
                      />
                    </div>
                  </div>

                  {/* Status Message Log Container */}
                  <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[12px] p-3.5 max-h-[120px] overflow-y-auto text-[10.5px] space-y-2 text-slate-700 dark:text-gray-300 font-sans scrollbar-none">
                    <AnimatePresence initial={false}>
                      {logLines.map((line, idx) => {
                        const isLast = idx === logLines.length - 1;
                        const { text, status } = parseLogLine(line, isLast);
                        return (
                          <motion.div 
                            key={idx} 
                            initial={{ opacity: 0, y: 4 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            transition={{ duration: 0.15 }}
                            className="flex items-start gap-2"
                          >
                            {getStatusIcon(status)}
                            <span className={isLast ? "font-extrabold text-slate-900 dark:text-white" : "text-slate-500 dark:text-gray-400"}>
                              {text}
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
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchToBackup();
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[12px] bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer"
                        >
                          <RefreshCw size={11} className="animate-spin text-amber-500" style={{ animationDuration: '3s' }} />
                          <span>Slow network? Use Backup API</span>
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
                  className="flex flex-col items-center text-center p-1 gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle2 size={24} className="animate-bounce" style={{ animationDuration: '2s' }} />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-outfit">Backup Server Active</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                      API connection updated to bypass local hostel firewall filters.
                    </p>
                  </div>

                  {/* Copyable URL box */}
                  <div className="flex items-center gap-2 w-full bg-slate-50 dark:bg-[var(--surface-secondary)] border border-slate-200 dark:border-[var(--border-muted)] rounded-[12px] p-2.5 pr-1.5 select-none">
                    <Globe size={12} className="text-slate-400 dark:text-gray-500 shrink-0" />
                    <span className="text-[9px] text-slate-600 dark:text-gray-400 font-mono truncate text-left flex-1 font-bold">
                      {BACKUP_API_URL}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss();
                    }}
                    className="w-full py-3 px-4 mt-1 rounded-[12px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    Dismiss & Try Again
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}