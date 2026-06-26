"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
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
  Menu,
  RefreshCcw,
  Settings,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type NavChild = {
  id: string;
  label: string;
  section?: string;
  isActive: boolean;
  onSelect: () => void;
};

type NavParent = {
  id: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
  isActive: boolean;
  onSelect?: () => void;
  hidden?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  parents: NavParent[];
};

type ChildButtonProps = {
  child: NavChild;
  nested?: boolean;
  onSelect: (child: NavChild) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
};

type ParentItemProps = {
  parent: NavParent;
  isOpen: boolean;
  compact?: boolean;
  onToggle: (parent: NavParent) => void;
  onChildSelect: (child: NavChild) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
};

type RailGroupProps = {
  group: NavGroup;
  active: boolean;
  isOpen: boolean;
  rootRef: RefObject<HTMLElement | null>;
  onOpen: (id: string) => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
  expanded: Record<string, boolean>;
  onParentToggle: (parent: NavParent) => void;
  onChildSelect: (child: NavChild) => void;
};

const navButtonBase =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40";

const ChildButton = memo(function ChildButton({
  child,
  nested = false,
  onSelect,
  onKeyDown,
}: ChildButtonProps) {
  return (
    <button
      data-sidebar-nav="true"
      onClick={() => onSelect(child)}
      onKeyDown={(event) => onKeyDown(event, () => onSelect(child))}
      className={`group/child relative flex w-full items-center rounded-md py-1.5 text-left text-xs transition-[color,transform,background-color] duration-150 ${navButtonBase} ${
        nested ? "pl-8 pr-2" : "pl-7 pr-3"
      } ${
        child.isActive
          ? "bg-info-surface text-info"
          : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <span
        className={`absolute left-3 h-1.5 w-1.5 rounded-full transition-opacity ${
          child.isActive
            ? "bg-info opacity-100"
            : "bg-muted-foreground opacity-0 group-hover/child:opacity-60"
        }`}
      />
      <span className="truncate font-normal">{child.label}</span>
    </button>
  );
});

const ParentNavItem = memo(function ParentNavItem({
  parent,
  isOpen,
  compact = false,
  onToggle,
  onChildSelect,
  onKeyDown,
}: ParentItemProps) {
  const ParentIcon = parent.icon;
  const hasChildren = Boolean(parent.children?.length);

  return (
    <div className="relative">
      <button
        data-sidebar-nav="true"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-controls={hasChildren ? `sidebar-section-${parent.id}` : undefined}
        onClick={() => onToggle(parent)}
        onKeyDown={(event) => onKeyDown(event, () => onToggle(parent))}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[color,transform,background-color] duration-150 ${navButtonBase} ${
          parent.isActive
            ? "bg-info-surface text-info"
            : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        {parent.isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-info" />
        )}
        <ParentIcon
          className={`h-5 w-5 shrink-0 stroke-[1.9] transition-colors ${
            parent.isActive ? "text-info" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-left">{parent.label}</span>
        {hasChildren && (
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        )}
      </button>

      {hasChildren && (
        <div
          id={`sidebar-section-${parent.id}`}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className={compact ? "pb-1 pt-1" : "pb-1 pt-1.5"}>
              {parent.children!.map((child) => (
                <div key={child.id}>
                  {child.section && (
                    <div className="mx-3 my-2 border-t border-sidebar-border pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {child.section}
                      </p>
                    </div>
                  )}
                  <ChildButton
                    child={child}
                    nested
                    onSelect={onChildSelect}
                    onKeyDown={onKeyDown}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const RailGroupButton = memo(function RailGroupButton({
  group,
  active,
  isOpen,
  rootRef,
  onOpen,
  onClose,
  onKeyDown,
  expanded,
  onParentToggle,
  onChildSelect,
}: RailGroupProps) {
  const GroupIcon = group.icon;
  const openGroup = () => onOpen(group.id);

  return (
    <div
      className="relative"
      onMouseEnter={openGroup}
      onMouseLeave={onClose}
    >
      <button
        data-sidebar-nav="true"
        aria-label={`${group.label} navigation`}
        aria-expanded={isOpen}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          isOpen ? onClose() : openGroup();
        }}
        onKeyDown={(event) => onKeyDown(event, openGroup)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-[color,transform,background-color] duration-150 ${navButtonBase} ${
          active
            ? "bg-info-surface text-info"
            : "text-muted-foreground hover:-translate-y-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-info" />
        )}
        <GroupIcon className="h-5 w-5 stroke-[1.9]" />
      </button>

      {isOpen && (
        <div
          ref={rootRef as RefObject<HTMLDivElement>}
          className="absolute left-[calc(100%+0.75rem)] top-0 z-50 w-72 rounded-2xl border border-sidebar-border bg-popover p-2 text-popover-foreground shadow-lg"
          onMouseEnter={openGroup}
          onMouseLeave={onClose}
        >
          <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2.5">
            <GroupIcon className="h-5 w-5 text-info" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </p>
          </div>
          <div className="space-y-1 py-2">
            {group.parents.map((parent) => (
              <ParentNavItem
                key={parent.id}
                parent={parent}
                compact
                isOpen={expanded[parent.id] ?? true}
                onToggle={onParentToggle}
                onChildSelect={onChildSelect}
                onKeyDown={onKeyDown}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

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
}) {
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    attendance: true,
    academics: true,
    hostel: true,
    more: true,
    profile: true,
  });
  const [flyoutId, setFlyoutId] = useState<string | null>(null);

  const openCommandPalette = useCallback(() => {
    onOpenCommandPalette?.();
    setFlyoutId(null);
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

  useEffect(() => {
    if (!flyoutId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sidebarRef.current?.contains(target) || flyoutRef.current?.contains(target)) return;
      setFlyoutId(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [flyoutId]);

  const isHosteller = profileData?.isHosteller;
  const isExpandedMode = !settings.isSidebarCollapsed;
  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum, day) => sum + day.total, 0)
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
          isActive: activeTab === "attendance",
          onSelect: () => {
            selectTab("attendance");
            setActiveAttendanceSubTab("attendance");
          },
          children: [
            {
              id: "attendance.attendance",
              label: "Attendance",
              isActive: activeTab === "attendance" && activeAttendanceSubTab === "attendance",
              onSelect: () => {
                selectTab("attendance");
                setActiveAttendanceSubTab("attendance");
              },
            },
            {
              id: "attendance.calendar",
              label: "Calendar",
              isActive: activeTab === "attendance" && activeAttendanceSubTab === "calendar",
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
          isActive: activeTab === "academics",
          onSelect: () => {
            selectTab("academics");
            if (!activeSubTab) setActiveSubTab("overview");
          },
          children: [
            {
              id: "academics.overview",
              label: "Overview",
              isActive: activeTab === "academics" && activeSubTab === "overview",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("overview");
              },
            },
            {
              id: "academics.course-dashboard",
              label: "Course Dashboard",
              isActive: activeTab === "academics" && activeSubTab === "course-dashboard",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("course-dashboard");
              },
            },
            {
              id: "academics.grades",
              label: "Grade History",
              isActive: activeTab === "academics" && activeSubTab === "grades",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("grades");
              },
            },
            {
              id: "academics.curriculum",
              label: "Curriculum",
              isActive: activeTab === "academics" && activeSubTab === "curriculum",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("curriculum");
              },
            },
            {
              id: "academics.predictor",
              label: "CGPA Predictor",
              isActive: activeTab === "academics" && activeSubTab === "predictor",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("predictor");
              },
            },
            {
              id: "academics.qbank",
              label: "Question Bank",
              isActive: activeTab === "academics" && activeSubTab === "qbank",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("qbank");
              },
            },
            {
              id: "academics.arrear",
              label: "Arrear",
              section: "Academic Tools",
              isActive: activeTab === "academics" && activeSubTab === "arrear",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("arrear");
              },
            },
            {
              id: "academics.makeup-compre",
              label: "Makeup & Compre",
              isActive: activeTab === "academics" && activeSubTab === "makeup-compre",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("makeup-compre");
              },
            },
            {
              id: "academics.course-mgmt",
              label: "Course Management",
              isActive: activeTab === "academics" && activeSubTab === "course-mgmt",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("course-mgmt");
              },
            },
            {
              id: "academics.projects",
              label: "Projects",
              isActive: activeTab === "academics" && activeSubTab === "projects",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("projects");
              },
            },
            {
              id: "academics.wishlist",
              label: "Wishlist",
              isActive: activeTab === "academics" && activeSubTab === "wishlist",
              onSelect: () => {
                selectTab("academics");
                setActiveSubTab("wishlist");
              },
            },
            {
              id: "academics.faculty-info",
              label: "Faculty Info",
              isActive: activeTab === "academics" && activeSubTab === "faculty-info",
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
          id: "hostel",
          label: "Hostel",
          icon: Home,
          hidden: isHosteller !== true,
          isActive: activeTab === "hostel",
          onSelect: () => {
            selectTab("hostel");
            if (!HostelActiveSubTab) setHostelActiveSubTab("mess");
          },
          children: [
            {
              id: "hostel.mess",
              label: "Mess",
              isActive: activeTab === "hostel" && HostelActiveSubTab === "mess",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("mess");
              },
            },
            {
              id: "hostel.laundry",
              label: "Laundry",
              isActive: activeTab === "hostel" && HostelActiveSubTab === "laundry",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("laundry");
              },
            },
            {
              id: "hostel.leave",
              label: "Leave",
              isActive: activeTab === "hostel" && HostelActiveSubTab === "leave",
              onSelect: () => {
                selectTab("hostel");
                setHostelActiveSubTab("leave");
              },
            },
            {
              id: "hostel.counselling",
              label: "Counselling",
              isActive: activeTab === "hostel" && HostelActiveSubTab === "counselling",
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
          isActive: activeTab === "more",
          onSelect: () => {
            selectTab("more");
            if (!activeMoreSubTab) setActiveMoreSubTab("social");
          },
          children: [
            {
              id: "tools.social",
              label: "Social",
              isActive: activeTab === "more" && activeMoreSubTab === "social",
              onSelect: () => {
                selectTab("more");
                setActiveMoreSubTab("social");
              },
            },
            {
              id: "tools.ffcs",
              label: "FFCS Planner",
              isActive: activeTab === "more" && activeMoreSubTab === "ffcs",
              onSelect: () => {
                selectTab("more");
                setActiveMoreSubTab("ffcs");
              },
            },
            {
              id: "tools.events",
              label: "Event Hub",
              isActive: activeTab === "more" && activeMoreSubTab === "events",
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
          isActive: activeTab === "profile",
          onSelect: () => {
            selectTab("profile");
            if (!activeProfileSubTab) setActiveProfileSubTab("info");
          },
          children: [
            {
              id: "settings.info",
              label: "My Info",
              isActive: activeTab === "profile" && activeProfileSubTab === "info",
              onSelect: () => {
                selectTab("profile");
                setActiveProfileSubTab("info");
              },
            },
            {
              id: "settings.credentials",
              label: "Credentials",
              isActive: activeTab === "profile" && activeProfileSubTab === "credentials",
              onSelect: () => {
                selectTab("profile");
                setActiveProfileSubTab("credentials");
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
    selectTab,
    setActiveAttendanceSubTab,
    setActiveMoreSubTab,
    setActiveProfileSubTab,
    setActiveSubTab,
    setHostelActiveSubTab,
  ]);

  const visibleGroups = useMemo(
    () => navigation
      .map(group => ({ ...group, parents: group.parents.filter(parent => !parent.hidden) }))
      .filter(group => group.parents.length > 0),
    [navigation],
  );

  const openFlyout = useCallback((id: string) => {
    setFlyoutId(current => (current === id ? current : id));
  }, []);

  const closeFlyout = useCallback(() => {
    setFlyoutId(null);
  }, []);

  const toggleParent = useCallback((parent: NavParent) => {
    parent.onSelect?.();
    if (parent.children?.length) {
      setExpanded(prev => ({
        ...prev,
        [parent.id]: parent.isActive ? !(prev[parent.id] ?? true) : true,
      }));
    }
  }, []);

  const selectChild = useCallback((child: NavChild) => {
    child.onSelect();
    setFlyoutId(null);
  }, []);

  const handleNavKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, action: () => void) => {
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
  }, []);

  const renderMobileNav = () => {
    const items = [
      { id: "attendance", label: "Attendance", icon: CalendarCheck, action: () => selectTab("attendance"), active: activeTab === "attendance" },
      { id: "academics", label: "Academics", icon: GraduationCap, action: () => selectTab("academics"), active: activeTab === "academics" },
      { id: "campus", label: "Campus", icon: Building, action: () => selectTab("payments"), active: ["payments", "libraries", "hostel"].includes(activeTab) },
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
        <div className={`border-b border-sidebar-border ${isExpandedMode ? "px-4 pb-4 pt-5" : "px-3 py-4"}`}>
          <div className={`flex items-start gap-3 ${isExpandedMode ? "justify-between" : "flex-col items-center"}`}>
            <div className={`flex min-w-0 gap-3 ${isExpandedMode ? "items-center" : "flex-col items-center"}`}>
              <img src={currentIcon} alt="AmazeCC" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
              {isExpandedMode && (
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-sidebar-foreground">AmazeCC</h2>
                  <p className="truncate text-xs font-medium text-muted-foreground">{username || "Student ID"}</p>
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 ${isExpandedMode ? "" : "flex-col"}`}>
              <button
                onClick={() => persistSidebarState(!settings.isSidebarCollapsed)}
                className={`rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${navButtonBase}`}
                title="Toggle sidebar"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5 stroke-[1.9]" />
              </button>
              {isExpandedMode && (
                <button
                  onClick={handleReloadClick}
                  className={`rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${navButtonBase}`}
                  title="Reload data"
                  aria-label="Reload data"
                >
                  <RefreshCcw className={`h-4 w-4 ${isSpinning ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {isExpandedMode && (
            <>
              <button
                onClick={() => selectTab("profile")}
                className={`mt-4 flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-left transition-colors hover:bg-accent ${navButtonBase}`}
              >
                {profileData?.image ? (
                  <img src={profileData.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-surface text-xs font-semibold text-info">
                    {initials || "ST"}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-sidebar-foreground">{profileName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{username || "Student ID"}</span>
                </span>
              </button>

              <div className="mt-3 rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-3">
                <div className="flex items-center justify-between gap-3 pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Current Semester
                  </span>
                  <span className="truncate text-xs font-medium text-sidebar-foreground">{currSemesterID || "-"}</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-sidebar-border border-t border-sidebar-border pt-2">
                  <button
                    className={`px-1 text-center transition-colors hover:text-info ${navButtonBase}`}
                    onClick={() => setSettings(prev => ({ ...prev, CGPAHidden: !prev.CGPAHidden }))}
                  >
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">CGPA</span>
                    <span className="block truncate text-xs font-semibold text-sidebar-foreground">{settings.CGPAHidden ? "###" : marksData?.cgpa?.cgpa || "-"}</span>
                  </button>
                  <button
                    className={`px-1 text-center transition-colors hover:text-info ${navButtonBase}`}
                    onClick={() => setSettings(prev => ({ ...prev, attendancePercentageOrString: prev.attendancePercentageOrString === "percentage" ? "str" : "percentage" }))}
                  >
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Att.</span>
                    <span className={`block truncate text-xs font-semibold ${attendancePercentage?.percentage < 75 ? "text-danger" : "text-success"}`}>
                      {attendanceValue}
                    </span>
                  </button>
                  <button
                    className={`px-1 text-center transition-colors hover:text-info ${navButtonBase}`}
                    onClick={() => setGradesDisplayIsOpen(true)}
                  >
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Credits</span>
                    <span className="block truncate text-xs font-semibold text-sidebar-foreground">{credits}</span>
                  </button>
                  <button
                    className={`px-1 text-center transition-colors hover:text-info ${navButtonBase}`}
                    onClick={() => setODhoursIsOpen(true)}
                  >
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">OD</span>
                    <span className="block truncate text-xs font-semibold text-sidebar-foreground">{totalODHours}/40</span>
                  </button>
                </div>
              </div>

              <button
                data-sidebar-nav="true"
                onClick={openCommandPalette}
                onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                className={`mt-3 flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar px-3 py-2.5 text-left transition-[color,background-color] hover:bg-sidebar-accent ${navButtonBase}`}
                aria-label="Open command palette"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-surface text-info">
                  <Command className="h-4.5 w-4.5 stroke-[1.9]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-sidebar-foreground">Command Center</span>
                  <span className="block truncate text-xs text-muted-foreground">Search pages, courses, tools</span>
                </span>
                <kbd className="rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
                </kbd>
              </button>
            </>
          )}
        </div>

        {isExpandedMode ? (
          <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4" style={{ scrollbarWidth: "none" }}>
            {visibleGroups.map(group => (
              <section key={group.id} className="border-t border-sidebar-border pt-3 first:border-t-0 first:pt-0">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.parents.map(parent => (
                    <ParentNavItem
                      key={parent.id}
                      parent={parent}
                      isOpen={expanded[parent.id] ?? true}
                      onToggle={toggleParent}
                      onChildSelect={selectChild}
                      onKeyDown={handleNavKeyDown}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>
        ) : (
          <>
            <div className="flex justify-center border-b border-sidebar-border px-2 py-3">
              <button
                data-sidebar-nav="true"
                onClick={openCommandPalette}
                onKeyDown={(event) => handleNavKeyDown(event, openCommandPalette)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-info-surface text-info transition-[color,transform,background-color] duration-150 hover:-translate-y-0.5 ${navButtonBase}`}
                title="Command Center"
                aria-label="Open command palette"
              >
                <Command className="h-5 w-5 stroke-[1.9]" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col items-center gap-2 px-2 py-4" aria-label="Navigation rail">
              {visibleGroups.map(group => (
                <RailGroupButton
                  key={group.id}
                  group={group}
                  active={group.parents.some(parent => parent.isActive)}
                  isOpen={flyoutId === group.id}
                  rootRef={flyoutRef}
                  onOpen={openFlyout}
                  onClose={closeFlyout}
                  onKeyDown={handleNavKeyDown}
                  expanded={expanded}
                  onParentToggle={toggleParent}
                  onChildSelect={selectChild}
                />
              ))}
            </nav>
          </>
        )}
      </aside>
    </>
  );
}
