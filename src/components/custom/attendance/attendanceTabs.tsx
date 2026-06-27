import { useState, useEffect } from "react";
import CourseCard from "./courseCard";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import PopupCard from "./PopupCard";
import config from '../../../../config.json';
import NoContentFound from "../NoContentFound";
import OverallAttendancePredictor from "./overallAttendancePredictor";
import { X, BadgeQuestionMark, Calendar, Users, ClipboardList, Building2 } from "lucide-react";
import TimetableGrid from "./TimetableGrid";
import { getFriends, Friend } from "../../../lib/socialUtils";
import CommonFreeSlotsModal from "../social/CommonFreeSlotsModal";
import AttendanceSubpage from "./AttendanceSubpage";
import ODTrackerSubpage from "./ODTrackerSubpage";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import Modal from "../shared/Modal";
import Badge from "../shared/Badge";

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

  useEffect(() => {
    if (!daysWithClasses.includes(activeDay)) {
      setActiveDay(daysWithClasses[0] || null);
    }
  }, [daysWithClasses]);

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

  if (daysWithClasses.length === 0) return <NoContentFound />;

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
    <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        {/* Mobile View: Inline Center */}
        <h1 className="md:hidden text-xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          <button onClick={() => setShowTimetable(true)} className="inline-flex mr-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors align-middle">
            <Calendar className={`w-4 h-4`} />
          </button>
          Weekly Attendance
          <button onClick={() => setShowPredictor(true)} className="inline-flex ml-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors align-middle">
            <BadgeQuestionMark className={`w-4 h-4`} />
          </button>

          {dashboardFriends.length > 0 && (
            <button onClick={() => setShowCommonFree(true)} className="inline-flex ml-2 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 border border-green-500/20 font-medium transition-colors align-middle">
              <Users className={`w-4 h-4`} />
            </button>
          )}
        </h1>

        {/* Desktop View: Left Aligned Heading + Right Aligned Buttons */}
        <h1 className="hidden md:block text-3xl font-bold text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Weekly Attendance
        </h1>
        <div className="hidden md:flex items-center gap-3">
          {dashboardFriends.length > 0 && (
            <button onClick={() => setShowCommonFree(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 font-medium transition-colors shadow-sm border border-green-500/20">
              <Users className={`w-4 h-4`} /> <span className="text-sm">Group Free Time</span>
            </button>
          )}
          <button onClick={() => setShowTimetable(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
            <Calendar className={`w-4 h-4`} /> <span className="text-sm">Timetable</span>
          </button>

          <button onClick={() => setShowPredictor(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
            <BadgeQuestionMark className={`w-4 h-4`} /> <span className="text-sm">Predictor</span>
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 justify-center flex-wrap">
        {daysWithClasses.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            className={`px-4 py-2 rounded-md text-sm md:text-base font-medium transition-colors duration-150
              ${activeDay === d
                ? "bg-blue-600 text-white midnight:bg-blue-700"
                : "bg-gray-200 text-gray-700 hover:bg-blue-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 midnight:bg-black midnight:text-gray-200 midnight:hover:bg-gray-800 midnight:outline midnight:outline-1 midnight:outline-gray-800"
              }`}
          >
            {d}
          </button>
        ))}
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
            />
          </div>
        ))}
      </div>

      {/* Desktop View: Side-by-side Timeline (Left) and Details Panel (Right) */}
      {dayCardsMap[activeDay] && dayCardsMap[activeDay].length > 0 ? (
        <div className="hidden md:grid md:grid-cols-[300px_1fr] gap-8 p-0 items-start">
          {/* Left Column: Timeline Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Today's Schedule</h3>
            <div className="relative pl-8 space-y-4">
              {/* Vertical timeline line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-gray-200 dark:bg-gray-800 midnight:bg-gray-800/80" />

              {dayCardsMap[activeDay].map((a, idx) => {
                const status = getClassStatus(a.time);
                const isSelected = idx === desktopSelectedIdx;
                
                // Color mapping for status dot
                let dotColorClass = "bg-gray-300 border-gray-400 dark:bg-gray-700 dark:border-gray-600";
                let pulseEffect = null;
                if (status === "ongoing") {
                  dotColorClass = "bg-amber-500 border-amber-300 dark:bg-amber-500 dark:border-amber-400";
                  pulseEffect = <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />;
                } else if (status === "completed") {
                  dotColorClass = "bg-emerald-500 border-emerald-300 dark:bg-emerald-500 dark:border-emerald-400";
                }

                // Card background and border based on state
                let cardStyle = "bg-white dark:bg-slate-900 midnight:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 midnight:border-gray-800/60";
                if (isSelected) {
                  cardStyle = "bg-blue-50/40 dark:bg-blue-950/20 midnight:bg-blue-950/15 border-blue-500 ring-1 ring-blue-500/30";
                } else if (status === "ongoing") {
                  cardStyle = "bg-amber-50/30 dark:bg-amber-950/10 midnight:bg-amber-950/5 border-amber-500/40";
                }

                // Muted state for completed classes
                let textOpacity = "opacity-100";
                if (status === "completed" && !isSelected) {
                  textOpacity = "opacity-60";
                }

                const attendanceVariant = a.attendancePercentage < (isDayscholarWithBus ? 85 : 75)
                  ? "danger"
                  : a.attendancePercentage < (isDayscholarWithBus ? 90 : 85)
                    ? "warning"
                    : "success";

                return (
                  <div 
                    key={idx} 
                    className="relative group cursor-pointer"
                    onClick={() => setDesktopSelectedIdx(idx)}
                  >
                    {/* Timeline Dot */}
                    <div className="absolute left-[-29px] top-4 z-10 flex h-6 w-6 items-center justify-center">
                      <div className="relative flex h-3 w-3 items-center justify-center">
                        {pulseEffect}
                        <span className={`relative inline-flex h-3 w-3 rounded-full border-2 ${dotColorClass}`} />
                      </div>
                    </div>

                    {/* Timeline Card */}
                    <div className={`stagger-enter p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${cardStyle} ${textOpacity}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 midnight:text-blue-400 uppercase">
                              {a.slotName}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {a.time}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 truncate">
                            {a.courseTitle}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{a.slotVenue}</span>
                          </div>
                        </div>

                        {/* Attendance Pill */}
                        <Badge variant={attendanceVariant} className="font-bold shrink-0">
                          {a.attendancePercentage}%
                        </Badge>
                      </div>

                      {/* Small badge overlay if ongoing */}
                      {status === "ongoing" && (
                        <div className="mt-3 flex justify-between items-center bg-amber-500/10 dark:bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/25">
                          <span className="text-[10px] font-black tracking-wider uppercase text-amber-600 dark:text-amber-400">
                            🔴 Ongoing Class
                          </span>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                            Now
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Premium Desktop Course Details Preview */}
          <div className="bg-white dark:bg-slate-900 midnight:bg-[#080808] border border-gray-200 dark:border-gray-800 midnight:border-gray-800/80 rounded-2xl p-6 shadow-sm">
            {dayCardsMap[activeDay][desktopSelectedIdx] ? (
              <DesktopCourseDetail
                a={dayCardsMap[activeDay][desktopSelectedIdx]}
                isDayscholarWithBus={isDayscholarWithBus}
                decimalValues={decimalValues}
                results={results}
                dayCardsMap={dayCardsMap}
                impDates={impDates}
                onViewFullPage={() => setExpandedIdx(desktopSelectedIdx)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20">
                <p>Select a class on the timeline to view details.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:block">
          <NoContentFound />
        </div>
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
        <Modal onClose={() => setShowTimetable(false)} maxWidth="max-w-4xl" className="max-h-[95vh] overflow-y-auto">
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
