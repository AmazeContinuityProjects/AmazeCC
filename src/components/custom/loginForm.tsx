"use client";

import { Eye, EyeOff, ArrowRight, Shield, Zap, Sparkles, LayoutGrid, Calendar, CalendarCheck2, Home, Search, BookOpen, Compass, ChevronLeft } from "lucide-react";
import { useState } from "react";
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
  const isLoading = message.startsWith("Logging");
  const [showPassword, setShowPassword] = useState(false);
  
  // Toggle landing page vs. login card
  const [showLoginCard, setShowLoginCard] = useState(false);

  const features = [
    {
      icon: <CalendarCheck2 className="h-5 w-5 text-sky-400" />,
      title: "Timetable & Attendance",
      desc: "Track daily lectures, check attendance stats, and simulate attendance impacts of skips ahead of exams."
    },
    {
      icon: <Home className="h-5 w-5 text-emerald-400" />,
      title: "Hostel Hub & Logistics",
      desc: "Inspect live mess menus, visual laundry slot grids mapped to your room, and track outing/leave histories."
    },
    {
      icon: <Zap className="h-5 w-5 text-amber-400" />,
      title: "CGPA & Target Predictor",
      desc: "Simulate required SGPA/CGPA goals, calculate grade thresholds, and visualize performance distributions."
    },
    {
      icon: <Search className="h-5 w-5 text-purple-400" />,
      title: "Offline Search & Archive",
      desc: "Find faculty information, exam question bank papers, payments history, and academic regulations instantly."
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100 flex flex-col justify-between selection:bg-sky-500/30 overflow-x-hidden relative">
      {/* Ambient background glowing circles */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-sky-500/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />
      </div>

      {/* Header bar */}
      <header className="px-6 py-4 border-b border-gray-900 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="AmazeCC Logo" className="h-7 w-7 rounded-lg object-contain shadow-md" onError={(e) => {
            (e.target as HTMLImageElement).src = "/images/icons/AmazeCC.png";
          }} />
          <span className="font-bold text-sm tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">AmazeCC</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDemoClick}
            className="text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Try Demo
          </button>
          {!showLoginCard && (
            <button
              onClick={() => setShowLoginCard(true)}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-12 px-4 md:px-8">
        {!showLoginCard ? (
          /* Landing Page View */
          <div className="max-w-4xl w-full text-center space-y-12 animate-fadeIn">
            {/* Hero text */}
            <div className="space-y-4 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 border border-sky-400/20 text-sky-400">
                <Sparkles size={11} /> VTOP, Redefined & Simplified
              </span>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white font-[family-name:var(--font-outfit)]">
                Academics. Simplified. <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Beautiful.</span>
              </h1>
              <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-medium">
                A premium, desktop-grade companion dashboard for VIT Chennai students. Access schedules, predicted grades, attendance calculations, and block details without the clutter.
              </p>
            </div>

            {/* Call to actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setShowLoginCard(true)}
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-sky-500/10 flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>Sign In with VTOP</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={handleDemoClick}
                className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-850 text-gray-300 font-bold text-xs px-6 py-3 rounded-xl border border-gray-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Live Demo</span>
              </button>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-3xl mx-auto pt-6">
              {features.map((f, i) => (
                <div key={i} className="bg-neutral-900/50 border border-gray-850 p-5 rounded-2xl space-y-2 hover:border-sky-500/30 hover:bg-neutral-900 transition-all shadow-2xs group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-neutral-950 border border-gray-850 rounded-xl group-hover:scale-105 transition-transform">
                      {f.icon}
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{f.title}</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-medium pl-0.5">{f.desc}</p>
                </div>
              ))}
            </div>

          </div>
        ) : (
          /* Improved Login Screen Card */
          <div className="w-full max-w-md animate-scaleIn">
            <button
              onClick={() => setShowLoginCard(false)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-4 transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} /> Back to product info
            </button>

            <form
              onSubmit={handleFormSubmit}
              className="bg-neutral-900/60 border border-gray-850 backdrop-blur-2xl rounded-2xl p-7 w-full space-y-6 shadow-2xl relative"
            >
              {/* VTOP verification badge */}
              <div className="flex items-center gap-2 border-b border-gray-850 pb-4 mb-2">
                <div className="p-2 bg-sky-500/10 border border-sky-400/20 text-sky-400 rounded-lg">
                  <Shield size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">VTOP Verification</h2>
                  <p className="text-[10px] text-gray-450 mt-0.5">Secure verification via VIT database</p>
                </div>
              </div>

              {message && (
                <div className={`p-3.5 rounded-xl border text-xs text-center font-bold ${
                  message.includes("failed") || message.includes("Invalid")
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    : "bg-sky-500/10 border-sky-400/20 text-sky-400"
                }`}>
                  {message}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Reg Number / Username</label>
                  <input
                    className="w-full border border-gray-850 bg-neutral-950 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-semibold uppercase"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="E.g., 22BCE0001"
                    disabled={isLoading}
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">VTOP Password</label>
                  <div className="relative">
                    <input
                      className="w-full border border-gray-850 bg-neutral-950 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-semibold"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded text-gray-400 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {!isLoading && (
                <>
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Residential Status</p>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => { setResidentialStatus("hosteller"); setIsDayscholarWithBus(false); }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          residentialStatus === "hosteller"
                            ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/10"
                            : "bg-neutral-950 text-gray-400 border-gray-850 hover:border-sky-500/30"
                        }`}
                      >
                        Hosteller
                      </button>
                      <button
                        type="button"
                        onClick={() => setResidentialStatus("dayscholar")}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          residentialStatus === "dayscholar"
                            ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/10"
                            : "bg-neutral-950 text-gray-400 border-gray-850 hover:border-sky-500/30"
                        }`}
                      >
                        Dayscholar
                      </button>
                    </div>
                    {residentialStatus === "dayscholar" && (
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-gray-850 cursor-pointer transition-all hover:border-sky-500/30">
                        <input
                          type="checkbox"
                          checked={isDayscholarWithBus}
                          onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500/50"
                        />
                        <span className="text-xs font-bold text-gray-300">I have registered transport (bus)</span>
                      </label>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-sky-500 hover:bg-sky-600 py-3 rounded-xl font-extrabold text-white text-xs transition-all shadow-md shadow-sky-500/10 active:scale-[0.98] focus:ring-2 focus:ring-sky-400/50 cursor-pointer"
                  >
                    Authenticate
                  </button>
                </>
              )}
            </form>
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="px-6 py-6 border-t border-gray-900 bg-neutral-950/70 text-center space-y-2">
        <p className="text-[10px] text-gray-500 max-w-sm mx-auto leading-relaxed font-semibold">
          Not affiliated with VIT or VTOP. Read our <Link href="/privacy" className="text-sky-400 hover:underline">Privacy Policy</Link> & <Link href="/terms" className="text-sky-400 hover:underline">Terms of Service</Link> before usage.
        </p>
      </footer>
    </div>
  );
}
