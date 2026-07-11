# AmazeUI Documentation

> This document was automatically generated to assist in translating and understanding the codebase.

Total Files: 68

---

## File: `AmazeUI\src\components\custom\LoginForm.tsx`

### Imports
```typescript
import { Eye, EyeOff, ArrowRight, Shield, Zap, Sparkles, Home, Search, BookOpen, ChevronLeft, Plus, RotateCcw, Minus, Sun, Moon, Loader2, Server } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Input, Button, Checkbox } from "../../index";
```

### Exports
```typescript
export default function LoginForm({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import { Eye, EyeOff, ArrowRight, Shield, Zap, Sparkles, Home, Search, BookOpen, ChevronLeft, Plus, RotateCcw, Minus, Sun, Moon, Loader2, Server } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

import { Input, Button, Checkbox } from "../../index";

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
  activeApi: string;
  onApiChange: (newUrl: string) => void;
  primaryApiUrl: string;
  backupApiUrl: string;
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
  setIsDayscholarWithBus,
  activeApi,
  onApiChange,
  primaryApiUrl,
  backupApiUrl
}: LoginFormProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isLoading = message.startsWith("Logging");
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginCard, setShowLoginCard] = useState(false);

  // Scrolled state for transparent navbar transition
  const [isScrolled, setIsScrolled] = useState(false);

  // FAQ states
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Attendance simulator states
  const [mockAttended, setMockAttended] = useState(17);
  const [mockTotal, setMockTotal] = useState(20);
  const mockPercent = mockTotal > 0 ? (mockAttended / mockTotal) * 100 : 0;

  const handleSimulateAttend = () => {
    setMockAttended(prev => prev + 1);
    setMockTotal(prev => prev + 1);
  };

  const handleSimulateSkip = () => {
    setMockTotal(prev => prev + 1);
  };

  const handleSimulateReset = () => {
    setMockAttended(17);
    setMockTotal(20);
  };

  // Skip status calculation
  const getSkipStatus = () => {
    if (mockPercent < 75) {
      return { text: "Critical: Attendance below 75% limit!", color: "text-rose-600 dark:text-rose-455 bg-rose-500/10 border border-rose-500/20" };
    }
    const maxTotal = Math.floor(mockAttended / 0.75);
    const skipCount = maxTotal - mockTotal;
    if (skipCount > 0) {
      return { text: `Safe to skip: Yes (${skipCount} class${skipCount > 1 ? "es" : ""})`, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" };
    }
    return { text: "Borderline: Exactly 75%. Do not skip.", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20" };
  };

  const skipStatus = getSkipStatus();
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(mockPercent, 100) / 100) * circumference;

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(isDark ? "light" : "dark");
      });
    } else {
      setTheme(isDark ? "light" : "dark");
    }
  };

  const features = [
    { emoji: "📅", title: "Attendance Tracker", desc: "Predict safety margins and skip lists instantly with an offline-first calculator." },
    { emoji: "🎓", title: "Academics Hub", desc: "Access courses, grade lists, schedules, and active curriculum structures." },
    { emoji: "📈", title: "CGPA Predictor", desc: "Set target grades, calculate SGPA distributions, and monitor credit levels." },
    { emoji: "👨‍🏫", title: "Faculty Explorer", desc: "Search professor cabinets, designations, emails, and student feedback." },
    { emoji: "🏠", title: "Hostel & Logistics", desc: "Check daily mess menus, visual room details, counseling slots, and leaves." },
    { emoji: "📚", title: "Question Bank", desc: "Search and download previous years' exam question papers offline." },
    { emoji: "❤️", title: "FFCS Wishlist", desc: "Draft mock wishlist classes to prepare for upcoming registration sessions." },
    { emoji: "💳", title: "Payments Ledger", desc: "Track tuition transactions, invoice records, and pending fee structures." },
    { emoji: "📖", title: "Libraries search", desc: "Search the OPAC catalog books and view checkouts from Koha accounts." },
    { emoji: "📅", title: "FFCS Planner", desc: "Design draft schedules and check slot collisions before registration." },
    { emoji: "🎉", title: "Event Hub", desc: "View upcoming club events, register profiles, and secure ticket passes." }
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
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#03060F] dark:text-gray-150 flex flex-col justify-between selection:bg-indigo-500/30 overflow-x-hidden relative font-sans transition-colors duration-300">
      
      {/* Inline Floating Animation CSS */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(0.3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${isScrolled ? "bg-white/90 border-slate-200/80 dark:bg-[#03060Fd0] dark:border-neutral-900 backdrop-blur-md" : "bg-transparent border-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setShowLoginCard(false)}>
              <img src="/logo.png" alt="AmazeCC Logo" className="h-7 w-7 rounded-lg object-contain shadow-md" onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/icons/logo.png";
              }} />
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</span>
            </div>
            
            {/* Nav links on desktop */}
            <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-500 dark:text-gray-400">
              <a href="#problem" className="hover:text-slate-900 dark:hover:text-white transition-colors">The Challenge</a>
              <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Modules</a>
              <a href="#timeline" className="hover:text-slate-900 dark:hover:text-white transition-colors">Timeline</a>
              <a href="#roadmap" className="hover:text-slate-900 dark:hover:text-white transition-colors">Roadmap</a>
              <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-gray-300 transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={handleDemoClick}
              className="text-xs font-semibold text-slate-500 hover:text-slate-950 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              Try Demo
            </button>
            {!showLoginCard && (
              <button
                onClick={() => setShowLoginCard(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Landing/Login Container */}
      <main className="flex-grow">
        {!showLoginCard ? (
          /* Premium Redesigned Landing Page */
          <div className="w-full">
            
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-6 pt-32 pb-24 lg:pt-44 lg:pb-36">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                
                {/* Hero Content Left */}
                <div className="lg:col-span-6 space-y-6 text-left animate-fadeIn">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
                    <Sparkles size={11} /> Next-Generation Portal Dashboard
                  </div>
                  
                  <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">
                    Your Entire VIT Life.<br />
                    <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">One Dashboard.</span>
                  </h1>
                  
                  <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed max-w-lg font-medium">
                    AmazeCC brings everything a VIT student needs into one beautifully designed platform. Stop opening ten different portals. Track attendance, marks, room counselling, and mess menus instantly.
                  </p>

                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={() => setShowLoginCard(true)}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-6 py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer group"
                    >
                      <span>Get Started</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <a
                      href="#features"
                      className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700 text-slate-700 dark:text-gray-300 font-black text-xs px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                    >
                      Explore Features
                    </a>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-neutral-900">
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
                </div>

                {/* Hero Centerpiece Artwork Right */}
                <div className="lg:col-span-6 relative flex justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-[120px] rounded-full -z-10 animate-pulse duration-4000" />
                  <div className="relative w-full max-w-[500px] aspect-4/3 rounded-3xl overflow-hidden border border-slate-200 dark:border-neutral-850 shadow-2xl animate-float">
                    <img
                      src="/hero-artwork.png"
                      alt="VIT Chennai Twilight Illustration"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/10 dark:from-[#03060Fd0] via-transparent to-transparent pointer-events-none" />
                  </div>
                </div>

              </div>
            </section>

            {/* Section 2: The Problem */}
            <section id="problem" className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-20 px-6">
              <div className="max-w-4xl mx-auto text-center space-y-8">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">The Portal Challenge</span>
                  <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Tired of hopping between disconnected links?</h2>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                    Most students waste hours daily logging into multiple outdated gateways just to check attendance, look up room validation OTPs, or retrieve mess menus.
                  </p>
                </div>

                {/* Scattered Disconnected Cards UI */}
                <div className="flex flex-wrap gap-4 justify-center items-center py-8">
                  <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-rose-600 dark:text-rose-400/90 rotate-[-3deg] shadow-md select-none flex items-center gap-2">
                    🔒 VTOP Session Expired (Re-login)
                  </div>
                  <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-amber-600 dark:text-amber-400/90 rotate-[2deg] shadow-md select-none flex items-center gap-2">
                    💬 Outing Pass OTP Pending
                  </div>
                  <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-purple-600 dark:text-purple-400/90 rotate-[-1deg] shadow-md select-none flex items-center gap-2">
                    🧺 Laundry Booking Slot Locked
                  </div>
                  <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-sky-600 dark:text-sky-400/90 rotate-[3deg] shadow-md select-none flex items-center gap-2">
                    🍲 Mess Menu PDF (Page 4)
                  </div>
                  <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400/90 rotate-[-2deg] shadow-md select-none flex items-center gap-2">
                    💳 Koha Book Catalog Error
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-[1px] bg-gradient-to-b from-indigo-500 to-transparent" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full">
                    AmazeCC Unifies Everything
                  </span>
                  <div className="h-10 w-[1px] bg-gradient-to-t from-indigo-500 to-transparent" />
                </div>
              </div>
            </section>

            {/* Section 3: Everything In One Place */}
            <section id="features" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Comprehensive Modules</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Everything inside one application</h2>
                <p className="text-xs md:text-sm text-slate-650 dark:text-gray-400 max-w-xl mx-auto">
                  A unified layout that groups core widgets, predictive calculators, and offline catalogs under cohesive interfaces.
                </p>
              </div>

              {/* Grid Layout of feature cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                {features.map((feat, idx) => (
                  <div key={idx} className="bg-white border border-slate-200/80 hover:border-indigo-500/30 dark:bg-[#050814]/60 dark:border-neutral-900 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-[#070b1c]/80 transition-all shadow-xs dark:shadow-none group">
                    <div className="space-y-3">
                      <span className="text-3xl block shrink-0">{feat.emoji}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{feat.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Attendance Simulator Widget Placement */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#050814]/40 dark:border-neutral-900 py-24 px-6 relative">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-[120px] pointer-events-none" />
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                <div className="lg:col-span-7 space-y-4 text-left">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Predictive Calculator</span>
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
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span>Dynamic percentage</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 p-6 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-900 pb-3">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Attendance Preview</span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Predictor Sandbox</h3>
                    </div>
                    <button onClick={handleSimulateReset} className="p-1.5 rounded-lg text-gray-400 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors" title="Reset Demo">
                      <RotateCcw size={12} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400">CSE3002 - COMPILER DESIGN</span>
                      <div className="text-xs font-semibold text-slate-600 dark:text-gray-350">Attended: <span className="text-slate-900 dark:text-white font-black">{mockAttended}</span> / {mockTotal}</div>
                    </div>

                    {/* SVG percentage circle */}
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
                      <span className="absolute text-[10px] font-black text-slate-900 dark:text-white">{Math.round(mockPercent)}%</span>
                    </div>
                  </div>

                  {/* Skip alert panel */}
                  <div className={`p-3 rounded-xl text-[10px] font-bold text-center transition-all duration-300 ${skipStatus.color}`}>
                    {skipStatus.text}
                  </div>

                  {/* Simulator Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSimulateAttend}
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 dark:hover:border-emerald-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus size={11} /> Attend
                    </button>
                    <button
                      onClick={handleSimulateSkip}
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-850 dark:hover:border-rose-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-455 flex items-center justify-center gap-1 transition-all"
                    >
                      <Minus size={11} /> Skip
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 4: Beautiful Dashboard Preview Mockup */}
            <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">User Interface</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Designed for clarity</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto">
                  A high-fidelity layout optimized for fast reading, dark preferences, and desktop-first tracking.
                </p>
              </div>

              {/* Overlapping CSS Mockup Container */}
              <div className="relative max-w-4xl mx-auto h-[450px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/40 dark:border-neutral-900 dark:bg-[#050711]/50 p-6 md:p-8 flex items-center justify-center shadow-md dark:shadow-xl">
                
                {/* Mock Desktop Panel */}
                <div className="hidden md:flex absolute top-10 left-10 right-28 bottom-10 bg-white border border-slate-200/80 dark:bg-neutral-950 dark:border-neutral-850 rounded-2xl shadow-2xl overflow-hidden -rotate-2 origin-top-left transition-transform duration-500 hover:rotate-0">
                  {/* Sidebar mockup */}
                  <div className="w-1/4 border-r border-slate-100 dark:border-neutral-900 p-4 space-y-4 bg-white dark:bg-neutral-950 select-none">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-neutral-900">
                      <div className="w-4 h-4 rounded bg-indigo-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">AmazeCC</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-6 rounded bg-slate-50 dark:bg-neutral-900 flex items-center px-2 text-[9px] text-slate-700 dark:text-gray-400 font-bold">📅 Calendar</div>
                      <div className="h-6 rounded flex items-center px-2 text-[9px] text-slate-500 dark:text-gray-500 font-bold">🏫 Attendance</div>
                      <div className="h-6 rounded flex items-center px-2 text-[9px] text-slate-500 dark:text-gray-500 font-bold">🏡 Hostel Hub</div>
                    </div>
                  </div>
                  {/* Core layout mockup */}
                  <div className="flex-1 p-6 space-y-4 bg-slate-50/50 dark:bg-neutral-900/20 select-none">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-900 pb-3">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Semester Course List</span>
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-100 dark:bg-neutral-950 dark:border-neutral-850 p-3 rounded-xl space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest block">BMAT201L</span>
                        <div className="h-1.5 w-3/4 rounded bg-indigo-500" />
                        <span className="text-[9px] text-slate-500 dark:text-gray-500 font-bold block">Complex Variables</span>
                      </div>
                      <div className="bg-white border border-slate-100 dark:bg-neutral-950 dark:border-neutral-850 p-3 rounded-xl space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest block">CSE3002</span>
                        <div className="h-1.5 w-1/2 rounded bg-indigo-500" />
                        <span className="text-[9px] text-slate-500 dark:text-gray-500 font-bold block">Compiler Design</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overlapping Mock Phone Panel */}
                <div className="absolute md:right-6 md:bottom-6 left-1/2 md:left-auto top-1/2 md:top-auto -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 w-52 h-80 bg-white border-4 border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-3xl shadow-2xl p-4 overflow-hidden md:rotate-3 transition-transform duration-500 hover:rotate-0">
                  <div className="w-12 h-4 bg-slate-100 dark:bg-neutral-850 rounded-full mx-auto mb-4" />
                  <div className="space-y-4 select-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-900 dark:text-white uppercase">Today's Hub</span>
                      <span className="text-[9px] text-indigo-650 dark:text-indigo-400 font-bold">22BCE1234</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl space-y-2">
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold block">✓ Attendance Safe</span>
                      <div className="h-1 bg-indigo-500 rounded w-full" />
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 dark:bg-[#050711] dark:border-neutral-900 p-2.5 rounded-xl space-y-2">
                      <span className="text-[8px] text-slate-500 dark:text-gray-400 font-bold block">Hostel Laundry</span>
                      <span className="text-[7px] text-slate-400 dark:text-gray-500 block">D-Block Slot #03 locked</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 5: Why Students Love AmazeCC */}
            <section className="bg-slate-100/50 border-y border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <div className="text-center space-y-3">
                  <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest block">Why AmazeCC?</span>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Built for speed and complete trust</h2>
                  <p className="text-xs md:text-sm text-slate-650 dark:text-gray-400 max-w-xl mx-auto">
                    Design choices aligned to speed, local privacy, and simplicity.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {benefits.map((benefit, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 dark:bg-neutral-950/40 dark:border-neutral-900 p-6 rounded-2xl space-y-2 shadow-xs dark:shadow-none">
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{benefit.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-455 leading-relaxed font-medium">{benefit.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 6: Campus Companion Day Timeline */}
            <section id="timeline" className="max-w-7xl mx-auto px-6 py-24 space-y-16">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-black text-indigo-605 dark:text-indigo-400 uppercase tracking-widest block">Daily Walkthrough</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">A typical day with AmazeCC</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto">
                  See how AmazeCC supports your schedule checks and mess menu updates throughout college hours.
                </p>
              </div>

              {/* Vertical timeline details */}
              <div className="max-w-3xl mx-auto space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200 dark:before:bg-neutral-900">
                {companionTimeline.map((item, idx) => (
                  <div key={idx} className="flex gap-6 relative pl-8 text-left">
                    {/* Circle indicators */}
                    <div className="absolute left-2.5 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-4 border-slate-50 dark:border-neutral-950 shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400">{item.time}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{item.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-455 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 7: Future Roadmap */}
            <section id="roadmap" className="bg-slate-100/50 border-t border-slate-200 dark:bg-[#02040a]/40 dark:border-neutral-900 py-24 px-6">
              <div className="max-w-7xl mx-auto space-y-16">
                <div className="text-center space-y-3">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Project Roadmap</span>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">What is coming next</h2>
                  <p className="text-xs md:text-sm text-slate-650 dark:text-gray-400 max-w-xl mx-auto">
                    Continuous upgrades to extend scheduling assistance.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {roadmap.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 dark:bg-neutral-950/60 dark:border-neutral-900 p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs dark:shadow-none">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full w-fit block">{item.status}</span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pt-2">{item.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 8: FAQ Accordion */}
            <section id="faq" className="max-w-4xl mx-auto px-6 py-24 space-y-16">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Support & FAQs</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Frequently Asked Questions</h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 max-w-xl mx-auto">
                  Answers to common questions regarding credentials and connections.
                </p>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className="border border-slate-200 bg-white dark:border-neutral-900 dark:bg-neutral-950/40 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-neutral-900/30 uppercase tracking-wider transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronLeft size={16} className={`text-gray-450 transition-transform duration-300 ${isOpen ? "-rotate-90" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="p-5 border-t border-slate-200 bg-slate-50/50 text-slate-600 dark:border-neutral-900 dark:bg-neutral-950/20 dark:text-gray-400 text-xs leading-relaxed font-medium">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        ) : (
          /* Premium Login Screen Card with split details panel */
          <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 w-full animate-scaleIn">
            <button
              onClick={() => setShowLoginCard(false)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-gray-400 hover:text-white mb-6 transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} /> Back to product info
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Left Column: Security and Details info */}
              <div className="lg:col-span-5 bg-slate-100 border border-slate-200 dark:bg-[#050814]/40 dark:border-neutral-900 p-6 rounded-3xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Security & Privacy</h3>
                  <div className="space-y-4 text-left">
                    <div className="flex gap-3">
                      <div className="p-2 bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 rounded-lg shrink-0 h-fit">
                        <Shield size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Client-Side Only</h4>
                        <p className="text-[10px] text-slate-500 dark:text-gray-455 mt-0.5 leading-relaxed font-medium">Authentication details and cookie stores stay strictly local. We never host database storage.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="p-2 bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 rounded-lg shrink-0 h-fit">
                        <Zap size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Direct verify</h4>
                        <p className="text-[10px] text-slate-500 dark:text-gray-455 mt-0.5 leading-relaxed font-medium">Secure verification directly with VTOP servers to pull schedules.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-neutral-900 text-[10px] text-slate-450 dark:text-gray-500 font-semibold text-left">
                  Secured by standard TLS encryption directly to the VIT gateway.
                </div>
              </div>

              {/* Right Column: Login form card */}
              <div className="lg:col-span-7 bg-white border border-slate-200 dark:bg-[#050814]/60 dark:border-neutral-900 backdrop-blur-2xl rounded-3xl p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-[#050814]/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center z-25 space-y-4 animate-in fade-in duration-300">
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
                  
                  {/* Header info */}
                  <div className="flex items-center gap-2.5 border-b border-slate-105 dark:border-neutral-900 pb-4 mb-2">
                    <div className="p-2 bg-indigo-550/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-650 dark:text-indigo-400 rounded-lg">
                      <Shield size={16} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">VTOP Verification</h2>
                      <p className="text-[10px] text-slate-500 dark:text-gray-455 mt-0.5">Secure authentication via VIT database</p>
                    </div>
                  </div>

                  {message && (message.toLowerCase().includes("failed") || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("wrong") || message.toLowerCase().includes("incorrect") || message.toLowerCase().includes("captcha") || message.toLowerCase().includes("error")) && (
                    <div className="p-3.5 rounded-xl border text-xs text-center font-bold bg-rose-500/10 border-rose-500/20 text-rose-650 dark:text-rose-450">
                      {message}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-900 mb-4">
                    <div className="flex items-center gap-2">
                      <Server size={14} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-600 dark:text-gray-300">API Gateway</span>
                    </div>
                    <select 
                      value={activeApi} 
                      onChange={(e) => onApiChange(e.target.value)}
                      className="text-xs bg-transparent border-none focus:ring-0 text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer"
                    >
                      <option value={primaryApiUrl}>Primary</option>
                      <option value={backupApiUrl}>Backup</option>
                    </select>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">VTop Username</label>
                      <Input
                        className="uppercase"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isLoading}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {!isLoading && (
                    <>
                      <div className="space-y-3 text-left">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">Residential Status</p>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => { setResidentialStatus("hosteller"); setIsDayscholarWithBus(false); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              residentialStatus === "hosteller"
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10"
                                : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-neutral-950 dark:text-gray-400 dark:border-neutral-900 hover:border-indigo-500/30"
                            }`}
                          >
                            Hosteller
                          </button>
                          <button
                            type="button"
                            onClick={() => setResidentialStatus("dayscholar")}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              residentialStatus === "dayscholar"
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10"
                                : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-neutral-950 dark:text-gray-400 dark:border-neutral-900 hover:border-indigo-500/30"
                            }`}
                          >
                            Dayscholar
                          </button>
                        </div>
                        {residentialStatus === "dayscholar" && (
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-900 cursor-pointer transition-all hover:border-indigo-500/30">
                            <Checkbox
                              checked={isDayscholarWithBus}
                              onCheckedChange={(checked) => setIsDayscholarWithBus(!!checked)}
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-gray-300">I have registered transport (bus)</span>
                          </label>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full text-xs font-extrabold"
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
            <a href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
            <a href="https://github.com/AmazeContinuityProjects/AmazeCC" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-[10px] font-semibold">
            Made with ❤️ by students. Not affiliated with VIT or VTOP.
          </p>
        </div>
      </footer>

    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\custom\NavigationTabs.tsx`

### Imports
```typescript
import {
import {
import { motion, AnimatePresence } from "framer-motion";
import {
import { AppLibrary, MobileBottomNav, OptionPicker } from "../../index";
```

### Exports
```typescript
export default function NavigationTabs({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  BookOpen,
  Building,
  CalendarCheck,
  ChevronRight,
  Command,
  CreditCard,
  GraduationCap,
  Home,
  Library,
  LayoutGrid,
  Lock,
  Menu,
  RefreshCcw,
  Settings,
  User,
  Wrench,
  Calendar,
  Compass,
  Key,
  ArrowLeft,
  Bus,
  Sun,
  Moon,
  Search,
  X,
  Coffee,
  Info,
  Link2,
  ChevronDown,
  Car,
  CarTaxiFront,
  MoreHorizontal,
  Server,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useTheme, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  SidebarProfile,
  SidebarThemeControl,
  SidebarExpandButton,
} from "../../index";
import { AppLibrary, MobileBottomNav, OptionPicker } from "../../index";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onSelect: () => void;
  isExpandable?: boolean;
};

type Group = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}

const navButtonBase =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";

export default function NavigationTabs({
  activeTab,
  setActiveTab,
  handleLogOutRequest,
  handleReloadRequest,
  currSemesterID,
  setCurrSemesterID,
  handleLogin,
  setIsReloading,
  username,
  password,
  setPassword,
  settings,
  setSettings,
  attendancePercentage,
  marksData,
  ODhoursData,
  setODhoursIsOpen,
  feedbackStatus,
  setGradesDisplayIsOpen,
  activeAttendanceSubTab,
  setActiveAttendanceSubTab,
  activeSubTab,
  setActiveSubTab,
  HostelActiveSubTab,
  setHostelActiveSubTab,
  activeDayscholarSubTab,
  setActiveDayscholarSubTab,
  activeQBankSubTab,
  setActiveQBankSubTab,
  activeMoreSubTab,
  setActiveMoreSubTab,
  activeProfileSubTab,
  setActiveProfileSubTab,
  onOpenFeedbackStatus,
  onOpenCommandPalette,
  showGpa,
  showProfilePhoto,
  assetPrefix,
  semesterIDs,
  activeApi,
  onApiChange,
  primaryApiUrl,
  backupApiUrl,
}: any) {
  // Suppress unused warnings to comply with ESLint configurations
  void handleLogOutRequest;
  void setCurrSemesterID;
  void handleLogin;
  void setIsReloading;
  void password;
  void setPassword;
  void activeDayscholarSubTab;
  void setActiveDayscholarSubTab;
  void activeQBankSubTab;
  void setActiveQBankSubTab;
  void feedbackStatus;
  void onOpenFeedbackStatus;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState((assetPrefix + "/logo.png"));
  const [profileData, setProfileData] = useState<any>(null);
  
  // Progressive disclosure
  const [expandedGroup, setExpandedGroup] = useState<string>("study");
  const [showAcademicsPanel, setShowAcademicsPanel] = useState(activeTab === "academics");
  const [showHostelPanel, setShowHostelPanel] = useState(activeTab === "hostel");
  const [activeRailGroup, setActiveRailGroup] = useState<string | null>(null);
  const [isAppLibraryOpen, setIsAppLibraryOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"primary" | "academics" | "hostel">("primary");

  // Theme settings (next-themes)
  const { theme, setTheme } = useTheme();
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);

  // Expanded mode depends on settings
  const isExpandedMode = !settings.isSidebarCollapsed;
  const isOpen = isExpandedMode;

  // Command palette logic
  const openCommandPalette = useCallback(() => {
    onOpenCommandPalette?.();
    setActiveRailGroup(null);
  }, [onOpenCommandPalette]);

  useEffect(() => {
    const updateIcon = () => {
      const savedIcon = localStorage.getItem("app-icon") || "default";
      setCurrentIcon((assetPrefix + (savedIcon === "fire" ? "/images/icons/fire.png" : "/logo.png")));
    };

    updateIcon();
    window.addEventListener("app-icon-changed", updateIcon);

    try {
      const stored = localStorage.getItem("profile");
      if (stored) setProfileData(JSON.parse(stored));
    } catch (e) {}
    
    return () => {
      window.removeEventListener("app-icon-changed", updateIcon);
    };
  }, []);

  // No swipe-up gesture — App Library is opened only via the Modules button


  // Update expandedGroup and subpanels when activeTab changes
  useEffect(() => {
    if (activeTab === "academics") {
      setShowAcademicsPanel(true);
      setShowHostelPanel(false);
      setExpandedGroup("study");
    } else if (activeTab === "hostel") {
      setShowHostelPanel(true);
      setShowAcademicsPanel(false);
      setExpandedGroup("campus");
    } else {
      setShowAcademicsPanel(false);
      setShowHostelPanel(false);
      if (activeTab === "home" || activeTab === "attendance") {
        setExpandedGroup("study");
      } else if (["payments", "libraries", "transport"].includes(activeTab)) {
        setExpandedGroup("campus");
      } else if (activeTab === "more") {
        setExpandedGroup("tools");
      } else if (activeTab === "profile") {
        setExpandedGroup("account");
      }
    }
  }, [activeTab]);

  // Handle clicking outside the rail popover in compact mode
  useEffect(() => {
    if (!activeRailGroup) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sidebarRef.current?.contains(target) || flyoutRef.current?.contains(target)) return;
      setActiveRailGroup(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [activeRailGroup]);

  // Close rail popover if expanded state changes
  useEffect(() => {
    if (isOpen) {
      setActiveRailGroup(null);
    }
  }, [isOpen]);

  const isHosteller = profileData?.isHosteller;
  const residentialStatus = settings?.residentialStatus;

  // Semester Summary Data Calculations
  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum: number, day: any) => sum + day.total, 0)
      : 0;
  const credits = marksData?.cgpa
    ? Number(marksData.cgpa.creditsEarned) + Number(marksData.cgpa.nonGradedRequirement || 0)
    : "-";
  const attendanceValue = `${attendancePercentage?.[settings.attendancePercentageOrString] || "-"}${
    settings.attendancePercentageOrString === "percentage" ? "%" : ""
  }`;

  const profileName = settings.friendlyName || profileData?.name || username || "Student";
  const shouldDisplayGpa = showGpa;
  const shouldDisplayProfilePhoto = showProfilePhoto;
  const initials = String(profileName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const persistSidebarState = useCallback((nextCollapsed: boolean) => {
    setSettings((prev: any) => ({ ...prev, isSidebarCollapsed: nextCollapsed }));
    localStorage.setItem("settings", JSON.stringify({ ...settings, isSidebarCollapsed: nextCollapsed }));
  }, [setSettings, settings]);

  const handleReloadClick = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    window.setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const selectTab = useCallback((tab: string) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }, [setActiveTab]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroup(current => (current === groupId ? "" : groupId));
  }, []);

  const toggleRailPopover = useCallback((groupId: string) => {
    setActiveRailGroup(current => (current === groupId ? null : groupId));
  }, []);

  const sidebarActiveStyles = "bg-sidebar-accent border border-sidebar-border text-info font-semibold";
  const sidebarActiveIconStyles = "text-info font-semibold";
  const railActiveStyles = "bg-sidebar-accent text-info border border-sidebar-border shadow-sm";

  const handleThemeChange = (selectedTheme: string) => {
    if (theme === selectedTheme) return;
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(selectedTheme);
      });
    } else {
      setTheme(selectedTheme);
    }
    
  };

  // Keyboard navigation
  const handleNavKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
      return;
    }
    if (event.key === "Escape") {
      setActiveRailGroup(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-nav='true']"));
      const index = buttons.indexOf(event.currentTarget);
      const next = event.key === "ArrowDown" ? buttons[index + 1] : buttons[index - 1];
      next?.focus();
    }
  }, []);

  // Navigation Items Memoization
  const studyItems = useMemo<NavItem[]>(() => [
    {
      id: "home",
      label: "Home",
      icon: Home,
      isActive: activeTab === "home",
      onSelect: () => selectTab("home"),
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: CalendarCheck,
      isActive: activeTab === "attendance" && activeAttendanceSubTab === "attendance",
      onSelect: () => {
        selectTab("attendance");
        setActiveAttendanceSubTab("attendance");
      },
    },
    {
      id: "calendar",
      label: "Timetable Calendar",
      icon: Calendar,
      isActive: activeTab === "attendance" && activeAttendanceSubTab === "calendar",
      onSelect: () => {
        selectTab("attendance");
        setActiveAttendanceSubTab("calendar");
      },
    },
    {
      id: "academics",
      label: "Academics",
      icon: GraduationCap,
      isActive: activeTab === "academics",
      isExpandable: true,
      onSelect: () => {
        selectTab("academics");
        if (!activeSubTab) setActiveSubTab("overview");
        setShowAcademicsPanel(true);
      },
    },
  ], [activeTab, activeAttendanceSubTab, activeSubTab, selectTab, setActiveAttendanceSubTab, setActiveSubTab]);

  const campusItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        id: "payments",
        label: "Payments",
        icon: CreditCard,
        isActive: activeTab === "payments",
        onSelect: () => selectTab("payments"),
      },
      {
        id: "cabshare",
        label: "Cab Share",
        icon: Car,
        isActive: activeTab === "cabshare",
        onSelect: () => selectTab("cabshare"),
      },
      {
        id: "libraries",
        label: "Libraries",
        icon: Library,
        isActive: activeTab === "libraries",
        onSelect: () => selectTab("libraries"),
      },
    ];

    if (isHosteller === true || residentialStatus === "hosteller") {
      items.push({
        id: "hostel",
        label: "Hostel",
        icon: Home,
        isActive: activeTab === "hostel",
        isExpandable: true,
        onSelect: () => {
          selectTab("hostel");
          if (!HostelActiveSubTab) setHostelActiveSubTab("overview");
          setShowHostelPanel(true);
        },
      });
    }

    items.push({
      id: "transport",
      label: "Transport",
      icon: Bus,
      isActive: activeTab === "transport",
      onSelect: () => selectTab("transport"),
    });

    return items;
  }, [activeTab, isHosteller, residentialStatus, selectTab, HostelActiveSubTab, setHostelActiveSubTab]);

  const toolsItems = useMemo<NavItem[]>(() => [
    {
      id: "social",
      label: "Social",
      icon: LayoutGrid,
      isActive: activeTab === "more" && activeMoreSubTab === "social",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("social");
      },
    },
    {
      id: "ffcs",
      label: "FFCS Planner",
      icon: Compass,
      isActive: activeTab === "more" && activeMoreSubTab === "ffcs",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("ffcs");
      },
    },
    {
      id: "more-events",
      label: "Event Hub",
      icon: Calendar,
      isActive: activeTab === "more" && activeMoreSubTab === "events",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("events");
      }
    },
    {
      id: "more-clubs",
      label: "Club Hub",
      icon: LayoutGrid,
      isActive: activeTab === "more" && activeMoreSubTab === "clubs",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("clubs");
      }
    },
  ], [activeTab, activeMoreSubTab, selectTab, setActiveMoreSubTab]);

  const accountItems = useMemo<NavItem[]>(() => [
    {
      id: "profile-info",
      label: "My Info",
      icon: User,
      isActive: activeTab === "profile" && activeProfileSubTab === "info",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("info");
      },
    },
    {
      id: "profile-credentials",
      label: "Credentials",
      icon: Key,
      isActive: activeTab === "profile" && activeProfileSubTab === "credentials",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("credentials");
      },
    },
    {
      id: "profile-settings",
      label: "Settings",
      icon: Settings,
      isActive: activeTab === "profile" && activeProfileSubTab === "settings",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("settings");
      },
    },
    {
      id: "about",
      label: "About & Resources",
      icon: Info,
      isActive: activeTab === "about",
      onSelect: () => {
        selectTab("about");
      },
    },
    {
      id: "logout",
      label: "Logout",
      icon: Lock,
      onSelect: () => {
        const handleLogout = () => {
          setIsSpinning(true);
          setTimeout(() => {
            setExpandedGroup((prev: any) => prev); // dummy use of prev with type
            handleLogOutRequest();
          }, 600);
        };
        handleLogout();
      },
      isActive: false,
    },
  ], [activeTab, activeProfileSubTab, selectTab, setActiveProfileSubTab]);

  const groups = useMemo<Group[]>(() => [
    { id: "study", label: "Study", icon: BookOpen, items: studyItems },
    { id: "campus", label: "Campus", icon: Building, items: campusItems },
    { id: "tools", label: "Tools", icon: Wrench, items: toolsItems },
    { id: "account", label: "Account", icon: Settings, items: accountItems },
  ], [studyItems, campusItems, toolsItems, accountItems]);

  const academicsItems = useMemo(() => [
    {
      id: "overview",
      label: "Overview",
      isActive: activeTab === "academics" && activeSubTab === "overview",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("overview");
      },
    },
    {
      id: "course-dashboard",
      label: "Course Dashboard",
      isActive: activeTab === "academics" && activeSubTab === "course-dashboard",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("course-dashboard");
      },
    },
    {
      id: "grades",
      label: "Grade History",
      isActive: activeTab === "academics" && activeSubTab === "grades",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("grades");
      },
    },
    {
      id: "curriculum",
      label: "Curriculum",
      isActive: activeTab === "academics" && activeSubTab === "curriculum",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("curriculum");
      },
    },
    {
      id: "predictor",
      label: "CGPA Predictor",
      isActive: activeTab === "academics" && activeSubTab === "predictor",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("predictor");
      },
    },
    {
      id: "qbank",
      label: "Question Bank",
      isActive: activeTab === "academics" && activeSubTab === "qbank",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("qbank");
      },
    },
    {
      id: "projects",
      label: "Projects",
      isActive: activeTab === "academics" && activeSubTab === "projects",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("projects");
      },
    },
    {
      id: "wishlist",
      label: "Wishlist",
      isActive: activeTab === "academics" && activeSubTab === "wishlist",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("wishlist");
      },
    },
    {
      id: "faculty-info",
      label: "Faculty",
      isActive: activeTab === "academics" && activeSubTab === "faculty-info",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("faculty-info");
      },
    },
    {
      id: "course-mgmt",
      label: "Course Management",
      isActive: activeTab === "academics" && activeSubTab === "course-mgmt",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("course-mgmt");
      },
    },
    {
      id: "arrear",
      label: "Arrear",
      isActive: activeTab === "academics" && activeSubTab === "arrear",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("arrear");
      },
    },
    {
      id: "makeup-compre",
      label: "Makeup & Compre",
      isActive: activeTab === "academics" && activeSubTab === "makeup-compre",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("makeup-compre");
      },
    },
  ], [activeTab, activeSubTab, selectTab, setActiveSubTab]);

  const hostelSubItems = useMemo(() => [
    {
      id: "overview",
      label: "Overview",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "overview",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("overview");
      },
    },
    {
      id: "mess",
      label: "Mess Menu",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "mess",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("mess");
      },
    },
    {
      id: "laundry",
      label: "Laundry",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "laundry",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("laundry");
      },
    },
    {
      id: "leave",
      label: "Leave Management",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "leave",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("leave");
      },
    },
    {
      id: "counselling",
      label: "Counselling",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "counselling",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("counselling");
      },
    },
  ], [activeTab, HostelActiveSubTab, selectTab, setHostelActiveSubTab]);

  const renderMobileNav = () => {
    const allSearchableItems = [
      { label: "Attendance", group: "Study", icon: CalendarCheck, action: () => { selectTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
      { label: "Timetable Calendar", group: "Study", icon: Calendar, action: () => { selectTab("attendance"); setActiveAttendanceSubTab("calendar"); } },
      
      { label: "Academics Overview", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("overview"); } },
      { label: "Course Dashboard", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("course-dashboard"); } },
      { label: "Grade History", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("grades"); } },
      { label: "Curriculum", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("curriculum"); } },
      { label: "CGPA Predictor", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("predictor"); } },
      { label: "Faculty Explorer", group: "Academics", icon: User, action: () => { selectTab("academics"); setActiveSubTab("faculty-info"); } },
      { label: "Question Bank", group: "Academics", icon: Library, action: () => { selectTab("academics"); setActiveSubTab("qbank"); } },
      { label: "Arrear Management", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("arrear"); } },
      { label: "Makeup & Compre", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("makeup-compre"); } },
      { label: "Course Options", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("course-mgmt"); } },
      { label: "Projects", group: "Academics", icon: LayoutGrid, action: () => { selectTab("academics"); setActiveSubTab("projects"); } },
      { label: "Wishlist", group: "Academics", icon: Settings, action: () => { selectTab("academics"); setActiveSubTab("wishlist"); } },
      
      { label: "Hostel Overview", group: "Hostel", icon: Building, action: () => { selectTab("hostel"); setHostelActiveSubTab("overview"); } },
      { label: "Mess Menu", group: "Hostel", icon: Coffee, action: () => { selectTab("hostel"); setHostelActiveSubTab("mess"); } },
      { label: "Laundry", group: "Hostel", icon: Wrench, action: () => { selectTab("hostel"); setHostelActiveSubTab("laundry"); } },
      { label: "Leave / Gatepass", group: "Hostel", icon: Compass, action: () => { selectTab("hostel"); setHostelActiveSubTab("leave"); } },
      { label: "Counselling", group: "Hostel", icon: User, action: () => { selectTab("hostel"); setHostelActiveSubTab("counselling"); } },
      { label: "Hostel Payments", group: "Hostel", icon: CreditCard, action: () => { selectTab("payments"); } },
      
      { label: "Cab Share", group: "Campus", icon: CarTaxiFront, action: () => { selectTab("cabshare"); } },
      { label: "Transport", group: "Campus", icon: Bus, action: () => { selectTab("transport"); } },
      { label: "Payments", group: "Campus", icon: CreditCard, action: () => { selectTab("payments"); } },
      { label: "Libraries", group: "Campus", icon: Library, action: () => { selectTab("libraries"); } },
      
      { label: "Social Feed", group: "Tools", icon: User, action: () => { selectTab("more"); setActiveMoreSubTab("social"); } },
      { label: "Event Hub", group: "Tools", icon: Compass, action: () => { selectTab("more"); setActiveMoreSubTab("events"); } },
      { label: "Club Hub", group: "Tools", icon: LayoutGrid, action: () => { selectTab("more"); setActiveMoreSubTab("clubs"); } },
      { label: "FFCS Planner", group: "Tools", icon: LayoutGrid, action: () => { selectTab("more"); setActiveMoreSubTab("ffcs"); } },
      
      { label: "My Info", group: "Account", icon: User, action: () => { selectTab("profile"); setActiveProfileSubTab("info"); } },
      { label: "Settings", group: "Account", icon: Wrench, action: () => { selectTab("profile"); setActiveProfileSubTab("settings"); } },
      { label: "About & Resources", group: "Account", icon: Info, action: () => { selectTab("about"); } },
      { label: "Logout", group: "Account", icon: Lock, action: () => { handleLogOutRequest(); } }
    ];

    // Primary mobile structure mirroring desktop groups
    const primaryGroups = [
      {
        name: "Study",
        items: [
          { label: "Attendance", icon: CalendarCheck, type: "link", action: () => { selectTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
          { label: "Timetable Calendar", icon: Calendar, type: "link", action: () => { selectTab("attendance"); setActiveAttendanceSubTab("calendar"); } },
          { label: "Academics", icon: GraduationCap, type: "panel", action: () => setMobilePanel("academics") }
        ]
      },
      {
        name: "Campus",
        items: [
          { label: "Cab Share", icon: CarTaxiFront, type: "link", action: () => selectTab("cabshare") },
          { label: "Payments", icon: CreditCard, type: "link", action: () => selectTab("payments") },
          { label: "Libraries", icon: Library, type: "link", action: () => selectTab("libraries") },
          ...(isHosteller === true || residentialStatus === "hosteller" 
            ? [{ label: "Hostel Hub", icon: Home, type: "panel", action: () => setMobilePanel("hostel") }] 
            : [{ label: "Transport", icon: Bus, type: "link", action: () => selectTab("transport") }])
        ]
      },
      {
        name: "Tools",
        items: [
          { label: "Social", icon: LayoutGrid, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("social"); } },
          { label: "FFCS Planner", icon: Compass, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("ffcs"); } },
          { label: "Event Hub", icon: Calendar, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("events"); } },
          { label: "Club Hub", icon: LayoutGrid, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("clubs"); } }
        ]
      },
      {
        name: "Account",
        items: [
          { label: "My Info", icon: User, type: "link", action: () => { selectTab("profile"); setActiveProfileSubTab("info"); } },
          { label: "Settings", icon: Wrench, type: "link", action: () => { selectTab("profile"); setActiveProfileSubTab("settings"); } },
          { label: "About & Resources", icon: Info, type: "link", action: () => { selectTab("about"); } },
          { label: "Logout", icon: Lock, type: "link", action: () => { handleLogOutRequest(); } }
        ]
      }
    ];

    const academicsItemsMobile = allSearchableItems.filter(item => item.group === "Academics");
    const hostelItemsMobile = allSearchableItems.filter(item => item.group === "Hostel");

    // Filter items based on search query
    const filteredSearchItems = librarySearchQuery
      ? allSearchableItems.filter(item => item.label.toLowerCase().includes(librarySearchQuery.toLowerCase()))
      : [];

    const pinnedTabs = settings?.pinnedNavTabs ?? [];
    const tabIcons: Record<string, { icon: React.ReactNode; label: string }> = {
      attendance: { icon: <CalendarCheck className="h-5 w-5 stroke-[2]" />, label: "Attendance" },
      academics: { icon: <GraduationCap className="h-5 w-5 stroke-[2]" />, label: "Academics" },
      payments: { icon: <CreditCard className="h-5 w-5 stroke-[2]" />, label: "Payments" },
      libraries: { icon: <Library className="h-5 w-5 stroke-[2]" />, label: "Libraries" },
      cabshare: { icon: <CarTaxiFront className="h-5 w-5 stroke-[2]" />, label: "Cab Share" },
      transport: { icon: <Bus className="h-5 w-5 stroke-[2]" />, label: "Transport" },
      more: { icon: <MoreHorizontal className="h-5 w-5 stroke-[2]" />, label: "More" },
      profile: { icon: <User className="h-5 w-5 stroke-[2]" />, label: "Profile" },
    };

    const rawNavItems: any[] = [
      {
        id: "home",
        icon: <Home className="h-5 w-5 stroke-[2]" />,
        label: "Home",
        isActive: activeTab === "home" && !isAppLibraryOpen,
        onClick: () => {
          setIsAppLibraryOpen(false);
          selectTab("home");
        },
      },
    ];

    if (pinnedTabs.length === 0) {
      rawNavItems.push({
        id: "search",
        icon: <Search className="h-5 w-5 stroke-[2]" />,
        label: "Search",
        onClick: openCommandPalette,
      });
    } else {
      pinnedTabs.forEach((tabId: string) => {
        const t = tabIcons[tabId];
        if (t) {
          rawNavItems.push({
            id: tabId,
            icon: t.icon,
            label: t.label,
            isActive: activeTab === tabId && !isAppLibraryOpen,
            onClick: () => {
              setIsAppLibraryOpen(false);
              selectTab(tabId);
            },
          });
        }
      });
    }

    rawNavItems.push({
      id: "modules",
      icon: <LayoutGrid className="h-5 w-5 stroke-[2]" />,
      label: "Modules",
      isActive: isAppLibraryOpen,
      onClick: () => {
        setMobilePanel("primary");
        setIsAppLibraryOpen(prev => !prev);
      },
    });

    const isCompact = rawNavItems.length > 5 || pinnedTabs.length >= 2;

    return (
      <>
        <MobileBottomNav items={rawNavItems} compact={isCompact} />

        <AppLibrary
          open={isAppLibraryOpen}
          onClose={() => { setIsAppLibraryOpen(false); setLibrarySearchQuery(""); }}
          title={mobilePanel === "primary" ? "App Library" : mobilePanel === "academics" ? "Academics" : "Hostel Hub"}
          subtitle={mobilePanel === "primary" ? "Select a module to open" : "Choose a sub-page"}
          showBack={mobilePanel !== "primary"}
          onBack={() => setMobilePanel("primary")}
          searchQuery={mobilePanel === "primary" ? librarySearchQuery : undefined}
          onSearchChange={mobilePanel === "primary" ? setLibrarySearchQuery : undefined}
        >
          {mobilePanel === "primary" && (
            <div className="flex items-center gap-1.5 px-1 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Active Sem:</span>
              <div className="relative flex items-center">
                <OptionPicker
                  value={settings.currSemesterID || semesterIDs[semesterIDs.length - 2]}
                  onChange={(val) => handleReloadRequest(val)}
                  options={semesterIDs.map((semId: string) => ({
                    value: semId,
                    label: formatSemesterName(semId)
                  }))}
                  className="w-[150px]"
                />
              </div>
            </div>
          )}

          {librarySearchQuery ? (
            filteredSearchItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">No modules found matching "{librarySearchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Search Results</h3>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {filteredSearchItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => { item.action(); setIsAppLibraryOpen(false); setLibrarySearchQuery(""); }}
                        className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                      >
                        <div className="rounded-xl bg-info-surface p-2 text-info shrink-0">
                          <Icon className="h-4.5 w-4.5 stroke-[2]" />
                        </div>
                        <span className="text-xs font-bold leading-tight text-gray-700 dark:text-gray-300">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : mobilePanel === "primary" ? (
            primaryGroups.map(group => (
              <div key={group.name} className="space-y-2">
                <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{group.name}</h3>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isPanelTrigger = item.type === "panel";
                    return (
                      <button
                        key={item.label}
                        onClick={() => { item.action(); if (!isPanelTrigger) setIsAppLibraryOpen(false); }}
                        className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-xl bg-info-surface p-2 text-info shrink-0">
                            <Icon className="h-4.5 w-4.5 stroke-[2]" />
                          </div>
                          <span className="truncate text-xs font-bold leading-tight text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                        {isPanelTrigger && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : mobilePanel === "academics" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {academicsItemsMobile.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setIsAppLibraryOpen(false); }}
                      className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                    >
                      <div className="rounded-xl bg-purple-50 p-2 text-purple-600 shrink-0 dark:bg-purple-950/30 dark:text-purple-400">
                        <Icon className="h-4.5 w-4.5 stroke-[2]" />
                      </div>
                      <span className="text-xs font-bold leading-tight text-gray-700 dark:text-gray-300">{item.label.replace("Academics ", "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {hostelItemsMobile.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setIsAppLibraryOpen(false); }}
                      className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                    >
                      <div className="rounded-xl bg-amber-50 p-2 text-amber-600 shrink-0 dark:bg-amber-950/30 dark:text-amber-400">
                        <Icon className="h-4.5 w-4.5 stroke-[2]" />
                      </div>
                      <span className="text-xs font-bold leading-tight text-gray-700 dark:text-gray-300">{item.label.replace("Hostel ", "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="shrink-0 space-y-2 border-t border-gray-200/50 bg-gray-50/80 px-5 py-4 dark:border-gray-800/50 dark:bg-black/60" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
            <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Interface Theme</h4>
            <div className="flex w-full gap-1 rounded-xl border border-gray-200/20 bg-gray-200/50 p-1 dark:border-gray-800/50 dark:bg-gray-900/50">
              {["light", "dark", "system"].map(t => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black capitalize transition-all ${
                    theme === t
                      ? "bg-white text-info shadow-xs dark:bg-black"
                      : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  {t === "light" && <Sun className="h-3.5 w-3.5" />}
                  {t === "dark" && <Moon className="h-3.5 w-3.5" />}
                  {t === "system" && <Settings className="h-3.5 w-3.5" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>

            <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-3">API Server</h4>
            <div className="flex w-full gap-1 rounded-xl border border-gray-200/20 bg-gray-200/50 p-1 dark:border-gray-800/50 dark:bg-gray-900/50">
              <button
                onClick={() => onApiChange(primaryApiUrl)}
                className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black capitalize transition-all ${
                  activeApi === primaryApiUrl
                    ? "bg-white text-info shadow-xs dark:bg-black"
                    : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Primary
              </button>
              <button
                onClick={() => onApiChange(backupApiUrl)}
                className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black capitalize transition-all ${
                  activeApi === backupApiUrl
                    ? "bg-white text-info shadow-xs dark:bg-black"
                    : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Backup
              </button>
            </div>
          </div>
        </AppLibrary>
      </>
    );
  };

  return (
    <>
      {renderMobileNav()}

      <Sidebar
        ref={sidebarRef}
        data-sidebar-root="true"
        aria-label="Primary navigation"
        isOpen={isOpen}
        onOpenChange={(val) => persistSidebarState(!val)}
      >
        {/* Sidebar Header */}
        <SidebarHeader>
          {/* Logo & Expand Toggle */}
          <div className={`flex items-center ${isOpen ? "justify-between w-full" : "justify-center w-full"}`}>
            <div className={`flex items-center min-w-0 ${isOpen ? "gap-2.5" : "justify-center"}`}>
              <img src={currentIcon} alt="AmazeCC" className="h-7 w-7 rounded-lg object-contain shadow-xs" />
              {isOpen && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">AmazeCC</h2>
              )}
            </div>
            {isOpen && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReloadClick}
                  className={`relative group rounded-xl p-1.5 text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-105 ${navButtonBase}`}
                  title="Reload data"
                  aria-label="Reload data"
                >
                  <RefreshCcw className={`h-4 w-4 transition-transform ${isSpinning ? "animate-spin" : "group-hover:rotate-180 duration-500"}`} />
                </button>
                <button
                  onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                  className={`relative group rounded-xl p-1.5 text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-105 ${navButtonBase}`}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <Menu className="h-4.5 w-4.5 stroke-[1.9] transition-transform group-hover:scale-110" />
                </button>
              </div>
            )}
          </div>

          {/* Profile Section, Semester summary, & Search */}
          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.div
                key="header-expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden space-y-3"
              >
                {/* Left-aligned clean Semester Summary Card */}
                <div className="mt-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-[11px] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sidebar-foreground/75 tracking-wide text-[10px] uppercase">Current Semester</div>
                    <div className="relative flex items-center">
                      <OptionPicker
                        value={settings.currSemesterID || semesterIDs[semesterIDs.length - 2]}
                        onChange={(val) => handleReloadRequest(val)}
                        options={semesterIDs.map((semId: string) => ({
                          value: semId,
                          label: formatSemesterName(semId)
                        }))}
                        className="w-[140px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {shouldDisplayGpa && (
                      <button
                        onClick={() => {
                          setSettings((prev: any) => {
                            const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
                            localStorage.setItem("settings", JSON.stringify(next));
                            return next;
                          });
                        }}
                        className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                        title="Click to show/hide CGPA"
                      >
                        <span className="text-sidebar-foreground/">CGPA</span>
                        <span className={`font-semibold text-sidebar-foreground transition-all duration-300 ${settings.CGPAHidden ? "blur-[4.5px] select-none" : ""}`}>{marksData?.cgpa?.cgpa || "-"}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = { ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" };
                          localStorage.setItem("settings", JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to toggle attendance format"
                    >
                      <span className="text-sidebar-foreground/">Attendance</span>
                      <span className={`font-semibold ${attendancePercentage?.percentage < 75 ? "text-rose-400" : "text-emerald-400"}`}>
                        {attendanceValue}
                      </span>
                    </button>

                    <button
                      onClick={() => setGradesDisplayIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to view credits & grades details"
                    >
                      <span className="text-sidebar-foreground/">Credits</span>
                      <span className="font-semibold text-sidebar-foreground">{credits}</span>
                    </button>

                    <button
                      onClick={() => setODhoursIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to view OD tracker details"
                    >
                      <span className="text-sidebar-foreground/">OD Hours</span>
                      <span className="font-semibold text-sidebar-foreground">{totalODHours}/40</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar Input */}
                <button
                  data-sidebar-nav="true"
                  onClick={openCommandPalette}
                  onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                  className={`group flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-left text-xs text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:border-sidebar-border hover:shadow-sm dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:scale-[1.02] ${navButtonBase}`}
                  aria-label="Open command palette"
                >
                  <Command className="h-4 w-4 shrink-0 text-sidebar-foreground/ transition-colors group-hover:text-sidebar-foreground/" />
                  <span className="flex-1 truncate transition-colors group-hover:text-sidebar-foreground/">Search anything...</span>
                  <kbd className="rounded-md bg-sidebar-accent border border-sidebar-border px-1.5 py-0.5 text-[9px] font-bold text-sidebar-foreground/ shadow-sm transition-colors group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground">
                    ⌘K
                  </kbd>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="header-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3.5 flex flex-col items-center gap-3 w-full"
              >
                {/* Search Icon Only */}
                <button
                  onClick={openCommandPalette}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
                  title="Search anything... (Ctrl+K)"
                >
                  <Command className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarHeader>

        {/* Navigation Content (Expanded Mode vs Compact Rail) */}
        {isOpen ? (
          <SidebarContent>
            {!showAcademicsPanel && !showHostelPanel ? (
              <div className="space-y-4">
                {groups.map((group) => (
                  <SidebarGroup key={group.id}>
                    <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                    <div className="space-y-0.5 pt-0.5 pb-1">
                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.id}
                          icon={<item.icon className="h-5 w-5" />}
                          label={item.label}
                          isActive={item.isActive}
                          onClick={item.onSelect}
                          onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          rightElement={item.isExpandable ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : undefined}
                        />
                      ))}
                    </div>
                  </SidebarGroup>
                ))}
              </div>
            ) : showAcademicsPanel ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowAcademicsPanel(false)}
                  className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <SidebarGroup>
                  <SidebarGroupLabel>Academics</SidebarGroupLabel>
                  <div className="space-y-0.5">
                    {academicsItems.map((item, index) => {
                      const showDivider = index === 6;
                      return (
                        <div key={item.id}>
                          {showDivider && <div className="my-2 border-t border-sidebar-border" />}
                          <SidebarItem
                            label={item.label}
                            isActive={item.isActive}
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SidebarGroup>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setShowHostelPanel(false)}
                  className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <SidebarGroup>
                  <SidebarGroupLabel>Hostel Hub</SidebarGroupLabel>
                  <div className="space-y-0.5">
                    {hostelSubItems.map((item) => (
                      <SidebarItem
                        key={item.id}
                        label={item.label}
                        isActive={item.isActive}
                        onClick={item.onSelect}
                        onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                      />
                    ))}
                  </div>
                </SidebarGroup>
              </div>
            )}
          </SidebarContent>
        ) : (
          /* Compact Mode Rail Content */
            <div className="flex flex-1 min-h-0 flex-col items-center justify-start w-full mt-3">
            {/* Divider */}
            <div className="w-8 border-t border-sidebar-border mb-3" />

            {/* Navigation Rail Buttons */}
            <nav className="flex flex-col items-center gap-2.5 w-full" aria-label="Navigation rail">
              {groups.map(group => {
                const GroupIcon = group.icon;
                const isActive = group.id === "study"
                  ? activeTab === "home" || activeTab === "attendance" || activeTab === "academics"
                  : group.id === "campus"
                  ? ["payments", "libraries", "hostel", "transport"].includes(activeTab)
                  : group.id === "tools"
                  ? activeTab === "more"
                  : activeTab === "profile";

                return (
                  <div key={group.id} className="relative flex justify-center group/rail">
                    <button
                      onClick={() => toggleRailPopover(group.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 ${
                        isActive
                          ? railActiveStyles
                          : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                      } ${navButtonBase}`}
                      title={group.label}
                      aria-label={`Open ${group.label} menu`}
                    >
                      <GroupIcon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110 text-info' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        )}

        {/* Profile, Theme, and Logout Footer */}
        <SidebarFooter>
          <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="footer-expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 px-4 py-3 rounded-b-[24px] space-y-2.5"
            >
              <SidebarProfile
                name={profileName}
                degree={(profileData?.program || profileData?.branch || profileData?.batch || "").replace("B.Tech ", "")}
                avatarUrl={shouldDisplayProfilePhoto ? profileData?.image : undefined}
                initials={initials || "ST"}
                onLogout={handleLogOutRequest}
              />

              <div className="h-px bg-sidebar-accent" />

              <SidebarThemeControl theme={theme} onThemeChange={handleThemeChange} />

              <div className="flex items-center justify-between w-full p-2 rounded-xl bg-sidebar-accent/50 border border-sidebar-border mt-2">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-sidebar-foreground/" />
                  <span className="text-xs font-bold text-sidebar-foreground">API Server</span>
                </div>
                <OptionPicker 
                  value={activeApi} 
                  onChange={onApiChange}
                  options={[
                    { value: primaryApiUrl, label: "Primary" },
                    { value: backupApiUrl, label: "Backup" }
                  ]}
                  className="w-[110px]"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="footer-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 pb-4 w-full shrink-0"
            >
              {/* Expand Toggle Button */}
              <SidebarExpandButton onClick={() => persistSidebarState(!settings.isSidebarCollapsed)} />

              {/* Theme Toggler (Compact Icon) */}
              <SidebarThemeControl theme={theme} onThemeChange={handleThemeChange} />

              {/* Profile Avatar */}
              <SidebarProfile
                avatarUrl={shouldDisplayProfilePhoto ? profileData?.image : undefined}
                initials={initials || "ST"}
                onProfileClick={() => selectTab("profile")}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </SidebarFooter>

        {/* Floating popover beside the compact rail */}
        <AnimatePresence>
          {activeRailGroup && (
            <motion.div
              ref={flyoutRef}
              initial={{ opacity: 0, scale: 0.95, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-[76px] top-12 z-50 w-56 rounded-2xl border border-sidebar-border bg-popover p-2 text-popover-foreground shadow-2xl"
            >
              {activeRailGroup === "account" ? (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/ border-b border-sidebar-border pb-1.5 mb-1.5">
                    Account
                  </div>
                  <div className="space-y-1">
                    {/* My Info */}
                    {groups.find(g => g.id === "account")?.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          setActiveRailGroup(null);
                        }}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                          item.isActive
                            ? sidebarActiveStyles
                            : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/"}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}

                    {/* Theme */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground`}
                      >
                        <Wrench className="h-4 w-4 shrink-0 text-sidebar-foreground/ group-hover:text-sidebar-foreground" />
                        <span className="truncate flex-1 text-left">Theme</span>
                        <motion.div
                          animate={{ rotate: isThemeExpanded ? 90 : 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <ChevronRight className="h-3 w-3 text-sidebar-foreground/" />
                        </motion.div>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: isThemeExpanded ? "auto" : 0, opacity: isThemeExpanded ? 1 : 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pl-6 space-y-1 py-1">
                          <button
                            onClick={() => handleThemeChange("light")}
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}>
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-info font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}>
                              {theme === "dark" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "dark" ? "text-info font-medium" : ""}>Dark</span>
                          </button>
                        </div>
                      </motion.div>
                    </div>

                    {/* API Server */}
                    <div className="space-y-0.5">
                      <div className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground">
                        <Server className="h-4 w-4 shrink-0 text-sidebar-foreground/ group-hover:text-sidebar-foreground" />
                        <span className="truncate flex-1 text-left">API Server</span>
                        <OptionPicker 
                          value={activeApi} 
                          onChange={onApiChange}
                          options={[
                            { value: primaryApiUrl, label: "Primary" },
                            { value: backupApiUrl, label: "Backup" }
                          ]}
                          className="w-[110px]"
                        />
                      </div>
                    </div>

                    {/* Log out */}
                    <button
                      onClick={() => {
                        handleLogOutRequest();
                        setActiveRailGroup(null);
                      }}
                      className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground mt-1.5 border-t border-sidebar-border pt-1.5"
                    >
                      <Lock className="h-4 w-4 shrink-0 text-sidebar-foreground/" />
                      <span className="truncate">Log out</span>
                    </button>
                  </div>
                </div>
              ) : activeRailGroup === "academics" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("study")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors border-b border-sidebar-border pb-1.5 mb-1.5 w-full text-left"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back to Study</span>
                  </button>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: "none" }}>
                    {academicsItems.map((item, index) => {
                      const showDivider = index === 6;
                      return (
                        <div key={item.id}>
                          {showDivider && (
                            <div className="my-1.5 border-t border-sidebar-border" />
                          )}
                          <button
                            onClick={() => {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }}
                            className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                              item.isActive
                                ? sidebarActiveStyles
                                : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            }`}
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeRailGroup === "hostel-sub" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("campus")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors border-b border-sidebar-border pb-1.5 mb-1.5 w-full text-left"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back to Campus</span>
                  </button>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: "none" }}>
                    {hostelSubItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          setActiveRailGroup(null);
                        }}
                        className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                          item.isActive
                            ? sidebarActiveStyles
                            : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/ border-b border-sidebar-border pb-1.5 mb-1.5">
                    {activeRailGroup === "study" && "Study"}
                    {activeRailGroup === "campus" && "Campus"}
                    {activeRailGroup === "tools" && "Tools"}
                  </div>
                  <div className="space-y-1">
                    {groups.find(g => g.id === activeRailGroup)?.items.map((item) => {
                      const activeStyles = railActiveStyles;
                      const inactiveStyles = "border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-1";
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.id === "academics") {
                              setActiveRailGroup("academics");
                            } else if (item.id === "hostel") {
                              setActiveRailGroup("hostel-sub");
                            } else {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }
                          }}
                          className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 ${navButtonBase} ${
                            item.isActive ? activeStyles : inactiveStyles
                          }`}
                        >
                          <item.icon className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${item.isActive ? "text-info scale-110" : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"}`} />
                          <span className="truncate transition-transform duration-300">{item.label}</span>
                          {item.isExpandable && (
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-sidebar-foreground/" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Sidebar>
    </>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\about-section.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface AboutSectionProps {
export function AboutSection({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { cn } from "../../lib/utils";

export interface AboutSectionProps {
  wordmarkLightSrc?: string;
  wordmarkDarkSrc?: string;
  tagline?: string;
  className?: string;
  version?: string;
  buildNumber?: string;
  lastUpdated?: string;
  platform?: string;
  credits?: string;
}

export function AboutSection({
  wordmarkLightSrc,
  wordmarkDarkSrc,
  tagline,
  className,
  version,
  buildNumber,
  lastUpdated,
  platform,
  credits = "MADE WITH ❤️ BY AMAZE CONTINUITY PROJECTS",
}: AboutSectionProps) {
  const showWordmark = wordmarkLightSrc || wordmarkDarkSrc;
  const hasInfoGrid = version || buildNumber || lastUpdated || platform;

  return (
    <div
      className={cn(
        "bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 p-6 flex flex-col items-center text-center space-y-4",
        className
      )}
    >
      {(showWordmark || tagline) && (
        <div className="space-y-3.5 pt-1.5">
          {wordmarkLightSrc && (
            <img
              src={wordmarkLightSrc}
              alt=""
              className="h-6 object-contain mx-auto block dark:hidden"
            />
          )}
          {wordmarkDarkSrc && (
            <img
              src={wordmarkDarkSrc}
              alt=""
              className="h-6 object-contain mx-auto hidden dark:block"
            />
          )}
          {tagline && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{tagline}</p>
          )}
        </div>
      )}

      {hasInfoGrid && (
        <div className="w-full max-w-xs grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-left pt-2 border-t border-gray-150 dark:border-gray-800/60 mt-2">
          {version && (
            <div>
              <span className="text-gray-400 font-medium block">Version</span>
              <span className="font-bold text-gray-850 dark:text-gray-200">{version}</span>
            </div>
          )}
          {buildNumber && (
            <div>
              <span className="text-gray-400 font-medium block">Build Number</span>
              <span className="font-bold text-gray-850 dark:text-gray-200">{buildNumber}</span>
            </div>
          )}
          {lastUpdated && (
            <div>
              <span className="text-gray-400 font-medium block">Last Updated</span>
              <span className="font-bold text-gray-850 dark:text-gray-200">{lastUpdated}</span>
            </div>
          )}
          {platform && (
            <div>
              <span className="text-gray-400 font-medium block">Platform</span>
              <span className="font-bold text-gray-850 dark:text-gray-200">{platform}</span>
            </div>
          )}
        </div>
      )}

      {credits && (
        <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase pt-2 border-t border-gray-150 dark:border-gray-850/60 w-full">
          {credits}
        </p>
      )}
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\alert.tsx`

### Imports
```typescript
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface AlertProps extends ViewProps {
export { Alert }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps } from "react-native"
import { cn } from "../../lib/utils"

const variantStyles = {
  default: "bg-muted border-border text-muted-foreground",
  success: "bg-success-surface/50 border-success/30 text-success-foreground",
  error: "bg-danger-surface/50 border-danger/30 text-danger",
  warning: "bg-warning-surface/50 border-warning/30 text-warning-foreground",
  info: "bg-info-surface/50 border-info/30 text-info-foreground",
}

export interface AlertProps extends ViewProps {
  variant?: keyof typeof variantStyles
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

const Alert = React.forwardRef<React.ElementRef<typeof View>, AlertProps>(
  ({ className, variant = "default", icon, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "flex flex-row items-start gap-3 p-4 rounded-xl border",
        variantStyles[variant],
        className
      ) } as any)}
      {...props}
    >
      {icon && (
        <View className="shrink-0 mt-0.5">{icon}</View>
      )}
      <Text className="flex-1 text-sm font-medium">{children}</Text>
    </View>
  )
)
Alert.displayName = "Alert"

export { Alert }

```
</details>

---

## File: `AmazeUI\src\components\ui\app-library.tsx`

### Imports
```typescript
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { View } from "../../lib/primitives";
```

### Exports
```typescript
export interface AppLibraryProps {
export function AppLibrary({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { View } from "../../lib/primitives";

export interface AppLibraryProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  children?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

export function AppLibrary({
  open,
  onClose,
  title,
  subtitle,
  showBack,
  onBack,
  searchQuery,
  onSearchChange,
  children,
  headerRight,
  className,
}: AppLibraryProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-xs md:hidden"
            style={{ willChange: "opacity" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[60] flex max-h-[86vh] flex-col overflow-hidden bg-gray-50/98 backdrop-blur-xl md:hidden dark:bg-black/98 rounded-t-[2rem] border-t border-gray-200/50 dark:border-neutral-900/60 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)]",
              className,
            )}
            style={{ willChange: "transform", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex w-full shrink-0 justify-center pt-3 pb-1">
              <div className="h-1 w-12 rounded-full bg-gray-300 dark:bg-neutral-800" />
            </div>

            <div className="shrink-0 border-b border-gray-200/50 px-5 pb-4 pt-5 dark:border-gray-800/50">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {showBack && (
                      <button
                        onClick={onBack}
                        className="-ml-1 flex items-center gap-1 rounded-lg p-1 text-xs font-bold text-info hover:bg-gray-200 dark:hover:bg-slate-800"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                      </button>
                    )}
                    <h2 className="truncate text-xl font-black tracking-tight text-gray-900 dark:text-white">
                      {title}
                    </h2>
                  </div>
                  {subtitle && (
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {subtitle}
                    </p>
                  )}
                </div>
                {headerRight}
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-full border border-gray-200/30 bg-gray-100 p-2.5 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {onSearchChange && (
              <div className="shrink-0 border-b border-gray-200/20 px-5 py-3 dark:border-gray-800/20">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200/50 bg-white px-3 py-2.5 dark:border-gray-800/80 dark:bg-gray-900">
                  <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery || ""}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => onSearchChange("")}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 pb-36">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\back-button.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { Pressable } from "../../lib/primitives";
```

### Exports
```typescript
export interface BackButtonProps {
export function BackButton({ onClick, className }: BackButtonProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { cn } from "../../lib/utils";
import { Pressable } from "../../lib/primitives";

export interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

export function BackButton({ onClick, className }: BackButtonProps) {
  return (
    <Pressable
      onPress={onClick}
      className={cn(
        "p-2 rounded-full bg-white dark:bg-gray-900",
        "shadow-sm border border-gray-200 dark:border-gray-800",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        "transition-all duration-200",
        className
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-400">
        <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
      </svg>
    </Pressable>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\badge.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface BadgeProps {
export function Badge({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
}

const variants = {
  default: "bg-surface-secondary text-text-primary",
  success: "bg-success-surface text-success-foreground",
  warning: "bg-warning-surface text-warning-foreground",
  danger: "bg-danger-surface text-danger-foreground",
  info: "bg-info-surface text-info-foreground",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  className,
  variant = "default",
  size = "sm",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\breadcrumbs.tsx`

### Imports
```typescript
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface BreadcrumbItem {
export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
export { Breadcrumbs }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react"
import { cn } from "../../lib/utils"

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, className, ...props }, ref) => (
    <nav 
      ref={ref}
      className={cn("flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2", className)}
      {...props}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.href ? (
            <a href={item.href} className={cn("hover:text-accent transition-colors", item.active && "text-accent")}>
              {item.label}
            </a>
          ) : (
            <span className={item.active ? 'text-accent' : ''}>
              {item.label}
            </span>
          )}
          {idx < items.length - 1 && <span className="opacity-40">/</span>}
        </React.Fragment>
      ))}
    </nav>
  )
)
Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }

```
</details>

---

## File: `AmazeUI\src\components\ui\button.tsx`

### Imports
```typescript
import { Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import {   type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Slot } from "../../lib/slot"
```

### Exports
```typescript
export interface ButtonProps
export { Button, buttonVariants }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import {   type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Slot } from "../../lib/slot"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-danger text-white hover:bg-danger/90",
        danger: "bg-danger text-white hover:bg-danger/90",
        success: "bg-emerald-500 text-white hover:bg-emerald-500/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"},
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10"}},
    defaultVariants: {
      variant: "default",
      size: "default"}}
)

export interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
  onClick?: (event: any) => void;
  type?: "button" | "submit" | "reset";
  asChild?: boolean;
  form?: string;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, children, textClassName, onClick, onPress, asChild, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    if (asChild) {
      return (
        <Slot className={classes} onClick={onPress || onClick} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <Pressable onPress={onPress || onClick}
        ref={ref}
        {...({ className: classes } as any)}
        {...props}
      >
        {React.Children.map(children, (child) => 
          typeof child === 'string' || typeof child === 'number' ? (
            <Text {...({ className: cn("font-medium", textClassName) } as any)}>{child}</Text>
          ) : (
            child
          )
        )}
      </Pressable>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }


```
</details>

---

## File: `AmazeUI\src\components\ui\card.tsx`

### Imports
```typescript
import * as React from "react";
import { View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface CardProps {
export function Card({
export function CardHeader({ className, action, children, ...props }: { className?: string; action?: React.ReactNode; children?: React.ReactNode; [key: string]: any }) {
export function CardTitle({ className, ...props }: { className?: string; [key: string]: any }) {
export function CardDescription({ className, ...props }: { className?: string; [key: string]: any }) {
export function CardContent({ className, ...props }: { className?: string; [key: string]: any }) {
export function CardFooter({ className, ...props }: { className?: string; [key: string]: any }) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  variant?: "default" | "glass" | "gradient" | "outline";
  gradient?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function Card({
  children,
  className,
  onClick,
  hover = false,
  variant = "default",
  gradient,
  title,
  subtitle,
  action,
}: CardProps) {
  const base = "rounded-2xl transition-all duration-300";

  const variants = {
    default: "bg-white text-gray-900 border border-gray-200 shadow-sm dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800",
    glass: "bg-white/70 backdrop-blur-xl border border-gray-200 dark:bg-gray-950/40 dark:border-gray-800",
    gradient: gradient
      ? `border-none text-white shadow-md ${gradient}`
      : "bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow-md",
    outline: "border border-gray-200 bg-transparent text-gray-900 dark:border-gray-800 dark:text-gray-100",
  };

  const hoverClasses = hover
    ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
    : onClick
      ? "cursor-pointer"
      : "";

  const hasHeader = title !== undefined || subtitle !== undefined || action !== undefined;

  return (
    <View
      onClick={onClick}
      className={cn(base, variants[variant], hoverClasses, onClick && "cursor-pointer", className)}
    >
      {hasHeader && (
        <CardHeader action={action}>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
      )}
      {children}
    </View>
  );
}

export function CardHeader({ className, action, children, ...props }: { className?: string; action?: React.ReactNode; children?: React.ReactNode; [key: string]: any }) {
  if (action) {
    return (
      <View className={cn("flex items-start justify-between gap-4 p-6", className)} {...props}>
        <View className="flex flex-col space-y-1.5 flex-1 min-w-0">{children}</View>
        <View className="shrink-0">{action}</View>
      </View>
    );
  }
  return <View className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>{children}</View>;
}

export function CardTitle({ className, ...props }: { className?: string; [key: string]: any }) {
  return <Text className={cn("font-semibold text-lg leading-none tracking-tight text-gray-900 dark:text-gray-100", className)} {...props} />;
}

export function CardDescription({ className, ...props }: { className?: string; [key: string]: any }) {
  return <Text className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />;
}

export function CardContent({ className, ...props }: { className?: string; [key: string]: any }) {
  return <View className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: { className?: string; [key: string]: any }) {
  return <View className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

```
</details>

---

## File: `AmazeUI\src\components\ui\checkbox.tsx`

### Imports
```typescript
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export { Checkbox }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "../../lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

```
</details>

---

## File: `AmazeUI\src\components\ui\circular-progress.tsx`

### Imports
```typescript
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
```

### Exports
```typescript
export interface CircularProgressProps {
export function CircularProgress({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export interface CircularProgressProps {
  value: number;
  text?: string;
  size?: number;
  strokeWidth?: number;
  threshold?: number;
  midThreshold?: number;
  className?: string;
}

const defaultThreshold = 75;
const defaultMidThreshold = 85;

export function CircularProgress({
  value,
  text,
  size = 80,
  strokeWidth = 8,
  threshold = defaultThreshold,
  midThreshold = defaultMidThreshold,
  className,
}: CircularProgressProps) {
  const pathColor =
    value < threshold ? "#EF4444" : value < midThreshold ? "#FACC15" : "#10B981";

  return (
    <div className={className} style={{ width: size, height: size }}>
      <CircularProgressbar
        value={value}
        text={text ?? `${value}%`}
        strokeWidth={strokeWidth}
        styles={buildStyles({
          pathColor,
          textColor: "currentColor",
          trailColor: "rgba(163, 198, 240, 0.2)",
          strokeLinecap: "round",
          pathTransitionDuration: 0.5,
        })}
      />
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\color-palette-picker.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"
import { PALETTE_OPTIONS, type ColorPaletteOption, useColorPalette } from "../../hooks/use-color-palette"
```

### Exports
```typescript
export interface ColorPalettePickerProps {
export { ColorPalettePicker }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"
import { PALETTE_OPTIONS, type ColorPaletteOption, useColorPalette } from "../../hooks/use-color-palette"

export interface ColorPalettePickerProps {
  className?: string;
}

const ColorPalettePicker = React.forwardRef<React.ElementRef<typeof View>, ColorPalettePickerProps>(
  ({ className }, ref) => {
    const { paletteId, setPaletteId } = useColorPalette();

    return (
      <View
        ref={ref}
        {...({ className: cn("flex flex-row flex-wrap gap-2", className) } as any)}
      >
        {PALETTE_OPTIONS.map((p) => {
          const active = paletteId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPaletteId(p.id)}
              {...({ className: cn(
                "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all",
                active
                  ? "border-foreground/30 bg-muted shadow-sm"
                  : "border-transparent hover:bg-muted/50"
              ) } as any)}
            >
              <View className="flex flex-row gap-0.5">
                {p.swatches.map((swatch, i) => (
                  <View
                    key={i}
                    {...({ className: cn(
                      "w-5 h-5 rounded-full border border-border/50",
                      i === 0 && "shadow-sm"
                    ) } as any)}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </View>
              <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {p.label}
              </Text>
              {active && (
                <View className="absolute -top-1 -right-1 w-4 h-4 bg-info rounded-full flex flex-row items-center justify-center shadow-sm">
                  <svg viewBox="0 0 16 16" fill="none" className="w-2.5 h-2.5 text-white">
                    <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }
)
ColorPalettePicker.displayName = "ColorPalettePicker"

export { ColorPalettePicker }

```
</details>

---

## File: `AmazeUI\src\components\ui\command-palette.tsx`

### Imports
```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface CommandPaletteItem {
export interface CommandPaletteProps {
export function CommandPalette({ isOpen, onClose, commands, onQueryChange, storageKeyPrefix = "" }: CommandPaletteProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "../../lib/utils";

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  onSelect: () => void;
  rightSlot?: React.ReactNode;
  detail?: React.ReactNode;
  subpage?: React.ReactNode;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandPaletteItem[];
  onQueryChange?: (query: string) => void;
  storageKeyPrefix?: string;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
}
function ArrowRightIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
}
function CommandIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" /></svg>;
}
function ArrowLeftIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>;
}
function XIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
}
function ClockIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function SlidersIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
}
function CalculatorIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10.01" /><line x1="12" y1="10" x2="12" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="8" y1="18" x2="8" y2="18.01" /><line x1="12" y1="18" x2="12" y2="18.01" /></svg>;
}
function HistoryIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>;
}
function TrashIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
}
function HashIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>;
}
function LightbulbIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></svg>;
}
function SparklesIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3v4" /><path d="M18 12h4" /><path d="M6 12H2" /><path d="M5.64 5.64 8.5 8.5" /><path d="M18.36 5.64 15.5 8.5" /><path d="M5.64 18.36 7.5 16.5" /><path d="M18.36 18.36 16.5 16.5" /><path d="M12 21v-4" /><path d="M8 12h8" /></svg>;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lower.length && qi < q.length; ti++) {
    if (lower[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreCommand(cmd: CommandPaletteItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = cmd.label.toLowerCase();
  const description = (cmd.description || "").toLowerCase();
  const category = (cmd.category || "").toLowerCase();
  const haystack = `${label} ${description} ${category}`;
  if (label === q) return 100;
  if (label.startsWith(q)) return 90;
  if (label.includes(q)) return 75;
  if (description.includes(q)) return 55;
  if (category.includes(q)) return 45;
  if (fuzzyMatch(haystack, q)) return 25;
  return 0;
}

const categoryGradients: Record<string, string> = {
  Navigation: "from-blue-500 to-purple-500",
  Academics: "from-emerald-500 to-teal-500",
  Attendance: "from-amber-500 to-orange-500",
  Profile: "from-violet-500 to-purple-500",
  Hostel: "from-rose-500 to-pink-500",
  "Day Scholar": "from-sky-500 to-cyan-500",
  Settings: "from-gray-500 to-slate-500",
  Tools: "from-indigo-500 to-blue-500",
  Events: "from-fuchsia-500 to-pink-500",
  "Exam Schedule": "from-red-500 to-rose-500",
  "Academic Calendar": "from-teal-500 to-emerald-500",
};

export function CommandPalette({ isOpen, onClose, commands, onQueryChange, storageKeyPrefix = "" }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subpage, setSubpage] = useState<React.ReactNode | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [selectionSource, setSelectionSource] = useState<"keyboard" | "pointer">("keyboard");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onQueryChangeRef = useRef(onQueryChange);
  const mousePos = useRef({ x: 0, y: 0 });
  onQueryChangeRef.current = onQueryChange;

  const RECENT_KEY = `${storageKeyPrefix}recent_commands`;
  const HISTORY_KEY = `${storageKeyPrefix}search_history`;
  const MAX_RECENT = 6;
  const MAX_HISTORY = 8;

  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const saveToHistory = useCallback((q: string) => {
    if (!q.trim() || q.startsWith("=") || q.startsWith("@")) return;
    setSearchHistory(prev => {
      const next = [q.trim(), ...prev.filter(item => item !== q.trim())].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [HISTORY_KEY]);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  }, [HISTORY_KEY]);

  const calculatorResult = useMemo(() => {
    if (!query.startsWith("=")) return null;
    const expr = query.slice(1).trim();
    if (!expr) return null;
    try {
      const sanitized = expr.replace(/[^0-9+\-*/.()%\s]/g, "");
      if (!sanitized) return null;
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== "number" || !isFinite(result)) return null;
      return { expr, result };
    } catch { return null; }
  }, [query]);

  const smartTips = useMemo(() => {
    if (query) return [];
    return [
      { id: "tip-calc", icon: <CalculatorIcon className="w-3.5 h-3.5" />, text: "Type = to calculate (e.g. =2+2*3)", category: "Quick Actions" },
      { id: "tip-today", icon: <HashIcon className="w-3.5 h-3.5" />, text: "Type @today for today's overview", category: "Quick Actions" },
    ];
  }, [query]);

  const categories = useMemo(() => {
    const cmdCats = Array.from(new Set(commands.map(cmd => cmd.category || "General")));
    return ["All", "Recent", ...cmdCats].filter((cat, i, all) => {
      if (cat === "Recent") return recentCommandIds.length > 0;
      return all.indexOf(cat) === i;
    });
  }, [commands, recentCommandIds.length]);

  const recentCommands = useMemo(() => {
    const byId = new Map(commands.map(cmd => [cmd.id, cmd]));
    return recentCommandIds.map(id => byId.get(id)).filter(Boolean).map(cmd => ({
      ...cmd!,
      id: `recent-${cmd!.id}`,
      category: "Recent",
    }));
  }, [commands, recentCommandIds]);

  const results = useMemo(() => {
    const q = query.trim();
    const base = !q && activeCategory === "All"
      ? [...recentCommands, ...commands.filter(cmd => !recentCommandIds.includes(cmd.id))]
      : activeCategory === "Recent" ? recentCommands : commands;
    const filtered = activeCategory === "All" || activeCategory === "Recent"
      ? base : base.filter(cmd => (cmd.category || "General") === activeCategory);
    if (!q) return filtered;
    return filtered.map(cmd => ({ cmd, score: scoreCommand(cmd, q) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.cmd.label.localeCompare(b.cmd.label))
      .map(item => item.cmd);
  }, [query, activeCategory, commands, recentCommands, recentCommandIds]);

  const safeIndex = Math.min(selectedIndex, results.length - 1);
  const hasDetail = results[safeIndex]?.detail;

  useEffect(() => {
    if (isOpen) {
      setQuery(""); setSelectedIndex(0); setSubpage(null); setActiveCategory("All"); setSelectionSource("keyboard");
      try { setRecentCommandIds(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch { setRecentCommandIds([]); }
      try { setSearchHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch { setSearchHistory([]); }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, RECENT_KEY, HISTORY_KEY]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => { setSelectedIndex(0); setSelectionSource("keyboard"); }, [query, activeCategory, commands]);
  useEffect(() => { onQueryChangeRef.current?.(query); }, [query]);

  const goBack = useCallback(() => { setSubpage(null); setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const rememberCommand = useCallback((cmd: CommandPaletteItem) => {
    const id = cmd.id.startsWith("recent-") ? cmd.id.slice(7) : cmd.id;
    setRecentCommandIds(prev => {
      const next = [id, ...prev.filter(i => i !== id)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [RECENT_KEY]);

  const executeCommand = useCallback((cmd: CommandPaletteItem) => {
    rememberCommand(cmd);
    saveToHistory(query);
    cmd.onSelect();
  }, [rememberCommand, saveToHistory, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (subpage) { if (e.key === "Escape") { e.preventDefault(); goBack(); } return; }
    const len = results.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (!len) return; setSelectionSource("keyboard"); setSelectedIndex(p => (p + 1) % len); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (!len) return; setSelectionSource("keyboard"); setSelectedIndex(p => (p - 1 + len) % len); }
    else if (e.key === "Enter" && results[safeIndex]) {
      e.preventDefault(); const cmd = results[safeIndex];
      if (cmd.subpage) setSubpage(cmd.subpage); else { executeCommand(cmd); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  }, [executeCommand, results, safeIndex, onClose, subpage, goBack]);

  useEffect(() => {
    if (selectionSource !== "keyboard" || safeIndex < 0) return;
    const cmd = results[safeIndex];
    const el = cmd ? itemRefs.current[cmd.id] : null;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, results, selectionSource]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !subpage) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, subpage]);

  const handleItemClick = useCallback((cmd: CommandPaletteItem) => {
    if (cmd.subpage) { rememberCommand(cmd); setSubpage(cmd.subpage); }
    else { executeCommand(cmd); onClose(); }
  }, [executeCommand, onClose, rememberCommand]);

  const grouped = useMemo(() => results.reduce<Record<string, CommandPaletteItem[]>>((acc, cmd) => {
    const cat = cmd.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {}), [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 md:items-start md:px-4 md:pt-[10vh]" onClick={subpage ? undefined : onClose}>
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="relative flex h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full animate-scale-in overflow-hidden rounded-t-3xl border border-white/20 shadow-2xl shadow-black/20 md:h-auto md:max-h-[78vh] md:max-w-3xl md:rounded-2xl dark:border-white/5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-purple-500/20 blur-[100px] pointer-events-none" />
        <div className="relative flex min-h-0 w-full flex-col bg-white/95 dark:bg-gray-950/95">
          {subpage ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-gray-200/60 px-4 py-3 dark:border-gray-800/30">
                <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-900 dark:text-gray-400 transition-colors"><ArrowLeftIcon className="w-4 h-4" /></button>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{results.find(c => c.subpage === subpage)?.label || "Search"}</p>
                <div className="flex-1" />
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-900 dark:text-gray-400 transition-colors"><XIcon className="w-4 h-4" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{subpage}</div>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-gray-200/60 px-4 py-4 dark:border-gray-800/30 md:px-5">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400">
                    <SearchIcon />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search commands..."
                    className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder-gray-400 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200" aria-label="Clear search">
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                    <CommandIcon className="w-3 h-3" />K
                  </kbd>
                  <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200" aria-label="Close search">
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                        activeCategory === category
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:text-gray-200"
                      )}
                    >
                      {category === "Recent" ? <ClockIcon className="h-3.5 w-3.5" /> : category === "All" ? <SlidersIcon className="h-3.5 w-3.5" /> : null}
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scroll-smooth md:max-h-[22rem]">
                {calculatorResult && (
                  <div className="mx-1 mb-2 flex items-center gap-3 rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 px-4 py-3 dark:border-blue-800/30 dark:from-blue-950/30 dark:to-indigo-950/20">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-900">
                      <CalculatorIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{calculatorResult.expr} <span className="text-blue-600 dark:text-blue-400">=</span></p>
                    </div>
                    <span className="shrink-0 text-lg font-black tabular-nums text-blue-700 dark:text-blue-300">{calculatorResult.result}</span>
                  </div>
                )}

                {results.length === 0 && !query && searchHistory.length === 0 && smartTips.length > 0 ? (
                  <div className="space-y-1 px-3 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <LightbulbIcon className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pro Tips</p>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 to-transparent dark:from-gray-800/30" />
                    </div>
                    {smartTips.map(tip => (
                      <div key={tip.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-default">
                        <span className="text-gray-400 dark:text-gray-500">{tip.icon}</span>
                        <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{tip.text}</span>
                      </div>
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-900 mb-3">
                      <SparklesIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No results found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      {Object.keys(grouped).length > 1 && (
                        <div className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 px-3 pb-1.5 pt-3 backdrop-blur dark:bg-gray-950/95">
                          <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${categoryGradients[category] || "from-gray-400 to-gray-500"}`} />
                          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{category}</p>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 to-transparent dark:from-gray-800/30" />
                        </div>
                      )}
                      {items.map((cmd) => {
                        const globalIdx = results.indexOf(cmd);
                        return (
                          <button
                            key={cmd.id}
                            ref={(node) => { itemRefs.current[cmd.id] = node; }}
                            onClick={() => handleItemClick(cmd)}
                            onPointerEnter={(event) => {
                              if (event.pointerType === "touch") return;
                              setSelectionSource("pointer");
                              setSelectedIndex(globalIdx);
                            }}
                            className={cn(
                              "flex w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 md:py-2.5",
                              globalIdx === safeIndex
                                ? "bg-blue-50 text-gray-900 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-gray-100 dark:ring-blue-900/40"
                                : "text-gray-700 hover:bg-gray-50/80 dark:text-gray-300 dark:hover:bg-gray-800/40"
                            )}
                          >
                            {cmd.icon && (
                              <span className={cn(
                                "shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm transition-all",
                                globalIdx === safeIndex
                                  ? "bg-white dark:bg-gray-900 shadow-sm ring-1 ring-black/5"
                                  : "bg-gray-100/80 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400"
                              )}>
                                {cmd.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-semibold truncate leading-tight", globalIdx === safeIndex ? "text-gray-900 dark:text-gray-100" : "text-gray-800 dark:text-gray-200")}>{cmd.label}</p>
                              {cmd.description && !cmd.rightSlot && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{cmd.description}</p>
                              )}
                            </div>
                            {cmd.rightSlot ? (
                              <div className="shrink-0">{cmd.rightSlot}</div>
                            ) : cmd.description ? (
                              <p className="hidden md:block text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[180px] mr-1">{cmd.description}</p>
                            ) : null}
                            <ArrowRightIcon className={cn("w-4 h-4 shrink-0 transition-all", globalIdx === safeIndex ? "text-blue-500 dark:text-blue-400 translate-x-0.5" : "text-gray-300 dark:text-gray-600")} />
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}

                {!query && searchHistory.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 dark:border-gray-800/30 pt-2 px-1">
                    <div className="flex items-center gap-2 mb-1.5 px-2">
                      <HistoryIcon className="w-3 h-3 text-gray-400" />
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex-1">Recent Searches</p>
                      <button onClick={clearHistory} className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors">
                        <TrashIcon className="w-3 h-3" /> Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((term) => (
                        <button key={term} onClick={() => setQuery(term)}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200"
                        >
                          <ClockIcon className="w-3 h-3" />{term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hasDetail && (
                <div className="relative hidden max-h-52 shrink-0 overflow-y-auto border-t border-gray-200/60 bg-gray-50/50 p-3 md:block dark:border-gray-800/30 dark:bg-gray-950/30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-transparent" />
                  {results[safeIndex].detail}
                </div>
              )}

              <div className="hidden shrink-0 items-center justify-between border-t border-gray-200/60 px-5 py-2.5 text-[11px] text-gray-400 md:flex dark:border-gray-800/30 dark:text-gray-500">
                <span className="flex items-center gap-1"><ArrowRightIcon className="w-3 h-3" /> <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 font-semibold">Enter</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 font-semibold">\u2191\u2193</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 font-semibold">Esc</kbd> close</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\command.tsx`

### Imports
```typescript
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import {
```

### Exports
```typescript
export {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from "./dialog"

function Command({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
 return (
 <CommandPrimitive
 data-slot="command"
 className={cn(
 "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
 className
 )}
 {...props}
 />
 )
}

function CommandDialog({
 title = "Command Palette",
 description = "Search for a command to run...",
 children,
 className,
 ...props
}: React.ComponentProps<typeof Dialog> & {
 title?: string
 description?: string
 className?: string
}) {
 return (
 <Dialog {...props}>
 <DialogHeader className="sr-only">
 <DialogTitle>{title}</DialogTitle>
 <DialogDescription>{description}</DialogDescription>
 </DialogHeader>
 <DialogContent
 className={cn("overflow-hidden p-0", className)}
 >
 <Command className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
 {children}
 </Command>
 </DialogContent>
 </Dialog>
 )
}

function CommandInput({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
 return (
 <div
 data-slot="command-input-wrapper"
 className="flex h-9 items-center gap-2 border-b px-3"
 >
 <SearchIcon className="size-4 shrink-0 opacity-50" />
 <CommandPrimitive.Input
 data-slot="command-input"
 className={cn(
 "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 {...props}
 />
 </div>
 )
}

function CommandList({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
 return (
 <CommandPrimitive.List
 data-slot="command-list"
 className={cn(
 "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
 className
 )}
 {...props}
 />
 )
}

function CommandEmpty({
 ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
 return (
 <CommandPrimitive.Empty
 data-slot="command-empty"
 className="py-6 text-center text-sm"
 {...props}
 />
 )
}

function CommandGroup({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
 return (
 <CommandPrimitive.Group
 data-slot="command-group"
 className={cn(
 "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
 className
 )}
 {...props}
 />
 )
}

function CommandSeparator({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
 return (
 <CommandPrimitive.Separator
 data-slot="command-separator"
 className={cn("bg-border -mx-1 h-px", className)}
 {...props}
 />
 )
}

function CommandItem({
 className,
 ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
 return (
 <CommandPrimitive.Item
 data-slot="command-item"
 className={cn(
 "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
 className
 )}
 {...props}
 />
 )
}

function CommandShortcut({
 className,
 ...props
}: React.ComponentProps<"span">) {
 return (
 <span
 data-slot="command-shortcut"
 className={cn(
 "text-muted-foreground ml-auto text-xs tracking-widest",
 className
 )}
 {...props}
 />
 )
}

export {
 Command,
 CommandDialog,
 CommandInput,
 CommandList,
 CommandEmpty,
 CommandGroup,
 CommandItem,
 CommandShortcut,
 CommandSeparator,
}

```
</details>

---

## File: `AmazeUI\src\components\ui\course-list-table.tsx`

### Imports
```typescript
import React from 'react';
import { cn } from '../../lib/utils';
```

### Exports
```typescript
export interface CourseListItem {
export interface CourseListTableProps {
export function CourseListTable({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import React from 'react';
import { cn } from '../../lib/utils';

export interface CourseListItem {
  id: string;
  code: string;
  title: string;
  slots: string[];
  faculty: string;
  venue: string;
  credits: string;
  type: string;
  color: string;
  batch?: string;
}

export interface CourseListTableProps {
  courses: CourseListItem[];
  renderTypeChips?: (type: string | string[], size?: 'sm' | 'md' | 'default') => React.ReactNode;
  getBatchBadgeClass?: (batch: string) => string;
  title?: string;
  className?: string;
}

export function CourseListTable({
  courses,
  renderTypeChips,
  getBatchBadgeClass = () => 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  title = 'Course List',
  className,
}: CourseListTableProps) {
  if (!courses || courses.length === 0) return null;

  return (
    <div className={cn('bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm flex flex-col', className)}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100/30 dark:bg-gray-900/30 rounded-t-xl">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div>
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Course</th>
              <th className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Faculty</th>
              <th className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Slots</th>
              <th className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Venue</th>
              <th className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {courses.map((c) => (
              <tr key={c.id} className="hover:bg-gray-100/10 dark:hover:bg-gray-900/10 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-3 h-3 rounded-full shrink-0', c.color)} />
                    <div>
                      <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {c.code}
                        {c.batch && c.batch.split(',').map(b => b.trim()).filter(Boolean).map(b => (
                          <span key={b} className={cn('text-xs font-bold px-2 py-0.5 rounded-md border', getBatchBadgeClass(b))}>
                            {b}
                          </span>
                        ))}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs max-w-xs">{c.title}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-sm text-gray-900/80 dark:text-gray-100/80">
                  {renderTypeChips ? renderTypeChips(c.type) : c.type}
                </td>
                <td className="py-3 px-2 text-sm text-gray-900/80 dark:text-gray-100/80">{c.faculty}</td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-1">
                    {c.slots.map(s => (
                      <span key={s} className="bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[10px] px-1.5 py-0.5 rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-2 text-sm text-gray-900/80 dark:text-gray-100/80 max-w-xs">{c.venue}</td>
                <td className="py-3 px-2 text-sm text-gray-900/80 dark:text-gray-100/80">{c.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\data-table.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface DataTableColumn {
export interface DataTableProps {
export function DataTable({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";

export interface DataTableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: Record<string, any>[];
  caption?: string;
  className?: string;
  emptyMessage?: string;
}

export function DataTable({
  columns,
  data,
  caption,
  className,
  emptyMessage = "No data available",
}: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950", className)}>
        <div className="p-5">
          {caption && (
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              {caption}
            </h4>
          )}
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950", className)}>
      <div className="p-5">
        {caption && (
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {caption}
          </h4>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap",
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "py-2.5 px-2 text-gray-800 dark:text-gray-200",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] ?? "\u2014"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\dialog.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,    type ModalProps, type ViewProps, type TextProps } from "react-native-web"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface DialogProps extends ModalProps {
export {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,    type ModalProps, type ViewProps, type TextProps } from "react-native-web"
import { cn } from "../../lib/utils"

export interface DialogProps extends ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
} | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("Dialog components must be used within a Dialog")
  return context
}

function Dialog({ open = false, onOpenChange, children, ...props }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(open)
  const isControlled = onOpenChange !== undefined
  
  const currentOpen = isControlled ? open : isOpen
  const setCurrentOpen = React.useCallback((val: boolean) => {
    if (!isControlled) setIsOpen(val)
    onOpenChange?.(val)
  }, [isControlled, onOpenChange])

  return (
    <DialogContext.Provider value={{ open: currentOpen, onOpenChange: setCurrentOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<React.ElementRef<typeof Pressable>, React.ComponentProps<typeof Pressable>>(
  ({ onPress, children, ...props }, ref) => {
    const { onOpenChange } = useDialog()
    return (
      <Pressable ref={ref} onPress={(e) => { onOpenChange(true); onPress?.(e); (props as any).onClick?.(e) }} {...props}>
        {children}
      </Pressable>
    )
  }
)
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialog()

    return (
      <Modal
        visible={open}
        transparent={true}
        animationType="fade"
        onRequestClose={() => onOpenChange(false)}
      >
        <View {...({ className: "flex-1 items-center justify-center bg-black/80" } as any)}>
          <View
            ref={ref}
            {...({ className: cn("w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg sm:rounded-[1rem]", className) } as any)}
            {...props}
          >
            {children}
          </View>
        </View>
      </Modal>
    )
  }
)
DialogContent.displayName = "DialogContent"

const DialogHeader = ({ className, ...props }: ViewProps & { className?: string }) => (
  <View {...({ className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className) } as any)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: ViewProps & { className?: string }) => (
  <View {...({ className: cn("flex flex-row flex-wrap items-center justify-end space-x-2 mt-4", className) } as any)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<React.ElementRef<typeof Text>, TextProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} {...({ className: cn("text-lg font-semibold leading-none tracking-tight text-foreground", className) } as any)} {...props} />
  )
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<React.ElementRef<typeof Text>, TextProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} {...({ className: cn("text-sm text-muted-foreground", className) } as any)} {...props} />
  )
)
DialogDescription.displayName = "DialogDescription"

const DialogClose = React.forwardRef<React.ElementRef<typeof Pressable>, React.ComponentProps<typeof Pressable>>(
  ({ onPress, children, ...props }, ref) => {
    const { onOpenChange } = useDialog()
    return (
      <Pressable ref={ref} onPress={(e) => { onOpenChange(false); onPress?.(e); (props as any).onClick?.(e) }} {...props}>
        {children}
      </Pressable>
    )
  }
)
DialogClose.displayName = "DialogClose"

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose}


```
</details>

---

## File: `AmazeUI\src\components\ui\dropdown-menu.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,    type ViewProps, type TextProps } from "react-native-web"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface DropdownMenuProps {
export {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,    type ViewProps, type TextProps } from "react-native-web"
import { cn } from "../../lib/utils"

export interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DropdownContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null)

function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = React.useCallback((val: boolean) => {
    if (!isControlled) setInternalOpen(val)
    onOpenChange?.(val)
  }, [isControlled, onOpenChange])
  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <View {...({ className: "relative" } as any)}>
        {children}
      </View>
    </DropdownContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef<React.ElementRef<typeof Pressable>, React.ComponentProps<typeof Pressable> & { asChild?: boolean }>(
  ({ onPress, children, asChild, ...props }, ref) => {
    const context = React.useContext(DropdownContext)
    const handler = (e: any) => { context?.setOpen(!context.open); onPress?.(e); (props as any).onClick?.(e) }
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...(children.props as any),
        ...props,
        onPress: handler,
        onClick: handler,
      })
    }
    return (
      <Pressable ref={ref} onPress={handler} {...props}>
        {children}
      </Pressable>
    )
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string; align?: "start" | "end" | "center"; sideOffset?: number }>(
  ({ className, children, align, sideOffset, ...props }, ref) => {
    const context = React.useContext(DropdownContext)
    if (!context?.open) return null

    return (
      <Modal visible={context.open} transparent={true} animationType="fade" onRequestClose={() => context.setOpen(false)}>
        <Pressable 
           onPress={() => context.setOpen(false)} 
           {...({ className: "flex-1 bg-black/10 justify-end sm:justify-center items-center" } as any)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              ref={ref}
              {...({ className: cn("z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 zoom-in-95", className) } as any)}
              {...props}
            >
              {children}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof Pressable>, React.ComponentProps<typeof Pressable> & { className?: string; textClassName?: string }>(
  ({ className, textClassName, onPress, children, ...props }, ref) => {
    const context = React.useContext(DropdownContext)
    return (
      <Pressable
        ref={ref}
        onPress={(e) => { context?.setOpen(false); onPress?.(e); (props as any).onClick?.(e) }}
        {...({ className: cn("relative flex-row items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent", className) } as any)}
        {...props}
      >
        {typeof children === 'string' ? (
           <Text {...({ className: cn("text-foreground", textClassName) } as any)}>{children}</Text>
        ) : children}
      </Pressable>
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof Text>, TextProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} {...({ className: cn("px-2 py-1.5 text-sm font-semibold text-foreground", className) } as any)} {...props} />
  )
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View ref={ref} {...({ className: cn("-mx-1 my-1 h-px bg-muted", className) } as any)} {...props} />
  )
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator}


```
</details>

---

## File: `AmazeUI\src\components\ui\empty-state.tsx`

### Imports
```typescript
import * as React from "react";
import { View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface EmptyStateProps {
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <View className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && <View className="mb-4 text-gray-300 dark:text-gray-700">{icon}</View>}
      <Text className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</Text>
      {description && (
        <Text className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-xs">{description}</Text>
      )}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\error-diagnostic-card.tsx`

### Imports
```typescript
import { useEffect, useMemo, useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface ErrorDiagnosticCardProps {
export function ErrorDiagnosticCard({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { cn } from "../../lib/utils";

type RuntimeInfo = {
  href: string;
  userAgent: string;
  language: string;
  platform: string;
  online: boolean;
  referrer: string;
  timestamp: string;
};

export interface ErrorDiagnosticCardProps {
  title: string;
  description: string;
  error?: { name?: string; message?: string; digest?: string; stack?: string };
  onRetry?: () => void;
  dashboardHref?: string;
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  );
}

export function ErrorDiagnosticCard({
  title,
  description,
  error,
  onRetry,
  dashboardHref,
}: ErrorDiagnosticCardProps) {
  const [copied, setCopied] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  useEffect(() => {
    setRuntimeInfo({
      href: window.location.href,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      online: navigator.onLine,
      referrer: document.referrer || "none",
      timestamp: new Date().toISOString(),
    });
  }, []);

  const report = useMemo(() => ({
    title,
    description,
    error: {
      name: error?.name ?? "UnknownError",
      message: error?.message ?? "Unknown client-side exception",
      digest: error?.digest ?? "none",
      stack: error?.stack ?? "stack unavailable",
    },
    runtime: runtimeInfo,
  }), [description, error, runtimeInfo, title]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 text-foreground transition-colors duration-300 dark:bg-[#03060F] flex items-center justify-center py-10">
      <div className="w-full max-w-2xl animate-in fade-in duration-300">
        <Card className="w-full border-slate-200 bg-white/70 backdrop-blur-md shadow-2xl dark:border-neutral-900 dark:bg-neutral-950/40 rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full pointer-events-none" />
          
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse">
                <AlertCircleIcon className="w-10 h-10" />
                <div className="absolute inset-0 rounded-full border border-rose-500/30 animate-ping duration-2000 pointer-events-none" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">System Diagnostic</p>
            <CardTitle className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1 leading-snug">{title}</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-2 text-slate-500 dark:text-gray-400 font-medium max-w-md mx-auto leading-relaxed">{description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 md:px-8 pb-8">
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 pt-2">
              {onRetry ? (
                <Button onClick={onRetry} variant="default" className="rounded-xl font-bold text-xs py-2 min-h-[38px]">
                  Try again
                </Button>
              ) : (
                <Button onClick={() => window.location.reload()} variant="default" className="rounded-xl font-bold text-xs py-2 min-h-[38px]">
                  Reload page
                </Button>
              )}
              {onRetry && (
                <Button onClick={() => window.location.reload()} variant="secondary" className="rounded-xl font-bold text-xs py-2 min-h-[38px]">
                  Reload page
                </Button>
              )}
              {dashboardHref && (
                <a href={dashboardHref}>
                  <Button variant="outline" className="rounded-xl font-bold text-xs py-2 min-h-[38px] w-full">
                    Dashboard
                  </Button>
                </a>
              )}
              <Button onClick={copyReport} variant="outline" className={cn("rounded-xl font-bold text-xs py-2 min-h-[38px] transition-all", copied && "text-emerald-500 border-emerald-500 bg-emerald-500/5")}>
                {copied ? "Copied Report" : "Copy Report"}
              </Button>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-slate-100 dark:bg-neutral-900/50 p-1 rounded-xl">
                <TabsTrigger value="summary" className="text-xs font-bold rounded-lg px-4 py-1.5">Summary</TabsTrigger>
                <TabsTrigger value="technical" className="text-xs font-bold rounded-lg px-4 py-1.5">Technical Report</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 focus-visible:outline-none">
                <div className="grid gap-3 rounded-2xl border border-slate-200/60 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-xs font-semibold text-slate-700 dark:text-gray-300 leading-relaxed">
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Error Message</span>
                    <span className="truncate max-w-[70%] font-extrabold text-slate-900 dark:text-white">{error?.message ?? "Unknown client-side exception"}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Digest Hash</span>
                    <span className="font-mono text-[10px] text-slate-500">{error?.digest ?? "none"}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Source Route</span>
                    <span className="truncate max-w-[70%] font-mono text-[10px] text-slate-500">{runtimeInfo?.href ?? "collecting..."}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Timestamp</span>
                    <span className="font-medium">{runtimeInfo?.timestamp ? new Date(runtimeInfo.timestamp).toLocaleString() : "collecting..."}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Connection Status</span>
                    <span className={runtimeInfo?.online ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                      {runtimeInfo ? (runtimeInfo.online ? "Online" : "Offline") : "collecting..."}
                    </span>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="mt-4 focus-visible:outline-none">
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-[10px] font-mono leading-relaxed text-slate-600 dark:text-gray-400">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\error-display.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { Pressable } from "../../lib/primitives";
```

### Exports
```typescript
export interface ErrorDisplayProps {
export function ErrorDisplay({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";
import { Pressable } from "../../lib/primitives";

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}

export interface ErrorDisplayProps {
  message: string;
  variant?: "error" | "warning";
  className?: string;
  onRetry?: () => void;
}

const iconMap = {
  error: XCircleIcon,
  warning: AlertTriangleIcon,
};

const styleMap = {
  error: "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300",
  warning: "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300",
};

export function ErrorDisplay({
  message,
  variant = "error",
  className,
  onRetry,
}: ErrorDisplayProps) {
  const Icon = iconMap[variant];
  return (
    <div className={cn(styleMap[variant], "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium mb-5", className)}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="ml-auto text-sm font-medium underline hover:no-underline"
        >
          Retry
        </Pressable>
      )}
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\expandable-section.tsx`

### Imports
```typescript
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Pressable, View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface ExpandableSectionProps {
export function ExpandableSection({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Pressable, View, Text } from "../../lib/primitives";

export interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function ExpandableSection({
  title,
  children,
  defaultOpen = false,
  className,
  headerClassName,
  contentClassName,
  badge,
  icon,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View className={cn("w-full", className)}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        className={cn(
          "flex flex-row items-center justify-between w-full p-4 text-left font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors",
          headerClassName
        )}
      >
        <View className="flex flex-row items-center gap-2">
          {icon}
          <Text>{title}</Text>
        </View>
        <View className="flex flex-row items-center gap-3">
          {badge}
          {isOpen ? (
            <ChevronUpIcon className="w-[18px] h-[18px] text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-[18px] h-[18px] text-gray-400" />
          )}
        </View>
      </Pressable>
      <View
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <View className={cn("p-4 bg-gray-50/50 dark:bg-gray-900/20", contentClassName)}>
          {children}
        </View>
      </View>
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\fab.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface FabProps {
export interface FabAction {
export interface FabSpeedDialProps {
export { Fab, FabSpeedDial }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"

export interface FabProps {
  icon?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  variant?: "primary" | "secondary" | "info";
  className?: string;
  disabled?: boolean;
}

const variantStyles = {
  primary: "bg-foreground text-background hover:bg-foreground/90",
  secondary: "bg-card text-foreground border border-border hover:bg-muted",
  info: "bg-info text-info-foreground hover:bg-info/90",
};

const positionStyles = {
  "bottom-right": "right-5 bottom-5",
  "bottom-left": "left-5 bottom-5",
  "bottom-center": "left-1/2 -translate-x-1/2 bottom-5",
};

const Fab = React.forwardRef<React.ElementRef<typeof View>, FabProps>(
  ({ className, icon, label, onPress, position = "bottom-right", variant = "primary", disabled = false }, ref) => {
    return (
      <Pressable
        ref={ref as any}
        onPress={onPress}
        disabled={disabled}
        className={cn(
          "fixed z-50 flex flex-row items-center transition-all duration-200 backdrop-blur-xl shadow-xl active:scale-95",
          label
            ? `gap-2.5 pl-4 pr-5 h-12 rounded-2xl ${variantStyles[variant]}`
            : `items-center justify-center w-14 h-14 rounded-full ${variantStyles[variant]}`,
          positionStyles[position],
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        {icon && <View className="shrink-0">{icon}</View>}
        {label && <Text className="text-sm font-semibold tracking-tight">{label}</Text>}
      </Pressable>
    );
  }
)
Fab.displayName = "Fab"

export interface FabAction {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "info" | "danger";
}

export interface FabSpeedDialProps {
  icon?: React.ReactNode;
  actions: FabAction[];
  position?: "bottom-right" | "bottom-left";
  className?: string;
}

function FabSpeedDial({ icon, actions, position = "bottom-right", className }: FabSpeedDialProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <View className={cn("fixed z-50", position === "bottom-right" ? "right-5 bottom-5" : "left-5 bottom-5", className)}>
      {open && (
        <Pressable className="fixed inset-0 z-40" onPress={() => setOpen(false)} />
      )}
      <View className="relative z-50 flex flex-col items-end gap-3">
        {open && (
          <View className="flex flex-col gap-2 mb-2">
            {actions.map((action, i) => (
              <Pressable
                key={i}
                onPress={() => { action.onPress(); setOpen(false); }}
                className={cn(
                  "flex flex-row items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-xl transition-all duration-200",
                  !action.variant || action.variant === "primary"
                    ? "bg-foreground text-background"
                    : action.variant === "danger"
                    ? "bg-danger text-danger-foreground"
                    : "bg-card text-foreground border border-border"
                )}
              >
                <View className="shrink-0">{action.icon}</View>
                <Text className="text-sm font-semibold whitespace-nowrap">{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          onPress={() => setOpen(!open)}
          className="flex flex-row items-center justify-center w-14 h-14 rounded-full bg-foreground text-background shadow-xl transition-all duration-200 hover:bg-foreground/90 active:scale-95"
        >
          <View className={`transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
            {icon || (
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
FabSpeedDial.displayName = "FabSpeedDial"

export { Fab, FabSpeedDial }

```
</details>

---

## File: `AmazeUI\src\components\ui\fetch-button.tsx`

### Imports
```typescript
import * as React from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface FetchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
export const FetchButton = React.forwardRef<HTMLButtonElement, FetchButtonProps>(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { cn } from "../../lib/utils";

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("animate-spin", className)}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

export interface FetchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  variant?: "primary" | "success" | "danger" | "gradient" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

export const FetchButton = React.forwardRef<HTMLButtonElement, FetchButtonProps>(
  ({ children, onClick, loading = false, disabled = false, className, variant = "primary", size = "md", icon, type = "button", ...props }, ref) => {
    const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

    const variants = {
      primary:
        "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700",
      success:
        "bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20",
      danger:
        "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/20",
      gradient:
        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg",
      ghost:
        "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent",
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-300 cursor-pointer",
          sizeClasses,
          variants[variant],
          (disabled || loading) && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {loading ? <SpinnerIcon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} /> : icon || null}
        {children}
      </button>
    );
  }
);
FetchButton.displayName = "FetchButton";

```
</details>

---

## File: `AmazeUI\src\components\ui\icon-badge.tsx`

### Imports
```typescript
import { View } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface IconBadgeProps extends ViewProps {
export { IconBadge }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps } from "react-native"
import { cn } from "../../lib/utils"

const colorMap = {
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  pink: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
  amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
  red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  gray: "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400",
}

export interface IconBadgeProps extends ViewProps {
  color?: keyof typeof colorMap
  size?: "sm" | "md"
  className?: string
  children?: React.ReactNode
}

const IconBadge = React.forwardRef<React.ElementRef<typeof View>, IconBadgeProps>(
  ({ className, color = "blue", size = "md", children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "shrink-0 flex flex-row items-center justify-center",
        size === "sm" ? "w-8 h-8 rounded-full" : "w-10 h-10 rounded-xl",
        colorMap[color] || colorMap.blue,
        className
      ) } as any)}
      {...props}
    >
      {children}
    </View>
  )
)
IconBadge.displayName = "IconBadge"

export { IconBadge }

```
</details>

---

## File: `AmazeUI\src\components\ui\image.tsx`

### Imports
```typescript
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
export { Image }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react"
import { cn } from "../../lib/utils"

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ className, alt = "", ...props }, ref) => (
    <img
      ref={ref}
      alt={alt}
      className={cn("object-contain", className)}
      {...props}
    />
  )
)
Image.displayName = "Image"

export { Image }

```
</details>

---

## File: `AmazeUI\src\components\ui\info-row.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface InfoRowProps {
export function InfoRow({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";

export interface InfoRowProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function InfoRow({
  icon,
  children,
  className,
  iconClassName,
}: InfoRowProps) {
  return (
    <View className={cn("flex flex-row items-center gap-2", className)}>
      <View className={cn("text-gray-400 dark:text-gray-500 shrink-0", iconClassName)}>
        {icon}
      </View>
      <Text className="text-sm text-gray-700 dark:text-gray-300">
        {children}
      </Text>
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\input.tsx`

### Imports
```typescript
import * as React from "react";
import { Platform } from "react-native-web";
import { View, Text, TextInput as PrimitiveTextInput } from "../../lib/primitives";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface InputProps {
export const Input = React.forwardRef<any, InputProps>(
export interface TextareaProps {
export const Textarea = React.forwardRef<any, TextareaProps>(
export interface SelectProps {
export const Select = React.forwardRef<any, SelectProps>(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { Platform } from "react-native-web";
import { View, Text, TextInput as PrimitiveTextInput } from "../../lib/primitives";
import { cn } from "../../lib/utils";

export interface InputProps {
  label?: string;
  error?: string;
  className?: string;
  id?: string;
  value?: string;
  onChange?: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}

export const Input = React.forwardRef<any, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <View>
        {label && (
          <Text className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {label}
          </Text>
        )}
        <PrimitiveTextInput
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white dark:bg-black",
            "border border-gray-200 dark:border-gray-800",
            "rounded-xl px-4 py-2.5",
            "text-gray-900 dark:text-gray-100",
            "focus:outline-none focus:border-blue-500/50 transition-colors",
            error && "border-red-500",
            className
          )}
          {...props}
        />
        {error && <Text className="text-xs text-red-500 mt-1 ml-1">{error}</Text>}
      </View>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps {
  label?: string;
  error?: string;
  className?: string;
  id?: string;
  value?: string;
  onChange?: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const Textarea = React.forwardRef<any, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <View>
        {label && (
          <Text className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {label}
          </Text>
        )}
        <PrimitiveTextInput
          ref={ref}
          id={inputId}
          multiline
          className={cn(
            "w-full bg-white dark:bg-black",
            "border border-gray-200 dark:border-gray-800",
            "rounded-xl px-4 py-2",
            "text-sm text-gray-900 dark:text-gray-100",
            "font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-none",
            error && "border-red-500",
            className
          )}
          {...props}
        />
        {error && <Text className="text-xs text-red-500 mt-1 ml-1">{error}</Text>}
      </View>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps {
  label?: string;
  className?: string;
  id?: string;
  value?: string;
  onChange?: (e: any) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

export const Select = React.forwardRef<any, SelectProps>(
  ({ className, label, options, id, value, onChange, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedLabel = options.find((o) => o.value === value)?.label || "Select...";

    if (Platform.OS === "web") {
      const C = "select" as any;
      return (
        <View>
          {label && (
            <Text className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
              {label}
            </Text>
          )}
          <C
            ref={ref}
            id={inputId}
            value={value}
            onChange={(e: any) => onChange?.(e)}
            className={cn(
              "w-full bg-white dark:bg-black",
              "border border-gray-200 dark:border-gray-800",
              "rounded-xl px-4 py-2.5",
              "text-gray-900 dark:text-gray-100",
              "focus:outline-none focus:border-blue-500/50 transition-colors",
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </C>
        </View>
      );
    }

    return (
      <View>
        {label && (
          <Text className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {label}
          </Text>
        )}
        <View
          className={cn(
            "w-full bg-white dark:bg-black",
            "border border-gray-200 dark:border-gray-800",
            "rounded-xl px-4 py-2.5",
            "text-gray-900 dark:text-gray-100",
            className
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Text className="text-sm text-gray-900 dark:text-gray-100">{selectedLabel}</Text>
        </View>
        {isOpen && (
          <View className="mt-1 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {options.map((opt) => (
              <Text
                key={opt.value}
                className={cn(
                  "px-4 py-3 text-sm",
                  value === opt.value
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "text-gray-900 dark:text-gray-100"
                )}
                onClick={() => {
                  onChange?.({ target: { value: opt.value } });
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }
);
Select.displayName = "Select";

```
</details>

---

## File: `AmazeUI\src\components\ui\label.tsx`

### Imports
```typescript
import { Text } from "../../lib/primitives";
import * as React from "react"
import {  type TextProps } from "react-native"
import { cn } from "../../lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
```

### Exports
```typescript
export interface LabelProps extends TextProps, VariantProps<typeof labelVariants> {
export { Label }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { Text } from "../../lib/primitives";
import * as React from "react"
import {  type TextProps } from "react-native"
import { cn } from "../../lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const labelVariants = cva(
  "text-sm font-medium leading-none text-foreground peer-disabled:opacity-70",
  {
    variants: {},
    defaultVariants: {}}
)

export interface LabelProps extends TextProps, VariantProps<typeof labelVariants> {
  className?: string;
}

const Label = React.forwardRef<React.ElementRef<typeof Text>, LabelProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      {...({ className: cn(labelVariants(), className) } as any)}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label }


```
</details>

---

## File: `AmazeUI\src\components\ui\link.tsx`

### Imports
```typescript
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
export { Link }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react"
import { cn } from "../../lib/utils"

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  className?: string;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn("text-primary underline-offset-4 hover:underline", className)}
      {...props}
    />
  )
)
Link.displayName = "Link"

export { Link }

```
</details>

---

## File: `AmazeUI\src\components\ui\loading-screen.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface LoadingScreenProps {
export function LoadingScreen({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { cn } from "../../lib/utils";

export interface LoadingScreenProps {
  logoSrc?: string;
  wordmarkLightSrc?: string;
  wordmarkDarkSrc?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  progress?: number;
}

export function LoadingScreen({
  logoSrc = "/logo.png",
  wordmarkLightSrc,
  wordmarkDarkSrc,
  title,
  subtitle = "Loading",
  className,
  progress,
}: LoadingScreenProps) {
  const showWordmark = wordmarkLightSrc || wordmarkDarkSrc;
  const showText = title;

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#03060F] transition-colors relative overflow-hidden",
        className
      )}
    >
      <style>{`
        @keyframes loaderBar {
          0% { left: -35%; }
          100% { left: 100%; }
        }
        .animate-loaderBar {
          animation: loaderBar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 blur-[120px] rounded-full -z-10" />

      <div className="flex flex-col items-center space-y-6 max-w-xs text-center z-10">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xl animate-pulse">
          <img
            src={logoSrc}
            alt={title || "Logo"}
            className="w-14 h-14 object-contain"
          />
          <div className="absolute -inset-1.5 rounded-[28px] border border-blue-500/20 animate-ping duration-3000 pointer-events-none" />
        </div>

        <div className="space-y-3 pt-2.5">
          {showWordmark && (
            <>
              {wordmarkLightSrc && (
                <img
                  src={wordmarkLightSrc}
                  alt={title || ""}
                  className="h-6 object-contain mx-auto block dark:hidden"
                />
              )}
              {wordmarkDarkSrc && (
                <img
                  src={wordmarkDarkSrc}
                  alt={title || ""}
                  className="h-6 object-contain mx-auto hidden dark:block"
                />
              )}
            </>
          )}
          {showText && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
              {title}
            </p>
          )}
          {!showWordmark && !showText && subtitle && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
              {subtitle}
            </p>
          )}
        </div>

        <div className="w-40 h-1 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden relative shadow-inner">
          {progress !== undefined ? (
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          ) : (
            <div className="absolute top-0 bottom-0 left-0 w-[35%] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-loaderBar" />
          )}
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\loading-spinner.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface LoadingSpinnerProps {
export function LoadingSpinner({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("animate-spin text-blue-500", className)}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingSpinner({
  size = "md",
  className,
  label,
}: LoadingSpinnerProps) {
  return (
    <View className={cn("flex flex-row items-center justify-center gap-3", className)}>
      <SpinnerIcon className={sizes[size]} />
      {label && (
        <Text className="text-sm text-gray-400 dark:text-gray-500">
          {label}
        </Text>
      )}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\mobile-bottom-nav.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface MobileBottomNavItem {
export interface MobileBottomNavProps {
export function MobileBottomNav({ items, className, compact }: MobileBottomNavProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import { cn } from "../../lib/utils";

export interface MobileBottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  className?: string;
  compact?: boolean;
}

export function MobileBottomNav({ items, className, compact }: MobileBottomNavProps) {
  return (
    <View
      className={cn(
        "fixed left-1/2 z-[50] flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-row items-center justify-between gap-1 rounded-[1.75rem] border border-white/55 bg-white/65 px-2 py-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-gray-950/68 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
        className,
      )}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } as any}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={item.onClick}
          className={cn(
            "flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-[1.35rem] px-3 py-2 text-[10px] font-bold transition-all",
            item.isActive
              ? "bg-white/80 text-info shadow-sm dark:bg-white/10 scale-105"
              : "text-gray-500 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white",
          )}
        >
          <View className="shrink-0">{item.icon}</View>
          {!compact && <Text className="mt-0.5">{item.label}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\modal.tsx`

### Imports
```typescript
import * as React from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface ModalProps {
export function Modal({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  showClose?: boolean;
  noPadding?: boolean;
}

export function Modal({
  isOpen = true,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
  className,
  showClose = true,
  noPadding = false,
}: ModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70" />
      <div
        className={cn(
          "relative w-full", maxWidth,
          "bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-3xl",
          "dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        {title && (
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          </div>
        )}
        <div className={cn(noPadding ? "" : "p-6", !title && !noPadding && "pt-6")}>{children}</div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\option-picker.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { createPortal } from "react-dom"
import { Modal } from "react-native-web"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface OptionPickerOption {
export interface OptionPickerProps {
export { OptionPicker }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import { createPortal } from "react-dom"
import { Modal } from "react-native-web"
import { cn } from "../../lib/utils"

export interface OptionPickerOption {
  value: string;
  label: string;
}

export interface OptionPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: OptionPickerOption[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  disabled?: boolean;
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const OptionPicker = React.forwardRef<React.ElementRef<typeof View>, OptionPickerProps>(
  ({ className, value, onChange, options, placeholder = "Select...", searchable = true, disabled = false }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const isMobile = useIsMobile();
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 });

    const selected = options.find(o => o.value === value);

    const filtered = query
      ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()))
      : options;

    React.useEffect(() => {
      if (open && !isMobile && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
      }
    }, [open, isMobile]);

    React.useEffect(() => {
      if (!open) setQuery("");
    }, [open]);

    const handleSelect = (opt: OptionPickerOption) => {
      onChange(opt.value);
      setOpen(false);
    };

    const listContent = (
      <View className="flex flex-col h-full max-h-[85vh]">
        {searchable && (
          <View className="relative shrink-0 border-b border-border">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full bg-transparent pl-10 pr-10 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {query && (
              <button onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </View>
        )}
        <View className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <View className="py-8 text-center">
              <Text className="text-sm text-muted-foreground/50">No options found</Text>
            </View>
          ) : (
            filtered.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleSelect(opt)}
                  className={cn(
                    "flex flex-row items-center gap-3 px-4 py-3 transition-colors mx-1 rounded-lg",
                    active
                      ? "bg-info/10 text-info font-semibold"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <Text className={cn(
                    "text-sm flex-1",
                    active ? "font-semibold" : "font-medium"
                  )}>
                    {opt.label}
                  </Text>
                  {active && (
                    <View className="w-2 h-2 rounded-full bg-info shrink-0" />
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    );

    return (
      <View ref={ref} className={cn("relative", className)}>
        <Pressable
          ref={triggerRef as any}
          onPress={() => !disabled && setOpen(true)}
          className={cn(
            "flex flex-row items-center justify-between gap-2 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30",
            !selected && "text-muted-foreground/60"
          )}
        >
          <Text className="truncate text-sm">
            {selected ? selected.label : placeholder}
          </Text>
          <ChevronDownIcon className={`w-4 h-4 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`} />
        </Pressable>

        {open && !isMobile && typeof document !== "undefined" && createPortal(
          <>
            <Pressable className="fixed inset-0 z-50" onPress={() => setOpen(false)} />
            <View
              {...({ className: cn(
                "fixed z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden",
                "animate-in fade-in slide-in-from-top-2 duration-200",
                "min-w-[240px]"
              ) } as any)}
              style={{ top: position.top, left: position.left, width: Math.max(position.width, 240) }}
            >
              <View className="max-h-[320px] flex flex-col">
                {listContent}
              </View>
            </View>
          </>,
          document.body
        )}

        {open && isMobile && (
          <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <View className="flex-1 items-center justify-center bg-black/60 p-4">
              <View className="w-full max-w-md max-h-[85vh] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
                {listContent}
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }
)
OptionPicker.displayName = "OptionPicker"

export { OptionPicker }

```
</details>

---

## File: `AmazeUI\src\components\ui\page-header.tsx`

### Imports
```typescript
import * as React from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface PageHeaderProps {
export function PageHeader({ icon, title, meta, actions, className }: PageHeaderProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon, title, meta, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-blue-50/60 border-b border-x border-gray-200 rounded-b-2xl py-4 px-5 sm:py-4.5 sm:px-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 -mx-4 md:-mx-6 mb-6 relative z-10 dark:bg-blue-950/20 dark:border-gray-800",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 z-10 min-w-0 w-full sm:w-auto">
        <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {meta}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 z-10 w-full sm:w-auto justify-end sm:justify-start">
          {actions}
        </div>
      )}
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\popover.tsx`

### Imports
```typescript
import { View, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,   type ViewProps } from "react-native-web"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface PopoverProps {
export { Popover, PopoverTrigger, PopoverContent }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Pressable } from "../../lib/primitives";
import * as React from "react"
import { Modal,   type ViewProps } from "react-native-web"
import { cn } from "../../lib/utils"

export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PopoverContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null)

function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = React.useCallback((val: boolean) => {
    if (!isControlled) setInternalOpen(val)
    onOpenChange?.(val)
  }, [isControlled, onOpenChange])
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <View {...({ className: "relative" } as any)}>
        {children}
      </View>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<React.ElementRef<typeof Pressable>, React.ComponentProps<typeof Pressable> & { asChild?: boolean }>(
  ({ onPress, children, asChild, ...props }, ref) => {
    const context = React.useContext(PopoverContext)
    const handler = (e: any) => { context?.setOpen(!context.open); onPress?.(e); (props as any).onClick?.(e) }
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...(children.props as any),
        ...props,
        onPress: handler,
        onClick: handler,
      })
    }
    return (
      <Pressable ref={ref} onPress={handler} {...props}>
        {children}
      </Pressable>
    )
  }
)
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string; align?: "start" | "end" | "center" }>(
  ({ className, children, align, ...props }, ref) => {
    const context = React.useContext(PopoverContext)
    if (!context?.open) return null

    return (
      <Modal visible={context.open} transparent={true} animationType="fade" onRequestClose={() => context.setOpen(false)}>
        <Pressable 
           onPress={() => context.setOpen(false)} 
           {...({ className: "flex-1 bg-transparent justify-center items-center" } as any)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              ref={ref}
              {...({ className: cn("z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none", className) } as any)}
              {...props}
            >
              {children}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    )
  }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }


```
</details>

---

## File: `AmazeUI\src\components\ui\progress-bar.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface ProgressBarProps {
export function ProgressBar({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";

export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  color?: "blue" | "emerald" | "amber" | "red";
  showLabel?: boolean;
  size?: "sm" | "md";
}

const barColors = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const sizes = {
  sm: "h-1.5",
  md: "h-2",
};

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  color = "blue",
  showLabel = false,
  size = "md",
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View className={cn("w-full", className)}>
      <View
        className={cn(
          "w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800",
          sizes[size]
        )}
      >
        <View
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            barColors[color],
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </View>
      {showLabel && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {Math.round(pct)}%
        </Text>
      )}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\progress.tsx`

### Imports
```typescript
import { View } from "../../lib/primitives";
import * as React from "react"
import {  type ViewProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface ProgressProps extends ViewProps {
export { Progress }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View } from "../../lib/primitives";
import * as React from "react"
import {  type ViewProps } from "react-native"
import { cn } from "../../lib/utils"

export interface ProgressProps extends ViewProps {
  className?: string;
  value?: number;
}

const Progress = React.forwardRef<React.ElementRef<typeof View>, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    // Ensure value is between 0 and 100
    const boundedValue = Math.min(100, Math.max(0, value || 0));
    
    return (
      <View
        ref={ref}
        {...({ className: cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className) } as any)}
        {...props}
      >
        <View 
          {...({ className: "h-full bg-primary flex-1 transition-all" } as any)}
          style={{ width: `${boundedValue}%` }}
        />
      </View>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }


```
</details>

---

## File: `AmazeUI\src\components\ui\search-input.tsx`

### Imports
```typescript
import * as React from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react";
import { cn } from "../../lib/utils";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <svg
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full pl-9 pr-4 py-2 text-sm",
            "bg-white border border-gray-200 dark:bg-gray-950 dark:border-gray-800",
            "rounded-xl",
            "text-gray-900 dark:text-gray-100 placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "transition-all",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

```
</details>

---

## File: `AmazeUI\src\components\ui\section-header.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface SectionHeaderProps {
export function SectionHeader({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { cn } from "../../lib/utils";
import { View, Text } from "../../lib/primitives";

export interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <View className={cn("flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4", className)}>
      <View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex flex-row items-center gap-2">
          {icon}
          {title}
        </Text>
        {subtitle && (
          <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">{subtitle}</Text>
        )}
      </View>
      {action && <View>{action}</View>}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\select.tsx`

### Imports
```typescript
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface SelectOption {
export interface SelectProps {
export { Select }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { cn } from "../../lib/utils"

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, value, onChange, options, placeholder, disabled, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    };

    return (
      <select
        ref={ref}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        name={props.name}
        required={props.required}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...(props as any)}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }

```
</details>

---

## File: `AmazeUI\src\components\ui\settings-panel.tsx`

### Imports
```typescript
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface SettingsSection {
export interface SettingsPanelProps {
export function SettingsPanel({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";

export interface SettingsSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SettingsPanelProps {
  sections: SettingsSection[];
  searchPlaceholder?: string;
  className?: string;
  children?: React.ReactNode;
  renderSection: (section: SettingsSection) => React.ReactNode;
  sidebarLabel?: string;
}

export function SettingsPanel({
  sections,
  searchPlaceholder = "Search Settings...",
  className,
  renderSection,
  sidebarLabel = "Settings",
}: SettingsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");
  const [expandedSection, setExpandedSection] = useState("");

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => {
      if (s.label.toLowerCase().includes(q)) return true;
      if (s.id.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [sections, searchQuery]);

  const scrollToSection = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 120;
      let current = sections[0]?.id || "";
      for (const sec of sections) {
        const el = sectionRefs.current[sec.id];
        if (el && el.offsetTop <= scrollPos) {
          current = sec.id;
        }
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return (
    <div className={cn("w-full h-full pb-16 px-4 md:px-8 max-w-7xl mx-auto", className)}>
      <div className="relative mt-5 max-w-md">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-info transition-all"
        />
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start relative mt-6">
        {filteredSections.length > 1 && (
          <aside className="sticky top-6 w-full md:w-56 shrink-0 hidden md:flex flex-col gap-0.5 border-r border-gray-150 dark:border-gray-800/60 pr-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 mb-2">
              {sidebarLabel}
            </div>
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg text-left transition-all",
                    isActive
                      ? "bg-info-surface text-info border border-info/30"
                      : "text-gray-600 dark:text-gray-450 hover:bg-gray-100/60 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white border border-transparent"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-info" : "text-gray-400 dark:text-gray-500")} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        <div className="flex-1 w-full min-w-0 space-y-8">
          {filteredSections.map((sec) => {
            const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
            const Icon = sec.icon;

            if (isMobile) {
              const isOpen = expandedSection === sec.id;
              return (
                <div
                  key={sec.id}
                  ref={(el) => { sectionRefs.current[sec.id] = el; }}
                  className="border border-gray-200/85 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 rounded-2xl overflow-hidden shadow-xs"
                >
                  <button
                    onClick={() => setExpandedSection(isOpen ? "" : sec.id)}
                    className="w-full flex items-center justify-between p-4 font-bold text-gray-850 dark:text-gray-200 hover:bg-gray-100/40 dark:hover:bg-slate-800/30 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4.5 h-4.5 text-info" />
                      <span className="text-sm font-extrabold">{sec.label}</span>
                    </div>
                    <svg
                      className={cn(
                        "w-4 h-4 text-gray-400 transition-transform duration-200",
                        isOpen ? "rotate-90 text-info" : ""
                      )}
                      xmlns="http://www.w3.org/2000/svg"
                      width="24" height="24" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-850 space-y-5 animate-fadeIn">
                      {renderSection(sec)}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <section
                key={sec.id}
                id={`sec-${sec.id}`}
                ref={(el) => { sectionRefs.current[sec.id] = el; }}
                className="scroll-mt-6 space-y-5"
              >
                <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                  <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {sec.label}
                  </h2>
                </div>
                {renderSection(sec)}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\sidebar-profile.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { useSidebar } from "./sidebar";
```

### Exports
```typescript
export interface SidebarProfileProps {
export function SidebarProfile({
export interface SidebarThemeControlProps {
export function SidebarThemeControl({
export interface SidebarExpandButtonProps {
export function SidebarExpandButton({ onClick, className }: SidebarExpandButtonProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { cn } from "../../lib/utils";
import { useSidebar } from "./sidebar";

export interface SidebarProfileProps {
  name?: string;
  degree?: string;
  avatarUrl?: string;
  initials?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
  className?: string;
}

export function SidebarProfile({
  name,
  degree,
  avatarUrl,
  initials,
  onLogout,
  onProfileClick,
  className,
}: SidebarProfileProps) {
  const { isOpen } = useSidebar();

  if (!isOpen) {
    return (
      <button
        onClick={onProfileClick}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-white/20"
        title="Account Settings"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-sidebar-border object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
            {initials || "ST"}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full border border-sidebar-border object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground">
          {initials || "ST"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-sidebar-foreground">
          {name}
        </span>
        {degree && (
          <span className="block truncate text-[10px] text-sidebar-foreground/">
            {degree}
          </span>
        )}
      </div>
      <button
        onClick={onLogout}
        className="rounded-lg p-1.5 text-sidebar-foreground/ transition-colors hover:bg-sidebar-accent hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        title="Log out"
        aria-label="Log out"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export interface SidebarThemeControlProps {
  theme?: string;
  onThemeChange?: (theme: string) => void;
  className?: string;
}

export function SidebarThemeControl({
  theme = "light",
  onThemeChange,
  className,
}: SidebarThemeControlProps) {
  const { isOpen } = useSidebar();

  if (!isOpen) {
    return (
      <button
        onClick={() => onThemeChange?.(theme === "dark" ? "light" : "dark")}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between px-0.5 text-[11px] text-sidebar-foreground/", className)}>
      <span className="text-sidebar-foreground/ text-[8px] font-semibold uppercase tracking-wide">
        Theme
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onThemeChange?.("light")}
          className={`flex items-center gap-1 transition-colors hover:text-sidebar-foreground ${theme === "light" ? "font-medium text-info" : ""}`}
        >
          <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "light" ? "border-info bg-info" : "border-sidebar-border"}`} />
          <span>Light</span>
        </button>
        <button
          onClick={() => onThemeChange?.("dark")}
          className={`flex items-center gap-1 transition-colors hover:text-sidebar-foreground ${theme === "dark" ? "font-medium text-info" : ""}`}
        >
          <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "dark" ? "border-info bg-info" : "border-sidebar-border"}`} />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
}

export interface SidebarExpandButtonProps {
  onClick?: () => void;
  className?: string;
}

export function SidebarExpandButton({ onClick, className }: SidebarExpandButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
        className,
      )}
      title="Expand sidebar"
      aria-label="Expand sidebar"
    >
      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\sidebar.tsx`

### Imports
```typescript
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export function useSidebar() {
export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react"
import { cn } from "../../lib/utils"

const SidebarContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
} | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  side?: "left" | "right"
}

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, isOpen = true, onOpenChange, side = "left", children, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(isOpen)
    const isControlled = onOpenChange !== undefined
    const openState = isControlled ? isOpen : internalOpen

    const handleToggle = React.useCallback((open: boolean) => {
      if (isControlled) {
        onOpenChange(open)
      } else {
        setInternalOpen(open)
      }
    }, [isControlled, onOpenChange])

    return (
      <SidebarContext.Provider value={{ isOpen: openState, setIsOpen: handleToggle }}>
        <aside
          ref={ref}
          data-state={openState ? "expanded" : "collapsed"}
          className={cn(
            "fixed top-4 z-50 hidden h-[calc(100vh-2rem)] flex-col rounded-[24px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:flex",
            openState ? "overflow-hidden w-[280px]" : "overflow-visible w-[72px]",
            side === "left" ? "left-4" : "right-4",
            className
          )}
          {...props}
        >
          {children}
        </aside>
      </SidebarContext.Provider>
    )
  }
)
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen } = useSidebar()
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col border-b border-sidebar-border shrink-0",
          isOpen ? "px-4 pb-4 pt-5" : "px-3.5 py-4",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen } = useSidebar()
    return (
      <div
        ref={ref}
        style={{ overflowY: "auto", overflowX: "hidden" }}
        className={cn(
          "min-h-0 flex-1",
          isOpen ? "px-3 py-4" : "px-2 py-4 items-center",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarContent.displayName = "SidebarContent"

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1 w-full", className)}
        {...props}
      />
    )
  }
)
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen } = useSidebar()
    if (!isOpen) return null
    return (
      <div
        ref={ref}
        className={cn("px-3 mb-1 mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/50", className)}
        {...props}
      />
    )
  }
)
SidebarGroupLabel.displayName = "SidebarGroupLabel"

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  isActive?: boolean
  label?: React.ReactNode
  rightElement?: React.ReactNode
}

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, icon, isActive, label, rightElement, ...props }, ref) => {
    const { isOpen } = useSidebar()
    return (
      <button
        ref={ref}
        data-active={isActive}
        className={cn(
          "group relative flex items-center rounded-xl transition-all duration-150 w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isOpen ? "gap-3 px-3 py-2 justify-start text-sm" : "justify-center p-3 h-11 w-11 mt-1",
          isActive 
            ? "bg-sidebar-accent border border-sidebar-border text-info font-semibold shadow-sm" 
            : "text-sidebar-foreground/70 border border-transparent",
          className
        )}
        {...props}
      >
        <div className={cn("shrink-0", isActive ? "text-info" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")}>
          {icon}
        </div>
        {isOpen && label && (
          <span className={cn("truncate flex-1 text-left", isActive ? "font-semibold" : "font-medium")}>
            {label}
          </span>
        )}
        {isOpen && rightElement && (
          <div className="shrink-0">
            {rightElement}
          </div>
        )}
        {!isOpen && label && (
          <div className="absolute left-full ml-4 hidden group-hover:block z-50 px-3 py-1.5 rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs font-medium whitespace-nowrap shadow-xl">
            {label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
          </div>
        )}
      </button>
    )
  }
)
SidebarItem.displayName = "SidebarItem"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen } = useSidebar()
    return (
      <div
        ref={ref}
        className={cn(
          "shrink-0 border-t border-sidebar-border bg-sidebar-accent/30 backdrop-blur-md",
          isOpen ? "p-4" : "p-3 flex justify-center",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarFooter.displayName = "SidebarFooter"
```
</details>

---

## File: `AmazeUI\src\components\ui\skeleton.tsx`

### Imports
```typescript
import { View } from "../../lib/primitives";
import * as React from "react"
import {  type ViewProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface SkeletonProps extends ViewProps {
export { Skeleton }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View } from "../../lib/primitives";
import * as React from "react"
import {  type ViewProps } from "react-native"
import { cn } from "../../lib/utils"

export interface SkeletonProps extends ViewProps {
  className?: string;
}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <View
      {...({ className: cn("animate-pulse rounded-md bg-primary/10", className) } as any)}
      {...props}
    />
  )
}

export { Skeleton }


```
</details>

---

## File: `AmazeUI\src\components\ui\status-badge.tsx`

### Imports
```typescript
import * as React from "react"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
export { StatusBadge }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react"
import { cn } from "../../lib/utils"

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'pending' | 'processing' | 'success' | 'error' | 'warning' | 'info';
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const styles = {
      pending: 'bg-[var(--semantic-warning)]/15 text-[var(--semantic-warning)] border-[var(--semantic-warning)]/20',
      processing: 'bg-accent/15 text-accent border-accent/20 animate-pulse',
      success: 'bg-[var(--semantic-success)]/15 text-[var(--semantic-success)] border-[var(--semantic-success)]/20',
      error: 'bg-destructive/15 text-destructive border-destructive/20',
      warning: 'bg-[var(--semantic-warning)]/15 text-[var(--semantic-warning)] border-[var(--semantic-warning)]/20',
      info: 'bg-muted text-muted-foreground border-border/50',
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
          styles[status],
          className
        )}
        {...props}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        {status}
      </span>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge }

```
</details>

---

## File: `AmazeUI\src\components\ui\sub-tab-strip.tsx`

### Imports
```typescript
import { motion } from "framer-motion";
```

### Exports
```typescript
export interface SubTabStripTab {
export interface SubTabStripProps {
export function SubTabStrip({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { motion } from "framer-motion";

export interface SubTabStripTab {
  id: string;
  label: string;
}

export interface SubTabStripProps {
  tabs: SubTabStripTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function SubTabStrip({
  tabs,
  activeTab,
  onChange,
}: SubTabStripProps) {
  return (
    <div className="w-full overflow-x-auto mb-5" style={{ scrollbarWidth: "none" }}>
      <div className="flex gap-1 bg-gray-100/80 dark:bg-black/60 backdrop-blur-xl rounded-full p-1.5 border border-gray-200/60 dark:border-gray-800/60 shadow-inner min-w-max w-fit">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-5 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-colors duration-300 ${
                isActive
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/40"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="subtab-active-indicator"
                  className="absolute inset-0 bg-white dark:bg-gray-800 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-200/50 dark:border-gray-700/50"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\subpage-layout.tsx`

### Imports
```typescript
import { BackButton } from "./back-button";
import { View, Text } from "../../lib/primitives";
```

### Exports
```typescript
export interface SubpageLayoutProps {
export function SubpageLayout({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { BackButton } from "./back-button";
import { View, Text } from "../../lib/primitives";

export interface SubpageLayoutProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SubpageLayout({
  title,
  subtitle,
  onBack,
  action,
  children,
  className,
}: SubpageLayoutProps) {
  return (
    <View className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Mobile header */}
      <View className="flex flex-row items-center justify-between w-full md:hidden mb-4 px-4">
        <View className="flex flex-row items-center gap-3 min-w-0">
          <BackButton onClick={onBack} />
          <View className="min-w-0">
            <Text className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 truncate tracking-tight">
              {title}
            </Text>
            {subtitle && (
              <Text className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {action && <View className="shrink-0 ml-2">{action}</View>}
      </View>

      {/* Desktop header */}
      <View className="hidden md:flex flex-row items-center justify-between mb-6">
        <View className="flex flex-row items-center gap-3">
          <BackButton onClick={onBack} />
          <View>
            <Text className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 leading-tight tracking-tight">
              {title}
            </Text>
            {subtitle && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {action && <View>{action}</View>}
      </View>

      <View className={className}>{children}</View>
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\switch.tsx`

### Imports
```typescript
import * as React from "react"
import { Switch as NativeSwitch, type SwitchProps as NativeSwitchProps } from "react-native-web"
```

### Exports
```typescript
export interface SwitchProps extends NativeSwitchProps {
export { Switch }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react"
import { Switch as NativeSwitch, type SwitchProps as NativeSwitchProps } from "react-native-web"

export interface SwitchProps extends NativeSwitchProps {
  onCheckedChange?: (checked: boolean) => void;
  checked?: boolean;
  onChange?: (event: any) => void;
  disabled?: boolean;
  className?: string;
}

const Switch = React.forwardRef<React.ElementRef<typeof NativeSwitch>, SwitchProps>(
  ({ className, onCheckedChange, onChange, onValueChange, checked, value, ...props }, ref) => {
    return (
      <NativeSwitch value={checked !== undefined ? checked : value} onValueChange={(val) => { onValueChange?.(val); onCheckedChange?.(val); onChange?.(val); }}
        ref={ref}
        {...props}
      />
    )
  }
)
Switch.displayName = "Switch"

export { Switch }


```
</details>

---

## File: `AmazeUI\src\components\ui\sync-notification.tsx`

### Imports
```typescript
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface SyncNotificationProps {
export function SyncNotification({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";

export interface SyncNotificationProps {
  message: string;
  progress: number;
  active: boolean;
  onDismiss: () => void;
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("animate-spin", className)}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function cleanStep(line: string) {
  return line
    .replace(/^✅\s*/, "")
    .replace(/^❌\s*/, "")
    .replace(/\.\.\.$/, "")
    .trim();
}

export function SyncNotification({
  message,
  progress = 0,
  active,
  onDismiss,
}: SyncNotificationProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isComplete = !active && progress >= 100;
  const isError = message.trim().startsWith("\u274C");

  const steps = useMemo(() => {
    return message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        raw: line,
        label: cleanStep(line),
        completed: line.startsWith("\u2705"),
        failed: line.startsWith("\u274C"),
      }));
  }, [message]);

  const activeStep = [...steps].reverse().find((step) => !step.completed && !step.failed) || steps[steps.length - 1];
  const completedSteps = steps.filter((step) => step.completed);
  const visibleSteps = showDetails ? steps : [...completedSteps.slice(-2), ...(activeStep && !activeStep.completed ? [activeStep] : [])];

  useEffect(() => {
    if (!isComplete) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [isComplete, onDismiss]);

  return (
    <AnimatePresence>
      {(active || isComplete || isError) && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed right-4 top-4 z-[100] w-[calc(100vw-2rem)] max-w-[360px] rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-black"
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
              isError
                ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : isComplete
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            }`}>
              {isError ? <XCircleIcon className="h-4 w-4" /> : isComplete ? <CheckCircleIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-900 dark:text-gray-100">
                    {isError ? "Sync failed" : isComplete ? "Sync completed successfully." : "Syncing with VTOP..."}
                  </p>
                  {!isComplete && !isError && activeStep && (
                    <p className="mt-0.5 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                      {activeStep.label}
                    </p>
                  )}
                </div>
                <button
                  onClick={onDismiss}
                  className="rounded-xl p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Dismiss sync notification"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <motion.div
                  className={`h-full ${isError ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-blue-600"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>

              <div className="mt-3 space-y-1.5">
                {visibleSteps.map((step, idx) => (
                  <div key={`${step.raw}-${idx}`} className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {step.failed ? (
                      <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    ) : step.completed || isComplete ? (
                      <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <LoaderIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>

              {steps.length > 3 && (
                <button
                  onClick={() => setShowDetails((value) => !value)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition-colors duration-150 hover:text-blue-700 dark:text-blue-400"
                >
                  {showDetails ? "Hide Details" : "Show Details"}
                  <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-150 ${showDetails ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\table.tsx`

### Imports
```typescript
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import {   type ViewProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import {   type ViewProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"

const Table = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View {...({ className: "w-full overflow-hidden" } as any)}>
      <View
        ref={ref}
        {...({ className: cn("w-full text-sm", className) } as any)}
        {...props}
      />
    </View>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View ref={ref} {...({ className: cn("flex flex-row items-center border-b border-border bg-muted/50", className) } as any)} {...props} />
  )
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn("flex flex-col [&_>_view:last-child]:border-0", className) } as any)}
      {...props}
    />
  )
)
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "flex flex-row items-center border-b border-border transition-colors hover:bg-muted/50",
        className
      ) } as any)}
      {...props}
    />
  )
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "h-12 px-4 flex justify-center text-left align-middle font-medium text-muted-foreground",
        className
      ) } as any)}
      {...props}
    >
      {typeof children === 'string' ? <Text {...({ className: "font-semibold text-muted-foreground text-sm" } as any)}>{children}</Text> : children}
    </View>
  )
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn("p-4 align-middle", className) } as any)}
      {...props}
    >
      {typeof children === 'string' ? <Text {...({ className: "text-foreground text-sm" } as any)}>{children}</Text> : children}
    </View>
  )
)
TableCell.displayName = "TableCell"

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell}


```
</details>

---

## File: `AmazeUI\src\components\ui\tabs.tsx`

### Imports
```typescript
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import {    type ViewProps, type PressableProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface TabsProps extends ViewProps {
export { Tabs, TabsList, TabsTrigger, TabsContent }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text, Pressable } from "../../lib/primitives";
import * as React from "react"
import {    type ViewProps, type PressableProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

export interface TabsProps extends ViewProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

function Tabs({ value: controlledValue, defaultValue, onValueChange, className, children, ...props }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
  
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setUncontrolledValue(newValue)
      onValueChange?.(newValue)
    },
    [onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <View {...({ className } as any)} {...props}>
        {children}
      </View>
    </TabsContext.Provider>
  )
}

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs compound components must be rendered within the Tabs component")
  }
  return context
}

const TabsList = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn("flex-row items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className) } as any)}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<React.ElementRef<typeof Pressable>, PressableProps & { value: string; className?: string; textClassName?: string }>(
  ({ className, textClassName, value, children, ...props }, ref) => {
    const context = useTabsContext()
    const isSelected = context.value === value

    return (
      <Pressable
        ref={ref}
        onPress={() => context.onValueChange(value)}
        {...({ className: cn(
          "flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5",
          isSelected ? "bg-background shadow-sm" : "bg-transparent",
          className
        ) } as any)}
        {...props}
      >
        {typeof children === 'string' ? (
           <Text {...({ className: cn("text-sm font-medium transition-all", isSelected ? "text-foreground" : "text-muted-foreground", textClassName) } as any)}>
             {children}
           </Text>
        ) : (
          children
        )}
      </Pressable>
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps & { value: string; className?: string }>(
  ({ className, value, children, ...props }, ref) => {
    const context = useTabsContext()

    if (context.value !== value) {
      return null
    }

    return (
      <View
        ref={ref}
        {...({ className: cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className) } as any)}
        {...props}
      >
        {children}
      </View>
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }


```
</details>

---

## File: `AmazeUI\src\components\ui\textarea.tsx`

### Imports
```typescript
import { View, TextInput } from "../../lib/primitives";
import * as React from "react"
import { type TextInputProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface TextareaProps extends Omit<TextInputProps, 'multiline'> {
export { Textarea }
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, TextInput } from "../../lib/primitives";
import * as React from "react"
import { type TextInputProps } from "react-native"
import { cn } from "../../lib/utils"

export interface TextareaProps extends Omit<TextInputProps, 'multiline'> {
  className?: string;
  name?: string;
  required?: boolean;
}

const Textarea = React.forwardRef<React.ElementRef<typeof TextInput>, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <View className="relative w-full">
        <TextInput
          ref={ref}
          multiline
          placeholderTextColor="#a3a3a3"
          {...({ className: cn("flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className) } as any)}
          {...props}
        />
      </View>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

```
</details>

---

## File: `AmazeUI\src\components\ui\theme-provider.tsx`

### Imports
```typescript
import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
```

### Exports
```typescript
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
export { useTheme } from "next-themes";
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const legacyDarkTheme = ["mid", "night"].join("");
    if (window.localStorage.getItem("theme") === legacyDarkTheme) {
      window.localStorage.setItem("theme", "dark");
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme } from "next-themes";

```
</details>

---

## File: `AmazeUI\src\components\ui\theme-switcher.tsx`

### Imports
```typescript
import * as React from "react";
import { useTheme } from "./theme-provider";
import { useColorPalette, PALETTE_OPTIONS } from "../../hooks/use-color-palette";
import { Pressable, View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";
```

### Exports
```typescript
export interface ThemeSwitcherProps {
export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";
import { useTheme } from "./theme-provider";
import { useColorPalette, PALETTE_OPTIONS } from "../../hooks/use-color-palette";
import { Pressable, View, Text } from "../../lib/primitives";
import { cn } from "../../lib/utils";

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const { paletteId, setPaletteId } = useColorPalette();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <View className={cn("p-2 rounded-xl bg-card border border-border", className)}><View className="w-5 h-5" /></View>;
  }

  const Icon = theme === "dark" ? MoonIcon : SunIcon;

  return (
    <View className={cn("relative", className)}>
      <Pressable
        onPress={() => setOpen(!open)}
        className="flex items-center justify-center p-2 rounded-xl bg-card border border-border hover:bg-muted/60 transition-colors"
      >
        <Icon className="w-5 h-5 text-foreground/80" />
      </Pressable>

      {open && (
        <>
          <Pressable className="fixed inset-0 z-40" onPress={() => setOpen(false)} />
          <View
            className={cn(
              "absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2",
              "w-44 rounded-2xl bg-card/90 backdrop-blur-2xl border border-border shadow-xl overflow-hidden",
              "animate-in fade-in slide-in-from-top-2 duration-200"
            )}
          >
            <View className="flex flex-col p-2 gap-1">
              <Text className="text-xs font-semibold text-muted-foreground/70 px-2 pt-1">Mode</Text>
              <View className="flex flex-row gap-1">
                <Pressable
                  onPress={() => { setTheme("light"); setOpen(false); }}
                  className={cn(
                    "flex flex-row items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    theme === "light"
                      ? "bg-info/10 text-info"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <SunIcon className="w-4 h-4" />
                  <Text className="text-sm">Light</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setTheme("dark"); setOpen(false); }}
                  className={cn(
                    "flex flex-row items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    theme === "dark"
                      ? "bg-info/10 text-info"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <MoonIcon className="w-4 h-4" />
                  <Text className="text-sm">Dark</Text>
                </Pressable>
              </View>

              <View className="h-px bg-border my-1" />

              <Text className="text-xs font-semibold text-muted-foreground/70 px-2 pt-1">Accent</Text>
              <View className="grid grid-cols-2 gap-1">
                {PALETTE_OPTIONS.map((p) => {
                  const active = p.id === paletteId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => { setPaletteId(p.id); setOpen(false); }}
                      className={cn(
                        "flex flex-row items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                        active
                          ? "bg-info/10 text-info"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <View
                        className="w-3 h-3 rounded-full shrink-0 border border-border"
                        style={{ backgroundColor: p.swatches[0] }}
                      />
                      <Text className="text-xs">{p.label}</Text>
                      {active && <CheckIcon className="w-3 h-3 ml-auto shrink-0 text-info" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\timeline.tsx`

### Imports
```typescript
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"
```

### Exports
```typescript
export interface TimelineProps extends ViewProps {
export interface TimelineItemProps extends ViewProps {
export interface TimelineCardProps extends ViewProps {
export interface TimelineDateProps extends TextProps {
export interface TimelineTitleProps extends TextProps {
export interface TimelineDescriptionProps extends TextProps {
export interface TimelineActionsProps extends ViewProps {
export {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { View, Text } from "../../lib/primitives";
import * as React from "react"
import { type ViewProps, type TextProps } from "react-native"
import { cn } from "../../lib/utils"

const dotColors = {
  blue: "bg-blue-500 dark:bg-blue-400 border-blue-200 dark:border-blue-800",
  emerald: "bg-emerald-500 dark:bg-emerald-400 border-emerald-200 dark:border-emerald-800",
  purple: "bg-purple-500 dark:bg-purple-400 border-purple-200 dark:border-purple-800",
  amber: "bg-amber-500 dark:bg-amber-400 border-amber-200 dark:border-amber-800",
  pink: "bg-pink-500 dark:bg-pink-400 border-pink-200 dark:border-pink-800",
  indigo: "bg-indigo-500 dark:bg-indigo-400 border-indigo-200 dark:border-indigo-800",
  gray: "bg-gray-400 dark:bg-gray-500 border-gray-200 dark:border-gray-700",
}

export interface TimelineProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const Timeline = React.forwardRef<React.ElementRef<typeof View>, TimelineProps>(
  ({ className, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn("relative flex flex-col", className) } as any)}
      {...props}
    >
      {children}
    </View>
  )
)
Timeline.displayName = "Timeline"

export interface TimelineItemProps extends ViewProps {
  className?: string;
  dotColor?: keyof typeof dotColors;
  children?: React.ReactNode;
}

const TimelineItem = React.forwardRef<React.ElementRef<typeof View>, TimelineItemProps>(
  ({ className, dotColor = "blue", children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "relative flex flex-row gap-4 pb-10 pl-0 group",
        className
      ) } as any)}
      {...props}
    >
      <View className="flex flex-col items-center shrink-0 pt-1.5">
        <View className={cn(
          "w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ring-2 ring-background",
          dotColors[dotColor]
        )} />
        <View className="w-0.5 flex-1 bg-gradient-to-b from-border/80 to-border/20 mt-2" />
      </View>
      <View className="flex-1 min-w-0">
        {children}
      </View>
    </View>
  )
)
TimelineItem.displayName = "TimelineItem"

export interface TimelineCardProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const TimelineCard = React.forwardRef<React.ElementRef<typeof View>, TimelineCardProps>(
  ({ className, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        "transition-all duration-200 group-hover:shadow-md group-hover:border-foreground/20",
        className
      ) } as any)}
      {...props}
    >
      {children}
    </View>
  )
)
TimelineCard.displayName = "TimelineCard"

export interface TimelineDateProps extends TextProps {
  className?: string;
  children?: React.ReactNode;
}

const TimelineDate = React.forwardRef<React.ElementRef<typeof Text>, TimelineDateProps>(
  ({ className, children, ...props }, ref) => (
    <Text
      ref={ref}
      {...({ className: cn(
        "text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5",
        className
      ) } as any)}
      {...props}
    >
      {children}
    </Text>
  )
)
TimelineDate.displayName = "TimelineDate"

export interface TimelineTitleProps extends TextProps {
  className?: string;
  children?: React.ReactNode;
}

const TimelineTitle = React.forwardRef<React.ElementRef<typeof Text>, TimelineTitleProps>(
  ({ className, children, ...props }, ref) => (
    <Text
      ref={ref}
      {...({ className: cn(
        "text-base font-semibold text-foreground leading-snug",
        className
      ) } as any)}
      {...props}
    >
      {children}
    </Text>
  )
)
TimelineTitle.displayName = "TimelineTitle"

export interface TimelineDescriptionProps extends TextProps {
  className?: string;
  children?: React.ReactNode;
}

const TimelineDescription = React.forwardRef<React.ElementRef<typeof Text>, TimelineDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <Text
      ref={ref}
      {...({ className: cn(
        "text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap",
        className
      ) } as any)}
      {...props}
    >
      {children}
    </Text>
  )
)
TimelineDescription.displayName = "TimelineDescription"

export interface TimelineActionsProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const TimelineActions = React.forwardRef<React.ElementRef<typeof View>, TimelineActionsProps>(
  ({ className, children, ...props }, ref) => (
    <View
      ref={ref}
      {...({ className: cn(
        "flex flex-row items-center gap-2 mt-3 pt-3 border-t border-border/50",
        className
      ) } as any)}
      {...props}
    >
      {children}
    </View>
  )
)
TimelineActions.displayName = "TimelineActions"

export {
  Timeline,
  TimelineItem,
  TimelineCard,
  TimelineDate,
  TimelineTitle,
  TimelineDescription,
  TimelineActions,
}

```
</details>

---

## File: `AmazeUI\src\components\ui\timetable-grid.tsx`

### Imports
```typescript
import React from 'react';
import { cn } from '../../lib/utils';
```

### Exports
```typescript
export type SlotMap = Record<string, string>;
export interface TimetablePeriod {
export interface AddedCourse {
export interface GapDetail {
export interface TimetableGridProps {
export function TimetableGrid({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import React from 'react';
import { cn } from '../../lib/utils';

export type SlotMap = Record<string, string>;

export interface TimetablePeriod {
  start?: string;
  end?: string;
  lunch?: boolean;
  days?: SlotMap;
}

export interface AddedCourse {
  id: string;
  code: string;
  title: string;
  slots: string[];
  faculty: string;
  venue: string;
  credits: string;
  type: string;
  color: string;
  batch?: string;
}

export interface GapDetail {
  day: string;
  startMin: number;
  endMin: number;
  durationMins: number;
  fromClass?: string;
  toClass?: string;
  fromTime?: string;
  toTime?: string;
}

const DEFAULT_DAYS = [
  { id: 'mon', name: 'Monday' },
  { id: 'tue', name: 'Tuesday' },
  { id: 'wed', name: 'Wednesday' },
  { id: 'thu', name: 'Thursday' },
  { id: 'fri', name: 'Friday' },
];

export interface TimetableGridProps {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  selectedGapDetails?: GapDetail[] | null;
  title?: string;
  showLegend?: boolean;
  className?: string;
}

export function TimetableGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days = DEFAULT_DAYS,
  blockedSlots,
  onToggleBlockSlot,
  selectedGapDetails,
  title = 'Unified Schedule',
  showLegend = true,
  className,
}: TimetableGridProps) {
  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getCourse = (slotName: string) => courses.find(c => c.slots.includes(slotName));

  return (
    <div className={cn('mb-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl bg-white dark:bg-gray-950', className)}>
      <div className="p-4 bg-gray-100/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {title}
        </h3>
        {showLegend && (
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-sm" />
              Theory (Top)
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-sm border-dashed" />
              Lab (Bottom)
            </div>
          </div>
        )}
      </div>
      <div className="min-w-max">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white dark:bg-gray-900">
              <th className="p-3 border-b border-r border-gray-200 dark:border-gray-800 font-semibold text-gray-500 dark:text-gray-400 w-24 text-center sticky left-0 z-20 bg-white dark:bg-gray-900">
                Day
              </th>
              {theoryPeriods.map((period, idx) => (
                <th key={idx} className="p-2 border-b border-r border-gray-200 dark:border-gray-800 text-xs text-center text-gray-500 dark:text-gray-400 font-medium">
                  <div className="flex flex-col">
                    <span>{period.start}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">to</span>
                    <span>{period.end}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100/5 dark:hover:bg-gray-800/5 transition-colors">
                <td className="p-3 border-r border-gray-200 dark:border-gray-800 font-semibold text-gray-600 dark:text-gray-300 text-center bg-white/95 dark:bg-gray-950/95 sticky left-0 z-20">
                  {day.name.substring(0, 3).toUpperCase()}
                </td>
                {theoryPeriods.map((period, pIdx) => {
                  const theorySlotName = period.days?.[day.id];
                  const labSlotName = labPeriods[pIdx]?.days?.[day.id];

                  if (!theorySlotName && !labSlotName) {
                    return (
                      <td key={pIdx} className="border-r border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 h-[76px] min-h-[76px]" />
                    );
                  }

                  const tCourse = theorySlotName ? getCourse(theorySlotName) : undefined;
                  const lCourse = labSlotName ? getCourse(labSlotName) : undefined;

                  const isTBlocked = blockedSlots && theorySlotName ? blockedSlots.has(theorySlotName) : false;
                  const isLBlocked = blockedSlots && labSlotName ? blockedSlots.has(labSlotName) : false;

                  const timeStart = period.start || '';

                  return (
                    <td key={pIdx} className="border-r border-gray-200 dark:border-gray-800 text-center relative group min-w-[80px] align-top hover:z-50 h-[76px] min-h-[76px]">
                      <div className="w-full h-full flex flex-col items-stretch">
                        {theorySlotName ? (
                          <div
                            onClick={() => onToggleBlockSlot?.(theorySlotName)}
                            className={cn(
                              'h-[38px] p-1 border-b border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center transition-all duration-300 relative',
                              onToggleBlockSlot && 'cursor-pointer',
                              isTBlocked
                                ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(239,68,68,0.3)_2px,rgba(239,68,68,0.3)_4px)] bg-red-950/40 border-red-500/30 text-red-200 shadow-inner'
                                : tCourse
                                  ? cn(tCourse.color, 'shadow-lg text-gray-900 dark:text-gray-100 z-10')
                                  : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(timeStart) >= g.startMin && timeToMinutes(timeStart) < g.endMin)
                                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-600 dark:text-yellow-200 animate-pulse'
                                    : 'bg-gray-100/20 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-100/30 dark:hover:bg-gray-900/30')
                            )}
                          >
                            <span className={cn('text-[11px] font-bold', (tCourse || isTBlocked) ? 'opacity-100' : 'opacity-60')}>
                              {isTBlocked ? 'Blocked' : theorySlotName}
                            </span>
                            {!isTBlocked && tCourse && (
                              <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{tCourse.code}</span>
                            )}

                            {!isTBlocked && tCourse && (
                              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-900 dark:bg-gray-950 text-gray-100 text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-gray-700 text-center">
                                <p className="font-bold">{tCourse.title}</p>
                                <p className="text-gray-300 mt-0.5">{tCourse.faculty}</p>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-950 rotate-45 border-r border-b border-gray-700" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[38px] border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50" />
                        )}

                        {labSlotName ? (
                          <div
                            onClick={() => onToggleBlockSlot?.(labSlotName)}
                            className={cn(
                              'h-[38px] p-1 flex flex-col items-center justify-center transition-all duration-300 relative',
                              onToggleBlockSlot && 'cursor-pointer',
                              isLBlocked
                                ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(239,68,68,0.3)_2px,rgba(239,68,68,0.3)_4px)] bg-red-950/40 text-red-200 shadow-inner'
                                : lCourse
                                  ? cn(lCourse.color, 'shadow-lg text-gray-900 dark:text-gray-100 z-10')
                                  : (selectedGapDetails?.some(g => g.day === day.id && timeToMinutes(timeStart) >= g.startMin && timeToMinutes(timeStart) < g.endMin)
                                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-600 dark:text-yellow-200 animate-pulse'
                                    : 'bg-gray-100/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100/60 dark:hover:bg-gray-900/60')
                            )}
                          >
                            <span className={cn('text-[11px] font-bold', (lCourse || isLBlocked) ? 'opacity-100' : 'opacity-60')}>
                              {isLBlocked ? 'Blocked' : labSlotName}
                            </span>
                            {!isLBlocked && lCourse && (
                              <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{lCourse.code}</span>
                            )}

                            {!isLBlocked && lCourse && (
                              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-[200px] bg-gray-900 dark:bg-gray-950 text-gray-100 text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-gray-700 text-center">
                                <p className="font-bold">{lCourse.title}</p>
                                <p className="text-gray-300 mt-0.5">{lCourse.faculty}</p>
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-950 rotate-45 border-t border-l border-gray-700" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[38px] bg-gray-100/50 dark:bg-gray-900/50" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeUI\src\components\ui\use-is-mobile.ts`

### Imports
```typescript
import { useState, useEffect } from "react";
```

### Exports
```typescript
export function useIsMobile() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return isMobile;
}

```
</details>

---

## File: `AmazeUI\src\components\ui\view-mode-toggle.tsx`

### Imports
```typescript
import { cn } from "../../lib/utils";
import { Pressable, View } from "../../lib/primitives";
```

### Exports
```typescript
export interface ViewModeOption {
export interface ViewModeToggleProps {
export function ViewModeToggle({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { cn } from "../../lib/utils";
import { Pressable, View } from "../../lib/primitives";

export interface ViewModeOption {
  key: string;
  icon: React.ReactNode;
  label?: string;
}

export interface ViewModeToggleProps {
  options: ViewModeOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function ViewModeToggle({
  options,
  value,
  onChange,
  className,
}: ViewModeToggleProps) {
  return (
    <View className={cn("flex flex-row bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-max", className)}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            value === opt.key
              ? "bg-white dark:bg-black text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          {opt.icon}
        </Pressable>
      ))}
    </View>
  );
}

```
</details>

---

## File: `AmazeUI\src\declarations.d.ts`

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
declare module "*.css";

```
</details>

---

## File: `AmazeUI\src\env.d.ts`

### Exports
```typescript
export * from "react-native";
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
/// <reference types="react-native-css/types" />

declare module "react-native-web" {
  export * from "react-native";
}

```
</details>

---

## File: `AmazeUI\src\hooks\use-color-palette.ts`

### Imports
```typescript
import { useState, useEffect, useCallback } from "react";
```

### Exports
```typescript
export interface PaletteDefinition {
export interface ColorPaletteOption {
export const PALETTE_OPTIONS: ColorPaletteOption[] = [
export function useColorPalette() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export interface PaletteDefinition {
  accent: string;
  background?: string;
  surface?: string;
}

const COLOR_PALETTES: Record<string, PaletteDefinition> = {
  default: { accent: "" },
  neonPink: { accent: "#ff2bd6", background: "#fff7fd", surface: "#ffffff" },
  forest: { accent: "#059669", background: "#f8fffb", surface: "#ffffff" },
  rose: { accent: "#e11d48", background: "#fff8fa", surface: "#ffffff" },
  amber: { accent: "#d97706", background: "#fffdf6", surface: "#ffffff" },
  ocean: { accent: "#3b82f6", background: "#f0f7ff", surface: "#ffffff" },
  lavender: { accent: "#8b5cf6", background: "#f8f6ff", surface: "#ffffff" },
  sunset: { accent: "#f59e0b", background: "#fffdf6", surface: "#ffffff" },
};

export interface ColorPaletteOption {
  id: string;
  label: string;
  swatches: string[];
}

export const PALETTE_OPTIONS: ColorPaletteOption[] = [
  { id: "default", label: "Default", swatches: ["#0ea5e9", "#ffffff", "#f8fafc"] },
  { id: "neonPink", label: "Neon Pink", swatches: ["#ff2bd6", "#ffffff", "#fff7fd"] },
  { id: "forest", label: "Forest", swatches: ["#059669", "#ffffff", "#f7fee7"] },
  { id: "rose", label: "Rose", swatches: ["#e11d48", "#ffffff", "#fff1f2"] },
  { id: "amber", label: "Amber", swatches: ["#d97706", "#ffffff", "#fffbeb"] },
  { id: "ocean", label: "Ocean", swatches: ["#3b82f6", "#ffffff", "#f0f7ff"] },
  { id: "lavender", label: "Lavender", swatches: ["#8b5cf6", "#ffffff", "#f8f6ff"] },
  { id: "sunset", label: "Sunset", swatches: ["#f59e0b", "#ffffff", "#fffdf6"] },
];

function getSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("club_hub_settings");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSettings(updates: Record<string, any>) {
  if (typeof window === "undefined") return;
  const current = getSettings() || {};
  const next = { ...current, ...updates };
  localStorage.setItem("club_hub_settings", JSON.stringify(next));
}

export function useColorPalette() {
  const [paletteId, setPaletteIdState] = useState<string>("default");

  useEffect(() => {
    const saved = getSettings();
    if (saved?.colorPalette) {
      setPaletteIdState(saved.colorPalette);
    } else {
      const legacyAccent = localStorage.getItem("accent");
      if (legacyAccent && COLOR_PALETTES[legacyAccent]) {
        setPaletteIdState(legacyAccent);
      }
    }
  }, []);

  const setPaletteId = useCallback((id: string) => {
    setPaletteIdState(id);
    saveSettings({ colorPalette: id });
    try { localStorage.setItem("accent", id); } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const selectedId = paletteId;
    const palette = COLOR_PALETTES[selectedId];

    if (!palette || selectedId === "default") {
      root.removeAttribute("data-color-palette");
      root.removeAttribute("data-accent");
      root.style.removeProperty("--theme-accent");
      root.style.removeProperty("--accent-color");
      root.style.removeProperty("--accent-foreground-color");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--info");
      root.style.removeProperty("--info-surface");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--chart-2");
      root.style.removeProperty("--chart-3");
      return;
    }

    const accent = palette.accent;
    const isDark = document.documentElement.classList.contains("dark");
    const darkBase = "oklch(0.09 0.015 255)";
    const darkSurface = "oklch(0.20 0 0)";
    const lightBase = "oklch(0.982 0.004 247)";

    root.setAttribute("data-color-palette", selectedId);
    root.setAttribute("data-accent", selectedId);

    const setVar = (name: string, value: string) => root.style.setProperty(name, value);
    const remVar = (name: string) => root.style.removeProperty(name);

    setVar("--theme-accent", accent);
    setVar("--accent-color", accent);
    setVar("--accent-foreground-color", isDark ? "#000000" : "#ffffff");

    if (isDark) {
      setVar("--background", `color-mix(in oklab, ${accent} 6%, ${darkBase})`);
      setVar("--surface", `color-mix(in oklab, ${accent} 4%, ${darkSurface})`);
      setVar("--primary", accent);
      setVar("--primary-foreground", "#ffffff");
      setVar("--info", accent);
      setVar("--info-surface", `color-mix(in oklab, ${accent} 18%, transparent)`);
      setVar("--ring", accent);
      setVar("--chart-1", accent);
      setVar("--chart-2", `color-mix(in oklab, ${accent} 70%, #10b981)`);
      setVar("--chart-3", `color-mix(in oklab, ${accent} 70%, #f59e0b)`);
    } else {
      setVar("--background", palette.background || lightBase);
      setVar("--surface", palette.surface || "#ffffff");
      setVar("--primary", accent);
      setVar("--primary-foreground", "#ffffff");
      setVar("--info", accent);
      setVar("--info-surface", `color-mix(in oklab, ${accent} 14%, transparent)`);
      setVar("--ring", accent);
      setVar("--chart-1", accent);
      setVar("--chart-2", `color-mix(in oklab, ${accent} 70%, #10b981)`);
      setVar("--chart-3", `color-mix(in oklab, ${accent} 70%, #f59e0b)`);
    }
  }, [paletteId]);

  return { paletteId, setPaletteId, palettes: PALETTE_OPTIONS };
}

```
</details>

---

## File: `AmazeUI\src\index.ts`

### Exports
```typescript
export * from "./components/ui/button";
export * from "./components/ui/card";
export * from "./components/ui/input";
export * from "./components/ui/label";
export * from "./components/ui/skeleton";
export * from "./components/ui/switch";
export * from "./components/ui/progress";
export * from "./components/ui/tabs";
export * from "./components/ui/table";
export * from "./components/ui/dialog";
export * from "./components/ui/command";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/popover";
export * from "./components/ui/sidebar";
export * from "./components/ui/sidebar-profile";
export * from "./components/ui/theme-provider";
export * from "./components/ui/page-header";
export * from "./components/ui/image";
export * from "./components/ui/link";
export * from "./components/ui/icon-badge";
export * from "./components/ui/empty-state";
export * from "./components/ui/alert";
export * from "./components/ui/timeline";
export * from "./components/ui/color-palette-picker";
export * from "./components/ui/option-picker";
export * from "./components/ui/fab";
export * from "./components/ui/theme-switcher";
export * from "./components/ui/app-library";
export * from "./components/ui/mobile-bottom-nav";
export * from "./components/ui/back-button";
export * from "./components/ui/badge";
export { default as LoginForm } from "./components/custom/LoginForm";
export { default as NavigationTabs } from "./components/custom/NavigationTabs";
export type { BadgeProps } from "./components/ui/badge";
export * from "./components/ui/circular-progress";
export * from "./components/ui/data-table";
export * from "./components/ui/error-display";
export * from "./components/ui/expandable-section";
export * from "./components/ui/fetch-button";
export * from "./components/ui/info-row";
export * from "./components/ui/loading-spinner";
export * from "./components/ui/loading-screen";
export * from "./components/ui/progress-bar";
export * from "./components/ui/search-input";
export * from "./components/ui/section-header";
export * from "./components/ui/subpage-layout";
export * from "./components/ui/sub-tab-strip";
export * from "./components/ui/sync-notification";
export * from "./components/ui/view-mode-toggle";
export * from "./components/ui/use-is-mobile";
export * from "./components/ui/modal";
export * from "./components/ui/command-palette";
export * from "./components/ui/error-diagnostic-card";
export * from "./components/ui/timetable-grid";
export * from "./components/ui/course-list-table";
export * from "./components/ui/about-section";
export * from "./components/ui/settings-panel";
export * from "./components/ui/checkbox";
export * from "./components/ui/status-badge";
export * from "./components/ui/breadcrumbs";
export { useColorPalette, PALETTE_OPTIONS } from "./hooks/use-color-palette";
export { View, Text, Pressable } from "./lib/primitives";
export * from "./lib/utils";
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export * from "./components/ui/button";
export * from "./components/ui/card";
export * from "./components/ui/input";
export * from "./components/ui/label";
export * from "./components/ui/skeleton";
export * from "./components/ui/switch";
export * from "./components/ui/progress";
export * from "./components/ui/tabs";
export * from "./components/ui/table";
export * from "./components/ui/dialog";
export * from "./components/ui/command";

export * from "./components/ui/dropdown-menu";
export * from "./components/ui/popover";
export * from "./components/ui/sidebar";
export * from "./components/ui/sidebar-profile";
export * from "./components/ui/theme-provider";
export * from "./components/ui/page-header";
export * from "./components/ui/image";
export * from "./components/ui/link";
export * from "./components/ui/icon-badge";
export * from "./components/ui/empty-state";
export * from "./components/ui/alert";
export * from "./components/ui/timeline";
export * from "./components/ui/color-palette-picker";
export * from "./components/ui/option-picker";
export * from "./components/ui/fab";
export * from "./components/ui/theme-switcher";
export * from "./components/ui/app-library";
export * from "./components/ui/mobile-bottom-nav";
export * from "./components/ui/back-button";
export * from "./components/ui/badge";
// Custom / Complex UI
export { default as LoginForm } from "./components/custom/LoginForm";
export { default as NavigationTabs } from "./components/custom/NavigationTabs";

export type { BadgeProps } from "./components/ui/badge";
export * from "./components/ui/circular-progress";
export * from "./components/ui/data-table";
export * from "./components/ui/error-display";
export * from "./components/ui/expandable-section";
export * from "./components/ui/fetch-button";
export * from "./components/ui/info-row";
export * from "./components/ui/loading-spinner";
export * from "./components/ui/loading-screen";
export * from "./components/ui/progress-bar";
export * from "./components/ui/search-input";
export * from "./components/ui/section-header";
export * from "./components/ui/subpage-layout";
export * from "./components/ui/sub-tab-strip";
export * from "./components/ui/sync-notification";
export * from "./components/ui/view-mode-toggle";
export * from "./components/ui/use-is-mobile";
export * from "./components/ui/modal";
export * from "./components/ui/command-palette";
export * from "./components/ui/error-diagnostic-card";
export * from "./components/ui/timetable-grid";
export * from "./components/ui/course-list-table";
export * from "./components/ui/about-section";
export * from "./components/ui/settings-panel";
export * from "./components/ui/checkbox";
export * from "./components/ui/status-badge";
export * from "./components/ui/breadcrumbs";
export { useColorPalette, PALETTE_OPTIONS } from "./hooks/use-color-palette";
export { View, Text, Pressable } from "./lib/primitives";
export * from "./lib/utils";

```
</details>

---

## File: `AmazeUI\src\lib\primitives.tsx`

### Imports
```typescript
import * as React from "react";
import { Platform, View as RNView, Text as RNText, Pressable as RNPressable, TextInput as RNTextInput } from "react-native-web";
import { cn } from "./utils";
```

### Exports
```typescript
export const View = React.forwardRef<any, any>(({ className, style, onClick, ...props }, ref) => {
export const Text = React.forwardRef<any, any>(({ className, style, onClick, ...props }, ref) => {
export const Pressable = React.forwardRef<any, any>(({ className, style, onPress, onClick, ...props }, ref) => {
export const TextInput = React.forwardRef<any, any>(({ className, style, onChangeText, onChange, value, placeholderTextColor, multiline, ...props }, ref) => {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react";
import { Platform, View as RNView, Text as RNText, Pressable as RNPressable, TextInput as RNTextInput } from "react-native-web";

import { cn } from "./utils";

export const View = React.forwardRef<any, any>(({ className, style, onClick, ...props }, ref) => {
  if (Platform.OS === 'web') {
    const C = "div" as any;
    return <C ref={ref} onClick={onClick} className={cn("flex flex-col items-stretch justify-start min-w-0 min-h-0 relative", className)} style={style as any} {...props as any} />;
  }
  return <RNView ref={ref} onClick={onClick} style={style} className={className} {...props} />;
});
View.displayName = "View";

export const Text = React.forwardRef<any, any>(({ className, style, onClick, ...props }, ref) => {
  if (Platform.OS === 'web') {
    const C = "span" as any;
    return <C ref={ref} onClick={onClick} className={cn("inline m-0 p-0", className)} style={style as any} {...props as any} />;
  }
  return <RNText ref={ref} onClick={onClick} style={style} className={className} {...props} />;
});
Text.displayName = "Text";

export const Pressable = React.forwardRef<any, any>(({ className, style, onPress, onClick, ...props }, ref) => {
  if (Platform.OS === 'web') {
    const C = "button" as any;
    return <C ref={ref} type="button" onClick={onPress || onClick} className={cn("flex flex-col items-stretch justify-start bg-transparent border-none p-0 m-0 cursor-pointer outline-none relative", className)} style={style as any} {...props as any} />;
  }
  return <RNPressable ref={ref} onPress={onPress || onClick} className={className} style={style} {...props} />;
});
Pressable.displayName = "Pressable";

export const TextInput = React.forwardRef<any, any>(({ className, style, onChangeText, onChange, value, placeholderTextColor, multiline, ...props }, ref) => {
  if (Platform.OS === 'web') {
    const C = multiline ? "textarea" : "input" as any;
    return <C ref={ref} value={value} onChange={(e: any) => { onChangeText?.(e.target.value); onChange?.(e); }} className={cn("w-full", className)} style={{ ...(style as any) }} {...props as any} />;
  }
  return <RNTextInput ref={ref} value={value} onChangeText={onChangeText} onChange={onChange} placeholderTextColor={placeholderTextColor} multiline={multiline} className={className} style={style} {...props} />;
});
TextInput.displayName = "TextInput";

```
</details>

---

## File: `AmazeUI\src\lib\slot.tsx`

### Imports
```typescript
import * as React from "react";
```

### Exports
```typescript
export { Slot };
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";
import * as React from "react";

function Slot({ children, ...props }: { children: React.ReactNode; [key: string]: any }) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...(children.props as any),
      ...props,
    });
  }
  return React.Children.only(children) as any;
}

export { Slot };

```
</details>

---

## File: `AmazeUI\src\lib\utils.ts`

### Imports
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
```

### Exports
```typescript
export function cn(...inputs: ClassValue[]) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```
</details>

---

