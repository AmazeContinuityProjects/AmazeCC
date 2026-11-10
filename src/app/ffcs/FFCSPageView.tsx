"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LayoutDashboard, LogIn } from "lucide-react";
import { useAtomValue } from "jotai";
import { isLoggedInAtom } from "@/store";
import { prepareSignIn, SIGN_IN_PARAM } from "@/lib/signInReturn";
import ThemeToggle from "@/components/custom/ThemeToggle";
import { getAssetPath } from "@/lib/utils";
import { useOverlayBackBoundary } from "@/lib/overlayStack";

// The planner is ~440KB of async chunks; the shell (nav + footer) is a few
// KB. Deferring the tab keeps the share-link landing paintable without the
// whole graph, matching how the dashboard already lazy-loads its tabs.
const FFCSTimetableTab = dynamic(() => import("@/components/custom/exams/FFCSTimetableTab"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
      <span className="animate-pulse text-sm text-slate-500 dark:text-gray-400">Loading planner…</span>
    </div>
  ),
});

export default function FFCSPageView() {
  useOverlayBackBoundary("ffcs-route");
  const [mounted, setMounted] = useState(false);
  const [plannerLayoutMode, setPlannerLayoutMode] = useState<"guided" | "modern" | "classic">("modern");
  // The planner tab hydrates this from the stored session on mount, so the
  // header can tell a signed-in student from a guest.
  const isLoggedIn = useAtomValue(isLoggedInAtom);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation Bar - non-sticky so it scrolls with the page */}
      <nav
        hidden={plannerLayoutMode === "modern"}
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
                loading="lazy"
                decoding="async"
                src={getAssetPath("/favicon/FFCS.png")}
                alt="AmazeCC FFCS"
                className="h-8 w-8 rounded-xl object-contain shadow-xs border border-indigo-500/30 p-0.5 bg-white dark:bg-zinc-900"
              />
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight font-outfit text-zinc-900 dark:text-white">
                  AmazeCC <span className="text-indigo-600 dark:text-indigo-400">FFCS</span>
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Signed in: a way back to the app. Signed out: sign in, then return here. */}
            <Link
              href={isLoggedIn ? "/" : `/?${SIGN_IN_PARAM}=1`}
              onClick={isLoggedIn ? undefined : () => prepareSignIn("/ffcs/")}
              title={isLoggedIn ? "Open AmazeCC" : "Login to AmazeCC"}
              aria-label={isLoggedIn ? "Open AmazeCC" : "Login to AmazeCC"}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 shadow-2xs active:scale-95"
            >
              {isLoggedIn ? (
                <LayoutDashboard size={14} className="shrink-0" />
              ) : (
                <LogIn size={14} className="shrink-0" />
              )}
              <span className="hidden sm:inline">{isLoggedIn ? "Open AmazeCC" : "Login to AmazeCC"}</span>
            </Link>
            {mounted && <ThemeToggle />}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full px-3 sm:px-6 py-4 sm:py-6 overflow-x-clip">
        <FFCSTimetableTab onLayoutModeChange={setPlannerLayoutMode} />
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
