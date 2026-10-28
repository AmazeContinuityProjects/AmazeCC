"use client";

/**
 * The marketing/feature sections that sit under the guest hero.
 *
 * Split out of `LoginForm` when the landing moved into `GuestExperience`, and
 * kept behind a dynamic import so the guest route paints its hero without
 * paying for ~480 lines of below-the-fold markup (and framer-motion's
 * `whileInView` work).
 */

import { useState } from "react";
import { m, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  Activity,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Lock,
  MessageSquareWarning,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";

function Tilt3DCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 180, damping: 22 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 180, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window === "undefined" || window.innerWidth < 1024 || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    mx.set(x);
    my.set(y);
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <m.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000 }}
      className={className}
    >
      {children}
    </m.div>
  );
}
  const features = [
    { icon: Activity, iconColor: "text-indigo-500", title: "Attendance Tracker", desc: "Predict safety margins and skip lists instantly with an offline-first calculator." },
    { icon: GraduationCap, iconColor: "text-purple-500", title: "Academics Hub", desc: "Access courses, grade lists, schedules, and active curriculum structures." },
    { icon: TrendingUp, iconColor: "text-pink-500", title: "CGPA Predictor", desc: "Set target grades, calculate SGPA distributions, and monitor credit levels." },
    { icon: UserCheck, iconColor: "text-blue-500", title: "Faculty Explorer", desc: "Search professor cabinets, designations, emails, and student feedback." },
    { icon: Home, iconColor: "text-emerald-500", title: "Hostel & Logistics", desc: "Check daily mess menus, visual room details, counseling slots, and leaves." },
    { icon: FileText, iconColor: "text-amber-500", title: "Question Bank", desc: "Search and download previous years' exam question papers offline." },
    { icon: Heart, iconColor: "text-rose-500", title: "FFCS Wishlist", desc: "Draft mock wishlist classes to prepare for upcoming registration sessions." },
    { icon: CreditCard, iconColor: "text-teal-500", title: "Payments Ledger", desc: "Track tuition transactions, invoice records, and pending fee structures." },
    { icon: BookOpen, iconColor: "text-cyan-500", title: "Libraries search", desc: "Search the OPAC catalog books and view checkouts from Koha accounts." },
    { icon: Calendar, iconColor: "text-violet-500", title: "FFCS Planner", desc: "Design draft schedules and check slot collisions before registration." },
    { icon: Sparkles, iconColor: "text-orange-500", title: "Event Hub", desc: "View upcoming club events, register profiles, and secure ticket passes." }
  ];

  const companionTimeline = [
    { time: "08:00 AM", title: "Timetable Check", desc: "AmazeCC wakes up with a clean view of today's schedule, locations, and attendance." },
    { time: "11:00 AM", title: "Interactive Skip", desc: "Want to skip a slot? Check the simulator to see if you stay above the 75% limit." },
    { time: "01:30 PM", title: "Mess Menu", desc: "Check what food is scheduled for lunch directly on the hostel panel." },
    { time: "04:30 PM", title: "Library Check", desc: "Search OPAC catalogs for reference books and verify return dates." },
    { time: "06:00 PM", title: "Event Listing", desc: "Discover upcoming club hackathons, workshops, and register passes." },
    { time: "09:00 PM", title: "Wishlist Drafting", desc: "Plan course slot selections for the upcoming semester's FFCS." }
  ];

  const benefits = [
    { title: "Everything in one place", desc: "No more loading VTOP, Koha, EventHub, and Mess PDFs separately." },
    { title: "Privacy First", desc: "100% local processing. Your passwords and keys never leave your browser." },
    { title: "Offline Support", desc: "Your schedule, marks, and attendance details are cached for instant offline lookup." },
    { title: "Lightning Fast", desc: "Optimized bundle sizes and lightweight state loads make queries instant." }
  ];

  const roadmap = [
    { status: "In Progress", title: "AI Assistant", desc: "Intelligent chatbot to answer questions about slots and exams." },
    { status: "Planned", title: "Placement Tracker", desc: "Log active job listings and requirements inside the profile." },
    { status: "Planned", title: "Smart Notifications", desc: "Reminders for class timings and pending library checkouts." },
    { status: "Backlog", title: "Expense Manager", desc: "Log pocket money and food purchases inside hostel tabs." }
  ];

  const faqs = [
    { q: "Is this official?", a: "No. AmazeCC is an independent, student-designed project built to provide a clean companion UI. It speaks directly to official portals securely." },
    { q: "Is it free?", a: "Yes. AmazeCC is completely free and student-focused with zero advertisements or subscription plans." },
    { q: "Does it store passwords?", a: "No. All authentication occurs directly on your client browser. Credentials and sessions are preserved in your local browser cache securely." },
    { q: "Can alumni use it?", a: "Yes. Any student with active credentials can synchronize history and inspect catalogs." }
  ];

