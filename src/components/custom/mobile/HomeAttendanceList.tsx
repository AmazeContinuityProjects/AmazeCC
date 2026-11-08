"use client";

import { useMemo } from "react";
import { attendanceBudget, CourseDot } from "@amazecontinuityprojects/amazeui";
import { cn } from "@/lib/utils";

interface AttendanceCourse {
  courseCode?: string;
  courseTitle?: string;
  slotName?: string;
  attendedClasses?: string | number;
  totalClasses?: string | number;
}

interface Props {
  courses: AttendanceCourse[] | undefined;
  /** Target attendance, in percent (VIT default 75). */
  targetPct: number;
  /** How many rows to show; the riskiest courses come first. */
  limit?: number;
  onCourseClick?: (courseCode: string) => void;
  /** Opens the full attendance page from the section header. */
  onViewAll?: () => void;
  className?: string;
}

interface Row {
  code: string;
  title: string;
  slot: string;
  attended: number;
  total: number;
  pct: number;
  label: string;
  status: "safe" | "edge" | "short";
  /** Lower is riskier: negative while short, then the skips left. */
  risk: number;
}

function isUsable(c: AttendanceCourse): boolean {
  const slot = String(c.slotName || "").trim().toUpperCase();
  const code = String(c.courseCode || "").trim().toUpperCase();
  const total = Number(c.totalClasses) || 0;
  return Boolean(code) && code !== "NIL" && !slot.includes("NULL") && slot !== "NIL" && total > 0;
}

/**
 * Calm Notebook home block: attendance as a short list, riskiest first. Each row
 * leads with the course's own hue, names the slot, and says what to do next
 * ("Attend next 1", "Can skip 6") instead of showing a bare percentage.
 * Lab slots meet as two-period sessions, so their budgets are counted in labs.
 */
export default function HomeAttendanceList({
  courses,
  targetPct,
  limit = 4,
  onCourseClick,
  onViewAll,
  className,
}: Props) {
  const rows = useMemo<Row[]>(() => {
    if (!Array.isArray(courses)) return [];
    const threshold = Math.min(0.99, Math.max(0.01, targetPct / 100));
    return courses.filter(isUsable).map((c) => {
      const attended = Number(c.attendedClasses) || 0;
      const total = Number(c.totalClasses) || 0;
      const slot = String(c.slotName || "").trim();
      const isLab = slot.toUpperCase().startsWith("L");
      const b = attendanceBudget(Math.min(attended, total), total, threshold);
      const per = isLab ? 2 : 1;
      const skip = Math.floor(b.canSkip / per);
      const need = Math.ceil(b.mustAttend / per);
      const unit = isLab ? "lab" : "";
      const label =
        b.status === "short"
          ? `attend next ${need}${unit ? ` ${unit}${need > 1 ? "s" : ""}` : ""}`
          : skip > 0
            ? `can skip ${skip}${unit ? ` ${unit}${skip > 1 ? "s" : ""}` : ""}`
            : "no skips left";
      return {
        code: String(c.courseCode).trim(),
        title: String(c.courseTitle || c.courseCode).trim(),
        slot,
        attended,
        total,
        pct: b.percent ?? 0,
        label,
        status: b.status === "short" ? "short" : skip > 0 ? "safe" : "edge",
        risk: b.status === "short" ? -need : skip,
      };
    });
  }, [courses, targetPct]);

  const shown = useMemo(
    () => [...rows].sort((a, b) => a.risk - b.risk || a.pct - b.pct).slice(0, limit),
    [rows, limit],
  );

  if (shown.length === 0) return null;

  return (
    <section aria-label="Attendance" className={cn("text-left", className)}>
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <h2 className="text-[13.5px] font-semibold text-ink">Attendance</h2>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="text-[13px] text-accent hover:underline">
            All {rows.length} courses
          </button>
        ) : (
          <span className="text-[12.5px] text-muted">{rows.length} courses</span>
        )}
      </div>
      <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
        {shown.map((r) => (
          <li key={`${r.code}-${r.slot}`}>
            <button
              type="button"
              onClick={() => onCourseClick?.(r.code)}
              className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <CourseDot course={r.code} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-ink">{r.title}</span>
                <span className="block font-mono text-[12px] text-muted">{r.slot}</span>
              </span>
              <span className="text-right">
                <span
                  className={cn(
                    "block font-mono text-[14px] font-semibold tabular-nums",
                    r.status === "short" ? "text-danger" : "text-ink",
                  )}
                >
                  {Math.round(r.pct)}%
                </span>
                <span
                  className={cn(
                    "block text-[12px]",
                    r.status === "short" ? "text-danger" : r.status === "edge" ? "text-warn" : "text-muted",
                  )}
                >
                  {r.label}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
