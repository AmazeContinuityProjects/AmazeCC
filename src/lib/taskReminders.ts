import type { Task } from "@/types/tasks";
import type { Settings } from "@/store/settingsAtoms";

export interface ScheduledReminder {
  taskId: string;
  taskTitle: string;
  triggerTime: number; // epoch ms
  kind: "explicit_reminder" | "due_lead";
}

let activeTimeoutId: any = null;
let currentQueue: ScheduledReminder[] = [];

/**
 * App-wide subscribers. The scheduler itself is started once from Main, but
 * any mounted view (e.g. the Tasks hub banner) can listen for fires without
 * owning the timer.
 */
const subscribers = new Set<(reminder: ScheduledReminder) => void>();

export function subscribeReminders(
  fn: (reminder: ScheduledReminder) => void
): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Checks if a given timestamp falls within quiet hours (e.g. 22:00 to 07:00).
 */
export function isInQuietHours(
  timeMs: number,
  startStr = "22:00",
  endStr = "07:00"
): boolean {
  const d = new Date(timeMs);
  const currentMinutes = d.getHours() * 60 + d.getMinutes();

  const [sh, sm] = startStr.split(":").map(Number);
  const startMinutes = (sh || 0) * 60 + (sm || 0);

  const [eh, em] = endStr.split(":").map(Number);
  const endMinutes = (eh || 0) * 60 + (em || 0);

  if (startMinutes > endMinutes) {
    // Overnight window (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  // Normal window (e.g. 13:00 to 14:00)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Builds a chronological queue of future reminder triggers from tasks and settings.
 */
export function buildReminderQueue(
  tasks: Task[],
  settings?: Partial<Settings>,
  now = Date.now()
): ScheduledReminder[] {
  const queue: ScheduledReminder[] = [];
  const quietEnabled = settings?.pushQuietHoursEnabled ?? false;
  const quietStart = settings?.pushQuietHoursStart || "22:00";
  const quietEnd = settings?.pushQuietHoursEnd || "07:00";
  const defaultLeadMin = settings?.taskDefaultReminderMinutes ?? 30;

  tasks.forEach((task) => {
    if (task.status === "done") return;

    // 1. Explicit user-configured reminders
    (task.reminders || []).forEach((iso) => {
      const t = new Date(iso).getTime();
      if (!isNaN(t) && t > now) {
        if (!quietEnabled || !isInQuietHours(t, quietStart, quietEnd)) {
          queue.push({
            taskId: task.id,
            taskTitle: task.title,
            triggerTime: t,
            kind: "explicit_reminder",
          });
        }
      }
    });

    // 2. Automatic due lead reminder if no explicit reminders were set
    if ((!task.reminders || task.reminders.length === 0) && task.dueDate) {
      const dueTime = new Date(task.dueDate).getTime();
      if (!isNaN(dueTime)) {
        const leadTime = dueTime - defaultLeadMin * 60 * 1000;
        if (leadTime > now) {
          if (!quietEnabled || !isInQuietHours(leadTime, quietStart, quietEnd)) {
            queue.push({
              taskId: task.id,
              taskTitle: task.title,
              triggerTime: leadTime,
              kind: "due_lead",
            });
          }
        }
      }
    }
  });

  return queue.sort((a, b) => a.triggerTime - b.triggerTime);
}

/**
 * Arms the next reminder in queue via setTimeout.
 */
export function startReminderScheduler(
  tasks: Task[],
  settings?: Partial<Settings>,
  onNotify?: (reminder: ScheduledReminder) => void
) {
  if (typeof window === "undefined") return;

  if (activeTimeoutId) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }

  currentQueue = buildReminderQueue(tasks, settings);
  if (currentQueue.length === 0) return;

  const next = currentQueue[0];
  const delay = Math.max(0, next.triggerTime - Date.now());

  // Max setTimeout delay in browsers is 2147483647 ms (~24.8 days)
  const safeDelay = Math.min(delay, 2147483647);

  activeTimeoutId = setTimeout(() => {
    // Deliver notification
    deliverNotification(next, onNotify);
    // Pop head and arm remaining
    currentQueue.shift();
    if (currentQueue.length > 0) {
      startReminderScheduler(tasks, settings, onNotify);
    }
  }, safeDelay);
}

function deliverNotification(
  reminder: ScheduledReminder,
  onNotify?: (reminder: ScheduledReminder) => void
) {
  const title = `Task Reminder: ${reminder.taskTitle}`;
  const body =
    reminder.kind === "due_lead"
      ? "This task is due shortly."
      : "You set a reminder for this task.";

  // Browser Web Notification
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/icons/icon-192x192.png",
        });
      } catch {}
    }
  }

  // App callback (e.g. for toast)
  onNotify?.(reminder);
  subscribers.forEach((fn) => {
    try {
      fn(reminder);
    } catch {}
  });
}

export function stopReminderScheduler() {
  if (activeTimeoutId) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }
  currentQueue = [];
}
