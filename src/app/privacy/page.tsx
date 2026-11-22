"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/custom/ThemeToggle";

export default function PrivacyPolicyPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-24 bg-slate-50/60 dark:bg-background transition-colors duration-300 relative overflow-hidden text-slate-800 dark:text-gray-200 font-sans">
      {/* Sticky Header Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-2 sm:flex sm:h-16 sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
          {/* Mobile: back + theme share the first row; tabs get their own row. */}
          <div className="flex items-center justify-between gap-2 sm:shrink-0">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-white/[0.06] focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft size={14} />
              <span>Back to AmazeCC</span>
            </Link>
            <div className="flex shrink-0 items-center gap-3">{mounted && <ThemeToggle />}</div>
          </div>

          {/* Switcher Tab between Privacy, Terms & Friend Finder — full width on phones, no hidden scroll strip */}
          <div className="mt-2 grid w-full grid-cols-3 gap-1 rounded-2xl border border-slate-200/60 bg-slate-200/60 p-1 dark:border-white/[0.06] dark:bg-neutral-900/80 sm:mt-0 sm:w-auto sm:shrink-0 sm:flex sm:items-center">
            <Link
              href="/privacy"
              aria-current="page"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-extrabold bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
            >
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">Privacy Policy</span>
              <span className="sm:hidden">Privacy</span>
            </Link>
            <Link
              href="/terms"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">Terms of Service</span>
              <span className="sm:hidden">Terms</span>
            </Link>
            <Link
              href="/friend-finder/disclaimer"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
            >
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">Friend Finder</span>
              <span className="sm:hidden">Disclaimer</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="w-full max-w-2xl space-y-6 relative z-10 pt-10">
        {/* Content Card */}
        <div className="card-surface border border-border-strong dark:border-border rounded-[24px] p-8 shadow-xs space-y-6 text-slate-700 dark:text-gray-300">
          <div className="border-b border-slate-100 dark:border-white/[0.08] pb-4">
            <h1 className="text-[32px] font-black tracking-tight text-balance leading-[1.15] text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">Last updated: 11 Nov, 2025</p>
          </div>

          <div className="space-y-5 max-w-prose text-sm leading-normal font-medium text-pretty">
            <p>
              This Privacy Policy describes how <strong>AmazeCC</strong> handles data when you use the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Data Storage</h2>
              <p>
                Data fetched from <strong>VTOP</strong> (including your academic data and cached results) is stored{" "}
                <strong>locally on your device</strong> by default. There are three explicit exceptions: Grade
                Prediction sends the marks needed for class statistics to our server (below); choosing the{" "}
                <strong>UniCC</strong> sign-in server sends your VTOP password to <strong>api.uni-cc.site</strong>, a
                third party; and social features send only what you choose to share to the configured AmazeCC API.
                Nothing else is uploaded.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Grade Prediction & Statistics
              </h2>
              <p>
                To calculate global class statistics (mean and standard deviation) for the Grade Prediction feature,
                your academic marks are temporarily sent to our server via an encrypted connection. The server strictly
                processes the numbers in-memory to incrementally update the class-wide averages using Welford's
                Algorithm and then <strong>immediately discards</strong> your individual marks. We do not store, map, or
                link any marks to any user. The process is completely anonymous.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Friend Finder (Voluntary Timetable Matching)
              </h2>
              <p>
                The optional <strong>Friend Finder</strong> feature allows students to find classmates sharing their
                registered course sections for the upcoming semester. If and only if you explicitly choose to publish
                your registered timetable, your verified name, university registration number (e.g.{" "}
                <code>25BXX0001</code>), and enrolled section identifiers are shared with classmates enrolled in those
                exact sections.
              </p>
              <p>
                Visibility is strictly reciprocal: only students sharing your sections can view you. You can switch your
                profile to &ldquo;Hidden&rdquo; or permanently delete your timetable registration at any time. For more
                information, read our{" "}
                <Link
                  href="/friend-finder/disclaimer"
                  className="text-indigo-600 dark:text-indigo-400 underline font-semibold"
                >
                  Friend Finder Data Sharing Disclaimer
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Cookies & Analytics</h2>
              <p>
                <strong>AmazeCC</strong> uses <strong>Posthog via shoot.amazecc.com</strong> and{" "}
                <strong>Google Analytics</strong> to gather <em>anonymous, aggregate data</em> such as page visits,
                device types, and general interaction information. These analytics help improve the app’s performance
                and user experience.
              </p>
              <p>
                This data does <strong>not</strong> include any privately identifiable information such as login
                credentials, or academic records. The analytics cookies are handled entirely by <strong>Google</strong>{" "}
                and <strong>Posthog</strong> under their respective privacy policies. Posthog is configured to track
                user interactions to help track down errors and analyse features as a part of an extended experiment to
                optimise the app. Errors are tracked by associating the error with your profile, which contains minimal
                identifiable info to track down errors for your particular configuration. The data is not shared with
                any third party and is used purely for debugging and improving the app.
              </p>
              <p>
                AmazeCC does not sell data, or share analytics with any third party. These analytics are used purely for{" "}
                <strong>educational and experimental</strong> purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Notifications</h2>
              <p>
                The app may send push notifications if you opt in. You can disable push notifications at any time
                through your browser settings. There are no background processes that track or monitor user behavior.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Local Storage</h2>
              <p>
                Settings, preferences, and any cached data are stored using your browser’s local storage mechanism. This
                data stays on your device unless one of the exceptions above applies, and can be cleared manually at any
                time from within the app.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Open Source</h2>
              <p>
                <strong>AmazeCC</strong> is an <strong>open-source project</strong> created for learning and
                experimentation purposes. The source code is publicly available, and anyone is welcome to explore,
                modify, or contribute improvements through the project’s GitHub repository.
              </p>
              <p>
                Contributions are voluntary and governed by the project’s open-source license. No data collected by
                contributors or modifications affects user privacy or transmits information externally.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Contact</h2>
              <p>
                For any concerns or questions about this Privacy Policy, you can reach out to the developer at{" "}
                <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
