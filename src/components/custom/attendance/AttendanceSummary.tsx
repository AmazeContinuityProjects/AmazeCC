"use client";

import { useMemo } from "react";
import CircularProgress from "../shared/CircularProgress";
import { AlertTriangle, ShieldCheck, TriangleAlert } from "lucide-react";

function getTargetAttendancePct(): number {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetAttendance) return Number(parsed.targetAttendance);
      }
    } catch (e) {}
  }
  return 75;
}

interface AttendanceSummaryProps {
  attendance: any[];
  simulatedSkips: Record<string, number>;
  isDayscholarWithBus: boolean;
  onOpenPredictor: () => void;
}

export default function AttendanceSummary({
  attendance,
  simulatedSkips,
  isDayscholarWithBus,
  onOpenPredictor,
}: AttendanceSummaryProps) {
  const stats = useMemo(() => {
    const thresholdPct = getTargetAttendancePct();
    const warnPct = isDayscholarWithBus ? 90 : 85;

    let totalAttended = 0;
    let totalClasses = 0;
    let safe = 0;
    let warn = 0;
    let crit = 0;
    const criticalCourses: string[] = [];

    (attendance || []).forEach((c) => {
      const skips = simulatedSkips[c.courseCode] || 0;
      const isLab = c.courseCode.endsWith("(L)");
      const CLASS_WEIGHT = isLab ? 2 : 1;
      const attended = parseInt(c.attendedClasses);
      const total = parseInt(c.totalClasses) + skips;

      if (c.slotName === "NILL" || total <= 0) return;

      totalAttended += attended * CLASS_WEIGHT;
      totalClasses += total * CLASS_WEIGHT;

      const pct = (attended / total) * 100;
      if (pct < thresholdPct) {
        crit += 1;
        criticalCourses.push(c.courseCode);
      } else if (pct < warnPct) {
        warn += 1;
      } else {
        safe += 1;
      }
    });

    const aggPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
    const needsAttention = crit + warn;

    return { thresholdPct, warnPct, totalAttended, totalClasses, aggPct, safe, warn, crit, criticalCourses, needsAttention };
  }, [attendance, simulatedSkips, isDayscholarWithBus]);

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 border text-xs font-extrabold uppercase tracking-wider";

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-white dark:bg-black shadow-sm p-5 animate-in fade-in duration-500 motion-reduce:animate-none">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left: ring + headline */}
        <div className="flex items-center gap-4">
          <CircularProgress
            value={stats.aggPct}
            text={`${stats.aggPct}%`}
            size={84}
            strokeWidth={8}
            threshold={stats.thresholdPct}
            midThreshold={stats.warnPct}
          />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              Overall attendance
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
              {stats.totalAttended}
              <span className="text-gray-400 dark:text-gray-600 font-bold">/{stats.totalClasses}</span>
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">classes attended (weighted)</p>
          </div>
        </div>

        {/* Right: chips + CTA */}
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-2">
            <span className={`${chipBase} text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {stats.safe} Safe
            </span>
            <span className={`${chipBase} text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20`}>
              <TriangleAlert className="w-3.5 h-3.5" /> {stats.warn} Warning
            </span>
            <span className={`${chipBase} text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20`}>
              <AlertTriangle className="w-3.5 h-3.5" /> {stats.crit} Critical
            </span>
          </div>

          {stats.needsAttention > 0 && (
            <button
              onClick={onOpenPredictor}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm transition-colors cursor-pointer bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {stats.needsAttention} course{stats.needsAttention > 1 ? "s" : ""} need attention
            </button>
          )}

          {stats.criticalCourses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              {stats.criticalCourses.map((code) => (
                <span
                  key={code}
                  className="rounded-md bg-red-500/10 dark:bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-500 dark:text-red-400 border border-red-500/20"
                >
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
