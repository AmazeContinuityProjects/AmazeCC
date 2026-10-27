"use client";

import { useTheme } from "next-themes";

interface GuestExperienceProps {
  onSignIn: () => void;
  onTryDemo: () => void;
}

export default function GuestExperience({
  onSignIn,
  onTryDemo,
}: GuestExperienceProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme ? resolvedTheme === "dark" : true;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#03060f] dark:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.17),_transparent_68%)]"
      />

      <header className="relative z-10 flex h-16 items-center justify-between border-b border-slate-200/70 px-5 dark:border-white/10 sm:px-8">
        <a href="/" className="flex items-center gap-2.5 font-bold tracking-tight" aria-label="AmazeCC home">
          <img src="/logo.png" alt="" width="32" height="32" className="h-8 w-8 rounded-lg object-contain" />
          <span>AmazeCC</span>
        </a>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle color theme"
            title="Toggle color theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ◐
          </button>
          <a
            href="/ffcs/"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300"
          >
            FFCS Planner
          </a>
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Sign in
          </button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
            The student workspace for VIT
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
              onClick={onSignIn}
              className="min-h-12 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Open my workspace
            </button>
            <button
              type="button"
              onClick={onTryDemo}
              className="min-h-12 rounded-xl border border-slate-300 bg-white/70 px-6 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              Try the demo
            </button>
          </div>
          <p className="mt-3 min-h-5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            Your VTOP credentials stay in this browser.
          </p>
        </div>

        <ul className="mt-14 grid max-w-4xl grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-4">
          {[
            "Attendance",
            "Grades and marks",
            "Campus schedule",
            "FFCS planning",
          ].map((feature) => (
            <li key={feature} className="rounded-xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
