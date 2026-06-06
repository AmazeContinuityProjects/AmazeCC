"use client";
import { Analytics } from "@vercel/analytics/next";
import NavigationTabs from "./header/NavigationTabs";
import StatsCards from "./statCards";
import GradesModal from "./Exams/GradesModal";
import AttendanceTabs from "./attendance/attendanceTabs";
import ExamsSubTabs from "./Exams/ExamSubsTab";
import MarksDisplay from "./Exams/MarksDisplay";
import ExamsScheduleDisplay from "./Exams/SchduleDisplay";
import TestGradesContainer from "./Exams/TestGradesContainer";
import CurriculumPage from "./Exams/CurriculumPage";
import HostelSubTabs from "./Hostel/HostelSubsTab";
import MessDisplay from "./Hostel/messDisplay";
import LaundryDisplay from "./Hostel/LaundryDisplay";
import AttendanceSubTabs from "./attendance/AttendanceSubsTabs";
import CalendarView from "./attendance/CalendarView";
import { useState, useEffect, useRef } from "react";
import LeaveDisplay from "./Hostel/LeaveDisplay";
import AllGradesDisplay from "./Exams/AllGradesDisplay";
import DayscholarSubTabs from "./dayscholar/DayscholarSubTabs";
import BusFinder from "./dayscholar/BusFinder";
import BusFeesDisplay from "./dayscholar/BusFeesDisplay";
import { API_BASE } from "./Main";
import MarksSubTab from "./Exams/MarksSubTab";
import { RefreshCcw } from "lucide-react";
import ScheduleSubTab from "./Exams/ScheduleSubTab";
import MoreTab from "./more/MoreTab";

import PapersArchiveTab from "./qbank/PapersArchiveTab";
import PureQBankTab from "./qbank/PureQBankTab";
import ProfilePage from "./header/ProfilePage";

<Analytics/>

export default function DashboardContent({
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
  vitolData,
  setVitolData,
  settings,
  setSettings
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSubpageOpen, setIsSubpageOpen] = useState(false);
  const hasMoved = useRef(false);
  const [resetKey, setResetKey] = useState(0);

  const [dayscholarBuses, setDayscholarBuses] = useState([]);

  useEffect(() => {
    fetch('/api/buses')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.buses) {
          setDayscholarBuses(data.buses);
        }
      })
      .catch(err => console.error("Failed to fetch buses from API:", err));
  }, []);

  const tabsOrder = ["attendance", "exams", "qbank", "hostel", "dayscholar", "more", "profile"];
  if (settings?.residentialStatus !== "dayscholar") tabsOrder.push("hostel");
  if (settings?.residentialStatus !== "hosteller") tabsOrder.push("dayscholar");

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
      />

      <div 
        className={`bg-gray-50 dark:bg-gray-900 midnight:bg-black min-h-[100dvh] text-gray-900 dark:text-gray-100 midnight:text-gray-100 transition-all duration-300 pb-24 md:pb-0 ${settings.isSidebarCollapsed ? 'md:pl-24' : 'md:pl-72'} w-full`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className={`md:hidden ${settings.hideMobileHeader && activeTab !== "attendance" ? "hidden" : ""} ${isSubpageOpen ? "hidden" : ""}`}>
          <div className="px-6 pt-6 pb-2 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white tracking-tight">AmazeCC</h2>
              <p className="text-sm text-gray-500 mt-1">
                {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, {IDs.VtopUsername}
              </p>
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
        />
        </div>

        {GradesDisplayIsOpen && (
          <GradesModal
            GradesData={GradesData}
            marksData={marksData}
            onClose={() => setGradesDisplayIsOpen(false)}
            handleFetchGrades={handleFetchGrades}
            attendance={attendanceData.attendance}
          />
        )}

        <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {activeTab === "attendance" && attendanceData?.attendance && (
            <div className="animate-fadeIn">
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
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "exams" && marksData && (
            <div className="animate-fadeIn">
              <div className="md:hidden">
                <ExamsSubTabs
                  activeSubTab={activeSubTab}
                  setActiveSubTab={setActiveSubTab}
                />
              </div>


                {activeSubTab === "marks" && <MarksSubTab data={marksData} moodleData={moodleData} handleFetchMoodle={handleFetchMoodle} setMoodleData={setMoodleData} IDs={IDs} />}
                {activeSubTab === "schedule" && <ExamsScheduleDisplay data={ScheduleData} handleScheduleFetch={handleScheduleFetch} />}
                {activeSubTab === "grades" && <TestGradesContainer data={allGradesData} marksData={marksData} gradesData={GradesData} attendance={attendanceData.attendance} handleFetchGrades={handleAllGradesFetch} />}
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
            </div>
          )}

          {activeTab === "dayscholar" && (
            <div className="animate-fadeIn">
              <div className="md:hidden">
                <DayscholarSubTabs
                  activeSubTab={activeDayscholarSubTab}
                  setActiveSubTab={setActiveDayscholarSubTab}
                />
              </div>
              {activeDayscholarSubTab === "finder" && <BusFinder buses={dayscholarBuses} />}
              {activeDayscholarSubTab === "fees" && <BusFeesDisplay />}
            </div>
          )}

          {activeTab === "more" && (
            <div className="animate-fadeIn">
              <MoreTab 
                attendanceData={attendanceData} 
                activeMoreSubTab={activeMoreSubTab} 
                setActiveMoreSubTab={setActiveMoreSubTab} 
              />
            </div>
          )}

          {activeTab === "qbank" && (
            <div className="animate-fadeIn">
              <PapersArchiveTab allGradesData={allGradesData} marksData={marksData} username={IDs.VtopUsername} />
            </div>
          )}

          {activeTab === "profile" && (
            <div className="animate-fadeIn">
              <ProfilePage
                isLoggedIn={true}
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
                residentialStatus={settings.residentialStatus}
                setResidentialStatus={(val: "hosteller" | "dayscholar") => {
                    setSettings(prev => ({ ...prev, residentialStatus: val }))
                    localStorage.setItem("settings", JSON.stringify({ ...settings, residentialStatus: val }))
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

