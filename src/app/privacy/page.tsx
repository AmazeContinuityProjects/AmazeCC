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
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-24 bg-slate-50/60 dark:bg-[#03060F] transition-colors duration-300 relative overflow-hidden text-slate-800 dark:text-gray-200 font-sans">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[120px]" />
      </div>

      {/* Sticky Header Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#03060F]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-white/[0.06]"
            >
              <ArrowLeft size={14} />
              <span>Back to Login</span>
            </Link>
          </div>

          {/* Switcher Tab between Privacy & Terms */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-neutral-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
            <Link 
              href="/privacy" 
              className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck size={13} />
              <span>Privacy Policy</span>
            </Link>
            <Link 
              href="/terms" 
              className="px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all"
            >
              <FileText size={13} />
              <span>Terms of Service</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {mounted && <ThemeToggle />}
          </div>
        </div>
      </nav>

      <div className="w-full max-w-2xl space-y-6 relative z-10 pt-10">
        {/* Content Card */}
        <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-8 shadow-xl space-y-6 text-slate-700 dark:text-gray-300">
          <div className="border-b border-slate-100 dark:border-white/[0.08] pb-4">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-outfit)]">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">
              Last updated: 11 Nov, 2025
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed font-medium">
            <p>
              This Privacy Policy describes how <strong>AmazeCC</strong> handles data when you use the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Data Storage
              </h2>
              <p>
                All data fetched from <strong>VTOP</strong> (including your academic data, credentials, or
                related content) is stored <strong>locally on your device</strong>. No information from VTOP is
                ever uploaded, transmitted, or stored on any external servers controlled by this app, with the exception of the Grade Prediction feature.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Grade Prediction & Statistics
              </h2>
              <p>
                To calculate global class statistics (mean and standard deviation) for the Grade Prediction feature, your academic marks are temporarily sent to our server via an encrypted connection. 
                The server strictly processes the numbers in-memory to incrementally update the class-wide averages using Welford's Algorithm and then <strong>immediately discards</strong> your individual marks. 
                We do not store, map, or link any marks to any user. The process is completely anonymous. 
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cookies & Analytics
              </h2>
              <p>
                <strong>AmazeCC</strong> uses <strong>Vercel Analytics</strong> and <strong>Google Analytics</strong> to gather <em>anonymous, aggregate data</em> such as page visits, device types, and general interaction information. These analytics help improve the app’s performance and user experience.
              </p>
              <p>
                This data does <strong>not</strong> include any personally identifiable information such as names, login credentials, or academic records. The analytics cookies are handled entirely by <strong>Google</strong> and <strong>Vercel</strong> under their respective privacy policies.
              </p>
              <p>
                AmazeCC does not track users, create profiles, sell data, or share analytics with any third party. These analytics are used purely for <strong>educational and experimental</strong> purposes and can be cleared anytime by removing browser cookies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Notifications
              </h2>
              <p>
                The app may send push notifications if you opt in. You can disable push notifications at any time through your browser settings. There are no background processes that track or monitor user behavior.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Local Storage
              </h2>
              <p>
                Settings, preferences, and any cached data are stored using your browser’s local storage mechanism. This data never leaves your device and can be cleared manually at any time from within the app.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Open Source
              </h2>
              <p>
                <strong>AmazeCC</strong> is an <strong>open-source project</strong> created for learning and experimentation purposes. The source code is publicly available, and anyone is welcome to explore, modify, or contribute improvements through the project’s GitHub repository.
              </p>
              <p>
                Contributions are voluntary and governed by the project’s open-source license. No data collected by contributors or modifications affects user privacy or transmits information externally.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Contact
              </h2>
              <p>
                For any concerns or questions about this Privacy Policy, you can reach out to the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
