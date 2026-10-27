"use client";

import { useEffect } from "react";
import { useDashboardNavigator } from "../dashboard/DashboardNavigator";

export function useGlobalShortcuts({ theme, setTheme, settings, setSettings, setCommandPaletteOpen, setIsShortcutsHelpOpen }: any) {
  const {
    setActiveTab,
    setActiveSubTab,
    setActiveAttendanceSubTab,
    setActiveProfileSubTab,
  } = useDashboardNavigator();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Toggle search palette (Ctrl/Cmd + K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Toggle shortcuts help sheet (Shift + ? or just ?)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setIsShortcutsHelpOpen(false);
      }

      // Ignore shortcuts if typing inside inputs/textareas
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      // We only listen for Alt (Option) key combinations for global actions
      if (e.altKey) {
        const key = e.key.toLowerCase();
        
        // Navigation Shortcuts
        if (key === "h") {
          e.preventDefault();
          setActiveTab("home");
        } else if (key === "a") {
          e.preventDefault();
          setActiveTab("attendance");
        } else if (key === "e") {
          e.preventDefault();
          setActiveTab("events");
        } else if (key === "l") {
          e.preventDefault();
          setActiveTab("libraries");
        } else if (key === "g") {
          e.preventDefault();
          setActiveTab("academics");
          setActiveSubTab("grades");
        } else if (key === "s") {
          e.preventDefault();
          setActiveTab("profile");
          setActiveProfileSubTab("settings");
        } 
        
        // Modal & Action Shortcuts
        else if (key === "o") {
          e.preventDefault();
          setActiveTab("attendance");
          setActiveAttendanceSubTab("od");
        } else if (key === "b") {
          e.preventDefault();
          setSettings(prev => {
            const nextVal = !prev.CGPAHidden;
            localStorage.setItem("settings", JSON.stringify({ ...prev, CGPAHidden: nextVal }));
            return { ...prev, CGPAHidden: nextVal };
          });
        } else if (key === "t") {
          e.preventDefault();
          setTheme(theme === "dark" ? "light" : "dark");

        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [theme, setTheme, settings, setSettings, setActiveTab, setActiveSubTab, setActiveAttendanceSubTab, setActiveProfileSubTab]);
}
