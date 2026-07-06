import { useState, useEffect, useMemo } from "react";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import NoContentFound from "../NoContentFound";
import OverallAttendancePredictor from "./overallAttendancePredictor";
import { BadgeQuestionMark, Calendar, Users } from "lucide-react";
import TimetableGrid from "./TimetableGrid";
import DailyPlanner from "./DailyPlanner";
import { getFriends, Friend } from "../../../lib/socialUtils";
import CommonFreeSlotsModal from "../social/CommonFreeSlotsModal";
import AttendanceSubpage from "./AttendanceSubpage";
import dynamic from "next/dynamic";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import Modal from "../shared/Modal";
import PageHeader from "../shared/PageHeader";
import { useIsMobile } from "../shared";
import { ATTENDANCE_DAYS, buildAttendanceDayCardsMap } from "@/lib/attendanceTimetable";

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
export default function AttendanceTabs({ data, activeDay, setActiveDay, calendars, decimalValues, isDayscholarWithBus, setIsSubpageOpen, ODhoursData, ODhoursIsOpen, setODhoursIsOpen, setActiveTab, setActiveSubTab }: any) {
  const isMobile = useIsMobile();
  const days = [...ATTENDANCE_DAYS];
  const [showPredictor, setShowPredictor] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showCommonFree, setShowCommonFree] = useState(false);
  const [dashboardFriends, setDashboardFriends] = useState<Friend[]>([]);
  const [desktopSelectedIdx, setDesktopSelectedIdx] = useState(0);
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

  useEffect(() => {
    if (setIsSubpageOpen) {
      setIsSubpageOpen(showPredictor || showTimetable || showCommonFree || ODhoursIsOpen);
    }
  }, [showPredictor, showTimetable, showCommonFree, ODhoursIsOpen, setIsSubpageOpen]);

  useEffect(() => {
    // Load friends meant for dashboard
    const allFriends = getFriends();
    setDashboardFriends(allFriends.filter(f => f.showInHomePage));
  }, []);

  const dayCardsMap = buildAttendanceDayCardsMap(data?.attendance || []);

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
    if (!activeDay || !(days as readonly string[]).includes(activeDay)) {
      const todayShort = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      setActiveDay((days as readonly string[]).includes(todayShort) ? todayShort : "MON");
    }
  }, [activeDay]);

  useEffect(() => {
    const dayClasses = dayCardsMap[activeDay] || [];
    setDesktopSelectedIdx(getOngoingIndex(dayClasses));
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

  if (!data || !data.attendance || data.attendance.length === 0) return <NoContentFound />;

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
      <div className={`mb-6 w-full ${isMobile ? "" : "overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none"}`}>
        {(() => {
          const isAnyDaySelected = weekDaysInfo.some((info) => activeDay === info.dayName);

          return (
            <div
              className={`flex w-full min-w-0 ${isMobile ? "h-[102px] rounded-xl" : "min-w-[595px] sm:min-w-0 h-[115px] rounded-2xl"} border overflow-hidden bg-white  dark:bg-black transition-all duration-300 ${
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

                let mobileBadgeLabel = badgeLabel;
                if (badgeLabel === "Free Day") mobileBadgeLabel = "Free";
                else if (badgeLabel === "Weekend") mobileBadgeLabel = "Weekend";
                else if (badgeLabel === "Holiday") mobileBadgeLabel = "Hldy";
                else if (badgeLabel.includes("Class")) {
                  mobileBadgeLabel = `${details.classesCount} Cls`;
                }

                const todayBorder = info.isToday && !isSelected ? (isMobile ? "border-t-2 border-t-blue-500" : "border-t-[3px] border-t-blue-550 dark:border-t-blue-500") : "";
                const isNextSelected = (idx < weekDaysInfo.length - 1) && (activeDay === weekDaysInfo[idx + 1].dayName);
                const dividerClass = (isSelected || isNextSelected || idx === weekDaysInfo.length - 1)
                  ? "border-r border-transparent"
                  : "border-r border-gray-205  dark:border-gray-800/80";

                return (
                  <button
                    key={info.dayName}
                    onClick={() => setActiveDay(info.dayName)}
                    className={`w-1/7 flex-1 h-full flex flex-col items-center justify-between ${isMobile ? "py-2 px-0.5" : "p-2.5"} text-center transition-all duration-300 cursor-pointer select-none focus:outline-none ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-50/50 dark:hover:bg-slate-800/30 hover:text-blue-500 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300"
                    } ${todayBorder} ${dividerClass}`}
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className={`${isMobile ? "text-[8px]" : "text-[9px]"} tracking-wider uppercase flex items-center justify-center gap-1 ${dayStyle}`}>
                        {isMobile ? info.dayName.slice(0, 3) : info.dayName}
                        {info.isToday && !isSelected && <span className="w-1 h-1 rounded-full bg-blue-605 dark:bg-blue-400" />}
                        {!details.isHoliday && !details.isWeekend && dayHasCriticalCourse(info.dayName) && (
                          <span className="w-1 h-1 rounded-full bg-red-550 animate-pulse" title="Critical attendance subject today" />
                        )}
                      </span>

                      <div className="flex flex-col items-center mt-0.5 sm:mt-1">
                        <span className={`${isMobile ? "text-base" : "text-xl sm:text-2xl"} leading-none ${numStyle}`}>{dayNum}</span>
                        <span className={`${isMobile ? "text-[6px]" : "text-[8px]"} tracking-widest mt-0.5 ${monthStyle}`}>{monthName}</span>
                      </div>
                    </div>
                    <div className="w-full flex justify-center mt-1 sm:mt-1.5 px-0.5">
                      <span className={`${isMobile ? "flex min-h-[20px] w-full max-w-[44px] items-center justify-center text-[7.5px] leading-none" : "text-[9px]"} font-semibold px-1 sm:px-1.5 py-0.5 rounded border ${badgeClass}`}>
                        {isMobile ? mobileBadgeLabel : badgeLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Daily Planner Timeline — replaces old mobile cards + desktop timeline */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-8 p-0 items-start">
        <div>
          <DailyPlanner
            attendance={data.attendance}
            activeDay={activeDay}
            simulatedSkips={simulatedSkips}
            isDayscholarWithBus={isDayscholarWithBus}
            onClassClick={(item) => {
              const idx = activeDayClasses.findIndex(c => 
                c.courseCode === item.course.courseCode &&
                c.slotName.split("+").some(slot => item.slots.includes(slot))
              );
              if (idx !== -1) {
                setDesktopSelectedIdx(idx);
                if (isMobile) {
                  localStorage.setItem("course_dashboard_target", item.course.courseCode);
                  localStorage.setItem("course_dashboard_tab", "attendance");
                  if (setActiveTab) setActiveTab("Academics");
                  if (setActiveSubTab) setActiveSubTab("course-dashboard");
                  if (setIsSubpageOpen) setIsSubpageOpen(true);
                }
              }
            }}
          />
        </div>

        {/* Right Column: Premium Desktop Course Details Preview */}
        <div className="hidden md:block bg-white  dark:bg-[#080808] border border-gray-200  dark:border-gray-800/80 rounded-2xl p-6 shadow-sm sticky top-4">
          {dayCardsMap[activeDay] && dayCardsMap[activeDay][desktopSelectedIdx] ? (
            <DesktopCourseDetail
              a={dayCardsMap[activeDay][desktopSelectedIdx]}
              isDayscholarWithBus={isDayscholarWithBus}
              decimalValues={decimalValues}
              results={results}
              dayCardsMap={dayCardsMap}
              impDates={impDates}
              onViewFullPage={() => {
                const courseCode = dayCardsMap[activeDay][desktopSelectedIdx].courseCode;
                localStorage.setItem("course_dashboard_target", courseCode);
                localStorage.setItem("course_dashboard_tab", "attendance");
                if (setActiveTab) setActiveTab("Academics");
                if (setActiveSubTab) setActiveSubTab("course-dashboard");
                if (setIsSubpageOpen) setIsSubpageOpen(true);
              }}
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
