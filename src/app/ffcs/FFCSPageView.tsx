"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, LogIn } from "lucide-react";
import ThemeToggle from "@/components/custom/ThemeToggle";
import FFCSTimetableTab from "@/components/custom/exams/FFCSTimetableTab";
import { getAssetPath } from "@/lib/utils";

export default function FFCSPageView() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation Bar - non-sticky so it scrolls with the page */}
      <nav
        className="w-full bg-white/85 dark:bg-[#03060F]/85 border-b border-slate-200/80 dark:border-white/[0.08]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform active:scale-95"
              title="AmazeCC Home"
            >
              <img
                src={getAssetPath("/logo.png")}
                alt="AmazeCC"
                className="h-8 w-8 rounded-xl object-contain shadow-xs border border-zinc-200/60 dark:border-zinc-800/80 p-0.5 bg-white dark:bg-zinc-900"
              />
              <span className="text-base sm:text-lg font-black tracking-tight font-outfit text-zinc-900 dark:text-white">
                AmazeCC
              </span>
            </Link>

            <div className="h-4 w-px bg-slate-200 dark:border-white/[0.08] dark:bg-white/[0.08]" />

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400">
              <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>FFCS Planner</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 shadow-2xs active:scale-95"
            >
              <LogIn size={13} />
              <span>Login to AmazeCC</span>
            </Link>
            {mounted && <ThemeToggle />}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6">
        <FFCSTimetableTab />
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-200/80 dark:border-white/[0.08] py-6 text-center text-xs text-slate-500 dark:text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} AmazeCC. Offline-first FFCS Timetable Planner.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
