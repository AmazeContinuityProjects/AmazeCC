"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import OptionPicker from "../shared/primitives/OptionPicker";
import AppLibraryPortal from "./AppLibraryPortal";

import { getAssetPath } from "@/lib/utils";
import { formatSemesterName } from "@/lib/formatSemesterName";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";
import { createTapTracker, hasSectionHome, sectionHomeFor } from "@/lib/sectionHome";
import { useOverlayBack } from "@/lib/overlayStack";
import { animateThemeCircularExpansion } from "../ThemeToggle";
import {
  BookOpen,
  Building,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  Command,
  CreditCard,
  GraduationCap,
  Home,
  Library,
  LayoutGrid,
  Menu,
  RefreshCcw,
  Settings,
  User,
  Wrench,
  WifiOff,
  Calendar,
  Compass,
  Key,
  ArrowLeft,
  Bus,
  Search,
  Coffee,
  Info,
  LogOut,
  CarTaxiFront,
  MoreHorizontal,
  Rss,
  Layers,
  Sparkles,
  Database,
  UserCheck,
  DoorOpen,
  Users,
  UsersRound,
  UserSearch,
  ScanLine,
  type LucideIcon,
  AlertTriangle,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
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
import { useSyncTrigger } from "../shared/useSyncTrigger";
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

type MobileNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
};

