"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import FreeClassroomsWidget from "./FreeClassroomsWidget";
import { getTodayAttendanceClasses } from "@/lib/attendanceTimetable";

interface MobileHomeProps {
  attendanceData: any;
  marksData: any;
  hostelData: any;
  registeredEvents: any[];
  moodleData: any[];
  settings: any;
  setSettings: any;
  IDs: any;
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (tab: string) => void;
  setHostelActiveSubTab: (tab: string) => void;
  setActiveAttendanceSubTab: (tab: string) => void;
  setActiveMoreSubTab: (tab: string) => void;
  handleReloadRequest: () => Promise<void>;
  onOpenCommandPalette: () => void;
  profileData?: any;
}

export default function MobileHome({
  attendanceData,
  marksData,
  hostelData,
  registeredEvents,
  moodleData,
  settings,
  setSettings,
  IDs,
  setActiveTab,
  setActiveSubTab,
  setHostelActiveSubTab,
  setActiveAttendanceSubTab,
  setActiveMoreSubTab,
  handleReloadRequest,
  onOpenCommandPalette,
  profileData: profileDataProp,
}: MobileHomeProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [cachedProfile, setCachedProfile] = useState<any>(profileDataProp || null);

  useEffect(() => {
    if (profileDataProp) {
      setCachedProfile(profileDataProp);
      return;
    }

    try {
      const storedProfile = localStorage.getItem("profile");
      const storedImages = localStorage.getItem("profileImages");
      const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
      const parsedImages = storedImages ? JSON.parse(storedImages) : null;
      const image =
        parsedProfile?.image ||
        parsedProfile?.photo ||
        parsedProfile?.photoBase64 ||
        parsedImages?.student?.photoBase64 ||
        parsedImages?.profile?.photoBase64 ||
        parsedImages?.studentPhoto;
      setCachedProfile(image ? { ...parsedProfile, image } : parsedProfile);
    } catch {
      setCachedProfile(null);
    }
  }, [profileDataProp]);

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
    return getTodayAttendanceClasses(attendanceData?.attendance || []);
  }, [attendanceData]);

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

  const profileName = settings?.friendlyName || cachedProfile?.name || IDs?.VtopUsername || "Student";
  const profileImage = cachedProfile?.image || cachedProfile?.photo || cachedProfile?.photoBase64;
  const showProfileImage = !settings?.hideProfileImageOutsideInfo;
  const initials = String(profileName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full space-y-6 pb-24 md:pb-0 animate-in fade-in duration-300">
      {/* ── HEADER & GREETING ── */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3.5 min-w-0">
          {showProfileImage && profileImage ? (
            <img
              src={profileImage}
              alt=""
              className="h-12 w-12 rounded-2xl border border-white/60 object-cover shadow-md dark:border-gray-800 md:h-14 md:w-14"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-info flex items-center justify-center text-white font-black text-sm shadow-md border border-white/15 shrink-0 md:h-14 md:w-14">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              {getGreeting()}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5 flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-info shrink-0" />
              <span className="truncate">Welcome, {profileName}</span>
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-xs active:scale-95 transition-all"
        >
          <RefreshCcw className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── QUICK SPOTLIGHT TRIGGER ── */}
      <button 
        onClick={onOpenCommandPalette}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-gray-950/80 border border-gray-200/70 dark:border-gray-800 shadow-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-left transition-all active:scale-[0.99] relative overflow-hidden group backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-info-surface opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="text-sm font-bold flex-1 text-gray-400 dark:text-gray-500">Search anything... (Spotlight)</span>
        <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg">⌘K</span>
      </button>

      {/* ── QUICK INSIGHTS DOCK ── */}
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none px-1" data-prevent-swipe="true">
        {/* CGPA Card */}
        <button
          onClick={() => {
            setSettings((prev: any) => {
              const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
              localStorage.setItem("settings", JSON.stringify(next));
              return next;
            });
          }}
          className="min-w-[125px] flex-1 snap-center p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between h-20 text-left relative overflow-hidden transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <span className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Cumulative GPA</span>
          <p className={`text-lg font-black text-gray-950 dark:text-white leading-none mt-1 transition-all duration-300 ${settings.CGPAHidden ? "blur-[5px] select-none" : ""}`}>
            {marksData?.cgpa?.cgpa ? Number(marksData.cgpa.cgpa).toFixed(2) : "—"}
          </p>
          <span className="text-[8px] text-gray-400 dark:text-gray-500 font-semibold leading-none">VTOP Verified</span>
        </button>

        {/* Credits Card */}
        <div className="min-w-[125px] flex-1 snap-center p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between h-20 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-info-surface rounded-bl-full pointer-events-none" />
          <span className="text-[9px] font-black text-info uppercase tracking-widest">Credits Earned</span>
          <p className="text-lg font-black text-gray-950 dark:text-white leading-none mt-1">
            {marksData?.cgpa?.creditsEarned ? Number(marksData.cgpa.creditsEarned) : "—"}
          </p>
          <span className="text-[8px] text-gray-400 dark:text-gray-500 font-semibold leading-none">Total Degree</span>
        </div>

        {/* OD Hours Card */}
        <div className="min-w-[125px] flex-1 snap-center p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between h-20 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/5 rounded-bl-full pointer-events-none" />
          <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest">OD Approved</span>
          <p className="text-lg font-black text-gray-950 dark:text-white leading-none mt-1">
            {attendanceData?.odHoursTotal ? attendanceData.odHoursTotal : "0"} hrs
          </p>
          <span className="text-[8px] text-gray-400 dark:text-gray-500 font-semibold leading-none">On-Duty History</span>
        </div>
      </div>

      {/* ── ATTENDANCE HERO CIRCLE CARD ── */}
      <div className="bg-info-surface border border-info/15 rounded-3xl p-5.5 md:p-6 flex items-center gap-6 relative overflow-hidden shadow-xs backdrop-blur-md">
        <div className="absolute top-0 right-0 w-36 h-36 bg-info-surface rounded-bl-full pointer-events-none" />
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3.2" className="text-gray-100/80 dark:text-gray-800/60" />
            <circle 
              cx="18" 
              cy="18" 
              r="15.5" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3.4" 
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
        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider font-[family-name:var(--font-outfit)]">Attendance Summary</h3>
          <div className="mt-1.5 flex items-center">
            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              overallAttendance.status === "Safe" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450" 
                : overallAttendance.status === "Warning"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-450"
                  : "bg-red-500/10 border-red-500/20 text-red-650 dark:text-red-450"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                overallAttendance.status === "Safe" ? "bg-emerald-500 animate-pulse" : overallAttendance.status === "Warning" ? "bg-amber-500" : "bg-red-500"
              }`} />
              {overallAttendance.status}
            </span>
          </div>
          <button 
            onClick={() => setActiveTab("attendance")}
            className="mt-3.5 flex items-center gap-1.5 text-[10px] font-black text-info bg-info-surface border border-info/10 px-3 py-1.5 rounded-xl w-fit active:scale-95 transition-all shadow-2xs hover:shadow-xs uppercase tracking-wider"
          >
            Predict Attendance <ChevronRight className="w-3.5 h-3.5 shrink-0" />
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
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
              <div className="p-4 rounded-3xl bg-info text-white shadow-md border border-info/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full pointer-events-none" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/20 dark:bg-black/30 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-ping" />
                  Ongoing Now
                </span>
                <h4 className="font-extrabold text-base mt-2 leading-tight">
                  {classStatus.current.courseTitle}
                </h4>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/80 font-semibold">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{classStatus.current.time}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{classStatus.current.slotVenue || "N/A"}</span>
                </div>
              </div>
            )}

            {/* Next Scheduled Class */}
            {classStatus.next ? (
              <div 
                onClick={() => { setActiveTab("attendance"); }}
                className="p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center gap-3 active:scale-[0.99] transition-all"
              >
                <div className="p-2.5 rounded-2xl bg-info-surface text-info shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-info font-bold uppercase tracking-wider">Next Class</span>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate mt-0.5">
                    {classStatus.next.courseTitle}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{classStatus.next.time}</span>
                    <span className="shrink-0">•</span>
                    <span className="truncate">Venue: {classStatus.next.slotVenue || "N/A"}</span>
                  </p>
                </div>
              </div>
            ) : !classStatus.current ? (
              <div className="p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-500 font-semibold">Done with classes for today!</p>
              </div>
            ) : null}

            <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Full Schedule</span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{todayClasses.length} total</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {todayClasses.map((cls: any) => {
                  const isCurrent = classStatus.current === cls;
                  const isNext = classStatus.next === cls;
                  return (
                    <button
                      key={`${cls.courseCode}-${cls.slotName}-${cls.time}`}
                      onClick={() => { setActiveTab("attendance"); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                    >
                      <div className={`w-1.5 h-10 rounded-full shrink-0 ${
                        isCurrent ? "bg-emerald-500" : isNext ? "bg-info" : "bg-gray-200 dark:bg-gray-700"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-xs font-black text-gray-900 dark:text-white truncate">{cls.courseTitle}</p>
                          {isCurrent && <span className="shrink-0 text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400">Now</span>}
                          {isNext && <span className="shrink-0 text-[8px] font-black uppercase text-info">Next</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 truncate">
                          {cls.courseCode} • Slot {cls.slotName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-black text-gray-700 dark:text-gray-200">{cls.time}</p>
                        <p className="mt-0.5 max-w-24 truncate text-[9px] font-semibold text-gray-400 dark:text-gray-500">{cls.slotVenue || "N/A"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS GRID ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
          <button 
            onClick={() => { setActiveTab("attendance"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-info-surface border border-info/20 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-info-surface flex items-center justify-center mb-1.5 text-info shrink-0">
              <Sliders className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">Predict Att.</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("predictor"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/20 border border-emerald-100/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-550/20 flex items-center justify-center mb-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">GPA Calc</span>
          </button>

          <button 
            onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("leave"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-50/20 border border-rose-100/50 dark:bg-rose-950/10 dark:border-rose-900/30 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 dark:bg-rose-550/20 flex items-center justify-center mb-1.5 text-rose-600 dark:text-rose-455 shrink-0">
              <Plane className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">Apply Leave</span>
          </button>

          <button 
            onClick={() => { setActiveTab("dayscholar"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50/20 border border-amber-100/50 dark:bg-amber-950/10 dark:border-amber-900/30 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-550/20 flex items-center justify-center mb-1.5 text-amber-605 dark:text-amber-400 shrink-0">
              <Bus className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">Bus Routes</span>
          </button>

          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("wishlist"); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-violet-50/20 border border-violet-100/50 dark:bg-violet-950/10 dark:border-violet-900/30 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-550/20 flex items-center justify-center mb-1.5 text-violet-600 dark:text-violet-400 shrink-0">
              <Bookmark className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">Wishlist</span>
          </button>

          <button 
            onClick={onOpenCommandPalette}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-info-surface border border-info/20 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-info-surface flex items-center justify-center mb-1.5 text-info shrink-0">
              <FolderOpen className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-slate-805 dark:text-gray-300">All Modules</span>
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
              className="text-xs font-bold text-info"
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
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
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
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate">{task.courseName || "General Assignment"}</p>
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
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible" data-prevent-swipe="true">
            {registeredEvents.map((ev: any, idx: number) => (
              <div 
                key={idx}
                onClick={() => { setActiveTab("more"); setActiveMoreSubTab("events"); }}
                className="min-w-[70vw] snap-center p-4 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 active:scale-[0.99] transition-all md:min-w-0"
              >
                <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{ev.name}</h4>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{ev.date} • {ev.time}</span>
                </p>
                <div className="flex items-center justify-between text-[10px] font-bold mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 gap-2 min-w-0">
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1 text-left">{ev.venue}</span>
                  <span className="text-info shrink-0">{ev.paymentStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
