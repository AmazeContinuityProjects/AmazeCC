'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAtom, useSetAtom } from "jotai";
import {
  credentialsAtom, messageAtom, attendanceDataAtom, marksDataAtom, gradesDataAtom,
  allGradesDataAtom, scheduleDataAtom, hostelDataAtom, calendarDataAtom,
  isReloadingAtom,
  isLoggedInAtom,
  moodleDataAtom, demoModeAtom, settingsAtom,
  registeredEventsAtom, eventHubEventsAtom, commandPaletteOpenAtom, isShortcutsHelpOpenAtom,
  officialOdDataAtom,
  authorizedIDAtom,
  defaultSettings
} from "@/store";
import IntroSong from "@/lib/introSong/IntroSong";
import config from "../../../config.json";
import { useTaskReminderScheduler } from "./tasks/useTaskReminderScheduler";
import { useAppBootstrap } from "./app/useAppBootstrap";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import BottomSheet from "@/components/custom/shared/BottomSheet";
import { useTheme } from "next-themes";
import { X, Keyboard, WifiOff } from "lucide-react";
import {
  BUILT_IN_MODES,
  listModes,
  loadCustomModes,
  resolveMode,
  type SyncMode,
} from "@/lib/sync-engine/sync-modes";
const LoginForm = dynamic(() => import("./LoginForm"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-[#03060f] dark:text-slate-300" role="status" aria-label="Opening sign in">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span>Preparing sign in…</span>
    </div>
  ),
});
const CredentialEditorModal = dynamic(() => import("./CredentialEditorModal"));
const SyncModeEditor = dynamic(() => import("@/components/custom/shared/SyncModeEditor"));
import { useOverlayBack } from "@/lib/overlayStack";
import type { Ids } from "@/lib/sync-engine/types";
import { storage } from "@/lib/storage";
import { reportError } from "@/lib/error-utils";
import { DashboardNavigatorProvider, useDashboardNavigator } from "./dashboard/DashboardNavigator";
import CommandPaletteHost from "./app/CommandPaletteHost";
import { useAppDataActions } from "./app/useAppDataActions";
import { useLogoutAction } from "./app/useLogoutAction";
import { useGlobalShortcuts } from "./app/useGlobalShortcuts";
import { useAppAppearance } from "./app/useAppAppearance";
import { useAppNetworkStatus } from "./app/useAppNetworkStatus";
import AuthenticatedWorkspace from "./app/AuthenticatedWorkspace";
import SyncSessionHost from "./app/SyncSessionHost";
import { useSyncSessionBridge } from "./app/useSyncSessionBridge";

interface MainProps {
  initialIntent?: "login" | "demo";
  onSignedOut?: () => void;
}

export default function LoginPage(props: MainProps) {
  return (
    <DashboardNavigatorProvider>
      <MainRuntime {...props} />
    </DashboardNavigatorProvider>
  );
}

