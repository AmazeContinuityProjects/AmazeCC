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
  ScanLine,
} from "lucide-react";
import { AppLibrary } from "@amazecontinuityprojects/amazeui";
import config from "../../../../config.json";

/** One line under each module: what it is for, in the student's words. */
const MODULE_HINTS: Record<string, string> = {
  "Timetable Calendar": "Your week, slots and rooms",
  Academics: "Marks, grades and curriculum",
  Payments: "Fees, wallet and receipts",
  Libraries: "Catalogue, loans and dues",
  Transport: "Bus routes and boarding points",
  "Free Classrooms": "Rooms open right now",
  "Faculty Schedule": "Cabins and teaching hours",
  "Event Hub": "Events and registrations",
  "Club Hub": "Clubs and chapters",
  Announcements: "Posts from clubs",
  "Hostel Hub": "Mess, laundry and leave",
  "Timetable Sharing": "Send your week as a link",
  "FFCS Planner": "Plan next semester's slots",
  "Tools Hub": "Scanner, calculators and exports",
  "Question Bank": "Past CAT and FAT papers",
  "Faculty Explorer": "Find any faculty member",
  "Tasks & Schedule": "Assignments and reminders",
  "Paper Scanner": "Scan papers into PDFs",
};
const GROUP_HINTS: Record<string, string> = {
  Study: "Study",
  Campus: "Campus",
  Tools: "Tools",
};


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
  if (lower === "paper scanner" || lower === "paper-scanner" || lower === "scan") return "paper-scanner";
  if (lower === "transport") return "transport";
  if (lower === "credentials") return "credentials";
  return null;
}

interface PinnableItem {
  label: string;
  icon: any;
  action: () => void;
  type?: string;
  tabId: string;
  hint: string;
}

