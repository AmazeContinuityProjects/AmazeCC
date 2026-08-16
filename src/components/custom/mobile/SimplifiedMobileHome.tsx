"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarCheck,
  Clock,
  MapPin,
  Sparkles,
  RefreshCcw,
  Sliders,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  GraduationCap,
  Award,
  Coffee,
  CheckCircle2,
  Calendar as CalendarIcon,
  Search,
  Zap,
  ArrowRight,
  List,
  Layers,
  FileText,
  Utensils,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Sun,
  CalendarOff,
  Building,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { buildAttendanceDayCardsMap, AttendanceDay, ATTENDANCE_DAYS, parseAttendanceTime } from "@/lib/attendanceTimetable";
import { shouldShowGpa, shouldShowProfilePhoto } from "@/lib/settingsVisibility";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { getAssetPath } from "@/lib/utils";
import TimetableGrid from "../attendance/TimetableGrid";
import Modal from "../shared/Modal";

interface SimplifiedMobileHomeProps {
  attendanceData: any;
  marksData: any;
  hostelData: any;
  registeredEvents?: any[];
  moodleData?: any[];
  calendarData?: any;
  ScheduleData?: any;
  settings: any;
  setSettings: any;
  IDs: any;
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (tab: string) => void;
  setHostelActiveSubTab?: (tab: string) => void;
  setActiveAttendanceSubTab: (tab: string) => void;
  setActiveMoreSubTab?: (tab: string) => void;
  setActiveProfileSubTab?: (tab: string) => void;
  handleReloadRequest: () => Promise<void>;
  onOpenCommandPalette: () => void;
  profileData?: any;
  ODhoursData?: any;
  setGradesDisplayIsOpen?: (open: boolean) => void;
  setODhoursIsOpen?: (open: boolean) => void;
}

