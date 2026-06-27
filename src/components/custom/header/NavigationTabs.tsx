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
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40";

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
  
  // Progressive disclosure: only one group expanded at a time
  const [expandedGroup, setExpandedGroup] = useState<string>("study");
  const [showAcademicsPanel, setShowAcademicsPanel] = useState(activeTab === "academics");
  const [activeRailGroup, setActiveRailGroup] = useState<string | null>(null);

  // Theme settings (next-themes)
  const { theme, setTheme } = useTheme();
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);

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

  // Update expandedGroup and showAcademicsPanel when activeTab changes (e.g. from command palette)
  useEffect(() => {
    if (activeTab === "academics") {
      setShowAcademicsPanel(true);
      setExpandedGroup("study");
    } else {
      setShowAcademicsPanel(false);
      if (activeTab === "attendance") {
        setExpandedGroup("study");
      } else if (["payments", "libraries", "hostel", "dayscholar"].includes(activeTab)) {
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
  const isExpandedMode = !settings.isSidebarCollapsed;
  useEffect(() => {
    if (isExpandedMode) {
      setActiveRailGroup(null);
    }
  }, [isExpandedMode]);

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
        onSelect: () => {
          selectTab("hostel");
          if (!HostelActiveSubTab) setHostelActiveSubTab("mess");
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
        className={`fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col overflow-visible rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-[width] duration-200 md:flex ${
          isExpandedMode ? "w-[280px]" : "w-[72px]"
        }`}
        aria-label="Primary navigation"
      >
        {/* Sidebar Header */}
        <div className={`flex flex-col border-b border-sidebar-border/40 shrink-0 ${isExpandedMode ? "px-4 pb-4 pt-5" : "px-3 py-4"}`}>
          {/* Logo & Expand Toggle */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={currentIcon} alt="AmazeCC" className="h-7 w-7 rounded-lg object-contain shadow-xs" />
              {isExpandedMode && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">AmazeCC</h2>
              )}
            </div>
            {isExpandedMode && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReloadClick}
                  className={`rounded-lg p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${navButtonBase}`}
                  title="Reload data"
                  aria-label="Reload data"
                >
                  <RefreshCcw className={`h-4 w-4 ${isSpinning ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                  className={`rounded-lg p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${navButtonBase}`}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <Menu className="h-4.5 w-4.5 stroke-[1.9]" />
                </button>
              </div>
            )}
          </div>

          {/* Profile Section, Semester summary, & Search */}
          {isExpandedMode && (
            <>
              {/* Natural Profile Display */}
              <div className="mt-3.5 flex items-center gap-2.5 px-0.5">
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-sidebar-border/20" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground">
                    {initials || "ST"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-sidebar-foreground">{profileName}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{username || "Student ID"}</span>
                </div>
              </div>

              {/* Compact Semester Summary Card */}
              <div className="mt-3 rounded-xl border border-sidebar-border/20 bg-sidebar-accent/25 p-2.5 shadow-2xs">
                <div className="grid grid-cols-4 gap-1 divide-x divide-sidebar-border/20 text-center">
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider">CGPA</span>
                    <span className="block text-xs font-semibold text-sidebar-foreground mt-0.5">
                      {settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Att.</span>
                    <span className={`block text-xs font-semibold mt-0.5 ${attendancePercentage?.percentage < 75 ? "text-danger" : "text-success"}`}>
                      {attendanceValue}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Credits</span>
                    <span className="block text-xs font-semibold text-sidebar-foreground mt-0.5">{credits}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider">OD</span>
                    <span className="block text-xs font-semibold text-sidebar-foreground mt-0.5">{totalODHours}/40</span>
                  </div>
                </div>
              </div>

              {/* Compact Search input */}
              <button
                data-sidebar-nav="true"
                onClick={openCommandPalette}
                onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                className={`mt-3 flex w-full items-center gap-2 rounded-lg border border-sidebar-border/20 bg-sidebar-accent/20 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/40 ${navButtonBase}`}
                aria-label="Open command palette"
              >
                <Command className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="flex-1 truncate text-xs">Search anything...</span>
                <kbd className="rounded bg-sidebar-accent border border-sidebar-border/40 px-1 py-0.5 text-[9px] font-medium text-muted-foreground/80">
                  {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
                </kbd>
              </button>
            </>
          )}
        </div>

        {/* Navigation Content (Expanded Mode vs Compact Rail) */}
        {isExpandedMode ? (
          <nav className="flex-1 overflow-y-auto px-3 py-4" style={{ scrollbarWidth: "none" }}>
            <AnimatePresence initial={false} mode="wait">
              {!showAcademicsPanel ? (
                <motion.div
                  key="primary-nav"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {groups.map((group, groupIdx) => {
                    const isExpanded = expandedGroup === group.id;
                    return (
                      <div key={group.id} className="space-y-1">
                        {groupIdx > 0 && <div className="border-t border-sidebar-border/10 my-2 pt-1" />}
                        {/* Group Header */}
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="flex w-full items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-sidebar-foreground transition-colors"
                        >
                          <span>{group.label}</span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                          >
                            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
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
                            {group.id === "account" ? (
                              // Render customized items for Account group
                              <div className="space-y-1">
                                {group.items.map((item) => (
                                  <button
                                    key={item.id}
                                    data-sidebar-nav="true"
                                    onClick={item.onSelect}
                                    onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                                      item.isActive
                                        ? "bg-info-surface text-info"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    }`}
                                  >
                                    {item.isActive && (
                                      <span className="absolute left-0 top-1/2 h-4.5 w-[3px] -translate-y-1/2 rounded-full bg-info" />
                                    )}
                                    <item.icon
                                      className={`h-4 w-4 shrink-0 transition-colors ${
                                        item.isActive ? "text-info" : "text-muted-foreground group-hover:text-sidebar-foreground"
                                      }`}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                  </button>
                                ))}

                                {/* Theme Row */}
                                <div className="space-y-0.5">
                                  <button
                                    onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground`}
                                  >
                                    <Wrench className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-sidebar-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-left">Theme</span>
                                    <motion.div
                                      animate={{ rotate: isThemeExpanded ? 90 : 0 }}
                                      transition={{ duration: 0.18 }}
                                    >
                                      <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                                    </motion.div>
                                  </button>

                                  <motion.div
                                    initial={false}
                                    animate={{ height: isThemeExpanded ? "auto" : 0, opacity: isThemeExpanded ? 1 : 0 }}
                                    transition={{ duration: 0.18, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pl-7 space-y-1.5 py-1">
                                      <button
                                        onClick={() => handleThemeChange("light")}
                                        className="flex items-center gap-2.5 w-full text-left text-xs text-muted-foreground/80 hover:text-sidebar-foreground py-0.5 transition-colors"
                                      >
                                        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-info text-info bg-info-surface/30" : "border-muted-foreground/35"}`}>
                                          {theme === "light" && <span className="h-1.5 w-1.5 rounded-full bg-info" />}
                                        </span>
                                        <span className={theme === "light" ? "text-info font-medium" : ""}>Light</span>
                                      </button>
                                      <button
                                        onClick={() => handleThemeChange("dark")}
                                        className="flex items-center gap-2.5 w-full text-left text-xs text-muted-foreground/80 hover:text-sidebar-foreground py-0.5 transition-colors"
                                      >
                                        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-info text-info bg-info-surface/30" : "border-muted-foreground/35"}`}>
                                          {theme === "dark" && <span className="h-1.5 w-1.5 rounded-full bg-info" />}
                                        </span>
                                        <span className={theme === "dark" ? "text-info font-medium" : ""}>Dark</span>
                                      </button>
                                    </div>
                                  </motion.div>
                                </div>

                                {/* Log out */}
                                <button
                                  onClick={handleLogOutRequest}
                                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground mt-2 border-t border-sidebar-border/10 pt-2`}
                                >
                                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-sidebar-foreground" />
                                  <span className="min-w-0 flex-1 truncate text-left">Log out</span>
                                </button>
                              </div>
                            ) : (
                              group.items.map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                  <button
                                    key={item.id}
                                    data-sidebar-nav="true"
                                    onClick={item.onSelect}
                                    onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                                      item.isActive
                                        ? "bg-info-surface text-info"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    }`}
                                  >
                                    {item.isActive && (
                                      <span className="absolute left-0 top-1/2 h-4.5 w-[3px] -translate-y-1/2 rounded-full bg-info" />
                                    )}
                                    <ItemIcon
                                      className={`h-4 w-4 shrink-0 transition-colors ${
                                        item.isActive ? "text-info" : "text-muted-foreground group-hover:text-sidebar-foreground"
                                      }`}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                    {item.isExpandable && (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </motion.div>
              ) : (
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
                    className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-muted-foreground/85 hover:text-sidebar-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/75">
                      Academics
                    </div>

                    <div className="space-y-0.5">
                      {academicsItems.map((item, index) => {
                        const showDivider = index === 6;
                        return (
                          <div key={item.id}>
                            {showDivider && (
                              <div className="my-2 border-t border-sidebar-border/20" />
                            )}
                            <button
                              data-sidebar-nav="true"
                              onClick={item.onSelect}
                              onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                              className={`group relative flex w-full items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                                item.isActive
                                  ? "bg-info-surface text-info"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              }`}
                            >
                              {item.isActive && (
                                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-info" />
                              )}
                              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        ) : (
          /* Compact Mode Rail */
          <div className="flex flex-grow flex-col items-center justify-between w-full">
            {/* Top compact section */}
            <div className="flex flex-col items-center gap-4 pt-4 w-full">
              {/* Compact Avatar */}
              <button
                onClick={() => toggleRailPopover("account")}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:ring-2 hover:ring-sidebar-border transition-all"
                title="Account Settings"
              >
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-sidebar-border/20" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                    {initials || "ST"}
                  </span>
                )}
              </button>

              {/* Compact Search icon */}
              <button
                onClick={openCommandPalette}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
                title="Search anything... (Ctrl+K)"
              >
                <Command className="h-4.5 w-4.5" />
              </button>

              <div className="w-8 border-t border-sidebar-border/20 my-1" />

              {/* Navigation Rail Buttons */}
              <nav className="flex flex-col items-center gap-3 w-full" aria-label="Navigation rail">
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
                    <button
                      key={group.id}
                      onClick={() => toggleRailPopover(group.id)}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-[color,background-color] duration-150 ${navButtonBase} ${
                        isActive
                          ? "bg-info-surface text-info"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                      title={group.label}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-info" />
                      )}
                      <GroupIcon className="h-4.5 w-4.5 stroke-[1.9]" />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom compact controls */}
            <div className="flex flex-col items-center gap-3 pb-4 w-full">
              <button
                onClick={handleReloadClick}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
                title="Reload data"
                aria-label="Reload data"
              >
                <RefreshCcw className={`h-4.5 w-4.5 ${isSpinning ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Menu className="h-4.5 w-4.5 stroke-[1.9]" />
              </button>
            </div>
          </div>
        )}

        {/* Profile Footer (Visible at the very bottom in expanded mode) */}
        {isExpandedMode && (
          <div className="h-[64px] shrink-0 border-t border-sidebar-border/30 px-4 py-3 flex items-center gap-2.5 bg-sidebar-accent/15 rounded-b-2xl">
            {profileData?.image ? (
              <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-sidebar-border/20" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground">
                {initials || "ST"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-sidebar-foreground">{profileName}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{username || "Student ID"}</span>
            </div>
          </div>
        )}

        {/* Floating popover beside the compact rail */}
        <AnimatePresence>
          {activeRailGroup && (
            <motion.div
              ref={flyoutRef}
              initial={{ opacity: 0, scale: 0.95, x: -5 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute left-[76px] top-12 z-50 w-56 rounded-xl border border-sidebar-border bg-popover p-2 text-popover-foreground shadow-xl"
            >
              {activeRailGroup === "account" ? (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/75 border-b border-sidebar-border/20 pb-1.5 mb-1.5">
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
                            ? "bg-info-surface text-info"
                            : "text-popover-foreground/80 hover:bg-sidebar-accent hover:text-popover-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}

                    {/* Theme */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-popover-foreground/80 hover:bg-sidebar-accent hover:text-popover-foreground`}
                      >
                        <Wrench className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-sidebar-foreground" />
                        <span className="truncate flex-1 text-left">Theme</span>
                        <motion.div
                          animate={{ rotate: isThemeExpanded ? 90 : 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
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
                            className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground/80 hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-info text-info bg-info-surface/30" : "border-muted-foreground/35"}`}>
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-info font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground/80 hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-info text-info bg-info-surface/30" : "border-muted-foreground/35"}`}>
                              {theme === "dark" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "dark" ? "text-info font-medium" : ""}>Dark</span>
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
                      className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-popover-foreground/70 hover:bg-sidebar-accent hover:text-popover-foreground mt-1.5 border-t border-sidebar-border/10 pt-1.5"
                    >
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="truncate">Log out</span>
                    </button>
                  </div>
                </div>
              ) : activeRailGroup !== "academics" ? (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/75 border-b border-sidebar-border/20 pb-1.5 mb-1.5">
                    {activeRailGroup === "study" && "Study"}
                    {activeRailGroup === "campus" && "Campus"}
                    {activeRailGroup === "tools" && "Tools"}
                  </div>
                  <div className="space-y-0.5">
                    {groups.find(g => g.id === activeRailGroup)?.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === "academics") {
                            setActiveRailGroup("academics");
                          } else {
                            item.onSelect();
                            setActiveRailGroup(null);
                          }
                        }}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                          item.isActive
                            ? "bg-info-surface text-info"
                            : "text-popover-foreground/80 hover:bg-sidebar-accent hover:text-popover-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.isExpandable && (
                          <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/60" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("study")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-popover-foreground transition-colors border-b border-sidebar-border/20 pb-1.5 mb-1.5 w-full text-left"
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
                            <div className="my-1.5 border-t border-sidebar-border/20" />
                          )}
                          <button
                            onClick={() => {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }}
                            className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                              item.isActive
                                ? "bg-info-surface text-info"
                                : "text-popover-foreground/80 hover:bg-sidebar-accent hover:text-popover-foreground"
                            }`}
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        </div>
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
