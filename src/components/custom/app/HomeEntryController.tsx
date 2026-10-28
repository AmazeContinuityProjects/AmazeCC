"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import GuestExperience from "./GuestExperience";
import { hasStoredAppSession } from "./readBootstrapSnapshot";

type EntryIntent = "login" | "demo" | null;

/**
 * The signed-in runtime is the app's biggest chunk, so it is only fetched once
 * a guest actually asks for it ("Get Started" / "Try the demo") or a saved
 * session exists. Until it lands this is the whole visible surface.
 */
const OpeningScreen = () => (
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

export default function HomeEntryController() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [intent, setIntent] = useState<EntryIntent>(null);

  useEffect(() => {
    try {
      setHasSession(hasStoredAppSession());
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
      // Treat that as a guest visit and let the user choose a path.
      setHasSession(false);
    }
  }, []);

  // The check is one synchronous read, but it cannot run during SSR — showing
  // the branded opening screen rather than an empty frame keeps the hand-off
  // to the guest hero seamless.
  if (hasSession === null) return <OpeningScreen />;

  if (hasSession || intent) {
    return (
      <AuthenticatedRuntime
        initialIntent={intent ?? undefined}
        onSignedOut={() => {
          setHasSession(false);
          setIntent(null);
        }}
      />
    );
  }

  return (
    <GuestExperience
      onGetStarted={() => setIntent("login")}
      onTryDemo={() => setIntent("demo")}
    />
  );
}
