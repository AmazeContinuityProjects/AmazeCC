"use client";

import { useCallback } from "react";
import { clearEventHubSession } from "@/lib/sync-engine";
import { defaultCredentials } from "@/store/authAtoms";
import { defaultSettings } from "@/store/settingsAtoms";

interface LogoutActionOptions {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  setIsLoggedIn: any;
  setIDs: any;
  setDemoMode: any;
  setAuthorizedID: any;
  setSettings: any;
  setAttendanceData: any;
  setMarksData: any;
  setGradesData: any;
  setScheduleData: any;
  setMessage: any;
  onSignedOut?: () => void;
}

/** Clears the signed-in session while preserving the user's theme and activity history. */
export function useLogoutAction({
  theme,
  setTheme,
  setIsLoggedIn,
  setIDs,
  setDemoMode,
  setAuthorizedID,
  setSettings,
  setAttendanceData,
  setMarksData,
  setGradesData,
  setScheduleData,
  setMessage,
  onSignedOut,
}: LogoutActionOptions) {
  return useCallback(() => {
    const savedTheme = localStorage.getItem("theme") || theme || "light";
    setIsLoggedIn(false);
    setIDs(defaultCredentials);
    setDemoMode(false);
    setAuthorizedID("");
    clearEventHubSession();

    const keysToKeep = ["activityTree", "theme"];
    const saved: Record<string, string | null> = {};
    keysToKeep.forEach(key => { saved[key] = localStorage.getItem(key); });
    saved.theme = saved.theme || savedTheme;

    localStorage.clear();
    keysToKeep.forEach(key => {
      if (saved[key] !== null) localStorage.setItem(key, saved[key]!);
    });

    localStorage.setItem("settings", JSON.stringify(defaultSettings));
    setTheme(savedTheme);
    setSettings(defaultSettings);
    setAttendanceData({});
    setMarksData({});
    setGradesData({});
    setScheduleData({});
    setMessage("");
    onSignedOut?.();
  }, [
    theme,
    setTheme,
    setIsLoggedIn,
    setIDs,
    setDemoMode,
    setAuthorizedID,
    setSettings,
    setAttendanceData,
    setMarksData,
    setGradesData,
    setScheduleData,
    setMessage,
    onSignedOut,
  ]);
}
