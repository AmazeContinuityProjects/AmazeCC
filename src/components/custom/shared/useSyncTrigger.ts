"use client";

import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { isOfflineAtom } from "@/store/uiAtoms";
import { openOfflineSyncSession } from "@/lib/sync-engine/sync-session";

/**
 * Wraps a sync trigger so it degrades gracefully with no network: the click
 * opens the sync sheet as a connectivity notice instead of firing a request
 * that cannot succeed. Callers flip their own label/styling off `isOffline`.
 */
export function useSyncTrigger(onSync: () => void | Promise<void>) {
  const isOffline = useAtomValue(isOfflineAtom);

  const triggerSync = useCallback(() => {
    if (isOffline) {
      openOfflineSyncSession();
      return;
    }
    void onSync();
  }, [isOffline, onSync]);

  return { isOffline, triggerSync };
}
