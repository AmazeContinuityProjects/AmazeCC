"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Sparkles, LayoutGrid, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight, 
  Check, GraduationCap, Bus, Bell, Palette, ShieldCheck, ChevronDown, 
  Sliders, User, Calendar, CalendarCheck, Car, CreditCard, Key, Smartphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAssetPath } from "@/lib/utils";
import { fetchGitHubCommits } from "@/lib/githubChangelog";
import buildInfo from "../../../data/buildInfo.json";
import config from "../../../../config.json";
import { API_BASE } from "../Main";
import SimplifiedMobileHome from "../mobile/SimplifiedMobileHome";
import MobileHome from "../mobile/MobileHome";
import AttendanceTabs from "../attendance/AttendanceTabs";

export type InterfaceOptionId = "simplified" | "classic" | "attendance";

const COLOR_PALETTES = [
  { id: "default", label: "Ocean", color: "#0ea5e9" },
  { id: "neonPink", label: "Pink", color: "#ff2bd6" },
  { id: "forest", label: "Forest", color: "#059669" },
  { id: "rose", label: "Rose", color: "#e11d48" },
  { id: "amber", label: "Amber", color: "#d97706" },
];

const AVAILABLE_NAV_TABS: Array<{ id: string; label: string; icon: any; desc: string }> = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck, desc: "Timetable & bunk margin" },
  { id: "academics", label: "Academics", icon: GraduationCap, desc: "Marks, CGPA & curriculum" },
  { id: "cabshare", label: "Cab Share", icon: Car, desc: "Share rides & airport cabs" },
  { id: "transport", label: "Transport", icon: Bus, desc: "College bus routes & timings" },
  { id: "payments", label: "Payments", icon: CreditCard, desc: "Tuition & hostel receipts" },
  { id: "credentials", label: "Credentials", icon: Key, desc: "Fast WiFi & VTOP auto-login" },
];

