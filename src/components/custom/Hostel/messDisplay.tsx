"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, ExternalLink, Clock, Sparkles } from "lucide-react";

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
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm font-medium">You are not registered as a Hosteller.</p>
        <button
          onClick={handleHostelDetailsFetch}
          className="mt-4 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> Reload Data
        </button>
      </div>
    );
  }

  const normalizeGender = (g: string) => (g?.toLowerCase() === "male" ? "Male" : "Female");

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
    normalizeGender(hostelData.hostelInfo?.gender?.toUpperCase()) || "Male"
  );
  const [type, setType] = useState(
    normalizeType(hostelData.hostelInfo?.messInfo?.toUpperCase()) || "Veg"
  );
  const [menu, setMenu] = useState<any[]>([]);
  const [activeDay, setActiveDay] = useState(today);

  const shortDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  async function fetchMenuWithCache(g: string, t: string) {
    const fileName = `VITC-${g[0].toUpperCase()}-${t[0].toUpperCase()}.json`;
    const localUrl = `/data/mess/${fileName}`;
    const remoteUrl = messLinks[g][t];

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
        console.error("Error loading from public folder:", err);
      }
    }

    fetch(remoteUrl, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        setMenu(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      })
      .catch(err => {
        console.warn("Remote fetch failed, keeping cached:", err);
      });
  }

  useEffect(() => {
    fetchMenuWithCache(gender, type);
  }, [gender, type]);

  const todayMenu = menu.find((day) => day.Day === activeDay);

  const mealsList = [
    { name: "Breakfast", icon: "🍳", time: "7:30 AM - 9:00 AM", key: "Breakfast", color: "from-amber-400/20 to-orange-400/10 text-amber-400" },
    { name: "Lunch", icon: "🍲", time: "12:30 PM - 2:00 PM", key: "Lunch", color: "from-sky-400/20 to-indigo-400/10 text-sky-300" },
    { name: "Snacks", icon: "☕", time: "4:30 PM - 5:30 PM", key: "Snacks", color: "from-emerald-400/20 to-teal-400/10 text-emerald-400" },
    { name: "Dinner", icon: "🍽️", time: "7:30 PM - 9:00 PM", key: "Dinner", color: "from-rose-400/20 to-pink-400/10 text-rose-450" }
  ];

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Mess Menu</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{currentMonth} Schedule</span>
            <span className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Sparkles size={10} /> Data from unmessify
            </span>
          </div>
        </div>

        {/* Controls: Segmented toggles */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Gender Selector Segmented control */}
          <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0">
            {["Male", "Female"].map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  gender === g
                    ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                    : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Mess Category Selector Segmented control */}
          <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0">
            {["Veg", "Non Veg", "Special"].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  type === t
                    ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                    : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day Selector pills list */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full justify-start md:justify-center">
        {shortDays.map((short) => {
          const isSelected = shortToFullDay[short] === activeDay;
          const isActualToday = shortToFullDay[short] === today;
          return (
            <button
              key={short}
              onClick={() => setActiveDay(shortToFullDay[short])}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/15"
                  : "bg-white/50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-350 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
            >
              {isActualToday ? `Today (${short})` : short}
            </button>
          );
        })}
      </div>

      {/* Meals cards */}
      {todayMenu ? (
        <div className="space-y-4">
          <div className="text-center font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            {activeDay} Menu
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mealsList.map((meal) => {
              const itemsText = todayMenu[meal.key] || "No items listed.";
              return (
                <div
                  key={meal.name}
                  className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs hover:shadow-sm hover:border-sky-500/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{meal.icon}</span>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{meal.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-450 font-medium">
                        <Clock size={10} />
                        <span>{meal.time}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50/50 dark:bg-slate-800/10 border border-gray-150 dark:border-gray-850/60 rounded-xl p-3.5 min-h-36">
                      <p className="whitespace-pre-line text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed">
                        {itemsText}
                      </p>
                    </div>
                  </div>

                  {/* Optional nutrition tag */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-[9px] font-bold bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full uppercase">Standard Choice</span>
                    {type === "Non Veg" && meal.name === "Lunch" && (
                      <span className="text-[9px] font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full uppercase">Non-Veg Option</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          No menu found for {activeDay}. Please trigger reload if data is outdated.
        </p>
      )}
    </div>
  );
}
