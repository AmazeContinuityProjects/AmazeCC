"use client";

import { useCallback } from "react";
import { useSetAtom } from "jotai";
import posthog from "posthog-js";
import { syncEngine } from "@/lib/sync-engine";
import { forgetStoredCredentials, SIGNED_OUT_EVENT } from "@/lib/forgetDevice";
import { authorizedIDAtom, credentialsAtom, defaultCredentials, demoModeAtom, isLoggedInAtom } from "@/store/authAtoms";

/**
 * Sign out and forget every stored login on this device, but keep the
 * student's own local data (tasks, FFCS plans, friends, settings, cached
 * timetable). Compare `useLogoutAction`, which clears all of it.
 */
export function useForgetCredentialsAction(onSignedOut?: () => void) {
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);
  const setIDs = useSetAtom(credentialsAtom);
  const setDemoMode = useSetAtom(demoModeAtom);
  const setAuthorizedID = useSetAtom(authorizedIDAtom);

  return useCallback(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      posthog.reset();
    }
    // Drops the in-memory VTOP and EventHub sessions too, so nothing signed in
    // survives until the next reload.
    syncEngine.logout();
    forgetStoredCredentials();
    setIDs(defaultCredentials);
    setDemoMode(false);
    setAuthorizedID("");
    setIsLoggedIn(false);
    if (onSignedOut) onSignedOut();
    else if (typeof window !== "undefined") window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }, [setIsLoggedIn, setIDs, setDemoMode, setAuthorizedID, onSignedOut]);
}
