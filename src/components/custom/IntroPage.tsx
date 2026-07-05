"use client";
import { useState, useMemo } from "react";
import {
  GraduationCap, Bus, Check, ChevronRight, ChevronLeft, Sparkles, ChevronDown, Bell
} from "lucide-react";
import config from "../../../config.json";
import { API_BASE } from "./Main";

const COLOR_PALETTES = [
  { id: "default", label: "Default", swatches: ["#0ea5e9", "#ffffff", "#f8fafc"] },
  { id: "neonPink", label: "Neon Pink", swatches: ["#ff2bd6", "#ffffff", "#fff7fd"] },
  { id: "forest", label: "Forest", swatches: ["#059669", "#ffffff", "#f7fee7"] },
  { id: "rose", label: "Rose", swatches: ["#e11d48", "#ffffff", "#fff1f2"] },
  { id: "amber", label: "Amber", swatches: ["#d97706", "#ffffff", "#fffbeb"] },
  { id: "custom", label: "Custom", swatches: ["#0ea5e9", "#ffffff", "#f8fafc"] },
];

const steps = [
  "welcome",
  "profile",          // Combined: Semester, Residential Status, and Bus mode
  "personalization",  // Combined: Accent color, Display options, and Pinned tabs
  "done",
] as const;

interface IntroPageProps {
  settings: any;
  username?: string;
  setSettings: (fn: any) => void;
  onComplete: (semesterId?: string) => void;
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
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function IntroPage({ settings, username, setSettings, onComplete }: IntroPageProps) {
  const [step, setStep] = useState(0);
  const [temp, setTemp] = useState({ ...settings });
  
  // Notification loading & status
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  });

  const accentVal = useMemo(() => {
    if (temp.colorPalette === "custom" && temp.customPalette?.accent) {
      return temp.customPalette.accent;
    }
    const palette = COLOR_PALETTES.find(x => x.id === temp.colorPalette);
    return palette?.swatches[0] ?? COLOR_PALETTES[0].swatches[0];
  }, [temp.colorPalette, temp.customPalette?.accent]);

  const update = (key: string, val: any) => {
    setTemp((prev: any) => ({ ...prev, [key]: val }));
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const finish = () => {
    setSettings(() => {
      const merged = { ...temp };
      localStorage.setItem("settings", JSON.stringify(merged));
      return merged;
    });
    onComplete(temp.currSemesterID);
  };

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotifEnabled(true);
        localStorage.setItem('hasSeenPushPrompt', 'true');

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidPublicKey && username && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          
          await fetch(`${API_BASE}/api/notifications/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              UserID: username,
              subscription: JSON.parse(JSON.stringify(sub)),
              vitol_enabled: false,
              vitol_reminder_day: 1,
              vitol_reminder_time: "10:00"
            }),
          });
          
          new Notification("Welcome to AmazeCC Alerts!", {
            body: "Push notifications are now enabled.",
            icon: "/favicon.ico"
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 sm:p-6 transition-all duration-300">
      <div className="w-full max-w-md mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? "w-6" : "bg-gray-200 dark:bg-gray-800 w-2"
              }`}
              style={i <= step ? { backgroundColor: accentVal } : undefined}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-7 shadow-xl transition-all duration-300">

          {/* Welcome Screen */}
          {steps[step] === "welcome" && (
            <div className="text-center space-y-5 py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse" style={{ backgroundColor: accentVal }}>
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Welcome to AmazeCC!</h1>
                <p className="text-sm text-gray-550 dark:text-gray-400 leading-relaxed">
                  Let&apos;s personalize your companion app in just a few clicks. You can adjust all settings later.
                </p>
              </div>
            </div>
          )}

          {/* Profile Screen: Semester, Residential Status, and Bus */}
          {steps[step] === "profile" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Campus Profile</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Configure your active semester and campus presence.</p>
              </div>

              {/* Semester Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider">Current Semester</label>
                <div className="relative">
                  <select
                    value={temp.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                    onChange={(e) => update("currSemesterID", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-55/40 dark:bg-neutral-900/50 text-sm font-black text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all appearance-none cursor-pointer"
                  >
                    {config.semesterIDs.map((semId: string) => (
                      <option key={semId} value={semId} className="bg-white dark:bg-neutral-950 text-gray-900 dark:text-white">
                        {formatSemesterName(semId)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Residential Status Grid */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider">Living Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "hosteller", label: "Hosteller", desc: "Live on campus", icon: GraduationCap },
                    { id: "dayscholar", label: "Dayscholar", desc: "Commute daily", icon: Bus },
                  ].map(opt => {
                    const selected = temp.residentialStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          update("residentialStatus", opt.id);
                          if (opt.id === "hosteller") {
                            update("isDayscholarWithBus", false);
                          }
                        }}
                        className="p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-24"
                        style={{
                          borderColor: selected ? accentVal : "rgba(229, 231, 235, 0.4)",
                          backgroundColor: selected ? `${accentVal}0a` : "rgba(243, 244, 246, 0.2)",
                        }}
                      >
                        <opt.icon className="w-5 h-5" style={{ color: selected ? accentVal : "#9ca3af" }} />
                        <div>
                          <p className="font-extrabold text-xs text-gray-900 dark:text-white">{opt.label}</p>
                          <p className="text-[10px] text-gray-550 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bus Mode (Conditional) */}
              {temp.residentialStatus === "dayscholar" && (
                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-neutral-800/80 bg-gray-50/20 dark:bg-neutral-900/10 flex items-center justify-between animate-fadeIn">
                  <div>
                    <p className="text-xs font-extrabold text-gray-900 dark:text-white">College Bus User?</p>
                    <p className="text-[10px] text-gray-550 dark:text-gray-400 mt-0.5">Enable routes & timings.</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { label: "Yes", value: true },
                      { label: "No", value: false }
                    ].map(btn => {
                      const active = temp.isDayscholarWithBus === btn.value;
                      return (
                        <button
                          key={String(btn.value)}
                          type="button"
                          onClick={() => update("isDayscholarWithBus", btn.value)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all"
                          style={{
                            borderColor: active ? accentVal : "transparent",
                            backgroundColor: active ? `${accentVal}15` : "rgba(243, 244, 246, 0.5)",
                            color: active ? accentVal : undefined
                          }}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personalization Screen: Colors, Toggles, and Tabs */}
          {steps[step] === "personalization" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Personalize</h2>
                <p className="text-xs text-gray-550 dark:text-gray-400">Tailor the layout and style to your liking.</p>
              </div>

              {/* Accent Color Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider">Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PALETTES.map(palette => {
                    const active = (temp.colorPalette === palette.id) || (!temp.colorPalette && palette.id === "default");
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => {
                          update("colorPalette", palette.id);
                          if (palette.id !== "custom") {
                            const c = palette.swatches[0];
                            update("customPalette", {
                              accent: c,
                              background: palette.swatches[1],
                              surface: palette.swatches[2]
                            });
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all cursor-pointer hover:bg-gray-50/50 dark:hover:bg-neutral-900/10"
                        style={{
                          borderColor: active ? accentVal : "rgba(229, 231, 235, 0.4)",
                          backgroundColor: active ? `${accentVal}05` : "transparent"
                        }}
                      >
                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-gray-200">{palette.label}</span>
                        <span className="flex -space-x-1">
                          {palette.swatches.slice(0, 3).map(color => (
                            <span
                              key={color}
                              className="h-3 w-3 rounded-full border border-white dark:border-neutral-950 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Pickers (Conditional) */}
              {temp.colorPalette === "custom" && (
                <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl border border-gray-150 dark:border-neutral-900 bg-gray-50/20 dark:bg-neutral-950/10 animate-fadeIn">
                  {[
                    { key: "accent", label: "Accent", default: "#0ea5e9" },
                    { key: "background", label: "Page Bg", default: "#ffffff" },
                    { key: "surface", label: "Container", default: "#f8fafc" },
                  ].map(opt => (
                    <div key={opt.key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-300">{opt.label}</span>
                      <div className="relative w-12 h-7 rounded-lg overflow-hidden border border-gray-250 dark:border-gray-800 shadow-2xs">
                        <input
                          type="color"
                          value={temp.customPalette?.[opt.key] || opt.default}
                          onChange={(e) => {
                            const val = e.target.value;
                            update("customPalette", {
                              ...(temp.customPalette || {}),
                              [opt.key]: val,
                            });
                          }}
                          className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer bg-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Privacy & Notifications */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider">Privacy & Alerts</label>
                <div className="space-y-2">
                  {/* Push Notifications permission */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-neutral-900 bg-gray-50/10 dark:bg-neutral-950/10">
                    <div>
                      <p className="text-xs font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>Push Notifications</span>
                        {notifLoading && <span className="w-2.5 h-2.5 border-2 border-t-transparent border-info rounded-full animate-spin inline-block" />}
                      </p>
                      <p className="text-[9px] text-gray-550 dark:text-gray-400 mt-0.5">
                        Never miss a class! Get weekly alerts on this device.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={notifLoading || notifEnabled}
                      onClick={enableNotifications}
                      className="w-8 h-4.5 rounded-full transition-all relative flex items-center shrink-0 cursor-pointer disabled:opacity-85"
                      style={{ backgroundColor: notifEnabled ? accentVal : "#d1d5db" }}
                    >
                      <div
                        className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                          notifEnabled ? "left-[13px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Standard toggles */}
                  {[
                    { key: "CGPAHidden", label: "Hide CGPA from Profile Card", desc: "Blurs your CGPA score on dashboard" },
                    { key: "hideProfileImageOutsideInfo", label: "Hide Profile Photo", desc: "Only visible under Info tab" },
                  ].map(opt => {
                    const isOn = temp[opt.key] === true;
                    return (
                      <div
                        key={opt.key}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-neutral-900 bg-gray-50/10 dark:bg-neutral-950/10"
                      >
                        <div>
                          <p className="text-xs font-extrabold text-gray-900 dark:text-white">{opt.label}</p>
                          <p className="text-[9px] text-gray-550 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => update(opt.key, !isOn)}
                          className="w-8 h-4.5 rounded-full transition-all relative flex items-center shrink-0 cursor-pointer"
                          style={{ backgroundColor: isOn ? accentVal : "#d1d5db" }}
                        >
                          <div
                            className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                              isOn ? "left-[13px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pin navigation tabs */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider">Pin Navigation (max 4)</label>
                  <span className="text-[10px] font-black" style={{ color: accentVal }}>
                    {(temp.pinnedNavTabs || []).length}/4 selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "attendance", label: "Attendance" },
                    { id: "academics", label: "Academics" },
                    { id: "payments", label: "Payments" },
                    { id: "libraries", label: "Libraries" },
                    { id: "cabshare", label: "Cab Share" },
                    { id: "transport", label: "Transport" },
                    { id: "more", label: "More" },
                    { id: "profile", label: "Profile" },
                  ].map(tab => {
                    const pinned = temp.pinnedNavTabs ?? [];
                    const isPinned = pinned.includes(tab.id);
                    const atLimit = !isPinned && pinned.length >= 4;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        disabled={atLimit}
                        onClick={() => {
                          const current = temp.pinnedNavTabs ?? [];
                          update("pinnedNavTabs", isPinned
                            ? current.filter((id: string) => id !== tab.id)
                            : [...current, tab.id]
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer disabled:opacity-30"
                        style={{
                          backgroundColor: isPinned ? accentVal : "transparent",
                          borderColor: isPinned ? accentVal : "rgba(156, 163, 175, 0.3)",
                          color: isPinned ? "#ffffff" : undefined
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Celebration Screen */}
          {steps[step] === "done" && (
            <div className="text-center space-y-5 py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center animate-bounce" style={{ backgroundColor: accentVal }}>
                <Check className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">You&apos;re all set!</h1>
                <p className="text-sm text-gray-550 dark:text-gray-400 leading-relaxed">
                  Your profile and style preferences have been successfully configured. Tap below to launch your dashboard.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-5">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black text-gray-550 dark:text-gray-400 disabled:opacity-30 transition-all hover:bg-gray-100/50 dark:hover:bg-neutral-900/20 animate-fadeIn"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>

          <button
            type="button"
            onClick={steps[step] === "done" ? finish : next}
            className="flex items-center gap-1 rounded-xl text-white text-xs font-black transition-all shadow-md px-5 py-2.5 cursor-pointer"
            style={{ backgroundColor: accentVal }}
          >
            {steps[step] === "done" ? "Get Started" : steps[step] === "welcome" ? "Get Started" : "Next"} 
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
