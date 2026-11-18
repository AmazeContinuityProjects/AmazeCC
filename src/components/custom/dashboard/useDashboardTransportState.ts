"use client";

import { useCallback, useEffect, useState } from "react";
import { runPageSync } from "@/lib/sync-engine/single-sync";
import { useDashboardNavigator } from "./DashboardNavigator";
import { getTypedStorageItem } from "@/lib/storage";
import { useAtomValue } from "jotai";
import { unifiedCampusServicesAtom } from "@/store";
import type { BusRoute, TransportData } from "@/types";

/** Owns browser-cached transport data and the public bus-route refresh. */
export function useDashboardTransportState() {
  const { activeTab } = useDashboardNavigator();
  const unifiedCampus = useAtomValue(unifiedCampusServicesAtom);
  const [dayscholarBuses, setDayscholarBuses] = useState<BusRoute[]>(() => {
    const cachedBuses = getTypedStorageItem("cache_buses");
    if (Array.isArray(cachedBuses) && cachedBuses.length > 0) return cachedBuses;
    if (Array.isArray(unifiedCampus?.transport?.busRoutes) && unifiedCampus.transport.busRoutes.length > 0) {
      return unifiedCampus.transport.busRoutes;
    }
    return [];
  });
  const [transportData, setTransportData] = useState<TransportData | null>(() => {
    return getTypedStorageItem("transportData") ?? unifiedCampus?.transport?.userRegistration ?? null;
  });
  const [transportLoading, setTransportLoading] = useState(true);
  const [transportBuses, setTransportBuses] = useState<BusRoute[]>(() => {
    const cachedBuses = getTypedStorageItem("cache_buses");
    if (Array.isArray(cachedBuses) && cachedBuses.length > 0) return cachedBuses;
    if (Array.isArray(unifiedCampus?.transport?.busRoutes) && unifiedCampus.transport.busRoutes.length > 0) {
      return unifiedCampus.transport.busRoutes;
    }
    return [];
  });
  const [transportBusesLoading, setTransportBusesLoading] = useState(false);

  const loadTransportData = useCallback(() => {
    const cached = getTypedStorageItem("transportData");
    if (cached) {
      setTransportData(cached);
    } else if (unifiedCampus?.transport?.userRegistration) {
      setTransportData(unifiedCampus.transport.userRegistration);
    }
    setTransportLoading(false);
  }, [unifiedCampus?.transport?.userRegistration]);

  useEffect(() => {
    const cachedBuses = getTypedStorageItem("cache_buses");
    if (Array.isArray(cachedBuses)) {
      setDayscholarBuses(cachedBuses);
    } else if (Array.isArray(unifiedCampus?.transport?.busRoutes) && unifiedCampus.transport.busRoutes.length > 0) {
      setDayscholarBuses(unifiedCampus.transport.busRoutes);
    }
    loadTransportData();
  }, [loadTransportData, unifiedCampus?.transport?.busRoutes]);

  useEffect(() => {
    const cachedBuses = getTypedStorageItem("cache_buses");
    if (Array.isArray(cachedBuses)) {
      setTransportBuses(cachedBuses);
    } else if (Array.isArray(unifiedCampus?.transport?.busRoutes) && unifiedCampus.transport.busRoutes.length > 0) {
      setTransportBuses(unifiedCampus.transport.busRoutes);
    }
  }, [unifiedCampus?.transport?.busRoutes]);

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
