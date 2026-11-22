"use client";

/**
 * The App Library portal. Navigation/search items come from the unified
 * module registry (`src/lib/navigation/registry.tsx`) so they stay in sync
 * with other surfaces (sidebar, command palette).
 */

import { memo, useEffect, useMemo, useState } from "react";
import SelectField from "../shared/primitives/SelectField";
import { formatSemesterName } from "@/lib/formatSemesterName";
import { ChevronRight, Home, Lightbulb, Pin, Sun } from "lucide-react";
import { AppLibrary } from "@amazecontinuityprojects/amazeui";
import config from "../../../../config.json";
import {
  activateEntry,
  getModuleRegistry,
  getPinId,
  quickPinTabs,
  type ModuleEntry,
  type NavContext,
} from "@/lib/navigation/registry";

const groupOrder = ["Study", "Campus", "Tools", "Account"] as const;

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
    void setSettings;
    void openCommandPalette;
    void tabIcons;

    const [librarySearchQuery, setLibrarySearchQuery] = useState("");
    const [showAllModules, setShowAllModules] = useState(false);
    const [editingPins, setEditingPins] = useState(false);

    useEffect(() => {
      if (!open) {
        setLibrarySearchQuery("");
        setShowAllModules(false);
        setEditingPins(false);
      }
    }, [open]);

    const ctx = useMemo<NavContext>(
      () => ({
        selectTab,
        setActiveSubTab,
        setActiveAttendanceSubTab,
        setActiveToolsSubTab,
        setHostelActiveSubTab,
        setActiveMoreSubTab,
        setActiveProfileSubTab,
        handleLogOutRequest,
        isHosteller,
        residentialStatus,
      }),
      [
        selectTab,
        setActiveSubTab,
        setActiveAttendanceSubTab,
        setActiveToolsSubTab,
        setHostelActiveSubTab,
        setActiveMoreSubTab,
        setActiveProfileSubTab,
        handleLogOutRequest,
        isHosteller,
        residentialStatus,
      ],
    );

    const registry = useMemo(() => getModuleRegistry(ctx), [ctx]);

    const runEntry = (entry: ModuleEntry) => {
      if (entry.target.kind === "panel") return;
      activateEntry(entry, ctx);
      onClose();
    };

    const commonNavEntries = useMemo(
      () =>
        registry.filter(
          (e) =>
            e.surfaces.sidebar === true ||
            e.surfaces.sidebar === "drill-in" ||
            e.surfaces.appLibraryPrimary ||
            e.surfaces.appLibrarySearch,
        ),
      [registry],
    );

    const primaryGroups = useMemo(() => {
      const items = registry.filter((e) => e.surfaces.appLibraryPrimary);
      return groupOrder
        .map((name) => ({ name, items: items.filter((e) => e.group === name) }))
        .filter((g) => g.items.length > 0);
    }, [registry]);

    // App library search shares all common enabled nav entries (sidebar + app library).
    const searchItems = useMemo(() => {
      const seen = new Set<string>();
      return commonNavEntries.filter((e) => {
        if (e.target.kind === "panel") return false; // panels are containers, not searchable destinations
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }, [commonNavEntries]);

    const academicsItems = useMemo(() => searchItems.filter((item) => item.searchGroup === "Academics"), [searchItems]);
    const hostelItems = useMemo(() => searchItems.filter((item) => item.searchGroup === "Hostel"), [searchItems]);

    const filteredSearchItems = useMemo(() => {
      if (!librarySearchQuery) return [];
      const q = librarySearchQuery.toLowerCase();
      return searchItems.filter((item) => {
        if (item.label.toLowerCase().includes(q)) return true;
        return (item.keywords ?? []).some((k) => k.toLowerCase().includes(q));
      });
    }, [librarySearchQuery, searchItems]);

    // One neutral well for every destination; colour is reserved for the accent
    // and for attendance/sync status, never for a category.
    const NEUTRAL_TINT = "bg-zinc-500/10 text-info";

    const pinnedIds: string[] = settings?.pinnedNavTabs ?? [];
    const pinnedEntries = pinnedIds
      .map((pinId) => registry.find((entry) => getPinId(entry) === pinId))
      .filter((entry): entry is ModuleEntry => Boolean(entry));
    const pinSlotsLeft = Math.max(0, 4 - pinnedIds.length);
    const pinLimitText =
      pinSlotsLeft === 0
        ? "4 of 4 pins used — unpin one first"
        : `${pinSlotsLeft} slot${pinSlotsLeft === 1 ? "" : "s"} left`;

    const renderItemCard = (item: ModuleEntry, opts?: { cleanPrefix?: string; subtitle?: string; tint?: string }) => {
      const Icon = item.icon || Home;
      const isPanelTrigger = item.target.kind === "panel";
      const pinId = getPinId(item);
      const isPinned = pinId ? pinnedIds.includes(pinId) : false;
      const atLimit = !isPinned && pinnedIds.length >= 4;
      const label = opts?.cleanPrefix ? item.label.replace(opts.cleanPrefix, "") : item.label;

      return (
        <div
          key={item.id}
          className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 transition-all hover:shadow-xs active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
        >
          <button
            onClick={() => runEntry(item)}
            className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className={`rounded-xl p-2 shrink-0 ${opts?.tint ?? NEUTRAL_TINT}`}>
              <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="line-clamp-2 text-sm font-bold leading-snug text-zinc-800 dark:text-zinc-200">
                {label}
              </span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500 font-medium">
                {opts?.subtitle ?? `${item.searchGroup ?? item.group} category`}
              </span>
            </div>
          </button>

          {pinId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePin(pinId);
              }}
              className={`relative hit-expand p-1.5 rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
                isPinned
                  ? "bg-primary border-primary text-primary-foreground"
                  : atLimit
                    ? "border-transparent text-zinc-300 dark:text-zinc-600"
                    : "border-transparent text-zinc-300 dark:text-zinc-600 hover:text-info hover:border-zinc-200 dark:hover:border-zinc-800"
              }`}
              title={isPinned ? "Unpin from bottom bar" : atLimit ? pinLimitText : "Pin to bottom bar"}
              aria-label={isPinned ? `Unpin ${label}` : atLimit ? pinLimitText : `Pin ${label} to bottom bar`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
            </button>
          )}

          {isPanelTrigger && !pinId && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
        </div>
      );
    };

    return (
      <AppLibrary
        open={open}
        onClose={onClose}
        title="App Library"
        subtitle="Select a module to open"
        showBack={false}
        searchQuery={librarySearchQuery}
        onSearchChange={setLibrarySearchQuery}
        className="!backdrop-blur-none"
      >
        {!librarySearchQuery && (
          <div className="flex items-center gap-1.5 px-1 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Search Results
              </h3>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {filteredSearchItems.map((item) => renderItemCard(item))}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Default landing: only the pinned destinations, then search.
                Everything else is one explicit tap away behind the disclosure. */}
            <div className="space-y-2">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Pinned
              </h3>
              {pinnedEntries.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
                  {pinnedEntries.map((entry) => renderItemCard(entry, { subtitle: "Pinned" }))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPins(true)}
                  className="w-full rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-5 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:border-info hover:text-info cursor-pointer"
                >
                  No pins yet — choose up to 4 destinations in Quick pins
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAllModules((value) => !value)}
              aria-expanded={showAllModules}
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 px-4 py-3 text-left text-sm font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span>{showAllModules ? "Hide all modules" : "Show all modules"}</span>
              <ChevronRight
                className={`h-4 w-4 text-zinc-400 transition-transform ${showAllModules ? "rotate-90" : ""}`}
              />
            </button>

            {showAllModules && (
              <div className="space-y-5">
                {primaryGroups.map((group) => {
                  const segments: Array<
                    { type: "items"; items: ModuleEntry[] } | { type: "academics" } | { type: "hostel" }
                  > = [];
                  let bucket: ModuleEntry[] = [];
                  const flush = () => {
                    if (bucket.length) {
                      segments.push({ type: "items", items: bucket });
                      bucket = [];
                    }
                  };
                  for (const item of group.items) {
                    if (item.target.kind === "panel" && item.target.panel === "academics") {
                      flush();
                      segments.push({ type: "academics" });
                    } else if (item.target.kind === "panel" && item.target.panel === "hostel") {
                      flush();
                      segments.push({ type: "hostel" });
                    } else {
                      bucket.push(item);
                    }
                  }
                  flush();

                  return (
                    <div key={group.name} className="space-y-3">
                      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {group.name}
                      </h3>
                      <div className="space-y-3">
                        {segments.map((seg, idx) => {
                          if (seg.type === "academics") {
                            return (
                              <div key={`${group.name}-academics-${idx}`} className="space-y-2">
                                <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  Academics
                                </h4>
                                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
                                  {academicsItems.map((sub) =>
                                    renderItemCard(sub, {
                                      tint: NEUTRAL_TINT,
                                      subtitle: "Academics Tracker",
                                    }),
                                  )}
                                </div>
                              </div>
                            );
                          }
                          if (seg.type === "hostel") {
                            return (
                              <div key={`${group.name}-hostel-${idx}`} className="space-y-2">
                                <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  Hostel Hub
                                </h4>
                                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
                                  {hostelItems.map((sub) =>
                                    renderItemCard(sub, {
                                      cleanPrefix: "Hostel ",
                                      tint: NEUTRAL_TINT,
                                      subtitle: "Hostel Hub",
                                    }),
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`${group.name}-items-${idx}`}
                              className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4"
                            >
                              {seg.items.map((item) =>
                                renderItemCard(item, {
                                  tint: NEUTRAL_TINT,
                                  subtitle:
                                    group.name === "Study"
                                      ? "Academic trackers & schedule"
                                      : group.name === "Campus"
                                        ? "Campus services"
                                        : group.name === "Tools"
                                          ? "Tools & utilities"
                                          : "Settings & profile",
                                }),
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="shrink-0 space-y-3 border-t border-zinc-200/50 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800/50 dark:bg-black/60 rounded-t-[20px] mt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-outfit">
              Quick pins
            </h4>
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{pinLimitText}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(editingPins ? quickPinTabs : quickPinTabs.filter((tab) => pinnedIds.includes(tab.id))).map((tab) => {
              const isPinned = pinnedIds.includes(tab.id);
              const atLimit = !isPinned && pinnedIds.length >= 4;
              return (
                <button
                  key={tab.id}
                  onClick={() => togglePin(tab.id)}
                  className={`hit-expand flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer select-none ${
                    isPinned
                      ? "bg-primary border-primary text-primary-foreground shadow-xs"
                      : atLimit
                        ? "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-info"
                  }`}
                  title={isPinned ? "Unpin from bottom bar" : atLimit ? pinLimitText : "Pin to bottom bar"}
                >
                  {isPinned ? "✓ " : "+ "}
                  {tab.label}
                </button>
              );
            })}
            {pinnedIds.length === 0 && !editingPins && (
              <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">No pins yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditingPins((value) => !value)}
            aria-expanded={editingPins}
            className="hit-expand flex items-center gap-1 py-1 text-sm font-bold text-info hover:underline cursor-pointer"
          >
            {editingPins ? "Done editing pins" : "Edit pins"}
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${editingPins ? "rotate-90" : ""}`} />
          </button>
        </div>

        <div
          className="shrink-0 space-y-2 border-t border-gray-200/50 bg-gray-50/80 px-5 py-4 dark:border-gray-800/50 dark:bg-black/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <h4 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 font-outfit">
            Interface Theme
          </h4>
          <div className="flex w-full gap-1.5 rounded-xl border border-gray-200/20 bg-gray-200/50 p-1 dark:border-gray-800/50 dark:bg-gray-900/50">
            {["light", "dark"].map((t) => (
              <button
                key={t}
                onClick={(e) => handleThemeChange(t, e)}
                className={`hit-expand flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold capitalize transition-all cursor-pointer ${
                  theme === t
                    ? "bg-white text-info shadow-xs dark:bg-black dark:text-info"
                    : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {t === "light" && <Sun className="h-3.5 w-3.5 text-info" />}
                {t === "dark" && <Lightbulb className="h-3.5 w-3.5 text-info" />}
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
