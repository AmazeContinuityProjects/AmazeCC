"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck } from "lucide-react";

interface LoadingScreenProps {
  logoSrc?: string;
  wordmarkLightSrc?: string;
  wordmarkDarkSrc?: string;
  title?: string;
  subtitle?: string;
  progress?: number;
  className?: string;
}

const LOADING_STEPS = [
  "Initializing Student OS...",
  "Loading Campus Profile...",
  "Syncing Attendance & Marks...",
  "Preparing Dashboard...",
  "Ready!",
];

export function LoadingScreen({
  logoSrc = "/logo.png",
  wordmarkLightSrc: _wordmarkLightSrc,
  wordmarkDarkSrc,
  title = "Student Operating System",
  progress: externalProgress,
  className = "",
}: LoadingScreenProps) {
  const [internalProgress, setInternalProgress] = useState(14);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof externalProgress === "number") return;
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 96) {
          clearInterval(interval);
          return 98;
        }
        const diff = Math.floor(Math.random() * 14) + 8;
        const next = Math.min(98, prev + diff);
        const nextStep = Math.min(
          LOADING_STEPS.length - 1,
          Math.floor((next / 100) * LOADING_STEPS.length)
        );
        setStepIndex(nextStep);
        return next;
      });
    }, 160);

    return () => clearInterval(interval);
  }, [externalProgress]);

  const currentProgress = typeof externalProgress === "number" ? externalProgress : internalProgress;
  const currentStep = LOADING_STEPS[stepIndex] || "Loading AmazeCC...";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] text-white overflow-hidden select-none ${className}`}
    >
      {/* Ambient background glow orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-pink-600/10 blur-[120px] pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
        {/* App Icon Container with Breathing Levitation & Glow Ring */}
        <motion.div
          initial={{ scale: 0.75, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6"
        >
          {/* Pulsing ring aura */}
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(99, 102, 241, 0.25)",
                "0 0 45px rgba(168, 85, 247, 0.45)",
                "0 0 20px rgba(99, 102, 241, 0.25)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center backdrop-blur-xl shadow-2xl overflow-hidden p-3 relative"
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="AmazeCC Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            ) : (
              <Sparkles className="w-10 h-10 text-indigo-400" />
            )}
          </motion.div>
        </motion.div>

        {/* Brand Wordmark & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1.5 mb-8"
        >
          {wordmarkDarkSrc ? (
            <img
              src={wordmarkDarkSrc}
              alt="amaze cc"
              className="h-7 mx-auto object-contain filter drop-shadow"
            />
          ) : (
            <h1 className="text-2xl font-black tracking-tight text-white font-outfit">
              amaze <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-md font-extrabold ml-1">CC</span>
            </h1>
          )}
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">
            {title}
          </p>
        </motion.div>

        {/* Creative Neon Progress Bar with Percentage Counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="w-full space-y-2.5"
        >
          {/* Progress Pill Bar */}
          <div className="w-full h-2 rounded-full bg-zinc-900 border border-zinc-800/80 p-0.5 overflow-hidden relative shadow-inner">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(100, Math.max(5, currentProgress))}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Lead Glow */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/80 rounded-full blur-[2px]" />
            </motion.div>
          </div>

          {/* Status Message & Progress Text */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 px-0.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentStep}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="truncate text-zinc-400 font-medium"
              >
                {currentStep}
              </motion.span>
            </AnimatePresence>
            <span className="font-mono text-[10px] font-extrabold text-indigo-400 shrink-0 ml-2">
              {Math.min(100, Math.round(currentProgress))}%
            </span>
          </div>
        </motion.div>

        {/* Security badge footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-zinc-600"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>Local Storage Encryption Enabled</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
