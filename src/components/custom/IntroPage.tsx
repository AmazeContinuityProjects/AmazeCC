"use client";
import { useState, useMemo } from "react";
import {
  GraduationCap, Bus, Check, ChevronRight, ChevronLeft, Sparkles
} from "lucide-react";

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
  "residential",
  "bus",
  "semester",
  "accent",
  "display",
  "nav",
  "done",
] as const;

interface IntroPageProps {
  settings: any;
  setSettings: (fn: any) => void;
  onComplete: () => void;
}

export default function IntroPage({ settings, setSettings, onComplete }: IntroPageProps) {
  const [step, setStep] = useState(0);
  const [temp, setTemp] = useState({ ...settings });

  const accentVal = useMemo(() => {
    const palette = COLOR_PALETTES.find(x => x.id === temp.colorPalette);
    return palette?.swatches[0] ?? COLOR_PALETTES[0].swatches[0];
  }, [temp.colorPalette]);

  const update = (key: string, val: any) => {
    setTemp((prev: any) => ({ ...prev, [key]: val }));
  };

  const next = (skipBus?: boolean) => {
    let nextStep = step + 1;
    if (steps[nextStep] === "bus" && skipBus) {
      nextStep++;
    }
    if (nextStep < steps.length) setStep(nextStep);
  };

  const prev = () => {
    let prevStep = step - 1;
    if (steps[prevStep] === "bus" && temp.residentialStatus !== "dayscholar") {
      prevStep--;
    }
    if (prevStep >= 0) setStep(prevStep);
  };

  const finish = () => {
    setSettings(() => {
      const merged = { ...temp };
      localStorage.setItem("settings", JSON.stringify(merged));
      return merged;
    });
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.slice(0, -1).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? "w-6" : "bg-gray-200 dark:bg-gray-800 w-3"
              }`}
              style={i <= step ? { backgroundColor: accentVal } : undefined}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">

          {/* Welcome */}
          {steps[step] === "welcome" && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: accentVal }}>
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Welcome to AmazeCC!</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Let&apos;s get you set up in a few quick steps. You can always change these later in Settings.
              </p>
            </div>
          )}

          {/* Residential Status */}
          {steps[step] === "residential" && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Are you a Hosteller or Dayscholar?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">This determines which campus modules appear.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "hosteller", label: "Hosteller", desc: "Live on campus", icon: GraduationCap, skipBus: true },
                  { id: "dayscholar", label: "Dayscholar", desc: "Travel from home", icon: Bus, skipBus: false },
                ].map(opt => {
                  const selected = temp.residentialStatus === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { update("residentialStatus", opt.id); next(opt.skipBus); }}
                      className="p-4 rounded-2xl border-2 text-left transition-all"
                      style={{
                        borderColor: selected ? accentVal : undefined,
                        backgroundColor: selected ? `${accentVal}14` : undefined,
                      }}
                    >
                      <opt.icon className="w-6 h-6 mb-2" style={{ color: selected ? accentVal : undefined }} />
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bus Registration */}
          {steps[step] === "bus" && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Do you use the college bus?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">This enables bus tracking and transport features.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: true as const, label: "Yes", icon: Bus },
                  { id: false as const, label: "No", icon: null },
                ].map(opt => {
                  const selected = temp.isDayscholarWithBus === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      onClick={() => { update("isDayscholarWithBus", opt.id); next(); }}
                      className="p-4 rounded-2xl border-2 text-center transition-all"
                      style={{
                        borderColor: selected ? accentVal : undefined,
                        backgroundColor: selected ? `${accentVal}14` : undefined,
                      }}
                    >
                      {opt.icon ? (
                        <opt.icon className="w-6 h-6 mx-auto mb-2" style={{ color: accentVal }} />
                      ) : (
                        <div className="w-6 h-6 text-gray-400 mx-auto mb-2 flex items-center justify-center">
                          <span className="text-lg font-black">&#10005;</span>
                        </div>
                      )}
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{opt.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Semester */}
          {steps[step] === "semester" && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Select your current semester</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">Used for attendance and grade tracking.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {["ODD 2024", "EVEN 2024", "ODD 2025", "EVEN 2025", "ODD 2026", "EVEN 2026"].map(sem => {
                  const isSelected = temp.currSemesterID === sem;
                  return (
                    <button
                      key={sem}
                      onClick={() => { update("currSemesterID", sem); }}
                      className="p-3 rounded-xl border-2 text-center transition-all"
                      style={{
                        borderColor: isSelected ? accentVal : undefined,
                        backgroundColor: isSelected ? `${accentVal}14` : undefined,
                        color: isSelected ? accentVal : undefined,
                      }}
                    >
                      <p className="font-bold text-sm">{sem}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accent Color */}
          {steps[step] === "accent" && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Color Palette</p>
                <p className="text-xs text-gray-500 dark:text-gray-450">Pick a preset or tune your own colors</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PALETTES.map(palette => {
                  const active = (temp.colorPalette === palette.id) || (!temp.colorPalette && palette.id === "default");
                  return (
                    <button
                      key={palette.id}
                      type="button"
                      onClick={() => {
                        update("colorPalette", palette.id);
                        const c = palette.swatches[0];
                        update("customPalette", {
                          ...(temp.customPalette || {}),
                          accent: c,
                        });
                      }}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                        active
                          ? "border-info bg-info-surface"
                          : "border-gray-200 dark:border-gray-800 hover:bg-gray-100/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{palette.label}</span>
                      <span className="flex -space-x-1">
                        {palette.swatches.map(color => (
                          <span
                            key={color}
                            className="h-4 w-4 rounded-full border border-white/70 dark:border-slate-900 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display preferences */}
          {steps[step] === "display" && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Adjust your display</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">What shows up on your profile.</p>
              <div className="space-y-3">
                {[
                  { key: "CGPAHidden", label: "Hide CGPA", desc: "Hide your CGPA from the profile card" },
                  { key: "hideProfileImageOutsideInfo", label: "Hide profile image", desc: "Don&apos;t show your photo outside the Info page" },
                ].map(opt => {
                  const isOn = temp[opt.key] === true;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => update(opt.key, !isOn)}
                      className="w-full p-4 rounded-2xl border-2 text-left transition-all"
                      style={{
                        borderColor: isOn ? accentVal : undefined,
                        backgroundColor: isOn ? `${accentVal}14` : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">{opt.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" dangerouslySetInnerHTML={{ __html: opt.desc }} />
                        </div>
                        <div
                          className="w-10 h-6 rounded-full transition-all relative"
                          style={{ backgroundColor: isOn ? accentVal : undefined }}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              isOn ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pinned Nav Tabs */}
          {steps[step] === "nav" && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Pin your favourite tabs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">Choose up to 4 tabs for quick access in the bottom nav bar.</p>
              <div className="flex flex-wrap gap-2">
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
                      disabled={atLimit}
                      onClick={() => {
                        const current = temp.pinnedNavTabs ?? [];
                        update("pinnedNavTabs", isPinned
                          ? current.filter((id: string) => id !== tab.id)
                          : [...current, tab.id]
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                      style={isPinned ? {
                        backgroundColor: accentVal,
                        borderColor: accentVal,
                        color: '#fff',
                      } : atLimit ? undefined : undefined}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Done */}
          {steps[step] === "done" && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: accentVal }}>
                <Check className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">You&apos;re all set!</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Your preferences are saved. You can change them anytime from Settings.
              </p>
            </div>
          )}

        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 disabled:opacity-30 transition-all hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={steps[step] === "done" ? finish : steps[step] === "residential" ? undefined : () => next()}
            disabled={steps[step] === "residential"}
            className={`flex items-center gap-1.5 rounded-xl text-white text-sm font-bold transition-all shadow-sm ${
              steps[step] === "done" ? "px-6 py-2.5" : "px-5 py-2.5"
            } ${steps[step] === "residential" ? "invisible pointer-events-none" : ""}`}
            style={{ backgroundColor: accentVal }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
