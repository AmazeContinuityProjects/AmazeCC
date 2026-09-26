"use client";

import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tasksAtom } from "@/store/dataAtoms";
import { settingsAtom } from "@/store/settingsAtoms";
import { messageAtom } from "@/store/uiAtoms";
import {
  startReminderScheduler,
  stopReminderScheduler,
  type ScheduledReminder,
} from "@/lib/taskReminders";

/**
 * Owns the foreground reminder scheduler for the whole app session.
 * Mounted once from Main so reminders keep firing while the user is on any
 * tab, not just the Tasks hub.
 */
export function useTaskReminderScheduler() {
  const tasks = useAtomValue(tasksAtom);
  const settings = useAtomValue(settingsAtom);
  const setMessage = useSetAtom(messageAtom);

  const notify = useCallback(
    (reminder: ScheduledReminder) => {
      setMessage(
        `⏰ ${reminder.taskTitle} — ${
          reminder.kind === "due_lead" ? "due soon" : "reminder"
        }`
      );
    },
    [setMessage]
  );

  useEffect(() => {
    // Ask once; if denied, the in-app banner is the only delivery channel
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {}
    }

    startReminderScheduler(tasks, settings, notify);

    // Re-arm after the tab sleeps so long-idle timers still fire on resume
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startReminderScheduler(tasks, settings, notify);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopReminderScheduler();
    };
  }, [tasks, settings, notify]);
}
