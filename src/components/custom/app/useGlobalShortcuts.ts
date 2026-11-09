"use client";

import { useEffect, useRef } from "react";
import { useDashboardNavigator } from "../dashboard/DashboardNavigator";
import { createSequenceTracker, isTypingTarget, letterOf, NAV_SHORTCUTS, type NavTarget } from "@/lib/shortcuts";

export function useGlobalShortcuts({
  theme,
  setTheme,
  settings,
  setSettings,
  setCommandPaletteOpen,
  setIsShortcutsHelpOpen,
}: any) {
  const { setActiveTab, setActiveSubTab, setActiveAttendanceSubTab, setActiveProfileSubTab } = useDashboardNavigator();
  const sequence = useRef(createSequenceTracker());

  useEffect(() => {
    const go = (target: NavTarget) => {
      setActiveTab(target.tab);
      if ("academicsSub" in target) setActiveSubTab(target.academicsSub);
      if ("attendanceSub" in target) setActiveAttendanceSubTab(target.attendanceSub);
      if ("profileSub" in target) setActiveProfileSubTab(target.profileSub);
    };

    const handler = (e: KeyboardEvent) => {
      // Toggle search palette (Ctrl/Cmd + K)
      if ((e.metaKey || e.ctrlKey) && letterOf(e) === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setIsShortcutsHelpOpen(false);
        sequence.current.reset();
        return;
      }

      // Never steal keys from a field the user is typing in.
      if (isTypingTarget(document.activeElement)) return;

      // Shortcuts help sheet (? / Shift + /)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }

      // "/" opens the command palette, as in most search-first apps.
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      const letter = letterOf(e);

      // Alt/Option + letter: the original set, plus two actions.
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const nav = NAV_SHORTCUTS.find((s) => s.alt && s.key === letter);
        if (nav) {
          e.preventDefault();
          go(nav.target);
        } else if (letter === "b") {
          e.preventDefault();
          setSettings((prev) => ({ ...prev, CGPAHidden: !prev.CGPAHidden }));
        } else if (letter === "t") {
          e.preventDefault();
          setTheme(theme === "dark" ? "light" : "dark");
        }
        return;
      }

      // "g" then a letter.
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && /^[a-z]$/.test(letter)) {
        const hit = sequence.current.feed(letter);
        if (hit === "pending") return;
        if (hit) {
          e.preventDefault();
          go(hit.target);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    theme,
    setTheme,
    settings,
    setSettings,
    setCommandPaletteOpen,
    setIsShortcutsHelpOpen,
    setActiveTab,
    setActiveSubTab,
    setActiveAttendanceSubTab,
    setActiveProfileSubTab,
  ]);
}
