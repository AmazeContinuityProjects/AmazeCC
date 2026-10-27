"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type SetStateAction } from "react";
import { useAtom } from "jotai";
import {
  activeAttendanceSubTabAtom,
  activeDayAtom,
  activeDayscholarSubTabAtom,
  activeMoreSubTabAtom,
  activeProfileSubTabAtom,
  activeSubTabAtom,
  activeTabAtom,
  activeToolsSubTabAtom,
  hostelActiveSubTabAtom,
} from "@/store/uiAtoms";
import { settingsAtom } from "@/store/settingsAtoms";

type NavigatorValue = {
  courseDashboardTarget: CourseDashboardTarget;
  setCourseDashboardTarget: (update: SetStateAction<CourseDashboardTarget>) => void;
  activePageResetKey: number;
  selectTab: (tab: string) => void;
  activeTab: string;
  setActiveTab: (update: SetStateAction<string>) => void;
  activeSubTab: string;
  setActiveSubTab: (update: SetStateAction<string>) => void;
  activeAttendanceSubTab: string;
  setActiveAttendanceSubTab: (update: SetStateAction<string>) => void;
  activeToolsSubTab: string;
  setActiveToolsSubTab: (update: SetStateAction<string>) => void;
  activeDayscholarSubTab: string;
  setActiveDayscholarSubTab: (update: SetStateAction<string>) => void;
  activeMoreSubTab: string;
  setActiveMoreSubTab: (update: SetStateAction<string>) => void;
  activeProfileSubTab: string;
  setActiveProfileSubTab: (update: SetStateAction<string>) => void;
  hostelActiveSubTab: string;
  setHostelActiveSubTab: (update: SetStateAction<string>) => void;
  activeDay: string;
  setActiveDay: (update: SetStateAction<string>) => void;
};

export type CourseDashboardTarget = { courseCode: string; targetTab?: string } | null;

const DashboardNavigatorContext = createContext<NavigatorValue | null>(null);

/** Owns the app's selected dashboard route and normalizes legacy route ids. */
export function DashboardNavigatorProvider({ children }: { children: ReactNode }) {
  const [courseDashboardTarget, setCourseDashboardTarget] = useState<CourseDashboardTarget>(null);
  const [activePageResetKey, setActivePageResetKey] = useState(0);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [activeSubTab, setActiveSubTab] = useAtom(activeSubTabAtom);
  const [activeAttendanceSubTab, setActiveAttendanceSubTab] = useAtom(activeAttendanceSubTabAtom);
  const [activeToolsSubTab, setActiveToolsSubTab] = useAtom(activeToolsSubTabAtom);
  const [activeDayscholarSubTab, setActiveDayscholarSubTab] = useAtom(activeDayscholarSubTabAtom);
  const [activeMoreSubTab, setActiveMoreSubTab] = useAtom(activeMoreSubTabAtom);
  const [activeProfileSubTab, setActiveProfileSubTab] = useAtom(activeProfileSubTabAtom);
  const [hostelActiveSubTab, setHostelActiveSubTab] = useAtom(hostelActiveSubTabAtom);
  const [activeDay, setActiveDay] = useAtom(activeDayAtom);
  const [settings] = useAtom(settingsAtom);

  const selectTab = useCallback((tab: string) => {
    if (tab === activeTab) setActivePageResetKey(key => key + 1);
    setActiveTab(tab);
  }, [activeTab, setActiveTab]);

  useEffect(() => {
    if (settings.defaultLandingTab === "attendance") {
      setActiveTab("attendance");
      setActiveAttendanceSubTab("attendance");
    }
  }, [settings.defaultLandingTab, setActiveAttendanceSubTab, setActiveTab]);

  useEffect(() => {
    const academicsHome = "courses-simplified";
    const academicsScreens = new Set([
      academicsHome,
      "simplified-academics",
      "overview",
      "course-dashboard",
      "grades",
      "curriculum",
      "cgpa-predictor",
      "schedule",
      "marks-predictor",
    ]);

    if (activeTab === "academics" && !academicsScreens.has(activeSubTab)) {
      setActiveSubTab(academicsHome);
    }
    if (activeTab === "more" && activeMoreSubTab === "qbank") {
      setActiveTab("tools");
      setActiveToolsSubTab("qbank");
    }
    if (activeTab === "hostel" && hostelActiveSubTab === "payment") {
      setActiveTab("payments");
    }
    if (activeTab === "profile" && activeProfileSubTab === "preferences") {
      setActiveProfileSubTab("settings");
    }
  }, [
    activeTab,
    activeSubTab,
    activeMoreSubTab,
    hostelActiveSubTab,
    activeProfileSubTab,
    setActiveSubTab,
    setActiveTab,
    setActiveToolsSubTab,
    setActiveProfileSubTab,
  ]);

  const value = useMemo(() => ({
    courseDashboardTarget,
    setCourseDashboardTarget,
    activePageResetKey,
    selectTab,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    activeAttendanceSubTab,
    setActiveAttendanceSubTab,
    activeToolsSubTab,
    setActiveToolsSubTab,
    activeDayscholarSubTab,
    setActiveDayscholarSubTab,
    activeMoreSubTab,
    setActiveMoreSubTab,
    activeProfileSubTab,
    setActiveProfileSubTab,
    hostelActiveSubTab,
    setHostelActiveSubTab,
    activeDay,
    setActiveDay,
  }), [
    courseDashboardTarget,
    setCourseDashboardTarget,
    activePageResetKey,
    selectTab,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    activeAttendanceSubTab,
    setActiveAttendanceSubTab,
    activeToolsSubTab,
    setActiveToolsSubTab,
    activeDayscholarSubTab,
    setActiveDayscholarSubTab,
    activeMoreSubTab,
    setActiveMoreSubTab,
    activeProfileSubTab,
    setActiveProfileSubTab,
    hostelActiveSubTab,
    setHostelActiveSubTab,
    activeDay,
    setActiveDay,
  ]);

  return <DashboardNavigatorContext.Provider value={value}>{children}</DashboardNavigatorContext.Provider>;
}

export function useDashboardNavigator(): NavigatorValue {
  const navigator = useContext(DashboardNavigatorContext);
  if (!navigator) throw new Error("useDashboardNavigator must be used inside DashboardNavigatorProvider");
  return navigator;
}

/** Mounts only the page selected by the navigator. */
export function DashboardRoute({ route, enabled = true, children }: { route: string; enabled?: boolean; children: ReactNode }) {
  const { activeTab } = useDashboardNavigator();
  return enabled && activeTab === route ? <>{children}</> : null;
}
