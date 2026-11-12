"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
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
  activeTabAtom,
} from "@/store";
import { activeRegNumberAtom, pendingInviteHandleAtom } from "@/store/socialAtoms";
import { activeToolsSubTabAtom } from "@/store/uiAtoms";
import { INVITE_PARAM, handleFromInvite, isValidHandle } from "@/lib/social/handle";
import IntroSong from "@/lib/introSong/IntroSong";
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
const FeedbackModal = dynamic(() => import("./feedback/FeedbackModal"));
const BugRecordingFloatingBar = dynamic(() => import("./feedback/BugRecordingFloatingBar"));
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
import posthog from "posthog-js";
import { trackScreenView, getPostHogUserIdentifiers, aliasPostHogUser } from "@/lib/posthog";
import buildInfo from "@/data/buildInfo.json";
import { useRouter } from "next/navigation";
import { clearSignInReturn, peekSignInReturn, VTOP_LOGIN_EVENT } from "@/lib/signInReturn";
import { credentialManager } from "@/lib/sync-engine/credential-manager";
import { hasStoredVtopCredentials } from "./app/readBootstrapSnapshot";
import ConnectionBanner from "./shared/ConnectionBanner";
import { isMacPlatform, NAV_SHORTCUTS } from "@/lib/shortcuts";

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
  const [isReloading, setIsReloading] = useAtom(isReloadingAtom);
  const setOfficialOdData = useSetAtom(officialOdDataAtom);
  const [isLoggedIn, setIsLoggedIn] = useAtom(isLoggedInAtom);
  const [authorizedID, setAuthorizedID] = useAtom(authorizedIDAtom);
  const activeRegNumber = useAtomValue(activeRegNumberAtom);
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
  const identifiedDistinctId = useRef<string | null>(null);
  /** The name last sent, so a profile that lands after identify re-runs it. */
  const identifiedName = useRef<string | null>(null);

  const {
    activeTab,
    activeSubTab,
    activeAttendanceSubTab,
    activeToolsSubTab,
    activeDayscholarSubTab,
    activeMoreSubTab,
    activeProfileSubTab,
    hostelActiveSubTab,
  } = useDashboardNavigator();

  useEffect(() => {
    if (!appHydrated) return;
    trackScreenView(activeTab, activeSubTab, {
      attendanceSubTab: activeAttendanceSubTab,
      toolsSubTab: activeToolsSubTab,
      dayscholarSubTab: activeDayscholarSubTab,
      moreSubTab: activeMoreSubTab,
      profileSubTab: activeProfileSubTab,
      hostelSubTab: hostelActiveSubTab,
    });
  }, [
    appHydrated,
    activeTab,
    activeSubTab,
    activeAttendanceSubTab,
    activeToolsSubTab,
    activeDayscholarSubTab,
    activeMoreSubTab,
    activeProfileSubTab,
    hostelActiveSubTab,
  ]);
  // Custom sync modes (built-ins come from the engine). Refreshed whenever the
  // editor reports a change, so the sheet picker and palette stay current.
  const [customModes, setCustomModes] = useState<SyncMode[]>(() => loadCustomModes());
  const [modeEditorOpen, setModeEditorOpen] = useState(false);
  const allModes = useMemo(() => listModes(customModes), [customModes]);
  const activeModeId = settings.defaultSyncMode ?? "quarterly";
  const activeMode = resolveMode(activeModeId, customModes) ?? BUILT_IN_MODES.find((m) => m.id === "quarterly")!;

  // Overlays dismiss via system back before screen navigation does
  useOverlayBack("command-palette", commandPaletteOpen, () => setCommandPaletteOpen(false));
  // Credential editor + shortcuts sheet register themselves via BottomSheet.

  // Task reminders are app-wide (not tied to the Tasks tab being open)
  useTaskReminderScheduler(isLoggedIn || demoMode);

  useSyncSessionBridge();

  // "Sign in, then come back": a page like the FFCS planner sent the student
  // here to log in. Send them back only once a VTOP login has succeeded AFTER
  // they asked: saved credentials alone are not proof — they may be the very
  // ones that stopped working, and returning on them just bounced the student
  // straight back to the error. Checked on mount and on every successful login
  // (a credential fix does not change "logged in", it was already true).
  // Client-side navigation, so the sync still running in the background keeps
  // going.
  const router = useRouter();
  const setActiveTab = useSetAtom(activeTabAtom);

  // Consume deep-link /?open=friend-finder (e.g. from share links or post-login return)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("open") === "friend-finder") {
        setActiveTab("friend-finder");
        url.searchParams.delete("open");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {}
  }, [setActiveTab]);

  // Consume an invite link /?add=AMZ-XXXX-XXXX: open Social with the Add friend
  // sheet on that handle. Pairing still needs the student to confirm there.
  const setActiveToolsSubTab = useSetAtom(activeToolsSubTabAtom);
  const setPendingInvite = useSetAtom(pendingInviteHandleAtom);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(INVITE_PARAM);
      if (raw === null) return;
      url.searchParams.delete(INVITE_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      const invited = handleFromInvite(raw);
      if (!isValidHandle(invited)) return;
      setPendingInvite(invited);
      setActiveTab("tools");
      setActiveToolsSubTab("social");
    } catch {}
  }, [setActiveTab, setActiveToolsSubTab, setPendingInvite]);

  useEffect(() => {
    const returnIfFreshlySignedIn = () => {
      if (demoMode) return;
      const note = peekSignInReturn();
      if (!note) return;
      const session = credentialManager.getStoredVtop();
      if (!session?.fetchedAt || session.fetchedAt < note.at) return;
      clearSignInReturn();
      router.push(note.path);
    };
    returnIfFreshlySignedIn();
    window.addEventListener(VTOP_LOGIN_EVENT, returnIfFreshlySignedIn);
    return () => window.removeEventListener(VTOP_LOGIN_EVENT, returnIfFreshlySignedIn);
  }, [isLoggedIn, demoMode, router]);

  // Sent here to sign in while saved credentials exist means those
  // credentials are what failed (a guest gets the login form instead), so
  // open the editor to fix them rather than showing a dashboard that cannot
  // sync. Saving it logs in again, which completes the return trip above.
  useEffect(() => {
    if (initialIntent !== "login" || demoMode) return;
    if (!peekSignInReturn()) return;
    if (hasStoredVtopCredentials(storage.ids.get(), storage.username.get(), storage.password.get())) {
      setCredEditorOpen(true);
    }
  }, [initialIntent, demoMode]);

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

  // Background autosync: when enabled in settings, sweep on a timer — the
  // engine's cadence gate decides what is actually due (Daily at most once a
  // day, Weekly once a week, Monthly once a month, Quarterly every 3 months).
  // Skipped steps cost the server nothing. Paused while a sync is already
  // running.
  useEffect(() => {
    const auto = settings.autoSyncInterval;
    if (auto === "manual" || auto === "off" || auto === undefined || auto === null) return;
    const delay = auto === "15m" ? 15 * 60_000 : auto === "30m" ? 30 * 60_000 : 60 * 60_000;
    const id = window.setInterval(() => {
      if (isReloading) return;
      void handleReloadRequest();
    }, delay);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoSyncInterval, handleReloadRequest, isReloading]);
  // Switching modes persists the preference AND re-runs the reload with it,
  // so the sheet switcher is one tap, not two.
  const persistDefaultSyncMode = useCallback(
    (id: string) => {
      setSettings((prev) => {
        const next = { ...prev, defaultSyncMode: id };
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

  // Identify user in PostHog, prioritizing their real VIT registration number (e.g. 25BLC1081)
  // over purely numeric enrollment / application numbers (e.g. 20626703).
  useEffect(() => {
    if (!isLoggedIn || demoMode) {
      identifiedDistinctId.current = null;
      identifiedName.current = null;
      return;
    }

    if (!appHydrated || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      return;
    }

    const identity = getPostHogUserIdentifiers({
      authorizedID,
      username: IDs?.VtopUsername,
      activeReg: activeRegNumber,
    });

    if (!identity || !identity.distinctId) return;
    // A profile segment that lands *after* the first identify changes nothing
    // here but the name — re-run anyway, since sending it is the whole point
    // of this pass. The aliasing below is a no-op when the id is unchanged.
    if (identifiedDistinctId.current === identity.distinctId && identifiedName.current === (identity.name ?? "")) {
      return;
    }

    const previousId = identifiedDistinctId.current;
    if (previousId && previousId !== identity.distinctId) {
      aliasPostHogUser(identity.distinctId, previousId);
    } else {
      // If PostHog previously stored a numeric enrollment number, alias it to the registration number
      const currentPhId = (posthog as unknown as { get_distinct_id?: () => string }).get_distinct_id?.();
      if (currentPhId && currentPhId !== identity.distinctId && /^\d{6,12}$/.test(currentPhId)) {
        aliasPostHogUser(identity.distinctId, currentPhId);
      }
    }

    const regNumber = identity.registrationNumber || identity.distinctId;
    const studentName = identity.name;
    posthog.identify(identity.distinctId, {
      // PostHog's person page reads `name`, which is what makes a person
      // readable as the student rather than as a bare registration number.
      ...(studentName ? { name: studentName } : {}),
      registration_number: regNumber,
      reg_number: regNumber,
      enrollment_number: identity.enrollmentNumber,
      application_number: identity.enrollmentNumber,
      semester: settings.currSemesterID,
      residential_status: settings.residentialStatus,
      theme: theme,
      default_sync_mode: settings.defaultSyncMode,
      demo_mode: demoMode,
      app_version: buildInfo.commitHash,
    });
    posthog.register({
      registration_number: regNumber,
      // …and as a super property, so every event after identify carries it too.
      ...(studentName ? { name: studentName } : {}),
    });
    identifiedDistinctId.current = identity.distinctId;
    identifiedName.current = studentName ?? "";
  }, [
    activeRegNumber,
    appHydrated,
    authorizedID,
    demoMode,
    IDs?.VtopUsername,
    isLoggedIn,
    settings.currSemesterID,
    settings.residentialStatus,
    settings.defaultSyncMode,
    theme,
  ]);

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

          <ConnectionBanner enabled={isLoggedIn && !demoMode} />
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
          <FeedbackModal />
          <BugRecordingFloatingBar />
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
  const alt = isMacPlatform() ? "⌥" : "Alt";
  const mod = isMacPlatform() ? "⌘" : "Ctrl";
  const categories = [
    {
      title: "Go to (press g, then the letter)",
      items: NAV_SHORTCUTS.map((s) => ({
        keys: ["g", s.key.toUpperCase()],
        joiner: "then",
        desc: s.alt ? `${s.desc}  ·  also ${alt}+${s.key.toUpperCase()}` : s.desc,
      })),
    },
    {
      title: "Actions",
      items: [
        { keys: [mod, "K"], desc: "Command palette" },
        { keys: ["/"], desc: "Command palette" },
        { keys: [alt, "B"], desc: "Hide or show CGPA" },
        { keys: [alt, "P"], desc: "Privacy mode (blur grades, attendance, fees)" },
        { keys: [alt, "T"], desc: "Switch light / dark theme" },
        { keys: ["?"], desc: "This list" },
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
                          {kIdx > 0 && (
                            <span className="text-[10px] text-gray-400 font-bold px-0.5">
                              {"joiner" in item ? item.joiner : "+"}
                            </span>
                          )}
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