interface AmazeOnboardingFlowProps {
  initialStep?: number;
  isStandaloneInterfacePicker?: boolean;
  settings: any;
  setSettings: (fn: any) => void;
  username?: string;
  onComplete: (semesterId?: string) => void;
  // Dashboard Live Props for Live Preview
  attendanceData?: any;
  marksData?: any;
  hostelData?: any;
  registeredEvents?: any;
  moodleData?: any;
  IDs?: any;
  profileData?: any;
  ODhoursData?: any;
  calendarData?: any;
  ScheduleData?: any;
  setGradesDisplayIsOpen?: (val: boolean) => void;
  setODhoursIsOpen?: (val: boolean) => void;
  handleReloadRequest?: (semId?: string) => Promise<any>;
  onOpenCommandPalette?: () => void;
  // Fresher Data
  eptData?: any;
  acknowledgementData?: any;
}

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

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function AmazeOnboardingFlow({
  initialStep = 0,
  isStandaloneInterfacePicker = false,
  settings,
  setSettings,
  username = "",
  onComplete,
  attendanceData,
  marksData,
  hostelData,
  registeredEvents,
  moodleData,
  IDs,
  profileData,
  ODhoursData,
  calendarData,
  ScheduleData,
  setGradesDisplayIsOpen,
  setODhoursIsOpen,
  handleReloadRequest,
  onOpenCommandPalette,
  eptData,
  acknowledgementData,
}: AmazeOnboardingFlowProps) {
  const [step, setStep] = useState(initialStep);
  const [temp, setTemp] = useState({
    ...settings,
    pinnedNavTabs: settings?.pinnedNavTabs || ["attendance", "academics", "cabshare"],
    showProfilePhoto: settings?.showProfilePhoto ?? true,
    isDayscholarWithBus: settings?.isDayscholarWithBus ?? false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  });

  // Dynamic Viewport Aspect Ratio for the live preview island
  const [viewportRatio, setViewportRatio] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return Math.min(0.75, Math.max(0.42, w / Math.max(1, h)));
    }
    return 9 / 19;
  });

  useEffect(() => {
    const updateRatio = () => {
      if (typeof window !== "undefined") {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setViewportRatio(Math.min(0.75, Math.max(0.42, w / Math.max(1, h))));
      }
    };
    updateRatio();
    window.addEventListener("resize", updateRatio);
    return () => window.removeEventListener("resize", updateRatio);
  }, []);

  // Pre-emptively mark latest commit hash so new users don't see "What's New" modal
  useEffect(() => {
    try {
      fetchGitHubCommits()
        .then((commits) => {
          if (commits && commits.length > 0) {
            localStorage.setItem("lastSeenCommitHash", commits[0].sha);
          } else if (buildInfo?.commitHash) {
            localStorage.setItem("lastSeenCommitHash", buildInfo.commitHash);
          }
        })
        .catch(() => {
          if (buildInfo?.commitHash) {
            localStorage.setItem("lastSeenCommitHash", buildInfo.commitHash);
          }
        });
    } catch {}
  }, []);

  const interfaces: Array<{
    id: InterfaceOptionId;
    title: string;
    icon: any;
  }> = [
    {
      id: "simplified",
      title: "Minimal Dashboard",
      icon: Sparkles,
    },
    {
      id: "classic",
      title: "Classic Multi-Widget",
      icon: LayoutGrid,
    },
    {
      id: "attendance",
      title: "Direct Attendance",
      icon: CheckCircle2,
    },
  ];

  const initialModeIdx = Math.max(
    0,
    interfaces.findIndex(
      (i) => i.id === (temp.defaultLandingTab === "attendance" ? "attendance" : temp.dashboardViewMode || "simplified")
    )
  );
  const [activeInterfaceIdx, setActiveInterfaceIdx] = useState(initialModeIdx >= 0 ? initialModeIdx : 0);

  const currentOption = interfaces[activeInterfaceIdx];

  const update = (key: string, val: any) => {
    setTemp((prev: any) => ({ ...prev, [key]: val }));
  };

  const togglePinnedTab = (tabId: string) => {
    const current = temp.pinnedNavTabs || [];
    const isPinned = current.includes(tabId);
    if (!isPinned && current.length >= 4) return;
    const next = isPinned ? current.filter((id: string) => id !== tabId) : [...current, tabId];
    update("pinnedNavTabs", next);
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else finish();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const finish = () => {
    const finalSettings = {
      ...temp,
      dashboardViewMode: currentOption.id === "classic" ? "classic" : "simplified",
      defaultLandingTab: currentOption.id === "attendance" ? "attendance" : "home",
      interfaceChosen: true,
    };
    try {
      localStorage.setItem("settings", JSON.stringify(finalSettings));
      localStorage.setItem("has_selected_interface", "true");
      localStorage.setItem("introDone", "true");
      localStorage.setItem("hasSeenPushPrompt", "true");
      localStorage.setItem("push_prompt_dismissed", "true");
      localStorage.setItem("busPromptDismissed", "true");

      if (buildInfo?.commitHash) {
        localStorage.setItem("lastSeenCommitHash", buildInfo.commitHash);
      }
    } catch {}

    setSettings(() => finalSettings);
    onComplete(finalSettings.currSemesterID);
  };

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotifEnabled(true);
        localStorage.setItem("hasSeenPushPrompt", "true");
        localStorage.setItem("push_prompt_dismissed", "true");

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidPublicKey && (username || IDs?.VtopUsername) && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });

          await fetch(`${API_BASE}/api/notifications/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              UserID: username || IDs?.VtopUsername,
              subscription: JSON.parse(JSON.stringify(sub)),
              vitol_enabled: false,
              vitol_reminder_day: 1,
              vitol_reminder_time: "10:00",
            }),
          });
        }
      } else {
        setNotifEnabled(false);
      }
    } catch (err) {
      console.error("Failed to enable push notifications", err);
    } finally {
      setNotifLoading(false);
    }
  };

  // Preview settings proxy for live dashboard render
  const previewSettings = {
    ...temp,
    dashboardViewMode: currentOption.id === "classic" ? "classic" : "simplified",
    defaultLandingTab: currentOption.id === "attendance" ? "attendance" : "home",
    timetablePillStyle: temp.timetablePillStyle || "compact",
  };

  const totalSteps = 5;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none px-5 sm:px-8 py-5 sm:py-8 animate-in fade-in duration-300">
      
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-violet-600/10 blur-[150px]" />
      </div>

      {/* ── TOP BAR: BACK BUTTON, PROGRESS PILLS & STEP TITLE ── */}
      <header className="relative z-20 w-full max-w-md sm:max-w-lg mx-auto flex items-center justify-between shrink-0 pt-1">
        {step > 0 && !isStandaloneInterfacePicker ? (
          <button
            onClick={prevStep}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5 px-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div className="w-16" />
        )}

        {/* Step Indicator Pills */}
        {!isStandaloneInterfacePicker && (
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-7 bg-indigo-500 shadow-xs shadow-indigo-500/50" : i < step ? "w-2.5 bg-indigo-400/50" : "w-2 bg-zinc-800"
                }`}
              />
            ))}
          </div>
        )}

        {!isStandaloneInterfacePicker ? (
          <span className="text-[11px] font-bold text-zinc-400 font-outfit">
            Step {step + 1} of {totalSteps}
          </span>
        ) : (
          <div className="w-16" />
        )}
      </header>

      {/* ── MAIN STEP CONTENT (SPACIOUS & CENTERED) ── */}
      <main className="relative z-20 w-full max-w-md sm:max-w-lg mx-auto flex-1 flex flex-col items-center justify-center my-auto min-h-0 py-2">
        <AnimatePresence mode="wait">
          
          {/* ──── STEP 0: WELCOME, SEMESTER & CAMPUS/BUS RESIDENCY ──── */}
          {step === 0 && !isStandaloneInterfacePicker && (
            <motion.div
              key="step-profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-4 sm:space-y-5 text-center"
            >
              <div className="flex flex-col items-center gap-2.5">
                <img
                  src={getAssetPath("/logo.png")}
                  alt="AmazeCC"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain shadow-lg border border-zinc-800 p-0.5 bg-zinc-900"
                />
                <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                  Welcome to AmazeCC
                </h1>
                <p className="text-xs text-zinc-400 font-medium max-w-xs">
                  Set up your personalized college companion in seconds.
                </p>
              </div>

              {/* Profile Card */}
              <div className="p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left">
                
                {/* Friendly Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                    What should we call you?
                  </label>
                  <input
                    type="text"
                    value={temp.friendlyName || ""}
                    onChange={(e) => update("friendlyName", e.target.value)}
                    placeholder={username || IDs?.VtopUsername || "Your Name"}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                  />
                </div>

                {/* Current Semester Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                    Current Semester
                  </label>
                  <div className="relative">
                    <select
                      value={temp.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                      onChange={(e) => update("currSemesterID", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      {config.semesterIDs.map((semId: string) => (
                        <option key={semId} value={semId} className="bg-zinc-900 text-white">
                          {formatSemesterName(semId)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Campus Residency & Bus Mode */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                    Campus Residency & Commute
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: "hosteller", label: "Hosteller", desc: "Living on campus", icon: GraduationCap },
                      { id: "dayscholar", label: "Day Scholar", desc: "Daily commuter", icon: Bus },
                    ].map((opt) => {
                      const isSelected = temp.residentialStatus === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            update("residentialStatus", opt.id);
                            if (opt.id === "hosteller") update("isDayscholarWithBus", false);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-20 cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600/10 border-indigo-500 text-white ring-1 ring-indigo-500/20"
                              : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          }`}
                        >
                          <opt.icon className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-zinc-500"}`} />
                          <div>
                            <p className="font-extrabold text-xs text-white font-outfit">{opt.label}</p>
                            <p className="text-[9.5px] text-zinc-500">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* College Bus Registration Toggle */}
                  <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <Bus className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">College Bus User?</p>
                        <p className="text-[9.5px] text-zinc-500">Enable bus routes and stops</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update("isDayscholarWithBus", !temp.isDayscholarWithBus)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        temp.isDayscholarWithBus
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {temp.isDayscholarWithBus ? "Registered ✓" : "No"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── STEP 1: CHOOSE YOUR INTERFACE (ISLAND CAROUSEL WITH DYNAMIC ASPECT RATIO) ──── */}
          {(step === 1 || isStandaloneInterfacePicker) && (
            <motion.div
              key="step-interface"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-1 flex flex-col items-center justify-center my-auto min-h-0 space-y-3"
            >
              {/* Header inside interface picker */}
              <div className="flex flex-col items-center text-center space-y-2 shrink-0">
                <img
                  src={getAssetPath("/logo.png")}
                  alt="AmazeCC"
                  className="w-11 h-11 rounded-2xl object-contain shadow-md border border-zinc-800 p-0.5 bg-zinc-900"
                />
                <h2 className="text-xl sm:text-2xl font-black text-white font-outfit tracking-tight">
                  Choose your interface
                </h2>

                {/* Icon-Only Option Bar */}
                <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-zinc-900/90 border border-zinc-800/90 backdrop-blur-xl shadow-lg">
                  {interfaces.map((item, idx) => {
                    const isCurrent = activeInterfaceIdx === idx;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveInterfaceIdx(idx)}
                        title={item.title}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          isCurrent
                            ? "bg-indigo-600 text-white shadow-md scale-105"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                        }`}
                      >
                        <item.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Aspect Ratio Preview Island */}
              <div
                style={{
                  aspectRatio: `${viewportRatio}`,
                }}
                className="h-[52vh] sm:h-[58vh] max-h-[600px] max-w-[88vw] rounded-[36px] sm:rounded-[40px] border-2 border-zinc-800/90 bg-zinc-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col relative text-left ring-1 ring-white/10"
              >
                {/* Scaled Preview Inner Body (Fluid 100% / 0.65 scale to prevent right-edge overflow) */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-thin scrollbar-thumb-zinc-700 select-none">
                  <div
                    style={{
                      width: "153.85%",
                      transform: "scale(0.65)",
                      transformOrigin: "top left",
                      marginBottom: "-53.85%",
                      marginRight: "-53.85%",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentOption.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                      >
                        {currentOption.id === "simplified" && (
                          <SimplifiedMobileHome
                            attendanceData={attendanceData}
                            marksData={marksData}
                            hostelData={hostelData}
                            registeredEvents={registeredEvents}
                            moodleData={moodleData}
                            settings={previewSettings}
                            setSettings={setSettings}
                            IDs={IDs}
                            setActiveTab={() => {}}
                            setActiveSubTab={() => {}}
                            setHostelActiveSubTab={() => {}}
                            setActiveAttendanceSubTab={() => {}}
                            setActiveMoreSubTab={() => {}}
                            setActiveProfileSubTab={() => {}}
                            handleReloadRequest={handleReloadRequest}
                            onOpenCommandPalette={onOpenCommandPalette}
                            profileData={profileData}
                            ODhoursData={ODhoursData}
                            calendarData={calendarData}
                            ScheduleData={ScheduleData}
                            setGradesDisplayIsOpen={setGradesDisplayIsOpen}
                            setODhoursIsOpen={setODhoursIsOpen}
                          />
                        )}

                        {currentOption.id === "classic" && (
                          <MobileHome
                            attendanceData={attendanceData}
                            marksData={marksData}
                            hostelData={hostelData}
                            registeredEvents={registeredEvents}
                            moodleData={moodleData}
                            settings={previewSettings}
                            setSettings={setSettings}
                            IDs={IDs}
                            setActiveTab={() => {}}
                            setActiveSubTab={() => {}}
                            setHostelActiveSubTab={() => {}}
                            setActiveAttendanceSubTab={() => {}}
                            setActiveMoreSubTab={() => {}}
                            setActiveProfileSubTab={() => {}}
                            handleReloadRequest={handleReloadRequest}
                            onOpenCommandPalette={onOpenCommandPalette}
                            profileData={profileData}
                            ODhoursData={ODhoursData}
                          />
                        )}

                        {currentOption.id === "attendance" && (
                          <div className="space-y-4">
                            <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 text-left">
                              <h4 className="text-xs font-bold text-indigo-300 font-outfit">
                                Direct Attendance Mode
                              </h4>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                Opens straight into your Course Attendance list.
                              </p>
                            </div>
                            {attendanceData?.attendance && (
                              <AttendanceTabs
                                data={attendanceData}
                                marksData={marksData}
                                ODhoursData={ODhoursData}
                                settings={previewSettings}
                                setSettings={setSettings}
                                calendarData={calendarData}
                                moodleData={moodleData}
                                scheduleData={ScheduleData}
                                isDayscholarWithBus={settings?.isDayscholarWithBus || false}
                                setIsSubpageOpen={() => {}}
                              />
                            )}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── STEP 2: PERSONALIZATION, AVATAR & GOALS ──── */}
          {step === 2 && !isStandaloneInterfacePicker && (
            <motion.div
              key="step-personalization"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-4 sm:space-y-5 text-center"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Palette className="w-6 h-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                  Display & Goals
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  Set your avatar, colors, and attendance safe goals.
                </p>
              </div>

              {/* Preferences Card */}
              <div className="p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left">
                
                {/* Dashboard Avatar Option */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                    Dashboard Greeting Avatar
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => update("showProfilePhoto", true)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        temp.showProfilePhoto !== false
                          ? "bg-indigo-600/10 border-indigo-500 text-white ring-1 ring-indigo-500/20"
                          : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-zinc-800 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-xs">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-white font-outfit truncate">Profile Photo</p>
                        <p className="text-[9px] text-zinc-500 truncate">Your VTOP picture</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => update("showProfilePhoto", false)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        temp.showProfilePhoto === false
                          ? "bg-indigo-600/10 border-indigo-500 text-white ring-1 ring-indigo-500/20"
                          : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <img
                        src={getAssetPath("/logo.png")}
                        alt="AmazeCC"
                        className="w-7 h-7 rounded-xl object-contain border border-zinc-800 p-0.5 bg-zinc-900 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-white font-outfit truncate">AmazeCC Logo</p>
                        <p className="text-[9px] text-zinc-500 truncate">Minimal app icon</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Target Attendance Goal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                      Target Attendance Goal
                    </label>
                    <span className="text-xs font-black text-indigo-400">
                      {temp.targetAttendance || 75}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[75, 80, 85].map((pct) => {
                      const isSelected = Number(temp.targetAttendance || 75) === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => update("targetAttendance", pct)}
                          className={`py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                              : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {pct}% Goal
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color Swatches */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                    Color Accent
                  </label>
                  <div className="flex items-center gap-2 justify-between">
                    {COLOR_PALETTES.map((p) => {
                      const isSelected = (temp.colorPalette === p.id) || (!temp.colorPalette && p.id === "default");
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => update("colorPalette", p.id)}
                          className={`flex-1 py-2 px-1 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected ? "border-white bg-zinc-800 shadow-xs" : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700"
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shadow-xs"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-[9px] font-bold text-zinc-400">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggle GPA */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Show GPA on Home</p>
                    <p className="text-[10px] text-zinc-500">Quick grade indicator card</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("showGpa", !temp.showGpa)}
                    className={`w-10 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                      temp.showGpa ? "bg-indigo-600" : "bg-zinc-800"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        temp.showGpa ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── STEP 3: CUSTOMIZE BOTTOM NAVIGATION TABS ──── */}
          {step === 3 && !isStandaloneInterfacePicker && (
            <motion.div
              key="step-bottomnav"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-4 sm:space-y-5 text-center"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                  Bottom Navigation
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  Pin up to 4 quick-access tabs for your mobile dock.
                </p>
              </div>

              {/* Bottom Nav Customizer Card */}
              <div className="p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3.5 text-left">
                
                {/* Live Dock Preview */}
                <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-around">
                  <div className="flex flex-col items-center gap-0.5 opacity-60">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[8px] font-bold text-zinc-400">Home</span>
                  </div>
                  {(temp.pinnedNavTabs || []).map((tId: string) => {
                    const found = AVAILABLE_NAV_TABS.find((x) => x.id === tId);
                    if (!found) return null;
                    const Icon = found.icon;
                    return (
                      <div key={tId} className="flex flex-col items-center gap-0.5 animate-in fade-in zoom-in duration-150">
                        <Icon className="w-3.5 h-3.5 text-white" />
                        <span className="text-[8px] font-extrabold text-white truncate max-w-[48px]">{found.label}</span>
                      </div>
                    );
                  })}
                  <div className="flex flex-col items-center gap-0.5 opacity-60">
                    <LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[8px] font-bold text-zinc-400">Apps</span>
                  </div>
                </div>

                {/* Tab Choices Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_NAV_TABS.map((tab) => {
                    const isPinned = (temp.pinnedNavTabs || []).includes(tab.id);
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => togglePinnedTab(tab.id)}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          isPinned
                            ? "bg-indigo-600/15 border-indigo-500 text-white shadow-xs"
                            : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isPinned ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-white font-outfit truncate">{tab.label}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{tab.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── STEP 4: SMART NOTIFICATIONS & READY ──── */}
          {step === 4 && !isStandaloneInterfacePicker && (
            <motion.div
              key="step-notifications"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-4 sm:space-y-5 text-center"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Bell className="w-6 h-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                  Stay Ahead of Classes
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  Instant class alerts and low attendance safeguards.
                </p>
              </div>

              {/* Notification & Launch Card */}
              <div className="p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-3 text-left">
                {[
                  { title: "Timetable Reminders", desc: "15 minutes before your class", icon: "⏰" },
                  { title: "Attendance Safeguard", desc: "Alert if attendance drops below 75%", icon: "🚨" },
                  { title: "Exam Seat & Venue Alerts", desc: "Live seating and room schedules", icon: "📝" },
                ].map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/60">
                    <span className="text-base">{perk.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-white">{perk.title}</p>
                      <p className="text-[10px] text-zinc-500">{perk.desc}</p>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={enableNotifications}
                  disabled={notifLoading || notifEnabled}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-2 ${
                    notifEnabled
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer"
                  }`}
                >
                  {notifEnabled ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Instant Alerts Enabled</span>
                    </>
                  ) : notifLoading ? (
                    <span>Enabling Alerts...</span>
                  ) : (
                    <span>Enable Class Alerts</span>
                  )}
                </button>

                {/* Fresher Specific Callout if detected */}
                {eptData?.tables?.[0]?.rows?.length > 0 && (
                  <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 space-y-0.5 mt-2">
                    <span className="text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      Fresher Schedule Active
                    </span>
                    <p className="text-[11px] font-bold text-zinc-300">EPT & Orientation Schedule integrated into your calendar.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── BOTTOM ACTION BAR (GENEROUS SPACING & DUAL ARROWS) ── */}
      <footer className="relative z-20 w-full max-w-sm sm:max-w-md mx-auto flex items-center justify-center gap-2.5 shrink-0 pb-1 sm:pb-3">
        {/* If on interface step, provide left & right carousel arrows */}
        {(step === 1 || isStandaloneInterfacePicker) && (
          <button
            onClick={() => setActiveInterfaceIdx((prev) => (prev - 1 + interfaces.length) % interfaces.length)}
            aria-label="Previous Interface"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Main CTA Button */}
        <button
          onClick={nextStep}
          className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl transition-all active:scale-95 cursor-pointer font-outfit tracking-wide flex items-center justify-center gap-2 truncate"
        >
          <span className="truncate">
            {isStandaloneInterfacePicker
              ? `Select ${currentOption.title}`
              : step === 4
              ? "Launch AmazeCC"
              : step === 1
              ? `Continue with ${currentOption.title}`
              : "Continue"}
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>

        {/* If on interface step, provide right arrow */}
        {(step === 1 || isStandaloneInterfacePicker) && (
          <button
            onClick={() => setActiveInterfaceIdx((prev) => (prev + 1) % interfaces.length)}
            aria-label="Next Interface"
            className="w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </footer>
    </div>
  );
}
