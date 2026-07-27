"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, FileText, Compass, HardDrive, DollarSign, 
  AlertTriangle, Building2, RefreshCw, Mail, Check, Copy, ShieldCheck, Sparkles
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/custom/ThemeToggle";

const termsSections = [
  { id: "purpose", title: "App Purpose & Scope", icon: Compass },
  { id: "data-handling", title: "Data Handling & Events", icon: HardDrive },
  { id: "monetization", title: "Non-Commercial Use", icon: DollarSign },
  { id: "disclaimer", title: "Disclaimer of Liability", icon: AlertTriangle },
  { id: "affiliation", title: "VIT Affiliation Disclaimer", icon: Building2 },
  { id: "changes", title: "Changes to Terms", icon: RefreshCw },
  { id: "contact", title: "Developer Contact", icon: Mail },
];

export default function TermsOfServicePage() {
  const [mounted, setMounted] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeSection, setActiveSection] = useState("purpose");

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
        <div className="absolute top-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-bl from-indigo-500/10 via-sky-500/10 to-transparent blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/10 to-transparent blur-[140px]" />
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
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Terms</span>
            </div>
          </div>

          {/* Switcher Tab between Privacy & Terms */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-neutral-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
            <Link 
              href="/privacy" 
              className="px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck size={13} />
              <span>Privacy Policy</span>
            </Link>
            <Link 
              href="/terms" 
              className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs flex items-center gap-1.5 transition-all"
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
            <span>Usage Guidelines & Disclaimers</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)] tracking-tight leading-tight">
            Terms of Service
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
            Welcome to AmazeCC. Please review our service terms, non-commercial scope, and independent student project disclaimers below.
          </p>

          <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-gray-400 pt-2">
            <span>Last Updated: June 23, 2026</span>
            <span>•</span>
            <span>Est. Read: 3 mins</span>
            <span>•</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">Non-Commercial Project</span>
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
              <Compass size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Educational & Personal Use</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              AmazeCC provides student productivity tools to organize and preview academic logs retrieved from VTOP.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-2.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit">
              <Building2 size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Independent Student Project</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              Independent student software. Not affiliated with, endorsed by, or maintained by Vellore Institute of Technology.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-5 rounded-3xl space-y-2.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
              <DollarSign size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">100% Free & No Ads</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
              Free non-monetized tool with zero subscriptions, zero payment handling, and zero commercial ads.
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
                {termsSections.map((sec) => {
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
            {/* Purpose */}
            <section id="purpose" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Compass size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">1. Application Purpose & Scope</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Educational student portal assistant</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <strong>AmazeCC</strong> is an experimental web application created solely for educational and personal utility. It provides client-side productivity tools to help students view and organize academic data retrieved directly from <strong>VTOP</strong> (VIT’s official student portal).
              </p>
            </section>

            {/* Data Handling */}
            <section id="data-handling" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <HardDrive size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">2. Local Data Handling & Payment Redirection</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Client-side fetching & Events Hub integration</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  The app does <strong>not collect, store, or transmit personal credentials</strong> to any third-party server. All login credentials and academic logs remain stored inside your local browser memory.
                </p>
                <p>
                  For Events Hub registration integration, AmazeCC provides external redirection to official payment portals. AmazeCC does <strong>not handle, process, or store financial payments or payment credentials</strong>.
                </p>
              </div>
            </section>

            {/* Non-Commercial Use */}
            <section id="monetization" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <DollarSign size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">3. No Monetization or Commercial Use</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Free open project</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                AmazeCC is a free and non-commercial project. The developers do not earn revenue, show advertisements, sell user metrics, or monetize service usage in any way.
              </p>
            </section>

            {/* Disclaimer of Liability */}
            <section id="disclaimer" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">4. Disclaimer of Liability</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">"As-Is" service provision</p>
                </div>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                <p>
                  The app is provided on an &ldquo;as-is&rdquo; basis with no guarantees of uninterrupted availability or data accuracy. Developers are not liable for session timeouts or service interruptions resulting from upstream portal changes.
                </p>
                <p>
                  Users are responsible for maintaining device security and using trusted networks when accessing portal tools.
                </p>
              </div>
            </section>

            {/* Affiliation */}
            <section id="affiliation" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">5. Independent Project Affiliation</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Institutional disclaimers</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                This project is an <strong>independent student initiative</strong> and is not affiliated with, endorsed by, sponsored by, or official software of Vellore Institute of Technology (VIT).
              </p>
            </section>

            {/* Changes to Terms */}
            <section id="changes" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">6. Revisions & Updates</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Periodic terms modifications</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                These terms may be updated periodically to reflect new features or interface improvements. Continued usage of the site following updates signifies acceptance of modified terms.
              </p>
            </section>

            {/* Contact */}
            <section id="contact" className="bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Mail size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">7. Contact Developer</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Questions or terms inquiries</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
                For questions, feedback, or legal inquiries regarding these Terms of Service, contact the lead developer:
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
