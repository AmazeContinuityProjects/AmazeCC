"use client";
import { getAssetPath } from "@/lib/utils";
import NavigationTabs from "./header/NavigationTabs";
import StatsCards from "./statCards";
import GradesModal from "./Exams/GradesModal";
import AttendanceTabs from "./attendance/attendanceTabs";
import AcademicsHub from "./Exams/AcademicsHub";
import MarksDisplay from "./Exams/MarksDisplay";
import ExamsScheduleDisplay from "./Exams/SchduleDisplay";
import TestGradesContainer from "./Exams/TestGradesContainer";
import CurriculumPage from "./Exams/CurriculumPage";
import GPAPredictorTab from "./Exams/GPAPredictorTab";
import HostelSubTabs from "./Hostel/HostelSubsTab";
import MessDisplay from "./Hostel/messDisplay";
import LaundryDisplay from "./Hostel/LaundryDisplay";
import AttendanceSubTabs from "./attendance/AttendanceSubsTabs";
import CalendarView from "./attendance/CalendarView";
import { useState, useEffect, useRef } from "react";
import LeaveDisplay from "./Hostel/LeaveDisplay";
import AllGradesDisplay from "./Exams/AllGradesDisplay";
import BusFinder from "./dayscholar/BusFinder";

import { API_BASE } from "./Main";
import CourseDashboard from "./Exams/CourseDashboard";
import { RefreshCcw, Calendar, MapPin } from "lucide-react";
import ScheduleSubTab from "./Exams/ScheduleSubTab";
import MoreTab from "./more/MoreTab";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const PapersArchiveTab = dynamic(() => import("./qbank/PapersArchiveTab"), {
  loading: () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-48 mb-4" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
});
const PureQBankTab = dynamic(() => import("./qbank/PureQBankTab"), {
  loading: () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-48 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
});
import QBankSubTabs from "./qbank/QBankSubTabs";
import PaymentsTab from "./PaymentsTab";
import LibrariesTab from "./Libraries/LibrariesTab";
import ArrearTab from "./Exams/ArrearTab";
import MakeupCompreTab from "./Exams/MakeupCompreTab";
import CourseMgmtTab from "./Exams/CourseMgmtTab";
import ProjectsTab from "./Exams/ProjectsTab";
import WishlistTab from "./Exams/WishlistTab";
import CircularsTab from "./Exams/CircularsTab";
import FacultyInfoTab from "./Exams/FacultyInfoTab";
import QCMViewTab from "./Exams/QCMViewTab";

import ProfileTab from "./profile/ProfileTab";
import PushPromptModal from "./PushPromptModal";
import ChangelogModal from "./ChangelogModal";
import FresherWelcomePage, { hasFutureExam } from "./FresherWelcomePage";
import FeedbackStatusModal from "./profile/FeedbackStatusModal";
import GenericApiView from "./Exams/GenericApiView";

