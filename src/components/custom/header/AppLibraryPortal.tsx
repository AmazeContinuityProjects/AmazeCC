"use client";

/**
 * The App Library portal: the header's search-over-every-tab sheet, kept in
 * its own memo'd component so opening it, typing in it, or flipping a mobile
 * panel re-renders this module and nothing above it. It owns only its own
 * search query and mobile-panel state; every navigation action arrives as a
 * prop from NavigationTabs, which renders it inside its tree. Extracted
 * verbatim, together with `getTabIdFromLabel`, its only caller.
 */

import { memo, useEffect, useMemo, useState } from "react";
import SelectField from "../shared/primitives/SelectField";
import { formatSemesterName } from "@/lib/formatSemesterName";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";
import {
  BookOpen,
  Building,
  CheckSquare,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Home,
  Library,
  LayoutGrid,
  Menu,
  Settings,
  User,
  Wrench,
  Calendar,
  Compass,
  Bus,
  Sun,
  Lightbulb,
  Search,
  Coffee,
  Info,
  LogOut,
  CarTaxiFront,
  Pin,
  Rss,
  Layers,
  Sparkles,
  Database,
  UserCheck,
  DoorOpen,
  Users,
  UserSearch,
} from "lucide-react";
import { AppLibrary } from "@amazecontinuityprojects/amazeui";
import config from "../../../../config.json";

function getTabIdFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  if (lower === "attendance") return "attendance";
  if (
    lower === "my courses & marks" ||
    lower === "my courses" ||
    lower === "academics overview" ||
    lower === "course dashboard" ||
    lower === "academics"
  )
    return "academics";
  if (lower === "hostel payments" || lower === "payments") return "payments";
  if (lower === "libraries" || lower === "question bank") return "libraries";
  if (lower === "free classrooms" || lower === "free classroom" || lower === "free-class") return "free-class";
  if (
    lower === "faculty schedule" ||
    lower === "faculty schedules" ||
    lower === "find faculty schedule" ||
    lower === "faculty-schedule"
  )
    return "faculty-schedule";
  if (lower === "event hub" || lower === "events hub" || lower === "events") return "events";
  if (lower === "club hub" || lower === "clubs") return "clubs";
  if (lower === "community feed" || lower === "community" || lower === "announcements") return "community";
  if (lower === "cab share") return "cabshare";
  if (lower === "transport") return "transport";
  if (lower === "credentials") return "credentials";
  return null;
}

