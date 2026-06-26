"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { getAssetPath } from "@/lib/utils";
import {
  BookOpen,
  Building,
  CalendarCheck,
  ChevronRight,
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
} from "lucide-react";

type NavChild = {
  id: string;
  label: string;
  short?: string;
  section?: string;
  isActive: () => boolean;
  onSelect: () => void;
};

type NavParent = {
  id: string;
  label: string;
  icon: any;
  children?: NavChild[];
  isActive: () => boolean;
  onSelect?: () => void;
  hidden?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: any;
  parents: NavParent[];
};

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
  void handleLogOutRequest;
  void currSemesterID;
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

  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(getAssetPath("/logo.png"));
  const [profileData, setProfileData] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    attendance: true,
    academics: true,
    hostel: true,
    more: true,
    profile: true,
  });
  const [flyoutId, setFlyoutId] = useState<string | null>(null);

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

  const isHosteller = profileData?.isHosteller;
  const mode = settings.isSidebarCollapsed ? "rail" : "expanded";
  const isExpandedMode = mode === "expanded";
  const isRailMode = mode === "rail";

  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum, day) => sum + day.total, 0)
      : 0;

  const persistSidebarState = (nextCollapsed: boolean) => {
    setSettings(prev => ({ ...prev, isSidebarCollapsed: nextCollapsed }));
    localStorage.setItem("settings", JSON.stringify({ ...settings, isSidebarCollapsed: nextCollapsed }));
  };

  const handleReloadClick = async () => {
    setIsSpinning(true);
    await handleReloadRequest();
    setTimeout(() => setIsSpinning(false), 600);
  };

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  const navigation = useMemo<NavGroup[]>(() => [
    {
      id: "study",
      label: "Study",
      icon: BookOpen,
      parents: [
        {
          id: "attendance",
          label: "Attendance",
          icon: CalendarCheck,
          isActive: () => activeTab === "attendance",
          children: [
            {
              id: "attendance.attendance",
              label: "Attendance",
              short: "A",
              isActive: () => activeTab === "attendance" && activeAttendanceSubTab === "attendance",
              onSelect: () => {
                selectTab("attendance");
                setActiveAttendanceSubTab("attendance");
              },
            },
            {
              id: "attendance.calendar",
              label: "Calendar",
              short: "C",
              isActive: () => activeTab === "attendance" && activeAttendanceSubTab === "calendar",
              onSelect: () => {
                selectTab("attendance");
                setActiveAttendanceSubTab("calendar");
              },
            },
          ],
        },
        {
          id: "academics",
          label: "Academics",
          icon: GraduationCap,
          isActive: () => activeTab === "academics",
          children: [
            {
              id: "academics.overview",
              label: "Overview",
              short: "O",
              isActive: () => activeTab === "academics" && activeSubTab === "overview",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("overview");
              },
            },
            {
              id: "academics.course-dashboard",
              label: "Course Dashboard",
              short: "D",
              isActive: () => activeTab === "academics" && activeSubTab === "course-dashboard",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("course-dashboard");
              },
            },
            {
              id: "academics.grades",
              label: "Grade History",
              short: "G",
              isActive: () => activeTab === "academics" && activeSubTab === "grades",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("grades");
              },
            },
            {
              id: "academics.curriculum",
              label: "Curriculum",
              short: "C",
              isActive: () => activeTab === "academics" && activeSubTab === "curriculum",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("curriculum");
              },
            },
            {
              id: "academics.predictor",
              label: "CGPA Predictor",
              short: "P",
              isActive: () => activeTab === "academics" && activeSubTab === "predictor",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("predictor");
              },
            },
            {
              id: "academics.qbank",
              label: "Question Bank",
              short: "Q",
              isActive: () => activeTab === "academics" && activeSubTab === "qbank",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("qbank");
              },
            },
            {
              id: "academics.arrear",
              label: "Arrear",
              short: "A",
              section: "Academic Tools",
              isActive: () => activeTab === "academics" && activeSubTab === "arrear",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("arrear");
              },
            },
            {
              id: "academics.makeup-compre",
              label: "Makeup & Compre",
              short: "M",
              isActive: () => activeTab === "academics" && activeSubTab === "makeup-compre",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("makeup-compre");
              },
            },
            {
              id: "academics.course-mgmt",
              label: "Course Management",
              short: "CM",
              isActive: () => activeTab === "academics" && activeSubTab === "course-mgmt",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("course-mgmt");
              },
            },
            {
              id: "academics.projects",
              label: "Projects",
              short: "Pr",
              isActive: () => activeTab === "academics" && activeSubTab === "projects",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("projects");
              },
            },
            {
              id: "academics.wishlist",
              label: "Wishlist",
              short: "W",
              isActive: () => activeTab === "academics" && activeSubTab === "wishlist",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("wishlist");
              },
            },
            {
              id: "academics.faculty-info",
              label: "Faculty Info",
              short: "F",
              isActive: () => activeTab === "academics" && activeSubTab === "faculty-info",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("faculty-info");
              },
            },
          ],
        },
      ],
    },
    {
      id: "campus",
      label: "Campus",
      icon: Building,
      parents: [
        {
          id: "payments",
          label: "Payments",
          icon: CreditCard,
          isActive: () => activeTab === "payments",
          onSelect: () => selectTab("payments"),
        },
        {
          id: "libraries",
          label: "Libraries",
          icon: Library,
          isActive: () => activeTab === "libraries",
          onSelect: () => selectTab("libraries"),
        },
        {
          id: "hostel",
          label: "Hostel",
          icon: Home,
          hidden: isHosteller !== true,
          isActive: () => activeTab === "hostel",
          children: [
            {
              id: "hostel.mess",
              label: "Mess",
              short: "M",
              isActive: () => activeTab === "hostel" && HostelActiveSubTab === "mess",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("mess");
              },
            },
            {
              id: "hostel.laundry",
              label: "Laundry",
              short: "L",
              isActive: () => activeTab === "hostel" && HostelActiveSubTab === "laundry",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("laundry");
              },
            },
            {
              id: "hostel.leave",
              label: "Leave",
              short: "Lv",
              isActive: () => activeTab === "hostel" && HostelActiveSubTab === "leave",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("leave");
              },
            },
            {
              id: "hostel.counselling",
              label: "Counselling",
              short: "C",
              isActive: () => activeTab === "hostel" && HostelActiveSubTab === "counselling",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("counselling");
              },
            },
          ],
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      icon: Wrench,
      parents: [
        {
          id: "more",
          label: "More",
          icon: LayoutGrid,
          isActive: () => activeTab === "more",
          children: [
            {
              id: "tools.social",
              label: "Social",
              short: "S",
              isActive: () => activeTab === "more" && activeMoreSubTab === "social",
              onSelect: () => {
                selectTab("more");
                setActiveMoreSubTab("social");
              },
            },
            {
              id: "tools.ffcs",
              label: "FFCS Planner",
              short: "F",
              isActive: () => activeTab === "more" && activeMoreSubTab === "ffcs",
              onSelect: () => {
                selectTab("more");
                setActiveMoreSubTab("ffcs");
              },
            },
            {
              id: "tools.events",
              label: "Event Hub",
              short: "E",
              isActive: () => activeTab === "more" && activeMoreSubTab === "events",
              onSelect: () => {
                selectTab("more");
                setActiveMoreSubTab("events");
              },
            },
          ],
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      parents: [
        {
          id: "profile",
          label: "Profile",
          icon: User,
          isActive: () => activeTab === "profile",
          children: [
            {
              id: "settings.info",
              label: "My Info",
              short: "I",
              isActive: () => false,
              onSelect: () => {
                selectTab("profile");
                setActiveProfileSubTab("info");
              },
            },
            {
              id: "settings.credentials",
              label: "Credentials",
              short: "Cr",
              isActive: () => activeTab === "profile" && activeProfileSubTab === "credentials",
              onSelect: () => {
                selectTab("profile");
                setActiveProfileSubTab("credentials");
              },
            },
            {
              id: "settings.preferences",
              label: "Preferences",
              short: "P",
              isActive: () => activeTab === "profile" && activeProfileSubTab === "info",
              onSelect: () => {
                selectTab("profile");
                setActiveProfileSubTab("info");
              },
            },
          ],
        },
      ],
    },
  ], [
    activeAttendanceSubTab,
    activeMoreSubTab,
    activeProfileSubTab,
    activeSubTab,
    activeTab,
    HostelActiveSubTab,
    isHosteller,
  ]);

  const visibleGroups = navigation
    .map(group => ({ ...group, parents: group.parents.filter(parent => !parent.hidden) }))
    .filter(group => group.parents.length > 0);

  const toggleParent = (parent: NavParent) => {
    if (parent.children?.length) {
      setExpanded(prev => ({ ...prev, [parent.id]: !prev[parent.id] }));
      return;
    }
    parent.onSelect?.();
  };

  const selectChild = (child: NavChild) => {
    child.onSelect();
    setFlyoutId(null);
  };

  const handleNavKeyDown = (event: KeyboardEvent<HTMLElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
      return;
    }
    if (event.key === "Escape") {
      setFlyoutId(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-nav='true']"));
      const index = buttons.indexOf(event.currentTarget);
      const next = event.key === "ArrowDown" ? buttons[index + 1] : buttons[index - 1];
      next?.focus();
    }
  };

  const renderChild = (child: NavChild, nested = false) => {
    const active = child.isActive();
    return (
      <button
        key={child.id}
        data-sidebar-nav="true"
        onClick={() => selectChild(child)}
        onKeyDown={(event) => handleNavKeyDown(event, () => selectChild(child))}
        className={`group/child relative flex w-full items-center rounded-lg py-1.5 text-left text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          nested ? "pl-8 pr-2" : "px-3"
        } ${
          active
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:translate-x-0.5"
        }`}
      >
        <span className={`absolute left-3 h-1.5 w-1.5 rounded-full transition-all ${active ? "bg-blue-500 opacity-100" : "bg-gray-300 opacity-0 group-hover/child:opacity-70 dark:bg-gray-600"}`} />
        {child.label}
      </button>
    );
  };

  const renderFlyout = (parent: NavParent) => {
    if (!parent.children?.length || flyoutId !== parent.id) return null;
    const ParentIcon = parent.icon;
    return (
      <div
        onMouseEnter={() => setFlyoutId(parent.id)}
        onMouseLeave={() => setFlyoutId(null)}
        className="absolute left-[calc(100%-2px)] top-0 z-50 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
          <ParentIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{parent.label}</span>
        </div>
        <div className="py-2">
          {parent.children.map(child => (
            <div key={child.id}>
              {child.section && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{child.section}</p>}
              {renderChild(child)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderParent = (parent: NavParent) => {
    const ParentIcon = parent.icon;
    const active = parent.isActive();
    const isOpen = expanded[parent.id] ?? false;
    const hasChildren = Boolean(parent.children?.length);

    if (!isExpandedMode) {
      return (
        <div
          key={parent.id}
          className="relative flex flex-col items-center"
          onMouseEnter={() => setFlyoutId(parent.id)}
          onMouseLeave={() => setFlyoutId(null)}
        >
          <button
            data-sidebar-nav="true"
            onClick={() => hasChildren ? setFlyoutId(parent.id) : parent.onSelect?.()}
            onKeyDown={(event) => handleNavKeyDown(event, () => hasChildren ? setFlyoutId(parent.id) : parent.onSelect?.())}
            title={parent.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
              active
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                : "text-gray-500 hover:-translate-y-0.5 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <ParentIcon className="h-5 w-5" />
          </button>
          {renderFlyout(parent)}
        </div>
      );
    }

    return (
      <div key={parent.id} className="relative">
        <button
          data-sidebar-nav="true"
          onClick={() => toggleParent(parent)}
          onKeyDown={(event) => handleNavKeyDown(event, () => toggleParent(parent))}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
            active
              ? "bg-blue-50 text-gray-900 dark:bg-blue-950/25 dark:text-gray-100"
              : "text-gray-600 hover:translate-x-0.5 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900/80 dark:hover:text-gray-100"
          }`}
        >
          <ParentIcon className={`h-4.5 w-4.5 shrink-0 transition-colors ${active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 group-hover:text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-200"}`} />
          <span className="min-w-0 flex-1 truncate text-left">{parent.label}</span>
          {hasChildren && (
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
          )}
        </button>
        {hasChildren && (
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
              isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="pb-1 pt-1">
                {parent.children!.map(child => (
                  <div key={child.id}>
                    {child.section && <p className="pl-8 pr-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{child.section}</p>}
                    {renderChild(child, true)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMobileNav = () => {
    const items = [
      { id: "attendance", label: "Attendance", icon: CalendarCheck, action: () => selectTab("attendance"), active: activeTab === "attendance" },
      { id: "academics", label: "Academics", icon: GraduationCap, action: () => selectTab("academics"), active: activeTab === "academics" },
      { id: "campus", label: "Campus", icon: Building, action: () => selectTab("payments"), active: ["payments", "libraries", "hostel"].includes(activeTab) },
      { id: "tools", label: "Tools", icon: Wrench, action: () => selectTab("more"), active: activeTab === "more" },
      { id: "settings", label: "Settings", icon: User, action: () => selectTab("profile"), active: activeTab === "profile" },
    ];

    return (
      <div className="fixed bottom-6 left-4 right-4 z-40 flex items-center justify-around rounded-full border border-gray-200/50 bg-white/90 px-2 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-black/80 md:hidden">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex flex-1 flex-col items-center justify-center rounded-full py-2 text-[10px] font-semibold transition-colors ${
                item.active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Icon className="h-5 w-5" />
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
        className={`fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col overflow-visible rounded-3xl border border-gray-200/50 bg-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-[width] duration-200 dark:border-white/10 dark:bg-black/70 dark:shadow-[0_8px_30px_rgba(255,255,255,0.05)] md:flex ${
          isExpandedMode ? "w-[280px]" : "w-[72px]"
        }`}
        style={{ scrollbarWidth: "none" }}
        aria-label="Primary navigation"
      >
        <div className={`flex flex-col gap-3 border-b border-gray-200 px-4 pb-4 pt-5 dark:border-gray-800 ${!isExpandedMode ? "items-center px-3" : ""}`}>
          <div className={`flex w-full items-start gap-3 ${!isExpandedMode ? "justify-center" : "justify-between"}`}>
            <div className={`flex gap-3 ${!isExpandedMode ? "flex-col items-center" : "items-center"}`}>
              <img src={currentIcon} alt="AmazeCC" className="h-9 w-9 rounded-xl object-contain shadow-sm" />
              {isExpandedMode && (
                <div>
                  <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">AmazeCC</h2>
                  <p className="max-w-[160px] truncate text-xs font-medium text-gray-500 dark:text-gray-400">{username || "Student ID"}</p>
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 ${!isExpandedMode ? "flex-col" : ""}`}>
              <button
                onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                title="Toggle sidebar"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              {isExpandedMode && (
                <>
                  <button
                    onClick={handleReloadClick}
                    className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                    title="Reload data"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isSpinning ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => selectTab("profile")}
                    className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                    title="Profile"
                  >
                    <User className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isExpandedMode && (
            <>
              <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-800 dark:bg-gray-900/40">
                <button
                  className="rounded-xl px-1.5 py-1.5 text-center transition-colors hover:bg-white dark:hover:bg-gray-950"
                  onClick={() => setSettings(prev => ({ ...prev, CGPAHidden: !prev.CGPAHidden }))}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">CGPA</span>
                  <span className="block truncate text-xs font-black text-gray-900 dark:text-gray-100">{settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}</span>
                </button>
                <button
                  className="rounded-xl px-1.5 py-1.5 text-center transition-colors hover:bg-white dark:hover:bg-gray-950"
                  onClick={() => setSettings(prev => ({ ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" }))}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Att.</span>
                  <span className={`block truncate text-xs font-black ${attendancePercentage?.percentage < 75 ? "text-red-500" : "text-green-500 dark:text-green-400"}`}>
                    {attendancePercentage?.[settings.attendancePercentageOrString] || "-"}
                    {settings.attendancePercentageOrString === "percentage" ? "%" : ""}
                  </span>
                </button>
                <button
                  className="rounded-xl px-1.5 py-1.5 text-center transition-colors hover:bg-white dark:hover:bg-gray-950"
                  onClick={() => setODhoursIsOpen(true)}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">OD</span>
                  <span className="block truncate text-xs font-black text-gray-900 dark:text-gray-100">{totalODHours}/40</span>
                </button>
                <button
                  className="rounded-xl px-1.5 py-1.5 text-center transition-colors hover:bg-white dark:hover:bg-gray-950"
                  onClick={() => setGradesDisplayIsOpen(true)}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Credits</span>
                  <span className="block truncate text-xs font-black text-gray-900 dark:text-gray-100">
                    {marksData?.cgpa ? Number(marksData.cgpa.creditsEarned) + Number(marksData.cgpa.nonGradedRequirement || 0) : "-"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        <nav className={`flex flex-1 flex-col gap-4 px-3 py-4 ${isExpandedMode ? "overflow-y-auto" : "items-center overflow-visible px-2"}`} style={{ scrollbarWidth: "none" }}>
          {visibleGroups.map(group => {
            const GroupIcon = group.icon;
            return (
              <section key={group.id} className={`w-full ${isRailMode ? "flex flex-col items-center" : ""}`}>
                {isExpandedMode ? (
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">{group.label}</p>
                ) : (
                  <div className="mb-2 flex items-center justify-center">
                    <GroupIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <div className={`space-y-1.5 ${!isExpandedMode ? "flex flex-col items-center" : ""}`}>
                  {group.parents.map(renderParent)}
                </div>
              </section>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
