"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowRight, Calendar, Heart, Sparkles, Zap } from "lucide-react";

/**
 * The below-the-fold landing (feature grid, predictor sandbox, showcase,
 * timeline, roadmap, FAQ) moved here from `LoginForm`. It stays behind a
 * dynamic import so a guest paints the hero above the fold first.
 */
const LandingSections = dynamic(() => import("../landing/LandingSections"), {
  ssr: false,
  loading: () => <div className="h-64" aria-hidden="true" />,
});

const SECTIONS = [
  { id: "sec-problem", label: "The Challenge" },
  { id: "sec-features", label: "Modules" },
  { id: "sec-timeline", label: "Timeline" },
  { id: "sec-roadmap", label: "Roadmap" },
  { id: "sec-faq", label: "FAQ" },
];

interface GuestExperienceProps {
  onGetStarted: () => void;
  onTryDemo: () => void;
}

export default function GuestExperience({ onGetStarted, onTryDemo }: GuestExperienceProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme ? resolvedTheme === "dark" : true;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-950 selection:bg-indigo-500/30 dark:bg-[#03060f] dark:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.17),_transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f060_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f060_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)]"
      />

      <header
        className={`sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b px-5 transition-all duration-300 sm:px-8 ${
          isScrolled
            ? "border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-neutral-900 dark:bg-[#03060Fd0]"
            : "border-transparent bg-transparent"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-w-0 items-center gap-7">
          <a href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight" aria-label="AmazeCC home">
            <img src="/logo.png" alt="" width="32" height="32" decoding="async" className="h-8 w-8 rounded-lg object-contain" />
            <span>AmazeCC</span>
          </a>
          <nav className="hidden items-center gap-5 text-xs font-semibold text-slate-500 dark:text-gray-400 lg:flex">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="transition-colors hover:text-slate-900 dark:hover:text-white"
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href="/ffcs/"
            title="Open FFCS Planner without login"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200/60 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <Calendar size={13} />
            <span className="hidden sm:inline">FFCS Planner</span>
          </a>
          <button
            type="button"
            aria-label="Toggle color theme"
            title="Toggle color theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ◐
          </button>
          <button
            type="button"
            onClick={onTryDemo}
            className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:text-gray-300 dark:hover:text-white sm:block"
          >
            Try demo
          </button>
          <button
            type="button"
            onClick={onGetStarted}
            className="min-h-9 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Get Started
          </button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
            <Sparkles size={12} /> The student workspace for VIT
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Your VIT life,
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300">
              all in one place.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
            Keep attendance, marks, schedules, campus services, and your FFCS plan together in one clear workspace.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Get Started
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={onTryDemo}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-6 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              <Zap size={15} />
              Try the demo
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("sec-features")}
              className="min-h-12 rounded-xl border border-transparent px-6 py-3 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Explore features
            </button>
          </div>
          <p className="mt-3 min-h-5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            Sign in with your VTOP credentials — they never leave this browser.
          </p>

          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-slate-200/50 dark:border-neutral-900/50">
            {[
              { value: "30+", label: "Student tools" },
              { value: "10+", label: "Modules" },
              { value: "100%", label: "Free & local" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[10px] font-bold uppercase text-slate-500 dark:text-gray-500">{stat.label}</dt>
                <dd className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <LandingSections />

      <footer className="border-t border-slate-200 bg-slate-100 px-6 py-8 text-center transition-colors dark:border-neutral-900 dark:bg-[#020409]/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-slate-500 dark:text-gray-500 md:flex-row">
          <div>
            <span className="font-bold text-slate-900 dark:text-white">AmazeCC</span>
          </div>
          <div className="flex gap-4">
            <a href="/ffcs/" className="transition-colors hover:text-slate-900 dark:hover:text-white">FFCS Planner</a>
            <span className="text-slate-300 dark:text-neutral-800">•</span>
            <a href="/privacy/" className="transition-colors hover:text-slate-900 dark:hover:text-white">Privacy</a>
            <span className="text-slate-300 dark:text-neutral-800">•</span>
            <a href="/terms/" className="transition-colors hover:text-slate-900 dark:hover:text-white">Terms</a>
            <span className="text-slate-300 dark:text-neutral-800">•</span>
            <a
              href="https://github.com/AmazeContinuityProjects/AmazeCC"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              GitHub
            </a>
          </div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold">
            Made with <Heart size={10} className="inline shrink-0 fill-rose-500 text-rose-500" /> by students. Not affiliated
            with VIT or VTOP.
          </p>
        </div>
      </footer>
    </main>
  );
}