const MobileBottomNav = memo(function MobileBottomNav({
  items,
  onItemTap,
}: {
  items: MobileNavItem[];
  onItemTap: (item: MobileNavItem) => void;
}) {
  return (
    <div className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[380px] z-40 bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/60 dark:border-zinc-800/80 rounded-[24px] p-1.5 shadow-[0_12px_35px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_35px_-8px_rgba(0,0,0,0.55)] flex items-center justify-around mobile-bottom-nav-bar">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemTap(item)}
          aria-label={hasSectionHome(item.id) ? `${item.label} — double tap for home` : item.label}
          title={item.label}
          className="flex items-center justify-center flex-1 py-2 relative select-none cursor-pointer group focus:outline-none transition-transform active:scale-95 motion-reduce:transition-none"
        >
          {item.isActive && <div className="absolute inset-1 rounded-2xl bg-info-surface/90 dark:bg-info/10 z-0" />}
          <div className="relative z-10 flex items-center justify-center">
            <div
              className={`p-1.5 transition-[color,transform] duration-200 ${
                item.isActive
                  ? "scale-[1.15] text-info"
                  : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
              }`}
            >
              {item.icon}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

const navButtonBase = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";

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
  activeToolsSubTab,
  setActiveToolsSubTab,
  activeSubTab,
  setActiveSubTab,
  HostelActiveSubTab,
  setHostelActiveSubTab,
  activeDayscholarSubTab,
  setActiveDayscholarSubTab,
  activeMoreSubTab,
  setActiveMoreSubTab,
  activeProfileSubTab,
  setActiveProfileSubTab,
  onOpenFeedbackStatus,
  onOpenCommandPalette,
  onCollapseScreenChange,
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
  void activeToolsSubTab;
  void setActiveToolsSubTab;
  void feedbackStatus;
  void onOpenFeedbackStatus;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));
  const [profileData, setProfileData] = useState<any>(null);

  // Progressive disclosure
  const [showAcademicsPanel, setShowAcademicsPanel] = useState(activeTab === "academics");
  const [showToolsPanel, setShowToolsPanel] = useState(activeTab === "tools");
  const [showHostelPanel, setShowHostelPanel] = useState(activeTab === "hostel");
  const [activeRailGroup, setActiveRailGroup] = useState<string | null>(null);
  const [isAppLibraryOpen, setIsAppLibraryOpen] = useState(false);

  // System back (incl. Android predictive back) dismisses the App Library
  // directly, before screen navigation does
  useOverlayBack("app-library", isAppLibraryOpen, () => setIsAppLibraryOpen(false));

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

  // Keep the matching drill-in panel open for section-level destinations.
  useEffect(() => {
    if (activeTab === "academics") {
      setShowAcademicsPanel(true);
      setShowToolsPanel(false);
      setShowHostelPanel(false);
    } else if (activeTab === "tools") {
      setShowToolsPanel(true);
      setShowAcademicsPanel(false);
      setShowHostelPanel(false);
    } else if (activeTab === "hostel") {
      setShowHostelPanel(true);
      setShowToolsPanel(false);
      setShowAcademicsPanel(false);
    } else {
      setShowAcademicsPanel(false);
      setShowToolsPanel(false);
      setShowHostelPanel(false);
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

  const persistSidebarState = useCallback(
    (nextCollapsed: boolean) => {
      setSettings((prev) => ({ ...prev, isSidebarCollapsed: nextCollapsed }));
    },
    [setSettings],
  );

  const handleReloadClick = useCallback(async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    window.setTimeout(() => setIsSpinning(false), 600);
  }, [handleReloadRequest]);

  const { isOffline, triggerSync: handleSyncClick } = useSyncTrigger(handleReloadClick);

  const selectTab = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      window.scrollTo(0, 0);
    },
    [setActiveTab],
  );

  const toggleRailPopover = useCallback((groupId: string) => {
    setActiveRailGroup((current) => (current === groupId ? null : groupId));
  }, []);

  // Removed old layout items as they are now fully isolated inside AppLibraryPortal

  const tabIcons = useMemo<Record<string, { icon: React.ReactNode; label: string }>>(
    () => ({
      attendance:
        activeAttendanceSubTab === "calendar"
          ? { icon: <Calendar className="h-5 w-5 stroke-[2]" />, label: "Calendar" }
          : { icon: <CalendarCheck className="h-5 w-5 stroke-[2]" />, label: "Attendance" },
      academics: { icon: <GraduationCap className="h-5 w-5 stroke-[2]" />, label: "Academics" },
      tools: { icon: <Layers className="h-5 w-5 stroke-[2]" />, label: "Tools" },
      payments: { icon: <CreditCard className="h-5 w-5 stroke-[2]" />, label: "Payments" },
      libraries: { icon: <Library className="h-5 w-5 stroke-[2]" />, label: "Libraries" },
      events: { icon: <Calendar className="h-5 w-5 stroke-[2]" />, label: "Event Hub" },
      clubs: { icon: <LayoutGrid className="h-5 w-5 stroke-[2]" />, label: "Club Hub" },
      community: { icon: <Rss className="h-5 w-5 stroke-[2]" />, label: "Announcements" },
      "free-class": { icon: <DoorOpen className="h-5 w-5 stroke-[2]" />, label: "Free Classrooms" },
      "paper-scanner": { icon: <ScanLine className="h-5 w-5 stroke-[2]" />, label: "Paper Scanner" },
      "faculty-schedule": { icon: <UserSearch className="h-5 w-5 stroke-[2]" />, label: "Faculty Schedule" },
      "friend-finder": { icon: <UsersRound className="h-5 w-5 stroke-[2]" />, label: "Find Classmates" },
      cabshare: { icon: <CarTaxiFront className="h-5 w-5 stroke-[2]" />, label: "Cab Share" },
      transport: { icon: <Bus className="h-5 w-5 stroke-[2]" />, label: "Transport" },
      more: { icon: <MoreHorizontal className="h-5 w-5 stroke-[2]" />, label: "More" },
      profile: { icon: <User className="h-5 w-5 stroke-[2]" />, label: "Profile" },
      credentials: { icon: <Key className="h-5 w-5 stroke-[2]" />, label: "Credentials" },
    }),
    [activeAttendanceSubTab],
  );

  const togglePin = useCallback(
    (tabId: string) => {
      const current = settings?.pinnedNavTabs ?? [];
      const isPinned = current.includes(tabId);
      const atLimit = !isPinned && current.length >= 4;
      if (atLimit) return;
      const next = isPinned ? current.filter((id: string) => id !== tabId) : [...current, tabId];
      setSettings((prev: any) => {
        const updated = { ...prev, pinnedNavTabs: next };
        return updated;
      });
    },
    [settings, setSettings],
  );

  const rawNavItems = useMemo(() => {
    const pinnedTabs = settings?.pinnedNavTabs ?? [];
    const rawItems: MobileNavItem[] = [
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
      rawItems.push({
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
          rawItems.push({
            id: tabId,
            icon: t.icon,
            label: t.label,
            isActive:
              tabId === "credentials"
                ? activeTab === "profile" && activeProfileSubTab === "credentials" && !isAppLibraryOpen
                : activeTab === tabId && !isAppLibraryOpen,
            onClick: () => {
              setIsAppLibraryOpen(false);
              if (tabId === "credentials") {
                selectTab("profile");
                setActiveProfileSubTab("credentials");
              } else {
                selectTab(tabId);
                if (tabId === "attendance") {
                  setActiveAttendanceSubTab("calendar");
                }
              }
            },
          });
        }
      });
    }

    rawItems.push({
      id: "modules",
      icon: <LayoutGrid className="h-5 w-5 stroke-[2]" />,
      label: "Modules",
      isActive: isAppLibraryOpen,
      onClick: () => {
        setIsAppLibraryOpen((prev) => !prev);
      },
    });

    return rawItems;
  }, [
    settings?.pinnedNavTabs,
    activeTab,
    activeProfileSubTab,
    isAppLibraryOpen,
    selectTab,
    openCommandPalette,
    tabIcons,
    setIsAppLibraryOpen,
    setActiveAttendanceSubTab,
    setActiveProfileSubTab,
  ]);

  const sidebarActiveStyles = "bg-sidebar-accent border border-sidebar-border text-info font-semibold";
  const railActiveStyles = "bg-sidebar-accent text-info border border-sidebar-border shadow-sm";

  const handleThemeChange = (selectedTheme: string, e?: React.MouseEvent<HTMLElement>) => {
    if (theme === selectedTheme) return;
    animateThemeCircularExpansion(e || null, selectedTheme, setTheme);
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
  const studyItems = useMemo<NavItem[]>(
    () => [
      {
        id: "home",
        label: "Home",
        icon: Home,
        isActive: activeTab === "home",
        onSelect: () => selectTab("home"),
      },
      {
        id: "calendar",
        label: "Timetable Calendar",
        icon: Calendar,
        isActive: activeTab === "attendance",
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
          if (!activeSubTab || activeSubTab === "overview") setActiveSubTab("courses-simplified");
          setShowAcademicsPanel(true);
        },
      },
    ],
    [activeTab, activeSubTab, selectTab, setActiveAttendanceSubTab, setActiveSubTab],
  );

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
      {
        id: "transport",
        label: "Transport",
        icon: Bus,
        isActive: activeTab === "transport",
        onSelect: () => selectTab("transport"),
      },
      {
        id: "events",
        label: "Event Hub",
        icon: Calendar,
        isActive: activeTab === "events",
        onSelect: () => selectTab("events"),
      },
      {
        id: "clubs",
        label: "Club Hub",
        icon: LayoutGrid,
        isActive: activeTab === "clubs",
        onSelect: () => selectTab("clubs"),
      },
      {
        id: "community",
        label: "Announcements",
        icon: Rss,
        isActive: activeTab === "community",
        onSelect: () => selectTab("community"),
      },
      {
        id: "free-class",
        label: "Free Classrooms",
        icon: DoorOpen,
        // Preserve highlighting for older saved navigation state.
        isActive: activeTab === "free-class" || (activeTab === "tools" && activeToolsSubTab === "free-class"),
        onSelect: () => selectTab("free-class"),
      },
      {
        id: "faculty-schedule",
        label: "Faculty Schedule",
        icon: UserSearch,
        isActive: activeTab === "faculty-schedule",
        onSelect: () => selectTab("faculty-schedule"),
      },
      {
        id: "friend-finder",
        label: "Find Classmates",
        icon: UsersRound,
        isActive: activeTab === "friend-finder",
        onSelect: () => selectTab("friend-finder"),
      },
    ];

    if (isHosteller === true || residentialStatus === "hosteller") {
      items.push({
        id: "hostel",
        label: "Hostel Hub",
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

    return items;
  }, [
    activeTab,
    activeToolsSubTab,
    isHosteller,
    residentialStatus,
    selectTab,
    setActiveToolsSubTab,
    HostelActiveSubTab,
    setHostelActiveSubTab,
  ]);

  const toolsItems = useMemo<NavItem[]>(
    () => [
      {
        id: "ffcs",
        label: "FFCS Planner",
        icon: Compass,
        isActive:
          (activeTab === "more" && activeMoreSubTab === "ffcs") ||
          (activeTab === "tools" && activeToolsSubTab === "ffcs"),
        onSelect: navigateToFFCSPlanner,
      },
      {
        id: "paper-scanner",
        label: "Paper Scanner",
        icon: ScanLine,
        isActive: activeTab === "paper-scanner",
        onSelect: () => selectTab("paper-scanner"),
      },
      {
        id: "student-report",
        label: "Student Report",
        icon: GraduationCap,
        isActive: activeTab === "student-report",
        onSelect: () => selectTab("student-report"),
      },
      {
        id: "tools",
        label: "Tools & Utilities Hub",
        icon: Layers,
        isActive: activeTab === "tools" && (!activeToolsSubTab || activeToolsSubTab === "overview"),
        isExpandable: true,
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("overview");
          setShowToolsPanel(true);
        },
      },
    ],
    [activeTab, activeToolsSubTab, selectTab, setActiveToolsSubTab],
  );

  const accountItems = useMemo<NavItem[]>(
    () => [
      {
        id: "profile",
        label: "Settings & Profile",
        icon: User,
        isActive: activeTab === "profile",
        onSelect: () => {
          // "settings" is the category hub. Without this the sidebar inherited
          // whatever section was last open and could re-open mid-section on a
          // return visit, or land on Student Profile on a cold start.
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
    ],
    [activeTab, selectTab, setActiveProfileSubTab],
  );

  const groups = useMemo<Group[]>(
    () => [
      { id: "study", label: "Study", icon: BookOpen, items: studyItems },
      { id: "campus", label: "Campus", icon: Building, items: campusItems },
      { id: "tools", label: "Tools", icon: Wrench, items: toolsItems },
      { id: "account", label: "Account", icon: Settings, items: accountItems },
    ],
    [studyItems, campusItems, toolsItems, accountItems],
  );

  const pinnedItems = useMemo(() => {
    const pinnedTabs = settings?.pinnedNavTabs ?? [];
    const tabData: Record<string, { label: string; icon: any; onSelect: () => void; isActive: boolean }> = {
      attendance: {
        label: "Attendance",
        icon: CalendarCheck,
        isActive: activeTab === "attendance",
        onSelect: () => {
          selectTab("attendance");
        },
      },
      academics: {
        label: "Academics",
        icon: GraduationCap,
        isActive: activeTab === "academics",
        onSelect: () => {
          selectTab("academics");
        },
      },
      tools: {
        label: "Tools",
        icon: Layers,
        isActive: activeTab === "tools",
        onSelect: () => {
          selectTab("tools");
        },
      },
      payments: {
        label: "Payments",
        icon: CreditCard,
        isActive: activeTab === "payments",
        onSelect: () => {
          selectTab("payments");
        },
      },
      libraries: {
        label: "Libraries",
        icon: Library,
        isActive: activeTab === "libraries",
        onSelect: () => {
          selectTab("libraries");
        },
      },
      events: {
        label: "Event Hub",
        icon: Calendar,
        isActive: activeTab === "events",
        onSelect: () => {
          selectTab("events");
        },
      },
      clubs: {
        label: "Club Hub",
        icon: LayoutGrid,
        isActive: activeTab === "clubs",
        onSelect: () => {
          selectTab("clubs");
        },
      },
      community: {
        label: "Announcements",
        icon: Rss,
        isActive: activeTab === "community",
        onSelect: () => {
          selectTab("community");
        },
      },
      "free-class": {
        label: "Free Classrooms",
        icon: DoorOpen,
        isActive: activeTab === "free-class" || (activeTab === "tools" && activeToolsSubTab === "free-class"),
        onSelect: () => {
          selectTab("free-class");
        },
      },
      "faculty-schedule": {
        label: "Faculty Schedule",
        icon: UserSearch,
        isActive: activeTab === "faculty-schedule",
        onSelect: () => {
          selectTab("faculty-schedule");
        },
      },
      "friend-finder": {
        label: "Find Classmates",
        icon: UsersRound,
        isActive: activeTab === "friend-finder",
        onSelect: () => {
          selectTab("friend-finder");
        },
      },
      "paper-scanner": {
        label: "Paper Scanner",
        icon: ScanLine,
        isActive: activeTab === "paper-scanner",
        onSelect: () => {
          selectTab("paper-scanner");
        },
      },
      cabshare: {
        label: "Cab Share",
        icon: CarTaxiFront,
        isActive: activeTab === "cabshare",
        onSelect: () => {
          selectTab("cabshare");
        },
      },
      transport: {
        label: "Transport",
        icon: Bus,
        isActive: activeTab === "transport",
        onSelect: () => {
          selectTab("transport");
        },
      },
      more: {
        label: "More",
        icon: MoreHorizontal,
        isActive: activeTab === "more",
        onSelect: () => {
          selectTab("more");
        },
      },
      profile: {
        label: "Profile",
        icon: User,
        isActive: activeTab === "profile",
        onSelect: () => {
          selectTab("profile");
        },
      },
    };
    return pinnedTabs.map((id: string) => ({ id, ...tabData[id] })).filter((item: any) => item.label !== undefined);
  }, [settings?.pinnedNavTabs, activeTab, selectTab]);

  const academicsItems = useMemo(
    () => [
      {
        id: "courses-simplified",
        label: "My Courses & Marks",
        icon: Sparkles,
        isActive:
          activeTab === "academics" &&
          (activeSubTab === "courses-simplified" ||
            activeSubTab === "simplified-academics" ||
            activeSubTab === "overview" ||
            activeSubTab === "course-dashboard"),
        onSelect: () => {
          selectTab("academics");
          setActiveSubTab("courses-simplified");
        },
      },
      {
        id: "schedule",
        label: "Exam Schedule",
        icon: Calendar,
        isActive: activeTab === "academics" && activeSubTab === "schedule",
        onSelect: () => {
          selectTab("academics");
          setActiveSubTab("schedule");
        },
      },
      {
        id: "grades",
        label: "Grade History",
        icon: GraduationCap,
        isActive: activeTab === "academics" && activeSubTab === "grades",
        onSelect: () => {
          selectTab("academics");
          setActiveSubTab("grades");
        },
      },
      {
        id: "curriculum",
        label: "Curriculum",
        icon: BookOpen,
        isActive: activeTab === "academics" && activeSubTab === "curriculum",
        onSelect: () => {
          selectTab("academics");
          setActiveSubTab("curriculum");
        },
      },
    ],
    [activeTab, activeSubTab, selectTab, setActiveSubTab],
  );

  const toolsSubItems = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        icon: Layers,
        isActive: activeTab === "tools" && (activeToolsSubTab === "overview" || !activeToolsSubTab),
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("overview");
        },
      },
      {
        id: "qbank",
        label: "Question Bank",
        icon: Database,
        isActive: activeTab === "tools" && activeToolsSubTab === "qbank",
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("qbank");
        },
      },
      {
        id: "faculty-info",
        label: "Faculty Explorer",
        icon: UserCheck,
        isActive: activeTab === "tools" && activeToolsSubTab === "faculty-info",
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("faculty-info");
        },
      },
      {
        id: "social",
        label: "Timetable Sharing",
        icon: Users,
        isActive: activeTab === "tools" && activeToolsSubTab === "social",
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("social");
        },
      },
      {
        id: "cabshare",
        label: "Cab Share",
        icon: CarTaxiFront,
        isActive: activeTab === "cabshare" || (activeTab === "tools" && activeToolsSubTab === "cabshare"),
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("cabshare");
        },
      },
      {
        id: "tasks",
        label: "Tasks & Schedule",
        icon: CheckSquare,
        isActive: activeTab === "tools" && activeToolsSubTab === "tasks",
        onSelect: () => {
          selectTab("tools");
          setActiveToolsSubTab?.("tasks");
        },
      },
    ],
    [activeTab, activeToolsSubTab, selectTab, setActiveToolsSubTab],
  );

  const hostelSubItems = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        icon: Building,
        isActive: activeTab === "hostel" && HostelActiveSubTab === "overview",
        onSelect: () => {
          selectTab("hostel");
          setHostelActiveSubTab("overview");
        },
      },
      {
        id: "mess",
        label: "Mess Menu",
        icon: Coffee,
        isActive: activeTab === "hostel" && HostelActiveSubTab === "mess",
        onSelect: () => {
          selectTab("hostel");
          setHostelActiveSubTab("mess");
        },
      },
      {
        id: "laundry",
        label: "Laundry",
        icon: Wrench,
        isActive: activeTab === "hostel" && HostelActiveSubTab === "laundry",
        onSelect: () => {
          selectTab("hostel");
          setHostelActiveSubTab("laundry");
        },
      },
      {
        id: "leave",
        label: "Leave Management",
        icon: Compass,
        isActive: activeTab === "hostel" && HostelActiveSubTab === "leave",
        onSelect: () => {
          selectTab("hostel");
          setHostelActiveSubTab("leave");
        },
      },
      {
        id: "counselling",
        label: "Counselling",
        icon: User,
        isActive: activeTab === "hostel" && HostelActiveSubTab === "counselling",
        onSelect: () => {
          selectTab("hostel");
          setHostelActiveSubTab("counselling");
        },
      },
    ],
    [activeTab, HostelActiveSubTab, selectTab, setHostelActiveSubTab],
  );

  /**
   * Single tap does the tab's normal thing; a second tap on the same icon inside
   * `DOUBLE_TAP_MS` takes that section to its home sub-screen.
   *
   * The first tap is *not* delayed waiting to see whether a second follows: an
   * icon that felt laggy would be worse than a double tap being one step late,
   * which is how Android's own double-tap-to-top behaves.
   */
  const navTaps = useMemo(() => createTapTracker(), []);

  const handleNavItemTap = useCallback(
    (item: { id: string; onClick: () => void; isActive: boolean }) => {
      const outcome = navTaps.tap(item.id, { wasActive: item.isActive });
      if (outcome.kind === "single") {
        item.onClick();
        return;
      }

      const home = sectionHomeFor(item.id, {
        setActiveAttendanceSubTab,
        setActiveSubTab,
        setActiveToolsSubTab,
        setActiveDayscholarSubTab,
        setActiveMoreSubTab,
        setActiveProfileSubTab,
      });
      // A toggle icon (search, modules) has no home, and a single-screen tab
      // needs no reset - in both cases the normal tap already did everything
      // there is to do, so the double tap falls through to it.
      if (!home) {
        item.onClick();
        return;
      }

      setIsAppLibraryOpen(false);
      selectTab(item.id);
      // When the first tap switched sections it already committed and wrote
      // that section as its own screen, so fold this move into it. Otherwise the
      // double tap would be two Back steps instead of one.
      if (outcome.collapseFirstTap) {
        onCollapseScreenChange?.();
      }
    },
    [
      navTaps,
      selectTab,
      setIsAppLibraryOpen,
      onCollapseScreenChange,
      setActiveAttendanceSubTab,
      setActiveSubTab,
      setActiveToolsSubTab,
      setActiveDayscholarSubTab,
      setActiveMoreSubTab,
      setActiveProfileSubTab,
    ],
  );

  const renderMobileNav = () => {
    return (
      <>
        {/* Sleek Floating Pill Bottom Navigation Bar (Icon-Only on Mobile).
            z-40, deliberately below every overlay surface: the option-picker
            portal paints at z-50, sheets at z-55/60. At z-55 this pill floated
            *above* an open picker — staying bright and tappable under the dim,
            swallowing outside-taps meant to dismiss, and covering popups that
            extended into its region. A bottom nav must dim with the page, not
            hover over modals. */}
        <MobileBottomNav items={rawNavItems} onItemTap={handleNavItemTap} />

        <AppLibraryPortal
          open={isAppLibraryOpen}
          onClose={() => setIsAppLibraryOpen(false)}
          settings={settings}
          setSettings={setSettings}
          selectTab={selectTab}
          setActiveAttendanceSubTab={setActiveAttendanceSubTab}
          setActiveToolsSubTab={setActiveToolsSubTab}
          setActiveSubTab={setActiveSubTab}
          setHostelActiveSubTab={setHostelActiveSubTab}
          setActiveMoreSubTab={setActiveMoreSubTab}
          setActiveProfileSubTab={setActiveProfileSubTab}
          handleLogOutRequest={handleLogOutRequest}
          handleReloadRequest={handleReloadRequest}
          isHosteller={isHosteller}
          residentialStatus={residentialStatus}
          theme={theme}
          handleThemeChange={handleThemeChange}
          openCommandPalette={openCommandPalette}
          tabIcons={tabIcons}
          togglePin={togglePin}
        />
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
              <img
                loading="lazy"
                decoding="async"
                src={currentIcon}
                alt="AmazeCC"
                className="h-7 w-7 rounded-lg object-contain shadow-xs"
              />
              {isOpen && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">AmazeCC</h2>
              )}
            </div>
            {isOpen && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleSyncClick}
                  className={`relative hit-expand group rounded-xl px-2.5 py-1.5 transition-all duration-300 hover:scale-105 flex items-center gap-1.5 text-xs font-bold ${navButtonBase} ${
                    isOffline
                      ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                  title={isOffline ? "You're offline — tap for details" : "Sync Data from VTOP"}
                  aria-label={isOffline ? "Offline — tap for details" : "Sync Data from VTOP"}
                  aria-live="polite"
                >
                  {isOffline ? (
                    <WifiOff className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <RefreshCcw
                      className={`h-3.5 w-3.5 transition-transform ${isSpinning ? "animate-spin text-indigo-500" : "group-hover:rotate-180 duration-500"}`}
                    />
                  )}
                  <span>{isOffline ? "Offline" : "Sync"}</span>
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
              <m.div
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
                    <div className="font-semibold text-sidebar-foreground/75 tracking-wide text-[10px] uppercase">
                      Current Semester
                    </div>
                    <div role="group" aria-label="Current semester" className="flex max-w-[9rem] shrink-0">
                      <OptionPicker
                        value={settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                        onChange={(val) => {
                          handleReloadRequest(val);
                        }}
                        options={config.semesterIDs.map((semId: string) => ({
                          value: semId,
                          label: formatSemesterName(semId),
                        }))}
                        searchable={false}
                        className="w-full [&>button:first-child]:h-auto [&>button:first-child]:p-0 [&>button:first-child]:rounded-none [&>button:first-child]:border-none [&>button:first-child]:shadow-none [&>button:first-child]:justify-end [&>button:first-child]:text-info [&>button:first-child]:hover:underline [&>button:first-child_span]:text-[10px] [&>button:first-child_span]:font-semibold [&>button:first-child_span]:text-info [&>button:first-child_svg]:h-3 [&>button:first-child_svg]:w-3"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {shouldDisplayGpa && (
                      <button
                        onClick={() => {
                          setSettings((prev: any) => {
                            const next = { ...prev, CGPAHidden: !prev.CGPAHidden };
                            return next;
                          });
                        }}
                        className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                        title="Click to show/hide CGPA"
                      >
                        <span className="text-sidebar-foreground/">CGPA</span>
                        <span
                          data-private
                          className={`font-semibold text-sidebar-foreground transition-all duration-300 ${settings.CGPAHidden ? "blur-[4.5px] select-none" : ""}`}
                        >
                          {marksData?.cgpa?.cgpa || "-"}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSettings((prev: any) => {
                          const next = {
                            ...prev,
                            attendancePercentageOrString:
                              prev.attendancePercentageOrString === "percentage" ? "str" : "percentage",
                          };
                          return next;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to toggle attendance format"
                    >
                      <span className="text-sidebar-foreground/">Attendance</span>
                      {(() => {
                        // Colour alone does not say "below target" to everyone,
                        // so a warning icon and a spoken label carry it too.
                        const target = Number(settings?.targetAttendance) || 75;
                        const below = attendancePercentage?.percentage < target;
                        return (
                          <span
                            data-private
                            className={`inline-flex items-center gap-1 font-semibold ${below ? "text-rose-400" : "text-emerald-400"}`}
                            title={below ? `Below your ${target}% target` : `At or above your ${target}% target`}
                          >
                            {below ? <AlertTriangle className="w-3 h-3" aria-hidden="true" /> : null}
                            {attendanceValue}
                            <span className="sr-only">{below ? `, below your ${target}% target` : `, on track`}</span>
                          </span>
                        );
                      })()}
                    </button>

                    <button
                      onClick={() => setGradesDisplayIsOpen(true)}
                      className="flex justify-between items-center w-full text-left hover:bg-sidebar-accent rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-sidebar-foreground/ hover:text-sidebar-foreground"
                      title="Click to view credits & grades details"
                    >
                      <span className="text-sidebar-foreground/">Credits</span>
                      <span data-private className="font-semibold text-sidebar-foreground">{credits}</span>
                    </button>

                    <button
                      onClick={() => {
                        selectTab("attendance");
                        setActiveAttendanceSubTab("od");
                      }}
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
                  <span className="flex-1 truncate transition-colors group-hover:text-sidebar-foreground/">
                    Search anything...
                  </span>
                  <kbd className="rounded-md bg-sidebar-accent border border-sidebar-border px-1.5 py-0.5 text-[9px] font-bold text-sidebar-foreground/ shadow-sm transition-colors group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground">
                    ⌘K
                  </kbd>
                </button>
              </m.div>
            ) : (
              <m.div
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
              </m.div>
            )}
          </AnimatePresence>
        </SidebarHeader>

        {/* Navigation Content (Expanded Mode vs Compact Rail) */}
        {isOpen ? (
          <SidebarContent>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={
                  showAcademicsPanel ? "academics" : showToolsPanel ? "tools" : showHostelPanel ? "hostel" : "primary"
                }
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {!showAcademicsPanel && !showToolsPanel && !showHostelPanel ? (
                  <div className="space-y-4">
                    {pinnedItems.length > 0 && (
                      <SidebarGroup>
                        <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                        <div className="space-y-0.5">
                          {pinnedItems.map((item) => (
                            <SidebarItem
                              key={item.id}
                              icon={<item.icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />}
                              label={item.label}
                              isActive={item.isActive}
                              aria-current={item.isActive ? "page" : undefined}
                              data-sidebar-nav="true"
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
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
                        <div className="space-y-0.5">
                          {group.items.map((item) => (
                            <SidebarItem
                              key={item.id}
                              icon={<item.icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />}
                              label={item.label}
                              isActive={item.isActive}
                              aria-current={item.isActive ? "page" : undefined}
                              data-sidebar-nav="true"
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
                              rightElement={
                                item.isExpandable ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : undefined
                              }
                              onClick={item.onSelect}
                              onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
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
                      className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>

                    <SidebarGroup>
                      <SidebarGroupLabel>Academics</SidebarGroupLabel>
                      <div className="space-y-0.5">
                        {academicsItems.map((item) => (
                          <SidebarItem
                            key={item.id}
                            icon={<item.icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />}
                            label={item.label}
                            isActive={item.isActive}
                            aria-current={item.isActive ? "page" : undefined}
                            data-sidebar-nav="true"
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          />
                        ))}
                      </div>
                    </SidebarGroup>
                  </div>
                ) : showToolsPanel ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setShowToolsPanel(false)}
                      className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>

                    <SidebarGroup>
                      <SidebarGroupLabel>Tools & Utilities</SidebarGroupLabel>
                      <div className="space-y-0.5">
                        {toolsSubItems.map((item) => (
                          <SidebarItem
                            key={item.id}
                            icon={<item.icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />}
                            label={item.label}
                            isActive={item.isActive}
                            aria-current={item.isActive ? "page" : undefined}
                            data-sidebar-nav="true"
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          />
                        ))}
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
                            icon={<item.icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />}
                            label={item.label}
                            isActive={item.isActive}
                            aria-current={item.isActive ? "page" : undefined}
                            data-sidebar-nav="true"
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
                            onClick={item.onSelect}
                            onKeyDown={(event) => handleNavKeyDown(event, item.onSelect)}
                          />
                        ))}
                      </div>
                    </SidebarGroup>
                  </div>
                )}
              </m.div>
            </AnimatePresence>
          </SidebarContent>
        ) : (
          /* Compact Mode Rail Content */
          <div className="flex flex-1 min-h-0 flex-col items-center justify-start w-full mt-3">
            {/* Divider */}
            <div className="w-8 border-t border-sidebar-border mb-3" />

            {pinnedItems.length > 0 && (
              <>
                <nav className="flex flex-col items-center gap-2.5 w-full mb-3" aria-label="Pinned rail shortcuts">
                  {pinnedItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.id} className="relative flex justify-center group/rail">
                        <button
                          onClick={item.onSelect}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-[transform,color,background-color,border-color,box-shadow] duration-200 hover:scale-105 ${
                            item.isActive
                              ? railActiveStyles
                              : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                          } ${navButtonBase}`}
                          title={item.label}
                          aria-label={`Open ${item.label}`}
                        >
                          <ItemIcon
                            className={`h-5 w-5 transition-transform duration-300 ${item.isActive ? "scale-110 text-info" : ""}`}
                          />
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
              {groups.map((group) => {
                const GroupIcon = group.icon;
                const isActive =
                  group.id === "study"
                    ? activeTab === "home" || activeTab === "attendance" || activeTab === "academics"
                    : group.id === "campus"
                      ? [
                          "payments",
                          "libraries",
                          "events",
                          "clubs",
                          "community",
                          "free-class",
                          "faculty-schedule",
                          "friend-finder",
                          "hostel",
                          "transport",
                        ].includes(activeTab)
                      : group.id === "tools"
                        ? activeTab === "tools" ||
                          activeTab === "more" ||
                          activeTab === "cabshare" ||
                          activeTab === "paper-scanner"
                        : activeTab === "profile" || activeTab === "about";

                return (
                  <div key={group.id} className="relative flex justify-center group/rail">
                    <button
                      onClick={() => toggleRailPopover(group.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-[transform,color,background-color,border-color,box-shadow] duration-200 hover:scale-105 ${
                        isActive
                          ? railActiveStyles
                          : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                      } ${navButtonBase}`}
                      title={group.label}
                      aria-label={`Open ${group.label} menu`}
                      aria-expanded={activeRailGroup === group.id}
                    >
                      <GroupIcon
                        className={`h-5 w-5 transition-transform duration-300 ${isActive ? "scale-110 text-info" : ""}`}
                      />
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
              <m.div
                key="footer-expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="shrink-0 space-y-2.5"
              >
                <SidebarProfile
                  name={profileName}
                  degree={(profileData?.program || profileData?.branch || profileData?.batch || "").replace(
                    "B.Tech ",
                    "",
                  )}
                  avatarUrl={shouldDisplayProfilePhoto ? profileData?.image : undefined}
                  initials={initials || "ST"}
                  onLogout={handleLogOutRequest}
                />

                <div className="h-px bg-sidebar-accent" />

                <SidebarThemeControl theme={theme} onThemeChange={handleThemeChange} />
              </m.div>
            ) : (
              <m.div
                key="footer-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full shrink-0"
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
              </m.div>
            )}
          </AnimatePresence>
        </SidebarFooter>

        {/* Floating popover beside the compact rail */}
        <AnimatePresence>
          {activeRailGroup && (
            <m.div
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
                    {groups
                      .find((g) => g.id === "account")
                      ?.items.map((item) => (
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
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/"}`}
                          />
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
                        <m.div animate={{ rotate: isThemeExpanded ? 90 : 0 }} transition={{ duration: 0.18 }}>
                          <ChevronRight className="h-3 w-3 text-sidebar-foreground/" />
                        </m.div>
                      </button>
                      <m.div
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
                            <span
                              className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "light" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}
                            >
                              {theme === "light" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "light" ? "text-info font-medium" : ""}>Light</span>
                          </button>
                          <button
                            onClick={() => handleThemeChange("dark")}
                            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/ hover:text-sidebar-foreground py-0.5 transition-colors"
                          >
                            <span
                              className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${theme === "dark" ? "border-info text-info bg-info-surface" : "border-sidebar-border"}`}
                            >
                              {theme === "dark" && <span className="h-1 w-1 rounded-full bg-info" />}
                            </span>
                            <span className={theme === "dark" ? "text-info font-medium" : ""}>Dark</span>
                          </button>
                        </div>
                      </m.div>
                    </div>

                    {/* Log out */}
                    <button
                      onClick={() => {
                        handleLogOutRequest();
                        setActiveRailGroup(null);
                      }}
                      className="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground mt-1.5 border-t border-sidebar-border pt-1.5"
                    >
                      <LogOut className="h-4 w-4 shrink-0 text-sidebar-foreground/" />
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
                          {showDivider && <div className="my-1.5 border-t border-sidebar-border" />}
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
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/70"}`}
                            />
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
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/70"}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeRailGroup === "tools-sub" ? (
                <div>
                  <button
                    onClick={() => setActiveRailGroup("tools")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-sidebar-foreground/ hover:text-sidebar-foreground transition-colors border-b border-sidebar-border pb-1.5 mb-1.5 w-full text-left"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back to Tools</span>
                  </button>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: "none" }}>
                    {toolsSubItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          setActiveRailGroup(null);
                        }}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ${navButtonBase} ${item.isActive ? sidebarActiveStyles : "text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${item.isActive ? "text-info" : "text-sidebar-foreground/70"}`}
                        />
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
                    {groups
                      .find((g) => g.id === activeRailGroup)
                      ?.items.map((item) => {
                        const activeStyles = railActiveStyles;
                        const inactiveStyles =
                          "border-transparent text-sidebar-foreground/ hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-1";
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === "academics") {
                                setActiveRailGroup("academics");
                              } else if (item.id === "hostel") {
                                setActiveRailGroup("hostel-sub");
                              } else if (item.id === "tools") {
                                setActiveRailGroup("tools-sub");
                              } else {
                                item.onSelect();
                                setActiveRailGroup(null);
                              }
                            }}
                            className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 ${navButtonBase} ${
                              item.isActive ? activeStyles : inactiveStyles
                            }`}
                          >
                            <item.icon
                              className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 ${item.isActive ? "text-info scale-110" : "text-sidebar-foreground/ group-hover:text-sidebar-foreground"}`}
                            />
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
            </m.div>
          )}
        </AnimatePresence>
      </Sidebar>
    </>
  );
}

// Optimized Sub-component to isolate App Library state & prevent parent re-renders
