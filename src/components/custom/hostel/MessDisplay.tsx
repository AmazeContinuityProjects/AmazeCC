"use client";

import { useEffect, useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { settingsAtom } from "@/store/settingsAtoms";
import { RefreshCcw, Clock, Sparkles, Utensils, Sun, Coffee, Moon, CalendarCheck } from "lucide-react";
import { useIsMobile } from "../shared";
import { WORKER_BASE } from "@/lib/workerBase";

/**
 * Mess menus, served by the AmazeCC worker rather than fetched from unmessify's
 * GitHub Pages in the browser.
 *
 * The worker caches each file for six hours, so one upstream fetch covers the
 * whole campus instead of one per student per visit. The filename is also on an
 * allowlist in the worker, which is why this is a plain map of known files and
 * not something built from user input.
 */
const messLinks: Record<string, Record<string, string>> = {
  Male: {
    "Non Veg": `${WORKER_BASE}/unmessify/VITC-M-N.json`,
    Veg: `${WORKER_BASE}/unmessify/VITC-M-V.json`,
    Special: `${WORKER_BASE}/unmessify/VITC-M-S.json`,
  },
  Female: {
    "Non Veg": `${WORKER_BASE}/unmessify/VITC-W-N.json`,
    Veg: `${WORKER_BASE}/unmessify/VITC-W-V.json`,
    Special: `${WORKER_BASE}/unmessify/VITC-W-S.json`,
  },
};

const fullToShortDay: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

const shortToFullDay: Record<string, string> = Object.fromEntries(
  Object.entries(fullToShortDay).map(([full, short]) => [short, full]),
);

// Helper to determine current week of month (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22+)
const getCurrentWeekOfMonth = (d: Date = new Date()): number => {
  const day = d.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

// Smart menu parser: filters items for current week & removes week qualifiers
const getSmartMenuText = (rawText: string, weekNum: number): string => {
  if (!rawText || typeof rawText !== "string" || rawText.trim() === "" || rawText === "No items listed.") {
    return "No items listed.";
  }

  const lines = rawText.split("\n");
  const resultLines: string[] = [];

  lines.forEach((line) => {
    const l = line.trim();
    if (!l) return;

    if (l.includes("/") && /\bweek/i.test(l)) {
      const candidates = l.split("/");
      let activeCandidate = "";

      for (const cand of candidates) {
        const c = cand.trim();
        const weekMatch = c.match(/\b(?:weeks?|w)\s*[:\(\[]?\s*([\d\s&,and]+)[\)\]]?/i);
        if (weekMatch) {
          const numbers = weekMatch[1].match(/\d+/g)?.map(Number) || [];
          if (numbers.includes(weekNum)) {
            activeCandidate = c
              .replace(/\s*\([^)]*week[^)]*\)/gi, "")
              .replace(/\s*\[[^\]]*week[^\]]*\]/gi, "")
              .replace(/\s*weeks?\s*[\d\s&,and]+/gi, "")
              .trim();
            break;
          }
        } else {
          if (!activeCandidate) {
            activeCandidate = c;
          }
        }
      }

      if (activeCandidate) {
        const cleanCand = activeCandidate.replace(/\/+$/, "").trim();
        if (cleanCand) resultLines.push(cleanCand);
      }
    } else {
      const weekMatch = l.match(/\b(?:weeks?)\s*[:\(\[]?\s*([\d\s&,and]+)[\)\]]?/i);
      if (weekMatch) {
        const numbers = weekMatch[1].match(/\d+/g)?.map(Number) || [];
        if (numbers.length > 0 && !numbers.includes(weekNum)) {
          return;
        }
      }

      const clean = l
        .replace(/\s*\([^)]*week[^)]*\)/gi, "")
        .replace(/\s*\[[^\]]*week[^\]]*\]/gi, "")
        .replace(/\/+$/, "")
        .trim();
      if (clean) resultLines.push(clean);
    }
  });

  return resultLines.length > 0 ? resultLines.join("\n") : rawText.replace(/\s*\([^)]*week[^)]*\)/gi, "").trim();
};

