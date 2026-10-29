"use client";
import NavigationTabs from "./header/NavigationTabs";
import { useState, useEffect, useCallback, memo } from "react";
import { useAtom } from "jotai";
import {
  attendanceDataAtom,
  attendancePercentageAtom,
  calendarDataAtom,
  credentialsAtom,
  gradesDataAtom,
  gradesDisplayIsOpenAtom,
  hostelDataAtom,
  marksDataAtom,
  marksStatsAtom,
  moodleDataAtom,
  odHoursDataAtom,
  odHoursIsOpenAtom,
  registeredEventsAtom,
  scheduleDataAtom,
  settingsAtom,
  isReloadingAtom,
} from "@/store";
import SubpageLayout from "./shared/SubpageLayout";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";

import { useDashboardWelcomeState } from "./dashboard/useDashboardWelcomeState";
import { DashboardRoute, useDashboardNavigator } from "./dashboard/DashboardNavigator";
import { useDashboardDataActions } from "./dashboard/useDashboardDataActions";
import { useDashboardTransportState } from "./dashboard/useDashboardTransportState";

function FeatureLoading() {
  return (
    <div
      className="min-h-40 w-full rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-white/[0.08] dark:bg-zinc-950/40"
      role="status"
      aria-label="Loading section"
      aria-busy="true"
    >
      <div className="h-5 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
      <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-900" />
    </div>
  );
}

// Keep the app chrome in the dashboard chunk; feature screens are fetched only
// when their tab/subtab is selected. This keeps a signed-in home visit from
// paying the parse/execute cost for every other product area up front.
const GradesModal = dynamic(() => import("./exams/GradesModal"), { loading: FeatureLoading });
const DashboardAttendanceFeature = dynamic(() => import("./dashboard/DashboardAttendanceFeature"), { loading: FeatureLoading });
const DashboardAcademicsFeature = dynamic(() => import("./dashboard/DashboardAcademicsFeature"), { loading: FeatureLoading });
const DashboardHomeFeature = dynamic(() => import("./dashboard/DashboardHomeFeature"), { loading: FeatureLoading });
const AmazeOnboardingFlow = dynamic(() => import("./onboarding/AmazeOnboardingFlow"), { loading: FeatureLoading });
const DashboardToolsFeature = dynamic(() => import("./dashboard/DashboardToolsFeature"), { loading: FeatureLoading });
const DashboardHostelFeature = dynamic(() => import("./dashboard/DashboardHostelFeature"), { loading: FeatureLoading });
const DashboardProfileFeature = dynamic(() => import("./dashboard/DashboardProfileFeature"), { loading: FeatureLoading });
const DashboardUtilityRoutes = dynamic(() => import("./dashboard/DashboardUtilityRoutes"), { loading: FeatureLoading });
const FresherWelcomePage = dynamic(() => import("./FresherWelcomePage"), { loading: FeatureLoading });
const FeedbackStatusModal = dynamic(() => import("./profile/FeedbackStatusModal"));

