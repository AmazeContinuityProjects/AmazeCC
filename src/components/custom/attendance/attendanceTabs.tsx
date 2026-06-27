import { useState, useEffect, useMemo } from "react";
import CourseCard from "./courseCard";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import PopupCard from "./PopupCard";
import config from '../../../../config.json';
import NoContentFound from "../NoContentFound";
import OverallAttendancePredictor from "./overallAttendancePredictor";
import { BadgeQuestionMark, Calendar, Users, ChevronDown, Clock, MapPin, User } from "lucide-react";
import TimetableGrid from "./TimetableGrid";
import { getFriends, Friend } from "../../../lib/socialUtils";
import CommonFreeSlotsModal from "../social/CommonFreeSlotsModal";
import AttendanceSubpage from "./AttendanceSubpage";
import ODTrackerSubpage from "./ODTrackerSubpage";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import Modal from "../shared/Modal";
import Badge from "../shared/Badge";
import PageHeader from "../shared/PageHeader";

const DesktopCourseDetail = dynamic(() => import("./DesktopCourseDetail"), {
  loading: () => (
    <div className="space-y-4 p-4 animate-in fade-in zoom-in-95 duration-200">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
    </div>
  )
});
export default function AttendanceTabs({ data, activeDay, setActiveDay, calendars, decimalValues, isDayscholarWithBus, setIsSubpageOpen, ODhoursData, ODhoursIsOpen, setODhoursIsOpen }) {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showPredictor, setShowPredictor] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showCommonFree, setShowCommonFree] = useState(false);
  const [dashboardFriends, setDashboardFriends] = useState<Friend[]>([]);
  const slotMap = config.slotMap as any;
  const [desktopSelectedIdx, setDesktopSelectedIdx] = useState(0);
  const [expandedScheduleIdx, setExpandedScheduleIdx] = useState<number | null>(null);
  const [simulatedSkips, setSimulatedSkips] = useState<Record<string, number>>({});

  const getOngoingIndex = (dayClasses) => {
    if (!dayClasses || dayClasses.length === 0) return 0;
    const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    if (!today.startsWith(activeDay.slice(0, 3).toUpperCase())) return 0;

    const now = new Date();
    const parseTime = (str) => {
      const [hour, minute] = str.split(":").map(Number);
      const d = new Date();
      let h = hour;
      let m = minute || 0;
      if (h < 8) h += 12;
      d.setHours(h, m, 0, 0);
      return d;
    };

    const idx = dayClasses.findIndex((a) => {
      if (!a.time) return false;
      const [startStr, endStr] = a.time.split("-").map(t => t.trim());
      if (!startStr || !endStr) return false;
      const start = parseTime(startStr);
      const end = parseTime(endStr);
      return now >= start && now <= end;
    });

    return idx !== -1 ? idx : 0;
  };

  const getClassStatus = (timeStr: string) => {
    if (!timeStr || !activeDay) return "upcoming";

    const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    if (!today.startsWith(activeDay.slice(0, 3).toUpperCase())) return "upcoming";

    const [startStr, endStr] = timeStr.split("-").map(t => t.trim());
    if (!startStr || !endStr) return "upcoming";

    const parseTime = (str) => {
      const [hour, minute] = str.split(":").map(Number);
      const d = new Date();
      let h = hour;
      let m = minute || 0;
      if (h < 8) h += 12;
      d.setHours(h, m, 0, 0);
      return d;
    };

    const start = parseTime(startStr);
    const end = parseTime(endStr);
    const now = new Date();

    if (now >= start && now <= end) return "ongoing";
    if (now > end) return "completed";
    return "upcoming";
  };


  useEffect(() => {
    if (setIsSubpageOpen) {
      setIsSubpageOpen(expandedIdx !== null || showPredictor || showTimetable || showCommonFree || ODhoursIsOpen);
    }
  }, [expandedIdx, showPredictor, showTimetable, showCommonFree, ODhoursIsOpen, setIsSubpageOpen]);

  useEffect(() => {
    // Load friends meant for dashboard
    const allFriends = getFriends();
    setDashboardFriends(allFriends.filter(f => f.showInHomePage));
  }, []);

  const dayCardsMap = {};
  days.forEach((day) => (dayCardsMap[day] = []));

  data.attendance.forEach((a) => {
    const slots = a.slotName.split("+");
    slots.forEach((slotName) => {
      const cleanSlot = slotName.trim();
      for (const day of days) {
        if (slotMap[day] && slotMap[day][cleanSlot]) {
          const info = slotMap[day][cleanSlot];
          const pct = parseInt(a.attendancePercentage);
          const cleanCourseCode = a.courseCode;
          const cls = pct < 50 ? "low" : pct < 75 ? "medium" : "high";
          dayCardsMap[day].push({
            ...a,
            courseCode: cleanCourseCode,
            slotName: cleanSlot,
            time: info.time,
            cls,
          });
        }
      }
    });
  });

  function parseTime(timeStr) {
    let [h, m] = timeStr.trim().split(":").map(Number);
    if (h < 8) h += 12;
    return h * 60 + m;
  }

  function getTimeRange(time) {
    const [start, end] = time.split("-").map((t) => t.trim());
    return {
      start: parseTime(start),
      end: parseTime(end),
    };
  }

  for (const day of days) {
    if (!dayCardsMap[day]) dayCardsMap[day] = [];

    dayCardsMap[day].sort((a, b) => {
      const timeA = getTimeRange(a.time);
      const timeB = getTimeRange(b.time);
      if (timeA.start !== timeB.start) return timeA.start - timeB.start;
      return a.slotName.localeCompare(b.slotName, undefined, { numeric: true });
    });

    const merged = [];
    for (let i = 0; i < dayCardsMap[day].length; i++) {
      const current = dayCardsMap[day][i];
      const next = dayCardsMap[day][i + 1];

      if (
        next &&
        current.courseTitle === next.courseTitle &&
        current.courseType === next.courseType &&
        current.faculty === next.faculty &&
        current.cls === next.cls
      ) {
        const currentRange = getTimeRange(current.time);
        const nextRange = getTimeRange(next.time);
        const gapInMinutes = nextRange.start - currentRange.end;

        if (gapInMinutes >= 0 && gapInMinutes <= 5) {
          const mergedSlotName = `${current.slotName}+${next.slotName}`;
          const mergedSlotTime = `${current.time.split("-")[0]}-${next.time.split("-")[1]}`;
          merged.push({
            ...current,
            slotName: mergedSlotName,
            time: mergedSlotTime,
          });
          i++;
        } else {
          merged.push(current);
        }
      } else {
        merged.push(current);
      }
    }

    merged.sort((a, b) => {
      const startA = parseTime(a.time.split("-")[0]);
      const startB = parseTime(b.time.split("-")[0]);
      return startA - startB;
    });

    dayCardsMap[day] = merged.length > 0 ? merged : [];
  }

  const daysWithClasses = days.filter((d) => dayCardsMap[d].length > 0);
  const { results, importantEvents } = analyzeAllCalendars(calendars);

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth =
    today.toLocaleString("default", { month: "long" }).toUpperCase() +
    " " +
    today.getFullYear();

  const monthData = results.find(
    (m) => m.month === todayMonth && m.year === today.getFullYear()
  );

  let isHoliday = false;
  if (monthData) {
    const todayInfo = monthData.days.find((d) => d.date === todayDate);
    if (todayInfo && todayInfo.type === "holiday") {
      isHoliday = true;
    }
  }

  // Compute weekly dates relative to today
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayDiff);

    const weekDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    return weekDays.map((dayName, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      return {
        dayName,
        dateObj: d,
        formattedDate: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }).toUpperCase(),
        isToday: d.toDateString() === today.toDateString(),
      };
    });
  };

  const getDayDetails = (d: Date, dayName: string) => {
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    const monthStr = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const dateNum = d.getDate();

    const monthData = results.find(
      (m) => m.month?.toString().toLowerCase().includes(monthStr) && m.year === year
    );

    let isHoliday = false;
    let eventName = "";
    if (monthData) {
      const dayInfo = monthData.days.find((day) => day.date === dateNum);
      if (dayInfo) {
        if (dayInfo.type === "holiday") {
          isHoliday = true;
          eventName = dayInfo.events?.[0]?.text || "Holiday";
        } else if (dayInfo.events && dayInfo.events.length > 0) {
          const hasHolidayEvent = dayInfo.events.some(ev =>
            ev.type?.toLowerCase().includes("holiday") ||
            /holiday|no instructional/i.test(ev.text)
          );
          if (hasHolidayEvent) {
            isHoliday = true;
            eventName = dayInfo.events.find(ev => /holiday/i.test(ev.text))?.text || dayInfo.events[0].text;
          }
        }
      }
    }

    const isWeekend = dayName === "SAT" || dayName === "SUN";
    const classes = dayCardsMap[dayName] || [];

    let status = "working";
    if (isHoliday) status = "holiday";
    else if (isWeekend && classes.length === 0) status = "weekend";
    else if (classes.length === 0) status = "no-classes";

    return {
      isHoliday,
      isWeekend,
      eventName,
      classesCount: classes.length,
      status
    };
  };

  const weekDaysInfo = getWeekDates();
  const activeDayInfo = weekDaysInfo.find(w => w.dayName === activeDay);
  const activeDate = activeDayInfo?.dateObj || new Date();

  useEffect(() => {
    if (!activeDay || !days.includes(activeDay)) {
      const todayShort = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      setActiveDay(days.includes(todayShort) ? todayShort : "MON");
    }
  }, [activeDay]);

  useEffect(() => {
    const dayClasses = dayCardsMap[activeDay] || [];
    setDesktopSelectedIdx(getOngoingIndex(dayClasses));
    setExpandedScheduleIdx(null);
  }, [activeDay]);

  const findEventDate = (eventName) => {
    const ev = [...importantEvents.values()].find(
      (e) => e.event.toLowerCase() === eventName.toLowerCase()
    );
    if (!ev) return null;
    return ev.formattedDate;
  };
  const impDates = {
    cat1Date: findEventDate("CAT I"),
    cat2Date: findEventDate("CAT II"),
    lidLabDate: findEventDate("lid for laboratory classes"),
    lidTheoryDate: findEventDate("LID FOR THEORY CLASSES"),
    midsemStart: findEventDate("Mid Term Test"),
  };

  const overallSimStats = useMemo(() => {
    let totalAttended = 0;
    let totalClasses = 0;
    let hasSimulation = false;

    if (data && Array.isArray(data.attendance)) {
      data.attendance.forEach(c => {
        if (c.slotName === "NILL") return;
        const skips = simulatedSkips[c.courseCode] || 0;
        if (skips > 0) hasSimulation = true;

        const isLab = c.courseCode.endsWith("(L)");
        const CLASS_WEIGHT = isLab ? 2 : 1;

        totalAttended += parseInt(c.attendedClasses) * CLASS_WEIGHT;
        totalClasses += (parseInt(c.totalClasses) + skips) * CLASS_WEIGHT;
      });
    }

    const origAttended = data?.attendance?.reduce((sum, c) => {
      const isLab = c.courseCode.endsWith("(L)");
      const CLASS_WEIGHT = isLab ? 2 : 1;
      return sum + (parseInt(c.attendedClasses) * CLASS_WEIGHT);
    }, 0) || 0;

    const origTotal = data?.attendance?.reduce((sum, c) => {
      const isLab = c.courseCode.endsWith("(L)");
      const CLASS_WEIGHT = isLab ? 2 : 1;
      return sum + (parseInt(c.totalClasses) * CLASS_WEIGHT);
    }, 0) || 0;

    const originalAvg = origTotal > 0 ? (origAttended / origTotal) * 100 : 0;
    const simAvg = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

    return {
      originalAvg: parseFloat(originalAvg.toFixed(1)),
      simAvg: parseFloat(simAvg.toFixed(1)),
      hasSimulation
    };
  }, [simulatedSkips, data]);

  const dayHasCriticalCourse = (dayName: string) => {
    const courses = dayCardsMap[dayName] || [];
    const threshold = isDayscholarWithBus ? 85 : 75;
    return courses.some(c => {
      const skips = simulatedSkips[c.courseCode] || 0;
      const attended = parseInt(c.attendedClasses);
      const total = parseInt(c.totalClasses) + skips;
      const pct = total > 0 ? (attended / total) * 100 : parseFloat(c.attendancePercentage);
      return pct < threshold;
    });
  };

  const activeDayClasses = dayCardsMap[activeDay] || [];
  const nextUpcomingIdx = activeDayClasses.findIndex((course) => getClassStatus(course.time) === "upcoming");

  if (!data || !data.attendance || data.attendance.length === 0) return <NoContentFound />;

  if (expandedIdx !== null && dayCardsMap[activeDay]?.[expandedIdx]) {
    return (
      <AttendanceSubpage
        a={dayCardsMap[activeDay][expandedIdx]}
        onBack={() => setExpandedIdx(null)}
        dayCardsMap={dayCardsMap}
        analyzeCalendars={results}
        impDates={impDates}
        decimalValues={decimalValues}
        isDayscholarWithBus={isDayscholarWithBus}
      />
    );
  }

  if (ODhoursIsOpen) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 md:-mx-4">
        <ODTrackerSubpage
          ODhoursData={ODhoursData}
          attendanceData={data.attendance}
          analyzeCalendars={results}
          onBack={() => setODhoursIsOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        icon={<Calendar className="w-5.5 h-5.5 text-blue-605 dark:text-blue-400" />}
        title="Weekly attendance"
        meta={overallSimStats.hasSimulation && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100/85 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-gray-200/60 dark:border-gray-700/60">
              Simulated: <span className={overallSimStats.simAvg >= (isDayscholarWithBus ? 85 : 75) ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>{overallSimStats.simAvg}%</span>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">(Original: {overallSimStats.originalAvg}%)</span>
            </span>
        )}
        actions={
          <>
            {dashboardFriends.length > 0 && (
            <button onClick={() => setShowCommonFree(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 font-extrabold text-[11px] uppercase tracking-wider transition-colors cursor-pointer">
              <Users className="w-4 h-4" /> <span className="hidden md:inline">Free Time</span>
            </button>
            )}
            <button onClick={() => setShowTimetable(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors shadow-sm text-[11px] uppercase tracking-wider cursor-pointer">
              <Calendar className="w-4 h-4" /> <span>Timetable</span>
            </button>
            <button onClick={() => setShowPredictor(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors shadow-sm text-[11px] uppercase tracking-wider cursor-pointer">
              <BadgeQuestionMark className="w-4 h-4" /> <span>Predictor</span>
            </button>
          </>
        }
      />

      {/* Rich Weekday Selector */}
      <div className="mb-6 w-full overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
        {(() => {
          const isAnyDaySelected = weekDaysInfo.some((info) => activeDay === info.dayName);

          return (
            <div
              className={`flex min-w-[595px] sm:min-w-0 h-[115px] rounded-2xl border overflow-hidden bg-white  dark:bg-black transition-all duration-300 ${
                isAnyDaySelected
                  ? "border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/15 shadow-md"
                  : "border-gray-250 dark:border-gray-850 shadow-sm"
              } hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-[0_0_12px_rgba(59,130,246,0.2)] dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.3)]`}
            >
              {weekDaysInfo.map((info, idx) => {
                const details = getDayDetails(info.dateObj, info.dayName);
                const isSelected = activeDay === info.dayName;
                const dayNum = info.dateObj.getDate();
                const monthName = info.dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

                const dayStyle = isSelected
                  ? "text-blue-105 font-bold"
                  : info.isToday
                    ? "text-blue-600 dark:text-blue-400 font-black"
                    : "text-gray-400 dark:text-gray-500 font-semibold";
                const numStyle = isSelected ? "text-white font-black" : "text-gray-900 dark:text-gray-100 font-black";
                const monthStyle = isSelected ? "text-blue-200 font-semibold" : "text-gray-450 dark:text-gray-500 font-semibold";

                let badgeLabel = "Free Day";
                let badgeClass = isSelected
                  ? "bg-white/20 border-white/20 text-white"
                  : "bg-gray-50 dark:bg-slate-800 text-gray-455 dark:text-gray-500 border-gray-100 dark:border-slate-700/50";

                if (details.isHoliday) {
                  badgeLabel = "Holiday";
                  badgeClass = isSelected
                    ? "bg-white/20 border-white/20 text-white"
                    : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30";
                } else if (details.isWeekend) {
                  badgeLabel = "Weekend";
                  badgeClass = isSelected
                    ? "bg-white/20 border-white/20 text-white"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-455 border-gray-100 dark:border-slate-700/50";
                } else if (details.classesCount > 0) {
                  badgeLabel = `${details.classesCount} Class${details.classesCount > 1 ? "es" : ""}`;
                  badgeClass = isSelected
                    ? "bg-white/30 border-white/20 text-white shadow-xs"
                    : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30";
                }

                const todayBorder = info.isToday && !isSelected ? "border-t-[3px] border-t-blue-550 dark:border-t-blue-500" : "";
                const isNextSelected = (idx < weekDaysInfo.length - 1) && (activeDay === weekDaysInfo[idx + 1].dayName);
                const dividerClass = (isSelected || isNextSelected || idx === weekDaysInfo.length - 1)
                  ? "border-r border-transparent"
                  : "border-r border-gray-205  dark:border-gray-800/80";

                return (
                  <button
                    key={info.dayName}
                    onClick={() => setActiveDay(info.dayName)}
                    className={`w-1/7 flex-1 h-full flex flex-col items-center justify-between p-2.5 text-center transition-all duration-300 cursor-pointer select-none focus:outline-none ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-50/50 dark:hover:bg-slate-800/30 hover:text-blue-500 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300"
                    } ${todayBorder} ${dividerClass}`}
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className={`text-[9px] tracking-wider uppercase flex items-center justify-center gap-1 ${dayStyle}`}>
                        {info.dayName}
                        {info.isToday && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                        {!details.isHoliday && !details.isWeekend && dayHasCriticalCourse(info.dayName) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-550 animate-pulse" title="Critical attendance subject today" />
                        )}
                      </span>

                      <div className="flex flex-col items-center mt-1">
                        <span className={`text-xl sm:text-2xl leading-none ${numStyle}`}>{dayNum}</span>
                        <span className={`text-[8px] tracking-widest mt-0.5 ${monthStyle}`}>{monthName}</span>
                      </div>
                    </div>
                    <div className="w-full flex justify-center mt-1.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Mobile View: Grid of cards */}
      <div className="grid grid-cols-1 md:hidden gap-6 px-1">
        {dayCardsMap[activeDay]?.map((a, idx) => (
          <div key={idx} className="stagger-enter">
            <CourseCard
              a={a}
              onClick={() => setExpandedIdx(idx)}
              activeDay={activeDay}
              isHoliday={isHoliday}
              decimalValues={decimalValues}
              isDayscholarWithBus={isDayscholarWithBus}
              simulatedSkips={simulatedSkips[a.courseCode] || 0}
              onSimulateSkipsChange={(val) => {
                setSimulatedSkips(prev => ({
                  ...prev,
                  [a.courseCode]: Math.max(0, val)
                }));
              }}
            />
          </div>
        ))}
      </div>

      {/* Desktop and Mobile Timetable Timeline Layout */}
      {dayCardsMap[activeDay] && dayCardsMap[activeDay].length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 p-0 items-start">
          {/* Left Column: Timeline Schedule */}
          <div className="hidden md:block space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Today's Schedule</h3>
            <div className="relative pl-8 space-y-4">
              {/* Vertical timeline line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-gray-200  dark:bg-gray-800/80" />

              {activeDayClasses.map((a, idx) => {
                const status = getClassStatus(a.time);
                const isExpanded = idx === expandedScheduleIdx;
                const isCurrent = status === "ongoing";
                const isNext = status === "upcoming" && idx === nextUpcomingIdx;

                // Color mapping for status dot
                let dotColorClass = "bg-gray-300 border-gray-400 dark:bg-gray-700 dark:border-gray-600";
                let pulseEffect = null;
                if (isCurrent) {
                  dotColorClass = "bg-amber-500 border-amber-300 dark:bg-amber-500 dark:border-amber-400";
                  pulseEffect = <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />;
                } else if (status === "completed") {
                  dotColorClass = "bg-emerald-500 border-emerald-300 dark:bg-emerald-500 dark:border-emerald-400";
                } else if (isNext) {
                  dotColorClass = "bg-blue-500 border-blue-300 dark:bg-blue-500 dark:border-blue-400";
                }

                const courseSkips = simulatedSkips[a.courseCode] || 0;
                const originalPercentage = parseFloat(a.attendancePercentage);
                const attendedClassesCount = parseInt(a.attendedClasses);
                const totalClassesCount = parseInt(a.totalClasses) + courseSkips;
                const simulatedPercentage = totalClassesCount > 0
                  ? parseFloat(((attendedClassesCount / totalClassesCount) * 100).toFixed(1))
                  : originalPercentage;

                const thresholdPct = isDayscholarWithBus ? 85 : 75;
                const isBelowThreshold = simulatedPercentage < thresholdPct;

                let cardStyle = "bg-white  dark:bg-[#0a0a0a] border-gray-200  dark:border-gray-800/60";
                if (isCurrent) {
                  cardStyle = "bg-amber-50/40  dark:bg-amber-950/10 border-amber-500/60 ring-1 ring-amber-500/20";
                } else if (isNext) {
                  cardStyle = "bg-blue-50/35  dark:bg-blue-950/10 border-blue-500/45";
                } else if (isExpanded) {
                  cardStyle = "bg-gray-50/70  dark:bg-gray-950 border-gray-300  dark:border-gray-700";
                } else if (courseSkips > 0 && isBelowThreshold) {
                  cardStyle = "bg-red-50/5  dark:bg-red-950/5 border-red-500 dark:border-red-500/80";
                }

                // Muted state for completed classes
                let textOpacity = "opacity-100";
                if (status === "completed" && !isExpanded) {
                  textOpacity = "opacity-70";
                }

                const attendanceVariant = simulatedPercentage < thresholdPct
                  ? "danger"
                  : simulatedPercentage < (isDayscholarWithBus ? 90 : 85)
                    ? "warning"
                    : "success";

                return (
                  <div
                    key={idx}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      setDesktopSelectedIdx(idx);
                      setExpandedScheduleIdx((current) => current === idx ? null : idx);
                    }}
                  >
                    {/* Timeline Dot */}
                    <div className="absolute left-[-29px] top-4 z-10 flex h-6 w-6 items-center justify-center">
                      <div className="relative flex h-3 w-3 items-center justify-center">
                        {pulseEffect}
                        <span className={`relative inline-flex h-3 w-3 rounded-full border-2 ${dotColorClass}`} />
                      </div>
                    </div>

                    {/* Timeline Card */}
                    <div className={`stagger-enter rounded-2xl border transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:shadow-sm ${cardStyle} ${textOpacity}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-blue-600  dark:text-blue-400 uppercase tracking-wider">
                                {a.courseCode}
                              </span>
                              {isCurrent && (
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                                  Current
                                </span>
                              )}
                              {isNext && !isCurrent && (
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">
                                  Next
                                </span>
                              )}
                            </div>
                            <h4 className="mt-1 text-sm font-bold text-gray-900  dark:text-gray-100 leading-snug truncate">
                              {a.courseTitle}
                            </h4>
                            <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 font-semibold">
                              <span className="flex items-center gap-2 min-w-0">
                                <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                                <span>{a.time}</span>
                              </span>
                              <span className="flex items-center gap-2 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                                <span className="truncate">{a.slotVenue}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant={attendanceVariant} className="font-extrabold text-xs">
                              {simulatedPercentage}%
                            </Badge>
                            <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-linear ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="overflow-hidden">
                            <div className="mt-4 border-t border-gray-200  dark:border-gray-800 pt-4 space-y-3">
                              {a.faculty && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600  dark:text-gray-300">
                                  <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                  <span className="truncate">{a.faculty}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-800 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {a.slotName}
                                </span>
                                <span className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-800 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {a.courseType || (a.courseCode.endsWith("(L)") ? "Lab" : "Theory")}
                                </span>
                                {courseSkips > 0 && (
                                  <span className="inline-flex items-center rounded-xl border border-red-200 dark:border-red-900/40 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                    Simulated {originalPercentage}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Premium Desktop Course Details Preview */}
          <div className="hidden md:block bg-white  dark:bg-[#080808] border border-gray-200  dark:border-gray-800/80 rounded-2xl p-6 shadow-sm">
            {dayCardsMap[activeDay][desktopSelectedIdx] ? (
              <DesktopCourseDetail
                a={dayCardsMap[activeDay][desktopSelectedIdx]}
                isDayscholarWithBus={isDayscholarWithBus}
                decimalValues={decimalValues}
                results={results}
                dayCardsMap={dayCardsMap}
                impDates={impDates}
                onViewFullPage={() => setExpandedIdx(desktopSelectedIdx)}
                simulatedSkips={simulatedSkips[dayCardsMap[activeDay][desktopSelectedIdx].courseCode] || 0}
                onSimulateSkipsChange={(val) => {
                  setSimulatedSkips(prev => ({
                    ...prev,
                    [dayCardsMap[activeDay][desktopSelectedIdx].courseCode]: Math.max(0, val)
                  }));
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-20">
                <p>Select a class on the timeline to view details.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty / Holiday / Weekend state */
        (() => {
          const details = getDayDetails(activeDate, activeDay);
          let title = "No Classes Scheduled";
          let desc = "Enjoy your day off! Take some rest or work on your personal projects.";
          let icon = "🎉";

          if (details.isHoliday) {
            title = details.eventName || "Academic Holiday";
            desc = "The university is closed today for academic holidays. Enjoy the break!";
            icon = "🌴";
          } else if (details.isWeekend) {
            title = "Weekend Mode";
            desc = "It's the weekend! Time to relax, recharge, and get ready for the coming week.";
            icon = "🏖️";
          }

          return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm max-w-md mx-auto py-12 animate-in fade-in zoom-in-95 duration-200">
              <span className="text-5xl mb-4 select-none" role="img" aria-label="day icon">{icon}</span>
              <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 mb-2">{title}</h3>
              <p className="text-sm text-gray-500  dark:text-gray-400 max-w-xs">{desc}</p>
            </div>
          );
        })()
      )}

      {showPredictor && (
        <Modal onClose={() => setShowPredictor(false)} maxWidth="max-w-4xl" className="max-h-[95vh] overflow-y-auto">
            <OverallAttendancePredictor
              attendanceData={data.attendance}
              analyzeCalendars={results}
              dayCardsMap={dayCardsMap}
              impDates={impDates}
              isDayscholarWithBus={isDayscholarWithBus}
            />
        </Modal>
      )}
      {showTimetable && (
        <Modal onClose={() => setShowTimetable(false)} maxWidth="max-w-6xl" className="max-h-[95vh] overflow-y-auto">
            <TimetableGrid attendance={data.attendance} />
        </Modal>
      )}
      {showCommonFree && (
        <CommonFreeSlotsModal
          friends={dashboardFriends}
          myAttendance={data.attendance}
          groupName="Dashboard Friends"
          onClose={() => setShowCommonFree(false)}
        />
      )}
    </div>
  );
}
