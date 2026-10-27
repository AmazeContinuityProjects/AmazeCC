"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import GuestExperience from "./GuestExperience";
import { hasStoredAppSession } from "./readBootstrapSnapshot";

type EntryIntent = "login" | "demo" | null;

const AuthenticatedRuntime = dynamic(() => import("../Main"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-[#03060f] dark:text-slate-300" role="status" aria-label="Opening your workspace">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span>Opening your workspace…</span>
    </div>
  ),
});

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

  if (hasSession === null) {
    return <div className="min-h-screen bg-slate-50 dark:bg-black" aria-busy="true" />;
  }

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
      onSignIn={() => setIntent("login")}
      onTryDemo={() => setIntent("demo")}
    />
  );
}