function DashboardContent({
  demoMode = false,
  handleLogOutRequest,
  handleReloadRequest,
  loginToVTOP,
  handleLogin,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onSystemBack,
  onCollapseScreenChange,
  onRunSyncMode
}) {
  const [IDs, setIDs] = useAtom(credentialsAtom);
  const [attendanceData] = useAtom(attendanceDataAtom);
  const [attendancePercentage] = useAtom(attendancePercentageAtom);
  const [marksData] = useAtom(marksDataAtom);
  const [marksStats] = useAtom(marksStatsAtom);
  const [GradesData] = useAtom(gradesDataAtom);
  const [ScheduleData] = useAtom(scheduleDataAtom);
  const [hostelData] = useAtom(hostelDataAtom);
  const [calendarData] = useAtom(calendarDataAtom);
  const [moodleData] = useAtom(moodleDataAtom);
  const [registeredEvents, setRegisteredEvents] = useAtom(registeredEventsAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const [ODhoursData] = useAtom(odHoursDataAtom);
  const [ODhoursIsOpen, setODhoursIsOpen] = useAtom(odHoursIsOpenAtom);
  const [GradesDisplayIsOpen, setGradesDisplayIsOpen] = useAtom(gradesDisplayIsOpenAtom);
  const [, setIsReloading] = useAtom(isReloadingAtom);
  const {
    allGradesData,
    pastSemesterData,
    handleAllGradesFetch,
    handleCalendarFetch,
    handleFetchGrades,
    handleFetchSchedule,
    handleHostelDetailsFetch,
    handleFetchMoodle,
  } = useDashboardDataActions();
  const {
    dayscholarBuses,
    transportBuses,
    transportData,
    transportLoading,
    transportBusesLoading,
    refreshTransportBuses,
  } = useDashboardTransportState();
  const {
    courseDashboardTarget,
    setCourseDashboardTarget,
    activePageResetKey,
    selectTab,
    activeTab, setActiveTab, activeSubTab, setActiveSubTab,
    activeAttendanceSubTab, setActiveAttendanceSubTab,
    activeToolsSubTab, setActiveToolsSubTab,
    activeDayscholarSubTab, setActiveDayscholarSubTab,
    activeMoreSubTab, setActiveMoreSubTab,
    activeProfileSubTab, setActiveProfileSubTab,
    hostelActiveSubTab: HostelActiveSubTab, setHostelActiveSubTab,
    activeDay, setActiveDay,
  } = useDashboardNavigator();
  const {
    showFresherWelcome,
    setShowFresherWelcome,
    fresherEptData,
    fresherAckData,
    fresherResources,
    showInterfaceOnboarding,
    setShowInterfaceOnboarding,
  } = useDashboardWelcomeState({ demoMode, interfaceChosen: settings?.interfaceChosen });

  const [isSubpageOpen, setIsSubpageOpen] = useState(false);
  const [showFeedbackStatus, setShowFeedbackStatus] = useState(false);

  // Grades + feedback dialogs register themselves for system back via
  // BottomSheet; nothing to do here.

  const [profileData, setProfileData] = useState<any>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("profile");
      if (stored) setProfileData(JSON.parse(stored));
    } catch(e){}
  }, []);

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
      className="dashboard-shell w-full max-w-md md:max-w-full mx-auto overflow-visible"
    >
      <NavigationTabs
        activeTab={activeTab}
        onCollapseScreenChange={onCollapseScreenChange}
        setActiveTab={selectTab}
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
        feedbackStatus={(GradesData as any).feedback}
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
        className={`dashboard-content relative bg-gray-50/50  dark:bg-black min-h-[100dvh] text-gray-900  dark:text-gray-100 transition-all duration-300 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-0 ${settings.isSidebarCollapsed ? 'md:pl-24' : 'md:pl-80'} w-full overflow-x-clip`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Ambient Background Glows */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-info-surface blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/10  dark:bg-emerald-500/5 blur-[120px]" />
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

        <FeedbackStatusModal isOpen={showFeedbackStatus} onClose={() => setShowFeedbackStatus(false)} loginToVTOP={loginToVTOP} />
        <div className="px-6 py-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <DashboardRoute route="home">
            <DashboardHomeFeature
              attendanceData={attendanceData}
              marksData={marksData}
              scheduleData={ScheduleData}
              handleScheduleFetch={handleFetchSchedule}
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
              ODhoursData={ODhoursData as any}
              calendarData={calendarData}
              ScheduleData={ScheduleData}
              setGradesDisplayIsOpen={setGradesDisplayIsOpen}
              setODhoursIsOpen={setODhoursIsOpen}
            />
          </DashboardRoute>

          <DashboardRoute route="attendance" enabled={Boolean(attendanceData?.attendance)}>
            <DashboardAttendanceFeature
              activeSubTab={activeAttendanceSubTab}
              setActiveSubTab={setActiveAttendanceSubTab}
              attendanceData={attendanceData}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              calendarData={calendarData}
              scheduleData={ScheduleData}
              moodleData={moodleData}
              IDs={IDs}
              settings={settings}
              ODhoursData={ODhoursData as any}
              ODhoursIsOpen={ODhoursIsOpen}
              setODhoursIsOpen={setODhoursIsOpen}
              setIsSubpageOpen={setIsSubpageOpen}
              allGradesData={allGradesData}
              handleCalendarFetch={handleCalendarFetch}
              handleFetchMoodle={handleFetchMoodle}
              setActiveTab={setActiveTab}
              onOpenCourse={(courseCode) => {
                setCourseDashboardTarget({ courseCode, targetTab: "overview" });
                setActiveTab("academics");
                setActiveSubTab("course-dashboard");
              }}
              onSystemBack={onSystemBack}
              loginToVTOP={loginToVTOP}
              resetKey={activePageResetKey}
            />
          </DashboardRoute>

          <DashboardRoute route="academics">
            <DashboardAcademicsFeature
              activeSubTab={activeSubTab}
              setActiveSubTab={setActiveSubTab}
              marksData={marksData}
              marksStats={marksStats}
              allGradesData={allGradesData}
              gradesData={GradesData}
              attendanceData={attendanceData}
              pastSemesterData={pastSemesterData}
              calendarData={calendarData}
              scheduleData={ScheduleData}
              settings={settings}
              loginToVTOP={loginToVTOP}
              handleFetchGrades={handleAllGradesFetch}
              handleScheduleFetch={handleFetchSchedule}
              courseDashboardTarget={courseDashboardTarget}
              onClearCourseTarget={() => setCourseDashboardTarget(null)}
            />
          </DashboardRoute>

          <DashboardRoute route="tools">
            <div className="animate-fadeIn">
              <DashboardToolsFeature
marksData={marksData}
                marksStats={marksStats}
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
          </DashboardRoute>

          <DashboardRoute route="hostel">
            <DashboardHostelFeature
              activeSubTab={HostelActiveSubTab}
              setActiveSubTab={setHostelActiveSubTab}
              hostelData={hostelData}
              onFetchHostelDetails={handleHostelDetailsFetch}
              loginToVTOP={loginToVTOP}
              onSystemBack={onSystemBack}
            />
          </DashboardRoute>

          <DashboardUtilityRoutes
            onSystemBack={onSystemBack}
            dayscholarBuses={dayscholarBuses}
            transportBuses={transportBuses}
            transportData={transportData}
            transportLoading={transportLoading}
            refreshTransportBuses={refreshTransportBuses}
            transportBusesLoading={transportBusesLoading}
            IDs={IDs}
            loginToVTOP={loginToVTOP}
            setIsSubpageOpen={setIsSubpageOpen}
            registeredEvents={registeredEvents}
            setRegisteredEvents={setRegisteredEvents}
            attendanceData={attendanceData}
            isSubpageOpen={isSubpageOpen}
          />
          <DashboardRoute route="profile">
            <DashboardProfileFeature
              onOpenShortcutsHelp={onOpenShortcutsHelp}
              loginToVTOP={loginToVTOP}
              handleLogin={handleLogin}
              setIsReloading={setIsReloading}
              handleLogOutRequest={handleLogOutRequest}
              onRunSyncMode={onRunSyncMode}
              settings={settings}
              setSettings={setSettings}
              IDs={IDs}
              setIDs={setIDs}
            />
          </DashboardRoute>
        </div>
      </div>
    </div>
  );
}

export default memo(DashboardContent);
