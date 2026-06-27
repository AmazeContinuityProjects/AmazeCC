"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { getAssetPath } from "@/lib/utils";
import {
  BookOpen,
  Building,
  CalendarCheck,
  ChevronRight,
  Command,
  CreditCard,
  GraduationCap,
  Home,
  Library,
  LayoutGrid,
  Lock,
  Menu,
  RefreshCcw,
  Settings,
  User,
  Wrench,
  Calendar,
  Compass,
  ArrowLeft,
  Bus,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onSelect: () => void;
  isExpandable?: boolean;
};

type Group = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const navButtonBase =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";

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
  onOpenFeedbackStatus,
  onOpenCommandPalette
}: any) {
  // Suppress unused warnings to comply with ESLint configurations
  void handleLogOutRequest;
  void setCurrSemesterID;
  void handleLogin;
  void setIsReloading;
  void password;
  void setPassword;
  void activeDayscholarSubTab;
  void setActiveDayscholarSubTab;
  void activeQBankSubTab;
  void setActiveQBankSubTab;
  void feedbackStatus;
  void onOpenFeedbackStatus;

  const sidebarRef = useRef<HTMLElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));
  const [profileData, setProfileData] = useState<any>(null);
  
  // Progressive disclosure
  const [expandedGroup, setExpandedGroup] = useState<string>("study");
  const [showAcademicsPanel, setShowAcademicsPanel] = useState(activeTab === "academics");
  const [showHostelPanel, setShowHostelPanel] = useState(activeTab === "hostel");
  const [activeRailGroup, setActiveRailGroup] = useState<string | null>(null);

  // Theme settings (next-themes)
  const { theme, setTheme } = useTheme();
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);

  // Expanded mode depends on settings
  const isExpandedMode = !settings.isSidebarCollapsed;
  const isOpen = isExpandedMode;

  // Command palette logic
  const openCommandPalette = useCallback(() => {
    onOpenCommandPalette?.();
    setActiveRailGroup(null);
  }, [onOpenCommandPalette]);

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
    } catch (e) {}

    return () => {
      window.removeEventListener("app-icon-changed", updateIcon);
    };
  }, []);

  // Update expandedGroup and subpanels when activeTab changes
  useEffect(() => {
    if (activeTab === "academics") {
      setShowAcademicsPanel(true);
      setShowHostelPanel(false);
      setExpandedGroup("study");
    } else if (activeTab === "hostel") {
      setShowHostelPanel(true);
      setShowAcademicsPanel(false);
      setExpandedGroup("campus");
    } else {
      setShowAcademicsPanel(false);
      setShowHostelPanel(false);
      if (activeTab === "attendance") {
        setExpandedGroup("study");
      } else if (["payments", "libraries", "dayscholar"].includes(activeTab)) {
        setExpandedGroup("campus");
      } else if (activeTab === "more") {
        setExpandedGroup("tools");
      } else if (activeTab === "profile") {
        setExpandedGroup("account");
      }
    }
  }, [activeTab]);

  // Handle clicking outside the rail popover in compact mode
  useEffect(() => {
    if (!activeRailGroup) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sidebarRef.current?.contains(target) || flyoutRef.current?.contains(target)) return;
      setActiveRailGroup(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [activeRailGroup]);

  // Close rail popover if expanded state changes
  useEffect(() => {
    if (isOpen) {
      setActiveRailGroup(null);
    }
  }, [isOpen]);

  const isHosteller = profileData?.isHosteller;
  const residentialStatus = settings?.residentialStatus;

  // Semester Summary Data Calculations
  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum: number, day: any) => sum + day.total, 0)
      : 0;
  const credits = marksData?.cgpa
    ? Number(marksData.cgpa.creditsEarned) + Number(marksData.cgpa.nonGradedRequirement || 0)
    : "-";
  const attendanceValue = `${attendancePercentage?.[settings.attendancePercentageOrString] || "-"}${
    settings.attendancePercentageOrString === "percentage" ? "%" : ""
  }`;

  const profileName = settings.friendlyName || profileData?.name || username || "Student";
  const initials = String(profileName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const persistSidebarState = useCallback((nextCollapsed: boolean) => {
    setSettings(prev => ({ ...prev, isSidebarCollapsed: nextCollapsed }));
    localStorage.setItem("settings", JSON.stringify({ ...settings, isSidebarCollapsed: nextCollapsed }));
  }, [setSettings, settings]);

  const handleReloadClick = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    window.setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const selectTab = useCallback((tab: string) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }, [setActiveTab]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroup(current => (current === groupId ? "" : groupId));
  }, []);

  const toggleRailPopover = useCallback((groupId: string) => {
    setActiveRailGroup(current => (current === groupId ? null : groupId));
  }, []);

  const handleThemeChange = (selectedTheme: string) => {
    setTheme(selectedTheme);
  };

  // Keyboard navigation
  const handleNavKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
      return;
    }
    if (event.key === "Escape") {
      setActiveRailGroup(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-nav='true']"));
      const index = buttons.indexOf(event.currentTarget);
      const next = event.key === "ArrowDown" ? buttons[index + 1] : buttons[index - 1];
      next?.focus();
    }
  }, []);

  // Navigation Items Memoization
  const studyItems = useMemo<NavItem[]>(() => [
    {
      id: "attendance",
      label: "Attendance",
      icon: CalendarCheck,
      isActive: activeTab === "attendance" && activeAttendanceSubTab === "attendance",
      onSelect: () => {
        selectTab("attendance");
        setActiveAttendanceSubTab("attendance");
      },
    },
    {
      id: "calendar",
      label: "Timetable Calendar",
      icon: Calendar,
      isActive: activeTab === "attendance" && activeAttendanceSubTab === "calendar",
      onSelect: () => {
        selectTab("attendance");
        setActiveAttendanceSubTab("calendar");
      },
    },
    {
      id: "academics",
      label: "Academics",
      icon: GraduationCap,
      isActive: activeTab === "academics",
      isExpandable: true,
      onSelect: () => {
        selectTab("academics");
        if (!activeSubTab) setActiveSubTab("overview");
        setShowAcademicsPanel(true);
      },
    },
  ], [activeTab, activeAttendanceSubTab, activeSubTab, selectTab, setActiveAttendanceSubTab, setActiveSubTab]);

  const campusItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        id: "payments",
        label: "Payments",
        icon: CreditCard,
        isActive: activeTab === "payments",
        onSelect: () => selectTab("payments"),
      },
      {
        id: "libraries",
        label: "Libraries",
        icon: Library,
        isActive: activeTab === "libraries",
        onSelect: () => selectTab("libraries"),
      },
    ];

    if (isHosteller === true || residentialStatus === "hosteller") {
      items.push({
        id: "hostel",
        label: "Hostel",
        icon: Home,
        isActive: activeTab === "hostel",
        isExpandable: true,
        onSelect: () => {
          selectTab("hostel");
          if (!HostelActiveSubTab) setHostelActiveSubTab("overview");
          setShowHostelPanel(true);
        },
      });
    } else if (isHosteller === false || residentialStatus === "dayscholar") {
      items.push({
        id: "dayscholar",
        label: "Bus Finder",
        icon: Bus,
        isActive: activeTab === "dayscholar",
        onSelect: () => selectTab("dayscholar"),
      });
    }

    return items;
  }, [activeTab, isHosteller, residentialStatus, selectTab, HostelActiveSubTab, setHostelActiveSubTab]);

  const toolsItems = useMemo<NavItem[]>(() => [
    {
      id: "social",
      label: "Social",
      icon: LayoutGrid,
      isActive: activeTab === "more" && activeMoreSubTab === "social",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("social");
      },
    },
    {
      id: "ffcs",
      label: "FFCS Planner",
      icon: Compass,
      isActive: activeTab === "more" && activeMoreSubTab === "ffcs",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("ffcs");
      },
    },
    {
      id: "events",
      label: "Event Hub",
      icon: Calendar,
      isActive: activeTab === "more" && activeMoreSubTab === "events",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("events");
      },
    },
  ], [activeTab, activeMoreSubTab, selectTab, setActiveMoreSubTab]);

  const accountItems = useMemo<NavItem[]>(() => [
    {
      id: "profile-info",
      label: "My Info",
      icon: User,
      isActive: activeTab === "profile" && activeProfileSubTab === "info",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("info");
      },
    },
  ], [activeTab, activeProfileSubTab, selectTab, setActiveProfileSubTab]);

  const groups = useMemo<Group[]>(() => [
    { id: "study", label: "Study", icon: BookOpen, items: studyItems },
    { id: "campus", label: "Campus", icon: Building, items: campusItems },
    { id: "tools", label: "Tools", icon: Wrench, items: toolsItems },
    { id: "account", label: "Account", icon: Settings, items: accountItems },
  ], [studyItems, campusItems, toolsItems, accountItems]);

  const academicsItems = useMemo(() => [
    {
      id: "overview",
      label: "Overview",
      isActive: activeTab === "academics" && activeSubTab === "overview",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("overview");
      },
    },
    {
      id: "course-dashboard",
      label: "Course Dashboard",
      isActive: activeTab === "academics" && activeSubTab === "course-dashboard",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("course-dashboard");
      },
    },
    {
      id: "grades",
      label: "Grade History",
      isActive: activeTab === "academics" && activeSubTab === "grades",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("grades");
      },
    },
    {
      id: "curriculum",
      label: "Curriculum",
      isActive: activeTab === "academics" && activeSubTab === "curriculum",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("curriculum");
      },
    },
    {
      id: "predictor",
      label: "CGPA Predictor",
      isActive: activeTab === "academics" && activeSubTab === "predictor",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("predictor");
      },
    },
    {
      id: "qbank",
      label: "Question Bank",
      isActive: activeTab === "academics" && activeSubTab === "qbank",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("qbank");
      },
    },
    {
      id: "projects",
      label: "Projects",
      isActive: activeTab === "academics" && activeSubTab === "projects",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("projects");
      },
    },
    {
      id: "wishlist",
      label: "Wishlist",
      isActive: activeTab === "academics" && activeSubTab === "wishlist",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("wishlist");
      },
    },
    {
      id: "faculty-info",
      label: "Faculty",
      isActive: activeTab === "academics" && activeSubTab === "faculty-info",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("faculty-info");
      },
    },
    {
      id: "course-mgmt",
      label: "Course Management",
      isActive: activeTab === "academics" && activeSubTab === "course-mgmt",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("course-mgmt");
      },
    },
    {
      id: "arrear",
      label: "Arrear",
      isActive: activeTab === "academics" && activeSubTab === "arrear",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("arrear");
      },
    },
    {
      id: "makeup-compre",
      label: "Makeup & Compre",
      isActive: activeTab === "academics" && activeSubTab === "makeup-compre",
      onSelect: () => {
        selectTab("academics");
        setActiveSubTab("makeup-compre");
      },
    },
  ], [activeTab, activeSubTab, selectTab, setActiveSubTab]);

  const hostelSubItems = useMemo(() => [
    {
      id: "overview",
      label: "Overview",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "overview",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("overview");
      },
    },
    {
      id: "mess",
      label: "Mess Menu",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "mess",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("mess");
      },
    },
    {
      id: "laundry",
      label: "Laundry",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "laundry",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("laundry");
      },
    },
    {
      id: "leave",
      label: "Leave Management",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "leave",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("leave");
      },
    },
    {
      id: "counselling",
      label: "Counselling",
      isActive: activeTab === "hostel" && HostelActiveSubTab === "counselling",
      onSelect: () => {
        selectTab("hostel");
        setHostelActiveSubTab("counselling");
      },
    },
  ], [activeTab, HostelActiveSubTab, selectTab, setHostelActiveSubTab]);

  const renderMobileNav = () => {
    const items = [
      { id: "attendance", label: "Attendance", icon: CalendarCheck, action: () => selectTab("attendance"), active: activeTab === "attendance" },
      { id: "academics", label: "Academics", icon: GraduationCap, action: () => selectTab("academics"), active: activeTab === "academics" },
      { id: "campus", label: "Campus", icon: Building, action: () => selectTab("payments"), active: ["payments", "libraries", "hostel", "dayscholar"].includes(activeTab) },
      { id: "tools", label: "Tools", icon: Wrench, action: () => selectTab("more"), active: activeTab === "more" },
      { id: "settings", label: "Settings", icon: User, action: () => selectTab("profile"), active: activeTab === "profile" },
    ];

    return (
      <div className="fixed bottom-6 left-4 right-4 z-40 flex items-center justify-around rounded-full border border-sidebar-border bg-sidebar px-2 py-1 text-sidebar-foreground shadow-lg md:hidden">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex flex-1 flex-col items-center justify-center rounded-full py-2 text-[10px] font-semibold transition-colors ${navButtonBase} ${
                item.active ? "text-info" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 stroke-[1.9]" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {renderMobileNav()}

      <aside
        ref={sidebarRef}
        data-sidebar-root="true"
        className={`fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col overflow-visible rounded-[24px] border border-white/10 bg-sidebar text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:flex ${
          isOpen ? "w-[280px]" : "w-[72px]"
        }`}
        aria-label="Primary navigation"
      >
        {/* Sidebar Header */}
        <div className={`flex flex-col border-b border-white/10 shrink-0 ${isOpen ? "px-4 pb-4 pt-5" : "px-3 py-4"}`}>
          {/* Logo & Expand Toggle */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={currentIcon} alt="AmazeCC" className="h-7 w-7 rounded-lg object-contain shadow-xs" />
              {isOpen && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-white">AmazeCC</h2>
              )}
            </div>
            {isOpen && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReloadClick}
                  className={`relative group rounded-xl p-1.5 text-white/60 transition-all duration-300 hover:bg-white/10 hover:text-white hover:scale-105 ${navButtonBase}`}
                  title="Reload data"
                  aria-label="Reload data"
                >
                  <RefreshCcw className={`h-4 w-4 transition-transform ${isSpinning ? "animate-spin" : "group-hover:rotate-180 duration-500"}`} />
                </button>
                <button
                  onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                  className={`relative group rounded-xl p-1.5 text-white/60 transition-all duration-300 hover:bg-white/10 hover:text-white hover:scale-105 ${navButtonBase}`}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <Menu className="h-4.5 w-4.5 stroke-[1.9] transition-transform group-hover:scale-110" />
                </button>
              </div>
            )}
          </div>

          {/* Profile Section, Semester summary, & Search */}
          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.div
                key="header-expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden space-y-3"
              >
                {/* Left-aligned clean Semester Summary Card */}
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-[11px] space-y-1.5 shadow-2xs">
                  <div className="font-semibold text-white/50 tracking-wide text-[10px] uppercase">Current Semester</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
                          localStorage.setItem("settings", JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-white/10 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-white/80 hover:text-white"
                      title="Click to show/hide CGPA"
                    >
                      <span className="text-white/70">CGPA</span>
                      <span className="font-semibold text-white">{settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = { ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" };
                          localStorage.setItem("settings", JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-white/10 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-white/80 hover:text-white"
                      title="Click to toggle attendance format"
                    >
                      <span className="text-white/70">Attendance</span>
                      <span className={`font-semibold ${attendancePercentage?.percentage < 75 ? "text-rose-400" : "text-emerald-400"}`}>
                        {attendanceValue}
                      </span>
                    </button>

                    <button
                      onClick={() => setGradesDisplayIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-white/10 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-white/80 hover:text-white"
                      title="Click to view credits & grades details"
                    >
                      <span className="text-white/70">Credits</span>
                      <span className="font-semibold text-white">{credits}</span>
                    </button>

                    <button
                      onClick={() => setODhoursIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-white/10 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-white/80 hover:text-white"
                      title="Click to view OD tracker details"
                    >
                      <span className="text-white/70">OD Hours</span>
                      <span className="font-semibold text-white">{totalODHours}/40</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar Input */}
                <button
                  data-sidebar-nav="true"
                  onClick={openCommandPalette}
                  onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                  className={`group flex w-full items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-left text-xs text-white/60 transition-all duration-300 hover:bg-white/10 hover:border-white/15 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:scale-[1.02] ${navButtonBase}`}
                  aria-label="Open command palette"
                >
                  <Command className="h-4 w-4 shrink-0 text-white/40 transition-colors group-hover:text-white/80" />
                  <span className="flex-1 truncate transition-colors group-hover:text-white/90">Search anything...</span>
                  <kbd className="rounded-md bg-white/10 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/70 shadow-sm transition-colors group-hover:bg-white/20 group-hover:text-white">
                    ⌘K
                  </kbd>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="header-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3.5 flex flex-col items-center gap-3 w-full"
              >
                {/* Search Icon Only */}
                <button
                  onClick={openCommandPalette}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors ${navButtonBase}`}
                  title="Search anything... (Ctrl+K)"
                >
                  <Command className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Content (Expanded Mode vs Compact Rail) */}
        {isOpen ? (
          <nav className="flex-grow overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
            <AnimatePresence initial={false} mode="wait">
              {!showAcademicsPanel && !showHostelPanel ? (
                <motion.div
                  key="primary-nav"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {groups.map((group) => {
                    const isExpanded = expandedGroup === group.id;
                    return (
                      <div key={group.id} className="space-y-1">
                        {/* Group Header with subtle line */}
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="flex w-full items-center gap-2 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
                        >
                          <span>{group.label}</span>
                          <div className="h-px bg-white/10 flex-grow" />
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                          >
                            <ChevronRight className="h-3 w-3 text-white/50" />
                          </motion.div>
                        </button>

                        {/* Group Accordion */}
                        <motion.div
                          initial={false}
                          animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="min-h-0 space-y-0.5 pt-0.5 pb-1">
                            {group.items.map((item) => {
                              const ItemIcon = item.icon;
                              const activeStyles = "bg-gradient-to-r from-sky-400/20 to-indigo-500/20 border border-sky-400/30 text-white font-bold shadow-[0_0_20px_rgba(56,189,248,0.15)]";
                              const inactiveStyles = "border border-transparent text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-1 hover:shadow-sm";
                              return (
                                <button
                                  key={item.id}
                                  data-sidebar-nav="true"
                                  onClick={item.onSelect}
                                  onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${navButtonBase} ${
                                    item.isActive ? activeStyles : inactiveStyles
                                  }`}
                                >
                                  {item.isActive && (
                                    <motion.div
                                      layoutId="active-nav-bg"
                                      className="absolute inset-0 rounded-xl bg-sky-400/10 pointer-events-none"
                                      initial={false}
                                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                  )}
                                  <ItemIcon
                                    className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${
                                      item.isActive ? "text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] scale-110" : "text-white/60 group-hover:text-white"
                                    }`}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-left transition-transform duration-300">{item.label}</span>
                                  {item.isExpandable && (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </motion.div>
              ) : showAcademicsPanel ? (
                <motion.div
                  key="academics-nav"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setShowAcademicsPanel(false)}
                    className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Academics
                      </span>
                      <div className="h-px bg-white/10 flex-grow" />
                    </div>

                    <div className="space-y-0.5">
                      {academicsItems.map((item, index) => {
                        const showDivider = index === 6;
                        const activeStyles = "bg-sky-400/15 border border-sky-400/25 text-sky-300 font-semibold shadow-2xs";
                        const inactiveStyles = "border border-transparent text-white/80 hover:bg-white/10 hover:text-white";
                        return (
                          <div key={item.id}>
                            {showDivider && (
                              <div className="my-2 border-t border-white/10" />
                            )}
                            <button
                              data-sidebar-nav="true"
                              onClick={item.onSelect}
                              onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                              className={`group relative flex w-full items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                                item.isActive ? activeStyles : inactiveStyles
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="hostel-nav"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setShowHostelPanel(false)}
                    className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Hostel Hub
                      </span>
                      <div className="h-px bg-white/10 flex-grow" />
                    </div>

                    <div className="space-y-0.5">
                      {hostelSubItems.map((item) => {
                        const activeStyles = "bg-sky-400/15 border border-sky-400/25 text-sky-300 font-semibold shadow-2xs";
                        const inactiveStyles = "border border-transparent text-white/80 hover:bg-white/10 hover:text-white";
                        return (
                          <button
                            key={item.id}
                            data-sidebar-nav="true"
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                            className={`group relative flex w-full items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                              item.isActive ? activeStyles : inactiveStyles
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        ) : (
          /* Compact Mode Rail Content */
          <div className="flex flex-1 flex-col items-center justify-start w-full mt-3">
            {/* Divider */}
            <div className="w-8 border-t border-white/10 mb-3" />

            {/* Navigation Rail Buttons */}
            <nav className="flex flex-col items-center gap-2.5 w-full" aria-label="Navigation rail">
              {groups.map(group => {
                const GroupIcon = group.icon;
                const isActive = group.id === "study"
                  ? activeTab === "attendance" || activeTab === "academics"
                  : group.id === "campus"
                  ? ["payments", "libraries", "hostel", "dayscholar"].includes(activeTab)
                  : group.id === "tools"
                  ? activeTab === "more"
                  : activeTab === "profile";

                return (
                  <div key={group.id} className="relative flex justify-center group/rail">
                    <button
                      onClick={() => toggleRailPopover(group.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 ${
                        isActive
                          ? "bg-gradient-to-tr from-sky-400/20 to-indigo-500/20 text-sky-100 border border-sky-400/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                          : "text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
                      } ${navButtonBase}`}
                      title={group.label}
                      aria-label={`Open ${group.label} menu`}
                    >
                      <GroupIcon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        )}

        {/* Profile, Theme, and Logout Footer */}
        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="footer-expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 border-t border-white/10 px-4 py-3 rounded-b-[24px] space-y-2.5"
            >
              {/* Profile Row: Name, Branch & Logout */}
              <div className="flex items-center gap-2.5">
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-white/15" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white">
                    {initials || "ST"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{profileName}</span>
                  <span className="block truncate text-[10px] text-white/60">Computer Science</span>
                </div>
                <button
                  onClick={handleLogOutRequest}
                  className={`p-1.5 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors ${navButtonBase}`}
                  title="Log out"
                  aria-label="Log out"
                >
                  <Lock className="h-4 w-4" />
                </button>
              </div>

              <div className="h-px bg-white/10" />

              {/* Theme Selection Row */}
              <div className="flex items-center justify-between text-[11px] text-white/70 px-0.5">
                <span className="font-semibold tracking-wide uppercase text-[8px] text-white/50">Theme</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`flex items-center gap-1 hover:text-white transition-colors ${theme === "light" ? "text-sky-300 font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "light" ? "border-sky-400 bg-sky-400" : "border-white/30"}`} />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex items-center gap-1 hover:text-white transition-colors ${theme === "dark" ? "text-sky-300 font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "dark" ? "border-sky-400 bg-sky-400" : "border-white/30"}`} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="footer-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 pb-4 w-full shrink-0"
            >
              {/* Expand Toggle Button */}
              <button
                onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors ${navButtonBase}`}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              {/* Theme Toggler (Compact Icon) */}
              <button
                onClick={() => handleThemeChange(theme === "dark" ? "light" : "dark")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors ${navButtonBase}`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Profile Avatar */}
              <button
                onClick={() => selectTab("profile")}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:ring-2 hover:ring-white/20 transition-all"
                title="Account Settings"
              >
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-white/15" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">
                    {initials || "ST"}
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating popover beside the compact rail */}
        <AnimatePresence>
          {activeRailGroup && (
            <motion.div
              ref={flyoutRef}
              initial={{ opacity: 0, scale: 0.95, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-[76px] top-12 z-50 w-56 rounded-2xl border border-sidebar-border bg-popover p-2 text-popover-foreground shadow-2xl"
            >
              {activeRailGroup === "account" ? (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/50 border-b border-white/10 pb-1.5 mb-1.5">
                    Account
                  </div>
                  <div className="space-y-1">
                    {/* My Info */}
                    {groups.find(g => g.id === "account")?.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          setActiveRailGroup(null);
                        }}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                          item.isActive
                            ? "bg-sky-400/15 border border-sky-400/25 text-sky-300 font-semibold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-white/60" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}

                    {/* Theme */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-white/80 hover:bg-white/10 hover:text-white`}
                      >
                        <Wrench className="h-4 w-4 shrink-0 text-white/60 group-hover:text-white" />
                        <span className="truncate flex-1 text-left">Theme</span>
                        <motion.div
                          animate={{ rotate: isThemeExpanded ? 90 : 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <ChevronRight className="h-3 w-3 text-white/50" />
                        </motion.div>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: isThemeExpanded ? "auto" : 0, opacity: isThemeExpanded ? 1 : 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pl-6 space-y-1 py-1">
                          <button
                            onClick={() => handleThemeChange("light")}
                            className="flex items-center gap-2 w-full text-left text-xs text-white/80 hover:text-white py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-sky-400 text-sky-300 bg-sky-400/15" : "border-white/30"}`}>
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-sky-300 font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-white/80 hover:text-white py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-sky-400 text-sky-300 bg-sky-400/15" : "border-white/30"}`}>
                              {theme === "dark" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "dark" ? "text-sky-300 font-medium" : ""}>Dark</span>
                          </button>
                        </div>
                      </motion.div>
                    </div>

                    {/* Log out */}
                    <button
                      onClick={() => {
                        handleLogOutRequest();
                        setActiveRailGroup(null);
                      }}
                      className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-white/70 hover:bg-white/10 hover:text-white mt-1.5 border-t border-white/10 pt-1.5"
                    >
                      <Lock className="h-4 w-4 shrink-0 text-white/60" />
                      <span className="truncate">Log out</span>
                    </button>
                  </div>
                </div>
              ) : activeRailGroup === "academics" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("study")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors border-b border-white/10 pb-1.5 mb-1.5 w-full text-left"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back to Study</span>
                  </button>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: "none" }}>
                    {academicsItems.map((item, index) => {
                      const showDivider = index === 6;
                      return (
                        <div key={item.id}>
                          {showDivider && (
                            <div className="my-1.5 border-t border-white/10" />
                          )}
                          <button
                            onClick={() => {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }}
                            className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                              item.isActive
                                ? "bg-sky-400/15 border border-sky-400/25 text-sky-300 font-semibold"
                                : "text-white/80 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeRailGroup === "hostel-sub" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("campus")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors border-b border-white/10 pb-1.5 mb-1.5 w-full text-left"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back to Campus</span>
                  </button>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: "none" }}>
                    {hostelSubItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          setActiveRailGroup(null);
                        }}
                        className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                          item.isActive
                            ? "bg-sky-400/15 border border-sky-400/25 text-sky-300 font-semibold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/50 border-b border-white/10 pb-1.5 mb-1.5">
                    {activeRailGroup === "study" && "Study"}
                    {activeRailGroup === "campus" && "Campus"}
                    {activeRailGroup === "tools" && "Tools"}
                  </div>
                  <div className="space-y-1">
                    {groups.find(g => g.id === activeRailGroup)?.items.map((item) => {
                      const activeStyles = "bg-gradient-to-r from-sky-400/20 to-indigo-500/20 border-sky-400/30 text-white font-bold shadow-[0_0_15px_rgba(56,189,248,0.1)]";
                      const inactiveStyles = "border-transparent text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-1";
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.id === "academics") {
                              setActiveRailGroup("academics");
                            } else if (item.id === "hostel") {
                              setActiveRailGroup("hostel-sub");
                            } else {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }
                          }}
                          className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 ${navButtonBase} ${
                            item.isActive ? activeStyles : inactiveStyles
                          }`}
                        >
                          <item.icon className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${item.isActive ? "text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] scale-110" : "text-white/60 group-hover:text-white"}`} />
                          <span className="truncate transition-transform duration-300">{item.label}</span>
                          {item.isExpandable && (
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-white/40" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </>
  );
}
