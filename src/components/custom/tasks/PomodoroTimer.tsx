"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { settingsAtom } from "@/store/settingsAtoms";
import { pomodoroSessionsAtom } from "@/store/dataAtoms";
import { logPomodoroSession } from "@/lib/tasksStorage";
import type { Task } from "@/types/tasks";

interface PomodoroTimerProps {
  task?: Task | null;
  initialFocusMin?: number;
  initialBreakMin?: number;
  initialRounds?: number;
  onSessionComplete?: () => void;
  compact?: boolean;
}

type TimerPhase = "focus" | "break" | "completed";

export default function PomodoroTimer({
  task,
  initialFocusMin,
  initialBreakMin,
  initialRounds,
  onSessionComplete,
  compact = false,
}: PomodoroTimerProps) {
  const [settings] = useAtom(settingsAtom);
  const [, setSessions] = useAtom(pomodoroSessionsAtom);

  const focusMinutes =
    task?.pomodoro?.focusMin ||
    initialFocusMin ||
    settings?.taskPomodoroFocus ||
    25;
  const breakMinutes =
    task?.pomodoro?.breakMin ||
    initialBreakMin ||
    settings?.taskPomodoroBreak ||
    5;
  const totalRounds =
    task?.pomodoro?.rounds ||
    initialRounds ||
    settings?.taskPomodoroRounds ||
    4;

  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  // Sound chime
  const playChime = useCallback(() => {
    if (!settings?.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [settings?.soundEnabled]);

  const taskId = task?.id || null;

  // Timer interval
  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft <= 0) {
      playChime();
      if (phase === "focus") {
        if (currentRound < totalRounds) {
          setPhase("break");
          setTimeLeft(breakMinutes * 60);
        } else {
          // Completed all rounds
          setPhase("completed");
          setIsRunning(false);
          const finished = logPomodoroSession({
            taskId,
            startedAt: startedAt || new Date().toISOString(),
            focusMin: focusMinutes,
            breakMin: breakMinutes,
            roundsPlanned: totalRounds,
            roundsDone: totalRounds,
            done: true,
          });
          setSessions(finished);
          onSessionComplete?.();
        }
      } else if (phase === "break") {
        setPhase("focus");
        setCurrentRound((r) => r + 1);
        setTimeLeft(focusMinutes * 60);
      }
    }
    return () => clearInterval(timer);
  }, [
    isRunning,
    timeLeft,
    phase,
    currentRound,
    totalRounds,
    focusMinutes,
    breakMinutes,
    playChime,
    startedAt,
    taskId,
    onSessionComplete,
    setSessions,
  ]);

  const toggleRun = () => {
    if (!isRunning && !startedAt) {
      setStartedAt(new Date().toISOString());
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setPhase("focus");
    setCurrentRound(1);
    setTimeLeft(focusMinutes * 60);
    setStartedAt(null);
  };

  const handleSkip = () => {
    playChime();
    if (phase === "focus") {
      if (currentRound < totalRounds) {
        setPhase("break");
        setTimeLeft(breakMinutes * 60);
      } else {
        setPhase("completed");
        setIsRunning(false);
      }
    } else if (phase === "break") {
      setPhase("focus");
      setCurrentRound((r) => r + 1);
      setTimeLeft(focusMinutes * 60);
    }
  };

  // Derived progress
  const totalPhaseSeconds = (phase === "focus" ? focusMinutes : breakMinutes) * 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100)
  );

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "p-3 space-y-3" : "p-6 sm:p-8 space-y-6"
      }`}
    >
      {/* Phase Label & Round Dots */}
      <div className="flex flex-col items-center gap-1.5">
        <span
          className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
            phase === "focus"
              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
              : phase === "break"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          }`}
        >
          {phase === "completed"
            ? "Session Finished! 🎉"
            : phase === "focus"
            ? "Focus Time"
            : "Short Break"}
        </span>

        {/* Round indicators */}
        <div className="flex items-center gap-1.5 mt-1">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                compact ? "w-1.5 h-1.5" : "w-2.5 h-2.5"
              } ${
                i + 1 < currentRound || phase === "completed"
                  ? "bg-indigo-600 dark:bg-indigo-400"
                  : i + 1 === currentRound
                  ? "bg-indigo-500 ring-2 ring-indigo-500/30 animate-pulse"
                  : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Big Circular Ring Display */}
      <div className="relative flex items-center justify-center">
        {/* SVG Ring */}
        <svg
          className={`transform -rotate-90 ${compact ? "w-36 h-36" : "w-56 h-56"}`}
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            className="stroke-zinc-100 dark:stroke-zinc-800"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            className={`transition-all duration-500 ${
              phase === "break"
                ? "stroke-emerald-500"
                : phase === "completed"
                ? "stroke-amber-500"
                : "stroke-indigo-600 dark:stroke-indigo-500"
            }`}
            strokeWidth="6"
            strokeDasharray={276.46}
            strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Time Text Inside Ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-black font-outfit tracking-tighter ${
              compact ? "text-2xl" : "text-4xl sm:text-5xl"
            } text-zinc-900 dark:text-white`}
          >
            {formatTime(timeLeft)}
          </span>
          <span className="text-[11px] font-bold text-zinc-400 mt-0.5">
            Round {Math.min(currentRound, totalRounds)} of {totalRounds}
          </span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-2xs"
          title="Reset timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleRun}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
            isRunning
              ? "bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          disabled={phase === "completed"}
          className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-2xs disabled:opacity-40"
          title="Skip phase"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
