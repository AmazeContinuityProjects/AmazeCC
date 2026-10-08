"use client";
import { getAssetPath } from "@/lib/utils";
import NavigationTabs from "./header/NavigationTabs";
import StatsCards from "./StatCards";
import GradesModal from "./exams/GradesModal";
import AttendanceTabs from "./attendance/AttendanceTabs";
import MarksHistoryTab from "./exams/MarksHistoryTab";
import CurriculumPage from "./exams/CurriculumPage";
import MarksPredictorTab from "./exams/MarksPredictorTab";
import ExamSchedule from "./exams/ScheduleDisplay";
import MessDisplay from "./hostel/MessDisplay";
import LaundryDisplay from "./hostel/LaundryDisplay";
import CalendarSubpage from "./attendance/CalendarSubpage";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import LeaveDisplay from "./hostel/LeaveDisplay";
import HostelOverview from "./hostel/HostelOverview";
import HostelCounsellingView from "./hostel/HostelCounsellingView";
import CabShareTab from "./hostel/CabShare/CabShareTab";
import CabShareMatchCard from "./hostel/CabShare/CabShareMatchCard";
import BusFinder from "./dayscholar/BusFinder";
import MobileHome from "./mobile/MobileHome";
import SimplifiedMobileHome from "./mobile/SimplifiedMobileHome";
import AmazeOnboardingFlow, { InterfaceOptionId } from "./onboarding/AmazeOnboardingFlow";
import AboutTab from "./AboutTab";

import { api } from "@/lib/sync-engine";
import CourseDashboard from "./exams/CourseDashboard";
import SimplifiedAcademicsPage from "./exams/SimplifiedAcademicsPage";
import ToolsTab from "./tools/ToolsTab";
import SubpageLayout from "./shared/SubpageLayout";
import { RefreshCcw, Calendar, MapPin, WifiOff } from "lucide-react";
import { useSyncTrigger } from "./shared/useSyncTrigger";
import MoreTab from "./more/MoreTab";
import dynamic from "next/dynamic";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { AnimatePresence } from "framer-motion";

import PaymentsTab from "./PaymentsTab";
import LibrariesTab from "./libraries/LibrariesTab";
import EventHubTab from "./events/EventHubTab";
import ClubHubTab from "./clubs/ClubHubTab";
import CommunityFeed from "./clubs/CommunityFeed";
import { syncPastSemesters, loadFrozenPastSemesters } from "@/lib/pastDataSync";
import FreeClassroomsTab from "./exams/FreeClassroomsTab";
import CircularsTab from "./exams/CircularsTab";
import FacultyInfoTab from "./exams/FacultyInfoTab";

import ProfileTab from "./profile/ProfileTab";
import PushPromptModal from "./PushPromptModal";
import ChangelogModal from "./ChangelogModal";
import FresherWelcomePage from "./FresherWelcomePage";
import FeedbackStatusModal from "./profile/FeedbackStatusModal";
import ODTrackerSubpage from "./attendance/ODTrackerSubpage";
import OverallAttendancePredictor from "./attendance/OverallAttendancePredictor";
import { buildAttendanceDayCardsMap } from "@/lib/attendanceTimetable";
import { buildMilestoneDates } from "@/lib/milestoneDates";
import { useMemo } from "react";
import {
  ensureSyncSession,
  appendSyncLine,
  setSyncProgress,
  closeSyncSession,
} from "@/lib/sync-engine/sync-session";
import { assertApiSuccess } from "@/lib/sync-engine/errors";

