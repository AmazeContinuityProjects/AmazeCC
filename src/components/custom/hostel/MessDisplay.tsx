"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  RefreshCcw, Clock, Sparkles, Utensils, Search, ChevronRight
} from "lucide-react";
import { useIsMobile } from "../shared";

const messLinks: Record<string, Record<string, string>> = {
  Male: {
    "Non Veg": "https://kanishka-developer.github.io/unmessify/json/en/VITC-M-N.json",
    Veg: "https://kanishka-developer.github.io/unmessify/json/en/VITC-M-V.json",
    Special: "https://kanishka-developer.github.io/unmessify/json/en/VITC-M-S.json",
  },
  Female: {
    "Non Veg": "https://kanishka-developer.github.io/unmessify/json/en/VITC-W-N.json",
    Veg: "https://kanishka-developer.github.io/unmessify/json/en/VITC-W-V.json",
    Special: "https://kanishka-developer.github.io/unmessify/json/en/VITC-W-S.json",
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
  Object.entries(fullToShortDay).map(([full, short]) => [short, full])
);

export default function MessDisplay({ hostelData, handleHostelDetailsFetch }: any) {
  if (!hostelData?.hostelInfo?.isHosteller) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 dark:text-gray-400 bg-white/70 dark:bg-[#050814]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <Utensils size={32} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-[family-name:var(--font-outfit)]">Hostel Mess Information</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium max-w-sm">You are currently not registered as a Hosteller in VTOP records.</p>
        </div>
        <button
          onClick={handleHostelDetailsFetch}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
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

  const [gender, setGender] = useState(
    normalizeGender(hostelData.hostelInfo?.gender) || "Male"
  );
  const [type, setType] = useState(
    normalizeType(hostelData.hostelInfo?.messInfo) || "Veg"
  );
  const [menu, setMenu] = useState<any[]>([]);
  const [activeDay, setActiveDay] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
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
      .then(res => res.json())
      .then(data => {
        if (data?.list) {
          setMenu(data.list);
          localStorage.setItem(fileName, JSON.stringify(data));
        }
      })
      .catch(err => {
        console.warn("Remote fetch failed, using cached menu:", err);
      });
  }

  useEffect(() => {
    fetchMenuWithCache(gender, type);
  }, [gender, type]);

  const todayMenu = menu.find((day) => day.Day === activeDay);

  // Helper to determine currently active meal slot based on local time
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
      icon: "🍳", 
      time: "7:30 AM - 9:00 AM", 
      key: "Breakfast", 
      gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
      accentColor: "text-amber-500"
    },
    { 
      name: "Lunch", 
      icon: "🍲", 
      time: "12:30 PM - 2:00 PM", 
      key: "Lunch", 
      gradient: "from-sky-500/10 via-indigo-500/5 to-transparent",
      accentColor: "text-sky-500"
    },
    { 
      name: "Snacks", 
      icon: "☕", 
      time: "4:30 PM - 5:30 PM", 
      key: "Snacks", 
      gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      accentColor: "text-emerald-500"
    },
    { 
      name: "Dinner", 
      icon: "🍽️", 
      time: "7:30 PM - 9:00 PM", 
      key: "Dinner", 
      gradient: "from-purple-500/10 via-pink-500/5 to-transparent",
      accentColor: "text-purple-500"
    }
  ];

  // Utility to parse raw comma/newline items into clean chips
  const parseItems = (raw: string) => {
    if (!raw || raw.trim() === "") return [];
    return raw
      .split(/[,;\n]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  // Search filter across the week
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !menu || menu.length === 0) return [];
    const query = searchQuery.toLowerCase().trim();
    const matches: Array<{ day: string; meal: string; item: string }> = [];

    menu.forEach(dayObj => {
      mealsList.forEach(m => {
        const text = dayObj[m.key] || "";
        const items = parseItems(text);
        items.forEach(it => {
          if (it.toLowerCase().includes(query)) {
            matches.push({ day: dayObj.Day, meal: m.name, item: it });
          }
        });
      });
    });

    return matches;
  }, [searchQuery, menu]);

  return (
    <div className="space-y-6 relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Utensils size={11} /> Mess Food Menu
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-outfit)]">
            Hostel Mess Schedule
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 font-medium flex items-center gap-1.5">
            <span>{currentMonth} Cycle</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-gray-300 font-bold">
              <Sparkles size={11} className="text-amber-500" /> Powered by unmessify
            </span>
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Gender Segmented Control */}
          <div className="flex p-1 bg-slate-100 dark:bg-neutral-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
            {["Male", "Female"].map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  gender === g
                    ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {g === "Male" ? "👨 Mens" : "👩 Womens"}
              </button>
            ))}
          </div>

          {/* Mess Type Control */}
          <div className="flex p-1 bg-slate-100 dark:bg-neutral-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
            {[
              { id: "Veg", label: "🟢 Veg" },
              { id: "Non Veg", label: "🍗 Non-Veg" },
              { id: "Special", label: "🌟 Special" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  type === t.id
                    ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3.5 text-slate-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food items (e.g. Biryani, Paneer, Ice Cream, Coffee)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-2 p-4 bg-white/95 dark:bg-[#050814]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl space-y-2 max-h-60 overflow-y-auto z-20">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-gray-500">
              Found {searchResults.length} match(es) for &quot;{searchQuery}&quot;
            </p>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium py-2">No matching dishes found in this week&apos;s menu.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setActiveDay(res.day);
                      setSearchQuery("");
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/50 dark:border-white/[0.05] hover:border-amber-500/30 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{res.item}</p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">{res.day} • {res.meal}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25 scale-[1.02]"
                  : "bg-white/80 dark:bg-neutral-900/60 text-slate-700 dark:text-gray-300 border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-neutral-800"
              }`}
            >
              {isActualToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              <span>{isActualToday ? `Today (${short})` : short}</span>
            </button>
          );
        })}
      </div>

      {/* Meals Cards Display */}
      {todayMenu ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 font-[family-name:var(--font-outfit)]">
              {activeDay} Menu ({gender} • {type})
            </span>
            {activeDay === today && currentActiveMealName && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Meal: {currentActiveMealName}
              </span>
            )}
          </div>

          {isMobile ? (
            /* Mobile Tab Switcher & Single Active Meal View */
            <div className="space-y-4">
              <div className="flex bg-slate-100 dark:bg-neutral-900 p-1 rounded-2xl w-full border border-slate-200/60 dark:border-white/[0.06]">
                {mealsList.map(meal => {
                  const isActive = activeMealMobile === meal.name;
                  const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                  return (
                    <button
                      key={meal.name}
                      onClick={() => setActiveMealMobile(meal.name)}
                      className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        isActive 
                          ? "bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-xs" 
                          : "text-slate-500 dark:text-gray-400 hover:text-slate-900"
                      }`}
                    >
                      <span className="text-sm">{meal.icon}</span>
                      <span className="text-[10px] font-bold">{meal.name}</span>
                      {isCurrentNow && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Single Active Meal Card */}
              {(() => {
                const meal = mealsList.find(m => m.name === activeMealMobile);
                if (!meal) return null;
                const itemsText = todayMenu[meal.key] || "";
                const itemsList = parseItems(itemsText);
                const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;

                return (
                  <div className={`bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border ${isCurrentNow ? "border-amber-500/40 dark:border-amber-500/30 shadow-amber-500/10 shadow-xl" : "border-slate-200/80 dark:border-white/[0.08]"} rounded-3xl p-5 shadow-lg space-y-4 relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${meal.gradient} rounded-bl-full pointer-events-none`} />

                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl shrink-0">
                          {meal.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-[family-name:var(--font-outfit)]">{meal.name}</h3>
                            {isCurrentNow && (
                              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Serving Now
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock size={11} /> {meal.time}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Food Items Chips */}
                    <div className="relative z-10 space-y-2">
                      {itemsList.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-gray-500 font-medium py-4 text-center">No items listed for this meal.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {itemsList.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-neutral-900/80 border border-slate-200/60 dark:border-white/[0.06] text-xs font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Desktop 4-Grid Card View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {mealsList.map((meal) => {
                const itemsText = todayMenu[meal.key] || "";
                const itemsList = parseItems(itemsText);
                const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;

                return (
                  <div
                    key={meal.name}
                    className={`bg-white/80 dark:bg-[#050814]/80 backdrop-blur-xl border ${
                      isCurrentNow 
                        ? "border-amber-500/50 dark:border-amber-500/40 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/30" 
                        : "border-slate-200/80 dark:border-white/[0.08]"
                    } rounded-3xl p-5 shadow-md hover:shadow-xl hover:border-amber-500/30 transition-all flex flex-col justify-between relative overflow-hidden text-left`}
                  >
                    <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl ${meal.gradient} rounded-bl-full pointer-events-none`} />

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{meal.icon}</span>
                          <div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-[family-name:var(--font-outfit)]">{meal.name}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {meal.time}
                            </p>
                          </div>
                        </div>
                        {isCurrentNow && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Items Chip List */}
                      <div className="min-h-[140px] space-y-2">
                        {itemsList.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-gray-500 font-medium py-6 text-center">No items listed.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {itemsList.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-xl bg-slate-100/70 dark:bg-neutral-900/70 border border-slate-200/50 dark:border-white/[0.05] text-[11px] font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-1.5"
                              >
                                <span className="w-1 h-1 rounded-full bg-amber-500/80" />
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-white/70 dark:bg-[#050814]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl">
          <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold">
            No menu found for {activeDay}. Please click reload if data is outdated.
          </p>
        </div>
      )}
    </div>
  );
}
