"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Car,
  Bookmark,
  FolderOpen,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Shirt,
  Maximize2,
  Minimize2,
  GripVertical
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Switch } from "@amazecontinuityprojects/amazeui";
import FreeClassroomsWidget from "./FreeClassroomsWidget";
import CabShareMatchCard from "../hostel/CabShare/CabShareMatchCard";
import TabHelpFooter from "../shared/TabHelpFooter";
import { getTodayAttendanceClasses } from "@/lib/attendanceTimetable";
import { shouldShowGpa, shouldShowProfilePhoto } from "@/lib/settingsVisibility";
import { API_BASE } from "@/lib/fetch-utils";

interface MobileHomeProps {
  attendanceData: any;
  marksData: any;
  scheduleData?: any;
  handleScheduleFetch?: () => void;
  ODhoursData?: any;
  setODhoursIsOpen?: (val: boolean) => void;
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
  setActiveProfileSubTab: (tab: string) => void;
  handleReloadRequest: () => Promise<void>;
  onOpenCommandPalette: () => void;
  profileData?: any;
}

interface WidgetItem {
  id: string;
  title: string;
  enabled: boolean;
  span?: "full" | "half";
}

const DEFAULT_WIDGETS: WidgetItem[] = [
  { id: "insights", title: "Quick Insights Dock", enabled: true, span: "full" },
  { id: "attendance", title: "Attendance Summary Card", enabled: true, span: "full" },
  { id: "classes", title: "Today's Classes", enabled: true, span: "half" },
  { id: "exam_schedule", title: "Upcoming Exam Schedule", enabled: true, span: "half" },
  { id: "attendance_courses", title: "Course Attendance Detail", enabled: true, span: "full" },
  { id: "academic_courses", title: "Current Semester Courses", enabled: true, span: "full" },
  { id: "critical", title: "Critical Attendance Alert", enabled: true, span: "full" },
  { id: "actions", title: "Quick Actions Grid", enabled: true, span: "half" },
  { id: "laundry", title: "Laundry Slot Status", enabled: true, span: "half" },
  { id: "mess", title: "Today's Mess Menu", enabled: true, span: "half" },
  { id: "deadlines", title: "Upcoming Deadlines", enabled: true, span: "half" },
  { id: "classrooms", title: "Free Classrooms Finder", enabled: true, span: "half" },
  { id: "events", title: "Registered Events", enabled: true, span: "half" },
  { id: "quick_settings", title: "Quick Settings Panel", enabled: true, span: "half" },
  { id: "cabshare", title: "Cab Share Promo", enabled: false, span: "full" },
  { id: "cabshare_match", title: "Cab Share Matches", enabled: false, span: "full" },
  { id: "dayscholar_guide", title: "Day Scholar Helper", enabled: false, span: "full" },
];