/** Canvas "Pinned to Home": up to four apps as two-column tiles, with Edit. */
function PinnedTiles({
  items,
  pinned,
  onOpen,
  onEdit,
}: {
  items: PinnableItem[];
  pinned: string[];
  onOpen: (item: PinnableItem) => void;
  onEdit: () => void;
}) {
  const tiles = pinned.map((id) => items.find((i) => i.tabId === id)).filter(Boolean) as PinnableItem[];
  return (
    <section aria-label="Pinned to Home" className="pb-1">
      <div className="flex items-baseline justify-between px-1 pb-1.5">
        <h3 className="text-[12.5px] font-semibold text-muted">Pinned to Home</h3>
        <button type="button" onClick={onEdit} className="text-[13px] text-accent hover:underline">
          Edit
        </button>
      </div>
      {tiles.length === 0 ? (
        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-md border border-dashed border-line px-4 py-3.5 text-left text-[13.5px] text-muted transition-colors duration-[120ms] hover:bg-surface-2"
        >
          Pin up to 4 apps to keep them on Home and in the bottom bar.
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tabId}
                type="button"
                onClick={() => onOpen(item)}
                className="flex min-h-[88px] flex-col items-start justify-between gap-3 rounded-md border border-line bg-surface p-3.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{item.label}</span>
                  {item.hint && <span className="mt-0.5 block truncate text-[12px] text-muted">{item.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Canvas "Edit pinned": the pinned apps first, then every other app, each with a switch. */
function EditPinnedPanel({
  items,
  pinned,
  togglePin,
  onDone,
}: {
  items: PinnableItem[];
  pinned: string[];
  togglePin: (id: string) => void;
  onDone: () => void;
}) {
  const on = pinned.map((id) => items.find((i) => i.tabId === id)).filter(Boolean) as PinnableItem[];
  const off = items.filter((i) => !pinned.includes(i.tabId));
  const full = pinned.length >= 4;
  const row = (item: PinnableItem, isOn: boolean) => {
    const Icon = item.icon;
    const disabled = !isOn && full;
    return (
      <li key={item.tabId}>
        <label
          className={`flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-surface-2"} transition-colors duration-[120ms]`}
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-ink-2" strokeWidth={1.7} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] text-ink">{item.label}</span>
            {item.hint && <span className="block truncate text-[12px] text-muted">{item.hint}</span>}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={`${isOn ? "Unpin" : "Pin"} ${item.label}`}
            disabled={disabled}
            onClick={() => togglePin(item.tabId)}
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[120ms] ${isOn ? "bg-accent" : "bg-line"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-[left] duration-[120ms] ${isOn ? "left-[18px]" : "left-0.5"}`}
            />
          </button>
        </label>
      </li>
    );
  };
  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-4 px-1">
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Pinned apps show on Home, at the top of Apps and in the bottom bar. You can pin up to 4.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-10 shrink-0 items-center rounded-sm bg-accent px-4 text-[14px] font-medium text-background hover:bg-accent/90"
        >
          Done
        </button>
      </div>
      <section aria-label="Pinned">
        <h3 className="px-1 pb-1.5 text-[12.5px] font-semibold text-muted">Pinned · {pinned.length} of 4</h3>
        {on.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-3 text-[13px] text-muted">Nothing pinned yet.</p>
        ) : (
          <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">{on.map((i) => row(i, true))}</ul>
        )}
      </section>
      <section aria-label="All apps">
        <h3 className="px-1 pb-1.5 text-[12.5px] font-semibold text-muted">All apps</h3>
        <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">{off.map((i) => row(i, false))}</ul>
      </section>
    </div>
  );
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
    const [mobilePanel, setMobilePanel] = useState<"primary" | "academics" | "hostel" | "edit">("primary");

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
          label: "Paper Scanner",
          group: "Tools",
          icon: ScanLine,
          action: () => {
            selectTab("paper-scanner");
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
            {
              label: "Paper Scanner",
              icon: ScanLine,
              type: "link",
              action: () => {
                selectTab("paper-scanner");
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

    // Every app that can be pinned, in library order, with its pin id.
    const pinnables = useMemo<PinnableItem[]>(() => {
      const seen = new Set<string>();
      const out: PinnableItem[] = [];
      for (const group of primaryGroups) {
        for (const item of group.items as any[]) {
          const tabId = getTabIdFromLabel(item.label);
          if (!tabId || seen.has(tabId)) continue;
          seen.add(tabId);
          out.push({ ...item, tabId, hint: MODULE_HINTS[item.label] ?? "" });
        }
      }
      return out;
    }, [primaryGroups]);

    return (
      <AppLibrary
        open={open}
        onClose={onClose}
        title={
          mobilePanel === "primary"
            ? "Apps"
            : mobilePanel === "edit"
              ? "Edit pinned"
              : mobilePanel === "academics"
                ? "Academics"
                : "Hostel"
        }
        subtitle={mobilePanel === "primary" || mobilePanel === "edit" ? undefined : "Choose a page"}
        showBack={mobilePanel !== "primary"}
        onBack={() => setMobilePanel("primary")}
        searchQuery={mobilePanel === "primary" ? librarySearchQuery : undefined}
        onSearchChange={mobilePanel === "primary" ? setLibrarySearchQuery : undefined}
        className="!"
      >
        {mobilePanel === "primary" && (
          <div className="flex items-center gap-1.5 px-1 pb-3">
            <span className="text-[12.5px] text-muted">
              Semester
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
              <h3 className="px-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
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
                      className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-md border border-zinc-200/50 p-3 shadow-2xs hover:shadow-xs transition-all dark:border-zinc-800/80 dark:bg-zinc-900/60"
                    >
                      <button
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="rounded-md bg-info-surface p-2 text-info shrink-0">
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-semibold leading-tight text-zinc-800 dark:text-zinc-200">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
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
                          title={isPinned ? "Unpin from Home" : "Pin to Home"}
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
        ) : mobilePanel === "edit" ? (
          <EditPinnedPanel
            items={pinnables}
            pinned={settings?.pinnedNavTabs ?? []}
            togglePin={togglePin}
            onDone={() => setMobilePanel("primary")}
          />
        ) : mobilePanel === "primary" ? (
          <>
          <PinnedTiles
            items={pinnables}
            pinned={settings?.pinnedNavTabs ?? []}
            onOpen={(item) => {
              item.action();
              if (item.type !== "panel") onClose();
            }}
            onEdit={() => setMobilePanel("edit")}
          />
          {primaryGroups.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h3 className="px-1 pb-1.5 text-[12.5px] font-semibold text-muted">{group.name}</h3>
              <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isPanelTrigger = item.type === "panel";
                  const tabId = getTabIdFromLabel(item.label);
                  const pinned = settings?.pinnedNavTabs ?? [];
                  const isPinned = tabId ? pinned.includes(tabId) : false;
                  const atLimit = !isPinned && pinned.length >= 4;

                  return (
                    <li key={item.label} className="flex items-center">
                      <button
                        onClick={() => {
                          item.action();
                          if (!isPanelTrigger) onClose();
                        }}
                        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.7} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14.5px] text-ink">{item.label}</span>
                          <span className="truncate text-[12.5px] text-muted">
                            {MODULE_HINTS[item.label] ?? GROUP_HINTS[group.name] ?? ""}
                          </span>
                        </span>
                      </button>

                      {tabId ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(tabId);
                          }}
                          disabled={atLimit}
                          aria-pressed={isPinned}
                          aria-label={isPinned ? `Unpin ${item.label} from Home` : `Pin ${item.label} to Home`}
                          title={isPinned ? "Unpin from Home" : "Pin to Home"}
                          className={`mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-sm transition-colors duration-[120ms] ${
                            isPinned
                              ? "text-accent hover:bg-accent-soft"
                              : atLimit
                                ? "cursor-not-allowed text-muted opacity-40"
                                : "text-muted hover:bg-surface-2 hover:text-ink"
                          }`}
                        >
                          <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} strokeWidth={1.8} />
                        </button>
                      ) : isPanelTrigger ? (
                        <ChevronRight aria-hidden="true" className="mr-3.5 h-4 w-4 shrink-0 text-muted" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          </>
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
                    className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-md border border-zinc-200/50 p-3 shadow-2xs hover:shadow-xs transition-all dark:border-zinc-800/80 dark:bg-zinc-900/60"
                  >
                    <button
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                    >
                      <div className="rounded-md bg-course-3/10 p-2 text-course-3 shrink-0">
                        <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-semibold leading-tight text-zinc-800 dark:text-zinc-200">
                          {cleanLabel}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">
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
                        title={isPinned ? "Unpin from Home" : "Pin to Home"}
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
                    className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-md border border-zinc-200/50 p-3 shadow-2xs hover:shadow-xs transition-all dark:border-zinc-800/80 dark:bg-zinc-900/60"
                  >
                    <button
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
                    >
                      <div className="rounded-md bg-warn-soft p-2 text-warn shrink-0">
                        <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-semibold leading-tight text-zinc-800 dark:text-zinc-200">
                          {cleanLabel}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium font-outfit">
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
                        title={isPinned ? "Unpin from Home" : "Pin to Home"}
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

      </AppLibrary>
    );
  },
);
AppLibraryPortal.displayName = "AppLibraryPortal";
export default AppLibraryPortal;
