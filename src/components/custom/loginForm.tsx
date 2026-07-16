"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  Eye, EyeOff, ArrowRight, Shield, Zap, Sparkles, ChevronLeft, Plus, 
  RotateCcw, Minus, Sun, Moon, Loader2, Server, ShieldAlert, 
  MessageSquareWarning, Lock, BookOpen, CreditCard, Activity, 
  GraduationCap, TrendingUp, UserCheck, Home, FileText, Heart, 
  Calendar, CheckCircle2, Bus, Check, ChevronDown
} from "lucide-react";
import { Input, Button } from "@amazecontinuityprojects/amazeui";
import { getActiveApiUrl, setActiveApiUrl, PRIMARY_API_URL, BACKUP_API_URL } from "@/lib/fetch-utils";

interface LoginFormProps {
  username: any;
  setUsername: any;
  password: any;
  setPassword: any;
  message: any;
  handleFormSubmit: any;
  handleDemoClick: any;
  residentialStatus: any;
  setResidentialStatus: any;
  isDayscholarWithBus: any;
  setIsDayscholarWithBus: any;
}

export default function LoginForm({
  username,
  setUsername,
  password,
  setPassword,
  message,
  handleFormSubmit,
  handleDemoClick,
  residentialStatus,
  setResidentialStatus,
  isDayscholarWithBus,
  setIsDayscholarWithBus
}: LoginFormProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isLoading = message && typeof message === "string" && message.startsWith("Logging");
  
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const backgroundScale = useTransform(scrollY, [0, 500], [1, 1.05]);
  const textY = useTransform(scrollY, [0, 500], [0, -50]);
  
  const [activeApi, setActiveApi] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginCard, setShowLoginCard] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // Simulator State
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
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20" 
      };
    }
    const maxTotal = Math.floor(mockAttended / 0.75);
    const skipCount = maxTotal - mockTotal;
    if (skipCount > 0) {
      return { 
        text: `Safe to skip: Yes (${skipCount} class${skipCount > 1 ? "es" : ""})`, 
        color: "text-emerald-650 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
      };
    }
    return { 
      text: "Borderline: Exactly 75%. Do not skip.", 
      color: "text-amber-600 dark:text-amber-450 bg-amber-500/10 border border-amber-500/20" 
    };
  };

  const skipStatus = getSkipStatus();
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(mockPercent, 100) / 100) * circumference;



  useEffect(() => {
    setMounted(true);
    setActiveApi(getActiveApiUrl());
    
    // Clear any active color palette overrides on document root for the landing page 
    // to ensure no orange or rose tint breaks the default light/dark theme.
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      delete root.dataset.colorPalette;
      
      const vars = [
        "--theme-accent", "--background", "--foreground", "--text-heading",
        "--text-primary", "--text-secondary", "--text-muted", "--surface",
        "--surface-raised", "--surface-secondary", "--surface-tertiary",
        "--surface-hover", "--border-muted", "--border-strong", "--card",
        "--card-foreground", "--popover", "--popover-foreground", "--primary",
        "--primary-foreground", "--secondary", "--secondary-foreground",
        "--muted", "--muted-foreground", "--accent", "--accent-foreground",
        "--border", "--input", "--info", "--info-foreground", "--info-surface",
        "--ring", "--chart-1", "--chart-2", "--chart-3", "--sidebar",
        "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
        "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border",
        "--sidebar-ring"
      ];
      vars.forEach((name) => root.style.removeProperty(name));
      
      // Also clean up local storage settings if they contain colorPalette override
      try {
        const rawSettings = localStorage.getItem("settings");
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          if (parsed.colorPalette && parsed.colorPalette !== "default") {
            parsed.colorPalette = "default";
            localStorage.setItem("settings", JSON.stringify(parsed));
          }
        }
      } catch (e) {}
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isDark = theme === "dark";
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleApiChange = (newUrl: string) => {
    setActiveApiUrl(newUrl);
    setActiveApi(newUrl);
  };

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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 dark:bg-[#03060F] dark:text-gray-100 flex flex-col justify-between selection:bg-indigo-500/30 overflow-x-hidden relative font-sans transition-colors duration-300">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
      
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f060_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f060_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${isScrolled ? "bg-white/90 border-slate-200/80 dark:bg-[#03060Fd0] dark:border-neutral-900 backdrop-blur-md" : "bg-transparent border-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setShowLoginCard(false)}>
              <img 
                src="/logo.png" 
                alt="AmazeCC Logo" 
                className="h-7 w-7 rounded-lg object-contain shadow-sm" 
                onError={(e: any) => {
                  e.target.src = "/images/icons/logo.png";
                }} 
              />
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</span>
            </div>
            {!showLoginCard && (
              <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-500 dark:text-gray-400">
                <a href="#problem" className="hover:text-slate-900 dark:hover:text-white transition-colors">The Challenge</a>
                <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Modules</a>
                <a href="#timeline" className="hover:text-slate-900 dark:hover:text-white transition-colors">Timeline</a>
                <a href="#roadmap" className="hover:text-slate-900 dark:hover:text-white transition-colors">Roadmap</a>
                <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-850 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="Toggle theme"
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            )}
            <button
              onClick={handleDemoClick}
              className="text-xs font-semibold text-slate-650 hover:text-slate-950 dark:text-gray-300 dark:hover:text-white transition-colors cursor-pointer"
            >
              Try Demo
            </button>
            {!showLoginCard && (
              <button
                onClick={() => setShowLoginCard(true)}
                className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main body wrapper */}
      <main className="flex-grow">
        {!showLoginCard ? (
          /* Landing Page View */
          <div className="w-full">
            {/* Hero Section */}
            <section className="relative w-full min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden px-6 pt-32 pb-20 lg:pt-40 lg:pb-28">
              
              {/* Parallax Background Image */}
              <motion.div 
                style={{ y: backgroundY, scale: backgroundScale, backgroundImage: "url('/campus-twilight.png')" }}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.55] dark:opacity-[0.22] pointer-events-none"
              />
              
              {/* Overlay Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/20 to-transparent dark:from-[#03060F] dark:via-[#03060F]/30 dark:to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-50/10 via-transparent to-slate-50 dark:from-[#03060F]/10 dark:via-transparent dark:to-[#03060F] pointer-events-none" />

              {/* Centered Hero Content */}
              <motion.div 
                style={{ y: textY }}
                className="max-w-4xl mx-auto text-center space-y-6 relative z-10 animate-fadeIn"
              >
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={11} /> Next-Generation Portal Dashboard
                  </span>
                </div>
                
                <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                  Your Entire VIT Life.
                  <br />
                  <span className="bg-gradient-to-r from-indigo-550 via-purple-550 to-pink-550 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    One Dashboard.
                  </span>
                </h1>
                
                <p className="text-sm md:text-base text-slate-650 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto font-medium">
                  AmazeCC brings everything a VIT student needs into one beautifully designed platform. Stop opening ten different portals. Track attendance, marks, room counselling, and mess menus instantly.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowLoginCard(true)}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-555 text-white font-black text-xs px-6 py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <a
                    href="#features"
                    className="w-full sm:w-auto bg-slate-100/80 hover:bg-slate-200 border border-slate-250/60 hover:border-slate-350 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700 text-slate-700 dark:text-gray-300 font-black text-xs px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    Explore Features
                  </a>
                </div>
                
                {/* Stats counters */}
                <div className="grid grid-cols-3 gap-6 pt-8 max-w-xl mx-auto border-t border-slate-200/50 dark:border-neutral-900/50">
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">30+</h4>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mt-1">Student Tools</p>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">10+</h4>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mt-1">Modules</p>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400">100%</h4>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mt-1">Free & Local</p>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Problem Section (Emojis Replaced with Lucide Icons) */}
            <section id="problem" className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-20 px-6">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
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
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs text-rose-600 dark:text-rose-400/90 rotate-[-2deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <ShieldAlert size={14} className="text-rose-500 shrink-0" />
                    VTOP Session Expired (Re-login)
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs text-amber-600 dark:text-amber-400/90 rotate-[1.5deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <MessageSquareWarning size={14} className="text-amber-500 shrink-0" />
                    Outing Pass OTP Pending
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs text-purple-600 dark:text-purple-400/90 rotate-[-1deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <Lock size={14} className="text-purple-500 shrink-0" />
                    Laundry Booking Slot Locked
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.24, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs text-sky-600 dark:text-sky-400/90 rotate-[2deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <BookOpen size={14} className="text-sky-500 shrink-0" />
                    Mess Menu PDF (Page 4)
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.32, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400/90 rotate-[-1.5deg] shadow-sm select-none flex items-center gap-2 font-semibold"
                  >
                    <CreditCard size={14} className="text-emerald-500 shrink-0" />
                    Koha Book Catalog Error
                  </motion.div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-[1px] bg-gradient-to-b from-indigo-500 to-transparent" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-605 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full select-none">
                    AmazeCC Unifies Everything
                  </span>
                  <div className="h-10 w-[1px] bg-gradient-to-t from-indigo-500 to-transparent" />
                </div>
              </motion.div>
            </section>

            {/* Features Module Grid Section (Emojis Replaced with elegant Lucide icons) */}
            <section id="features" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <motion.div 
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
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                {features.map((feat, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 25 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: (idx % 3) * 0.08, ease: "easeOut" }}
                    className="bg-white border border-slate-200/80 hover:border-indigo-500/30 dark:bg-[#050814]/60 dark:border-neutral-900 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-[#070b1c]/80 transition-all shadow-xs dark:shadow-none group"
                  >
                    <div className="space-y-3">
                      <div className={`p-2 w-fit rounded-xl bg-slate-550/5 ${feat.iconColor} bg-slate-100 dark:bg-neutral-900`}>
                        <feat.icon className="h-6 w-6 stroke-[1.8]" />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">
                        {feat.title}
                      </h3>
                      <p className="text-xs text-slate-650 dark:text-gray-400 leading-relaxed font-medium">
                        {feat.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Attendance Predictor Sandbox Section */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#050814]/40 dark:border-neutral-900 py-24 px-6 relative">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-[120px] pointer-events-none" />
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                <motion.div 
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
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
                </motion.div>

                {/* Simulator Card Box */}
                <motion.div 
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="lg:col-span-5 bg-white border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 p-6 rounded-3xl space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-900 pb-3">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-605 dark:text-indigo-400 block">Attendance Preview</span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Predictor Sandbox</h3>
                    </div>
                    <button 
                      onClick={handleSimulateReset} 
                      className="p-1.5 rounded-lg text-gray-400 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer" 
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
                </motion.div>
              </div>
            </section>

            {/* UI Showcase Layout */}
            <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <motion.div 
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
              </motion.div>

              {/* Showcase Skeletons (Emojis replaced with Lucide Icons) */}
              <div className="relative max-w-4xl mx-auto h-[450px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/40 dark:border-neutral-900 dark:bg-[#050711]/50 p-6 md:p-8 flex items-center justify-center shadow-md dark:shadow-xl">
                
                {/* Desktop layout skeleton card */}
                <motion.div 
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
                </motion.div>

                {/* Mobile layout skeleton card */}
                <motion.div 
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                  className="absolute md:right-6 md:bottom-6 left-1/2 md:left-auto top-1/2 md:top-auto -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 w-52 h-80 bg-white border-4 border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-3xl shadow-2xl p-4 overflow-hidden md:rotate-3 transition-transform duration-500 hover:rotate-0"
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
                </motion.div>

              </div>
            </section>

            {/* Benefits Section */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <motion.div 
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
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {benefits.map((benefit, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (idx % 4) * 0.08, ease: "easeOut" }}
                      className="bg-white border border-slate-200 dark:bg-neutral-950/40 dark:border-neutral-900 p-6 rounded-2xl space-y-2 shadow-xs dark:shadow-none"
                    >
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">
                        {benefit.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">
                        {benefit.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Timeline walkthrough */}
            <section id="timeline" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <motion.div 
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
              </motion.div>

              <div className="max-w-3xl mx-auto space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200 dark:before:bg-neutral-900">
                {companionTimeline.map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-45px" }}
                    transition={{ duration: 0.5, delay: idx * 0.06, ease: "easeOut" }}
                    className="flex gap-6 relative pl-8 text-left"
                  >
                    <div className="absolute left-2.5 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-4 border-slate-50 dark:border-neutral-950 shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono">{item.time}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{item.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="bg-slate-100/50 border-t border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <motion.div 
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
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {roadmap.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (idx % 4) * 0.08, ease: "easeOut" }}
                      className="bg-white border border-slate-200 dark:bg-neutral-950/60 dark:border-neutral-900 p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs dark:shadow-none"
                    >
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full w-fit block">
                          {item.status}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pt-2 font-[family-name:var(--font-outfit)]">{item.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* FAQ Accordion */}
            <section id="faq" className="max-w-4xl mx-auto px-6 py-24 space-y-16">
              <motion.div 
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
              </motion.div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.4, delay: idx * 0.06, ease: "easeOut" }}
                      className="border border-slate-200 bg-white dark:border-neutral-900 dark:bg-neutral-950/40 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
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
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          /* Login Credentials Form View */
          <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 w-full animate-scaleIn">
            <button
              onClick={() => setShowLoginCard(false)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-gray-450 dark:hover:text-white mb-6 transition-colors cursor-pointer select-none"
            >
              <ChevronLeft size={14} /> Back to product info
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Security column (Left side) */}
              <div className="lg:col-span-5 bg-slate-100 border border-slate-200 dark:bg-[#050814]/40 dark:border-neutral-900 p-6 rounded-3xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Security & Privacy</h3>
                  <div className="space-y-4 text-left">
                    <div className="flex gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-lg shrink-0 h-fit">
                        <Shield size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Client-Side Only</h4>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed font-medium">
                          Authentication details and cookie stores stay strictly local. We never host database storage.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-lg shrink-0 h-fit">
                        <Zap size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Direct verify</h4>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed font-medium">
                          Secure verification directly with VTOP servers to pull schedules.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-neutral-900 text-[10px] text-slate-500 dark:text-gray-500 font-semibold text-left">
                  Secured by standard TLS encryption directly to the VIT gateway.
                </div>
              </div>

              {/* Login form fields column (Right side) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 dark:bg-[#050814]/60 dark:border-neutral-900 backdrop-blur-2xl rounded-3xl p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/85 dark:bg-[#050814]/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center z-20 space-y-4 animate-fadeIn">
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">VTOP Authentication</p>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider animate-pulse">Establishing secure gateway...</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  {/* Form Header */}
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-neutral-900 pb-4 mb-2">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-605 dark:text-indigo-400 rounded-lg">
                      <Shield size={16} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">VTOP Verification</h2>
                      <p className="text-[10px] text-slate-500 dark:text-gray-450 mt-0.5">Secure authentication via VIT database</p>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {message && (message.toLowerCase().includes("failed") || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("wrong") || message.toLowerCase().includes("incorrect") || message.toLowerCase().includes("captcha") || message.toLowerCase().includes("error")) && (
                    <div className="p-3.5 rounded-xl border text-xs text-center font-bold bg-rose-500/10 border-rose-500/20 text-rose-650 dark:text-rose-400">
                      {message}
                    </div>
                  )}

                  {/* Gateway config */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-900 mb-4">
                    <div className="flex items-center gap-2">
                      <Server size={14} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-600 dark:text-gray-300">API Gateway</span>
                    </div>
                    <select
                      value={activeApi}
                      onChange={(e) => handleApiChange(e.target.value)}
                      className="text-xs bg-transparent border-none focus:ring-0 text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer focus:outline-none"
                    >
                      <option value={PRIMARY_API_URL} className="bg-white dark:bg-neutral-950">Primary</option>
                      <option value={BACKUP_API_URL} className="bg-white dark:bg-neutral-950">Backup</option>
                    </select>
                  </div>

                  {/* Credentials fields */}
                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">VTop Username</label>
                      <Input
                        className="uppercase"
                        value={username}
                        onChange={(e: any) => setUsername(e.target.value)}
                        placeholder="E.g., VITUSER12345"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">VTOP Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e: any) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isLoading}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Settings toggles */}
                  {!isLoading && (
                    <>
                      <div className="space-y-3 text-left">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">Residential Status</p>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setResidentialStatus("hosteller");
                              setIsDayscholarWithBus(false);
                            }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              residentialStatus === "hosteller" 
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10" 
                                : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-neutral-950 dark:text-gray-400 dark:border-neutral-900 hover:border-indigo-500/30"
                            }`}
                          >
                            <Home size={12} className="inline mr-1 stroke-[2.2]" /> Hosteller
                          </button>
                          <button
                            type="button"
                            onClick={() => setResidentialStatus("dayscholar")}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              residentialStatus === "dayscholar" 
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10" 
                                : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-neutral-950 dark:text-gray-400 dark:border-neutral-900 hover:border-indigo-500/30"
                            }`}
                          >
                            <Bus size={12} className="inline mr-1 stroke-[2.2]" /> Dayscholar
                          </button>
                        </div>
                        
                        {residentialStatus === "dayscholar" && (
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-900 cursor-pointer transition-all hover:border-indigo-500/30 select-none">
                            <button
                              type="button"
                              onClick={() => setIsDayscholarWithBus(!isDayscholarWithBus)}
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                isDayscholarWithBus 
                                  ? "bg-indigo-600 border-indigo-600 text-white" 
                                  : "bg-white border-slate-250 dark:bg-neutral-900 dark:border-neutral-800 text-transparent"
                              }`}
                            >
                              {isDayscholarWithBus && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                            <span className="text-xs font-bold text-slate-600 dark:text-gray-300">I have registered transport (bus)</span>
                          </label>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full text-xs font-extrabold cursor-pointer"
                        size="lg"
                      >
                        Authenticate
                      </Button>
                    </>
                  )}
                </form>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-200 dark:border-neutral-900 bg-slate-100 dark:bg-[#020409]/60 text-center space-y-3 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-gray-500">
          <div>
            <span className="font-bold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</span>
          </div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
            <span className="text-slate-300 dark:text-neutral-800">•</span>
            <a href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
            <span className="text-slate-300 dark:text-neutral-800">•</span>
            <a href="https://github.com/AmazeContinuityProjects/AmazeCC" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-[10px] font-semibold flex items-center gap-1.5">
            Made with <Heart size={10} className="text-rose-500 fill-rose-500 inline shrink-0" /> by students. Not affiliated with VIT or VTOP.
          </p>
        </div>
      </footer>
    </div>
  );
}
