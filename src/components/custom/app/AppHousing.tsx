"use client";

import { useEffect, type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { credentialsAtom, demoModeAtom, isLoggedInAtom } from "@/store";
import { storage } from "@/lib/storage";
import { hasStoredVtopCredentials } from "@/components/custom/app/readBootstrapSnapshot";
import { syncCurrentUserPostHogIdentity } from "@/lib/posthog";
import { useSyncSessionBridge } from "@/components/custom/app/useSyncSessionBridge";
import SyncSessionHost from "@/components/custom/app/SyncSessionHost";

export interface AppHousingProps {
  children: ReactNode;
  route?: string;
  semester?: string;
  /**
   * Whether to mount the global SyncSessionHost. Defaults to true.
   * Set false if the caller renders its own custom-configured SyncSessionHost (e.g. Main.tsx).
   */
  mountSyncHost?: boolean;
}

/**
 * Shared App Housing:
 * Provides universal session hydration from storage, global sync-engine bridge,
 * PostHog identification, and mounts the unified Sync Engine bottom sheet.
 * Used across Main, Friend Finder, FFCS, and other standalone routes.
 */
export default function AppHousing({
  children,
  route,
  semester = "CH20262705",
  mountSyncHost = true,
}: AppHousingProps) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);
  const setDemoMode = useSetAtom(demoModeAtom);
  const setIDs = useSetAtom(credentialsAtom);

  // 1. Bridge sync engine progress events into atoms
  useSyncSessionBridge();

  // 2. Hydrate session cache from storage on mount
  useEffect(() => {
    try {
      const idsRaw = storage.ids.get();
      const storedUsername = storage.username.get();
      const storedPassword = storage.password.get();
      const isDemoStored = storage.demoMode.get();
      const hasVtop = hasStoredVtopCredentials(idsRaw, storedUsername, storedPassword);

      if (hasVtop || isDemoStored) {
        setIsLoggedIn(true);
        setDemoMode(Boolean(isDemoStored));
        setIDs({
          VtopUsername: storedUsername || "",
          VtopPassword: storedPassword || "",
          MoodleUsername: storage.moodleUsername.get() || "",
          MoodlePassword: storage.moodlePassword.get() || "",
          ...(idsRaw || {}),
        });
      }
    } catch {
      // Storage access guard
    }
  }, [setIsLoggedIn, setDemoMode, setIDs]);

  // 3. Keep PostHog registered whenever user is logged in
  useEffect(() => {
    if (isLoggedIn) {
      syncCurrentUserPostHogIdentity({
        route,
        semester,
      });
    }
  }, [isLoggedIn, route, semester]);

  return (
    <>
      {mountSyncHost && <SyncSessionHost />}
      {children}
    </>
  );
}
