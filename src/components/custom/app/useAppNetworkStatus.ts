"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { api } from "@/lib/sync-engine";
import { isOfflineAtom, isAPIworkingAtom } from "@/store/uiAtoms";

/** Owns browser connectivity events and the app API's availability indicator. */
export function useAppNetworkStatus(isLoggedIn: boolean, demoMode: boolean) {
  const [isOffline, setIsOffline] = useAtom(isOfflineAtom);
  const [isAPIworking, setIsAPIworking] = useAtom(isAPIworkingAtom);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [setIsOffline]);

  useEffect(() => {
    if (!isLoggedIn && !demoMode) return;
    const checkAPIStatus = async () => {
      try {
        const data = (await api("status")) as any;
        setIsAPIworking(data.text !== "API is working");
      } catch {
        setIsAPIworking(true);
      }
    };
    void checkAPIStatus();
  }, [isLoggedIn, demoMode]);

  return { isOffline, isAPIworking, setIsAPIworking };
}
