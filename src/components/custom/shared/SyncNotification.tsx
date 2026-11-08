"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import BottomSheet from "./BottomSheet";
import { BACKUP_API_URL, PRIMARY_API_URL, getActiveApiUrl, setActiveApiUrl, hasBackupApi } from "@/lib/fetch-utils";
import { UNICC_API_URL, resetUniccActivity } from "@/lib/unicc-fallback";
import { useUniccActivity, useUniccTarget, setUniccTarget, isUniccFallbackEnabled } from "@/lib/useUniccTarget";
import { pingVtopDirectly, VTOP_PORTAL_URL } from "@/lib/vtopHealth";
import { appendSyncLine, closeSyncSession } from "@/lib/sync-engine/sync-session";
import { cancelAllRequests } from "@/lib/sync-engine/request-layer";
import type { SyncNotice } from "@/lib/sync-engine/sync-session";
import { classifyAuthFailure } from "@/lib/sync-engine/errors";
import type { AuthFailureKind } from "@/lib/sync-engine/errors";
import type { SyncMode } from "@/lib/sync-engine/sync-modes";
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
  WifiOff,
  Settings,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ServerOff,
} from "lucide-react";

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
  /** Current sync mode id; when `modes` is set a switcher renders in the sheet. */
  modeId?: string;
  /** Default mode id, starred in the switcher. */
  defaultModeId?: string;
  /** All modes (built-in + custom) for the switcher. */
  modes?: SyncMode[];
  /** Title shown in the sheet header; defaults to "VTOP Sync". */
  modeLabel?: string;
  /** Switching modes mid-sheet re-runs the reload with that mode. */
  onSelectMode?: (id: string) => void;
  /** Opens the custom-mode editor. */
  onOpenEditor?: () => void;
  /**
   * Opens the credential editor, so a run that died on the saved password can
   * be fixed from inside the sheet instead of hunting for it on the login
   * screen.
   */
  onChangePassword?: () => void;
}

// Helper to clean emojis and determine status
const parseLogLine = (line: string, isLast: boolean) => {
  let cleanText = line.trim();
  let status: "success" | "error" | "pending" | "info" | "loading" = "info";

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

  cleanText = cleanText.replace(/^[-•*]\s*/, "").trim();
  return { text: cleanText, status };
};

const getStatusIcon = (status: "success" | "error" | "pending" | "info" | "loading") => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />;
    case "pending":
      return (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-zinc-700 shrink-0 mt-0.5" />
      );
    case "loading":
      return <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0 mt-0.5" />;
    case "info":
    default:
      return <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5 mx-1" />;
  }
};

const cleanLogLine = (line: string) => {
  return line
    .replace(/[✅✔️❌⏳📝☐]/g, "")
    .replace(/^[-•*]\s*/, "")
    .trim();
};

