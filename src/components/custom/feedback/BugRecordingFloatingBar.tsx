"use client";

import React, { useEffect, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  isBugRecordingActiveAtom,
  bugRecordingStartedAtAtom,
  hasBugRecordingClipAtom,
  bugRecordingDurationAtom,
  bugRecordingOriginAtom,
  isFeedbackModalOpenAtom,
} from "@/store/uiAtoms";
import { stopPostHogSessionRecording } from "@/lib/posthog";
import { useDashboardNavigator } from "../dashboard/DashboardNavigator";
import { CheckCircle2, Video, X } from "lucide-react";

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BugRecordingFloatingBar() {
  const [isActive, setIsActive] = useAtom(isBugRecordingActiveAtom);
  const [startedAt, setStartedAt] = useAtom(bugRecordingStartedAtAtom);
  const setHasClip = useSetAtom(hasBugRecordingClipAtom);
  const setDuration = useSetAtom(bugRecordingDurationAtom);
  const [origin] = useAtom(bugRecordingOriginAtom);
  const setIsFeedbackOpen = useSetAtom(isFeedbackModalOpenAtom);
  const { setActiveTab } = useDashboardNavigator();

  const [elapsed, setElapsed] = useState(0);

  // Update timer every second while recording
  useEffect(() => {
    if (!isActive || !startedAt) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startedAt) / 1000));
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  // Clean up if user closes or reloads the tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopPostHogSessionRecording();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  if (!isActive) return null;

  const handleFinishAndReview = () => {
    stopPostHogSessionRecording();
    setDuration(elapsed);
    setHasClip(true);
    setIsActive(false);
    setStartedAt(null);

    // Return to the origin of the recording
    if (origin === "modal") {
      setIsFeedbackOpen(true);
    } else {
      setActiveTab("feedback");
    }
  };

  const handleCancel = () => {
    stopPostHogSessionRecording();
    setIsActive(false);
    setStartedAt(null);
    setHasClip(false);
    setDuration(0);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300 pointer-events-auto select-none"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 px-3.5 py-1.5 sm:py-2 rounded-full bg-zinc-950/95 text-white dark:bg-zinc-900/95 backdrop-blur-md border border-rose-500/40 shadow-xl shadow-rose-950/30">
        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-rose-400 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <span>REC {formatElapsed(elapsed)}</span>
        </span>

        <span className="hidden md:inline text-xs text-zinc-300 font-medium truncate max-w-[200px]">
          Replicate the issue in AmazeCC...
        </span>

        <div className="flex items-center gap-1.5 border-l border-zinc-700/60 pl-2 shrink-0">
          <button
            type="button"
            onClick={handleFinishAndReview}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish & Review</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            title="Cancel recording"
            className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
