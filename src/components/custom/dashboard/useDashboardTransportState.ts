"use client";

import { useCallback, useEffect, useState } from "react";
import { runPageSync } from "@/lib/sync-engine/single-sync";
import { useDashboardNavigator } from "./DashboardNavigator";

/** Owns browser-cached transport data and the public bus-route refresh. */
export function useDashboardTransportState() {
  const { activeTab } = useDashboardNavigator();
  const [dayscholarBuses, setDayscholarBuses] = useState<any[]>([]);
  const [transportData, setTransportData] = useState<any>(null);
  const [transportLoading, setTransportLoading] = useState(true);
  const [transportBuses, setTransportBuses] = useState<any[]>([]);
  const [transportBusesLoading, setTransportBusesLoading] = useState(false);

  const loadTransportData = useCallback(() => {
    const cached = localStorage.getItem("transportData");
    if (cached) {
      try {
        setTransportData(JSON.parse(cached));
      } catch {
        localStorage.removeItem("transportData");
      }
    }
    setTransportLoading(false);
  }, []);

  useEffect(() => {
    const cachedBuses = localStorage.getItem("cache_buses");
    if (cachedBuses) {
      try { setDayscholarBuses(JSON.parse(cachedBuses)); } catch {}
    }
    loadTransportData();
  }, [loadTransportData]);

  useEffect(() => {
    const cachedBuses = localStorage.getItem("cache_buses");
    if (cachedBuses) {
      try { setTransportBuses(JSON.parse(cachedBuses)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (activeTab === "transport") loadTransportData();
  }, [activeTab, loadTransportData]);

  const refreshTransportBuses = useCallback(async () => {
    setTransportBusesLoading(true);
    try {
      const buses = await runPageSync<any[]>({
        title: "Bus Routes",
        steps: [{ op: "buses" }],
        doneLine: "Bus routes fetched",
      });
      if (Array.isArray(buses) && buses.length > 0) {
        setTransportBuses(buses);
        setDayscholarBuses(buses);
      }
    } catch (error) {
      console.error("Failed to fetch transport buses:", error);
    } finally {
      setTransportBusesLoading(false);
    }
  }, []);

  return {
    dayscholarBuses,
    transportBuses,
    transportData,
    transportLoading,
    transportBusesLoading,
    refreshTransportBuses,
  };
}