export default function SyncNotification({
  message,
  progress,
  active,
  onDismiss,
  outcome = null,
  notice = null,
  onRetry,
  modeId,
  defaultModeId,
  modes,
  modeLabel,
  onSelectMode,
  onOpenEditor,
  onChangePassword,
}: SyncNotificationProps) {
  const [showBackupBtn, setShowBackupBtn] = useState(false);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [vtopState, setVtopState] = useState<"idle" | "checking" | "up" | "down">("idle");

  const modeMenuRef = useRef<HTMLDivElement>(null);
  const serverMenuRef = useRef<HTMLDivElement>(null);

  // Live target + traffic
  const uniccTarget = useUniccTarget();
  const activity = useUniccActivity();
  const uniccAvailable = isUniccFallbackEnabled();
  const targetValue = uniccTarget === "unicc" ? UNICC_API_URL : getActiveApiUrl();

  const isOfflineNotice = notice === "offline";

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setShowServerMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTargetChange = (newUrl: string) => {
    if (newUrl === UNICC_API_URL) {
      setUniccTarget("unicc");
    } else {
      setUniccTarget("amazecc");
      setActiveApiUrl(newUrl);
    }
    setShowServerMenu(false);
  };

  // Reset activity on open
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) resetUniccActivity();
    wasActive.current = active;
  }, [active]);

  // Slow network timer (6s)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (active && !isOfflineNotice) {
      setShowBackupBtn(false);
      setHasSwitched(false);
      timer = setTimeout(() => {
        if (hasBackupApi() && getActiveApiUrl() === PRIMARY_API_URL) {
          setShowBackupBtn(true);
        }
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [active, message, isOfflineNotice]);

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
    setIsMinimized(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(BACKUP_API_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logLines = message
    .split(/\r?\n|\\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  // Classify authentication failure
  const authFailure: AuthFailureKind | null = (() => {
    let kind: AuthFailureKind | null = null;
    for (const line of logLines) {
      const { text, status } = parseLogLine(line, false);
      if (status !== "error") continue;
      const found = classifyAuthFailure(text);
      if (found === "bad-credentials") return found;
      if (found) kind = found;
    }
    return kind;
  })();

  // Auto-expand console if an unexpected non-auth error occurs
  useEffect(() => {
    if (authFailure) return;
    const hasError = logLines.some((l) => l.includes("❌"));
    if (hasError) setShowConsole(true);
  }, [logLines, authFailure]);

  // Pre-flight check: check if VTOP is working as soon as sync starts
  useEffect(() => {
    if (active && outcome === null && vtopState === "idle" && !isOfflineNotice) {
      let isMounted = true;
      pingVtopDirectly(4000).then((isUp) => {
        if (!isMounted) return;
        if (!isUp) {
          cancelAllRequests("VTOP is down");
          setVtopState("down");
          appendSyncLine("VTOP is down (vtopcc.vit.ac.in is unreachable) — sync cancelled", "error");
          closeSyncSession(4000, "error");
        } else {
          setVtopState("up");
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [active, outcome, vtopState, isOfflineNotice]);

  // Ping VTOP directly if all APIs failed to sync (and it's not a rejected password)
  const hasApiFailure =
    (outcome === "error" && !authFailure) ||
    (logLines.some((l) => /AmazeCC API failed|could not answer|fallback also failed|Failed to fetch/i.test(l)) &&
      !authFailure);

  const isPingingRef = useRef(false);

  useEffect(() => {
    if (!hasApiFailure) {
      setVtopState("idle");
      isPingingRef.current = false;
      return;
    }
    if (isPingingRef.current) return;
    isPingingRef.current = true;
    setVtopState("checking");

    let isMounted = true;
    pingVtopDirectly(4500)
      .then((isUp) => {
        if (isMounted) {
          const nextState = isUp ? "up" : "down";
          setVtopState(nextState);
          if (!isUp) {
            cancelAllRequests("VTOP is down");
            appendSyncLine("VTOP is down (vtopcc.vit.ac.in is unreachable) — sync cancelled", "error");
            closeSyncSession(4000, "error");
          }
        }
      })
      .finally(() => {
        isPingingRef.current = false;
      });

    return () => {
      isMounted = false;
    };
  }, [hasApiFailure]);

  // Cancel active sync if VTOP is confirmed down
  useEffect(() => {
    if (vtopState === "down" && active && outcome !== "error") {
      cancelAllRequests("VTOP is down");
      appendSyncLine("VTOP is down (vtopcc.vit.ac.in is unreachable) — sync cancelled", "error");
      closeSyncSession(4000, "error");
    }
  }, [vtopState, active, outcome]);

  const isVtopDown =
    vtopState === "down" || logLines.some((l) => /vtop.*down|vtopcc\.vit\.ac\.in.*down|portal unreachable/i.test(l));

  // When VTOP is detected down, immediately cancel all background sync requests
  useEffect(() => {
    if (isVtopDown) {
      cancelAllRequests("VTOP is down");
    }
  }, [isVtopDown]);

  const effectiveOutcome = outcome || (isVtopDown ? "error" : null);

  // Server telemetry label
  const req = (n: number) => `${n} req${n === 1 ? "" : "s"}`;
  const servingText = (() => {
    if (!uniccAvailable || !activity.lastServer) return null;
    const viaUnicc = activity.lastServer === "unicc";
    const viaAmazecc = viaUnicc && activity.unsupported > 0 ? ` · ${req(activity.unsupported)} from AmazeCC` : "";

    if (viaUnicc) {
      return `UniCC serving${activity.lastPath ? ` ${activity.lastPath}` : ""}${viaAmazecc}`;
    }
    return `AmazeCC serving${activity.lastPath ? ` ${activity.lastPath}` : ""}`;
  })();

  // Active server name for the header chip
  const activeServerLabel =
    targetValue === UNICC_API_URL ? "UniCC" : targetValue === BACKUP_API_URL ? "Backup API" : "AmazeCC";

  // Headline determination
  const latestLog = logLines[logLines.length - 1] || "";
  const cleanedHeadline = cleanLogLine(latestLog) || "Syncing records...";

  // Standard Milestones
  const milestones = [
    {
      id: "auth",
      label: "Authentication & Session",
      status: authFailure ? "error" : progress >= 20 || /logged in|captcha/i.test(message) ? "completed" : "active",
      detail: authFailure
        ? "Sign-in rejected"
        : progress >= 20 || /logged in|captcha/i.test(message)
          ? "Session verified"
          : "Checking credentials...",
    },
    {
      id: "academics",
      label: "Attendance & Timetable",
      status:
        progress >= 60 || /attendance.*complete|timetable.*complete/i.test(message)
          ? "completed"
          : progress >= 20
            ? "active"
            : "pending",
      detail: progress >= 60 ? "Classes up to date" : progress >= 20 ? "Fetching latest slots..." : "Waiting",
    },
    {
      id: "evaluations",
      label: "Marks & Grades",
      status:
        progress >= 85 || /marks.*complete|grades.*complete/i.test(message)
          ? "completed"
          : progress >= 60
            ? "active"
            : "pending",
      detail:
        progress >= 85 ? "Grades & assessments verified" : progress >= 60 ? "Pulling assessment scores..." : "Waiting",
    },
    {
      id: "cache",
      label: "Local Storage & Finalize",
      status: progress >= 100 || outcome === "success" ? "completed" : progress >= 85 ? "active" : "pending",
      detail:
        progress >= 100 || outcome === "success"
          ? "Synchronized"
          : progress >= 85
            ? "Saving offline database..."
            : "Waiting",
    },
  ];

  // Circular progress SVG constants for minimized mobile pill
  const strokeRadius = 14;
  const strokeCircumference = 2 * Math.PI * strokeRadius;
  const strokeOffset = strokeCircumference - (Math.min(progress, 100) / 100) * strokeCircumference;

  const minimizeToBackground = () => setIsMinimized(true);
  const isFinished = isOfflineNotice || effectiveOutcome === "success" || effectiveOutcome === "error" || hasSwitched;
  const parkOrClose = isFinished ? onDismiss : minimizeToBackground;

  const handleCancelSync = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    cancelAllRequests("User cancelled sync mid-flight");
    onDismiss();
  };

  const currentMode = modes?.find((m) => m.id === modeId);
  const activeModeTitle = currentMode?.label || modeLabel || "VTOP Sync";

  if (!active) return null;

  return (
    <AnimatePresence>
      {isMinimized ? (
        /* Minimized background pill - refined mobile dock capsule */
        <m.div
          key="sync-minimized"
          layout
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", stiffness: 450, damping: 32 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-3 right-3 sm:left-auto sm:right-6 sm:w-auto sm:min-w-[320px] sm:max-w-[350px] mx-auto z-50 bg-surface backdrop-hidden border border-black/[0.08] dark:border-white/[0.12] shadow-[0_12px_36px_-4px_rgba(0,0,0,0.18),0_0_1px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_40px_-4px_rgba(0,0,0,0.7),0_0_1px_rgba(255,255,255,0.15)] rounded-md py-2.5 px-3.5 flex items-center gap-3 cursor-pointer select-none font-sans transition-transform"
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center gap-3 w-full">
            {/* Circular progress SVG */}
            <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
              <svg className="w-9 h-9 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r={strokeRadius}
                  className="stroke-slate-200/80 dark:stroke-zinc-800/80"
                  strokeWidth="2.5"
                  fill="transparent"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={strokeRadius}
                  className="stroke-accent transition-all duration-300 ease-out"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={strokeCircumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                />
              </svg>
              {progress >= 100 ? (
                <Check className="w-4 h-4 text-ok absolute" strokeWidth={3} />
              ) : (
                <span className="text-[11px] font-semibold text-accent absolute font-mono">
                  {Math.min(100, Math.round(progress))}%
                </span>
              )}
            </div>

            {/* Pinned Labels */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-white leading-none font-outfit truncate">
                  {activeModeTitle}
                </h4>
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-1 leading-tight">
                {cleanedHeadline}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsMinimized(false)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Expand sync view"
              >
                <Maximize2 size={15} />
              </button>
              <button
                onClick={handleCancelSync}
                className="p-2 rounded-md text-danger hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
                title="Cancel sync"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </m.div>
      ) : (
        /* Expanded Bottom Sheet */
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
          <div className="flex flex-col gap-3.5 w-full relative">
            {/* 1. OFFLINE NOTICE TAKEOVER */}
            {isOfflineNotice ? (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 240 }}
                className="flex flex-col items-center text-center py-6 px-4"
              >
                <div className="w-14 h-14 rounded-full bg-warn-soft text-warn flex items-center justify-center border border-warn/20 shadow-lg">
                  <WifiOff className="w-7 h-7" strokeWidth={2.4} />
                </div>
                <h4 className="mt-3.5 text-base font-semibold text-slate-900 dark:text-white font-outfit">
                  You&apos;re Offline
                </h4>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400 max-w-[260px] leading-relaxed">
                  No network detected. Reconnect to sync the latest records from VTOP.
                </p>

                <div className="w-full flex items-center gap-2 mt-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss();
                    }}
                    className="flex-1 py-2.5 px-4 rounded-md bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs transition-all duration-150 cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss();
                      onRetry?.();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-warn hover:bg-warn text-white font-semibold text-xs transition-all duration-150 cursor-pointer shadow-md"
                  >
                    <RefreshCw size={12} />
                    <span>Try Again</span>
                  </button>
                </div>
              </m.div>
            ) : effectiveOutcome === "success" ? (
              /* 2. SUCCESS STATE TAKEOVER */
              <m.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 18, stiffness: 240 }}
                className="flex flex-col items-center text-center py-6 px-4"
              >
                <div className="w-14 h-14 rounded-full bg-ok text-white flex items-center justify-center shadow-lg">
                  <Check className="w-7 h-7" strokeWidth={3} />
                </div>
                <h4 className="mt-3.5 text-base font-semibold text-slate-900 dark:text-white font-outfit">
                  Sync Successful
                </h4>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
                  All academic records are completely up to date.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  className="mt-5 w-full py-2.5 px-6 rounded-md bg-ok hover:bg-ok active:bg-ok text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Done
                </button>
              </m.div>
            ) : effectiveOutcome === "error" ? (
              /* 3. FULL-SCREEN ERROR TAKEOVER */
              isVtopDown ? (
                /* 3A. BOLD VTOP IS DOWN TAKEOVER */
                <m.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 240 }}
                  className="flex flex-col items-center text-center py-6 px-3 sm:px-4 w-full"
                >
                  {/* Glowing Rose Halo + ServerOff Icon */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-md bg-danger-soft blur-xl animate-pulse" />
                    <div className="relative w-16 h-16 rounded-md bg-danger-soft border border-danger/40 text-danger flex items-center justify-center ring-2 ring-danger/30">
                      <ServerOff className="w-8 h-8 drop-" strokeWidth={2.4} />
                    </div>
                  </div>

                  {/* BOLD HEADLINE */}
                  <h3 className="mt-4 text-2xl font-semibold text-danger font-outfit tracking-tight drop-">
                    VTOP is Down
                  </h3>

                  {/* EXPLANATORY DESCRIPTION */}
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 max-w-[320px] leading-relaxed">
                    Direct connection to{" "}
                    <span className="font-semibold text-danger underline decoration-danger/40 underline-offset-2">
                      vtopcc.vit.ac.in
                    </span>{" "}
                    did not respond. The university portal appears to be offline or undergoing maintenance. Background
                    sync has been cancelled.
                  </p>

                  {/* ACTION BUTTONS: PROMINENT DISMISS + SECONDARY ACTIONS */}
                  <div className="w-full flex flex-col gap-2.5 mt-6">
                    {/* Primary Dismiss Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelAllRequests("User dismissed VTOP down notice");
                        onDismiss();
                      }}
                      className="w-full py-3 px-4 rounded-md bg-slate-900 hover:bg-slate-800 active:bg-black dark:bg-surface dark:hover:bg-zinc-100 dark:active:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs transition-all duration-150 cursor-pointer shadow-lg shadow-black/10 dark:shadow-white/10"
                    >
                      Dismiss
                    </button>

                    {/* Secondary Actions: Check VTOP & Retry */}
                    <div className="w-full flex items-center gap-2">
                      <a
                        href={VTOP_PORTAL_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 font-semibold text-xs transition-all cursor-pointer border border-slate-200/60 dark:border-zinc-700/60"
                      >
                        <ExternalLink size={12} />
                        <span>Check VTOP</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelAllRequests("Retrying sync");
                          onDismiss();
                          onRetry?.();
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md bg-danger-soft hover:bg-danger-soft active:bg-danger-soft text-danger border border-danger/30 font-semibold text-xs transition-all cursor-pointer shadow-sm"
                      >
                        <RefreshCw size={12} />
                        <span>Retry Sync</span>
                      </button>
                    </div>
                  </div>
                </m.div>
              ) : vtopState === "checking" ? (
                /* 3B. CHECKING VTOP STATUS TAKEOVER (PREVENTS FLASHING "SYNC FAILED") */
                <m.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-8 px-4 w-full"
                >
                  <div className="relative w-14 h-14 rounded-md bg-warn-soft border border-warn/30 text-warn flex items-center justify-center shadow-lg">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warn-soft border border-warn/25 text-warn text-[11px] font-semibold">
                    <span>Checking Reachability</span>
                  </div>
                  <h4 className="mt-2.5 text-base font-semibold text-slate-900 dark:text-white font-outfit">
                    Connecting to VTOP…
                  </h4>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400 max-w-[280px] leading-relaxed">
                    Checking if vtopcc.vit.ac.in is online to determine server status.
                  </p>
                </m.div>
              ) : (
                /* 3C. OTHER ERRORS (Auth Rejection / General Error) */
                <m.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 240 }}
                  className="flex flex-col items-center text-center py-6 px-4 w-full"
                >
                  {/* ICON BADGE */}
                  {authFailure ? (
                    <div className="w-14 h-14 rounded-full bg-warn-soft text-warn flex items-center justify-center border border-warn/25 shadow-lg ring-1 ring-warn/30">
                      <KeyRound className="w-7 h-7" strokeWidth={2.2} />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-danger-soft text-danger flex items-center justify-center border border-danger/25 shadow-lg ring-1 ring-danger/30">
                      <AlertCircle className="w-7 h-7" strokeWidth={2.2} />
                    </div>
                  )}

                  {/* HEADLINE */}
                  <h4 className="mt-3.5 text-base font-semibold text-slate-900 dark:text-white font-outfit">
                    {authFailure === "bad-credentials"
                      ? "Check Your Password"
                      : authFailure
                        ? "Sign-in Rejected"
                        : "Sync Failed"}
                  </h4>

                  {/* EXPLANATORY DESCRIPTION */}
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400 max-w-[280px] leading-relaxed">
                    {authFailure === "bad-credentials" ? (
                      "VTOP rejected your saved credentials. Update your password or reset it directly on the university portal."
                    ) : authFailure ? (
                      <>
                        Your VTOP session was rejected. Please log in directly to{" "}
                        <span className="font-semibold text-warn">vtopcc.vit.ac.in</span> to verify
                        or change your password.
                      </>
                    ) : vtopState === "up" ? (
                      "VTOP portal is online, but our sync API gateways could not connect. Try switching to the Backup API or retry."
                    ) : (
                      "Unable to synchronize your academic records from VTOP. Please check your network and try again."
                    )}
                  </p>

                  {/* ACTION BUTTONS ROW */}
                  <div className="w-full flex flex-col gap-2 mt-5">
                    {authFailure === "bad-credentials" ? (
                      <div className="w-full flex flex-col gap-2">
                        {onChangePassword && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangePassword();
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-sm bg-accent hover:bg-accent/90 active: text-background font-medium text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <KeyRound size={12} />
                            <span>Change Password</span>
                          </button>
                        )}
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss();
                            }}
                            className="flex-1 py-2.5 px-4 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
                          >
                            Dismiss
                          </button>
                          <a
                            href={VTOP_PORTAL_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-md bg-warn hover:bg-warn text-white font-semibold text-xs transition-all cursor-pointer shadow-md"
                          >
                            <ExternalLink size={12} />
                            <span>Reset on VTOP</span>
                          </a>
                        </div>
                      </div>
                    ) : authFailure ? (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss();
                          }}
                          className="flex-1 py-2.5 px-4 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <a
                          href={VTOP_PORTAL_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-md bg-warn hover:bg-warn text-white font-semibold text-xs transition-all cursor-pointer shadow-md"
                        >
                          <ExternalLink size={12} />
                          <span>Open VTOP</span>
                        </a>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-2">
                        {hasBackupApi() && getActiveApiUrl() === PRIMARY_API_URL && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwitchToBackup();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-warn-soft hover:bg-warn-soft text-warn border border-warn/20 font-semibold text-xs transition-all cursor-pointer"
                          >
                            <RefreshCw size={12} />
                            <span>Switch to Backup API</span>
                          </button>
                        )}
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss();
                            }}
                            className="flex-1 py-2.5 px-4 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss();
                              onRetry?.();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-md bg-danger hover:bg-danger active:bg-danger text-white font-semibold text-xs transition-all cursor-pointer shadow-md"
                          >
                            <RefreshCw size={12} />
                            <span>Retry Sync</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* OPTIONAL DIAGNOSTICS ACCORDION IN OTHER ERRORS (Omitted when VTOP is down) */}
                    {logLines.length > 0 && (
                      <div className="w-full mt-3 text-left">
                        <button
                          type="button"
                          onClick={() => setShowConsole(!showConsole)}
                          className="w-full flex items-center justify-between py-1.5 px-3 rounded-md bg-slate-100/70 hover:bg-slate-200/70 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-slate-200/50 dark:border-zinc-800/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Terminal size={12} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                            <span className="text-[10.5px] font-semibold text-slate-600 dark:text-zinc-400">
                              Error Log & Diagnostics ({logLines.length} events)
                            </span>
                          </div>
                          {showConsole ? (
                            <ChevronUp size={12} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={12} className="text-slate-400" />
                          )}
                        </button>

                        <AnimatePresence>
                          {showConsole && (
                            <m.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden mt-1.5"
                            >
                              <div className="bg-slate-900 dark:bg-black/90 text-slate-200 rounded-md p-3 max-h-[140px] overflow-y-auto text-[11px] font-mono space-y-1.5 scrollbar-none border border-slate-800">
                                {logLines.map((line, idx) => {
                                  const isLast = idx === logLines.length - 1;
                                  const { text, status } = parseLogLine(line, isLast);
                                  return (
                                    <div key={idx} className="flex items-start gap-2">
                                      {getStatusIcon(status)}
                                      <span
                                        className={
                                          status === "error"
                                            ? "text-danger font-semibold"
                                            : isLast
                                              ? "text-white font-semibold"
                                              : "text-slate-400"
                                        }
                                      >
                                        {text}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </m.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </m.div>
              )
            ) : hasSwitched ? (
              /* 4. SWITCHED TO BACKUP STATE */
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center text-center py-5 px-3 gap-3.5"
              >
                <div className="w-12 h-12 rounded-full text-ok flex items-center justify-center border border-line-2 bg-surface-2">
                  <CheckCircle2 size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm font-outfit">
                    Backup Server Active
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
                    Connection updated to bypass local firewall filters.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full bg-surface-2 border border-slate-200 dark:border-zinc-800 rounded-md p-2.5 pr-1.5 select-none">
                  <Globe size={13} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono truncate text-left flex-1 font-semibold">
                    {BACKUP_API_URL}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {copied ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
                  </button>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  className="w-full py-2.5 px-4 rounded-sm bg-accent hover:bg-accent/90 text-background font-medium text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Dismiss & Try Again
                </button>
              </m.div>
            ) : (
              /* 5. ACTIVE RUNNING SYNC VIEW */
              <>
                {/* 1. UNIFIED HEADER TOOLBAR */}
                <div className="flex items-center justify-between gap-2 pb-1">
                  {/* Left: Mode Chip Selector */}
                  <div className="relative" ref={modeMenuRef}>
                    {modes && modes.length > 0 && onSelectMode ? (
                      <button
                        onClick={() => {
                          setShowModeMenu(!showModeMenu);
                          setShowServerMenu(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/60 hover:bg-blue-100/60 transition-colors cursor-pointer"
                        title="Change sync mode"
                      >
                        <Sparkles size={11} className="text-accent shrink-0" />
                        <span className="truncate max-w-[130px]">{activeModeTitle}</span>
                        <ChevronDown size={11} className="opacity-70 shrink-0" />
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-2 text-slate-700 dark:text-zinc-300">
                        <Layers size={11} className="text-slate-500 shrink-0" />
                        <span>{activeModeTitle}</span>
                      </div>
                    )}

                    {/* Mode Dropdown Menu */}
                    {showModeMenu && (
                      <div className="absolute left-0 top-full mt-1.5 z-30 w-60 rounded-md bg-surface border border-slate-200 dark:border-zinc-800 shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        {modes?.map((m) => {
                          const isSelected = m.id === modeId;
                          const isDefault = defaultModeId === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                onSelectMode?.(m.id);
                                setShowModeMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs transition-colors ${
                                isSelected
                                  ? "bg-accent-soft text-accent font-semibold"
                                  : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60 font-medium"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  {isDefault && (
                                    <span className="text-[11px] text-warn font-semibold" title="Default Mode">
                                      ★
                                    </span>
                                  )}
                                  <span className="truncate">{m.label}</span>
                                </div>
                                <span className="text-[11px] text-slate-400 dark:text-zinc-500 truncate block">
                                  {m.description}
                                </span>
                              </div>
                              {isSelected && <Check size={13} className="shrink-0 text-accent" />}
                            </button>
                          );
                        })}

                        {onOpenEditor && (
                          <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800">
                            <button
                              onClick={() => {
                                setShowModeMenu(false);
                                onOpenEditor();
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
                            >
                              <Settings size={12} />
                              <span>Manage Custom Modes</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Target Server Pill + Prominent Minimize Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Server Status Chip */}
                    <div className="relative" ref={serverMenuRef}>
                      <button
                        onClick={() => {
                          setShowServerMenu(!showServerMenu);
                          setShowModeMenu(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                        title="Target Server Status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            uniccTarget === "unicc"
                              ? "bg-warn animate-pulse"
                              : targetValue === BACKUP_API_URL
                                ? "bg-indigo-500"
                                : "bg-ok"
                          }`}
                        />
                        <span>{activeServerLabel}</span>
                        <ChevronDown size={10} className="text-slate-400 dark:text-zinc-500" />
                      </button>

                      {/* Server Selection Dropdown */}
                      {showServerMenu && (
                        <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-md bg-surface border border-slate-200 dark:border-zinc-800 shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                            Switch Gateway
                          </div>
                          <button
                            onClick={() => handleTargetChange(PRIMARY_API_URL)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs font-semibold transition-colors ${
                              targetValue === PRIMARY_API_URL && uniccTarget !== "unicc"
                                ? "bg-ok-soft text-ok"
                                : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span>AmazeCC (Primary)</span>
                            {targetValue === PRIMARY_API_URL && uniccTarget !== "unicc" && (
                              <Check size={13} className="text-ok" />
                            )}
                          </button>

                          {hasBackupApi() && (
                            <button
                              onClick={() => handleTargetChange(BACKUP_API_URL)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs font-semibold transition-colors ${
                                targetValue === BACKUP_API_URL && uniccTarget !== "unicc"
                                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400"
                                  : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <span>AmazeCC (Backup)</span>
                              {targetValue === BACKUP_API_URL && uniccTarget !== "unicc" && (
                                <Check size={13} className="text-indigo-500" />
                              )}
                            </button>
                          )}

                          {uniccAvailable && (
                            <button
                              onClick={() => handleTargetChange(UNICC_API_URL)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs font-semibold transition-colors ${
                                uniccTarget === "unicc"
                                  ? "bg-warn-soft text-warn"
                                  : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <span>UniCC Proxy</span>
                              {uniccTarget === "unicc" && <Check size={13} className="text-warn" />}
                            </button>
                          )}

                          {servingText && (
                            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-zinc-800 px-2 py-1 text-[9.5px] font-medium text-slate-500 dark:text-zinc-400 leading-tight">
                              {servingText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bigger Minimize Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMinimized(true);
                      }}
                      className="p-2 sm:p-2.5 rounded-md bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-zinc-700/60 transition-all cursor-pointer shadow-xs"
                      title="Minimize / Run in background"
                    >
                      <Minimize2 size={17} />
                    </button>
                  </div>
                </div>

                {/* 2. HERO STAGE (PROGRESS & ACTIVE HEADLINE) */}
                <div className="w-full space-y-2 pt-0.5">
                  <div className="flex justify-between items-baseline gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm font-outfit truncate">
                      {cleanedHeadline}
                    </h3>
                    <span className="text-xs font-mono font-semibold text-accent shrink-0">
                      {Math.min(100, Math.round(progress))}%
                    </span>
                  </div>

                  {/* High performance spring progress bar */}
                  <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden relative">
                    <m.div
                      className="h-full bg-accent rounded-full"
                      animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      transition={{ type: "spring", damping: 24, stiffness: 140 }}
                    />
                  </div>
                </div>

                {/* 3. MILESTONE STEPPER */}
                <div className="space-y-1.5 py-1">
                  {milestones.map((mItem) => {
                    return (
                      <div
                        key={mItem.id}
                        className="flex items-center justify-between py-1.5 px-3 rounded-md bg-surface-2 border border-slate-200/50 dark:border-zinc-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {mItem.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                          ) : mItem.status === "error" ? (
                            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                          ) : mItem.status === "active" ? (
                            <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-700 shrink-0" />
                          )}
                          <span
                            className={`font-semibold truncate ${
                              mItem.status === "active"
                                ? "text-slate-900 dark:text-white font-semibold"
                                : mItem.status === "completed"
                                  ? "text-slate-700 dark:text-zinc-300"
                                  : "text-slate-400 dark:text-zinc-500"
                            }`}
                          >
                            {mItem.label}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-medium shrink-0 ${
                            mItem.status === "completed"
                              ? "text-ok font-semibold"
                              : mItem.status === "error"
                                ? "text-danger font-semibold"
                                : mItem.status === "active"
                                  ? "text-accent animate-pulse font-semibold"
                                  : "text-slate-400 dark:text-zinc-600"
                          }`}
                        >
                          {mItem.detail}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* INLINE VTOP DOWN ALERT (DURING RUN) */}
                {vtopState === "down" && (
                  <m.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border border-danger/40 bg-danger-soft p-3 flex items-start gap-2.5"
                  >
                    <ServerOff className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-danger">
                          VTOP is Down
                        </p>
                        <span className="text-[11px] font-semibold text-danger/80">Offline</span>
                      </div>
                      <p className="text-[10.5px] font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
                        Direct connection to vtopcc.vit.ac.in timed out. The university portal appears to be offline.
                      </p>
                    </div>
                  </m.div>
                )}

                {/* 4. PROGRESSIVE DISCLOSURE: LIVE CONSOLE LOG DRAWER */}
                <div className="w-full space-y-1.5">
                  <div className="w-full flex items-center justify-between py-1.5 px-3 rounded-md bg-surface-2 border border-slate-200/60 dark:border-zinc-800/80 transition-colors">
                    <button
                      type="button"
                      onClick={() => setShowConsole(!showConsole)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer select-none py-0.5"
                    >
                      <Terminal size={12} className="text-slate-500 dark:text-zinc-400 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                        Diagnostics ({logLines.length} events)
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showConsole && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(message);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Copy full logs"
                        >
                          {copied ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowConsole(!showConsole)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {showConsole ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showConsole && (
                      <m.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-slate-900 dark:bg-black/80 text-slate-200 rounded-md p-3 max-h-[130px] overflow-y-auto text-[11px] font-mono space-y-1.5 scrollbar-none border border-slate-800">
                          {logLines.map((line, idx) => {
                            const isLast = idx === logLines.length - 1;
                            const { text, status } = parseLogLine(line, isLast);
                            return (
                              <div key={idx} className="flex items-start gap-2">
                                {getStatusIcon(status)}
                                <span className={isLast ? "text-white font-semibold" : "text-slate-400"}>{text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 5. SLOW NETWORK ALERT BUTTON */}
                <AnimatePresence>
                  {showBackupBtn && hasBackupApi() && (
                    <m.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ type: "spring", damping: 20, stiffness: 200 }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchToBackup();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-warn-soft hover:bg-warn-soft text-warn border border-warn/20 font-semibold text-[11px] transition-all cursor-pointer"
                      >
                        <RefreshCw
                          size={11}
                          className="animate-spin text-warn"
                          style={{ animationDuration: "3s" }}
                        />
                        <span>Slow network? Switch to Backup API</span>
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>

                {/* 6. RED NEON CANCEL SYNC BUTTON */}
                <div className="pt-1.5 w-full">
                  <button
                    onClick={handleCancelSync}
                    className="group relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md border border-danger/80 bg-danger/8 hover:bg-danger/18 active:bg-danger/28 text-danger font-semibold text-xs transition-all duration-200 cursor-pointer ring-1 ring-danger/40"
                  >
                    <X
                      size={15}
                      className="stroke-[2.7] text-danger drop-"
                    />
                    <span className="drop-">Cancel Sync</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