function MainRuntime({ initialIntent, onSignedOut }: MainProps) {
  const { theme, setTheme } = useTheme();
  const { setActiveDay } = useDashboardNavigator();
  // --- State Management via Jotai Atoms ---
  const [IDs, setIDs] = useAtom(credentialsAtom);
  const [message, setMessage] = useAtom(messageAtom);
  const setAttendanceData = useSetAtom(attendanceDataAtom);
  const setMarksData = useSetAtom(marksDataAtom);
  const setGradesData = useSetAtom(gradesDataAtom);
  const setAllGradesData = useSetAtom(allGradesDataAtom);
  const setScheduleData = useSetAtom(scheduleDataAtom);
  const sethostelData = useSetAtom(hostelDataAtom);
  const setCalender = useSetAtom(calendarDataAtom);
  const [, setIsReloading] = useAtom(isReloadingAtom);
  const setOfficialOdData = useSetAtom(officialOdDataAtom);
  const [isLoggedIn, setIsLoggedIn] = useAtom(isLoggedInAtom);
  const [authorizedID, setAuthorizedID] = useAtom(authorizedIDAtom);
  const setMoodleData = useSetAtom(moodleDataAtom);
  const [demoMode, setDemoMode] = useAtom(demoModeAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const setRegisteredEvents = useSetAtom(registeredEventsAtom);
  const setEventHubEvents = useSetAtom(eventHubEventsAtom);
  const [commandPaletteOpen, setCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useAtom(isShortcutsHelpOpenAtom);
  const [credEditorOpen, setCredEditorOpen] = useState(false);
  const { isOffline, isAPIworking, setIsAPIworking } = useAppNetworkStatus(isLoggedIn, demoMode);
  const { appHydrated, setAttendanceAndOD } = useAppBootstrap();
  const didStartInitialIntent = useRef(false);
  // Custom sync modes (built-ins come from the engine). Refreshed whenever the
  // editor reports a change, so the sheet picker and palette stay current.
  const [customModes, setCustomModes] = useState<SyncMode[]>(() => loadCustomModes());
  const [modeEditorOpen, setModeEditorOpen] = useState(false);
  const allModes = useMemo(() => listModes(customModes), [customModes]);
  const activeModeId = settings.defaultSyncMode ?? "quick";
  const activeMode = resolveMode(activeModeId, customModes) ?? BUILT_IN_MODES[1];

  // Overlays dismiss via system back before screen navigation does
  useOverlayBack("command-palette", commandPaletteOpen, () => setCommandPaletteOpen(false));
  // Credential editor + shortcuts sheet register themselves via BottomSheet.

  // Task reminders are app-wide (not tied to the Tasks tab being open)
  useTaskReminderScheduler(isLoggedIn || demoMode);

  useSyncSessionBridge();

  useEffect(() => {
    if (!isLoggedIn && !demoMode) return;
    const day = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    setActiveDay(day);
  }, [isLoggedIn, demoMode, setActiveDay]);

  useAppAppearance(settings, theme);

  // Attendance cache normalization and initial app state live in focused hooks.

  const { loginToVTOP, handleLogin, handleReloadRequest } = useAppDataActions({
    IDs, demoMode, settings, customModes, setSettings, setDemoMode, setIsReloading,
    setAttendanceData, setMarksData, setGradesData, setAllGradesData, setScheduleData,
    sethostelData, setCalender, setRegisteredEvents, setEventHubEvents, setMoodleData,
    setIsLoggedIn, setOfficialOdData,
    setAttendanceAndOD,
  });
  const handleLogOutRequest = useLogoutAction({
    theme,
    setTheme,
    setIsLoggedIn,
    setIDs,
    setDemoMode,
    setAuthorizedID,
    setSettings,
    setAttendanceData,
    setMarksData,
    setGradesData,
    setScheduleData,
    setMessage,
    onSignedOut,
  });
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [setCommandPaletteOpen]);
  const openShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(true), [setIsShortcutsHelpOpen]);

  // Switching modes persists the preference AND re-runs the reload with it,
  // so the sheet switcher is one tap, not two.
  const persistDefaultSyncMode = useCallback((id: string) => {
    setSettings(prev => {
      const next = { ...prev, defaultSyncMode: id };
      try {
        localStorage.setItem("settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [setSettings]);
  const selectSyncMode = useCallback((id: string) => {
    persistDefaultSyncMode(id);
    void handleReloadRequest(undefined, id);
  }, [persistDefaultSyncMode, handleReloadRequest]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!IDs.VtopUsername || !IDs.VtopPassword) {
      return alert("Please fill all the fields!");
    }
    setIsReloading(true);
    handleLogin().catch(() => {});
  };

  const handleDemoClick = async () => {
    const demoData = await (await fetch('/data/demoData.json')).json();
    setDemoMode(true);
    localStorage.setItem("demoMode", "true");
    setIDs({
      VtopUsername: demoData.username,
      VtopPassword: demoData.password,
      MoodleUsername: "",
      MoodlePassword: ""
    });

    setSettings(defaultSettings);
    setAttendanceData(demoData.attendance);
    setMarksData(demoData.marks);
    setGradesData(demoData.grades);
    setAllGradesData(demoData.allGrades);
    setScheduleData(demoData.schedule);
    sethostelData(demoData.hostel);
    setCalender(demoData.calender);
    if ((demoData as any).registeredEvents) {
      setRegisteredEvents((demoData as any).registeredEvents);
      localStorage.setItem("registeredEvents", JSON.stringify((demoData as any).registeredEvents));
    }
    if ((demoData as any).profile) {
      localStorage.setItem("profile", JSON.stringify((demoData as any).profile));
    }
    setIsLoggedIn(true);
  }

  useEffect(() => {
    if (!initialIntent || didStartInitialIntent.current) return;
    didStartInitialIntent.current = true;

    if (initialIntent === "demo") {
      void handleDemoClick().catch((error) => {
        reportError(error, { context: "initialDemoEntry" });
        onSignedOut?.();
      });
    }
  }, [handleDemoClick, initialIntent, onSignedOut]);

  useGlobalShortcuts({ theme, setTheme, settings, setSettings, setCommandPaletteOpen, setIsShortcutsHelpOpen });



  return (
    <LazyMotion features={() => import("framer-motion").then((mod) => mod.domMax)}>
    <>
        {/* One-time intro song, gated on the VTOP authorizedID. Renders nothing
            for anyone not on the allowlist, and not even an <audio> element for
            them. Mounted at the root so it survives sub-tab navigation. */}
        <IntroSong authorizedId={authorizedID} />
        <m.div
          className="min-h-screen bg-gray-50  dark:bg-black flex flex-col text-gray-900  dark:text-zinc-100 transition-colors"
        >
      <AnimatePresence>
        {isAPIworking && !isOffline && (
          <m.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-[calc(env(safe-area-inset-top,0px)+1rem)] left-1/2 -translate-x-1/2 z-50 w-full max-w-[320px] px-4"
          >
            <div className="flex items-center justify-between gap-3 p-3.5 bg-red-50/90 dark:bg-zinc-950/90 backdrop-blur-md border border-red-200/50 dark:border-red-900/30 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 dark:bg-red-950/40 text-red-650 dark:text-red-400 flex items-center justify-center shrink-0">
                  <WifiOff size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-red-900 dark:text-red-400 leading-none">Connection Offline</h4>
                  <p className="text-[10px] text-red-700/80 dark:text-red-400/70 font-semibold mt-1 truncate">
                    Unable to connect to VTOP API services.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAPIworking(false)}
                className="p-1 rounded-lg text-red-500 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <SyncSessionHost
        activeModeId={activeModeId}
        modes={allModes}
        modeLabel={activeMode.label}
        onSelectMode={selectSyncMode}
        onOpenEditor={() => setModeEditorOpen(true)}
        onChangePassword={() => setCredEditorOpen(true)}
        onRetry={() => handleReloadRequest()}
      />

      {!appHydrated && initialIntent !== "login" && initialIntent !== "demo" && (
        <div className="min-h-[60vh] flex-1" role="status" aria-label="Restoring your workspace" />
      )}

      {(!isLoggedIn && !demoMode) && (appHydrated || initialIntent === "login") && (
        <LoginForm
          initialLoginOpen={initialIntent === "login"}
          username={IDs.VtopUsername}
          setUsername={(val: string) =>
            setIDs(prev => ({ ...prev, VtopUsername: val }))
          }
          password={IDs.VtopPassword}
          setPassword={(val: string) =>
            setIDs(prev => ({ ...prev, VtopPassword: val }))
          }
          message={message}
          handleFormSubmit={handleFormSubmit}
          handleDemoClick={handleDemoClick}
          residentialStatus={settings.residentialStatus || "hosteller"}
          setResidentialStatus={(val: "hosteller" | "dayscholar") => {
            setSettings(prev => ({ ...prev, residentialStatus: val }));
            localStorage.setItem("settings", JSON.stringify({ ...settings, residentialStatus: val }));
          }}
          isDayscholarWithBus={settings.isDayscholarWithBus || false}
          setIsDayscholarWithBus={(val: boolean) => {
            setSettings(prev => ({ ...prev, isDayscholarWithBus: val }));
            localStorage.setItem("settings", JSON.stringify({ ...settings, isDayscholarWithBus: val }));
          }}
        />
      )}

      {appHydrated && (!isLoggedIn && !demoMode) && (
        <>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setCredEditorOpen(true)}
              style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
            >
              Edit saved credentials
            </button>
          </div>
          <div className="mx-auto mt-5 w-full max-w-md px-4">
            <Link
              href="/ffcs/"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-500/15 dark:text-indigo-300"
            >
              Go to FFCS Planner
            </Link>
          </div>
        </>
      )}

      {credEditorOpen && <CredentialEditorModal
        open={credEditorOpen}
        onClose={() => setCredEditorOpen(false)}
        onSaved={(ids) => {
          setIDs(ids as typeof IDs);
          setCredEditorOpen(false);
          handleLogin(undefined, ids as Ids);
        }}
      />}

      {modeEditorOpen && <SyncModeEditor
        open={modeEditorOpen}
        onClose={() => setModeEditorOpen(false)}
        onChanged={setCustomModes}
        defaultId={activeModeId}
        onSetDefault={persistDefaultSyncMode}
        onRun={(id) => {
          setModeEditorOpen(false);
          selectSyncMode(id);
        }}
      />}

      <AuthenticatedWorkspace
        handleLogOutRequest={handleLogOutRequest}
        handleReloadRequest={handleReloadRequest}
        loginToVTOP={loginToVTOP}
        handleLogin={handleLogin}
        onOpenCommandPalette={openCommandPalette}
        onOpenShortcutsHelp={openShortcutsHelp}
        onRunSyncMode={selectSyncMode}
      />
      {/* <div className="top-0 left-0 w-full bg-blue-500 text-white text-center py-2 font-medium">
        Scheduled maintenance on December 29, 2025 ( afternoon ). API services will be temporarily unavailable.
      </div> */}


      <CommandPaletteHost
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        handleReloadRequest={handleReloadRequest}
        handleLogOutRequest={handleLogOutRequest}
        setModeEditorOpen={setModeEditorOpen}
        customModes={customModes}
      />
      <AnimatePresence>
        {isShortcutsHelpOpen && (
          <GlobalShortcutsModal onClose={() => setIsShortcutsHelpOpen(false)} />
        )}
      </AnimatePresence>
        </m.div>
    </>
    </LazyMotion>
  );
}

function GlobalShortcutsModal({ onClose }: { onClose: () => void }) {
  // Registered for system back via BottomSheet below.
  const categories = [
    {
      title: "Navigation",
      items: [
        { keys: ["Alt", "H"], desc: "Go to Home Tab" },
        { keys: ["Alt", "A"], desc: "Go to Attendance & Timetable" },
        { keys: ["Alt", "E"], desc: "Go to Event Hub" },
        { keys: ["Alt", "L"], desc: "Go to Koha Library Search" },
        { keys: ["Alt", "G"], desc: "Go to Academic Grades" },
        { keys: ["Alt", "S"], desc: "Go to Settings" },
      ]
    },
    {
      title: "Quick Tools & Actions",
      items: [
        { keys: ["Ctrl", "K"], desc: "Toggle Spotlight Command Palette" },
        { keys: ["Alt", "O"], desc: "Open On-Duty (OD) hours page" },
        { keys: ["Alt", "B"], desc: "Toggle privacy blur filter (hides GPA)" },
        { keys: ["Alt", "T"], desc: "Toggle Theme (Light / Dark mode)" },
        { keys: ["?"], desc: "Show this keyboard shortcuts cheat-sheet" },
      ]
    }
  ];

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="shortcuts-help-sheet"
      maxWidth="max-w-lg"
      title="Keyboard Shortcuts"
      icon={<Keyboard className="w-5 h-5" />}
      accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
      closeLabel="Close shortcuts help"
    >
      <div className="flex flex-col min-h-0">
        <div className="space-y-5">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{cat.title}</h4>
              <div className="divide-y divide-gray-100 dark:divide-gray-850/40 border border-gray-150 dark:border-gray-800/80 rounded-xl overflow-hidden bg-white/40 dark:bg-slate-900/10">
                {cat.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <span key={kIdx} className="flex items-center gap-1">
                          {kIdx > 0 && <span className="text-[10px] text-gray-400 font-bold px-0.5">+</span>}
                          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[10px] font-bold text-gray-800 dark:text-gray-200 shadow-xs">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