const AppLibraryPortal = memo(
  ({
    open,
    onClose,
    settings,
    setSettings,
    selectTab,
    setActiveAttendanceSubTab,
    setActiveToolsSubTab,
    setActiveSubTab,
    setHostelActiveSubTab,
    setActiveMoreSubTab,
    setActiveProfileSubTab,
    handleLogOutRequest,
    handleReloadRequest,
    isHosteller,
    residentialStatus,
    theme,
    handleThemeChange,
    openCommandPalette,
    tabIcons,
    togglePin,
  }: any) => {
    const [librarySearchQuery, setLibrarySearchQuery] = useState("");
    const [mobilePanel, setMobilePanel] = useState<"primary" | "academics" | "hostel">("primary");

    // Cleanup state on close
    useEffect(() => {
      if (!open) {
        setLibrarySearchQuery("");
        setMobilePanel("primary");
      }
    }, [open]);

    // Memoized variables inside the portal to isolate changes
    const allSearchableItems = useMemo(
      () => [
        {
          label: "Timetable Calendar",
          group: "Study",
          icon: Calendar,
          action: () => {
            selectTab("attendance");
            setActiveAttendanceSubTab("calendar");
          },
        },

        {
          label: "My Courses & Marks",
          group: "Academics",
          icon: Sparkles,
          action: () => {
            selectTab("academics");
            setActiveSubTab("courses-simplified");
          },
        },
        {
          label: "Course Dashboard",
          group: "Academics",
          icon: BookOpen,
          action: () => {
            selectTab("academics");
            setActiveSubTab("course-dashboard");
          },
        },
        {
          label: "Grade History",
          group: "Academics",
          icon: GraduationCap,
          action: () => {
            selectTab("academics");
            setActiveSubTab("grades");
          },
        },
        {
          label: "Curriculum",
          group: "Academics",
          icon: BookOpen,
          action: () => {
            selectTab("academics");
            setActiveSubTab("curriculum");
          },
        },

        {
          label: "Payments",
          group: "Campus",
          icon: CreditCard,
          action: () => {
            selectTab("payments");
          },
        },
        {
          label: "Libraries",
          group: "Campus",
          icon: Library,
          action: () => {
            selectTab("libraries");
          },
        },
        {
          label: "Transport",
          group: "Campus",
          icon: Bus,
          action: () => {
            selectTab("transport");
          },
        },
        {
          label: "Event Hub",
          group: "Campus",
          icon: Calendar,
          action: () => {
            selectTab("events");
          },
        },
        {
          label: "Club Hub",
          group: "Campus",
          icon: LayoutGrid,
          action: () => {
            selectTab("clubs");
          },
        },
        {
          label: "Announcements",
          group: "Campus",
          icon: Rss,
          action: () => {
            selectTab("community");
          },
        },

        {
          label: "Timetable Sharing",
          group: "Tools",
          icon: Users,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("social");
          },
        },
        { label: "FFCS Planner", group: "Tools", icon: Compass, action: navigateToFFCSPlanner },
        {
          label: "Tools Hub",
          group: "Tools",
          icon: Layers,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("overview");
          },
        },
        {
          label: "Question Bank",
          group: "Tools",
          icon: Database,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("qbank");
          },
        },
        {
          label: "Faculty Explorer",
          group: "Tools",
          icon: UserCheck,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("faculty-info");
          },
        },
        {
          label: "Tasks & Schedule",
          group: "Tools",
          icon: CheckSquare,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("tasks");
          },
        },
        {
          label: "Cab Share",
          group: "Tools",
          icon: CarTaxiFront,
          action: () => {
            selectTab("tools");
            setActiveToolsSubTab?.("cabshare");
          },
        },
        {
          label: "Free Classrooms",
          group: "Campus",
          icon: DoorOpen,
          action: () => {
            selectTab("free-class");
          },
        },
        {
          label: "Faculty Schedule",
          group: "Campus",
          icon: UserSearch,
          action: () => {
            selectTab("faculty-schedule");
          },
        },

        {
          label: "Hostel Overview",
          group: "Hostel",
          icon: Building,
          action: () => {
            selectTab("hostel");
            setHostelActiveSubTab("overview");
          },
        },
        {
          label: "Mess Menu",
          group: "Hostel",
          icon: Coffee,
          action: () => {
            selectTab("hostel");
            setHostelActiveSubTab("mess");
          },
        },
        {
          label: "Laundry",
          group: "Hostel",
          icon: Wrench,
          action: () => {
            selectTab("hostel");
            setHostelActiveSubTab("laundry");
          },
        },
        {
          label: "Leave / Gatepass",
          group: "Hostel",
          icon: Compass,
          action: () => {
            selectTab("hostel");
            setHostelActiveSubTab("leave");
          },
        },
        {
          label: "Counselling",
          group: "Hostel",
          icon: User,
          action: () => {
            selectTab("hostel");
            setHostelActiveSubTab("counselling");
          },
        },

        {
          label: "Settings & Profile",
          group: "Account",
          icon: User,
          action: () => {
            selectTab("profile");
            setActiveProfileSubTab("settings");
          },
        },
        {
          label: "About & Resources",
          group: "Account",
          icon: Info,
          action: () => {
            selectTab("about");
          },
        },
        {
          label: "Logout",
          group: "Account",
          icon: LogOut,
          action: () => {
            handleLogOutRequest();
          },
        },
      ],
      [
        selectTab,
        setActiveAttendanceSubTab,
        setActiveToolsSubTab,
        setActiveSubTab,
        setHostelActiveSubTab,
        setActiveProfileSubTab,
        handleLogOutRequest,
      ],
    );

    const primaryGroups = useMemo(
      () => [
        {
          name: "Study",
          items: [
            {
              label: "Timetable Calendar",
              icon: Calendar,
              type: "link",
              action: () => {
                selectTab("attendance");
                setActiveAttendanceSubTab("calendar");
              },
            },
            { label: "Academics", icon: GraduationCap, type: "panel", action: () => setMobilePanel("academics") },
          ],
        },
        {
          name: "Campus",
          items: [
            { label: "Payments", icon: CreditCard, type: "link", action: () => selectTab("payments") },
            { label: "Libraries", icon: Library, type: "link", action: () => selectTab("libraries") },
            { label: "Transport", icon: Bus, type: "link", action: () => selectTab("transport") },
            {
              label: "Free Classrooms",
              icon: DoorOpen,
              type: "link",
              action: () => {
                selectTab("free-class");
              },
            },
            {
              label: "Faculty Schedule",
              icon: UserSearch,
              type: "link",
              action: () => {
                selectTab("faculty-schedule");
              },
            },
            {
              label: "Event Hub",
              icon: Calendar,
              type: "link",
              action: () => {
                selectTab("events");
              },
            },
            {
              label: "Club Hub",
              icon: LayoutGrid,
              type: "link",
              action: () => {
                selectTab("clubs");
              },
            },
            {
              label: "Announcements",
              icon: Rss,
              type: "link",
              action: () => {
                selectTab("community");
              },
            },
            ...(isHosteller === true || residentialStatus === "hosteller"
              ? [{ label: "Hostel Hub", icon: Home, type: "panel", action: () => setMobilePanel("hostel") }]
              : []),
          ],
        },
        {
          name: "Tools",
          items: [
            {
              label: "Timetable Sharing",
              icon: Users,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("social");
              },
            },
            { label: "FFCS Planner", icon: Compass, type: "link", action: navigateToFFCSPlanner },
            {
              label: "Tools Hub",
              icon: Layers,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("overview");
              },
            },
            {
              label: "Question Bank",
              icon: Database,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("qbank");
              },
            },
            {
              label: "Faculty Explorer",
              icon: UserCheck,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("faculty-info");
              },
            },
            {
              label: "Tasks & Schedule",
              icon: CheckSquare,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("tasks");
              },
            },
            {
              label: "Cab Share",
              icon: CarTaxiFront,
              type: "link",
              action: () => {
                selectTab("tools");
                setActiveToolsSubTab?.("cabshare");
              },
            },
          ],
        },
        {
          name: "Account",
          items: [
            {
              label: "Settings & Profile",
              icon: User,
              type: "link",
              action: () => {
                selectTab("profile");
                setActiveProfileSubTab("settings");
              },
            },
            {
              label: "About & Resources",
              icon: Info,
              type: "link",
              action: () => {
                selectTab("about");
              },
            },
            {
              label: "Logout",
              icon: LogOut,
              type: "link",
              action: () => {
                handleLogOutRequest();
              },
            },
          ],
        },
      ],
      [
        selectTab,
        setActiveAttendanceSubTab,
        setMobilePanel,
        isHosteller,
        residentialStatus,
        setActiveToolsSubTab,
        setActiveProfileSubTab,
        handleLogOutRequest,
      ],
    );

    const academicsItemsMobile = useMemo(
      () => allSearchableItems.filter((item) => item.group === "Academics"),
      [allSearchableItems],
    );

    const hostelItemsMobile = useMemo(
      () => allSearchableItems.filter((item) => item.group === "Hostel"),
      [allSearchableItems],
    );

    const filteredSearchItems = useMemo(
      () =>
        librarySearchQuery
          ? allSearchableItems.filter((item) => item.label.toLowerCase().includes(librarySearchQuery.toLowerCase()))
          : [],
      [librarySearchQuery, allSearchableItems],
    );

    return (
      <AppLibrary
        open={open}
        onClose={onClose}
        title={mobilePanel === "primary" ? "App Library" : mobilePanel === "academics" ? "Academics" : "Hostel Hub"}
        subtitle={mobilePanel === "primary" ? "Select a module to open" : "Choose a sub-page"}
        showBack={mobilePanel !== "primary"}
        onBack={() => setMobilePanel("primary")}
        searchQuery={mobilePanel === "primary" ? librarySearchQuery : undefined}
        onSearchChange={mobilePanel === "primary" ? setLibrarySearchQuery : undefined}
        className="!backdrop-blur-none"
      >
        {mobilePanel === "primary" && (
          <div className="flex items-center gap-1.5 px-1 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-550">
              Active Sem:
            </span>
            <div className="relative flex items-center">
              <SelectField
                value={settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]}
                onChange={(val) => {
                  handleReloadRequest(val);
                }}
                options={config.semesterIDs.map((semId: string) => ({
                  value: semId,
                  label: formatSemesterName(semId),
                }))}
                searchable={false}
                role="group"
                aria-label="Current semester"
                size="auto"
                className="w-full [&>button:first-child]:border-none [&>button:first-child]:bg-transparent [&>button:first-child]:pr-5 [&>button:first-child]:text-info [&>button:first-child]:hover:underline"
              />
            </div>
          </div>
        )}

        {librarySearchQuery ? (
          filteredSearchItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
                No modules found matching "{librarySearchQuery}"
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Search Results
              </h3>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {filteredSearchItems.map((item) => {
                  const Icon = item.icon;
                  const tabId = getTabIdFromLabel(item.label);
                  const pinned = settings?.pinnedNavTabs ?? [];
                  const isPinned = tabId ? pinned.includes(tabId) : false;
                  const atLimit = !isPinned && pinned.length >= 4;

                  return (
                    <div
                      key={item.label}
                      className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                    >
                      <button
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="rounded-xl bg-info-surface p-2 text-info shrink-0">
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">
                            {item.label}
                          </span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {item.group} category
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
                                : "border-transparent text-zinc-300 dark:text-zinc-500 hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
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
          primaryGroups.map((group) => (
            <div key={group.name} className="space-y-2">
              <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {group.name}
              </h3>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isPanelTrigger = item.type === "panel";
                  const tabId = getTabIdFromLabel(item.label);
                  const pinned = settings?.pinnedNavTabs ?? [];
                  const isPinned = tabId ? pinned.includes(tabId) : false;
                  const atLimit = !isPinned && pinned.length >= 4;

                  return (
                    <div
                      key={item.label}
                      className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                    >
                      <button
                        onClick={() => {
                          item.action();
                          if (!isPanelTrigger) onClose();
                        }}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <div
                          className={`rounded-xl p-2 shrink-0 transition-all ${
                            group.name === "Study"
                              ? "bg-purple-50 text-purple-650 dark:bg-purple-950/30 dark:text-purple-400"
                              : group.name === "Campus"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">
                            {item.label}
                          </span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {group.name === "Study"
                              ? "Academic trackers & schedule"
                              : group.name === "Campus"
                                ? "Campus services"
                                : "Social & utilities"}
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
                              ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                              : atLimit
                                ? "opacity-20 cursor-not-allowed"
                                : "border-transparent text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
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
              {academicsItemsMobile.map((item) => {
                const Icon = item.icon;
                const cleanLabel = item.label.replace("Academics ", "");
                const tabId = getTabIdFromLabel(item.label);
                const pinned = settings?.pinnedNavTabs ?? [];
                const isPinned = tabId ? pinned.includes(tabId) : false;
                const atLimit = !isPinned && pinned.length >= 4;

                return (
                  <div
                    key={item.label}
                    className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                  >
                    <button
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                    >
                      <div className="rounded-xl bg-purple-50 p-2 text-purple-650 shrink-0 dark:bg-purple-950/30 dark:text-purple-400">
                        <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">
                          {cleanLabel}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">
                          Academics Tracker
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
                            ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                            : atLimit
                              ? "opacity-20 cursor-not-allowed"
                              : "border-transparent text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
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
              {hostelItemsMobile.map((item) => {
                const Icon = item.icon;
                const cleanLabel = item.label.replace("Hostel ", "");
                const tabId = getTabIdFromLabel(item.label);
                const pinned = settings?.pinnedNavTabs ?? [];
                const isPinned = tabId ? pinned.includes(tabId) : false;
                const atLimit = !isPinned && pinned.length >= 4;

                return (
                  <div
                    key={item.label}
                    className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
                  >
                    <button
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                    >
                      <div className="rounded-xl bg-amber-50 p-2 text-amber-655 shrink-0 dark:bg-amber-950/30 dark:text-amber-400">
                        <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">
                          {cleanLabel}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">
                          Hostel Hub
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
                            ? "bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400"
                            : atLimit
                              ? "opacity-20 cursor-not-allowed"
                              : "border-transparent text-zinc-300 dark:text-zinc-600 hover:text-zinc-400 hover:border-zinc-200 dark:hover:border-zinc-800"
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
            <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-outfit">
              Quick Pin tabs (Max 4)
            </h4>
            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
              {(settings?.pinnedNavTabs ?? []).length}/4 selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "attendance", label: "Timetable Calendar" },
              { id: "academics", label: "Academics" },
              { id: "payments", label: "Payments" },
              { id: "libraries", label: "Libraries" },
              { id: "free-class", label: "Free Classrooms" },
              { id: "faculty-schedule", label: "Faculty Schedule" },
              { id: "events", label: "Event Hub" },
              { id: "clubs", label: "Club Hub" },
              { id: "community", label: "Announcements" },
              { id: "cabshare", label: "Cab Share" },
              { id: "transport", label: "Transport" },
              { id: "more", label: "More" },
              { id: "profile", label: "Profile" },
              { id: "credentials", label: "Credentials" },
            ].map((tab) => {
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

        <div
          className="shrink-0 space-y-2 border-t border-gray-200/50 bg-gray-50/80 px-5 py-4 dark:border-gray-800/50 dark:bg-black/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <h4 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-550 font-outfit">
            Interface Theme
          </h4>
          <div className="flex w-full gap-1.5 rounded-xl border border-gray-200/20 bg-gray-200/50 p-1 dark:border-gray-800/50 dark:bg-gray-900/50">
            {["light", "dark"].map((t) => (
              <button
                key={t}
                onClick={(e) => handleThemeChange(t, e)}
                className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black capitalize transition-all cursor-pointer ${
                  theme === t
                    ? "bg-white text-info shadow-xs dark:bg-black dark:text-amber-300"
                    : "text-gray-550 hover:text-gray-955 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {t === "light" && <Sun className="h-3.5 w-3.5 text-indigo-600" />}
                {t === "dark" && (
                  <Lightbulb className="h-3.5 w-3.5 text-amber-300 fill-amber-300/20 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                )}
                <span>{t}</span>
              </button>
            ))}
          </div>
        </div>
      </AppLibrary>
    );
  },
);
AppLibraryPortal.displayName = "AppLibraryPortal";
export default AppLibraryPortal;
