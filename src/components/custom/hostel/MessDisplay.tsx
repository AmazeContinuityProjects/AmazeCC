"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  RefreshCcw, Clock, Sparkles, Utensils, Search, ChevronRight, Sun, Coffee, Moon
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
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Utensils size={28} />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white font-outfit">Hostel Mess Information</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium max-w-sm">You are currently not registered as a Hosteller in VTOP records.</p>
        </div>
        <button
          onClick={handleHostelDetailsFetch}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
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
      accentColor: "text-amber-500 dark:text-amber-400"
    },
    { 
      name: "Lunch", 
      Icon: Utensils, 
      time: "12:30 PM - 2:00 PM", 
      key: "Lunch", 
      accentColor: "text-indigo-500 dark:text-indigo-400"
    },
    { 
      name: "Snacks", 
      Icon: Coffee, 
      time: "4:30 PM - 5:30 PM", 
      key: "Snacks", 
      accentColor: "text-emerald-500 dark:text-emerald-400"
    },
    { 
      name: "Dinner", 
      Icon: Moon, 
      time: "7:30 PM - 9:00 PM", 
      key: "Dinner", 
      accentColor: "text-purple-500 dark:text-purple-400"
    }
  ];

  const parseItems = (raw: string) => {
    if (!raw || raw.trim() === "") return [];
    return raw
      .split(/[,;\n]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

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
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
            <Utensils size={11} /> Mess Menu
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight font-outfit">
            Hostel Mess Schedule
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium flex items-center gap-1.5">
            <span>{currentMonth} Schedule</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-bold">
              <Sparkles size={11} className="text-indigo-500" /> Powered by unmessify
            </span>
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Gender Segmented Control */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-850 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
            {["Male", "Female"].map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  gender === g
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {g === "Male" ? "Mens" : "Womens"}
              </button>
            ))}
          </div>

          {/* Mess Type Control */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-850 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
            {[
              { id: "Veg", label: "Veg" },
              { id: "Non Veg", label: "Non-Veg" },
              { id: "Special", label: "Special" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  type === t.id
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
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
          <Search size={15} className="absolute left-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes (e.g. Biryani, Paneer, Coffee)..."
            className="w-full pl-10 pr-4 py-2 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl space-y-2 max-h-60 overflow-y-auto z-20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Found {searchResults.length} match(es) for &quot;{searchQuery}&quot;
            </p>
            {searchResults.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium py-2">No matching dishes found in this week&apos;s menu.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setActiveDay(res.day);
                      setSearchQuery("");
                    }}
                    className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:border-indigo-500/30 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">{res.item}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">{res.day} • {res.meal}</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-indigo-600 text-white dark:bg-indigo-500 shadow-xs"
                  : "bg-white/70 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {isActualToday && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} />
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
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-outfit">
              {activeDay} Menu ({gender} • {type})
            </span>
            {activeDay === today && currentActiveMealName && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active: {currentActiveMealName}
              </span>
            )}
          </div>

          {isMobile ? (
            /* Mobile Tab Switcher & Single Active Meal View */
            <div className="space-y-4">
              <div className="flex bg-zinc-100 dark:bg-zinc-850 p-1 rounded-xl w-full border border-zinc-200/60 dark:border-zinc-800">
                {mealsList.map(meal => {
                  const isActive = activeMealMobile === meal.name;
                  const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                  const MealIcon = meal.Icon;
                  return (
                    <button
                      key={meal.name}
                      onClick={() => setActiveMealMobile(meal.name)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                        isActive 
                          ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs" 
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <MealIcon size={13} className={isActive ? meal.accentColor : "text-zinc-400"} />
                      <span>{meal.name}</span>
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
                const MealIcon = meal.Icon;

                return (
                  <div className={`bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border ${isCurrentNow ? "border-indigo-500/50 dark:border-indigo-500/40" : "border-zinc-200/50 dark:border-zinc-800/80"} rounded-2xl p-5 shadow-xs space-y-4`}>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          <MealIcon size={18} className={meal.accentColor} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-zinc-900 dark:text-white text-sm font-outfit">{meal.name}</h3>
                            {isCurrentNow && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Serving Now
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {meal.time}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Food Items Chips */}
                    <div className="space-y-2">
                      {itemsList.length === 0 ? (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium py-3 text-center">No items listed for this meal.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {itemsList.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"
                            >
                              <span className="w-1 h-1 rounded-full bg-indigo-500/60" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mealsList.map((meal) => {
                const itemsText = todayMenu[meal.key] || "";
                const itemsList = parseItems(itemsText);
                const isCurrentNow = activeDay === today && currentActiveMealName === meal.name;
                const MealIcon = meal.Icon;

                return (
                  <div
                    key={meal.name}
                    className={`bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border ${
                      isCurrentNow 
                        ? "border-indigo-500/50 dark:border-indigo-500/40 ring-1 ring-indigo-500/20" 
                        : "border-zinc-200/50 dark:border-zinc-800/80"
                    } rounded-2xl p-4.5 shadow-xs hover:border-indigo-500/30 transition-all flex flex-col justify-between text-left`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                            <MealIcon size={16} className={meal.accentColor} />
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-900 dark:text-white text-xs font-outfit">{meal.name}</h3>
                            <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                              <Clock size={9} /> {meal.time}
                            </p>
                          </div>
                        </div>
                        {isCurrentNow && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Items Chip List */}
                      <div className="min-h-[130px] space-y-1.5">
                        {itemsList.length === 0 ? (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium py-6 text-center">No items listed.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {itemsList.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"
                              >
                                <span className="w-1 h-1 rounded-full bg-indigo-500/60" />
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
        <div className="p-8 text-center bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 rounded-2xl">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            No menu found for {activeDay}. Please click reload if data is outdated.
          </p>
        </div>
      )}
    </div>
  );
}
