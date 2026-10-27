"use client";

import dynamic from "next/dynamic";
import { useAtomValue } from "jotai";
import { demoModeAtom, isLoggedInAtom, showIntroAtom } from "@/store";
import AppIntroExperience from "./AppIntroExperience";
import { useDashboardScreenHistory } from "../dashboard/useDashboardScreenHistory";

function WorkspaceLoading() {
  return <div className="min-h-screen bg-slate-50 dark:bg-black" role="status" aria-label="Opening your workspace" />;
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
}

/** Owns the signed-in experience boundary and its dashboard history wiring. */
export default function AuthenticatedWorkspace(props: AuthenticatedWorkspaceProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const demoMode = useAtomValue(demoModeAtom);
  const showIntro = useAtomValue(showIntroAtom);
  const { goBack, collapseLastScreenChange } = useDashboardScreenHistory();

  if (!isLoggedIn && !demoMode) return null;

  return showIntro === true ? (
    <AppIntroExperience
      handleReloadRequest={props.handleReloadRequest}
      onOpenCommandPalette={props.onOpenCommandPalette}
    />
  ) : (
    <>
      {demoMode && (
        <div className="top-0 left-0 w-full bg-blue-500 text-white text-center py-2 font-medium">
          ℹ️ You are in Demo Mode. Data shown is for demonstration purposes only.
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
