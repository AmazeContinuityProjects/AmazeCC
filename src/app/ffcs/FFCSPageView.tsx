"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, LogIn } from "lucide-react";
import ThemeToggle from "@/components/custom/ThemeToggle";
import FFCSTimetableTab from "@/components/custom/exams/FFCSTimetableTab";

export default function FFCSPageView() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation Bar */}
      <nav
        className="sticky top-0 left-0 right-0 z-40 bg-white/85 dark:bg-[#03060F]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-100/90 dark:bg-neutral-900/70 border border-slate-200/70 dark:border-white/[0.08]"
              title="Back to AmazeCC Home"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">AmazeCC Home</span>
              <span className="sm:hidden">Home</span>
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/[0.08]">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                FFCS Planner
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900"
            >
              <LogIn size={13} />
              <span>VTOP Login</span>
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
