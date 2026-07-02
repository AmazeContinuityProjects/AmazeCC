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
  Info,
  Link2,
  ChevronDown,
  Car,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import config from "../../../../config.json";

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

function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}

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
  const [mobilePanel, setMobilePanel] = useState<"primary" | "academics" | "hostel">("primary");

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

  // Swipe up gesture from bottom of screen to open App Library (Modules)
  useEffect(() => {
    let startY = 0;
    let startX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startY = touch.clientY;
      startX = touch.clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startY || !startX) return;

      const touch = e.changedTouches[0];
      const diffY = startY - touch.clientY;
      const diffX = Math.abs(touch.clientX - startX);

      // Swipe up of at least 65px, starting from bottom 22% of the viewport (near the bottom capsule/dock)
      if (diffY > 65 && diffX < 40 && startY > window.innerHeight * 0.78) {
        setIsAppLibraryOpen(true);
        setMobilePanel("primary");
      }
      
      startY = 0;
      startX = 0;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [setIsAppLibraryOpen]);


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
      if (activeTab === "home" || activeTab === "attendance") {
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

  const sidebarActiveStyles = "bg-sidebar-accent border border-sidebar-border text-info font-semibold";
  const sidebarActiveIconStyles = "text-info font-semibold";
  const railActiveStyles = "bg-sidebar-accent text-info border border-sidebar-border shadow-sm";

  const handleThemeChange = (selectedTheme: string) => {
    if (theme === selectedTheme) return;
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(selectedTheme);
      });
    } else {
      setTheme(selectedTheme);
    }
    window.setTimeout(() => window.location.reload(), 80);
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
      id: "home",
      label: "Home",
      icon: Home,
      isActive: activeTab === "home",
      onSelect: () => selectTab("home"),
    },
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
        id: "cabshare",
        label: "Cab Share",
        icon: Car,
        isActive: activeTab === "cabshare",
        onSelect: () => selectTab("cabshare"),
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
      id: "more-events",
      label: "Event Hub",
      icon: Calendar,
      isActive: activeTab === "more" && activeMoreSubTab === "events",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("events");
      }
    },
    {
      id: "more-clubs",
      label: "Club Hub",
      icon: LayoutGrid,
      isActive: activeTab === "more" && activeMoreSubTab === "clubs",
      onSelect: () => {
        selectTab("more");
        setActiveMoreSubTab("clubs");
      }
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
    {
      id: "about",
      label: "About & Resources",
      icon: Info,
      isActive: activeTab === "about",
      onSelect: () => {
        selectTab("about");
      },
    },
    {
      id: "logout",
      label: "Logout",
      icon: Lock,
      onSelect: () => {
        handleLogOutRequest();
      },
      isActive: false,
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
    const allSearchableItems = [
      { label: "Attendance", group: "Study", icon: CalendarCheck, action: () => { selectTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
      { label: "Timetable Calendar", group: "Study", icon: Calendar, action: () => { selectTab("attendance"); setActiveAttendanceSubTab("calendar"); } },
      
      { label: "Academics Overview", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("overview"); } },
      { label: "Course Dashboard", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("course-dashboard"); } },
      { label: "Grade History", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("grades"); } },
      { label: "Curriculum", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("curriculum"); } },
      { label: "CGPA Predictor", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("predictor"); } },
      { label: "Faculty Explorer", group: "Academics", icon: User, action: () => { selectTab("academics"); setActiveSubTab("faculty-info"); } },
      { label: "Question Bank", group: "Academics", icon: Library, action: () => { selectTab("academics"); setActiveSubTab("qbank"); } },
      { label: "Arrear Management", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("arrear"); } },
      { label: "Makeup & Compre", group: "Academics", icon: GraduationCap, action: () => { selectTab("academics"); setActiveSubTab("makeup-compre"); } },
      { label: "Course Options", group: "Academics", icon: BookOpen, action: () => { selectTab("academics"); setActiveSubTab("course-mgmt"); } },
      { label: "Projects", group: "Academics", icon: LayoutGrid, action: () => { selectTab("academics"); setActiveSubTab("projects"); } },
      { label: "Wishlist", group: "Academics", icon: Settings, action: () => { selectTab("academics"); setActiveSubTab("wishlist"); } },
      
      { label: "Hostel Overview", group: "Hostel", icon: Building, action: () => { selectTab("hostel"); setHostelActiveSubTab("overview"); } },
      { label: "Mess Menu", group: "Hostel", icon: Coffee, action: () => { selectTab("hostel"); setHostelActiveSubTab("mess"); } },
      { label: "Laundry", group: "Hostel", icon: Wrench, action: () => { selectTab("hostel"); setHostelActiveSubTab("laundry"); } },
      { label: "Leave / Gatepass", group: "Hostel", icon: Compass, action: () => { selectTab("hostel"); setHostelActiveSubTab("leave"); } },
      { label: "Counselling", group: "Hostel", icon: User, action: () => { selectTab("hostel"); setHostelActiveSubTab("counselling"); } },
      { label: "Hostel Payments", group: "Hostel", icon: CreditCard, action: () => { selectTab("payments"); } },
      
      { label: "Bus Finder", group: "Campus", icon: Bus, action: () => { selectTab("dayscholar"); } },
      { label: "Payments", group: "Campus", icon: CreditCard, action: () => { selectTab("payments"); } },
      { label: "Libraries", group: "Campus", icon: Library, action: () => { selectTab("libraries"); } },
      
      { label: "Social Feed", group: "Tools", icon: User, action: () => { selectTab("more"); setActiveMoreSubTab("social"); } },
      { label: "Event Hub", group: "Tools", icon: Compass, action: () => { selectTab("more"); setActiveMoreSubTab("events"); } },
      { label: "Club Hub", group: "Tools", icon: LayoutGrid, action: () => { selectTab("more"); setActiveMoreSubTab("clubs"); } },
      { label: "FFCS Planner", group: "Tools", icon: LayoutGrid, action: () => { selectTab("more"); setActiveMoreSubTab("ffcs"); } },
      
      { label: "My Info", group: "Account", icon: User, action: () => { selectTab("profile"); setActiveProfileSubTab("info"); } },
      { label: "Settings", group: "Account", icon: Wrench, action: () => { selectTab("profile"); setActiveProfileSubTab("settings"); } },
      { label: "About & Resources", group: "Account", icon: Info, action: () => { selectTab("about"); } },
      { label: "Logout", group: "Account", icon: Lock, action: () => { handleLogOutRequest(); } }
    ];

    // Primary mobile structure mirroring desktop groups
    const primaryGroups = [
      {
        name: "Study",
        items: [
          { label: "Attendance", icon: CalendarCheck, type: "link", action: () => { selectTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
          { label: "Timetable Calendar", icon: Calendar, type: "link", action: () => { selectTab("attendance"); setActiveAttendanceSubTab("calendar"); } },
          { label: "Academics", icon: GraduationCap, type: "panel", action: () => setMobilePanel("academics") }
        ]
      },
      {
        name: "Campus",
        items: [
          { label: "Payments", icon: CreditCard, type: "link", action: () => selectTab("payments") },
          { label: "Libraries", icon: Library, type: "link", action: () => selectTab("libraries") },
          ...(isHosteller === true || residentialStatus === "hosteller" 
            ? [{ label: "Hostel Hub", icon: Home, type: "panel", action: () => setMobilePanel("hostel") }] 
            : [{ label: "Bus Finder", icon: Bus, type: "link", action: () => selectTab("dayscholar") }])
        ]
      },
      {
        name: "Tools",
        items: [
          { label: "Social", icon: LayoutGrid, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("social"); } },
          { label: "FFCS Planner", icon: Compass, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("ffcs"); } },
          { label: "Event Hub", icon: Calendar, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("events"); } },
          { label: "Club Hub", icon: LayoutGrid, type: "link", action: () => { selectTab("more"); setActiveMoreSubTab("clubs"); } }
        ]
      },
      {
        name: "Account",
        items: [
          { label: "My Info", icon: User, type: "link", action: () => { selectTab("profile"); setActiveProfileSubTab("info"); } },
          { label: "Settings", icon: Wrench, type: "link", action: () => { selectTab("profile"); setActiveProfileSubTab("settings"); } },
          { label: "About & Resources", icon: Info, type: "link", action: () => { selectTab("about"); } },
          { label: "Logout", icon: Lock, type: "link", action: () => { handleLogOutRequest(); } }
        ]
      }
    ];

    const academicsItemsMobile = allSearchableItems.filter(item => item.group === "Academics");
    const hostelItemsMobile = allSearchableItems.filter(item => item.group === "Hostel");

    // Filter items based on search query
    const filteredSearchItems = librarySearchQuery
      ? allSearchableItems.filter(item => item.label.toLowerCase().includes(librarySearchQuery.toLowerCase()))
      : [];

    return (
      <>
        {/* Floating Action Capsule (FAC) */}
        <div
          className="fixed left-1/2 z-[50] flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center justify-between gap-1 rounded-[1.75rem] border border-white/55 bg-white/65 px-2 py-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-gray-950/68 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            onClick={() => {
              setIsAppLibraryOpen(false);
              selectTab("home");
            }}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-[1.35rem] px-3 py-2 text-[10px] font-bold transition-all ${
              activeTab === "home" && !isAppLibraryOpen 
                ? "bg-white/80 text-info shadow-sm dark:bg-white/10 scale-105"
                : "text-gray-500 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <Home className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Home</span>
          </button>
          
          <button
            onClick={openCommandPalette}
            className="flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-[1.35rem] px-3 py-2 text-[10px] font-bold text-gray-500 transition-all hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <Search className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Search</span>
          </button>

          <button
            onClick={() => {
              setMobilePanel("primary");
              setIsAppLibraryOpen(prev => !prev);
            }}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-[1.35rem] px-3 py-2 text-[10px] font-bold transition-all ${
              isAppLibraryOpen 
                ? "bg-white/80 text-info shadow-sm dark:bg-white/10 scale-105"
                : activeTab !== "home"
                  ? "text-info hover:bg-white/50 hover:text-info dark:hover:bg-white/5"
                  : "text-gray-500 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="h-5 w-5 stroke-[2]" />
            <span className="mt-0.5">Modules</span>
          </button>
        </div>

        {/* App Library Overlay Drawer */}
        <AnimatePresence>
          {isAppLibraryOpen && (
            <>
              {/* Backdrop Dimmer Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsAppLibraryOpen(false);
                  setLibrarySearchQuery("");
                }}
                className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-xs md:hidden"
              />

              {/* Bottom Sheet Modal */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 z-[60] h-[86vh] flex flex-col overflow-hidden bg-gray-50/98 backdrop-blur-xl md:hidden dark:bg-black/98 rounded-t-[2rem] border-t border-gray-200/50 dark:border-neutral-900/60 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.3)]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {/* Drag Handle Indicator */}
                <div className="shrink-0 w-full flex justify-center pt-3 pb-1">
                  <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full" />
                </div>

              {/* Drawer Header */}
              <div className="shrink-0 border-b border-gray-200/50 px-5 pb-4 pt-5 dark:border-gray-800/50">
                <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {mobilePanel !== "primary" && (
                      <button
                        onClick={() => setMobilePanel("primary")}
                        className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-info font-bold flex items-center gap-1 -ml-1 text-xs"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back
                      </button>
                    )}
                    <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      {mobilePanel === "primary" ? "App Library" : mobilePanel === "academics" ? "Academics" : "Hostel Hub"}
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    {mobilePanel === "primary" ? "Select a module to open" : "Choose a sub-page"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Sem:</span>
                    <div className="relative flex items-center">
                      <select
                        value={settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings((prev: any) => {
                            const next = { ...prev, currSemesterID: val };
                            localStorage.setItem("settings", JSON.stringify(next));
                            return next;
                          });
                          handleReloadRequest();
                        }}
                        className="appearance-none bg-transparent border-none text-xs font-black text-info hover:underline cursor-pointer focus:outline-none pr-3.5 py-0 select-none"
                      >
                        {config.semesterIDs.map((semId: string) => (
                          <option key={semId} value={semId} className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-xs">
                            {formatSemesterName(semId)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-info pointer-events-none" />
                    </div>
                  </div>
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
              </div>

              {/* Drawer Search (Hidden inside sub-panels for clean UI, shown on primary) */}
              {mobilePanel === "primary" && (
                <div className="shrink-0 border-b border-gray-200/20 px-5 py-3 dark:border-gray-800/20">
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
              )}

              {/* Drawer Grid Modules */}
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 pb-36">
                {librarySearchQuery ? (
                  // Flat search matches
                  filteredSearchItems.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">No modules found matching "{librarySearchQuery}"</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Search Results
                      </h3>
                      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                        {filteredSearchItems.map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              onClick={() => {
                                item.action();
                                setIsAppLibraryOpen(false);
                                setLibrarySearchQuery("");
                              }}
                              className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                            >
                              <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
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
                  )
                ) : mobilePanel === "primary" ? (
                  // Primary Groups (Study, Campus, Tools, Account)
                  primaryGroups.map(group => (
                    <div key={group.name} className="space-y-2">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        {group.name}
                      </h3>
                      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                        {group.items.map(item => {
                          const Icon = item.icon;
                          const isPanelTrigger = item.type === "panel";
                          return (
                            <button
                              key={item.label}
                              onClick={() => {
                                item.action();
                                if (!isPanelTrigger) {
                                  setIsAppLibraryOpen(false);
                                }
                              }}
                              className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                                  <Icon className="h-4.5 w-4.5 stroke-[2]" />
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight truncate">
                                  {item.label}
                                </span>
                              </div>
                              {isPanelTrigger && (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : mobilePanel === "academics" ? (
                  // Academics Sub-Pages
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                      {academicsItemsMobile.map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              item.action();
                              setIsAppLibraryOpen(false);
                            }}
                            className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                          >
                            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 shrink-0">
                              <Icon className="h-4.5 w-4.5 stroke-[2]" />
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight">
                              {item.label.replace("Academics ", "")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Hostel Sub-Pages
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                      {hostelItemsMobile.map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              item.action();
                              setIsAppLibraryOpen(false);
                            }}
                            className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-xs transition-all active:scale-[0.98] dark:border-gray-800/80 dark:bg-gray-900"
                          >
                            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 shrink-0">
                              <Icon className="h-4.5 w-4.5 stroke-[2]" />
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight">
                              {item.label.replace("Hostel ", "")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Theme Switcher */}
              <div
                className="shrink-0 space-y-2 border-t border-gray-200/50 bg-gray-50/80 px-5 py-4 dark:border-gray-800/50 dark:bg-black/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
              >
                <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-0.5">Interface Theme</h4>
                <div className="flex bg-gray-200/50 dark:bg-gray-900/50 p-1 rounded-xl w-full border border-gray-200/20 dark:border-gray-800/50">
                  {["light", "dark", "system"].map(t => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className={`flex-1 py-2 text-xs font-black rounded-lg transition-all capitalize flex items-center justify-center gap-1.5 min-h-[36px] ${
                        theme === t 
                          ? "bg-white dark:bg-black text-info shadow-xs"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white"
                      }`}
                    >
                      {t === "light" && <Sun className="w-3.5 h-3.5" />}
                      {t === "dark" && <Moon className="w-3.5 h-3.5" />}
                      {t === "system" && <Settings className="w-3.5 h-3.5" />}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>

            </motion.div>
            </>
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
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sidebar-foreground/75 tracking-wide text-[10px] uppercase">Current Semester</div>
                    <div className="relative flex items-center">
                      <select
                        value={settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings((prev: any) => {
                            const next = { ...prev, currSemesterID: val };
                            localStorage.setItem("settings", JSON.stringify(next));
                            return next;
                          });
                          handleReloadRequest();
                        }}
                        className="appearance-none bg-transparent border-none text-[10px] font-black text-info hover:underline cursor-pointer focus:outline-none pr-3.5 py-0 select-none text-right"
                      >
                        {config.semesterIDs.map((semId: string) => (
                          <option key={semId} value={semId} className="bg-sidebar text-sidebar-foreground text-xs">
                            {formatSemesterName(semId)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-info pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
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
                            const activeStyles = sidebarActiveStyles;
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
                                    item.isActive ? sidebarActiveIconStyles : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"
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
                        const activeStyles = sidebarActiveStyles;
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
                        const activeStyles = sidebarActiveStyles;
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
                  ? activeTab === "home" || activeTab === "attendance" || activeTab === "academics"
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
                          ? railActiveStyles
                          : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                      } ${navButtonBase}`}
                      title={group.label}
                      aria-label={`Open ${group.label} menu`}
                    >
                      <GroupIcon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110 text-info' : ''}`} />
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
                    className={`flex items-center gap-1 hover:text-sidebar-foreground transition-colors ${theme === "light" ? "text-info font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "light" ? "border-info bg-info" : "border-sidebar-border"}`} />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex items-center gap-1 hover:text-sidebar-foreground transition-colors ${theme === "dark" ? "text-info font-medium" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full border transition-colors ${theme === "dark" ? "border-info bg-info" : "border-sidebar-border"}`} />
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

              {/* Profile Shortcut */}
              <button
                onClick={() => selectTab("profile")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80"
                title="Account Settings"
                aria-label="Open profile"
              >
                <User className="h-4 w-4" />
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
                            ? sidebarActiveStyles
                            : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/"}`} />
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
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}>
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-info font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}>
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
                                ? sidebarActiveStyles
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
                            ? sidebarActiveStyles
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
                      const activeStyles = railActiveStyles;
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
                          <item.icon className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${item.isActive ? "text-info scale-110" : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"}`} />
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
