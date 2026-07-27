"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, ShieldCheck, HardDrive, Cpu, Cookie, Bell, 
  Database, Code2, Mail, Check, Copy, ExternalLink, FileText, Sparkles
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/custom/ThemeToggle";

const privacySections = [
  { id: "overview", title: "Overview", icon: ShieldCheck },
  { id: "data-storage", title: "Data Storage & Privacy", icon: HardDrive },
  { id: "grade-prediction", title: "Grade Prediction & Stats", icon: Cpu },
  { id: "analytics", title: "Cookies & Analytics", icon: Cookie },
  { id: "notifications", title: "Push Notifications", icon: Bell },
  { id: "local-storage", title: "Local Browser Storage", icon: Database },
  { id: "open-source", title: "Open Source Code", icon: Code2 },
  { id: "contact", title: "Developer Contact", icon: Mail },
];

export default function PrivacyPolicyPage() {
  const [mounted, setMounted] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sugeeth2007@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/60 dark:bg-[#03060F] text-slate-800 dark:text-gray-200 transition-colors duration-300 font-sans relative overflow-x-hidden selection:bg-indigo-500/20">
      {/* Dynamic Background Glow Orbs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tl from-emerald-500/10 via-teal-500/10 to-transparent blur-[140px]" />
      </div>

      {/* Sticky Header Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#03060F]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-white/[0.06]"
            >
              <ArrowLeft size={14} />
              <span>Back to App</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-neutral-800">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Legal</span>
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-24">
        {/* Page Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto space-y-4 mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Data Transparency & Safety</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)] tracking-tight leading-tight">
            Privacy Policy
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
            At AmazeCC, your academic data, credentials, and privacy belong strictly to you. Learn how local browser architecture protects your information.
          </p>

          <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-gray-400 pt-2">
            <span>Last Updated: Nov 11, 2025</span>
            <span>•</span>
            <span>Est. Read: 3 mins</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">100% Client-Side</span>
          </div>
        </motion.div>

        {/* Highlight Cards Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12 max-w-5xl mx-auto"
        >
          <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-2.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit">
              <HardDrive size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Local Device Storage</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              All VTOP credentials, timetable caches, and marks remain encrypted in your device's browser memory.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-2.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Zero Third-Party Sales</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              We never monetize, sell, profile, or transmit personal information to external advertisers or brokers.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-2.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit">
              <Code2 size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Open Source Transparency</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              Our full source code is public on GitHub. Anyone can inspect, audit, or verify data flows independently.
            </p>
          </div>
        </motion.div>

        {/* Layout Grid: Sidebar Index + Document Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* Table of Contents Sticky Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-3 shadow-xs">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)] border-b border-slate-100 dark:border-white/[0.06] pb-3">
                Quick Table of Contents
              </h4>
              <nav className="space-y-1">
                {privacySections.map((sec) => {
                  const IconComponent = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        isActive
                          ? "bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-600/20"
                          : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <IconComponent size={15} />
                      <span>{sec.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Document Content Sections */}
          <div className="lg:col-span-8 space-y-6">
            {/* Overview */}
            <section id="overview" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">1. Overview</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Core commitment to user privacy</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                This Privacy Policy describes how <strong>AmazeCC</strong> handles information when you access and use the application. AmazeCC is built around a privacy-first, client-side architecture where data minimization and user sovereignty are fundamental principles.
              </p>
            </section>

            {/* Data Storage */}
            <section id="data-storage" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <HardDrive size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">2. Data Storage & Privacy</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Client-side isolation details</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  All data fetched from <strong>VTOP</strong> (including your academic records, attendance logs, timetables, and credentials) is stored <strong>locally on your browser/device</strong>.
                </p>
                <p>
                  No information from VTOP is ever uploaded, transmitted, or stored on external servers controlled by this app, with the single exception of anonymous marks processing for the Grade Prediction feature detailed below.
                </p>
              </div>
            </section>

            {/* Grade Prediction & Stats */}
            <section id="grade-prediction" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Cpu size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">3. Grade Prediction & Anonymized Statistics</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">In-memory mathematical aggregation</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  To calculate global class statistics (mean and standard deviation) for the Grade Prediction module, numerical academic marks are temporarily sent to our server via an encrypted TLS connection.
                </p>
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs space-y-2">
                  <span className="font-extrabold uppercase tracking-wider block">Welford's Algorithm In-Memory Processing:</span>
                  <p>
                    The server processes numerical values strictly in-memory to incrementally update class-wide averages and <strong>immediately discards</strong> individual marks. We do not store, map, or link any marks to user accounts. The process is completely anonymous.
                  </p>
                </div>
              </div>
            </section>

            {/* Cookies & Analytics */}
            <section id="analytics" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Cookie size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">4. Cookies & Performance Analytics</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Telemetry and usage monitoring</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  <strong>AmazeCC</strong> uses <strong>Vercel Analytics</strong> and <strong>Google Analytics</strong> to gather anonymous, aggregate metrics such as page visits, device types, and performance latency.
                </p>
                <p>
                  This telemetry does <strong>not</strong> contain personally identifiable details like names, registration numbers, or credentials. Analytics are used solely for debugging and optimizing runtime responsiveness.
                </p>
              </div>
            </section>

            {/* Push Notifications */}
            <section id="notifications" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Bell size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">5. Push Notifications</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Optional browser alerts</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                If you opt in, the application may issue local web browser notifications for upcoming class schedules or attendance warnings. You can grant or revoke notification permissions at any time in your browser settings.
              </p>
            </section>

            {/* Local Storage */}
            <section id="local-storage" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">6. Browser LocalStorage Control</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">User clearing & data wiping</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                User settings, custom themes, and cached responses reside inside your browser’s `localStorage` and `IndexedDB`. Clearing site storage in your browser immediately purges all saved app data permanently.
              </p>
            </section>

            {/* Open Source */}
            <section id="open-source" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Code2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">7. Open Source Repository</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Public GitHub codebase</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  AmazeCC is an open-source project designed for learning, exploration, and community development. You can review the complete source code on GitHub.
                </p>
                <a 
                  href="https://github.com/AmazeContinuityProjects/AmazeCC" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-850 text-slate-900 dark:text-white text-xs font-bold transition-all border border-slate-200 dark:border-white/[0.08]"
                >
                  <span>View GitHub Repository</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </section>

            {/* Contact */}
            <section id="contact" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Mail size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">8. Contact Developer</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Questions or privacy inquiries</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                If you have questions, feedback, or concerns about this Privacy Policy, feel free to contact the lead developer directly:
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedEmail ? "Email Copied!" : "Copy sugeeth2007@gmail.com"}</span>
                </button>
                <a
                  href="mailto:sugeeth2007@gmail.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-850 text-slate-800 dark:text-gray-200 text-xs font-bold transition-all border border-slate-200 dark:border-white/[0.08]"
                >
                  <Mail size={14} />
                  <span>Send Email</span>
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
