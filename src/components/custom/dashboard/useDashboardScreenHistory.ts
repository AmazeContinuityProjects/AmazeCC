"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { closeTopOverlayFromPop, hasOpenOverlays } from "@/lib/overlayStack";
import { readHistoryOp, writeHistoryEntry } from "@/lib/historyStack";
import { useDashboardNavigator } from "./DashboardNavigator";

/** Keeps browser history aligned with the navigator's selected screen. */
export function useDashboardScreenHistory() {
  const {
    activeTab,
    setActiveTab,
    activeAttendanceSubTab,
    setActiveAttendanceSubTab,
    activeSubTab,
    setActiveSubTab,
    hostelActiveSubTab,
    setHostelActiveSubTab,
    activeMoreSubTab,
    setActiveMoreSubTab,
    activeProfileSubTab,
    setActiveProfileSubTab,
    activeToolsSubTab,
    setActiveToolsSubTab,
    activeDayscholarSubTab,
    setActiveDayscholarSubTab,
  } = useDashboardNavigator();

  const screenKey = useMemo(() => {
    switch (activeTab) {
      case "attendance": return `attendance:${activeAttendanceSubTab}`;
      case "academics": return `academics:${activeSubTab}`;
      case "hostel": return `hostel:${hostelActiveSubTab}`;
      case "more": return `more:${activeMoreSubTab}`;
      case "profile": return `profile:${activeProfileSubTab}`;
      case "tools": return `tools:${activeToolsSubTab}`;
      case "transport": return `transport:${activeDayscholarSubTab}`;
      default: return activeTab;
    }
  }, [activeTab, activeAttendanceSubTab, activeSubTab, hostelActiveSubTab, activeMoreSubTab, activeProfileSubTab, activeToolsSubTab, activeDayscholarSubTab]);

  const restoreScreen = useCallback((key: string) => {
    const sep = key.indexOf(":");
    const tab = sep === -1 ? key : key.slice(0, sep);
    const sub = sep === -1 ? null : key.slice(sep + 1);
    setActiveTab(tab);
    if (sub === null) return;
    if (tab === "attendance") setActiveAttendanceSubTab(sub);
    else if (tab === "academics") setActiveSubTab(sub);
    else if (tab === "hostel") setHostelActiveSubTab(sub);
    else if (tab === "more") setActiveMoreSubTab(sub);
    else if (tab === "profile") setActiveProfileSubTab(sub);
    else if (tab === "tools") setActiveToolsSubTab(sub);
    else if (tab === "transport") setActiveDayscholarSubTab(sub);
  }, [setActiveTab, setActiveAttendanceSubTab, setActiveSubTab, setHostelActiveSubTab, setActiveMoreSubTab, setActiveProfileSubTab, setActiveToolsSubTab, setActiveDayscholarSubTab]);

  const screenStackRef = useRef<string[]>([]);
  const skipScreenPushRef = useRef(false);
  const restoreScreenRef = useRef(restoreScreen);
  restoreScreenRef.current = restoreScreen;
  const screenKeyRef = useRef(screenKey);
  screenKeyRef.current = screenKey;
  const collapseScreenPushRef = useRef(false);

  const writeScreenState = useCallback((method: "push" | "replace", key: string) => {
    writeHistoryEntry(method, { screen: key });
  }, []);

  useEffect(() => {
    if (!screenStackRef.current.length) {
      screenStackRef.current = [screenKey];
      writeScreenState("replace", screenKey);
      return;
    }
    if (skipScreenPushRef.current) { skipScreenPushRef.current = false; return; }
    const collapse = collapseScreenPushRef.current;
    collapseScreenPushRef.current = false;
    const stack = screenStackRef.current;
    if (stack[stack.length - 1] === screenKey) return;
    if (collapse) {
      stack[stack.length - 1] = screenKey;
      writeScreenState("replace", screenKey);
      return;
    }
    stack.push(screenKey);
    writeScreenState("push", screenKey);
  }, [screenKey, writeScreenState]);

  const collapseLastScreenChange = useCallback(() => {
    collapseScreenPushRef.current = true;
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { op?: unknown; screen?: unknown } | null;
      if (readHistoryOp(state)?.kind === "overlay" && closeTopOverlayFromPop()) return;
      if (closeTopOverlayFromPop()) {
        writeScreenState("push", screenKeyRef.current);
        return;
      }
      const landedScreen = state?.screen;
      if (typeof landedScreen !== "string") return;
      const stack = screenStackRef.current;
      if (stack.length >= 2 && stack[stack.length - 2] === landedScreen) stack.pop();
      else if (stack[stack.length - 1] !== landedScreen) stack.push(landedScreen);
      else return;
      skipScreenPushRef.current = true;
      restoreScreenRef.current(landedScreen);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [writeScreenState]);

  const goBack = useCallback(() => {
    if (hasOpenOverlays() || screenStackRef.current.length > 1) {
      try { window.history.back(); return; } catch {}
    }
    skipScreenPushRef.current = true;
    screenStackRef.current = ["home"];
    writeScreenState("replace", "home");
    restoreScreen("home");
  }, [restoreScreen, writeScreenState]);

  return { goBack, collapseLastScreenChange };
}
