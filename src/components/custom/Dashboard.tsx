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
import { useState, useEffect, useRef, useCallback } from "react";
import LeaveDisplay from "./Hostel/LeaveDisplay";
import HostelOverview from "./Hostel/HostelOverview";
import HostelCounsellingView from "./Hostel/HostelCounsellingView";
import CabShareTab from "./Hostel/CabShare/CabShareTab";
import CabShareMatchCard from "./Hostel/CabShare/CabShareMatchCard";
import AllGradesDisplay from "./Exams/AllGradesDisplay";
import BusFinder from "./dayscholar/BusFinder";
import MobileHome from "./mobile/MobileHome";
import AboutTab from "./AboutTab";

import { API_BASE } from "./Main";
import CourseDashboard from "./Exams/CourseDashboard";
import { RefreshCcw, Calendar, MapPin } from "lucide-react";
import ScheduleSubTab from "./Exams/ScheduleSubTab";
import MoreTab from "./more/MoreTab";
import dynamic from "next/dynamic";
import { Skeleton } from "@amazecontinuityprojects/amazeui";

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
import { syncPastSemesters, loadFrozenPastSemesters } from "@/lib/pastDataSync";
import MakeupCompreTab from "./Exams/MakeupCompreTab";
import CourseMgmtTab from "./Exams/CourseMgmtTab";
import ProjectsTab from "./Exams/ProjectsTab";
import WishlistTab from "./Exams/WishlistTab";
import FreeClassroomsTab from "./Exams/FreeClassroomsTab";
import CircularsTab from "./Exams/CircularsTab";
import FacultyInfoTab from "./Exams/FacultyInfoTab";

