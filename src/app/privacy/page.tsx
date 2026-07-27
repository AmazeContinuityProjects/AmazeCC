"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, ShieldCheck, HardDrive, Cpu, Cookie, Bell, 
  Database, Code2, Mail, FileText, Sparkles
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/custom/ThemeToggle";

export default function PrivacyPolicyPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-28 bg-slate-50/60 dark:bg-[#03060F] transition-colors duration-300 relative overflow-x-hidden text-slate-800 dark:text-gray-200 font-sans selection:bg-indigo-500/20">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tl from-emerald-500/10 via-teal-500/10 to-transparent blur-[140px]" />
      </div>

      {/* Sticky Header Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#03060F]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-white/[0.06]"
            >
              <ArrowLeft size={14} />
              <span>Back to Login</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-neutral-800">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Privacy</span>
            </div>
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

      <div className="w-full max-w-3xl space-y-6 relative z-10">
        {/* Content Card with Frosted Glass & Delicate Glass Border */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 text-slate-700 dark:text-gray-300"
        >
          <div className="border-b border-slate-100 dark:border-white/[0.08] pb-5 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
                <Sparkles size={11} /> Legal & Data Protection
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-outfit)]">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-semibold">
                Last updated: 11 Nov, 2025
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 hidden sm:block">
              <ShieldCheck size={28} />
            </div>
          </div>

          {/* EXACT UNTOUCHED ORIGINAL TEXT CONTENT */}
          <div className="space-y-6 text-xs sm:text-sm leading-relaxed font-medium">
            <p>
              This Privacy Policy describes how <strong>AmazeCC</strong> handles data when you use the app.
            </p>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Data Storage
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                All data fetched from <strong>VTOP</strong> (including your academic data, credentials, or
                related content) is stored <strong>locally on your device</strong>. No information from VTOP is
                ever uploaded, transmitted, or stored on any external servers controlled by this app, with the exception of the Grade Prediction feature.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Grade Prediction & Statistics
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                To calculate global class statistics (mean and standard deviation) for the Grade Prediction feature, your academic marks are temporarily sent to our server via an encrypted connection. 
                The server strictly processes the numbers in-memory to incrementally update the class-wide averages using Welford's Algorithm and then <strong>immediately discards</strong> your individual marks. 
                We do not store, map, or link any marks to any user. The process is completely anonymous. 
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Cookie size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Cookies & Analytics
                </h2>
              </div>
              <div className="pl-6 space-y-2 text-slate-600 dark:text-gray-300">
                <p>
                  <strong>AmazeCC</strong> uses <strong>Vercel Analytics</strong> and <strong>Google Analytics</strong> to gather <em>anonymous, aggregate data</em> such as page visits, device types, and general interaction information. These analytics help improve the app’s performance and user experience.
                </p>
                <p>
                  This data does <strong>not</strong> include any personally identifiable information such as names, login credentials, or academic records. The analytics cookies are handled entirely by <strong>Google</strong> and <strong>Vercel</strong> under their respective privacy policies.
                </p>
                <p>
                  AmazeCC does not track users, create profiles, sell data, or share analytics with any third party. These analytics are used purely for <strong>educational and experimental</strong> purposes and can be cleared anytime by removing browser cookies.
                </p>
              </div>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Notifications
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                The app may send push notifications if you opt in. You can disable push notifications at any time through your browser settings. There are no background processes that track or monitor user behavior.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-pink-600 dark:text-pink-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Local Storage
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                Settings, preferences, and any cached data are stored using your browser’s local storage mechanism. This data never leaves your device and can be cleared manually at any time from within the app.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Code2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Open Source
                </h2>
              </div>
              <div className="pl-6 space-y-2 text-slate-600 dark:text-gray-300">
                <p>
                  <strong>AmazeCC</strong> is an <strong>open-source project</strong> created for learning and experimentation purposes. The source code is publicly available, and anyone is welcome to explore, modify, or contribute improvements through the project’s GitHub repository.
                </p>
                <p>
                  Contributions are voluntary and governed by the project’s open-source license. No data collected by contributors or modifications affects user privacy or transmits information externally.
                </p>
              </div>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Contact
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                For any concerns or questions about this Privacy Policy, you can reach out to the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
