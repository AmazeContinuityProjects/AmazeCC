"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/custom/ThemeToggle";
import FacultyReviewsTab from "@/components/custom/reviews/FacultyReviewsTab";
import { ENABLE_AMAZE_REVIEWS } from "@/lib/reviewsService";

export default function FacultyReviewsPage() {
  const router = useRouter();

  // The feature is env-gated; with the flag off this page must not render
  // anything that would send identity-bearing requests.
  useEffect(() => {
    if (!ENABLE_AMAZE_REVIEWS) router.replace("/");
  }, [router]);

  if (!ENABLE_AMAZE_REVIEWS) {
    return (
      <div className="min-h-screen w-full bg-slate-50/60 dark:bg-[#03060F] transition-colors duration-300 text-slate-800 dark:text-gray-200 font-sans flex items-center justify-center">
        <p className="text-xs text-slate-500 dark:text-gray-400">Page not available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50/60 dark:bg-[#03060F] transition-colors duration-300 relative text-slate-800 dark:text-gray-200 font-sans pb-16">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[120px]" />
      </div>

      {/* Top Navbar */}
      <header
        className="sticky top-0 z-40 bg-white/80 dark:bg-[#03060F]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-white/[0.06]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <FacultyReviewsTab />
      </main>
    </div>
  );
}
