"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/sync-engine";
import { getTypedStorageItem } from "@/lib/storage";

interface DashboardWelcomeStateOptions {
  demoMode: boolean;
  interfaceChosen?: boolean;
}

export function useDashboardWelcomeState({ demoMode, interfaceChosen }: DashboardWelcomeStateOptions) {
  const [showFresherWelcome, setShowFresherWelcome] = useState(false);
  const [fresherEptData, setFresherEptData] = useState<any>(null);
  const [fresherAckData, setFresherAckData] = useState<any>(null);
  const [fresherResources, setFresherResources] = useState<any[]>([]);
  const [showInterfaceOnboarding, setShowInterfaceOnboarding] = useState(false);

  useEffect(() => {
    try {
      const hasChosen = getTypedStorageItem("has_selected_interface") === "true" || interfaceChosen === true;
      if (!hasChosen) setShowInterfaceOnboarding(true);
    } catch {}
  }, [interfaceChosen]);

  useEffect(() => {
    const handleOpen = () => setShowInterfaceOnboarding(true);
    window.addEventListener("open-interface-selector", handleOpen);
    return () => window.removeEventListener("open-interface-selector", handleOpen);
  }, []);

  useEffect(() => {
    if (demoMode) {
      setShowFresherWelcome(true);
      return;
    }

    try {
      const dismissed = getTypedStorageItem("fresherWelcomeDismissed");
      let eptData: any = null;
      let ackData: any = null;
      let hasFresherData = false;

      const w = getTypedStorageItem("cache_whoami") as any;
      if (w) {
        eptData = w?.eptSchedule ?? null;
        ackData = w?.acknowledgement ?? null;
      }

      // Backward compat with old caches
      if (!eptData) {
        eptData = getTypedStorageItem("cache_ept_schedule") as any;
      }
      if (!ackData) {
        ackData = getTypedStorageItem("cache_acknowledgement") as any;
      }

      if (eptData) {
        setFresherEptData(eptData);
        if (eptData.tables?.[0]?.rows?.length > 0 || eptData.message) hasFresherData = true;
      }
      if (ackData) {
        setFresherAckData(ackData);
        if (Array.isArray(ackData.documents) ? ackData.documents.length > 0 : ackData.tables?.[1]?.rows?.length > 0) {
          hasFresherData = true;
        }
      }

      if (hasFresherData && dismissed !== "true") setShowFresherWelcome(true);
    } catch (error) {
      console.error("Failed to load fresher data from typed storage", error);
    }
  }, [demoMode]);

  useEffect(() => {
    api("fresher-resources")
      .then((data: any) => {
        if (data?.success && data.resources) setFresherResources(data.resources);
      })
      .catch(() => {});
  }, []);

  return {
    showFresherWelcome,
    setShowFresherWelcome,
    fresherEptData,
    fresherAckData,
    fresherResources,
    showInterfaceOnboarding,
    setShowInterfaceOnboarding,
  };
}
