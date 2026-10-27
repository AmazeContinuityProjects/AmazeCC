"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/sync-engine";

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
      const hasChosen = localStorage.getItem("has_selected_interface") === "true" || interfaceChosen === true;
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
      const ept = localStorage.getItem("cache_ept_schedule");
      const ack = localStorage.getItem("cache_acknowledgement");
      const dismissed = localStorage.getItem("fresherWelcomeDismissed");
      let hasFresherData = false;

      if (ept) {
        const parsedEpt = JSON.parse(ept);
        setFresherEptData(parsedEpt);
        if (parsedEpt.tables?.[0]?.rows?.length > 0) hasFresherData = true;
      }
      if (ack) {
        const parsedAck = JSON.parse(ack);
        setFresherAckData(parsedAck);
        if (parsedAck.tables?.[1]?.rows?.length > 0) hasFresherData = true;
      }

      if (hasFresherData && dismissed !== "true") setShowFresherWelcome(true);
    } catch (error) {
      console.error("Failed to load fresher data from localStorage", error);
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
