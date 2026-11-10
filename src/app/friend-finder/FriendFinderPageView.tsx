"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  LogIn,
  UsersRound,
  ShieldCheck,
  BookOpen,
  Clock,
  UserRound,
  BadgeCheck,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Star,
} from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { credentialsAtom, demoModeAtom, isLoggedInAtom } from "@/store";
import ThemeToggle from "@/components/custom/ThemeToggle";
import { getAssetPath } from "@/lib/utils";
import { useOverlayBackBoundary } from "@/lib/overlayStack";
import { storage } from "@/lib/storage";
import { hasStoredVtopCredentials } from "@/components/custom/app/readBootstrapSnapshot";
import { syncCurrentUserPostHogIdentity, trackScreenView } from "@/lib/posthog";
import FriendFinderLoginModal from "@/components/custom/friendfinder/FriendFinderLoginModal";

// Lazy-load the interactive FriendFinderTab to match the FFCS pattern
const FriendFinderTab = dynamic(() => import("@/components/custom/friendfinder/FriendFinderTab"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <span className="animate-pulse text-sm text-slate-500 dark:text-gray-400">Loading Friend Finder…</span>
    </div>
  ),
});

export default function FriendFinderPageView() {
  useOverlayBackBoundary("friend-finder-route");
  const [mounted, setMounted] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);
  const setDemoMode = useSetAtom(demoModeAtom);
  const setIDs = useSetAtom(credentialsAtom);

  // Hydrate session cache from storage on mount so / and /friend-finder share the signin session
  useEffect(() => {
    setMounted(true);
    try {
      const idsRaw = storage.ids.get();
      const storedUsername = storage.username.get();
      const storedPassword = storage.password.get();
      const isDemoStored = storage.demoMode.get();
      const hasVtop = hasStoredVtopCredentials(idsRaw, storedUsername, storedPassword);

      if (hasVtop || isDemoStored) {
        setIsLoggedIn(true);
        setDemoMode(Boolean(isDemoStored));
        setIDs({
          VtopUsername: storedUsername || "",
          VtopPassword: storedPassword || "",
          MoodleUsername: storage.moodleUsername.get() || "",
          MoodlePassword: storage.moodlePassword.get() || "",
          ...(idsRaw || {}),
        });
      }
    } catch {
      // Storage access guard
    }
  }, [setIsLoggedIn, setDemoMode, setIDs]);

  // Track screen view and ensure logged in users are registered in PostHog
  useEffect(() => {
    trackScreenView("friend_finder", isLoggedIn ? "dashboard" : "landing");
    if (isLoggedIn) {
      syncCurrentUserPostHogIdentity({
        route: "friend_finder",
        semester: "CH20262705",
      });
    }
  }, [isLoggedIn]);

  /* ─────────────────────────────────────────────────────────────
     When logged in:
     Skip the hero entirely and show only the Friend Finder page
     itself with the AmazeCC Logo at the top instead of BackButton.
  ───────────────────────────────────────────────────────────── */
  if (isLoggedIn) {
    return (
      <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
        <main className="flex-1 w-full px-3 sm:px-6 py-4 sm:py-6 overflow-x-clip">
          <FriendFinderTab standaloneLogo />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 dark:border-white/[0.08] py-6 text-center text-xs text-slate-500 dark:text-gray-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} Amaze Continuity Projects. Independent Student Timetable Tools.</p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Home
              </Link>
              <Link href="/ffcs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                FFCS Planner
              </Link>
              <Link
                href="/friend-finder/disclaimer"
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Disclaimer
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

  /* ─────────────────────────────────────────────────────────────
     When NOT logged in:
     Landing page hero onboarding experience with generic mock cards.
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation Bar */}
      <nav
        className="w-full bg-white/85 dark:bg-[#03060F]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] sticky top-0 z-40 transition-colors"
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
                src={getAssetPath("/favicon/favicon.svg")}
                alt="AmazeCC"
                className="h-8 w-8 object-contain"
              />
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight font-outfit text-zinc-900 dark:text-white">
                  AmazeCC <span className="text-indigo-600 dark:text-indigo-400">Friend Finder</span>
                </span>
                <span className="hidden md:inline-flex items-center text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  Winter 26-27
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/ffcs"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-xl"
            >
              <BookOpen size={13} />
              <span>FFCS Planner</span>
            </Link>
            <Link
              href="/friend-finder/disclaimer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-xl"
            >
              <ShieldAlert size={13} />
              <span>Disclaimer</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              title="Login with VTOP"
              aria-label="Login with VTOP"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 shadow-2xs active:scale-95 cursor-pointer"
            >
              <LogIn size={14} className="shrink-0" />
              <span className="hidden sm:inline">Login with VTOP</span>
            </button>
            {mounted && <ThemeToggle />}
          </div>
        </div>
      </nav>

      {/* Hero Onboarding Section */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 pb-12 sm:pb-20 border-b border-slate-200/80 dark:border-white/[0.08]">
        {/* Glow gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 pointer-events-none -z-10 overflow-hidden opacity-60 dark:opacity-40">
          <div className="absolute top-[-10%] left-[20%] w-[450px] h-[350px] rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute top-[10%] right-[20%] w-[400px] h-[320px] rounded-full bg-purple-500/15 blur-[110px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          {/* Semester Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold font-outfit text-indigo-700 dark:text-indigo-300">
              Winter Semester 2026-2027 · CH20262705
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-outfit tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Find Your Friends & Classmates <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              In Every Section
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-zinc-300 leading-relaxed">
            See who picked the same course slots, faculties, and classroom sections as you for next semester. Verified
            through VTOP with strict reciprocal privacy and complete opt-in control.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold px-7 py-3.5 text-sm shadow-xl shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with VTOP to Discover</span>
            </button>

            <Link
              href="/friend-finder/disclaimer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold px-6 py-3.5 text-sm border border-slate-200/80 dark:border-zinc-800 transition-all"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Sharing Disclaimer</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] backdrop-blur-sm space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <BadgeCheck className="w-5 h-5 shrink-0" />
                <span className="font-bold text-xs sm:text-sm font-outfit text-slate-900 dark:text-white">
                  VTOP-Verified Students
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">
                No impostors or fake signups. Every classmate is verified with their university registration.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] backdrop-blur-sm space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="font-bold text-xs sm:text-sm font-outfit text-slate-900 dark:text-white">
                  Reciprocal Privacy
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">
                Only students registered in your exact section can see you. No public or universal directory.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] backdrop-blur-sm space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <EyeOff className="w-5 h-5 shrink-0" />
                <span className="font-bold text-xs sm:text-sm font-outfit text-slate-900 dark:text-white">
                  Instant Opt-Out
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">
                Toggle &ldquo;Hidden&rdquo; or delete your data at any time with a single tap. You stay in control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Preview Area (Generic Illustrations only — no actual student names or reg numbers) */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        <div className="space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Interface Preview
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-outfit text-slate-900 dark:text-white">
              How Friend Finder Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
              Here is an illustrative example of what your section roster looks like when you sync your registered
              timetable:
            </p>
          </div>

          {/* Illustrative Mock Section Card */}
          <div className="max-w-2xl mx-auto rounded-3xl border border-slate-200/90 dark:border-white/[0.08] bg-white/95 dark:bg-zinc-900/90 shadow-xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-outfit font-black text-base sm:text-lg text-slate-900 dark:text-white">
                      BCSE202L
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      Theory
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-300">
                    Data Structures and Algorithms
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" /> Slot A1+TA1
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="w-3.5 h-3.5 text-indigo-500" /> Prof. Faculty Member
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold">
                  <UsersRound className="w-3.5 h-3.5" /> 3 classmates
                </span>
              </div>
            </div>

            {/* Generic Classmate Placeholders - NO actual student names or numbers */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Classmates in this section (Illustrative)
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 pl-1.5 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold font-outfit text-xs">
                    SA
                  </span>
                  <span>Student A</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300">
                    25BXX0001
                  </span>
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 pl-1.5 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold font-outfit text-xs">
                    SB
                  </span>
                  <span>Student B</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300">
                    25BXX0002
                  </span>
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 pl-1.5 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="w-7 h-7 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold font-outfit text-xs">
                    SC
                  </span>
                  <span>Student C</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300">
                    25BXX0003
                  </span>
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Action Banner */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold py-3 text-xs shadow-md transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in with VTOP to see your actual classmates</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="space-y-6 pt-6">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-2xl font-black font-outfit text-slate-900 dark:text-white">
              Why Use AmazeCC Friend Finder?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Built by VIT students for VIT students to coordinate classes effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </span>
              <h3 className="font-bold font-outfit text-base text-slate-900 dark:text-white">Course & Slot Grouping</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Browse classmates grouped by specific courses or view friends to see how many total hours you share
                across the week.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </span>
              <h3 className="font-bold font-outfit text-base text-slate-900 dark:text-white">
                Faculty Reviews & Ratings
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Drill down into any registered course to read real student reviews and ratings for your assigned
                professors.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h3 className="font-bold font-outfit text-base text-slate-900 dark:text-white">Zero Impersonation</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Timetable matching is verified against authentic VTOP session snapshots. No one can register with fake
                credentials.
              </p>
            </div>
          </div>
        </section>

        {/* Disclaimer Callout Box */}
        <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold font-outfit text-base">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3>Data Sharing & Liability Disclaimer</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Sharing your timetable is 100% voluntary and opt-in. Amaze Continuity Projects is not liable for data
              voluntarily shared with peers. You can toggle Hidden or delete your data at any moment.
            </p>
          </div>
          <Link
            href="/friend-finder/disclaimer"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors"
          >
            <span>Read full disclaimer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-white/[0.08] py-8 text-center text-xs text-slate-500 dark:text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Amaze Continuity Projects. Independent Student Timetable Tools.</p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Home
            </Link>
            <Link href="/ffcs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              FFCS Planner
            </Link>
            <Link
              href="/friend-finder/disclaimer"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Disclaimer
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

      {/* VTOP Sync Engine Login Modal */}
      <FriendFinderLoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
      />
    </div>
  );
}
