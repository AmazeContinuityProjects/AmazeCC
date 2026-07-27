"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, FileText, Compass, HardDrive, DollarSign, 
  AlertTriangle, Building2, RefreshCw, Mail, ShieldCheck, Sparkles
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/custom/ThemeToggle";

export default function TermsOfServicePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-28 bg-slate-50/60 dark:bg-[#03060F] transition-colors duration-300 relative overflow-x-hidden text-slate-800 dark:text-gray-200 font-sans selection:bg-indigo-500/20">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-bl from-indigo-500/10 via-sky-500/10 to-transparent blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/10 to-transparent blur-[140px]" />
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
                <Sparkles size={11} /> Usage Guidelines & Disclaimers
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-outfit)]">
                Terms of Service
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-semibold">
                Last updated: June 23, 2026
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 hidden sm:block">
              <FileText size={28} />
            </div>
          </div>

          {/* EXACT UNTOUCHED ORIGINAL TEXT CONTENT FROM ORIGIN/MAIN */}
          <div className="space-y-6 text-xs sm:text-sm leading-relaxed font-medium">
            <p>
              Welcome to <strong>AmazeCC</strong>. By using this application, you agree to the following Terms of Service. Please read them carefully before using the app.
            </p>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Purpose
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                <strong>AmazeCC</strong> is an experimental web application created solely for educational and personal use. It provides tools to help students view and organize their academic data retrieved from <strong>VTOP</strong> (VIT’s official portal). This app is not an official VIT product and is <strong>not affiliated, endorsed, or maintained by Vellore Institute of Technology (VIT)</strong> in any manner. 
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Data Handling
                </h2>
              </div>
              <div className="pl-6 space-y-2 text-slate-600 dark:text-gray-300">
                <p>
                  The app does <strong>not collect, store, or transmit any personal information</strong> to any server. All your login credentials, academic data, and settings remain <strong>entirely on your local device</strong> via browser local storage. Once you close or clear your browser data, all information is removed. 
                </p>
                <p>
                  When you log in, the app connects directly to the official <strong>VTOP</strong> website to retrieve your academic data for display. This data is processed locally in your browser and never shared externally. At the same time, the applicatiion also connects to the <strong>Events Hub</strong> website to retrieve your registered events for display. It allows you to download your receipts, your certificates by streaming the download. The app does not handle payments gateway of any sort or kind, and will not receive or send payments. This app provides a beta feature - "Pay Now" button that redirects to the official payment portal, as such does not handle payments. By clicking the pay now button, you automatically accept to the Event Hub Terms and Conditions, and similarly thereof absolve the developer of this site of any responsibility. This data is also processed locally in your browser and never shared externally.
                </p>
              </div>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  No Monetization or Commercial Use
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                <strong>AmazeCC</strong> is a free and non-commercial project. The developer does not earn revenue, display advertisements, sell data, or monetize the service in any way. The app is provided purely for fun, learning, and experimentation purposes.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Disclaimer of Liability
                </h2>
              </div>
              <div className="pl-6 space-y-2 text-slate-600 dark:text-gray-300">
                <p>
                  The app is provided on an &ldquo;as-is&rdquo; basis with no guarantees of accuracy, reliability, or availability. The developer is <strong>not responsible for any data inaccuracies, login failures, or service interruptions</strong> that may occur due to VTOP updates, VIT Event Hubs updates,or other external factors. 
                </p>
                <p>
                  Users are solely responsible for the use of their VTOP credentials within the app. It is recommended to use this app only on trusted devices and networks. You use this application at your own risk and discretion.
                </p>
              </div>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Affiliation
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                This app is an <strong>independent student project</strong> and is in no way affiliated with, endorsed by, or supported by Vellore Institute of Technology (VIT) or any of its departments. This project is created out of personal interest, curiosity and learning, and is not an official VIT product.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Changes to Terms
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                These terms may be updated periodically to reflect improvements or changes in app behavior. Continued use of the app after updates constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-200/50 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Contact
                </h2>
              </div>
              <p className="pl-6 text-slate-600 dark:text-gray-300">
                For any concerns, questions, or feedback related to this app or these Terms of Service, you can contact the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
