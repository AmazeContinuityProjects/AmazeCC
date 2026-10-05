"use client"

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import BottomSheet from "./BottomSheet";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl, hasBackupApi } from "@/lib/fetch-utils";
import { UNICC_API_URL, resetUniccActivity } from "@/lib/unicc-fallback";
import { useUniccActivity, useUniccTarget, setUniccTarget, isUniccFallbackEnabled } from "@/lib/useUniccTarget";
import type { SyncNotice } from "@/lib/sync-engine/sync-session";
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
  Info,
  WifiOff
} from "lucide-react";

import SelectField from "../shared/primitives/SelectField";
interface SyncNotificationProps {
  message: string;
  progress: number;
  active: boolean;
  onDismiss: () => void;
  outcome?: "success" | "error" | null;
  /** Non-run reason the sheet was opened; replaces the progress UI when set. */
  notice?: SyncNotice;
  /** Re-attempt the sync from the offline notice. */
  onRetry?: () => void;
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
  onDismiss,
  outcome = null,
  notice = null,
  onRetry
}: SyncNotificationProps) {
  const [showBackupBtn, setShowBackupBtn] = useState(false);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Live target + traffic, read straight from the request layer so the sheet can
  // never claim one server while the app is using another.
  const uniccTarget = useUniccTarget();
  const activity = useUniccActivity();
  const uniccAvailable = isUniccFallbackEnabled();
  const targetValue = uniccTarget === "unicc" ? UNICC_API_URL : getActiveApiUrl();

  const isOfflineNotice = notice === "offline";

  const handleTargetChange = (newUrl: string) => {
    if (newUrl === UNICC_API_URL) {
      // Preference only: AmazeCC keeps serving the routes UniCC lacks, so the
      // global active URL must not move.
      setUniccTarget("unicc");
    } else {
      setUniccTarget("amazecc");
      setActiveApiUrl(newUrl);
      setIsMinimized(false);
    }
  };

  // Per-session tally. Reset when a session opens, not on every progress tick,
  // so the counts describe the sync the user is actually watching.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) resetUniccActivity();
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    let timer: any;
    if (active && !isOfflineNotice) {
      setShowBackupBtn(false);
      setHasSwitched(false);
      
      // Show the backup API switch button if loading takes more than 6 seconds
      // (only when a distinct backup gateway is actually configured)
      timer = setTimeout(() => {
        if (hasBackupApi() && getActiveApiUrl() === PRIMARY_API_URL) {
          setShowBackupBtn(true);
        }
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [active, message, isOfflineNotice]);

  // Reset minimized state when starting a new sync session
  useEffect(() => {
    if (active) {
      setIsMinimized(false);
    }
  }, [active]);

  const handleSwitchToBackup = () => {
    if (!hasBackupApi()) return;
    setActiveApiUrl(BACKUP_API_URL);
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

  // Which API is answering right now, in one line. The dot colour follows the
  // same rule the log does, so the two never disagree.
  const req = (n: number) => `${n} request${n === 1 ? "" : "s"}`;
  const serving: { dot: string; tone: string; text: string } | null = (() => {
    if (!uniccAvailable || !activity.lastServer) return null;
    const viaUnicc = activity.lastServer === "unicc";

    // Shown while opted in, so "UniCC is serving" is never read as "everything
    // came from UniCC" when half the endpoints only exist on AmazeCC.
    const viaAmazecc =
      viaUnicc && activity.unsupported > 0
        ? ` · ${req(activity.unsupported)} from AmazeCC (no UniCC route)`
        : "";

    if (viaUnicc) {
      return {
        dot: "bg-amber-500 animate-pulse",
        tone: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
        text: `UniCC API is serving${activity.lastPath ? ` ${activity.lastPath}` : ""}${viaAmazecc}`,
      };
    }
    return {
      dot: "bg-emerald-500 animate-pulse",
      tone: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
      text: `AmazeCC API is serving${activity.lastPath ? ` ${activity.lastPath}` : ""}`,
    };
  })();

  // circular SVG progress configurations
  const strokeRadius = 13;
  const strokeCircumference = 2 * Math.PI * strokeRadius;
  const strokeOffset = strokeCircumference - (Math.min(progress, 100) / 100) * strokeCircumference;

  // Backdrop tap / swipe-down / system back only park the sync in the
  // background pill — only the explicit X/Escape dismisses (cancels) it.
  // A notice has nothing to keep running, so it just closes.
  const minimizeToBackground = () => setIsMinimized(true);
  const parkOrClose = isOfflineNotice ? onDismiss : minimizeToBackground;

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
            /* Minimized background pill (unchanged) */
            <m.div
              key="sync-minimized"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
              className="fixed bottom-24 right-4 z-50 w-full max-w-[300px] bg-white dark:bg-[var(--surface)] border border-slate-200 dark:border-[var(--border-muted)] shadow-xl rounded-2xl p-3 pr-2 flex items-center gap-3 cursor-pointer select-none font-sans border-l-[4px] border-l-blue-500"
              onClick={() => setIsMinimized(false)}
            >
            <div className="flex items-center gap-3 w-full">
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
                    {Math.min(100, Math.round(progress))}%
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
            </div>
            </m.div>
          ) : (
            /* Expanded view as a bottom sheet */
            <BottomSheet
              key="sync-expanded"
              onClose={onDismiss}
              overlayId="sync-progress"
              maxWidth="max-w-md"
              showClose={false}
              onBackdropClick={parkOrClose}
              onSwipeDown={parkOrClose}
              onSystemBack={parkOrClose}
            >
            <div className="flex flex-col gap-4 sm:gap-5 w-full relative">
              {/* Header controls */}
              <div className="absolute -top-1 -right-1 flex items-center gap-2 z-10">
                {!hasSwitched && !isOfflineNotice && (
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

              {/* Connectivity notice: no request was fired, so the sheet
                  explains the state and offers a retry instead of progress */}
              {isOfflineNotice ? (
                <m.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 240 }}
                  className="flex flex-col items-center text-center py-8 px-4"
                >
                  <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <WifiOff className="w-8 h-8" strokeWidth={2.4} />
                  </div>
                  <h4 className="mt-4 text-base font-black text-zinc-900 dark:text-white font-outfit">
                    You&apos;re Offline
                  </h4>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 max-w-[260px] leading-relaxed">
                    No internet connection right now. Reconnect to the network, then sync again to pull the
                    latest records from VTOP.
                  </p>

                  <div className="w-full flex items-center gap-2 mt-5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss();
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss();
                        onRetry?.();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <RefreshCw size={11} />
                      <span>Try Again</span>
                    </button>
                  </div>
                </m.div>
              ) : outcome === "success" ? (
                /* Success tick takes over the whole sheet; everything else
                    disappears the moment it appears */
                <m.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 18, stiffness: 240 }}
                  className="flex flex-col items-center text-center py-8 px-4"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <Check className="w-8 h-8" strokeWidth={3} />
                  </div>
                  <h4 className="mt-4 text-base font-black text-zinc-900 dark:text-white font-outfit">
                    Sync successful
                  </h4>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    All records are up to date
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss();
                    }}
                    className="mt-5 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer active:scale-95"
                  >
                    Done
                  </button>
                </m.div>
              ) : (
                <>
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

                  {/* Target server: selectable mid-sync, and honest about who is
                      actually answering right now. */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-[var(--surface-secondary)] border border-slate-200/60 dark:border-[var(--border-muted)] p-3 rounded-xl gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold shrink-0">
                        Target Server:
                      </span>
                          <SelectField
                            value={targetValue}
                            onChange={handleTargetChange}
                            options={[
                              { value: PRIMARY_API_URL, label: "AmazeCC" },
                              ...(hasBackupApi()
                                ? [{ value: BACKUP_API_URL, label: "AmazeCC (Backup)" }]
                                : []),
                              ...(uniccAvailable ? [{ value: UNICC_API_URL, label: "UniCC" }] : []),
                            ]}
                            searchable={false}
                            size="xs"
                            role="group"
                            aria-label="Target server"
                            className="min-w-0 flex-1 [&>button:first-child]:border-none [&>button:first-child]:bg-transparent [&>button:first-child]:px-0 [&>button:first-child]:text-[10px] [&>button:first-child]:text-indigo-600 dark:[&>button:first-child]:text-indigo-400"
                          />
                        </div>

                    {/* Which API is answering, as opposed to which one was
                        asked for. Reported even when the user did not opt in,
                        because a third party quietly serving a student's data is
                        exactly the thing that should never be invisible. */}
                    {serving && (
                      <m.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-[9.5px] font-bold leading-snug ${serving.tone}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${serving.dot}`} />
                        <span>{serving.text}</span>
                      </m.div>
                    )}
                  </div>

                  {/* Custom styled progress indicator */}
                  <div className="w-full space-y-2 bg-slate-50 dark:bg-[var(--surface-secondary)] p-4 rounded-2xl border border-slate-200/50 dark:border-[var(--border-muted)] shadow-sm">
                    <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-gray-500">
                      <span>Transfer Rate</span>
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">{Math.min(100, Math.round(progress))}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                      <m.div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        transition={{ type: "spring", damping: 20, stiffness: 120 }}
                      />
                    </div>
                  </div>

                  {/* Status Message Log Container */}
                  <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 max-h-[120px] overflow-y-auto text-[10.5px] space-y-2 text-slate-700 dark:text-gray-300 font-sans scrollbar-none">
                    <AnimatePresence initial={false}>
                      {logLines.map((line, idx) => {
                        const isLast = idx === logLines.length - 1;
                        const { text, status } = parseLogLine(line, isLast);
                        return (
                          <m.div 
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
                          </m.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Slow connection switch backup button */}
                  <AnimatePresence>
                    {showBackupBtn && hasBackupApi() && (
                      <m.div
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
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer"
                        >
                          <RefreshCw size={11} className="animate-spin text-amber-500" style={{ animationDuration: '3s' }} />
                          <span>Slow network? Use Backup API</span>
                        </button>
                      </m.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                /* Switched to backup server success screen */
                <m.div 
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
                  <div className="flex items-center gap-2 w-full bg-slate-50 dark:bg-[var(--surface-secondary)] border border-slate-200 dark:border-[var(--border-muted)] rounded-xl p-2.5 pr-1.5 select-none">
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
                    className="w-full py-3 px-4 mt-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-[0.985] cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    Dismiss & Try Again
                  </button>
                </m.div>
                  )}
                </>
              )}
            </div>
            </BottomSheet>
          )}
    </AnimatePresence>
  );
}