export default function LandingSections() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Attendance predictor sandbox — a live toy, so it owns its own counts.
  const [mockAttended, setMockAttended] = useState(17);
  const [mockTotal, setMockTotal] = useState(20);
  const mockPercent = mockTotal > 0 ? (mockAttended / mockTotal) * 100 : 0;

  const handleSimulateAttend = () => {
    setMockAttended((prev) => prev + 1);
    setMockTotal((prev) => prev + 1);
  };

  const handleSimulateSkip = () => {
    setMockTotal((prev) => prev + 1);
  };

  const handleSimulateReset = () => {
    setMockAttended(17);
    setMockTotal(20);
  };

  const getSkipStatus = () => {
    if (mockPercent < 75) {
      return {
        text: "Critical: Attendance below 75% limit!",
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20",
      };
    }
    const maxTotal = Math.floor(mockAttended / 0.75);
    const skipCount = maxTotal - mockTotal;
    if (skipCount > 0) {
      return {
        text: `Safe to skip: Yes (${skipCount} class${skipCount > 1 ? "es" : ""})`,
        color: "text-emerald-650 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
      };
    }
    return {
      text: "Borderline: Exactly 75%. Do not skip.",
      color: "text-amber-600 dark:text-amber-450 bg-amber-500/10 border border-amber-500/20",
    };
  };

  const skipStatus = getSkipStatus();
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(mockPercent, 100) / 100) * circumference;

  return (
    <>

            {/* Problem Section (Emojis Replaced with Lucide Icons) */}
            <section id="sec-problem" className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-20 px-6">
              <m.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="max-w-4xl mx-auto text-center space-y-8"
              >
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">The Portal Challenge</span>
                  <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Tired of hopping between disconnected links?</h2>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed font-medium">
                    Most students waste hours daily logging into multiple outdated gateways just to check attendance, look up room validation OTPs, or retrieve mess menus.
                  </p>
                </div>
                
                {/* Floating tags */}
                <div className="flex flex-wrap gap-4 justify-center items-center py-6">
                  <m.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-rose-600 dark:text-rose-400/90 rotate-[-2deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <ShieldAlert size={14} className="text-rose-500 shrink-0" />
                    VTOP Session Expired (Re-login)
                  </m.div>
                  <m.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-amber-600 dark:text-amber-400/90 rotate-[1.5deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <MessageSquareWarning size={14} className="text-amber-500 shrink-0" />
                    Outing Pass OTP Pending
                  </m.div>
                  <m.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-purple-600 dark:text-purple-400/90 rotate-[-1deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <Lock size={14} className="text-purple-500 shrink-0" />
                    Laundry Booking Slot Locked
                  </m.div>
                  <m.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.24, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-sky-600 dark:text-sky-400/90 rotate-[2deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <BookOpen size={14} className="text-sky-500 shrink-0" />
                    Mess Menu PDF (Page 4)
                  </m.div>
                  <m.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.32, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400/90 rotate-[-1.5deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <CreditCard size={14} className="text-emerald-500 shrink-0" />
                    Koha Book Catalog Error
                  </m.div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-[1px] bg-gradient-to-b from-indigo-500 to-transparent" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full select-none">
                    AmazeCC Unifies Everything
                  </span>
                  <div className="h-10 w-[1px] bg-gradient-to-t from-indigo-500 to-transparent" />
                </div>
              </m.div>
            </section>

            {/* Features Module Grid Section (Emojis Replaced with elegant Lucide icons) */}
            <section id="sec-features" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <m.div 
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center space-y-3"
              >
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Comprehensive Modules</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Everything inside one application</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto font-medium">
                  A unified layout that groups core widgets, predictive calculators, and offline catalogs under cohesive interfaces.
                </p>
              </m.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                {features.map((feat, idx) => (
                  <Tilt3DCard key={idx} className="h-full">
                    <m.div 
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.05 }}
                      transition={{ duration: 0.45, delay: (idx % 3) * 0.07, ease: "easeOut" }}
                      className="bg-white border border-slate-200/80 hover:border-indigo-500/40 dark:bg-[#050814]/70 dark:border-white/[0.08] p-6 rounded-[24px] flex flex-col justify-between hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 h-full group"
                    >
                      <div className="space-y-3">
                        <div className={`p-2.5 w-fit rounded-2xl ${feat.iconColor} bg-slate-100 dark:bg-neutral-900 group-hover:scale-110 transition-transform duration-300`}>
                          <feat.icon className="h-6 w-6 stroke-[1.8]" />
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">
                          {feat.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
                          {feat.desc}
                        </p>
                      </div>
                    </m.div>
                  </Tilt3DCard>
                ))}
              </div>
            </section>

            {/* Attendance Predictor Sandbox Section */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#050814]/40 dark:border-neutral-900 py-24 px-6 relative">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-[120px] pointer-events-none" />
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                <m.div 
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="lg:col-span-7 space-y-4 text-left"
                >
                  <span className="text-[10px] font-black text-indigo-605 dark:text-indigo-400 uppercase tracking-widest block">Predictive Calculator</span>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Simulate attendance margins live</h2>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 leading-relaxed font-medium max-w-xl">
                    Calculate safe margins before skip classes. Adjust the simulator below to check the real-time safety limits, percentage ratios, and skip counts immediately.
                  </p>
                  <div className="flex items-center gap-6 pt-2 text-xs font-semibold text-slate-500 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>75% safety guard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-550 dark:bg-indigo-400" />
                      <span>Dynamic percentage</span>
                    </div>
                  </div>
                </m.div>

                {/* Simulator Card Box */}
                <m.div 
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="lg:col-span-5 bg-white border border-slate-200 dark:bg-neutral-950 dark:border-white/[0.08] p-6 rounded-[24px] space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-900 pb-3">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-605 dark:text-indigo-400 block">Attendance Preview</span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Predictor Sandbox</h3>
                    </div>
                    <button
                      onClick={handleSimulateReset}
                      className="relative hit-expand p-1.5 rounded-lg text-gray-400 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Reset Demo"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400">CSE3002 - COMPILER DESIGN</span>
                      <div className="text-xs font-semibold text-slate-650 dark:text-gray-350">
                        Attended: <span className="text-slate-900 dark:text-white font-black">{mockAttended}</span> / {mockTotal}
                      </div>
                    </div>

                    {/* Circle chart */}
                    <div className="relative h-14 w-14 flex items-center justify-center shrink-0">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r={radius} className="stroke-slate-100 dark:stroke-neutral-850" strokeWidth="4.5" fill="transparent" />
                        <circle
                          cx="28"
                          cy="28"
                          r={radius}
                          className="stroke-indigo-600 dark:stroke-indigo-500 transition-all duration-300"
                          strokeWidth="4.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-black text-slate-900 dark:text-white font-mono">
                        {Math.round(mockPercent)}%
                      </span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl text-[10px] font-bold text-center transition-all duration-300 ${skipStatus.color}`}>
                    {skipStatus.text}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSimulateAttend}
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 dark:hover:border-emerald-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-450 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus size={11} /> Attend
                    </button>
                    <button
                      onClick={handleSimulateSkip}
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 dark:hover:border-rose-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-450 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Minus size={11} /> Skip
                    </button>
                  </div>
                </m.div>
              </div>
            </section>

            {/* UI Showcase Layout */}
            <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <m.div 
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-3"
              >
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">User Interface</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Designed for clarity</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto font-medium">
                  A high-fidelity layout optimized for fast reading, dark preferences, and desktop-first tracking.
                </p>
              </m.div>

              {/* Showcase Skeletons (Emojis replaced with Lucide Icons) */}
              <div className="relative max-w-4xl mx-auto h-[450px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100/40 dark:border-neutral-900 dark:bg-[#050711]/50 p-6 md:p-8 flex items-center justify-center shadow-md dark:shadow-xl">
                
                {/* Desktop layout skeleton card */}
                <m.div 
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="hidden md:flex absolute top-10 left-10 right-28 bottom-10 bg-white border border-slate-200/80 dark:bg-neutral-950 dark:border-neutral-850 rounded-2xl shadow-2xl overflow-hidden -rotate-2 origin-top-left transition-transform duration-500 hover:rotate-0"
                >
                  <div className="w-1/4 border-r border-slate-100 dark:border-neutral-900 p-4 space-y-4 bg-white dark:bg-neutral-950 select-none">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-neutral-900">
                      <div className="w-4 h-4 rounded bg-indigo-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">AmazeCC</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-6 rounded bg-slate-50 dark:bg-neutral-900 flex items-center px-2 text-[9px] text-slate-700 dark:text-gray-400 font-bold gap-1">
                        <Calendar size={11} className="text-indigo-550 dark:text-indigo-400 shrink-0" /> Calendar
                      </div>
                      <div className="h-6 rounded flex items-center px-2 text-[9px] text-slate-500 dark:text-gray-500 font-bold gap-1">
                        <Activity size={11} className="text-slate-400 shrink-0" /> Attendance
                      </div>
                      <div className="h-6 rounded flex items-center px-2 text-[9px] text-slate-500 dark:text-gray-500 font-bold gap-1">
                        <Home size={11} className="text-slate-400 shrink-0" /> Hostel Hub
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6 space-y-4 bg-slate-50/50 dark:bg-neutral-900/20 select-none">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-900 pb-3">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Semester Course List</span>
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-100 dark:bg-neutral-950 dark:border-neutral-850 p-3 rounded-xl space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest block font-mono">BMAT201L</span>
                        <div className="h-1.5 w-3/4 rounded bg-indigo-500" />
                        <span className="text-[9px] text-slate-500 dark:text-gray-500 font-bold block">Complex Variables</span>
                      </div>
                      <div className="bg-white border border-slate-100 dark:bg-neutral-950 dark:border-neutral-850 p-3 rounded-xl space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest block font-mono">CSE3002</span>
                        <div className="h-1.5 w-1/2 rounded bg-indigo-500" />
                        <span className="text-[9px] text-slate-500 dark:text-gray-500 font-bold block">Compiler Design</span>
                      </div>
                    </div>
                  </div>
                </m.div>

                {/* Mobile layout skeleton card */}
                <m.div 
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                  className="absolute md:right-6 md:bottom-6 left-1/2 md:left-auto top-1/2 md:top-auto -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 w-52 h-80 bg-white border-4 border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-[24px] shadow-2xl p-4 overflow-hidden md:rotate-3 transition-transform duration-500 hover:rotate-0"
                >
                  <div className="w-12 h-4 bg-slate-100 dark:bg-neutral-850 rounded-full mx-auto mb-4" />
                  <div className="space-y-4 select-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-900 dark:text-white uppercase">Today's Hub</span>
                      <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold font-mono">22BCE1234</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl space-y-2">
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-emerald-500 shrink-0" /> Attendance Safe
                      </span>
                      <div className="h-1 bg-indigo-500 rounded w-full" />
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 dark:bg-[#050711] dark:border-neutral-900 p-2.5 rounded-xl space-y-2">
                      <span className="text-[8px] text-slate-500 dark:text-gray-400 font-bold block">Hostel Laundry</span>
                      <span className="text-[7px] text-slate-405 dark:text-gray-500 block">D-Block Slot #03 locked</span>
                    </div>
                  </div>
                </m.div>

              </div>
            </section>

            {/* Benefits Section */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <m.div 
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-center space-y-3"
                >
                  <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest block">Why AmazeCC?</span>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Built for speed and complete trust</h2>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto font-medium">
                    Design choices aligned to speed, local privacy, and simplicity.
                  </p>
                </m.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {benefits.map((benefit, idx) => (
                    <m.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (idx % 4) * 0.08, ease: "easeOut" }}
                      className="bg-white border border-slate-200 dark:bg-neutral-950/40 dark:border-white/[0.08] p-6 rounded-2xl space-y-2 shadow-xs dark:shadow-none"
                    >
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">
                        {benefit.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
                        {benefit.desc}
                      </p>
                    </m.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Timeline walkthrough */}
            <section id="sec-timeline" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <m.div 
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-3"
              >
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Daily Walkthrough</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">A typical day with AmazeCC</h2>
                <p className="text-xs md:text-sm text-slate-650 dark:text-gray-400 max-w-xl mx-auto font-medium">
                  See how AmazeCC supports your schedule checks and mess menu updates throughout college hours.
                </p>
              </m.div>

              <div className="max-w-3xl mx-auto space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200 dark:before:bg-neutral-900">
                {companionTimeline.map((item, idx) => (
                  <m.div 
                    key={idx} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.05 }}
                    transition={{ duration: 0.5, delay: idx * 0.06, ease: "easeOut" }}
                    className="flex gap-6 relative pl-8 text-left"
                  >
                    <div className="absolute left-2.5 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-4 border-slate-50 dark:border-neutral-950 shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono">{item.time}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{item.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </m.div>
                ))}
              </div>
            </section>

            {/* Roadmap */}
            <section id="sec-roadmap" className="bg-slate-100/50 border-t border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <m.div 
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-center space-y-3"
                >
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Project Roadmap</span>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">What is coming next</h2>
                  <p className="text-xs md:text-sm text-slate-655 dark:text-gray-400 max-w-xl mx-auto font-medium">
                    Continuous upgrades to extend scheduling assistance.
                  </p>
                </m.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {roadmap.map((item, idx) => (
                    <m.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (idx % 4) * 0.08, ease: "easeOut" }}
                      className="bg-white border border-slate-200 dark:bg-neutral-950/60 dark:border-white/[0.08] p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs dark:shadow-none"
                    >
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full w-fit block">
                          {item.status}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pt-2 font-[family-name:var(--font-outfit)]">{item.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
              </div>
            </section>

            {/* FAQ Accordion */}
            <section id="sec-faq" className="max-w-4xl mx-auto px-6 py-24 space-y-16">
              <m.div 
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-3"
              >
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Support & FAQs</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Frequently Asked Questions</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto font-medium">
                  Answers to common questions regarding credentials and connections.
                </p>
              </m.div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <m.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.05 }}
                      transition={{ duration: 0.4, delay: idx * 0.06, ease: "easeOut" }}
                      className="border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-neutral-950/40 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-neutral-900/30 uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="p-5 border-t border-slate-200 bg-slate-50/50 text-slate-600 dark:border-neutral-900 dark:bg-neutral-950/20 dark:text-gray-400 text-xs leading-relaxed font-medium animate-fadeIn">
                          {faq.a}
                        </div>
                      )}
                    </m.div>
                  );
                })}
              </div>
            </section>
    </>
  );
}
