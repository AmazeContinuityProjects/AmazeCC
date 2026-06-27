"use client";

import { useEffect, useState } from "react";
import {
  Home,
  Coffee,
  Calendar,
  Clock,
  Heart,
  Users,
  Phone,
  ArrowRight,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HostelOverviewProps {
  hostelData: any;
  setHostelActiveSubTab: (tab: string) => void;
}

export default function HostelOverview({ hostelData, setHostelActiveSubTab }: HostelOverviewProps) {
  const [activeMeal, setActiveMeal] = useState({ name: "Breakfast", icon: "🍳", time: "7:30 AM - 9:00 AM" });
  const [menuItems, setMenuItems] = useState<string>("");
  const [nextMealCountdown, setNextMealCountdown] = useState<string>("");

  const getActiveMealDetails = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // Breakfast: 7:30 AM (450) - 9:00 AM (540)
    // Lunch: 12:30 PM (750) - 2:00 PM (840)
    // Snacks: 4:30 PM (990) - 5:30 PM (1050)
    // Dinner: 7:30 PM (1170) - 9:00 PM (1260)

    if (totalMinutes < 540) {
      const diff = 540 - totalMinutes;
      setNextMealCountdown(`Breakfast ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Breakfast", icon: "🍳", time: "7:30 AM - 9:00 AM" };
    } else if (totalMinutes < 840) {
      const diff = 840 - totalMinutes;
      setNextMealCountdown(`Lunch ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Lunch", icon: "🍲", time: "12:30 PM - 2:00 PM" };
    } else if (totalMinutes < 1050) {
      const diff = 1050 - totalMinutes;
      setNextMealCountdown(`Snacks ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Snacks", icon: "☕", time: "4:30 PM - 5:30 PM" };
    } else if (totalMinutes < 1260) {
      const diff = 1260 - totalMinutes;
      setNextMealCountdown(`Dinner ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Dinner", icon: "🍽️", time: "7:30 PM - 9:00 PM" };
    } else {
      setNextMealCountdown("Kitchen is closed. Reopens at 7:30 AM");
      return { name: "Breakfast", icon: "🍳", time: "Tomorrow 7:30 AM" };
    }
  };

  useEffect(() => {
    const meal = getActiveMealDetails();
    setActiveMeal(meal);

    try {
      const isFemale = hostelData.hostelInfo?.gender?.toLowerCase() === "female";
      const genderLetter = isFemale ? "W" : "M";
      const rawType = hostelData.hostelInfo?.messInfo?.toUpperCase() || "VEG";
      const typeLetter = rawType.includes("NON") ? "N" : rawType.includes("SPECIAL") ? "S" : "V";
      
      const fileName = `VITC-${genderLetter}-${typeLetter}.json`;
      const cached = localStorage.getItem(fileName);
      if (cached) {
        const parsed = JSON.parse(cached);
        const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const todayMenu = parsed.list?.find((day: any) => day.Day === weekday);
        if (todayMenu) {
          setMenuItems(todayMenu[meal.name] || "");
        }
      }
    } catch (e) {
      console.warn("Failed to load cached mess data:", e);
    }
  }, [hostelData]);

  // Extract hostel profile info
  const info = hostelData?.hostelInfo || {};
  const block = info.blockName || "N/A";
  const room = info.roomNo || "N/A";
  const messType = info.messInfo || "N/A";

  // Parse active leaves
  const leaveHistory = hostelData?.leaveHistory || [];
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      return new Date(Number(year), month, parseInt(day));
    }
    return new Date(dateStr);
  };
  const now = new Date();
  const activeLeaves = leaveHistory.filter((leave: any) => {
    const from = parseDate(leave.from);
    const to = parseDate(leave.to);
    const daysSinceEnd = (now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24);
    return (from <= now && now <= to) || from > now || (daysSinceEnd > 0 && daysSinceEnd <= 3);
  });
  const activeLeave = activeLeaves[0];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Hostel Hub</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your residential status, laundry schedules, leave details, and dining.</p>
      </div>

      {/* Grid Dashboard layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card: Today's Mess */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-sky-500/35 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Mess Dining</span>
              <span className="text-xs text-gray-450 dark:text-gray-400 font-semibold">{activeMeal.time}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">{activeMeal.icon}</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Current Meal: {activeMeal.name}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{nextMealCountdown}</p>
              </div>
            </div>
            <div className="bg-gray-100/50 dark:bg-slate-800/10 border border-gray-150 dark:border-gray-800/60 rounded-xl p-3 text-xs max-h-24 overflow-y-auto">
              {menuItems ? (
                <p className="whitespace-pre-line text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{menuItems}</p>
              ) : (
                <p className="text-gray-450 dark:text-gray-500 italic">No menu cached. Tap view full menu to load it from the remote database.</p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("mess")}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs mt-4 rounded-xl flex items-center justify-center gap-1.5 h-9"
          >
            <span>View Full Menu</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Laundry */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-sky-500/35 transition-all">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Laundry Schedule</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">🧺</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Weekly Slots</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Check when laundry is available for your room range</p>
              </div>
            </div>
            
            <div className="bg-gray-100/50 dark:bg-slate-800/10 border border-gray-150 dark:border-gray-800/60 rounded-xl p-3 text-xs space-y-2">
              <div className="flex justify-between items-center text-gray-650 dark:text-gray-300">
                <span>Active Slot today:</span>
                <span className="font-semibold text-sky-400">Available</span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-450 leading-relaxed">
                Matches current calendar dates. Standard slots allocate up to two washings per week.
              </div>
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("laundry")}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs mt-4 rounded-xl flex items-center justify-center gap-1.5 h-9"
          >
            <span>Check Schedule</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Leave Management */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-sky-500/35 transition-all">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Leaves & Outings</span>
            
            {activeLeave ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">Leave Request Found</span>
                </div>
                <div className="bg-gray-100/50 dark:bg-slate-800/10 border border-gray-150 dark:border-gray-800/60 rounded-xl p-3 text-xs text-gray-650 dark:text-gray-300 space-y-1">
                  <div className="truncate"><strong>From:</strong> {activeLeave.from}</div>
                  <div className="truncate"><strong>To:</strong> {activeLeave.to}</div>
                  <div className="truncate"><strong>Place:</strong> {activeLeave.visitPlace}</div>
                  <div className="mt-1 pt-1.5 border-t border-gray-150 dark:border-gray-800/60 flex items-center justify-between text-[10px]">
                    <span>Status:</span>
                    <span className="font-semibold text-emerald-400 uppercase">{activeLeave.status || "Approved"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-gray-400 shrink-0" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">No Active Leave</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">You do not currently have any active outings or leaves. Ensure to file on time via VTOP.</p>
              </div>
            )}
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("leave")}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs mt-4 rounded-xl flex items-center justify-center gap-1.5 h-9"
          >
            <span>Manage Leaves</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Counselling */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-sky-500/35 transition-all">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Mental Health & Counselling</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">🤝</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Calm Spaces</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Talk to a counsellor or access resources</p>
              </div>
            </div>
            
            <div className="bg-gray-100/50 dark:bg-slate-800/10 border border-gray-150 dark:border-gray-800/60 rounded-xl p-3 text-xs space-y-1.5">
              <p className="text-gray-700 dark:text-gray-300 font-semibold text-[11px]">Upcoming Sessions:</p>
              <p className="text-[10px] text-gray-450 dark:text-gray-500 italic">No scheduled appointments. Access the Book tab to arrange one.</p>
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("counselling")}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs mt-4 rounded-xl flex items-center justify-center gap-1.5 h-9"
          >
            <span>Book Appointment</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Hostel Information */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-sky-500/35 transition-all md:col-span-2">
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Hostel Room Information</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-450 block mb-0.5 text-[10px]">Hostel Block</span>
                <span className="font-bold text-gray-850 dark:text-gray-200">{block}</span>
              </div>
              <div>
                <span className="text-gray-450 block mb-0.5 text-[10px]">Room Number</span>
                <span className="font-bold text-gray-850 dark:text-gray-200">{room}</span>
              </div>
              <div>
                <span className="text-gray-450 block mb-0.5 text-[10px]">Mess Selection</span>
                <span className="font-bold text-gray-850 dark:text-gray-200 capitalize">{messType} Mess</span>
              </div>
              <div>
                <span className="text-gray-450 block mb-0.5 text-[10px]">Chief Warden</span>
                <span className="font-bold text-gray-850 dark:text-gray-200">Dr. K. Srinivasan</span>
              </div>
            </div>

            <div className="h-px bg-gray-150 dark:bg-gray-850" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-450 uppercase mb-2">Emergency Contacts</p>
                <div className="space-y-1.5 text-[11px] text-gray-700 dark:text-gray-350">
                  <div className="flex items-center justify-between">
                    <span>Hostel Office:</span>
                    <a href="tel:+914439931555" className="font-semibold text-sky-400 hover:underline">+91 44 3993 1555</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Warden Office:</span>
                    <a href="tel:+914439931666" className="font-semibold text-sky-400 hover:underline">+91 44 3993 1666</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Medical / Ambulance:</span>
                    <a href="tel:+914439931108" className="font-semibold text-rose-400 hover:underline font-bold">+91 44 3993 1108</a>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-450 uppercase mb-2">Useful Links</p>
                <div className="space-y-1 text-[11px] text-gray-700 dark:text-gray-350">
                  <a href="https://vtop.vit.ac.in/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between hover:text-sky-400 transition-colors">
                    <span>VTOP Portal</span>
                    <ExternalLink size={11} className="text-gray-400" />
                  </a>
                  <a href="#" className="flex items-center justify-between hover:text-sky-400 transition-colors">
                    <span>Mess Change Request Form</span>
                    <ChevronRight size={11} className="text-gray-400" />
                  </a>
                  <a href="#" className="flex items-center justify-between hover:text-sky-400 transition-colors">
                    <span>Hostel Grievance Register</span>
                    <ChevronRight size={11} className="text-gray-400" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
