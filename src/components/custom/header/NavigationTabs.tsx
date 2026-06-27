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
  Key,
  ArrowLeft,
  Bus,
  Sun,
  Moon,
  Search,
  X,
  Coffee,
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
  const [isAppLibraryOpen, setIsAppLibraryOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");

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
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(selectedTheme);
      });
    } else {
      setTheme(selectedTheme);
    }
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
    {
      id: "profile-credentials",
      label: "Credentials",
      icon: Key,
      isActive: activeTab === "profile" && activeProfileSubTab === "credentials",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("credentials");
      },
    },
    {
      id: "profile-settings",
      label: "Settings",
      icon: Settings,
      isActive: activeTab === "profile" && activeProfileSubTab === "settings",
      onSelect: () => {
        selectTab("profile");
        setActiveProfileSubTab("settings");
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
    const libraryGroups = [
      {
        name: "Study",
        items: [
          { label: "Attendance", icon: CalendarCheck, action: () => { selectTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
          { label: "Academics Hub", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("overview"); } },
          { label: "Course Dashboard", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("course-dashboard"); } },
          { label: "Timetable", icon: Calendar, action: () => { selectTab("academics"); setActiveSubTab("timetable"); } },
          { label: "Grade History", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("grades"); } },
          { label: "GPA Predictor", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("gpa"); } },
          { label: "Question Bank", icon: Library, action: () => { selectTab("more"); setActiveMoreSubTab("qbank"); } },
          { label: "Faculty Explorer", icon: User, action: () => { selectTab("academics"); setActiveSubTab("faculty-info"); } }
        ]
      },
      {
        name: "Campus",
        items: [
          { label: "Hostel Overview", icon: Building, action: () => { selectTab("hostel"); setHostelActiveSubTab("overview"); } },
          { label: "Mess Menu", icon: Coffee, action: () => { selectTab("hostel"); setHostelActiveSubTab("mess"); } },
          { label: "Laundry", icon: Wrench, action: () => { selectTab("hostel"); setHostelActiveSubTab("laundry"); } },
          { label: "Leave", icon: Compass, action: () => { selectTab("hostel"); setHostelActiveSubTab("leave"); } },
          { label: "Counselling", icon: User, action: () => { selectTab("hostel"); setHostelActiveSubTab("counselling"); } },
          { label: "Bus Finder", icon: Bus, action: () => { selectTab("dayscholar"); } },
          { label: "Payments", icon: CreditCard, action: () => { selectTab("payments"); } },
          { label: "Libraries", icon: Library, action: () => { selectTab("libraries"); } }
        ]
      },
      {
        name: "Planning",
        items: [
          { label: "FFCS Planner", icon: LayoutGrid, action: () => { selectTab("more"); setActiveMoreSubTab("ffcs"); } },
          { label: "Wishlist", icon: Settings, action: () => { selectTab("academics"); setActiveSubTab("wishlist"); } }
        ]
      },
      {
        name: "Community",
        items: [
          { label: "Social Feed", icon: User, action: () => { selectTab("more"); setActiveMoreSubTab("social"); } },
          { label: "Event Hub", icon: Compass, action: () => { selectTab("more"); setActiveMoreSubTab("events"); } }
        ]
      },
      {
        name: "Account",
        items: [
          { label: "My Info", icon: User, action: () => { selectTab("profile"); setActiveProfileSubTab("info"); } },
          { label: "Preferences", icon: Settings, action: () => { selectTab("profile"); setActiveProfileSubTab("preferences"); } },
          { label: "Settings", icon: Wrench, action: () => { selectTab("profile"); setActiveProfileSubTab("settings"); } },
          { label: "Logout", icon: Lock, action: () => { handleLogOutRequest(); } }
        ]
      }
    ];

    // Filter items based on search query
    const filteredGroups = libraryGroups.map(group => {
      const matched = group.items.filter(item => 
        item.label.toLowerCase().includes(librarySearchQuery.toLowerCase())
      );
      return { ...group, items: matched };
    }).filter(group => group.items.length > 0);

    return (
      <>
        {/* Floating Action Capsule (FAC) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] flex items-center bg-gray-900/90 dark:bg-gray-950/90 backdrop-blur-lg border border-white/10 px-3 py-2 rounded-full shadow-2xl md:hidden gap-1 max-w-[90vw]">
          <button
            onClick={() => {
              setIsAppLibraryOpen(false);
              selectTab("home");
            }}
            className={`flex flex-col items-center justify-center rounded-full px-5 py-2.5 text-[10px] font-bold transition-all min-h-[44px] ${
              activeTab === "home" && !isAppLibraryOpen 
                ? "text-blue-400 bg-white/10 scale-105" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Home className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Home</span>
          </button>
          
          <button
            onClick={openCommandPalette}
            className="flex flex-col items-center justify-center rounded-full px-5 py-2.5 text-[10px] font-bold text-gray-400 hover:text-white min-h-[44px]"
          >
            <Search className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Search</span>
          </button>

          <button
            onClick={() => setIsAppLibraryOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center rounded-full px-5 py-2.5 text-[10px] font-bold transition-all min-h-[44px] ${
              isAppLibraryOpen 
                ? "text-blue-400 bg-white/10 scale-105" 
                : activeTab !== "home"
                  ? "text-blue-400/80 hover:text-white"
                  : "text-gray-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Modules</span>
          </button>
        </div>

        {/* App Library Overlay Drawer */}
        <AnimatePresence>
          {isAppLibraryOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-gray-50/98 dark:bg-black/98 backdrop-blur-xl flex flex-col md:hidden overflow-hidden"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {/* Drawer Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">App Library</h2>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">Select a module to open</p>
                </div>
                <button
                  onClick={() => {
                    setIsAppLibraryOpen(false);
                    setLibrarySearchQuery("");
                  }}
                  className="p-2.5 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200/30 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Search */}
              <div className="px-6 py-3 border-b border-gray-200/20 dark:border-gray-800/20">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/50 dark:border-gray-800/80">
                  <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search modules..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                  />
                  {librarySearchQuery && (
                    <button onClick={() => setLibrarySearchQuery("")} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Drawer Grid Modules */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-32">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">No modules found matching "{librarySearchQuery}"</p>
                  </div>
                ) : (
                  filteredGroups.map(group => (
                    <div key={group.name} className="space-y-2">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        {group.name}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              onClick={() => {
                                item.action();
                                setIsAppLibraryOpen(false);
                                setLibrarySearchQuery("");
                              }}
                              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 text-left active:scale-[0.98] transition-all min-h-[48px]"
                            >
                              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
                                <Icon className="h-4.5 w-4.5 stroke-[2]" />
                              </div>
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  return (
    <>
      {renderMobileNav()}

      <aside
        ref={sidebarRef}
        data-sidebar-root="true"
        className={`fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col overflow-visible rounded-[24px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:flex ${
          isOpen ? "w-[280px]" : "w-[72px]"
        }`}
        aria-label="Primary navigation"
      >
        {/* Sidebar Header */}
        <div className={`flex flex-col border-b border-sidebar-border shrink-0 ${isOpen ? "px-4 pb-4 pt-5" : "px-3.5 py-4"}`}>
          {/* Logo & Expand Toggle */}
          <div className={`flex items-center ${isOpen ? "justify-between w-full" : "justify-center w-full"}`}>
            <div className={`flex items-center min-w-0 ${isOpen ? "gap-2.5" : "justify-center"}`}>
              <img src={currentIcon} alt="AmazeCC" className="h-7 w-7 rounded-lg object-contain shadow-xs" />
              {isOpen && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">AmazeCC</h2>
              )}
            </div>
            {isOpen && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReloadClick}
                  className={`relative group rounded-xl p-1.5 text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-105 ${navButtonBase}`}
                  title="Reload data"
                  aria-label="Reload data"
                >
                  <RefreshCcw className={`h-4 w-4 transition-transform ${isSpinning ? "animate-spin" : "group-hover:rotate-180 duration-500"}`} />
                </button>
                <button
                  onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                  className={`relative group rounded-xl p-1.5 text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-105 ${navButtonBase}`}
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
                <div className="mt-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-[11px] space-y-1.5 shadow-2xs">
                  <div className="font-semibold text-sidebar-foreground/ tracking-wide text-[10px] uppercase">Current Semester</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
                          localStorage.setItem("settings", JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to show/hide CGPA"
                    >
                      <span className="text-sidebar-foreground/">CGPA</span>
                      <span className="font-semibold text-sidebar-foreground">{settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = { ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" };
                          localStorage.setItem("settings", JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to toggle attendance format"
                    >
                      <span className="text-sidebar-foreground/">Attendance</span>
                      <span className={`font-semibold ${attendancePercentage?.percentage < 75 ? "text-rose-400" : "text-emerald-400"}`}>
                        {attendanceValue}
                      </span>
                    </button>

                    <button
                      onClick={() => setGradesDisplayIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to view credits & grades details"
                    >
                      <span className="text-sidebar-foreground/">Credits</span>
                      <span className="font-semibold text-sidebar-foreground">{credits}</span>
                    </button>

                    <button
                      onClick={() => setODhoursIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to view OD tracker details"
                    >
                      <span className="text-sidebar-foreground/">OD Hours</span>
                      <span className="font-semibold text-sidebar-foreground">{totalODHours}/40</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar Input */}
                <button
                  data-sidebar-nav="true"
                  onClick={openCommandPalette}
                  onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                  className={`group flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-left text-xs text-sidebar-foreground/ transition-all duration-300 hover:bg-sidebar-accent hover:border-sidebar-border hover:shadow-sm dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:scale-[1.02] ${navButtonBase}`}
                  aria-label="Open command palette"
                >
                  <Command className="h-4 w-4 shrink-0 text-sidebar-foreground/ transition-colors group-hover:text-sidebar-foreground/" />
                  <span className="flex-1 truncate transition-colors group-hover:text-sidebar-foreground/">Search anything...</span>
                  <kbd className="rounded-md bg-sidebar-accent border border-sidebar-border px-1.5 py-0.5 text-[9px] font-bold text-sidebar-foreground/ shadow-sm transition-colors group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground">
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
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
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
                    return (
                      <div key={group.id} className="space-y-1">
                        {/* Group Header with subtle line */}
                        <div className="flex w-full items-center gap-2 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/">
                          <span>{group.label}</span>
                          <div className="h-px bg-sidebar-accent flex-grow" />
                        </div>

                        {/* Group Items (Always Expanded) */}
                        <div className="space-y-0.5 pt-0.5 pb-1">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            const activeStyles = "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold shadow-2xs animate-pulse";
                            const inactiveStyles = "border border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground";
                            return (
                              <button
                                key={item.id}
                                data-sidebar-nav="true"
                                onClick={item.onSelect}
                                onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                                  item.isActive ? activeStyles : inactiveStyles
                                }`}
                              >
                                <ItemIcon
                                  className={`h-4 w-4 shrink-0 transition-colors ${
                                    item.isActive ? "text-sky-700 dark:text-sky-300 font-semibold" : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"
                                  }`}
                                />
                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                {item.isExpandable && (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/" />
                                )}
                              </button>
                            );
                          })}
                        </div>
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
                    className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/">
                        Academics
                      </span>
                      <div className="h-px bg-sidebar-accent flex-grow" />
                    </div>

                    <div className="space-y-0.5">
                      {academicsItems.map((item, index) => {
                        const showDivider = index === 6;
                        const activeStyles = "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold shadow-2xs";
                        const inactiveStyles = "border border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground";
                        return (
                          <div key={item.id}>
                            {showDivider && (
                              <div className="my-2 border-t border-sidebar-border" />
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
                    className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/">
                        Hostel Hub
                      </span>
                      <div className="h-px bg-sidebar-accent flex-grow" />
                    </div>

                    <div className="space-y-0.5">
                      {hostelSubItems.map((item) => {
                        const activeStyles = "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold shadow-2xs";
                        const inactiveStyles = "border border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground";
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
            <div className="w-8 border-t border-sidebar-border mb-3" />

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
                          ? "bg-gradient-to-tr from-sky-400/20 to-indigo-500/20 text-sky-900 dark:text-sky-100 border border-sky-600/30 dark:border-sky-400/30 shadow-sm dark:shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                          : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                      } ${navButtonBase}`}
                      title={group.label}
                      aria-label={`Open ${group.label} menu`}
                    >
                      <GroupIcon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : ''}`} />
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
              className="shrink-0 border-t border-sidebar-border px-4 py-3 rounded-b-[24px] space-y-2.5"
            >
              {/* Profile Row: Name, Branch & Logout */}
              <div className="flex items-center gap-2.5">
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-sidebar-border" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground">
                    {initials || "ST"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-sidebar-foreground">{profileName}</span>
                  <span className="block truncate text-[10px] text-sidebar-foreground/">Computer Science</span>
                </div>
                <button
                  onClick={handleLogOutRequest}
                  className={`p-1.5 text-sidebar-foreground/ hover:text-red-400 hover:bg-sidebar-accent rounded-lg transition-colors ${navButtonBase}`}
                  title="Log out"
                  aria-label="Log out"
                >
                  <Lock className="h-4 w-4" />
                </button>
              </div>

              <div className="h-px bg-sidebar-accent" />

              {/* Theme Selection Row */}
              <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/ px-0.5">
                <span className="font-semibold tracking-wide uppercase text-[8px] text-sidebar-foreground/">Theme</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`flex items-center gap-1 hover:text-sidebar-foreground transition-colors ${theme === "light" ? "text-sky-700 dark:text-sky-300 font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "light" ? "border-sky-400 bg-sky-400" : "border-sidebar-border"}`} />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex items-center gap-1 hover:text-sidebar-foreground transition-colors ${theme === "dark" ? "text-sky-700 dark:text-sky-300 font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "dark" ? "border-sky-400 bg-sky-400" : "border-sidebar-border"}`} />
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
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              {/* Theme Toggler (Compact Icon) */}
              <button
                onClick={() => handleThemeChange(theme === "dark" ? "light" : "dark")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${navButtonBase}`}
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
                  <img src={profileData.image} alt="" className="h-8 w-8 rounded-full object-cover border border-sidebar-border" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
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
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/ border-b border-sidebar-border pb-1.5 mb-1.5">
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
                            ? "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold"
                            : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}

                    {/* Theme */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground`}
                      >
                        <Wrench className="h-4 w-4 shrink-0 text-sidebar-foreground/ group-hover:text-sidebar-foreground" />
                        <span className="truncate flex-1 text-left">Theme</span>
                        <motion.div
                          animate={{ rotate: isThemeExpanded ? 90 : 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <ChevronRight className="h-3 w-3 text-sidebar-foreground/" />
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
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-sky-400 text-sky-700 dark:text-sky-300 bg-sky-400/15" : "border-sidebar-border"}`}>
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-sky-700 dark:text-sky-300 font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-sky-400 text-sky-700 dark:text-sky-300 bg-sky-400/15" : "border-sidebar-border"}`}>
                              {theme === "dark" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "dark" ? "text-sky-700 dark:text-sky-300 font-medium" : ""}>Dark</span>
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
                      className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground mt-1.5 border-t border-sidebar-border pt-1.5"
                    >
                      <Lock className="h-4 w-4 shrink-0 text-sidebar-foreground/" />
                      <span className="truncate">Log out</span>
                    </button>
                  </div>
                </div>
              ) : activeRailGroup === "academics" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("study")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors border-b border-sidebar-border pb-1.5 mb-1.5 w-full text-left"
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
                            <div className="my-1.5 border-t border-sidebar-border" />
                          )}
                          <button
                            onClick={() => {
                              item.onSelect();
                              setActiveRailGroup(null);
                            }}
                            className={`group relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${
                              item.isActive
                                ? "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold"
                                : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors border-b border-sidebar-border pb-1.5 mb-1.5 w-full text-left"
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
                            ? "bg-sky-400/15 border border-sky-400/25 text-sky-700 dark:text-sky-300 font-semibold"
                            : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/ border-b border-sidebar-border pb-1.5 mb-1.5">
                    {activeRailGroup === "study" && "Study"}
                    {activeRailGroup === "campus" && "Campus"}
                    {activeRailGroup === "tools" && "Tools"}
                  </div>
                  <div className="space-y-1">
                    {groups.find(g => g.id === activeRailGroup)?.items.map((item) => {
                      const activeStyles = "bg-gradient-to-r from-sky-400/20 to-indigo-500/20 border-sky-600/30 dark:border-sky-400/30 text-sidebar-foreground font-bold shadow-sm dark:shadow-[0_0_15px_rgba(56,189,248,0.1)]";
                      const inactiveStyles = "border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-1";
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
                          <item.icon className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${item.isActive ? "text-sky-700 dark:text-sky-300 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] scale-110" : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"}`} />
                          <span className="truncate transition-transform duration-300">{item.label}</span>
                          {item.isExpandable && (
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-sidebar-foreground/" />
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
