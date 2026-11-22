"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/custom/ThemeToggle";

export default function TermsOfServicePage() {
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
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
            >
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">Privacy Policy</span>
              <span className="sm:hidden">Privacy</span>
            </Link>
            <Link
              href="/terms"
              aria-current="page"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-extrabold bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
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
              Terms of Service
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">Last updated: June 23, 2026</p>
          </div>

          <div className="space-y-5 max-w-prose text-sm leading-normal font-medium text-pretty">
            <p>
              Welcome to <strong>AmazeCC</strong>. By using this application, you agree to the following Terms of
              Service. Please read them carefully before using the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Purpose</h2>
              <p>
                <strong>AmazeCC</strong> is an experimental web application created solely for educational and personal
                use. It provides tools to help students view and organize their academic data retrieved from{" "}
                <strong>VTOP</strong> (VIT’s official portal). This app is not an official VIT product and is{" "}
                <strong>not affiliated, endorsed, or maintained by Vellore Institute of Technology (VIT)</strong> in any
                manner.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Data Handling</h2>
              <p>
                Your login credentials, academic data, and settings are kept <strong>on your local device</strong> via
                browser local storage and are not uploaded by default. A few features are explicit exceptions: Grade
                Prediction sends the marks used for class statistics to our server; choosing the <strong>UniCC</strong>{" "}
                sign-in server sends your VTOP password to a third party; and social features send only what you choose
                to share. See the Privacy Policy for details. Clearing your browser data removes locally stored
                information.
              </p>
              <p>
                When you log in, the app connects directly to the official <strong>VTOP</strong> website to retrieve
                your academic data for display. This data is processed locally in your browser and is not shared
                externally except by the features listed above. At the same time, the application also connects to the{" "}
                <strong>Events Hub</strong> website to retrieve your registered events for display. It allows you to
                download your receipts, your certificates by streaming the download. The app does not handle payments
                gateway of any sort or kind, and will not receive or send payments. This app provides a beta feature -
                "Pay Now" button that redirects to the official payment portal, as such does not handle payments. By
                clicking the pay now button, you automatically accept to the Event Hub Terms and Conditions, and
                similarly thereof absolve the developer of this site of any responsibility. This data is also processed
                locally in your browser and is not shared externally except by the features listed above.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                No Monetization or Commercial Use
              </h2>
              <p>
                <strong>AmazeCC</strong> is a free and non-commercial project. The developer does not earn revenue,
                display advertisements, sell data, or monetize the service in any way. The app is provided purely for
                fun, learning, and experimentation purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Disclaimer of Liability
              </h2>
              <p>
                The app is provided on an &ldquo;as-is&rdquo; basis with no guarantees of accuracy, reliability, or
                availability. The developer is{" "}
                <strong>not responsible for any data inaccuracies, login failures, or service interruptions</strong>{" "}
                that may occur due to VTOP updates, VIT Event Hubs updates,or other external factors.
              </p>
              <p>
                Users are solely responsible for the use of their VTOP credentials within the app. It is recommended to
                use this app only on trusted devices and networks. You use this application at your own risk and
                discretion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Friend Finder & Voluntary Timetable Sharing
              </h2>
              <p>
                AmazeCC provides an optional <strong>Friend Finder</strong> feature enabling students to discover peers
                enrolled in matching course sections. Participation is 100% voluntary and opt-in. The developer
                expressly disclaims all liability and responsibility for any data, real names, or registration numbers
                you voluntarily choose to share with classmates. For comprehensive data boundaries and terms, please
                consult the dedicated{" "}
                <Link
                  href="/friend-finder/disclaimer"
                  className="text-indigo-600 dark:text-indigo-400 underline font-semibold"
                >
                  Friend Finder Disclaimer
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Affiliation</h2>
              <p>
                This app is an <strong>independent student project</strong> and is in no way affiliated with, endorsed
                by, or supported by Vellore Institute of Technology (VIT) or any of its departments. This project is
                created out of personal interest, curiosity and learning, and is not an official VIT product.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Changes to Terms</h2>
              <p>
                These terms may be updated periodically to reflect improvements or changes in app behavior. Continued
                use of the app after updates constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Contact</h2>
              <p>
                For any concerns, questions, or feedback related to this app or these Terms of Service, you can contact
                the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