function DashboardContent({
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
  activeToolsSubTab = "overview",
  setActiveToolsSubTab,
  activeDayscholarSubTab,
  setActiveDayscholarSubTab,
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
  vitolData: _vitolData,
  setVitolData: _setVitolData,
  settings,
  setSettings,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onSystemBack,
  onCollapseScreenChange
}) {
  const [showFresherWelcome, setShowFresherWelcome] = useState(false);
  const [fresherEptData, setFresherEptData] = useState<any>(null);
  const [fresherAckData, setFresherAckData] = useState<any>(null);
  const [fresherResources, setFresherResources] = useState<any[]>([]);
  const [showInterfaceOnboarding, setShowInterfaceOnboarding] = useState(false);

  // Check if user has chosen an interface option yet (for new and existing users)
  useEffect(() => {
    try {
      const hasChosen = localStorage.getItem("has_selected_interface") === "true" || settings?.interfaceChosen === true;
      if (!hasChosen) {
        setShowInterfaceOnboarding(true);
      }
    } catch {}
  }, [settings?.interfaceChosen]);

  // Listen for global open-interface-selector events from Profile or switchers
  useEffect(() => {
    const handleOpen = () => setShowInterfaceOnboarding(true);
    window.addEventListener("open-interface-selector", handleOpen);
    return () => window.removeEventListener("open-interface-selector", handleOpen);
  }, []);

  // Honor preferred default landing tab (e.g. direct attendance)
  useEffect(() => {
    if (settings?.defaultLandingTab === "attendance") {
      setActiveTab("attendance");
      setActiveAttendanceSubTab("attendance");
    }
  }, []);

  const results = useMemo(() => buildMilestoneDates(calendarData).results, [calendarData]);

  useEffect(() => {
    if (demoMode) {
      setShowFresherWelcome(true);
      return;
    }

    try {
      const ept = localStorage.getItem("cache_ept_schedule");
      const ack = localStorage.getItem("cache_acknowledgement");
      const dismissed = localStorage.getItem("fresherWelcomeDismissed");
      
      let hasFresherData = false;
      if (ept) {
        const parsedEpt = JSON.parse(ept);
        setFresherEptData(parsedEpt);
        if (parsedEpt.tables?.[0]?.rows?.length > 0) {
          hasFresherData = true;
        }
      }
      if (ack) {
        const parsedAck = JSON.parse(ack);
        setFresherAckData(parsedAck);
        if (parsedAck.tables?.[1]?.rows?.length > 0) {
          hasFresherData = true;
        }
      }

      if (hasFresherData && dismissed !== "true") {
        setShowFresherWelcome(true);
      }
    } catch (e) {
      console.error("Failed to load fresher data from localStorage", e);
    }
  }, [demoMode]);

  useEffect(() => {
    api("fresher-resources")
      .then((data: any) => { if (data?.success && data.resources) setFresherResources(data.resources); })
      .catch(() => {});
  }, []);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));

  const handleReloadClick = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    try {
      const updatedGrades = JSON.parse(localStorage.getItem("allGrades") || "{}");
      setPastSemesterData(loadFrozenPastSemesters(updatedGrades));
    } catch (e) {}
    setResetKey(k => k + 1);
    setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const { isOffline, triggerSync: handleSyncClick } = useSyncTrigger(handleReloadClick);

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

  // Grades + feedback dialogs register themselves for system back via
  // BottomSheet; nothing to do here.

  const [hostelCounsellingRefreshKey, setHostelCounsellingRefreshKey] = useState(0);
  const [pastSemesterData, setPastSemesterData] = useState<any>(null);
  const [courseDashboardTarget, setCourseDashboardTarget] = useState<{ courseCode: string; targetTab?: string } | null>(null);

  useEffect(() => {
    if (allGradesData) {
      setPastSemesterData(loadFrozenPastSemesters(allGradesData));
    }
  }, [allGradesData]);

  useEffect(() => {
    // Tools is its own section. Academics used to bounce `qbank`, `faculty` and
    // `free-class` over to Tools from here, which meant tapping an Academics icon
    // could silently land you in a different section, and made Tools reachable
    // only through a hidden redirect. Nothing renders those under Academics any
    // more, so a stale value (an old history entry, a bookmark) snaps to the
    // Academics home instead of bouncing sections.
    //
    // The CGPA predictor is separate: it lives in the Curriculum page's planner,
    // and `cgpa-predictor` is rendered by Academics below.
    //
    // Keep this in step with the `activeSubTab === ...` screens below - a new
    // Academics screen that is not listed here will snap back to the home.
    const ACADEMICS_HOME = "courses-simplified";
    const ACADEMIC_SCREENS = new Set([
      ACADEMICS_HOME,
      "simplified-academics",
      "overview",
      "course-dashboard",
      "grades",
      "curriculum",
      "cgpa-predictor",
      "schedule",
      "marks-predictor",
    ]);

    if (activeTab === "academics" && !ACADEMIC_SCREENS.has(activeSubTab)) {
      setActiveSubTab(ACADEMICS_HOME);
    }

    if (activeTab === "more" && activeMoreSubTab === "qbank") {
      setActiveTab("tools");
      if (setActiveToolsSubTab) setActiveToolsSubTab("qbank");
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
      const data = await api("buses") as any;
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

  const tabsOrder = ["home", "attendance", "academics", "tools", "payments", "libraries", "events", "clubs", "community", "free-class", "more", "profile"];

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
    ensureSyncSession("VTOP Sync");
    appendSyncLine("Fetching all grades…", "loading");
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const AllGradesData = await api("all-grades", {
        method: "POST",
        body: { cookies, authorizedID, csrf },
      }) as any;
      assertApiSuccess(AllGradesData, "All grades");
      setSyncProgress(40);

      setAllGradesData(AllGradesData);
      localStorage.setItem("allGrades", JSON.stringify(AllGradesData));

      appendSyncLine("Loading past semester data from cache…", "info");
      setPastSemesterData(loadFrozenPastSemesters(AllGradesData));

      // Fetch missing past semesters and update cache
      syncPastSemesters(AllGradesData, { cookies, authorizedID, csrf }).then(() => {
        setPastSemesterData(loadFrozenPastSemesters(AllGradesData));
      });

      appendSyncLine("All grades reloaded successfully", "success");
      setSyncProgress(100);
      setIsReloading(false);
      closeSyncSession();
    } catch (err) {
      console.error(err);
      appendSyncLine(err instanceof Error ? err.message : "All Grades fetch failed, check console.", "error");
      setSyncProgress(0);
      closeSyncSession(4000, "error");
    }
  };

  const handleCalendarFetch = async (FncalendarType) => {
    setIsReloading(true);
    ensureSyncSession("VTOP Sync");
    appendSyncLine("Fetching academic calendar…", "loading");
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const CalenderRes = await api("calendar", {
        method: "POST",
        body: { cookies, authorizedID, csrf, type: FncalendarType || "ALL", semesterId: settings.currSemesterID },
      }) as any;
      assertApiSuccess(CalenderRes, "Academic calendar");
      setSyncProgress(40);

      setCalender(CalenderRes);
      setSettings(prev => ({ ...prev, calendarType: FncalendarType || "ALL" }))
      localStorage.setItem("calender", JSON.stringify(CalenderRes));
      localStorage.setItem("settings", JSON.stringify({ ...settings, calendarType: FncalendarType }));

      appendSyncLine("Calendar reloaded successfully", "success");
      setSyncProgress(100);
      setIsReloading(false);
      closeSyncSession();
    } catch (err) {
      console.error(err);
      appendSyncLine(err instanceof Error ? err.message : "Calendar fetch failed, check console.", "error");
      setSyncProgress(0);
      closeSyncSession(4000, "error");
    }
  };

  const handleFetchGrades = async () => {
    setIsReloading(true);
    ensureSyncSession("VTOP Sync");
    appendSyncLine("Fetching grades…", "loading");
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const gradesData = await api("grades", {
        method: "POST",
        body: { cookies, authorizedID, csrf, semesterId: settings.currSemesterID },
      }) as any;
      assertApiSuccess(gradesData, "Grades");
      setSyncProgress(40);

      setGradesData(gradesData);
      localStorage.setItem("grades", JSON.stringify(gradesData));

      appendSyncLine("Grades reloaded successfully", "success");
      setSyncProgress(100);
      setIsReloading(false);
      closeSyncSession();
    } catch (err) {
      console.error(err);
      appendSyncLine(err instanceof Error ? err.message : "Grades fetch failed, check console.", "error");
      setSyncProgress(0);
      closeSyncSession(4000, "error");
    }
  };

  const handleHostelDetailsFetch = async () => {
    setIsReloading(true);
    ensureSyncSession("VTOP Sync");
    appendSyncLine("Fetching hostel details…", "loading");
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const HostelData = await api("hostel", {
        method: "POST",
        body: { cookies, authorizedID, csrf },
      }) as any;
      assertApiSuccess(HostelData, "Hostel details");
      setSyncProgress(40);
      sethostelData(HostelData);
      localStorage.setItem("hostel", JSON.stringify(HostelData));
      appendSyncLine("Hostel details reloaded successfully", "success");
      setSyncProgress(100);
      setIsReloading(false);
      closeSyncSession();
    } catch (err) {
      console.error(err);
      appendSyncLine(err instanceof Error ? err.message : "Hostel details fetch failed, check console.", "error");
      setSyncProgress(0);
      closeSyncSession(4000, "error");
    }
  };



  const handleFetchMoodle = async (username = IDs.MoodleUsername, pass = IDs.MoodlePassword) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsReloading(true);
    ensureSyncSession("VTOP Sync");
    appendSyncLine("Fetching Moodle data…", "loading");
    setSyncProgress(20);
    try {
      const moodleData = await api("lms-data", {
        method: "POST",
        body: { username, pass },
      }) as any;
      assertApiSuccess(moodleData, "Moodle data");
      if (!Array.isArray(moodleData)) {
        throw new Error("Moodle data came back in an unexpected shape");
      }
      setSyncProgress(60);

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

      appendSyncLine("Moodle data fetched successfully", "success");
      setSyncProgress(100);
      setIsReloading(false);
      closeSyncSession();
    } catch (err) {
      console.error(err);
      appendSyncLine(err instanceof Error ? err.message : "Moodle Data fetch failed, check console.", "error");
      setSyncProgress(0);
      closeSyncSession(4000, "error");
    }
  };

  if (showFresherWelcome) {
    return (
      <FresherWelcomePage
        onDismiss={() => {
          localStorage.setItem("fresherWelcomeDismissed", "true");
          setShowFresherWelcome(false);
        }}
        username={IDs?.VtopUsername || ""}
        friendlyName={settings?.friendlyName || ""}
        eptData={fresherEptData}
        acknowledgementData={fresherAckData}
        resources={fresherResources}
      />
    );
  }

  if (showInterfaceOnboarding) {
    return (
      <AmazeOnboardingFlow
        initialStep={1}
        isStandaloneInterfacePicker={true}
        settings={settings}
        setSettings={setSettings}
        username={IDs?.VtopUsername}
        onComplete={() => {
          setShowInterfaceOnboarding(false);
        }}
        attendanceData={attendanceData}
        marksData={marksData}
        hostelData={hostelData}
        registeredEvents={registeredEvents}
        moodleData={moodleData}
        IDs={IDs}
        profileData={profileData}
        ODhoursData={ODhoursData}
        calendarData={calendarData}
        ScheduleData={ScheduleData}
        setGradesDisplayIsOpen={setGradesDisplayIsOpen}
        setODhoursIsOpen={setODhoursIsOpen}
        handleReloadRequest={handleReloadRequest}
        onOpenCommandPalette={onOpenCommandPalette}
      />
    );
  }

  return (
    <div
      className="w-full max-w-md md:max-w-full mx-auto overflow-visible"
    >
      <NavigationTabs
        activeTab={activeTab}
        onCollapseScreenChange={onCollapseScreenChange}
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
          setSettings(prev => {
            const next = { ...prev, currSemesterID: val };
            localStorage.setItem("settings", JSON.stringify(next));
            return next;
          });
        }}
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
        activeToolsSubTab={activeToolsSubTab}
        setActiveToolsSubTab={setActiveToolsSubTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        HostelActiveSubTab={HostelActiveSubTab}
        setHostelActiveSubTab={setHostelActiveSubTab}
        activeDayscholarSubTab={activeDayscholarSubTab}
        setActiveDayscholarSubTab={setActiveDayscholarSubTab}
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
              onClick={handleSyncClick}
              className={`p-2.5 rounded-full transition-colors shadow-sm ${
                isOffline
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                  : "bg-info-surface text-info hover:bg-info-surface"
              }`}
              title={isOffline ? "You're offline — tap for details" : "Reload Data"}
              aria-label={isOffline ? "Offline — tap for details" : "Reload Data"}
            >
              {isOffline ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <RefreshCcw className={`w-5 h-5 ${isSpinning ? "animate-spin" : ""}`} />
              )}
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
            setSettings(prev => {
              const next = { ...prev, CGPAHidden: val };
              localStorage.setItem("settings", JSON.stringify(next));
              return next;
            });
          }}
          attendancePercentageOrString={settings.attendancePercentageOrString}
          setAttendancePercentageOrString={(val: string) => {
            setSettings(prev => {
              const next = { ...prev, attendancePercentageOrString: val };
              localStorage.setItem("settings", JSON.stringify(next));
              return next;
            });
          }}
          onOpenFeedbackStatus={() => setShowFeedbackStatus(true)}
        />
        </div>



        <AnimatePresence>
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
        </AnimatePresence>

        <PushPromptModal UserID={IDs?.VtopUsername} />
        <ChangelogModal />
        <FeedbackStatusModal isOpen={showFeedbackStatus} onClose={() => setShowFeedbackStatus(false)} loginToVTOP={loginToVTOP} />
        <div className="px-6 py-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {activeTab === "home" && (
            <div>
              {settings?.dashboardViewMode === "classic" ? (
                <MobileHome
                  attendanceData={attendanceData}
                  marksData={marksData}
                  scheduleData={ScheduleData}
                  handleScheduleFetch={handleSyncClick}
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
                  setActiveProfileSubTab={setActiveProfileSubTab}
                  handleReloadRequest={handleReloadRequest}
                  onOpenCommandPalette={onOpenCommandPalette}
                  profileData={profileData}
                  ODhoursData={ODhoursData}
                />
              ) : (
                <SimplifiedMobileHome
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
                  setActiveProfileSubTab={setActiveProfileSubTab}
                  setActiveToolsSubTab={setActiveToolsSubTab}
                  handleReloadRequest={handleReloadRequest}
                  onOpenCommandPalette={onOpenCommandPalette}
                  profileData={profileData}
                  ODhoursData={ODhoursData}
                  calendarData={calendarData}
                  ScheduleData={ScheduleData}
                  setGradesDisplayIsOpen={setGradesDisplayIsOpen}
                  setODhoursIsOpen={setODhoursIsOpen}
                />
              )}
            </div>
          )}

          {activeTab === "attendance" && attendanceData?.attendance && (
            <div className="animate-fadeIn">



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
                    setActiveTab={setActiveTab}
                    setActiveSubTab={setActiveSubTab}
                  />
                </>
              )}

              {activeAttendanceSubTab === "calendar" && (
                <div className="animate-fadeIn">
                  <CalendarSubpage
                    calendars={calendarData?.calendars}
                    calendarType={settings.calendarType}
                    handleCalendarFetch={handleCalendarFetch}
                    moodleData={moodleData}
                    scheduleData={ScheduleData}
                    attendanceData={attendanceData}
                    ODhoursData={ODhoursData}
                    handleFetchMoodle={handleFetchMoodle}
                    IDs={IDs}
                    currSemesterID={settings.currSemesterID}
                    targetAttendance={settings.targetAttendance}
                    onOpenCirculars={() => setActiveAttendanceSubTab("circulars")}
                    onOpenCourse={(courseCode) => {
                      // The same target mechanism `CourseDashboard` already reads,
                      // and the one the other attendance screens use. It lands on
                      // the course's overview, which is that course's own page and
                      // already carries its marks and attendance as carousels.
                      // `"attendance"` looks like the obvious value but is a
                      // legacy deep-link that remaps to a log *inside* the
                      // overview, not a page of its own.
                      setCourseDashboardTarget({ courseCode, targetTab: "overview" });
                      setActiveTab("academics");
                      setActiveSubTab("course-dashboard");
                    }}
                    onBack={onSystemBack}
                  />
                </div>
              )}

              {activeAttendanceSubTab === "circulars" && (
                <div className="animate-fadeIn">
                  <CircularsTab loginToVTOP={loginToVTOP} onBack={() => setActiveAttendanceSubTab("calendar")} />
                </div>
              )}

              {activeAttendanceSubTab === "predictor" && (
                <div className="animate-fadeIn">
                  {(() => {
                    const { results, impDates } = buildMilestoneDates(calendarData);
                    return (
                      <OverallAttendancePredictor
                        attendanceData={attendanceData.attendance}
                        analyzeCalendars={results}
                        dayCardsMap={buildAttendanceDayCardsMap(
                          attendanceData.attendance,
                          undefined,
                          (typeof window !== "undefined" ? localStorage.getItem("saturday_timetable_override") : null) || "SAT"
                        )}
                        impDates={impDates}
                        isDayscholarWithBus={settings.isDayscholarWithBus}
                        decimalValues={settings.decimalValues}
                        // `onSystemBack`, not a subtab setter. Setting the state
                        // directly changes `screenKey`, which makes Main push a
                        // *new* history entry instead of consuming the one the
                        // predictor arrived on — so the next system-back landed on
                        // the predictor again, and the stack mirror drifted until
                        // the app let go of the history and exited.
                        onBack={onSystemBack}
                      />
                    );
                  })()}
                </div>
              )}

              {activeAttendanceSubTab === "od" && (
                <div className="animate-fadeIn">
                  <ODTrackerSubpage
                    ODhoursData={ODhoursData}
                    attendanceData={attendanceData?.attendance}
                    onBack={onSystemBack}
                    currSemesterID={settings?.currSemesterID}
                    allGradesData={allGradesData}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "academics" && (
            <div className="animate-fadeIn">
              {(activeSubTab === "courses-simplified" || activeSubTab === "simplified-academics" || activeSubTab === "overview" || activeSubTab === "course-dashboard") && (
                marksData ? (
                  <CourseDashboard
                    marksData={marksData}
                    allGradesData={allGradesData}
                    pastSemesterData={pastSemesterData}
                    attendanceData={attendanceData}
                    loginToVTOP={loginToVTOP}
                    setActiveSubTab={setActiveSubTab}
                    calendars={calendarData?.calendars}
                    decimalValues={settings.decimalValues}
                    isDayscholarWithBus={settings.isDayscholarWithBus}
                    targetCourseCode={courseDashboardTarget?.courseCode}
                    targetTab={courseDashboardTarget?.targetTab}
                    onClearTarget={() => setCourseDashboardTarget(null)}
                  />
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
                  <MarksHistoryTab
                    data={allGradesData}
                    marksData={marksData}
                    gradesData={GradesData}
                    pastSemesters={pastSemesterData}
                    onRefresh={handleAllGradesFetch}
                    onBack={() => setActiveSubTab("overview")}
                  />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {(activeSubTab === "curriculum" || activeSubTab === "cgpa-predictor") && (
                marksData ? (
                  <CurriculumPage
                    marksData={marksData}
                    allGradesData={allGradesData}
                    gradesData={GradesData}
                    attendance={attendanceData.attendance}
                    handleFetchGrades={handleAllGradesFetch}
                    setActiveSubTab={setActiveSubTab}
                    loginToVTOP={loginToVTOP}
                    /* Same page, opened drilled in. The CGPA predictor used to be
                       a standalone Tools subpage with its own route; the planner
                       screen is that feature now, so anything that still asks for
                       it by subtab lands straight on it. */
                    initialScreen={activeSubTab === "cgpa-predictor" ? "planner" : undefined}
                  />
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                    <div className="h-36 w-full bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                  </div>
                )
              )}
              {activeSubTab === "schedule" && (
                <div className="animate-fadeIn">
                  <ExamSchedule
                    data={ScheduleData}
                    handleScheduleFetch={handleSyncClick}
                    onBack={() => setActiveSubTab("courses-simplified")}
                  />
                </div>
              )}
              {activeSubTab === "marks-predictor" && (
                <div className="animate-fadeIn">
                  <MarksPredictorTab
                    marksData={marksData}
                    attendance={attendanceData?.attendance}
                    setActiveSubTab={setActiveSubTab}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "tools" && (
            <div className="animate-fadeIn">
              <ToolsTab
marksData={marksData}
                allGradesData={allGradesData}
                attendanceData={attendanceData}
                loginToVTOP={loginToVTOP}
                IDs={IDs}
                activeToolsSubTab={activeToolsSubTab}
                setActiveToolsSubTab={setActiveToolsSubTab}
                setActiveTab={setActiveTab}
                onSystemBack={onSystemBack}
                calendarData={calendarData}
                decimalValues={settings.decimalValues}
                isDayscholarWithBus={settings.isDayscholarWithBus}
              />
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
                <PaymentsTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />
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
            <CabShareTab onBack={onSystemBack} />
          )}

          {/* BusFinder owns its own page chrome now, so the header and the
              refresh button it used to duplicate here are gone — the refresh is
              the shell's action slot. */}
          {activeTab === "dayscholar" && (
            <BusFinder
              buses={dayscholarBuses}
              transportData={transportData}
              transportLoading={transportLoading}
              loginToVTOP={loginToVTOP}
              onRefresh={refreshTransportBuses}
              refreshing={transportBusesLoading}
              onBack={onSystemBack}
            />
          )}

          {activeTab === "transport" && (
            <BusFinder
              buses={transportBuses}
              transportData={transportData}
              transportLoading={transportLoading}
              loginToVTOP={loginToVTOP}
              onRefresh={refreshTransportBuses}
              refreshing={transportBusesLoading}
              onBack={onSystemBack}
            />
          )}

              {activeTab === "payments" && (
                <div className="animate-fadeIn">
                  <PaymentsTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />
                </div>
              )}

          {activeTab === "libraries" && (
            <div className="animate-fadeIn">
              <LibrariesTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />
            </div>
          )}

          {activeTab === "events" && (
            <div className="animate-fadeIn">
              <EventHubTab
                IDs={IDs}
                onBack={onSystemBack}
                setIsSubpageOpen={setIsSubpageOpen}
                registeredEvents={registeredEvents}
                setRegisteredEvents={setRegisteredEvents}
              />
            </div>
          )}

          {activeTab === "clubs" && (
            <div className="animate-fadeIn">
              <ClubHubTab IDs={IDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} />
            </div>
          )}

          {activeTab === "community" && (
            <div className="animate-fadeIn">
              <CommunityFeed IDs={IDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} />
            </div>
          )}

          {activeTab === "free-class" && (
            <div className="animate-fadeIn">
              <FreeClassroomsTab onBack={onSystemBack} />
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
                  setSettings(prev => {
                    const next = { ...prev, currSemesterID: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}
                handleLogin={handleLogin}
                setIsReloading={setIsReloading}
                handleLogOutRequest={handleLogOutRequest}
                password={IDs.VtopPassword}
                username={IDs.VtopUsername}
                setPassword={(val: string[]) =>{
                  setIDs(prev => {
                    const next = { ...prev, VtopUsername: val[0], VtopPassword: val[1] };
                    localStorage.setItem("IDs", JSON.stringify(next));
                    return next;
                  });
                }}
                decimalValues={settings.decimalValues}
                setDecimalValues={(val: boolean) => {
                  setSettings(prev => {
                    const next = { ...prev, decimalValues: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}

                isDayscholarWithBus={settings.isDayscholarWithBus}
                setIsDayscholarWithBus={(val: boolean) => {
                  setSettings(prev => {
                    const next = { ...prev, isDayscholarWithBus: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}
                residentialStatus={settings.residentialStatus || "hosteller"}
                setResidentialStatus={(val: "hosteller" | "dayscholar") => {
                  setSettings(prev => {
                    const next = { ...prev, residentialStatus: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}
                friendlyName={settings.friendlyName}
                setFriendlyName={(val: string) => {
                  setSettings(prev => {
                    const next = { ...prev, friendlyName: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}
                calendarType={settings.calendarType}
                setCalendarType={(val: any) => {
                  setSettings(prev => {
                    const next = { ...prev, calendarType: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
                }}
                reloadAllData={settings.reloadAllData}
                setReloadAllData={(val: boolean) => {
                  setSettings(prev => {
                    const next = { ...prev, reloadAllData: val };
                    localStorage.setItem("settings", JSON.stringify(next));
                    return next;
                  });
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

export default memo(DashboardContent);
