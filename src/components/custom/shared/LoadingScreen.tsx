"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Cpu } from "lucide-react";

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
  "Connecting to VTOP Gateway...",
  "Decrypting Session Tokens...",
  "Synchronizing Attendance & Timetable...",
  "Building Student OS Dashboard...",
  "System Ready!",
];

export function LoadingScreen({
  logoSrc = "/logo.png",
  wordmarkLightSrc: _wordmarkLightSrc,
  wordmarkDarkSrc,
  title = "Student Operating System",
  progress: externalProgress,
  className = "",
}: LoadingScreenProps) {
  const [internalProgress, setInternalProgress] = useState(12);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof externalProgress === "number") return;
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 98) {
          clearInterval(interval);
          return 100;
        }
        const diff = Math.floor(Math.random() * 8) + 8;
        const next = Math.min(100, prev + diff);
        const nextStep = Math.min(
          LOADING_STEPS.length - 1,
          Math.floor((next / 100) * LOADING_STEPS.length)
        );
        setStepIndex(nextStep);
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [externalProgress]);

  const currentProgress = typeof externalProgress === "number" ? externalProgress : internalProgress;
  const currentStep = LOADING_STEPS[stepIndex] || "Loading AmazeCC...";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.05,
        filter: "blur(12px)",
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] text-white overflow-hidden select-none ${className}`}
    >
      {/* Dynamic ambient background glow orbs */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          rotate: [0, 90, 0],
          opacity: [0.25, 0.45, 0.25],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[580px] h-[580px] rounded-full bg-gradient-to-br from-indigo-600/35 via-purple-600/25 to-pink-600/15 blur-[140px] pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [1.1, 0.9, 1.1],
          opacity: [0.15, 0.35, 0.15],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-indigo-600/20 blur-[100px] pointer-events-none"
      />

      {/* Floating particles background grid effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
        {/* App Icon Container with Floating Physics & Dual Aura Glow */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-7"
        >
          {/* Outer floating physics loop */}
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [0, 1, -1, 0],
            }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            {/* Dual pulsing aura ring */}
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 25px rgba(99, 102, 241, 0.3), 0 0 50px rgba(168, 85, 247, 0.15)",
                  "0 0 55px rgba(168, 85, 247, 0.55), 0 0 90px rgba(236, 72, 153, 0.25)",
                  "0 0 25px rgba(99, 102, 241, 0.3), 0 0 50px rgba(168, 85, 247, 0.15)",
                ],
              }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-28 h-28 rounded-[28px] bg-zinc-900/90 border border-zinc-800/90 flex items-center justify-center backdrop-blur-2xl shadow-2xl overflow-hidden p-3.5 relative"
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="AmazeCC Logo"
                  className="w-full h-full object-contain filter drop-shadow-lg"
                />
              ) : (
                <Sparkles className="w-12 h-12 text-indigo-400" />
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Brand Wordmark & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2 mb-9"
        >
          {wordmarkDarkSrc ? (
            <img
              src={wordmarkDarkSrc}
              alt="amaze cc"
              className="h-7.5 mx-auto object-contain filter drop-shadow-md"
            />
          ) : (
            <h1 className="text-2xl font-black tracking-tight text-white font-outfit">
              amaze <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-2 py-0.5 rounded-md font-extrabold ml-1 shadow-sm">CC</span>
            </h1>
          )}
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
            {title}
          </p>
        </motion.div>

        {/* Creative Multi-Layered Neon Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="w-full space-y-3"
        >
          {/* Progress Bar Container */}
          <div className="w-full h-2.5 rounded-full bg-zinc-900/90 border border-zinc-800 p-0.5 overflow-hidden relative shadow-inner">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(100, Math.max(5, currentProgress))}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {/* Animated Lead Glow Particle Beam */}
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-0 top-0 bottom-0 w-4 bg-white/90 rounded-full blur-[2px] shadow-[0_0_12px_#fff]"
              />
            </motion.div>
          </div>

          {/* Status Message & Progress Text Switcher */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 px-1">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentStep}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="truncate text-zinc-300 font-medium flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
                <span>{currentStep}</span>
              </motion.span>
            </AnimatePresence>

            <span className="font-mono text-[11px] font-black text-indigo-400 shrink-0 ml-2">
              {Math.min(100, Math.round(currentProgress))}%
            </span>
          </div>
        </motion.div>

        {/* Security badge footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-14 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local Storage Encryption Enabled</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
