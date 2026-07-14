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
  CarTaxiFront,
  MoreHorizontal,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useTheme, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  SidebarProfile,
  SidebarThemeControl,
  SidebarExpandButton,
} from "@amazecontinuityprojects/amazeui";
import { AppLibrary, MobileBottomNav } from "@amazecontinuityprojects/amazeui";
import config from "../../../../config.json";
import { shouldShowGpa, shouldShowProfilePhoto } from "@/lib/settingsVisibility";

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

  const sidebarRef = useRef<HTMLDivElement>(null);
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

  // No swipe-up gesture — App Library is opened only via the Modules button


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
      } else if (["payments", "libraries", "transport"].includes(activeTab)) {
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
  const shouldDisplayGpa = shouldShowGpa(settings);
  const shouldDisplayProfilePhoto = shouldShowProfilePhoto(settings);
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
    }

    items.push({
      id: "transport",
      label: "Transport",
      icon: Bus,
      isActive: activeTab === "transport",
      onSelect: () => selectTab("transport"),
    });

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

  const pinnedItems = useMemo(() => {
    const pinnedTabs = settings?.pinnedNavTabs ?? [];
    const tabData: Record<string, { label: string; icon: any; onSelect: () => void; isActive: boolean }> = {
      attendance: {
        label: "Attendance",
        icon: CalendarCheck,
        isActive: activeTab === "attendance",
        onSelect: () => { selectTab("attendance"); }
      },
      academics: {
        label: "Academics",
        icon: GraduationCap,
        isActive: activeTab === "academics",
        onSelect: () => { selectTab("academics"); }
      },
      payments: {
        label: "Payments",
        icon: CreditCard,
        isActive: activeTab === "payments",
        onSelect: () => { selectTab("payments"); }
      },
      libraries: {
        label: "Libraries",
        icon: Library,
        isActive: activeTab === "libraries",
        onSelect: () => { selectTab("libraries"); }
      },
      cabshare: {
        label: "Cab Share",
        icon: CarTaxiFront,
        isActive: activeTab === "cabshare",
        onSelect: () => { selectTab("cabshare"); }
      },
      transport: {
        label: "Transport",
        icon: Bus,
        isActive: activeTab === "transport",
        onSelect: () => { selectTab("transport"); }
      },
      more: {
        label: "More",
        icon: MoreHorizontal,
        isActive: activeTab === "more",
        onSelect: () => { selectTab("more"); }
      },
      profile: {
        label: "Profile",
        icon: User,
        isActive: activeTab === "profile",
        onSelect: () => { selectTab("profile"); }
      }
    };
    return pinnedTabs
      .map((id: string) => ({ id, ...tabData[id] }))
      .filter((item: any) => item.label !== undefined);
  }, [settings?.pinnedNavTabs, activeTab, selectTab]);

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
      
      { label: "Cab Share", group: "Campus", icon: CarTaxiFront, action: () => { selectTab("cabshare"); } },
      { label: "Transport", group: "Campus", icon: Bus, action: () => { selectTab("transport"); } },
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
          { label: "Cab Share", icon: CarTaxiFront, type: "link", action: () => selectTab("cabshare") },
          { label: "Payments", icon: CreditCard, type: "link", action: () => selectTab("payments") },
          { label: "Libraries", icon: Library, type: "link", action: () => selectTab("libraries") },
          ...(isHosteller === true || residentialStatus === "hosteller" 
            ? [{ label: "Hostel Hub", icon: Home, type: "panel", action: () => setMobilePanel("hostel") }] 
            : [{ label: "Transport", icon: Bus, type: "link", action: () => selectTab("transport") }])
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
    ];    const academicsItemsMobile = allSearchableItems.filter(item => item.group === "Academics");
    const hostelItemsMobile = allSearchableItems.filter(item => item.group === "Hostel");

    // Filter items based on search query
    const filteredSearchItems = librarySearchQuery
      ? allSearchableItems.filter(item => item.label.toLowerCase().includes(librarySearchQuery.toLowerCase()))
      : [];

    const pinnedTabs = settings?.pinnedNavTabs ?? [];
    const tabIcons: Record<string, { icon: React.ReactNode; label: string }> = {
      attendance: { icon: <CalendarCheck className="h-5 w-5 stroke-[2]" />, label: "Attendance" },
      academics: { icon: <GraduationCap className="h-5 w-5 stroke-[2]" />, label: "Academics" },
      payments: { icon: <CreditCard className="h-5 w-5 stroke-[2]" />, label: "Payments" },
      libraries: { icon: <Library className="h-5 w-5 stroke-[2]" />, label: "Libraries" },
      cabshare: { icon: <CarTaxiFront className="h-5 w-5 stroke-[2]" />, label: "Cab Share" },
      transport: { icon: <Bus className="h-5 w-5 stroke-[2]" />, label: "Transport" },
      more: { icon: <MoreHorizontal className="h-5 w-5 stroke-[2]" />, label: "More" },
      profile: { icon: <User className="h-5 w-5 stroke-[2]" />, label: "Profile" },
    };

    const getTabIdFromLabel = (label: string) => {
      const lower = label.toLowerCase();
      if (lower === "attendance") return "attendance";
      if (lower === "academics overview" || lower === "course dashboard" || lower === "academics") return "academics";
      if (lower === "hostel payments" || lower === "payments") return "payments";
      if (lower === "libraries" || lower === "question bank") return "libraries";
      if (lower === "cab share") return "cabshare";
      if (lower === "transport") return "transport";
      return null;
    };

    const togglePin = (tabId: string) => {
      const current = settings?.pinnedNavTabs ?? [];
      const isPinned = current.includes(tabId);
      const atLimit = !isPinned && current.length >= 4;
      if (atLimit) return;
      const next = isPinned
        ? current.filter((id: string) => id !== tabId)
        : [...current, tabId];
      setSettings((prev: any) => {
        const updated = { ...prev, pinnedNavTabs: next };
        localStorage.setItem("settings", JSON.stringify(updated));
        return updated;
      });
    };

    const rawNavItems: any[] = [
      {
        id: "home",
        icon: <Home className="h-5 w-5 stroke-[2]" />,
        label: "Home",
        isActive: activeTab === "home" && !isAppLibraryOpen,
        onClick: () => {
          setIsAppLibraryOpen(false);
          selectTab("home");
        },
      },
    ];

    if (pinnedTabs.length === 0) {
      rawNavItems.push({
        id: "search",
        icon: <Search className="h-5 w-5 stroke-[2]" />,
        label: "Search",
        isActive: false,
        onClick: openCommandPalette,
      });
    } else {
      pinnedTabs.forEach((tabId: string) => {
        const t = tabIcons[tabId];
        if (t) {
          rawNavItems.push({
            id: tabId,
            icon: t.icon,
            label: t.label,
            isActive: activeTab === tabId && !isAppLibraryOpen,
            onClick: () => {
              setIsAppLibraryOpen(false);
              selectTab(tabId);
            },
          });
        }
      });
    }

    rawNavItems.push({
      id: "modules",
      icon: <LayoutGrid className="h-5 w-5 stroke-[2]" />,
      label: "Modules",
      isActive: isAppLibraryOpen,
      onClick: () => {
        setMobilePanel("primary");
        setIsAppLibraryOpen(prev => !prev);
      },
    });

    return (
      <>
        {/* Sleek Floating Pill Bottom Navigation Bar */}
        <div className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px] z-40 bg-white/80 dark:bg-zinc-950/85 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/80 rounded-[26px] p-1 shadow-[0_12px_35px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_35px_-8px_rgba(0,0,0,0.55)] flex items-center justify-around">
          {rawNavItems.map((item) => {
            const isActive = item.isActive;
            return (
              <motion.button
                key={item.id}
                onClick={item.onClick}
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center justify-center flex-1 py-1.5 relative select-none cursor-pointer group focus:outline-none"
              >
                {/* Floating pill background highlight that slides smoothly */}
                {isActive && (
                  <motion.div
                    layoutId="activeMobileTabPill"
                    className="absolute inset-0.5 rounded-[20px] bg-info-surface/90 dark:bg-info/10 z-0"
                    transition={{ type: "spring", stiffness: 350, damping: 26 }}
                  />
                )}

                {/* Relative container to raise icon and text above active highlight */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  {/* Icon with bounce & scale effect on active */}
                  <motion.div 
                    animate={isActive ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className={`p-1 transition-colors duration-300 ${
                      isActive 
                        ? "text-info" 
                        : "text-zinc-400 dark:text-zinc-550 hover:text-zinc-650 dark:hover:text-zinc-300"
                    }`}
                  >
                    {item.icon}
                  </motion.div>

                  {/* Tab Title */}
                  <span className={`text-[9.5px] font-black tracking-wide transition-colors duration-300 ${
                    isActive 
                      ? "text-info font-black" 
                      : "text-zinc-400 dark:text-zinc-555"
                  }`}>
                    {item.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        <AppLibrary
          open={isAppLibraryOpen}
          onClose={() => { setIsAppLibraryOpen(false); setLibrarySearchQuery(""); }}
          title={mobilePanel === "primary" ? "App Library" : mobilePanel === "academics" ? "Academics" : "Hostel Hub"}
          subtitle={mobilePanel === "primary" ? "Select a module to open" : "Choose a sub-page"}
          showBack={mobilePanel !== "primary"}
          onBack={() => setMobilePanel("primary")}
          searchQuery={mobilePanel === "primary" ? librarySearchQuery : undefined}
          onSearchChange={mobilePanel === "primary" ? setLibrarySearchQuery : undefined}
        >
          {mobilePanel === "primary" && (
            <div className="flex items-center gap-1.5 px-1 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-550">Active Sem:</span>
              <div className="relative flex items-center">
                <select
                  value={settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleReloadRequest(val);
                  }}
                  className="appearance-none border-none bg-transparent py-0 pr-3.5 text-xs font-black text-info hover:underline focus:outline-none"
                >
                  {config.semesterIDs.map((semId: string) => (
                    <option key={semId} value={semId} className="bg-white text-xs text-gray-900 dark:bg-neutral-900 dark:text-white">
                      {formatSemesterName(semId)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-info" />
              </div>
            </div>
          )}

          {librarySearchQuery ? (
            filteredSearchItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">No modules found matching "{librarySearchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-550">Search Results</h3>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {filteredSearchItems.map(item => {
                    const Icon = item.icon;
                    const tabId = getTabIdFromLabel(item.label);
                    const pinned = settings?.pinnedNavTabs ?? [];
                    const isPinned = tabId ? pinned.includes(tabId) : false;
                    const atLimit = !isPinned && pinned.length >= 4;

                    return (
                      <div
                        key={item.label}
                        className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-55/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                      >
                        <button
                          onClick={() => { item.action(); setIsAppLibraryOpen(false); setLibrarySearchQuery(""); }}
                          className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                        >
                          <div className="rounded-xl bg-info-surface p-2 text-info shrink-0">
                            <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">{item.label}</span>
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">{item.group} category</span>
                          </div>
                        </button>

                        {tabId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(tabId);
                            }}
                            disabled={atLimit}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isPinned
                                ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                                : atLimit
                                  ? "opacity-20 cursor-not-allowed"
                                  : "border-transparent text-zinc-300 dark:text-zinc-650 hover:text-zinc-550 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
                            }`}
                            title={isPinned ? "Unpin from bottom bar" : "Pin to bottom bar"}
                          >
                            <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : mobilePanel === "primary" ? (
            primaryGroups.map(group => (
              <div key={group.name} className="space-y-2">
                <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-550">{group.name}</h3>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isPanelTrigger = item.type === "panel";
                    const tabId = getTabIdFromLabel(item.label);
                    const pinned = settings?.pinnedNavTabs ?? [];
                    const isPinned = tabId ? pinned.includes(tabId) : false;
                    const atLimit = !isPinned && pinned.length >= 4;

                    return (
                      <div
                        key={item.label}
                        className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-55/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                      >
                        <button
                          onClick={() => { item.action(); if (!isPanelTrigger) setIsAppLibraryOpen(false); }}
                          className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                        >
                          <div className={`rounded-xl p-2 shrink-0 transition-all ${
                            group.name === "Study"
                              ? "bg-purple-50 text-purple-650 dark:bg-purple-950/30 dark:text-purple-400"
                              : group.name === "Campus"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                          }`}>
                            <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">{item.label}</span>
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                              {group.name === "Study" ? "Academic trackers & schedule" : group.name === "Campus" ? "Campus services" : "Social & utilities"}
                            </span>
                          </div>
                        </button>

                        {tabId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(tabId);
                            }}
                            disabled={atLimit}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isPinned
                                ? "bg-indigo-50 border-indigo-200 text-indigo-655 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                                : atLimit
                                  ? "opacity-20 cursor-not-allowed"
                                  : "border-transparent text-zinc-300 dark:text-zinc-650 hover:text-zinc-600 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
                            }`}
                            title={isPinned ? "Unpin from bottom bar" : "Pin to bottom bar"}
                          >
                            <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
                          </button>
                        )}
                        
                        {isPanelTrigger && !tabId && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : mobilePanel === "academics" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {academicsItemsMobile.map(item => {
                  const Icon = item.icon;
                  const cleanLabel = item.label.replace("Academics ", "");
                  const tabId = getTabIdFromLabel(item.label);
                  const pinned = settings?.pinnedNavTabs ?? [];
                  const isPinned = tabId ? pinned.includes(tabId) : false;
                  const atLimit = !isPinned && pinned.length >= 4;

                  return (
                    <div
                      key={item.label}
                      className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-55/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                    >
                      <button
                        onClick={() => { item.action(); setIsAppLibraryOpen(false); }}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="rounded-xl bg-purple-50 p-2 text-purple-655 shrink-0 dark:bg-purple-950/30 dark:text-purple-400">
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">{cleanLabel}</span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">Academics Tracker</span>
                        </div>
                      </button>

                      {tabId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(tabId);
                          }}
                          disabled={atLimit}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isPinned
                              ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                              : atLimit
                                ? "opacity-20 cursor-not-allowed"
                                : "border-transparent text-zinc-300 dark:text-zinc-650 hover:text-zinc-650 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
                          }`}
                          title={isPinned ? "Unpin from bottom bar" : "Pin to bottom bar"}
                        >
                          <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {hostelItemsMobile.map(item => {
                  const Icon = item.icon;
                  const cleanLabel = item.label.replace("Hostel ", "");
                  const tabId = getTabIdFromLabel(item.label);
                  const pinned = settings?.pinnedNavTabs ?? [];
                  const isPinned = tabId ? pinned.includes(tabId) : false;
                  const atLimit = !isPinned && pinned.length >= 4;

                  return (
                    <div
                      key={item.label}
                      className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-55/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                    >
                      <button
                        onClick={() => { item.action(); setIsAppLibraryOpen(false); }}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="rounded-xl bg-amber-50 p-2 text-amber-600 shrink-0 dark:bg-amber-950/30 dark:text-amber-400">
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">{cleanLabel}</span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">Hostel Hub</span>
                        </div>
                      </button>

                      {tabId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(tabId);
                          }}
                          disabled={atLimit}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isPinned
                              ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                              : atLimit
                                ? "opacity-20 cursor-not-allowed"
                                : "border-transparent text-zinc-300 dark:text-zinc-650 hover:text-zinc-655 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
                          }`}
                          title={isPinned ? "Unpin from bottom bar" : "Pin to bottom bar"}
                        >
                          <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Customize Pinned Tabs Block */}
          <div className="shrink-0 space-y-3 border-t border-zinc-200/50 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800/50 dark:bg-black/60 rounded-t-[20px] mt-4">
            <div className="flex items-center justify-between">
              <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Quick Pin tabs (Max 4)</h4>
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                {(settings?.pinnedNavTabs ?? []).length}/4 selected
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "attendance", label: "Attendance" },
                { id: "academics", label: "Academics" },
                { id: "payments", label: "Payments" },
                { id: "libraries", label: "Libraries" },
                { id: "cabshare", label: "Cab Share" },
                { id: "transport", label: "Transport" },
                { id: "more", label: "More" },
                { id: "profile", label: "Profile" },
              ].map(tab => {
                const pinned = settings?.pinnedNavTabs ?? [];
                const isPinned = pinned.includes(tab.id);
                const atLimit = !isPinned && pinned.length >= 4;
                return (
                  <button
                    key={tab.id}
                    disabled={atLimit}
                    onClick={() => togglePin(tab.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10.5px] font-black border transition-all cursor-pointer select-none ${
                      isPinned
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : atLimit
                          ? "bg-gray-100 dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-400 dark:text-gray-650 cursor-not-allowed opacity-40"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-indigo-400"
                    }`}
                  >
                    {isPinned ? "✓ " : "+ "}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-gray-200/50 bg-gray-50/80 px-5 py-4 dark:border-gray-800/50 dark:bg-black/60" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
            <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 font-outfit">Interface Theme</h4>
            <div className="flex w-full gap-1 rounded-xl border border-gray-200/20 bg-gray-200/50 p-1 dark:border-gray-800/50 dark:bg-gray-900/50">
              {["light", "dark", "system"].map(t => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black capitalize transition-all cursor-pointer ${
                    theme === t
                      ? "bg-white text-info shadow-xs dark:bg-black"
                      : "text-gray-500 hover:text-gray-955 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  {t === "light" && <Sun className="h-3.5 w-3.5" />}
                  {t === "dark" && <Moon className="h-3.5 w-3.5" />}
                  {t === "system" && <Settings className="h-3.5 w-3.5" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>
        </AppLibrary>
      </>
    );
  };

  return (
    <>
      {renderMobileNav()}

      <Sidebar
        ref={sidebarRef}
        data-sidebar-root="true"
        aria-label="Primary navigation"
        isOpen={isOpen}
        onOpenChange={(val) => persistSidebarState(!val)}
      >
        {/* Sidebar Header */}
        <SidebarHeader>
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
                          handleReloadRequest(val);
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
                    {shouldDisplayGpa && (
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
                        <span className={`font-semibold text-sidebar-foreground transition-all duration-300 ${settings.CGPAHidden ? "blur-[4.5px] select-none" : ""}`}>{marksData?.cgpa?.cgpa || "-"}</span>
                      </button>
                    )}

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
        </SidebarHeader>

        {/* Navigation Content (Expanded Mode vs Compact Rail) */}
        {isOpen ? (
          <SidebarContent>
            {!showAcademicsPanel && !showHostelPanel ? (
              <div className="space-y-4">
                {pinnedItems.length > 0 && (
                  <SidebarGroup>
                    <SidebarGroupLabel>Pinned Shortcuts</SidebarGroupLabel>
                    <div className="space-y-0.5 pt-0.5 pb-1">
                      {pinnedItems.map((item) => (
                        <SidebarItem
                          key={item.id}
                          icon={<item.icon className="h-5 w-5" />}
                          label={item.label}
                          isActive={item.isActive}
                          onClick={item.onSelect}
                          onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                        />
                      ))}
                    </div>
                  </SidebarGroup>
                )}

                {groups.map((group) => (
                  <SidebarGroup key={group.id}>
                    <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                    <div className="space-y-0.5 pt-0.5 pb-1">
                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.id}
                          icon={<item.icon className="h-5 w-5" />}
                          label={item.label}
                          isActive={item.isActive}
                          onClick={item.onSelect}
                          onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          rightElement={item.isExpandable ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : undefined}
                        />
                      ))}
                    </div>
                  </SidebarGroup>
                ))}
              </div>
            ) : showAcademicsPanel ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowAcademicsPanel(false)}
                  className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <SidebarGroup>
                  <SidebarGroupLabel>Academics</SidebarGroupLabel>
                  <div className="space-y-0.5">
                    {academicsItems.map((item, index) => {
                      const showDivider = index === 6;
                      return (
                        <div key={item.id}>
                          {showDivider && <div className="my-2 border-t border-sidebar-border" />}
                          <SidebarItem
                            label={item.label}
                            isActive={item.isActive}
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SidebarGroup>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setShowHostelPanel(false)}
                  className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <SidebarGroup>
                  <SidebarGroupLabel>Hostel Hub</SidebarGroupLabel>
                  <div className="space-y-0.5">
                    {hostelSubItems.map((item) => (
                      <SidebarItem
                        key={item.id}
                        label={item.label}
                        isActive={item.isActive}
                        onClick={item.onSelect}
                        onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                      />
                    ))}
                  </div>
                </SidebarGroup>
              </div>
            )}
          </SidebarContent>
        ) : (
          /* Compact Mode Rail Content */
            <div className="flex flex-1 min-h-0 flex-col items-center justify-start w-full mt-3">
            {/* Divider */}
            <div className="w-8 border-t border-sidebar-border mb-3" />

            {pinnedItems.length > 0 && (
              <>
                <nav className="flex flex-col items-center gap-2.5 w-full mb-3" aria-label="Pinned rail shortcuts">
                  {pinnedItems.map(item => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.id} className="relative flex justify-center group/rail">
                        <button
                          onClick={item.onSelect}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 ${
                            item.isActive
                              ? railActiveStyles
                              : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                          } ${navButtonBase}`}
                          title={item.label}
                          aria-label={`Open ${item.label}`}
                        >
                          <ItemIcon className={`h-5 w-5 transition-transform duration-300 ${item.isActive ? 'scale-110 text-info' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </nav>
                {/* Secondary Divider */}
                <div className="w-8 border-t border-sidebar-border mb-3" />
              </>
            )}

            {/* Navigation Rail Buttons */}
            <nav className="flex flex-col items-center gap-2.5 w-full" aria-label="Navigation rail">
              {groups.map(group => {
                const GroupIcon = group.icon;
                const isActive = group.id === "study"
                  ? activeTab === "home" || activeTab === "attendance" || activeTab === "academics"
                  : group.id === "campus"
                  ? ["payments", "libraries", "hostel", "transport"].includes(activeTab)
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
        <SidebarFooter>
          <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="footer-expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 px-4 py-3 rounded-b-[24px] space-y-2.5"
            >
              <SidebarProfile
                name={profileName}
                degree={(profileData?.program || profileData?.branch || profileData?.batch || "").replace("B.Tech ", "")}
                avatarUrl={shouldDisplayProfilePhoto ? profileData?.image : undefined}
                initials={initials || "ST"}
                onLogout={handleLogOutRequest}
              />

              <div className="h-px bg-sidebar-accent" />

              <SidebarThemeControl theme={theme} onThemeChange={handleThemeChange} />
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
              <SidebarExpandButton onClick={() => persistSidebarState(!settings.isSidebarCollapsed)} />

              {/* Theme Toggler (Compact Icon) */}
              <SidebarThemeControl theme={theme} onThemeChange={handleThemeChange} />

              {/* Profile Avatar */}
              <SidebarProfile
                avatarUrl={shouldDisplayProfilePhoto ? profileData?.image : undefined}
                initials={initials || "ST"}
                onProfileClick={() => selectTab("profile")}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </SidebarFooter>

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
      </Sidebar>
    </>
  );
}
