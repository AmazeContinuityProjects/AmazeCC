"use client";
import { useState, useEffect } from "react";
import { getAssetPath } from "@/lib/utils";
import { RefreshCcw, User, CalendarCheck, Building, Bus, Menu, BookOpen, LayoutGrid, Wallet } from "lucide-react";

import { IconToggle } from "../toggle";

export default function NavigationTabs({
  activeTab,
  setActiveTab,
  handleLogOutRequest,
  handleReloadRequest,
  currSemesterID,
  setCurrSemesterID,
  handleLogin,
  setIsReloading,
  username,
  password,
  setPassword,
  settings,
  setSettings,
  attendancePercentage,
  marksData,
  ODhoursData,
  setODhoursIsOpen,
  feedbackStatus,
  setGradesDisplayIsOpen,
  activeAttendanceSubTab,
  setActiveAttendanceSubTab,
  activeSubTab,
  setActiveSubTab,
  HostelActiveSubTab,
  setHostelActiveSubTab,
  activeDayscholarSubTab,
  setActiveDayscholarSubTab,
  activeQBankSubTab,
  setActiveQBankSubTab,
  activeMoreSubTab,
  setActiveMoreSubTab,
  activeProfileSubTab,
  setActiveProfileSubTab,
  onOpenFeedbackStatus
}) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));

  useEffect(() => {
    const updateIcon = () => {
      const savedIcon = localStorage.getItem("app-icon") || "default";
      setCurrentIcon(getAssetPath(savedIcon === "fire" ? "/images/icons/fire.png" : "/logo.png"));
    };
    updateIcon();
    window.addEventListener("app-icon-changed", updateIcon);
    
    try {
      const stored = localStorage.getItem("profile");
      if (stored) setProfileData(JSON.parse(stored));
    } catch(e){}
    
    return () => window.removeEventListener("app-icon-changed", updateIcon);
  }, []);

  const [profileData, setProfileData] = useState<any>(null);
  const isHosteller = profileData?.isHosteller;

  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum, day) => sum + day.total, 0)
      : 0;

  const handleReloadClick = async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    setTimeout(() => setIsSpinning(false), 600);
  };

  const navItemClass = (isActive) => 
    `flex flex-col md:flex-row items-center justify-center flex-1 md:flex-none w-full py-2 md:py-4 ${settings.isSidebarCollapsed ? 'md:px-0 md:justify-center' : 'md:px-6 md:justify-start'} space-y-1 md:space-y-0 ${settings.isSidebarCollapsed ? 'md:space-x-0' : 'md:space-x-4'} transition-colors cursor-pointer md:border-l-4 rounded-full md:rounded-none ${
      isActive 
        ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 bg-blue-50/50 dark:bg-slate-800/50 midnight:bg-gray-900/50 border-transparent md:border-blue-600 dark:md:border-blue-400" 
        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 midnight:text-gray-400 midnight:hover:text-gray-200 border-transparent"
    }`;

  return (
    <>


      {/* Main Container */}
      <div 
        className={`fixed bottom-6 md:top-4 left-4 right-4 md:left-4 md:right-auto z-40 flex items-center md:items-start justify-around md:justify-start w-auto ${settings.isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} md:h-[calc(100vh-2rem)] md:flex-col bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.02] backdrop-blur-2xl border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] midnight:shadow-[0_8px_30px_rgba(255,255,255,0.05)] rounded-full md:rounded-3xl overflow-y-auto transition-all duration-300 py-1 md:py-0 px-2 md:px-0`}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Desktop Sidebar Profile / Stats Area */}
        <div className={`hidden md:flex flex-col w-full p-4 mb-2 border-b border-gray-200 dark:border-gray-800 midnight:border-gray-800 pt-6 ${settings.isSidebarCollapsed ? 'items-center' : ''}`}>
          {settings.isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-4 w-full mb-4">
              <img src={currentIcon} alt="Logo" className="w-8 h-8 rounded-lg object-contain shadow-sm" />
              <button 
                onClick={() => {
                  setSettings(prev => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
                  localStorage.setItem("settings", JSON.stringify({ ...settings, isSidebarCollapsed: !settings.isSidebarCollapsed }));
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-800 transition-colors flex items-center justify-center"
                title="Toggle Sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col w-full mb-4">
              <div className="flex justify-between items-start w-full">
                <div className="flex flex-col items-start gap-2">
                  <img src={currentIcon} alt="Logo" className="w-8 h-8 rounded-lg object-contain shadow-sm" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white tracking-tight">AmazeCC</h2>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 pt-1">
                  <button 
                    onClick={() => {
                      setSettings(prev => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
                      localStorage.setItem("settings", JSON.stringify({ ...settings, isSidebarCollapsed: !settings.isSidebarCollapsed }));
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-800 transition-colors flex items-center justify-center"
                    title="Toggle Sidebar"
                  >
                    <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button 
                    onClick={handleReloadClick}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-800 transition-colors flex items-center justify-center"
                    title="Reload Data"
                  >
                    <RefreshCcw className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${isSpinning ? "animate-spin" : ""}`} />
                  </button>
                  <button 
                    onClick={() => setActiveTab("profile")}
                    className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-800 transition-colors flex items-center justify-center ${activeTab === "profile" ? "bg-blue-50 dark:bg-slate-800/50 midnight:bg-gray-900/50" : ""}`}
                    title="Profile"
                  >
                    <User className={`w-4 h-4 ${activeTab === "profile" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Compact Stats Grid - Small Cards */}
          {!settings.isSidebarCollapsed && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
            {/* CGPA */}
            <div 
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-800 midnight:border-gray-700 cursor-pointer hover:shadow-sm transition-all group" 
              onClick={() => setSettings(prev => ({...prev, CGPAHidden: !prev.CGPAHidden}))}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 font-medium">CGPA</span>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 group-hover:text-blue-500 transition-colors">
                {settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}
              </span>
            </div>

            {/* Attendance */}
            <div 
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-800 midnight:border-gray-700 cursor-pointer hover:shadow-sm transition-all group"
              onClick={() => setSettings(prev => ({ ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" }))}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 font-medium">Att.</span>
              <span className={`font-bold text-sm ${attendancePercentage?.percentage < 75 ? "text-red-500" : "text-green-500 dark:text-green-400"}`}>
                {attendancePercentage?.[settings.attendancePercentageOrString] || "-"}
                {settings.attendancePercentageOrString === "percentage" ? "%" : ""}
              </span>
            </div>

            {/* OD Hours */}
            <div 
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-800 midnight:border-gray-700 cursor-pointer hover:shadow-sm transition-all group" 
              onClick={() => setODhoursIsOpen(true)}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 font-medium">OD Hrs</span>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 group-hover:text-blue-500 transition-colors">
                {totalODHours}/40
              </span>
            </div>

            {/* Credits */}
            <div 
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-800 midnight:border-gray-700 cursor-pointer hover:shadow-sm transition-all group" 
              onClick={() => setGradesDisplayIsOpen(true)}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 font-medium">Credits</span>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 group-hover:text-blue-500 transition-colors">
                {marksData?.cgpa ? Number(marksData.cgpa.creditsEarned) + Number(marksData.cgpa.nonGradedRequirement || 0) : "-"}
              </span>
            </div>
          </div>

          {feedbackStatus && (
            <div onClick={onOpenFeedbackStatus} className="flex flex-col mt-2 pt-3 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/30 midnight:hover:bg-gray-800/30 rounded-lg px-2 -mx-2 transition-colors">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Feedback</span>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">Mid Sem</span>
                <span className={`text-[11px] font-bold ${feedbackStatus?.MidSem?.Curriculum && feedbackStatus?.MidSem?.Course ? "text-green-500" : "text-red-500"}`}>
                  {feedbackStatus?.MidSem?.Curriculum && feedbackStatus?.MidSem?.Course ? "Given" : "Pending"}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-500">End Sem</span>
                <span className={`text-[11px] font-bold ${feedbackStatus?.EndSem?.Curriculum && feedbackStatus?.EndSem?.Course ? "text-green-500" : "text-red-500"}`}>
                  {feedbackStatus?.EndSem?.Curriculum && feedbackStatus?.EndSem?.Course ? "Given" : "Pending"}
                </span>
              </div>
              <span className="text-[10px] text-blue-500 font-medium mt-1.5 text-center">View all semesters →</span>
              </div>
            )}
            </>
          )}
        </div>

        <button
          onClick={() => setActiveTab("attendance")}
          className={navItemClass(activeTab === "attendance")}
          title="Attendance"
        >
          <CalendarCheck className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Attendance</span>
        </button>
        {activeTab === "attendance" && !settings.isSidebarCollapsed && (
          <div className="hidden md:flex flex-col w-full pl-12 pr-4 py-1 space-y-1 bg-white dark:bg-slate-900 midnight:bg-black">
            <button
              onClick={() => setActiveAttendanceSubTab("attendance")}
              className={`text-left text-sm py-1.5 transition-colors ${activeAttendanceSubTab === "attendance" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveAttendanceSubTab("calendar")}
              className={`text-left text-sm py-1.5 transition-colors ${activeAttendanceSubTab === "calendar" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Calendar
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setActiveTab("academics");
            if (activeSubTab !== "overview") setActiveSubTab("overview");
            window.scrollTo(0, 0);
          }}
          className={navItemClass(activeTab === "academics")}
          title="Academics"
        >
          <BookOpen className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Academics</span>
        </button>
        {activeTab === "academics" && !settings.isSidebarCollapsed && (
          <div className="hidden md:flex flex-col w-full pl-12 pr-4 py-1 space-y-1 bg-white dark:bg-slate-900 midnight:bg-black">
            <button
              onClick={() => setActiveSubTab("overview")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "overview" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveSubTab("course-dashboard")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "course-dashboard" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Course Dashboard
            </button>
            <button
              onClick={() => setActiveSubTab("grades")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "grades" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Grade History
            </button>
            <button
              onClick={() => setActiveSubTab("curriculum")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "curriculum" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Curriculum
            </button>
            <button
              onClick={() => setActiveSubTab("predictor")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "predictor" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              CGPA Predictor
            </button>
            <button
              onClick={() => setActiveSubTab("qbank")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "qbank" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Question Bank
            </button>
            <div className="border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 my-1.5" />
            <button
              onClick={() => setActiveSubTab("arrear")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "arrear" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Arrear
            </button>
            <button
              onClick={() => setActiveSubTab("makeup-compre")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "makeup-compre" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Makeup & Compre
            </button>
            <button
              onClick={() => setActiveSubTab("course-mgmt")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "course-mgmt" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Course Mgmt
            </button>
            <button
              onClick={() => setActiveSubTab("projects")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "projects" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveSubTab("wishlist")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "wishlist" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Wishlist
            </button>
            <button
              onClick={() => setActiveSubTab("faculty-info")}
              className={`text-left text-sm py-1.5 transition-colors ${activeSubTab === "faculty-info" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Faculty Info
            </button>

          </div>
        )}


        <button
          onClick={() => setActiveTab("payments")}
          className={navItemClass(activeTab === "payments")}
          title="Payments"
        >
          <Wallet className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Payments</span>
        </button>

        <button
          onClick={() => setActiveTab("libraries")}
          className={navItemClass(activeTab === "libraries")}
          title="Libraries"
        >
          <BookOpen className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Libraries</span>
        </button>

        {isHosteller === true && (
          <>
            <button
              onClick={() => setActiveTab("hostel")}
              className={navItemClass(activeTab === "hostel")}
              title="Hostel"
            >
              <Building className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
              <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Hostel</span>
            </button>
            {activeTab === "hostel" && !settings.isSidebarCollapsed && (
              <div className="hidden md:flex flex-col w-full pl-12 pr-4 py-1 space-y-1 bg-white dark:bg-slate-900 midnight:bg-black">
                <button
                  onClick={() => setHostelActiveSubTab("mess")}
                  className={`text-left text-sm py-1.5 transition-colors ${HostelActiveSubTab === "mess" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
                >
                  Mess
                </button>
                <button
                  onClick={() => setHostelActiveSubTab("laundry")}
                  className={`text-left text-sm py-1.5 transition-colors ${HostelActiveSubTab === "laundry" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
                >
                  Laundry
                </button>
                <button
                  onClick={() => setHostelActiveSubTab("leave")}
                  className={`text-left text-sm py-1.5 transition-colors ${HostelActiveSubTab === "leave" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
                >
                  Leave
                </button>
                <button
                  onClick={() => setHostelActiveSubTab("counselling")}
                  className={`text-left text-sm py-1.5 transition-colors ${HostelActiveSubTab === "counselling" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
                >
                  Counselling
                </button>
              </div>
            )}
          </>
        )}

        {settings.isDayscholarWithBus && (
            <button
              onClick={() => setActiveTab("dayscholar")}
              className={navItemClass(activeTab === "dayscholar")}
              title="Bus Info"
            >
              <Bus className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
              <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Bus Info</span>
            </button>
        )}
        <button
          onClick={() => setActiveTab("more")}
          className={navItemClass(activeTab === "more")}
          title="More"
        >
          <LayoutGrid className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>More</span>
        </button>
        {activeTab === "more" && !settings.isSidebarCollapsed && (
          <div className="hidden md:flex flex-col w-full pl-12 pr-4 py-1 space-y-1 bg-white dark:bg-slate-900 midnight:bg-black">
            <button
              onClick={() => setActiveMoreSubTab("social")}
              className={`text-left text-sm py-1.5 transition-colors ${activeMoreSubTab === "social" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Social
            </button>
            <button
              onClick={() => setActiveMoreSubTab("ffcs")}
              className={`text-left text-sm py-1.5 transition-colors ${activeMoreSubTab === "ffcs" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              FFCS Planner
            </button>
            <button
              onClick={() => setActiveMoreSubTab("events")}
              className={`text-left text-sm py-1.5 transition-colors ${activeMoreSubTab === "events" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Event Hub
            </button>
          </div>
        )}

        <button
          onClick={() => setActiveTab("profile")}
          className={navItemClass(activeTab === "profile")}
          title="Profile"
        >
          <User className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
          <span className={`hidden md:block text-[10px] md:text-sm font-medium ${settings.isSidebarCollapsed ? '!hidden' : ''}`}>Profile</span>
        </button>
        {activeTab === "profile" && !settings.isSidebarCollapsed && (
          <div className="hidden md:flex flex-col w-full pl-12 pr-4 py-1 space-y-1 bg-white dark:bg-slate-900 midnight:bg-black">
            <button
              onClick={() => setActiveProfileSubTab("info")}
              className={`text-left text-sm py-1.5 transition-colors ${activeProfileSubTab === "info" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              My Info
            </button>
            <button
              onClick={() => setActiveProfileSubTab("credentials")}
              className={`text-left text-sm py-1.5 transition-colors ${activeProfileSubTab === "credentials" ? "text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-medium" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"}`}
            >
              Credentials
            </button>
          </div>
        )}

        <div className="hidden md:block w-full flex-grow"></div>

      </div>
    </>
  );
}
