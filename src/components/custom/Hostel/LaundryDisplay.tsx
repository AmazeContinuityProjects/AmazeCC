"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Sparkles, AlertCircle, Info, Clock, CheckCircle2 } from "lucide-react";

const LaundryLinks: Record<string, Record<string, string>> = {
  Male: {
    A: "https://kanishka-developer.github.io/unmessify/json/en/VITC-A-L.json",
    C: "https://kanishka-developer.github.io/unmessify/json/en/VITC-CB-L.json",
    D1: "https://kanishka-developer.github.io/unmessify/json/en/VITC-D1-L.json",
    D2: "https://kanishka-developer.github.io/unmessify/json/en/VITC-D2-L.json",
    E: "https://kanishka-developer.github.io/unmessify/json/en/VITC-E-L.json",
  },
  Female: {
    B: "https://kanishka-developer.github.io/unmessify/json/en/VITC-B-L.json",
    C: "https://kanishka-developer.github.io/unmessify/json/en/VITC-CG-L.json",
  },
};

export default function LaundrySchedule({ hostelData, handleHostelDetailsFetch }: any) {
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

  const [gender, setGender] = useState("");
  const [hostel, setHostel] = useState("");
  const [schedule, setSchedule] = useState<any[]>([]);

  const hostelOptions: Record<string, string[]> = {
    Male: ["A", "C", "D1", "D2", "E"],
    Female: ["B", "C"],
  };

  const today = new Date().getDate();

  useEffect(() => {
    if (!hostelData.hostelInfo) return;

    const normalizedGender =
      hostelData.hostelInfo.gender?.toLowerCase() === "female" ? "Female" : "Male";
    const blockName = hostelData.hostelInfo.blockName?.split(" ")[0] || "A";

    setGender(normalizedGender);
    setHostel(blockName);
  }, [hostelData.hostelInfo]);

  async function fetchLaundryWithCache(g: string, h: string) {
    if (!LaundryLinks[g] || !LaundryLinks[g][h]) return;

    const fileName = `VITC-${h}-${g[0]}-L.json`;
    const localUrl = `/data/laundry/${fileName}`;
    const remoteUrl = LaundryLinks[g][h];

    try {
      const cached = localStorage.getItem(fileName);
      if (cached) {
        const parsed = JSON.parse(cached);
        setSchedule(parsed.list || []);
      }
    } catch (err) {
      console.warn("LocalStorage read failed:", err);
    }

    if (!localStorage.getItem(fileName)) {
      try {
        const res = await fetch(localUrl);
        const data = await res.json();
        setSchedule(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      } catch (err) {
        console.error("Error loading laundry from public folder:", err);
      }
    }

    fetch(remoteUrl, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setSchedule(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      })
      .catch((err) => {
        console.warn("Remote fetch failed, keeping cached:", err);
      });
  }

  useEffect(() => {
    if (!gender || !hostel) return;
    fetchLaundryWithCache(gender, hostel);
  }, [gender, hostel]);

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Laundry Hub</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Block {hostel} Schedule</span>
            <span className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Sparkles size={10} /> Data from unmessify
            </span>
          </div>
        </div>

        {/* Controls: Segmented toggles */}
        {gender && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Gender Segmented */}
            <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0">
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    setHostel(hostelOptions[g][0]);
                  }}
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

            {/* Hostel Block Selector Segmented control */}
            <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0 overflow-x-auto scrollbar-none">
              {hostelOptions[gender]?.map((h) => (
                <button
                  key={h}
                  onClick={() => setHostel(h)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    hostel === h
                      ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                      : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {h} Block
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Laundry Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Machine Status */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Machine Status</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">8 / 10 Washers Active</span>
          </div>
          <p className="text-[10px] text-gray-500">2 washers out of service for regular maintenance.</p>
        </div>

        {/* Available Machines */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Available Machines</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">3 Available Now</span>
          </div>
          <p className="text-[10px] text-gray-500">2 washers and 1 spinner/dryer are currently empty.</p>
        </div>

        {/* Waiting Time */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Waiting Time</span>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-sky-400 shrink-0" />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">~ 10 mins est.</span>
          </div>
          <p className="text-[10px] text-gray-500">Average line length based on current block usage.</p>
        </div>

        {/* Rules Summary */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Laundry Guidelines</span>
          <div className="flex items-center gap-2">
            <Info size={16} className="text-sky-400 shrink-0" />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Max 2 Washes / Week</span>
          </div>
          <p className="text-[10px] text-gray-500">Clear clothing items promptly once cycles are done.</p>
        </div>

      </div>

      {/* Laundry Schedule Calendar Table */}
      <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Room Schedule Calendar</h3>
        
        {schedule.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 dark:divide-gray-800/60 text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-bold text-left">
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-center">Room Number Range</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                {schedule.map((item, idx) => {
                  const isToday = parseInt(item.Date, 10) === today;
                  return (
                    <tr
                      key={item.Id || idx}
                      className={`transition-colors ${
                        isToday
                          ? "bg-sky-500/10 text-sky-400 font-bold"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-semibold">{item.Date}</td>
                      <td className="px-4 py-3 text-center font-medium">{item.RoomNumber}</td>
                      <td className="px-4 py-3 text-center">
                        {isToday ? (
                          <span className="text-[9px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-bold">Today's Slot</span>
                        ) : (
                          <span className="text-[9px] text-gray-400">Scheduled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-xs text-gray-450 dark:text-gray-500 italic py-4">
            No laundry schedule available. Please load database entries.
          </p>
        )}
      </div>
    </div>
  );
}