// Helper to extract day order override from academic calendar text
function extractDayOrderOverride(eventText: string): AttendanceDay | null {
  const norm = String(eventText || "").toLowerCase();
  if (norm.includes("mon") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "MON";
  if (norm.includes("tue") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "TUE";
  if (norm.includes("wed") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "WED";
  if (norm.includes("thu") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "THU";
  if (norm.includes("fri") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "FRI";
  if (norm.includes("sat") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table"))) return "SAT";
  return null;
}

// Helper to parse exam dates reliably across diverse date formats (DD-MMM-YYYY, DD-MM-YYYY, ISO)
function parseExamDateTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();

  // Try standard parse
  const standard = new Date(str);
  if (!isNaN(standard.getTime())) {
    return new Date(standard.getFullYear(), standard.getMonth(), standard.getDate(), 23, 59, 59).getTime();
  }

  // Handle DD-MMM-YYYY (e.g. 28-Nov-2025) or DD-MM-YYYY (e.g. 28-11-2025)
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthPart = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);

    const MONTHS: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    let month = -1;
    if (MONTHS[monthPart.slice(0, 3)] !== undefined) {
      month = MONTHS[monthPart.slice(0, 3)];
    } else if (!isNaN(parseInt(monthPart, 10))) {
      month = parseInt(monthPart, 10) - 1;
    }

    if (!isNaN(day) && month !== -1 && !isNaN(year)) {
      return new Date(year, month, day, 23, 59, 59).getTime();
    }
  }

  return 0;
}

export default function SimplifiedMobileHome({
  attendanceData,
  marksData,
  hostelData,
  registeredEvents = [],
  moodleData = [],
  calendarData,
  ScheduleData,
  settings,
  setSettings,
  IDs,
  setActiveTab,
  setActiveSubTab,
  setActiveAttendanceSubTab,
  setActiveProfileSubTab,
  handleReloadRequest,
  onOpenCommandPalette,
  profileData: profileDataProp,
  ODhoursData,
  setGradesDisplayIsOpen,
  setODhoursIsOpen,
}: SimplifiedMobileHomeProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [cachedProfile, setCachedProfile] = useState<any>(profileDataProp || null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTimetableModal, setShowTimetableModal] = useState(false);

  // Carousel slide index for the dynamic secondary stat card
  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Determine current day of week
  const todayDayIndex = new Date().getDay();
  const dayNames: AttendanceDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const todayDayCode: AttendanceDay = dayNames[todayDayIndex];
  
  const [selectedDay, setSelectedDay] = useState<AttendanceDay>(todayDayCode);
  const [satOverride, setSatOverride] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("saturday_timetable_override") || "MON";
      } catch {
        return "MON";
      }
    }
    return "MON";
  });

  const pillStyle: "compact" | "detailed" = settings?.timetablePillStyle || "compact";

  const setPillStyle = (style: "compact" | "detailed") => {
    setSettings((prev: any) => {
      const next = { ...prev, timetablePillStyle: style };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  // Ticker to refresh progress bar every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
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

  const handleRefresh = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    window.setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const toggleDashboardMode = () => {
    const nextMode = (settings?.dashboardViewMode === "simplified" || !settings?.dashboardViewMode) ? "classic" : "simplified";
    setSettings((prev: any) => {
      const next = { ...prev, dashboardViewMode: nextMode };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  const getGreeting = () => {
    const hr = currentTime.getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  const profileName = settings?.friendlyName || cachedProfile?.name || IDs?.VtopUsername || "Student";
  const profileImage = cachedProfile?.image || cachedProfile?.photo || cachedProfile?.photoBase64;
  const shouldDisplayProfilePhoto = shouldShowProfilePhoto(settings);
  const shouldDisplayGpa = shouldShowGpa(settings);
  const targetAttendancePct = Number(settings?.targetAttendance || 75);

  const initials = String(profileName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Overall attendance calculation
  const overallAttendance = useMemo(() => {
    if (!attendanceData?.attendance || attendanceData.attendance.length === 0) {
      return { percentage: 0, attended: 0, total: 0, status: "N/A" };
    }
    let totalClasses = 0;
    let attendedClasses = 0;
    attendanceData.attendance.forEach((a: any) => {
      totalClasses += Number(a.totalClasses || 0);
      attendedClasses += Number(a.attendedClasses || 0);
    });
    const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
    return {
      percentage,
      attended: attendedClasses,
      total: totalClasses,
      status: percentage >= targetAttendancePct + 5 ? "Safe" : percentage >= targetAttendancePct ? "Warning" : "Critical",
    };
  }, [attendanceData, targetAttendancePct]);

  // Approved OD Hours
  const totalODHours = useMemo(() => {
    if (!ODhoursData || ODhoursData.length === 0 || !ODhoursData[0]?.courses) return 0;
    return ODhoursData.reduce((sum: number, day: any) => sum + (day.total || 0), 0);
  }, [ODhoursData]);

  // Critical Courses count (< target attendance)
  const criticalCount = useMemo(() => {
    if (!attendanceData?.attendance || !Array.isArray(attendanceData.attendance)) return 0;
    return attendanceData.attendance.filter((c: any) => {
      if (!c) return false;
      const slot = String(c.slotName || "").trim().toUpperCase();
      const code = String(c.courseCode || "").trim().toUpperCase();
      const total = parseInt(c.totalClasses, 10) || 0;
      if (slot.includes("NULL") || slot === "NIL" || code === "NIL" || total === 0) return false;
      const pct = parseFloat(c.attendancePercentage);
      return !isNaN(pct) && pct < targetAttendancePct;
    }).length;
  }, [attendanceData, targetAttendancePct]);

  // Parsed academic calendar events
  const analyzedCalendarResults = useMemo(() => {
    if (!calendarData?.calendars) return [];
    try {
      return analyzeAllCalendars(calendarData.calendars).results || [];
    } catch {
      return [];
    }
  }, [calendarData]);

  // Flattened exams schedule
  const allExams = useMemo(() => {
    const scheduleObj = ScheduleData?.Schedule || ScheduleData?.schedule;
    if (!scheduleObj) return [];
    const list: any[] = [];
    Object.keys(scheduleObj).forEach((cat) => {
      const items = scheduleObj[cat];
      if (Array.isArray(items)) {
        items.forEach((item) => list.push({ ...item, examCategory: cat }));
      }
    });
    return list;
  }, [ScheduleData]);

  // Next upcoming exam (Strictly future/today exams only; NEVER show past exams)
  const nextUpcomingExam = useMemo(() => {
    if (allExams.length === 0) return null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const futureExams = allExams
      .map((ex) => {
        const timestamp = parseExamDateTimestamp(ex.examDate);
        return { ...ex, timestamp };
      })
      .filter((ex) => ex.timestamp >= startOfToday)
      .sort((a, b) => a.timestamp - b.timestamp);

    return futureExams.length > 0 ? futureExams[0] : null;
  }, [allExams]);

  // Next upcoming moodle deadline
  const nextMoodleDeadline = useMemo(() => {
    if (!moodleData || moodleData.length === 0) return null;
    const now = new Date().getTime();
    const sorted = [...moodleData]
      .filter((t: any) => t.dueDate && !t.hidden)
      .map((t: any) => ({ ...t, timestamp: new Date(t.dueDate).getTime() }))
      .filter((t: any) => t.timestamp > now)
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
    return sorted[0] || null;
  }, [moodleData]);

  // Dynamic Insight Slides for the right cycling card (spacious and minimal)
  const insightSlides = useMemo(() => {
    const slides: Array<{
      id: string;
      title: string;
      headline: string;
      subline: string;
      badge?: string;
      badgeColor?: string;
      onClick: () => void;
    }> = [];

    // Slide 1: CGPA
    if (shouldDisplayGpa) {
      slides.push({
        id: "cgpa",
        title: "CGPA",
        headline: marksData?.cgpa?.cgpa
          ? `${Number(marksData.cgpa.cgpa).toFixed(2)}`
          : "—",
        subline: "VTOP Verified Grade",
        badge: "Academic",
        onClick: () => {
          if (setGradesDisplayIsOpen) setGradesDisplayIsOpen(true);
          else {
            setActiveTab("academics");
            setActiveSubTab("overview");
          }
        },
      });
    }

    // Slide 2: Credits
    slides.push({
      id: "credits",
      title: "Credits",
      headline: marksData?.cgpa?.creditsEarned
        ? `${Number(marksData.cgpa.creditsEarned)} cr`
        : "—",
      subline: "Degree Curriculum Earned",
      badge: "Degree",
      onClick: () => {
        setActiveTab("academics");
        setActiveSubTab("curriculum");
      },
    });

    // Slide 3: OD Hours or Alert
    if (criticalCount > 0) {
      slides.push({
        id: "alerts",
        title: "Shortage Alert",
        headline: `${criticalCount} Low`,
        subline: `Courses below ${targetAttendancePct}%`,
        badge: "Warning",
        badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        onClick: () => {
          setActiveTab("attendance");
          setActiveAttendanceSubTab("attendance");
        },
      });
    } else {
      slides.push({
        id: "od",
        title: "On-Duty",
        headline: `${totalODHours} hrs`,
        subline: "Approved On-Duty Total",
        badge: "OD",
        onClick: () => {
          if (setODhoursIsOpen) setODhoursIsOpen(true);
          else setActiveTab("attendance");
        },
      });
    }

    // Slide 4: Upcoming Exam (if exists)
    if (nextUpcomingExam) {
      slides.push({
        id: "exam",
        title: "Next Exam",
        headline: nextUpcomingExam.courseCode,
        subline: `${nextUpcomingExam.examDate} • ${nextUpcomingExam.examTime?.split("-")[0] || ""}`,
        badge: nextUpcomingExam.examCategory || "Exam",
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        onClick: () => {
          setActiveTab("attendance");
          setActiveAttendanceSubTab("calendar");
        },
      });
    }

    // Slide 5: Upcoming Deadline (if exists)
    if (nextMoodleDeadline) {
      const daysLeft = Math.ceil((nextMoodleDeadline.timestamp - new Date().getTime()) / 86400000);
      slides.push({
        id: "moodle",
        title: "Assignment Due",
        headline: nextMoodleDeadline.name ? String(nextMoodleDeadline.name).slice(0, 14) : "Task Due",
        subline: `Due in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
        badge: "Moodle",
        onClick: () => {
          setActiveTab("academics");
          setActiveSubTab("moodle");
        },
      });
    }

    return slides;
  }, [
    shouldDisplayGpa,
    marksData,
    criticalCount,
    targetAttendancePct,
    totalODHours,
    nextUpcomingExam,
    nextMoodleDeadline,
    setActiveTab,
    setActiveSubTab,
    setActiveAttendanceSubTab,
    setGradesDisplayIsOpen,
    setODhoursIsOpen,
  ]);

  // Carousel auto-advance timer
  useEffect(() => {
    if (isCarouselPaused || insightSlides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % insightSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isCarouselPaused, insightSlides.length]);

  // All weekly timetable cards map
  const timetableMap = useMemo(() => {
    return buildAttendanceDayCardsMap(attendanceData?.attendance || [], undefined, satOverride);
  }, [attendanceData, satOverride]);

  // Integrated Calendar week days with accurate month-matched event detection
  const weekDays = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);

    const currentDayOfWeek = base.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

    const monday = new Date(base);
    monday.setDate(base.getDate() + distanceToMonday);

    const todayDate = new Date();

    // Prepare calendar list
    let baseCals: any[] = [];
    if (calendarData) {
      if (Array.isArray(calendarData)) baseCals = calendarData;
      else if (calendarData.calendars && Array.isArray(calendarData.calendars)) baseCals = calendarData.calendars;
      else if (calendarData.days) baseCals = [calendarData];
    }

    const preferredCalType = String(settings?.calendarType || "General Semester").toLowerCase();
    let userCals = baseCals.filter((c: any) => {
      const name = String(c.calendarType || c.title || c.name || "").toLowerCase();
      return name.includes(preferredCalType) || name.includes("general") || name.includes("all");
    });
    if (userCals.length === 0) userCals = baseCals;

    const MONTH_NAME_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    return ATTENDANCE_DAYS.map((code, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);

      const isToday =
        d.getDate() === todayDate.getDate() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getFullYear() === todayDate.getFullYear();

      const dayNum = d.getDate();
      const monthNum = d.getMonth();
      const monthStr = d.toLocaleDateString("en-US", { month: "short" });
      const yearNum = d.getFullYear();
      const dateKey1 = `${dayNum < 10 ? "0" + dayNum : dayNum}-${monthStr}-${yearNum}`;

      // Check for exam on this date
      const targetDateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const targetDateEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();

      const matchingDayExams = allExams.filter((ex) => {
        if (!ex.examDate) return false;
        const examTs = parseExamDateTimestamp(ex.examDate);
        return examTs >= targetDateStart && examTs <= targetDateEnd;
      });

      // Check for academic calendar events with strict month and year matching
      let holidayInfo: string | null = null;
      let detectedDayOrder: AttendanceDay | null = null;
      let orderInfo: string | null = null;
      let isInstructional = false;

      for (const cal of userCals) {
        if (!cal.days || !Array.isArray(cal.days)) continue;

        const rawMonth = String(cal.month || "").toLowerCase();
        const yearMatch = rawMonth.match(/\d{4}/);
        const calYear = yearMatch ? parseInt(yearMatch[0], 10) : Number(cal.year) || yearNum;

        let calMonth = -1;
        for (const [mName, mIdx] of Object.entries(MONTH_NAME_MAP)) {
          if (rawMonth.includes(mName)) {
            calMonth = mIdx;
            break;
          }
        }

        // Strictly verify both year and month
        if (calYear !== yearNum || (calMonth !== -1 && calMonth !== monthNum)) {
          continue;
        }

        const dayEntry = cal.days.find((cd: any) => Number(cd.date) === dayNum);
        if (!dayEntry) continue;

        let rawEvents: any[] = [];
        if (Array.isArray(dayEntry.events)) rawEvents = dayEntry.events;
        else if (typeof dayEntry.events === "string" && dayEntry.events.trim()) {
          rawEvents = [{ text: dayEntry.events.trim(), type: "event" }];
        }

        for (const ev of rawEvents) {
          const text = String(ev.text || ev.category || "").trim();
          const norm = text.toLowerCase();
          if (!norm) continue;

          const hasNoInstructional =
            norm.includes("no instructional") ||
            norm.includes("non instructional") ||
            norm.includes("noinstructional");

          const hasInstructionalWord =
            norm.includes("instructional day") ||
            norm.includes("instructional") ||
            norm.includes("working day") ||
            norm.includes("working");

          const hasHolidayWord =
            norm.includes("holiday") ||
            norm.includes("vacation") ||
            norm.includes("pooja") ||
            norm.includes("puja") ||
            norm.includes("diwali") ||
            norm.includes("pongal") ||
            norm.includes("eid") ||
            norm.includes("christmas") ||
            norm.includes("independence") ||
            norm.includes("republic");

          if (hasNoInstructional || (hasHolidayWord && !hasInstructionalWord)) {
            holidayInfo = text;
          } else if (hasInstructionalWord && !hasNoInstructional) {
            isInstructional = true;
          }

          const orderMatch = extractDayOrderOverride(text);
          if (orderMatch) {
            detectedDayOrder = orderMatch;
            orderInfo = text;
            isInstructional = true;
          }
        }
      }

      // Check for moodle deadline
      const hasDeadline = moodleData.some((t: any) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).toDateString() === d.toDateString();
      });

      return {
        dayCode: code,
        dayNumber: dayNum,
        monthShort: monthStr,
        weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: d,
        isToday,
        exams: matchingDayExams,
        hasExam: matchingDayExams.length > 0,
        isInstructional,
        holidayInfo: isInstructional ? null : holidayInfo,
        detectedDayOrder,
        orderInfo,
        hasDeadline,
      };
    });
  }, [weekOffset, allExams, calendarData, settings?.calendarType, moodleData]);

  // Active selected day's detailed calendar context
  const selectedDayMeta = useMemo(() => {
    return weekDays.find((w) => w.dayCode === selectedDay) || null;
  }, [weekDays, selectedDay]);

  // Effective day code for timetable (auto-applies detected day order override if present)
  const effectiveTimetableDay: AttendanceDay = useMemo(() => {
    if (selectedDayMeta?.detectedDayOrder) {
      return selectedDayMeta.detectedDayOrder;
    }
    return selectedDay;
  }, [selectedDayMeta, selectedDay]);

  // Classes for the selected day (or day order override)
  const selectedDayClasses = useMemo(() => {
    return timetableMap[effectiveTimetableDay] || [];
  }, [timetableMap, effectiveTimetableDay]);

  // Month & Year header for the calendar row
  const calendarWeekHeader = useMemo(() => {
    if (weekDays.length === 0) return "";
    const start = weekDays[0].fullDate;
    const end = weekDays[weekDays.length - 1].fullDate;
    if (start.getMonth() === end.getMonth()) {
      return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return `${start.toLocaleDateString("en-US", { month: "short" })} - ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }, [weekDays]);

  // Time parser & duration calculator
  const parseClassTimeMinutes = (timeStr: string) => {
    if (!timeStr) return { startMinutes: 0, endMinutes: 0 };
    const [start, end] = timeStr.split("-").map((t) => t.trim());
    return {
      startMinutes: parseAttendanceTime(start),
      endMinutes: parseAttendanceTime(end),
    };
  };

  // Calculate live progress, state, and bunkable count for a given class card
  const getClassProgressAndBunk = (cls: any) => {
    const { startMinutes, endMinutes } = parseClassTimeMinutes(cls.time);
    const duration = Math.max(1, endMinutes - startMinutes);
    const isToday = selectedDay === todayDayCode && weekOffset === 0;

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    let status: "live" | "upcoming" | "completed" | "other-day" = "other-day";
    let progressPct = 0;
    let minutesLeft = 0;
    let minutesUntilStart = 0;

    if (isToday) {
      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        status = "live";
        const elapsed = currentMinutes - startMinutes;
        progressPct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
        minutesLeft = endMinutes - currentMinutes;
      } else if (currentMinutes < startMinutes) {
        status = "upcoming";
        progressPct = 0;
        minutesUntilStart = startMinutes - currentMinutes;
      } else {
        status = "completed";
        progressPct = 100;
      }
    }

    // Bunk / Margin calculation
    const attended = Number(cls.attendedClasses) || 0;
    const total = Number(cls.totalClasses) || 0;
    const currentPct = total > 0 ? (attended / total) * 100 : parseFloat(cls.attendancePercentage || "0");
    const isLab = String(cls.slotName || "").trim().toUpperCase().startsWith("L");
    const thresholdDec = targetAttendancePct / 100;

    let bunkStatus: "safe" | "warning" | "critical" = "safe";
    let bunkText = "";
    let bunkSubtext = "";

    if (total === 0) {
      bunkText = "No classes held yet";
      bunkStatus = "safe";
    } else if (currentPct < targetAttendancePct) {
      const needed = Math.ceil((thresholdDec * total - attended) / (1 - thresholdDec));
      const neededValue = isLab ? Math.ceil(needed / 2) : Math.max(1, needed);
      bunkStatus = "critical";
      bunkText = `Need ${neededValue} class${neededValue > 1 ? "es" : ""}`;
      bunkSubtext = `to reach ${targetAttendancePct}%`;
    } else {
      const canMiss = Math.floor(attended / thresholdDec - total);
      const canMissValue = isLab ? Math.floor(canMiss / 2) : canMiss;
      if (canMissValue <= 0) {
        bunkStatus = "warning";
        bunkText = "0 bunkable";
        bunkSubtext = "On safety margin";
      } else {
        bunkStatus = "safe";
        bunkText = `${canMissValue} bunkable`;
        bunkSubtext = `Safe margin above ${targetAttendancePct}%`;
      }
    }

    return {
      status,
      progressPct,
      minutesLeft,
      minutesUntilStart,
      attended,
      total,
      currentPct,
      bunkStatus,
      bunkText,
      bunkSubtext,
    };
  };

  // Formatted date string for selected day based on active calendar week
  const getSelectedDayFormattedDate = () => {
    if (selectedDayMeta) {
      return selectedDayMeta.fullDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return selectedDay;
  };

  const currentSlideData = insightSlides[activeSlide] || insightSlides[0];

  // State checks for the active view
  const isExamDay = selectedDayMeta && selectedDayMeta.exams && selectedDayMeta.exams.length > 0;
  const isHolidayOrOff = selectedDayMeta && selectedDayMeta.holidayInfo && !isExamDay;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300">
      
      {/* ── TOP APP BAR: AVATAR / ICON ABOVE GREETING & CONTROLS ── */}
      <div className="flex items-start justify-between px-1">
        <div className="flex flex-col items-start min-w-0 text-left">
          {/* Avatar or AmazeCC Icon Above */}
          <div className="mb-3">
            {shouldDisplayProfilePhoto && profileImage ? (
              <img
                src={profileImage}
                alt=""
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 object-cover shadow-xs"
              />
            ) : (
              <img
                src={getAssetPath("/logo.png")}
                alt="AmazeCC"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl object-contain shadow-xs border border-zinc-200/60 dark:border-zinc-800/80 p-0.5 bg-white dark:bg-zinc-900"
              />
            )}
          </div>

          {/* Multiline Greeting & Name Below */}
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
            {getGreeting()},
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
            {profileName}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Sync Button */}
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Sync Data from VTOP"
          >
            <RefreshCcw className={`w-4 h-4 ${isSpinning ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          {/* Spotlight Search */}
          <button
            onClick={onOpenCommandPalette}
            className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── STATS: SPACIOUS, MINIMAL SIDE-BY-SIDE CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        
        {/* CARD 1: PINNED HERO ATTENDANCE (SPACIOUS & CLEAN) */}
        <div
          onClick={() => {
            setActiveTab("attendance");
            setActiveAttendanceSubTab("attendance");
          }}
          className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Attendance
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                overallAttendance.status === "Safe"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : overallAttendance.status === "Warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              {overallAttendance.status}
            </span>
          </div>

          {/* Big clean percentage with state color */}
          <div className="my-auto">
            <span
              className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block ${
                overallAttendance.status === "Safe"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : overallAttendance.status === "Warning"
                  ? "text-amber-500 dark:text-amber-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {overallAttendance.percentage > 0
                ? `${overallAttendance.percentage.toFixed(settings?.decimalValues ? 1 : 0)}%`
                : "—"}
            </span>
          </div>

          <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {overallAttendance.attended} of {overallAttendance.total} attended
          </p>
        </div>

        {/* CARD 2: ROTATING DYNAMIC INSIGHT CAROUSEL (SPACIOUS & MINIMAL) */}
        {insightSlides.length > 0 && (
          <div
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onTouchStart={() => setIsCarouselPaused(true)}
            onTouchEnd={() => setIsCarouselPaused(false)}
            onClick={() => currentSlideData.onClick()}
            className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer relative overflow-hidden group"
          >
            {/* Header: Metric Title & Category Badge */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                {currentSlideData.title}
              </span>
              {currentSlideData.badge && (
                <span
                  className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                    currentSlideData.badgeColor || "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40"
                  }`}
                >
                  {currentSlideData.badge}
                </span>
              )}
            </div>

            {/* Slide Body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlideData.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="my-auto min-w-0"
              >
                <span
                  className={`text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight leading-tight truncate block ${
                    currentSlideData.id === "cgpa" && (settings?.CGPAHidden || settings?.blurGrades)
                      ? "blur-[5px] select-none"
                      : ""
                  }`}
                >
                  {currentSlideData.headline}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Footer with subline and dots */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                {currentSlideData.subline}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                {insightSlides.map((slide, idx) => (
                  <span
                    key={slide.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeSlide === idx
                        ? "w-3 bg-indigo-500"
                        : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TIMETABLE & INTEGRATED ACADEMIC CALENDAR SECTION ── */}
      <div className="space-y-4 text-left">
        
        {/* Calendar Header: Month, Navigation & Link to Full Calendar Page */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
                {calendarWeekHeader}
              </h2>
            </div>

            {/* Week navigation arrows */}
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => {
                    setWeekOffset(0);
                    setSelectedDay(todayDayCode);
                  }}
                  className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 ml-1 cursor-pointer"
                >
                  This Week
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Deep link button: Open Full Academic Calendar Page */}
            <button
              onClick={() => {
                setActiveTab("attendance");
                setActiveAttendanceSubTab("calendar");
              }}
              className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-2xs"
              title="Open Full Calendar Page"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Full Calendar</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            {/* Pill Style Selector (Compact 2-Line vs Detailed) */}
            {!isExamDay && !isHolidayOrOff && (
              <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                <button
                  onClick={() => setPillStyle("compact")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pillStyle === "compact"
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                  title="2-Line Compact Pill View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Compact</span>
                </button>
                <button
                  onClick={() => setPillStyle("detailed")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pillStyle === "detailed"
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                  title="Spacious Detailed Card View"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Detailed</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Shortcut Buttons: Timetable & Predictor */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimetableModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800/60 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Full Timetable</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("attendance");
              setActiveAttendanceSubTab("predictor");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800/60 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Predictor</span>
          </button>
        </div>

        {/* ── INTEGRATED CALENDAR WEEK ROW (DATES + DAYS + EXAMS + HOLIDAYS) ── */}
        <div className="grid grid-cols-7 gap-1.5 p-1.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
          {weekDays.map((item) => {
            const isSelected = selectedDay === item.dayCode;
            const isToday = item.isToday;
            const count = timetableMap[item.detectedDayOrder || item.dayCode]?.length || 0;

            return (
              <button
                key={item.dayCode}
                onClick={() => setSelectedDay(item.dayCode)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs font-black ring-1 ring-indigo-500/20"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold"
                }`}
              >
                {/* Weekday Code */}
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                  {item.dayCode}
                </span>

                {/* Real Calendar Date Number */}
                <span
                  className={`text-base sm:text-lg font-black font-outfit tracking-tight leading-tight my-0.5 ${
                    isSelected
                      ? "text-indigo-600 dark:text-indigo-300 scale-105"
                      : isToday
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {item.dayNumber}
                </span>

                {/* Status / Exam / Holiday / Class Count Badge */}
                <span
                  className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold leading-tight ${
                    item.hasExam
                      ? "bg-red-500 text-white font-extrabold"
                      : item.holidayInfo
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : item.detectedDayOrder
                      ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                      : isSelected
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                      : count > 0
                      ? "text-zinc-500 dark:text-zinc-400"
                      : "text-zinc-300 dark:text-zinc-600"
                  }`}
                >
                  {item.hasExam
                    ? "Exam"
                    : item.holidayInfo
                    ? "Off"
                    : item.detectedDayOrder
                    ? `${item.detectedDayOrder}`
                    : count > 0
                    ? `${count} cls`
                    : "Free"}
                </span>

                {/* Dot for today */}
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 right-1.5 shadow-xs" title="Today" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Sub-Header */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
              {getSelectedDayFormattedDate()}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isExamDay
                ? `${selectedDayMeta.exams.length} ${selectedDayMeta.exams.length === 1 ? "exam" : "exams"} scheduled`
                : isHolidayOrOff
                ? "Academic Holiday / Non-Instructional"
                : `${selectedDayClasses.length} ${selectedDayClasses.length === 1 ? "session" : "sessions"} scheduled`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedDay !== todayDayCode && weekOffset === 0 && (
              <button
                onClick={() => setSelectedDay(todayDayCode)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 px-3 py-1 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                Jump to Today
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab("attendance");
                setActiveAttendanceSubTab("calendar");
              }}
              className="sm:hidden text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30 px-2.5 py-1 rounded-xl"
            >
              Calendar
            </button>
          </div>
        </div>

        {/* Day Order Override Banner (Auto-detected from Academic Calendar) */}
        {selectedDayMeta?.orderInfo && !isExamDay && !isHolidayOrOff && (
          <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{selectedDayMeta.orderInfo} (Applied)</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              Calendar Auto
            </span>
          </div>
        )}

        {/* ── VIEWPORT STATE 1: EXAM SCHEDULE DAY (STICKY & SPACIOUS) ── */}
        {isExamDay ? (
          <div className="sticky top-4 z-20 space-y-3.5 max-h-[80vh] overflow-y-auto pr-0.5">
            {selectedDayMeta.exams.map((ex: any, idx: number) => (
              <div
                key={`${ex.courseCode}-${ex.classId || idx}`}
                className="p-5 sm:p-6 rounded-[28px] bg-gradient-to-br from-red-500/10 via-white/90 to-amber-500/10 dark:from-red-950/30 dark:via-zinc-900/90 dark:to-amber-950/20 backdrop-blur-xl border border-red-500/30 dark:border-red-800/40 shadow-lg text-left space-y-4"
              >
                {/* Exam Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-red-500 text-white shadow-xs">
                      {ex.examCategory || "Exam Day"}
                    </span>
                    {ex.examSession && (
                      <span className="text-xs font-extrabold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/50 px-2.5 py-1 rounded-xl border border-red-200 dark:border-red-900/50">
                        Session: {ex.examSession}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                    Slot {ex.slot || "—"}
                  </span>
                </div>

                {/* Course Details */}
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white font-outfit leading-snug">
                    {ex.courseTitle || "Course Examination"}
                  </h2>
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                    {ex.courseCode}
                  </p>
                </div>

                {/* Timing, Venue & Seating Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-red-200/50 dark:border-red-900/30">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                      <Clock className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{ex.examTime || "Morning Session"}</span>
                    </div>
                    {ex.reportingTime && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
                        Reporting: <span className="font-bold text-zinc-800 dark:text-zinc-200">{ex.reportingTime}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                      <Building className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Venue: <strong className="text-zinc-900 dark:text-white font-bold">{ex.venue || "Hall Assigned"}</strong></span>
                    </div>
                    {(ex.seatNo || ex.seatLocation) && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
                        Seat: <strong className="text-zinc-900 dark:text-white font-bold">No. {ex.seatNo || "—"}</strong> ({ex.seatLocation || "Row"})
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                    No regular lectures on exam day
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab("attendance");
                      setActiveAttendanceSubTab("calendar");
                    }}
                    className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Hall Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : isHolidayOrOff ? (
          /* ── VIEWPORT STATE 2: HOLIDAY / NON-INSTRUCTIONAL DAY (SPACIOUS & MINIMAL) ── */
          <div className="p-10 rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-4 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Sun className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-base text-zinc-900 dark:text-white font-outfit">
                No classes today
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
                {selectedDayMeta.holidayInfo} • Non-instructional day as per the official Academic Calendar.
              </p>
            </div>
            <div className="pt-1">
              <button
                onClick={() => {
                  setActiveTab("attendance");
                  setActiveAttendanceSubTab("calendar");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                <CalendarIcon className="w-3.5 h-3.5" /> View Academic Calendar
              </button>
            </div>
          </div>
        ) : selectedDayClasses.length === 0 ? (
          /* ── VIEWPORT STATE 3: FREE DAY (NO CLASSES SCHEDULED) ── */
          <div className="p-8 rounded-[28px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mx-auto text-indigo-500">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white font-outfit">
                No classes on {selectedDay}!
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                No lectures or lab sessions are scheduled for this day. Enjoy your free time or check free classrooms.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setActiveTab("academics");
                  setActiveSubTab("free-class");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-3.5 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Free Classrooms <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEWPORT STATE 4: REGULAR TIMETABLE CLASSES ── */
          <div className="space-y-3">
            {selectedDayClasses.map((cls: any, index: number) => {
              const {
                status,
                progressPct,
                minutesLeft,
                minutesUntilStart,
                attended,
                total,
                currentPct,
                bunkStatus,
                bunkText,
              } = getClassProgressAndBunk(cls);

              const isLive = status === "live";
              const isCompleted = status === "completed";
              const isUpcoming = status === "upcoming";

              if (pillStyle === "compact") {
                /* ── OPTION A: COMPACT 2-LINE PILL (HIGH DENSITY WITH PERCENTAGE ON RIGHT) ── */
                return (
                  <div
                    key={`${cls.courseCode}-${cls.slotName}-${index}`}
                    onClick={() => {
                      setActiveTab("attendance");
                      setActiveAttendanceSubTab("attendance");
                    }}
                    className={`relative overflow-hidden rounded-2xl transition-all duration-200 cursor-pointer text-left border ${
                      isLive
                        ? "bg-white dark:bg-zinc-900 border-indigo-500 dark:border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                        : isCompleted
                        ? "bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-850 opacity-75 hover:opacity-100"
                        : "bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700"
                    } hover:scale-[1.006] active:scale-[0.99]`}
                  >
                    {/* Live Progress Background Fill Bar */}
                    {isLive && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-indigo-500/15 to-emerald-500/15 pointer-events-none transition-all duration-700 ease-linear"
                        style={{ width: `${progressPct}%` }}
                      />
                    )}

                    <div className="relative py-3 px-4 z-10 flex items-center justify-between gap-3">
                      {/* Left: 2 Lines of info */}
                      <div className="min-w-0 flex-1">
                        {/* Line 1: Slot + Title + Status */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                            {cls.slotName}
                          </span>
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight" title={cls.courseTitle}>
                            {cls.courseTitle}
                          </h3>
                          {isLive && (
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white shrink-0 shadow-2xs animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                              Live ({minutesLeft}m)
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 px-1.5 py-0.2 rounded shrink-0">
                              Done
                            </span>
                          )}
                        </div>

                        {/* Line 2: Time • Venue • Bunkable count */}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            {cls.time}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="flex items-center gap-1 shrink-0 font-medium text-zinc-600 dark:text-zinc-400">
                            <MapPin className="w-3 h-3 text-zinc-400" />
                            {cls.slotVenue || "Room Assigned"}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span
                            className={`font-bold inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10.5px] ${
                              bunkStatus === "safe"
                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                : bunkStatus === "warning"
                                ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                                : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                bunkStatus === "safe"
                                  ? "bg-emerald-500"
                                  : bunkStatus === "warning"
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                            />
                            {bunkText}
                          </span>
                        </div>
                      </div>

                      {/* Right: Attendance Percentage & Ratio */}
                      <div className="text-right shrink-0 flex flex-col items-end justify-center pl-2">
                        <span
                          className={`text-base font-black font-outfit tracking-tight leading-none ${
                            currentPct >= targetAttendancePct + 5
                              ? "text-emerald-600 dark:text-emerald-400"
                              : currentPct >= targetAttendancePct
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {currentPct.toFixed(0)}%
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {attended}/{total}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar for Ongoing Class */}
                    {isLive && (
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700 ease-linear"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              /* ── OPTION B: DETAILED SPACIOUS PILL (EXPANDED CARD VIEW) ── */
              return (
                <div
                  key={`${cls.courseCode}-${cls.slotName}-${index}`}
                  onClick={() => {
                    setActiveTab("attendance");
                    setActiveAttendanceSubTab("attendance");
                  }}
                  className={`relative overflow-hidden rounded-[24px] transition-all duration-300 cursor-pointer text-left border ${
                    isLive
                      ? "bg-white dark:bg-zinc-900 border-indigo-500 dark:border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                      : isCompleted
                      ? "bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-850 opacity-75 hover:opacity-100"
                      : "bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700"
                  } hover:scale-[1.008] active:scale-[0.99]`}
                >
                  
                  {/* Dynamic Progress Fill Bar */}
                  {isLive && (
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-indigo-500/15 to-violet-500/20 pointer-events-none transition-all duration-700 ease-linear"
                      style={{ width: `${progressPct}%` }}
                    />
                  )}

                  {/* Main Pill Content */}
                  <div className="relative p-5 z-10 flex flex-col justify-between gap-3">
                    
                    {/* Top Row: Slot & Status Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black tracking-wider uppercase px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                          {cls.slotName}
                        </span>

                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.8 rounded-xl bg-emerald-500 text-white shadow-xs animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            Live ({minutesLeft}m left)
                          </span>
                        )}

                        {isUpcoming && selectedDay === todayDayCode && weekOffset === 0 && (
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                            {minutesUntilStart <= 60
                              ? `In ${minutesUntilStart} mins`
                              : `Upcoming`}
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-zinc-400" /> Done
                          </span>
                        )}
                      </div>

                      {/* Course Attendance % Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                          {attended}/{total}
                        </span>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-lg font-outfit ${
                            currentPct >= targetAttendancePct + 5
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : currentPct >= targetAttendancePct
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {currentPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Title & Course Meta */}
                    <div>
                      <h3 className="font-extrabold text-base text-zinc-900 dark:text-white leading-snug font-outfit">
                        {cls.courseTitle}
                      </h3>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold mt-1 flex items-center gap-2">
                        <span>{cls.courseCode}</span>
                        <span>•</span>
                        <span className="truncate">{cls.faculty || "Faculty Assigned"}</span>
                      </p>
                    </div>

                    {/* Bottom Row: Time, Venue & Bunkable Subtext */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      
                      {/* Time & Venue */}
                      <div className="flex items-center gap-3.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                        <span className="flex items-center gap-1.5 shrink-0 font-bold">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {cls.time}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {cls.slotVenue || "Room Assigned"}
                          </span>
                        </span>
                      </div>

                      {/* Bunkable Classes Subtext Indicator */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                            bunkStatus === "safe"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30"
                              : bunkStatus === "warning"
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30"
                              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-900/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              bunkStatus === "safe"
                                ? "bg-emerald-500"
                                : bunkStatus === "warning"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          />
                          {bunkText}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar for Ongoing Class */}
                    {isLive && (
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700 ease-linear"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Timetable Modal */}
      {showTimetableModal && (
        <Modal onClose={() => setShowTimetableModal(false)} maxWidth="max-w-5xl" noPadding>
          <div className="flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/90 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                    Full Weekly Timetable
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Slot matrix, timeslots & classroom venues
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTimetableModal(false);
                  setActiveTab("attendance");
                  setActiveAttendanceSubTab("attendance");
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer mr-6"
              >
                <span>Attendance Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-50/40 dark:bg-zinc-950/50">
              <TimetableGrid attendance={attendanceData?.attendance || []} />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
