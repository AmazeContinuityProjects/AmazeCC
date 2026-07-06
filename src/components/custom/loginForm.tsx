"use client";

import { Eye, EyeOff, ArrowRight, Shield, Zap, Sparkles, Home, Search, BookOpen, ChevronLeft, Plus, RotateCcw, Minus, Sun, Moon, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";

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

function InteractiveCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: -100, y: -100 });
  const current = useRef({ x: -100, y: -100 });
  const pressed = useRef(false);

  useEffect(() => {
    let frame = 0;
    const handleMove = (event: MouseEvent) => {
      target.current.x = event.clientX;
      target.current.y = event.clientY;
    };
    const handleDown = () => {
      pressed.current = true;
    };
    const handleUp = () => {
      pressed.current = false;
    };

    const render = () => {
      current.current.x += (target.current.x - current.current.x) * 0.35;
      current.current.y += (target.current.y - current.current.y) * 0.35;
      if (cursorRef.current) {
        const scale = pressed.current ? 0.72 : 1;
        cursorRef.current.style.transform = `translate3d(${current.current.x - 14}px, ${current.current.y - 14}px, 0) scale(${scale})`;
      }
      frame = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    render();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed left-0 top-0 z-[80] hidden h-7 w-7 rounded-full border border-indigo-400/55 bg-indigo-400/10 shadow-[0_0_24px_rgba(99,102,241,0.25)] will-change-transform md:block"
    />
  );
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    const pointer = { x: -9999, y: -9999 };
    const particles = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      size: 1 + Math.random() * 1.8
    }));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const move = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };

    const leave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(99, 102, 241, 0.5)";
      ctx.strokeStyle = "rgba(168, 85, 247, 0.12)";

      particles.forEach((particle, index) => {
        let px = particle.x * width;
        let py = particle.y * height;
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 120) {
          const force = (120 - dist) / 120;
          particle.vx += (dx / Math.max(dist, 1)) * force * 0.08;
          particle.vy += (dy / Math.max(dist, 1)) * force * 0.08;
        }

      particle.vx *= 0.978;
      particle.vy *= 0.978;
        particle.x += particle.vx / width;
        particle.y += particle.vy / height;

        if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
        if (particle.y < 0 || particle.y > 1) particle.vy *= -1;
        particle.x = Math.min(1, Math.max(0, particle.x));
        particle.y = Math.min(1, Math.max(0, particle.y));

        px = particle.x * width;
        py = particle.y * height;
        ctx.beginPath();
        ctx.arc(px, py, particle.size, 0, Math.PI * 2);
        ctx.fill();

        for (let next = index + 1; next < particles.length; next += 1) {
          const other = particles[next];
          const ox = other.x * width;
          const oy = other.y * height;
          const gap = Math.hypot(px - ox, py - oy);
          if (gap < 95) {
            ctx.globalAlpha = 1 - gap / 95;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(ox, oy);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      });

      frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" aria-hidden="true" />;
}

