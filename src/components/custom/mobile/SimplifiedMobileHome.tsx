"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  UserSearch,
  Sun,
  CalendarOff,
  Building,
  DoorOpen,
  WifiOff,
  X,
  ChevronDown,
} from "lucide-react";

import { AnimatePresence, m } from "framer-motion";
import {
  buildAttendanceDayCardsMap,
  AttendanceDay,
  ATTENDANCE_DAYS,
  parseAttendanceTime,
} from "@/lib/attendanceTimetable";
import { summariseAttendance } from "@/lib/attendanceSummary";
import { shouldShowGpa, shouldShowProfilePhoto } from "@/lib/settingsVisibility";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { getAssetPath } from "@/lib/utils";
import { buildExamRows } from "@/lib/examSchedule";
import { dateKey } from "@/lib/calendarDay";
import { isLabFatMarked, labFatPapersByDate, labSlotTokens, type LabFatPaper } from "@/lib/labFatWeek";
import { cn } from "@amazecontinuityprojects/amazeui";
import { TILE } from "@/lib/uiTokens";
import TimetableGrid from "../attendance/TimetableGrid";
import WeekSlotMap from "./WeekSlotMap";
import DesktopCourseDetail from "../attendance/DesktopCourseDetail";
import BottomSheet from "../shared/BottomSheet";
import { useSyncTrigger } from "../shared/useSyncTrigger";
import {
  EmptyPanel,
  IconButton,
  InsightCarousel,
  StatTile,
  ListShell,
  SegmentedControl,
  useCarousel,
  useHorizontalSwipe,
  type InsightSlide,
} from "../shared/primitives";
import { useAtom } from "jotai";
import { tasksAtom } from "@/store/dataAtoms";
import { classTaskSummary, tasksForDay, isSameCalendarDay, isDueOnDay } from "@/lib/taskMatch";
import {
  SELECTED_RING,
  TODAY_INK,
  TODAY_RING,
  WEEK_STRIP_TINT,
  weekStripExamNote,
  weekStripFlavour,
  weekStripTitle,
} from "@/lib/weekStrip";
import TaskBadge from "../tasks/TaskBadge";
import HomeAttendanceList from "./HomeAttendanceList";
import { courseColor } from "@amazecontinuityprojects/amazeui";
import { getAttendanceTimeRange } from "@/lib/attendanceTimetable";
import { HomeNowNext, HomeDueSoon } from "./HomeTodaySummary";
import { KIND_CONFIG } from "../tasks/TaskCard";
import { parseCachedCourses, parseCourseRows, type FreeRoomCourse } from "@/lib/freeClassrooms";
import { facultyGroupKey } from "../exams/FFCS/logic/facultyGroups";
import { getSelectedFinalReportPath, getSelectedFinalSemesterId, mapToFinalSemesterId } from "@/lib/ffcsReports";

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
  setActiveProfileSubTab?: (tab: string) => void;
  setActiveToolsSubTab?: (tab: string) => void;
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
  if (norm.includes("mon") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "MON";
  if (norm.includes("tue") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "TUE";
  if (norm.includes("wed") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "WED";
  if (norm.includes("thu") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "THU";
  if (norm.includes("fri") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "FRI";
  if (norm.includes("sat") && (norm.includes("order") || norm.includes("timetable") || norm.includes("table")))
    return "SAT";
  return null;
}

/**
 * A lab slot whose class hour has been taken over by its Lab FAT paper.
 *
 * Collapsed by default — the slot line (paper + slot + time + venue) is what
 * the student scans; the session, reporting time and seat sit behind the
 * disclosure, exactly like the exam schedule page's rows. Renders in the
 * timetable's slot list, in the place of the lab class it replaces.
 */
function LabFatExamSlot({
  paper,
  time,
  onHallDetails,
}: {
  paper: LabFatPaper;
  time?: string;
  onHallDetails: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `labfat-${paper.courseCode}-${paper.slot}`;
  return (
    <div className="rounded-md border border-danger/60 bg-danger-soft shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Lab FAT exam slot ${paper.slot} — ${paper.courseTitle || paper.courseCode}`}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-transform"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-danger text-white shadow-xs shrink-0">
              Lab FAT
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-danger-soft text-danger border border-danger/40 shrink-0">
              {paper.slot}
            </span>
            <h3 className="text-sm font-semibold text-ink font-outfit truncate">
              {paper.courseTitle || paper.courseCode}
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold min-w-0">
            <span className="inline-flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5 text-danger" />
              {paper.examTime || time || "Time TBA"}
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Building className="w-3.5 h-3.5 text-danger shrink-0" />
              {paper.venue || "Venue TBA"}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 pt-2.5 border-t border-danger/60 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <p className="text-muted">
                Session{" "}
                <span className="block font-semibold text-zinc-800 dark:text-zinc-200">{paper.examSession || "—"}</span>
              </p>
              <p className="text-muted">
                Reporting{" "}
                <span className="block font-semibold text-zinc-800 dark:text-zinc-200">{paper.reportingTime || "—"}</span>
              </p>
              <p className="text-muted">
                Seat{" "}
                <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
                  {paper.seatNo ? `No. ${paper.seatNo}` : "—"}
                </span>
              </p>
              <button
                type="button"
                onClick={onHallDetails}
                className="self-center justify-self-end text-xs font-semibold text-white bg-danger hover:bg-danger px-3 py-1.5 rounded-md transition-all shadow-xs cursor-pointer"
              >
                Hall Details
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  setActiveToolsSubTab,
  handleReloadRequest,
  onOpenCommandPalette,
  profileData: profileDataProp,
  ODhoursData,
  setGradesDisplayIsOpen,
  setODhoursIsOpen,
}: SimplifiedMobileHomeProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [tasks] = useAtom(tasksAtom);
  const [cachedProfile, setCachedProfile] = useState<any>(profileDataProp || null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  /**
   * Which edge the visible week slid in from.
   *
   * Set by `goToWeek` and nowhere else, in the same batch as `weekOffset`, so
   * the entering week is already animating the right way on its first frame.
   * Two pieces of state that each remember "how we got here" and are updated
   * separately is the bug that makes a carousel animate backwards.
   */
  const [weekSlideDir, setWeekSlideDir] = useState<1 | -1>(1);
  const [showTimetableModal, setShowTimetableModal] = useState(false);

  // Timetable sheet registers itself for system back via BottomSheet.

  const activeSemesterId = useMemo(
    () => mapToFinalSemesterId(settings?.currSemesterID) ?? getSelectedFinalSemesterId(),
    [settings?.currSemesterID],
  );

  const [reportCourses, setReportCourses] = useState<FreeRoomCourse[]>(() => {
    if (typeof window === "undefined") return [];
    return parseCachedCourses(
      localStorage.getItem(`ffcs_raw_courses_${activeSemesterId}`) || localStorage.getItem("ffcs_raw_courses"),
    );
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const XLSX = await import("xlsx");
        const reportPath = getSelectedFinalReportPath(activeSemesterId);
        const response = await fetch(reportPath);
        if (!response.ok) return;
        const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
        const parsed = parseCourseRows(rows);
        if (!cancelled && parsed.length > 0) {
          setReportCourses(parsed);
          try {
            localStorage.setItem(`ffcs_raw_courses_${activeSemesterId}`, JSON.stringify(parsed));
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSemesterId]);

  const facultyErpLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of reportCourses) {
      if (!c.ERP_ID) continue;
      if (c.CLASS_ID) {
        map.set(`class:${c.CLASS_ID.toUpperCase()}`, c.ERP_ID);
      }
      if (c.CODE) {
        const code = c.CODE.toUpperCase();
        if (c.SLOT) {
          map.set(`code_slot:${code}:${c.SLOT.toUpperCase()}`, c.ERP_ID);
        }
        if (c.FACULTY) {
          map.set(`code_fac:${code}:${facultyGroupKey(c.FACULTY)}`, c.ERP_ID);
        }
      }
      if (c.FACULTY) {
        map.set(`fac:${facultyGroupKey(c.FACULTY)}`, c.ERP_ID);
      }
    }
    return map;
  }, [reportCourses]);

  const getFacultyErp = useCallback(
    (cls: any): string | undefined => {
      if (cls?.employeeId) return cls.employeeId;
      if (cls?.classId) {
        const hit = facultyErpLookup.get(`class:${String(cls.classId).toUpperCase()}`);
        if (hit) return hit;
      }
      if (cls?.courseCode) {
        const code = String(cls.courseCode)
          .toUpperCase()
          .replace(/\([LPT]\)$/i, "");
        if (cls?.slotName) {
          const hit = facultyErpLookup.get(`code_slot:${code}:${String(cls.slotName).toUpperCase()}`);
          if (hit) return hit;
        }
        if (cls?.faculty) {
          const hit = facultyErpLookup.get(`code_fac:${code}:${facultyGroupKey(cls.faculty)}`);
          if (hit) return hit;
        }
      }
      if (cls?.faculty) {
        const hit = facultyErpLookup.get(`fac:${facultyGroupKey(cls.faculty)}`);
        if (hit) return hit;
      }
      return undefined;
    },
    [facultyErpLookup],
  );

  const handleOpenFreeClassrooms = () => {
    setActiveTab("free-class");
  };

  const handleOpenFacultySchedule = (facultyNameOrErp?: string | React.MouseEvent) => {
    if (typeof facultyNameOrErp === "string" && facultyNameOrErp.trim()) {
      const clean = facultyNameOrErp.trim();
      if (/^\d{3,}$/.test(clean) || clean.startsWith("erp:")) {
        localStorage.setItem("faculty_schedule_target_erp", clean.replace(/^erp:/, ""));
      } else {
        localStorage.setItem("faculty_schedule_target_name", clean);
      }
    }
    // Home launches count only the reader's *enrolled* faculties — the picks
    // they made in the /ffcs planner are a plan, not this screen's courses.
    localStorage.setItem("faculty_schedule_source", "home");
    setActiveTab("faculty-schedule");
  };

  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);

  const handleCourseClick = (courseCode: string) => {
    if (!courseCode) return;
    const cleanCode = String(courseCode)
      .replace(/\([LPT]\)$/i, "")
      .trim();

    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

    if (isDesktop) {
      // In desktop mode, clicking a class displays its side view pane.
      // If clicking the already selected course, navigate to full dashboard.
      const isAlreadySelected = selectedCourseCode && cleanCode.toUpperCase() === selectedCourseCode.toUpperCase();

      if (isAlreadySelected) {
        try {
          localStorage.setItem("course_dashboard_target", cleanCode);
          localStorage.setItem("course_dashboard_tab", "overview");
        } catch {}
        setActiveTab("academics");
        setActiveSubTab("course-dashboard");
      } else {
        setSelectedCourseCode(cleanCode);
      }
    } else {
      // Mobile mode: directly navigate to course dashboard
      try {
        localStorage.setItem("course_dashboard_target", cleanCode);
        localStorage.setItem("course_dashboard_tab", "overview");
      } catch {}
      setActiveTab("academics");
      setActiveSubTab("course-dashboard");
    }
  };

  // Carousel slide index for the dynamic secondary stat card

  // Determine current day of week
  const todayDayIndex = new Date().getDay();
  const dayNames: AttendanceDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const todayDayCode: AttendanceDay = dayNames[todayDayIndex];

  const [selectedDay, setSelectedDay] = useState<AttendanceDay>(todayDayCode);

  /**
   * The only way the visible week changes.
   *
   * Three callers used to write `setWeekOffset` directly — the two chevrons, the
   * "This Week" reset, and now a swipe — and only two of them could know which
   * way the strip was travelling. Routing them all through here means the
   * animation direction is derived from the change, not remembered alongside
   * it.
   */
  const goToWeek = useCallback((next: number, dir: 1 | -1) => {
    setWeekSlideDir(dir);
    setWeekOffset(next);
  }, []);

  /** A drag across the strip pages it, exactly as the chevrons do. */
  const weekSwipe = useHorizontalSwipe({
    onNext: () => goToWeek(weekOffset + 1, 1),
    onPrev: () => goToWeek(weekOffset - 1, -1),
  });

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

  const { isOffline, triggerSync: handleSyncClick } = useSyncTrigger(handleRefresh);

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

  // Overall attendance — the app's one formula, shared with the calendar page so
  // two screens can never show different percentages for the same student.
  const overallAttendance = useMemo(
    () => summariseAttendance(attendanceData?.attendance, targetAttendancePct),
    [attendanceData, targetAttendancePct],
  );

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
      const slot = String(c.slotName || "")
        .trim()
        .toUpperCase();
      const code = String(c.courseCode || "")
        .trim()
        .toUpperCase();
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

  // Flattened exams schedule, with per-paper start/end resolved.
  const scheduleRows = buildExamRows(ScheduleData?.Schedule || ScheduleData?.schedule);

  // Lab FAT papers, joined to the calendar's LAB FAT day marks (see
  // lib/labFatWeek). Both payloads are already fetched; this is the join that
  // lets a lab slot say it has become its own exam.
  const labFatByDate = useMemo(
    () => labFatPapersByDate(ScheduleData?.Schedule || ScheduleData?.schedule, calendarData?.calendars),
    [ScheduleData, calendarData],
  );

  const allExams = useMemo(
    () => scheduleRows.map((r) => ({ ...r.raw, examCategory: r.examType, date: r.date })),
    [scheduleRows],
  );

  // Earliest paper that has NOT finished yet. Judged on the clock, not the
  // calendar: a CAT that ended at 12:30 PM is done at 3 PM even though it is
  // still "today", so it must not sit on this card. Recomputed every render
  // (the insight carousel re-renders on a timer) rather than memoised on the
  // schedule alone, so a card left open across an exam boundary stays honest.
  const nextUpcomingExam = (() => {
    const row = scheduleRows.find((r) => r.state !== "past");
    if (!row) return null;
    return { ...row.raw, examCategory: row.examType, examState: row.state };
  })();

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
        headline: marksData?.cgpa?.cgpa ? `${Number(marksData.cgpa.cgpa).toFixed(2)}` : "—",
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
      headline: marksData?.cgpa?.creditsEarned ? `${Number(marksData.cgpa.creditsEarned)} cr` : "—",
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
        badgeColor: "bg-danger-soft text-danger border-danger/20",
        onClick: () => {
          setActiveTab("academics");
          setActiveSubTab("courses-simplified");
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
          setActiveTab("attendance");
          setActiveAttendanceSubTab("od");
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
        badgeColor: "bg-ok-soft text-ok border-ok/20",
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
  ]);

  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [statTileCount, setStatTileCount] = useState(2);

  useEffect(() => {
    const container = statsContainerRef.current;
    if (!container) return;

    const updateCount = (width: number) => {
      if (width > 0) {
        // Fits tiles of ~220px + 12px gap
        const count = Math.max(2, Math.floor((width + 12) / (220 + 12)));
        setStatTileCount(count);
      }
    };

    updateCount(container.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(([entry]) => updateCount(entry.contentRect.width));
      observer.observe(container);
      return () => observer.disconnect();
    }

    const handleResize = () => updateCount(container.getBoundingClientRect().width);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const attendanceTile = useMemo(
    () => ({
      id: "attendance",
      label: "Attendance",
      value:
        overallAttendance.percentage > 0
          ? `${overallAttendance.percentage.toFixed(settings?.decimalValues ? 1 : 0)}%`
          : "—",
      sub: `${overallAttendance.attended} of ${overallAttendance.total} attended`,
      badge: overallAttendance.status,
      badgeColor: undefined as string | undefined,
      tone: overallAttendance.status === "Safe" ? "emerald" : overallAttendance.status === "Warning" ? "amber" : "red",
      blur: undefined as string | undefined,
      onClick: () => {
        setActiveTab("attendance");
        setActiveAttendanceSubTab("predictor");
      },
    }),
    [overallAttendance, settings?.decimalValues, setActiveTab, setActiveAttendanceSubTab],
  );

  const secondaryTiles = useMemo(
    () =>
      insightSlides.map((s) => ({
        id: s.id,
        label: s.title,
        value: s.headline,
        sub: s.subline,
        badge: s.badge,
        badgeColor: s.badgeColor,
        tone:
          s.id === "alerts"
            ? "red"
            : s.id === "cgpa"
              ? "indigo"
              : s.id === "credits"
                ? "blue"
                : s.id === "exam"
                  ? "emerald"
                  : s.id === "od"
                    ? "emerald"
                    : "amber",
        blur: s.id === "cgpa" && (settings?.CGPAHidden || settings?.blurGrades) ? "blur-[5px]" : undefined,
        onClick: s.onClick,
      })),
    [insightSlides, settings?.CGPAHidden, settings?.blurGrades],
  );

  // Attendance, credits, shortage alert and the rest stay as the home widgets.
  const allStatTiles = useMemo(() => [attendanceTile, ...secondaryTiles], [attendanceTile, secondaryTiles]);

  const hasStatOverflow = allStatTiles.length > statTileCount;
  const directTileCount = hasStatOverflow ? Math.max(1, statTileCount - 1) : allStatTiles.length;
  const directTiles = useMemo(() => allStatTiles.slice(0, directTileCount), [allStatTiles, directTileCount]);
  const directStatIds = useMemo(() => new Set(directTiles.map((t) => t.id)), [directTiles]);

  const overflowSlides = useMemo<InsightSlide[]>(
    () =>
      allStatTiles
        .filter((tile) => !directStatIds.has(tile.id))
        .map((tile) => ({
          id: tile.id,
          label: tile.label,
          value: tile.value,
          sub: tile.sub,
          badge: tile.badge,
          badgeClassName: tile.badgeColor,
          tone: tile.tone,
          blur: tile.blur,
          onClick: tile.onClick,
        })),
    [allStatTiles, directStatIds],
  );

  const statCarousel = useCarousel(overflowSlides.length);
  const carousel = statCarousel;
  const carouselSlides = overflowSlides;
  const statColumnCount = directTiles.length + (overflowSlides.length > 0 ? 1 : 0);

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
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
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
        if (!ex.date) return false;
        const examTs = ex.date.getTime();
        return examTs >= targetDateStart && examTs <= targetDateEnd;
      });

      // Check for academic calendar events with strict month and year matching
      let holidayInfo: string | null = null;
      let detectedDayOrder: AttendanceDay | null = null;
      let orderInfo: string | null = null;
      let isInstructional = false;
      let isLabFatDay = false;

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

          // "(Working Day / LAB FAT)" marks the day; the schedule supplies the
          // paper. The two meet per-date in the return below.
          if (isLabFatMarked(text, ev.category)) isLabFatDay = true;

          const hasNoInstructional =
            norm.includes("no instructional") || norm.includes("non instructional") || norm.includes("noinstructional");

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
        isLabFatDay,
        labFatPapers: isLabFatDay ? (labFatByDate.get(dateKey(d)) ?? []) : [],
      };
    });
  }, [weekOffset, allExams, calendarData, settings?.calendarType, moodleData, labFatByDate]);

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

  // The real current date, not the day being browsed. "…today" task labels and
  // the red test tint are gated on this.
  const viewedDayDate: Date | undefined = selectedDayMeta?.fullDate;
  const isTodayView = Boolean(viewedDayDate) && isSameCalendarDay(viewedDayDate as Date, new Date());

  // Classes for the selected day (or day order override)
  const selectedDayClasses = useMemo(() => {
    return timetableMap[effectiveTimetableDay] || [];
  }, [timetableMap, effectiveTimetableDay]);

  // The day's Lab FAT papers (calendar mark + schedule join).
  const selectedDayLabFat: LabFatPaper[] = selectedDayMeta?.labFatPapers ?? [];

  /**
   * The slot list with lab FAT taken over in place: a lab class whose slot or
   * course matches a paper becomes that paper's exam slot, in the class's own
   * position and with its time. Papers with no matching row (attendance not
   * synced, exam outside class hours) still get their slot, appended in
   * exam-time order, so a Lab FAT never renders as an ordinary class hour.
   */
  const dayRows = useMemo(() => {
    type DayRow = { kind: "class"; cls: any; index: number } | { kind: "labFat"; paper: LabFatPaper; time?: string };
    const rows: DayRow[] = [];
    const remaining = [...selectedDayLabFat];

    selectedDayClasses.forEach((cls: any, index: number) => {
      const classTokens = labSlotTokens(cls.slotName);
      const isLabClass = classTokens.length > 0;
      const paperIdx = isLabClass
        ? remaining.findIndex(
            (p) => p.labTokens.some((t) => classTokens.includes(t)) || p.courseCode === cls.courseCode,
          )
        : -1;
      if (paperIdx !== -1) {
        const [paper] = remaining.splice(paperIdx, 1);
        rows.push({ kind: "labFat", paper, time: cls.time });
      } else {
        rows.push({ kind: "class", cls, index });
      }
    });

    remaining
      .slice()
      .sort((a, b) =>
        String(a.examTime ?? a.reportingTime ?? "").localeCompare(String(b.examTime ?? b.reportingTime ?? "")),
      )
      .forEach((paper) => rows.push({ kind: "labFat", paper }));

    return rows;
  }, [selectedDayClasses, selectedDayLabFat]);

  // Selected course object for desktop course side view pane (active when a class is clicked)
  const selectedCourseObj = useMemo(() => {
    if (!selectedCourseCode || !attendanceData?.attendance || !Array.isArray(attendanceData.attendance)) {
      return null;
    }

    const clean = selectedCourseCode
      .replace(/\([LPT]\)$/i, "")
      .trim()
      .toUpperCase();

    return (
      attendanceData.attendance.find((c: any) => {
        const cCode = String(c?.courseCode || "")
          .replace(/\([LPT]\)$/i, "")
          .trim()
          .toUpperCase();
        return cCode === clean;
      }) || null
    );
  }, [attendanceData?.attendance, selectedCourseCode]);

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
    const isLab = String(cls.slotName || "")
      .trim()
      .toUpperCase()
      .startsWith("L");
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

  // State checks for the active view
  // Calendar-marked or paper-derived: either signal alone marks the day.
  const isLabFatDay = Boolean(selectedDayMeta?.isLabFatDay) || selectedDayLabFat.length > 0;
  // A Lab FAT day is a working day — other classes still run, so the day keeps
  // its timetable and only the lab slot becomes the exam (see dayRows).
  const isExamDay = selectedDayMeta && selectedDayMeta.exams && selectedDayMeta.exams.length > 0 && !isLabFatDay;
  const isHolidayOrOff = selectedDayMeta && selectedDayMeta.holidayInfo && !isExamDay && !isLabFatDay;
  // Sessions still running: the slot list minus the labs that became exams.
  const stillOnCount = dayRows.filter((row) => row.kind === "class").length;

  return (
    <div className="w-full max-w-4xl lg:max-w-none mx-auto lg:mx-0 pt-3 sm:pt-5 md:pb-8 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8 w-full">
        {/* Left Column: Feed, Stats, Timetable, Shortcuts */}
        <div className="w-full lg:flex-1 lg:min-w-0 space-y-6 text-left">
          {/* ── TOP APP BAR: AVATAR / ICON ABOVE GREETING & CONTROLS ── */}
          <div className="flex items-start justify-between px-1">
            <div className="flex min-w-0 flex-1 flex-col items-stretch pr-2 text-left">
              <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-2xl">
                {getGreeting()}, {(() => { const n = String(profileName || "there").split(" ")[0]; return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); })()}
              </h1>
              <p className="mt-1 text-[13.5px] text-muted">
                {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>

            {/* Action Controls */}
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              {/* Sync Button */}
              <button
                onClick={handleSyncClick}
                className={`relative hit-expand flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors duration-[120ms] cursor-pointer ${
                  isOffline ? "bg-warn-soft text-warn" : "text-ink-2 hover:bg-surface-2"
                }`}
                title={isOffline ? "You're offline — tap for details" : "Sync Data from VTOP"}
                aria-label={isOffline ? "Offline — tap for details" : "Sync Data from VTOP"}
              >
                {isOffline ? (
                  <>
                    <WifiOff className="w-4 h-4 shrink-0" />
                    <span>Offline</span>
                  </>
                ) : (
                  <RefreshCcw className={`h-[18px] w-[18px] ${isSpinning ? "animate-spin text-accent" : ""}`} strokeWidth={1.8} />
                )}
              </button>

              {/* Spotlight Search */}
              <button
                onClick={onOpenCommandPalette}
                className="hidden h-10 w-10 place-items-center rounded-full text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 cursor-pointer sm:grid"
                title="Search (Cmd+K)"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                aria-label="Profile"
                title="Profile"
                className="ml-1 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2 transition-colors duration-[120ms] hover:bg-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {initials}
              </button>
            </div>
          </div>

          {/* ── STATS: DYNAMIC MULTI-TILE & CAROUSEL GRID ── */}
          <HomeNowNext
            classes={timetableMap[todayDayCode] || []}
            now={currentTime}
            onOpenCourse={handleCourseClick}
          />

          <HomeAttendanceList
            courses={attendanceData?.attendance}
            targetPct={targetAttendancePct}
            onCourseClick={handleCourseClick}
            onViewAll={() => setActiveTab("attendance")}
          />

          <HomeDueSoon tasks={tasks} now={currentTime} />

          <div
            ref={statsContainerRef}
            className="grid gap-3 sm:gap-4 text-left"
            style={{
              gridTemplateColumns: `repeat(${statColumnCount}, minmax(0, 1fr))`,
            }}
          >
            {directTiles.map((tile) => (
              <div key={tile.id} onClick={tile.onClick} className={cn("min-w-0", tile.onClick && "cursor-pointer")}>
                <StatTile
                  label={tile.label}
                  value={tile.value}
                  sub={tile.sub}
                  badge={tile.badge}
                  tone={tile.tone}
                  className={cn(
                    tile.onClick && "transition-all group",
                    tile.blur,
                  )}
                />
              </div>
            ))}

            {overflowSlides.length > 0 && (
              <InsightCarousel
                slides={overflowSlides}
                carousel={statCarousel}
                ariaLabel="Rotating insights"
                className="min-w-0"
              />
            )}
          </div>

          <WeekSlotMap
            map={timetableMap as any}
            today={todayDayCode}
            now={currentTime}
            selectedDay={weekOffset === 0 ? selectedDay : undefined}
            onSelectDay={(d) => {
              setWeekOffset(0);
              setSelectedDay(d as AttendanceDay);
            }}
          />

          {/* ── TIMETABLE & INTEGRATED ACADEMIC CALENDAR SECTION ── */}
          <div className="space-y-4 text-left">
            {/* Calendar Header: Week Navigation (left) & Display Controls (right)

            `gap-2` and `flex-wrap` are load-bearing on this row, not polish. It
            has two children at opposite ends of the width, and the left one
            grows and shrinks with the state: a month range, two chevrons, and
            the Today chip whenever you are off today — which is exactly the
            state the exam-schedule viewport below is showing. With no gap and
            no wrap, the left group ran its last child straight into the
            Compact/Detailed control, and on a 360px phone both were still
            "half visible" rather than one of them obviously having won.

            `min-w-0` on the left, plus `truncate` on the date, is what lets the
            month range shorten ("Nov - Dec 2025" → "…") instead of shoving the
            filter off the edge. The filter itself is `shrink-0` because its
            segments are `whitespace-nowrap`: squeezed, they would overflow their
            own pill rather than shorten, so refusing to shrink is the honest
            answer and `ml-auto` keeps it right-aligned when it wraps to a line
            of its own. */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
                  <h2 className="text-sm font-semibold text-ink font-outfit tracking-tight truncate">
                    {calendarWeekHeader}
                  </h2>
                </div>

                {/* Week navigation arrows. The strip itself is swipeable too; these
                stay because a chevron is the one affordance that works with a
                keyboard and a screen reader without a gesture. */}
                <div className="flex items-center gap-1 ml-1 shrink-0">
                  <button
                    onClick={() => goToWeek(weekOffset - 1, -1)}
                    className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                    title="Previous Week"
                    aria-label="Previous Week"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => goToWeek(weekOffset + 1, 1)}
                    className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                    title="Next Week"
                    aria-label="Next Week"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  {/* "Today" — the way back, from wherever the selection is.

                  This started life as a "This Week" chip that only appeared
                  when the week had been paged away from, and it already did
                  the whole job: reset the week *and* select today. What it got
                  wrong was showing up. Gating it on `weekOffset !== 0` alone
                  meant that picking a different day on the current week — by
                  far the more common way to wander off today — hid the only
                  control that undid it, and the page then offered no way home
                  at all. So the condition is "you are not on today", and the
                  two things this page used to offer separately are one chip.

                  It is named after the day rather than the week because that is
                  what the user is going back to. The week comes along because
                  there is no version of this that is only half a reset: a bare
                  `setSelectedDay(today)` while a browsed week is showing would
                  select *this* week's Tuesday on a week that has no Tuesday on
                  it, and the highlight would land on nothing. */}
                  {(weekOffset !== 0 || selectedDay !== todayDayCode) && (
                    <button
                      onClick={() => {
                        // Direction from wherever the user currently is, so the
                        // reset slides the same way a swipe from that week would.
                        if (weekOffset !== 0) goToWeek(0, 0 < weekOffset ? 1 : -1);
                        setSelectedDay(todayDayCode);
                      }}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 ml-1 cursor-pointer"
                      title="Back to today"
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {/* No deep link to the full academic calendar here any more. The
                strip is the home page's calendar now, and a second "open the
                calendar" button pointing at a month grid of the same data
                asked the user to choose between two views of one thing. The
                link survives on small screens, on the selected-day row below,
                where it is the only route to it. */}

                {/* Pill Style Selector (Compact 2-Line vs Detailed) */}
                {!isExamDay && !isHolidayOrOff && (
                  <SegmentedControl
                    options={[
                      {
                        value: "compact" as const,
                        label: "Compact",
                        icon: <List className="w-3.5 h-3.5" />,
                        title: "2-Line Compact Pill View",
                      },
                      {
                        value: "detailed" as const,
                        label: "Detailed",
                        icon: <Layers className="w-3.5 h-3.5" />,
                        title: "Spacious Detailed Card View",
                      },
                    ]}
                    value={pillStyle}
                    onChange={setPillStyle}
                  />
                )}
              </div>
            </div>

            {/* ── INTEGRATED CALENDAR WEEK ROW ──
            Seven circles, one per day, each tinted by what kind of day it is.
            The day kind used to be a pill that spelled it out (`Exam` / `Off` /
            `3 cls`), which at this size was an eight-pixel smudge competing with
            the date for the same band. The words now live in the title and the
            sub-header below; the circle only says "there is something here".

            The circles sit straight on the page — the `rounded-md bg-zinc-100`
            plate they used to be pinned to is gone, so every one of them draws
            its own fill and its own hairline (`WEEK_STRIP_TINT`). That is what
            the negative space is for: a row of discs with room around the
            numbers instead of five badges crammed against each other.

            `data-prevent-swipe` is load-bearing. `Dashboard` decides a
            horizontal drag means "change tab" by looking at the element the
            touch *ended* on, and a drag that starts on a circle and ends on the
            padding between two circles would otherwise flip the dashboard out
            from under the strip. Circles are exempt already (they are buttons);
            this container covers the rest. */}
            <div
              data-prevent-swipe="true"
              role="group"
              aria-label="Week"
              {...weekSwipe.handlers}
              className={cn("w-full", weekSwipe.className)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={weekOffset}
                  initial={{ opacity: 0, x: weekSlideDir * 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: weekSlideDir * -28 }}
                  transition={{ duration: 0.2 }}
                  // Tracks are equal so the gaps stay even, but each circle is
                  // capped: 7 x 46px already fills a 390px phone, and on a desktop
                  // this is a 900px column where a stretched circle would be a
                  // swimming pool. `justify-self` parks the capped circle in the
                  // middle of its track.
                  className="grid grid-cols-7 gap-1 sm:gap-2"
                >
                  {weekDays.map((item) => {
                    const isSelected = selectedDay === item.dayCode;
                    const count = timetableMap[item.detectedDayOrder || item.dayCode]?.length || 0;
                    const flavour = weekStripFlavour(item);
                    const tint = WEEK_STRIP_TINT[flavour];
                    // Today keeps its green number only when nothing more
                    // important is going on that day. An exam outranks "it is
                    // Tuesday" for attention, and the emerald ring still marks it.
                    const ink = flavour === "teaching" && item.isToday && !isSelected ? TODAY_INK : tint.ink;
                    const title = weekStripTitle(item, count);
                    // A weekend with nothing on it recedes so the working week reads first.
                    const isQuietDay =
                      flavour === "teaching" && count === 0 && (item.dayCode === "SAT" || item.dayCode === "SUN");
                    const labFatNote = item.isLabFatDay ? " · Lab FAT" : "";

                    return (
                      <button
                        key={item.dayCode}
                        type="button"
                        onClick={() => setSelectedDay(item.dayCode)}
                        title={`${title}${labFatNote}`}
                        aria-label={`${title}${labFatNote}${weekStripExamNote(item.exams.length)}`}
                        aria-current={item.isToday ? "date" : undefined}
                        aria-pressed={isSelected}
                        className={cn(
                          "relative flex h-[58px] w-full max-w-[52px] flex-col items-center justify-center gap-1 justify-self-center rounded-sm border transition-colors duration-[120ms] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          isSelected
                            ? SELECTED_RING
                            : cn(tint.fill, item.isToday && flavour === "teaching" ? TODAY_RING : tint.edge, "hover:bg-surface-2"),
                        )}
                      >
                        <span
                          className={cn(
                            "text-[11.5px] leading-none",
                            isSelected ? "text-background/80" : isQuietDay ? "text-muted/70" : "text-muted",
                          )}
                        >
                          {item.dayCode.charAt(0) + item.dayCode.slice(1).toLowerCase()}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[17px] font-semibold leading-none tabular-nums",
                            isSelected ? "text-background" : isQuietDay ? "text-muted" : ink,
                          )}
                        >
                          {item.dayNumber}
                        </span>
                        {item.isToday && !isSelected && (
                          <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />
                        )}
                        {flavour !== "teaching" && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                              flavour === "exam" ? "bg-warn" : flavour === "holiday" ? "bg-danger" : "bg-accent",
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </m.div>
              </AnimatePresence>
            </div>

            {/* Selected Day Sub-Header */}
            <div className="flex items-center justify-between px-1 pt-1">
              <div>
                <h3 className="text-sm font-semibold text-ink font-outfit">
                  {getSelectedDayFormattedDate()}
                </h3>
                <p className="text-xs text-muted font-medium">
                  {isLabFatDay ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-danger">
                        Lab FAT{selectedDayLabFat.length > 1 ? ` ×${selectedDayLabFat.length}` : ""}
                      </span>
                      {stillOnCount > 0
                        ? `· ${stillOnCount} ${stillOnCount === 1 ? "session" : "sessions"} still on`
                        : null}
                    </span>
                  ) : isExamDay ? (
                    `${selectedDayMeta.exams.length} ${selectedDayMeta.exams.length === 1 ? "exam" : "exams"} scheduled`
                  ) : isHolidayOrOff ? (
                    "Academic Holiday / Non-Instructional"
                  ) : (
                    `${selectedDayClasses.length} ${selectedDayClasses.length === 1 ? "session" : "sessions"} scheduled`
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveTab("attendance");
                    setActiveAttendanceSubTab("calendar");
                  }}
                  className="sm:hidden text-[13px] font-medium text-accent hover:underline"
                >
                  Calendar
                </button>
              </div>
            </div>

            {/* Day Order Override Banner (Auto-detected from Academic Calendar) */}
            {selectedDayMeta?.orderInfo && !isExamDay && !isHolidayOrOff && (
              <div className="p-3 rounded-md bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{selectedDayMeta.orderInfo} (Applied)</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
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
                    className="p-5 sm:p-6 rounded-lg bg-danger-soft border border-danger/30 shadow-lg text-left space-y-4"
                  >
                    {/* Exam Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-3 py-1 rounded-md bg-danger text-white shadow-xs">
                          {ex.examCategory || "Exam Day"}
                        </span>
                        {ex.examSession && (
                          <span className="text-xs font-semibold text-danger bg-danger-soft px-2.5 py-1 rounded-md border border-danger/40">
                            Session: {ex.examSession}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Slot {ex.slot || "—"}</span>
                    </div>

                    {/* Course Details */}
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-ink font-outfit leading-snug">
                        {ex.courseTitle || "Course Examination"}
                      </h2>
                      <p className="text-xs font-semibold text-muted mt-1">{ex.courseCode}</p>
                    </div>

                    {/* Timing, Venue & Seating Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-danger/50">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                          <Clock className="w-4 h-4 text-danger shrink-0" />
                          <span>{ex.examTime || "Morning Session"}</span>
                        </div>
                        {ex.reportingTime && (
                          <p className="text-[11px] text-muted pl-6">
                            Reporting:{" "}
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ex.reportingTime}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                          <Building className="w-4 h-4 text-danger shrink-0" />
                          <span>
                            Venue:{" "}
                            <strong className="text-ink font-semibold">
                              {ex.venue || "Hall Assigned"}
                            </strong>
                          </span>
                        </div>
                        {(ex.seatNo || ex.seatLocation) && (
                          <p className="text-[11px] text-muted pl-6">
                            Seat:{" "}
                            <strong className="text-ink font-semibold">No. {ex.seatNo || "—"}</strong>{" "}
                            ({ex.seatLocation || "Row"})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-danger">
                        No regular lectures on exam day
                      </span>
                      <button
                        onClick={() => {
                          setActiveTab("academics");
                          setActiveSubTab("schedule");
                        }}
                        className="text-xs font-semibold text-white bg-danger hover:bg-danger px-3.5 py-1.5 rounded-md transition-all shadow-xs cursor-pointer"
                      >
                        Hall Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : isHolidayOrOff ? (
              /* ── VIEWPORT STATE 2: HOLIDAY / NON-INSTRUCTIONAL DAY (SPACIOUS & MINIMAL) ── */
              <EmptyPanel
                tone="amber"
                icon={<Sun className="w-7 h-7" />}
                title="No classes today"
                description={`${selectedDayMeta.holidayInfo} • Non-instructional day as per the official Academic Calendar.`}
                action={
                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setActiveTab("attendance");
                        setActiveAttendanceSubTab("calendar");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-4 py-2 rounded-md transition-all cursor-pointer"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" /> View Academic Calendar
                    </button>
                  </div>
                }
              />
            ) : dayRows.length === 0 ? (
              /* ── VIEWPORT STATE 3: FREE DAY (NO CLASSES SCHEDULED) ── */
              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-line px-4 py-3.5 text-left">
                <div className="flex min-w-0 items-center gap-3">
                  <Coffee aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.7} />
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-semibold text-ink">No classes</h3>
                    <p className="text-[12.5px] text-muted">Nothing scheduled for this day.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Free Classrooms lives in Tools, so it is opened there
                    // directly rather than through an Academics value that
                    // Dashboard used to translate into a Tools section switch.
                    setActiveTab("tools");
                    setActiveToolsSubTab?.("free-class");
                  }}
                  className="shrink-0 text-[13px] font-medium text-accent hover:underline"
                >
                  Free rooms
                </button>
              </div>
            ) : (
              /* ── VIEWPORT STATE 4: REGULAR TIMETABLE CLASSES ── */
              <div className="space-y-1.5">
                {dayRows.map((row: any, index: number) => {
                  // A lab slot taken over by its Lab FAT paper renders as the
                  // collapsed exam slot, in the class's own place in the list.
                  if (row.kind === "labFat") {
                    return (
                      <LabFatExamSlot
                        key={`labfat-${row.paper.courseCode}-${row.paper.slot}`}
                        paper={row.paper}
                        time={row.time}
                        onHallDetails={() => {
                          setActiveTab("academics");
                          setActiveSubTab("schedule");
                        }}
                      />
                    );
                  }
                  const cls = row.cls;
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

                  const [startTimeStr, endTimeStr] = String(cls.time || "")
                    .split("-")
                    .map((t) => t.trim());
                  const clsTimeRange =
                    startTimeStr && endTimeStr
                      ? {
                          start: parseAttendanceTime(startTimeStr),
                          end: parseAttendanceTime(endTimeStr),
                        }
                      : undefined;
                  const taskSummary = classTaskSummary(tasks, cls, effectiveTimetableDay, clsTimeRange, {
                    dayDate: viewedDayDate,
                    // "…today" labels + the red tint are reserved for the real
                    // current date; browsing another weekday stays generic.
                    literalToday: isTodayView,
                  });
                  const showTaskBadgeInline = settings?.tasksInlineOnHome !== false || taskSummary.total > 0;
                  // Red is reserved for a test sitting in today's session; every
                  // other linked-task state gets the softer amber treatment.
                  const taskBorderClass =
                    taskSummary.today.tests > 0 && taskSummary.today.sessionTotal > 0
                      ? "border-danger/40 ring-1 ring-danger/20"
                      : taskSummary.total > 0
                        ? "border-warn/40 ring-1 ring-warn/20"
                        : "";

                  const isSelectedCourse = Boolean(
                    selectedCourseObj?.courseCode &&
                    cls.courseCode &&
                    String(cls.courseCode)
                      .replace(/\([LPT]\)$/i, "")
                      .trim()
                      .toUpperCase() ===
                      String(selectedCourseObj.courseCode)
                        .replace(/\([LPT]\)$/i, "")
                        .trim()
                        .toUpperCase(),
                  );

                  if (pillStyle === "compact") {
                    /* ── OPTION A: CALM NOTEBOOK TIMELINE (canvas "Timetable" day view) ──
                       Time in a mono column, the class as a block with its course
                       rail, a red now-line, and dashed free gaps between classes. */
                    const hm = (m: number) =>
                      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                    const startMin = clsTimeRange?.start ?? 0;
                    const endMin = clsTimeRange?.end ?? 0;
                    const prevRow = index > 0 ? dayRows[index - 1] : null;
                    const prevEnd =
                      prevRow && prevRow.kind === "class"
                        ? getAttendanceTimeRange(String(prevRow.cls?.time || "")).end
                        : null;
                    const gap = prevEnd != null && startMin > prevEnd ? startMin - prevEnd : 0;
                    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
                    const showNowBefore =
                      isTodayView && !isLive && isUpcoming && (prevEnd == null || nowMin >= prevEnd) && nowMin < startMin;
                    const pctLow = total > 0 && currentPct < targetAttendancePct;
                    const nowLine = (
                      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3" aria-hidden="true">
                        <span className="font-mono text-[11.5px] font-semibold text-danger">{hm(nowMin)}</span>
                        <span className="relative block h-[1.5px] bg-danger">
                          <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-danger" />
                        </span>
                      </div>
                    );
                    return (
                      <div key={`${cls.courseCode}-${cls.slotName}-${index}`} className="space-y-1.5">
                        {gap >= 60 && (
                          <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                            <span className="pt-2 font-mono text-[12.5px] text-muted">{hm(prevEnd as number)}</span>
                            <div className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-line px-3 py-2 text-[12.5px] text-muted">
                              <span>
                                Free · {gap >= 60 ? `${Math.floor(gap / 60)} h${gap % 60 ? ` ${gap % 60} min` : ""}` : `${gap} min`}
                              </span>
                              <button
                                type="button"
                                onClick={handleOpenFreeClassrooms}
                                className="text-accent hover:underline"
                              >
                                Free classrooms
                              </button>
                            </div>
                          </div>
                        )}
                        {showNowBefore && nowLine}
                        <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                          <span className={cn("pt-2.5 font-mono text-[12.5px]", isLive ? "font-semibold text-ink" : "text-muted")}>
                            {clsTimeRange ? hm(startMin) : cls.time}
                          </span>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCourseClick(cls.courseCode)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCourseClick(cls.courseCode);
                              }
                            }}
                            className={cn(
                              "relative overflow-hidden rounded-sm border bg-surface py-2.5 pl-3.5 pr-3 text-left transition-colors duration-[120ms] cursor-pointer hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                              isLive ? "border-accent/60" : "border-line",
                              isCompleted && "opacity-60 hover:opacity-100",
                              taskBorderClass,
                              isSelectedCourse && "lg:border-accent",
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 w-[3px]"
                              style={{ background: courseColor(String(cls.courseCode || cls.slotName || "x")) }}
                            />
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[14px] font-semibold text-ink">
                                  {cls.courseTitle || cls.courseCode}
                                </p>
                                <p className="truncate font-mono text-[12.5px] text-muted">
                                  {[cls.venue, cls.slotName, clsTimeRange ? `${hm(startMin)}–${hm(endMin)}` : cls.time]
                                    .filter(Boolean)
                                    .map((part: string, i: number) => (
                                      <span key={i}>
                                        {i > 0 && <span aria-hidden="true"> · </span>}
                                        <span>{part}</span>
                                      </span>
                                    ))}
                                </p>
                              </div>
                              {total > 0 && (
                                <span
                                  className={cn(
                                    "shrink-0 pt-0.5 font-mono text-[12.5px] tabular-nums",
                                    pctLow ? "text-danger" : "text-muted",
                                  )}
                                  title={bunkText}
                                >
                                  {Math.round(currentPct)}%
                                </span>
                              )}
                            </div>
                            {isLive && (
                              <p className="mt-1.5 text-[12px] text-accent">
                                Now · {minutesLeft} min left
                              </p>
                            )}
                            {!isLive && isUpcoming && minutesUntilStart > 0 && minutesUntilStart <= 60 && (
                              <p className="mt-1.5 text-[12px] text-muted">In {minutesUntilStart} min</p>
                            )}
                            {showTaskBadgeInline && taskSummary.total > 0 && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <TaskBadge
                                  summary={taskSummary}
                                  onClick={() => {
                                    setActiveTab("tools");
                                    setActiveToolsSubTab?.("tasks");
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {isLive && nowLine}
                      </div>
                    );
                  }

                  /* ── OPTION B: DETAILED SPACIOUS PILL (EXPANDED CARD VIEW) ── */
                  return (
                    <div
                      key={`${cls.courseCode}-${cls.slotName}-${index}`}
                      onClick={() => handleCourseClick(cls.courseCode)}
                      className={`relative overflow-hidden rounded-lg transition-all duration-300 cursor-pointer text-left border ${taskBorderClass} ${
                        isSelectedCourse ? "lg:ring-2 lg:ring-indigo-500/80 lg:border-indigo-500 shadow-sm" : ""
                      } ${
                        isLive
                          ? "bg-surface border-indigo-500 dark:border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                          : isCompleted
                            ? "bg-surface-2 border-zinc-200/50 dark:border-zinc-800 opacity-75 hover:opacity-100"
                            : "card-surface border-line shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {/* Dynamic Progress Fill Bar */}
                      {isLive && (
                        <div
                          className="absolute inset-0 bg-indigo-500/10 pointer-events-none transition-all duration-700 ease-linear"
                          style={{ width: `${progressPct}%` }}
                        />
                      )}

                      {/* Main Pill Content */}
                      <div className="relative p-5 z-10 flex flex-col justify-between gap-3">
                        {/* Top Row: Slot & Status Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                              {cls.slotName}
                            </span>

                            {isLive && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.8 rounded-md bg-ok text-white shadow-xs animate-pulse [animation-duration:2.5s]">
                                <span className="w-1.5 h-1.5 rounded-full bg-surface animate-ping [animation-duration:2.5s]" />
                                Live ({minutesLeft}m left)
                              </span>
                            )}

                            {isUpcoming && selectedDay === todayDayCode && weekOffset === 0 && (
                              <span className="text-[11px] font-semibold text-muted bg-surface-2 px-2 py-0.5 rounded-lg">
                                {minutesUntilStart <= 60 ? `In ${minutesUntilStart} mins` : `Upcoming`}
                              </span>
                            )}

                            {isCompleted && (
                              <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 bg-surface-2 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-zinc-400" /> Done
                              </span>
                            )}
                          </div>

                          {/* Course Attendance % Badge */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                              {attended}/{total}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-lg font-outfit ${
                                currentPct >= targetAttendancePct + 5
                                  ? "bg-ok-soft text-ok"
                                  : currentPct >= targetAttendancePct
                                    ? "bg-warn-soft text-warn"
                                    : "bg-danger-soft text-danger"
                              }`}
                            >
                              {currentPct.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Middle Row: Title & Course Meta */}
                        <div>
                          <h3 className="font-semibold text-base text-ink leading-snug font-outfit">
                            {cls.courseTitle}
                          </h3>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                            <span>{cls.courseCode}</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const erp = getFacultyErp(cls);
                                handleOpenFacultySchedule(erp || cls.faculty);
                              }}
                              className="inline-flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group/fac"
                              title="View faculty timetable schedule"
                            >
                              <span className="truncate group-hover/fac:underline underline-offset-2">
                                {cls.faculty || "Faculty Assigned"}
                              </span>
                              {getFacultyErp(cls) && (
                                <span className="text-[11px] font-mono px-1 py-0.2 rounded bg-surface-2 text-muted border border-zinc-200/50 dark:border-zinc-700/50">
                                  #{getFacultyErp(cls)}
                                </span>
                              )}
                            </button>
                          </p>
                        </div>

                        {/* Bottom Row: Time, Venue & Bunkable Subtext */}
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Time & Venue */}
                          <div className="flex items-center gap-3.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                            <span className="flex items-center gap-1.5 shrink-0 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              {cls.time}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {cls.slotVenue || "Room Assigned"}
                              </span>
                            </span>
                          </div>

                          {/* Bunkable Classes Subtext Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                                bunkStatus === "safe"
                                  ? "bg-ok-soft text-ok border border-ok/50"
                                  : bunkStatus === "warning"
                                    ? "bg-warn-soft text-warn border border-warn/50"
                                    : "bg-danger-soft text-danger border border-danger/50"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  bunkStatus === "safe"
                                    ? "bg-ok"
                                    : bunkStatus === "warning"
                                      ? "bg-warn"
                                      : "bg-danger"
                                }`}
                              />
                              {bunkText}
                            </span>

                            {showTaskBadgeInline && taskSummary.total > 0 && (
                              <TaskBadge
                                summary={taskSummary}
                                onClick={() => {
                                  setActiveTab("tools");
                                  setActiveToolsSubTab?.("tasks");
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Progress Bar for Ongoing Class */}
                        {isLive && (
                          <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-linear"
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

            {/* ── TODAY'S TASKS SECTION (WHEN TASKSINLINEONHOME IS FALSE) ── */}
            {settings?.tasksInlineOnHome === false &&
              (() => {
                // Chunked on this day, plus (on the real current date) tasks that are
                // only due today — otherwise a Moodle DA is invisible in this mode.
                const todayTasks = (() => {
                  const chunked = tasksForDay(effectiveTimetableDay, tasks);
                  if (!isTodayView || !viewedDayDate) return chunked;
                  const seen = new Set(chunked.map((t) => t.id));
                  const dueOnly = tasks.filter(
                    (t) => t.status !== "done" && !seen.has(t.id) && isDueOnDay(t.dueDate, viewedDayDate as Date),
                  );
                  return [...chunked, ...dueOnly];
                })();
                if (todayTasks.length === 0) return null;
                return (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-semibold text-ink font-outfit">
                          Today&apos;s Tasks &amp; Schedule
                        </h3>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-zinc-600 dark:text-zinc-300">
                          {todayTasks.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("tools");
                          setActiveToolsSubTab?.("tasks");
                        }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        View All Tasks
                      </button>
                    </div>

                    <ListShell>
                      {todayTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setActiveTab("tools");
                            setActiveToolsSubTab?.("tasks");
                          }}
                          className="p-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded border ${
                                  (KIND_CONFIG[t.kind] || KIND_CONFIG.homework).badgeClass
                                }`}
                              >
                                {(KIND_CONFIG[t.kind] || KIND_CONFIG.homework).label}
                              </span>
                              {t.courseCode && (
                                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                  {t.courseCode}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-ink truncate font-outfit">
                              {t.title}
                            </h4>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                        </div>
                      ))}
                    </ListShell>
                  </div>
                );
              })()}

            {/* ── TIMETABLE & QUICK TOOLS BUTTONS (PLACED CLEANLY AFTER ALL CLASSES) ── */}
            <nav aria-label="Shortcuts" className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
              {[
                { label: "Full weekly timetable", Icon: CalendarIcon, onClick: () => setShowTimetableModal(true) },
                { label: "Find a free classroom", Icon: DoorOpen, onClick: handleOpenFreeClassrooms },
                { label: "Find a faculty's schedule", Icon: UserSearch, onClick: handleOpenFacultySchedule },
              ].map(({ label, Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[14px] text-ink transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-ink-2" strokeWidth={1.8} />
                  <span className="flex-1">{label}</span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ── RIGHT COLUMN: DESKTOP COURSE SIDE VIEW PANE (SHOWN ON CLASS CLICK) ── */}
        {selectedCourseObj && (
          <aside className="hidden lg:block w-80 xl:w-96 shrink-0 sticky top-6 self-start animate-in fade-in duration-200">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelectedCourseCode(null)}
                className="absolute top-4 right-4 z-20 p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                title="Close side view"
                aria-label="Close side view"
              >
                <X className="w-4 h-4" />
              </button>
              <DesktopCourseDetail
                course={selectedCourseObj}
                isDayscholarWithBus={settings?.isDayscholarWithBus || false}
                decimalValues={settings?.decimalValues || false}
                dayCardsMap={timetableMap}
                results={analyzedCalendarResults}
                onViewFullPage={() => {
                  if (!selectedCourseObj?.courseCode) return;
                  const cleanCode = String(selectedCourseObj.courseCode)
                    .replace(/\([LPT]\)$/i, "")
                    .trim();
                  try {
                    localStorage.setItem("course_dashboard_target", cleanCode);
                    localStorage.setItem("course_dashboard_tab", "overview");
                  } catch {}
                  setActiveTab("academics");
                  setActiveSubTab("course-dashboard");
                }}
                className="w-full bg-surface border border-zinc-200/80 dark:border-zinc-800/80 rounded-md p-5 shadow-xs text-left"
              />
            </div>
          </aside>
        )}
      </div>

      {/* Full Timetable Sheet */}
      <AnimatePresence>
        {showTimetableModal && (
          <BottomSheet
            onClose={() => setShowTimetableModal(false)}
            overlayId="home-timetable"
            maxWidth="max-w-5xl"
            showClose={false}
          >
            <div className="flex flex-col min-h-0">
              <div className="p-4 sm:p-5 border border-line rounded-md flex items-center justify-between gap-3 bg-surface-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shrink-0">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink font-outfit truncate">
                      Full Weekly Timetable
                    </h2>
                    <p className="text-xs text-muted truncate">
                      Slot matrix, timeslots & classroom venues
                    </p>
                  </div>
                </div>
                {/*
                The sheet's own floating X is off (`showClose={false}`) so the
                close affordance lives in this box, next to the thing it closes.
                "Free Classrooms" and "Attendance" are reachable from the home
                screen, and links inside a dismissible overlay that only swap the
                surface out from under it are a trap to tap by accident.
              */}
                <IconButton onClick={() => setShowTimetableModal(false)} title="Close timetable">
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
              <div className="p-4 sm:p-5">
                <TimetableGrid attendance={attendanceData?.attendance || []} />
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
