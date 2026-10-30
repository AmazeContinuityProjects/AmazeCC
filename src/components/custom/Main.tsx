"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useAtom, useSetAtom } from "jotai";
import {
  credentialsAtom,
  messageAtom,
  attendanceDataAtom,
  marksDataAtom,
  gradesDataAtom,
  allGradesDataAtom,
  scheduleDataAtom,
  hostelDataAtom,
  calendarDataAtom,
  isReloadingAtom,
  isLoggedInAtom,
  moodleDataAtom,
  demoModeAtom,
  settingsAtom,
  registeredEventsAtom,
  eventHubEventsAtom,
  commandPaletteOpenAtom,
  isShortcutsHelpOpenAtom,
  officialOdDataAtom,
  authorizedIDAtom,
  defaultSettings,
} from "@/store";
import IntroSong from "@/lib/introSong/IntroSong";
import config from "../../../config.json";
import { useTaskReminderScheduler } from "./tasks/useTaskReminderScheduler";
import { useAppBootstrap } from "./app/useAppBootstrap";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import BottomSheet from "@/components/custom/shared/BottomSheet";
import { useTheme } from "next-themes";
import { Keyboard } from "lucide-react";
import { BUILT_IN_MODES, listModes, loadCustomModes, resolveMode, type SyncMode } from "@/lib/sync-engine/sync-modes";
import { dismissSyncSession, getSyncSessionSnapshot, isSyncSessionOpen } from "@/lib/sync-engine/sync-session";
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
  const setMessage = useSetAtom(messageAtom);
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
  useAppNetworkStatus(isLoggedIn, demoMode);
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
    IDs,
    demoMode,
    settings,
    customModes,
    setSettings,
    setDemoMode,
    setIsReloading,
    setAttendanceData,
    setMarksData,
    setGradesData,
    setAllGradesData,
    setScheduleData,
    sethostelData,
    setCalender,
    setRegisteredEvents,
    setEventHubEvents,
    setMoodleData,
    setIsLoggedIn,
    setOfficialOdData,
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
  const persistDefaultSyncMode = useCallback(
    (id: string) => {
      setSettings((prev) => {
        const next = { ...prev, defaultSyncMode: id };
        try {
          localStorage.setItem("settings", JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [setSettings],
  );
  const selectSyncMode = useCallback(
    (id: string) => {
      persistDefaultSyncMode(id);
      void handleReloadRequest(undefined, id);
    },
    [persistDefaultSyncMode, handleReloadRequest],
  );

  // Sign-in now lives on page one of the onboarding hero, so this returns the
  // outcome instead of driving a sheet: `true` on success, and on failure the
  // reason from the sync log is surfaced by the caller.
  const [loginError, setLoginError] = useState<string | null>(null);
  const submitLogin = useCallback(async (): Promise<boolean> => {
    setLoginError(null);
    setIsReloading(true);
    try {
      await handleLogin();
      return true;
    } catch (err) {
      // The engine writes the real reason into the session log ("Invalid
      // Username / Password", a rate limit, a timeout). Mirror the last failure
      // for the sign-in screen and drop the half-open session so no progress
      // modal can pop up behind the hero that deliberately suppressed it.
      const failure = [...getSyncSessionSnapshot().lines].reverse().find((line) => line.status === "error");
      setLoginError(
        failure?.text ?? (err instanceof Error && err.message ? err.message : "Sign-in failed. Please try again."),
      );
      if (isSyncSessionOpen()) dismissSyncSession();
      return false;
    }
  }, [handleLogin, setIsReloading]);

  const handleDemoClick = async () => {
    const demoData = await (await fetch("/data/demoData.json")).json();
    setDemoMode(true);
    localStorage.setItem("demoMode", "true");
    setIDs({
      VtopUsername: demoData.username,
      VtopPassword: demoData.password,
      MoodleUsername: "",
      MoodlePassword: "",
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
  };

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

  // Bootstrap reads the stored session and the intro flag in one effect; the
  // hero/dashboard decision below cannot be trusted until it has run, so hold
  // the branded opening screen instead of flashing the wrong surface.
  if (!appHydrated) return <OpeningScreen />;

  return (
    <LazyMotion features={() => import("framer-motion").then((mod) => mod.domMax)}>
      <>
        {/* One-time intro song, gated on the VTOP authorizedID. Renders nothing
            for anyone not on the allowlist, and not even an <audio> element for
            them. Mounted at the root so it survives sub-tab navigation. */}
        <IntroSong authorizedId={authorizedID} />
        <m.div className="min-h-screen bg-gray-50  dark:bg-black flex flex-col text-gray-900  dark:text-zinc-100 transition-colors">
          <SyncSessionHost
            activeModeId={activeModeId}
            modes={allModes}
            modeLabel={activeMode.label}
            onSelectMode={selectSyncMode}
            onOpenEditor={() => setModeEditorOpen(true)}
            onChangePassword={() => setCredEditorOpen(true)}
            onRetry={() => handleReloadRequest()}
          />

          {credEditorOpen && (
            <CredentialEditorModal
              open={credEditorOpen}
              onClose={() => setCredEditorOpen(false)}
              onSaved={(ids) => {
                setIDs(ids as typeof IDs);
                setCredEditorOpen(false);
                // The previous rejection is what brought the student here; keeping it
                // on screen while the retry runs would read as "still wrong".
                setLoginError(null);
                // Fire-and-forget: the retry reports through the sync session, which
                // the intro's sync screen is already subscribed to. Swallow the
                // rejection so a failed retry is not also an unhandled promise.
                handleLogin(undefined, ids as Ids).catch(() => {});
              }}
            />
          )}

          {modeEditorOpen && (
            <SyncModeEditor
              open={modeEditorOpen}
              onClose={() => setModeEditorOpen(false)}
              onChanged={setCustomModes}
              defaultId={activeModeId}
              onSetDefault={persistDefaultSyncMode}
              onRun={(id) => {
                setModeEditorOpen(false);
                selectSyncMode(id);
              }}
            />
          )}

          <AuthenticatedWorkspace
            handleLogOutRequest={handleLogOutRequest}
            handleReloadRequest={handleReloadRequest}
            loginToVTOP={loginToVTOP}
            handleLogin={handleLogin}
            onOpenCommandPalette={openCommandPalette}
            onOpenShortcutsHelp={openShortcutsHelp}
            onRunSyncMode={selectSyncMode}
            intro={{
              // "Try the demo" and a saved session skip straight to the welcome
              // beat; everyone else lands on page one of onboarding: sign in.
              initialPhase: initialIntent === "demo" || isLoggedIn || demoMode ? "welcome" : "login",
              login: {
                username: IDs.VtopUsername,
                password: IDs.VtopPassword,
                setUsername: (value: string) => setIDs((prev) => ({ ...prev, VtopUsername: value })),
                setPassword: (value: string) => setIDs((prev) => ({ ...prev, VtopPassword: value })),
                onSignIn: submitLogin,
                error: loginError,
                // Offered only for the rejections a new password actually fixes
                // (see `classifyAuthFailure`); the editor re-runs the login on
                // save, and the intro follows that run onto its sync screen.
                onChangePassword: () => setCredEditorOpen(true),
              },
            }}
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
            {isShortcutsHelpOpen && <GlobalShortcutsModal onClose={() => setIsShortcutsHelpOpen(false)} />}
          </AnimatePresence>
        </m.div>
      </>
    </LazyMotion>
  );
}

function OpeningScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-600 dark:bg-black dark:text-slate-300"
      role="status"
      aria-label="Opening your workspace"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span className="text-sm font-semibold">Opening your workspace…</span>
    </div>
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
      ],
    },
    {
      title: "Quick Tools & Actions",
      items: [
        { keys: ["Ctrl", "K"], desc: "Toggle Spotlight Command Palette" },
        { keys: ["Alt", "O"], desc: "Open On-Duty (OD) hours page" },
        { keys: ["Alt", "B"], desc: "Toggle privacy blur filter (hides GPA)" },
        { keys: ["Alt", "T"], desc: "Toggle Theme (Light / Dark mode)" },
        { keys: ["?"], desc: "Show this keyboard shortcuts cheat-sheet" },
      ],
    },
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
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {cat.title}
              </h4>
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
