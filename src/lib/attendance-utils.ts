/**
 * Attendance utility functions for attendance calculations, status thresholds, and projections.
 */

export function calculateAttendancePercentage(attended: number, total: number, decimals: boolean = false): number {
  if (!total || total <= 0) return 0;
  const raw = (attended / total) * 100;
  return decimals ? Math.round(raw * 10) / 10 : Math.round(raw);
}

export function formatAttendanceDisplay(
  attended: number,
  total: number,
  mode: "percentage" | "str" = "percentage",
  decimals: boolean = false
): string {
  if (mode === "str") {
    return `${attended}/${total}`;
  }
  const pct = calculateAttendancePercentage(attended, total, decimals);
  return `${pct}%`;
}

export function calculateClassesToAttend(
  attended: number,
  total: number,
  targetPercentage: number = 75
): number {
  if (total <= 0) return 0;
  const currentPct = (attended / total) * 100;
  if (currentPct >= targetPercentage) return 0;

  // target = (attended + x) / (total + x) * 100
  // target * total + target * x = 100 * attended + 100 * x
  // x * (100 - target) = target * total - 100 * attended
  const needed = Math.ceil((targetPercentage * total - 100 * attended) / (100 - targetPercentage));
  return Math.max(0, needed);
}

export function calculateBunkMargin(
  attended: number,
  total: number,
  minimumPercentage: number = 75
): number {
  if (total <= 0) return 0;
  const currentPct = (attended / total) * 100;
  if (currentPct < minimumPercentage) return 0;

  // min = attended / (total + y) * 100
  // min * total + min * y = 100 * attended
  // y = (100 * attended - min * total) / min
  const canBunk = Math.floor((100 * attended - minimumPercentage * total) / minimumPercentage);
  return Math.max(0, canBunk);
}

export type AttendanceLevel = "low" | "medium" | "high";

export function getAttendanceLevel(percentage: number): AttendanceLevel {
  if (percentage < 75) return "low";
  if (percentage < 85) return "medium";
  return "high";
}

export function getAttendanceStatus(
  percentage: number,
  isDayscholarWithBus: boolean = false
): "critical" | "warning" | "safe" {
  const minThreshold = isDayscholarWithBus ? 85 : 75;
  const warnThreshold = isDayscholarWithBus ? 90 : 85;

  if (percentage < minThreshold) return "critical";
  if (percentage < warnThreshold) return "warning";
  return "safe";
}

export function getAttendanceColorClass(
  percentage: number,
  isDayscholarWithBus: boolean = false
): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  const status = getAttendanceStatus(percentage, isDayscholarWithBus);
  switch (status) {
    case "critical":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-500/10 dark:bg-red-500/20",
        border: "border-red-500/30",
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      };
    case "warning":
      return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10 dark:bg-amber-500/20",
        border: "border-amber-500/30",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      };
    case "safe":
    default:
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        border: "border-emerald-500/30",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
  }
}
