/**
 * Canonical Time Utilities.
 *
 * Single source of truth for minutes-since-midnight arithmetic, clock formatting
 * (12h/24h), and relative time strings across AmazeCC.
 */

/**
 * Formats minutes since midnight into a human-readable 12-hour clock string (e.g. "8:00 AM", "12:30 PM").
 */
export function formatClock(minutes: number | null | undefined, fallback = "Time TBA"): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return fallback;
  }
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/**
 * Formats minutes since midnight into a 24-hour "HH:mm" string (e.g. "08:00", "14:30").
 */
export function formatMinutes24(minutes: number | null | undefined, fallback = "00:00"): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return fallback;
  }
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Parses any time string into minutes since midnight (0..1439).
 * Supports:
 * - "8:00 AM", "08:00PM", "12:30 pm"
 * - "08:00", "14:30"
 * - Raw numeric minutes
 */
export function parseTimeToMinutes(time: string | number | null | undefined): number | null {
  if (time === null || time === undefined) return null;
  if (typeof time === "number") {
    if (isNaN(time)) return null;
    return Math.max(0, Math.min(1439, Math.floor(time)));
  }

  const trimmed = time.trim();
  if (!trimmed) return null;

  // Match 12-hour: "8:00 AM", "08:30pm"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const isPm = match12[3].toLowerCase() === "pm";
    if (hours === 12) hours = 0;
    const total = (isPm ? hours + 12 : hours) * 60 + mins;
    return Math.max(0, Math.min(1439, total));
  }

  // Match 24-hour: "08:00", "14:30"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    const total = hours * 60 + mins;
    return Math.max(0, Math.min(1439, total));
  }

  return null;
}

/**
 * Formats a date, timestamp, or ISO string into a concise relative time string.
 * ("just now", "5m ago", "2h ago", "yesterday", "3d ago").
 */
export function formatRelativeTime(dateOrMs: Date | number | string | null | undefined, nowMs = Date.now()): string {
  if (!dateOrMs) return "never";

  const target =
    typeof dateOrMs === "number"
      ? dateOrMs
      : dateOrMs instanceof Date
        ? dateOrMs.getTime()
        : new Date(dateOrMs).getTime();

  if (isNaN(target)) return "never";

  const diffSec = Math.max(0, Math.floor((nowMs - target) / 1000));
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}
