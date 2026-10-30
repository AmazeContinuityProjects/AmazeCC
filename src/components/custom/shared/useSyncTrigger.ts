"use client";

import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { isOfflineAtom, isAPIworkingAtom } from "@/store/uiAtoms";
import { openOfflineSyncSession } from "@/lib/sync-engine/sync-session";

/**
 * Wraps a sync trigger so it degrades gracefully with no network: the click
 * opens the sync sheet as a connectivity notice instead of firing a request
 * that cannot succeed. Callers flip their own label/styling off `isOffline`.
 * `isOffline` here means "no usable connection" — either the browser is
 * offline OR the VTOP API is unreachable, so the sync button reflects live
 * connectivity rather than only a failed sync.
 */
export function useSyncTrigger(onSync: () => void | Promise<void>) {
  const browserOffline = useAtomValue(isOfflineAtom);
  const apiDown = useAtomValue(isAPIworkingAtom);
  const isOffline = browserOffline || apiDown;

  const triggerSync = useCallback(() => {
    if (isOffline) {
      openOfflineSyncSession();
      return;
    }
    void onSync();
  }, [isOffline, onSync]);

  return { isOffline, triggerSync };
}