export default function DashboardContent({
  demoMode = false,
  activeTab,
  setActiveTab,
  handleLogOutRequest,
  handleReloadRequest,
  GradesData,
  allGradesData,
  attendancePercentage,
  ODhoursData,
  ODhoursIsOpen,
  setODhoursIsOpen,
  GradesDisplayIsOpen,
  setGradesDisplayIsOpen,
  attendanceData,
  activeDay,
  setActiveDay,
  marksData,
  activeSubTab,
  setActiveSubTab,
  ScheduleData,
  hostelData,
  HostelActiveSubTab,
  setHostelActiveSubTab,
  activeAttendanceSubTab,
  setActiveAttendanceSubTab,
  activeDayscholarSubTab,
  setActiveDayscholarSubTab,
  activeQBankSubTab,
  setActiveQBankSubTab,
  activeMoreSubTab,
  setActiveMoreSubTab,
  calendarData,
  setCalender,
  setIsReloading,
  setProgressBar,
  setMessage,
  loginToVTOP,
  setAllGradesData,
  sethostelData,
  setGradesData,
  setScheduleData,
  handleLogin,
  moodleData,
  setMoodleData,
  IDs,
  setIDs,
  registeredEvents,
  setRegisteredEvents,
  vitolData,
  setVitolData,
  settings,
  setSettings
}) {
  const [showFresherWelcome, setShowFresherWelcome] = useState(false);
  const [fresherEptData, setFresherEptData] = useState<any>(null);
  const [fresherAckData, setFresherAckData] = useState<any>(null);
  const [fresherResources, setFresherResources] = useState<any[]>([]);

  useEffect(() => {
    if (demoMode) {
      setShowFresherWelcome(true);
      return;
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/fresher-resources`)
      .then(r => r.json())
      .then(data => { if (data.success && data.resources) setFresherResources(data.resources); })
      .catch(() => {});
  }, []);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));

  useEffect(() => {
    const updateIcon = () => {
      const savedIcon = localStorage.getItem("app-icon") || "default";
      setCurrentIcon(getAssetPath(savedIcon === "fire" ? "/images/icons/fire.png" : "/logo.png"));
    };
    updateIcon();
    window.addEventListener("app-icon-changed", updateIcon);
    return () => window.removeEventListener("app-icon-changed", updateIcon);
  }, []);
  const [isSubpageOpen, setIsSubpageOpen] = useState(false);
  const hasMoved = useRef(false);
  const [resetKey, setResetKey] = useState(0);
  const [activeProfileSubTab, setActiveProfileSubTab] = useState("info");
  const [showFeedbackStatus, setShowFeedbackStatus] = useState(false);
  const [hostelCounsellingCreds, setHostelCounsellingCreds] = useState<any>(null);
  const [hostelCounsellingRefreshKey, setHostelCounsellingRefreshKey] = useState(0);

  const [dayscholarBuses, setDayscholarBuses] = useState([]);
  const [transportData, setTransportData] = useState<any>(null);
  const [transportLoading, setTransportLoading] = useState(true);

  useEffect(() => {
    const cachedBuses = localStorage.getItem("cache_buses");
    if (cachedBuses) {
      try { setDayscholarBuses(JSON.parse(cachedBuses)); } catch {}
    }

    const cached = localStorage.getItem("transportData");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTransportData(parsed);
      } catch (e) {
        localStorage.removeItem("transportData");
      }
    }
    setTransportLoading(false);
  }, []);

  const tabsOrder = ["attendance", "academics", "payments", "libraries", "more", "profile"];
  
  const [profileData, setProfileData] = useState<any>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("profile");
      if (stored) setProfileData(JSON.parse(stored));
    } catch(e){}
  }, []);

  const isHosteller = profileData?.isHosteller;
  const residentialStatus = settings?.residentialStatus;

  if (isHosteller === true) tabsOrder.push("hostel");
  else if (isHosteller === false) tabsOrder.push("dayscholar");
  else if (residentialStatus === "dayscholar") tabsOrder.push("dayscholar");
  else if (residentialStatus === "hosteller") tabsOrder.push("hostel");

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    hasMoved.current = false;
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    touchEndX.current = touch.clientX;
    touchEndY.current = touch.clientY;

    const diffX = Math.abs(touchStartX.current - touchEndX.current);
    const diffY = Math.abs(touchStartY.current - touchEndY.current);

    if (diffX > diffY && diffX > 10) hasMoved.current = true;
  };

  const handleTouchEnd = (e) => {
    if (!hasMoved.current) return;

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;

    if (Math.abs(diffY) > Math.abs(diffX)) return;

    const target = e.target.closest("button, a, input, textarea, select, [data-prevent-swipe]");
    if (target) return;

    const scrollable = e.target.closest("[data-scrollable], [style*='overflow-x']");
    if (scrollable) return;

    if (Math.abs(diffX) < 75) return;

    const currentIndex = tabsOrder.indexOf(activeTab);
    if (diffX > 0 && currentIndex < tabsOrder.length - 1) {
      setActiveTab(tabsOrder[currentIndex + 1]);
    } else if (diffX < 0 && currentIndex > 0) {
      setActiveTab(tabsOrder[currentIndex - 1]);
    }
  };

  const handleAllGradesFetch = async () => {
    setIsReloading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const AllGradesRes = await fetch(`${API_BASE}/api/all-grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookies, authorizedID, csrf }),
      });

      const AllGradesData = await AllGradesRes.json();
      setProgressBar((prev) => prev + 40);

      setAllGradesData(AllGradesData);
      localStorage.setItem("allGrades", JSON.stringify(AllGradesData));

      setMessage((prev) => prev + "\n✅ All grades reloaded successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "All Grades fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  const handleCalendarFetch = async (FncalendarType) => {
    setIsReloading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const calenderRes = await fetch(`${API_BASE}/api/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies: cookies,
          authorizedID, csrf,
          type: FncalendarType || "ALL",
          semesterId: settings.currSemesterID
        }),
      });

      const CalenderRes = await calenderRes.json();
      setProgressBar((prev) => prev + 40);

      setCalender(CalenderRes);
      setSettings(prev => ({ ...prev, calendarType: FncalendarType || "ALL" }))
      localStorage.setItem("calender", JSON.stringify(CalenderRes));
      localStorage.setItem("settings", JSON.stringify({ ...settings, calendarType: FncalendarType }));

      setMessage((prev) => prev + "\n✅ Calendar reloaded successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Calendar fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  const handleFetchGrades = async () => {
    setIsReloading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const gradesRes = await fetch(`${API_BASE}/api/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf, semesterId: settings.currSemesterID }),
      });

      const gradesData = await gradesRes.json();
      setProgressBar((prev) => prev + 40);

      setGradesData(gradesData);
      localStorage.setItem("grades", JSON.stringify(gradesData));

      setMessage((prev) => prev + "\n✅ Grades reloaded successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Grades fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  const handleHostelDetailsFetch = async () => {
    setIsReloading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const HostelRes = await fetch(`${API_BASE}/api/hostel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookies, authorizedID, csrf }),
      });
      const HostelData = await HostelRes.json();
      setProgressBar((prev) => prev + 40);
      sethostelData(HostelData);
      localStorage.setItem("hostel", JSON.stringify(HostelData));
      setMessage((prev) => prev + "\n✅ Hostel details reloaded successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Hostel details fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  const handleScheduleFetch = async () => {
    setIsReloading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const ScheduleRes = await fetch(`${API_BASE}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookies, authorizedID, csrf, semesterId: settings.currSemesterID }),
      });
      const ScheduleData = await ScheduleRes.json();
      setProgressBar((prev) => prev + 40);
      setScheduleData(ScheduleData);
      localStorage.setItem("schedule", JSON.stringify(ScheduleData));
      setMessage((prev) => prev + "\n✅ Schedule reloaded successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Schedule fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  const handleFetchMoodle = async (username = IDs.MoodleUsername, pass = IDs.MoodlePassword) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsReloading(true);
    setProgressBar(20);
    setMessage("Fetching Moodle data...");
    try {
      const moodleRes = await fetch(`${API_BASE}/api/lms-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pass }),
      });

      const moodleData = await moodleRes.json();
      setProgressBar((prev) => prev + 40);

      const prevData = JSON.parse(localStorage.getItem("moodleData") || "[]");

      const mergedData = moodleData.map(item => {
        const prevItem = prevData.find(p => p.url === item.url);
        return {
          ...item,
          hidden: prevItem?.hidden ?? false,
        };
      });

      setMoodleData(mergedData);
      localStorage.setItem("moodleData", JSON.stringify(mergedData));

      setMessage((prev) => prev + "\n✅ Moodle Data fetched Successfully!");
      setProgressBar(100);
      setIsReloading(false);
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Moodle Data fetch failed, check console.")
      );
      setProgressBar(0);
    }
  };

  if (showFresherWelcome) {
    return (
      <FresherWelcomePage
        onDismiss={() => setShowFresherWelcome(false)}
        username={IDs?.VtopUsername || ""}
        friendlyName={settings?.friendlyName || ""}
        eptData={fresherEptData}
        acknowledgementData={fresherAckData}
        resources={fresherResources}
      />
    );
  }

  return (
    <div
      className="w-full max-w-md md:max-w-full mx-auto overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <NavigationTabs
        activeTab={activeTab}
        setActiveTab={(newTab) => {
          if (newTab === activeTab) {
            setResetKey(k => k + 1);
          }
          setActiveTab(newTab);
        }}
        handleLogOutRequest={handleLogOutRequest}
        handleReloadRequest={handleReloadRequest}
        currSemesterID={settings.currSemesterID}
        setCurrSemesterID={(val: string) => {
          setSettings(prev => ({ ...prev, currSemesterID: val }))
          localStorage.setItem("settings", JSON.stringify({ ...settings, currSemesterID: val }))
        }
        }
        handleLogin={handleLogin}
        setIsReloading={setIsReloading}
        username={IDs.VtopUsername}
        password={IDs.VtopPassword}
        setPassword={(val: string[]) =>{
          setIDs(prev => ({ ...prev, VtopUsername: val[0], VtopPassword: val[1] }))
          localStorage.setItem("IDs", JSON.stringify({ ...IDs, VtopUsername: val[0], VtopPassword: val[1]}))
        }
        }
        settings={settings}
        setSettings={setSettings}
        attendancePercentage={attendancePercentage}
        marksData={marksData}
        ODhoursData={ODhoursData}
        setODhoursIsOpen={setODhoursIsOpen}
        feedbackStatus={GradesData.feedback}
        setGradesDisplayIsOpen={setGradesDisplayIsOpen}
        activeAttendanceSubTab={activeAttendanceSubTab}
        setActiveAttendanceSubTab={setActiveAttendanceSubTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        HostelActiveSubTab={HostelActiveSubTab}
        setHostelActiveSubTab={setHostelActiveSubTab}
        activeDayscholarSubTab={activeDayscholarSubTab}
        setActiveDayscholarSubTab={setActiveDayscholarSubTab}
        activeQBankSubTab={activeQBankSubTab}
        setActiveQBankSubTab={setActiveQBankSubTab}
        activeMoreSubTab={activeMoreSubTab}
        setActiveMoreSubTab={setActiveMoreSubTab}
        activeProfileSubTab={activeProfileSubTab}
        setActiveProfileSubTab={setActiveProfileSubTab}
        onOpenFeedbackStatus={() => setShowFeedbackStatus(true)}
      />

      <div 
        className={`relative bg-gray-50/50 dark:bg-gray-900/50 midnight:bg-black min-h-[100dvh] text-gray-900 dark:text-gray-100 midnight:text-gray-100 transition-all duration-300 pb-24 md:pb-0 ${settings.isSidebarCollapsed ? 'md:pl-24' : 'md:pl-72'} w-full overflow-hidden`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Ambient Background Glows */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 dark:bg-blue-500/10 midnight:bg-blue-500/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/10 dark:bg-emerald-500/10 midnight:bg-emerald-500/5 blur-[120px]" />
        </div>
        <div className={`md:hidden ${settings.hideMobileHeader && activeTab !== "attendance" ? "hidden" : ""} ${isSubpageOpen ? "hidden" : ""}`}>
          <div className="px-6 pt-6 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src={currentIcon} alt="Logo" className="w-10 h-10 rounded-xl object-contain shadow-xs" />
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 midnight:text-white tracking-tight leading-tight">AmazeCC</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 truncate max-w-[180px] font-semibold mt-0.5">
                  {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, {settings.friendlyName || IDs.VtopUsername}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                setIsSpinning(true);
                await handleReloadRequest();
                setTimeout(() => setIsSpinning(false), 600);
              }}
              className="p-2.5 rounded-full bg-blue-50 dark:bg-slate-800 midnight:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
              title="Reload Data"
            >
              <RefreshCcw className={`w-5 h-5 ${isSpinning ? "animate-spin" : ""}`} />
            </button>
          </div>
          <StatsCards
            attendancePercentage={attendancePercentage}
          ODhoursData={ODhoursData}
          setODhoursIsOpen={setODhoursIsOpen}
          feedbackStatus={GradesData.feedback}
          marksData={marksData}
          setGradesDisplayIsOpen={setGradesDisplayIsOpen}
          CGPAHidden={settings.CGPAHidden}
          setCGPAHidden={(val: boolean) => {
            setSettings(prev => ({ ...prev, CGPAHidden: val }))
            localStorage.setItem("settings", JSON.stringify({ ...settings, CGPAHidden: val }))
          }
          }
          attendancePercentageOrString={settings.attendancePercentageOrString}
          setAttendancePercentageOrString={(val: string) => {
            setSettings(prev => ({ ...prev, attendancePercentageOrString: val }))
            localStorage.setItem("settings", JSON.stringify({ ...settings, attendancePercentageOrString: val }))
            }
          }
          onOpenFeedbackStatus={() => setShowFeedbackStatus(true)}
        />
        </div>



        {GradesDisplayIsOpen && (
          <GradesModal
            allGradesData={allGradesData}
            GradesData={GradesData}
            marksData={marksData}
            onClose={() => setGradesDisplayIsOpen(false)}
            handleFetchGrades={handleFetchGrades}
            attendance={attendanceData.attendance}
          />
        )}

        <PushPromptModal UserID={IDs?.VtopUsername} />
        <ChangelogModal />
        <FeedbackStatusModal isOpen={showFeedbackStatus} onClose={() => setShowFeedbackStatus(false)} loginToVTOP={loginToVTOP} />
        <div className="px-6 py-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {activeTab === "attendance" && attendanceData?.attendance && (
            <div className="animate-fadeIn">
              {(() => {
                // Determine upcoming events within the next 7 days
                if (!registeredEvents || !Array.isArray(registeredEvents) || registeredEvents.length === 0) return null;
                const now = new Date();
                now.setHours(0,0,0,0);
                const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                const parseEventDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  if (!isNaN(d.getTime())) return d;
                  
                  // Try parsing DD-MM-YYYY or DD/MM/YYYY
                  const parts = dateStr.split(/[-/]/);
                  if (parts.length === 3) {
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                  }
                  return new Date(0); // fallback
                };
                
                const upcoming = registeredEvents.filter(ev => {
                  if (!ev.date) return false;
                  const d = parseEventDate(ev.date);
                  return d >= now && d <= nextWeek;
                }).sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
                
                if (upcoming.length === 0) return null;
                
                return (
                  <div className={`mb-8 ${isSubpageOpen ? "hidden" : ""}`}>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white midnight:text-white">Upcoming Events</h3>
                    </div>
                    <div 
                      className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:pb-0"
                      data-prevent-swipe="true"
                    >
                      {upcoming.map((ev, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            sessionStorage.setItem("pendingEventOpen", ev.name);
                            setActiveTab("more");
                            setActiveMoreSubTab("events");
                          }}
                          className="min-w-[85vw] sm:min-w-[300px] md:min-w-0 snap-center bg-white dark:bg-slate-800 midnight:bg-black rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 midnight:border-gray-800 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 midnight:hover:border-blue-500 transition-all hover:shadow-md group relative overflow-hidden flex flex-col justify-between shrink-0"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 dark:bg-blue-400/10 midnight:bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                          
                          <div className="z-10">
                            <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white midnight:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 midnight:group-hover:text-blue-400 transition-colors line-clamp-1">{ev.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-4 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.date} • {ev.time}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs font-medium mt-auto z-10 pt-4 border-t border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50">
                            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300 midnight:text-gray-300 truncate pr-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.venue}</span>
                            </span>
                            <span className={`px-2.5 py-1 rounded-full shrink-0 ${ev.paymentStatus.toLowerCase().includes('paid') || ev.paymentStatus.toLowerCase().includes('free') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 midnight:bg-green-900/20 midnight:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 midnight:bg-red-900/20 midnight:text-red-400'}`}>
                              {ev.paymentStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className={`md:hidden ${isSubpageOpen ? "hidden" : ""}`}>
                <AttendanceSubTabs
                  activeSubTab={activeAttendanceSubTab}
                  setActiveAttendanceSubTab={setActiveAttendanceSubTab}
                />
              </div>

              {activeAttendanceSubTab === "attendance" && (
                <>
                  <AttendanceTabs
                    key={`attendance-tabs-${resetKey}`}
                    data={attendanceData}
                    activeDay={activeDay}
                    setActiveDay={setActiveDay}
                    calendars={calendarData.calendars}
                    decimalValues={settings.decimalValues}
                    isDayscholarWithBus={settings.isDayscholarWithBus}
                    setIsSubpageOpen={setIsSubpageOpen}
                    ODhoursData={ODhoursData}
                    ODhoursIsOpen={ODhoursIsOpen}
                    setODhoursIsOpen={setODhoursIsOpen}
                  />
                </>
              )}

              {activeAttendanceSubTab === "calendar" && (
                <div className="animate-fadeIn">
                  <CalendarView
                    calendars={calendarData?.calendars}
                    calendarType={settings.calendarType}
                    handleCalendarFetch={handleCalendarFetch}
                    moodleData={moodleData}
                    scheduleData={ScheduleData}
                    attendanceData={attendanceData}
                    ODhoursData={ODhoursData}
                    setIsSubpageOpen={setIsSubpageOpen}
                    setMoodleData={setMoodleData}
                    handleFetchMoodle={handleFetchMoodle}
                    IDs={IDs}
                    registeredEvents={registeredEvents}
                    setActiveAttendanceSubTab={setActiveAttendanceSubTab}
                  />
                </div>
              )}

              {activeAttendanceSubTab === "circulars" && (
                <div className="animate-fadeIn">
                  <CircularsTab loginToVTOP={loginToVTOP} onBack={() => setActiveAttendanceSubTab("calendar")} />
                </div>
              )}
            </div>
          )}

          {activeTab === "academics" && marksData && (
            <div className="animate-fadeIn">
              {activeSubTab === "overview" && <AcademicsHub 
                setActiveSubTab={setActiveSubTab} 
                data={allGradesData} 
                marksData={marksData} 
                gradesData={GradesData} 
                attendance={attendanceData.attendance} 
                hideMobileHeader={settings.hideMobileHeader} 
                handleFetchGrades={handleAllGradesFetch} 
              />}
              {activeSubTab === "course-dashboard" && <CourseDashboard marksData={marksData} attendanceData={attendanceData} loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} calendars={calendarData?.calendars} decimalValues={settings.decimalValues} isDayscholarWithBus={settings.isDayscholarWithBus} />}
              {activeSubTab === "grades" && <TestGradesContainer data={allGradesData} marksData={marksData} gradesData={GradesData} attendance={attendanceData.attendance} handleFetchGrades={handleAllGradesFetch} setActiveSubTab={setActiveSubTab} />}
              {activeSubTab === "curriculum" && <CurriculumPage marksData={marksData} allGradesData={allGradesData} gradesData={GradesData} attendance={attendanceData.attendance} handleFetchGrades={handleAllGradesFetch} setActiveSubTab={setActiveSubTab} loginToVTOP={loginToVTOP} />}
              {activeSubTab === "predictor" && <GPAPredictorTab marksData={marksData} attendance={attendanceData.attendance} setActiveSubTab={setActiveSubTab} />}
              {activeSubTab === "qbank" && (
                <div className="animate-fadeIn">
                  <PapersArchiveTab allGradesData={allGradesData} marksData={marksData} username={IDs.VtopUsername} setActiveSubTab={setActiveSubTab} />
                </div>
              )}
              {activeSubTab === "arrear" && (
                <ArrearTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
              {activeSubTab === "makeup-compre" && (
                <MakeupCompreTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
              {activeSubTab === "course-mgmt" && (
                <CourseMgmtTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
              {activeSubTab === "projects" && (
                <ProjectsTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
              {activeSubTab === "wishlist" && (
                <WishlistTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}

              {activeSubTab === "faculty-info" && (
                <FacultyInfoTab loginToVTOP={loginToVTOP} />
              )}
              {activeSubTab === "qcm-view" && (
                <QCMViewTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
            </div>
          )}

          {activeTab === "hostel" && (
            <div className="animate-fadeIn">
              <div className="md:hidden">
                <HostelSubTabs
                  HostelActiveSubTab={HostelActiveSubTab}
                  setHostelActiveSubTab={setHostelActiveSubTab}
                />
              </div>
              {HostelActiveSubTab === "mess" && <MessDisplay hostelData={hostelData} handleHostelDetailsFetch={handleHostelDetailsFetch} />}
              {HostelActiveSubTab === "laundry" && <LaundryDisplay hostelData={hostelData} handleHostelDetailsFetch={handleHostelDetailsFetch} />}
              {HostelActiveSubTab === "leave" && <LeaveDisplay leaveData={hostelData.leaveHistory} handleHostelDetailsFetch={handleHostelDetailsFetch} />}
              {HostelActiveSubTab === "counselling" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Hostel Counselling</h2>
                    <button
                      onClick={() => { setHostelCounsellingRefreshKey(k => k + 1); }}
                      className="p-2.5 rounded-full bg-blue-50 dark:bg-slate-800 midnight:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
                      title="Reload"
                    >
                      <RefreshCcw className="w-5 h-5" />
                    </button>
                  </div>
                  <HostelCounsellingView loginToVTOP={loginToVTOP} refreshKey={hostelCounsellingRefreshKey} />
                </div>
              )}
            </div>
          )}

          {activeTab === "dayscholar" && (
            <div className="animate-fadeIn space-y-8">
              <BusFinder buses={dayscholarBuses} transportData={transportData} transportLoading={transportLoading} loginToVTOP={loginToVTOP} />
            </div>
          )}

          {activeTab === "payments" && (
            <div className="animate-fadeIn">
              <PaymentsTab loginToVTOP={loginToVTOP} />
            </div>
          )}

          {activeTab === "libraries" && (
            <div className="animate-fadeIn">
              <LibrariesTab loginToVTOP={loginToVTOP} />
            </div>
          )}

          {activeTab === "more" && (
            <div className="animate-fadeIn">
              <MoreTab 
                attendanceData={attendanceData} 
                activeMoreSubTab={activeMoreSubTab} 
                setActiveMoreSubTab={setActiveMoreSubTab}
                IDs={IDs}
                isSubpageOpen={isSubpageOpen}
                setIsSubpageOpen={setIsSubpageOpen}
                registeredEvents={registeredEvents}
                setRegisteredEvents={setRegisteredEvents}
              />
            </div>
          )}



          {activeTab === "profile" && (
            <div className="animate-fadeIn">
              <ProfileTab
                activeProfileSubTab={activeProfileSubTab}
                setActiveProfileSubTab={setActiveProfileSubTab}
                isLoggedIn={true}
                loginToVTOP={loginToVTOP}
                currSemesterID={settings.currSemesterID}
                setCurrSemesterID={(val: string) => {
                  setSettings(prev => ({ ...prev, currSemesterID: val }))
                  localStorage.setItem("settings", JSON.stringify({ ...settings, currSemesterID: val }))
                }}
                handleLogin={handleLogin}
                setIsReloading={setIsReloading}
                handleLogOutRequest={handleLogOutRequest}
                password={IDs.VtopPassword}
                username={IDs.VtopUsername}
                setPassword={(val: string[]) =>{
                  setIDs(prev => ({ ...prev, VtopUsername: val[0], VtopPassword: val[1] }))
                  localStorage.setItem("IDs", JSON.stringify({ ...IDs, VtopUsername: val[0], VtopPassword: val[1]}))
                }}
                decimalValues={settings.decimalValues}
                setDecimalValues={(val: boolean) => {
                    setSettings(prev => ({ ...prev, decimalValues: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, decimalValues: val }))
                  }
                }
                loadingScreen={settings.loadingScreen}
                setLoadingScreen={(val: boolean) => {
                    setSettings(prev => ({ ...prev, loadingScreen: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, loadingScreen: val }))
                  }
                }
                isDayscholarWithBus={settings.isDayscholarWithBus}
                setIsDayscholarWithBus={(val: boolean) => {
                    setSettings(prev => ({ ...prev, isDayscholarWithBus: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, isDayscholarWithBus: val }))
                  }
                }
                residentialStatus={settings.residentialStatus || "hosteller"}
                setResidentialStatus={(val: "hosteller" | "dayscholar") => {
                  setSettings(prev => ({ ...prev, residentialStatus: val }))
                  localStorage.setItem("settings", JSON.stringify({ ...settings, residentialStatus: val }))
                }}
                friendlyName={settings.friendlyName}
                setFriendlyName={(val: string) => {
                  setSettings(prev => ({ ...prev, friendlyName: val }))
                  localStorage.setItem("settings", JSON.stringify({ ...settings, friendlyName: val }))
                }}
                calendarType={settings.calendarType}
                setCalendarType={(val: any) => {
                    setSettings(prev => ({ ...prev, calendarType: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, calendarType: val }))
                }}
                hideMobileHeader={settings.hideMobileHeader}
                setHideMobileHeader={(val: boolean) => {
                    setSettings(prev => ({ ...prev, hideMobileHeader: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, hideMobileHeader: val }))
                }}
                reloadAllData={settings.reloadAllData}
                setReloadAllData={(val: boolean) => {
                    setSettings(prev => ({ ...prev, reloadAllData: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, reloadAllData: val }))
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HostelCounsellingView({ loginToVTOP, refreshKey }: { loginToVTOP: () => Promise<any>; refreshKey: number }) {
  const [creds, setCreds] = useState<any>(null);
  useEffect(() => { loginToVTOP().then(setCreds).catch(() => {}); }, [refreshKey]);

  if (!creds) return <Skeleton className="h-32 w-full rounded-2xl" />;
  return <GenericApiView endpoint="hostel-counselling" title="" creds={creds} refreshKey={refreshKey} />;
}