function AnimatedStat({ value, suffix, label, accent = false }: { value: number; suffix: string; label: string; accent?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, latest => Math.round(latest));
  const [display, setDisplay] = useState(0);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => rounded.on("change", latest => setDisplay(latest)), [rounded]);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, { duration: 1.4, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, motionValue, value]);

  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
      <h4 className={`text-xl font-black ${accent ? "text-indigo-600 dark:text-indigo-400" : "text-slate-900 dark:text-white"}`}>{display}{suffix}</h4>
      <p className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mt-1">{label}</p>
    </motion.div>
  );
}

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-7, 7]);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width - 0.5);
    y.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function MouseReactiveHeroScene() {
  return (
    <motion.div
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width - 0.5) * 14}deg`);
        event.currentTarget.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height - 0.5) * -14}deg`);
        event.currentTarget.style.setProperty("--px", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        event.currentTarget.style.setProperty("--py", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.setProperty("--mx", "0deg");
        event.currentTarget.style.setProperty("--my", "0deg");
        event.currentTarget.style.setProperty("--px", "50%");
        event.currentTarget.style.setProperty("--py", "50%");
      }}
      className="relative w-full max-w-[540px] aspect-[4/3] rounded-3xl overflow-hidden border border-white/40 bg-white/20 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] [transform:perspective(1000px)_rotateY(var(--mx,0deg))_rotateX(var(--my,0deg))] transition-transform duration-200"
    >
      <img src="/hero-artwork.png" alt="AmazeCC campus dashboard preview" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--px,50%)_var(--py,50%),rgba(255,255,255,0.42),transparent_24%),linear-gradient(135deg,rgba(99,102,241,0.42),rgba(14,165,233,0.12)_42%,rgba(236,72,153,0.28))]" />
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-8 top-8 w-52 rounded-2xl border border-white/40 bg-white/70 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#050814]/70"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Live Portal</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
        </div>
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-indigo-500/70" />
          <div className="h-2 w-3/4 rounded-full bg-sky-400/60" />
          <div className="h-2 w-1/2 rounded-full bg-fuchsia-400/60" />
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 right-7 w-56 rounded-2xl border border-white/40 bg-slate-950/75 p-4 text-white shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-300">
          <span>Attendance</span>
          <span className="text-emerald-300">Safe</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[9px] font-bold text-slate-300">
          <span>Marks</span>
          <span>Mess</span>
          <span>FFCS</span>
        </div>
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/70 to-transparent dark:from-[#03060F]/80" />
    </motion.div>
  );
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
      <InteractiveCursor />
      
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
        .glass-nav {
          background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.34));
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        }
        .dark .glass-nav {
          background: linear-gradient(135deg, rgba(3,6,15,0.74), rgba(30,41,59,0.28));
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }
      `}</style>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />
      <ParticleField />

      {/* Navbar */}
      <nav className={`fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-7xl -translate-x-1/2 rounded-2xl border transition-all duration-500 ${isScrolled ? "glass-nav border-white/50 backdrop-blur-2xl dark:border-white/10" : "border-white/30 bg-white/25 backdrop-blur-sm dark:border-white/5 dark:bg-white/[0.03]"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setShowLoginCard(false)}>
              <img src="/logo.png" alt="AmazeCC Logo" className="h-7 w-7 rounded-lg object-contain shadow-md" onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/icons/AmazeCC.png";
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
            <section className="relative max-w-7xl mx-auto px-6 pt-32 pb-24 lg:pt-44 lg:pb-36">
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
                    <AnimatedStat value={30} suffix="+" label="Student Tools" />
                    <AnimatedStat value={10} suffix="+" label="Modules" />
                    <AnimatedStat value={100} suffix="%" label="Free & Local" accent />
                  </div>
                </div>

                {/* Hero Centerpiece Artwork Right */}
                <div className="lg:col-span-6 relative flex justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-[120px] rounded-full -z-10 animate-pulse duration-4000" />
                  <MouseReactiveHeroScene />
                </div>

              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 translate-y-1/2 bg-gradient-to-b from-transparent via-indigo-500/10 to-slate-100/70 blur-2xl dark:via-fuchsia-500/10 dark:to-[#02040a]" />
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
                  <TiltCard key={idx} className="bg-white/80 border border-slate-200/80 hover:border-indigo-500/30 dark:bg-[#050814]/70 dark:border-neutral-900 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-[#070b1c]/80 transition-colors shadow-xs dark:shadow-none group backdrop-blur-xl">
                    <div className="space-y-3">
                      <span className="text-3xl block shrink-0">{feat.emoji}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{feat.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-medium">{feat.desc}</p>
                    </div>
                  </TiltCard>
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
                    <TiltCard key={idx} className="bg-white/80 border border-slate-200 dark:bg-neutral-950/50 dark:border-neutral-900 p-6 rounded-2xl space-y-2 shadow-xs dark:shadow-none backdrop-blur-xl">
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">{benefit.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-455 leading-relaxed font-medium">{benefit.desc}</p>
                    </TiltCard>
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

                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">Registration Number</label>
                      <input
                        className="w-full border border-slate-200 bg-slate-50 dark:border-neutral-900 dark:bg-neutral-950 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-semibold uppercase"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="E.g., 22BCE0001"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider pl-0.5">VTOP Password</label>
                      <div className="relative">
                        <input
                          className="w-full border border-slate-200 bg-slate-50 dark:border-neutral-900 dark:bg-neutral-950 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-semibold"
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
                            <input
                              type="checkbox"
                              checked={isDayscholarWithBus}
                              onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 dark:border-neutral-800 text-indigo-500 focus:ring-indigo-500/50"
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-gray-300">I have registered transport (bus)</span>
                          </label>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-extrabold text-white text-xs transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98] focus:ring-2 focus:ring-indigo-400/50 cursor-pointer"
                      >
                        Authenticate
                      </button>
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
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-[10px] font-semibold">
            Made with ❤️ by students. Not affiliated with VIT or VTOP.
          </p>
        </div>
      </footer>

    </div>
  );
}
