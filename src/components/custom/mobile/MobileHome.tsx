"use client";

import React, { useMemo, useState } from "react";
import { 
  CalendarCheck, 
  GraduationCap, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Calendar, 
  Coffee, 
  Search, 
  ArrowRight, 
  Plus, 
  Minus,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Sliders,
  ChevronRight,
  Plane,
  Bus,
  Bookmark,
  FolderOpen
} from "lucide-react";
import config from "../../../../config.json";

interface MobileHomeProps {
  attendanceData: any;
  marksData: any;
  hostelData: any;
  registeredEvents: any[];
  moodleData: any[];
  settings: any;
  IDs: any;
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (tab: string) => void;
  setHostelActiveSubTab: (tab: string) => void;
  setActiveAttendanceSubTab: (tab: string) => void;
  setActiveMoreSubTab: (tab: string) => void;
  handleReloadRequest: () => Promise<void>;
  onOpenCommandPalette: () => void;
}

export default function MobileHome({
  attendanceData,
  marksData,
  hostelData,
  registeredEvents,
  moodleData,
  settings,
  IDs,
  setActiveTab,
  setActiveSubTab,
  setHostelActiveSubTab,
  setActiveAttendanceSubTab,
  setActiveMoreSubTab,
  handleReloadRequest,
  onOpenCommandPalette,
}: MobileHomeProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const slotMap = config.slotMap as any;

  // Determine current meal time
  const currentMealType = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 10) return "Breakfast";
    if (hour < 15) return "Lunch";
    if (hour < 18) return "Snacks";
    return "Dinner";
  }, []);

  // Today's classes schedule
  const todayClasses = useMemo(() => {
    if (!attendanceData?.attendance) return [];
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const todayIndex = new Date().getDay();
    const todayStr = days[todayIndex];

    const result: any[] = [];
    attendanceData.attendance.forEach((course: any) => {
      if (!course.slotName) return;
      const slots = course.slotName.split("+");
      slots.forEach((slot: string) => {
        const cleanSlot = slot.trim();
        if (slotMap[todayStr] && slotMap[todayStr][cleanSlot]) {
          const info = slotMap[todayStr][cleanSlot];
          result.push({
            ...course,
            slotName: cleanSlot,
            time: info.time,
          });
        }
      });
    });

    // Sort classes by time
    const parseTime = (timeStr: string) => {
      const [start] = timeStr.split("-").map(t => t.trim());
      let [h, m] = start.split(":").map(Number);
      if (h < 8) h += 12;
      return h * 60 + m;
    };

    return result.sort((a, b) => parseTime(a.time) - parseTime(b.time));
  }, [attendanceData, slotMap]);

  // Current or Next class
  const classStatus = useMemo(() => {
    if (todayClasses.length === 0) return { current: null, next: null };
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr: string) => {
      const [start, end] = timeStr.split("-").map(t => t.trim());
      const parseSingle = (str: string) => {
        let [h, m] = str.split(":").map(Number);
        if (h < 8) h += 12;
        return h * 60 + m;
      };
      return { start: parseSingle(start), end: parseSingle(end) };
    };

    let current: any = null;
    let next: any = null;

    for (const cls of todayClasses) {
      const { start, end } = parseTime(cls.time);
      if (currentMinutes >= start && currentMinutes <= end) {
        current = cls;
      } else if (currentMinutes < start && !next) {
        next = cls;
      }
    }

    return { current, next };
  }, [todayClasses]);

  // Overall attendance calculations
  const overallAttendance = useMemo(() => {
    if (!attendanceData?.attendance || attendanceData.attendance.length === 0) return { percentage: 0, status: "N/A" };
    let totalClasses = 0;
    let attendedClasses = 0;
    attendanceData.attendance.forEach((a: any) => {
      totalClasses += a.totalClasses || 0;
      attendedClasses += a.attendedClasses || 0;
    });
    const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
    return {
      percentage,
      status: percentage >= 80 ? "Safe" : percentage >= 75 ? "Warning" : "Critical"
    };
  }, [attendanceData]);

  // Critical attendance warnings (< 75%)
  const criticalCourses = useMemo(() => {
    if (!attendanceData?.attendance) return [];
    return attendanceData.attendance.filter((c: any) => {
      const pct = parseFloat(c.attendancePercentage);
      return !isNaN(pct) && pct < 75;
    });
  }, [attendanceData]);

  // Today's mess menu meal
  const todayMeal = useMemo(() => {
    if (!hostelData?.messMenu || !Array.isArray(hostelData.messMenu)) return null;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const todayMenu = hostelData.messMenu.find((m: any) => m.day === todayName);
    if (!todayMenu) return null;
    return todayMenu[currentMealType.toLowerCase()] || todayMenu[currentMealType] || null;
  }, [hostelData, currentMealType]);

  // Upcoming moodle deadlines
  const upcomingDeadlines = useMemo(() => {
    if (!moodleData || moodleData.length === 0) return [];
    const now = new Date().getTime();
    return moodleData
      .filter((task: any) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate).getTime();
        return due > now && !task.hidden;
      })
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 2);
  }, [moodleData]);

  const handleRefresh = async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    setTimeout(() => setIsSpinning(false), 800);
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="w-full space-y-6 pb-24 md:pb-0 animate-in fade-in duration-300">
      {/* ── HEADER & GREETING ── */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold mt-0.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Welcome back, {settings.friendlyName || IDs.VtopUsername}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm active:scale-95 transition-transform"
        >
          <RefreshCcw className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── QUICK SPOTLIGHT TRIGGER ── */}
      <button 
        onClick={onOpenCommandPalette}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800/80 shadow-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 text-left transition-all active:scale-[0.99]"
      >
        <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-medium flex-1">Search anything... (Spotlight)</span>
        <span className="text-[10px] font-bold bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg">⌘K</span>
      </button>

      {/* ── ATTENDANCE HERO CIRCLE CARD ── */}
      <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/10 rounded-3xl p-5 flex items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-gray-800" />
            <circle 
              cx="18" 
              cy="18" 
              r="15.5" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3.2" 
              strokeDasharray={`${overallAttendance.percentage} 100`} 
              strokeLinecap="round" 
              className={overallAttendance.status === "Safe" ? "text-emerald-500" : overallAttendance.status === "Warning" ? "text-amber-500" : "text-red-500"} 
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black text-gray-900 dark:text-white leading-none">
              {overallAttendance.percentage.toFixed(0)}%
            </span>
            <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Overall</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Attendance Summary</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Status: <span className={`font-black ${overallAttendance.status === "Safe" ? "text-emerald-500" : overallAttendance.status === "Warning" ? "text-amber-500" : "text-red-500"}`}>{overallAttendance.status}</span>
          </p>
          <button 
            onClick={() => setActiveTab("attendance")}
            className="mt-3 flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 active:translate-x-1 transition-transform"
          >
            Predict Attendance <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── CRITICAL ALERTS ── */}
      {criticalCourses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" />
            <span>Critical Attendance ({criticalCourses.length})</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {criticalCourses.map((c: any) => (
              <div 
                key={c.courseCode} 
                onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-red-500/5 border border-red-500/10 active:scale-[0.99] transition-all"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{c.courseTitle}</p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{c.courseCode} • Slot {c.slotName}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-red-600 dark:text-red-400">{parseFloat(c.attendancePercentage).toFixed(0)}%</span>
                  <p className="text-[9px] text-red-500/70 font-semibold mt-0.5">Below 75%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TODAY'S CLASS SCHEDULE (NOW & NEXT) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Today's Classes</span>
          </h2>
          <span className="text-xs font-bold text-gray-500">{todayClasses.length} Scheduled</span>
        </div>

        {todayClasses.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
            <Coffee className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm font-bold text-gray-500">No classes today!</p>
            <p className="text-xs text-gray-400 mt-0.5">Enjoy your free time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Current Ongoing Class */}
            {classStatus.current && (
              <div className="p-4 rounded-3xl bg-blue-600 dark:bg-blue-600 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full pointer-events-none" />
                <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/20 rounded-md">
                  Ongoing Now
                </span>
                <h4 className="font-extrabold text-base mt-2 leading-tight">
                  {classStatus.current.courseTitle}
                </h4>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/80 font-medium">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{classStatus.current.time}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{classStatus.current.slotVenue || "N/A"}</span>
                </div>
              </div>
            )}

            {/* Next Scheduled Class */}
            {classStatus.next ? (
              <div 
                onClick={() => { setActiveTab("attendance"); }}
                className="p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center gap-3 active:scale-[0.99] transition-all"
              >
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Next Class</span>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate mt-0.5">
                    {classStatus.next.courseTitle}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3">
                    <span>{classStatus.next.time}</span>
                    <span>•</span>
                    <span>Venue: {classStatus.next.slotVenue || "N/A"}</span>
                  </p>
                </div>
              </div>
            ) : !classStatus.current ? (
              <div className="p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-500 font-semibold">Done with classes for today!</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS GRID ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => { setActiveTab("attendance"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <Sliders className="w-5 h-5 text-blue-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Predict Att.</span>
          </button>
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("gpa"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <TrendingUp className="w-5 h-5 text-emerald-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">GPA Calc</span>
          </button>
          <button 
            onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("leave"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <Plane className="w-5 h-5 text-rose-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Apply Leave</span>
          </button>
          <button 
            onClick={() => { setActiveTab("dayscholar"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <Bus className="w-5 h-5 text-amber-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Bus Routes</span>
          </button>
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("wishlist"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <Bookmark className="w-5 h-5 text-violet-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Wishlist</span>
          </button>
          <button 
            onClick={onOpenCommandPalette}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center active:scale-95 transition-all"
          >
            <FolderOpen className="w-5 h-5 text-indigo-500 mb-1.5" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">All Modules</span>
          </button>
        </div>
      </div>

      {/* ── TODAY'S MEAL MENU ── */}
      {todayMeal && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4" />
              <span>Mess Menu • {currentMealType}</span>
            </h2>
            <button 
              onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("mess"); }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400"
            >
              Full Menu
            </button>
          </div>
          <div className="p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed font-semibold">
              {todayMeal}
            </p>
          </div>
        </div>
      )}

      {/* ── MOODLE / ASSIGNMENT DEADLINES ── */}
      {upcomingDeadlines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
            Upcoming Deadlines
          </h2>
          <div className="space-y-2">
            {upcomingDeadlines.map((task: any) => {
              const dueStr = new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });
              return (
                <div 
                  key={task.url || task.title}
                  className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex justify-between items-center"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{task.courseName || "General Assignment"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-black text-red-500 uppercase">Due</span>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">{dueStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── REGISTERED EVENTS TODAY ── */}
      {registeredEvents && registeredEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
            Registered Events
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" data-prevent-swipe="true">
            {registeredEvents.map((ev: any, idx: number) => (
              <div 
                key={idx}
                onClick={() => { setActiveTab("more"); setActiveMoreSubTab("events"); }}
                className="min-w-[70vw] snap-center p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 active:scale-[0.99] transition-all"
              >
                <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{ev.name}</h4>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{ev.date} • {ev.time}</span>
                </p>
                <div className="flex items-center justify-between text-[10px] font-bold mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">{ev.venue}</span>
                  <span className="text-blue-500">{ev.paymentStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
