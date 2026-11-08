"use client";

import { AttendanceBar, attendanceAfter, attendanceBudget } from "@amazecontinuityprojects/amazeui";
import { cn } from "@/lib/utils";

interface AttItem {
  attendedClasses?: string | number;
  totalClasses?: string | number;
  slotName?: string;
}

interface Part {
  label: "Theory" | "Lab";
  item: AttItem;
}

function counts(item: AttItem) {
  const attended = Number(item?.attendedClasses) || 0;
  const total = Number(item?.totalClasses) || 0;
  return { attended: Math.min(attended, total), total };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Calm Notebook attendance hero for a course (canvas "Attendance detail").
 * The percentage is the headline, the bar shows the distance to the line, and
 * one sentence says what to do. Labs meet as two-period sessions, so their
 * budgets are counted in labs.
 */
export default function CourseAttendanceHero({
  parts,
  targetPct,
  course,
}: {
  parts: Part[];
  targetPct: number;
  course: string;
}) {
  const usable = parts.filter((p) => counts(p.item).total > 0);
  if (usable.length === 0) return null;
  const threshold = Math.min(0.99, Math.max(0.01, targetPct / 100));
  const describe = (p: Part) => {
    const { attended, total } = counts(p.item);
    const b = attendanceBudget(attended, total, threshold);
    const per = p.label === "Lab" ? 2 : 1;
    const unit = p.label === "Lab" ? "lab" : "class";
    const need = Math.ceil(b.mustAttend / per);
    const skip = Math.floor(b.canSkip / per);
    const pct = b.percent ?? 0;
    // Early in term a perfect record still has no skips; that is not "on the line".
    const early = b.status !== "short" && skip === 0 && pct >= targetPct + 10;
    const status: "short" | "edge" | "safe" = b.status === "short" ? "short" : skip > 0 || early ? "safe" : "edge";
    const after = attendanceAfter(attended, total, -per);
    const sentence =
      status === "short"
        ? `Attend the next ${need === 1 ? unit : plural(need, unit)} to get back to ${targetPct}%.`
        : early
          ? `Early in the term: missing the next ${unit} would take you to ${after.toFixed(1)}%.`
          : status === "edge"
            ? `No skips left. Missing the next ${unit} puts you below ${targetPct}%.`
            : `You can miss ${plural(skip, unit)} and stay at ${targetPct}% or above.`;
    return { attended, total, pct, status, sentence, need, skip };
  };

  // The part that needs attention leads.
  const rank = (p: Part) => {
    const d = describe(p);
    return d.status === "short" ? -100 + -d.need : d.status === "edge" ? 0 : d.skip;
  };
  const [main, ...rest] = [...usable].sort((a, b) => rank(a) - rank(b));

  const m = describe(main);
  const pill =
    m.status === "short"
      ? { text: `Below ${targetPct}%`, cls: "bg-danger-soft text-danger" }
      : m.status === "edge"
        ? { text: "On the line", cls: "bg-warn-soft text-warn" }
        : { text: "Safe", cls: "bg-ok-soft text-ok" };
  const per = main.label === "Lab" ? 2 : 1;
  const u = main.label === "Lab" ? "lab" : "class";
  const whatIf = [
    { label: `Miss next ${u}`, value: attendanceAfter(m.attended, m.total, -per) },
    { label: `Attend next ${u}`, value: attendanceAfter(m.attended, m.total, per) },
    { label: `Attend next 3`, value: attendanceAfter(m.attended, m.total, 3 * per) },
  ];

  return (
    <div className="space-y-4">
      <section aria-label={`${main.label} attendance`} className="rounded-md border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={cn(
                "text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
                m.status === "short" ? "text-danger" : "text-ink",
              )}
            >
              {m.pct.toFixed(1)}%
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {usable.length > 1 ? `${main.label} · ` : ""}
              {m.attended} of {m.total} {main.label === "Lab" ? "periods" : "classes"} attended
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium", pill.cls)}>{pill.text}</span>
        </div>
        <AttendanceBar
          className="mt-4"
          attended={m.attended}
          held={m.total}
          threshold={threshold}
          course={course}
        />
        <p className="mt-4 border-t border-line-2 pt-3 text-[14px] leading-relaxed text-ink">{m.sentence}</p>

        {rest.map((p) => {
          const r = describe(p);
          return (
            <div key={p.label} className="mt-3 border-t border-line-2 pt-3">
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-ink-2">
                  {p.label} · {r.attended} of {r.total}
                </span>
                <span className={cn("font-semibold tabular-nums", r.status === "short" ? "text-danger" : "text-ink")}>
                  {r.pct.toFixed(1)}%
                </span>
              </div>
              <AttendanceBar className="mt-2" size="sm" attended={r.attended} held={r.total} threshold={threshold} course={course} />
              <p className={cn("mt-2 text-[12.5px]", r.status === "short" ? "text-danger" : "text-muted")}>{r.sentence}</p>
            </div>
          );
        })}
      </section>

      <section aria-label="What if">
        <h2 className="px-0.5 pb-2 text-[13.5px] font-semibold text-ink">What if</h2>
        <div className="grid grid-cols-3 gap-2">
          {whatIf.map((w) => (
            <div key={w.label} className="rounded-md border border-line bg-surface px-3 py-2.5">
              <p className="text-[11.5px] text-muted">{w.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-[18px] font-semibold tracking-tight tabular-nums",
                  w.value < targetPct ? "text-danger" : w.value >= targetPct + 1 ? "text-ok" : "text-ink",
                )}
              >
                {w.value.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