export default function MobileHome({
  attendanceData,
  marksData,
  scheduleData,
  handleScheduleFetch,
  ODhoursData,
  setODhoursIsOpen,
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
  setActiveProfileSubTab,
  handleReloadRequest,
  onOpenCommandPalette,
  profileData: profileDataProp,
}: MobileHomeProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [cachedProfile, setCachedProfile] = useState<any>(profileDataProp || null);
  const [globalPromoteCab, setGlobalPromoteCab] = useState(false);
  
  // Customizable Widgets State
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [widgets, setWidgets] = useState<WidgetItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("amaze_dashboard_widgets");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const merged = parsed.map((p: any) => {
              const def = DEFAULT_WIDGETS.find(d => d.id === p.id);
              return {
                ...p,
                span: p.span || def?.span || "full"
              };
            });
            DEFAULT_WIDGETS.forEach(def => {
              if (!merged.some((m: any) => m.id === def.id)) {
                merged.push(def);
              }
            });
            return merged;
          }
        } catch (e) {}
      }
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem("amaze_dashboard_widgets", JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidgetSpan = (id: string) => {
    setWidgets(prev =>
      prev.map(w => {
        if (w.id === id) {
          const nextSpan = w.span === "full" ? "half" : "full";
          return { ...w, span: nextSpan };
        }
        return w;
      })
    );
  };

  // Load global cab share settings
  useEffect(() => {
    fetch(`${API_BASE}/api/settings/global`)
      .then(r => r.json())
      .then(data => {
        if (data?.success && data.config?.promoteCabShare?.enabled === true) {
          setGlobalPromoteCab(true);
        }
      })
      .catch(() => {});
  }, []);

  // Sync profile info
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

  // Dynamic laundry schedule loaders
  const [laundrySchedule, setLaundrySchedule] = useState<any[]>([]);
  
  const laundryInfo = useMemo(() => {
    if (!hostelData?.hostelInfo?.isHosteller) return null;
    const normalizedGender = hostelData.hostelInfo.gender?.toLowerCase() === "female" ? "Female" : "Male";
    const blockName = hostelData.hostelInfo.blockName?.split(" ")[0] || "A";
    const roomNo = hostelData.hostelInfo.roomNo || "";
    return { gender: normalizedGender, hostel: blockName, roomNo };
  }, [hostelData]);

  useEffect(() => {
    if (!laundryInfo) return;
    const { gender, hostel } = laundryInfo;
    const fileName = `VITC-${hostel}-${gender[0]}-L.json`;
    
    try {
      const cached = localStorage.getItem(fileName);
      if (cached) {
        setLaundrySchedule(JSON.parse(cached).list || []);
      }
    } catch (e) {}

    fetch(`/data/laundry/${fileName}`)
      .then(res => res.json())
      .then(data => {
        if (data?.list) {
          setLaundrySchedule(data.list);
          localStorage.setItem(fileName, JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, [laundryInfo]);

  const laundryStatus = useMemo(() => {
    if (!laundryInfo || laundrySchedule.length === 0) return null;
    const todayNum = new Date().getDate();
    
    const cleanRoomNum = laundryInfo.roomNo
      ? (laundryInfo.roomNo.match(/\d+/) ? parseInt(laundryInfo.roomNo.match(/\d+/)![0], 10) : null)
      : null;

    const isRoomInSlotRange = (roomRangeStr: any) => {
      if (!cleanRoomNum || !roomRangeStr || typeof roomRangeStr !== "string") return false;
      const matches = roomRangeStr.match(/\d+/g);
      if (matches && matches.length >= 2) {
        const start = parseInt(matches[0], 10);
        const end = parseInt(matches[1], 10);
        return cleanRoomNum >= start && cleanRoomNum <= end;
      }
      return false;
    };

    const matchingSlots = laundrySchedule.filter((item) => isRoomInSlotRange(item.RoomNumber));
    const hasSlotToday = matchingSlots.some((slot) => parseInt(slot.Date, 10) === todayNum);
    const nextSlot = matchingSlots.find((slot) => parseInt(slot.Date, 10) >= todayNum);

    return { hasSlotToday, nextSlot, matchingSlots, todayNum };
  }, [laundryInfo, laundrySchedule]);

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

  // Approved OD hours total calculation
  const totalODHours = useMemo(() => {
    if (Array.isArray(ODhoursData) && ODhoursData.length > 0) {
      return ODhoursData.reduce((sum: number, day: any) => sum + (Number(day.total) || 0), 0);
    }
    if (attendanceData?.attendance && Array.isArray(attendanceData.attendance)) {
      let total = 0;
      attendanceData.attendance.forEach((course: any) => {
        if (Array.isArray(course.viewLink)) {
          course.viewLink.forEach((day: any) => {
            if (day.status === "On Duty") {
              const hours = (course.slotName || "").startsWith("L") ? 2 : 1;
              total += hours;
            }
          });
        }
      });
      return total;
    }
    return 0;
  }, [ODhoursData, attendanceData]);

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
    if (!attendanceData?.attendance || !Array.isArray(attendanceData.attendance)) return [];
    return attendanceData.attendance.filter((c: any) => {
      if (!c) return false;
      const slot = String(c.slotName || "").trim().toUpperCase();
      const code = String(c.courseCode || "").trim().toUpperCase();
      const title = String(c.courseTitle || "").trim().toUpperCase();
      const total = parseInt(c.totalClasses, 10) || 0;

      if (slot.includes("NULL") || slot === "NIL" || slot === "N/A") return false;
      if (code === "NIL" || code === "NULL" || !code) return false;
      if (title === "NIL" || title === "NULL" || !title) return false;
      if (total === 0) return false;

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

  const handleRefresh = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    window.setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    const enabledWidgets = widgets.filter(w => w.enabled);
    const indexInEnabled = enabledWidgets.findIndex(w => w.id === id);
    if (indexInEnabled === -1) return;

    const nextIndexInEnabled = direction === "up" ? indexInEnabled - 1 : indexInEnabled + 1;
    if (nextIndexInEnabled < 0 || nextIndexInEnabled >= enabledWidgets.length) return;

    const targetWidget = enabledWidgets[nextIndexInEnabled];

    const absIndex1 = widgets.findIndex(w => w.id === id);
    const absIndex2 = widgets.findIndex(w => w.id === targetWidget.id);

    if (absIndex1 === -1 || absIndex2 === -1) return;

    const updated = [...widgets];
    const temp = updated[absIndex1];
    updated[absIndex1] = updated[absIndex2];
    updated[absIndex2] = temp;
    setWidgets(updated);
  };

  const toggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const profileName = settings?.friendlyName || cachedProfile?.name || IDs?.VtopUsername || "Student";
  const profileImage = cachedProfile?.image || cachedProfile?.photo || cachedProfile?.photoBase64;
  const shouldDisplayGpa = shouldShowGpa(settings);
  const shouldDisplayProfilePhoto = shouldShowProfilePhoto(settings);
  const initials = String(profileName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── WIDGETS RENDER METHODS ──

  const renderCabSharePromo = () => {
    return (
      <button
        onClick={() => { setActiveTab("cabshare"); window.scrollTo(0, 0); }}
        className="w-full flex items-center gap-4 px-5 py-4 rounded-[24px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm active:scale-[0.98] transition-all duration-150 text-left"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
          <Car className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-amber-100">Use CAB Share</p>
          <p className="text-sm font-bold mt-0.5">Share a cab with students heading the same way</p>
        </div>
        <ChevronRight className="w-5 h-5 shrink-0 text-white/80" />
      </button>
    );
  };

  const renderCabShareMatch = () => (
    <CabShareMatchCard />
  );

  const renderDayScholarWidget = () => {
    const isDayscholar = settings?.residentialStatus === "dayscholar" || cachedProfile?.residentialStatus === "dayscholar" || hostelData?.hostelInfo?.isHosteller === false;
    if (!isDayscholar) return null;

    return (
      <div className="p-5 rounded-[24px] bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/5 border border-indigo-100/50 dark:border-indigo-900/30 text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-550/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-400 rounded-md">
          Day Scholar Mode
        </span>
        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white mt-2 leading-tight font-outfit">
          Find Study Spots & Bus Routes
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
          Use the Free Classrooms finder to locate an empty room between classes, or view active bus schedules.
        </p>
        <div className="flex gap-2 mt-4">
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("free-class"); }}
            className="flex items-center gap-1 text-[10px] font-black text-white bg-indigo-650 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-2xs"
          >
            Find Classrooms
          </button>
          <button 
            onClick={() => { setActiveTab("dayscholar"); }}
            className="flex items-center gap-1 text-[10px] font-black text-indigo-650 dark:text-indigo-400 bg-white/80 dark:bg-zinc-900/60 border border-indigo-100/50 dark:border-indigo-900/30 px-3.5 py-2 rounded-xl hover:bg-white dark:hover:bg-zinc-900 transition-all cursor-pointer uppercase tracking-wider shadow-2xs"
          >
            Bus Routes
          </button>
        </div>
      </div>
    );
  };

  const renderInsightsDock = () => {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none" data-prevent-swipe="true">
        {/* CGPA Card */}
        {shouldDisplayGpa ? (
          <button
            onClick={() => {
              setSettings((prev: any) => {
                const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
                localStorage.setItem("settings", JSON.stringify(next));
                return next;
              });
            }}
            className="min-w-[125px] flex-1 snap-center p-4 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-24 text-left relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
            <span className="text-[9px] font-black text-emerald-655 dark:text-emerald-400 uppercase tracking-widest font-outfit font-black">Cumulative GPA</span>
            <p className={`text-xl font-black text-zinc-900 dark:text-white leading-none mt-1 transition-all duration-300 ${settings?.CGPAHidden || settings?.blurGrades ? "blur-[5px] select-none hover:blur-none" : ""}`}>
              {marksData?.cgpa?.cgpa ? Number(marksData.cgpa.cgpa).toFixed(2) : "—"}
            </p>
            <span className="text-[8px] text-zinc-400 dark:text-zinc-550 font-bold leading-none">VTOP Verified</span>
          </button>
        ) : null}

        {/* Credits Card */}
        <div className="min-w-[125px] flex-1 snap-center p-4 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-24 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/5 rounded-bl-full pointer-events-none" />
          <span className="text-[9px] font-black text-blue-655 dark:text-blue-400 uppercase tracking-widest font-outfit font-black">Credits Earned</span>
          <p className={`text-xl font-black text-zinc-900 dark:text-white leading-none mt-1 transition-all duration-300 ${settings?.blurGrades ? "blur-[5px] select-none hover:blur-none" : ""}`}>
            {marksData?.cgpa?.creditsEarned ? Number(marksData.cgpa.creditsEarned) : "—"}
          </p>
          <span className="text-[8px] text-zinc-400 dark:text-zinc-555 font-bold leading-none">Total Degree</span>
        </div>

        {/* OD Hours Card */}
        <button
          onClick={() => {
            if (setODhoursIsOpen) {
              setODhoursIsOpen(true);
            } else {
              setActiveTab("attendance");
              setActiveAttendanceSubTab("attendance");
            }
          }}
          className="min-w-[125px] flex-1 snap-center p-4 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-24 text-left relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/5 rounded-bl-full pointer-events-none" />
          <span className="text-[9px] font-black text-amber-600 dark:text-amber-455 uppercase tracking-widest font-outfit font-black">OD Approved</span>
          <p className="text-xl font-black text-zinc-900 dark:text-white leading-none mt-1">
            {totalODHours} hrs
          </p>
          <span className="text-[8px] text-zinc-400 dark:text-zinc-555 font-bold leading-none font-outfit">On-Duty History</span>
        </button>
      </div>
    );
  };

  const renderAttendanceHero = () => {
    return (
      <div className="bg-gradient-to-br from-indigo-50/40 to-blue-50/40 dark:from-indigo-950/20 dark:to-blue-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-[24px] p-6 flex items-center gap-6 relative overflow-hidden shadow-xs backdrop-blur-md">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-bl-full pointer-events-none" />
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3.2" className="text-gray-250 dark:text-zinc-800" />
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
            <span className="text-base font-black text-gray-900 dark:text-white leading-none font-outfit">
              {overallAttendance.percentage.toFixed(0)}%
            </span>
            <span className="text-[8px] text-gray-400 dark:text-gray-500 font-extrabold uppercase mt-0.5">Overall</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider font-outfit">Attendance Summary</h3>
          <div className="mt-1.5 flex items-center">
            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              overallAttendance.status === "Safe" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450" 
                : overallAttendance.status === "Warning"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-450"
                  : "bg-red-500/10 border-red-500/20 text-red-655 dark:text-red-450"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                overallAttendance.status === "Safe" ? "bg-emerald-500 animate-pulse" : overallAttendance.status === "Warning" ? "bg-amber-500" : "bg-red-500"
              }`} />
              {overallAttendance.status}
            </span>
          </div>
          <button 
            onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
            className="mt-3.5 flex items-center gap-1.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white/50 dark:bg-zinc-900/50 border border-indigo-100/50 dark:border-indigo-900/20 px-3.5 py-1.5 rounded-xl w-fit active:scale-95 transition-all shadow-2xs hover:shadow-xs uppercase tracking-wider cursor-pointer font-outfit"
          >
            Predict Attendance <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    );
  };

  const renderAttendanceCoursesWidget = () => {
    if (!attendanceData?.attendance || !Array.isArray(attendanceData.attendance) || attendanceData.attendance.length === 0) return null;

    // Filter out invalid/NULL slots and empty/NIL course codes
    const validItems = attendanceData.attendance.filter((c: any) => {
      if (!c) return false;
      const slot = String(c.slotName || "").trim().toUpperCase();
      const code = String(c.courseCode || "").trim().toUpperCase();
      const title = String(c.courseTitle || "").trim().toUpperCase();

      if (slot.includes("NULL") || slot === "NIL" || slot === "N/A") return false;
      if (code === "NIL" || code === "NULL" || !code) return false;
      if (title === "NIL" || title === "NULL" || !title) return false;

      return true;
    });

    if (validItems.length === 0) return null;

    // Group items by base course code (combining Theory & Lab under 1 card with distinct bars)
    const getBaseCourseCode = (rawCode: string): string => {
      if (!rawCode) return "";
      let clean = String(rawCode).trim().toUpperCase();
      clean = clean.replace(/\s*\((T|L|P|ETH|ELA|EPJ|TH|LAB|SS)\)\s*$/i, "").trim();
      clean = clean.replace(/\s*-(T|L|P)\s*$/i, "").trim();
      const vtopMatch = clean.match(/^([A-Z]{3,4}\d{3,4})[LPT]$/i);
      if (vtopMatch) {
        return vtopMatch[1].toUpperCase();
      }
      return clean;
    };

    const getComponentType = (c: any): "Theory" | "Lab" | "Practical" => {
      const code = String(c.courseCode || "").trim().toUpperCase();
      const type = String(c.courseType || "").trim().toUpperCase();
      const slot = String(c.slotName || "").trim().toUpperCase();

      if (code.endsWith("(L)") || code.endsWith("(P)") || type.includes("LAB") || type.includes("PRACTICAL") || type === "ELA" || type === "EPJ" || slot.startsWith("L")) {
        return type.includes("PRACTICAL") ? "Practical" : "Lab";
      }
      return "Theory";
    };

    const groupedMap: Record<string, {
      courseCode: string;
      courseTitle: string;
      components: Array<{
        type: string;
        slotName: string;
        attendedClasses: number;
        totalClasses: number;
        pct: number;
      }>;
    }> = {};

    validItems.forEach((c: any) => {
      const rawCode = String(c.courseCode || "").trim();
      const baseKey = getBaseCourseCode(rawCode);
      const attended = parseInt(c.attendedClasses, 10) || 0;
      const total = parseInt(c.totalClasses, 10) || 0;
      const slot = String(c.slotName || "").trim();
      const pct = total > 0 ? (attended / total) * 100 : parseFloat(c.attendancePercentage) || 0;
      const compType = getComponentType(c);

      let cleanTitle = String(c.courseTitle || "").trim();
      cleanTitle = cleanTitle.replace(/\s*\((ETH|ELA|EPJ|TH|LAB|SS|T|L|P)\)\s*$/i, "").trim();
      cleanTitle = cleanTitle.replace(/\s*-\s*(Theory|Lab|Practical|Embedded Lab|Embedded Theory)\s*$/i, "").trim();

      if (!groupedMap[baseKey]) {
        groupedMap[baseKey] = {
          courseCode: baseKey,
          courseTitle: cleanTitle,
          components: [],
        };
      }

      groupedMap[baseKey].components.push({
        type: compType,
        slotName: slot,
        attendedClasses: attended,
        totalClasses: total,
        pct,
      });
    });

    const clubbedCourses = Object.values(groupedMap);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <CalendarCheck className="w-4 h-4 text-emerald-500" />
            <span>Course Attendance</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
            className="text-xs font-bold text-indigo-650 dark:text-indigo-400 cursor-pointer"
          >
            Predict Attendance
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-left">
          {clubbedCourses.map((c, index) => {
            const isGrouped = c.components.length > 1;
            return (
              <div 
                key={`${c.courseCode}-${index}`}
                onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
                className="p-4 rounded-[22px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-white/90 dark:hover:bg-zinc-900/80 hover:scale-[1.01] hover:shadow-xs active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-zinc-500/5 dark:bg-zinc-500/10 rounded-bl-full pointer-events-none" />
                <div className="min-w-0 pr-1 mb-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate font-outfit" title={c.courseTitle}>{c.courseTitle}</h4>
                    {isGrouped && (
                      <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20">
                        Theory + Lab
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] text-zinc-405 dark:text-zinc-500 font-bold mt-0.5 truncate">
                    {c.courseCode}
                  </p>
                </div>
                
                <div className="space-y-2.5">
                  {c.components.map((comp, compIdx) => {
                    const pct = comp.pct;
                    const color = pct >= 85 ? "text-emerald-500" : pct >= 75 ? "text-amber-500" : "text-red-500";
                    const bgProgress = pct >= 85 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-red-500";
                    return (
                      <div key={compIdx} className="space-y-1">
                        <div className="flex items-center justify-between text-[9.5px]">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">
                            {isGrouped ? comp.type : "Attendance"} <span className="text-zinc-400 font-medium">• Slot {comp.slotName || "N/A"}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 pl-1">
                            <span className="text-zinc-500 dark:text-zinc-400 font-medium text-[9px]">{comp.attendedClasses}/{comp.totalClasses}</span>
                            <span className={`font-black text-xs ${color}`}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-150 dark:bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${bgProgress} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCurrentCoursesWidget = () => {
    const rawList = marksData?.courses || attendanceData?.attendance || [];
    const coursesList = rawList.filter((c: any) => {
      if (!c) return false;
      const slot = String(c.slotName || "").trim().toUpperCase();
      const code = String(c.courseCode || "").trim().toUpperCase();
      if (slot.includes("NULL") || slot === "NIL") return false;
      if (code === "NIL" || code === "NULL" || !code) return false;
      return true;
    });
    if (coursesList.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <GraduationCap className="w-4 h-4 text-violet-500" />
            <span>Academic Courses</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("overview"); }}
            className="text-xs font-bold text-violet-500 cursor-pointer"
          >
            Course Dashboard
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-left">
          {coursesList.map((c: any, index: number) => (
            <div 
              key={`${c.courseCode}-${c.slotName || ''}-${index}`}
              onClick={() => { setActiveTab("academics"); setActiveSubTab("overview"); }}
              className="p-4 rounded-[22px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-white/90 dark:hover:bg-zinc-900/80 hover:scale-[1.01] hover:shadow-xs active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between h-[105px] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 dark:bg-violet-500/10 rounded-bl-full pointer-events-none" />
              <div className="min-w-0 pr-1">
                <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate font-outfit" title={c.courseTitle}>{c.courseTitle}</h4>
                <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5">{c.courseCode} • {c.courseType || "Theory/Lab"}</p>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <span className="text-[9.5px] font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 px-2 py-0.5 rounded-md">Credits: {c.credits || "4"}</span>
                <span className="text-[9.5px] font-bold text-zinc-455 dark:text-zinc-555">{c.slotName || "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCriticalAlerts = () => {
    if (criticalCourses.length === 0) return null;
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-red-655 dark:text-red-400 font-bold text-xs uppercase tracking-wider px-1">
          <AlertCircle className="w-4 h-4" />
          <span>Critical Attendance Alert ({criticalCourses.length})</span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {criticalCourses.map((c: any) => (
            <div 
              key={c.courseCode} 
              onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
              className="flex items-center justify-between p-3.5 rounded-[20px] bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 dark:border-red-500/20 active:scale-[0.99] transition-all hover:bg-red-500/10 dark:hover:bg-red-500/15 cursor-pointer text-left"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{c.courseTitle}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">{c.courseCode} • Slot {c.slotName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-black text-red-600 dark:text-red-455">{parseFloat(c.attendancePercentage).toFixed(0)}%</span>
                <p className="text-[8px] text-red-500/80 font-bold uppercase mt-0.5">Below 75%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTodayClasses = () => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <Clock className="w-4 h-4" />
            <span>Today's Classes</span>
          </h2>
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555">{todayClasses.length} Scheduled</span>
        </div>

        {todayClasses.length === 0 ? (
          <div className="p-6 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-center">
            <Coffee className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-650 mb-2 animate-pulse" />
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">No classes today!</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-550 mt-0.5 font-semibold">Enjoy your free time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classStatus.current && (
              <div className="p-4.5 rounded-[24px] bg-indigo-650 text-white shadow-sm border border-indigo-700/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full pointer-events-none" />
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-white/20 dark:bg-black/30 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Ongoing Now
                </span>
                <h4 className="font-extrabold text-base mt-2 leading-tight text-left">
                  {classStatus.current.courseTitle}
                </h4>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/80 font-semibold">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{classStatus.current.time}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{classStatus.current.slotVenue || "N/A"}</span>
                </div>
              </div>
            )}

            {classStatus.next ? (
              <div 
                onClick={() => { setActiveTab("attendance"); }}
                className="p-4.5 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 flex items-center gap-3 active:scale-[0.99] transition-all hover:bg-white/90 dark:hover:bg-zinc-900/80 cursor-pointer"
              >
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider font-outfit font-black">Next Class</span>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate mt-0.5">
                    {classStatus.next.courseTitle}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2 min-w-0 font-semibold font-outfit">
                    <span className="shrink-0">{classStatus.next.time}</span>
                    <span className="shrink-0">•</span>
                    <span className="truncate">Venue: {classStatus.next.slotVenue || "N/A"}</span>
                  </p>
                </div>
              </div>
            ) : !classStatus.current ? (
              <div className="p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-center">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Done with classes for today!</p>
              </div>
            ) : null}

            <div className="rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 p-4 text-left">
              <div className="pb-3 border-b border-zinc-250/30 dark:border-zinc-800/50 flex items-center justify-between mb-3.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-555 font-outfit">Full Schedule</span>
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">{todayClasses.length} sessions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {todayClasses.map((cls: any) => {
                  const isCurrent = classStatus.current === cls;
                  const isNext = classStatus.next === cls;
                  return (
                    <button
                      key={`${cls.courseCode}-${cls.slotName}-${cls.time}`}
                      onClick={() => { setActiveTab("attendance"); }}
                      className="px-4 py-3 flex items-center gap-3 text-left rounded-[20px] bg-zinc-50/20 dark:bg-zinc-950/10 border border-zinc-250/30 dark:border-zinc-850 hover:bg-zinc-100/50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      <div className={`w-1 h-8 rounded-full shrink-0 ${
                        isCurrent ? "bg-emerald-500 animate-pulse" : isNext ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-800"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{cls.courseTitle}</p>
                          {isCurrent && <span className="shrink-0 text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/20 px-1 rounded">Now</span>}
                          {isNext && <span className="shrink-0 text-[8px] font-black uppercase text-indigo-650 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-950/20 px-1 rounded">Next</span>}
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold text-zinc-450 dark:text-zinc-500 truncate">
                          {cls.courseCode} • Slot {cls.slotName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{cls.time}</p>
                        <p className="mt-0.5 max-w-24 truncate text-[9px] font-semibold text-zinc-400 dark:text-zinc-555">{cls.slotVenue || "N/A"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuickActions = () => {
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider px-1 text-left">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
          <button 
            onClick={() => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-1.5 text-indigo-500 shrink-0">
              <Sliders className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">Predict Att.</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("predictor"); }}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-1.5 text-emerald-600 dark:text-emerald-450 shrink-0">
              <TrendingUp className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">GPA Calc</span>
          </button>

          <button 
            onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("leave"); }}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-1.5 text-rose-600 dark:text-rose-455 shrink-0">
              <Plane className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">Apply Leave</span>
          </button>

          <button 
            onClick={() => { setActiveTab("dayscholar"); }}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-955/30 flex items-center justify-center mb-1.5 text-amber-605 dark:text-amber-400 shrink-0">
              <Bus className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">Bus Routes</span>
          </button>

          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("wishlist"); }}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center mb-1.5 text-violet-600 dark:text-violet-400 shrink-0">
              <Bookmark className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">Wishlist</span>
          </button>

          <button 
            onClick={onOpenCommandPalette}
            className="flex flex-col items-center justify-center p-3 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 text-center active:scale-95 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-955/30 flex items-center justify-center mb-1.5 text-blue-650 dark:text-blue-400 shrink-0">
              <FolderOpen className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 font-outfit uppercase tracking-wide">All Modules</span>
          </button>
        </div>
      </div>
    );
  };

  const renderLaundryWidget = () => {
    const isDayscholar = settings?.residentialStatus === "dayscholar" || cachedProfile?.residentialStatus === "dayscholar" || hostelData?.hostelInfo?.isHosteller === false;
    if (isDayscholar) return null;
    if (!hostelData?.hostelInfo?.isHosteller) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5">
            <Shirt className="w-4 h-4 text-sky-500" />
            <span>Laundry Status</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("laundry"); }}
            className="text-xs font-bold text-sky-500 cursor-pointer"
          >
            Open Laundry Hub
          </button>
        </div>
        
        <div 
          onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("laundry"); }}
          className="p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 active:scale-[0.99] transition-all hover:bg-white/90 dark:hover:bg-zinc-900/80 cursor-pointer text-left flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30 flex items-center justify-center text-sky-500 shrink-0">
            <Shirt className="w-6 h-6" />
          </div>
          
          <div className="flex-1 min-w-0">
            {laundryStatus ? (
              laundryStatus.hasSlotToday ? (
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-605 dark:text-emerald-450 rounded-md">
                    Active Today
                  </span>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-1 font-outfit">
                    Laundry slot is active for your room range today!
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
                    Drop off your clothes before 5:00 PM today.
                  </p>
                </div>
              ) : laundryStatus.nextSlot ? (
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-sky-500/10 border border-sky-500/25 text-sky-605 dark:text-sky-400 rounded-md">
                    Upcoming Slot
                  </span>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-1 font-outfit">
                    Next slot: Day {laundryStatus.nextSlot.Date}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
                    Scheduled for room range {laundryStatus.nextSlot.RoomNumber}.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No scheduled slots found.</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Check for block updates in VTOP.</p>
                </div>
              )
            ) : (
              <div>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Loading laundry schedule...</p>
              </div>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
        </div>
      </div>
    );
  };

  const renderMessMenu = () => {
    const isDayscholar = settings?.residentialStatus === "dayscholar" || cachedProfile?.residentialStatus === "dayscholar" || hostelData?.hostelInfo?.isHosteller === false;
    if (isDayscholar) return null;
    if (!todayMeal) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <Coffee className="w-4 h-4 text-amber-500" />
            <span>Mess Menu • {currentMealType}</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("mess"); }}
            className="text-xs font-bold text-indigo-650 dark:text-indigo-400 cursor-pointer"
          >
            Full Menu
          </button>
        </div>
        <div 
          onClick={() => { setActiveTab("hostel"); setHostelActiveSubTab("mess"); }}
          className="p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-left hover:bg-white/90 dark:hover:bg-zinc-900/80 cursor-pointer"
        >
          <p className="text-sm text-zinc-850 dark:text-zinc-200 leading-relaxed font-semibold">
            {todayMeal}
          </p>
        </div>
      </div>
    );
  };

  const renderMoodleDeadlines = () => {
    if (upcomingDeadlines.length === 0) return null;
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-500 uppercase tracking-wider px-1 text-left font-outfit font-black">
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
                onClick={() => {
                  if (task.url) {
                    window.open(task.url, "_blank");
                  } else {
                    setActiveTab("attendance");
                    setActiveAttendanceSubTab("calendar");
                  }
                }}
                className="p-3.5 rounded-[20px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 flex justify-between items-center text-left hover:bg-white/90 dark:hover:bg-zinc-900/80 cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200 truncate">{task.title}</p>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5 truncate">{task.courseName || "General Assignment"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[8px] font-black text-red-505 uppercase bg-red-100/50 dark:bg-red-950/20 px-1 py-0.5 rounded">Due</span>
                  <p className="text-[10px] text-zinc-550 dark:text-zinc-400 font-bold mt-1">{dueStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFreeClassrooms = () => (
    <FreeClassroomsWidget />
  );

  const renderRegisteredEvents = () => {
    if (!registeredEvents || registeredEvents.length === 0) return null;
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-450 dark:text-zinc-555 uppercase tracking-wider px-1 text-left font-outfit font-black">
          Registered Events
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible" data-prevent-swipe="true">
          {registeredEvents.map((ev: any, idx: number) => (
            <div 
              key={idx}
              onClick={() => { setActiveTab("more"); setActiveMoreSubTab("events"); }}
              className="min-w-[75vw] snap-center p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 active:scale-[0.99] transition-all hover:bg-white/95 dark:hover:bg-zinc-900/85 cursor-pointer md:min-w-0"
            >
              <h4 className="font-bold text-sm text-zinc-850 dark:text-white truncate text-left">{ev.name}</h4>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-450 mt-1.5 flex items-center gap-1.5 text-left font-medium">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>{ev.date} • {ev.time}</span>
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold mt-3.5 pt-3.5 border-t border-zinc-150/50 dark:border-zinc-800/50 gap-2 min-w-0">
                <span className="text-zinc-550 dark:text-zinc-455 truncate flex-1 text-left">{ev.venue}</span>
                <span className="text-indigo-650 dark:text-indigo-400 shrink-0 uppercase tracking-wider text-[9px] font-extrabold">{ev.paymentStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderQuickSettingsWidget = () => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <Sliders className="w-4 h-4 text-zinc-550" />
            <span>Quick Settings Toggles</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("profile"); setActiveProfileSubTab("settings"); }}
            className="text-xs font-bold text-indigo-650 dark:text-indigo-400 cursor-pointer"
          >
            All Settings
          </button>
        </div>
        <div className="p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-left space-y-3.5 divide-y divide-zinc-100 dark:divide-zinc-800/50">
          
          {/* Hide CGPA */}
          <div className="flex items-center justify-between text-xs pt-0">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Hide CGPA Everywhere</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Blur CGPA display on dashboard & header</p>
            </div>
            <Switch
              checked={settings?.CGPAHidden ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, CGPAHidden: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Grades Anonymizer */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Grades Anonymizer Mode</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Blur course marks & letter grades</p>
            </div>
            <Switch
              checked={settings?.blurGrades ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, blurGrades: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Show Profile Photo */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Show Profile Photo</p>
              <p className="text-[10px] text-zinc-455 dark:text-zinc-500">Display your avatar in dashboard greeting</p>
            </div>
            <Switch
              checked={settings?.showProfilePhoto ?? true}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, showProfilePhoto: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Home Page Search Bar */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Home Page Search Bar</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Display Spotlight search bar on home tab</p>
            </div>
            <Switch
              checked={!(settings?.hideHomeSearchBar ?? false)}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, hideHomeSearchBar: !val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Decimal Attendance Values */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Decimal Attendance Values</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Show 2 decimal places (e.g. 84.62%)</p>
            </div>
            <Switch
              checked={settings?.decimalValues ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, decimalValues: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Dayscholar Bus Mode */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Dayscholar Bus Mode</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Show bus route & boarding point widgets</p>
            </div>
            <Switch
              checked={settings?.isDayscholarWithBus ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, isDayscholarWithBus: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Reload All Data */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Reload All API Categories</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550">Refresh button syncs all categories</p>
            </div>
            <Switch
              checked={settings?.reloadAllData ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, reloadAllData: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

          {/* Smart Mess Filter */}
          <div className="flex items-center justify-between text-xs pt-3">
            <div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Smart Mess Menu Filter</p>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-550 font-medium">Auto-filter mess menu items for current week</p>
            </div>
            <Switch
              checked={settings?.smartMessFilter ?? false}
              onCheckedChange={(val) => {
                setSettings((prev: any) => {
                  const next = { ...prev, smartMessFilter: val };
                  localStorage.setItem("settings", JSON.stringify(next));
                  return next;
                });
              }}
            />
          </div>

        </div>
      </div>
    );
  };

  const renderExamScheduleWidget = () => {
    const scheduleObj = scheduleData?.Schedule || scheduleData?.schedule;

    const allExams = useMemo(() => {
      if (!scheduleObj || typeof scheduleObj !== "object") return [];
      const list: any[] = [];
      Object.entries(scheduleObj).forEach(([examType, subjects]: [string, any]) => {
        if (Array.isArray(subjects)) {
          subjects.forEach((subj) => {
            list.push({ ...subj, examType });
          });
        }
      });

      const parseDate = (dStr: string) => {
        if (!dStr) return null;
        const parts = dStr.split(/[-/]/);
        if (parts.length === 3) {
          let [d, m, y] = parts;
          const dayNum = parseInt(d, 10);
          if (isNaN(dayNum)) return null;
          const yearNum = parseInt(y, 10);
          if (isNaN(parseInt(m, 10))) {
            const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
            const mIndex = monthNames.findIndex((x) => m.toLowerCase().startsWith(x));
            if (mIndex === -1) return null;
            return new Date(yearNum, mIndex, dayNum);
          } else {
            return new Date(yearNum, parseInt(m, 10) - 1, dayNum);
          }
        }
        return new Date(dStr);
      };

      return list
        .map((exam) => ({ ...exam, parsedDate: parseDate(exam.examDate) }))
        .sort((a, b) => {
          if (!a.parsedDate && !b.parsedDate) return 0;
          if (!a.parsedDate) return 1;
          if (!b.parsedDate) return -1;
          return a.parsedDate.getTime() - b.parsedDate.getTime();
        });
    }, [scheduleObj]);

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const todayExams = allExams.filter((e) => e.parsedDate && e.parsedDate.getTime() === todayDate.getTime());
    const upcomingExams = allExams.filter((e) => e.parsedDate && e.parsedDate.getTime() >= todayDate.getTime());
    const nextExam = upcomingExams.length > 0 ? upcomingExams[0] : null;

    const calculateDaysLeft = (targetDate: Date) => {
      const diffTime = targetDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      return `In ${diffDays} days`;
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-zinc-455 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-outfit font-black">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Exam Schedule</span>
          </h2>
          <button 
            onClick={() => { setActiveTab("academics"); setActiveSubTab("schedule"); }}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
          >
            Full Schedule
          </button>
        </div>

        {allExams.length === 0 ? (
          <div className="p-5 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-left flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-500 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-outfit">No exam schedule loaded</h4>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Fetch your CAT & FAT timetables from VTOP</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (handleScheduleFetch) {
                  handleScheduleFetch();
                } else {
                  setActiveTab("academics");
                  setActiveSubTab("schedule");
                }
              }}
              className="text-[10px] font-black text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-all shrink-0 cursor-pointer uppercase tracking-wider shadow-2xs"
            >
              Fetch Schedule
            </button>
          </div>
        ) : todayExams.length > 0 ? (
          <div className="space-y-2.5">
            <div className="p-4.5 rounded-[24px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm border border-emerald-600/30 relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full pointer-events-none" />
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-white/20 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Exam Today!
              </span>
              {todayExams.map((exam, idx) => (
                <div key={idx} className={idx > 0 ? "mt-4 pt-4 border-t border-white/20" : "mt-2"}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-base leading-tight">
                      {exam.courseCode} — {exam.courseTitle}
                    </h4>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-black/20 text-white uppercase shrink-0">
                      {exam.examType}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-white/90 font-semibold">
                    <div>
                      <p className="text-[9px] text-white/70 uppercase">Exam Time</p>
                      <p className="font-bold">{exam.examTime || exam.reportingTime}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/70 uppercase">Venue & Seat</p>
                      <p className="font-bold">{exam.venue || "TBA"} • #{exam.seatNo || "-"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : nextExam ? (
          <div className="space-y-3">
            {/* Spotlight next upcoming exam */}
            <div 
              onClick={() => { setActiveTab("academics"); setActiveSubTab("schedule"); }}
              className="p-4.5 rounded-[24px] bg-gradient-to-br from-blue-50/70 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-900/40 text-left cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition-all relative overflow-hidden shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider bg-blue-600/10 text-blue-700 dark:text-blue-400 rounded-md border border-blue-600/20 font-outfit">
                  Next Exam • {nextExam.parsedDate ? calculateDaysLeft(nextExam.parsedDate) : nextExam.examDate}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {nextExam.examType}
                </span>
              </div>

              <h4 className="font-black text-sm text-zinc-900 dark:text-white font-outfit truncate">
                {nextExam.courseCode} — {nextExam.courseTitle}
              </h4>

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Date & Time</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{nextExam.examDate}</p>
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{nextExam.examTime}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Venue & Seat</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{nextExam.venue || "TBA"}</p>
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Seat #{nextExam.seatNo || "-"}</p>
                </div>
              </div>
            </div>

            {/* List of remaining upcoming exams */}
            {upcomingExams.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {upcomingExams.slice(1, 3).map((exam, idx) => (
                  <div 
                    key={idx}
                    onClick={() => { setActiveTab("academics"); setActiveSubTab("schedule"); }}
                    className="p-3 rounded-[18px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-white/90 dark:hover:bg-zinc-900/80 transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                          {exam.examType}
                        </span>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate font-outfit">{exam.courseCode}</p>
                      </div>
                      <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold truncate mt-0.5">{exam.courseTitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{exam.examDate}</span>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold">{exam.venue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/80 text-left flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-outfit">No upcoming exams</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">All scheduled exams for this term are completed</p>
            </div>
            <button 
              onClick={() => { setActiveTab("academics"); setActiveSubTab("schedule"); }}
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              View History
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderWidget = (id: string) => {
    switch (id) {
      case "cabshare":
        return renderCabSharePromo();
      case "cabshare_match":
        return renderCabShareMatch();
      case "dayscholar_guide":
        return renderDayScholarWidget();
      case "insights":
        return renderInsightsDock();
      case "attendance":
        return renderAttendanceHero();
      case "attendance_courses":
        return renderAttendanceCoursesWidget();
      case "academic_courses":
        return renderCurrentCoursesWidget();
      case "critical":
        return renderCriticalAlerts();
      case "classes":
        return renderTodayClasses();
      case "exam_schedule":
        return renderExamScheduleWidget();
      case "actions":
        return renderQuickActions();
      case "laundry":
        return renderLaundryWidget();
      case "mess":
        return renderMessMenu();
      case "deadlines":
        return renderMoodleDeadlines();
      case "classrooms":
        return renderFreeClassrooms();
      case "events":
        return renderRegisteredEvents();
      case "quick_settings":
        return renderQuickSettingsWidget();
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6 pb-24 md:pb-0 animate-in fade-in duration-300">
      
      {/* ── HEADER & GREETING ── */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3.5 min-w-0">
          {shouldDisplayProfilePhoto && profileImage ? (
            <img
              src={profileImage}
              alt=""
              className="h-12 w-12 rounded-2xl border border-white/60 object-cover shadow-sm dark:border-gray-800 md:h-14 md:w-14 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-indigo-650 flex items-center justify-center text-white font-black text-sm shadow-md border border-white/15 shrink-0 md:h-14 md:w-14">
              {initials}
            </div>
          )}
          <div className="min-w-0 text-left">
            <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight font-outfit">
              {getGreeting()}
            </h1>
            <p className="text-xs text-gray-550 dark:text-gray-400 font-semibold mt-0.5 flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-indigo-505 shrink-0" />
              <span className="truncate">Welcome, {profileName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            className={`p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${
              showCustomizer 
                ? "bg-indigo-650 border-indigo-650 text-white shadow-sm"
                : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-xs"
            }`}
            title="Customize Dashboard"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200 shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Sync Data from VTOP"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin text-indigo-500" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── CUSTOMIZATION PANEL (Clean & Intuitive) ── */}
      <AnimatePresence>
        {showCustomizer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-4 sm:p-5 shadow-xl backdrop-blur-xl space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span>Customize Dashboard Layout</span>
                  </h3>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Toggle visibility and size of your dashboard cards</p>
                </div>
                <button 
                  onClick={() => {
                    setWidgets(DEFAULT_WIDGETS);
                    localStorage.removeItem("amaze_dashboard_widgets");
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-500 border border-red-200 dark:border-red-900/40 px-2.5 py-1 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              {/* Drag & Drop Reorderable Widget List */}
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1 font-outfit">
                <GripVertical className="w-3.5 h-3.5" />
                <span>Drag handle to reorder • Tap eye to toggle</span>
              </p>

              <Reorder.Group axis="y" values={widgets} onReorder={setWidgets} className="space-y-2">
                {widgets.map((w, index) => {
                  const isFull = w.span === "full";
                  return (
                    <Reorder.Item
                      key={w.id}
                      value={w}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-grab active:cursor-grabbing select-none ${
                        w.enabled
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-850/60 text-zinc-800 dark:text-zinc-200"
                          : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-850/50 text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2 text-left">
                        <GripVertical className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 cursor-grab active:cursor-grabbing" />
                        <button
                          onClick={() => toggleWidget(w.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          {w.enabled ? (
                            <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-zinc-400 shrink-0 opacity-60" />
                          )}
                          <span className={`truncate text-xs ${w.enabled ? "font-bold" : "font-normal opacity-70"}`}>
                            {w.title}
                          </span>
                        </button>
                      </div>

                      {w.enabled && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Size Pill */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleWidgetSpan(w.id); }}
                            className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black text-indigo-600 dark:text-indigo-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Toggle width between 1-Column and Full Width"
                          >
                            {isFull ? "Full" : "Half"}
                          </button>
                          {/* Reorder Up/Down */}
                          <button
                            onClick={(e) => { e.stopPropagation(); moveWidget(w.id, "up"); }}
                            disabled={index === 0}
                            className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-500 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveWidget(w.id, "down"); }}
                            disabled={index === widgets.length - 1}
                            className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-500 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>

              {/* Home Search Bar Toggle */}
              <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  onClick={() => {
                    const nextVal = !settings?.hideHomeSearchBar;
                    setSettings((prev: any) => {
                      const next = { ...prev, hideHomeSearchBar: nextVal };
                      localStorage.setItem("settings", JSON.stringify(next));
                      return next;
                    });
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    !settings?.hideHomeSearchBar 
                      ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-850/60 text-indigo-700 dark:text-indigo-400"
                      : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {!settings?.hideHomeSearchBar ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4" />}
                    <span>Home Page Search Bar</span>
                  </span>
                  <span className="text-[10px] font-black uppercase">
                    {!settings?.hideHomeSearchBar ? "Shown" : "Hidden"}
                  </span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUICK SPOTLIGHT SEARCH ── */}
      {!settings?.hideHomeSearchBar && (
        <button 
          onClick={onOpenCommandPalette}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-white/80 dark:bg-gray-950/80 border border-gray-200/70 dark:border-gray-800 shadow-xs text-gray-400 dark:text-gray-550 hover:text-gray-600 dark:hover:text-gray-300 text-left transition-all active:scale-[0.99] relative overflow-hidden group backdrop-blur-xl cursor-pointer"
        >
          <div className="absolute inset-0 bg-indigo-50/10 dark:bg-indigo-950/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <span className="text-sm font-bold flex-1 text-gray-400 dark:text-gray-550">Search anything... (Spotlight)</span>
          <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg">⌘K</span>
        </button>
      )}

      {/* ── DYNAMIC DASHBOARD WIDGETS (Responsive 2-Column Desktop Grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <AnimatePresence mode="popLayout">
          {(() => {
            const enabledWidgets = widgets.filter(w => w.enabled);
            return enabledWidgets.map((w, index) => {
              const element = renderWidget(w.id);
              if (!element) return null;
              const isFull = w.span === "full";

              return (
                <motion.div
                  key={w.id}
                  layoutId={w.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className={`${isFull ? "md:col-span-2" : "md:col-span-1"} w-full`}
                >
                  {/* Edit Mode Header Overlay */}
                  {showCustomizer && (
                    <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/90 rounded-t-[20px] border border-indigo-200/80 dark:border-indigo-850 border-b-0 text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                      <span className="flex items-center gap-1.5 font-outfit font-extrabold uppercase tracking-wider">
                        <GripVertical className="w-3.5 h-3.5 text-indigo-400 cursor-grab" />
                        <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{w.title}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWidgetSpan(w.id); }}
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black text-indigo-600 dark:text-indigo-400 cursor-pointer shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                          {isFull ? "Full Width" : "Half Width"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveWidget(w.id, "up"); }}
                          disabled={index === 0}
                          className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-30 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveWidget(w.id, "down"); }}
                          disabled={index === enabledWidgets.length - 1}
                          className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-30 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWidget(w.id); }}
                          className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 dark:text-red-400 cursor-pointer"
                          title="Hide Card"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={showCustomizer ? "border border-indigo-200/80 dark:border-indigo-850 border-t-0 rounded-b-[24px] overflow-hidden" : ""}>
                    {element}
                  </div>
                </motion.div>
              );
            });
          })()}
        </AnimatePresence>
      </div>

      {/* Tab Help & Guide Footer */}
      <TabHelpFooter tabId="home" />

    </div>
  );
}
