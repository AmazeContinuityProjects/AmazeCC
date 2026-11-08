"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { demoModeAtom, isLoggedInAtom, showIntroAtom } from "@/store";
import AppIntroExperience from "./AppIntroExperience";
import { useDashboardScreenHistory } from "../dashboard/useDashboardScreenHistory";
import type { IntroLogin } from "../onboarding/OnboardingIntro";

function WorkspaceLoading() {
  return <div className="min-h-screen bg-slate-50 dark:bg-background" role="status" aria-label="Opening your workspace" />;
}

const DashboardContent = dynamic(() => import("../Dashboard"), { loading: WorkspaceLoading });

interface AuthenticatedWorkspaceProps {
  handleLogOutRequest: () => void;
  handleReloadRequest: (semesterId?: string, modeId?: string) => Promise<void>;
  loginToVTOP: () => Promise<any>;
  handleLogin: (semesterId?: string, ids?: any) => Promise<any>;
  onOpenCommandPalette: () => void;
  onOpenShortcutsHelp: () => void;
  onRunSyncMode: (modeId: string) => void;
  /** First-run sign-in / sync / welcome screens that precede the onboarding steps. */
  intro?: {
    initialPhase: "login" | "welcome";
    login: IntroLogin;
  };
}

/** Owns the signed-in experience boundary and its dashboard history wiring. */
export default function AuthenticatedWorkspace(props: AuthenticatedWorkspaceProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const demoMode = useAtomValue(demoModeAtom);
  const showIntro = useAtomValue(showIntroAtom);
  const { goBack, collapseLastScreenChange } = useDashboardScreenHistory();

  // The intro hero owns sign-in, the first full sync and onboarding, so it is
  // shown whenever there is no session yet — not only on a literal first run
  // (`showIntro`). "Get Started" therefore lands straight on it.
  const runIntro = showIntro === true || (!isLoggedIn && !demoMode);

  // Once the hero has taken over it must not be yanked away mid-flight: the
  // first login flips `isLoggedIn`, which would otherwise swap the sync screen
  // for the dashboard. Only the hero's own completion hands control back.
  const [introActive, setIntroActive] = useState(false);
  useEffect(() => {
    if (runIntro) setIntroActive(true);
  }, [runIntro]);
  const showHero = runIntro || introActive;

  if (showHero) {
    return (
      <AppIntroExperience
        handleReloadRequest={props.handleReloadRequest}
        onOpenCommandPalette={props.onOpenCommandPalette}
        intro={props.intro}
        onFinished={() => setIntroActive(false)}
      />
    );
  }

  return (
    <>
      {demoMode && (
        <div
          role="status"
          className="w-full border-b border-line bg-accent-soft px-4 py-1.5 text-center text-[13px] text-accent"
        >
          Demo mode: this is sample data, not your VTOP account.
        </div>
      )}
      <DashboardContent
        demoMode={demoMode}
        handleLogOutRequest={props.handleLogOutRequest}
        handleReloadRequest={props.handleReloadRequest}
        loginToVTOP={props.loginToVTOP}
        handleLogin={props.handleLogin}
        onOpenCommandPalette={props.onOpenCommandPalette}
        onOpenShortcutsHelp={props.onOpenShortcutsHelp}
        onSystemBack={goBack}
        onCollapseScreenChange={collapseLastScreenChange}
        onRunSyncMode={props.onRunSyncMode}
      />
    </>
  );
}
