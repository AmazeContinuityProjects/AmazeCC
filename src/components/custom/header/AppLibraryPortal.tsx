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

    useEffect(() => {
      if (!open) {
        setLibrarySearchQuery("");
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

    const renderItemCard = (item: ModuleEntry, opts?: { cleanPrefix?: string; subtitle?: string; tint?: string }) => {
      const Icon = item.icon || Home;
      const isPanelTrigger = item.target.kind === "panel";
      const pinId = getPinId(item);
      const pinned = settings?.pinnedNavTabs ?? [];
      const isPinned = pinId ? pinned.includes(pinId) : false;
      const atLimit = !isPinned && pinned.length >= 4;
      const label = opts?.cleanPrefix ? item.label.replace(opts.cleanPrefix, "") : item.label;

      return (
        <div
          key={item.id}
          className="group/item relative flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-white to-zinc-50/20 p-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40"
        >
          <button
            onClick={() => runEntry(item)}
            className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none"
          >
            <div className={`rounded-xl p-2 shrink-0 ${opts?.tint ?? "bg-info-surface text-info"}`}>
              <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-bold leading-tight text-zinc-800 dark:text-zinc-200">{label}</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
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
                {filteredSearchItems.map((item) => renderItemCard(item))}
              </div>
            </div>
          )
        ) : (
          primaryGroups.map((group) => {
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
                <h3 className="px-1 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {group.name}
                </h3>
                <div className="space-y-3">
                  {segments.map((seg, idx) => {
                    if (seg.type === "academics") {
                      return (
                        <div key={`${group.name}-academics-${idx}`} className="space-y-2">
                          <h4 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Academics
                          </h4>
                          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                            {academicsItems.map((sub) =>
                              renderItemCard(sub, {
                                tint: "bg-purple-50 text-purple-650 dark:bg-purple-950/30 dark:text-purple-400",
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
                          <h4 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Hostel Hub
                          </h4>
                          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                            {hostelItems.map((sub) =>
                              renderItemCard(sub, {
                                cleanPrefix: "Hostel ",
                                tint: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
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
                        className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2"
                      >
                        {seg.items.map((item) =>
                          renderItemCard(item, {
                            tint:
                              group.name === "Study"
                                ? "bg-purple-50 text-purple-650 dark:bg-purple-950/30 dark:text-purple-400"
                                : group.name === "Campus"
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                                  : group.name === "Tools"
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : "bg-info-surface text-info",
                            subtitle:
                              group.name === "Study"
                                ? "Academic trackers & schedule"
                                : group.name === "Campus"
                                  ? "Campus services"
                                  : "Social & utilities",
                          }),
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

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
            {quickPinTabs.map((tab) => {
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
