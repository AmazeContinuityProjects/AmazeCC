"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import GuestExperience from "./GuestExperience";
import { hasStoredAppSession } from "./readBootstrapSnapshot";
import { SIGN_IN_PARAM } from "@/lib/signInReturn";

type EntryIntent = "login" | "demo" | null;

/**
 * The signed-in runtime is the app's biggest chunk, so it is only fetched once
 * a guest actually asks for it ("Get Started" / "Try the demo") or a saved
 * session exists. Until it lands this is the fallback surface.
 */
export const OpeningScreen = () => (
  <div
    className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-600 dark:bg-[#03060f] dark:text-slate-300"
    role="status"
    aria-label="Opening your workspace"
  >
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
    <span className="text-sm font-semibold">Opening your workspace…</span>
  </div>
);

const AuthenticatedRuntime = dynamic(() => import("../Main"), { loading: OpeningScreen });

function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredSessionSnapshot(): boolean {
  try {
    return hasStoredAppSession();
  } catch {
    return false;
  }
}

/**
 * Server snapshot defaults to false so static generation (SSG) and SSR
 * prerender the GuestExperience directly. First-time guests receive the full
 * hero instantly over the wire with 0ms JS delay and 0 layout shift.
 */
function getServerSnapshot(): boolean {
  return false;
}

export default function HomeEntryController() {
  const storedSession = useSyncExternalStore(subscribeToStorage, getStoredSessionSnapshot, getServerSnapshot);

  const [intent, setIntent] = useState<EntryIntent>(null);
  const [explicitSignedOut, setExplicitSignedOut] = useState(false);

  // When a guest visits, storedSession is false immediately on client mount.
  // The moment the controller recognizes no login key in storage, it renders GuestExperience.
  const hasActiveSession = !explicitSignedOut && storedSession;

  const handleSignedOut = useCallback(() => {
    try {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("has-stored-session");
      }
    } catch {}
    setExplicitSignedOut(true);
    setIntent(null);
  }, []);

  const handleGetStarted = useCallback(() => {
    setExplicitSignedOut(false);
    setIntent("login");
  }, []);

  // `/?signin=1` (sent by pages like the FFCS planner) starts the "login"
  // entry, as if "Get Started" had been pressed: a guest gets the login form,
  // and a student whose saved credentials stopped working gets the credential
  // editor (see Main). Read after mount so the static guest page still
  // prerenders, then dropped from the address bar so a refresh does not
  // reopen it.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(SIGN_IN_PARAM)) return;
      url.searchParams.delete(SIGN_IN_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      handleGetStarted();
    } catch {}
  }, [handleGetStarted]);

  const handleTryDemo = useCallback(() => {
    setExplicitSignedOut(false);
    setIntent("demo");
  }, []);

  // When an active session is detected or the user initiated an entry flow, load the authenticated workspace.
  if (hasActiveSession || intent) {
    return <AuthenticatedRuntime initialIntent={intent ?? undefined} onSignedOut={handleSignedOut} />;
  }

  // Guest experience: rendered statically on server and hydrated immediately without spinner flash.
  return (
    <>
      <div
        className="opening-screen-fallback hidden min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-600 dark:bg-[#03060f] dark:text-slate-300"
        role="status"
        aria-label="Opening your workspace"
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
        <span className="text-sm font-semibold">Opening your workspace…</span>
      </div>
      <div className="guest-experience-root flex min-h-screen flex-col">
        <GuestExperience onGetStarted={handleGetStarted} onTryDemo={handleTryDemo} />
      </div>
    </>
  );
}