import ProfileTab from "./profile/ProfileTab";
import PushPromptModal from "./PushPromptModal";
import ChangelogModal from "./ChangelogModal";
import FresherWelcomePage, { hasFutureExam } from "./FresherWelcomePage";
import FeedbackStatusModal from "./profile/FeedbackStatusModal";
import GenericApiView from "./Exams/GenericApiView";
import Modal from "./shared/Modal";
import ODTrackerSubpage from "./attendance/ODTrackerSubpage";
import { analyzeAllCalendars } from "@/lib/analyzeCalendar";
import { useMemo } from "react";

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
  activeProfileSubTab,
  setActiveProfileSubTab,
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
  setSettings,
  onOpenCommandPalette,
  onOpenShortcutsHelp
}) {
  const [showFresherWelcome, setShowFresherWelcome] = useState(false);
  const [fresherEptData, setFresherEptData] = useState<any>(null);
  const [fresherAckData, setFresherAckData] = useState<any>(null);
  const [fresherResources, setFresherResources] = useState<any[]>([]);

  const results = useMemo(() => {
    const analysis = analyzeAllCalendars(calendarData?.calendars);
    return analysis?.results || [];
  }, [calendarData]);

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
  const [showFeedbackStatus, setShowFeedbackStatus] = useState(false);
  const [hostelCounsellingCreds, setHostelCounsellingCreds] = useState<any>(null);
  const [hostelCounsellingRefreshKey, setHostelCounsellingRefreshKey] = useState(0);
  const [pastSemesterData, setPastSemesterData] = useState<any>(null);

  useEffect(() => {
    if (allGradesData) {
      setPastSemesterData(loadFrozenPastSemesters(allGradesData));
    }
  }, [allGradesData]);

  useEffect(() => {
    const academicAliases: Record<string, string> = {
      gpa: "predictor",
      faculty: "faculty-info",
      timetable: "course-dashboard",
    };

    if (activeTab === "academics" && academicAliases[activeSubTab]) {
      setActiveSubTab(academicAliases[activeSubTab]);
    }

    if (activeTab === "more" && activeMoreSubTab === "qbank") {
      setActiveTab("academics");
      setActiveSubTab("qbank");
    }

    if (activeTab === "hostel" && HostelActiveSubTab === "payment") {
      setActiveTab("payments");
    }

    if (activeTab === "profile" && activeProfileSubTab === "preferences") {
      setActiveProfileSubTab("settings");
    }
  }, [
    activeTab,
    activeSubTab,
    activeMoreSubTab,
    HostelActiveSubTab,
    activeProfileSubTab,
    setActiveSubTab,
    setActiveTab,
    setActiveProfileSubTab,
  ]);

  const [dayscholarBuses, setDayscholarBuses] = useState([]);
  const [transportData, setTransportData] = useState<any>(null);
  const [transportLoading, setTransportLoading] = useState(true);

  const loadTransportData = useCallback(() => {
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

  useEffect(() => {
    const cachedBuses = localStorage.getItem("cache_buses");
    if (cachedBuses) {
      try { setDayscholarBuses(JSON.parse(cachedBuses)); } catch {}
    }
    loadTransportData();
  }, [loadTransportData]);

  const [transportBuses, setTransportBuses] = useState<any[]>([]);
  const [transportBusesLoading, setTransportBusesLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("cache_buses");
    if (cached) {
      try { setTransportBuses(JSON.parse(cached)); } catch {}
    }
  }, []);

  const refreshTransportBuses = useCallback(async () => {
    setTransportBusesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/buses`);
      const data = await res.json();
      if (data.success) {
        setTransportBuses(data.buses);
        setDayscholarBuses(data.buses);
        localStorage.setItem("cache_buses", JSON.stringify(data.buses));
      }
    } catch (e) {
      console.error("Failed to fetch transport buses:", e);
    } finally {
      setTransportBusesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "transport") {
      loadTransportData();
    }
  }, [activeTab, loadTransportData]);

  const tabsOrder = ["home", "attendance", "academics", "payments", "libraries", "more", "profile"];

  const [profileData, setProfileData] = useState<any>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("profile");
      if (stored) setProfileData(JSON.parse(stored));
    } catch(e){}
  }, []);

  const isHosteller = profileData?.isHosteller;
  const residentialStatus = settings?.residentialStatus;

  if (isHosteller === true || residentialStatus === "hosteller") tabsOrder.push("hostel");
  else if (isHosteller === false || residentialStatus === "dayscholar") {
    /* no separate dayscholar tab — transport covers it */
  }

  tabsOrder.push("cabshare", "transport");

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

      setMessage((prev) => prev + "\n🔄 Loading past semester data from cache...");
      setPastSemesterData(loadFrozenPastSemesters(AllGradesData));

      // Fetch missing past semesters and update cache
      syncPastSemesters(AllGradesData, { cookies, authorizedID, csrf }).then(() => {
        setPastSemesterData(loadFrozenPastSemesters(AllGradesData));
      });

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
      className="w-full max-w-md md:max-w-full mx-auto overflow-visible"
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
        onOpenCommandPalette={onOpenCommandPalette}
      />

      <div
        className={`relative bg-gray-50/50  dark:bg-black min-h-[100dvh] text-gray-900  dark:text-gray-100 transition-all duration-300 pb-24 md:pb-0 ${settings.isSidebarCollapsed ? 'md:pl-24' : 'md:pl-80'} w-full overflow-hidden`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Ambient Background Glows */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-info-surface blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/10  dark:bg-emerald-500/5 blur-[120px]" />
        </div>
        <div className="hidden">
          <div className="px-6 pt-6 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src={currentIcon} alt="Logo" className="w-10 h-10 rounded-xl object-contain shadow-xs" />
              <div>
                <h2 className="text-xl font-black text-gray-900  dark:text-white tracking-tight leading-tight">AmazeCC</h2>
                <p className="text-xs text-gray-500  dark:text-gray-400 truncate max-w-[180px] font-semibold mt-0.5">
                  {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, {settings.friendlyName || IDs.VtopUsername}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                setIsSpinning(true);
                await handleReloadRequest();
                try {
                  const updatedGrades = JSON.parse(localStorage.getItem("allGrades") || "{}");
                  setPastSemesterData(loadFrozenPastSemesters(updatedGrades));
                } catch (e) {}
                setResetKey(k => k + 1);
                setTimeout(() => setIsSpinning(false), 600);
              }}
              className="p-2.5 rounded-full bg-info-surface text-info hover:bg-info-surface transition-colors shadow-sm"
              title="Reload Data"
            >
              <RefreshCcw className={`w-5 h-5 ${isSpinning ? "animate-spin" : ""}`} />
            </button>
          </div>
          <CabShareMatchCard />
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
        {ODhoursIsOpen && (
          <Modal onClose={() => setODhoursIsOpen(false)} maxWidth="max-w-4xl" className="max-h-[95vh] overflow-y-auto">
            <ODTrackerSubpage
              ODhoursData={ODhoursData}
              attendanceData={attendanceData?.attendance}
              analyzeCalendars={results}
              onBack={() => setODhoursIsOpen(false)}
            />
          </Modal>
        )}
        <div className="px-6 py-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {activeTab === "home" && (
            <div>
              <MobileHome
                attendanceData={attendanceData}
                marksData={marksData}
                hostelData={hostelData}
                registeredEvents={registeredEvents}
                moodleData={moodleData}
                settings={settings}
                setSettings={setSettings}
                IDs={IDs}
                setActiveTab={setActiveTab}
                setActiveSubTab={setActiveSubTab}
                setHostelActiveSubTab={setHostelActiveSubTab}
                setActiveAttendanceSubTab={setActiveAttendanceSubTab}
                setActiveMoreSubTab={setActiveMoreSubTab}
                handleReloadRequest={handleReloadRequest}
                onOpenCommandPalette={onOpenCommandPalette}
                profileData={profileData}
              />
            </div>
          )}

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
                      <h3 className="text-lg font-bold text-gray-900  dark:text-white">Upcoming Events</h3>
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
                          className="min-w-[85vw] sm:min-w-[300px] md:min-w-0 snap-center bg-white  dark:bg-black rounded-2xl p-5 shadow-sm border border-gray-100  dark:border-gray-800 cursor-pointer hover:border-info transition-all hover:shadow-md group relative overflow-hidden flex flex-col justify-between shrink-0"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-info-surface rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

                          <div className="z-10">
                            <h4 className="font-bold text-lg mb-2 text-gray-900  dark:text-white group-hover:text-info transition-colors line-clamp-1">{ev.name}</h4>
                            <p className="text-sm text-gray-500  dark:text-gray-400 mb-4 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.date} • {ev.time}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-xs font-medium mt-auto z-10 pt-4 border-t border-gray-100  dark:border-gray-800/50">
                            <span className="flex items-center gap-1 text-gray-600  dark:text-gray-300 truncate pr-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.venue}</span>
                            </span>
                            <span className={`px-2.5 py-1 rounded-full shrink-0 ${(ev.paymentStatus || "").toLowerCase().includes('paid') || (ev.paymentStatus || "").toLowerCase().includes('free') ? 'bg-green-100 text-green-700   dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700   dark:bg-red-900/20 dark:text-red-400'}`}>
                              {ev.paymentStatus || "Registered"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}



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

          {activeTab === "academics" && (
            <div className="animate-fadeIn">
              {activeSubTab === "overview" && (
                marksData ? (
                  <AcademicsHub
                    setActiveSubTab={setActiveSubTab}
                    data={allGradesData}
                    marksData={marksData}
                    gradesData={GradesData}
                    attendance={attendanceData.attendance}
                    hideMobileHeader={settings.hideMobileHeader}
                    handleFetchGrades={handleAllGradesFetch}
                  />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "course-dashboard" && (
                marksData ? (
                  <CourseDashboard marksData={marksData} allGradesData={allGradesData} pastSemesterData={pastSemesterData} attendanceData={attendanceData} loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} calendars={calendarData?.calendars} decimalValues={settings.decimalValues} isDayscholarWithBus={settings.isDayscholarWithBus} />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "grades" && (
                marksData ? (
                  <TestGradesContainer data={allGradesData} marksData={marksData} gradesData={GradesData} attendance={attendanceData.attendance} handleFetchGrades={handleAllGradesFetch} setActiveSubTab={setActiveSubTab} />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "curriculum" && (
                marksData ? (
                  <CurriculumPage marksData={marksData} allGradesData={allGradesData} gradesData={GradesData} attendance={attendanceData.attendance} handleFetchGrades={handleAllGradesFetch} setActiveSubTab={setActiveSubTab} loginToVTOP={loginToVTOP} />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "predictor" && (
                marksData ? (
                  <GPAPredictorTab marksData={marksData} attendance={attendanceData.attendance} setActiveSubTab={setActiveSubTab} />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "qbank" && (
                marksData ? (
                  <div className="animate-fadeIn">
                    <PapersArchiveTab allGradesData={allGradesData} marksData={marksData} username={IDs.VtopUsername} setActiveSubTab={setActiveSubTab} />
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "arrear" && (
                <ArrearTab key={`arrear-${resetKey}`} loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} allGradesData={allGradesData} />
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
              {activeSubTab === "free-class" && (
                <FreeClassroomsTab setActiveSubTab={setActiveSubTab} />
              )}

              {activeSubTab === "faculty-info" && (
                <FacultyInfoTab loginToVTOP={loginToVTOP} setActiveSubTab={setActiveSubTab} />
              )}
            </div>
          )}

          {activeTab === "hostel" && (
            <div className="animate-fadeIn">

              {HostelActiveSubTab === "overview" && (
                <HostelOverview hostelData={hostelData} setHostelActiveSubTab={setHostelActiveSubTab} />
              )}
              {HostelActiveSubTab === "mess" && (
                <MessDisplay hostelData={hostelData} handleHostelDetailsFetch={handleHostelDetailsFetch} />
              )}
              {HostelActiveSubTab === "laundry" && (
                <LaundryDisplay hostelData={hostelData} handleHostelDetailsFetch={handleHostelDetailsFetch} />
              )}
              {HostelActiveSubTab === "leave" && (
                <LeaveDisplay leaveData={hostelData.leaveHistory} handleHostelDetailsFetch={handleHostelDetailsFetch} />
              )}
              {HostelActiveSubTab === "payment" && (
                <PaymentsTab loginToVTOP={loginToVTOP} />
              )}
              {HostelActiveSubTab === "counselling" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Hostel Counselling</h2>
                    <button
                      onClick={() => { setHostelCounsellingRefreshKey(k => k + 1); }}
                      className="p-2.5 rounded-full bg-info-surface text-info hover:bg-info-surface transition-colors"
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

          {activeTab === "cabshare" && (
            <CabShareTab />
          )}

          {activeTab === "dayscholar" && (
            <div className="animate-fadeIn space-y-8">
              <BusFinder buses={dayscholarBuses} transportData={transportData} transportLoading={transportLoading} loginToVTOP={loginToVTOP} />
            </div>
          )}

          {activeTab === "transport" && (
            <div className="animate-fadeIn space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transport</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bus routes, boarding points, vehicle placements & contact info</p>
                </div>
                <button
                  onClick={refreshTransportBuses}
                  disabled={transportBusesLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/25"
                >
                  <RefreshCcw className={`w-4 h-4 ${transportBusesLoading ? "animate-spin" : ""}`} />
                  {transportBusesLoading ? "Refreshing..." : "Refresh Bus Data"}
                </button>
              </div>
              <BusFinder buses={transportBuses} transportData={transportData} transportLoading={transportLoading} loginToVTOP={loginToVTOP} />
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
                loginToVTOP={loginToVTOP}
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
                onOpenShortcutsHelp={onOpenShortcutsHelp}
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
                settings={settings}
                setSettings={setSettings}
              />
            </div>
          )}

          {activeTab === "about" && (
            <div className="animate-fadeIn">
              <AboutTab />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