export default function MessDisplay({ hostelData, handleHostelDetailsFetch }: any) {
  if (!hostelData?.hostelInfo?.isHosteller) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted card-surface border border-zinc-200/50 dark:border-zinc-800/80 rounded-lg space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Utensils size={28} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink font-outfit">Hostel Mess Information</h3>
          <p className="text-xs text-muted mt-1 font-medium max-w-sm">
            You are currently not registered as a Hosteller in VTOP records.
          </p>
        </div>
        <button
          onClick={handleHostelDetailsFetch}
          className="px-4 py-2 rounded-sm bg-accent hover:bg-accent/90 text-background text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RefreshCcw className="w-4 h-4" /> Reload Hostel Data
        </button>
      </div>
    );
  }

  const normalizeGender = (g: string) => (g?.toLowerCase() === "female" ? "Female" : "Male");

  const normalizeType = (t: string) => {
    const map: Record<string, string> = {
      VEG: "Veg",
      NON: "Non Veg",
      SPECIAL: "Special",
    };
    return map[t?.toUpperCase()] || "Veg";
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentWeekNum = getCurrentWeekOfMonth();

  const [gender, setGender] = useState(normalizeGender(hostelData.hostelInfo?.gender) || "Male");
  const [type, setType] = useState(normalizeType(hostelData.hostelInfo?.messInfo) || "Veg");
  const settings = useAtomValue(settingsAtom);
  const smartMode = settings?.smartMessFilter ?? false;
  const [menu, setMenu] = useState<any[]>([]);
  const [activeDay, setActiveDay] = useState(today);
  const isMobile = useIsMobile();

  const getInitialMeal = () => {
    const hour = new Date().getHours();
    if (hour < 10) return "Breakfast";
    if (hour < 15) return "Lunch";
    if (hour < 18) return "Snacks";
    return "Dinner";
  };

  const [activeMealMobile, setActiveMealMobile] = useState(getInitialMeal());
  const shortDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  async function fetchMenuWithCache(g: string, t: string) {
    const fileName = `VITC-${g[0].toUpperCase()}-${t[0].toUpperCase()}.json`;
    const localUrl = `/data/mess/${fileName}`;
    const remoteUrl = messLinks[g]?.[t] || messLinks.Male.Veg;

    try {
      const cached = localStorage.getItem(fileName);
      if (cached) {
        const parsed = JSON.parse(cached);
        setMenu(parsed.list || []);
      }
    } catch (err) {
      console.warn("LocalStorage read failed:", err);
    }

    if (!localStorage.getItem(fileName)) {
      try {
        const res = await fetch(localUrl);
        const data = await res.json();
        setMenu(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      } catch (err) {
        console.error("Error loading local mess JSON:", err);
      }
    }

    fetch(remoteUrl, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.list) {
          setMenu(data.list);
          localStorage.setItem(fileName, JSON.stringify(data));
        }
      })
      .catch((err) => {
        console.warn("Remote fetch failed, using cached menu:", err);
      });
  }

  useEffect(() => {
    fetchMenuWithCache(gender, type);
  }, [gender, type]);

  const todayMenu = menu.find((day) => day.Day === activeDay);

  const currentActiveMealName = useMemo(() => {
    const hour = new Date().getHours();
    const min = new Date().getMinutes();
    const timeVal = hour + min / 60;
    if (timeVal >= 7 && timeVal < 10.5) return "Breakfast";
    if (timeVal >= 12 && timeVal < 15) return "Lunch";
    if (timeVal >= 16.5 && timeVal < 18.5) return "Snacks";
    if (timeVal >= 19 && timeVal < 21.5) return "Dinner";
    return null;
  }, []);

  const mealsList = [
    {
      name: "Breakfast",
      Icon: Sun,
      time: "7:30 AM - 9:00 AM",
      key: "Breakfast",
      accentColor: "text-warn",
    },
    {
      name: "Lunch",
      Icon: Utensils,
      time: "12:30 PM - 2:00 PM",
      key: "Lunch",
      accentColor: "text-indigo-500 dark:text-indigo-400",
    },
    {
      name: "Snacks",
      Icon: Coffee,
      time: "4:30 PM - 5:30 PM",
      key: "Snacks",
      accentColor: "text-ok",
    },
    {
      name: "Dinner",
      Icon: Moon,
      time: "7:30 PM - 9:00 PM",
      key: "Dinner",
      accentColor: "text-course-3",
    },
  ];

  const renderMenuContent = (rawText: string) => {
    if (!rawText || rawText.trim() === "" || rawText === "No items listed.") {
      return <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium py-3 text-center">No items listed.</p>;
    }

    // Clean leading line numbers like "1. ", "2) ", etc. from every line
    const cleanedLines = rawText
      .split("\n")
      .map((line) => line.trim().replace(/^(\d+)[\.\)]\s*/, ""))
      .filter(Boolean);

    return (
      <ul className="space-y-2">
        {cleanedLines.map((line, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed"
          >
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500/60 mt-1.5" />
            <span className="flex-1">{line}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
            <Utensils size={11} /> Mess Menu
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink leading-tight font-outfit">
            Hostel Mess Schedule
          </h1>
          <p className="text-xs text-muted mt-0.5 font-medium flex items-center gap-1.5">
            <span>{currentMonth} Schedule</span>
            <span>•</span>
            {smartMode ? (
              <span className="inline-flex items-center gap-1 text-ok font-semibold">
                <CalendarCheck size={11} /> Smart Week {currentWeekNum} Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-semibold">
                <Sparkles size={11} className="text-indigo-500" /> Standard Menu View
              </span>
            )}
          </p>
        </div>

        {/* Unified Controls Cluster */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Gender Segmented Control */}
          <div className="flex p-1 bg-surface-2 rounded-md border border-zinc-200/60 dark:border-zinc-800">
            {["Male", "Female"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  gender === g
                    ? "bg-surface dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-muted hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {g === "Male" ? "Mens" : "Womens"}
              </button>
            ))}
          </div>

          {/* Mess Type Control */}
          <div className="flex p-1 bg-surface-2 rounded-md border border-zinc-200/60 dark:border-zinc-800">
            {[
              { id: "Veg", label: "Veg" },
              { id: "Non Veg", label: "Non-Veg" },
              { id: "Special", label: "Special" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  type === t.id
                    ? "bg-surface dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-muted hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Days Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full justify-start sm:justify-center">
        {shortDays.map((short) => {
          const fullDayName = shortToFullDay[short];
          const isSelected = fullDayName === activeDay;
          const isActualToday = fullDayName === today;
          return (
            <button
              key={short}
              onClick={() => setActiveDay(fullDayName)}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-accent text-background"
                  : "bg-surface text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {isActualToday && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-surface" : "bg-ok"}`} />
              )}
              <span>{short}</span>
            </button>
          );
        })}
      </div>

      {/* Meals Cards Display */}
      {todayMenu ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted font-outfit">
              {activeDay} Menu ({gender} • {type})
            </span>
            {activeDay === today && currentActiveMealName && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-ok-soft text-ok border border-ok/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                Active: {currentActiveMealName}
              </span>
            )}
          </div>

          {isMobile ? (
            /* Mobile Tab Switcher & Single Active Meal View */
            <div className="space-y-4">
              <div className="flex bg-surface-2 p-1 rounded-md w-full border border-zinc-200/60 dark:border-zinc-800">
                {mealsList.map((meal) => {
                  const isActive = activeMealMobile === meal.name;
                  const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                  const MealIcon = meal.Icon;
                  return (
                    <button
                      key={meal.name}
                      onClick={() => setActiveMealMobile(meal.name)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                        isActive
                          ? "bg-surface dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-muted hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <MealIcon size={13} className={isActive ? meal.accentColor : "text-zinc-400"} />
                      <span>{meal.name}</span>
                      {isCurrentNow && <span className="w-1 h-1 rounded-full bg-ok" />}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Single Active Meal Card */}
              {(() => {
                const meal = mealsList.find((m) => m.name === activeMealMobile);
                if (!meal) return null;
                const rawText = todayMenu[meal.key] || "";
                const displayText = smartMode ? getSmartMenuText(rawText, currentWeekNum) : rawText;
                const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                const MealIcon = meal.Icon;

                return (
                  <div
                    className={`card-surface border ${isCurrentNow ? "border-indigo-500/50 dark:border-indigo-500/40" : "border-zinc-200/50 dark:border-zinc-800/80"} rounded-md p-5 shadow-xs space-y-4`}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                          <MealIcon size={18} className={meal.accentColor} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-ink text-sm font-outfit">{meal.name}</h3>
                            {isCurrentNow && (
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-ok-soft text-ok border border-ok/20">
                                Serving Now
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {meal.time}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">{renderMenuContent(displayText)}</div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Desktop 4-Grid Card View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mealsList.map((meal) => {
                const rawText = todayMenu[meal.key] || "";
                const displayText = smartMode ? getSmartMenuText(rawText, currentWeekNum) : rawText;
                const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                const MealIcon = meal.Icon;

                return (
                  <div
                    key={meal.name}
                    className={`card-surface border ${
                      isCurrentNow
                        ? "border-indigo-500/50 dark:border-indigo-500/40 ring-1 ring-indigo-500/20"
                        : "border-zinc-200/50 dark:border-zinc-800/80"
                    } rounded-md p-4.5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between text-left`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                            <MealIcon size={16} className={meal.accentColor} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-ink text-xs font-outfit">{meal.name}</h3>
                            <p className="text-[9.5px] text-muted font-medium flex items-center gap-1 mt-0.5">
                              <Clock size={9} /> {meal.time}
                            </p>
                          </div>
                        </div>
                        {isCurrentNow && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-ok-soft text-ok border border-ok/20 shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="pt-1 min-h-[140px]">{renderMenuContent(displayText)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center card-surface border border-zinc-200/50 dark:border-zinc-800/80 rounded-md">
          <p className="text-xs text-muted font-medium">
            No menu found for {activeDay}. Please click reload if data is outdated.
          </p>
        </div>
      )}
    </div>
  );
}
